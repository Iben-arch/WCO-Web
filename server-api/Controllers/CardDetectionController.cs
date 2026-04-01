using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using ServerApi.Services;

namespace ServerApi.Controllers
{
    /// <summary>
    /// API for card detection and lens-like image search (CLIP + pgvector).
    /// </summary>
    [ApiController]
    [Route("api/card-detection")]
    public class CardDetectionController : BaseController
    {
        private readonly CardDetectionService _cardDetection;
        private readonly SupabaseService _supabaseService;
        private readonly ClipEmbeddingService _clipEmbedding;
        private readonly IConfiguration _configuration;

        private const int MaxQueryCards = 12;
        private const int DefaultMaxResults = 12;
        private const int RpcMatchLimitPerEmbedding = 30;
        private const double DefaultMinSimilarityScore = 0.7;

        public CardDetectionController(
            CardDetectionService cardDetection,
            SupabaseService supabaseService,
            ClipEmbeddingService clipEmbedding,
            IConfiguration configuration)
        {
            _cardDetection = cardDetection;
            _supabaseService = supabaseService;
            _clipEmbedding = clipEmbedding;
            _configuration = configuration;
        }

        /// <summary>CLIP cosine similarity floor (0–1). Config: ImageSearch:MinSimilarityScore</summary>
        private double MinSimilarityScore
        {
            get
            {
                var raw = _configuration["ImageSearch:MinSimilarityScore"];
                if (string.IsNullOrWhiteSpace(raw) || !double.TryParse(raw, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var v))
                    v = DefaultMinSimilarityScore;
                return Math.Clamp(v, 0.0, 1.0);
            }
        }

        /// <summary>
        /// Detect and crop cards from image. Returns cards with imageUrl (data URL base64) per card.
        /// </summary>
        [HttpPost("detect")]
        public async Task<IActionResult> Detect([FromForm] IFormFile? image, [FromForm] string? cardType, CancellationToken cancellationToken)
        {
            if (image == null || image.Length == 0)
                return BadRequest(new { success = false, error = "กรุณาส่งรูปภาพ" });

            try
            {
                await using var stream = image.OpenReadStream();
                var cards = await _cardDetection.DetectAndCropAsync(stream, cancellationToken).ConfigureAwait(false);
                return Ok(new { success = true, cards });
            }
            catch
            {
                return Ok(new { success = true, cards = Array.Empty<object>() });
            }
        }

        /// <summary>
        /// Process post images (used by PostDetail). Stub - returns empty cards.
        /// </summary>
        [HttpPost("process-post")]
        public IActionResult ProcessPost([FromBody] ProcessPostRequest? request)
        {
            if (request?.ImageUrls == null || request.ImageUrls.Count == 0)
                return BadRequest(new { success = false, error = "ไม่พบภาพในโพสต์นี้" });

            return Ok(new
            {
                success = true,
                cards = Array.Empty<object>()
            });
        }

        /// <summary>
        /// Search similar posts using CLIP embeddings + pgvector (lens-like).
        /// </summary>
        [HttpPost("search")]
        [RequestSizeLimit(30_000_000)]
        public async Task<IActionResult> SearchSimilar(
            [FromForm] List<IFormFile>? images,
            [FromForm] int? maxResults,
            CancellationToken cancellationToken)
        {
            try
            {
                if (images == null || images.Count == 0)
                    return BadRequest(new { success = false, error = "กรุณาส่งรูปภาพอย่างน้อย 1 รูป" });

                var effectiveMaxResults = Math.Clamp(maxResults ?? DefaultMaxResults, 5, 30);

                // 1) Detect/crop query cards -> data URLs
                var dataUrls = new List<string>(capacity: 32);
                foreach (var image in images)
                {
                    if (image == null || image.Length == 0) continue;
                    await using var stream = image.OpenReadStream();
                    var detectedCards = await _cardDetection.DetectAndCropAsync(stream, cancellationToken).ConfigureAwait(false);
                    foreach (var card in detectedCards)
                    {
                        if (card.ImageUrl == null) continue;
                        dataUrls.Add(card.ImageUrl);
                        if (dataUrls.Count >= MaxQueryCards) break;
                    }
                    if (dataUrls.Count >= MaxQueryCards) break;
                }

                if (dataUrls.Count == 0)
                    return Ok(new { success = true, posts = Array.Empty<object>(), matchedCards = 0 });

                // 2) CLIP embeddings for query cards
                var queryEmbeddings = await _clipEmbedding.GetEmbeddingsAsync(dataUrls, cancellationToken).ConfigureAwait(false);
                if (queryEmbeddings == null || queryEmbeddings.Count == 0)
                    return Ok(new { success = true, posts = Array.Empty<object>(), matchedCards = 0 });

                // 3) RPC match per query embedding, merge by best score per post
                var postIdToScore = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);
                foreach (var embedding in queryEmbeddings)
                {
                    if (embedding == null || embedding.Length == 0) continue;
                    // Send as pgvector text format to avoid PostgREST 400 with double precision[]
                    var vectorStr = "[" + string.Join(",", System.Array.ConvertAll(embedding, x => x.ToString("G", System.Globalization.CultureInfo.InvariantCulture))) + "]";
                    var rpcParams = new Dictionary<string, object>
                    {
                        ["query_embedding"] = vectorStr,
                        ["match_limit"] = RpcMatchLimitPerEmbedding,
                        ["match_status"] = "active",
                        ["match_threshold"] = MinSimilarityScore
                    };
                    var rows = await _supabaseService.RpcAsync("match_posts_by_embedding", rpcParams, useServiceRole: true).ConfigureAwait(false);
                    foreach (var row in rows)
                    {
                        if (!row.TryGetValue("postId", out var idObj) || idObj == null) continue;
                        var postId = idObj.ToString();
                        if (string.IsNullOrEmpty(postId)) continue;
                        var score = row.TryGetValue("score", out var sObj) && sObj != null ? Convert.ToDouble(sObj) : 0d;
                        if (!postIdToScore.TryGetValue(postId, out var existing) || score > existing)
                            postIdToScore[postId] = score;
                    }
                }

                var ordered = postIdToScore.OrderByDescending(x => x.Value).Take(effectiveMaxResults).ToList();
                var posts = new List<object>();
                foreach (var (postId, score) in ordered)
                {
                    var post = await _supabaseService.GetAsync("posts", postId, useServiceRole: true).ConfigureAwait(false);
                    if (post == null) continue;
                    NormalizePostImages(post);
                    post["imageSearchScore"] = score;
                    posts.Add(post);
                }

                return Ok(new { success = true, posts, matchedCards = queryEmbeddings.Count });
            }
            catch (OperationCanceledException)
            {
                return StatusCode(499, new { success = false, error = "Request cancelled" });
            }
            catch (Exception ex)
            {
                // Log so server console shows the real cause (e.g. RPC not found, CLIP worker down, card detection failure)
                Console.WriteLine($"❌ [card-detection/search] {ex.GetType().Name}: {ex.Message}");
                if (ex.InnerException != null)
                    Console.WriteLine($"   Inner: {ex.InnerException.Message}");
                // 404 from Supabase RPC = match_posts_by_embedding not created yet
                var msg = ex.Message;
                if (msg.Contains("404") && (msg.Contains("Not Found") || msg.Contains("NotFound")))
                    msg = "Image search is not set up. In Supabase Dashboard → SQL Editor, run the script: client-web/supabase-image-embeddings-setup.sql";
                return StatusCode(500, new
                {
                    success = false,
                    error = "เกิดข้อผิดพลาดในการค้นหาด้วยรูปภาพ",
                    message = msg
                });
            }
        }

        private static void NormalizePostImages(Dictionary<string, object> post)
        {
            if (!post.TryGetValue("images", out var imagesObj) || imagesObj == null) return;

            var list = ExtractStringList(imagesObj);
            post["images"] = list;
        }

        private static List<string> ExtractStringList(object imagesObj)
        {
            if (imagesObj is List<string> ls)
                return ls.Where(s => !string.IsNullOrWhiteSpace(s)).ToList();

            if (imagesObj is List<object> lo)
                return lo.Select(x => x?.ToString() ?? "")
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .ToList();

            // Supabase may return a JsonElement sometimes, depending on serializer path.
            if (imagesObj is System.Text.Json.JsonElement je && je.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                var res = new List<string>();
                foreach (var item in je.EnumerateArray())
                {
                    var s = item.GetString();
                    if (!string.IsNullOrWhiteSpace(s)) res.Add(s);
                }
                return res;
            }

            return new List<string>();
        }
    }

    public class ProcessPostRequest
    {
        public string? PostId { get; set; }
        public List<string>? ImageUrls { get; set; }
    }
}

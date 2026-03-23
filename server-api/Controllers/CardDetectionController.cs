using Microsoft.AspNetCore.Mvc;
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

        private const int MaxQueryCards = 12;
        private const int DefaultMaxResults = 12;
        private const int RpcMatchLimitPerEmbedding = 30;
        private const int SimilarByPostDefaultLimit = 8;
        private const int SimilarByPostMaxEmbeddings = 3; // use first N embeddings to limit RPC calls

        public CardDetectionController(
            CardDetectionService cardDetection,
            SupabaseService supabaseService,
            ClipEmbeddingService clipEmbedding)
        {
            _cardDetection = cardDetection;
            _supabaseService = supabaseService;
            _clipEmbedding = clipEmbedding;
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
        /// Get similar posts by post ID using existing embeddings (AI Similar Cards Recommendation).
        /// Returns 6-8 posts that are visually similar or same category based on CLIP embeddings.
        /// </summary>
        [HttpGet("similar/{postId}")]
        public async Task<IActionResult> GetSimilarByPostId(string postId, [FromQuery] int limit = SimilarByPostDefaultLimit, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(postId))
                return BadRequest(new { success = false, error = "กรุณาระบุ postId" });

            try
            {
                var effectiveLimit = Math.Clamp(limit, 1, 12);

                // 1) ดึง embeddings ของโพสต์นี้จาก post_image_embeddings
                var embeddingRows = await _supabaseService.QueryAsync(
                    "post_image_embeddings",
                    "postId",
                    postId.Trim(),
                    useServiceRole: true
                ).ConfigureAwait(false);

                if (embeddingRows == null || embeddingRows.Count == 0)
                    return Ok(new { success = true, posts = Array.Empty<object>() });

                // 2) ใช้ embedding แรก (หรือหลายตัว) เพื่อค้นหาโพสต์คล้ายกัน
                var postIdToScore = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);
                var embeddingsUsed = 0;

                foreach (var row in embeddingRows)
                {
                    if (embeddingsUsed >= SimilarByPostMaxEmbeddings) break;
                    if (!row.TryGetValue("embedding", out var embObj) || embObj == null) continue;

                    // pgvector returns as string "[0.1,-0.2,...]" or as array
                    var vectorStr = EmbObjToVectorString(embObj);
                    if (string.IsNullOrEmpty(vectorStr)) continue;

                    var rpcParams = new Dictionary<string, object>
                    {
                        ["query_embedding"] = vectorStr,
                        ["match_limit"] = effectiveLimit + 5, // fetch extra to exclude self
                        ["match_status"] = "active"
                    };
                    var rows = await _supabaseService.RpcAsync("match_posts_by_embedding", rpcParams, useServiceRole: true).ConfigureAwait(false);

                    foreach (var r in rows)
                    {
                        if (!r.TryGetValue("postId", out var idObj) || idObj == null) continue;
                        var matchedId = idObj.ToString();
                        if (string.IsNullOrEmpty(matchedId) || string.Equals(matchedId, postId, StringComparison.OrdinalIgnoreCase))
                            continue;
                        var score = r.TryGetValue("score", out var sObj) && sObj != null ? Convert.ToDouble(sObj) : 0d;
                        if (!postIdToScore.TryGetValue(matchedId, out var existing) || score > existing)
                            postIdToScore[matchedId] = score;
                    }
                    embeddingsUsed++;
                }

                var ordered = postIdToScore.OrderByDescending(x => x.Value).Take(effectiveLimit).ToList();
                var posts = new List<object>();
                foreach (var (matchedPostId, score) in ordered)
                {
                    var post = await _supabaseService.GetAsync("posts", matchedPostId, useServiceRole: true).ConfigureAwait(false);
                    if (post == null) continue;
                    NormalizePostImages(post);
                    post["imageSearchScore"] = score;
                    posts.Add(post);
                }

                return Ok(new { success = true, posts });
            }
            catch (OperationCanceledException)
            {
                return StatusCode(499, new { success = false, error = "Request cancelled" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ [card-detection/similar] {ex.GetType().Name}: {ex.Message}");
                var msg = ex.Message;
                if (msg.Contains("404") && (msg.Contains("Not Found") || msg.Contains("NotFound")))
                    msg = "Image search is not set up. Run supabase-image-embeddings-setup.sql";
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาดในการดึงการ์ดคล้ายกัน", message = msg });
            }
        }

        private static string? EmbObjToVectorString(object embObj)
        {
            if (embObj is string s && !string.IsNullOrWhiteSpace(s) && s.StartsWith("["))
                return s;
            if (embObj is List<object> list)
            {
                var parts = list.Select(x => x?.ToString() ?? "0").ToArray();
                return "[" + string.Join(",", parts) + "]";
            }
            if (embObj is float[] fa)
                return "[" + string.Join(",", fa.Select(x => x.ToString("G", System.Globalization.CultureInfo.InvariantCulture))) + "]";
            if (embObj is double[] da)
                return "[" + string.Join(",", da.Select(x => x.ToString("G", System.Globalization.CultureInfo.InvariantCulture))) + "]";
            return null;
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
                        ["match_status"] = "active"
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

        private static string? ExtractFirstImageUrl(Dictionary<string, object> post)
        {
            if (!post.TryGetValue("images", out var imagesObj) || imagesObj == null) return null;
            var images = ExtractStringList(imagesObj);
            return images.Count > 0 ? images[0] : null;
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

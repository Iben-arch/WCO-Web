using Microsoft.Extensions.Logging;

namespace ServerApi.Services
{
    /// <summary>
    /// Background indexing: for a new post, download images -> crop cards -> CLIP embed -> insert into post_image_embeddings.
    /// </summary>
    public class PostEmbeddingIndexingService
    {
        private readonly CardDetectionService _cardDetection;
        private readonly ClipEmbeddingService _clipEmbedding;
        private readonly SupabaseService _supabaseService;
        private readonly HttpClient _httpClient;
        private readonly ILogger<PostEmbeddingIndexingService> _logger;

        public PostEmbeddingIndexingService(
            CardDetectionService cardDetection,
            ClipEmbeddingService clipEmbedding,
            SupabaseService supabaseService,
            IHttpClientFactory httpClientFactory,
            ILogger<PostEmbeddingIndexingService> logger)
        {
            _cardDetection = cardDetection;
            _clipEmbedding = clipEmbedding;
            _supabaseService = supabaseService;
            _httpClient = httpClientFactory.CreateClient();
            _httpClient.Timeout = TimeSpan.FromSeconds(30);
            _logger = logger;
        }

        /// <summary>
        /// For each image URL: download -> detect/crop cards -> get CLIP embeddings -> insert into post_image_embeddings.
        /// Call this in a background task after post create (do not block response).
        /// </summary>
        public async Task IndexPostImagesAsync(string postId, IReadOnlyList<string> imageUrls, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrEmpty(postId) || imageUrls == null || imageUrls.Count == 0)
            {
                _logger.LogWarning("IndexPostImagesAsync skipped: postId or imageUrls empty. postId={PostId}, count={Count}", postId ?? "(null)", imageUrls?.Count ?? 0);
                return;
            }

            _logger.LogInformation("Indexing post {PostId} with {Count} image URL(s)", postId, imageUrls.Count);

            var dataUrls = new List<string>();
            var meta = new List<(string SourceImageUrl, int CardIndex)>();

            foreach (var imageUrl in imageUrls)
            {
                if (string.IsNullOrWhiteSpace(imageUrl)) continue;
                byte[] bytes;
                try
                {
                    bytes = await _httpClient.GetByteArrayAsync(imageUrl, cancellationToken).ConfigureAwait(false);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to download image for indexing: {Url}", imageUrl.Length > 80 ? imageUrl[..80] + "..." : imageUrl);
                    continue;
                }
                if (bytes == null || bytes.Length == 0)
                {
                    _logger.LogWarning("Empty response for image: {Url}", imageUrl.Length > 80 ? imageUrl[..80] + "..." : imageUrl);
                    continue;
                }
                await using var ms = new MemoryStream(bytes);
                var cards = await _cardDetection.DetectAndCropAsync(ms, cancellationToken).ConfigureAwait(false);
                if (cards.Count > 0)
                {
                    for (int i = 0; i < cards.Count; i++)
                    {
                        if (cards[i].ImageUrl == null) continue;
                        dataUrls.Add(cards[i].ImageUrl);
                        meta.Add((imageUrl, i));
                    }
                    _logger.LogInformation("  URL: {N} card(s) detected", cards.Count);
                }
                else
                {
                    // รูปการ์ดเดี่ยว (เช่นจาก individualCards) อาจ crop ไม่เจอ — ใช้ทั้งรูปเป็น 1 การ์ด
                    var dataUrl = "data:image/jpeg;base64," + Convert.ToBase64String(bytes);
                    dataUrls.Add(dataUrl);
                    meta.Add((imageUrl, 0));
                    _logger.LogInformation("  URL: 0 cards detected, using full image as 1 card");
                }
            }

            if (dataUrls.Count == 0)
            {
                _logger.LogWarning("No images to embed for post {PostId}", postId);
                return;
            }

            _logger.LogInformation("Getting CLIP embeddings for {N} image(s)...", dataUrls.Count);
            var embeddings = await _clipEmbedding.GetEmbeddingsAsync(dataUrls, cancellationToken).ConfigureAwait(false);
            if (embeddings == null || embeddings.Count != dataUrls.Count)
            {
                _logger.LogWarning("CLIP returned {Got} embeddings, expected {Expected}. Skipping insert for post {PostId}.", embeddings?.Count ?? 0, dataUrls.Count, postId);
                return;
            }

            var rows = new List<Dictionary<string, object>>();
            for (int i = 0; i < embeddings.Count; i++)
            {
                rows.Add(new Dictionary<string, object>
                {
                    ["postId"] = postId,
                    ["sourceImageUrl"] = meta[i].SourceImageUrl,
                    ["cardIndex"] = meta[i].CardIndex,
                    ["embedding"] = embeddings[i]
                });
            }

            try
            {
                await _supabaseService.InsertManyAsync("post_image_embeddings", rows, useServiceRole: true).ConfigureAwait(false);
                _logger.LogInformation("Indexed {N} row(s) for post {PostId}", rows.Count, postId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to insert post_image_embeddings for post {PostId}", postId);
                throw;
            }
        }
    }
}

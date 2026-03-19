using System.Net.Http.Json;
using System.Text.Json;

namespace ServerApi.Services
{
    /// <summary>
    /// Calls the self-hosted CLIP worker to get 512-dim image embeddings.
    /// </summary>
    public class ClipEmbeddingService
    {
        private readonly string _baseUrl;
        private readonly HttpClient _httpClient;
        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        public ClipEmbeddingService(IConfiguration configuration, IHttpClientFactory httpClientFactory)
        {
            _baseUrl = (configuration["ClipWorker:BaseUrl"] ?? "http://localhost:5000").TrimEnd('/');
            _httpClient = httpClientFactory.CreateClient("ClipWorker");
        }

        /// <summary>
        /// Get embeddings for a list of images (data URLs or base64 strings).
        /// Returns one 512-dim vector per image, or empty list on failure after retry.
        /// </summary>
        public async Task<List<float[]>> GetEmbeddingsAsync(
            List<string> imageDataUrls,
            CancellationToken cancellationToken = default)
        {
            if (imageDataUrls == null || imageDataUrls.Count == 0)
                return new List<float[]>();

            var payload = new { images = imageDataUrls };
            const int maxRetries = 2;
            for (int attempt = 1; attempt <= maxRetries; attempt++)
            {
                try
                {
                    var response = await _httpClient.PostAsJsonAsync($"{_baseUrl}/embed", payload, JsonOptions, cancellationToken)
                        .ConfigureAwait(false);
                    response.EnsureSuccessStatusCode();
                    var body = await response.Content.ReadFromJsonAsync<EmbedResponse>(JsonOptions, cancellationToken)
                        .ConfigureAwait(false);
                    if (body?.Embeddings == null) return new List<float[]>();
                    return body.Embeddings.Select(x => x.ToArray()).ToList();
                }
                catch (Exception ex) when (attempt < maxRetries)
                {
                    Console.WriteLine($"⚠️ CLIP worker /embed attempt {attempt} failed: {ex.Message}");
                }
            }

            return new List<float[]>();
        }

        private class EmbedResponse
        {
            public List<List<float>> Embeddings { get; set; } = new();
        }
    }
}

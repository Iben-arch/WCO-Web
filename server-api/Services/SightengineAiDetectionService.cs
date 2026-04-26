using System.Text.Json;

namespace ServerApi.Services
{
    /// <summary>
    /// Calls the Sightengine "ai-generated" model to determine whether an image was
    /// created by an AI image generator (Midjourney, DALL·E, Stable Diffusion, etc.).
    ///
    /// Configuration keys (appsettings.json → "Sightengine"):
    ///   ApiUser   – Sightengine account API user ID
    ///   ApiSecret – Sightengine account API secret
    ///
    /// If either key is absent the service is considered unconfigured and returns null,
    /// allowing the caller to fall back to the local heuristic estimate.
    ///
    /// Sightengine free tier: 500 ops/month (https://sightengine.com/pricing).
    /// Endpoint: GET https://api.sightengine.com/1.0/check.json
    ///   ?models=genai&url={imageUrl}&api_user={user}&api_secret={secret}
    /// Response shape: { "status": "success", "type": { "ai_generated": 0.95 } }
    /// </summary>
    public class SightengineAiDetectionService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly string? _apiUser;
        private readonly string? _apiSecret;
        private readonly ILogger<SightengineAiDetectionService> _logger;

        public SightengineAiDetectionService(
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration,
            ILogger<SightengineAiDetectionService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _apiUser = configuration["Sightengine:ApiUser"];
            _apiSecret = configuration["Sightengine:ApiSecret"];
            _logger = logger;
        }

        /// <summary>True when API credentials are configured.</summary>
        public bool IsConfigured =>
            !string.IsNullOrWhiteSpace(_apiUser) && !string.IsNullOrWhiteSpace(_apiSecret);

        /// <summary>
        /// Returns probability (0–100) that the image was AI-generated,
        /// or null when the service is unconfigured or the request fails.
        /// Response shape: { "type": { "ai_generated": 0.95 } }
        /// </summary>
        /// <param name="imageUrl">Publicly accessible URL of the image to analyse.</param>
        public async Task<double?> GetAiGeneratedRiskPctAsync(
            string imageUrl,
            CancellationToken cancellationToken = default)
        {
            if (!IsConfigured)
            {
                _logger.LogWarning("[Sightengine] Service not configured — ApiUser or ApiSecret is missing. Skipping AI-generated check.");
                return null;
            }

            try
            {
                var client = _httpClientFactory.CreateClient("Sightengine");
                // Correct model name is "genai" (not "ai-generated").
                var url = "https://api.sightengine.com/1.0/check.json"
                        + $"?models=genai"
                        + $"&url={Uri.EscapeDataString(imageUrl)}"
                        + $"&api_user={Uri.EscapeDataString(_apiUser!)}"
                        + $"&api_secret={Uri.EscapeDataString(_apiSecret!)}";

                _logger.LogInformation("[Sightengine] Calling API for {ImageUrl}", imageUrl);
                var response = await client.GetStringAsync(url, cancellationToken).ConfigureAwait(false);
                _logger.LogInformation("[Sightengine] Raw response for {ImageUrl}: {Response}", imageUrl, response);

                using var doc = JsonDocument.Parse(response);
                var root = doc.RootElement;

                if (root.TryGetProperty("status", out var status) &&
                    status.GetString() != "success")
                {
                    _logger.LogWarning("[Sightengine] Non-success status for {ImageUrl}: {Response}",
                        imageUrl, response);
                    return null;
                }

                // Response: { "type": { "ai_generated": 0.95 } }
                if (root.TryGetProperty("type", out var typeEl) &&
                    typeEl.TryGetProperty("ai_generated", out var aiGenScore))
                {
                    var pct = aiGenScore.GetDouble() * 100.0;
                    _logger.LogInformation("[Sightengine] ai_generated={Pct:F1}% for {ImageUrl}", pct, imageUrl);
                    return Math.Round(Math.Clamp(pct, 0, 100), 2);
                }

                _logger.LogWarning("[Sightengine] Response missing type.ai_generated for {ImageUrl}: {Response}",
                    imageUrl, response);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[Sightengine] API call FAILED for {ImageUrl} — falling back to heuristic", imageUrl);
                return null;
            }
        }
    }
}

using System.Text.Json;
using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
namespace ServerApi.Services
{
    /// <summary>
    /// Result returned by ExternalReverseImageService.AnalyzeAsync.
    /// </summary>
    public sealed record ExternalReverseResult
    {
        public double RiskPct { get; init; }
        public int MatchCount { get; init; }
        public bool HasOurDomain { get; init; }
        public string Provider { get; init; } = "";
        public bool AnalysisAvailable { get; init; } = true;
        public string? UnavailableReason { get; init; }
        public string MatchLevel { get; init; } = "unknown";
        /// <summary>Thumbnail/image URLs from target marketplace visual matches — for CLIP composition comparison.</summary>
        public List<string> CandidateImageUrls { get; init; } = new();
        public int TargetMarketplaceMatchCount { get; init; }
        /// <summary>Deduplicated page URLs from Mercari / Yahoo Auctions JP / Magi found in visual matches.</summary>
        public List<string> TargetMarketplacePageLinks { get; init; } = new();
        /// <summary>
        /// Per-match (pageLink, thumbnailUrl) pairs for target marketplace results.
        /// Used for dHash/pHash direct image comparison to confirm same photo (not just same card).
        /// </summary>
        public List<(string Link, string ThumbUrl)> MarketplaceMatchDetails { get; init; } = new();
    }

    public class ExternalReverseImageService
    {
        // Bump this when external scoring logic changes to invalidate in-memory cache keys.
        private const string ScoringVersion = "v10-exact-matches";
        private sealed class CacheEntry
        {
            public required DateTimeOffset StoredAtUtc { get; init; }
            public required ExternalReverseResult Value { get; init; }
        }

        private static readonly ConcurrentDictionary<string, CacheEntry> _cache = new(StringComparer.Ordinal);
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;
        private readonly ILogger<ExternalReverseImageService> _logger;

        public ExternalReverseImageService(
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration,
            ILogger<ExternalReverseImageService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<ExternalReverseResult> AnalyzeAsync(
            string imageUrl,
            bool forceRefresh = false,
            CancellationToken cancellationToken = default)
        {
            var now = DateTimeOffset.UtcNow;
            var freshMinutes = ReadInt("AiModeration:ExternalReverse:CacheMinutes", 30, 1, 1440);
            var staleHours = ReadInt("AiModeration:ExternalReverse:StaleCacheHours", 24, 1, 240);
            var cacheKey = BuildCacheKey(imageUrl);
            if (!forceRefresh && _cache.TryGetValue(cacheKey, out var cached))
            {
                var freshAge = now - cached.StoredAtUtc;
                if (freshAge <= TimeSpan.FromMinutes(freshMinutes))
                    return cached.Value with { Provider = cached.Value.Provider + "(cache)" };
            }

            var provider = (_configuration["AiModeration:ExternalReverse:Provider"] ?? "serpapi").Trim().ToLowerInvariant();
            if (provider != "serpapi")
                return NotAvailable(provider, "provider-not-supported");

            var apiKey = _configuration["AiModeration:ExternalReverse:ApiKey"];
            if (string.IsNullOrWhiteSpace(apiKey))
                return NotAvailable("serpapi(not-configured)", "missing-api-key");

            var timeoutSec = ReadInt("AiModeration:ExternalReverse:TimeoutSeconds", 15, 5, 60);
            var ourDomainTokens = (_configuration["AiModeration:ExternalReverse:OwnDomainTokens"] ?? "")
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(x => x.ToLowerInvariant())
                .ToList();

            try
            {
                var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(timeoutSec);

                // type=exact_matches: finds pages where this EXACT image appears online —
                // same as tapping "ค้นหาภาพเหมือน" (Exact Matches tab) in the mobile Google Lens app.
                // This is fundamentally different from visual_matches (semantic similarity).
                var encodedImage = Uri.EscapeDataString(imageUrl);
                var apiUrl = $"https://serpapi.com/search.json?engine=google_lens&type=exact_matches&url={encodedImage}&api_key={Uri.EscapeDataString(apiKey)}";
                var response = await client.GetAsync(apiUrl, cancellationToken).ConfigureAwait(false);

                var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
                if (!response.IsSuccessStatusCode)
                {
                    var stale = forceRefresh ? null : TryGetStale(cacheKey, now, staleHours);
                    if (stale != null) return stale;
                    return NotAvailable("serpapi(error)", $"http-{(int)response.StatusCode}");
                }
                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;

                var fragments = GetTargetMarketplaceHostFragments();

                // type=exact_matches returns results in "exact_matches" array.
                // Fall back to "visual_matches" in case the API returns a different structure.
                var allMatchesArray = GetArrayProperty(root, "exact_matches")
                    ?? GetArrayProperty(root, "matches")
                    ?? GetArrayProperty(root, "visual_matches")
                    ?? new List<JsonElement>();

                var links = allMatchesArray
                    .Select(item => item.TryGetProperty("link", out var lp) ? lp.GetString() : null)
                    .Where(l => !string.IsNullOrWhiteSpace(l))
                    .Cast<string>()
                    .ToList();

                // Collect (link, thumbUrl) pairs for target marketplace matches — used for dHash comparison.
                var marketplaceMatchDetails = ExtractMarketplaceMatchDetails(allMatchesArray, fragments);

                // Build deduplicated page-link list from match details.
                var targetMarketplacePageLinks = marketplaceMatchDetails
                    .Select(x => x.Link)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .Take(10)
                    .ToList();
                var targetMarketplaceMatchCount = targetMarketplacePageLinks.Count;

                // Also keep flat candidate URL list for CLIP (backward compat).
                var candidateImageUrls = marketplaceMatchDetails
                    .Where(x => !string.IsNullOrWhiteSpace(x.ThumbUrl))
                    .Select(x => x.ThumbUrl)
                    .Take(14)
                    .ToList();

                var matchCount = links.Count;
                var hasOurDomain = links.Any(link =>
                {
                    var low = link.ToLowerInvariant();
                    return ourDomainTokens.Any(token => !string.IsNullOrWhiteSpace(token) && low.Contains(token));
                });

                if (matchCount == 0)
                {
                    var zeroResult = new ExternalReverseResult
                    {
                        RiskPct = 5d, MatchCount = 0, HasOurDomain = false,
                        Provider = "serpapi-lens-exact", AnalysisAvailable = true,
                        MatchLevel = "none", CandidateImageUrls = candidateImageUrls,
                        TargetMarketplaceMatchCount = 0,
                        TargetMarketplacePageLinks = new(),
                        MarketplaceMatchDetails = new()
                    };
                    _cache[cacheKey] = new CacheEntry { StoredAtUtc = now, Value = zeroResult };
                    return zeroResult;
                }

                // exact_matches scoring: every result IS the same photo (or very close).
                // No need for large ambiguity penalties used for visual_matches.
                // dHash in PostModerationAiService still acts as final pixel-level confirmation.
                var distinctDomains = links
                    .Select(GetDomain).Where(d => !string.IsNullOrWhiteSpace(d))
                    .Distinct(StringComparer.OrdinalIgnoreCase).Count();

                var risk = 0d;
                var level = "ambiguous";

                if (targetMarketplaceMatchCount >= 1)
                {
                    // Exact match found on Mercari/Yahoo/Magi = high risk of stolen image.
                    level = "near";
                    risk = Math.Min(85d, 65d + (targetMarketplaceMatchCount * 8d));
                }
                else if (matchCount >= 3)
                {
                    // Multiple exact matches elsewhere → at least copied from somewhere.
                    level = "near";
                    risk = Math.Clamp(45d + (matchCount * 5d), 45d, 75d);
                }
                else if (matchCount >= 1)
                {
                    level = "weak";
                    risk = Math.Clamp(30d + (matchCount * 8d), 30d, 55d);
                }

                var result = new ExternalReverseResult
                {
                    RiskPct = risk, MatchCount = matchCount, HasOurDomain = hasOurDomain,
                    Provider = "serpapi-lens-exact", AnalysisAvailable = true,
                    MatchLevel = level, CandidateImageUrls = candidateImageUrls,
                    TargetMarketplaceMatchCount = targetMarketplaceMatchCount,
                    TargetMarketplacePageLinks = targetMarketplacePageLinks,
                    MarketplaceMatchDetails = marketplaceMatchDetails
                };
                _cache[cacheKey] = new CacheEntry { StoredAtUtc = now, Value = result };
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "External reverse image lookup failed");
                var stale = forceRefresh ? null : TryGetStale(cacheKey, now, staleHours);
                if (stale != null) return stale;
                return NotAvailable("serpapi(error)", "exception");
            }
        }

        private static ExternalReverseResult NotAvailable(string provider, string reason) =>
            new() { Provider = provider, AnalysisAvailable = false, UnavailableReason = reason, MatchLevel = "unknown" };

        private int ReadInt(string key, int fallback, int min, int max)
        {
            var raw = _configuration[key];
            if (!int.TryParse(raw, out var value)) value = fallback;
            return Math.Clamp(value, min, max);
        }

        private static string BuildCacheKey(string imageUrl)
        {
            var normalized = (imageUrl ?? "").Trim() + "|" + ScoringVersion;
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(normalized));
            return Convert.ToHexString(bytes);
        }

        private static ExternalReverseResult? TryGetStale(string cacheKey, DateTimeOffset now, int staleHours)
        {
            if (!_cache.TryGetValue(cacheKey, out var cached)) return null;
            if (now - cached.StoredAtUtc > TimeSpan.FromHours(staleHours)) return null;
            return cached.Value with { Provider = cached.Value.Provider + "(stale-fallback)" };
        }

        private List<string> GetTargetMarketplaceHostFragments()
        {
            var raw = _configuration["AiModeration:ExternalReverse:TargetMarketplaceHostFragments"];
            if (string.IsNullOrWhiteSpace(raw))
                return new List<string> { "mercari", "auctions.yahoo.co.jp", "magi.care", "magi.jp" };
            return raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s.ToLowerInvariant()).ToList();
        }

        private static bool IsTargetMarketplaceHost(string url, List<string> hostFragments)
        {
            var host = GetDomain(url);
            if (string.IsNullOrWhiteSpace(host)) return false;
            return hostFragments.Any(f => host.Contains(f, StringComparison.OrdinalIgnoreCase));
        }

        /// <summary>
        /// Extract (pageLink, thumbnailUrl) pairs for target marketplace pages from the matches list.
        /// These are used for dHash image comparison in PostModerationAiService.
        /// </summary>
        private static List<(string Link, string ThumbUrl)> ExtractMarketplaceMatchDetails(List<JsonElement> items, List<string> hostFragments)
        {
            var results = new List<(string Link, string ThumbUrl)>();
            foreach (var item in items)
            {
                if (item.ValueKind != JsonValueKind.Object) continue;
                if (!item.TryGetProperty("link", out var linkProp)) continue;
                var link = linkProp.GetString();
                if (string.IsNullOrWhiteSpace(link) || !IsTargetMarketplaceHost(link, hostFragments)) continue;

                // Prefer "thumbnail" (smaller, faster), fall back to "image".
                var thumbUrl = GetStringProperty(item, "thumbnail") ?? GetStringProperty(item, "image") ?? "";
                results.Add((link, thumbUrl));
                if (results.Count >= 14) break;
            }
            return results;
        }

        private static List<JsonElement>? GetArrayProperty(JsonElement root, string name)
        {
            if (!root.TryGetProperty(name, out var prop) || prop.ValueKind != JsonValueKind.Array)
                return null;
            var list = prop.EnumerateArray().ToList();
            return list.Count == 0 ? null : list;
        }

        private static string? GetStringProperty(JsonElement obj, string name)
        {
            if (!obj.TryGetProperty(name, out var p)) return null;
            var v = p.GetString();
            return string.IsNullOrWhiteSpace(v) || !Uri.TryCreate(v, UriKind.Absolute, out _) ? null : v;
        }

        private static string GetDomain(string url)
        {
            if (string.IsNullOrWhiteSpace(url)) return "";
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)) return "";
            return uri.Host.ToLowerInvariant();
        }
    }
}

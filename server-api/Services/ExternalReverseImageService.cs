using System.Text.Json;
using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
namespace ServerApi.Services
{
    public class ExternalReverseImageService
    {
        // Bump this when external scoring logic changes to invalidate in-memory cache keys.
        private const string ScoringVersion = "v6-target-marketplaces-only";
        private sealed class CacheEntry
        {
            public required DateTimeOffset StoredAtUtc { get; init; }
            public required (double riskPct, int matchCount, bool hasOurDomain, string provider, bool analysisAvailable, string? unavailableReason, string matchLevel, List<string> candidateImageUrls, int targetMarketplaceMatchCount) Value { get; init; }
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

        public async Task<(double riskPct, int matchCount, bool hasOurDomain, string provider, bool analysisAvailable, string? unavailableReason, string matchLevel, List<string> candidateImageUrls, int targetMarketplaceMatchCount)> AnalyzeAsync(
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
                {
                    var v = cached.Value;
                    return (v.riskPct, v.matchCount, v.hasOurDomain, v.provider + "(cache)", v.analysisAvailable, v.unavailableReason, v.matchLevel, v.candidateImageUrls, v.targetMarketplaceMatchCount);
                }
            }

            var provider = (_configuration["AiModeration:ExternalReverse:Provider"] ?? "serpapi").Trim().ToLowerInvariant();
            if (provider != "serpapi")
                return (0, 0, false, provider, false, "provider-not-supported", "unknown", new List<string>(), 0);

            var apiKey = _configuration["AiModeration:ExternalReverse:ApiKey"];
            if (string.IsNullOrWhiteSpace(apiKey))
                return (0, 0, false, "serpapi(not-configured)", false, "missing-api-key", "unknown", new List<string>(), 0);

            var timeoutSec = ReadInt("AiModeration:ExternalReverse:TimeoutSeconds", 8, 3, 30);
            var ourDomainTokens = (_configuration["AiModeration:ExternalReverse:OwnDomainTokens"] ?? "")
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(x => x.ToLowerInvariant())
                .ToList();

            var encodedImage = Uri.EscapeDataString(imageUrl);
            var url = $"https://serpapi.com/search.json?engine=google_lens&url={encodedImage}&api_key={Uri.EscapeDataString(apiKey)}";

            try
            {
                var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(timeoutSec);
                var response = await client.GetAsync(url, cancellationToken).ConfigureAwait(false);
                var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
                if (!response.IsSuccessStatusCode)
                {
                    var stale = forceRefresh ? null : TryGetStale(cacheKey, now, staleHours);
                    if (stale != null) return stale.Value;
                    return (0, 0, false, "serpapi(error)", false, $"http-{(int)response.StatusCode}", "unknown", new List<string>(), 0);
                }
                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;

                var fragments = GetTargetMarketplaceHostFragments();
                var links = new List<string>();
                if (root.TryGetProperty("visual_matches", out var visualMatches) && visualMatches.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in visualMatches.EnumerateArray())
                    {
                        if (item.TryGetProperty("link", out var linkProp))
                        {
                            var link = linkProp.GetString();
                            if (!string.IsNullOrWhiteSpace(link)) links.Add(link);
                        }
                    }
                }
                var candidateImageUrls = ExtractTargetMarketplaceCandidateImageUrls(root, fragments);
                var targetMarketplaceMatchCount = links.Count(l => IsTargetMarketplaceHost(l, fragments));

                var matchCount = links.Count;
                var hasOurDomain = links.Any(link =>
                {
                    var low = link.ToLowerInvariant();
                    return ourDomainTokens.Any(token => !string.IsNullOrWhiteSpace(token) && low.Contains(token));
                });

                if (matchCount == 0)
                {
                    var zeroResult = (10d, 0, false, "serpapi", true, (string?)null, "none", candidateImageUrls, 0);
                    _cache[cacheKey] = new CacheEntry { StoredAtUtc = now, Value = zeroResult };
                    return zeroResult;
                }

                var externalCount = hasOurDomain
                    ? links.Count(link => !ourDomainTokens.Any(token => link.Contains(token, StringComparison.OrdinalIgnoreCase)))
                    : matchCount;

                var distinctDomains = links
                    .Select(GetDomain)
                    .Where(d => !string.IsNullOrWhiteSpace(d))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .Count();
                var hasMercariHit = links.Any(link => GetDomain(link).Contains("mercari", StringComparison.OrdinalIgnoreCase));

                var marketplaceHits = targetMarketplaceMatchCount;
                var domainGroups = links
                    .Select(GetDomain)
                    .Where(d => !string.IsNullOrWhiteSpace(d))
                    .GroupBy(d => d)
                    .Select(g => g.Count())
                    .OrderByDescending(x => x)
                    .ToList();
                var dominantDomainCount = domainGroups.FirstOrDefault();
                var dominantRatio = matchCount == 0 ? 0 : dominantDomainCount / (double)matchCount;

                // Base risk: prioritize marketplace hits + domain concentration.
                var baseRisk = Math.Min(78, (marketplaceHits * 10) + (Math.Min(distinctDomains, 6) * 5));

                // Ambiguity penalty:
                // many visual matches often means "similar card artwork" rather than exact same photo.
                var ambiguityPenalty = 0;
                if (matchCount >= 60) ambiguityPenalty += 30;
                else if (matchCount >= 40) ambiguityPenalty += 22;
                else if (matchCount >= 25) ambiguityPenalty += 14;
                if (distinctDomains >= 12) ambiguityPenalty += 12;
                else if (distinctDomains >= 8) ambiguityPenalty += 8;

                var risk = Math.Clamp(baseRisk - ambiguityPenalty, 5d, 90d);
                var level = "ambiguous";
                var strictByLowVolume = marketplaceHits > 0 && dominantDomainCount >= 2 && matchCount <= 12;
                // High-volume but concentrated marketplace matches can also indicate
                // the same full photo being reused broadly.
                var strictByConcentratedVolume =
                    marketplaceHits >= 20 &&
                    dominantDomainCount >= 8 &&
                    dominantRatio >= 0.18 &&
                    distinctDomains <= 10;
                // Guardrails for false positives on popular card artwork:
                // high match volume across many listings is often "similar cards",
                // not necessarily the exact same photo/background.
                var highAmbiguityVolume = matchCount >= 35 || distinctDomains >= 12;
                var strictByMercariSignal =
                    hasMercariHit &&
                    matchCount >= 6 &&
                    matchCount <= 20 &&
                    dominantRatio >= 0.45 &&
                    distinctDomains <= 6;
                var strictByDominantDomainVolume =
                    dominantDomainCount >= 12 &&
                    dominantRatio >= 0.55 &&
                    matchCount >= 25 &&
                    distinctDomains <= 7;

                if ((strictByLowVolume || strictByConcentratedVolume || strictByMercariSignal || strictByDominantDomainVolume)
                    && !highAmbiguityVolume)
                {
                    level = "exact_or_near";
                    // Strong signal that the whole photo (card + background composition)
                    // is being reused across external listings. Escalate to 90-100.
                    var strictScore = 90d
                        + Math.Min(10d,
                            (dominantRatio * 8d)
                            + (Math.Min(dominantDomainCount, 12) * 0.6d)
                            + (marketplaceHits >= 20 ? 2.5d : (marketplaceHits >= 3 ? 1.5d : 0d)));
                    risk = Math.Max(risk, Math.Clamp(strictScore, 90d, 100d));
                }
                else if (marketplaceHits > 0 && dominantRatio >= 0.35 && matchCount <= 25)
                {
                    level = "near";
                    risk = Math.Max(risk, 68d);
                }
                else if (marketplaceHits == 0 && matchCount < 8)
                {
                    level = "weak";
                }

                var value = (risk, matchCount, hasOurDomain, "serpapi", true, (string?)null, level, candidateImageUrls, targetMarketplaceMatchCount);
                _cache[cacheKey] = new CacheEntry { StoredAtUtc = now, Value = value };
                return value;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "External reverse image lookup failed");
                var stale = forceRefresh ? null : TryGetStale(cacheKey, now, staleHours);
                if (stale != null) return stale.Value;
                return (0, 0, false, "serpapi(error)", false, "exception", "unknown", new List<string>(), 0);
            }
        }

        private int ReadInt(string key, int fallback, int min, int max)
        {
            var raw = _configuration[key];
            if (!int.TryParse(raw, out var value))
                value = fallback;
            return Math.Clamp(value, min, max);
        }

        private static string BuildCacheKey(string imageUrl)
        {
            var normalized = (imageUrl ?? "").Trim() + "|" + ScoringVersion;
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(normalized));
            return Convert.ToHexString(bytes);
        }

        private static (double riskPct, int matchCount, bool hasOurDomain, string provider, bool analysisAvailable, string? unavailableReason, string matchLevel, List<string> candidateImageUrls, int targetMarketplaceMatchCount)? TryGetStale(
            string cacheKey,
            DateTimeOffset now,
            int staleHours)
        {
            if (!_cache.TryGetValue(cacheKey, out var cached))
                return null;
            if (now - cached.StoredAtUtc > TimeSpan.FromHours(staleHours))
                return null;

            var v = cached.Value;
            return (v.riskPct, v.matchCount, v.hasOurDomain, v.provider + "(stale-fallback)", v.analysisAvailable, v.unavailableReason, v.matchLevel, v.candidateImageUrls, v.targetMarketplaceMatchCount);
        }

        private List<string> GetTargetMarketplaceHostFragments()
        {
            var raw = _configuration["AiModeration:ExternalReverse:TargetMarketplaceHostFragments"];
            if (string.IsNullOrWhiteSpace(raw))
                return new List<string> { "mercari", "auctions.yahoo.co.jp", "magi.care", "magi.jp" };
            return raw
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => s.ToLowerInvariant())
                .ToList();
        }

        private static bool IsTargetMarketplaceHost(string url, List<string> hostFragments)
        {
            var host = GetDomain(url);
            if (string.IsNullOrWhiteSpace(host)) return false;
            foreach (var f in hostFragments)
            {
                if (host.Contains(f, StringComparison.OrdinalIgnoreCase)) return true;
            }
            return false;
        }

        /// <summary>
        /// รูปตัวอย่างสำหรับ CLIP: เฉพาะลิงก์ที่เป็น Mercari / Yahoo! Auctions Japan / Magi (ตั้งค่าได้)
        /// </summary>
        private static List<string> ExtractTargetMarketplaceCandidateImageUrls(JsonElement root, List<string> hostFragments)
        {
            var urls = new List<string>();
            if (!root.TryGetProperty("visual_matches", out var visualMatches) || visualMatches.ValueKind != JsonValueKind.Array)
                return urls;

            foreach (var item in visualMatches.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.Object) continue;
                if (!item.TryGetProperty("link", out var linkProp)) continue;
                var link = linkProp.GetString();
                if (string.IsNullOrWhiteSpace(link) || !IsTargetMarketplaceHost(link, hostFragments)) continue;

                TryAddImageUrl(item, "thumbnail", urls);
                TryAddImageUrl(item, "image", urls);
                if (urls.Count >= 14) break;
            }

            return urls;
        }

        private static void TryAddImageUrl(JsonElement obj, string propertyName, List<string> urls)
        {
            if (!obj.TryGetProperty(propertyName, out var p)) return;
            var value = p.GetString();
            if (string.IsNullOrWhiteSpace(value)) return;
            if (!Uri.TryCreate(value, UriKind.Absolute, out _)) return;
            if (urls.Any(u => string.Equals(u, value, StringComparison.OrdinalIgnoreCase))) return;
            urls.Add(value);
        }

        private static string GetDomain(string url)
        {
            if (string.IsNullOrWhiteSpace(url)) return "";
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)) return "";
            return uri.Host.ToLowerInvariant();
        }

    }
}

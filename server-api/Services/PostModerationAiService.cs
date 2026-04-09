using System.Text.Json;
using System.Numerics;
using System.Runtime.InteropServices;
using Emgu.CV;
using Emgu.CV.CvEnum;

namespace ServerApi.Services
{
    public class AiModerationOptions
    {
        public int WarningThresholdPct { get; set; } = 65;
        public double ExternalSourceWeight { get; set; } = 0.40;
        public double InternalDuplicateWeight { get; set; } = 0.25;
        public double ManipulationWeight { get; set; } = 0.35;
        public int MaxImagesPerPost { get; set; } = 6;
        public int Parallelism { get; set; } = 3;
    }

    public class AiScreeningResult
    {
        public string PostId { get; set; } = "";
        public int WarningThresholdPct { get; set; }
        public double ExternalSourceRiskPct { get; set; }
        public double InternalDuplicateRiskPct { get; set; }
        public double ManipulationRiskPct { get; set; }
        public double OverallRiskPct { get; set; }
        public bool ShouldWarn { get; set; }
        public bool SourceAnalysisAvailable { get; set; } = true;
        public string? SourceUnavailableReason { get; set; }
        public string? SourceProviderStatus { get; set; }
        public bool HasStrongExternalMatch { get; set; }
        /// <summary>สูงสุดของความคล้ายทั้งภาพ (CLIP) กับตัวอย่างจากเว็บอื่น — ใช้เป็นหลักแทนการดูแค่การ์ด</summary>
        public double? MaxCompositionSimilarityPct { get; set; }
        /// <summary>จำนวนลิงก์จาก Mercari / Yahoo! Auctions JP / Magi ในผลค้นหา</summary>
        public int TotalTargetMarketplaceMatchLinks { get; set; }
        /// <summary>danger | warning | safe | unknown</summary>
        public string SourceWarningLevel { get; set; } = "unknown";
        /// <summary>danger | warning | safe — เฉพาะโหมด manipulation / all</summary>
        public string? ManipulationWarningLevel { get; set; }
        /// <summary>danger | warning | safe — ระดับเตือนสำหรับ AI-generated image</summary>
        public string? AiGeneratedWarningLevel { get; set; }
        /// <summary>ความเสี่ยงเฉลี่ยที่รูปสร้างจาก AI (diffusion / GAN) ทุกรูปในโพสต์ — ค่า 0-100</summary>
        public double AiGeneratedRiskPct { get; set; }
        public List<string> Reasons { get; set; } = new();
        public List<AiScreeningImageResult> Images { get; set; } = new();
        /// <summary>รวม URL หน้าเว็บที่พบรูปคล้าย — ทุกแหล่ง (marketplace + เว็บทั่วไป) ทุกรูปในโพสต์</summary>
        public List<string> AllExternalMatchLinks { get; set; } = new();
        /// <summary>
        /// URL หน้าเว็บที่ผ่านการยืนยันด้วย dHash (perceptual hash) ว่าเป็นภาพเดิม ไม่ใช่แค่การ์ดชนิดเดียวกัน
        /// รวมทุกแหล่ง เชื่อถือได้มากกว่า AllExternalMatchLinks
        /// </summary>
        public List<string> DHashConfirmedLinks { get; set; } = new();
        /// <summary>ค่าความคล้ายทั้งภาพสูงสุดจาก dHash (0-100%) — ไม่ต้องรอ CLIP worker</summary>
        public double? MaxDHashSimilarityPct { get; set; }
    }

    public class AiScreeningImageResult
    {
        public string ImageUrl { get; set; } = "";
        public double ExternalSourceRiskPct { get; set; }
        public double InternalDuplicateRiskPct { get; set; }
        public double ManipulationRiskPct { get; set; }
        /// <summary>ความเสี่ยงที่รูปสร้างจาก AI (diffusion / GAN) — ค่า 0-100</summary>
        public double AiGeneratedRiskPct { get; set; }
        public double OverallRiskPct { get; set; }
        public string? InternalBestMatchPostId { get; set; }
        public double? InternalBestSimilarityScore { get; set; }
        public string? ExternalProvider { get; set; }
        public int ExternalMatchCount { get; set; }
        public bool ExternalHasOurDomain { get; set; }
        public string? ExternalMatchLevel { get; set; }
        /// <summary>จำนวนลิงก์ที่เป็น Mercari / Yahoo! Auctions JP / Magi</summary>
        public int TargetMarketplaceMatchCount { get; set; }
        /// <summary>ความคล้ายทั้งภาพกับรูปจากแหล่งภายนอก (CLIP) — รวมทุกเว็บ โฟกัส 3 เว็บหลักเป็นพิเศษ</summary>
        public double? ExternalCompositionSimilarityPct { get; set; }
        /// <summary>URL หน้าเว็บที่พบรูปคล้าย — รวมทุกแหล่ง (marketplace + เว็บทั่วไป)</summary>
        public List<string> ExternalMatchLinks { get; set; } = new();
        /// <summary>URL หน้าเว็บที่ผ่านการยืนยันด้วย dHash ว่าภาพตรงกัน — รวมทุกแหล่ง (เชื่อถือได้)</summary>
        public List<string> DHashConfirmedLinks { get; set; } = new();
        /// <summary>% ความคล้ายสูงสุดจาก dHash เทียบกับ thumbnail ของเว็บที่พบ (0-100)</summary>
        public double? DHashSimilarityPct { get; set; }
        public bool SourceAnalysisAvailable { get; set; } = true;
        public string? SourceUnavailableReason { get; set; }
        public string? Error { get; set; }
    }

    public class PostModerationAiService
    {
        private readonly SupabaseService _supabaseService;
        private readonly ClipEmbeddingService _clipEmbeddingService;
        private readonly ExternalReverseImageService _externalReverseImageService;
        private readonly ImageManipulationDetectionService _imageManipulationService;
        private readonly SightengineAiDetectionService _sightengineService;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly AiModerationOptions _options;
        private readonly ILogger<PostModerationAiService> _logger;

        public PostModerationAiService(
            SupabaseService supabaseService,
            ClipEmbeddingService clipEmbeddingService,
            ExternalReverseImageService externalReverseImageService,
            ImageManipulationDetectionService imageManipulationService,
            SightengineAiDetectionService sightengineService,
            IConfiguration configuration,
            IHttpClientFactory httpClientFactory,
            ILogger<PostModerationAiService> logger)
        {
            _supabaseService = supabaseService;
            _clipEmbeddingService = clipEmbeddingService;
            _externalReverseImageService = externalReverseImageService;
            _imageManipulationService = imageManipulationService;
            _sightengineService = sightengineService;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
            _options = configuration.GetSection("AiModeration").Get<AiModerationOptions>() ?? new AiModerationOptions();
        }

        public async Task<AiScreeningResult> AnalyzePostAsync(string postId, bool forceRefresh = false, CancellationToken cancellationToken = default)
        {
            return await AnalyzePostByModeAsync(postId, "all", forceRefresh, cancellationToken);
        }

        public async Task<AiScreeningResult> AnalyzePostSourceAsync(string postId, bool forceRefresh = false, CancellationToken cancellationToken = default)
        {
            return await AnalyzePostByModeAsync(postId, "source", forceRefresh, cancellationToken);
        }

        public async Task<AiScreeningResult> AnalyzePostManipulationAsync(string postId, bool forceRefresh = false, CancellationToken cancellationToken = default)
        {
            return await AnalyzePostByModeAsync(postId, "manipulation", forceRefresh, cancellationToken);
        }

        private async Task<AiScreeningResult> AnalyzePostByModeAsync(string postId, string mode, bool forceRefresh, CancellationToken cancellationToken)
        {
            var normalizedMode = string.IsNullOrWhiteSpace(mode) ? "all" : mode.Trim().ToLowerInvariant();
            var result = new AiScreeningResult
            {
                PostId = postId,
                WarningThresholdPct = _options.WarningThresholdPct
            };

            var post = await _supabaseService.GetAsync("posts", postId, useServiceRole: true);
            if (post == null)
            {
                result.Reasons.Add("ไม่พบโพสต์");
                return result;
            }

            var imageUrls = ExtractImagesFromPost(post, normalizedMode)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(Math.Max(1, _options.MaxImagesPerPost))
                .ToList();
            if (imageUrls.Count == 0)
            {
                result.Reasons.Add("โพสต์ไม่มีรูปภาพให้วิเคราะห์");
                return result;
            }

            var limiter = new SemaphoreSlim(Math.Max(1, _options.Parallelism));
            var tasks = imageUrls.Select(async url =>
            {
                await limiter.WaitAsync(cancellationToken).ConfigureAwait(false);
                try
                {
                    return await AnalyzeImageAsync(postId, url, normalizedMode, forceRefresh, cancellationToken).ConfigureAwait(false);
                }
                finally
                {
                    limiter.Release();
                }
            }).ToList();

            var perImage = await Task.WhenAll(tasks).ConfigureAwait(false);
            result.Images = perImage.ToList();
            result.SourceAnalysisAvailable = result.Images.Any(x => x.SourceAnalysisAvailable);
            result.SourceProviderStatus = result.Images
                .Select(x => x.ExternalProvider)
                .FirstOrDefault(x => !string.IsNullOrWhiteSpace(x));
            result.HasStrongExternalMatch = result.Images.Any(x =>
                string.Equals(x.ExternalMatchLevel, "exact_or_near", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(x.ExternalMatchLevel, "near", StringComparison.OrdinalIgnoreCase));

            var compValues = result.Images
                .Where(x => x.ExternalCompositionSimilarityPct.HasValue)
                .Select(x => x.ExternalCompositionSimilarityPct!.Value)
                .ToList();
            if (compValues.Count > 0)
                result.MaxCompositionSimilarityPct = RoundPct(compValues.Max());
            result.TotalTargetMarketplaceMatchLinks = result.Images.Sum(x => x.TargetMarketplaceMatchCount);
            result.AllExternalMatchLinks = result.Images
                .SelectMany(x => x.ExternalMatchLinks)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(15)
                .ToList();
            // dHash-confirmed links are the most reliable: only pages where the thumbnail visually matches
            // the post image (not just "same card type").
            result.DHashConfirmedLinks = result.Images
                .SelectMany(x => x.DHashConfirmedLinks)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(15)
                .ToList();
            var dHashValues = result.Images
                .Where(x => x.DHashSimilarityPct.HasValue)
                .Select(x => x.DHashSimilarityPct!.Value)
                .ToList();
            if (dHashValues.Count > 0)
                result.MaxDHashSimilarityPct = RoundPct(dHashValues.Max());

            if (!result.SourceAnalysisAvailable)
            {
                result.SourceUnavailableReason = result.Images
                    .Select(x => x.SourceUnavailableReason)
                    .FirstOrDefault(x => !string.IsNullOrWhiteSpace(x)) ?? "source-analysis-unavailable";
            }

            result.ExternalSourceRiskPct = RoundPct(result.Images.Average(x => x.ExternalSourceRiskPct));
            result.InternalDuplicateRiskPct = RoundPct(result.Images.Average(x => x.InternalDuplicateRiskPct));
            result.ManipulationRiskPct = RoundPct(result.Images.Average(x => x.ManipulationRiskPct));
            result.AiGeneratedRiskPct = RoundPct(result.Images.Average(x => x.AiGeneratedRiskPct));

            if (normalizedMode == "source")
            {
                result.OverallRiskPct = RoundPct((result.ExternalSourceRiskPct * 0.7) + (result.InternalDuplicateRiskPct * 0.3));
                // If we already classify any image as exact_or_near external reuse,
                // promote source overall risk to 90+ for admin warning clarity.
                var hasExactOrNear = result.Images.Any(x =>
                    string.Equals(x.ExternalMatchLevel, "exact_or_near", StringComparison.OrdinalIgnoreCase));
                if (hasExactOrNear)
                {
                    var promoted = Math.Max(90d, result.ExternalSourceRiskPct);
                    result.OverallRiskPct = RoundPct(Math.Min(100d, promoted));
                }
            }
            else if (normalizedMode == "manipulation")
            {
                result.OverallRiskPct = RoundPct(Math.Max(result.ManipulationRiskPct, result.AiGeneratedRiskPct * 0.92));
            }
            else
            {
                var manipComponent = Math.Max(result.ManipulationRiskPct, result.AiGeneratedRiskPct * 0.90);
                result.OverallRiskPct = RoundPct(
                    (result.ExternalSourceRiskPct * _options.ExternalSourceWeight)
                    + (result.InternalDuplicateRiskPct * _options.InternalDuplicateWeight)
                    + (manipComponent * _options.ManipulationWeight));
            }
            result.ShouldWarn = result.OverallRiskPct >= _options.WarningThresholdPct;

            var hasExactOrNearAgg = result.Images.Any(x =>
                string.Equals(x.ExternalMatchLevel, "exact_or_near", StringComparison.OrdinalIgnoreCase));
            if (normalizedMode == "source" || normalizedMode == "all")
            {
                var sourceRiskForLevel = normalizedMode == "source"
                    ? result.OverallRiskPct
                    : result.ExternalSourceRiskPct;
                var totalTargetLinks = result.TotalTargetMarketplaceMatchLinks;
                result.SourceWarningLevel = ComputeSourceWarningLevel(
                    result.SourceAnalysisAvailable,
                    result.MaxCompositionSimilarityPct,
                    sourceRiskForLevel,
                    hasExactOrNearAgg,
                    totalTargetLinks);
            }

            if (normalizedMode == "manipulation" || normalizedMode == "all")
            {
                result.ManipulationWarningLevel = ComputeManipulationWarningLevel(result.ManipulationRiskPct);
                result.AiGeneratedWarningLevel = ComputeAiGeneratedWarningLevel(result.AiGeneratedRiskPct);
            }

            if (result.ExternalSourceRiskPct >= 70)
                result.Reasons.Add("รูปมีแนวโน้มพบจากแหล่งภายนอกในระดับสูง");
            if (result.InternalDuplicateRiskPct >= 70)
                result.Reasons.Add("รูปคล้ายโพสต์อื่นในระบบสูง อาจเป็นรูปซ้ำ");
            if (result.ManipulationRiskPct >= 75)
                result.Reasons.Add("รูปมีความเสี่ยงภาพตัดต่อสูง — ตรวจพบสัญญาณการแก้ไขภาพหลายจุดที่สอดคล้องกัน");
            else if (result.ManipulationRiskPct >= 52)
                result.Reasons.Add("รูปมีสัญญาณบางส่วนที่อาจบ่งชี้การตัดต่อ — ควรพิจารณาเพิ่มเติม");
            if (result.AiGeneratedRiskPct >= 58)
                result.Reasons.Add("รูปมีสัญญาณชัดเจนว่าอาจสร้างจาก AI — ควรตรวจสอบก่อนอนุมัติ");
            else if (result.AiGeneratedRiskPct >= 35)
                result.Reasons.Add("รูปมีสัญญาณบางส่วนที่อาจชี้ว่าสร้างจาก AI");
            if (result.HasStrongExternalMatch)
                result.Reasons.Add("พบรูปเหมือนหรือใกล้เคียงมากในเว็บอื่น ควรตรวจสอบก่อนอนุมัติ");
            var totalTargetForReason = result.TotalTargetMarketplaceMatchLinks;
            if (result.SourceWarningLevel == "danger" && result.MaxCompositionSimilarityPct >= 88 && totalTargetForReason < 32)
                result.Reasons.Insert(0, "ภาพทั้งภาพคล้ายกับ Mercari/Yahoo/Magi มาก (เกือบ 90%) — ควรตรวจสอบก่อนอนุมัติ");
            else if (result.SourceWarningLevel == "danger" && result.MaxCompositionSimilarityPct >= 93 && totalTargetForReason >= 32)
                result.Reasons.Insert(0, "ภาพทั้งภาพคล้ายกับแหล่งอื่นมากมาก — ควรตรวจสอบเพิ่มก่อนอนุมัติ");
            if (result.Reasons.Count == 0)
                result.Reasons.Add("ความเสี่ยงรวมอยู่ในระดับที่ยอมรับได้");
            if (!result.SourceAnalysisAvailable)
                result.Reasons.Add("การวิเคราะห์แหล่งที่มาภายนอกใช้งานไม่ได้ในขณะนี้");

            return result;
        }

        private async Task<AiScreeningImageResult> AnalyzeImageAsync(string currentPostId, string imageUrl, string mode, bool forceRefresh, CancellationToken cancellationToken)
        {
            var item = new AiScreeningImageResult { ImageUrl = imageUrl };
            try
            {
                var httpClient = _httpClientFactory.CreateClient();
                httpClient.Timeout = TimeSpan.FromSeconds(20);
                var bytes = await httpClient.GetByteArrayAsync(imageUrl, cancellationToken).ConfigureAwait(false);
                var dataUrl = "data:image/jpeg;base64," + Convert.ToBase64String(bytes);

                if (mode != "manipulation")
                {
                    try
                    {
                        var internalMatch = await AnalyzeInternalDuplicateAsync(currentPostId, dataUrl, cancellationToken).ConfigureAwait(false);
                        item.InternalDuplicateRiskPct = RoundPct(internalMatch.risk);
                        item.InternalBestMatchPostId = internalMatch.matchPostId;
                        item.InternalBestSimilarityScore = internalMatch.similarity;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Internal duplicate analysis failed for {ImageUrl}", imageUrl);
                        item.Error = AppendError(item.Error, "internal-duplicate-unavailable");
                    }

                    try
                    {
                        var external = await _externalReverseImageService.AnalyzeAsync(imageUrl, forceRefresh, cancellationToken).ConfigureAwait(false);
                        item.ExternalSourceRiskPct = RoundPct(external.RiskPct);
                        item.ExternalProvider = external.Provider;
                        item.ExternalMatchCount = external.MatchCount;
                        item.TargetMarketplaceMatchCount = external.TargetMarketplaceMatchCount;
                        // Include all external page links (marketplace + general), marketplace first.
                        item.ExternalMatchLinks = external.AllMatchDetails
                            .OrderByDescending(x => x.IsTargetMarketplace)
                            .Select(x => x.Link)
                            .Distinct(StringComparer.OrdinalIgnoreCase)
                            .Take(15)
                            .ToList();
                        item.ExternalHasOurDomain = external.HasOurDomain;
                        item.ExternalMatchLevel = external.MatchLevel;
                        item.SourceAnalysisAvailable = external.AnalysisAvailable;
                        item.SourceUnavailableReason = external.UnavailableReason;

                        // dHash comparison: compare post image against ALL external thumbnails directly.
                        // Marketplace matches (Mercari/Yahoo/Magi) get higher risk escalation,
                        // but non-marketplace confirmed matches also raise risk.
                        if (external.AllMatchDetails.Count > 0)
                        {
                            var dHashResult = await ComputeDHashSimilarityAsync(
                                bytes, external.AllMatchDetails, cancellationToken).ConfigureAwait(false);
                            item.DHashConfirmedLinks = dHashResult.MarketplaceConfirmedLinks
                                .Concat(dHashResult.OtherConfirmedLinks)
                                .Distinct(StringComparer.OrdinalIgnoreCase)
                                .ToList();
                            item.DHashSimilarityPct = dHashResult.BestOverallSimilarityPct;

                            // Marketplace-confirmed matches: highest escalation
                            if (dHashResult.BestMarketplaceSimilarityPct.HasValue)
                            {
                                var sim = dHashResult.BestMarketplaceSimilarityPct.Value;
                                if (sim >= 88)
                                {
                                    item.ExternalMatchLevel = "exact_or_near";
                                    item.ExternalSourceRiskPct = Math.Max(item.ExternalSourceRiskPct, 92d);
                                }
                                else if (sim >= 75)
                                {
                                    item.ExternalMatchLevel = "near";
                                    item.ExternalSourceRiskPct = Math.Max(item.ExternalSourceRiskPct, 78d);
                                }
                            }

                            // Non-marketplace confirmed matches: high escalation (slightly below marketplace)
                            if (dHashResult.BestOtherSimilarityPct.HasValue)
                            {
                                var sim = dHashResult.BestOtherSimilarityPct.Value;
                                if (sim >= 88)
                                {
                                    if (item.ExternalMatchLevel != "exact_or_near")
                                        item.ExternalMatchLevel = "near";
                                    item.ExternalSourceRiskPct = Math.Max(item.ExternalSourceRiskPct, 80d);
                                }
                                else if (sim >= 75)
                                {
                                    if (item.ExternalMatchLevel != "exact_or_near" && item.ExternalMatchLevel != "near")
                                        item.ExternalMatchLevel = "weak";
                                    item.ExternalSourceRiskPct = Math.Max(item.ExternalSourceRiskPct, 65d);
                                }
                            }

                            // De-escalate only if ALL comparisons show different images
                            if (dHashResult.MarketplaceConfirmedLinks.Count == 0
                                && dHashResult.OtherConfirmedLinks.Count == 0
                                && dHashResult.BestOverallSimilarityPct.HasValue
                                && dHashResult.BestOverallSimilarityPct.Value < 75)
                            {
                                item.ExternalMatchLevel = "ambiguous";
                                item.ExternalSourceRiskPct = Math.Min(item.ExternalSourceRiskPct, 45d);
                            }
                        }

                        // CLIP composition comparison (if worker available) as supplementary signal.
                        item.ExternalCompositionSimilarityPct = await ComputeExternalCompositionSimilarityAsync(
                            dataUrl,
                            external.CandidateImageUrls,
                            cancellationToken).ConfigureAwait(false);

                        if (item.ExternalCompositionSimilarityPct.HasValue)
                        {
                            // Composition-aware scoring: promote only when whole-image similarity is high,
                            // de-escalate when external matches are likely just same card artwork.
                            var similarity = item.ExternalCompositionSimilarityPct.Value;
                            var manyVisualHits = item.TargetMarketplaceMatchCount >= 18;
                            if (manyVisualHits && similarity >= 90)
                            {
                                // ผลค้นหาเยอะมากจาก 3 เว็บ — อาจเป็นการ์ดยอดนิยมหลายรายการ
                                item.ExternalMatchLevel = "ambiguous";
                                item.ExternalSourceRiskPct = RoundPct(Math.Min(item.ExternalSourceRiskPct, 72d));
                            }
                            else if (similarity >= 88)
                            {
                                // เกือบ 90% กับรูปบน Mercari/Yahoo/Magi — ถือเป็นภาพเดียวกันหรือใกล้เคียงมาก
                                item.ExternalMatchLevel = "exact_or_near";
                                item.ExternalSourceRiskPct = Math.Max(item.ExternalSourceRiskPct, 90d);
                            }
                            else if (similarity >= 82)
                            {
                                item.ExternalMatchLevel = manyVisualHits ? "ambiguous" : "near";
                                item.ExternalSourceRiskPct = Math.Max(
                                    item.ExternalSourceRiskPct,
                                    manyVisualHits ? 68d : 75d);
                            }
                            else if (similarity < 72 && item.ExternalMatchCount >= 20)
                            {
                                item.ExternalMatchLevel = "ambiguous";
                                item.ExternalSourceRiskPct = Math.Min(item.ExternalSourceRiskPct, 65d);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "External source analysis failed for {ImageUrl}", imageUrl);
                        item.SourceAnalysisAvailable = false;
                        item.SourceUnavailableReason = "external-analysis-exception";
                        item.ExternalProvider = "serpapi(error)";
                        item.Error = AppendError(item.Error, "external-source-unavailable");
                    }
                }

                if (mode != "source")
                {
                    try
                    {
                        // Local heuristic: photo-editing manipulation (ELA, noise inconsistency, etc.)
                        var manipulation = await _imageManipulationService.AnalyzeAsync(bytes, cancellationToken).ConfigureAwait(false);
                        item.ManipulationRiskPct = RoundPct(manipulation.ManipulationRiskPct);
                        // Start with heuristic AI-gen estimate as fallback.
                        item.AiGeneratedRiskPct = RoundPct(manipulation.AiGeneratedRiskPct);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Manipulation analysis failed for {ImageUrl}", imageUrl);
                        item.Error = AppendError(item.Error, "manipulation-unavailable");
                    }

                    // Sightengine: dedicated ML model for AI-generated image detection.
                    // Overrides the heuristic estimate when API keys are configured.
                    // Modern AI generators (Midjourney, DALL·E, SD) produce realistic textures
                    // that fool OpenCV heuristics — only a trained ML model can detect them reliably.
                    try
                    {
                        var sightengineRisk = await _sightengineService
                            .GetAiGeneratedRiskPctAsync(imageUrl, cancellationToken)
                            .ConfigureAwait(false);
                        if (sightengineRisk.HasValue)
                            item.AiGeneratedRiskPct = RoundPct(sightengineRisk.Value);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Sightengine AI detection failed for {ImageUrl}", imageUrl);
                    }
                }

                if (mode == "source")
                {
                    item.OverallRiskPct = RoundPct((item.ExternalSourceRiskPct * 0.7) + (item.InternalDuplicateRiskPct * 0.3));
                }
                else if (mode == "manipulation")
                {
                    item.OverallRiskPct = RoundPct(Math.Max(item.ManipulationRiskPct, item.AiGeneratedRiskPct * 0.92));
                }
                else
                {
                    var manipComponent = Math.Max(item.ManipulationRiskPct, item.AiGeneratedRiskPct * 0.90);
                    item.OverallRiskPct = RoundPct(
                        (item.ExternalSourceRiskPct * _options.ExternalSourceWeight)
                        + (item.InternalDuplicateRiskPct * _options.InternalDuplicateWeight)
                        + (manipComponent * _options.ManipulationWeight));
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "AI screening failed for image {ImageUrl}", imageUrl);
                item.Error = ex.Message;
            }
            return item;
        }

        private static string AppendError(string? existing, string next)
        {
            if (string.IsNullOrWhiteSpace(existing)) return next;
            return existing + ";" + next;
        }

        private async Task<double?> ComputeExternalCompositionSimilarityAsync(
            string queryImageDataUrl,
            List<string>? candidateImageUrls,
            CancellationToken cancellationToken)
        {
            if (candidateImageUrls == null || candidateImageUrls.Count == 0) return null;

            var httpClient = _httpClientFactory.CreateClient();
            httpClient.Timeout = TimeSpan.FromSeconds(12);

            var embedInputs = new List<string> { queryImageDataUrl };
            var candidateCount = 0;

            foreach (var u in candidateImageUrls.Take(8))
            {
                try
                {
                    var bytes = await httpClient.GetByteArrayAsync(u, cancellationToken).ConfigureAwait(false);
                    var ext = GuessImageExtensionFromUrl(u);
                    embedInputs.Add($"data:image/{ext};base64," + Convert.ToBase64String(bytes));
                    candidateCount++;
                }
                catch
                {
                    // Ignore broken external candidate images and continue.
                }
            }

            if (candidateCount == 0) return null;

            var embeddings = await _clipEmbeddingService.GetEmbeddingsAsync(embedInputs, cancellationToken).ConfigureAwait(false);
            if (embeddings.Count < 2) return null;

            var query = embeddings[0];
            var best = -1d;
            for (var i = 1; i < embeddings.Count; i++)
            {
                var sim = CosineSimilarity(query, embeddings[i]);
                if (sim > best) best = sim;
            }

            if (best < 0) return null;
            var pct = Math.Clamp((best + 1d) * 50d, 0d, 100d);
            return RoundPct(pct);
        }

        private static double CosineSimilarity(float[] a, float[] b)
        {
            if (a.Length == 0 || b.Length == 0 || a.Length != b.Length) return -1;
            double dot = 0, na = 0, nb = 0;
            for (var i = 0; i < a.Length; i++)
            {
                dot += a[i] * b[i];
                na += a[i] * a[i];
                nb += b[i] * b[i];
            }
            if (na <= 0 || nb <= 0) return -1;
            return dot / (Math.Sqrt(na) * Math.Sqrt(nb));
        }

        private static string GuessImageExtensionFromUrl(string url)
        {
            var low = (url ?? "").ToLowerInvariant();
            if (low.Contains(".png")) return "png";
            if (low.Contains(".webp")) return "webp";
            if (low.Contains(".gif")) return "gif";
            return "jpeg";
        }

        private async Task<(double risk, string? matchPostId, double? similarity)> AnalyzeInternalDuplicateAsync(
            string currentPostId,
            string imageDataUrl,
            CancellationToken cancellationToken)
        {
            var embeddings = await _clipEmbeddingService
                .GetEmbeddingsAsync(new List<string> { imageDataUrl }, cancellationToken)
                .ConfigureAwait(false);
            if (embeddings.Count == 0)
                return (0, null, null);

            var vector = "[" + string.Join(",",
                embeddings[0].Select(v => v.ToString("G", System.Globalization.CultureInfo.InvariantCulture))) + "]";

            var rpcParams = new Dictionary<string, object>
            {
                ["query_embedding"] = vector,
                ["match_limit"] = 6,
                ["match_status"] = "active",
                ["match_threshold"] = 0.55
            };
            var rows = await _supabaseService.RpcAsync("match_posts_by_embedding", rpcParams, useServiceRole: true).ConfigureAwait(false);
            var best = rows
                .Select(r =>
                {
                    var id = r.TryGetValue("postId", out var p) ? p?.ToString() : null;
                    var score = r.TryGetValue("score", out var s) && s != null ? Convert.ToDouble(s) : 0d;
                    return (id, score);
                })
                .Where(x => !string.IsNullOrWhiteSpace(x.id) && !string.Equals(x.id, currentPostId, StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(x => x.score)
                .FirstOrDefault();

            if (string.IsNullOrWhiteSpace(best.id))
                return (0, null, null);

            var normalizedRisk = Math.Clamp((best.score - 0.55) / 0.45, 0, 1) * 100.0;
            return (normalizedRisk, best.id, best.score);
        }

        private static List<string> ExtractImagesFromPost(Dictionary<string, object> post, string mode)
        {
            var urls = new List<string>();
            var sourceOnlyMode = string.Equals(mode, "source", StringComparison.OrdinalIgnoreCase);
            var manipulationOnlyMode = string.Equals(mode, "manipulation", StringComparison.OrdinalIgnoreCase);
            // For source and manipulation checks, always use only the original full images uploaded by the seller.
            // Per-card crops (individualCards) focus on a single card and cause false positives in reverse image search
            // because many listings share the same card artwork. We want to match the whole photo composition.
            var skipIndividualCards = sourceOnlyMode || manipulationOnlyMode;

            if (post.TryGetValue("images", out var imagesObj) && imagesObj != null)
            {
                if (imagesObj is List<string> ls) urls.AddRange(ls.Where(s => !string.IsNullOrWhiteSpace(s)));
                else if (imagesObj is List<object> lo) urls.AddRange(lo.Select(x => x?.ToString() ?? "").Where(s => !string.IsNullOrWhiteSpace(s)));
                else if (imagesObj is JsonElement je && je.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in je.EnumerateArray())
                    {
                        var s = item.GetString();
                        if (!string.IsNullOrWhiteSpace(s)) urls.Add(s);
                    }
                }
            }

            // Only include per-card crops in "all" mode (comprehensive scan), never in source/manipulation checks.
            if (!skipIndividualCards &&
                post.TryGetValue("individualCards", out var cardsObj) && cardsObj != null)
            {
                if (cardsObj is List<object> cardsList)
                {
                    foreach (var c in cardsList)
                    {
                        if (c is Dictionary<string, object> dict && dict.TryGetValue("imageUrl", out var uo) && uo != null)
                        {
                            var u = uo.ToString();
                            if (!string.IsNullOrWhiteSpace(u)) urls.Add(u);
                        }
                    }
                }
                else if (cardsObj is JsonElement cardsJson && cardsJson.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in cardsJson.EnumerateArray())
                    {
                        if (item.TryGetProperty("imageUrl", out var up))
                        {
                            var u = up.GetString();
                            if (!string.IsNullOrWhiteSpace(u)) urls.Add(u);
                        }
                    }
                }
            }
            return urls;
        }

        /// <summary>
        /// ใช้ความคล้ายทั้งภาพ (CLIP) ร่วมกับจำนวนผลค้นหา:
        /// ถ้าพบลิงก์ภาพเยอะมักเป็นการ์ดยอดนิยม/มุมคล้าย — ต้องให้คะแนน CLIP สูงมากก่อนจะขึ้นอันตราย
        /// </summary>
        private static string ComputeSourceWarningLevel(
            bool sourceAvailable,
            double? maxCompositionPct,
            double sourceOverallRiskPct,
            bool hasExactOrNear,
            int totalTargetMarketplaceLinks)
        {
            if (!sourceAvailable) return "unknown";
            // ไม่มีลิงก์จาก Mercari / Yahoo! Auctions JP / Magi และไม่มีค่า CLIP — ไม่ขึ้นเตือนจากการเทียบภาพกับ 3 เว็บนี้
            if (!maxCompositionPct.HasValue && totalTargetMarketplaceLinks == 0)
                return "safe";

            if (maxCompositionPct.HasValue)
            {
                var c = maxCompositionPct.Value;
                var highVolume = totalTargetMarketplaceLinks >= 22;
                if (highVolume)
                {
                    if (c >= 93) return "danger";
                    if (c >= 78) return "warning";
                    return "safe";
                }

                // ไม่ใช่เคสลิงก์จาก 3 เว็บเยอะผิดปกติ: เกือบ 90% (88+) = อันตราย
                if (c >= 88) return "danger";
                if (c >= 72) return "warning";
                return "safe";
            }

            if (totalTargetMarketplaceLinks >= 28 && !hasExactOrNear)
            {
                if (sourceOverallRiskPct >= 75) return "warning";
                return "safe";
            }

            if (hasExactOrNear || sourceOverallRiskPct >= 85) return "danger";
            if (sourceOverallRiskPct >= 50) return "warning";
            return "safe";
        }

        private static string ComputeManipulationWarningLevel(double manipulationRiskPct)
        {
            if (manipulationRiskPct >= 75) return "danger";
            if (manipulationRiskPct >= 52) return "warning";
            return "safe";
        }

        private static string ComputeAiGeneratedWarningLevel(double aiGeneratedRiskPct)
        {
            if (aiGeneratedRiskPct >= 58) return "danger";
            if (aiGeneratedRiskPct >= 35) return "warning";
            return "safe";
        }

        private static double RoundPct(double value) => Math.Round(Math.Clamp(value, 0, 100), 2);

        // ─── dHash (Difference Hash) using OpenCV ────────────────────────────────────────
        // Resize to 9×8 grayscale, compare adjacent pixels in each row → 64-bit fingerprint.
        // Handles JPEG re-encoding, small resizing, and color adjustments well.
        // Hamming distance 0-10/64 ≈ same photo; >20/64 ≈ different photo.

        private sealed record DHashResult
        {
            public List<string> MarketplaceConfirmedLinks { get; init; } = new();
            public List<string> OtherConfirmedLinks { get; init; } = new();
            public double? BestMarketplaceSimilarityPct { get; init; }
            public double? BestOtherSimilarityPct { get; init; }
            public double? BestOverallSimilarityPct { get; init; }
        }

        private async Task<DHashResult> ComputeDHashSimilarityAsync(
            byte[] postImageBytes,
            List<(string Link, string ThumbUrl, bool IsTargetMarketplace)> allMatchDetails,
            CancellationToken cancellationToken)
        {
            var marketplaceConfirmed = new List<string>();
            var otherConfirmed = new List<string>();
            double? bestMarketplace = null;
            double? bestOther = null;
            double? bestOverall = null;

            var postHash = ComputeDHash(postImageBytes);
            if (postHash == 0) return new DHashResult();

            var httpClient = _httpClientFactory.CreateClient();
            httpClient.Timeout = TimeSpan.FromSeconds(10);

            const int ConfirmThreshold = 12;

            foreach (var (link, thumbUrl, isMarketplace) in allMatchDetails.Take(16))
            {
                if (string.IsNullOrWhiteSpace(thumbUrl)) continue;
                try
                {
                    var thumbBytes = await httpClient.GetByteArrayAsync(thumbUrl, cancellationToken).ConfigureAwait(false);
                    var thumbHash = ComputeDHash(thumbBytes);
                    if (thumbHash == 0) continue;

                    var distance = HammingDistance(postHash, thumbHash);
                    var simPct = (1.0 - distance / 64.0) * 100.0;

                    if (!bestOverall.HasValue || simPct > bestOverall.Value)
                        bestOverall = simPct;

                    if (isMarketplace)
                    {
                        if (!bestMarketplace.HasValue || simPct > bestMarketplace.Value)
                            bestMarketplace = simPct;
                        if (distance <= ConfirmThreshold)
                            marketplaceConfirmed.Add(link);
                    }
                    else
                    {
                        if (!bestOther.HasValue || simPct > bestOther.Value)
                            bestOther = simPct;
                        if (distance <= ConfirmThreshold)
                            otherConfirmed.Add(link);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "dHash thumbnail download failed: {ThumbUrl}", thumbUrl);
                }
            }

            return new DHashResult
            {
                MarketplaceConfirmedLinks = marketplaceConfirmed,
                OtherConfirmedLinks = otherConfirmed,
                BestMarketplaceSimilarityPct = bestMarketplace.HasValue ? RoundPct(bestMarketplace.Value) : null,
                BestOtherSimilarityPct = bestOther.HasValue ? RoundPct(bestOther.Value) : null,
                BestOverallSimilarityPct = bestOverall.HasValue ? RoundPct(bestOverall.Value) : null
            };
        }

        private static ulong ComputeDHash(byte[] imageBytes)
        {
            try
            {
                using var img = new Mat();
                CvInvoke.Imdecode(imageBytes, ImreadModes.Grayscale, img);
                if (img.IsEmpty) return 0;
                using var resized = new Mat();
                // 9 wide × 8 tall — 8 column comparisons per row = 64 bits total.
                CvInvoke.Resize(img, resized, new System.Drawing.Size(9, 8), interpolation: Inter.Area);

                int step = resized.Step;
                var totalBytes = step * 8;
                var data = new byte[totalBytes];
                Marshal.Copy(resized.DataPointer, data, 0, totalBytes);

                ulong hash = 0;
                int bit = 0;
                for (int row = 0; row < 8; row++)
                    for (int col = 0; col < 8; col++)
                    {
                        if (data[row * step + col] < data[row * step + col + 1])
                            hash |= (1UL << bit);
                        bit++;
                    }
                return hash;
            }
            catch
            {
                return 0;
            }
        }

        private static int HammingDistance(ulong a, ulong b) =>
            BitOperations.PopCount(a ^ b);
    }
}

using Microsoft.AspNetCore.Mvc;
using ServerApi.Services;
using System.Text.Json;

namespace ServerApi.Controllers
{
    /// <summary>
    /// Admin API - ทุก endpoint ต้องเป็นผู้ใช้ที่มี profiles.role = 'admin'
    /// </summary>
    [ApiController]
    [Route("api/admin")]
    public class AdminController : BaseController
    {
        private readonly SupabaseService _supabaseService;
        private readonly PostEmbeddingIndexingService _embeddingIndexing;
        private readonly PostModerationAiService _postModerationAiService;
        private readonly ILogger<AdminController> _logger;

        public AdminController(
            SupabaseService supabaseService,
            PostEmbeddingIndexingService embeddingIndexing,
            PostModerationAiService postModerationAiService,
            ILogger<AdminController> logger)
        {
            _supabaseService = supabaseService;
            _embeddingIndexing = embeddingIndexing;
            _postModerationAiService = postModerationAiService;
            _logger = logger;
        }

        /// <summary>
        /// ตรวจสอบว่า request มาจากแอดมิน (JWT sub + profiles.role = admin). คืน 401/403 ถ้าไม่ผ่าน.
        /// </summary>
        private async Task<Dictionary<string, object>?> EnsureAdminAsync()
        {
            var userId = GetUserId();
            if (string.IsNullOrEmpty(userId))
            {
                return null; // caller will return 401
            }

            var profile = await _supabaseService.GetAsync("profiles", userId, useServiceRole: true, idField: "id");
            if (profile == null)
            {
                return null;
            }

            var role = profile.TryGetValue("role", out var r) ? r?.ToString() : null;
            if (string.IsNullOrEmpty(role) || !role.Equals("admin", StringComparison.OrdinalIgnoreCase))
            {
                return null; // caller will return 403
            }

            return profile;
        }

        /// <summary>
        /// GET /api/admin/stats - สถิติสำหรับแดชบอร์ด
        /// </summary>
        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            if (await EnsureAdminAsync() == null)
            {
                var userId = GetUserId();
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized(new { success = false, error = "ไม่พบผู้ใช้" });
                return StatusCode(403, new { success = false, error = "ไม่มีสิทธิ์แอดมิน" });
            }

            try
            {
                var sevenDaysAgo = DateTime.UtcNow.AddDays(-7);

                var (_, totalPosts) = await _supabaseService.GetPostsFilteredAsync(
                    category: null,
                    search: null,
                    sortBy: "newest",
                    page: 1,
                    limit: 1,
                    postType: null,
                    status: null,
                    useServiceRole: true);

                var (_, totalRecentPosts) = await _supabaseService.GetPostsFilteredAsync(
                    category: null,
                    search: null,
                    sortBy: "newest",
                    page: 1,
                    limit: 1,
                    postType: null,
                    status: null,
                    useServiceRole: true,
                    createdAtFromUtc: sevenDaysAgo);

                var (_, totalActivePosts) = await _supabaseService.GetPostsFilteredAsync(
                    category: null,
                    search: null,
                    sortBy: "newest",
                    page: 1,
                    limit: 1,
                    postType: null,
                    status: "active",
                    useServiceRole: true);

                var (_, totalPendingPosts) = await _supabaseService.GetPostsFilteredAsync(
                    category: null,
                    search: null,
                    sortBy: "newest",
                    page: 1,
                    limit: 1,
                    postType: null,
                    status: "pending",
                    useServiceRole: true);

                var (_, totalRejectedPosts) = await _supabaseService.GetPostsFilteredAsync(
                    category: null,
                    search: null,
                    sortBy: "newest",
                    page: 1,
                    limit: 1,
                    postType: null,
                    status: "rejected",
                    useServiceRole: true);

                var (_, totalUsers) = await _supabaseService.GetProfilesFilteredAsync(
                    search: null,
                    isBanned: null,
                    page: 1,
                    limit: 1,
                    useServiceRole: true);

                // Active users = users that are NOT banned
                var (_, totalActiveUsers) = await _supabaseService.GetProfilesFilteredAsync(
                    search: null,
                    isBanned: false,
                    page: 1,
                    limit: 1,
                    useServiceRole: true);

                var embeddingBatchSize = 200;
                var activeCoverage = await ComputeEmbeddingCoverageAsync(
                    postStatus: "active",
                    totalCount: totalActivePosts,
                    batchSize: embeddingBatchSize);
                var pendingCoverage = await ComputeEmbeddingCoverageAsync(
                    postStatus: "pending",
                    totalCount: totalPendingPosts,
                    batchSize: embeddingBatchSize);

                return Ok(new
                {
                    totalPosts,
                    activePosts = totalActivePosts,
                    pendingPosts = totalPendingPosts,
                    rejectedPosts = totalRejectedPosts,
                    totalUsers,
                    activeUsers = totalActiveUsers,
                    recentPosts = totalRecentPosts,
                    embeddingCoverage = new
                    {
                        activePostsWithEmbeddings = activeCoverage.withEmbeddings,
                        activePostsWithoutEmbeddings = activeCoverage.withoutEmbeddings,
                        activeEmbeddingCoveragePct = activeCoverage.coveragePct,
                        pendingPostsWithEmbeddings = pendingCoverage.withEmbeddings,
                        pendingPostsWithoutEmbeddings = pendingCoverage.withoutEmbeddings,
                        pendingEmbeddingCoveragePct = pendingCoverage.coveragePct
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Admin GetStats error");
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาดในการโหลดสถิติ" });
            }
        }

        private async Task<(int withEmbeddings, int withoutEmbeddings, double coveragePct)> ComputeEmbeddingCoverageAsync(
            string postStatus,
            int totalCount,
            int batchSize)
        {
            if (totalCount <= 0)
                return (0, 0, 0);

            var withEmbeddingsPostIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            var totalPages = (int)Math.Ceiling(totalCount / (double)batchSize);
            for (var page = 1; page <= totalPages; page++)
            {
                var (postIds, _) = await _supabaseService.GetPostIdsFilteredAsync(
                    category: null,
                    search: null,
                    sortBy: "newest",
                    page: page,
                    limit: batchSize,
                    postType: null,
                    status: postStatus,
                    useServiceRole: true);

                if (postIds == null || postIds.Count == 0)
                    continue;

                var embeddingRows = await _supabaseService.QueryInAsync(
                    table: "post_image_embeddings",
                    field: "postId",
                    values: postIds,
                    select: "postId",
                    useServiceRole: true);

                foreach (var row in embeddingRows)
                {
                    if (row.TryGetValue("postId", out var pid) && pid != null)
                    {
                        var p = pid.ToString();
                        if (!string.IsNullOrWhiteSpace(p))
                            withEmbeddingsPostIds.Add(p);
                    }
                }
            }

            var withEmbeddings = withEmbeddingsPostIds.Count;
            var withoutEmbeddings = Math.Max(0, totalCount - withEmbeddings);
            var coveragePct = totalCount == 0 ? 0 : (withEmbeddings / (double)totalCount) * 100.0;
            return (withEmbeddings, withoutEmbeddings, coveragePct);
        }

        /// <summary>
        /// POST /api/admin/backfill-embeddings - คำนวณ CLIP embeddings ให้โพสต์ที่ยังไม่มี (batch)
        /// </summary>
        [HttpPost("backfill-embeddings")]
        public async Task<IActionResult> BackfillEmbeddings([FromQuery] int limit = 50)
        {
            if (await EnsureAdminAsync() == null)
            {
                if (string.IsNullOrEmpty(GetUserId()))
                    return Unauthorized(new { success = false, error = "ไม่พบผู้ใช้" });
                return StatusCode(403, new { success = false, error = "ไม่มีสิทธิ์แอดมิน" });
            }

            var batchSize = Math.Clamp(limit, 1, 100);
            try
            {
                var (posts, _) = await _supabaseService.GetPostsFilteredAsync(
                    category: null, search: null, sortBy: "newest", page: 1, limit: batchSize, postType: "sale", status: "active", useServiceRole: true);

                var indexed = 0;
                var failed = 0;
                foreach (var post in posts)
                {
                    if (!post.TryGetValue("id", out var idObj) || idObj == null) continue;
                    var postId = idObj.ToString();
                    if (string.IsNullOrEmpty(postId)) continue;

                    var (imageUrls, preCroppedUrls) = GetImagesFromPost(post);
                    if (imageUrls.Count == 0) continue;

                    try
                    {
                        await _supabaseService.DeleteByFieldAsync("post_image_embeddings", "postId", postId, useServiceRole: true);
                        await _embeddingIndexing.IndexPostImagesAsync(postId, imageUrls, preCroppedUrls);
                        indexed++;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Backfill embedding failed for post {PostId}", postId);
                        failed++;
                    }
                }

                return Ok(new { success = true, indexed, failed, totalProcessed = indexed + failed });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Admin BackfillEmbeddings error");
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาดในการ backfill embeddings" });
            }
        }

        /// <summary>
        /// Collect image URLs for embedding index: post.images + post.individualCards[].imageUrl (for ขายแยกใบ).
        /// Returns (MainImages, PreCroppedImages) — PreCroppedImages คือรูปที่ครอปมาแล้วจาก individualCards ที่ไม่ต้องผ่าน Card Detection
        /// </summary>
        private static (List<string> AllUrls, List<string> PreCroppedUrls) GetImagesFromPost(Dictionary<string, object> post)
        {
            var urls = new List<string>();
            var preCropped = new List<string>();

            // 1) Main images
            if (post.TryGetValue("images", out var imagesObj) && imagesObj != null)
            {
                if (imagesObj is List<string> ls) urls.AddRange(ls.Where(s => !string.IsNullOrWhiteSpace(s)));
                else if (imagesObj is List<object> lo) urls.AddRange(lo.Select(x => x?.ToString() ?? "").Where(s => !string.IsNullOrWhiteSpace(s)));
                else if (imagesObj is System.Text.Json.JsonElement je && je.ValueKind == System.Text.Json.JsonValueKind.Array)
                {
                    foreach (var item in je.EnumerateArray())
                    {
                        var s = item.GetString();
                        if (!string.IsNullOrWhiteSpace(s)) urls.Add(s);
                    }
                }
            }

            // 2) Individual card image URLs (โพสขายแยกใบ/ประมูลแยกใบ) — pre-cropped, ข้าม Card Detection
            if (post.TryGetValue("individualCards", out var cardsObj) && cardsObj != null)
            {
                if (cardsObj is List<object> cardsList)
                {
                    foreach (var c in cardsList)
                    {
                        if (c is Dictionary<string, object> dict && dict.TryGetValue("imageUrl", out var urlObj) && urlObj != null)
                        {
                            var u = urlObj.ToString();
                            if (!string.IsNullOrWhiteSpace(u))
                            {
                                urls.Add(u);
                                preCropped.Add(u);
                            }
                        }
                    }
                }
                else if (cardsObj is System.Text.Json.JsonElement je && je.ValueKind == System.Text.Json.JsonValueKind.Array)
                {
                    foreach (var item in je.EnumerateArray())
                    {
                        if (item.TryGetProperty("imageUrl", out var urlProp))
                        {
                            var u = urlProp.GetString();
                            if (!string.IsNullOrWhiteSpace(u))
                            {
                                urls.Add(u);
                                preCropped.Add(u);
                            }
                        }
                    }
                }
            }

            return (urls, preCropped);
        }

        /// <summary>
        /// GET /api/admin/posts - รายการโพสต์ทั้งหมด (สำหรับจัดการ)
        /// </summary>
        [HttpGet("posts")]
        public async Task<IActionResult> GetPosts(
            [FromQuery] string? status = null,
            [FromQuery] string? search = null,
            [FromQuery] string sortBy = "newest",
            [FromQuery] int page = 1,
            [FromQuery] int limit = 20)
        {
            if (await EnsureAdminAsync() == null)
            {
                if (string.IsNullOrEmpty(GetUserId()))
                    return Unauthorized(new { success = false, error = "ไม่พบผู้ใช้" });
                return StatusCode(403, new { success = false, error = "ไม่มีสิทธิ์แอดมิน" });
            }

            try
            {
                var boundedLimit = Math.Clamp(limit, 1, 200);
                var boundedPage = Math.Max(1, page);

                var (posts, total) = await _supabaseService.GetPostsFilteredAsync(
                    category: null,
                    search: search,
                    sortBy: sortBy,
                    page: boundedPage,
                    limit: boundedLimit,
                    postType: null,
                    status: status,
                    useServiceRole: true,
                    searchIncludesSellerName: true);

                // เน้นเร็ว: ดึง username ของผู้ขายแบบ batch (แทน N+1 ทีละโพสต์)
                var sellerIds = posts
                    .Select(p => p.TryGetValue("sellerId", out var sid) ? sid?.ToString() : null)
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                var profileCache = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                if (sellerIds.Count > 0)
                {
                    var tasks = sellerIds.Select(async sellerId =>
                    {
                        var prof = await _supabaseService.GetAsync("profiles", sellerId!, useServiceRole: true, idField: "id");
                        var username = prof != null && prof.TryGetValue("username", out var u) && u != null ? u.ToString() : null;
                        return (sellerId!, username);
                    }).ToList();

                    var results = await Task.WhenAll(tasks);
                    foreach (var (sellerId, username) in results)
                        profileCache[sellerId] = !string.IsNullOrWhiteSpace(username) ? username! : "—";
                }

                var list = posts.Select(p =>
                {
                    var sellerId = p.TryGetValue("sellerId", out var s) ? s?.ToString() : null;
                    var sellerName = !string.IsNullOrEmpty(sellerId) && profileCache.TryGetValue(sellerId, out var name)
                        ? name
                        : (p.TryGetValue("sellerName", out var sn) ? sn?.ToString() : "—");
                    var price = GetPostPrice(p);
                    var createdAt = p.TryGetValue("createdAt", out var c) ? c : null;
                    return new
                    {
                        id = p.TryGetValue("id", out var id) ? id?.ToString() : null,
                        title = p.TryGetValue("title", out var t) ? t?.ToString() : null,
                        description = p.TryGetValue("description", out var d) ? d?.ToString() : null,
                        category = p.TryGetValue("category", out var cat) ? cat?.ToString() : null,
                        images = p.TryGetValue("images", out var imagesObj)
                            ? NormalizeStringList(imagesObj)
                            : new List<string>(),
                        sellerId,
                        sellerName,
                        status = p.TryGetValue("status", out var st) ? st?.ToString() : null,
                        postType = p.TryGetValue("postType", out var pt) ? pt?.ToString() : null,
                        saleType = p.TryGetValue("saleType", out var saleType) ? saleType?.ToString() : null,
                        auctionStatus = p.TryGetValue("auctionStatus", out var auctionStatus) ? auctionStatus?.ToString() : null,
                        auctionEndDate = p.TryGetValue("auctionEndDate", out var auctionEndDate) ? auctionEndDate : null,
                        cardCount = p.TryGetValue("cardCount", out var cardCount) ? cardCount : null,
                        availableQuantity = p.TryGetValue("availableQuantity", out var availableQuantity) ? availableQuantity : null,
                        startingBid = p.TryGetValue("startingBid", out var startingBid) ? startingBid : null,
                        currentBid = p.TryGetValue("currentBid", out var currentBid) ? currentBid : null,
                        buyNowPrice = p.TryGetValue("buyNowPrice", out var buyNowPrice) ? buyNowPrice : null,
                        individualPrice = p.TryGetValue("individualPrice", out var individualPrice) ? individualPrice : null,
                        price,
                        createdAt,
                        updatedAt = p.TryGetValue("updatedAt", out var u) ? u : null
                    };
                }).ToList();

                var totalPages = (int)Math.Ceiling(total / (double)boundedLimit);
                return Ok(new
                {
                    posts = list,
                    pagination = new
                    {
                        page = boundedPage,
                        limit = boundedLimit,
                        total,
                        totalPages
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Admin GetPosts error");
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาดในการโหลดโพสต์" });
            }
        }

        /// <summary>
        /// GET /api/admin/posts/{id}/ai-screening - AI ช่วยประเมินความเสี่ยงรูปภาพสำหรับการอนุมัติโพสต์ (รวมทุก mode)
        /// </summary>
        [HttpGet("posts/{id}/ai-screening")]
        public async Task<IActionResult> GetPostAiScreening(
            string id,
            [FromQuery] string mode = "all",
            [FromQuery] bool forceRefresh = false,
            CancellationToken cancellationToken = default)
        {
            if (await EnsureAdminAsync() == null)
            {
                if (string.IsNullOrEmpty(GetUserId()))
                    return Unauthorized(new { success = false, error = "ไม่พบผู้ใช้" });
                return StatusCode(403, new { success = false, error = "ไม่มีสิทธิ์แอดมิน" });
            }

            if (string.IsNullOrWhiteSpace(id))
                return BadRequest(new { success = false, error = "กรุณาระบุ post id" });

            try
            {
                var existing = await _supabaseService.GetAsync("posts", id, useServiceRole: true);
                if (existing == null)
                    return NotFound(new { success = false, error = "ไม่พบโพสต์ที่ระบุ" });

                var normalizedMode = (mode ?? "all").Trim().ToLowerInvariant();
                AiScreeningResult screening;
                if (normalizedMode == "source")
                {
                    screening = await _postModerationAiService.AnalyzePostSourceAsync(id, forceRefresh, cancellationToken);
                }
                else if (normalizedMode == "manipulation")
                {
                    screening = await _postModerationAiService.AnalyzePostManipulationAsync(id, forceRefresh, cancellationToken);
                }
                else
                {
                    screening = await _postModerationAiService.AnalyzePostAsync(id, forceRefresh, cancellationToken);
                }
                return Ok(new { success = true, data = screening });
            }
            catch (OperationCanceledException)
            {
                return StatusCode(499, new { success = false, error = "Request cancelled" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Admin GetPostAiScreening error for {PostId}", id);
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาดในการวิเคราะห์ AI" });
            }
        }

        /// <summary>
        /// GET /api/admin/posts/{id}/ai-screening/manipulation - ตรวจภาพตัดต่อ/ปลอมแปลง (Image Manipulation Detection)
        /// แยก endpoint จาก /ai-screening/generated เพื่อให้ยิง API คนละเส้น ไม่ share cache กัน
        /// </summary>
        [HttpGet("posts/{id}/ai-screening/manipulation")]
        public async Task<IActionResult> GetPostManipulationScreening(
            string id,
            [FromQuery] bool forceRefresh = false,
            CancellationToken cancellationToken = default)
        {
            if (await EnsureAdminAsync() == null)
            {
                if (string.IsNullOrEmpty(GetUserId()))
                    return Unauthorized(new { success = false, error = "ไม่พบผู้ใช้" });
                return StatusCode(403, new { success = false, error = "ไม่มีสิทธิ์แอดมิน" });
            }

            if (string.IsNullOrWhiteSpace(id))
                return BadRequest(new { success = false, error = "กรุณาระบุ post id" });

            try
            {
                var existing = await _supabaseService.GetAsync("posts", id, useServiceRole: true);
                if (existing == null)
                    return NotFound(new { success = false, error = "ไม่พบโพสต์ที่ระบุ" });

                var screening = await _postModerationAiService.AnalyzePostManipulationAsync(id, forceRefresh, cancellationToken);
                return Ok(new { success = true, data = screening });
            }
            catch (OperationCanceledException)
            {
                return StatusCode(499, new { success = false, error = "Request cancelled" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Admin GetPostManipulationScreening error for {PostId}", id);
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาดในการวิเคราะห์ภาพตัดต่อ" });
            }
        }

        /// <summary>
        /// GET /api/admin/posts/{id}/ai-screening/generated - ตรวจภาพสร้างจาก AI (AI-Generated Image Detection)
        /// ยิงภาพหลักไปที่ Sightengine โดยตรง — ข้าม OpenCV, Reverse Image Search, dHash, CLIP ทั้งหมด
        /// เร็วกว่า mode "all" มาก เหมาะสำหรับปุ่ม "ตรวจภาพ AI" ในหน้า admin
        /// </summary>
        [HttpGet("posts/{id}/ai-screening/generated")]
        public async Task<IActionResult> GetPostAiGeneratedScreening(
            string id,
            CancellationToken cancellationToken = default)
        {
            if (await EnsureAdminAsync() == null)
            {
                if (string.IsNullOrEmpty(GetUserId()))
                    return Unauthorized(new { success = false, error = "ไม่พบผู้ใช้" });
                return StatusCode(403, new { success = false, error = "ไม่มีสิทธิ์แอดมิน" });
            }

            if (string.IsNullOrWhiteSpace(id))
                return BadRequest(new { success = false, error = "กรุณาระบุ post id" });

            try
            {
                // ยิงภาพหลักไปที่ Sightengine โดยตรง — ไม่ต้องรัน OpenCV หรือ Reverse Image Search
                var screening = await _postModerationAiService.AnalyzeAiGeneratedOnlyAsync(id, cancellationToken);
                return Ok(new { success = true, data = screening });
            }
            catch (OperationCanceledException)
            {
                return StatusCode(499, new { success = false, error = "Request cancelled" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Admin GetPostAiGeneratedScreening error for {PostId}", id);
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาดในการวิเคราะห์ภาพ AI" });
            }
        }

        /// <summary>
        /// DELETE /api/admin/posts/{id} - ลบโพสต์และรูปใน Storage
        /// </summary>
        [HttpDelete("posts/{id}")]
        public async Task<IActionResult> DeletePost(string id, [FromBody] AdminDeletePostRequest? body = null)
        {
            if (await EnsureAdminAsync() == null)
            {
                if (string.IsNullOrEmpty(GetUserId()))
                    return Unauthorized(new { success = false, error = "ไม่พบผู้ใช้" });
                return StatusCode(403, new { success = false, error = "ไม่มีสิทธิ์แอดมิน" });
            }

            try
            {
                var existingPost = await _supabaseService.GetAsync("posts", id, useServiceRole: true);
                if (existingPost == null)
                    return NotFound(new { success = false, error = "ไม่พบโพสต์ที่ระบุ" });

                if (existingPost.TryGetValue("imageStoragePaths", out var pathsObj) && pathsObj != null)
                {
                    var pathList = new List<string>();
                    if (pathsObj is List<object> listObj)
                    {
                        pathList = listObj.Select(p => p?.ToString() ?? "").Where(s => !string.IsNullOrEmpty(s)).ToList();
                    }
                    else if (pathsObj is JsonElement je && je.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var item in je.EnumerateArray())
                            pathList.Add(item.GetString() ?? "");
                    }
                    if (pathList.Count > 0)
                        await _supabaseService.DeleteStorageObjectsAsync("posts", pathList);
                }

                await _supabaseService.DeleteAsync("posts", id, idField: "id", useServiceRole: true);

                return Ok(new { success = true, message = "ลบโพสต์สำเร็จ" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Admin DeletePost error");
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาดในการลบโพสต์" });
            }
        }

        /// <summary>
        /// PUT /api/admin/posts/{id}/status - เปลี่ยนสถานะโพสต์ (active / rejected)
        /// </summary>
        [HttpPut("posts/{id}/status")]
        public async Task<IActionResult> UpdatePostStatus(string id, [FromBody] AdminPostStatusRequest body)
        {
            if (await EnsureAdminAsync() == null)
            {
                if (string.IsNullOrEmpty(GetUserId()))
                    return Unauthorized(new { success = false, error = "ไม่พบผู้ใช้" });
                return StatusCode(403, new { success = false, error = "ไม่มีสิทธิ์แอดมิน" });
            }

            if (body == null || string.IsNullOrEmpty(body.Status))
                return BadRequest(new { success = false, error = "กรุณาระบุ status (active หรือ rejected)" });

            var status = body.Status.Trim().ToLowerInvariant();
            if (status != "active" && status != "rejected")
                return BadRequest(new { success = false, error = "status ต้องเป็น active หรือ rejected" });

            try
            {
                var existing = await _supabaseService.GetAsync("posts", id, useServiceRole: true);
                if (existing == null)
                    return NotFound(new { success = false, error = "ไม่พบโพสต์ที่ระบุ" });

                var updateData = new Dictionary<string, object>
                {
                    ["status"] = status,
                    ["updatedAt"] = DateTime.UtcNow
                };

                await _supabaseService.UpdateAsync("posts", id, updateData, idField: "id", useServiceRole: true);

                // เมื่อปฏิเสธโพสต์: สร้างการแจ้งเตือนให้ผู้โพส (sellerId)
                if (status == "rejected")
                {
                    var sellerId = existing.TryGetValue("sellerId", out var sid) ? sid?.ToString() : null;
                    var postTitle = existing.TryGetValue("title", out var tit) ? tit?.ToString() : "โพสต์";
                    if (!string.IsNullOrEmpty(sellerId))
                    {
                        var reasonText = !string.IsNullOrWhiteSpace(body.Reason) ? body.Reason.Trim() : null;
                        var notifMessage = string.IsNullOrEmpty(reasonText)
                            ? $"โพสต์ \"{postTitle}\" ของคุณไม่ผ่านการอนุมัติ"
                            : $"โพสต์ \"{postTitle}\" ของคุณไม่ผ่านการอนุมัติ: {reasonText}";
                        var notifData = new Dictionary<string, object>
                        {
                            ["user_id"] = sellerId,
                            ["type"] = "post_rejected",
                            ["title"] = "โพสต์ไม่ผ่านการอนุมัติ",
                            ["message"] = notifMessage,
                            ["post_id"] = id
                        };
                        try
                        {
                            await _supabaseService.CreateAsync("notifications", notifData, useServiceRole: true);
                        }
                        catch (Exception notifEx)
                        {
                            _logger.LogWarning(notifEx, "Failed to create rejection notification for user {SellerId}", sellerId);
                        }
                    }
                }

                return Ok(new { success = true, message = status == "active" ? "อนุมัติโพสต์สำเร็จ" : "ปฏิเสธโพสต์สำเร็จ" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Admin UpdatePostStatus error");
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาดในการอัปเดตสถานะ" });
            }
        }

        /// <summary>
        /// POST /api/admin/posts/bulk-status - อนุมัติ/ปฏิเสธหลายโพสต์พร้อมกัน
        /// </summary>
        [HttpPost("posts/bulk-status")]
        public async Task<IActionResult> BulkUpdatePostsStatus([FromBody] AdminBulkPostStatusRequest body)
        {
            if (await EnsureAdminAsync() == null)
            {
                if (string.IsNullOrEmpty(GetUserId()))
                    return Unauthorized(new { success = false, error = "ไม่พบผู้ใช้" });
                return StatusCode(403, new { success = false, error = "ไม่มีสิทธิ์แอดมิน" });
            }

            if (body == null || body.PostIds == null || body.PostIds.Count == 0)
                return BadRequest(new { success = false, error = "กรุณาส่ง postIds" });

            if (string.IsNullOrWhiteSpace(body.Status))
                return BadRequest(new { success = false, error = "กรุณาส่ง status (active หรือ rejected)" });

            var status = body.Status.Trim().ToLowerInvariant();
            if (status != "active" && status != "rejected")
                return BadRequest(new { success = false, error = "status ต้องเป็น active หรือ rejected" });

            var reasonText = !string.IsNullOrWhiteSpace(body.Reason) ? body.Reason.Trim() : null;
            var distinctIds = body.PostIds
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Select(id => id.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var updated = 0;
            var failed = 0;

            try
            {
                foreach (var postId in distinctIds)
                {
                    try
                    {
                        var existing = await _supabaseService.GetAsync("posts", postId, useServiceRole: true);
                        if (existing == null) { failed++; continue; }

                        var updateData = new Dictionary<string, object>
                        {
                            ["status"] = status,
                            ["updatedAt"] = DateTime.UtcNow
                        };

                        await _supabaseService.UpdateAsync("posts", postId, updateData, idField: "id", useServiceRole: true);

                        // เมื่อปฏิเสธโพสต์: สร้างการแจ้งเตือนให้ผู้โพส (sellerId)
                        if (status == "rejected")
                        {
                            var sellerId = existing.TryGetValue("sellerId", out var sid) ? sid?.ToString() : null;
                            var postTitle = existing.TryGetValue("title", out var tit) ? tit?.ToString() : "โพสต์";
                            if (!string.IsNullOrWhiteSpace(sellerId))
                            {
                                var notifMessage = string.IsNullOrEmpty(reasonText)
                                    ? $"โพสต์ \"{postTitle}\" ของคุณไม่ผ่านการอนุมัติ"
                                    : $"โพสต์ \"{postTitle}\" ของคุณไม่ผ่านการอนุมัติ: {reasonText}";

                                var notifData = new Dictionary<string, object>
                                {
                                    ["user_id"] = sellerId,
                                    ["type"] = "post_rejected",
                                    ["title"] = "โพสต์ไม่ผ่านการอนุมัติ",
                                    ["message"] = notifMessage,
                                    ["post_id"] = postId
                                };

                                await _supabaseService.CreateAsync("notifications", notifData, useServiceRole: true);
                            }
                        }

                        updated++;
                    }
                    catch
                    {
                        failed++;
                    }
                }

                return Ok(new { success = true, updated, failed, total = distinctIds.Count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Admin BulkUpdatePostsStatus error");
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาดในการอัปเดตสถานะ" });
            }
        }

        /// <summary>
        /// GET /api/admin/export/banned-users - Export ผู้ใช้ที่ถูกแบนเป็น CSV
        /// </summary>
        [HttpGet("export/banned-users")]
        public async Task<IActionResult> ExportBannedUsersCsv()
        {
            if (await EnsureAdminAsync() == null)
            {
                if (string.IsNullOrEmpty(GetUserId()))
                    return Unauthorized(new { success = false, error = "ไม่พบผู้ใช้" });
                return StatusCode(403, new { success = false, error = "ไม่มีสิทธิ์แอดมิน" });
            }

            var sb = new System.Text.StringBuilder();
            sb.AppendLine("id,username,role,is_banned,ban_reason,created_at");

            var page = 1;
            var limit = 500;
            var totalPages = int.MaxValue;

            while (page <= totalPages)
            {
                var (profiles, total) = await _supabaseService.GetProfilesFilteredAsync(
                    search: null,
                    isBanned: true,
                    page: page,
                    limit: limit,
                    useServiceRole: true);

                if (profiles == null || profiles.Count == 0)
                    break;

                if (totalPages == int.MaxValue)
                    totalPages = (int)Math.Ceiling(total / (double)limit);

                foreach (var p in profiles)
                {
                    var id = p.TryGetValue("id", out var i) ? i?.ToString() : "";
                    var username = p.TryGetValue("username", out var u) ? u?.ToString() : "";
                    var role = p.TryGetValue("role", out var r) ? r?.ToString() : "";
                    var createdAt = p.TryGetValue("created_at", out var c) ? c?.ToString() : "";
                    var banReason = p.TryGetValue("ban_reason", out var br) ? br?.ToString() : "";

                    sb.AppendLine(string.Join(",",
                        EscapeCsv(id),
                        EscapeCsv(username),
                        EscapeCsv(role),
                        "true",
                        EscapeCsv(banReason ?? ""),
                        EscapeCsv(createdAt ?? "")));
                }

                page++;
            }

            var bytes = System.Text.Encoding.UTF8.GetBytes(sb.ToString());
            return File(bytes, "text/csv", "banned-users.csv");
        }

        /// <summary>
        /// GET /api/admin/export/rejected-posts - Export โพสต์ที่ถูกปฏิเสธเป็น CSV
        /// </summary>
        [HttpGet("export/rejected-posts")]
        public async Task<IActionResult> ExportRejectedPostsCsv()
        {
            if (await EnsureAdminAsync() == null)
            {
                if (string.IsNullOrEmpty(GetUserId()))
                    return Unauthorized(new { success = false, error = "ไม่พบผู้ใช้" });
                return StatusCode(403, new { success = false, error = "ไม่มีสิทธิ์แอดมิน" });
            }

            var sb = new System.Text.StringBuilder();
            sb.AppendLine("id,title,sellerId,sellerName,status,postType,price,createdAt");

            var page = 1;
            var limit = 200;
            var totalPages = int.MaxValue;

            while (page <= totalPages)
            {
                var (posts, total) = await _supabaseService.GetPostsFilteredAsync(
                    category: null,
                    search: null,
                    sortBy: "newest",
                    page: page,
                    limit: limit,
                    postType: null,
                    status: "rejected",
                    useServiceRole: true);

                if (posts == null || posts.Count == 0)
                    break;

                if (totalPages == int.MaxValue)
                    totalPages = (int)Math.Ceiling(total / (double)limit);

                // cache seller username for this page
                var sellerIds = posts
                    .Select(p => p.TryGetValue("sellerId", out var sid) ? sid?.ToString() : null)
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                var profileCache = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                if (sellerIds.Count > 0)
                {
                    var tasks = sellerIds.Select(async sellerId =>
                    {
                        var prof = await _supabaseService.GetAsync("profiles", sellerId!, useServiceRole: true, idField: "id");
                        var username = prof != null && prof.TryGetValue("username", out var u) && u != null ? u.ToString() : null;
                        return (sellerId!, username);
                    }).ToList();

                    var results = await Task.WhenAll(tasks);
                    foreach (var (sellerId, username) in results)
                        profileCache[sellerId] = !string.IsNullOrWhiteSpace(username) ? username! : "—";
                }

                foreach (var p in posts)
                {
                    var id = p.TryGetValue("id", out var pid) ? pid?.ToString() : "";
                    var title = p.TryGetValue("title", out var t) ? t?.ToString() : "";
                    var sellerId = p.TryGetValue("sellerId", out var sid) ? sid?.ToString() : "";
                    var sellerName =
                        (!string.IsNullOrWhiteSpace(sellerId) && profileCache.TryGetValue(sellerId!, out var name))
                            ? name
                            : (p.TryGetValue("sellerName", out var sn) ? sn?.ToString() : "");

                    var status = p.TryGetValue("status", out var st) ? st?.ToString() : "";
                    var postType = p.TryGetValue("postType", out var pt) ? pt?.ToString() : "";
                    var price = GetPostPrice(p);
                    var createdAt = p.TryGetValue("createdAt", out var c) ? c?.ToString() : "";

                    sb.AppendLine(string.Join(",",
                        EscapeCsv(id),
                        EscapeCsv(title),
                        EscapeCsv(sellerId ?? ""),
                        EscapeCsv(sellerName ?? ""),
                        EscapeCsv(status ?? ""),
                        EscapeCsv(postType ?? ""),
                        price.ToString(System.Globalization.CultureInfo.InvariantCulture),
                        EscapeCsv(createdAt ?? "")));
                }

                page++;
            }

            var bytes = System.Text.Encoding.UTF8.GetBytes(sb.ToString());
            return File(bytes, "text/csv", "rejected-posts.csv");
        }

        private static string EscapeCsv(string? value)
        {
            var v = value ?? string.Empty;
            if (v.Contains(',') || v.Contains('\n') || v.Contains('\r') || v.Contains('"'))
            {
                v = v.Replace("\"", "\"\"");
                return $"\"{v}\"";
            }
            return v;
        }

        /// <summary>
        /// GET /api/admin/users - รายการผู้ใช้จาก profiles (ไม่มี email ในรอบนี้)
        /// </summary>
        [HttpGet("users")]
        public async Task<IActionResult> GetUsers(
            [FromQuery] string? search = null,
            [FromQuery] bool? isBanned = null,
            [FromQuery] int page = 1,
            [FromQuery] int limit = 20)
        {
            if (await EnsureAdminAsync() == null)
            {
                if (string.IsNullOrEmpty(GetUserId()))
                    return Unauthorized(new { success = false, error = "ไม่พบผู้ใช้" });
                return StatusCode(403, new { success = false, error = "ไม่มีสิทธิ์แอดมิน" });
            }

            try
            {
                var boundedLimit = Math.Clamp(limit, 1, 200);
                var boundedPage = Math.Max(1, page);

                var (profiles, total) = await _supabaseService.GetProfilesFilteredAsync(
                    search: search,
                    isBanned: isBanned,
                    page: boundedPage,
                    limit: boundedLimit,
                    useServiceRole: true);

                // profiles table doesn't contain email, so we fetch email from GoTrue via Admin API
                // (profiles.id corresponds to auth.users.id in our schema).
                var profileList = profiles ?? new List<Dictionary<string, object>>();
                var profileIds = profileList
                    .Select(p => p.TryGetValue("id", out var i) ? i?.ToString() : null)
                    .Where(id => !string.IsNullOrWhiteSpace(id))
                    .Select(id => id!)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                var emailById = await _supabaseService.GetAuthUserEmailsByIdsAsync(profileIds);

                var users = profileList.Select(p =>
                {
                    var id = p.TryGetValue("id", out var i) ? i?.ToString() : "";
                    var username = p.TryGetValue("username", out var u) ? u?.ToString() : "";
                    var role = p.TryGetValue("role", out var r) ? r?.ToString() : "user";
                    var createdAt = p.TryGetValue("created_at", out var c) ? c : null;
                    var isBanned = p.TryGetValue("is_banned", out var b) && b != null &&
                                   (b is bool bb ? bb : string.Equals(b.ToString(), "true", StringComparison.OrdinalIgnoreCase));
                    var banReason = p.TryGetValue("ban_reason", out var br) ? br?.ToString() : null;

                    string? email = null;
                    if (!string.IsNullOrWhiteSpace(id))
                        emailById.TryGetValue(id, out email);

                    return new
                    {
                        id,
                        displayName = username ?? "—",
                        email,
                        role,
                        isAdmin = string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase),
                        isBanned,
                        banReason,
                        createdAt
                    };
                }).ToList();

                var totalPages = (int)Math.Ceiling(total / (double)boundedLimit);
                return Ok(new
                {
                    users,
                    pagination = new
                    {
                        page = boundedPage,
                        limit = boundedLimit,
                        total,
                        totalPages
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Admin GetUsers error");
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาดในการโหลดผู้ใช้" });
            }
        }

        /// <summary>
    /// PUT /api/admin/users/{id}/admin - ตั้งหรือถอดสิทธิ์แอดมิน (ห้ามลบสิทธิ์ตัวเอง)
        /// </summary>
        [HttpPut("users/{id}/admin")]
        public async Task<IActionResult> SetUserAdmin(string id, [FromBody] AdminSetAdminRequest body)
        {
            if (await EnsureAdminAsync() == null)
            {
                if (string.IsNullOrEmpty(GetUserId()))
                    return Unauthorized(new { success = false, error = "ไม่พบผู้ใช้" });
                return StatusCode(403, new { success = false, error = "ไม่มีสิทธิ์แอดมิน" });
            }

            if (body == null)
                return BadRequest(new { success = false, error = "กรุณาระบุ isAdmin" });

            var currentUserId = GetUserId();
            if (!string.IsNullOrEmpty(currentUserId) && string.Equals(currentUserId, id, StringComparison.OrdinalIgnoreCase) && !body.IsAdmin)
            {
                return BadRequest(new { success = false, error = "ไม่สามารถลบสิทธิ์แอดมินของตัวเองได้" });
            }

            try
            {
                var profile = await _supabaseService.GetAsync("profiles", id, useServiceRole: true, idField: "id");
                if (profile == null)
                    return NotFound(new { success = false, error = "ไม่พบผู้ใช้ที่ระบุ" });

                var newRole = body.IsAdmin ? "admin" : "user";
                var updateData = new Dictionary<string, object>
                {
                    ["role"] = newRole,
                    ["updated_at"] = DateTime.UtcNow
                };

                await _supabaseService.UpdateAsync("profiles", id, updateData, idField: "id", useServiceRole: true);

                return Ok(new { success = true, message = body.IsAdmin ? "ให้สิทธิ์แอดมินสำเร็จ" : "ลบสิทธิ์แอดมินสำเร็จ" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Admin SetUserAdmin error");
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาดในการอัปเดต" });
            }
        }

        /// <summary>
        /// PUT /api/admin/users/{id}/ban - แบนหรือยกเลิกแบนผู้ใช้
        /// </summary>
        [HttpPut("users/{id}/ban")]
        public async Task<IActionResult> SetUserBan(string id, [FromBody] AdminSetBanRequest body)
        {
            if (await EnsureAdminAsync() == null)
            {
                if (string.IsNullOrEmpty(GetUserId()))
                    return Unauthorized(new { success = false, error = "ไม่พบผู้ใช้" });
                return StatusCode(403, new { success = false, error = "ไม่มีสิทธิ์แอดมิน" });
            }

            if (body == null)
                return BadRequest(new { success = false, error = "กรุณาระบุ isBanned" });

            var currentUserId = GetUserId();
            if (!string.IsNullOrEmpty(currentUserId) && string.Equals(currentUserId, id, StringComparison.OrdinalIgnoreCase) && body.IsBanned)
            {
                return BadRequest(new { success = false, error = "ไม่สามารถแบนตัวเองได้" });
            }

            try
            {
                var profile = await _supabaseService.GetAsync("profiles", id, useServiceRole: true, idField: "id");
                if (profile == null)
                    return NotFound(new { success = false, error = "ไม่พบผู้ใช้ที่ระบุ" });

                var updateData = new Dictionary<string, object>
                {
                    ["is_banned"] = body.IsBanned,
                    ["updated_at"] = DateTime.UtcNow
                };
                if (body.IsBanned)
                {
                    updateData["ban_reason"] = body.Reason ?? "";
                    updateData["banned_at"] = DateTime.UtcNow;
                }

                await _supabaseService.UpdateAsync("profiles", id, updateData, idField: "id", useServiceRole: true);

                return Ok(new { success = true, message = body.IsBanned ? "แบนผู้ใช้สำเร็จ" : "ยกเลิกการแบนผู้ใช้สำเร็จ" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Admin SetUserBan error");
                var msg = ex.Message ?? "";
                if (msg.IndexOf("is_banned", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    msg.IndexOf("does not exist", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    msg.IndexOf("column", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    return StatusCode(500, new { success = false, error = "ตาราง profiles ยังไม่มีคอลัมน์แบน กรุณารันไฟล์ supabase-profiles-ban-columns.sql ใน Supabase SQL Editor" });
                }
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาดในการอัปเดตสถานะแบน" });
            }
        }

        private static double GetPostPrice(Dictionary<string, object> post)
        {
            try
            {
                if (post.TryGetValue("postType", out var pt) && pt?.ToString() == "sale")
                {
                    if (post.TryGetValue("saleType", out var st) && st?.ToString() == "individual" && post.TryGetValue("individualPrice", out var ip) && ip != null)
                    {
                        var v = Convert.ToDouble(ip);
                        if (v > 0) return v;
                    }
                    if (post.TryGetValue("price", out var p) && p != null)
                    {
                        var v = Convert.ToDouble(p);
                        if (v > 0) return v;
                    }
                }
                if (post.TryGetValue("postType", out var pt2) && pt2?.ToString() == "auction")
                {
                    if (post.TryGetValue("currentBid", out var cb) && cb != null)
                    {
                        var v = Convert.ToDouble(cb);
                        if (v > 0) return v;
                    }
                    if (post.TryGetValue("startingBid", out var sb) && sb != null)
                    {
                        var v = Convert.ToDouble(sb);
                        if (v > 0) return v;
                    }
                    if (post.TryGetValue("buyNowPrice", out var bnp) && bnp != null)
                    {
                        var v = Convert.ToDouble(bnp);
                        if (v > 0) return v;
                    }
                }
            }
            catch { }
            return 0;
        }

        private static DateTime ParseDateTime(object? value)
        {
            if (value == null) return DateTime.MinValue;
            if (value is DateTime dt) return dt;
            if (value is string str && DateTime.TryParse(str, out var parsed)) return parsed;
            if (DateTime.TryParse(value.ToString(), out var p)) return p;
            return DateTime.MinValue;
        }

        private static List<string> NormalizeStringList(object? value)
        {
            if (value == null) return new List<string>();
            if (value is List<string> ls)
                return ls.Where(s => !string.IsNullOrWhiteSpace(s)).ToList();
            if (value is List<object> lo)
                return lo.Select(x => x?.ToString() ?? "").Where(s => !string.IsNullOrWhiteSpace(s)).ToList();
            if (value is System.Text.Json.JsonElement je && je.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                var urls = new List<string>();
                foreach (var item in je.EnumerateArray())
                {
                    var s = item.GetString();
                    if (!string.IsNullOrWhiteSpace(s)) urls.Add(s);
                }
                return urls;
            }
            if (value is string s2)
                return string.IsNullOrWhiteSpace(s2) ? new List<string>() : new List<string> { s2 };
            return new List<string>();
        }
    }

    public class AdminDeletePostRequest
    {
        public string? Reason { get; set; }
    }

    public class AdminPostStatusRequest
    {
        public string? Status { get; set; }
        public string? Reason { get; set; }
    }

    public class AdminSetAdminRequest
    {
        public bool IsAdmin { get; set; }
    }

    public class AdminSetBanRequest
    {
        public bool IsBanned { get; set; }
        public string? Reason { get; set; }
    }

    public class AdminBulkPostStatusRequest
    {
        public List<string> PostIds { get; set; } = new();
        public string? Status { get; set; } // active | rejected
        public string? Reason { get; set; } // optional for rejected
    }
}

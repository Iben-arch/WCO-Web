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
        private readonly ILogger<AdminController> _logger;

        public AdminController(SupabaseService supabaseService, ILogger<AdminController> logger)
        {
            _supabaseService = supabaseService;
            _logger = logger;
        }

        /// <summary>
        /// ตรวจสอบว่า request มาจากแอดมิน (X-User-Id + profiles.role = admin). คืน 401/403 ถ้าไม่ผ่าน.
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
                var (allPosts, totalPosts) = await _supabaseService.GetPostsFilteredAsync(
                    category: null, search: null, sortBy: "newest", page: 1, limit: 10000, postType: null, status: null, useServiceRole: true);

                var activePosts = allPosts.Count(p => (p.TryGetValue("status", out var s) ? s?.ToString() : null) == "active");
                var sevenDaysAgo = DateTime.UtcNow.AddDays(-7);
                var recentPosts = allPosts.Count(p =>
                {
                    if (!p.TryGetValue("createdAt", out var created))
                        return false;
                    var dt = ParseDateTime(created);
                    return dt >= sevenDaysAgo;
                });

                var profiles = await _supabaseService.GetAllAsync("profiles", useServiceRole: true);
                var totalUsers = profiles?.Count ?? 0;

                return Ok(new
                {
                    totalPosts,
                    activePosts,
                    totalUsers,
                    recentPosts
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Admin GetStats error");
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาดในการโหลดสถิติ" });
            }
        }

        /// <summary>
        /// GET /api/admin/posts - รายการโพสต์ทั้งหมด (สำหรับจัดการ)
        /// </summary>
        [HttpGet("posts")]
        public async Task<IActionResult> GetPosts()
        {
            if (await EnsureAdminAsync() == null)
            {
                if (string.IsNullOrEmpty(GetUserId()))
                    return Unauthorized(new { success = false, error = "ไม่พบผู้ใช้" });
                return StatusCode(403, new { success = false, error = "ไม่มีสิทธิ์แอดมิน" });
            }

            try
            {
                var (posts, _) = await _supabaseService.GetPostsFilteredAsync(
                    category: null, search: null, sortBy: "newest", page: 1, limit: 500, postType: null, status: null, useServiceRole: true);

                var profileCache = new Dictionary<string, string>();
                foreach (var p in posts)
                {
                    if (p.TryGetValue("sellerId", out var sid) && sid != null)
                    {
                        var sellerId = sid.ToString();
                        if (!string.IsNullOrEmpty(sellerId) && !profileCache.ContainsKey(sellerId))
                        {
                            var prof = await _supabaseService.GetAsync("profiles", sellerId, useServiceRole: true, idField: "id");
                            profileCache[sellerId] = prof != null && prof.TryGetValue("username", out var u) && u != null ? u.ToString() ?? "" : "—";
                        }
                    }
                }

                var list = posts.Select(p =>
                {
                    var sellerId = p.TryGetValue("sellerId", out var s) ? s?.ToString() : null;
                    var sellerName = !string.IsNullOrEmpty(sellerId) && profileCache.TryGetValue(sellerId, out var name) ? name : (p.TryGetValue("sellerName", out var sn) ? sn?.ToString() : "—");
                    var price = GetPostPrice(p);
                    var createdAt = p.TryGetValue("createdAt", out var c) ? c : null;
                    return new
                    {
                        id = p.TryGetValue("id", out var id) ? id?.ToString() : null,
                        title = p.TryGetValue("title", out var t) ? t?.ToString() : null,
                        description = p.TryGetValue("description", out var d) ? d?.ToString() : null,
                        category = p.TryGetValue("category", out var cat) ? cat?.ToString() : null,
                        images = p.TryGetValue("images", out _) ? p["images"] : null,
                        sellerId,
                        sellerName,
                        status = p.TryGetValue("status", out var st) ? st?.ToString() : null,
                        postType = p.TryGetValue("postType", out var pt) ? pt?.ToString() : null,
                        price,
                        createdAt,
                        updatedAt = p.TryGetValue("updatedAt", out var u) ? u : null
                    };
                }).ToList();

                return Ok(new { posts = list });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Admin GetPosts error");
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาดในการโหลดโพสต์" });
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

                return Ok(new { success = true, message = status == "active" ? "อนุมัติโพสต์สำเร็จ" : "ปฏิเสธโพสต์สำเร็จ" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Admin UpdatePostStatus error");
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาดในการอัปเดตสถานะ" });
            }
        }

        /// <summary>
        /// GET /api/admin/users - รายการผู้ใช้จาก profiles (ไม่มี email ในรอบนี้)
        /// </summary>
        [HttpGet("users")]
        public async Task<IActionResult> GetUsers()
        {
            if (await EnsureAdminAsync() == null)
            {
                if (string.IsNullOrEmpty(GetUserId()))
                    return Unauthorized(new { success = false, error = "ไม่พบผู้ใช้" });
                return StatusCode(403, new { success = false, error = "ไม่มีสิทธิ์แอดมิน" });
            }

            try
            {
                var profiles = await _supabaseService.GetAllAsync("profiles", useServiceRole: true);
                var users = (profiles ?? new List<Dictionary<string, object>>()).Select(p =>
                {
                    var id = p.TryGetValue("id", out var i) ? i?.ToString() : "";
                    var username = p.TryGetValue("username", out var u) ? u?.ToString() : "";
                    var role = p.TryGetValue("role", out var r) ? r?.ToString() : "user";
                    var createdAt = p.TryGetValue("created_at", out var c) ? c : null;
                    var isBanned = p.TryGetValue("is_banned", out var b) && b != null &&
                                   (b is bool bb ? bb : string.Equals(b.ToString(), "true", StringComparison.OrdinalIgnoreCase));
                    var banReason = p.TryGetValue("ban_reason", out var br) ? br?.ToString() : null;

                    return new
                    {
                        id,
                        displayName = username ?? "—",
                        email = (string?)null,
                        role,
                        isAdmin = string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase),
                        isBanned,
                        banReason,
                        createdAt
                    };
                }).ToList();

                return Ok(new { users });
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
                    if (post.TryGetValue("saleType", out var st) && st?.ToString() == "individual" && post.TryGetValue("individualPrice", out var ip))
                        return Convert.ToDouble(ip);
                    if (post.TryGetValue("price", out var p))
                        return Convert.ToDouble(p);
                }
                if (post.TryGetValue("postType", out var pt2) && pt2?.ToString() == "auction")
                {
                    if (post.TryGetValue("currentBid", out var cb))
                        return Convert.ToDouble(cb);
                    if (post.TryGetValue("startingBid", out var sb))
                        return Convert.ToDouble(sb);
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
}

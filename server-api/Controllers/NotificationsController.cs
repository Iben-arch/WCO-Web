using Microsoft.AspNetCore.Mvc;
using ServerApi.Services;

namespace ServerApi.Controllers
{
    /// <summary>
    /// API การแจ้งเตือนผู้ใช้ (เช่น โพสต์ถูกปฏิเสธ)
    /// </summary>
    [ApiController]
    [Route("api/notifications")]
    public class NotificationsController : BaseController
    {
        private readonly SupabaseService _supabaseService;
        private readonly ILogger<NotificationsController> _logger;

        public NotificationsController(SupabaseService supabaseService, ILogger<NotificationsController> logger)
        {
            _supabaseService = supabaseService;
            _logger = logger;
        }

        /// <summary>
        /// GET /api/notifications - รายการแจ้งเตือนของผู้ใช้ที่ล็อกอิน
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetMyNotifications()
        {
            var userId = GetUserId();
            if (string.IsNullOrEmpty(userId))
                return Ok(new { success = true, notifications = Array.Empty<object>() });

            try
            {
                var rows = await _supabaseService.QueryAsync("notifications", "user_id", userId, useServiceRole: true);
                var list = (rows ?? new List<Dictionary<string, object>>()).Select(r =>
                {
                    var created = r.TryGetValue("created_at", out var c) ? c : null;
                    var readAt = r.TryGetValue("read_at", out var ra) ? ra : null;
                    return new
                    {
                        id = r.TryGetValue("id", out var id) ? id?.ToString() : null,
                        userId = r.TryGetValue("user_id", out var uid) ? uid?.ToString() : null,
                        type = r.TryGetValue("type", out var t) ? t?.ToString() : null,
                        title = r.TryGetValue("title", out var tit) ? tit?.ToString() : null,
                        message = r.TryGetValue("message", out var m) ? m?.ToString() : null,
                        postId = r.TryGetValue("post_id", out var pid) ? pid?.ToString() : null,
                        readAt = readAt,
                        createdAt = created
                    };
                }).OrderByDescending(x => x.createdAt).ToList();

                return Ok(new { success = true, notifications = list });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetMyNotifications error");
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาดในการโหลดการแจ้งเตือน" });
            }
        }

        /// <summary>
        /// PATCH /api/notifications/{id}/read - ทำเครื่องหมายว่าอ่านแล้ว
        /// </summary>
        [HttpPatch("{id}/read")]
        public async Task<IActionResult> MarkAsRead(string id)
        {
            var userId = GetUserId();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { success = false, error = "ไม่พบผู้ใช้" });

            try
            {
                var existing = await _supabaseService.GetAsync("notifications", id, useServiceRole: true);
                if (existing == null)
                    return NotFound(new { success = false, error = "ไม่พบการแจ้งเตือน" });

                var notifUserId = existing.TryGetValue("user_id", out var uid) ? uid?.ToString() : null;
                if (string.IsNullOrEmpty(notifUserId) || !string.Equals(notifUserId, userId, StringComparison.OrdinalIgnoreCase))
                    return StatusCode(403, new { success = false, error = "ไม่มีสิทธิ์แก้ไขการแจ้งเตือนนี้" });

                var updateData = new Dictionary<string, object>
                {
                    ["read_at"] = DateTime.UtcNow
                };
                await _supabaseService.UpdateAsync("notifications", id, updateData, idField: "id", useServiceRole: true);
                return Ok(new { success = true, message = "ทำเครื่องหมายว่าอ่านแล้ว" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "MarkNotificationRead error");
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาด" });
            }
        }
    }
}

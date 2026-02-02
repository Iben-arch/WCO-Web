using Microsoft.AspNetCore.Mvc;

namespace ServerApi.Controllers
{
    /// <summary>
    /// Base Controller สำหรับ shared methods ที่ใช้ร่วมกัน
    /// </summary>
    public abstract class BaseController : ControllerBase
    {
        /// <summary>
        /// ดึง User ID จาก request - ตรวจสอบจาก query parameter หรือ header
        /// </summary>
        protected string? GetUserId()
        {
            // Try to get userId from query parameter
            if (Request.Query.TryGetValue("userId", out var userIdQuery))
            {
                return userIdQuery.ToString();
            }

            // Try to get userId from header
            if (Request.Headers.TryGetValue("X-User-Id", out var userIdHeader))
            {
                return userIdHeader.ToString();
            }

            return null;
        }

        /// <summary>
        /// ดึง User ID จาก request และ throw exception ถ้าไม่พบ
        /// </summary>
        protected string GetUserIdRequired()
        {
            var userId = GetUserId();
            if (string.IsNullOrEmpty(userId))
            {
                throw new UnauthorizedAccessException("User ID not found in request. Please provide userId in query parameter or X-User-Id header.");
            }
            return userId;
        }
    }
}


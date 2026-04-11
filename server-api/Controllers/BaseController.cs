using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace ServerApi.Controllers
{
    /// <summary>
    /// Base Controller สำหรับ shared methods ที่ใช้ร่วมกัน
    /// </summary>
    public abstract class BaseController : ControllerBase
    {
        private void GetJwtSubAndClientClaim(out string? sub, out string claimedFromClient)
        {
            sub =
                User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.FindFirstValue("sub");

            Request.Query.TryGetValue("userId", out var userIdQuery);
            Request.Headers.TryGetValue("X-User-Id", out var userIdHeader);
            claimedFromClient = userIdQuery.ToString();
            if (string.IsNullOrEmpty(claimedFromClient))
                claimedFromClient = userIdHeader.ToString();
        }

        /// <summary>
        /// ดึง User ID จาก JWT ที่ Bearer middleware ตรวจแล้ว (claim sub).
        /// ไม่ยอมรับ userId จาก query/header โดยไม่มี JWT ที่ตรงกัน — ป้องกันการแอบอ้างตัวตน
        /// </summary>
        protected string? GetUserId()
        {
            GetJwtSubAndClientClaim(out var sub, out var claimedFromClient);

            if (!string.IsNullOrEmpty(sub))
            {
                if (!string.IsNullOrEmpty(claimedFromClient)
                    && !string.Equals(claimedFromClient, sub, StringComparison.Ordinal))
                    return null;
                return sub;
            }

            return null;
        }

        /// <summary>
        /// ดึง User ID จาก JWT และ throw exception ถ้าไม่พบ
        /// </summary>
        protected string GetUserIdRequired()
        {
            GetJwtSubAndClientClaim(out var sub, out var claimedFromClient);

            if (string.IsNullOrEmpty(sub))
            {
                throw new UnauthorizedAccessException(
                    "ไม่พบผู้ใช้จาก JWT: ส่ง Supabase access_token ใน Authorization: Bearer และตรวจสอบ Issuer/Audience ตรงโปรเจกต์ " +
                    "(โทเค็น ES256 ต้องให้ API โหลด JWKS ได้; legacy HS256 ต้องตั้ง Supabase:JwtSecret ให้ถูก — ห้ามใส่ kid แทน secret)");
            }

            if (!string.IsNullOrEmpty(claimedFromClient)
                && !string.Equals(claimedFromClient, sub, StringComparison.Ordinal))
            {
                throw new UnauthorizedAccessException(
                    $"X-User-Id / userId ไม่ตรงกับ JWT sub: ส่งมา '{claimedFromClient}' แต่ในโทเค็นเป็น '{sub}'");
            }

            return sub;
        }
    }
}


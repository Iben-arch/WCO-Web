using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace ServerApi.Authentication;

/// <summary>
/// สร้าง signing key สำหรับตรวจ Supabase access token (HS256).
/// ถ้า secret เป็น Base64 ที่ decode ได้และยาวพอ จะใช้ raw bytes; ไม่เช่นนั้นใช้ UTF-8 ของสตริง
/// </summary>
public static class SupabaseJwtSigningKey
{
    private const int MinDecodedKeyBytes = 16;

    public static SymmetricSecurityKey Create(string jwtSecret)
    {
        if (string.IsNullOrWhiteSpace(jwtSecret))
            throw new InvalidOperationException("Supabase:JwtSecret is required for JWT validation.");

        var trimmed = jwtSecret.Trim();
        try
        {
            var decoded = Convert.FromBase64String(trimmed);
            if (decoded.Length >= MinDecodedKeyBytes)
                return new SymmetricSecurityKey(decoded);
        }
        catch (FormatException)
        {
            // ไม่ใช่ Base64 ที่ถูกต้อง — ใช้ UTF-8 ของสตริงแทน
        }

        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));
    }
}

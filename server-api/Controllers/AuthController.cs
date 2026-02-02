using Microsoft.AspNetCore.Mvc;
using ServerApi.Services;
using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using System.Text.Json.Serialization;
using BCrypt.Net;

namespace ServerApi.Controllers
{
    /// <summary>
    /// Controller สำหรับจัดการ Authentication
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : BaseController
    {
        private readonly SupabaseService _supabaseService;
        private readonly ILogger<AuthController> _logger;

        public AuthController(
            SupabaseService supabaseService,
            ILogger<AuthController> logger)
        {
            _supabaseService = supabaseService;
            _logger = logger;
        }

        /// <summary>
        /// Login endpoint - ตรวจสอบ email/password
        /// </summary>
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest? request)
        {
            try
            {
                if (request == null)
                {
                    return BadRequest(new
                    {
                        success = false,
                        error = "กรุณากรอกข้อมูลให้ถูกต้อง"
                    });
                }

                if (string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password))
                {
                    return BadRequest(new
                    {
                        success = false,
                        error = "กรุณากรอกอีเมลและรหัสผ่าน"
                    });
                }

                // ค้นหา user จาก database
                var users = await _supabaseService.QueryAsync("users", "email", request.Email, useServiceRole: true);
                
                if (users == null || users.Count == 0)
                {
                    _logger.LogWarning($"User not found: {request.Email}");
                    return Unauthorized(new
                    {
                        success = false,
                        error = "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
                    });
                }

                var user = users[0];

                // ตรวจสอบ password hash
                if (!user.ContainsKey("passwordhash") || user["passwordhash"] == null)
                {
                    return Unauthorized(new
                    {
                        success = false,
                        error = "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
                    });
                }

                var passwordHash = user["passwordhash"]?.ToString();
                if (string.IsNullOrEmpty(passwordHash))
                {
                    return Unauthorized(new
                    {
                        success = false,
                        error = "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
                    });
                }

                // ตรวจสอบ password ด้วย BCrypt
                bool isPasswordValid = BCrypt.Net.BCrypt.Verify(request.Password, passwordHash);
                
                if (!isPasswordValid)
                {
                    _logger.LogWarning($"Invalid password for user: {request.Email}");
                    return Unauthorized(new
                    {
                        success = false,
                        error = "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
                    });
                }

                // ตรวจสอบว่า user active หรือไม่
                bool isActive = true;
                if (user.ContainsKey("isActive"))
                {
                    var isActiveValue = user["isActive"];
                    if (isActiveValue is bool active)
                        isActive = active;
                    else if (isActiveValue is JsonElement jsonElement && jsonElement.ValueKind == JsonValueKind.True)
                        isActive = true;
                    else
                        isActive = false;
                }

                if (!isActive)
                {
                    return Unauthorized(new
                    {
                        success = false,
                        error = "บัญชีของคุณถูกปิดการใช้งาน"
                    });
                }

                // ดึง userId และ email
                string? userId = null;
                string? email = null;

                if (user.ContainsKey("uid") && user["uid"] != null)
                    userId = user["uid"].ToString();
                else if (user.ContainsKey("id") && user["id"] != null)
                    userId = user["id"].ToString();

                if (user.ContainsKey("email") && user["email"] != null)
                    email = user["email"].ToString();

                if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(email))
                {
                    return StatusCode(500, new
                    {
                        success = false,
                        error = "เกิดข้อผิดพลาดในการเข้าสู่ระบบ"
                    });
                }

                // สร้าง user profile (ลบ passwordhash ออก)
                var userProfile = new Dictionary<string, object>(user);
                userProfile.Remove("passwordhash");

                _logger.LogInformation($"User logged in successfully: {email}");

                return Ok(new
                {
                    success = true,
                    userId = userId,
                    email = email,
                    user = userProfile,
                    message = "เข้าสู่ระบบสำเร็จ"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during login");
                return StatusCode(500, new
                {
                    success = false,
                    error = "เกิดข้อผิดพลาดในการเข้าสู่ระบบ"
                });
            }
        }

        /// <summary>
        /// Register endpoint - สร้าง user ใหม่
        /// </summary>
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest? request)
        {
            try
            {
                if (request == null)
                {
                    return BadRequest(new
                    {
                        success = false,
                        error = "กรุณากรอกข้อมูลให้ถูกต้อง"
                    });
                }

                if (string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password))
                {
                    return BadRequest(new
                    {
                        success = false,
                        error = "กรุณากรอกอีเมลและรหัสผ่าน"
                    });
                }

                if (request.Password.Length < 6)
                {
                    return BadRequest(new
                    {
                        success = false,
                        error = "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"
                    });
                }

                // ตรวจสอบว่าอีเมลซ้ำหรือไม่
                var existingUsers = await _supabaseService.QueryAsync("users", "email", request.Email, useServiceRole: true);
                if (existingUsers != null && existingUsers.Count > 0)
                {
                    return BadRequest(new
                    {
                        success = false,
                        error = "อีเมลนี้ถูกใช้งานแล้ว"
                    });
                }

                // สร้าง UUID สำหรับ userId
                var userId = Guid.NewGuid().ToString();

                // กำหนด displayName
                string displayName = !string.IsNullOrWhiteSpace(request.DisplayName) 
                    ? request.DisplayName.Trim() 
                    : (request.Email.Contains('@') ? request.Email.Split('@')[0] : request.Email);

                // Hash password ด้วย BCrypt
                var hashedPassword = BCrypt.Net.BCrypt.HashPassword(request.Password);

                // สร้าง profile data - ใช้ field names ตาม schema ใน Supabase
                // Field names ที่มี quotes ใน schema (เช่น "displayName") → ใช้ camelCase ใน JSON
                // Field names ที่ไม่มี quotes (เช่น email, uid) → ใช้ lowercase ใน JSON
                var profileData = new Dictionary<string, object>
                {
                    ["uid"] = userId,  // lowercase (ไม่มี quotes ใน schema)
                    ["email"] = request.Email,  // lowercase (ไม่มี quotes ใน schema)
                    ["displayName"] = displayName,  // camelCase (มี quotes ใน schema)
                    ["accountname"] = displayName,  // lowercase (ไม่มี quotes ใน schema)
                    ["passwordhash"] = hashedPassword,  // lowercase (ไม่มี quotes ใน schema)
                    ["isActive"] = true,  // camelCase (มี quotes ใน schema)
                    ["createdAt"] = DateTime.UtcNow,  // camelCase (มี quotes ใน schema)
                    ["registrationDate"] = DateTime.UtcNow  // camelCase (มี quotes ใน schema)
                };

                if (!string.IsNullOrWhiteSpace(request.Phone))
                    profileData["phone"] = request.Phone.Trim();

                if (!string.IsNullOrWhiteSpace(request.Address))
                    profileData["address"] = request.Address.Trim();

                // สร้าง user ใน Supabase
                await _supabaseService.CreateAsync("users", profileData, useServiceRole: true);

                // รอสักครู่เพื่อให้ Supabase อัปเดตข้อมูล
                await Task.Delay(100);
                
                // ดึงข้อมูล user ที่สร้างเสร็จแล้ว
                var createdProfile = await _supabaseService.GetAsync("users", userId, useServiceRole: true, idField: "uid");
                
                if (createdProfile == null)
                {
                    // ถ้ายังดึงข้อมูลไม่ได้ ให้ใช้ข้อมูลที่ส่งไป
                    createdProfile = new Dictionary<string, object>(profileData);
                }

                // ลบ passwordhash ออกจาก response
                if (createdProfile.ContainsKey("passwordhash"))
                {
                    createdProfile.Remove("passwordhash");
                }

                _logger.LogInformation($"User registered successfully: {request.Email}");

                return Ok(new
                {
                    success = true,
                    userId = userId,
                    email = request.Email,
                    user = createdProfile,
                    message = "สมัครสมาชิกสำเร็จ"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error during registration for email: {request?.Email ?? "unknown"}");
                
                // ตรวจสอบว่าเป็น duplicate email error หรือไม่
                if (ex.Message.Contains("duplicate") || ex.Message.Contains("already exists") || ex.Message.Contains("unique"))
                {
                    return BadRequest(new
                    {
                        success = false,
                        error = "อีเมลนี้ถูกใช้งานแล้ว"
                    });
                }

                return StatusCode(500, new
                {
                    success = false,
                    error = "เกิดข้อผิดพลาดในการสมัครสมาชิก"
                });
            }
        }

        /// <summary>
        /// ดึงข้อมูล User Profile
        /// </summary>
        [HttpGet("profile")]
        public async Task<IActionResult> GetProfile()
        {
            try
            {
                var userId = GetUserIdRequired();
                
                // ใช้ service role เพื่อให้สามารถดึงข้อมูลได้
                var profile = await _supabaseService.GetAsync("users", userId, useServiceRole: true, idField: "uid");

                if (profile == null)
                {
                    return NotFound(new
                    {
                        success = false,
                        error = "ไม่พบข้อมูลโปรไฟล์"
                    });
                }

                // ลบ passwordhash ออก
                if (profile.ContainsKey("passwordhash"))
                {
                    profile.Remove("passwordhash");
                }

                return Ok(new
                {
                    success = true,
                    user = profile
                });
            }
            catch (UnauthorizedAccessException)
            {
                return Unauthorized(new
                {
                    success = false,
                    error = "กรุณาเข้าสู่ระบบ"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching profile");
                return StatusCode(500, new
                {
                    success = false,
                    error = "เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์"
                });
            }
        }

        /// <summary>
        /// ตรวจสอบว่า user ถูกใจ post หรือไม่ (สำหรับ PostDetail)
        /// </summary>
        [HttpGet("check-like/{postId}")]
        public async Task<IActionResult> CheckLike(string postId)
        {
            try
            {
                var userId = GetUserId();
                if (string.IsNullOrEmpty(userId))
                    return Ok(new { liked = false });

                var likedPostIds = await _supabaseService.QueryLikedPostIdsAsync(userId, new List<string> { postId }, useServiceRole: true);
                return Ok(new { liked = likedPostIds.Contains(postId) });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking like status");
                return Ok(new { liked = false });
            }
        }

        /// <summary>
        /// ตรวจสอบว่า user ถูกใจ posts ใดบ้าง (batch - แก้ N+1 สำหรับหน้า Home)
        /// GET /api/auth/check-likes?postIds=id1,id2,id3
        /// </summary>
        [HttpGet("check-likes")]
        public async Task<IActionResult> CheckLikes([FromQuery] string? postIds)
        {
            try
            {
                var userId = GetUserId();
                if (string.IsNullOrEmpty(userId))
                    return Ok(new { likedPostIds = Array.Empty<string>() });

                if (string.IsNullOrWhiteSpace(postIds))
                    return Ok(new { likedPostIds = Array.Empty<string>() });

                var postIdList = postIds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Where(id => !string.IsNullOrEmpty(id))
                    .ToList();

                if (postIdList.Count == 0)
                    return Ok(new { likedPostIds = Array.Empty<string>() });

                var likedPostIds = await _supabaseService.QueryLikedPostIdsAsync(userId, postIdList, useServiceRole: true);
                return Ok(new { likedPostIds });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking likes batch");
                return Ok(new { likedPostIds = Array.Empty<string>() });
            }
        }

        /// <summary>
        /// Toggle like บน post (เพิ่มหรือลบ)
        /// </summary>
        [HttpPost("like/{postId}")]
        public async Task<IActionResult> ToggleLike(string postId)
        {
            try
            {
                var userId = GetUserId();
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized(new { success = false, error = "กรุณาเข้าสู่ระบบ", liked = false });

                var likedPostIds = await _supabaseService.QueryLikedPostIdsAsync(userId, new List<string> { postId }, useServiceRole: true);
                var isLiked = likedPostIds.Contains(postId);

                if (isLiked)
                {
                    await _supabaseService.RemoveLikeAsync(userId, postId, useServiceRole: true);
                    return Ok(new { liked = false, message = "ลบออกจากรายการโปรดแล้ว" });
                }
                else
                {
                    await _supabaseService.AddLikeAsync(userId, postId, useServiceRole: true);
                    return Ok(new { liked = true, message = "เพิ่มในรายการโปรดแล้ว" });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error toggling like");
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาด", liked = false });
            }
        }

        /// <summary>
        /// อัปเดต User Profile
        /// </summary>
        [HttpPost("profile")]
        public async Task<IActionResult> UpdateProfile([FromBody] ProfileRequest request)
        {
            try
            {
                var userId = GetUserIdRequired();

                // ใช้ service role เพื่อให้สามารถอัปเดตข้อมูลได้
                var existingProfile = await _supabaseService.GetAsync("users", userId, useServiceRole: true, idField: "uid");
                var profileData = new Dictionary<string, object>();

                if (existingProfile != null)
                {
                    foreach (var item in existingProfile)
                    {
                        profileData[item.Key] = item.Value;
                    }
                }
                else
                {
                    profileData["uid"] = userId;
                    profileData["createdAt"] = DateTime.UtcNow;
                    profileData["isActive"] = true;
                }

                // อัปเดตเฉพาะ field ที่มีการส่งมา
                if (request.DisplayName != null)
                {
                    profileData["displayName"] = request.DisplayName;
                    profileData["accountname"] = request.DisplayName; // อัปเดต accountname ด้วย
                }

                if (request.Email != null)
                    profileData["email"] = request.Email;

                if (request.Phone != null)
                    profileData["phone"] = request.Phone;

                if (request.Address != null)
                    profileData["address"] = request.Address;

                profileData["updatedAt"] = DateTime.UtcNow;

                if (existingProfile == null)
                {
                    // สร้างใหม่ (ใช้ service role)
                    await _supabaseService.CreateAsync("users", profileData, useServiceRole: true);
                }
                else
                {
                    // อัปเดต (ต้องใช้ service role เพื่อให้สามารถอัปเดตได้)
                    await _supabaseService.UpdateAsync("users", userId, profileData, "uid", useServiceRole: true);
                }

                // ดึงข้อมูลที่อัปเดตแล้ว
                var updatedProfile = await _supabaseService.GetAsync("users", userId, useServiceRole: true, idField: "uid");
                if (updatedProfile != null && updatedProfile.ContainsKey("passwordhash"))
                {
                    updatedProfile.Remove("passwordhash");
                }

                return Ok(new
                {
                    success = true,
                    message = "บันทึกข้อมูลสำเร็จ",
                    user = updatedProfile
                });
            }
            catch (UnauthorizedAccessException)
            {
                return Unauthorized(new
                {
                    success = false,
                    error = "กรุณาเข้าสู่ระบบ"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating profile");
                return StatusCode(500, new
                {
                    success = false,
                    error = "เกิดข้อผิดพลาดในการบันทึกข้อมูลโปรไฟล์"
                });
            }
        }
    }

    public class LoginRequest
    {
        [Required]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string Password { get; set; } = string.Empty;
    }

    public class RegisterRequest
    {
        [Required]
        [JsonPropertyName("email")]
        public string Email { get; set; } = string.Empty;

        [Required]
        [JsonPropertyName("password")]
        public string Password { get; set; } = string.Empty;

        [JsonPropertyName("displayName")]
        public string? DisplayName { get; set; }

        [JsonPropertyName("phone")]
        public string? Phone { get; set; }

        [JsonPropertyName("address")]
        public string? Address { get; set; }
    }

    public class ProfileRequest
    {
        [JsonPropertyName("displayName")]
        public string? DisplayName { get; set; }

        [JsonPropertyName("email")]
        public string? Email { get; set; }

        [JsonPropertyName("phone")]
        public string? Phone { get; set; }

        [JsonPropertyName("address")]
        public string? Address { get; set; }
    }
}

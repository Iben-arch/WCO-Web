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
        /// Login endpoint - ตรวจสอบ email/password ผ่าน Supabase Auth แล้วส่ง session กลับ client
        /// </summary>
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest? request)
        {
            try
            {
                if (request == null)
                {
                    return BadRequest(new { success = false, error = "กรุณากรอกข้อมูลให้ถูกต้อง" });
                }

                if (string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password))
                {
                    return BadRequest(new { success = false, error = "กรุณากรอกอีเมลและรหัสผ่าน" });
                }

                // เรียก Supabase Auth เพื่อตรวจสอบ email/password และรับ session
                SupabaseSession session;
                try
                {
                    session = await _supabaseService.SignInWithPasswordAsync(request.Email, request.Password);
                }
                catch (InvalidOperationException ex)
                {
                    _logger.LogWarning("Login failed for {Email}: {Error}", request.Email, ex.Message);
                    var msg = ex.Message;
                    if (msg.Contains("Invalid login credentials") || msg.Contains("invalid_credentials"))
                        msg = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
                    else if (msg.Contains("Email not confirmed"))
                        msg = "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ";
                    return Unauthorized(new { success = false, error = msg });
                }

                // ดึง userId จาก session user
                var userId = session.User != null && session.User.TryGetValue("id", out var idVal)
                    ? idVal?.ToString()
                    : null;

                // ตรวจสอบสถานะแบนจาก profiles
                if (!string.IsNullOrEmpty(userId))
                {
                    var profile = await _supabaseService.GetAsync("profiles", userId, useServiceRole: true, idField: "id");
                    if (profile != null && profile.TryGetValue("is_banned", out var isBanned))
                    {
                        bool banned = isBanned is bool b ? b
                            : isBanned is JsonElement je && je.ValueKind == JsonValueKind.True;
                        if (banned)
                        {
                            _logger.LogWarning("Banned user attempted login: {UserId}", userId);
                            return Unauthorized(new { success = false, error = "บัญชีของคุณถูกแบน ไม่สามารถเข้าสู่ระบบได้" });
                        }
                    }
                }

                _logger.LogInformation("User logged in via API: {Email}", request.Email);

                return Ok(new
                {
                    success = true,
                    access_token = session.AccessToken,
                    refresh_token = session.RefreshToken,
                    expires_in = session.ExpiresIn,
                    token_type = session.TokenType,
                    user = session.User,
                    message = "เข้าสู่ระบบสำเร็จ"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during login");
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" });
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
        /// ดึงข้อมูลผู้ขายตาม sellerId (สำหรับหน้า SellerProfile/ประวัติผู้ขาย)
        /// </summary>
        [HttpGet("seller/{sellerId}")]
        public async Task<IActionResult> GetSeller(string sellerId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(sellerId))
                {
                    return BadRequest(new { success = false, error = "ไม่พบรหัสผู้ขาย" });
                }

                // ดึงจากทั้ง users และ profiles แล้วผสานข้อมูล
                // เหตุผล: seller_contact_note อยู่ใน profiles แต่ข้อมูลบางส่วนเดิมอยู่ใน users
                var userFromUsers = await _supabaseService.GetAsync("users", sellerId, useServiceRole: true, idField: "uid");
                var userFromProfiles = await _supabaseService.GetAsync("profiles", sellerId, useServiceRole: true, idField: "id");

                if (userFromUsers == null && userFromProfiles == null)
                {
                    return NotFound(new { success = false, error = "ไม่พบข้อมูลผู้ขาย" });
                }

                var user = userFromUsers ?? userFromProfiles!;

                // ลบข้อมูลที่ไม่อยากให้ public เห็น
                if (user.ContainsKey("passwordhash"))
                    user.Remove("passwordhash");

                // สร้าง response ในรูปแบบที่ frontend ต้องการ (Seller type)
                // users: uid, displayName, photoURL, accountname | profiles: id, username, avatar_url
                var sellerData = new Dictionary<string, object>
                {
                    ["id"] = user.ContainsKey("uid") ? user["uid"]?.ToString() ?? sellerId
                        : (user.ContainsKey("id") ? user["id"]?.ToString() ?? sellerId : sellerId),
                    ["displayName"] = user.ContainsKey("displayName") && user["displayName"] != null
                        ? user["displayName"].ToString()!
                        : (user.ContainsKey("accountname") && user["accountname"] != null
                            ? user["accountname"].ToString()!
                            : (user.ContainsKey("username") && user["username"] != null ? user["username"].ToString()! : "ผู้ขาย")),
                    ["profileImage"] = user.ContainsKey("photoURL") && user["photoURL"] != null
                        ? user["photoURL"].ToString()!
                        : (user.ContainsKey("avatar_url") && user["avatar_url"] != null ? user["avatar_url"].ToString()! : ""),
                    ["phone"] = userFromProfiles != null && userFromProfiles.ContainsKey("phone") && userFromProfiles["phone"] != null
                        ? userFromProfiles["phone"].ToString()!
                        : (user.ContainsKey("phone") && user["phone"] != null ? user["phone"].ToString()! : ""),
                    ["sellerContactNote"] = userFromProfiles != null && userFromProfiles.ContainsKey("seller_contact_note") && userFromProfiles["seller_contact_note"] != null
                        ? userFromProfiles["seller_contact_note"].ToString()!
                        : (user.ContainsKey("seller_contact_note") && user["seller_contact_note"] != null ? user["seller_contact_note"].ToString()! : ""),
                    ["createdAt"] = user.ContainsKey("createdAt") ? user["createdAt"] : (user.ContainsKey("created_at") ? user["created_at"] : DateTime.UtcNow)
                };

                if (user.ContainsKey("email") && user["email"] != null)
                    sellerData["email"] = user["email"];

                return Ok(sellerData);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching seller profile");
                return StatusCode(500, new
                {
                    success = false,
                    error = "เกิดข้อผิดพลาดในการดึงข้อมูลผู้ขาย"
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
        /// ดึงรายการที่ถูกใจของ user (โพสต์ + วันที่ถูกใจ)
        /// </summary>
        [HttpGet("liked-items")]
        public async Task<IActionResult> GetLikedItems()
        {
            try
            {
                var userId = GetUserId();
                if (string.IsNullOrEmpty(userId))
                    return Ok(new List<object>());

                var likes = await _supabaseService.QueryAsync("likes", "userId", userId, useServiceRole: true);
                if (likes == null || likes.Count == 0)
                    return Ok(new List<object>());

                var result = new List<object>();
                foreach (var like in likes)
                {
                    var postId = like.TryGetValue("postId", out var pid) ? pid?.ToString() : null;
                    if (string.IsNullOrEmpty(postId)) continue;

                    var post = await _supabaseService.GetAsync("posts", postId, useServiceRole: true);
                    if (post == null) continue;

                    var likedAt = like.TryGetValue("created_at", out var ca) ? ca : null;
                    var item = new Dictionary<string, object?>(post)
                    {
                        ["likedAt"] = likedAt ?? ""
                    };
                    result.Add(item);
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching liked items");
                return Ok(new List<object>());
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

        /// <summary>
        /// สมัครเป็นผู้ขาย — ยืนยันข้อตกลง + บันทึกธนาคาร/เลขบัญชี แล้วอัปเดต role เป็น seller (ผ่าน service role)
        /// </summary>
        [HttpPost("apply-seller")]
        public async Task<IActionResult> ApplySeller([FromBody] ApplySellerRequest? request)
        {
            try
            {
                if (request == null || !request.AgreedToTerms)
                {
                    return BadRequest(new { success = false, error = "กรุณายืนยันข้อตกลงการเป็นผู้ขาย" });
                }

                var bankName = request.BankName?.Trim() ?? "";
                var account = request.BankAccountNumber?.Trim() ?? "";
                if (bankName.Length < 2)
                {
                    return BadRequest(new { success = false, error = "กรุณาระบุชื่อธนาคาร" });
                }
                if (account.Length < 8)
                {
                    return BadRequest(new { success = false, error = "กรุณาระบุเลขบัญชีธนาคารให้ครบถ้วน" });
                }

                var userId = GetUserIdRequired();
                var profile = await _supabaseService.GetAsync("profiles", userId, useServiceRole: true, idField: "id");
                if (profile == null)
                {
                    return NotFound(new { success = false, error = "ไม่พบโปรไฟล์ผู้ใช้" });
                }

                var currentRole = profile.TryGetValue("role", out var r) ? r?.ToString() : null;
                if (string.Equals(currentRole, "seller", StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest(new { success = false, error = "บัญชีนี้เป็นผู้ขายอยู่แล้ว" });
                }
                if (string.Equals(currentRole, "admin", StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest(new { success = false, error = "บัญชีแอดมินไม่ต้องสมัครเป็นผู้ขาย" });
                }

                var updateData = new Dictionary<string, object>
                {
                    ["role"] = "seller",
                    ["bank_name"] = bankName,
                    ["bank_account_number"] = account,
                    ["seller_registered_at"] = DateTime.UtcNow,
                    ["updated_at"] = DateTime.UtcNow
                };

                await _supabaseService.UpdateAsync("profiles", userId, updateData, idField: "id", useServiceRole: true);

                var updated = await _supabaseService.GetAsync("profiles", userId, useServiceRole: true, idField: "id");
                if (updated != null)
                {
                    updated.Remove("passwordhash");
                }

                _logger.LogInformation("User {UserId} applied as seller", userId);

                return Ok(new
                {
                    success = true,
                    message = "สมัครเป็นผู้ขายสำเร็จ",
                    profile = updated
                });
            }
            catch (UnauthorizedAccessException)
            {
                return Unauthorized(new { success = false, error = "กรุณาเข้าสู่ระบบ" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ApplySeller failed");
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาดในการสมัครเป็นผู้ขาย" });
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

    public class ApplySellerRequest
    {
        [JsonPropertyName("agreedToTerms")]
        public bool AgreedToTerms { get; set; }

        [JsonPropertyName("bankName")]
        public string? BankName { get; set; }

        [JsonPropertyName("bankAccountNumber")]
        public string? BankAccountNumber { get; set; }
    }
}

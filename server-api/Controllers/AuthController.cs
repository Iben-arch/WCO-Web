using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using ServerApi.Services;
using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text;

namespace ServerApi.Controllers
{
    /// <summary>
    /// Controller สำหรับจัดการ Authentication และ Profile - ทำหน้าที่เป็น Middleware ระหว่าง Client กับ Supabase/Cloudinary
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly SupabaseService _supabaseService;
        private readonly CloudinaryService _cloudinaryService;
        private readonly ILogger<AuthController> _logger;
        private readonly IConfiguration _configuration;
        private readonly HttpClient _httpClient;

        public AuthController(
            SupabaseService supabaseService,
            CloudinaryService cloudinaryService,
            ILogger<AuthController> logger,
            IConfiguration configuration,
            IHttpClientFactory httpClientFactory)
        {
            _supabaseService = supabaseService;
            _cloudinaryService = cloudinaryService;
            _logger = logger;
            _configuration = configuration;
            _httpClient = httpClientFactory.CreateClient();
            // ตั้ง timeout สำหรับ HttpClient เพื่อไม่ให้รอนานเกินไป
            _httpClient.Timeout = TimeSpan.FromSeconds(5); // ลดเป็น 5 วินาที
        }

        /// <summary>
        /// Login endpoint - รับ email/password แล้ว authenticate ผ่าน Supabase REST API
        /// </summary>
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password))
                {
                    return BadRequest(new
                    {
                        success = false,
                        error = "กรุณากรอกอีเมลและรหัสผ่าน"
                    });
                }

                var supabaseUrl = _configuration["Supabase:Url"];
                if (string.IsNullOrEmpty(supabaseUrl))
                {
                    _logger.LogError("Supabase URL not configured");
                    return StatusCode(500, new
                    {
                        success = false,
                        error = "ระบบยังไม่ได้ตั้งค่า Supabase URL"
                    });
                }

                // ใช้ Supabase REST API เพื่อ authenticate
                var loginUrl = $"{supabaseUrl}/auth/v1/token?grant_type=password";
                
                var loginPayload = new
                {
                    email = request.Email,
                    password = request.Password
                };

                var jsonContent = JsonSerializer.Serialize(loginPayload);
                var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");
                
                var supabaseKey = _configuration["Supabase:Key"];
                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Add("apikey", supabaseKey);
                _httpClient.DefaultRequestHeaders.Add("Content-Type", "application/json");

                var response = await _httpClient.PostAsync(loginUrl, content);
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning($"Supabase login failed: {responseContent}");
                    
                    // Parse error message
                    var errorMessage = "เกิดข้อผิดพลาดในการเข้าสู่ระบบ";
                    try
                    {
                        var errorResponse = JsonSerializer.Deserialize<JsonElement>(responseContent);
                        if (errorResponse.TryGetProperty("error_description", out var errorDesc))
                        {
                            var messageStr = errorDesc.GetString() ?? "";
                            if (messageStr.Contains("Invalid login credentials"))
                            {
                                errorMessage = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
                            }
                            else
                            {
                                errorMessage = messageStr;
                            }
                        }
                    }
                    catch
                    {
                        // Use default error message
                    }

                    return Unauthorized(new
                    {
                        success = false,
                        error = errorMessage
                    });
                }

                var loginResult = JsonSerializer.Deserialize<JsonElement>(responseContent);
                
                // Extract token and user info
                var accessToken = loginResult.GetProperty("access_token").GetString();
                var refreshToken = loginResult.GetProperty("refresh_token").GetString();
                var userObj = loginResult.GetProperty("user");
                var userId = userObj.GetProperty("id").GetString();
                var email = userObj.GetProperty("email").GetString();

                _logger.LogInformation($"User logged in successfully: {email}");

                // ส่ง response กลับทันทีโดยไม่รอ profile
                // Profile จะถูก fetch ใน background หรือเมื่อ user เข้าหน้า profile
                var responseData = new
                {
                    success = true,
                    token = accessToken,
                    refreshToken = refreshToken,
                    userId = userId,
                    email = email,
                    message = "เข้าสู่ระบบสำเร็จ"
                };

                // ดึง profile ใน background (ไม่ block response)
                _ = Task.Run(async () =>
                {
                    try
                    {
                        var profile = await _supabaseService.GetAsync("users", userId ?? "");
                        if (profile != null)
                        {
                            _logger.LogInformation($"Profile fetched in background for user: {email}");
                        }
                    }
                    catch (Exception profileEx)
                    {
                        _logger.LogWarning(profileEx, $"Could not fetch profile in background for user: {email}");
                    }
                });

                return Ok(responseData);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during login");
                return StatusCode(500, new
                {
                    success = false,
                    error = "เกิดข้อผิดพลาดในการเข้าสู่ระบบ",
                    message = ex.Message
                });
            }
        }

        /// <summary>
        /// Register endpoint - รับ email/password/displayName แล้วสร้าง user ผ่าน Supabase REST API
        /// </summary>
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            try
            {
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

                var supabaseUrl = _configuration["Supabase:Url"];
                if (string.IsNullOrEmpty(supabaseUrl))
                {
                    _logger.LogError("Supabase URL not configured");
                    return StatusCode(500, new
                    {
                        success = false,
                        error = "ระบบยังไม่ได้ตั้งค่า Supabase URL"
                    });
                }

                // ใช้ Supabase REST API เพื่อสร้าง user
                var registerUrl = $"{supabaseUrl}/auth/v1/signup";
                
                var registerPayload = new
                {
                    email = request.Email,
                    password = request.Password
                };

                var jsonContent = JsonSerializer.Serialize(registerPayload);
                var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");
                
                var supabaseKey = _configuration["Supabase:Key"];
                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Add("apikey", supabaseKey);
                _httpClient.DefaultRequestHeaders.Add("Content-Type", "application/json");

                var response = await _httpClient.PostAsync(registerUrl, content);
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning($"Supabase registration failed: {responseContent}");
                    
                    // Parse error message
                    var errorMessage = "เกิดข้อผิดพลาดในการสมัครสมาชิก";
                    try
                    {
                        var errorResponse = JsonSerializer.Deserialize<JsonElement>(responseContent);
                        if (errorResponse.TryGetProperty("error_description", out var errorDesc))
                        {
                            var messageStr = errorDesc.GetString() ?? "";
                            if (messageStr.Contains("User already registered"))
                            {
                                errorMessage = "อีเมลนี้ถูกใช้งานแล้ว";
                            }
                            else if (messageStr.Contains("Password"))
                            {
                                errorMessage = "รหัสผ่านไม่แข็งแรงพอ";
                            }
                            else
                            {
                                errorMessage = messageStr;
                            }
                        }
                    }
                    catch
                    {
                        // Use default error message
                    }

                    return BadRequest(new
                    {
                        success = false,
                        error = errorMessage
                    });
                }

                var registerResult = JsonSerializer.Deserialize<JsonElement>(responseContent);
                
                // Extract token and user info
                var accessToken = registerResult.GetProperty("access_token").GetString();
                var refreshToken = registerResult.GetProperty("refresh_token").GetString();
                var userObj = registerResult.GetProperty("user");
                var userId = userObj.GetProperty("id").GetString();
                var email = userObj.GetProperty("email").GetString();

                // สร้าง user profile ใน Supabase (ทำแบบ async เพื่อไม่ให้ block)
                var createdAt = DateTime.UtcNow;
                
                // กำหนดชื่อบัญชี - ใช้ displayName ถ้ามี หรือใช้ email แทน
                var accountName = !string.IsNullOrEmpty(request.DisplayName) 
                    ? request.DisplayName 
                    : email.Split('@')[0]; // ใช้ส่วนก่อน @ ของ email เป็นชื่อบัญชี

                var profileData = new Dictionary<string, object>
                {
                    ["id"] = userId,
                    ["uid"] = userId,
                    ["email"] = email,
                    ["displayName"] = accountName, // เก็บชื่อบัญชีเสมอ
                    ["accountName"] = accountName, // เก็บชื่อบัญชีแยกไว้ด้วย
                    ["createdAt"] = createdAt,
                    ["updatedAt"] = createdAt,
                    ["registrationDate"] = createdAt, // วันที่สมัครสมาชิก
                    ["isActive"] = true // สถานะบัญชี
                };

                // หมายเหตุ: ไม่เก็บรหัสผ่านใน Supabase เพราะ Supabase Authentication จัดการให้แล้ว
                // รหัสผ่านถูก hash และเก็บใน Supabase Authentication อย่างปลอดภัย

                // สร้าง profile ใน Supabase แบบ background (ไม่ block response)
                // ส่ง response กลับทันทีโดยไม่รอ profile creation
                _ = Task.Run(async () =>
                {
                    try
                    {
                        await _supabaseService.CreateAsync("users", profileData);
                        _logger.LogInformation($"User profile created successfully (background) - Email: {email}, AccountName: {accountName}, CreatedAt: {createdAt}");
                    }
                    catch (Exception profileEx)
                    {
                        _logger.LogError(profileEx, $"Failed to create user profile in Supabase for user: {email}");
                        // Profile จะถูกสร้างเมื่อ user login ครั้งแรกหรือแก้ไข profile
                    }
                });

                _logger.LogInformation($"User registered successfully: {email}");

                // ส่ง response กลับทันทีโดยไม่รอ profile creation
                // Profile จะถูกสร้างใน background
                var createdAtString = createdAt.ToString("o"); // ISO 8601 format
                
                return Ok(new
                {
                    success = true,
                    token = accessToken,
                    refreshToken = refreshToken,
                    userId = userId,
                    email = email,
                    user = new
                    {
                        uid = userId,
                        email = email,
                        displayName = accountName,
                        accountName = accountName,
                        createdAt = createdAtString,
                        updatedAt = createdAtString,
                        isActive = true
                    },
                    message = "สมัครสมาชิกสำเร็จ"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during registration");
                return StatusCode(500, new
                {
                    success = false,
                    error = "เกิดข้อผิดพลาดในการสมัครสมาชิก",
                    message = ex.Message
                });
            }
        }

        /// <summary>
        /// สร้างหรืออัปเดต User Profile - รับข้อมูลจาก Client แล้วส่งต่อไปยัง Supabase
        /// </summary>
        [HttpPost("profile")]
        [Authorize]
        public async Task<IActionResult> CreateOrUpdateProfile([FromBody] ProfileRequest request)
        {
            try
            {
                // ดึง userId จาก JWT claims - Supabase ใช้ 'sub' (subject) เป็น user ID
                var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                    ?? User.FindFirst("sub")?.Value
                    ?? User.FindFirst("user_id")?.Value
                    ?? User.FindFirst("uid")?.Value
                    ?? User.Identity?.Name
                    ?? throw new UnauthorizedAccessException("User ID not found in token");

                _logger.LogInformation($"Updating profile for user: {userId}");

                // ดึงข้อมูล profile ที่มีอยู่ก่อน
                var existingProfile = await _supabaseService.GetAsync("users", userId);

                // สร้าง dictionary สำหรับข้อมูลที่จะอัปเดต
                var profileData = new Dictionary<string, object>();

                // ถ้ามี profile อยู่แล้ว ให้ merge ข้อมูลเดิมกับข้อมูลใหม่
                if (existingProfile != null)
                {
                    // คัดลอกข้อมูลเดิมทั้งหมด
                    foreach (var item in existingProfile)
                    {
                        profileData[item.Key] = item.Value;
                    }
                }
                else
                {
                    // ถ้ายังไม่มี profile ให้สร้างใหม่
                    var createdAt = DateTime.UtcNow;
                    profileData["id"] = userId;
                    profileData["uid"] = userId;
                    profileData["createdAt"] = createdAt;
                    profileData["registrationDate"] = createdAt; // วันที่สมัครสมาชิก
                    profileData["isActive"] = true; // สถานะบัญชี
                }

                // อัปเดตเฉพาะฟิลด์ที่ส่งมา (partial update)
                if (request.AccountName != null)
                    profileData["accountName"] = request.AccountName;

                if (request.DisplayName != null)
                    profileData["displayName"] = request.DisplayName;

                if (request.Email != null)
                    profileData["email"] = request.Email;

                if (request.ProfileImage != null)
                    profileData["photoURL"] = request.ProfileImage;

                if (request.Phone != null)
                    profileData["phone"] = request.Phone;

                if (request.Address != null)
                    profileData["address"] = request.Address;

                // อัปเดต timestamp เสมอ
                profileData["updatedAt"] = DateTime.UtcNow;

                // บันทึกข้อมูล
                if (existingProfile == null)
                {
                    await _supabaseService.CreateAsync("users", profileData);
                    _logger.LogInformation($"Created new profile for user: {userId}");
                }
                else
                {
                    await _supabaseService.UpdateAsync("users", userId, profileData);
                    _logger.LogInformation($"Updated profile for user: {userId}");
                }

                // ดึงข้อมูล profile ที่อัปเดตแล้วเพื่อส่งกลับ
                var updatedProfile = await _supabaseService.GetAsync("users", userId);

                return Ok(new
                {
                    success = true,
                    message = "Profile saved successfully",
                    user = updatedProfile
                });
            }
            catch (UnauthorizedAccessException ex)
            {
                _logger.LogWarning(ex, "Unauthorized access attempt");
                return Unauthorized(new
                {
                    success = false,
                    error = "ไม่พบข้อมูลผู้ใช้ใน token",
                    message = ex.Message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving profile");
                return StatusCode(500, new
                {
                    success = false,
                    error = "เกิดข้อผิดพลาดในการบันทึกข้อมูลโปรไฟล์",
                    message = ex.Message
                });
            }
        }

        /// <summary>
        /// ดึงข้อมูล User Profile - รับข้อมูลจาก Supabase แล้วส่งกลับไปยัง Client
        /// </summary>
        [HttpGet("profile")]
        [Authorize]
        public async Task<IActionResult> GetProfile()
        {
            try
            {
                // ดึง userId จาก JWT claims - Supabase ใช้ 'sub' (subject) เป็น user ID
                var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                    ?? User.FindFirst("sub")?.Value
                    ?? User.FindFirst("user_id")?.Value
                    ?? User.FindFirst("uid")?.Value
                    ?? User.Identity?.Name
                    ?? throw new UnauthorizedAccessException("User ID not found in token");

                _logger.LogInformation($"Fetching profile for user: {userId}");

                var profile = await _supabaseService.GetAsync("users", userId);

                if (profile == null)
                {
                    _logger.LogWarning($"Profile not found for user: {userId}");
                    return NotFound(new
                    {
                        success = false,
                        error = "ไม่พบข้อมูลโปรไฟล์"
                    });
                }

                return Ok(new
                {
                    success = true,
                    user = profile
                });
            }
            catch (UnauthorizedAccessException ex)
            {
                _logger.LogWarning(ex, "Unauthorized access attempt");
                return Unauthorized(new
                {
                    success = false,
                    error = "ไม่พบข้อมูลผู้ใช้ใน token",
                    message = ex.Message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching profile");
                return StatusCode(500, new
                {
                    success = false,
                    error = "เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์",
                    message = ex.Message
                });
            }
        }

        /// <summary>
        /// อัปโหลดรูป Profile Image - รับไฟล์จาก Client แล้วส่งต่อไปยัง Cloudinary และ Supabase
        /// </summary>
        [HttpPost("upload-profile-image")]
        [Authorize]
        public async Task<IActionResult> UploadProfileImage(IFormFile profileImage)
        {
            try
            {
                if (profileImage == null || profileImage.Length == 0)
                {
                    return BadRequest(new
                    {
                        success = false,
                        error = "กรุณาเลือกไฟล์รูปภาพ"
                    });
                }

                // Validate file type
                var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
                var fileExtension = Path.GetExtension(profileImage.FileName).ToLowerInvariant();
                if (!allowedExtensions.Contains(fileExtension))
                {
                    return BadRequest(new
                    {
                        success = false,
                        error = "รูปแบบไฟล์ไม่ถูกต้อง กรุณาเลือกไฟล์รูปภาพเท่านั้น"
                    });
                }

                // Validate file size (5MB max)
                if (profileImage.Length > 5 * 1024 * 1024)
                {
                    return BadRequest(new
                    {
                        success = false,
                        error = "ขนาดไฟล์ต้องไม่เกิน 5MB"
                    });
                }

                // ดึง userId จาก JWT claims - Supabase ใช้ 'sub' (subject) เป็น user ID
                var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                    ?? User.FindFirst("sub")?.Value
                    ?? User.FindFirst("user_id")?.Value
                    ?? User.FindFirst("uid")?.Value
                    ?? User.Identity?.Name
                    ?? throw new UnauthorizedAccessException("User ID not found in token");

                // 1. อัปโหลดรูปไปยัง Cloudinary
                _logger.LogInformation($"Uploading profile image for user: {userId}");
                var uploadResult = await _cloudinaryService.UploadImageAsync(
                    profileImage, 
                    "wco-uploads/profiles"
                );

                if (uploadResult.StatusCode != System.Net.HttpStatusCode.OK)
                {
                    return StatusCode(500, new
                    {
                        success = false,
                        error = "เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ"
                    });
                }

                var imageUrl = uploadResult.SecureUrl.ToString();
                var publicId = uploadResult.PublicId;

                // 2. บันทึก URL ลง Supabase
                var updateData = new Dictionary<string, object>
                {
                    ["photoURL"] = imageUrl,
                    ["cloudinaryPublicId"] = publicId,
                    ["updatedAt"] = DateTime.UtcNow
                };

                var existingProfile = await _supabaseService.GetAsync("users", userId);
                if (existingProfile != null)
                {
                    // ลบรูปเก่าจาก Cloudinary ถ้ามี
                    if (existingProfile.ContainsKey("cloudinaryPublicId"))
                    {
                        var oldPublicId = existingProfile["cloudinaryPublicId"]?.ToString();
                        if (!string.IsNullOrEmpty(oldPublicId))
                        {
                            try
                            {
                                await _cloudinaryService.DeleteImageAsync(oldPublicId);
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, $"Failed to delete old profile image: {oldPublicId}");
                            }
                        }
                    }

                    await _supabaseService.UpdateAsync("users", userId, updateData);
                }
                else
                {
                    updateData["id"] = userId;
                    updateData["uid"] = userId;
                    updateData["createdAt"] = DateTime.UtcNow;
                    await _supabaseService.CreateAsync("users", updateData);
                }

                _logger.LogInformation($"Profile image uploaded successfully for user: {userId}");

                return Ok(new
                {
                    success = true,
                    imageUrl = imageUrl,
                    publicId = publicId,
                    savedToDatabase = true,
                    message = "อัปโหลดรูปโปรไฟล์สำเร็จ"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading profile image");
                return StatusCode(500, new
                {
                    success = false,
                    error = "เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ",
                    message = ex.Message
                });
            }
        }

        /// <summary>
        /// ตรวจสอบว่า User ได้ Like Post นี้หรือไม่
        /// </summary>
        [HttpGet("check-like/{postId}")]
        [Authorize]
        public async Task<IActionResult> CheckLike(string postId)
        {
            try
            {
                // ดึง userId จาก JWT claims - Supabase ใช้ 'sub' (subject) เป็น user ID
                var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                    ?? User.FindFirst("sub")?.Value
                    ?? User.FindFirst("user_id")?.Value
                    ?? User.FindFirst("uid")?.Value
                    ?? User.Identity?.Name;

                if (string.IsNullOrEmpty(userId))
                {
                    return Ok(new { liked = false });
                }

                var likes = await _supabaseService.QueryAsync("likes", "postId", postId);
                var userLike = likes.FirstOrDefault(l => 
                    l.ContainsKey("userId") && l["userId"]?.ToString() == userId);

                return Ok(new { liked = userLike != null });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking like status");
                return Ok(new { liked = false });
            }
        }

        /// <summary>
        /// Toggle Like สำหรับ Post
        /// </summary>
        [HttpPost("like/{postId}")]
        [Authorize]
        public async Task<IActionResult> ToggleLike(string postId)
        {
            try
            {
                // ดึง userId จาก JWT claims - Supabase ใช้ 'sub' (subject) เป็น user ID
                var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                    ?? User.FindFirst("sub")?.Value
                    ?? User.FindFirst("user_id")?.Value
                    ?? User.FindFirst("uid")?.Value
                    ?? User.Identity?.Name
                    ?? throw new UnauthorizedAccessException("User ID not found in token");

                // ตรวจสอบว่ามี like อยู่แล้วหรือไม่
                var likes = await _supabaseService.QueryAsync("likes", "postId", postId);
                var existingLike = likes.FirstOrDefault(l => 
                    l.ContainsKey("userId") && l["userId"]?.ToString() == userId);

                if (existingLike != null)
                {
                    // ลบ like
                    var likeId = existingLike["id"]?.ToString();
                    if (!string.IsNullOrEmpty(likeId))
                    {
                        await _supabaseService.DeleteAsync("likes", likeId);
                    }
                    return Ok(new { liked = false, message = "Unlike successful" });
                }
                else
                {
                    // เพิ่ม like
                    var likeData = new Dictionary<string, object>
                    {
                        ["postId"] = postId,
                        ["userId"] = userId,
                        ["createdAt"] = DateTime.UtcNow
                    };
                    await _supabaseService.CreateAsync("likes", likeData);
                    return Ok(new { liked = true, message = "Like successful" });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error toggling like");
                return StatusCode(500, new
                {
                    success = false,
                    error = "เกิดข้อผิดพลาดในการ like/unlike",
                    message = ex.Message
                });
            }
        }

        /// <summary>
        /// Refresh Token endpoint - รับ refresh token แล้ว refresh ID token ใหม่
        /// </summary>
        [HttpPost("refresh-token")]
        public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.RefreshToken))
                {
                    return BadRequest(new
                    {
                        success = false,
                        error = "กรุณาส่ง refresh token"
                    });
                }

                var supabaseUrl = _configuration["Supabase:Url"];
                if (string.IsNullOrEmpty(supabaseUrl))
                {
                    _logger.LogError("Supabase URL not configured");
                    return StatusCode(500, new
                    {
                        success = false,
                        error = "ระบบยังไม่ได้ตั้งค่า Supabase URL"
                    });
                }

                // ใช้ Supabase REST API เพื่อ refresh token
                var refreshUrl = $"{supabaseUrl}/auth/v1/token?grant_type=refresh_token";
                
                var refreshPayload = new
                {
                    refresh_token = request.RefreshToken
                };

                var jsonContent = JsonSerializer.Serialize(refreshPayload);
                var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");
                
                var supabaseKey = _configuration["Supabase:Key"];
                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Add("apikey", supabaseKey);
                _httpClient.DefaultRequestHeaders.Add("Content-Type", "application/json");

                var response = await _httpClient.PostAsync(refreshUrl, content);
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning($"Supabase token refresh failed: {responseContent}");
                    
                    // Parse error message
                    var errorMessage = "ไม่สามารถ refresh token ได้";
                    try
                    {
                        var errorResponse = JsonSerializer.Deserialize<JsonElement>(responseContent);
                        if (errorResponse.TryGetProperty("error_description", out var errorDesc))
                        {
                            var messageStr = errorDesc.GetString() ?? "";
                            if (messageStr.Contains("expired") || messageStr.Contains("invalid"))
                            {
                                errorMessage = "Refresh token หมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบอีกครั้ง";
                            }
                            else
                            {
                                errorMessage = messageStr;
                            }
                        }
                    }
                    catch
                    {
                        // Use default error message
                    }

                    return Unauthorized(new
                    {
                        success = false,
                        error = errorMessage
                    });
                }

                var refreshResult = JsonSerializer.Deserialize<JsonElement>(responseContent);
                
                // Extract new tokens
                var accessToken = refreshResult.GetProperty("access_token").GetString();
                var refreshToken = refreshResult.GetProperty("refresh_token").GetString();
                var userObj = refreshResult.GetProperty("user");
                var userId = userObj.GetProperty("id").GetString();
                var email = userObj.GetProperty("email")?.GetString() ?? "";

                _logger.LogInformation($"Token refreshed successfully for user: {userId}");

                return Ok(new
                {
                    success = true,
                    token = accessToken,
                    refreshToken = refreshToken,
                    userId = userId,
                    email = email,
                    message = "Refresh token สำเร็จ"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during token refresh");
                return StatusCode(500, new
                {
                    success = false,
                    error = "เกิดข้อผิดพลาดในการ refresh token",
                    message = ex.Message
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
        public string Email { get; set; } = string.Empty;
        
        [Required]
        public string Password { get; set; } = string.Empty;
        
        public string? DisplayName { get; set; }
    }

    public class ProfileRequest
    {
        [JsonPropertyName("accountName")]
        public string? AccountName { get; set; }
        
        [JsonPropertyName("displayName")]
        public string? DisplayName { get; set; }
        
        [JsonPropertyName("email")]
        public string? Email { get; set; }
        
        [JsonPropertyName("profileImage")]
        public string? ProfileImage { get; set; }
        
        [JsonPropertyName("phone")]
        public string? Phone { get; set; }
        
        [JsonPropertyName("address")]
        public string? Address { get; set; }
    }

    public class RefreshTokenRequest
    {
        [Required]
        [JsonPropertyName("refreshToken")]
        public string RefreshToken { get; set; } = string.Empty;
    }
}


using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using ServerApi.Services;
using System.ComponentModel.DataAnnotations;
using Google.Cloud.Firestore;
using System.Text.Json;
using System.Text;

namespace ServerApi.Controllers
{
    /// <summary>
    /// Controller สำหรับจัดการ Authentication และ Profile - ทำหน้าที่เป็น Middleware ระหว่าง Client กับ Firebase/Cloudinary
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly FirebaseService _firebaseService;
        private readonly CloudinaryService _cloudinaryService;
        private readonly ILogger<AuthController> _logger;
        private readonly IConfiguration _configuration;
        private readonly HttpClient _httpClient;

        public AuthController(
            FirebaseService firebaseService,
            CloudinaryService cloudinaryService,
            ILogger<AuthController> logger,
            IConfiguration configuration,
            IHttpClientFactory httpClientFactory)
        {
            _firebaseService = firebaseService;
            _cloudinaryService = cloudinaryService;
            _logger = logger;
            _configuration = configuration;
            _httpClient = httpClientFactory.CreateClient();
        }

        /// <summary>
        /// Login endpoint - รับ email/password แล้ว authenticate ผ่าน Firebase REST API
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

                var firebaseApiKey = _configuration["Firebase:ApiKey"];
                if (string.IsNullOrEmpty(firebaseApiKey))
                {
                    _logger.LogError("Firebase API Key not configured");
                    return StatusCode(500, new
                    {
                        success = false,
                        error = "ระบบยังไม่ได้ตั้งค่า Firebase API Key"
                    });
                }

                // ใช้ Firebase REST API เพื่อ authenticate
                var loginUrl = $"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={firebaseApiKey}";
                
                var loginPayload = new
                {
                    email = request.Email,
                    password = request.Password,
                    returnSecureToken = true
                };

                var jsonContent = JsonSerializer.Serialize(loginPayload);
                var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync(loginUrl, content);
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning($"Firebase login failed: {responseContent}");
                    
                    // Parse error message
                    var errorResponse = JsonSerializer.Deserialize<JsonElement>(responseContent);
                    var errorMessage = "เกิดข้อผิดพลาดในการเข้าสู่ระบบ";
                    
                    if (errorResponse.TryGetProperty("error", out var errorObj))
                    {
                        if (errorObj.TryGetProperty("message", out var message))
                        {
                            var messageStr = message.GetString() ?? "";
                            if (messageStr.Contains("INVALID_PASSWORD") || messageStr.Contains("INVALID_EMAIL"))
                            {
                                errorMessage = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
                            }
                            else if (messageStr.Contains("USER_NOT_FOUND"))
                            {
                                errorMessage = "ไม่พบผู้ใช้นี้ในระบบ";
                            }
                            else if (messageStr.Contains("TOO_MANY_ATTEMPTS"))
                            {
                                errorMessage = "พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่";
                            }
                            else
                            {
                                errorMessage = messageStr;
                            }
                        }
                    }

                    return Unauthorized(new
                    {
                        success = false,
                        error = errorMessage
                    });
                }

                var loginResult = JsonSerializer.Deserialize<JsonElement>(responseContent);
                
                // Extract token and user info
                var idToken = loginResult.GetProperty("idToken").GetString();
                var refreshToken = loginResult.GetProperty("refreshToken").GetString();
                var localId = loginResult.GetProperty("localId").GetString();
                var email = loginResult.GetProperty("email").GetString();

                _logger.LogInformation($"User logged in successfully: {email}");

                return Ok(new
                {
                    success = true,
                    token = idToken,
                    refreshToken = refreshToken,
                    userId = localId,
                    email = email,
                    message = "เข้าสู่ระบบสำเร็จ"
                });
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
        /// Register endpoint - รับ email/password/displayName แล้วสร้าง user ผ่าน Firebase REST API
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

                var firebaseApiKey = _configuration["Firebase:ApiKey"];
                if (string.IsNullOrEmpty(firebaseApiKey))
                {
                    _logger.LogError("Firebase API Key not configured");
                    return StatusCode(500, new
                    {
                        success = false,
                        error = "ระบบยังไม่ได้ตั้งค่า Firebase API Key"
                    });
                }

                // ใช้ Firebase REST API เพื่อสร้าง user
                var registerUrl = $"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={firebaseApiKey}";
                
                var registerPayload = new
                {
                    email = request.Email,
                    password = request.Password,
                    returnSecureToken = true
                };

                var jsonContent = JsonSerializer.Serialize(registerPayload);
                var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync(registerUrl, content);
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning($"Firebase registration failed: {responseContent}");
                    
                    // Parse error message
                    var errorResponse = JsonSerializer.Deserialize<JsonElement>(responseContent);
                    var errorMessage = "เกิดข้อผิดพลาดในการสมัครสมาชิก";
                    
                    if (errorResponse.TryGetProperty("error", out var errorObj))
                    {
                        if (errorObj.TryGetProperty("message", out var message))
                        {
                            var messageStr = message.GetString() ?? "";
                            if (messageStr.Contains("EMAIL_EXISTS"))
                            {
                                errorMessage = "อีเมลนี้ถูกใช้งานแล้ว";
                            }
                            else if (messageStr.Contains("WEAK_PASSWORD"))
                            {
                                errorMessage = "รหัสผ่านไม่แข็งแรงพอ";
                            }
                            else
                            {
                                errorMessage = messageStr;
                            }
                        }
                    }

                    return BadRequest(new
                    {
                        success = false,
                        error = errorMessage
                    });
                }

                var registerResult = JsonSerializer.Deserialize<JsonElement>(responseContent);
                
                // Extract token and user info
                var idToken = registerResult.GetProperty("idToken").GetString();
                var refreshToken = registerResult.GetProperty("refreshToken").GetString();
                var localId = registerResult.GetProperty("localId").GetString();
                var email = registerResult.GetProperty("email").GetString();

                // สร้าง user profile ใน Firestore
                try
                {
                    var profileData = new Dictionary<string, object>
                    {
                        ["uid"] = localId,
                        ["email"] = email,
                        ["createdAt"] = Timestamp.GetCurrentTimestamp(),
                        ["updatedAt"] = Timestamp.GetCurrentTimestamp()
                    };

                    if (!string.IsNullOrEmpty(request.DisplayName))
                    {
                        profileData["displayName"] = request.DisplayName;
                    }

                    await _firebaseService.CreateAsync("users", profileData);
                    _logger.LogInformation($"User profile created: {email}");
                }
                catch (Exception profileEx)
                {
                    _logger.LogWarning(profileEx, "Failed to create user profile, but registration succeeded");
                    // Continue even if profile creation fails
                }

                _logger.LogInformation($"User registered successfully: {email}");

                return Ok(new
                {
                    success = true,
                    token = idToken,
                    refreshToken = refreshToken,
                    userId = localId,
                    email = email,
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
        /// สร้างหรืออัปเดต User Profile - รับข้อมูลจาก Client แล้วส่งต่อไปยัง Firebase
        /// </summary>
        [HttpPost("profile")]
        [Authorize]
        public async Task<IActionResult> CreateOrUpdateProfile([FromBody] ProfileRequest request)
        {
            try
            {
                var userId = User.FindFirst("uid")?.Value 
                    ?? User.FindFirst("user_id")?.Value 
                    ?? User.Identity?.Name 
                    ?? throw new UnauthorizedAccessException("User ID not found");

                var profileData = new Dictionary<string, object>
                {
                    ["updatedAt"] = Timestamp.GetCurrentTimestamp()
                };

                if (!string.IsNullOrEmpty(request.DisplayName))
                    profileData["displayName"] = request.DisplayName;

                if (!string.IsNullOrEmpty(request.Email))
                    profileData["email"] = request.Email;

                if (!string.IsNullOrEmpty(request.ProfileImage))
                    profileData["photoURL"] = request.ProfileImage;

                // ตรวจสอบว่ามี profile อยู่แล้วหรือไม่
                var existingProfile = await _firebaseService.GetAsync("users", userId);

                if (existingProfile == null)
                {
                    // สร้าง profile ใหม่
                    profileData["createdAt"] = Timestamp.GetCurrentTimestamp();
                    profileData["uid"] = userId;
                    await _firebaseService.CreateAsync("users", profileData);
                    _logger.LogInformation($"Created new profile for user: {userId}");
                }
                else
                {
                    // อัปเดต profile ที่มีอยู่
                    await _firebaseService.UpdateAsync("users", userId, profileData);
                    _logger.LogInformation($"Updated profile for user: {userId}");
                }

                var updatedProfile = await _firebaseService.GetAsync("users", userId);

                return Ok(new
                {
                    success = true,
                    message = "Profile saved successfully",
                    user = updatedProfile
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
        /// ดึงข้อมูล User Profile - รับข้อมูลจาก Firebase แล้วส่งกลับไปยัง Client
        /// </summary>
        [HttpGet("profile")]
        [Authorize]
        public async Task<IActionResult> GetProfile()
        {
            try
            {
                var userId = User.FindFirst("uid")?.Value 
                    ?? User.FindFirst("user_id")?.Value 
                    ?? User.Identity?.Name 
                    ?? throw new UnauthorizedAccessException("User ID not found");

                var profile = await _firebaseService.GetAsync("users", userId);

                if (profile == null)
                {
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
        /// อัปโหลดรูป Profile Image - รับไฟล์จาก Client แล้วส่งต่อไปยัง Cloudinary และ Firebase
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

                var userId = User.FindFirst("uid")?.Value 
                    ?? User.FindFirst("user_id")?.Value 
                    ?? User.Identity?.Name 
                    ?? throw new UnauthorizedAccessException("User ID not found");

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

                // 2. บันทึก URL ลง Firebase
                var updateData = new Dictionary<string, object>
                {
                    ["photoURL"] = imageUrl,
                    ["cloudinaryPublicId"] = publicId,
                    ["updatedAt"] = Timestamp.GetCurrentTimestamp()
                };

                var existingProfile = await _firebaseService.GetAsync("users", userId);
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

                    await _firebaseService.UpdateAsync("users", userId, updateData);
                }
                else
                {
                    updateData["uid"] = userId;
                    updateData["createdAt"] = Timestamp.GetCurrentTimestamp();
                    await _firebaseService.CreateAsync("users", updateData);
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
                var userId = User.FindFirst("uid")?.Value 
                    ?? User.FindFirst("user_id")?.Value 
                    ?? User.Identity?.Name;

                if (string.IsNullOrEmpty(userId))
                {
                    return Ok(new { liked = false });
                }

                var likes = await _firebaseService.QueryAsync("likes", "postId", postId);
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
                var userId = User.FindFirst("uid")?.Value 
                    ?? User.FindFirst("user_id")?.Value 
                    ?? User.Identity?.Name 
                    ?? throw new UnauthorizedAccessException("User ID not found");

                // ตรวจสอบว่ามี like อยู่แล้วหรือไม่
                var likes = await _firebaseService.QueryAsync("likes", "postId", postId);
                var existingLike = likes.FirstOrDefault(l => 
                    l.ContainsKey("userId") && l["userId"]?.ToString() == userId);

                if (existingLike != null)
                {
                    // ลบ like
                    var likeId = existingLike["id"]?.ToString();
                    if (!string.IsNullOrEmpty(likeId))
                    {
                        await _firebaseService.DeleteAsync("likes", likeId);
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
                        ["createdAt"] = Timestamp.GetCurrentTimestamp()
                    };
                    await _firebaseService.CreateAsync("likes", likeData);
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
        public string? DisplayName { get; set; }
        public string? Email { get; set; }
        public string? ProfileImage { get; set; }
    }
}


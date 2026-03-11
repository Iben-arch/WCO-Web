using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using ServerApi.Services;

namespace ServerApi.Controllers
{
    /// <summary>
    /// Controller สำหรับจัดการ Posts - รูปโพสต์เก็บใน Supabase Storage (อัปโหลดจาก Client โดยตรง)
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class PostsController : BaseController
    {
        private readonly SupabaseService _supabaseService;
        private readonly ILogger<PostsController> _logger;

        public PostsController(
            SupabaseService supabaseService,
            ILogger<PostsController> logger)
        {
            _supabaseService = supabaseService;
            _logger = logger;
        }

        /// <summary>
        /// สร้าง Post ใหม่ - รับ imageUrls จาก Client (อัปโหลดไป Supabase Storage แล้ว)
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CreatePost([FromBody] CreatePostRequest? request)
        {
            try
            {
                if (request == null)
                {
                    return BadRequest(new { success = false, error = "ข้อมูลไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง" });
                }

                var imageUrls = request.ImageUrls ?? new List<string>();
                var imageStoragePaths = request.ImageStoragePaths ?? new List<string>();

                _logger.LogInformation($"CreatePost received: imageUrls={imageUrls.Count}, imageStoragePaths={imageStoragePaths.Count}");

                if (imageUrls.Count == 0)
                {
                    return BadRequest(new { success = false, error = "กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป" });
                }

                var userId = GetUserId() ?? "unknown";
                var userName = "Unknown User";

                // ดึง username จาก profiles table (เพราะ JWT ไม่มี claim "name")
                if (userId != "unknown")
                {
                    var profile = await _supabaseService.GetAsync("profiles", userId, useServiceRole: true);
                    if (profile != null && profile.TryGetValue("username", out var usernameObj) && usernameObj != null)
                    {
                        userName = usernameObj.ToString() ?? userName;
                    }
                }

                var postData = new Dictionary<string, object>
                {
                    ["title"] = request.Title ?? "การ์ดเกม",
                    ["description"] = request.Description ?? "",
                    ["category"] = request.Category ?? "",
                    ["images"] = imageUrls,
                    ["imageStoragePaths"] = imageStoragePaths,
                    ["sellerId"] = userId,
                    ["sellerName"] = userName,
                    ["status"] = "active",
                    ["postType"] = request.PostType ?? "sale",
                    ["createdAt"] = DateTime.UtcNow,
                    ["updatedAt"] = DateTime.UtcNow
                };

                if (request.PostType == "sale")
                {
                    if (!string.IsNullOrEmpty(request.Price))
                        postData["price"] = double.Parse(request.Price);

                    if (request.SaleType != null)
                        postData["saleType"] = request.SaleType;

                    if (request.SaleType == "deck")
                    {
                        if (!string.IsNullOrEmpty(request.CardCount))
                            postData["cardCount"] = int.Parse(request.CardCount);
                        if (!string.IsNullOrEmpty(request.DeckDescription))
                            postData["deckDescription"] = request.DeckDescription;
                    }
                    else if (request.SaleType == "individual")
                    {
                        if (!string.IsNullOrEmpty(request.IndividualPrice))
                            postData["individualPrice"] = double.Parse(request.IndividualPrice);
                        if (!string.IsNullOrEmpty(request.AvailableQuantity))
                            postData["availableQuantity"] = int.Parse(request.AvailableQuantity);
                        if (request.IndividualCards != null && request.IndividualCards.Count > 0)
                        {
                            postData["individualCards"] = request.IndividualCards;
                            if (!string.IsNullOrEmpty(request.Price))
                                postData["individualPrice"] = double.Parse(request.Price);
                            if (!string.IsNullOrEmpty(request.AvailableQuantity))
                                postData["availableQuantity"] = int.Parse(request.AvailableQuantity);
                        }
                    }
                }
                else if (request.PostType == "auction")
                {
                    if (!string.IsNullOrEmpty(request.StartingBid))
                        postData["startingBid"] = double.Parse(request.StartingBid);
                    if (!string.IsNullOrEmpty(request.BuyNowPrice))
                        postData["buyNowPrice"] = double.Parse(request.BuyNowPrice);
                    if (!string.IsNullOrEmpty(request.AuctionEndDate))
                        postData["auctionEndDate"] = DateTime.Parse(request.AuctionEndDate);

                    if (request.SaleType != null)
                        postData["saleType"] = request.SaleType;

                    if (request.SaleType == "deck")
                    {
                        if (!string.IsNullOrEmpty(request.CardCount))
                            postData["cardCount"] = int.Parse(request.CardCount);
                    }
                    else if (request.SaleType == "individual")
                    {
                        if (!string.IsNullOrEmpty(request.AvailableQuantity))
                            postData["availableQuantity"] = int.Parse(request.AvailableQuantity);
                    }
                }

                if (!string.IsNullOrEmpty(request.Condition))
                    postData["condition"] = request.Condition;

                if (!string.IsNullOrEmpty(request.Game))
                    postData["game"] = request.Game;

                if (request.IndividualCards != null && request.IndividualCards.Count > 0)
                {
                    postData["individualCards"] = request.IndividualCards;
                }

                _logger.LogInformation("Saving post to Supabase...");
                var postId = await _supabaseService.CreateAsync("posts", postData, useServiceRole: true);
                _logger.LogInformation($"Post created with ID: {postId}");

                var createdPost = await _supabaseService.GetAsync("posts", postId);

                return Ok(new
                {
                    success = true,
                    message = "Post created successfully",
                    id = postId,
                    data = createdPost
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating post");
                return StatusCode(500, new
                {
                    success = false,
                    error = "เกิดข้อผิดพลาดในการสร้างโพสต์",
                    message = ex.Message
                });
            }
        }

        /// <summary>
        /// อ่าน Post ทั้งหมด - รองรับ pagination, filtering, และ sorting
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetPosts(
            [FromQuery] string? category,
            [FromQuery] string? search,
            [FromQuery] int page = 1,
            [FromQuery] int limit = 12,
            [FromQuery] string? sortBy = "newest",
            [FromQuery] string? postType = null,
            [FromQuery] string? status = null)
        {
            try
            {
                // ใช้ database-level filter, sort, pagination แทนการโหลดทั้งหมด
                var (posts, total) = await _supabaseService.GetPostsFilteredAsync(
                    category, search, sortBy, page, limit, postType, status, useServiceRole: true);

                var totalPages = (int)Math.Ceiling(total / (double)limit);

                return Ok(new
                {
                    posts,
                    pagination = new
                    {
                        page,
                        limit,
                        total,
                        totalPages
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching posts");
                return StatusCode(500, new
                {
                    success = false,
                    error = "เกิดข้อผิดพลาดในการดึงข้อมูลโพสต์",
                    message = ex.Message
                });
            }
        }

        /// <summary>
        /// Helper method สำหรับดึงราคาของ post
        /// </summary>
        private double GetPostPrice(Dictionary<string, object> post)
        {
            try
            {
                if (post.ContainsKey("postType") && post["postType"]?.ToString() == "sale")
                {
                    if (post.ContainsKey("saleType") && post["saleType"]?.ToString() == "individual")
                    {
                        if (post.ContainsKey("individualPrice"))
                        {
                            return Convert.ToDouble(post["individualPrice"]);
                        }
                    }
                    if (post.ContainsKey("price"))
                    {
                        return Convert.ToDouble(post["price"]);
                    }
                }
                else if (post.ContainsKey("postType") && post["postType"]?.ToString() == "auction")
                {
                    if (post.ContainsKey("currentBid"))
                    {
                        return Convert.ToDouble(post["currentBid"]);
                    }
                    if (post.ContainsKey("startingBid"))
                    {
                        return Convert.ToDouble(post["startingBid"]);
                    }
                }
            }
            catch
            {
                // Return 0 if conversion fails
            }
            return 0;
        }

        /// <summary>
        /// Helper method สำหรับดึงวันที่ของ post
        /// </summary>
        private DateTime GetPostDate(Dictionary<string, object> post)
        {
            try
            {
                if (post.ContainsKey("createdAt"))
                {
                    var dateValue = post["createdAt"];
                    if (dateValue is DateTime dt)
                        return dt;
                    if (dateValue is string str && DateTime.TryParse(str, out var parsed))
                        return parsed;
                    if (dateValue != null)
                    {
                        // Try to convert from various formats
                        var dateStr = dateValue.ToString();
                        if (DateTime.TryParse(dateStr, out var parsed2))
                            return parsed2;
                    }
                }
            }
            catch
            {
                // Return MinValue if conversion fails
            }
            return DateTime.MinValue;
        }

        /// <summary>
        /// ดึงโพสต์ทั้งหมดของผู้ขายตาม sellerId (สำหรับหน้า SellerProfile/ประวัติผู้ขาย)
        /// </summary>
        [HttpGet("seller/{sellerId}")]
        public async Task<IActionResult> GetPostsBySeller(string sellerId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(sellerId))
                {
                    return BadRequest(new { success = false, error = "ไม่พบรหัสผู้ขาย", posts = Array.Empty<object>() });
                }

                var postsData = await _supabaseService.QueryAsync("posts", "sellerId", sellerId, useServiceRole: true);

                if (postsData == null || postsData.Count == 0)
                {
                    return Ok(new { posts = new List<object>(), pagination = new { total = 0 } });
                }

                return Ok(new
                {
                    posts = postsData,
                    pagination = new { total = postsData.Count }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching seller posts");
                return StatusCode(500, new
                {
                    success = false,
                    error = "เกิดข้อผิดพลาดในการดึงข้อมูลโพสต์ของผู้ขาย",
                    posts = Array.Empty<object>()
                });
            }
        }

        /// <summary>
        /// อ่าน Post ตาม ID
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetPost(string id)
        {
            try
            {
                var post = await _supabaseService.GetAsync("posts", id);
                
                if (post == null)
                {
                    return NotFound(new { success = false, error = "ไม่พบโพสต์ที่ระบุ" });
                }

                return Ok(post);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching post");
                return StatusCode(500, new
                {
                    success = false,
                    error = "เกิดข้อผิดพลาดในการดึงข้อมูลโพสต์",
                    message = ex.Message
                });
            }
        }

        /// <summary>
        /// อัปเดต Post
        /// </summary>
        [HttpPut("{id}")]
        // REMOVED: [Authorize] - Token system is no longer used
        public async Task<IActionResult> UpdatePost(string id, [FromBody] UpdatePostRequest request)
        {
            try
            {
                var userId = GetUserId();
                var existingPost = await _supabaseService.GetAsync("posts", id);

                if (existingPost == null)
                {
                    return NotFound(new { success = false, error = "ไม่พบโพสต์ที่ระบุ" });
                }

                // ตรวจสอบว่าเป็นเจ้าของโพสต์
                if (string.IsNullOrEmpty(userId) || (existingPost.ContainsKey("sellerId") && existingPost["sellerId"]?.ToString() != userId))
                {
                    return Forbid("คุณไม่มีสิทธิ์แก้ไขโพสต์นี้");
                }

                var updateData = new Dictionary<string, object>
                {
                    ["updatedAt"] = DateTime.UtcNow
                };

                if (!string.IsNullOrEmpty(request.Title))
                    updateData["title"] = request.Title;
                if (!string.IsNullOrEmpty(request.Description))
                    updateData["description"] = request.Description;
                if (!string.IsNullOrEmpty(request.Category))
                    updateData["category"] = request.Category;
                if (request.Price.HasValue)
                    updateData["price"] = request.Price.Value;

                await _supabaseService.UpdateAsync("posts", id, updateData);

                var updatedPost = await _supabaseService.GetAsync("posts", id);

                return Ok(new
                {
                    success = true,
                    message = "Post updated successfully",
                    data = updatedPost
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating post");
                return StatusCode(500, new
                {
                    success = false,
                    error = "เกิดข้อผิดพลาดในการอัปเดตโพสต์",
                    message = ex.Message
                });
            }
        }

        /// <summary>
        /// ลบ Post
        /// </summary>
        [HttpDelete("{id}")]
        // REMOVED: [Authorize] - Token system is no longer used
        public async Task<IActionResult> DeletePost(string id)
        {
            try
            {
                var userId = GetUserId();
                var existingPost = await _supabaseService.GetAsync("posts", id);

                if (existingPost == null)
                {
                    return NotFound(new { success = false, error = "ไม่พบโพสต์ที่ระบุ" });
                }

                // ตรวจสอบว่าเป็นเจ้าของโพสต์
                if (string.IsNullOrEmpty(userId) || (existingPost.ContainsKey("sellerId") && existingPost["sellerId"]?.ToString() != userId))
                {
                    return Forbid("คุณไม่มีสิทธิ์ลบโพสต์นี้");
                }

                // ลบรูปภาพจาก Supabase Storage ถ้ามี
                if (existingPost.ContainsKey("imageStoragePaths"))
                {
                    var paths = existingPost["imageStoragePaths"];
                    var pathList = new List<string>();
                    if (paths is List<object> listObj)
                    {
                        pathList = listObj.Select(p => p?.ToString() ?? "").Where(s => !string.IsNullOrEmpty(s)).ToList();
                    }
                    else if (paths is System.Text.Json.JsonElement je && je.ValueKind == System.Text.Json.JsonValueKind.Array)
                    {
                        foreach (var item in je.EnumerateArray())
                            pathList.Add(item.GetString() ?? "");
                    }
                    if (pathList.Count > 0)
                        await _supabaseService.DeleteStorageObjectsAsync("posts", pathList);
                }

                // ลบข้อมูลจาก Supabase
                await _supabaseService.DeleteAsync("posts", id);

                return Ok(new
                {
                    success = true,
                    message = "Post deleted successfully"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting post");
                return StatusCode(500, new
                {
                    success = false,
                    error = "เกิดข้อผิดพลาดในการลบโพสต์",
                    message = ex.Message
                });
            }
        }

        /// <summary>
        /// ดึงโพสต์ของ User
        /// </summary>
        [HttpGet("my-posts")]
        // REMOVED: [Authorize] - Token system is no longer used
        public async Task<IActionResult> GetMyPosts()
        {
            try
            {
                var userId = GetUserId() ?? "";
                var posts = await _supabaseService.QueryAsync("posts", "sellerId", userId);

                return Ok(new { posts });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching user posts");
                return StatusCode(500, new
                {
                    success = false,
                    error = "เกิดข้อผิดพลาดในการดึงข้อมูลโพสต์",
                    message = ex.Message
                });
            }
        }
    }

    public class CreatePostRequest
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public string? Category { get; set; }
        public List<string>? ImageUrls { get; set; }
        public List<string>? ImageStoragePaths { get; set; }
        public string? PostType { get; set; }
        public string? SaleType { get; set; }
        public string? Price { get; set; }
        public string? IndividualPrice { get; set; }
        public string? StartingBid { get; set; }
        public string? BuyNowPrice { get; set; }
        public string? AuctionEndDate { get; set; }
        public string? CardCount { get; set; }
        public string? DeckDescription { get; set; }
        public string? AvailableQuantity { get; set; }
        public List<IndividualCardDto>? IndividualCards { get; set; }
        public string? Condition { get; set; }
        public string? Game { get; set; }
    }

    public class IndividualCardDto
    {
        [JsonPropertyName("id")]
        public string? Id { get; set; }
        [JsonPropertyName("imageUrl")]
        public string ImageUrl { get; set; } = string.Empty;
        [JsonPropertyName("price")]
        public double Price { get; set; }
        [JsonPropertyName("quantity")]
        public int Quantity { get; set; }
    }

    public class UpdatePostRequest
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public string? Category { get; set; }
        public double? Price { get; set; }
    }
}


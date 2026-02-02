using Microsoft.AspNetCore.Mvc;
// REMOVED: using Microsoft.AspNetCore.Authorization; - Token system is no longer used
using ServerApi.Services;
using System.ComponentModel.DataAnnotations;

namespace ServerApi.Controllers
{
    /// <summary>
    /// Controller สำหรับจัดการ Posts - ทำหน้าที่เป็น Middleware ระหว่าง Client กับ Supabase/Cloudinary
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class PostsController : BaseController
    {
        private readonly SupabaseService _supabaseService;
        private readonly CloudinaryService _cloudinaryService;
        private readonly ILogger<PostsController> _logger;

        public PostsController(
            SupabaseService supabaseService,
            CloudinaryService cloudinaryService,
            ILogger<PostsController> logger)
        {
            _supabaseService = supabaseService;
            _cloudinaryService = cloudinaryService;
            _logger = logger;
        }

        /// <summary>
        /// สร้าง Post ใหม่ - รับข้อมูลจาก Client แล้วส่งต่อไปยัง Supabase และ Cloudinary
        /// </summary>
        [HttpPost]
        // REMOVED: [Authorize] - Token system is no longer used
        public async Task<IActionResult> CreatePost([FromForm] CreatePostRequest request)
        {
            try
            {
                // 1. อัปโหลดรูปภาพไปยัง Cloudinary
                var imageUrls = new List<string>();
                var cloudinaryPublicIds = new List<string>();

                if (request.Images != null && request.Images.Count > 0)
                {
                    _logger.LogInformation($"Uploading {request.Images.Count} images to Cloudinary...");
                    
                    var uploadResults = await _cloudinaryService.UploadImagesAsync(
                        request.Images, 
                        "wco-uploads/posts"
                    );

                    foreach (var result in uploadResults)
                    {
                        if (result.StatusCode == System.Net.HttpStatusCode.OK)
                        {
                            imageUrls.Add(result.SecureUrl.ToString());
                            cloudinaryPublicIds.Add(result.PublicId);
                        }
                    }

                    _logger.LogInformation($"Successfully uploaded {imageUrls.Count} images");
                }

                // 2. เตรียมข้อมูลสำหรับ Supabase
                var userId = GetUserId() ?? "unknown";
                var userName = User.FindFirst("name")?.Value ?? "Unknown User";

                var postData = new Dictionary<string, object>
                {
                    ["title"] = request.Title,
                    ["description"] = request.Description ?? "",
                    ["category"] = request.Category,
                    ["images"] = imageUrls,
                    ["cloudinaryPublicIds"] = cloudinaryPublicIds,
                    ["sellerId"] = userId,
                    ["sellerName"] = userName,
                    ["status"] = "pending",
                    ["postType"] = request.PostType ?? "sale",
                    ["createdAt"] = DateTime.UtcNow,
                    ["updatedAt"] = DateTime.UtcNow
                };

                // เพิ่มข้อมูลตาม postType
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

                // 3. บันทึกข้อมูลลง Supabase
                _logger.LogInformation("Saving post to Supabase...");
                var postId = await _supabaseService.CreateAsync("posts", postData);
                _logger.LogInformation($"Post created with ID: {postId}");

                // 4. ดึงข้อมูลที่บันทึกแล้วเพื่อส่งกลับ
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
                List<Dictionary<string, object>> posts;

                // ดึงข้อมูล posts
                if (!string.IsNullOrEmpty(category))
                {
                    posts = await _supabaseService.QueryAsync("posts", "category", category);
                }
                else
                {
                    posts = await _supabaseService.GetAllAsync("posts");
                }

                // Filter by postType
                if (!string.IsNullOrEmpty(postType))
                {
                    posts = posts.Where(p =>
                        p.ContainsKey("postType") && p["postType"]?.ToString() == postType
                    ).ToList();
                }

                // Filter by status
                if (!string.IsNullOrEmpty(status))
                {
                    posts = posts.Where(p =>
                        p.ContainsKey("status") && p["status"]?.ToString() == status
                    ).ToList();
                }

                // Filter by search term
                if (!string.IsNullOrEmpty(search))
                {
                    posts = posts.Where(p =>
                        (p.ContainsKey("title") && p["title"]?.ToString()?.Contains(search, StringComparison.OrdinalIgnoreCase) == true) ||
                        (p.ContainsKey("description") && p["description"]?.ToString()?.Contains(search, StringComparison.OrdinalIgnoreCase) == true)
                    ).ToList();
                }

                // Server-side sorting
                posts = sortBy?.ToLower() switch
                {
                    "priceasc" => posts.OrderBy(p => GetPostPrice(p)).ToList(),
                    "pricedesc" => posts.OrderByDescending(p => GetPostPrice(p)).ToList(),
                    _ => posts.OrderByDescending(p => GetPostDate(p)).ToList()
                };

                // Pagination
                var total = posts.Count;
                var totalPages = (int)Math.Ceiling(total / (double)limit);
                var paginatedPosts = posts.Skip((page - 1) * limit).Take(limit).ToList();

                return Ok(new
                {
                    posts = paginatedPosts,
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

                // ลบรูปภาพจาก Cloudinary ถ้ามี
                if (existingPost.ContainsKey("cloudinaryPublicIds"))
                {
                    var publicIds = existingPost["cloudinaryPublicIds"] as List<object>;
                    if (publicIds != null && publicIds.Count > 0)
                    {
                        var stringIds = publicIds.Select(p => p.ToString()!).ToList();
                        await _cloudinaryService.DeleteImagesAsync(stringIds);
                    }
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

                return Ok(posts);
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
        [Required]
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        [Required]
        public string Category { get; set; } = string.Empty;
        public List<IFormFile>? Images { get; set; }
        public string? PostType { get; set; } // "sale" or "auction"
        public string? SaleType { get; set; } // "deck" or "individual"
        public string? Price { get; set; }
        public string? IndividualPrice { get; set; }
        public string? StartingBid { get; set; }
        public string? BuyNowPrice { get; set; }
        public string? AuctionEndDate { get; set; }
        public string? CardCount { get; set; }
        public string? DeckDescription { get; set; }
        public string? AvailableQuantity { get; set; }
        public string? Condition { get; set; }
        public string? Game { get; set; }
    }

    public class UpdatePostRequest
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public string? Category { get; set; }
        public double? Price { get; set; }
    }
}


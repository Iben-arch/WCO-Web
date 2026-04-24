using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
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
        private readonly AuctionService _auctionService;
        private readonly RelatedPostsService _relatedPostsService;
        private readonly ILogger<PostsController> _logger;

        private readonly IServiceScopeFactory _scopeFactory;

        public PostsController(
            SupabaseService supabaseService,
            AuctionService auctionService,
            RelatedPostsService relatedPostsService,
            ILogger<PostsController> logger,
            IServiceScopeFactory scopeFactory)
        {
            _supabaseService = supabaseService;
            _auctionService = auctionService;
            _relatedPostsService = relatedPostsService;
            _logger = logger;
            _scopeFactory = scopeFactory;
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

                var titleTrim = request.Title?.Trim() ?? "";
                if (titleTrim.Length < 3)
                {
                    return BadRequest(new { success = false, error = "กรุณากรอกชื่อการ์ดอย่างน้อย 3 ตัวอักษร" });
                }

                if (string.IsNullOrWhiteSpace(request.Category))
                {
                    return BadRequest(new { success = false, error = "กรุณาเลือกประเภทการ์ด (หมวดหมู่)" });
                }

                var userId = GetUserId() ?? "unknown";
                if (userId == "unknown")
                {
                    return Unauthorized(new { success = false, error = "กรุณาเข้าสู่ระบบ" });
                }

                var userName = "Unknown User";
                var profile = await _supabaseService.GetAsync("profiles", userId, useServiceRole: true, idField: "id");
                if (profile != null && profile.TryGetValue("username", out var usernameObj) && usernameObj != null)
                {
                    userName = usernameObj.ToString() ?? userName;
                }

                var role = profile != null && profile.TryGetValue("role", out var roleObj) ? roleObj?.ToString() : null;
                var canCreatePost = !string.IsNullOrEmpty(role) &&
                    (role.Equals("seller", StringComparison.OrdinalIgnoreCase) ||
                     role.Equals("admin", StringComparison.OrdinalIgnoreCase));
                if (!canCreatePost)
                {
                    return StatusCode(403, new
                    {
                        success = false,
                        error = "เฉพาะผู้ขายที่สมัครแล้วเท่านั้นที่สามารถสร้างโพสต์ได้ กรุณาสมัครเป็นผู้ขายจากหน้าแรก"
                    });
                }

                var postData = new Dictionary<string, object>
                {
                    ["title"] = titleTrim,
                    ["description"] = request.Description ?? "",
                    ["category"] = request.Category!.Trim(),
                    ["images"] = imageUrls,
                    ["imageStoragePaths"] = imageStoragePaths,
                    ["sellerId"] = userId,
                    ["sellerName"] = userName,
                    ["status"] = "pending",
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
                    postData["auctionStatus"] = "active";
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

                // URLs to index: main images + individual card image URLs (โพสขายแยกใบ/ประมูลแยกใบ)
                var urlsToIndex = new List<string>(imageUrls);
                // รูป individualCards ที่ครอปมาแล้ว → ส่ง CLIP ตรง ไม่ต้องผ่าน Card Detection
                var preCroppedUrls = new List<string>();
                if (request.IndividualCards != null)
                {
                    foreach (var c in request.IndividualCards)
                    {
                        if (!string.IsNullOrWhiteSpace(c?.ImageUrl))
                        {
                            if (!urlsToIndex.Contains(c.ImageUrl))
                                urlsToIndex.Add(c.ImageUrl);
                            preCroppedUrls.Add(c.ImageUrl);
                        }
                    }
                }

                // Background: index images for CLIP/pgvector search (fire-and-forget)
                var postIdCapture = postId;
                var urlsCapture = new List<string>(urlsToIndex);
                var preCroppedCapture = new List<string>(preCroppedUrls);
                _ = Task.Run(async () =>
                {
                    try
                    {
                        using var scope = _scopeFactory.CreateScope();
                        var indexing = scope.ServiceProvider.GetRequiredService<PostEmbeddingIndexingService>();
                        await indexing.IndexPostImagesAsync(postIdCapture, urlsCapture, preCroppedCapture);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error indexing post images for {PostId}", postIdCapture);
                    }
                });

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
                // รายการสาธารณะ: แสดงเฉพาะโพสต์ที่แอดมินอนุมัติแล้ว (status=active) ถ้าไม่ได้ระบุ status
                var statusFilter = status ?? "active";
                var (posts, total) = await _supabaseService.GetPostsFilteredAsync(
                    category, search, sortBy, page, limit, postType, statusFilter, useServiceRole: true);

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

                // หน้าโปรไฟล์ผู้ขาย: แสดงเฉพาะโพสต์ที่อนุมัติแล้ว (active)
                var activePosts = postsData.Where(p =>
                    p.TryGetValue("status", out var st) && string.Equals(st?.ToString(), "active", StringComparison.OrdinalIgnoreCase)).ToList();

                return Ok(new
                {
                    posts = activePosts,
                    pagination = new { total = activePosts.Count }
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
        /// โพสที่เกี่ยวข้องในหน้าโพสดีเทล (ภาพคล้ายจาก embedding + เติมหมวดเดียวกัน)
        /// แยกจากการค้นหาด้วยรูป — ใช้เกณฑ์ RelatedPosts:MinSimilarityScore ไม่ใช่ ImageSearch:MinSimilarityScore
        /// </summary>
        [HttpGet("{id}/related")]
        public async Task<IActionResult> GetRelatedPosts(string id, [FromQuery] int limit = 8, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(id))
                return BadRequest(new { success = false, error = "กรุณาระบุโพสต์" });

            try
            {
                var posts = await _relatedPostsService.GetRelatedPostsForDetailAsync(id, limit, cancellationToken).ConfigureAwait(false);
                return Ok(new { success = true, posts });
            }
            catch (OperationCanceledException)
            {
                return StatusCode(499, new { success = false, error = "Request cancelled" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetRelatedPosts failed for {PostId}", id);
                var msg = ex.Message;
                if (msg.Contains("404") && (msg.Contains("Not Found") || msg.Contains("NotFound")))
                    msg = "Image search is not set up. Run supabase-image-embeddings-setup.sql";
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาดในการดึงโพสต์ที่เกี่ยวข้อง", message = msg });
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
                var post = await _supabaseService.GetAsync("posts", id, useServiceRole: true);
                
                if (post == null)
                {
                    return NotFound(new { success = false, error = "ไม่พบโพสต์ที่ระบุ" });
                }

                // ประมูล: อัปเดตสถานะจบประมูล/หลุดเมื่อโหลดโพสต์
                if (post.TryGetValue("postType", out var ptCheck) && ptCheck?.ToString() == "auction")
                {
                    await _auctionService.FinalizeAuctionIfNeededAsync(id);
                    await _auctionService.ReleaseAuctionIfOverdueAsync(id);
                    post = await _supabaseService.GetAsync("posts", id, useServiceRole: true) ?? post;
                }

                var postStatus = post.TryGetValue("status", out var st) ? st?.ToString() : null;
                var sellerId = post.TryGetValue("sellerId", out var sid) ? sid?.ToString() : null;

                // โพสต์ที่ยังไม่อนุมัติ (pending/rejected) แสดงเฉพาะเจ้าของหรือแอดมิน
                if (!string.Equals(postStatus, "active", StringComparison.OrdinalIgnoreCase))
                {
                    var userId = GetUserId();
                    var isOwner = !string.IsNullOrEmpty(userId) && string.Equals(userId, sellerId, StringComparison.OrdinalIgnoreCase);
                    var isAdmin = false;
                    if (!isOwner && !string.IsNullOrEmpty(userId))
                    {
                        var profile = await _supabaseService.GetAsync("profiles", userId, useServiceRole: true, idField: "id");
                        isAdmin = profile != null && profile.TryGetValue("role", out var r) && string.Equals(r?.ToString(), "admin", StringComparison.OrdinalIgnoreCase);
                    }
                    if (!isOwner && !isAdmin)
                    {
                        return NotFound(new { success = false, error = "ไม่พบโพสต์ที่ระบุ" });
                    }
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
                if (request.ImageUrls != null && request.ImageUrls.Count > 0)
                {
                    // อัปเดตรูปโพสต์ (แทนของเดิม) และลบไฟล์เดิมใน Storage เพื่อไม่ให้ค้าง
                    var newImageUrls = request.ImageUrls.Where(u => !string.IsNullOrWhiteSpace(u)).ToList();
                    var newImagePaths = request.ImageStoragePaths ?? new List<string>();

                    if (newImageUrls.Count == 0)
                        return BadRequest(new { success = false, error = "กรุณาระบุ imageUrls อย่างน้อย 1 รูป" });

                    if (newImagePaths.Count != newImageUrls.Count)
                        return BadRequest(new { success = false, error = "จำนวน imageUrls ไม่เท่ากับ imageStoragePaths" });

                    // Delete old storage objects
                    if (existingPost.TryGetValue("imageStoragePaths", out var oldPathsObj) && oldPathsObj != null)
                    {
                        var oldPaths = new List<string>();
                        if (oldPathsObj is List<object> listObj)
                        {
                            oldPaths = listObj.Select(p => p?.ToString() ?? "").Where(s => !string.IsNullOrEmpty(s)).ToList();
                        }
                        else if (oldPathsObj is System.Text.Json.JsonElement je && je.ValueKind == System.Text.Json.JsonValueKind.Array)
                        {
                            foreach (var item in je.EnumerateArray())
                                oldPaths.Add(item.GetString() ?? "");
                        }

                        oldPaths = oldPaths.Where(s => !string.IsNullOrWhiteSpace(s)).Distinct().ToList();
                        if (oldPaths.Count > 0)
                            await _supabaseService.DeleteStorageObjectsAsync("posts", oldPaths);
                    }

                    updateData["images"] = newImageUrls;
                    updateData["imageStoragePaths"] = newImagePaths;
                }
                if (request.Price.HasValue)
                {
                    var newPrice = request.Price.Value;
                    var postType = existingPost.TryGetValue("postType", out var ptObj) ? ptObj?.ToString() : null;
                    var saleType = existingPost.TryGetValue("saleType", out var stObj) ? stObj?.ToString() : null;

                    // Map field name ให้ตรงกับชนิดโพสต์
                    // - sale(deck) => price
                    // - sale(individual) => individualPrice (และเก็บ fallback ที่ price ด้วย)
                    // - auction => startingBid (ใช้เป็นค่าตั้งต้น/อ้างอิง)
                    if (string.Equals(postType, "sale", StringComparison.OrdinalIgnoreCase))
                    {
                        if (string.Equals(saleType, "deck", StringComparison.OrdinalIgnoreCase))
                        {
                            updateData["price"] = newPrice;
                        }
                        else if (string.Equals(saleType, "individual", StringComparison.OrdinalIgnoreCase))
                        {
                            updateData["individualPrice"] = newPrice;
                            // เก็บ fallback เพื่อให้ client แสดงผลได้ไม่สับสน (บางส่วนใช้ post.price)
                            updateData["price"] = newPrice;
                        }
                        else
                        {
                            // fallback
                            updateData["price"] = newPrice;
                        }
                    }
                    else if (string.Equals(postType, "auction", StringComparison.OrdinalIgnoreCase))
                    {
                        updateData["startingBid"] = newPrice;
                        // fallback
                        updateData["price"] = newPrice;
                    }
                    else
                    {
                        updateData["price"] = newPrice;
                    }
                }

                // Update individual cards (saleType=individual) - เหมาะสำหรับ "ขายแยกใบ"
                if (existingPost.TryGetValue("postType", out var ptObj2)
                    && string.Equals(ptObj2?.ToString(), "sale", StringComparison.OrdinalIgnoreCase)
                    && existingPost.TryGetValue("saleType", out var stObj2)
                    && string.Equals(stObj2?.ToString(), "individual", StringComparison.OrdinalIgnoreCase)
                    && request.IndividualCards != null
                    && request.IndividualCards.Count > 0)
                {
                    var cards = request.IndividualCards;
                    var totalQty = cards.Sum(c => c?.Quantity ?? 0);
                    var minPrice = cards
                        .Where(c => c != null && c.Price > 0)
                        .Select(c => c!.Price)
                        .DefaultIfEmpty(0d)
                        .Min();

                    updateData["individualCards"] = cards;
                    updateData["availableQuantity"] = totalQty;
                    updateData["individualPrice"] = minPrice;
                    // fallback เพื่อให้ client แสดงราคาได้ในหลายจุด
                    updateData["price"] = minPrice;
                }

                await _supabaseService.UpdateAsync("posts", id, updateData);

                var updatedPost = await _supabaseService.GetAsync("posts", id);

                // Background re-index embeddings (อย่า block request)
                if (request.ImageUrls != null && request.ImageUrls.Count > 0)
                {
                    var postIdCapture = id;
                    var urlsCapture = new List<string>(request.ImageUrls.Where(u => !string.IsNullOrWhiteSpace(u)));
                    // รูป individualCards ที่ครอปมาแล้ว → ส่ง CLIP ตรง ไม่ต้องผ่าน Card Detection
                    var preCroppedCapture = new List<string>();
                    if (updatedPost != null && updatedPost.TryGetValue("individualCards", out var icObj) && icObj != null)
                    {
                        try
                        {
                            // ถ้ามี individualCards ใน post ให้รวม imageUrl เพื่อ embed
                            if (icObj is List<object> cardsList)
                            {
                                foreach (var c in cardsList)
                                {
                                    if (c is Dictionary<string, object> dict &&
                                        dict.TryGetValue("imageUrl", out var urlObj) &&
                                        urlObj != null)
                                    {
                                        var u = urlObj.ToString();
                                        if (!string.IsNullOrWhiteSpace(u))
                                        {
                                            urlsCapture.Add(u);
                                            preCroppedCapture.Add(u);
                                        }
                                    }
                                }
                            }
                        }
                        catch
                        {
                            // ไม่กระทบการอัปเดตโพสต์
                        }
                    }

                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            // Clear old embeddings for this post
                            await _supabaseService.DeleteByFieldAsync("post_image_embeddings", "postId", postIdCapture, useServiceRole: true);

                            using var scope = _scopeFactory.CreateScope();
                            var indexing = scope.ServiceProvider.GetRequiredService<PostEmbeddingIndexingService>();
                            await indexing.IndexPostImagesAsync(postIdCapture, urlsCapture, preCroppedCapture);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Error re-index embeddings after post image update {PostId}", postIdCapture);
                        }
                    });
                }

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
        /// ยื่นขออนุมัติใหม่สำหรับโพสต์ที่ถูกปฏิเสธแล้ว (status=rejected -> pending)
        /// </summary>
        [HttpPut("{id}/resubmit")]
        public async Task<IActionResult> ResubmitPost(string id)
        {
            try
            {
                var userId = GetUserId();
                var existingPost = await _supabaseService.GetAsync("posts", id);

                if (existingPost == null)
                    return NotFound(new { success = false, error = "ไม่พบโพสต์ที่ระบุ" });

                // ตรวจสอบว่าเป็นเจ้าของโพสต์
                if (string.IsNullOrEmpty(userId) || (existingPost.ContainsKey("sellerId") && existingPost["sellerId"]?.ToString() != userId))
                {
                    return Forbid("คุณไม่มีสิทธิ์ยื่นขออนุมัติโพสต์นี้");
                }

                var postStatus = existingPost.TryGetValue("status", out var stObj) ? stObj?.ToString() : null;
                if (!string.Equals(postStatus, "rejected", StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest(new { success = false, error = "โพสต์นี้ไม่ได้อยู่ในสถานะถูกปฏิเสธ" });
                }

                var updateData = new Dictionary<string, object>
                {
                    ["status"] = "pending",
                    ["updatedAt"] = DateTime.UtcNow
                };

                // ถ้าเป็น auction ให้รีเซ็ตสถานะย่อยเพื่อเริ่มพิจารณาใหม่อย่างปลอดภัย
                if (existingPost.TryGetValue("postType", out var ptObj) && string.Equals(ptObj?.ToString(), "auction", StringComparison.OrdinalIgnoreCase))
                {
                    updateData["auctionStatus"] = "active";
                    updateData["winnerId"] = null!;
                    updateData["paymentDeadline"] = null!;
                    updateData["currentBid"] = null!;
                    updateData["highestBidder"] = null!;
                    updateData["bidCount"] = 0;
                }

                await _supabaseService.UpdateAsync("posts", id, updateData);

                var updatedPost = await _supabaseService.GetAsync("posts", id);

                return Ok(new
                {
                    success = true,
                    message = "ยื่นขออนุมัติใหม่สำเร็จ",
                    data = updatedPost
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resubmitting post");
                return StatusCode(500, new
                {
                    success = false,
                    error = "เกิดข้อผิดพลาดในการยื่นขออนุมัติใหม่",
                    message = ex.Message
                });
            }
        }

        /// <summary>
        /// เจ้าของโพสต์ mark เป็น sold (ขายแล้ว / จบการประมูล)
        /// </summary>
        [HttpPost("{id}/sold")]
        public async Task<IActionResult> MarkAsSold(string id)
        {
            try
            {
                var userId = GetUserId();
                var post = await _supabaseService.GetAsync("posts", id, useServiceRole: true);
                if (post == null)
                    return NotFound(new { success = false, error = "ไม่พบโพสต์ที่ระบุ" });

                var sellerId = post.TryGetValue("sellerId", out var sid) ? sid?.ToString() : null;
                if (string.IsNullOrEmpty(userId) || sellerId != userId)
                    return Forbid();

                var postType = post.TryGetValue("postType", out var pt) ? pt?.ToString() : null;
                var currentStatus = post.TryGetValue("status", out var st) ? st?.ToString() : null;

                if (currentStatus == "sold")
                    return BadRequest(new { success = false, error = "โพสต์นี้ถูกขายแล้ว" });

                var updateData = new Dictionary<string, object>
                {
                    ["status"] = "sold",
                    ["updatedAt"] = DateTime.UtcNow
                };

                if (postType == "auction")
                {
                    // Finalize auction first if needed
                    await _auctionService.FinalizeAuctionIfNeededAsync(id);
                    updateData["auctionStatus"] = "sold";
                }

                await _supabaseService.UpdateAsync("posts", id, updateData, useServiceRole: true);
                var updatedPost = await _supabaseService.GetAsync("posts", id, useServiceRole: true);

                return Ok(new
                {
                    success = true,
                    message = postType == "auction" ? "จบการประมูลสำเร็จ" : "ทำเครื่องหมายขายแล้วสำเร็จ",
                    data = updatedPost
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marking post as sold");
                return StatusCode(500, new
                {
                    success = false,
                    error = "เกิดข้อผิดพลาดในการอัปเดตสถานะโพสต์",
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
        public List<string>? ImageUrls { get; set; }
        public List<string>? ImageStoragePaths { get; set; }
      public List<IndividualCardDto>? IndividualCards { get; set; }
    }
}


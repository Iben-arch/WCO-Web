using Microsoft.AspNetCore.Mvc;
using ServerApi.Services;
using System.Text.Json;

namespace ServerApi.Controllers
{
    /// <summary>
    /// Controller สำหรับจัดการตะกร้าสินค้า
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class CartController : BaseController
    {
        private readonly SupabaseService _supabaseService;
        private readonly ILogger<CartController> _logger;

        public CartController(SupabaseService supabaseService, ILogger<CartController> logger)
        {
            _supabaseService = supabaseService;
            _logger = logger;
        }

        /// <summary>
        /// ดึงรายการตะกร้าของผู้ใช้
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetCartItems()
        {
            try
            {
                var userId = GetUserIdRequired();
                var cartItems = await _supabaseService.QueryAsync("cart_items", "user_id", userId);

                var result = new List<object>();
                foreach (var item in cartItems)
                {
                    var postId = item.ContainsKey("post_id") ? item["post_id"]?.ToString() : null;
                    if (string.IsNullOrEmpty(postId)) continue;

                    var post = await _supabaseService.GetAsync("posts", postId);
                    if (post == null) continue;

                    var cartItemId = item.ContainsKey("id") ? item["id"]?.ToString() : null;
                    var cardId = item.ContainsKey("card_id") ? item["card_id"]?.ToString() : null;
                    var quantity = item.ContainsKey("quantity") ? Convert.ToInt32(item["quantity"]) : 1;

                    result.Add(new
                    {
                        id = cartItemId,
                        postId = postId,
                        post = MapPostToResponse(post),
                        cardId = string.IsNullOrEmpty(cardId) ? (string?)null : cardId,
                        quantity = quantity,
                        addedAt = item.ContainsKey("created_at") ? item["created_at"] : null
                    });
                }

                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { success = false, error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching cart items");
                return StatusCode(500, new
                {
                    success = false,
                    error = "เกิดข้อผิดพลาดในการดึงข้อมูลตะกร้า",
                    message = ex.Message
                });
            }
        }

        /// <summary>
        /// เพิ่มรายการลงตะกร้า
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> AddToCart([FromBody] AddToCartRequest request)
        {
            try
            {
                var userId = GetUserIdRequired();

                if (string.IsNullOrEmpty(request.PostId))
                {
                    return BadRequest(new { success = false, message = "กรุณาระบุ postId" });
                }

                var post = await _supabaseService.GetAsync("posts", request.PostId);
                if (post == null)
                {
                    return NotFound(new { success = false, message = "ไม่พบโพสต์ที่ระบุ" });
                }

                var sellerId = post.ContainsKey("sellerId") ? post["sellerId"]?.ToString() : null;
                if (sellerId == userId)
                {
                    return BadRequest(new { success = false, message = "ไม่สามารถเพิ่มโพสต์ของตัวเองในตะกร้าได้" });
                }

                var status = post.ContainsKey("status") ? post["status"]?.ToString() : null;
                if (status == "sold")
                {
                    return BadRequest(new { success = false, message = "โพสต์นี้ถูกขายแล้ว" });
                }

                var postType = post.ContainsKey("postType") ? post["postType"]?.ToString() : null;
                if (postType == "auction")
                {
                    return BadRequest(new { success = false, message = "ไม่สามารถเพิ่มโพสต์ประมูลในตะกร้าได้" });
                }

                var cartData = new Dictionary<string, object>
                {
                    ["user_id"] = userId,
                    ["post_id"] = request.PostId,
                    ["quantity"] = request.Quantity ?? 1
                };

                if (!string.IsNullOrEmpty(request.CardId))
                {
                    cartData["card_id"] = request.CardId;
                }

                var cartItemId = await _supabaseService.CreateAsync("cart_items", cartData, useServiceRole: true);

                return Ok(new
                {
                    success = true,
                    message = "เพิ่มลงตะกร้าเรียบร้อย",
                    id = cartItemId
                });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { success = false, error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding to cart");
                var msg = ex.Message;
                if (msg.Contains("duplicate") || msg.Contains("unique"))
                {
                    return Ok(new { success = true, message = "รายการนี้อยู่ในตะกร้าแล้ว" });
                }
                return StatusCode(500, new
                {
                    success = false,
                    error = "เกิดข้อผิดพลาดในการเพิ่มตะกร้า",
                    message = ex.Message
                });
            }
        }

        /// <summary>
        /// ลบรายการออกจากตะกร้า (ตาม cart item id หรือ postId, รองรับ cardId ผ่าน query)
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> RemoveFromCart(string id, [FromQuery] string? cardId = null)
        {
            try
            {
                var userId = GetUserIdRequired();

                var cartItems = await _supabaseService.QueryAsync("cart_items", "user_id", userId);
                var item = cartItems.FirstOrDefault(i =>
                {
                    var itemId = i.ContainsKey("id") ? i["id"]?.ToString() : null;
                    var postId = i.ContainsKey("post_id") ? i["post_id"]?.ToString() : null;
                    var itemCardId = i.ContainsKey("card_id") ? i["card_id"]?.ToString() : null;
                    if (itemId == id) return true;
                    if (postId == id)
                    {
                        if (string.IsNullOrEmpty(cardId)) return string.IsNullOrEmpty(itemCardId);
                        return itemCardId == cardId;
                    }
                    return false;
                });

                if (item == null)
                {
                    return NotFound(new { success = false, message = "ไม่พบรายการในตะกร้า" });
                }

                var itemId = item["id"]?.ToString();
                if (string.IsNullOrEmpty(itemId))
                {
                    return NotFound(new { success = false, message = "ไม่พบรายการในตะกร้า" });
                }

                await _supabaseService.DeleteAsync("cart_items", itemId);

                return Ok(new { success = true, message = "ลบออกจากตะกร้าเรียบร้อย" });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { success = false, error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error removing from cart");
                return StatusCode(500, new
                {
                    success = false,
                    error = "เกิดข้อผิดพลาดในการลบจากตะกร้า",
                    message = ex.Message
                });
            }
        }

        /// <summary>
        /// ล้างตะกร้าทั้งหมด
        /// </summary>
        [HttpDelete]
        public async Task<IActionResult> ClearCart()
        {
            try
            {
                var userId = GetUserIdRequired();
                var cartItems = await _supabaseService.QueryAsync("cart_items", "user_id", userId);

                foreach (var item in cartItems)
                {
                    var itemId = item.ContainsKey("id") ? item["id"]?.ToString() : null;
                    if (!string.IsNullOrEmpty(itemId))
                    {
                        await _supabaseService.DeleteAsync("cart_items", itemId);
                    }
                }

                return Ok(new { success = true, message = "ล้างตะกร้าเรียบร้อย" });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { success = false, error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error clearing cart");
                return StatusCode(500, new
                {
                    success = false,
                    error = "เกิดข้อผิดพลาดในการล้างตะกร้า",
                    message = ex.Message
                });
            }
        }

        private static object MapPostToResponse(Dictionary<string, object> post)
        {
            return post;
        }
    }

    public class AddToCartRequest
    {
        public string PostId { get; set; } = string.Empty;
        public string? CardId { get; set; }
        public int? Quantity { get; set; }
    }
}

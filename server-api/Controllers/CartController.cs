using Microsoft.AspNetCore.Mvc;
using ServerApi.Services;
using System.Linq;
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
                var cartItems = await _supabaseService.QueryAsync("cart_items", "user_id", userId, useServiceRole: true);

                var result = new List<object>();
                foreach (var item in cartItems)
                {
                    var postId = item.ContainsKey("post_id") ? item["post_id"]?.ToString() : null;
                    if (string.IsNullOrEmpty(postId)) continue;

                    var post = await _supabaseService.GetAsync("posts", postId, useServiceRole: true);
                    if (post == null) continue;

                    var cartItemId = item.ContainsKey("id") ? item["id"]?.ToString() : null;
                    var cardId = item.ContainsKey("card_id") ? item["card_id"]?.ToString() : null;
                    var quantity = item.ContainsKey("quantity") ? Convert.ToInt32(item["quantity"]) : 1;

                    double? unitPrice = null;
                    var postType = post.TryGetValue("postType", out var pt) ? pt?.ToString() : null;
                    var saleType = post.TryGetValue("saleType", out var st) ? st?.ToString() : null;
                    if (postType == "auction" && saleType == "individual" && !string.IsNullOrEmpty(cardId))
                    {
                        var winners = await _supabaseService.QueryAsync("auction_card_winners", "post_id", postId, useServiceRole: true);
                        var winnerRow = winners?.FirstOrDefault(w =>
                            string.Equals(w.TryGetValue("card_id", out var cid) ? cid?.ToString() : null, cardId, StringComparison.OrdinalIgnoreCase));
                        if (winnerRow != null && winnerRow.TryGetValue("bid_amount", out var amt) && amt != null)
                        {
                            if (amt is decimal dm) unitPrice = (double)dm;
                            else if (amt is double d) unitPrice = d;
                            else if (double.TryParse(amt.ToString(), out var parsed)) unitPrice = parsed;
                        }
                    }
                    else if (postType == "auction" && string.IsNullOrEmpty(cardId) && post.TryGetValue("currentBid", out var cb) && cb != null)
                    {
                        if (cb is decimal dm) unitPrice = (double)dm;
                        else if (cb is double d) unitPrice = d;
                    }
                    else if (postType == "sale")
                    {
                        // ขายแยกใบ: ใช้ราคาจาก individualCards[].price ของการ์ดที่ตรง cardId
                        if (saleType == "individual" && !string.IsNullOrEmpty(cardId) && post.TryGetValue("individualCards", out var cardsObj) && cardsObj is System.Collections.IEnumerable cardsEnum)
                        {
                            foreach (var c in cardsEnum)
                            {
                                var card = c as Dictionary<string, object>;
                                if (card == null) continue;
                                var cid = card.TryGetValue("id", out var idVal) ? idVal?.ToString() : null;
                                if (string.IsNullOrEmpty(cid) || !string.Equals(cid, cardId, StringComparison.OrdinalIgnoreCase)) continue;
                                if (card.TryGetValue("price", out var priceVal) && priceVal != null)
                                {
                                    if (priceVal is decimal pm) unitPrice = (double)pm;
                                    else if (priceVal is double pd) unitPrice = pd;
                                    else if (priceVal is int pi) unitPrice = pi;
                                    else if (double.TryParse(priceVal.ToString(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var parsed)) unitPrice = parsed;
                                    break;
                                }
                            }
                        }
                        // ถ้ายังไม่มี unitPrice (ขายทั้งเด็ค หรือไม่พบการ์ด) ใช้ individualPrice / price ของโพสต์
                        if (unitPrice == null)
                        {
                            if (post.TryGetValue("individualPrice", out var ip) && ip != null)
                            {
                                if (ip is decimal dm) unitPrice = (double)dm;
                                else if (ip is double d) unitPrice = d;
                                else if (double.TryParse(ip.ToString(), out var p)) unitPrice = p;
                            }
                            if (unitPrice == null && post.TryGetValue("price", out var pp) && pp != null)
                            {
                                if (pp is decimal dm) unitPrice = (double)dm;
                                else if (pp is double d) unitPrice = d;
                                else if (double.TryParse(pp.ToString(), out var p)) unitPrice = p;
                            }
                        }
                    }

                    result.Add(new
                    {
                        id = cartItemId,
                        postId = postId,
                        post = MapPostToResponse(post),
                        cardId = string.IsNullOrEmpty(cardId) ? (string?)null : cardId,
                        quantity = quantity,
                        unitPrice = unitPrice,
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

                // ไม่เปลี่ยน status โพสต์ตอนเพิ่มตะกร้า — ให้โพสต์หายเมื่อชำระเงินแล้วเท่านั้น

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

                var cartItems = await _supabaseService.QueryAsync("cart_items", "user_id", userId, useServiceRole: true);
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
                var postId = item.ContainsKey("post_id") ? item["post_id"]?.ToString() : null;
                if (string.IsNullOrEmpty(itemId))
                {
                    return NotFound(new { success = false, message = "ไม่พบรายการในตะกร้า" });
                }

                await _supabaseService.DeleteAsync("cart_items", itemId, null, true);

                // ถ้าไม่มีใครมีโพสต์นี้ในตะกร้าแล้ว ให้เปลี่ยนสถานะกลับเป็น active
                if (!string.IsNullOrEmpty(postId))
                {
                    var remainingCartItems = await _supabaseService.QueryAsync("cart_items", "post_id", postId, useServiceRole: true);
                    if (remainingCartItems.Count == 0)
                    {
                        var post = await _supabaseService.GetAsync("posts", postId, useServiceRole: true);
                        var postStatus = post?.ContainsKey("status") == true ? post["status"]?.ToString() : null;
                        if (postStatus == "pending")
                        {
                            var updateData = new Dictionary<string, object>
                            {
                                ["status"] = "active",
                                ["updatedAt"] = DateTime.UtcNow
                            };
                            await _supabaseService.UpdateAsync("posts", postId, updateData, null, true);
                        }
                    }
                }

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
                var cartItems = await _supabaseService.QueryAsync("cart_items", "user_id", userId, useServiceRole: true);
                var postIdsToCheck = new List<string>();

                foreach (var item in cartItems)
                {
                    var itemId = item.ContainsKey("id") ? item["id"]?.ToString() : null;
                    var postId = item.ContainsKey("post_id") ? item["post_id"]?.ToString() : null;
                    if (!string.IsNullOrEmpty(itemId))
                    {
                        await _supabaseService.DeleteAsync("cart_items", itemId, null, true);
                        if (!string.IsNullOrEmpty(postId))
                            postIdsToCheck.Add(postId);
                    }
                }

                // ตรวจสอบโพสต์ที่ไม่มีใครมีในตะกร้าแล้ว ให้เปลี่ยนสถานะกลับเป็น active
                foreach (var postId in postIdsToCheck.Distinct())
                {
                    var remainingCartItems = await _supabaseService.QueryAsync("cart_items", "post_id", postId, useServiceRole: true);
                    if (remainingCartItems.Count == 0)
                    {
                        var post = await _supabaseService.GetAsync("posts", postId, useServiceRole: true);
                        var postStatus = post?.ContainsKey("status") == true ? post["status"]?.ToString() : null;
                        if (postStatus == "pending")
                        {
                            var updateData = new Dictionary<string, object>
                            {
                                ["status"] = "active",
                                ["updatedAt"] = DateTime.UtcNow
                            };
                            await _supabaseService.UpdateAsync("posts", postId, updateData, null, true);
                        }
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

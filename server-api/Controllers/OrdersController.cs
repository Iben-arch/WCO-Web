using Microsoft.AspNetCore.Mvc;
using ServerApi.Services;

namespace ServerApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class OrdersController : BaseController
    {
        private readonly SupabaseService _supabaseService;
        private readonly ILogger<OrdersController> _logger;

        public OrdersController(SupabaseService supabaseService, ILogger<OrdersController> logger)
        {
            _supabaseService = supabaseService;
            _logger = logger;
        }

        /// <summary>
        /// สั่งซื้อจากตะกร้า - สร้าง orders (แยกตามผู้ขาย), ลบรายการในตะกร้าที่เลือก
        /// Body: { "cartItemIds": ["uuid1", "uuid2"] } หรือไม่ส่ง = สั่งทั้งหมด
        /// </summary>
        [HttpPost("checkout")]
        public async Task<IActionResult> Checkout([FromBody] CheckoutRequest? request)
        {
            try
            {
                var userId = GetUserIdRequired();
                var cartItems = await _supabaseService.QueryAsync("cart_items", "user_id", userId);
                var idsToCheckout = request?.CartItemIds != null && request.CartItemIds.Count > 0
                    ? request.CartItemIds.ToHashSet()
                    : null;

                var itemsToProcess = cartItems.Where(c =>
                {
                    var cartId = c.ContainsKey("id") ? c["id"]?.ToString() : null;
                    if (string.IsNullOrEmpty(cartId)) return false;
                    if (idsToCheckout != null && !idsToCheckout.Contains(cartId)) return false;
                    return true;
                }).ToList();

                if (itemsToProcess.Count == 0)
                {
                    return BadRequest(new { success = false, error = "ไม่มีรายการที่เลือกหรือตะกร้าว่าง" });
                }

                var bySeller = new Dictionary<string, List<Dictionary<string, object>>>();
                foreach (var item in itemsToProcess)
                {
                    var postId = item.ContainsKey("post_id") ? item["post_id"]?.ToString() : null;
                    if (string.IsNullOrEmpty(postId)) continue;
                    var post = await _supabaseService.GetAsync("posts", postId, useServiceRole: true);
                    if (post == null) continue;
                    var sellerId = post.ContainsKey("sellerId") ? post["sellerId"]?.ToString() : null;
                    if (string.IsNullOrEmpty(sellerId)) continue;
                    var sellerName = post.ContainsKey("sellerName") ? post["sellerName"]?.ToString() : "";
                    if (!bySeller.ContainsKey(sellerId))
                        bySeller[sellerId] = new List<Dictionary<string, object>>();
                    bySeller[sellerId].Add(new Dictionary<string, object>(item)
                    {
                        ["_post"] = post,
                        ["_sellerName"] = sellerName ?? ""
                    });
                }

                var createdOrderIds = new List<string>();
                var cartIdsToDelete = new List<string>();

                foreach (var kv in bySeller)
                {
                    var sellerId = kv.Key;
                    var group = kv.Value;
                    if (group.Count == 0) continue;
                    var first = group[0];
                    var post = (Dictionary<string, object>?)first["_post"];
                    var sellerName = first["_sellerName"]?.ToString() ?? "";

                    double total = 0;
                    foreach (var ci in group)
                    {
                        var p = (Dictionary<string, object>?)ci["_post"];
                        var cardId = ci.ContainsKey("card_id") ? ci["card_id"]?.ToString() : null;
                        var qty = ci.ContainsKey("quantity") ? Convert.ToInt32(ci["quantity"]) : 1;
                        double price = GetUnitPriceForOrderItem(p, cardId);
                        total += price * qty;
                    }

                    var orderData = new Dictionary<string, object>
                    {
                        ["buyer_id"] = userId,
                        ["seller_id"] = sellerId,
                        ["seller_name"] = sellerName,
                        ["status"] = "pending_shipment",
                        ["total_amount"] = total,
                        ["created_at"] = DateTime.UtcNow,
                        ["updated_at"] = DateTime.UtcNow
                    };
                    var orderId = await _supabaseService.CreateAsync("orders", orderData, useServiceRole: true);
                    createdOrderIds.Add(orderId);

                    foreach (var ci in group)
                    {
                        var p = (Dictionary<string, object>?)ci["_post"];
                        var postId = ci.ContainsKey("post_id") ? ci["post_id"]?.ToString() : null;
                        var cardId = ci.ContainsKey("card_id") ? ci["card_id"]?.ToString() : null;
                        var qty = ci.ContainsKey("quantity") ? Convert.ToInt32(ci["quantity"]) : 1;
                        double unitPrice = GetUnitPriceForOrderItem(p, cardId);
                        var itemData = new Dictionary<string, object>
                        {
                            ["order_id"] = orderId,
                            ["post_id"] = postId!,
                            ["quantity"] = qty,
                            ["unit_price"] = unitPrice,
                            ["created_at"] = DateTime.UtcNow
                        };
                        if (!string.IsNullOrEmpty(cardId))
                            itemData["card_id"] = cardId;
                        await _supabaseService.CreateAsync("order_items", itemData, useServiceRole: true);
                        var cid = ci.ContainsKey("id") ? ci["id"]?.ToString() : null;
                        if (!string.IsNullOrEmpty(cid))
                            cartIdsToDelete.Add(cid);
                    }
                }

                foreach (var cartId in cartIdsToDelete)
                {
                    try
                    {
                        await _supabaseService.DeleteAsync("cart_items", cartId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Could not delete cart item {CartId}", cartId);
                    }
                }

                return Ok(new
                {
                    success = true,
                    message = "สั่งซื้อสำเร็จ สถานะ: รอจัดส่ง",
                    orderIds = createdOrderIds
                });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { success = false, error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Checkout error");
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาดในการสั่งซื้อ", message = ex.Message });
            }
        }

        /// <summary>
        /// รายการคำสั่งซื้อของฉัน (ผู้ซื้อ)
        /// </summary>
        [HttpGet("my-orders")]
        public async Task<IActionResult> GetMyOrders()
        {
            try
            {
                var userId = GetUserIdRequired();
                var orders = await _supabaseService.QueryAsync("orders", "buyer_id", userId, useServiceRole: true);
                var list = new List<object>();
                foreach (var o in orders)
                {
                    var orderId = o.ContainsKey("id") ? o["id"]?.ToString() : null;
                    if (string.IsNullOrEmpty(orderId)) continue;
                    var items = await _supabaseService.QueryAsync("order_items", "order_id", orderId, useServiceRole: true);
                    var itemsWithPost = new List<object>();
                    foreach (var it in items)
                    {
                        var postId = it.ContainsKey("post_id") ? it["post_id"]?.ToString() : null;
                        var post = !string.IsNullOrEmpty(postId) ? await _supabaseService.GetAsync("posts", postId, useServiceRole: true) : null;
                        itemsWithPost.Add(new
                        {
                            id = it.ContainsKey("id") ? it["id"] : null,
                            postId,
                            cardId = it.ContainsKey("card_id") ? it["card_id"] : null,
                            quantity = it.ContainsKey("quantity") ? it["quantity"] : 1,
                            unitPrice = it.ContainsKey("unit_price") ? it["unit_price"] : 0,
                            post = post
                        });
                    }
                    list.Add(new
                    {
                        id = o["id"],
                        buyerId = o.ContainsKey("buyer_id") ? o["buyer_id"] : null,
                        sellerId = o.ContainsKey("seller_id") ? o["seller_id"] : null,
                        sellerName = o.ContainsKey("seller_name") ? o["seller_name"] : null,
                        status = o.ContainsKey("status") ? o["status"] : "pending_shipment",
                        receiptUrl = o.ContainsKey("receipt_url") ? o["receipt_url"] : null,
                        totalAmount = o.ContainsKey("total_amount") ? o["total_amount"] : 0,
                        createdAt = o.ContainsKey("created_at") ? o["created_at"] : null,
                        updatedAt = o.ContainsKey("updated_at") ? o["updated_at"] : null,
                        items = itemsWithPost
                    });
                }
                return Ok(list);
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { success = false, error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetMyOrders error");
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาด", message = ex.Message });
            }
        }

        /// <summary>
        /// รายการคำสั่งซื้อที่รอจัดส่ง / ขายแล้ว (สำหรับเจ้าของโพส)
        /// </summary>
        [HttpGet("seller-orders")]
        public async Task<IActionResult> GetSellerOrders()
        {
            try
            {
                var userId = GetUserIdRequired();
                var orders = await _supabaseService.QueryAsync("orders", "seller_id", userId, useServiceRole: true);
                var list = new List<object>();
                foreach (var o in orders)
                {
                    var orderId = o.ContainsKey("id") ? o["id"]?.ToString() : null;
                    if (string.IsNullOrEmpty(orderId)) continue;
                    var items = await _supabaseService.QueryAsync("order_items", "order_id", orderId, useServiceRole: true);
                    var itemsWithPost = new List<object>();
                    foreach (var it in items)
                    {
                        var postId = it.ContainsKey("post_id") ? it["post_id"]?.ToString() : null;
                        var post = !string.IsNullOrEmpty(postId) ? await _supabaseService.GetAsync("posts", postId, useServiceRole: true) : null;
                        itemsWithPost.Add(new
                        {
                            id = it.ContainsKey("id") ? it["id"] : null,
                            postId,
                            cardId = it.ContainsKey("card_id") ? it["card_id"] : null,
                            quantity = it.ContainsKey("quantity") ? it["quantity"] : 1,
                            unitPrice = it.ContainsKey("unit_price") ? it["unit_price"] : 0,
                            post = post
                        });
                    }
                    list.Add(new
                    {
                        id = o["id"],
                        buyerId = o.ContainsKey("buyer_id") ? o["buyer_id"] : null,
                        sellerId = o.ContainsKey("seller_id") ? o["seller_id"] : null,
                        sellerName = o.ContainsKey("seller_name") ? o["seller_name"] : null,
                        status = o.ContainsKey("status") ? o["status"] : "pending_shipment",
                        receiptUrl = o.ContainsKey("receipt_url") ? o["receipt_url"] : null,
                        totalAmount = o.ContainsKey("total_amount") ? o["total_amount"] : 0,
                        createdAt = o.ContainsKey("created_at") ? o["created_at"] : null,
                        updatedAt = o.ContainsKey("updated_at") ? o["updated_at"] : null,
                        items = itemsWithPost
                    });
                }
                return Ok(list);
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { success = false, error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetSellerOrders error");
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาด", message = ex.Message });
            }
        }

        /// <summary>
        /// เจ้าของโพสยืนยันการส่ง - อัปเดตสถานะเป็นขายแล้ว และเก็บ URL ใบเสร็จ
        /// Body: { "receiptUrl": "https://..." } (client อัปโหลดรูปไป Storage แล้วส่ง URL มา)
        /// </summary>
        [HttpPost("{id}/confirm-shipment")]
        public async Task<IActionResult> ConfirmShipment(string id, [FromBody] ConfirmShipmentRequest? request)
        {
            try
            {
                var userId = GetUserIdRequired();
                var order = await _supabaseService.GetAsync("orders", id, useServiceRole: true);
                if (order == null)
                    return NotFound(new { success = false, error = "ไม่พบคำสั่งซื้อ" });
                var sellerId = order.ContainsKey("seller_id") ? order["seller_id"]?.ToString() : null;
                if (sellerId != userId)
                    return Forbid();
                var receiptUrl = request?.ReceiptUrl?.Trim();
                if (string.IsNullOrEmpty(receiptUrl))
                    return BadRequest(new { success = false, error = "กรุณาส่ง receiptUrl (URL รูปใบเสร็จ)" });

                var updateData = new Dictionary<string, object>
                {
                    ["status"] = "sold",
                    ["receipt_url"] = receiptUrl,
                    ["updated_at"] = DateTime.UtcNow
                };
                await _supabaseService.UpdateAsync("orders", id, updateData, null, true);

                return Ok(new { success = true, message = "ยืนยันการส่งแล้ว สถานะเปลี่ยนเป็นขายแล้ว" });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { success = false, error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ConfirmShipment error");
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาด", message = ex.Message });
            }
        }

        /// <summary>
        /// ราคาต่อหน่วยสำหรับ order item: แยกใบใช้ราคาจาก individualCards[].price ไม่ใช่ individualPrice
        /// </summary>
        private static double GetUnitPriceForOrderItem(Dictionary<string, object>? p, string? cardId)
        {
            if (p == null) return 0;
            if (!string.IsNullOrEmpty(cardId) && p.TryGetValue("individualCards", out var cardsObj) && cardsObj is System.Collections.IList cards)
            {
                foreach (var c in cards)
                {
                    if (c is Dictionary<string, object> card && card.ContainsKey("id") && card["id"]?.ToString() == cardId && card.ContainsKey("price") && card["price"] != null)
                        return Convert.ToDouble(card["price"]);
                }
            }
            if (p.ContainsKey("individualPrice") && p["individualPrice"] != null)
                return Convert.ToDouble(p["individualPrice"]);
            if (p.ContainsKey("price") && p["price"] != null)
                return Convert.ToDouble(p["price"]);
            return 0;
        }
    }

    public class CheckoutRequest
    {
        public List<string>? CartItemIds { get; set; }
    }

    public class ConfirmShipmentRequest
    {
        public string? ReceiptUrl { get; set; }
    }
}

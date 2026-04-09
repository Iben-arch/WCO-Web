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
                var cartItems = await _supabaseService.QueryAsync("cart_items", "user_id", userId, useServiceRole: true);
                var idsToCheckout = request?.CartItemIds != null && request.CartItemIds.Count > 0
                    ? new HashSet<string>(request.CartItemIds, StringComparer.OrdinalIgnoreCase)
                    : null;

                var itemsToProcess = cartItems.Where(c =>
                {
                    var cartId = c.ContainsKey("id") ? c["id"]?.ToString()?.Trim() : null;
                    if (string.IsNullOrEmpty(cartId)) return false;
                    if (idsToCheckout != null && !idsToCheckout.Contains(cartId)) return false;
                    return true;
                }).ToList();

                if (itemsToProcess.Count == 0)
                {
                    return BadRequest(new { success = false, error = "ไม่มีรายการที่เลือกหรือตะกร้าว่าง กรุณารีเฟรชหน้าแล้วลองใหม่" });
                }

                var profile = await _supabaseService.GetAsync("profiles", userId, useServiceRole: true, idField: "id");
                var shippingAddress = request?.ShippingAddress?.Trim();
                if (string.IsNullOrEmpty(shippingAddress))
                    shippingAddress = profile?.TryGetValue("address", out var addr) == true && addr != null ? addr.ToString()?.Trim() : null;
                if (string.IsNullOrEmpty(shippingAddress))
                    return BadRequest(new { success = false, error = "กรุณากรอกที่อยู่จัดส่ง หรือเพิ่มที่อยู่ในโปรไฟล์" });

                var shippingPhone = request?.ShippingPhone?.Trim();
                if (string.IsNullOrEmpty(shippingPhone))
                    shippingPhone = profile?.TryGetValue("phone", out var ph) == true && ph != null ? ph.ToString()?.Trim() : null;
                if (string.IsNullOrEmpty(shippingPhone))
                    return BadRequest(new { success = false, error = "กรุณากรอกเบอร์โทร หรือเพิ่มเบอร์โทรในโปรไฟล์" });

                var buyerName = profile?.TryGetValue("username", out var un) == true && un != null ? un.ToString() : "ผู้ซื้อ";

                // Batch load โพสต์ทั้งหมดใน 1 query แทน N+1
                var allPostIds = itemsToProcess
                    .Select(c => c.ContainsKey("post_id") ? c["post_id"]?.ToString() : null)
                    .Where(id => !string.IsNullOrEmpty(id))
                    .Distinct()
                    .ToList()!;
                var allPosts = await _supabaseService.QueryInAsync("posts", "id", allPostIds!, useServiceRole: true);
                var postLookup = allPosts.ToDictionary(
                    p => p.ContainsKey("id") ? p["id"]?.ToString() ?? "" : "",
                    p => p,
                    StringComparer.OrdinalIgnoreCase);

                var bySeller = new Dictionary<string, List<Dictionary<string, object>>>();
                foreach (var item in itemsToProcess)
                {
                    var postId = item.ContainsKey("post_id") ? item["post_id"]?.ToString() : null;
                    if (string.IsNullOrEmpty(postId) || !postLookup.TryGetValue(postId, out var post)) continue;
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
                        ["buyer_name"] = buyerName ?? "",
                        ["seller_id"] = sellerId,
                        ["seller_name"] = sellerName,
                        ["status"] = "pending_shipment",
                        ["shipping_address"] = shippingAddress ?? "",
                        ["shipping_phone"] = shippingPhone ?? "",
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

                // ลดจำนวนสต็อกในโพสต์ (ขายแยกใบ: ลด individualCards[].quantity, ไม่ใช่ mark โพสต์เป็น sold ทั้งหมด)
                var reductionsByPost = new Dictionary<string, List<(string? cardId, int qty)>>(StringComparer.OrdinalIgnoreCase);
                foreach (var kv in bySeller)
                {
                    foreach (var ci in kv.Value)
                    {
                        var postId = ci.ContainsKey("post_id") ? ci["post_id"]?.ToString() : null;
                        if (string.IsNullOrEmpty(postId)) continue;
                        var cardId = ci.ContainsKey("card_id") ? ci["card_id"]?.ToString() : null;
                        var qty = ci.ContainsKey("quantity") ? Convert.ToInt32(ci["quantity"]) : 1;
                        if (!reductionsByPost.ContainsKey(postId))
                            reductionsByPost[postId] = new List<(string?, int)>();
                        reductionsByPost[postId].Add((cardId, qty));
                    }
                }
                foreach (var kv in reductionsByPost)
                {
                    var postId = kv.Key;
                    // Re-fetch เพื่อเช็คสต็อกล่าสุด (ป้องกัน oversell จาก concurrent checkout)
                    var freshPost = await _supabaseService.GetAsync("posts", postId, useServiceRole: true);
                    if (freshPost == null) continue;

                    // ตรวจสอบว่าสต็อกเพียงพอก่อนลด
                    if (!ValidateStockAvailable(freshPost, kv.Value))
                    {
                        var postTitle = freshPost.TryGetValue("title", out var t) ? t?.ToString() : postId;
                        return BadRequest(new { success = false, error = $"สินค้า \"{postTitle}\" มีจำนวนไม่เพียงพอ อาจมีคนอื่นซื้อไปก่อน กรุณาลองใหม่" });
                    }

                    var postUpdate = ReducePostStock(freshPost, kv.Value);
                    if (postUpdate != null && postUpdate.Count > 0)
                        await _supabaseService.UpdateAsync("posts", postId, postUpdate, null, true);
                }

                foreach (var cartId in cartIdsToDelete)
                {
                    try
                    {
                        await _supabaseService.DeleteAsync("cart_items", cartId, null, true);
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
                return Ok(await BuildOrderListAsync(orders));
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
                return Ok(await BuildOrderListAsync(orders));
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
                var currentStatus = order.ContainsKey("status") ? order["status"]?.ToString() : null;
                if (currentStatus != "pending_shipment")
                    return BadRequest(new { success = false, error = "สามารถยืนยันการส่งได้เมื่อสถานะเป็นรอจัดส่งเท่านั้น" });
                var receiptUrl = request?.ReceiptUrl?.Trim();
                if (string.IsNullOrEmpty(receiptUrl))
                    return BadRequest(new { success = false, error = "กรุณาส่ง receiptUrl (URL รูปใบเสร็จ)" });

                var updateData = new Dictionary<string, object>
                {
                    ["status"] = "shipped",
                    ["receipt_url"] = receiptUrl,
                    ["updated_at"] = DateTime.UtcNow
                };
                await _supabaseService.UpdateAsync("orders", id, updateData, null, true);

                // แจ้งเตือนผู้ซื้อว่าสินค้าถูกจัดส่งแล้ว
                var buyerId = order.ContainsKey("buyer_id") ? order["buyer_id"]?.ToString() : null;
                if (!string.IsNullOrEmpty(buyerId))
                {
                    try
                    {
                        var sellerName = order.ContainsKey("seller_name") ? order["seller_name"]?.ToString() : "ผู้ขาย";
                        await _supabaseService.CreateAsync("notifications", new Dictionary<string, object>
                        {
                            ["user_id"] = buyerId,
                            ["type"] = "order_shipped",
                            ["title"] = "สินค้าถูกจัดส่งแล้ว",
                            ["message"] = $"ผู้ขาย {sellerName} ได้จัดส่งสินค้าและแนบใบเสร็จแล้ว กรุณาตรวจสอบและกดยืนยันเมื่อได้รับสินค้า"
                        }, useServiceRole: true);
                    }
                    catch (Exception notifEx)
                    {
                        _logger.LogWarning(notifEx, "Failed to create shipment notification for buyer {BuyerId}", buyerId);
                    }
                }

                return Ok(new { success = true, message = "ยืนยันการส่งแล้ว สถานะ: จัดส่งแล้ว" });
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
        /// ผู้ซื้อยืนยันได้รับของแล้ว → เปลี่ยนแค่สถานะคำสั่งซื้อเป็น "sold"
        /// ไม่ไป mark โพสต์เป็นขายแล้ว — สต็อกลดที่ checkout แล้ว โพสต์จะเป็น sold เฉพาะเมื่อสต็อกหมด (จำนวนใบเหลือ 0)
        /// </summary>
        [HttpPost("{id}/confirm-received")]
        public async Task<IActionResult> ConfirmReceived(string id)
        {
            try
            {
                var userId = GetUserIdRequired();
                var order = await _supabaseService.GetAsync("orders", id, useServiceRole: true);
                if (order == null)
                    return NotFound(new { success = false, error = "ไม่พบคำสั่งซื้อ" });
                var buyerId = order.ContainsKey("buyer_id") ? order["buyer_id"]?.ToString() : null;
                if (buyerId != userId)
                    return Forbid();
                var status = order.ContainsKey("status") ? order["status"]?.ToString() : null;
                if (status != "shipped")
                    return BadRequest(new { success = false, error = "สามารถกดได้รับของแล้วได้เมื่อสถานะเป็นจัดส่งแล้วเท่านั้น" });

                var updateData = new Dictionary<string, object>
                {
                    ["status"] = "sold",
                    ["updated_at"] = DateTime.UtcNow
                };
                await _supabaseService.UpdateAsync("orders", id, updateData, null, true);

                // แจ้งเตือนผู้ขายว่าผู้ซื้อได้รับสินค้าแล้ว
                var sellerId = order.ContainsKey("seller_id") ? order["seller_id"]?.ToString() : null;
                if (!string.IsNullOrEmpty(sellerId))
                {
                    try
                    {
                        var buyerName = order.ContainsKey("buyer_name") ? order["buyer_name"]?.ToString() : "ผู้ซื้อ";
                        await _supabaseService.CreateAsync("notifications", new Dictionary<string, object>
                        {
                            ["user_id"] = sellerId,
                            ["type"] = "order_received",
                            ["title"] = "ผู้ซื้อได้รับสินค้าแล้ว",
                            ["message"] = $"{buyerName} ยืนยันว่าได้รับสินค้าเรียบร้อยแล้ว คำสั่งซื้อเสร็จสมบูรณ์"
                        }, useServiceRole: true);
                    }
                    catch (Exception notifEx)
                    {
                        _logger.LogWarning(notifEx, "Failed to create received notification for seller {SellerId}", sellerId);
                    }
                }

                return Ok(new { success = true, message = "ยืนยันได้รับของแล้ว เสร็จสิ้นกระบวนการ" });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { success = false, error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ConfirmReceived error");
                return StatusCode(500, new { success = false, error = "เกิดข้อผิดพลาด", message = ex.Message });
            }
        }

        /// <summary>
        /// Batch load order items + posts แทน N+1 — ใช้ร่วมกันระหว่าง GetMyOrders / GetSellerOrders
        /// </summary>
        private async Task<List<object>> BuildOrderListAsync(List<Dictionary<string, object>> orders)
        {
            if (orders.Count == 0) return new List<object>();

            // 1) Batch load order_items ทุก order ใน 1 query
            var orderIds = orders
                .Select(o => o.ContainsKey("id") ? o["id"]?.ToString() : null)
                .Where(id => !string.IsNullOrEmpty(id))
                .Distinct()
                .ToList()!;
            var allItems = await _supabaseService.QueryInAsync("order_items", "order_id", orderIds!, useServiceRole: true);

            // 2) Batch load posts ทั้งหมดที่อยู่ใน order_items ใน 1 query
            var allPostIds = allItems
                .Select(it => it.ContainsKey("post_id") ? it["post_id"]?.ToString() : null)
                .Where(id => !string.IsNullOrEmpty(id))
                .Distinct()
                .ToList()!;
            var allPosts = allPostIds!.Count > 0
                ? await _supabaseService.QueryInAsync("posts", "id", allPostIds!, useServiceRole: true)
                : new List<Dictionary<string, object>>();
            var postLookup = allPosts.ToDictionary(
                p => p.ContainsKey("id") ? p["id"]?.ToString() ?? "" : "",
                p => p,
                StringComparer.OrdinalIgnoreCase);

            // 3) จัดกลุ่ม order_items ตาม order_id
            var itemsByOrder = new Dictionary<string, List<Dictionary<string, object>>>(StringComparer.OrdinalIgnoreCase);
            foreach (var it in allItems)
            {
                var oid = it.ContainsKey("order_id") ? it["order_id"]?.ToString() ?? "" : "";
                if (!itemsByOrder.ContainsKey(oid))
                    itemsByOrder[oid] = new List<Dictionary<string, object>>();
                itemsByOrder[oid].Add(it);
            }

            // 4) ประกอบ response
            var list = new List<object>();
            foreach (var o in orders)
            {
                var orderId = o.ContainsKey("id") ? o["id"]?.ToString() : null;
                if (string.IsNullOrEmpty(orderId)) continue;
                var items = itemsByOrder.TryGetValue(orderId, out var oItems) ? oItems : new List<Dictionary<string, object>>();
                var itemsWithPost = items.Select(it =>
                {
                    var postId = it.ContainsKey("post_id") ? it["post_id"]?.ToString() : null;
                    var post = !string.IsNullOrEmpty(postId) && postLookup.TryGetValue(postId, out var p) ? p : null;
                    return new
                    {
                        id = it.ContainsKey("id") ? it["id"] : null,
                        postId,
                        cardId = it.ContainsKey("card_id") ? it["card_id"] : null,
                        quantity = it.ContainsKey("quantity") ? it["quantity"] : 1,
                        unitPrice = it.ContainsKey("unit_price") ? it["unit_price"] : 0,
                        post = (object?)post
                    };
                }).ToList();

                list.Add(new
                {
                    id = o["id"],
                    buyerId = o.ContainsKey("buyer_id") ? o["buyer_id"] : null,
                    buyerName = o.ContainsKey("buyer_name") ? o["buyer_name"] : null,
                    sellerId = o.ContainsKey("seller_id") ? o["seller_id"] : null,
                    sellerName = o.ContainsKey("seller_name") ? o["seller_name"] : null,
                    status = o.ContainsKey("status") ? o["status"] : "pending_shipment",
                    receiptUrl = o.ContainsKey("receipt_url") ? o["receipt_url"] : null,
                    shippingAddress = o.ContainsKey("shipping_address") ? o["shipping_address"] : null,
                    shippingPhone = o.ContainsKey("shipping_phone") ? o["shipping_phone"] : null,
                    totalAmount = o.ContainsKey("total_amount") ? o["total_amount"] : 0,
                    createdAt = o.ContainsKey("created_at") ? o["created_at"] : null,
                    updatedAt = o.ContainsKey("updated_at") ? o["updated_at"] : null,
                    items = itemsWithPost
                });
            }
            return list;
        }

        /// <summary>
        /// ดึงค่าตัวเลขจาก dictionary โดยลองหลายคีย์ (รองรับทั้ง camelCase และ lowercase จาก DB)
        /// </summary>
        private static double GetNumeric(Dictionary<string, object> dict, params string[] keys)
        {
            foreach (var key in keys)
            {
                if (!dict.TryGetValue(key, out var v) || v == null) continue;
                if (v is decimal dm) return (double)dm;
                if (v is double dbl) return dbl;
                if (v is int i) return i;
                if (v is long l) return l;
                if (double.TryParse(v.ToString(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var parsed))
                    return parsed;
            }
            return 0;
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
                    if (c is not Dictionary<string, object> card) continue;
                    var cid = card.TryGetValue("id", out var idVal) ? idVal?.ToString() : null;
                    if (cid != cardId) continue;
                    var cardPrice = GetNumeric(card, "price", "Price");
                    if (cardPrice > 0) return cardPrice;
                }
            }
            var fromPost = GetNumeric(p, "individualPrice", "individualprice", "price", "Price");
            if (fromPost > 0) return fromPost;
            return 0;
        }

        /// <summary>
        /// ตรวจสอบว่าสต็อกเพียงพอสำหรับรายการที่ต้องการซื้อ (ป้องกัน oversell)
        /// </summary>
        private static bool ValidateStockAvailable(Dictionary<string, object> post, List<(string? cardId, int qty)> reductions)
        {
            if (reductions == null || reductions.Count == 0) return true;
            var postType = post.TryGetValue("postType", out var pt) ? pt?.ToString() : null;
            var saleType = post.TryGetValue("saleType", out var st) ? st?.ToString() : null;

            if (postType == "sale" && saleType == "individual"
                && post.TryGetValue("individualCards", out var cardsObj) && cardsObj is System.Collections.IEnumerable cardsEnum)
            {
                var qtyByCard = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                foreach (var (cardId, qty) in reductions)
                {
                    var key = cardId ?? "";
                    if (!qtyByCard.ContainsKey(key)) qtyByCard[key] = 0;
                    qtyByCard[key] += qty;
                }

                foreach (var c in cardsEnum)
                {
                    if (c is not Dictionary<string, object> card) continue;
                    var cid = card.TryGetValue("id", out var idVal) ? idVal?.ToString() ?? "" : "";
                    if (!qtyByCard.TryGetValue(cid, out var needed)) continue;
                    int currentQty = Convert.ToInt32(GetNumeric(card, "quantity", "Quantity"));
                    if (currentQty < needed) return false;
                }
                return true;
            }

            int deckQtyNeeded = reductions.Where(r => string.IsNullOrEmpty(r.cardId)).Sum(r => r.qty);
            if (deckQtyNeeded <= 0) return true;
            int currentAvail = Convert.ToInt32(GetNumeric(post, "availableQuantity", "availablequantity"));
            return currentAvail >= deckQtyNeeded;
        }

        /// <summary>
        /// ลดสต็อกโพสต์ตามรายการที่ซื้อ (ขายแยกใบ: ลด individualCards[].quantity; ถ้าเหลือ 0 ถึง mark sold)
        /// </summary>
        private static Dictionary<string, object>? ReducePostStock(Dictionary<string, object> post, List<(string? cardId, int qty)> reductions)
        {
            if (reductions == null || reductions.Count == 0) return null;
            var postType = post.TryGetValue("postType", out var pt) ? pt?.ToString() : null;
            var saleType = post.TryGetValue("saleType", out var st) ? st?.ToString() : null;
            if (postType == "sale" && saleType == "individual"
                && post.TryGetValue("individualCards", out var cardsObj) && cardsObj is System.Collections.IEnumerable cardsEnum)
            {
                // รวม qty ต่อ cardId (กรณีซื้อการ์ดเดียวกันหลายบรรทัด)
                var qtyByCard = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                foreach (var (cardId, qty) in reductions)
                {
                    var key = cardId ?? "";
                    if (!qtyByCard.ContainsKey(key)) qtyByCard[key] = 0;
                    qtyByCard[key] += qty;
                }

                var cardsList = new List<Dictionary<string, object>>();
                foreach (var c in cardsEnum)
                {
                    var card = c as Dictionary<string, object>;
                    if (card == null) continue;
                    var cid = card.TryGetValue("id", out var idVal) ? idVal?.ToString() : null;
                    var key = cid ?? "";
                    int toDeduct = qtyByCard.TryGetValue(key, out var d) ? d : 0;
                    int currentQty = Convert.ToInt32(GetNumeric(card, "quantity", "Quantity"));
                    int newQty = Math.Max(0, currentQty - toDeduct);
                    var newCard = new Dictionary<string, object>(card);
                    newCard["quantity"] = newQty;
                    cardsList.Add(newCard);
                }

                int totalQty = cardsList.Sum(c => Convert.ToInt32(GetNumeric(c, "quantity", "Quantity")));
                var update = new Dictionary<string, object>
                {
                    ["individualCards"] = cardsList,
                    ["availableQuantity"] = totalQty,
                    ["updatedAt"] = DateTime.UtcNow
                };
                if (totalQty <= 0)
                    update["status"] = "sold";
                return update;
            }

            // โพสต์แบบเด็ค/ทั้งชุด: ลด availableQuantity (เฉพาะรายการที่ไม่มี cardId)
            int deckQtyToDeduct = reductions.Where(r => string.IsNullOrEmpty(r.cardId)).Sum(r => r.qty);
            if (deckQtyToDeduct <= 0) return null;
            int currentAvail = Convert.ToInt32(GetNumeric(post, "availableQuantity", "availablequantity"));
            int newAvail = Math.Max(0, currentAvail - deckQtyToDeduct);
            var deckUpdate = new Dictionary<string, object>
            {
                ["availableQuantity"] = newAvail,
                ["updatedAt"] = DateTime.UtcNow
            };
            if (newAvail <= 0)
                deckUpdate["status"] = "sold";
            return deckUpdate;
        }
    }

    public class CheckoutRequest
    {
        public List<string>? CartItemIds { get; set; }
        public string? ShippingAddress { get; set; }
        public string? ShippingPhone { get; set; }
    }

    public class ConfirmShipmentRequest
    {
        public string? ReceiptUrl { get; set; }
    }
}

using System.Linq;
using System.Text.Json;

namespace ServerApi.Services
{
    public class AuctionService
    {
        private readonly SupabaseService _supabase;
        private readonly ILogger<AuctionService> _logger;

        private const int PaymentDeadlineHours = 24;

        public AuctionService(SupabaseService supabase, ILogger<AuctionService> logger)
        {
            _supabase = supabase;
            _logger = logger;
        }

        /// <summary>จบประมูลแล้วใส่ตะกร้าผู้ชนะ + กำหนด deadline ชำระ 1 วัน</summary>
        public async Task FinalizeAuctionIfNeededAsync(string postId)
        {
            var post = await _supabase.GetAsync("posts", postId, useServiceRole: true);
            if (post == null) return;
            if (post.TryGetValue("postType", out var pt) && pt?.ToString() != "auction") return;
            if (post.TryGetValue("auctionStatus", out var ast) && ast?.ToString() == "won_pending_payment") return;
            if (post.TryGetValue("auctionStatus", out var ast2) && ast2?.ToString() == "sold") return;

            var end = GetDateTime(post, "auctionEndDate");
            if (end > DateTime.UtcNow) return;

            var saleType = post.TryGetValue("saleType", out var st) ? st?.ToString() : null;
            var isIndividual = saleType == "individual";

            var bids = await _supabase.QueryAsync("auction_bids", "post_id", postId, useServiceRole: true);
            if (bids == null || bids.Count == 0)
            {
                var noBidUpdate = new Dictionary<string, object> { ["auctionStatus"] = "active", ["updatedAt"] = DateTime.UtcNow };
                await _supabase.UpdateAsync("posts", postId, noBidUpdate, idField: "id", useServiceRole: true);
                return;
            }

            if (isIndividual)
            {
                await FinalizeIndividualAuctionAsync(postId, post, bids);
                return;
            }

            var top = bids.OrderByDescending(b => GetDecimal(b, "bid_amount")).ThenByDescending(b => GetDateTime(b, "created_at")).First();
            var winnerId = top.TryGetValue("bidder_id", out var wid) ? wid?.ToString() : null;
            var winningAmount = GetDecimal(top, "bid_amount");
            if (string.IsNullOrEmpty(winnerId)) return;

            var deadline = DateTime.UtcNow.AddHours(PaymentDeadlineHours);
            var update = new Dictionary<string, object>
            {
                ["winnerId"] = winnerId,
                ["currentBid"] = winningAmount,
                ["paymentDeadline"] = deadline,
                ["auctionStatus"] = "won_pending_payment",
                ["status"] = "pending",
                ["updatedAt"] = DateTime.UtcNow
            };
            await _supabase.UpdateAsync("posts", postId, update, idField: "id", useServiceRole: true);

            var cartData = new Dictionary<string, object> { ["user_id"] = winnerId, ["post_id"] = postId, ["quantity"] = 1 };
            try { await _supabase.CreateAsync("cart_items", cartData, useServiceRole: true); }
            catch (Exception ex) { _logger.LogWarning(ex, "Auction finalize: could not add to winner cart"); }
        }

        private async Task FinalizeIndividualAuctionAsync(string postId, Dictionary<string, object> post, List<Dictionary<string, object>> bids)
        {
            var cardGroups = bids
                .Where(b => !string.IsNullOrEmpty(GetStr(b, "card_id")))
                .GroupBy(b => GetStr(b, "card_id"));

            var deadline = DateTime.UtcNow.AddHours(PaymentDeadlineHours);
            foreach (var grp in cardGroups)
            {
                var top = grp.OrderByDescending(b => GetDecimal(b, "bid_amount")).ThenByDescending(b => GetDateTime(b, "created_at")).First();
                var winnerId = top.TryGetValue("bidder_id", out var wid) ? wid?.ToString() : null;
                var cardId = grp.Key;
                var amount = GetDecimal(top, "bid_amount");
                if (string.IsNullOrEmpty(winnerId) || string.IsNullOrEmpty(cardId)) continue;

                var winnerRow = new Dictionary<string, object>
                {
                    ["post_id"] = postId,
                    ["card_id"] = cardId,
                    ["winner_id"] = winnerId,
                    ["bid_amount"] = amount,
                    ["payment_deadline"] = deadline
                };
                try { await _supabase.CreateAsync("auction_card_winners", winnerRow, useServiceRole: true); }
                catch { continue; }

                var cartData = new Dictionary<string, object>
                {
                    ["user_id"] = winnerId,
                    ["post_id"] = postId,
                    ["card_id"] = cardId,
                    ["quantity"] = 1
                };
                try { await _supabase.CreateAsync("cart_items", cartData, useServiceRole: true); }
                catch { }

                var update = new Dictionary<string, object> { ["auctionStatus"] = "won_pending_payment", ["status"] = "pending", ["updatedAt"] = DateTime.UtcNow };
                await _supabase.UpdateAsync("posts", postId, update, idField: "id", useServiceRole: true);
            }

            if (cardGroups.Any())
            {
                var up = new Dictionary<string, object> { ["auctionStatus"] = "won_pending_payment", ["status"] = "pending", ["updatedAt"] = DateTime.UtcNow };
                await _supabase.UpdateAsync("posts", postId, up, idField: "id", useServiceRole: true);
            }
        }

        private static string GetStr(Dictionary<string, object> d, string key)
        {
            if (!d.TryGetValue(key, out var v) || v == null) return string.Empty;
            return v?.ToString() ?? string.Empty;
        }

        /// <summary>
        /// ถ้าเลย deadline ยังไม่ชำระ → cascade ไป bidder ถัดไป, 
        /// ถ้าไม่มี bidder เหลือ → auction_released
        /// </summary>
        public async Task ReleaseAuctionIfOverdueAsync(string postId)
        {
            var post = await _supabase.GetAsync("posts", postId, useServiceRole: true);
            if (post == null) return;
            if (post.TryGetValue("auctionStatus", out var ast) && ast?.ToString() != "won_pending_payment") return;

            var saleType = post.TryGetValue("saleType", out var st) ? st?.ToString() : null;
            if (saleType == "individual")
            {
                await ReleaseIndividualOverdueAsync(postId, post);
                return;
            }

            var deadline = GetDateTime(post, "paymentDeadline");
            if (deadline >= DateTime.UtcNow) return;

            var currentWinnerId = post.TryGetValue("winnerId", out var w) ? w?.ToString() : null;
            if (string.IsNullOrEmpty(currentWinnerId)) return;

            // Remove current winner's cart item
            await RemoveCartItemForUser(currentWinnerId, postId, null);

            // Add current winner to defaultedBidders
            var defaulted = GetDefaultedBidders(post);
            defaulted.Add(currentWinnerId);

            // Find next bidder (not in defaultedBidders)
            var bids = await _supabase.QueryAsync("auction_bids", "post_id", postId, useServiceRole: true);
            var nextBid = bids?
                .Where(b => !defaulted.Contains(GetStr(b, "bidder_id")))
                .OrderByDescending(b => GetDecimal(b, "bid_amount"))
                .ThenByDescending(b => GetDateTime(b, "created_at"))
                .FirstOrDefault();

            var nextBidderId = nextBid != null ? GetStr(nextBid, "bidder_id") : null;

            if (!string.IsNullOrEmpty(nextBidderId))
            {
                var newDeadline = DateTime.UtcNow.AddHours(PaymentDeadlineHours);
                var newAmount = GetDecimal(nextBid!, "bid_amount");
                var update = new Dictionary<string, object>
                {
                    ["winnerId"] = nextBidderId,
                    ["currentBid"] = newAmount,
                    ["paymentDeadline"] = newDeadline,
                    ["auctionStatus"] = "won_pending_payment",
                    ["status"] = "pending",
                    ["defaultedBidders"] = JsonSerializer.Serialize(defaulted),
                    ["updatedAt"] = DateTime.UtcNow
                };
                await _supabase.UpdateAsync("posts", postId, update, idField: "id", useServiceRole: true);

                var cartData = new Dictionary<string, object> { ["user_id"] = nextBidderId, ["post_id"] = postId, ["quantity"] = 1 };
                try { await _supabase.CreateAsync("cart_items", cartData, useServiceRole: true); }
                catch (Exception ex) { _logger.LogWarning(ex, "Cascade: could not add to next winner cart"); }

                _logger.LogInformation("Auction {PostId}: cascaded from {Old} to {New} (bid {Amount})",
                    postId, currentWinnerId, nextBidderId, newAmount);
            }
            else
            {
                var update = new Dictionary<string, object>
                {
                    ["auctionStatus"] = "auction_released",
                    ["status"] = "active",
                    ["winnerId"] = null!,
                    ["paymentDeadline"] = null!,
                    ["defaultedBidders"] = JsonSerializer.Serialize(defaulted),
                    ["updatedAt"] = DateTime.UtcNow
                };
                await _supabase.UpdateAsync("posts", postId, update, idField: "id", useServiceRole: true);
                _logger.LogInformation("Auction {PostId}: no more bidders, released", postId);
            }
        }

        private async Task ReleaseIndividualOverdueAsync(string postId, Dictionary<string, object> post)
        {
            var allWinners = await _supabase.QueryAsync("auction_card_winners", "post_id", postId, useServiceRole: true);
            if (allWinners == null) return;
            var now = DateTime.UtcNow;
            var bids = await _supabase.QueryAsync("auction_bids", "post_id", postId, useServiceRole: true);
            var defaulted = GetDefaultedBidders(post);
            bool defaultedChanged = false;

            foreach (var row in allWinners)
            {
                var deadline = GetDateTime(row, "payment_deadline");
                if (deadline >= now) continue;

                var currentWinnerId = GetStr(row, "winner_id");
                var cardId = GetStr(row, "card_id");
                var rowId = row.TryGetValue("id", out var rid) ? rid?.ToString() : null;
                if (string.IsNullOrEmpty(rowId) || string.IsNullOrEmpty(cardId)) continue;

                // Remove old winner's cart item
                if (!string.IsNullOrEmpty(currentWinnerId))
                    await RemoveCartItemForUser(currentWinnerId, postId, cardId);

                if (!string.IsNullOrEmpty(currentWinnerId) && !defaulted.Contains(currentWinnerId))
                {
                    defaulted.Add(currentWinnerId);
                    defaultedChanged = true;
                }

                // Find next bidder for this card
                var nextBid = bids?
                    .Where(b => GetStr(b, "card_id") == cardId && !defaulted.Contains(GetStr(b, "bidder_id")))
                    .OrderByDescending(b => GetDecimal(b, "bid_amount"))
                    .ThenByDescending(b => GetDateTime(b, "created_at"))
                    .FirstOrDefault();
                var nextBidderId = nextBid != null ? GetStr(nextBid, "bidder_id") : null;

                if (!string.IsNullOrEmpty(nextBidderId))
                {
                    var newDeadline = DateTime.UtcNow.AddHours(PaymentDeadlineHours);
                    var newAmount = GetDecimal(nextBid!, "bid_amount");
                    var winnerUpdate = new Dictionary<string, object>
                    {
                        ["winner_id"] = nextBidderId,
                        ["bid_amount"] = newAmount,
                        ["payment_deadline"] = newDeadline
                    };
                    await _supabase.UpdateAsync("auction_card_winners", rowId, winnerUpdate, idField: "id", useServiceRole: true);

                    var cartData = new Dictionary<string, object>
                    {
                        ["user_id"] = nextBidderId,
                        ["post_id"] = postId,
                        ["card_id"] = cardId,
                        ["quantity"] = 1
                    };
                    try { await _supabase.CreateAsync("cart_items", cartData, useServiceRole: true); }
                    catch { }

                    _logger.LogInformation("Individual auction {PostId} card {CardId}: cascaded from {Old} to {New}",
                        postId, cardId, currentWinnerId, nextBidderId);
                }
                else
                {
                    await _supabase.DeleteAsync("auction_card_winners", rowId, "id", true);
                    _logger.LogInformation("Individual auction {PostId} card {CardId}: no more bidders, removed winner row",
                        postId, cardId);
                }
            }

            // Persist defaultedBidders if changed
            if (defaultedChanged)
            {
                var defUpdate = new Dictionary<string, object>
                {
                    ["defaultedBidders"] = JsonSerializer.Serialize(defaulted),
                    ["updatedAt"] = DateTime.UtcNow
                };
                await _supabase.UpdateAsync("posts", postId, defUpdate, idField: "id", useServiceRole: true);
            }

            // Check if any winners remain
            var remaining = await _supabase.QueryAsync("auction_card_winners", "post_id", postId, useServiceRole: true);
            if (remaining == null || remaining.Count == 0)
            {
                var update = new Dictionary<string, object>
                {
                    ["auctionStatus"] = "auction_released",
                    ["status"] = "active",
                    ["updatedAt"] = DateTime.UtcNow
                };
                await _supabase.UpdateAsync("posts", postId, update, idField: "id", useServiceRole: true);
            }
        }

        /// <summary>Parse defaultedBidders JSON array from post</summary>
        private static HashSet<string> GetDefaultedBidders(Dictionary<string, object> post)
        {
            var result = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (!post.TryGetValue("defaultedBidders", out var val) || val == null) return result;

            try
            {
                if (val is JsonElement je)
                {
                    if (je.ValueKind == JsonValueKind.Array)
                        foreach (var item in je.EnumerateArray())
                            if (item.GetString() is string s) result.Add(s);
                }
                else if (val is string str)
                {
                    var arr = JsonSerializer.Deserialize<List<string>>(str);
                    if (arr != null) foreach (var s in arr) result.Add(s);
                }
            }
            catch { }
            return result;
        }

        /// <summary>Remove a specific cart item for a user/post/card combination</summary>
        private async Task RemoveCartItemForUser(string userId, string postId, string? cardId)
        {
            var cartItems = await _supabase.QueryAsync("cart_items", "user_id", userId, useServiceRole: true);
            var item = cartItems?.FirstOrDefault(i =>
                postId.Equals(GetStr(i, "post_id"), StringComparison.OrdinalIgnoreCase)
                && (string.IsNullOrEmpty(cardId)
                    ? string.IsNullOrEmpty(GetStr(i, "card_id"))
                    : cardId.Equals(GetStr(i, "card_id"), StringComparison.OrdinalIgnoreCase)));
            if (item != null && item.TryGetValue("id", out var cartIdVal) && cartIdVal != null)
                await _supabase.DeleteAsync("cart_items", cartIdVal.ToString()!, "id", true);
        }

        internal static decimal GetDecimal(Dictionary<string, object> d, string key)
        {
            if (!d.TryGetValue(key, out var v) || v == null) return 0;
            if (v is decimal dm) return dm;
            if (v is double db) return (decimal)db;
            if (v is int i) return i;
            if (v is long l) return l;
            if (v is JsonElement je && je.TryGetDecimal(out var jd)) return jd;
            decimal.TryParse(v.ToString(), out var r);
            return r;
        }

        internal static DateTime GetDateTime(Dictionary<string, object> d, string key)
        {
            if (!d.TryGetValue(key, out var v) || v == null) return DateTime.MinValue;
            if (v is DateTime dt) return dt;
            if (v is DateTimeOffset dto) return dto.UtcDateTime;
            if (v is string s && DateTime.TryParse(s, out var p)) return p.ToUniversalTime();
            return DateTime.MinValue;
        }
    }
}

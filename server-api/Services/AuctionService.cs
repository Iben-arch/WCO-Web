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

        /// <summary>ถ้าเลย deadline ยังไม่ชำระ → หลุด (auction_released)</summary>
        public async Task ReleaseAuctionIfOverdueAsync(string postId)
        {
            var post = await _supabase.GetAsync("posts", postId, useServiceRole: true);
            if (post == null) return;
            if (post.TryGetValue("auctionStatus", out var ast) && ast?.ToString() != "won_pending_payment") return;

            var saleType = post.TryGetValue("saleType", out var st) ? st?.ToString() : null;
            var isIndividual = saleType == "individual";

            if (isIndividual)
            {
                await ReleaseIndividualOverdueAsync(postId);
                return;
            }

            var deadline = GetDateTime(post, "paymentDeadline");
            if (deadline >= DateTime.UtcNow) return;

            var winnerId = post.TryGetValue("winnerId", out var w) ? w?.ToString() : null;
            var update = new Dictionary<string, object>
            {
                ["auctionStatus"] = "auction_released",
                ["status"] = "active",
                ["winnerId"] = null!,
                ["paymentDeadline"] = null!,
                ["updatedAt"] = DateTime.UtcNow
            };
            await _supabase.UpdateAsync("posts", postId, update, idField: "id", useServiceRole: true);

            if (!string.IsNullOrEmpty(winnerId))
            {
                var cartItems = await _supabase.QueryAsync("cart_items", "user_id", winnerId, useServiceRole: true);
                var item = cartItems?.FirstOrDefault(i =>
                    postId.Equals(GetStr(i, "post_id")) && string.IsNullOrEmpty(GetStr(i, "card_id")));
                if (item != null && item.TryGetValue("id", out var cartId) && cartId != null)
                    await _supabase.DeleteAsync("cart_items", cartId.ToString()!, "id", true);
            }
        }

        private async Task ReleaseIndividualOverdueAsync(string postId)
        {
            var allWinners = await _supabase.QueryAsync("auction_card_winners", "post_id", postId, useServiceRole: true);
            if (allWinners == null) return;
            var now = DateTime.UtcNow;
            foreach (var row in allWinners)
            {
                var deadline = GetDateTime(row, "payment_deadline");
                if (deadline >= now) continue;
                var winnerId = GetStr(row, "winner_id");
                var cardId = GetStr(row, "card_id");
                var rowId = row.TryGetValue("id", out var rid) ? rid?.ToString() : null;
                if (string.IsNullOrEmpty(rowId)) continue;
                await _supabase.DeleteAsync("auction_card_winners", rowId, "id", true);
                if (string.IsNullOrEmpty(winnerId)) continue;
                var cartItems = await _supabase.QueryAsync("cart_items", "user_id", winnerId, useServiceRole: true);
                var item = cartItems?.FirstOrDefault(i =>
                    postId.Equals(GetStr(i, "post_id")) && cardId.Equals(GetStr(i, "card_id")));
                if (item != null && item.TryGetValue("id", out var cartId) && cartId != null)
                    await _supabase.DeleteAsync("cart_items", cartId.ToString()!, "id", true);
            }
            var remaining = await _supabase.QueryAsync("auction_card_winners", "post_id", postId, useServiceRole: true);
            if (remaining == null || remaining.Count == 0)
            {
                var update = new Dictionary<string, object> { ["auctionStatus"] = "auction_released", ["status"] = "active", ["updatedAt"] = DateTime.UtcNow };
                await _supabase.UpdateAsync("posts", postId, update, idField: "id", useServiceRole: true);
            }
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

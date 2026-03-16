using Microsoft.AspNetCore.Mvc;
using ServerApi.Services;
using System.Text.Json;

namespace ServerApi.Controllers
{
    [ApiController]
    [Route("api/auction")]
    public class AuctionController : BaseController
    {
        private readonly SupabaseService _supabase;
        private readonly AuctionService _auctionService;
        private readonly ILogger<AuctionController> _logger;

        private const int ExtendMinutes = 5;
        private const int MinutesThresholdToExtend = 5;
        private const int PaymentDeadlineHours = 24;

        public AuctionController(SupabaseService supabase, AuctionService auctionService, ILogger<AuctionController> logger)
        {
            _supabase = supabase;
            _auctionService = auctionService;
            _logger = logger;
        }

        /// <summary>วาง bid และขยายเวลาได้ถ้าใกล้หมดเวลา (cardId บังคับสำหรับประมูลแยกใบ)</summary>
        [HttpPost("{postId}/bid")]
        public async Task<IActionResult> PlaceBid(string postId, [FromBody] PlaceBidRequest body)
        {
            var userId = GetUserId();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { success = false, error = "กรุณาเข้าสู่ระบบ" });

            if (body?.BidAmount <= 0)
                return BadRequest(new { success = false, error = "จำนวนเงินประมูลต้องมากกว่า 0" });

            var post = await _supabase.GetAsync("posts", postId, useServiceRole: true);
            if (post == null)
                return NotFound(new { success = false, error = "ไม่พบโพสต์" });

            if (post.TryGetValue("postType", out var pt) && pt?.ToString() != "auction")
                return BadRequest(new { success = false, error = "โพสต์นี้ไม่ใช่การประมูล" });

            var saleType = post.TryGetValue("saleType", out var stype) ? stype?.ToString() : null;
            var isIndividual = saleType == "individual";

            if (isIndividual && string.IsNullOrEmpty(body?.CardId))
                return BadRequest(new { success = false, error = "ประมูลแยกใบต้องระบุ cardId" });

            var sellerId = post.TryGetValue("sellerId", out var sid) ? sid?.ToString() : null;
            if (sellerId == userId)
                return BadRequest(new { success = false, error = "ไม่สามารถประมูลโพสต์ของตัวเองได้" });

            var status = post.TryGetValue("status", out var st) ? st?.ToString() : null;
            var auctionStatus = post.TryGetValue("auctionStatus", out var ast) ? ast?.ToString() : null;
            if (status == "sold" || auctionStatus == "sold" || auctionStatus == "won_pending_payment")
                return BadRequest(new { success = false, error = "การประมูลจบแล้วหรือรอการชำระเงิน" });

            if (auctionStatus == "auction_released")
                return BadRequest(new { success = false, error = "รายการนี้หลุดแล้ว เจ้าของยังไม่ได้เปิดประมูลใหม่" });

            var auctionEnd = GetDateTime(post, "auctionEndDate");
            if (auctionEnd <= DateTime.UtcNow)
            {
                await _auctionService.FinalizeAuctionIfNeededAsync(postId);
                return BadRequest(new { success = false, error = "การประมูลสิ้นสุดแล้ว" });
            }

            decimal minBid;
            if (isIndividual)
            {
                if (!GetIndividualCardStartingBid(post, body!.CardId!, out var cardStart))
                    return BadRequest(new { success = false, error = "ไม่พบการ์ดที่ระบุ" });
                var allBids = await _supabase.QueryAsync("auction_bids", "post_id", postId, useServiceRole: true);
                var cardBids = (allBids ?? new List<Dictionary<string, object>>())
                    .Where(b => string.Equals(GetString(b, "card_id"), body.CardId, StringComparison.OrdinalIgnoreCase))
                    .ToList();
                var cardMax = cardBids.Count > 0 ? cardBids.Max(b => GetDecimal(b, "bid_amount")) : 0;
                minBid = cardMax > 0 ? cardMax : cardStart;
            }
            else
            {
                var startingBid = GetDecimal(post, "startingBid");
                var currentBid = GetDecimal(post, "currentBid");
                minBid = currentBid > 0 ? currentBid : startingBid;
            }

            if (body!.BidAmount <= minBid)
                return BadRequest(new { success = false, error = $"จำนวนเงินประมูลต้องมากกว่า {minBid:N0} บาท" });

            var profile = await _supabase.GetAsync("profiles", userId, useServiceRole: true, idField: "id");
            var bidderName = (profile != null && profile.TryGetValue("username", out var un) && un != null) ? un.ToString()! : "ผู้ใช้";

            var bidRow = new Dictionary<string, object>
            {
                ["post_id"] = postId,
                ["bidder_id"] = userId,
                ["bidder_name"] = bidderName,
                ["bid_amount"] = body.BidAmount
            };
            if (isIndividual)
                bidRow["card_id"] = body.CardId!;
            await _supabase.CreateAsync("auction_bids", bidRow, useServiceRole: true);

            var bidCount = (int)(GetDecimal(post, "bidCount") + 1);
            var newEnd = auctionEnd;
            var remaining = (newEnd - DateTime.UtcNow).TotalMinutes;
            if (remaining <= MinutesThresholdToExtend)
                newEnd = DateTime.UtcNow.AddMinutes(ExtendMinutes);

            var update = new Dictionary<string, object>
            {
                ["bidCount"] = bidCount,
                ["auctionEndDate"] = newEnd,
                ["updatedAt"] = DateTime.UtcNow
            };
            if (!post.ContainsKey("auctionStatus") || string.IsNullOrEmpty(auctionStatus))
                update["auctionStatus"] = "active";
            if (!isIndividual)
            {
                update["currentBid"] = body.BidAmount;
                update["highestBidder"] = userId;
            }
            await _supabase.UpdateAsync("posts", postId, update, idField: "id", useServiceRole: true);

            return Ok(new
            {
                success = true,
                message = remaining <= MinutesThresholdToExtend ? $"ประมูลสำเร็จ และขยายเวลาประมูลอีก {ExtendMinutes} นาที" : "ประมูลสำเร็จ",
                currentBid = body.BidAmount,
                cardId = body.CardId,
                bidCount,
                auctionEndDate = newEnd
            });
        }

        private static bool GetIndividualCardStartingBid(Dictionary<string, object> post, string cardId, out decimal startingBid)
        {
            startingBid = 0;
            if (!post.TryGetValue("individualCards", out var icObj) || icObj == null) return false;
            if (icObj is not System.Collections.IEnumerable arr) return false;
            foreach (var item in arr)
            {
                var card = item as Dictionary<string, object>;
                if (card == null) continue;
                var id = card.TryGetValue("id", out var i) ? i?.ToString() : null;
                if (string.IsNullOrEmpty(id) || !string.Equals(id, cardId, StringComparison.OrdinalIgnoreCase)) continue;
                startingBid = AuctionService.GetDecimal(card, "price");
                if (startingBid <= 0) startingBid = GetDecimal(post, "startingBid");
                return true;
            }
            return false;
        }

        private static string GetString(Dictionary<string, object> d, string key)
        {
            if (!d.TryGetValue(key, out var v) || v == null) return string.Empty;
            return v?.ToString() ?? string.Empty;
        }

        /// <summary>ดึงรายการ bid ของโพสต์ (optional cardId สำหรับประมูลแยกใบ)</summary>
        [HttpGet("{postId}/bids")]
        public async Task<IActionResult> GetBids(string postId, [FromQuery] string? cardId = null)
        {
            var list = await _supabase.QueryAsync("auction_bids", "post_id", postId, useServiceRole: true);
            if (list == null) return Ok(new List<object>());

            var filtered = string.IsNullOrEmpty(cardId)
                ? list
                : list.Where(b => string.Equals(GetString(b, "card_id"), cardId, StringComparison.OrdinalIgnoreCase)).ToList();

            var bids = filtered
                .OrderByDescending(b => GetDecimal(b, "bid_amount"))
                .ThenByDescending(b => GetDateTime(b, "created_at"))
                .Select(b => new
                {
                    id = b.TryGetValue("id", out var i) ? i?.ToString() : null,
                    bidderId = b.TryGetValue("bidder_id", out var bi) ? bi?.ToString() : null,
                    bidderName = b.TryGetValue("bidder_name", out var bn) ? bn?.ToString() : null,
                    bidAmount = GetDecimal(b, "bid_amount"),
                    cardId = b.TryGetValue("card_id", out var ci) ? ci?.ToString() : null,
                    createdAt = b.TryGetValue("created_at", out var c) ? c : null
                })
                .ToList();

            return Ok(bids);
        }

        /// <summary>ดึงรายการผู้ชนะแต่ละใบ (สำหรับประมูลแยกใบ)</summary>
        [HttpGet("{postId}/card-winners")]
        public async Task<IActionResult> GetCardWinners(string postId)
        {
            var list = await _supabase.QueryAsync("auction_card_winners", "post_id", postId, useServiceRole: true);
            if (list == null) return Ok(new List<object>());
            var result = list.Select(w => new
            {
                cardId = w.TryGetValue("card_id", out var ci) ? ci?.ToString() : null,
                winnerId = w.TryGetValue("winner_id", out var wi) ? wi?.ToString() : null,
                bidAmount = AuctionService.GetDecimal(w, "bid_amount"),
                paymentDeadline = w.TryGetValue("payment_deadline", out var pd) ? pd : null
            }).ToList();
            return Ok(result);
        }

        /// <summary>เจ้าของโพสต์เลือกประมูลใหม่ (หลังหลุด)</summary>
        [HttpPost("{postId}/re-auction")]
        public async Task<IActionResult> ReAuction(string postId, [FromBody] ReAuctionRequest body)
        {
            var userId = GetUserId();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { success = false, error = "กรุณาเข้าสู่ระบบ" });

            var post = await _supabase.GetAsync("posts", postId, useServiceRole: true);
            if (post == null)
                return NotFound(new { success = false, error = "ไม่พบโพสต์" });

            var sellerId = post.TryGetValue("sellerId", out var s) ? s?.ToString() : null;
            if (sellerId != userId)
                return Forbid();

            if (post.TryGetValue("auctionStatus", out var ast) && ast?.ToString() != "auction_released")
                return BadRequest(new { success = false, error = "สามารถประมูลใหม่ได้เฉพาะรายการที่หลุดเท่านั้น" });

            var newEnd = body?.NewEndDate ?? DateTime.UtcNow.AddDays(7);
            if (newEnd <= DateTime.UtcNow)
                return BadRequest(new { success = false, error = "วันสิ้นสุดต้องเป็นเวลาข้างหน้า" });

            var update = new Dictionary<string, object>
            {
                ["auctionStatus"] = "active",
                ["winnerId"] = null!,
                ["paymentDeadline"] = null!,
                ["auctionEndDate"] = newEnd,
                ["currentBid"] = null!,
                ["highestBidder"] = null!,
                ["bidCount"] = 0,
                ["updatedAt"] = DateTime.UtcNow
            };
            await _supabase.UpdateAsync("posts", postId, update, idField: "id", useServiceRole: true);

            return Ok(new { success = true, message = "เปิดประมูลใหม่แล้ว", auctionEndDate = newEnd });
        }

        private static decimal GetDecimal(Dictionary<string, object> d, string key)
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

        private static DateTime GetDateTime(Dictionary<string, object> d, string key)
        {
            if (!d.TryGetValue(key, out var v) || v == null) return DateTime.MinValue;
            if (v is DateTime dt) return dt;
            if (v is DateTimeOffset dto) return dto.UtcDateTime;
            if (v is string s && DateTime.TryParse(s, out var p)) return p.ToUniversalTime();
            return DateTime.MinValue;
        }
    }

    public class PlaceBidRequest
    {
        public decimal BidAmount { get; set; }
        public string? CardId { get; set; }
    }

    public class ReAuctionRequest
    {
        public DateTime? NewEndDate { get; set; }
    }
}

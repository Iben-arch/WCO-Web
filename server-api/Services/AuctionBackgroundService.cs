using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace ServerApi.Services
{
    /// <summary>
    /// Background service ที่ทำงานทุก 60 วินาที เพื่อ finalize/release auctions
    /// ที่หมดเวลาแล้ว โดยไม่ต้องรอให้มีคนเปิดดูโพสต์
    /// </summary>
    public class AuctionBackgroundService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<AuctionBackgroundService> _logger;
        private static readonly TimeSpan Interval = TimeSpan.FromSeconds(60);

        public AuctionBackgroundService(IServiceScopeFactory scopeFactory, ILogger<AuctionBackgroundService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("AuctionBackgroundService started");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await ProcessExpiredAuctionsAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "AuctionBackgroundService error");
                }

                await Task.Delay(Interval, stoppingToken);
            }
        }

        private async Task ProcessExpiredAuctionsAsync()
        {
            using var scope = _scopeFactory.CreateScope();
            var supabase = scope.ServiceProvider.GetRequiredService<SupabaseService>();
            var auctionService = scope.ServiceProvider.GetRequiredService<AuctionService>();

            // Query auction posts that are past end time but not yet finalized
            var activePosts = await supabase.QueryAsync("posts", "postType", "auction", useServiceRole: true);
            if (activePosts == null || activePosts.Count == 0) return;

            var now = DateTime.UtcNow;
            var processed = 0;

            foreach (var post in activePosts)
            {
                var postId = post.TryGetValue("id", out var idv) ? idv?.ToString() : null;
                if (string.IsNullOrEmpty(postId)) continue;

                var status = post.TryGetValue("status", out var st) ? st?.ToString() : null;
                var auctionStatus = post.TryGetValue("auctionStatus", out var ast) ? ast?.ToString() : null;

                if (status == "sold" || auctionStatus == "sold") continue;

                // Finalize: active auctions past end time
                if (auctionStatus == "active" || string.IsNullOrEmpty(auctionStatus))
                {
                    var endDate = AuctionService.GetDateTime(post, "auctionEndDate");
                    if (endDate != DateTime.MinValue && endDate <= now)
                    {
                        await auctionService.FinalizeAuctionIfNeededAsync(postId);
                        processed++;
                    }
                }

                // Release: won_pending_payment past payment deadline
                if (auctionStatus == "won_pending_payment")
                {
                    await auctionService.ReleaseAuctionIfOverdueAsync(postId);
                    processed++;
                }
            }

            if (processed > 0)
                _logger.LogInformation("AuctionBackgroundService processed {Count} auctions", processed);
        }
    }
}

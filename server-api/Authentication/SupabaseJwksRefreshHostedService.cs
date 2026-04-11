using System.Net.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;

namespace ServerApi.Authentication;

/// <summary>
/// โหลด JWKS จาก Supabase Auth เป็นระยะ (แคช ~10 นาทีตามแนวทางของ Supabase)
/// </summary>
public sealed class SupabaseJwksRefreshHostedService : BackgroundService
{
    public const string HttpClientName = "SupabaseJwks";

    private readonly SupabaseJwtValidationState _state;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly string _jwksUrl;
    private readonly ILogger<SupabaseJwksRefreshHostedService> _logger;

    public SupabaseJwksRefreshHostedService(
        SupabaseJwtValidationState state,
        IHttpClientFactory httpClientFactory,
        string jwksUrl,
        ILogger<SupabaseJwksRefreshHostedService> logger)
    {
        _state = state;
        _httpClientFactory = httpClientFactory;
        _jwksUrl = jwksUrl;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var client = _httpClientFactory.CreateClient(HttpClientName);
                var json = await client.GetStringAsync(new Uri(_jwksUrl), stoppingToken).ConfigureAwait(false);
                var keys = new JsonWebKeySet(json).GetSigningKeys().ToList();
                _state.ReplaceJwks(keys);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "Failed to refresh Supabase JWKS from {JwksUrl}", _jwksUrl);
            }

            try
            {
                await Task.Delay(TimeSpan.FromMinutes(10), stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }
}

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using ServerApi.Authentication;
using ServerApi.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Configure JSON serializer options
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
        options.JsonSerializerOptions.AllowTrailingCommas = true; // Allow trailing commas in JSON
        options.JsonSerializerOptions.ReadCommentHandling = System.Text.Json.JsonCommentHandling.Skip;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    // เพิ่ม Bearer token authentication ใน Swagger UI
    options.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer' [space] and then your token in the text input below.\n\nExample: \"Bearer 12345abcdef\"",
        Name = "Authorization",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    
    options.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// Supabase JWT: โปรเจกต์ใหม่ใช้ Signing keys (ES256) จาก JWKS — legacy ยังรองรับ HS256 ด้วย JwtSecret
var supabaseUrl = builder.Configuration["Supabase:Url"]?.Trim().TrimEnd('/');
if (string.IsNullOrEmpty(supabaseUrl))
    throw new InvalidOperationException("Supabase:Url is required.");

var jwksUrl = $"{supabaseUrl}/auth/v1/.well-known/jwks.json";
List<SecurityKey> initialJwksKeys;
try
{
    using var jwksHttp = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
    var jwksJson = jwksHttp.GetStringAsync(jwksUrl).GetAwaiter().GetResult();
    initialJwksKeys = new JsonWebKeySet(jwksJson).GetSigningKeys().ToList();
}
catch (Exception ex)
{
    throw new InvalidOperationException(
        $"Failed to load Supabase JWKS from {jwksUrl}. Cloud projects sign access tokens with ES256; the API must fetch this endpoint at startup.",
        ex);
}

var jwtSecret = builder.Configuration["Supabase:JwtSecret"]?.Trim();
SymmetricSecurityKey? symmetricKey = null;
if (!string.IsNullOrEmpty(jwtSecret))
    symmetricKey = SupabaseJwtSigningKey.Create(jwtSecret);

if (initialJwksKeys.Count == 0 && symmetricKey == null)
{
    throw new InvalidOperationException(
        "No JWT signing keys: JWKS returned no keys and Supabase:JwtSecret is empty. Set JwtSecret for legacy HS256 only, or fix JWKS.");
}

var jwtValidationState = new SupabaseJwtValidationState(symmetricKey, initialJwksKeys);
builder.Services.AddSingleton(jwtValidationState);

builder.Services.AddHttpClient(SupabaseJwksRefreshHostedService.HttpClientName, client =>
{
    client.BaseAddress = new Uri(supabaseUrl + "/");
    client.Timeout = TimeSpan.FromSeconds(15);
});
builder.Services.AddHostedService(sp => new SupabaseJwksRefreshHostedService(
    sp.GetRequiredService<SupabaseJwtValidationState>(),
    sp.GetRequiredService<IHttpClientFactory>(),
    jwksUrl,
    sp.GetRequiredService<ILogger<SupabaseJwksRefreshHostedService>>()));

var jwtIssuer = builder.Configuration["Supabase:JwtIssuer"];
if (string.IsNullOrEmpty(jwtIssuer))
    jwtIssuer = $"{supabaseUrl}/auth/v1";

var jwtAudience = builder.Configuration["Supabase:JwtAudience"] ?? "authenticated";
var validateAudience = builder.Configuration.GetValue("Supabase:JwtValidateAudience", true);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKeyResolver = (tokenString, securityToken, kid, _) =>
            {
                if (securityToken is not JwtSecurityToken jwt)
                    return Array.Empty<SecurityKey>();

                var alg = jwt.Header.Alg;
                if (string.Equals(alg, SecurityAlgorithms.HmacSha256, StringComparison.Ordinal))
                {
                    if (jwtValidationState.SymmetricKey != null)
                        return new[] { jwtValidationState.SymmetricKey };
                    return Array.Empty<SecurityKey>();
                }

                var jwks = jwtValidationState.JwksKeys;
                if (jwks.Count == 0)
                    return Array.Empty<SecurityKey>();

                if (!string.IsNullOrEmpty(kid))
                {
                    var matched = jwks.Where(k => string.Equals(k.KeyId, kid, StringComparison.Ordinal)).ToList();
                    if (matched.Count > 0)
                        return matched;
                }

                return jwks;
            },
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = validateAudience,
            ValidAudience = validateAudience ? jwtAudience : null,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(2),
            NameClaimType = JwtRegisteredClaimNames.Sub,
            RoleClaimType = ClaimTypes.Role,
            ValidAlgorithms = new HashSet<string>(StringComparer.Ordinal)
            {
                SecurityAlgorithms.HmacSha256,
                SecurityAlgorithms.EcdsaSha256,
                SecurityAlgorithms.RsaSha256,
                SecurityAlgorithms.RsaSsaPssSha256,
            },
        };
    });
builder.Services.AddAuthorization();

// Register custom services
try
{
    builder.Services.AddScoped<SupabaseService>();
    builder.Services.AddScoped<AuctionService>();
    builder.Services.AddHostedService<AuctionBackgroundService>();
    builder.Services.AddScoped<CardDetectionService>();
    builder.Services.AddScoped<ClipEmbeddingService>();
    builder.Services.AddScoped<PostEmbeddingIndexingService>();
    builder.Services.AddScoped<RelatedPostsService>();
    builder.Services.AddScoped<ExternalReverseImageService>();
    builder.Services.AddScoped<ImageManipulationDetectionService>();
    builder.Services.AddScoped<SightengineAiDetectionService>();
    builder.Services.AddScoped<PostModerationAiService>();
    Console.WriteLine("✅ SupabaseService registered");
}
catch (Exception ex)
{
    Console.Error.WriteLine($"❌ Error registering SupabaseService: {ex.Message}");
    throw;
}

// Add HttpClient for Supabase REST API calls with timeout
builder.Services.AddHttpClient("Supabase", client =>
{
    client.Timeout = TimeSpan.FromSeconds(10); // Timeout 10 วินาที
});

// CLIP embedding worker (self-hosted, no API cost)
builder.Services.AddHttpClient("ClipWorker", client =>
{
    client.Timeout = TimeSpan.FromSeconds(60);
});

// Sightengine AI-generated image detection API
builder.Services.AddHttpClient("Sightengine", client =>
{
    client.Timeout = TimeSpan.FromSeconds(12);
});

// Add CORS support
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// CRA dev server proxies to http://localhost:5000.
// Keep HTTP in Development to avoid 307 redirect to HTTPS that can break local API calls.
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();

// Add default route that redirects to Swagger in development
if (app.Environment.IsDevelopment())
{
    app.MapGet("/", () => Results.Redirect("/swagger")).ExcludeFromDescription();
}

app.MapControllers();

app.Run();


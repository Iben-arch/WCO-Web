using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using ServerApi.Services;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Get Supabase configuration
var supabaseUrl = builder.Configuration["Supabase:Url"];

// Register custom services
try
{
    builder.Services.AddScoped<SupabaseService>();
    Console.WriteLine("✅ SupabaseService registered");
}
catch (Exception ex)
{
    Console.Error.WriteLine($"❌ Error registering SupabaseService: {ex.Message}");
    throw;
}

builder.Services.AddScoped<CloudinaryService>();

// Add HttpClient for Supabase REST API calls with timeout
builder.Services.AddHttpClient()
    .ConfigureHttpClient(client =>
    {
        client.Timeout = TimeSpan.FromSeconds(10); // Timeout 10 วินาที
    });

// Add Supabase Authentication (JWT Bearer)
if (!string.IsNullOrEmpty(supabaseUrl))
{
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.Authority = $"{supabaseUrl}/auth/v1";
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = $"{supabaseUrl}/auth/v1",
                ValidateAudience = false, // Supabase doesn't use audience validation
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            };
        });
}

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

app.UseHttpsRedirection();
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


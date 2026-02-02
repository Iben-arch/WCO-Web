using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
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

// Get Supabase configuration
var supabaseUrl = builder.Configuration["Supabase:Url"];
var jwtSecret = builder.Configuration["Supabase:JwtSecret"];
var serviceRoleKey = builder.Configuration["Supabase:ServiceRoleKey"];

// ถ้าไม่มี JWT Secret ให้ลองใช้ ServiceRoleKey แทน (บาง Supabase projects ใช้ ServiceRoleKey เป็น JWT secret)
if (string.IsNullOrEmpty(jwtSecret) && !string.IsNullOrEmpty(serviceRoleKey))
{
    jwtSecret = serviceRoleKey;
    Console.WriteLine("⚠️ JWT Secret not found, using ServiceRoleKey as fallback");
}

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
builder.Services.AddHttpClient("Supabase", client =>
{
    client.Timeout = TimeSpan.FromSeconds(10); // Timeout 10 วินาที
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

app.UseHttpsRedirection();
app.UseCors("AllowAll");

// Add default route that redirects to Swagger in development
if (app.Environment.IsDevelopment())
{
    app.MapGet("/", () => Results.Redirect("/swagger")).ExcludeFromDescription();
}

app.MapControllers();

app.Run();


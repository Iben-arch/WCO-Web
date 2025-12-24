using Supabase;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Text.Json;
using System.Text;
using System.Net.Http.Headers;

namespace ServerApi.Services
{
    /// <summary>
    /// Service สำหรับเชื่อมต่อกับ Supabase Database
    /// </summary>
    public class SupabaseService
    {
        private readonly Supabase.Client _client;
        private readonly string _supabaseUrl;
        private readonly string _supabaseKey;
        private readonly HttpClient _httpClient;

        public SupabaseService(IConfiguration configuration, IHttpClientFactory httpClientFactory)
        {
            try
            {
                _supabaseUrl = configuration["Supabase:Url"] 
                    ?? throw new ArgumentNullException("Supabase:Url is required");
                _supabaseKey = configuration["Supabase:Key"] 
                    ?? throw new ArgumentNullException("Supabase:Key is required");

                var options = new SupabaseOptions
                {
                    AutoRefreshToken = true,
                    AutoConnectRealtime = false
                };

                _client = new Supabase.Client(_supabaseUrl, _supabaseKey, options);
                _httpClient = httpClientFactory.CreateClient();
                _httpClient.BaseAddress = new Uri(_supabaseUrl);
                
                Console.WriteLine($"✅ Supabase initialized for project: {_supabaseUrl}");
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"❌ CRITICAL: Failed to initialize Supabase: {ex.Message}");
                if (ex.InnerException != null)
                {
                    Console.Error.WriteLine($"Inner Exception: {ex.InnerException.Message}");
                }
                throw;
            }
        }

        /// <summary>
        /// สร้างข้อมูลใหม่ใน Supabase
        /// </summary>
        public async Task<string> CreateAsync(string table, Dictionary<string, object> data)
        {
            var url = $"/rest/v1/{table}";
            var json = JsonSerializer.Serialize(data);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var request = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = content
            };
            request.Headers.Add("apikey", _supabaseKey);
            request.Headers.Add("Authorization", $"Bearer {_supabaseKey}");
            request.Headers.Add("Prefer", "return=representation");

            var response = await _httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var responseContent = await response.Content.ReadAsStringAsync();
            var doc = JsonSerializer.Deserialize<JsonElement>(responseContent);

            // Handle array response (Supabase returns array)
            if (doc.ValueKind == JsonValueKind.Array && doc.GetArrayLength() > 0)
            {
                doc = doc[0];
            }

            if (doc.TryGetProperty("id", out var idProp))
            {
                return idProp.GetString() ?? Guid.NewGuid().ToString();
            }

            return Guid.NewGuid().ToString();
        }

        /// <summary>
        /// อัปเดตข้อมูลใน Supabase
        /// </summary>
        public async Task UpdateAsync(string table, string id, Dictionary<string, object> data)
        {
            var url = $"/rest/v1/{table}?id=eq.{id}";
            var json = JsonSerializer.Serialize(data);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var request = new HttpRequestMessage(HttpMethod.Patch, url)
            {
                Content = content
            };
            request.Headers.Add("apikey", _supabaseKey);
            request.Headers.Add("Authorization", $"Bearer {_supabaseKey}");
            request.Headers.Add("Prefer", "return=representation");

            var response = await _httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();
        }

        /// <summary>
        /// อ่านข้อมูลจาก Supabase
        /// </summary>
        public async Task<Dictionary<string, object>?> GetAsync(string table, string id)
        {
            var url = $"/rest/v1/{table}?id=eq.{id}&select=*";
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("apikey", _supabaseKey);
            request.Headers.Add("Authorization", $"Bearer {_supabaseKey}");
            
            var response = await _httpClient.SendAsync(request);
            
            if (!response.IsSuccessStatusCode)
                return null;

            var content = await response.Content.ReadAsStringAsync();
            var doc = JsonSerializer.Deserialize<JsonElement>(content);

            // Handle array response
            if (doc.ValueKind == JsonValueKind.Array)
            {
                if (doc.GetArrayLength() == 0)
                    return null;
                doc = doc[0];
            }

            var result = new Dictionary<string, object>();
            foreach (var prop in doc.EnumerateObject())
            {
                result[prop.Name] = ConvertJsonElement(prop.Value);
            }

            return result;
        }

        /// <summary>
        /// อ่านข้อมูลทั้งหมดจาก table
        /// </summary>
        public async Task<List<Dictionary<string, object>>> GetAllAsync(string table)
        {
            var url = $"/rest/v1/{table}?select=*";
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("apikey", _supabaseKey);
            request.Headers.Add("Authorization", $"Bearer {_supabaseKey}");
            
            var response = await _httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync();
            var doc = JsonSerializer.Deserialize<JsonElement>(content);

            var results = new List<Dictionary<string, object>>();
            
            if (doc.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in doc.EnumerateArray())
                {
                    var dict = new Dictionary<string, object>();
                    foreach (var prop in item.EnumerateObject())
                    {
                        dict[prop.Name] = ConvertJsonElement(prop.Value);
                    }
                    results.Add(dict);
                }
            }

            return results;
        }

        /// <summary>
        /// ลบข้อมูลจาก Supabase
        /// </summary>
        public async Task DeleteAsync(string table, string id)
        {
            var url = $"/rest/v1/{table}?id=eq.{id}";
            var request = new HttpRequestMessage(HttpMethod.Delete, url);
            request.Headers.Add("apikey", _supabaseKey);
            request.Headers.Add("Authorization", $"Bearer {_supabaseKey}");
            
            var response = await _httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();
        }

        /// <summary>
        /// ค้นหาข้อมูลด้วยเงื่อนไข
        /// </summary>
        public async Task<List<Dictionary<string, object>>> QueryAsync(
            string table, 
            string field, 
            object value)
        {
            var url = $"/rest/v1/{table}?{field}=eq.{Uri.EscapeDataString(value.ToString() ?? "")}&select=*";
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("apikey", _supabaseKey);
            request.Headers.Add("Authorization", $"Bearer {_supabaseKey}");
            
            var response = await _httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync();
            var doc = JsonSerializer.Deserialize<JsonElement>(content);

            var results = new List<Dictionary<string, object>>();
            
            if (doc.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in doc.EnumerateArray())
                {
                    var dict = new Dictionary<string, object>();
                    foreach (var prop in item.EnumerateObject())
                    {
                        dict[prop.Name] = ConvertJsonElement(prop.Value);
                    }
                    results.Add(dict);
                }
            }

            return results;
        }

        /// <summary>
        /// Convert JsonElement to appropriate C# type
        /// </summary>
        private object ConvertJsonElement(JsonElement element)
        {
            switch (element.ValueKind)
            {
                case JsonValueKind.String:
                    return element.GetString() ?? "";
                case JsonValueKind.Number:
                    if (element.TryGetInt32(out var intVal))
                        return intVal;
                    if (element.TryGetInt64(out var longVal))
                        return longVal;
                    return element.GetDouble();
                case JsonValueKind.True:
                    return true;
                case JsonValueKind.False:
                    return false;
                case JsonValueKind.Null:
                    return null!;
                case JsonValueKind.Array:
                    var list = new List<object>();
                    foreach (var item in element.EnumerateArray())
                    {
                        list.Add(ConvertJsonElement(item));
                    }
                    return list;
                case JsonValueKind.Object:
                    var dict = new Dictionary<string, object>();
                    foreach (var prop in element.EnumerateObject())
                    {
                        dict[prop.Name] = ConvertJsonElement(prop.Value);
                    }
                    return dict;
                default:
                    return element.ToString();
            }
        }

        /// <summary>
        /// Get Supabase client สำหรับใช้งานโดยตรง
        /// </summary>
        public Supabase.Client GetClient()
        {
            return _client;
        }
    }
}


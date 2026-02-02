using Supabase;
using System.Collections.Generic;
using System.Linq;
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
        private readonly string? _serviceRoleKey;
        private readonly HttpClient _httpClient;

        public SupabaseService(IConfiguration configuration, IHttpClientFactory httpClientFactory)
        {
            try
            {
                _supabaseUrl = configuration["Supabase:Url"] 
                    ?? throw new ArgumentNullException("Supabase:Url is required");
                _supabaseKey = configuration["Supabase:Key"] 
                    ?? throw new ArgumentNullException("Supabase:Key is required");
                _serviceRoleKey = configuration["Supabase:ServiceRoleKey"];

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
        /// ใช้ lowercase field names ตาม schema จริงใน Supabase
        /// </summary>
        public async Task<string> CreateAsync(string table, Dictionary<string, object> data, bool useServiceRole = false)
        {
            // Schema ใน Supabase ใช้ lowercase field names (displayname, accountname, isactive)
            // ไม่ต้องแปลง field names - ใช้ lowercase ตรงๆ
            
            // ใช้ REST API
            var url = $"/rest/v1/{table}";
            
            // ใช้ JsonSerializerOptions เพื่อไม่ให้แปลง field names
            var jsonOptions = new JsonSerializerOptions
            {
                PropertyNamingPolicy = null, // ไม่แปลง field names
                DictionaryKeyPolicy = null   // ไม่แปลง dictionary keys
            };
            
            var jsonContent = JsonSerializer.Serialize(data, jsonOptions);
            
            // Log JSON ที่ส่งไป Supabase
            Console.WriteLine($"📤 Sending to Supabase ({table}):");
            Console.WriteLine($"   URL: {url}");
            Console.WriteLine($"   JSON: {jsonContent}");
            Console.WriteLine($"   Field names: {string.Join(", ", data.Keys)}");
            
            var stringContent = new StringContent(jsonContent, Encoding.UTF8, "application/json");

            // ใช้ service role key ถ้ามีและต้องการใช้ (เพื่อหลีกเลี่ยง RLS)
            var keyToUse = (useServiceRole && !string.IsNullOrEmpty(_serviceRoleKey)) ? _serviceRoleKey : _supabaseKey;

            var request = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = stringContent
            };
            request.Headers.Add("apikey", keyToUse);
            request.Headers.Add("Authorization", $"Bearer {keyToUse}");
            request.Headers.Add("Prefer", "return=representation");

            var response = await _httpClient.SendAsync(request);
            
            // Handle error response with detailed message
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                var errorMessage = $"Failed to create record in {table}. Status: {response.StatusCode}";
                var errorDetails = new List<string>();
                
                try
                {
                    var errorDoc = JsonSerializer.Deserialize<JsonElement>(errorContent);
                    
                    // Try to get detailed error message
                    if (errorDoc.TryGetProperty("message", out var msgProp))
                    {
                        var msg = msgProp.GetString() ?? "";
                        errorDetails.Add($"message: {msg}");
                        if (!string.IsNullOrEmpty(msg))
                            errorMessage = msg;
                    }
                    
                    if (errorDoc.TryGetProperty("error", out var errProp))
                    {
                        var err = errProp.GetString() ?? "";
                        errorDetails.Add($"error: {err}");
                        if (string.IsNullOrEmpty(errorMessage) || errorMessage.Contains("Failed to create"))
                            errorMessage = err;
                    }
                    
                    if (errorDoc.TryGetProperty("hint", out var hintProp))
                    {
                        var hint = hintProp.GetString() ?? "";
                        errorDetails.Add($"hint: {hint}");
                    }
                    
                    if (errorDoc.TryGetProperty("details", out var detailsProp))
                    {
                        var details = detailsProp.GetString() ?? "";
                        errorDetails.Add($"details: {details}");
                    }
                    
                    // Parse error_code and msg from Supabase
                    if (errorDoc.TryGetProperty("error_code", out var errorCodeProp))
                    {
                        var errorCode = errorCodeProp.GetString() ?? "";
                        errorDetails.Add($"error_code: {errorCode}");
                        
                        if (errorCode == "email_exists")
                        {
                            errorMessage = "อีเมลนี้ถูกใช้งานแล้ว";
                        }
                    }
                    
                    if (errorDoc.TryGetProperty("msg", out var msgProp))
                    {
                        var msg = msgProp.GetString() ?? "";
                        errorDetails.Add($"msg: {msg}");
                        
                        if (string.IsNullOrEmpty(errorMessage) || errorMessage.Contains("Failed to create"))
                        {
                            if (msg.Contains("already been registered") || msg.Contains("email address has already"))
                            {
                                errorMessage = "อีเมลนี้ถูกใช้งานแล้ว";
                            }
                            else
                            {
                                errorMessage = msg;
                            }
                        }
                    }
                    
                    // Log full error for debugging
                    Console.Error.WriteLine($"❌ Supabase CreateAsync Error ({response.StatusCode}):");
                    Console.Error.WriteLine($"   Table: {table}");
                    Console.Error.WriteLine($"   Error Content: {errorContent}");
                    if (errorDetails.Any())
                    {
                        Console.Error.WriteLine($"   Details: {string.Join(", ", errorDetails)}");
                    }
                }
                catch (Exception parseEx)
                {
                    // If parsing fails, use raw error content
                    Console.Error.WriteLine($"❌ Failed to parse Supabase error: {parseEx.Message}");
                    if (!string.IsNullOrEmpty(errorContent))
                    {
                        errorMessage = $"{errorMessage}. Response: {errorContent}";
                        Console.Error.WriteLine($"   Raw Response: {errorContent}");
                    }
                }
                
                // Include full error details in exception message for better debugging
                var fullErrorMessage = errorMessage;
                if (errorDetails.Any())
                {
                    fullErrorMessage = $"{errorMessage} | Details: {string.Join(", ", errorDetails)}";
                }
                
                throw new HttpRequestException($"{fullErrorMessage} (Status: {response.StatusCode})");
            }

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
        public async Task UpdateAsync(string table, string id, Dictionary<string, object> data, string? idField = null, bool useServiceRole = false)
        {
            // ใช้ idField ที่ระบุ หรือใช้ "uid" สำหรับ users table, "id" สำหรับ table อื่นๆ
            var fieldName = idField ?? (table == "users" ? "uid" : "id");
            var url = $"/rest/v1/{table}?{fieldName}=eq.{Uri.EscapeDataString(id)}";
            
            // ใช้ JsonSerializerOptions เพื่อไม่ให้แปลง field names
            var jsonOptions = new JsonSerializerOptions
            {
                PropertyNamingPolicy = null,
                DictionaryKeyPolicy = null
            };
            var json = JsonSerializer.Serialize(data, jsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            // ใช้ service role key ถ้าต้องการ (เพื่อหลีกเลี่ยง RLS)
            var keyToUse = (useServiceRole && !string.IsNullOrEmpty(_serviceRoleKey)) ? _serviceRoleKey : _supabaseKey;

            var request = new HttpRequestMessage(HttpMethod.Patch, url)
            {
                Content = content
            };
            request.Headers.Add("apikey", keyToUse);
            request.Headers.Add("Authorization", $"Bearer {keyToUse}");
            request.Headers.Add("Prefer", "return=representation");

            var response = await _httpClient.SendAsync(request);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                Console.Error.WriteLine($"❌ Failed to update record in {table}. Status: {response.StatusCode}, Error: {errorContent}");
                throw new HttpRequestException($"Failed to update record in {table}. Status: {response.StatusCode}, Error: {errorContent}");
            }
        }

        /// <summary>
        /// อ่านข้อมูลจาก Supabase
        /// </summary>
        public async Task<Dictionary<string, object>?> GetAsync(string table, string id, bool useServiceRole = false, string? idField = null)
        {
            // ใช้ idField ที่ระบุ หรือใช้ "uid" สำหรับ users table, "id" สำหรับ table อื่นๆ
            var fieldName = idField ?? (table == "users" ? "uid" : "id");
            var url = $"/rest/v1/{table}?{fieldName}=eq.{id}&select=*";
            
            // ใช้ service role key ถ้าต้องการ (เพื่อหลีกเลี่ยง RLS)
            var keyToUse = (useServiceRole && !string.IsNullOrEmpty(_serviceRoleKey)) ? _serviceRoleKey : _supabaseKey;
            
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("apikey", keyToUse);
            request.Headers.Add("Authorization", $"Bearer {keyToUse}");
            
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
            object value,
            bool useServiceRole = false)
        {
            var url = $"/rest/v1/{table}?{field}=eq.{Uri.EscapeDataString(value.ToString() ?? "")}&select=*";
            
            // ใช้ service role key ถ้าต้องการ (เพื่อหลีกเลี่ยง RLS)
            var keyToUse = (useServiceRole && !string.IsNullOrEmpty(_serviceRoleKey)) ? _serviceRoleKey : _supabaseKey;
            
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("apikey", keyToUse);
            request.Headers.Add("Authorization", $"Bearer {keyToUse}");
            
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



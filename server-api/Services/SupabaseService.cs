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
                    
                    if (errorDoc.TryGetProperty("msg", out var msgProperty))
                    {
                        var msg = msgProperty.GetString() ?? "";
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
        /// Bulk insert หลายแถวในตาราง (POST body เป็น JSON array)
        /// </summary>
        public async Task InsertManyAsync(string table, List<Dictionary<string, object>> rows, bool useServiceRole = true)
        {
            if (rows == null || rows.Count == 0) return;

            var keyToUse = (useServiceRole && !string.IsNullOrEmpty(_serviceRoleKey)) ? _serviceRoleKey : _supabaseKey;
            var url = $"/rest/v1/{table}";
            var jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = null, DictionaryKeyPolicy = null };
            var json = JsonSerializer.Serialize(rows, jsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = content };
            request.Headers.Add("apikey", keyToUse);
            request.Headers.Add("Authorization", $"Bearer {keyToUse}");
            request.Headers.Add("Prefer", "return=minimal");

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                var err = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException($"InsertMany {table} failed: {response.StatusCode} - {err}");
            }
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
        /// ดึง posts พร้อม filter, sort, pagination ใน database (แก้ปัญหา GetAllAsync ที่โหลดทั้งหมด)
        /// </summary>
        public async Task<(List<Dictionary<string, object>> posts, int total)> GetPostsFilteredAsync(
            string? category,
            string? search,
            string? sortBy,
            int page,
            int limit,
            string? postType,
            string? status,
            bool useServiceRole = false,
            bool searchIncludesSellerName = false,
            DateTime? createdAtFromUtc = null)
        {
            var keyToUse = (useServiceRole && !string.IsNullOrEmpty(_serviceRoleKey)) ? _serviceRoleKey : _supabaseKey;
            var queryParams = new List<string> { "select=*" };

            // Filter: category
            if (!string.IsNullOrEmpty(category))
                queryParams.Add($"category=eq.{Uri.EscapeDataString(category)}");

            // Filter: postType
            if (!string.IsNullOrEmpty(postType))
                queryParams.Add($"postType=eq.{Uri.EscapeDataString(postType)}");

            // Filter: status
            if (!string.IsNullOrEmpty(status))
                queryParams.Add($"status=eq.{Uri.EscapeDataString(status)}");

            // ไม่แสดงโพสต์ประมูลที่หลุด (auction_released) ในรายการหลัก
            queryParams.Add("or=(postType.neq.auction,auctionStatus.neq.auction_released,auctionStatus.is.null)");

            // Filter: search (title or description contains - ใช้ % สำหรับ SQL LIKE wildcard)
            if (!string.IsNullOrEmpty(search))
            {
                var term = Uri.EscapeDataString($"%{search}%");
                if (searchIncludesSellerName)
                {
                    queryParams.Add($"or=(title.ilike.{term},description.ilike.{term},sellerName.ilike.{term})");
                }
                else
                {
                    queryParams.Add($"or=(title.ilike.{term},description.ilike.{term})");
                }
            }

            if (createdAtFromUtc.HasValue)
            {
                // ใช้ ISO-8601 เพื่อให้ Supabase/PostgREST แปลค่า timestamp ได้ชัดเจน
                queryParams.Add($"createdAt=gte.{Uri.EscapeDataString(createdAtFromUtc.Value.ToString("o"))}");
            }

            // Order (price column มีใน posts table)
            var orderCol = sortBy?.ToLower() switch
            {
                "priceasc" => "price.asc",
                "pricedesc" => "price.desc",
                _ => "createdAt.desc"
            };
            queryParams.Add($"order={orderCol}");

            // Pagination - ใช้ limit+offset สำหรับ page
            var offset = (page - 1) * limit;
            queryParams.Add($"limit={limit}");
            queryParams.Add($"offset={offset}");

            var url = $"/rest/v1/posts?{string.Join("&", queryParams)}";

            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("apikey", keyToUse);
            request.Headers.Add("Authorization", $"Bearer {keyToUse}");
            request.Headers.Add("Prefer", "count=exact"); // เพื่อได้ total count

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
                return (new List<Dictionary<string, object>>(), 0);

            var total = ParseContentRangeTotal(response);

            var content = await response.Content.ReadAsStringAsync();
            var doc = JsonSerializer.Deserialize<JsonElement>(content);

            var results = new List<Dictionary<string, object>>();
            if (doc.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in doc.EnumerateArray())
                {
                    var dict = new Dictionary<string, object>();
                    foreach (var prop in item.EnumerateObject())
                        dict[prop.Name] = ConvertJsonElement(prop.Value);
                    results.Add(dict);
                }
            }

            return (results, total);
        }

        /// <summary>
        /// ดึงเฉพาะ post IDs พร้อม filter/sort/pagination (เพื่อคำนวณสถิติ เช่น embedding coverage)
        /// </summary>
        public async Task<(List<string> postIds, int total)> GetPostIdsFilteredAsync(
            string? category,
            string? search,
            string? sortBy,
            int page,
            int limit,
            string? postType,
            string? status,
            bool useServiceRole = false,
            bool searchIncludesSellerName = false,
            DateTime? createdAtFromUtc = null)
        {
            var keyToUse = (useServiceRole && !string.IsNullOrEmpty(_serviceRoleKey)) ? _serviceRoleKey : _supabaseKey;
            var queryParams = new List<string> { "select=id" };

            // Filter: category
            if (!string.IsNullOrEmpty(category))
                queryParams.Add($"category=eq.{Uri.EscapeDataString(category)}");

            // Filter: postType
            if (!string.IsNullOrEmpty(postType))
                queryParams.Add($"postType=eq.{Uri.EscapeDataString(postType)}");

            // Filter: status
            if (!string.IsNullOrEmpty(status))
                queryParams.Add($"status=eq.{Uri.EscapeDataString(status)}");

            // ไม่แสดงโพสต์ประมูลที่หลุด (auction_released) ในรายการหลัก
            queryParams.Add("or=(postType.neq.auction,auctionStatus.neq.auction_released,auctionStatus.is.null)");

            // Filter: search
            if (!string.IsNullOrEmpty(search))
            {
                var term = Uri.EscapeDataString($"%{search}%");
                if (searchIncludesSellerName)
                {
                    queryParams.Add($"or=(title.ilike.{term},description.ilike.{term},sellerName.ilike.{term})");
                }
                else
                {
                    queryParams.Add($"or=(title.ilike.{term},description.ilike.{term})");
                }
            }

            if (createdAtFromUtc.HasValue)
            {
                queryParams.Add($"createdAt=gte.{Uri.EscapeDataString(createdAtFromUtc.Value.ToString("o"))}");
            }

            // Order
            var orderCol = sortBy?.ToLower() switch
            {
                "priceasc" => "price.asc",
                "pricedesc" => "price.desc",
                _ => "createdAt.desc"
            };
            queryParams.Add($"order={orderCol}");

            // Pagination
            var offset = (page - 1) * limit;
            queryParams.Add($"limit={limit}");
            queryParams.Add($"offset={offset}");

            var url = $"/rest/v1/posts?{string.Join("&", queryParams)}";
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("apikey", keyToUse);
            request.Headers.Add("Authorization", $"Bearer {keyToUse}");
            request.Headers.Add("Prefer", "count=exact");

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
                return (new List<string>(), 0);

            var total = ParseContentRangeTotal(response);

            var content = await response.Content.ReadAsStringAsync();
            var doc = JsonSerializer.Deserialize<JsonElement>(content);

            var results = new List<string>();
            if (doc.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in doc.EnumerateArray())
                {
                    if (item.TryGetProperty("id", out var idProp))
                    {
                        var id = idProp.GetString();
                        if (!string.IsNullOrWhiteSpace(id))
                            results.Add(id);
                    }
                }
            }

            return (results, total);
        }

        /// <summary>
        /// ดึง profiles พร้อม filter/search/pagination (ใช้สำหรับ admin)
        /// </summary>
        public async Task<(List<Dictionary<string, object>> users, int total)> GetProfilesFilteredAsync(
            string? search,
            bool? isBanned,
            int page,
            int limit,
            bool useServiceRole = false)
        {
            var keyToUse = (useServiceRole && !string.IsNullOrEmpty(_serviceRoleKey)) ? _serviceRoleKey : _supabaseKey;
            var queryParams = new List<string> { "select=*" };

            if (!string.IsNullOrEmpty(search))
            {
                var term = Uri.EscapeDataString($"%{search}%");
                queryParams.Add($"username.ilike={term}");
            }

            if (isBanned.HasValue)
            {
                queryParams.Add($"is_banned=eq.{(isBanned.Value ? "true" : "false")}");
            }

            queryParams.Add("order=created_at.desc");

            var offset = (page - 1) * limit;
            queryParams.Add($"limit={limit}");
            queryParams.Add($"offset={offset}");

            var url = $"/rest/v1/profiles?{string.Join("&", queryParams)}";
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("apikey", keyToUse);
            request.Headers.Add("Authorization", $"Bearer {keyToUse}");
            request.Headers.Add("Prefer", "count=exact");

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
                return (new List<Dictionary<string, object>>(), 0);

            var total = ParseContentRangeTotal(response);

            var content = await response.Content.ReadAsStringAsync();
            var doc = JsonSerializer.Deserialize<JsonElement>(content);

            var results = new List<Dictionary<string, object>>();
            if (doc.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in doc.EnumerateArray())
                {
                    var dict = new Dictionary<string, object>();
                    foreach (var prop in item.EnumerateObject())
                        dict[prop.Name] = ConvertJsonElement(prop.Value);
                    results.Add(dict);
                }
            }

            return (results, total);
        }

        /// <summary>
        /// Query แบบ in.(...) เพื่อใช้ในงาน admin/statistics
        /// </summary>
        public async Task<List<Dictionary<string, object>>> QueryInAsync(
            string table,
            string field,
            List<string> values,
            string? select = null,
            bool useServiceRole = false)
        {
            if (values == null || values.Count == 0)
                return new List<Dictionary<string, object>>();

            var keyToUse = (useServiceRole && !string.IsNullOrEmpty(_serviceRoleKey)) ? _serviceRoleKey : _supabaseKey;

            var cleaned = values
                .Where(v => !string.IsNullOrWhiteSpace(v))
                .Select(v => v.Trim())
                .Distinct()
                .ToList();

            if (cleaned.Count == 0)
                return new List<Dictionary<string, object>>();

            var inValues = string.Join(",", cleaned.Select(v => Uri.EscapeDataString(v)));
            var selectParam = string.IsNullOrWhiteSpace(select) ? "select=*" : $"select={select}";

            var url = $"/rest/v1/{table}?{field}=in.({inValues})&{selectParam}";
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("apikey", keyToUse);
            request.Headers.Add("Authorization", $"Bearer {keyToUse}");

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
                return new List<Dictionary<string, object>>();

            var content = await response.Content.ReadAsStringAsync();
            var doc = JsonSerializer.Deserialize<JsonElement>(content);

            var results = new List<Dictionary<string, object>>();
            if (doc.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in doc.EnumerateArray())
                {
                    var dict = new Dictionary<string, object>();
                    foreach (var prop in item.EnumerateObject())
                        dict[prop.Name] = ConvertJsonElement(prop.Value);
                    results.Add(dict);
                }
            }

            return results;
        }

        /// <summary>
        /// อ่านข้อมูลทั้งหมดจาก table
        /// </summary>
        public async Task<List<Dictionary<string, object>>> GetAllAsync(string table, bool useServiceRole = false)
        {
            var keyToUse = (useServiceRole && !string.IsNullOrEmpty(_serviceRoleKey)) ? _serviceRoleKey : _supabaseKey;
            var url = $"/rest/v1/{table}?select=*";
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
        /// ลบข้อมูลจาก Supabase
        /// </summary>
        public async Task DeleteAsync(string table, string id, string? idField = null, bool useServiceRole = false)
        {
            var fieldName = idField ?? (table == "users" ? "uid" : "id");
            var url = $"/rest/v1/{table}?{fieldName}=eq.{Uri.EscapeDataString(id)}";
            var keyToUse = (useServiceRole && !string.IsNullOrEmpty(_serviceRoleKey)) ? _serviceRoleKey : _supabaseKey;
            var request = new HttpRequestMessage(HttpMethod.Delete, url);
            request.Headers.Add("apikey", keyToUse);
            request.Headers.Add("Authorization", $"Bearer {keyToUse}");

            var response = await _httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();
        }

        /// <summary>
        /// ลบแถวที่ field มีค่าเท่ากับ value (ใช้สำหรับลบ embeddings ตาม postId ก่อน backfill)
        /// </summary>
        public async Task DeleteByFieldAsync(string table, string fieldName, string value, bool useServiceRole = true)
        {
            var url = $"/rest/v1/{table}?{Uri.EscapeDataString(fieldName)}=eq.{Uri.EscapeDataString(value)}";
            var keyToUse = (useServiceRole && !string.IsNullOrEmpty(_serviceRoleKey)) ? _serviceRoleKey : _supabaseKey;
            var request = new HttpRequestMessage(HttpMethod.Delete, url);
            request.Headers.Add("apikey", keyToUse);
            request.Headers.Add("Authorization", $"Bearer {keyToUse}");
            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                var err = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException($"DeleteByField {table} failed: {response.StatusCode} - {err}");
            }
        }

        /// <summary>
        /// ค้นหา likes ของ user สำหรับหลาย postIds (batch query - แก้ N+1)
        /// </summary>
        public async Task<List<string>> QueryLikedPostIdsAsync(string userId, List<string> postIds, bool useServiceRole = false)
        {
            if (postIds == null || postIds.Count == 0)
                return new List<string>();

            // Supabase PostgREST: ?userId=eq.X&postId=in.(id1,id2,id3)&select=postId
            var postIdsParam = string.Join(",", postIds.Select(id => id.Trim()));
            var url = $"/rest/v1/likes?userId=eq.{Uri.EscapeDataString(userId)}&postId=in.({postIdsParam})&select=postId";
            
            var keyToUse = (useServiceRole && !string.IsNullOrEmpty(_serviceRoleKey)) ? _serviceRoleKey : _supabaseKey;
            
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("apikey", keyToUse);
            request.Headers.Add("Authorization", $"Bearer {keyToUse}");
            
            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
                return new List<string>();

            var content = await response.Content.ReadAsStringAsync();
            var doc = JsonSerializer.Deserialize<JsonElement>(content);
            
            var result = new List<string>();
            if (doc.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in doc.EnumerateArray())
                {
                    if (item.TryGetProperty("postId", out var postIdProp))
                    {
                        var postId = postIdProp.GetString();
                        if (!string.IsNullOrEmpty(postId))
                            result.Add(postId);
                    }
                }
            }
            return result;
        }

        /// <summary>
        /// เพิ่ม like (insert into likes table)
        /// </summary>
        public async Task<bool> AddLikeAsync(string userId, string postId, bool useServiceRole = false)
        {
            try
            {
                var data = new Dictionary<string, object>
                {
                    ["postId"] = postId,
                    ["userId"] = userId
                };
                await CreateAsync("likes", data, useServiceRole);
                return true;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// ลบ like (delete from likes table)
        /// </summary>
        public async Task<bool> RemoveLikeAsync(string userId, string postId, bool useServiceRole = false)
        {
            try
            {
                var keyToUse = (useServiceRole && !string.IsNullOrEmpty(_serviceRoleKey)) ? _serviceRoleKey : _supabaseKey;
                var url = $"/rest/v1/likes?userId=eq.{Uri.EscapeDataString(userId)}&postId=eq.{Uri.EscapeDataString(postId)}";
                var request = new HttpRequestMessage(HttpMethod.Delete, url);
                request.Headers.Add("apikey", keyToUse);
                request.Headers.Add("Authorization", $"Bearer {keyToUse}");
                var response = await _httpClient.SendAsync(request);
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
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
        /// PostgREST ส่ง Prefer: count=exact เป็น header Content-Range: start-end/total
        /// ใน .NET HttpClient header นี้อยู่ที่ <see cref="HttpContent.Headers"/> ไม่ใช่ <see cref="HttpResponseMessage.Headers"/>
        /// </summary>
        private static int ParseContentRangeTotal(HttpResponseMessage response)
        {
            string? header = null;
            if (response.Content?.Headers.TryGetValues("Content-Range", out var fromContent) == true)
                header = fromContent.FirstOrDefault();
            else if (response.Headers.TryGetValues("Content-Range", out var fromResponse))
                header = fromResponse.FirstOrDefault();

            if (string.IsNullOrWhiteSpace(header))
                return 0;

            var parts = header.Split('/');
            if (parts.Length < 2)
                return 0;

            var totalPart = parts[^1].Trim();
            return int.TryParse(totalPart, out var t) ? t : 0;
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
        /// ดึง email ของ auth.users โดยใช้ GoTrue Admin API
        /// (ใช้แทนการ query ผ่าน PostgREST ที่อาจเข้าถึงไม่ได้ในบาง config)
        /// </summary>
        public async Task<Dictionary<string, string?>> GetAuthUserEmailsByIdsAsync(IEnumerable<string> userIds)
        {
            var ids = userIds
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Select(id => id.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var result = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
            if (ids.Count == 0) return result;

            if (string.IsNullOrEmpty(_serviceRoleKey))
                return result; // ไม่มี service role key = ไม่มีสิทธิ์ดึง email

            foreach (var id in ids)
            {
                try
                {
                    string? email = null;
                    
                    // Call GoTrue Admin REST directly:
                    // GET {SUPABASE_URL}/auth/v1/admin/users/{id}
                    var url = $"/auth/v1/admin/users/{Uri.EscapeDataString(id)}";
                    var request = new HttpRequestMessage(HttpMethod.Get, url);
                    request.Headers.Add("apikey", _serviceRoleKey!);
                    request.Headers.Add("Authorization", $"Bearer {_serviceRoleKey!}");

                    var response = await _httpClient.SendAsync(request);
                    var body = await response.Content.ReadAsStringAsync();

                    if (!response.IsSuccessStatusCode)
                    {
                        Console.Error.WriteLine($"[AdminEmailLookup] GoTrue admin failed for id={id}: {(int)response.StatusCode} {response.StatusCode} {body}");
                        result[id] = null;
                        continue;
                    }

                    using var doc = JsonDocument.Parse(body);
                    if (doc.RootElement.ValueKind == JsonValueKind.Object &&
                        doc.RootElement.TryGetProperty("email", out var emailProp))
                    {
                        email = emailProp.GetString();
                    }

                    result[id] = email;
                }
                catch (Exception ex)
                {
                    // ถ้าดึงไม่ได้ ให้คืนค่า null (และให้ caller ใช้ fallback)
                    Console.Error.WriteLine($"[AdminEmailLookup] GoTrue admin request failed for id={id}: {ex}");
                    result[id] = null;
                }
            }

            return result;
        }

        /// <summary>
        /// ลบไฟล์จาก Supabase Storage
        /// </summary>
        public async Task DeleteStorageObjectsAsync(string bucketName, List<string> paths)
        {
            if (paths == null || paths.Count == 0) return;

            var keyToUse = !string.IsNullOrEmpty(_serviceRoleKey) ? _serviceRoleKey : _supabaseKey;

            foreach (var path in paths)
            {
                var url = $"/storage/v1/object/{bucketName}/{path}";
                var request = new HttpRequestMessage(HttpMethod.Delete, url);
                request.Headers.Add("apikey", keyToUse);
                request.Headers.Add("Authorization", $"Bearer {keyToUse}");

                var response = await _httpClient.SendAsync(request);
                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    Console.WriteLine($"⚠️ Failed to delete storage object {path}: {response.StatusCode} - {errorContent}");
                }
            }
        }

        /// <summary>
        /// Get Supabase client สำหรับใช้งานโดยตรง
        /// </summary>
        public Supabase.Client GetClient()
        {
            return _client;
        }

        /// <summary>
        /// เรียก Supabase RPC function (e.g. match_posts_by_embedding)
        /// POST /rest/v1/rpc/{functionName} with JSON body = parameters
        /// </summary>
        public async Task<List<Dictionary<string, object>>> RpcAsync(
            string functionName,
            Dictionary<string, object> parameters,
            bool useServiceRole = true)
        {
            var keyToUse = (useServiceRole && !string.IsNullOrEmpty(_serviceRoleKey)) ? _serviceRoleKey : _supabaseKey;
            var url = $"/rest/v1/rpc/{Uri.EscapeDataString(functionName)}";

            var jsonOptions = new JsonSerializerOptions
            {
                PropertyNamingPolicy = null,
                DictionaryKeyPolicy = null
            };
            var json = JsonSerializer.Serialize(parameters, jsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = content };
            request.Headers.Add("apikey", keyToUse);
            request.Headers.Add("Authorization", $"Bearer {keyToUse}");

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                var err = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException($"RPC {functionName} failed: {response.StatusCode} - {err}");
            }

            var responseContent = await response.Content.ReadAsStringAsync();
            var doc = JsonSerializer.Deserialize<JsonElement>(responseContent);
            var results = new List<Dictionary<string, object>>();
            if (doc.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in doc.EnumerateArray())
                {
                    var dict = new Dictionary<string, object>();
                    foreach (var prop in item.EnumerateObject())
                        dict[prop.Name] = ConvertJsonElement(prop.Value);
                    results.Add(dict);
                }
            }
            return results;
        }

        /// <summary>
        /// เรียก Supabase Auth API เพื่อ sign in ด้วย email/password และรับ session tokens
        /// </summary>
        public async Task<SupabaseSession> SignInWithPasswordAsync(string email, string password)
        {
            var url = "/auth/v1/token?grant_type=password";
            var body = new { email, password };
            var jsonContent = JsonSerializer.Serialize(body);
            var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

            var request = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = content
            };
            request.Headers.Add("apikey", _supabaseKey);
            request.Headers.Add("Authorization", $"Bearer {_supabaseKey}");

            var response = await _httpClient.SendAsync(request);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                string? errorMsg = null;
                try
                {
                    using var doc = JsonDocument.Parse(responseBody);
                    if (doc.RootElement.TryGetProperty("error_description", out var desc))
                        errorMsg = desc.GetString();
                    else if (doc.RootElement.TryGetProperty("msg", out var msg))
                        errorMsg = msg.GetString();
                    else if (doc.RootElement.TryGetProperty("error", out var err))
                        errorMsg = err.GetString();
                }
                catch { }

                throw new InvalidOperationException(errorMsg ?? "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
            }

            using var respDoc = JsonDocument.Parse(responseBody);
            var root = respDoc.RootElement;

            var session = new SupabaseSession
            {
                AccessToken = root.TryGetProperty("access_token", out var at) ? at.GetString() ?? "" : "",
                RefreshToken = root.TryGetProperty("refresh_token", out var rt) ? rt.GetString() ?? "" : "",
                ExpiresIn = root.TryGetProperty("expires_in", out var ei) ? ei.GetInt32() : 3600,
                TokenType = root.TryGetProperty("token_type", out var tt) ? tt.GetString() ?? "bearer" : "bearer"
            };

            if (root.TryGetProperty("user", out var userProp) && userProp.ValueKind == JsonValueKind.Object)
            {
                session.User = new Dictionary<string, object?>();
                foreach (var prop in userProp.EnumerateObject())
                    session.User[prop.Name] = ConvertJsonElement(prop.Value);
            }

            return session;
        }
    }

    public class SupabaseSession
    {
        public string AccessToken { get; set; } = string.Empty;
        public string RefreshToken { get; set; } = string.Empty;
        public int ExpiresIn { get; set; } = 3600;
        public string TokenType { get; set; } = "bearer";
        public Dictionary<string, object?>? User { get; set; }
    }
}



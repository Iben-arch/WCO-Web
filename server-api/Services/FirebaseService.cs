using Google.Cloud.Firestore;
using Google.Apis.Auth.OAuth2;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Text.Json;

namespace ServerApi.Services
{
    /// <summary>
    /// Service สำหรับเชื่อมต่อกับ Firebase Firestore
    /// </summary>
    public class FirebaseService
    {
        private readonly FirestoreDb _db;

        public FirebaseService(IConfiguration configuration)
        {
            try
            {
                var projectId = configuration["Firebase:ProjectId"] 
                    ?? throw new ArgumentNullException("Firebase:ProjectId is required");
                
                // Try to initialize with explicit credentials or service account file
                GoogleCredential? credential = null;
                
                // Method 1: Check for service account JSON file path
                var credentialsPath = configuration["Firebase:CredentialsPath"] 
                    ?? Environment.GetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS");
                
                if (!string.IsNullOrEmpty(credentialsPath))
                {
                    // Handle relative paths (relative to application root or project directory)
                    if (!Path.IsPathRooted(credentialsPath))
                    {
                        // Try multiple possible base directories
                        var possibleBases = new[]
                        {
                            AppContext.BaseDirectory, // bin/Debug/net8.0 or bin/Release/net8.0
                            Directory.GetCurrentDirectory(), // Current working directory
                            Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location) ?? "",
                            Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "..") // Go up from bin/Debug to project root
                        };
                        
                        string? resolvedPath = null;
                        foreach (var baseDir in possibleBases)
                        {
                            if (!string.IsNullOrEmpty(baseDir) && Directory.Exists(baseDir))
                            {
                                var testPath = Path.Combine(baseDir, credentialsPath);
                                if (File.Exists(testPath))
                                {
                                    resolvedPath = testPath;
                                    break;
                                }
                            }
                        }
                        
                        if (resolvedPath != null)
                        {
                            credentialsPath = resolvedPath;
                        }
                        else
                        {
                            // If not found, try with current directory as fallback
                            credentialsPath = Path.Combine(Directory.GetCurrentDirectory(), credentialsPath);
                        }
                    }
                    
                    if (File.Exists(credentialsPath))
                    {
                        credential = GoogleCredential.FromFile(credentialsPath);
                        Console.WriteLine($"✅ Firebase credentials loaded from: {credentialsPath}");
                    }
                    else
                    {
                        throw new FileNotFoundException(
                            $"Firebase credentials file not found at: {credentialsPath}\n" +
                            $"Current directory: {Directory.GetCurrentDirectory()}\n" +
                            $"Base directory: {AppContext.BaseDirectory}\n" +
                            "Please ensure the file exists or update the path in appsettings.json");
                    }
                }
                // Method 2: Check for explicit credentials (privateKey and clientEmail)
                else
                {
                    var privateKey = configuration["Firebase:PrivateKey"];
                    var clientEmail = configuration["Firebase:ClientEmail"];
                    
                    if (!string.IsNullOrEmpty(privateKey) && !string.IsNullOrEmpty(clientEmail))
                    {
                        // Replace escaped newlines if present
                        privateKey = privateKey.Replace("\\n", "\n");
                        
                        // Create service account JSON with proper escaping
                        var serviceAccountJson = new
                        {
                            type = "service_account",
                            project_id = projectId,
                            private_key_id = "",
                            private_key = privateKey,
                            client_email = clientEmail,
                            auth_uri = "https://accounts.google.com/o/oauth2/auth",
                            token_uri = "https://oauth2.googleapis.com/token",
                            auth_provider_x509_cert_url = "https://www.googleapis.com/oauth2/v1/certs",
                            client_x509_cert_url = ""
                        };
                        
                        var jsonString = JsonSerializer.Serialize(serviceAccountJson);
                        credential = GoogleCredential.FromJson(jsonString);
                        Console.WriteLine("✅ Firebase credentials loaded from appsettings.json");
                    }
                }
                
                // Create FirestoreDb with explicit credentials
                if (credential != null)
                {
                    var builder = new FirestoreDbBuilder
                    {
                        ProjectId = projectId,
                        Credential = credential.CreateScoped("https://www.googleapis.com/auth/cloud-platform")
                    };
                    _db = builder.Build();
                    Console.WriteLine($"✅ Firebase Firestore initialized for project: {projectId}");
                }
                else
                {
                    // Throw a clear error if no credentials are configured
                    throw new InvalidOperationException(
                        "Firebase credentials not found. Please configure one of the following:\n" +
                        "1. Set 'Firebase:CredentialsPath' in appsettings.json to the path of your service account JSON file, OR\n" +
                        "2. Set 'Firebase:PrivateKey' and 'Firebase:ClientEmail' in appsettings.json, OR\n" +
                        "3. Set the 'GOOGLE_APPLICATION_CREDENTIALS' environment variable to point to your service account JSON file.\n\n" +
                        "To get your service account key:\n" +
                        "1. Go to https://console.firebase.google.com/\n" +
                        "2. Select your project (oct-center)\n" +
                        "3. Go to Project Settings > Service Accounts\n" +
                        "4. Click 'Generate new private key' and download the JSON file");
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"❌ CRITICAL: Failed to initialize Firebase: {ex.Message}");
                if (ex.InnerException != null)
                {
                    Console.Error.WriteLine($"Inner Exception: {ex.InnerException.Message}");
                }
                throw; // Re-throw to show error in Visual Studio
            }
        }

        /// <summary>
        /// สร้างข้อมูลใหม่ใน Firestore
        /// </summary>
        public async Task<string> CreateAsync(string collection, Dictionary<string, object> data)
        {
            var docRef = _db.Collection(collection).Document();
            await docRef.SetAsync(data);
            return docRef.Id;
        }

        /// <summary>
        /// อัปเดตข้อมูลใน Firestore
        /// </summary>
        public async Task UpdateAsync(string collection, string documentId, Dictionary<string, object> data)
        {
            var docRef = _db.Collection(collection).Document(documentId);
            await docRef.UpdateAsync(data);
        }

        /// <summary>
        /// อ่านข้อมูลจาก Firestore
        /// </summary>
        public async Task<Dictionary<string, object>?> GetAsync(string collection, string documentId)
        {
            var docRef = _db.Collection(collection).Document(documentId);
            var snapshot = await docRef.GetSnapshotAsync();
            
            if (!snapshot.Exists)
                return null;

            var data = snapshot.ToDictionary();
            data["id"] = snapshot.Id;
            return data;
        }

        /// <summary>
        /// อ่านข้อมูลทั้งหมดจาก collection
        /// </summary>
        public async Task<List<Dictionary<string, object>>> GetAllAsync(string collection)
        {
            var snapshot = await _db.Collection(collection).GetSnapshotAsync();
            var results = new List<Dictionary<string, object>>();

            foreach (var doc in snapshot.Documents)
            {
                var data = doc.ToDictionary();
                data["id"] = doc.Id;
                results.Add(data);
            }

            return results;
        }

        /// <summary>
        /// ลบข้อมูลจาก Firestore
        /// </summary>
        public async Task DeleteAsync(string collection, string documentId)
        {
            var docRef = _db.Collection(collection).Document(documentId);
            await docRef.DeleteAsync();
        }

        /// <summary>
        /// ค้นหาข้อมูลด้วยเงื่อนไข
        /// </summary>
        public async Task<List<Dictionary<string, object>>> QueryAsync(
            string collection, 
            string field, 
            object value)
        {
            var query = _db.Collection(collection).WhereEqualTo(field, value);
            var snapshot = await query.GetSnapshotAsync();
            var results = new List<Dictionary<string, object>>();

            foreach (var doc in snapshot.Documents)
            {
                var data = doc.ToDictionary();
                data["id"] = doc.Id;
                results.Add(data);
            }

            return results;
        }
    }
}


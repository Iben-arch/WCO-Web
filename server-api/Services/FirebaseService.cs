using Google.Cloud.Firestore;
using System.Collections.Generic;
using System.Threading.Tasks;

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
            var projectId = configuration["Firebase:ProjectId"] 
                ?? throw new ArgumentNullException("Firebase:ProjectId is required");
            
            _db = FirestoreDb.Create(projectId);
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


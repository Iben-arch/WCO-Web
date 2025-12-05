using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.AspNetCore.Http;

namespace ServerApi.Services
{
    /// <summary>
    /// Service สำหรับอัปโหลดรูปภาพไปยัง Cloudinary
    /// </summary>
    public class CloudinaryService
    {
        private readonly Cloudinary _cloudinary;

        public CloudinaryService(IConfiguration configuration)
        {
            var cloudName = configuration["Cloudinary:CloudName"] 
                ?? throw new ArgumentNullException("Cloudinary:CloudName is required");
            var apiKey = configuration["Cloudinary:ApiKey"] 
                ?? throw new ArgumentNullException("Cloudinary:ApiKey is required");
            var apiSecret = configuration["Cloudinary:ApiSecret"] 
                ?? throw new ArgumentNullException("Cloudinary:ApiSecret is required");

            var account = new Account(cloudName, apiKey, apiSecret);
            _cloudinary = new Cloudinary(account);
        }

        /// <summary>
        /// อัปโหลดรูปภาพเดียว
        /// </summary>
        public async Task<ImageUploadResult> UploadImageAsync(IFormFile file, string folder = "wco-uploads")
        {
            if (file == null || file.Length == 0)
                throw new ArgumentException("File is required");

            // Validate file type
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
            var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(fileExtension))
                throw new ArgumentException("Invalid file type. Only images are allowed.");

            // Validate file size (10MB max)
            if (file.Length > 10 * 1024 * 1024)
                throw new ArgumentException("File size exceeds 10MB limit.");

            using var stream = file.OpenReadStream();
            var uploadParams = new ImageUploadParams
            {
                File = new FileDescription(file.FileName, stream),
                Folder = folder,
                Transformation = new Transformation()
                    .Quality("auto")
                    .FetchFormat("auto")
            };

            var uploadResult = await _cloudinary.UploadAsync(uploadParams);
            return uploadResult;
        }

        /// <summary>
        /// อัปโหลดรูปภาพหลายรูป
        /// </summary>
        public async Task<List<ImageUploadResult>> UploadImagesAsync(
            List<IFormFile> files, 
            string folder = "wco-uploads")
        {
            var results = new List<ImageUploadResult>();

            foreach (var file in files)
            {
                var result = await UploadImageAsync(file, folder);
                results.Add(result);
            }

            return results;
        }

        /// <summary>
        /// ลบรูปภาพจาก Cloudinary
        /// </summary>
        public async Task<DeletionResult> DeleteImageAsync(string publicId)
        {
            var deleteParams = new DeletionParams(publicId)
            {
                ResourceType = ResourceType.Image
            };

            var result = await _cloudinary.DestroyAsync(deleteParams);
            return result;
        }

        /// <summary>
        /// ลบรูปภาพหลายรูป
        /// </summary>
        public async Task<List<DeletionResult>> DeleteImagesAsync(List<string> publicIds)
        {
            var results = new List<DeletionResult>();

            foreach (var publicId in publicIds)
            {
                var result = await DeleteImageAsync(publicId);
                results.Add(result);
            }

            return results;
        }

        /// <summary>
        /// สร้าง URL สำหรับรูปภาพ
        /// </summary>
        public string GetImageUrl(string publicId, int? width = null, int? height = null)
        {
            var transformation = new Transformation();
            
            if (width.HasValue)
                transformation = transformation.Width(width.Value);
            
            if (height.HasValue)
                transformation = transformation.Height(height.Value);

            transformation = transformation.Quality("auto").FetchFormat("auto");

            return _cloudinary.Api.UrlImgUp.Transform(transformation).BuildUrl(publicId);
        }
    }
}


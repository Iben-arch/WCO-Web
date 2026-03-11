using Microsoft.AspNetCore.Mvc;

namespace ServerApi.Controllers
{
    /// <summary>
    /// Stub API for card detection. Frontend calls POST /api/card-detection/detect.
    /// When AI detection is not configured, returns empty cards so user can use manual crop in Step 3.
    /// </summary>
    [ApiController]
    [Route("api/card-detection")]
    public class CardDetectionController : BaseController
    {
        /// <summary>
        /// Detect and crop cards from image. Currently a stub - returns empty list.
        /// Wire this to an AI/Vision service (e.g. object detection + crop) to return cards with imageUrl per card.
        /// </summary>
        [HttpPost("detect")]
        public IActionResult Detect([FromForm] IFormFile? image, [FromForm] string? cardType)
        {
            if (image == null || image.Length == 0)
                return BadRequest(new { success = false, error = "กรุณาส่งรูปภาพ" });

            // Stub: no AI service wired. Return success with empty cards so UI does not error;
            // user can add cards via manual crop in Step 3.
            return Ok(new
            {
                success = true,
                cards = Array.Empty<object>()
            });
        }

        /// <summary>
        /// Process post images (used by PostDetail). Stub - returns empty cards.
        /// </summary>
        [HttpPost("process-post")]
        public IActionResult ProcessPost([FromBody] ProcessPostRequest? request)
        {
            if (request?.ImageUrls == null || request.ImageUrls.Count == 0)
                return BadRequest(new { success = false, error = "ไม่พบภาพในโพสต์นี้" });

            return Ok(new
            {
                success = true,
                cards = Array.Empty<object>()
            });
        }
    }

    public class ProcessPostRequest
    {
        public string? PostId { get; set; }
        public List<string>? ImageUrls { get; set; }
    }
}

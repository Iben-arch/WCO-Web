using Microsoft.AspNetCore.Mvc;
using ServerApi.Services;

namespace ServerApi.Controllers
{
    /// <summary>
    /// API for card detection. Uses contour detection (Emgu.CV) to find rectangular cards in the image
    /// and returns cropped images as base64. If no cards are detected, returns empty list so user can use manual crop.
    /// </summary>
    [ApiController]
    [Route("api/card-detection")]
    public class CardDetectionController : BaseController
    {
        private readonly CardDetectionService _cardDetection;

        public CardDetectionController(CardDetectionService cardDetection)
        {
            _cardDetection = cardDetection;
        }

        /// <summary>
        /// Detect and crop cards from image. Returns cards with imageUrl (data URL base64) per card.
        /// </summary>
        [HttpPost("detect")]
        public async Task<IActionResult> Detect([FromForm] IFormFile? image, [FromForm] string? cardType, CancellationToken cancellationToken)
        {
            if (image == null || image.Length == 0)
                return BadRequest(new { success = false, error = "กรุณาส่งรูปภาพ" });

            try
            {
                await using var stream = image.OpenReadStream();
                var cards = await _cardDetection.DetectAndCropAsync(stream, cancellationToken).ConfigureAwait(false);
                return Ok(new { success = true, cards });
            }
            catch
            {
                return Ok(new { success = true, cards = Array.Empty<object>() });
            }
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

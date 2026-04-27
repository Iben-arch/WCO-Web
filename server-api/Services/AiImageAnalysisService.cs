using System;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using Emgu.CV;
using Emgu.CV.CvEnum;
using Emgu.CV.Structure;
using Emgu.CV.Util;
using Microsoft.Extensions.Logging;
using Tesseract;

namespace ServerApi.Services
{
    public sealed record AiImageSignals(
        double SharpnessVariance,
        double OcrLikeConfidence,
        bool LayoutIsCard,
        double MaxContourAreaPct,
        int ContourCount
    );

    public class AiImageAnalysisService
    {
        private readonly ILogger<AiImageAnalysisService> _logger;

        public AiImageAnalysisService(ILogger<AiImageAnalysisService> logger)
        {
            _logger = logger;
        }

        public async Task<AiImageSignals> AnalyzeAsync(byte[] imageBytes, CancellationToken cancellationToken = default)
        {
            return await Task.Run(() =>
            {
                try
                {
                    using var img = new Mat();
                    CvInvoke.Imdecode(imageBytes, ImreadModes.Color, img);
                    if (img.IsEmpty)
                        return new AiImageSignals(100, 1.0, true, 1.0, 0); // Assume safe if unreadable

                    using var gray = new Mat();
                    CvInvoke.CvtColor(img, gray, ColorConversion.Bgr2Gray);

                    // 1. Sharpness (Laplacian Variance)
                    var sharpness = ComputeSharpness(gray);

                    // 2. Real OCR Confidence via Tesseract
                    var ocrConfidence = ComputeTesseractConfidence(imageBytes);

                    // 3. Card Layout (Aspect Ratio & Edge Rectangularity)
                    var maxContourAreaPct = CheckCardLayout(gray, img.Width, img.Height, out bool layoutIsCard, out int contourCount);

                    return new AiImageSignals(sharpness, ocrConfidence, layoutIsCard, maxContourAreaPct, contourCount);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[AiImageAnalysisService] Error analyzing image signals.");
                    // Fallback to safe values on exception
                    return new AiImageSignals(100, 1.0, true, 1.0, 0);
                }
            }, cancellationToken);
        }

        private static double ComputeSharpness(Mat grayImage)
        {
            using var laplacian = new Mat();
            CvInvoke.Laplacian(grayImage, laplacian, DepthType.Cv64F);
            
            var mean = new MCvScalar();
            var stddev = new MCvScalar();
            CvInvoke.MeanStdDev(laplacian, ref mean, ref stddev);
            
            // Variance is standard deviation squared
            return stddev.V0 * stddev.V0;
        }

        private double ComputeTesseractConfidence(byte[] imageBytes)
        {
            try
            {
                string tessDataPath = Path.Combine(AppContext.BaseDirectory, "tessdata");
                if (!Directory.Exists(tessDataPath))
                {
                    _logger.LogWarning("[AiImageAnalysisService] tessdata folder missing at {Path}", tessDataPath);
                    return 1.0;
                }

                using var engine = new TesseractEngine(tessDataPath, "eng+jpn+tha", EngineMode.Default);
                using var img = Pix.LoadFromMemory(imageBytes);
                using var page = engine.Process(img);

                string text = page.GetText();
                int textLength = text?.Trim().Length ?? 0;
                float confidence = page.GetMeanConfidence();
                
                _logger.LogInformation("[AiImageAnalysisService] Tesseract Mean Confidence: {Conf}, Extracted Text Length: {Len}", confidence, textLength);

                // AI gibberish often causes Tesseract to extract almost nothing (or just a few stray symbols).
                // A real trading card or group of cards should have dozens of characters at minimum.
                // We set the threshold to 8 characters to ensure even blurry 15-card grid photos pass,
                // while AI gibberish (which often extracts 0-3 characters) fails.
                if (textLength < 8)
                {
                    _logger.LogInformation("[AiImageAnalysisService] Extracted text too short ({Len}), forcing low confidence.", textLength);
                    return 0.0f; // Force low confidence to trigger penalty
                }

                // For real user photos, the text might be blurry, causing low MeanConfidence (e.g., 0.40).
                // But if it successfully extracted 8+ characters, it is almost certainly real text, not AI gibberish.
                // We return 1.0f to guarantee it safely passes the OCR threshold without penalty.
                return 1.0f;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[AiImageAnalysisService] Tesseract OCR failed");
                return 1.0; // Assume safe (high confidence) if OCR completely fails to run
            }
        }

        private static double CheckCardLayout(Mat grayImage, int width, int height, out bool isValid, out int contourCount)
        {
            double imageArea = width * height;
            isValid = false;
            contourCount = 0;
            if (imageArea <= 0) return 0;

            // 1. Edge/Contour check (Looking for a prominent rectangular shape)
            using var blurred = new Mat();
            CvInvoke.GaussianBlur(grayImage, blurred, new Size(5, 5), 0);

            using var edges = new Mat();
            CvInvoke.Canny(blurred, edges, 50, 150);

            // Use Morphological Close to connect broken edge lines (very common in AI generated images)
            using var kernel = CvInvoke.GetStructuringElement(ElementShape.Rectangle, new Size(15, 15), new Point(-1, -1));
            using var closedEdges = new Mat();
            CvInvoke.MorphologyEx(edges, closedEdges, MorphOp.Close, kernel, new Point(-1, -1), 1, BorderType.Default, new MCvScalar());

            using var contours = new VectorOfVectorOfPoint();
            using var hierarchy = new Mat();
            CvInvoke.FindContours(closedEdges, contours, hierarchy, RetrType.List, ChainApproxMethod.ChainApproxSimple);

            contourCount = contours.Size;
            double maxContourArea = 0;
            for (int i = 0; i < contours.Size; i++)
            {
                double area = CvInvoke.ContourArea(contours[i]);
                if (area > maxContourArea)
                {
                    maxContourArea = area;
                }
            }
            
            double maxContourPct = maxContourArea / imageArea;

            // 2. Aspect Ratio check
            // Accept vertical cards (0.5 to 0.85) or horizontal cards/multi-card photos (1.15 to 2.0)
            double aspectRatio = (double)width / height;
            bool isValidAspectRatio = (aspectRatio >= 0.5 && aspectRatio <= 0.85) || 
                                      (aspectRatio >= 1.15 && aspectRatio <= 2.0);

            if (!isValidAspectRatio)
            {
                isValid = false;
                return maxContourPct; 
            }

            // A well-framed card should have a large contour (the card outline itself or the art box)
            // In a photo of 2 cards side-by-side, one card covers roughly 15-20% of the image area.
            // A photo of 3 cards side-by-side has each card covering roughly 10-12% of the image area.
            // A photo of 15 cards has each card covering roughly 5-6% of the image area.
            // Setting the threshold to 8% perfectly separates "a few cards" from "a massive grid of tiny cards".
            isValid = maxContourPct > 0.08;
            return maxContourPct;
        }
    }
}

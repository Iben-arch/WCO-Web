using System.Drawing;
using Emgu.CV;
using Emgu.CV.CvEnum;
using Emgu.CV.Structure;
using Emgu.CV.Util;

namespace ServerApi.Services
{
    /// <summary>
    /// Detects rectangular trading cards in an image using contour detection (OpenCV/Emgu.CV),
    /// then crops each card and returns as base64 JPEG for the frontend.
    /// </summary>
    public class CardDetectionService
    {
        // Standard trading card aspect ratio ~ 2.5:3.5 => width/height ≈ 0.714
        private const double MinAspectRatio = 0.50;
        private const double MaxAspectRatio = 0.90;
        private const double CardAspect = 2.5 / 3.5; // ~0.714
        private const int MinCardAreaPixels = 8000;
        private const int MaxCardsReturned = 20;
        private const int MaxProcessWidth = 1600;

        /// <summary>
        /// Detect and crop cards from the uploaded image. Returns list of objects with imageUrl (data URL base64).
        /// </summary>
        public async Task<List<DetectedCardDto>> DetectAndCropAsync(Stream imageStream, CancellationToken cancellationToken = default)
        {
            await using var ms = new MemoryStream();
            await imageStream.CopyToAsync(ms, cancellationToken).ConfigureAwait(false);
            byte[] bytes = ms.ToArray();

            using var img = new Mat();
            CvInvoke.Imdecode(bytes, ImreadModes.Color, img);
            if (img.IsEmpty)
                return new List<DetectedCardDto>();

            using var working = new Mat();
            double scale = 1.0;
            if (img.Width > MaxProcessWidth)
            {
                scale = (double)MaxProcessWidth / img.Width;
                int newW = MaxProcessWidth;
                int newH = (int)Math.Round(img.Height * scale);
                CvInvoke.Resize(img, working, new Size(newW, newH), 0, 0, Inter.Area);
            }
            else
            {
                img.CopyTo(working);
            }

            int imageArea = working.Width * working.Height;
            int minArea = Math.Max(MinCardAreaPixels, imageArea / 500); // at least 0.2% of image

            using var gray = new Mat();
            using var grayEq = new Mat();
            using var blur = new Mat();
            using var canny = new Mat();
            using var thresh = new Mat();
            using var otsu = new Mat();
            using var morph = new Mat();
            using var otsuMorph = new Mat();
            using var edges = new Mat();

            CvInvoke.CvtColor(working, gray, ColorConversion.Bgr2Gray);
            CvInvoke.EqualizeHist(gray, grayEq);
            CvInvoke.GaussianBlur(grayEq, blur, new Size(5, 5), 0);

            // Two complementary signals:
            // - Adaptive threshold helps when edges are weak due to glare/blur
            // - Canny helps when card borders are strong
            CvInvoke.AdaptiveThreshold(
                blur,
                thresh,
                255,
                AdaptiveThresholdType.GaussianC,
                ThresholdType.Binary,
                31,
                7);

            // Otsu inverse sometimes works better when background is bright/complex
            CvInvoke.Threshold(blur, otsu, 0, 255, ThresholdType.BinaryInv | ThresholdType.Otsu);

            CvInvoke.Canny(blur, canny, 25, 110);

            using var kernelSmall = CvInvoke.GetStructuringElement(ElementShape.Rectangle, new Size(3, 3), new Point(-1, -1));
            using var kernel = CvInvoke.GetStructuringElement(ElementShape.Rectangle, new Size(5, 5), new Point(-1, -1));
            using var kernelBig = CvInvoke.GetStructuringElement(ElementShape.Rectangle, new Size(7, 7), new Point(-1, -1));

            CvInvoke.MorphologyEx(thresh, morph, MorphOp.Close, kernelBig, new Point(-1, -1), 2, BorderType.Default, new MCvScalar());
            CvInvoke.MorphologyEx(otsu, otsuMorph, MorphOp.Close, kernelBig, new Point(-1, -1), 2, BorderType.Default, new MCvScalar());
            CvInvoke.Dilate(canny, canny, kernelSmall, new Point(-1, -1), 1, BorderType.Default, new MCvScalar());
            CvInvoke.BitwiseOr(morph, canny, edges);

            var candidates = new List<(Rectangle Rect, double Area)>();

            // Run contour detection over multiple binary candidates and merge results.
            Mat[] contourSources = { edges, morph, otsuMorph, canny };
            foreach (var src in contourSources)
            {
                using var contours = new VectorOfVectorOfPoint();
                CvInvoke.FindContours(src, contours, null!, RetrType.List, ChainApproxMethod.ChainApproxSimple);

                for (int i = 0; i < contours.Size; i++)
                {
                    using var contour = contours[i];
                    using var approx = new VectorOfPoint();

                    double arcLen = CvInvoke.ArcLength(contour, true);
                    if (arcLen < 1) continue;

                    CvInvoke.ApproxPolyDP(contour, approx, arcLen * 0.05, true);

                    // Pass 1: strict rectangle (4 vertices). Works well when borders are clear.
                    if (approx.Size == 4 && CvInvoke.IsContourConvex(approx))
                    {
                        double area = CvInvoke.ContourArea(approx, false);
                        if (area < minArea) continue;

                        Rectangle rect = CvInvoke.BoundingRectangle(approx);
                        if (rect.Width < 20 || rect.Height < 20) continue;

                        double aspect = (double)rect.Width / rect.Height;
                        if (aspect < MinAspectRatio || aspect > MaxAspectRatio) continue;
                        if (Math.Abs(aspect - CardAspect) > 0.25) continue;

                        candidates.Add((rect, area));
                        continue;
                    }

                    // Pass 2 (fallback): rotated rectangle from contour. More tolerant when contour isn't a perfect quad.
                    double contourArea = CvInvoke.ContourArea(contour, false);
                    if (contourArea < minArea) continue;

                    RotatedRect rr = CvInvoke.MinAreaRect(contour);
                    double w = rr.Size.Width;
                    double h = rr.Size.Height;
                    if (w < 1 || h < 1) continue;
                    double ratio = Math.Min(w, h) / Math.Max(w, h); // rotation-invariant
                    if (ratio < 0.45 || ratio > 0.90) continue;

                    // Rectangularity: how much of the rotated box is filled by the contour
                    double rectArea = w * h;
                    if (rectArea <= 1) continue;
                    if (contourArea / rectArea < 0.55) continue;

                    PointF[] v = rr.GetVertices();
                    Rectangle rectR = BoundingRect(v);
                    if (rectR.Width < 20 || rectR.Height < 20) continue;

                    double aspectR = (double)rectR.Width / rectR.Height;
                    if (aspectR < MinAspectRatio || aspectR > MaxAspectRatio) continue;
                    if (Math.Abs(aspectR - CardAspect) > 0.30) continue;

                    candidates.Add((rectR, contourArea));
                }
            }

            // Sort by area descending, then take up to MaxCardsReturned (optionally filter overlapping)
            var ordered = candidates
                .OrderByDescending(x => x.Area)
                .Take(MaxCardsReturned * 2)
                .ToList();

            // Remove overlapping boxes (keep larger area when overlap is high)
            var filtered = new List<(Rectangle Rect, double Area)>();
            foreach (var c in ordered)
            {
                bool tooMuchOverlap = filtered.Any(f =>
                {
                    double interArea = IntersectionArea(f.Rect, c.Rect);
                    if (interArea <= 0) return false;
                    double minBoxArea = Math.Min(f.Rect.Width * f.Rect.Height, c.Rect.Width * c.Rect.Height);
                    return interArea / minBoxArea > 0.5;
                });
                if (!tooMuchOverlap)
                    filtered.Add(c);
                if (filtered.Count >= MaxCardsReturned) break;
            }

            var result = new List<DetectedCardDto>();
            foreach (var (rect, _) in filtered)
            {
                // Clamp to image bounds
                int x = Math.Max(0, Math.Min(rect.X, working.Width - 2));
                int y = Math.Max(0, Math.Min(rect.Y, working.Height - 2));
                int w = Math.Max(1, Math.Min(rect.Width, working.Width - x));
                int h = Math.Max(1, Math.Min(rect.Height, working.Height - y));

                var roi = new Rectangle(x, y, w, h);
                using var imgBgr = working.ToImage<Bgr, byte>();
                imgBgr.ROI = roi;
                using var croppedImg = imgBgr.Copy();
                using var cropped = croppedImg.Mat;

                var buffer = new VectorOfByte();
                CvInvoke.Imencode(".jpg", cropped, buffer);
                byte[] jpegBytes = buffer.ToArray();
                string base64 = Convert.ToBase64String(jpegBytes);
                string dataUrl = "data:image/jpeg;base64," + base64;

                result.Add(new DetectedCardDto { ImageUrl = dataUrl });
            }

            return result;
        }

        private static double IntersectionArea(Rectangle a, Rectangle b)
        {
            int x1 = Math.Max(a.X, b.X);
            int y1 = Math.Max(a.Y, b.Y);
            int x2 = Math.Min(a.X + a.Width, b.X + b.Width);
            int y2 = Math.Min(a.Y + a.Height, b.Y + b.Height);
            if (x2 <= x1 || y2 <= y1) return 0;
            return (x2 - x1) * (y2 - y1);
        }

        private static Rectangle BoundingRect(PointF[] points)
        {
            float minX = points.Min(p => p.X);
            float minY = points.Min(p => p.Y);
            float maxX = points.Max(p => p.X);
            float maxY = points.Max(p => p.Y);

            int x = (int)Math.Floor(minX);
            int y = (int)Math.Floor(minY);
            int w = (int)Math.Ceiling(maxX - minX);
            int h = (int)Math.Ceiling(maxY - minY);
            return new Rectangle(x, y, w, h);
        }
    }

    public class DetectedCardDto
    {
        public string ImageUrl { get; set; } = "";
    }
}

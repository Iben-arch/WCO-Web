using System.Drawing;
using System.Runtime.InteropServices;
using Emgu.CV;
using Emgu.CV.CvEnum;
using Emgu.CV.Features2D;
using Emgu.CV.Structure;
using Emgu.CV.Util;

namespace ServerApi.Services
{
    /// <summary>
    /// Detects rectangular trading cards in an image.
    ///
    /// Strategy (in order):
    ///   0. Color-based background segmentation — estimates dominant background color from
    ///      border pixels, builds a foreground mask via color distance, uses it to enhance
    ///      contour detection when the background is sufficiently uniform.
    ///   1. Projection-based grid detection  — best for seller photos where cards are arranged in a grid
    ///      on a uniform background (table/mat).  Finds horizontal/vertical gaps between cards using
    ///      a foreground-mask projection, then crops each grid cell.
    ///   2. Contour-based detection (multi-scale) — fallback for single cards, mixed piles, or varied
    ///      backgrounds. Uses adaptive-thresholded edge detection + contour filtering with card
    ///      aspect-ratio constraints. Runs at multiple scales (1×, 0.75×, 0.5×) to catch small cards.
    ///   3. Grid completion — after detection, infers missing cards if some are missing
    ///      from an otherwise regular grid pattern.
    ///   4. Perspective correction — when a detected quad is not axis-aligned, applies a
    ///      perspective warp to produce a properly oriented rectangular crop.
    ///   5. MSER text-region scoring — validates each candidate by checking for text-like
    ///      regions (card names, stats, numbers). Real cards score higher; plain background
    ///      rectangles are penalised.
    /// </summary>
    public class CardDetectionService
    {
        // Standard trading card aspect ratio: 2.5 × 3.5 inches → width/height ≈ 0.714
        private const double CardAspect = 2.5 / 3.5;
        private const double MinAspectRatio = 0.50;
        private const double MaxAspectRatio = 0.92;
        private const double MaxAspectDeviationStrict = 0.18;
        private const double MaxAspectDeviationFallback = 0.22;

        private const int MinCardAreaPixels = 5000;
        private const int MaxCardsReturned = 24;
        private const int MaxProcessWidth = 1800;

        /// <summary>Padding added around each crop so card edges are not clipped.</summary>
        private const double CropPaddingFraction = 0.012;
        private const double MinInnerToOuterAreaRatio = 0.12;

        // ──────────────────────────────────────────────────────────────────────────────────────────
        // Public entry point
        // ──────────────────────────────────────────────────────────────────────────────────────────

        public async Task<List<DetectedCardDto>> DetectAndCropAsync(Stream imageStream, CancellationToken cancellationToken = default)
        {
            await using var ms = new MemoryStream();
            await imageStream.CopyToAsync(ms, cancellationToken).ConfigureAwait(false);
            byte[] bytes = ms.ToArray();

            using var img = new Mat();
            CvInvoke.Imdecode(bytes, ImreadModes.Color, img);
            if (img.IsEmpty) return [];

            using var working = new Mat();
            if (img.Width > MaxProcessWidth)
            {
                double sc = (double)MaxProcessWidth / img.Width;
                CvInvoke.Resize(img, working, new Size(MaxProcessWidth, (int)Math.Round(img.Height * sc)), 0, 0, Inter.Area);
            }
            else
            {
                img.CopyTo(working);
            }

            int imageArea = working.Width * working.Height;
            int minArea = Math.Max(MinCardAreaPixels, imageArea / 600);

            using var gray = new Mat();
            CvInvoke.CvtColor(working, gray, ColorConversion.Bgr2Gray);

            // ── Method 0: color-based background mask (optional enhancer) ──────────
            using var bgMask = TryColorBackgroundMask(working);

            // ── Method 1: projection grid ──────────────────────────────────────────
            var gridRects = TryGridDetection(working, gray, minArea);

            // ── Method 2: multi-scale contour detection ────────────────────────────
            var contourRects = MultiScaleContourDetection(working, gray, bgMask, minArea);

            // ── Merge ──────────────────────────────────────────────────────────────
            List<Rectangle> merged = gridRects.Count >= 2
                ? MergeRectLists(gridRects, contourRects)
                : contourRects;

            // ── Grid completion (infer missing cards) ──────────────────────────────
            if (merged.Count >= 2)
                merged = CompleteGrid(merged, working.Width, working.Height);

            // ── Remove outer frame if it contains inner cards ──────────────────────
            var withPairs = merged.Select(r => (Rect: r, Area: (double)(r.Width * r.Height))).ToList();
            var withoutOuter = RemoveOuterWhenContainsInnerCard(withPairs, minArea);

            // ── Score all candidates ───────────────────────────────────────────────
            var scored = withoutOuter
                .Select(c =>
                {
                    double tex = TextureScore(gray, c.Rect);
                    double textLikelihood = TextLikelihoodScore(gray, c.Rect);
                    double borderContrast = BorderContrastScore(gray, c.Rect);
                    double aspect = (double)c.Rect.Width / c.Rect.Height;
                    double aspectFit = 1.0 - Math.Min(1.0, Math.Abs(aspect - CardAspect) / 0.2);

                    // ── Text presence is a HARD GATE ────────────────────────────
                    double textGate;
                    if (textLikelihood >= 0.25)
                        textGate = 1.0;
                    else if (textLikelihood >= 0.15)
                        textGate = 0.6;
                    else if (textLikelihood >= 0.05)
                        textGate = 0.25;
                    else
                        textGate = 0.08;

                    // ── Border contrast gate ────────────────────────────────────
                    double borderGate = borderContrast >= 0.15 ? 1.0 :
                                        borderContrast >= 0.08 ? 0.6 : 0.35;

                    double score = tex * (0.40 + 0.35 * aspectFit + 0.25 * textLikelihood)
                                   * textGate * borderGate;

                    return (c.Rect, c.Area, score, textLikelihood);
                })
                .OrderByDescending(x => x.score)
                .ThenByDescending(x => x.Area)
                .Take(MaxCardsReturned * 3)
                .ToList();

            // ── Size consistency filter ──────────────────────────────────────────
            // If we have multiple candidates, compute the dominant (median) card
            // size. Reject candidates that are much smaller than the dominant size
            // — they are fragments of existing cards, not separate cards.
            if (scored.Count >= 3)
            {
                var areas = scored.Select(s => s.Area).OrderByDescending(a => a).ToList();
                // Use the area of the top-25% candidate as "expected card size"
                double refArea = areas[Math.Max(0, areas.Count / 4)];
                double minAcceptableArea = refArea * 0.30; // must be at least 30% of expected
                scored = scored.Where(s => s.Area >= minAcceptableArea).ToList();
            }

            // ── Deduplicate with aggressive overlap + containment checks ────────
            var filtered = new List<Rectangle>();
            foreach (var c in scored)
            {
                // Sub-region / significant overlap check:
                // If this candidate is mostly inside an already-accepted card, skip it.
                // Uses IoU-like logic: if >25% of this candidate's area overlaps with
                // an accepted card, treat it as a fragment.
                bool isFragmentOrOverlap = filtered.Any(f =>
                {
                    double inter = IntersectionArea(f, c.Rect);
                    if (inter <= 0) return false;

                    double thisArea = c.Rect.Width * (double)c.Rect.Height;
                    double filterArea = f.Width * (double)f.Height;

                    // If >25% of this candidate overlaps with accepted card → fragment
                    if (inter / thisArea > 0.25) return true;

                    // If >25% of accepted card overlaps with this → near-duplicate
                    if (inter / filterArea > 0.25) return true;

                    return false;
                });
                if (isFragmentOrOverlap) continue;

                filtered.Add(c.Rect);
                if (filtered.Count >= MaxCardsReturned) break;
            }

            // ── Final size cleanup ──────────────────────────────────────────────
            // If we have 2+ accepted cards, remove any that are drastically smaller
            // than the median accepted card (late-stage safety net).
            if (filtered.Count >= 2)
            {
                var acceptedAreas = filtered.Select(r => (double)(r.Width * r.Height)).OrderBy(a => a).ToList();
                double medianArea = acceptedAreas[acceptedAreas.Count / 2];
                filtered = filtered.Where(r => r.Width * (double)r.Height >= medianArea * 0.28).ToList();
            }

            return CropCards(working, filtered);
        }

        // ══════════════════════════════════════════════════════════════════════════════════════════
        // Method 0 — Color-based background segmentation
        // ══════════════════════════════════════════════════════════════════════════════════════════

        /// <summary>
        /// Estimates the dominant background color from border pixels and creates a
        /// foreground mask (white = card, black = background). Returns null if the
        /// background is too varied for reliable segmentation.
        ///
        /// Works well when cards sit on a uniform mat/table where border pixels
        /// represent the background color. The mask is used to enhance contour
        /// detection in ContourDetection.
        /// </summary>
        private static Mat? TryColorBackgroundMask(Mat working)
        {
            try
            {
                int W = working.Width, H = working.Height;
                int borderW = Math.Max(8, W / 20);
                int borderH = Math.Max(8, H / 20);

                // Sample border pixels to estimate background color in HSV space
                using var hsv = new Mat();
                CvInvoke.CvtColor(working, hsv, ColorConversion.Bgr2Hsv);

                var hValues = new List<double>();
                var sValues = new List<double>();
                var vValues = new List<double>();

                var hsvImg = hsv.ToImage<Hsv, byte>();
                // Top, bottom, left, right border strips
                void SampleRegion(int x0, int y0, int x1, int y1)
                {
                    int step = Math.Max(1, ((x1 - x0) * (y1 - y0)) / 200);
                    int idx = 0;
                    for (int y = y0; y < y1 && y < H; y++)
                        for (int x = x0; x < x1 && x < W; x++)
                        {
                            if (idx++ % step != 0) continue;
                            hValues.Add(hsvImg.Data[y, x, 0]);
                            sValues.Add(hsvImg.Data[y, x, 1]);
                            vValues.Add(hsvImg.Data[y, x, 2]);
                        }
                }
                SampleRegion(0, 0, W, borderH);        // top
                SampleRegion(0, H - borderH, W, H);    // bottom
                SampleRegion(0, 0, borderW, H);         // left
                SampleRegion(W - borderW, 0, W, H);     // right

                if (hValues.Count < 20) return null;

                // Check if background is uniform enough (low std-dev in S and V)
                double sMean = sValues.Average(), vMean = vValues.Average();
                double sStd = Math.Sqrt(sValues.Average(v => (v - sMean) * (v - sMean)));
                double vStd = Math.Sqrt(vValues.Average(v => (v - vMean) * (v - vMean)));

                // If border colors are too varied, skip this method
                if (sStd > 45 || vStd > 55) return null;

                double hMean = hValues.Average();

                // Create mask: pixels far from background color = foreground (card)
                var mask = new Mat(H, W, DepthType.Cv8U, 1);
                var foreground = mask.ToImage<Gray, byte>();
                for (int y = 0; y < H; y++)
                    for (int x = 0; x < W; x++)
                    {
                        double dh = Math.Min(Math.Abs(hsvImg.Data[y, x, 0] - hMean),
                                             180 - Math.Abs(hsvImg.Data[y, x, 0] - hMean));
                        double ds = Math.Abs(hsvImg.Data[y, x, 1] - sMean);
                        double dv = Math.Abs(hsvImg.Data[y, x, 2] - vMean);
                        double dist = dh * 1.2 + ds * 0.6 + dv * 0.5;
                        foreground.Data[y, x, 0] = dist > 35 ? (byte)255 : (byte)0;
                    }

                // Morphological cleanup
                using var kernel = CvInvoke.GetStructuringElement(ElementShape.Rectangle, new Size(5, 5), new Point(-1, -1));
                var result = foreground.Mat.Clone();
                CvInvoke.MorphologyEx(result, result, MorphOp.Close, kernel, new Point(-1, -1), 2, BorderType.Default, new MCvScalar());
                CvInvoke.MorphologyEx(result, result, MorphOp.Open, kernel, new Point(-1, -1), 1, BorderType.Default, new MCvScalar());

                return result;
            }
            catch
            {
                return null;
            }
        }

        // ══════════════════════════════════════════════════════════════════════════════════════════
        // Method 1 — Edge-projection grid detection
        // ══════════════════════════════════════════════════════════════════════════════════════════

        /// <summary>
        /// Detects a grid of cards using gradient-magnitude projections.
        ///
        /// Key insight: background (table/mat) is uniform → near-zero gradient.
        ///              Cards have artwork + borders → high gradient.
        ///              Gaps between cards → zero gradient valley.
        ///
        /// This approach requires NO background colour estimation, so it works even when
        /// cards extend all the way to the image edges.
        /// </summary>
        private List<Rectangle> TryGridDetection(Mat working, Mat gray, int minArea)
        {
            int W = working.Width, H = working.Height;

            // ── 1. Gradient magnitude ─────────────────────────────────────────────
            using var blurred = new Mat();
            CvInvoke.GaussianBlur(gray, blurred, new Size(5, 5), 1.5);

            using var gx = new Mat();
            using var gy = new Mat();
            CvInvoke.Sobel(blurred, gx, DepthType.Cv16S, 1, 0, 3);
            CvInvoke.Sobel(blurred, gy, DepthType.Cv16S, 0, 1, 3);
            CvInvoke.ConvertScaleAbs(gx, gx, 1.0, 0.0);
            CvInvoke.ConvertScaleAbs(gy, gy, 1.0, 0.0);

            using var mag = new Mat();
            CvInvoke.AddWeighted(gx, 0.5, gy, 0.5, 0, mag);

            // ── 2. Compute column and row gradient profiles ───────────────────────
            double[] vProfile = new double[W];
            double[] hProfile = new double[H];

            // Use Otsu threshold on the magnitude image to determine a dynamic noise floor.
            // Drops all gradients belonging to table scratches/textures so gaps between cards are mathematically clean.
            double noiseThresh = CvInvoke.Threshold(mag, new Mat(), 0, 255, ThresholdType.Otsu);

            using var magImg = mag.ToImage<Gray, byte>();
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                {
                    double v = magImg[y, x].Intensity;
                    if (v < noiseThresh * 0.5) continue; // Ignore low-contrast texture noise
                    
                    vProfile[x] += v;
                    hProfile[y] += v;
                }
            for (int x = 0; x < W; x++) vProfile[x] /= H;
            for (int y = 0; y < H; y++) hProfile[y] /= W;

            // ── 3. Gaussian smooth profiles (more robust than box-filter) ────────
            GaussianSmoothProjection(vProfile, 13);
            GaussianSmoothProjection(hProfile, 13);

            // ── 4. Adaptive valley threshold ──────────────────────────────────────
            double vMax = vProfile.Max();
            double hMax = hProfile.Max();
            if (vMax < 0.5 || hMax < 0.5) return [];

            double vThresh = Math.Max(0.8, vMax * 0.28);
            double hThresh = Math.Max(0.8, hMax * 0.28);

            var colBands = FindBands(vProfile, vThresh);
            var rowBands = FindBands(hProfile, hThresh);

            if (colBands.Count == 0 || rowBands.Count == 0) return [];

            // ── 5. Discard bands too thin to be a card ────────────────────────────
            int minDim = (int)Math.Sqrt(minArea * CardAspect);
            colBands = [.. colBands.Where(b => b.Length >= minDim * 0.35)];
            rowBands = [.. rowBands.Where(b => b.Length >= minDim * 0.35)];

            if (colBands.Count == 0 || rowBands.Count == 0) return [];

            // ── 6. Split oversized bands (cards touching / no gap) ────────────────
            colBands = SplitOversizedBands(colBands, vProfile, W, isRow: false);
            rowBands = SplitOversizedBands(rowBands, hProfile, H, isRow: true);

            // ── 7. Build and validate grid cells ──────────────────────────────────
            var cells = new List<Rectangle>();
            foreach (var row in rowBands)
                foreach (var col in colBands)
                {
                    int cw = col.Length, ch = row.Length;
                    if (cw < 20 || ch < 20) continue;

                    // ── Robust Local Cell Tightening ──
                    // Reduces the oversized grid bounding box caused by diagonally staggered cards
                    double[] cellV = new double[cw];
                    double[] cellH = new double[ch];
                    // magImg is an image of OpenCV byte intensities representing gradient magnitude
                    var magImgData = magImg.Data; 
                    for (int cy = 0; cy < ch; cy++)
                    {
                        for (int cx = 0; cx < cw; cx++)
                        {
                            double v = magImgData[row.Start + cy, col.Start + cx, 0];
                            cellV[cx] += v;
                            cellH[cy] += v;
                        }
                    }
                    for (int cx = 0; cx < cw; cx++) cellV[cx] /= ch;
                    for (int cy = 0; cy < ch; cy++) cellH[cy] /= cw;

                    // Card edges have very strong gradients compared to the table background.
                    // By setting the threshold relative ONLY to the local peak, we safely 
                    // bypass background texture/noise that confused the global threshold.
                    double localVMax = cellV.Max();
                    double localHMax = cellH.Max();
                    
                    double tightVThresh = localVMax * 0.15; // 15% of peak horizontal gradient
                    double tightHThresh = localHMax * 0.15; // 15% of peak vertical gradient

                    int startX = 0, endX = cw - 1;
                    while (startX < cw && cellV[startX] < tightVThresh) startX++;
                    while (endX >= 0 && cellV[endX] < tightVThresh) endX--;

                    int startY = 0, endY = ch - 1;
                    while (startY < ch && cellH[startY] < tightHThresh) startY++;
                    while (endY >= 0 && cellH[endY] < tightHThresh) endY--;

                    int finalX = col.Start, finalY = row.Start;
                    int finalW = cw, finalH = ch;

                    if (startX <= endX && startY <= endY)
                    {
                        finalX += startX;
                        finalY += startY;
                        finalW = endX - startX + 1;
                        finalH = endY - startY + 1;
                    }

                    if (finalW * (double)finalH < minArea * 0.20) continue;
                    double aspect = (double)finalW / finalH;
                    // Strict aspect ratio check because we are now confident in our tight bounds
                    if (aspect < MinAspectRatio * 0.70 || aspect > MaxAspectRatio * 1.40) continue;

                    cells.Add(new Rectangle(finalX, finalY, finalW, finalH));
                }

            if (cells.Count < 2) return [];

            // ── 8. Loose size-uniformity check ────────────────────────────────────
            double avgW = cells.Average(c => c.Width);
            double avgH = cells.Average(c => c.Height);
            var uniform = cells.Where(c =>
                Math.Abs(c.Width - avgW) / avgW < 0.60 &&
                Math.Abs(c.Height - avgH) / avgH < 0.60).ToList();

            return uniform.Count >= 2 ? uniform : [];
        }

        /// <summary>
        /// Gaussian-weighted smoothing for projection arrays. More robust against outlier
        /// spikes than the original box-filter, producing cleaner valley/peak separation.
        /// </summary>
        private static void GaussianSmoothProjection(double[] proj, int window)
        {
            double[] tmp = new double[proj.Length];
            int half = window / 2;
            double sigma = window / 4.0;
            double[] kernel = new double[window];
            double kSum = 0;
            for (int i = 0; i < window; i++)
            {
                double x = i - half;
                kernel[i] = Math.Exp(-(x * x) / (2.0 * sigma * sigma));
                kSum += kernel[i];
            }
            for (int i = 0; i < window; i++) kernel[i] /= kSum;

            for (int i = 0; i < proj.Length; i++)
            {
                double sum = 0;
                for (int k = 0; k < window; k++)
                {
                    int j = Math.Clamp(i + k - half, 0, proj.Length - 1);
                    sum += proj[j] * kernel[k];
                }
                tmp[i] = sum;
            }
            Array.Copy(tmp, proj, proj.Length);
        }

        /// <summary>
        /// If a band is much wider/taller than what a single card should look like,
        /// attempt to subdivide it by finding local minima (shallow valleys where cards touch).
        /// Falls back to even division when no minima are found.
        /// </summary>
        private static List<Band> SplitOversizedBands(List<Band> bands, double[] proj, int totalSize, bool isRow)
        {
            if (bands.Count == 0) return bands;

            int medLen = bands.Select(b => b.Length).OrderBy(x => x).ToList()[bands.Count / 2];
            int singleCardEstimate = medLen;

            var result = new List<Band>();
            foreach (var band in bands)
            {
                if (band.Length < medLen * 1.60)
                {
                    result.Add(band);
                    continue;
                }

                int expectedCount = (int)Math.Round((double)band.Length / singleCardEstimate);
                expectedCount = Math.Max(2, Math.Min(expectedCount, 8));

                var segment = proj.Skip(band.Start).Take(band.Length).ToArray();
                int minGap = Math.Max(5, band.Length / (expectedCount * 3));
                var minima = FindLocalMinima(segment, minGap);

                double segMax = segment.Max();
                minima = [.. minima.Where(m => segment[m] < segMax * 0.75)];

                if (minima.Count >= 1 && minima.Count < expectedCount * 2)
                {
                    int prev = 0;
                    foreach (int m in minima)
                    {
                        if (m - prev >= 10)
                            result.Add(new Band(band.Start + prev, m - prev));
                        prev = m;
                    }
                    if (band.Length - prev >= 10)
                        result.Add(new Band(band.Start + prev, band.Length - prev));
                }
                else
                {
                    int partLen = band.Length / expectedCount;
                    for (int i = 0; i < expectedCount; i++)
                    {
                        int s = band.Start + i * partLen;
                        int l = (i == expectedCount - 1) ? (band.Start + band.Length - s) : partLen;
                        if (l >= 10) result.Add(new Band(s, l));
                    }
                }
            }

            return result.Count > 0 ? result : bands;
        }

        private static List<int> FindLocalMinima(double[] arr, int minGap)
        {
            var minima = new List<int>();
            for (int i = 1; i < arr.Length - 1; i++)
            {
                if (arr[i] <= arr[i - 1] && arr[i] <= arr[i + 1])
                {
                    if (minima.Count == 0 || i - minima[^1] >= minGap)
                        minima.Add(i);
                }
            }
            return minima;
        }

        // ══════════════════════════════════════════════════════════════════════════════════════════
        // Method 2 — Multi-scale contour-based detection
        // ══════════════════════════════════════════════════════════════════════════════════════════

        /// <summary>
        /// Runs contour detection at multiple scales (1×, 0.75×, 0.5×) to catch both
        /// large and small cards in high-resolution images. Merges results across scales.
        /// </summary>
        private List<Rectangle> MultiScaleContourDetection(Mat working, Mat gray, Mat? bgMask, int minArea)
        {
            var allRects = new List<Rectangle>();

            // Scale 1.0 — full resolution
            allRects.AddRange(ContourDetection(working, gray, bgMask, minArea));

            // Scale 0.75 — catches cards that are too small relative to full resolution
            if (working.Width > 600 && working.Height > 600)
            {
                double s = 0.75;
                using var scaled = new Mat();
                CvInvoke.Resize(working, scaled, new Size((int)(working.Width * s), (int)(working.Height * s)), 0, 0, Inter.Area);
                using var scaledGray = new Mat();
                CvInvoke.CvtColor(scaled, scaledGray, ColorConversion.Bgr2Gray);
                int scaledMinArea = (int)(minArea * s * s);
                var rects = ContourDetection(scaled, scaledGray, null, scaledMinArea);
                // Map back to original resolution
                foreach (var r in rects)
                    allRects.Add(new Rectangle(
                        (int)(r.X / s), (int)(r.Y / s),
                        (int)(r.Width / s), (int)(r.Height / s)));
            }

            // Scale 0.5 — for very high-resolution images with small cards
            if (working.Width > 1200 && working.Height > 1200)
            {
                double s = 0.5;
                using var scaled = new Mat();
                CvInvoke.Resize(working, scaled, new Size((int)(working.Width * s), (int)(working.Height * s)), 0, 0, Inter.Area);
                using var scaledGray = new Mat();
                CvInvoke.CvtColor(scaled, scaledGray, ColorConversion.Bgr2Gray);
                int scaledMinArea = (int)(minArea * s * s);
                var rects = ContourDetection(scaled, scaledGray, null, scaledMinArea);
                foreach (var r in rects)
                    allRects.Add(new Rectangle(
                        (int)(r.X / s), (int)(r.Y / s),
                        (int)(r.Width / s), (int)(r.Height / s)));
            }

            // Deduplicate across scales
            return DeduplicateRects(allRects);
        }

        private List<Rectangle> ContourDetection(Mat working, Mat gray, Mat? bgMask, int minArea)
        {
            using var grayEq = new Mat();
            using var blur = new Mat();
            using var canny = new Mat();
            using var thresh = new Mat();
            using var otsu = new Mat();
            using var morph = new Mat();
            using var otsuMorph = new Mat();
            using var edges = new Mat();

            CvInvoke.EqualizeHist(gray, grayEq);
            CvInvoke.GaussianBlur(grayEq, blur, new Size(5, 5), 0);
            CvInvoke.AdaptiveThreshold(blur, thresh, 255, AdaptiveThresholdType.GaussianC, ThresholdType.Binary, 31, 7);
            CvInvoke.Threshold(blur, otsu, 0, 255, ThresholdType.BinaryInv | ThresholdType.Otsu);

            // ── Adaptive Canny: compute thresholds from Otsu's threshold ──────────
            // Otsu gives us the optimal binarization level; use it to derive Canny
            // thresholds that adapt to the image's actual contrast.
            double otsuThreshold = CvInvoke.Threshold(blur, new Mat(), 0, 255, ThresholdType.Otsu);
            double cannyLow = Math.Max(10, otsuThreshold * 0.33);
            double cannyHigh = Math.Min(255, otsuThreshold * 1.1);
            CvInvoke.Canny(blur, canny, cannyLow, cannyHigh);

            using var kernelSmall = CvInvoke.GetStructuringElement(ElementShape.Rectangle, new Size(3, 3), new Point(-1, -1));
            using var kernelBig = CvInvoke.GetStructuringElement(ElementShape.Rectangle, new Size(7, 7), new Point(-1, -1));

            CvInvoke.MorphologyEx(thresh, morph, MorphOp.Close, kernelBig, new Point(-1, -1), 2, BorderType.Default, new MCvScalar());
            CvInvoke.MorphologyEx(otsu, otsuMorph, MorphOp.Close, kernelBig, new Point(-1, -1), 2, BorderType.Default, new MCvScalar());
            CvInvoke.Dilate(canny, canny, kernelSmall, new Point(-1, -1), 1, BorderType.Default, new MCvScalar());
            CvInvoke.BitwiseOr(morph, canny, edges);

            var candidates = new List<(Rectangle Rect, double Area, PointF[]? QuadPts)>();
            Mat[] sources = bgMask != null
                ? [edges, morph, otsuMorph, canny, bgMask]
                : [edges, morph, otsuMorph, canny];

            foreach (var src in sources)
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

                    if (approx.Size == 4 && CvInvoke.IsContourConvex(approx))
                    {
                        double area = CvInvoke.ContourArea(approx, false);
                        if (area < minArea) continue;
                        Rectangle rect = CvInvoke.BoundingRectangle(approx);
                        if (rect.Width < 20 || rect.Height < 20) continue;
                        double aspect = (double)rect.Width / rect.Height;
                        if (aspect < MinAspectRatio || aspect > MaxAspectRatio) continue;
                        // Relaxed deviation to allow slightly rotated full contours
                        if (Math.Abs(aspect - CardAspect) > MaxAspectDeviationStrict * 1.5) continue;

                        // Store the quad points for potential perspective correction
                        var pts = approx.ToArray().Select(p => new PointF(p.X, p.Y)).ToArray();
                        candidates.Add((rect, area, pts));
                        continue;
                    }

                    double contArea = CvInvoke.ContourArea(contour, false);
                    if (contArea < minArea) continue;
                    RotatedRect rr = CvInvoke.MinAreaRect(contour);
                    double w = rr.Size.Width, h = rr.Size.Height;
                    if (w < 1 || h < 1) continue;
                    double ratio = Math.Min(w, h) / Math.Max(w, h);
                    if (ratio < 0.45 || ratio > 0.90) continue;
                    double rrArea = w * h;
                    if (rrArea <= 1 || contArea / rrArea < 0.50) continue;
                    PointF[] verts = rr.GetVertices();
                    Rectangle rectR = BoundingRect(verts);
                    if (rectR.Width < 20 || rectR.Height < 20) continue;
                    // We REMOVED the strict aspectR check on the bounding box here 
                    // because naturally rotated cards generate wider bounding boxes that fail it.
                    candidates.Add((rectR, contArea, verts));
                }
            }

            var deduped = candidates
                .GroupBy(c => new { c.Rect.X, c.Rect.Y, c.Rect.Width, c.Rect.Height })
                .Select(g => g.First()).ToList();

            var withPairs = deduped.Select(c => (c.Rect, c.Area)).ToList();
            return RemoveOuterWhenContainsInnerCard(withPairs, minArea)
                .Select(c => c.Rect).ToList();
        }

        // ══════════════════════════════════════════════════════════════════════════════════════════
        // Method 3 — Grid completion
        // ══════════════════════════════════════════════════════════════════════════════════════════

        /// <summary>
        /// After detection, checks if the found cards form a regular grid.  
        /// If some grid positions are empty, infers cards at those positions using the median
        /// card size and the detected column/row layout.
        /// </summary>
        private static List<Rectangle> CompleteGrid(List<Rectangle> rects, int imgW, int imgH)
        {
            if (rects.Count < 2) return rects;

            var sortedW = rects.Select(r => r.Width).OrderBy(x => x).ToList();
            var sortedH = rects.Select(r => r.Height).OrderBy(x => x).ToList();
            int medW = sortedW[sortedW.Count / 2];
            int medH = sortedH[sortedH.Count / 2];

            var dominant = rects.Where(r =>
                Math.Abs(r.Width - medW) <= medW * 0.38 &&
                Math.Abs(r.Height - medH) <= medH * 0.38).ToList();
            if (dominant.Count < 2) return rects;

            var rows = new List<List<Rectangle>>();
            int rowTol = (int)(medH * 0.40);
            foreach (var r in dominant.OrderBy(r => r.Y + r.Height / 2))
            {
                int cy = r.Y + r.Height / 2;
                var matchRow = rows.FirstOrDefault(row => Math.Abs(row[0].Y + row[0].Height / 2 - cy) <= rowTol);
                if (matchRow != null) matchRow.Add(r);
                else rows.Add([r]);
            }

            int maxCols = rows.Count > 0 ? rows.Max(row => row.Count) : 0;
            if (maxCols < 2 && rows.Count < 2) return rects;

            var refRow = rows.OrderByDescending(r => r.Count).First().OrderBy(r => r.X).ToList();
            if (refRow.Count < 2) return rects;

            double totalSpacing = 0;
            for (int i = 1; i < refRow.Count; i++)
                totalSpacing += refRow[i].X - refRow[i - 1].X;
            double avgSpacing = totalSpacing / (refRow.Count - 1);
            if (avgSpacing <= medW * 0.5) return rects;

            var colXs = refRow.Select(r => r.X).ToList();
            var result = new List<Rectangle>(rects);

            foreach (var row in rows)
            {
                if (row.Count >= maxCols) continue;
                int rowY = row.Min(r => r.Y);
                int rowH = (int)row.Average(r => r.Height);

                foreach (int expectedX in colXs)
                {
                    bool found = row.Any(r => Math.Abs(r.X - expectedX) <= medW * 0.55);
                    if (found) continue;

                    int x = Math.Max(0, expectedX);
                    int y = Math.Max(0, rowY);
                    int w = Math.Min(medW, imgW - x);
                    int h = Math.Min(rowH > 0 ? rowH : medH, imgH - y);
                    if (w < 20 || h < 20) continue;

                    var inferred = new Rectangle(x, y, w, h);
                    bool alreadyPresent = result.Any(r =>
                    {
                        double inter = IntersectionArea(r, inferred);
                        double minBox = Math.Min(r.Width * (double)r.Height, inferred.Width * (double)inferred.Height);
                        return inter / minBox > 0.40;
                    });
                    if (!alreadyPresent)
                        result.Add(inferred);
                }
            }

            return result;
        }

        // ══════════════════════════════════════════════════════════════════════════════════════════
        // Helpers
        // ══════════════════════════════════════════════════════════════════════════════════════════

        private readonly struct Band(int start, int length)
        {
            public int Start { get; } = start;
            public int Length { get; } = length;
        }

        /// <summary>
        /// Returns contiguous spans of the projection array where value ≥ threshold.
        /// Each span = one "row" or "column" of cards.
        /// </summary>
        private static List<Band> FindBands(double[] proj, double threshold)
        {
            var bands = new List<Band>();
            bool inBand = false;
            int start = 0;
            for (int i = 0; i < proj.Length; i++)
            {
                if (proj[i] >= threshold)
                {
                    if (!inBand) { inBand = true; start = i; }
                }
                else if (inBand)
                {
                    bands.Add(new Band(start, i - start));
                    inBand = false;
                }
            }
            if (inBand) bands.Add(new Band(start, proj.Length - start));
            return bands;
        }

        private static List<Rectangle> MergeRectLists(List<Rectangle> primary, List<Rectangle> secondary)
        {
            var combined = new List<Rectangle>(primary);
            combined.AddRange(secondary);

            var result = new List<Rectangle>();
            foreach (var r in combined)
            {
                int overlapIdx = result.FindIndex(f =>
                {
                    double inter = IntersectionArea(f, r);
                    if (inter <= 0) return false;
                    double minBox = Math.Min(f.Width * (double)f.Height, r.Width * (double)r.Height);
                    return inter / minBox > 0.40;
                });

                if (overlapIdx >= 0)
                {
                    // If they overlap, keep the one with the aspect ratio closer to standard CardAspect
                    double aspectF = (double)result[overlapIdx].Width / result[overlapIdx].Height;
                    double aspectR = (double)r.Width / r.Height;
                    double distF = Math.Abs(aspectF - CardAspect);
                    double distR = Math.Abs(aspectR - CardAspect);

                    if (distR < distF)
                        result[overlapIdx] = r;
                }
                else
                {
                    result.Add(r);
                }
            }
            return result;
        }

        /// <summary>
        /// Deduplicates rectangles from multi-scale detection by removing
        /// those that overlap significantly with an existing rectangle.
        /// </summary>
        private static List<Rectangle> DeduplicateRects(List<Rectangle> rects)
        {
            var result = new List<Rectangle>();
            foreach (var r in rects.OrderByDescending(r => r.Width * r.Height))
            {
                bool overlap = result.Any(f =>
                {
                    double inter = IntersectionArea(f, r);
                    if (inter <= 0) return false;
                    double minBox = Math.Min(f.Width * (double)f.Height, r.Width * (double)r.Height);
                    return inter / minBox > 0.50;
                });
                if (!overlap) result.Add(r);
            }
            return result;
        }

        /// <summary>
        /// Efficient card cropping using Mat ROI directly instead of creating
        /// full Image&lt;Bgr,byte&gt; copies on every iteration.
        /// </summary>
        private static List<DetectedCardDto> CropCards(Mat working, IEnumerable<Rectangle> rects)
        {
            var result = new List<DetectedCardDto>();
            foreach (var rect in rects)
            {
                var padded = PadRectangle(rect, working.Width, working.Height, CropPaddingFraction);
                int x = Math.Max(0, Math.Min(padded.X, working.Width - 2));
                int y = Math.Max(0, Math.Min(padded.Y, working.Height - 2));
                int w = Math.Max(1, Math.Min(padded.Width, working.Width - x));
                int h = Math.Max(1, Math.Min(padded.Height, working.Height - y));

                // Direct Mat ROI crop — no full-image copy needed
                var roi = new Rectangle(x, y, w, h);
                using var cropped = new Mat(working, roi);
                using var croppedCopy = cropped.Clone();
                using var buf = new VectorOfByte();
                CvInvoke.Imencode(".jpg", croppedCopy, buf);
                string dataUrl = "data:image/jpeg;base64," + Convert.ToBase64String(buf.ToArray());
                result.Add(new DetectedCardDto { ImageUrl = dataUrl });
            }
            return result;
        }

        private static List<(Rectangle Rect, double Area)> RemoveOuterWhenContainsInnerCard(
            List<(Rectangle Rect, double Area)> candidates, int minAreaPixels)
        {
            if (candidates.Count <= 1) return candidates;
            var toRemove = new HashSet<int>();
            for (int i = 0; i < candidates.Count; i++)
            {
                for (int j = 0; j < candidates.Count; j++)
                {
                    if (i == j || toRemove.Contains(i)) continue;
                    var outer = candidates[i].Rect;
                    var inner = candidates[j].Rect;
                    if (!ContainsRect(outer, inner)) continue;
                    double innerA = inner.Width * (double)inner.Height;
                    double outerA = outer.Width * (double)outer.Height;
                    if (innerA < minAreaPixels * 0.5) continue;
                    if (innerA < outerA * MinInnerToOuterAreaRatio) continue;
                    if (innerA > outerA * 0.92) continue;
                    toRemove.Add(i);
                    break;
                }
            }
            var kept = new List<(Rectangle, double)>();
            for (int i = 0; i < candidates.Count; i++)
                if (!toRemove.Contains(i)) kept.Add(candidates[i]);
            return kept;
        }

        /// <summary>Scores a region by its texture richness (card art = high texture, plain table = low).</summary>
        private static double TextureScore(Mat gray, Rectangle rect)
        {
            int x = Math.Max(0, rect.X), y = Math.Max(0, rect.Y);
            int w = Math.Max(1, Math.Min(rect.Width, gray.Width - x));
            int h = Math.Max(1, Math.Min(rect.Height, gray.Height - y));
            if (w < 12 || h < 12) return 0;

            using var roi = new Mat(gray, new Rectangle(x, y, w, h));
            MCvScalar mean = default, stddev = default;
            CvInvoke.MeanStdDev(roi, ref mean, ref stddev);
            double grayStd = stddev.V0;

            using var gx = new Mat(); using var gy = new Mat();
            CvInvoke.Sobel(roi, gx, DepthType.Cv16S, 1, 0, 3);
            CvInvoke.Sobel(roi, gy, DepthType.Cv16S, 0, 1, 3);
            CvInvoke.ConvertScaleAbs(gx, gx, 1.0, 0.0);
            CvInvoke.ConvertScaleAbs(gy, gy, 1.0, 0.0);
            using var mag = new Mat();
            CvInvoke.AddWeighted(gx, 0.5, gy, 0.5, 0, mag);
            CvInvoke.MeanStdDev(mag, ref mean, ref stddev);
            return grayStd * 0.42 + stddev.V0 * 0.58;
        }

        /// <summary>
        /// MSER-based text-region likelihood score for a candidate rectangle.
        ///
        /// Trading cards have text (name, stats, numbers, descriptions). Plain background
        /// rectangles (table edges, box sides) do not. This score uses MSER (Maximally
        /// Stable Extremal Regions) to detect clusters of small, high-contrast blobs
        /// that look like text characters, then returns a normalised score [0, 1].
        ///
        /// MSER is built into OpenCV and runs in ~1ms per ROI — no Tesseract dependency.
        /// We filter MSER regions by size (small), aspect ratio (roughly character-shaped),
        /// and density (characters cluster together in lines).
        /// </summary>
        private static double TextLikelihoodScore(Mat gray, Rectangle rect)
        {
            try
            {
                int x = Math.Max(0, rect.X), y = Math.Max(0, rect.Y);
                int w = Math.Max(1, Math.Min(rect.Width, gray.Width - x));
                int h = Math.Max(1, Math.Min(rect.Height, gray.Height - y));
                if (w < 30 || h < 30) return 0;

                using var roi = new Mat(gray, new Rectangle(x, y, w, h));

                // MSER parameters tuned for card text (small characters on card background)
                using var mser = new MSER(
                    delta: 5,
                    minArea: 8,
                    maxArea: (int)(w * h * 0.02),  // text chars are small relative to card
                    maxVariation: 0.25,
                    minDiversity: 0.2);

                using var regions = new VectorOfVectorOfPoint();
                using var bboxes = new VectorOfRect();
                mser.DetectRegions(roi, regions, bboxes);

                if (bboxes.Size == 0) return 0;

                // Filter for text-like regions: small, roughly character-shaped
                int textLikeCount = 0;
                double roiArea = w * h;

                for (int i = 0; i < bboxes.Size; i++)
                {
                    var b = bboxes[i];
                    double bArea = b.Width * b.Height;
                    // Characters are typically 0.01%-1.5% of card area
                    if (bArea < roiArea * 0.0001 || bArea > roiArea * 0.015) continue;
                    // Character aspect ratio: not too elongated
                    double bAspect = (double)Math.Min(b.Width, b.Height) / Math.Max(b.Width, b.Height);
                    if (bAspect < 0.15) continue; // filter out thin lines
                    textLikeCount++;
                }

                // Normalize: a typical card has 20-100+ text-like regions
                // Score saturates around 30 regions (strongly indicates text presence)
                double score = Math.Min(1.0, textLikeCount / 30.0);
                return score;
            }
            catch
            {
                return 0;
            }
        }

        /// <summary>
        /// Measures the contrast between the border strip of a candidate rectangle
        /// and the area just outside it. Real trading cards have a visible edge/border
        /// that creates a transition from card surface to background. Fragments of
        /// artwork that sit inside a card have NO such transition — the pixels just
        /// outside the crop look the same as the pixels inside.
        ///
        /// Returns a normalised score [0, ~1]; higher = stronger border contrast.
        /// </summary>
        private static double BorderContrastScore(Mat gray, Rectangle rect)
        {
            try
            {
                int x = Math.Max(0, rect.X), y = Math.Max(0, rect.Y);
                int w = Math.Max(1, Math.Min(rect.Width, gray.Width - x));
                int h = Math.Max(1, Math.Min(rect.Height, gray.Height - y));
                if (w < 30 || h < 30) return 0;

                int stripW = Math.Max(2, w / 20);  // inner border strip width
                int outerW = Math.Max(2, w / 15);  // outer strip width

                // Sample inner border strip (just inside the rectangle edges)
                double innerSum = 0; int innerCount = 0;
                // Sample outer strip (just outside the rectangle edges)
                double outerSum = 0; int outerCount = 0;

                var grayImg = gray.ToImage<Gray, byte>();

                // Top and bottom edges
                for (int dx = 0; dx < w; dx += 3)
                {
                    int px = x + dx;
                    if (px >= gray.Width) break;
                    // Inner top strip
                    for (int dy = 0; dy < stripW && y + dy < gray.Height; dy++)
                    { innerSum += grayImg.Data[y + dy, px, 0]; innerCount++; }
                    // Inner bottom strip
                    for (int dy = 0; dy < stripW && y + h - 1 - dy >= 0 && y + h - 1 - dy < gray.Height; dy++)
                    { innerSum += grayImg.Data[y + h - 1 - dy, px, 0]; innerCount++; }
                    // Outer top strip
                    for (int dy = 1; dy <= outerW && y - dy >= 0; dy++)
                    { outerSum += grayImg.Data[y - dy, px, 0]; outerCount++; }
                    // Outer bottom strip
                    for (int dy = 1; dy <= outerW && y + h - 1 + dy < gray.Height; dy++)
                    { outerSum += grayImg.Data[y + h - 1 + dy, px, 0]; outerCount++; }
                }

                // Left and right edges
                for (int dy = 0; dy < h; dy += 3)
                {
                    int py = y + dy;
                    if (py >= gray.Height) break;
                    // Inner left strip
                    for (int dx = 0; dx < stripW && x + dx < gray.Width; dx++)
                    { innerSum += grayImg.Data[py, x + dx, 0]; innerCount++; }
                    // Inner right strip
                    for (int dx = 0; dx < stripW && x + w - 1 - dx >= 0 && x + w - 1 - dx < gray.Width; dx++)
                    { innerSum += grayImg.Data[py, x + w - 1 - dx, 0]; innerCount++; }
                    // Outer left strip
                    for (int dx = 1; dx <= outerW && x - dx >= 0; dx++)
                    { outerSum += grayImg.Data[py, x - dx, 0]; outerCount++; }
                    // Outer right strip
                    for (int dx = 1; dx <= outerW && x + w - 1 + dx < gray.Width; dx++)
                    { outerSum += grayImg.Data[py, x + w - 1 + dx, 0]; outerCount++; }
                }

                if (innerCount == 0 || outerCount == 0) return 0;

                double innerMean = innerSum / innerCount;
                double outerMean = outerSum / outerCount;

                // Normalise the absolute difference by the max possible range (255)
                double contrast = Math.Abs(innerMean - outerMean) / 255.0;
                return contrast;
            }
            catch
            {
                return 0;
            }
        }

        private static Rectangle PadRectangle(Rectangle roi, int imgW, int imgH, double frac)
        {
            int padX = Math.Max(1, (int)Math.Round(roi.Width * frac));
            int padY = Math.Max(1, (int)Math.Round(roi.Height * frac));
            int x = Math.Max(0, roi.X - padX);
            int y = Math.Max(0, roi.Y - padY);
            int right = Math.Min(imgW, roi.X + roi.Width + padX);
            int bottom = Math.Min(imgH, roi.Y + roi.Height + padY);
            return new Rectangle(x, y, Math.Max(1, right - x), Math.Max(1, bottom - y));
        }

        private static double IntersectionArea(Rectangle a, Rectangle b)
        {
            int x1 = Math.Max(a.X, b.X), y1 = Math.Max(a.Y, b.Y);
            int x2 = Math.Min(a.X + a.Width, b.X + b.Width);
            int y2 = Math.Min(a.Y + a.Height, b.Y + b.Height);
            return x2 <= x1 || y2 <= y1 ? 0 : (x2 - x1) * (y2 - y1);
        }

        private static bool ContainsRect(Rectangle outer, Rectangle inner) =>
            outer.Left <= inner.Left && outer.Top <= inner.Top &&
            outer.Right >= inner.Right && outer.Bottom >= inner.Bottom;

        private static Rectangle BoundingRect(PointF[] pts)
        {
            float minX = pts.Min(p => p.X), minY = pts.Min(p => p.Y);
            float maxX = pts.Max(p => p.X), maxY = pts.Max(p => p.Y);
            return new Rectangle((int)Math.Floor(minX), (int)Math.Floor(minY),
                (int)Math.Ceiling(maxX - minX), (int)Math.Ceiling(maxY - minY));
        }
    }

    public class DetectedCardDto
    {
        public string ImageUrl { get; set; } = "";
    }
}

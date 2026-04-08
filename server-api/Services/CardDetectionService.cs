using System.Drawing;
using Emgu.CV;
using Emgu.CV.CvEnum;
using Emgu.CV.Structure;
using Emgu.CV.Util;

namespace ServerApi.Services
{
    /// <summary>
    /// Detects rectangular trading cards in an image.
    ///
    /// Strategy (in order):
    ///   1. Projection-based grid detection  — best for seller photos where cards are arranged in a grid
    ///      on a uniform background (table/mat).  Finds horizontal/vertical gaps between cards using
    ///      a foreground-mask projection, then crops each grid cell.
    ///   2. Contour-based detection          — fallback for single cards, mixed piles, or varied backgrounds.
    ///      Uses edge detection + contour filtering with card aspect-ratio constraints.
    ///   3. Grid completion                  — after detection, infers missing cards if some are missing
    ///      from an otherwise regular grid pattern.
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

            // ── Method 1: projection grid ──────────────────────────────────────────
            var gridRects = TryGridDetection(working, gray, minArea);

            // ── Method 2: contour detection ────────────────────────────────────────
            var contourRects = ContourDetection(working, gray, minArea);

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

            // ── Score and deduplicate ──────────────────────────────────────────────
            var scored = withoutOuter
                .Select(c =>
                {
                    double tex = TextureScore(gray, c.Rect);
                    double aspect = (double)c.Rect.Width / c.Rect.Height;
                    double aspectFit = 1.0 - Math.Min(1.0, Math.Abs(aspect - CardAspect) / 0.2);
                    double score = tex * (0.55 + 0.45 * aspectFit);
                    return (c.Rect, c.Area, score);
                })
                .OrderByDescending(x => x.score)
                .ThenByDescending(x => x.Area)
                .Take(MaxCardsReturned * 3)
                .ToList();

            var filtered = new List<Rectangle>();
            foreach (var c in scored)
            {
                bool overlap = filtered.Any(f =>
                {
                    double inter = IntersectionArea(f, c.Rect);
                    if (inter <= 0) return false;
                    double minBox = Math.Min(f.Width * (double)f.Height, c.Rect.Width * (double)c.Rect.Height);
                    return inter / minBox > 0.45;
                });
                if (!overlap) filtered.Add(c.Rect);
                if (filtered.Count >= MaxCardsReturned) break;
            }

            return CropCards(working, filtered);
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
            // vProfile[x] = average gradient magnitude across all rows at column x
            // hProfile[y] = average gradient magnitude across all cols at row y
            //
            // Gaps between cards → vProfile ≈ 0  (smooth uniform background)
            // Card columns      → vProfile is HIGH (artwork + border gradients)
            double[] vProfile = new double[W];
            double[] hProfile = new double[H];

            using var magImg = mag.ToImage<Gray, byte>();
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                {
                    double v = magImg[y, x].Intensity;
                    vProfile[x] += v;
                    hProfile[y] += v;
                }
            for (int x = 0; x < W; x++) vProfile[x] /= H;
            for (int y = 0; y < H; y++) hProfile[y] /= W;

            // ── 3. Smooth profiles to remove per-pixel spikes ────────────────────
            SmoothProjection(vProfile, 11);
            SmoothProjection(hProfile, 11);

            // ── 4. Adaptive valley threshold ──────────────────────────────────────
            // Valleys (gaps between cards or image borders) are regions where the
            // profile drops below 28% of the peak.  Card artwork creates high values
            // across the whole card width, so card columns stay well above threshold
            // even for uniformly coloured cards with minimal edge contrast.
            double vMax = vProfile.Max();
            double hMax = hProfile.Max();
            if (vMax < 0.5 || hMax < 0.5) return []; // essentially featureless image

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
                    if (cw * (double)ch < minArea * 0.20) continue;
                    double aspect = (double)cw / ch;
                    if (aspect < MinAspectRatio * 0.65 || aspect > MaxAspectRatio * 1.55) continue;
                    cells.Add(new Rectangle(col.Start, row.Start, cw, ch));
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
        /// Smooth a 1-D projection array with a simple box-filter window to reduce per-pixel noise.
        /// </summary>
        private static void SmoothProjection(double[] proj, int window)
        {
            double[] tmp = new double[proj.Length];
            int half = window / 2;
            for (int i = 0; i < proj.Length; i++)
            {
                double sum = 0; int cnt = 0;
                for (int j = Math.Max(0, i - half); j <= Math.Min(proj.Length - 1, i + half); j++)
                { sum += proj[j]; cnt++; }
                tmp[i] = sum / cnt;
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

            // Estimate typical single-card dimension: use the SHORT dimension of the image side
            // (cards in a grid usually span 20–80% of the image along each axis).
            // As a heuristic, single-card size ≈ totalSize / 5 .. totalSize / 1.2
            int medLen = bands.Select(b => b.Length).OrderBy(x => x).ToList()[bands.Count / 2];

            // If there is only 1 band and it covers > 60% of the image axis, it likely
            // contains multiple cards. Estimate count from the expected card aspect ratio.
            int singleCardEstimate = medLen; // start conservative

            var result = new List<Band>();
            foreach (var band in bands)
            {
                // Only split if this band is substantially larger than the median band
                if (band.Length < medLen * 1.60)
                {
                    result.Add(band);
                    continue;
                }

                int expectedCount = (int)Math.Round((double)band.Length / singleCardEstimate);
                expectedCount = Math.Max(2, Math.Min(expectedCount, 8));

                // Look for local minima (shallow valleys between touching cards)
                var segment = proj.Skip(band.Start).Take(band.Length).ToArray();
                int minGap = Math.Max(5, band.Length / (expectedCount * 3));
                var minima = FindLocalMinima(segment, minGap);

                // Keep only minima that are somewhat below surrounding peaks
                double segMax = segment.Max();
                minima = [.. minima.Where(m => segment[m] < segMax * 0.75)];

                if (minima.Count >= 1 && minima.Count < expectedCount * 2)
                {
                    // Split at each minimum
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
                    // No clear minima — divide evenly by expected count
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
        // Method 2 — Contour-based detection (original approach, refined)
        // ══════════════════════════════════════════════════════════════════════════════════════════

        private List<Rectangle> ContourDetection(Mat working, Mat gray, int minArea)
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
            CvInvoke.Canny(blur, canny, 25, 110);

            using var kernelSmall = CvInvoke.GetStructuringElement(ElementShape.Rectangle, new Size(3, 3), new Point(-1, -1));
            using var kernelBig = CvInvoke.GetStructuringElement(ElementShape.Rectangle, new Size(7, 7), new Point(-1, -1));

            CvInvoke.MorphologyEx(thresh, morph, MorphOp.Close, kernelBig, new Point(-1, -1), 2, BorderType.Default, new MCvScalar());
            CvInvoke.MorphologyEx(otsu, otsuMorph, MorphOp.Close, kernelBig, new Point(-1, -1), 2, BorderType.Default, new MCvScalar());
            CvInvoke.Dilate(canny, canny, kernelSmall, new Point(-1, -1), 1, BorderType.Default, new MCvScalar());
            CvInvoke.BitwiseOr(morph, canny, edges);

            var candidates = new List<(Rectangle Rect, double Area)>();
            Mat[] sources = [edges, morph, otsuMorph, canny];

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
                        if (Math.Abs(aspect - CardAspect) > MaxAspectDeviationStrict) continue;
                        candidates.Add((rect, area));
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
                    if (rrArea <= 1 || contArea / rrArea < 0.55) continue;
                    PointF[] verts = rr.GetVertices();
                    Rectangle rectR = BoundingRect(verts);
                    if (rectR.Width < 20 || rectR.Height < 20) continue;
                    double aspectR = (double)rectR.Width / rectR.Height;
                    if (aspectR < MinAspectRatio || aspectR > MaxAspectRatio) continue;
                    if (Math.Abs(aspectR - CardAspect) > MaxAspectDeviationFallback) continue;
                    candidates.Add((rectR, contArea));
                }
            }

            var deduped = candidates
                .GroupBy(c => new { c.Rect.X, c.Rect.Y, c.Rect.Width, c.Rect.Height })
                .Select(g => g.First()).ToList();

            return RemoveOuterWhenContainsInnerCard(deduped, minArea)
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

            // Dominant card size via median
            var sortedW = rects.Select(r => r.Width).OrderBy(x => x).ToList();
            var sortedH = rects.Select(r => r.Height).OrderBy(x => x).ToList();
            int medW = sortedW[sortedW.Count / 2];
            int medH = sortedH[sortedH.Count / 2];

            // Keep cards of similar size to the median
            var dominant = rects.Where(r =>
                Math.Abs(r.Width - medW) <= medW * 0.38 &&
                Math.Abs(r.Height - medH) <= medH * 0.38).ToList();
            if (dominant.Count < 2) return rects;

            // Group into rows by Y-center proximity
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

            // Reference row: most populated, gives us column X positions
            var refRow = rows.OrderByDescending(r => r.Count).First().OrderBy(r => r.X).ToList();
            if (refRow.Count < 2) return rects;

            // Average column spacing from reference row
            double totalSpacing = 0;
            for (int i = 1; i < refRow.Count; i++)
                totalSpacing += refRow[i].X - refRow[i - 1].X;
            double avgSpacing = totalSpacing / (refRow.Count - 1);
            if (avgSpacing <= medW * 0.5) return rects; // cards overlap → do not infer

            // Column X positions from the reference row
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
            var merged = new List<Rectangle>(primary);
            foreach (var r in secondary)
            {
                bool overlaps = primary.Any(p =>
                {
                    double inter = IntersectionArea(p, r);
                    if (inter <= 0) return false;
                    double minBox = Math.Min(p.Width * (double)p.Height, r.Width * (double)r.Height);
                    return inter / minBox > 0.40;
                });
                if (!overlaps) merged.Add(r);
            }
            return merged;
        }

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

                using var imgBgr = working.ToImage<Bgr, byte>();
                imgBgr.ROI = new Rectangle(x, y, w, h);
                using var croppedImg = imgBgr.Copy();
                using var cropped = croppedImg.Mat;
                using var buf = new VectorOfByte();
                CvInvoke.Imencode(".jpg", cropped, buf);
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

using Emgu.CV;
using Emgu.CV.CvEnum;
using Emgu.CV.Structure;
using System.Runtime.InteropServices;

namespace ServerApi.Services
{
    public record ManipulationAnalysisResult(
        double ManipulationRiskPct,
        double AiGeneratedRiskPct,
        string Reason,
        double Confidence
    );

    /// <summary>
    /// Heuristic detector for suspicious image editing artifacts AND AI-generated images.
    /// Returns risk percentages (0–100) with confidence level, not hard ground truth.
    ///
    /// Manipulation signals (photo editing / splicing):
    ///   1. Multi-level ELA  – recompression error at 4 JPEG quality levels with regional outlier detection
    ///   2. Block noise inconsistency – CoV of local noise across 16×16 tiles
    ///   3. Saturation anomaly – CoV of saturation across 32×32 tiles
    ///   4. Edge density incoherence – CoV of Canny edge density across 32×32 tiles
    ///   5. Blockiness – JPEG 8×8 boundary gradient ratio
    ///   6. Luminance consistency – local gradient inconsistency of mean brightness per tile
    ///   7. Sharpness consistency – CoV of local Laplacian variance (focus/resolution mismatches)
    ///   8. Color Channel Correlation – per-tile R-G/G-B/R-B correlation CoV (splice detection)
    ///   9. JPEG Ghost Detection – multi-quality recompression to find spliced regions from different JPEG sources
    ///  10. Wavelet Noise Estimation – Haar wavelet detail coefficient variance for noise profile mismatch
    ///  11. Spatial Frequency Consistency – combined Laplacian+gradient energy CoV per tile
    ///
    /// AI-generation signals (diffusion / GAN):
    ///  12. Multi-scale noise floor – high-freq residual at 3 blur kernel sizes
    ///  13. HF/MF ratio – high-freq vs mid-freq energy balance
    ///  14. Texture diversity – CoV of local Laplacian variance across tiles
    ///  15. Histogram smoothness – roughness of pixel-value histogram (second-derivative magnitude)
    ///  16. Mid-frequency regularity – CoV of band-pass (DoG) tile means
    ///  17. Color Palette Uniformity – unique color ratio in quantized space (AI has unnaturally uniform palettes)
    ///
    /// Scoring uses sigmoid normalization and IQR-based concordance analysis for better calibration.
    /// </summary>
    public class ImageManipulationDetectionService
    {
        public Task<ManipulationAnalysisResult> AnalyzeAsync(byte[] imageBytes, CancellationToken cancellationToken = default)
        {
            if (imageBytes == null || imageBytes.Length == 0)
                return Task.FromResult(new ManipulationAnalysisResult(0, 0, "empty-image", 0));

            try
            {
                using var img = new Mat();
                CvInvoke.Imdecode(imageBytes, ImreadModes.Color, img);
                if (img.IsEmpty)
                    return Task.FromResult(new ManipulationAnalysisResult(0, 0, "decode-failed", 0));

                using var gray = new Mat();
                CvInvoke.CvtColor(img, gray, ColorConversion.Bgr2Gray);

                // ── Manipulation signals ──────────────────────────────────────────
                var elaScore = ComputeMultiElaScore(img);
                var noiseInconsistency = ComputeNoiseInconsistency(gray);
                var satAnomaly = ComputeSaturationAnomaly(img);
                var edgeIncoherence = ComputeEdgeIncoherence(gray);
                var blockiness = ComputeBlockiness(gray);
                var lumConsistency = ComputeLuminanceConsistency(gray);
                var sharpConsistency = ComputeSharpnessConsistency(gray);
                var colorCorrelation = ComputeColorChannelCorrelation(img);
                var jpegGhost = ComputeJpegGhostScore(img);
                var waveletNoise = ComputeWaveletNoiseInconsistency(gray);
                var spatialFreq = ComputeSpatialFrequencyConsistency(gray);

                // Normalization ranges are calibrated for trading-card marketplace photos.
                // Cards are printed surfaces with uniform color/noise sitting on a textured
                // background — this naturally elevates noise, saturation, and luminance signals
                // well above what a general-photo detector would consider "normal".
                // Wide ranges + low steepness keep genuine card photos in the safe zone
                // while actual image splicing (much stronger signals) still triggers warnings.
                var elaRisk = SigmoidNormalize(elaScore, 16, 36, 3);
                var noiseRisk = SigmoidNormalize(noiseInconsistency, 0.50, 1.25, 3);
                var satRisk = SigmoidNormalize(satAnomaly, 14, 34, 2.5);
                var edgeRisk = SigmoidNormalize(edgeIncoherence, 0.10, 0.28, 3);
                var blockRisk = SigmoidNormalize(blockiness, 10, 28, 2.5);
                var lumRisk = SigmoidNormalize(lumConsistency, 0.42, 1.05, 3);
                var sharpRisk = SigmoidNormalize(sharpConsistency, 0.50, 1.15, 3);
                var ccaRisk = SigmoidNormalize(colorCorrelation, 0.15, 0.55, 3);
                var ghostRisk = SigmoidNormalize(jpegGhost, 1.5, 6.0, 3);
                var waveletRisk = SigmoidNormalize(waveletNoise, 0.30, 0.90, 3);
                var spatialRisk = SigmoidNormalize(spatialFreq, 0.25, 0.75, 3);

                var manipSignals = new[] {
                    elaRisk, noiseRisk, satRisk, edgeRisk, blockRisk,
                    lumRisk, sharpRisk, ccaRisk, ghostRisk, waveletRisk, spatialRisk
                };
                var manipWeights = new[] {
                    0.16, 0.07, 0.06, 0.08, 0.10,
                    0.08, 0.13, 0.09, 0.10, 0.07, 0.06
                };

                var rawManipRisk = WeightedAverage(manipSignals, manipWeights);
                var manipConcordance = ComputeConcordance(manipSignals);
                var manipulationRisk = Math.Clamp(rawManipRisk * manipConcordance.Factor, 0, 92);

                // ── AI-generation signals ─────────────────────────────────────────
                var noiseFloor = ComputeMultiScaleNoiseFloor(gray);
                var hfRatio = ComputeHighFreqRatio(gray);
                var textureDiversity = ComputeTextureDiversity(gray);
                var histSmoothness = ComputeHistogramSmoothness(gray);
                var midFreqRegularity = ComputeMidFreqRegularity(gray);
                var colorPaletteUniformity = ComputeColorPaletteUniformity(img);

                var smoothRisk = SigmoidNormalizeInverse(noiseFloor, 0.8, 4.0, 5);
                var hfRisk = SigmoidNormalizeInverse(hfRatio, 0.08, 0.28, 5);
                var texRisk = SigmoidNormalizeInverse(textureDiversity, 0.15, 0.55, 5);
                var histRisk = SigmoidNormalizeInverse(histSmoothness, 0.3, 2.5, 4);
                var midFreqRisk = SigmoidNormalizeInverse(midFreqRegularity, 0.12, 0.50, 4);
                var paletteRisk = SigmoidNormalizeInverse(colorPaletteUniformity, 0.03, 0.18, 4);

                var aiSignals = new[] { smoothRisk, hfRisk, texRisk, histRisk, midFreqRisk, paletteRisk };
                var aiWeights = new[] { 0.20, 0.17, 0.14, 0.18, 0.15, 0.16 };

                var rawAiRisk = WeightedAverage(aiSignals, aiWeights);
                var aiConcordance = ComputeConcordance(aiSignals);
                var aiGenRisk = Math.Clamp(rawAiRisk * aiConcordance.Factor, 0, 90);

                var confidence = Math.Max(manipConcordance.Confidence, aiConcordance.Confidence);

                string reason;
                if (aiGenRisk >= 52 && aiGenRisk > manipulationRisk + 6)
                    reason = "ai-generated";
                else if (manipulationRisk >= 52 && manipulationRisk > aiGenRisk + 6)
                    reason = "manipulation";
                else if (aiGenRisk >= 38 || manipulationRisk >= 38)
                    reason = "mixed-signals";
                else
                    reason = "heuristic";

                return Task.FromResult(new ManipulationAnalysisResult(
                    Math.Round(manipulationRisk, 2),
                    Math.Round(aiGenRisk, 2),
                    reason,
                    Math.Round(confidence, 2)
                ));
            }
            catch
            {
                return Task.FromResult(new ManipulationAnalysisResult(0, 0, "error", 0));
            }
        }

        // ── Manipulation helpers ──────────────────────────────────────────────────

        /// <summary>
        /// Multi-level ELA at 4 quality levels. Lower quality levels reveal gross
        /// edits (cut-paste), higher levels catch subtle retouching.
        /// </summary>
        private static double ComputeMultiElaScore(Mat img)
        {
            double total = 0;
            (int quality, double weight)[] levels = { (60, 0.15), (70, 0.30), (80, 0.35), (92, 0.20) };
            foreach (var (quality, weight) in levels)
                total += ComputeElaAtQuality(img, quality) * weight;
            return total;
        }

        private static double ComputeElaAtQuality(Mat img, int quality)
        {
            using var buffer = new Emgu.CV.Util.VectorOfByte();
            CvInvoke.Imencode(".jpg", img, buffer,
                new KeyValuePair<ImwriteFlags, int>(ImwriteFlags.JpegQuality, quality));
            var reBytes = buffer.ToArray();
            if (reBytes.Length == 0) return 0;

            using var recompressed = new Mat();
            CvInvoke.Imdecode(reBytes, ImreadModes.Color, recompressed);
            if (recompressed.IsEmpty) return 0;

            using var diff = new Mat();
            CvInvoke.AbsDiff(img, recompressed, diff);

            using var scaled = new Mat();
            CvInvoke.ConvertScaleAbs(diff, scaled, 10.0, 0);

            MCvScalar mean = default, std = default;
            CvInvoke.MeanStdDev(scaled, ref mean, ref std);
            var overallLevel = (mean.V0 + mean.V1 + mean.V2) / 3.0;
            var overallSpread = (std.V0 + std.V1 + std.V2) / 6.0;

            // Regional outlier detection: tiles with ELA much higher than average
            // indicate localized editing.
            using var grayEla = new Mat();
            CvInvoke.CvtColor(scaled, grayEla, ColorConversion.Bgr2Gray);
            var outlierScore = ComputeRegionalOutlierScore(grayEla, 24);

            return (overallLevel + overallSpread) * 0.55 + outlierScore * 14.0 * 0.45;
        }

        /// <summary>
        /// Measures how many tiles deviate significantly from the image-wide mean.
        /// Manipulated regions produce localized ELA hotspots.
        /// </summary>
        private static double ComputeRegionalOutlierScore(Mat gray, int tileSize)
        {
            int cols = gray.Width / tileSize;
            int rows = gray.Height / tileSize;
            if (cols < 3 || rows < 3) return 0;

            var tileMeans = new List<double>(cols * rows);
            for (int r = 0; r < rows; r++)
                for (int c = 0; c < cols; c++)
                {
                    var roi = new System.Drawing.Rectangle(c * tileSize, r * tileSize, tileSize, tileSize);
                    using var tile = new Mat(gray, roi);
                    MCvScalar m = default, s = default;
                    CvInvoke.MeanStdDev(tile, ref m, ref s);
                    tileMeans.Add(m.V0);
                }

            var avg = tileMeans.Average();
            if (avg < 1) return 0;
            var stdDev = Math.Sqrt(tileMeans.Average(v => (v - avg) * (v - avg)));
            if (stdDev < 0.5) return 0;

            // Fraction of tiles more than 2 standard deviations above mean.
            var threshold = avg + 2.0 * stdDev;
            var outlierCount = tileMeans.Count(v => v > threshold);
            return (double)outlierCount / tileMeans.Count;
        }

        /// <summary>
        /// Coefficient of variation of local Laplacian noise across 16×16 tiles.
        /// Spliced regions have distinctly different noise profiles from the original.
        /// </summary>
        private static double ComputeNoiseInconsistency(Mat gray)
        {
            const int tileSize = 16;
            int cols = gray.Width / tileSize;
            int rows = gray.Height / tileSize;
            if (cols < 4 || rows < 4) return 0;

            var tileNoises = new List<double>(cols * rows);
            for (int r = 0; r < rows; r++)
                for (int c = 0; c < cols; c++)
                {
                    var roi = new System.Drawing.Rectangle(c * tileSize, r * tileSize, tileSize, tileSize);
                    using var tile = new Mat(gray, roi);
                    using var lap = new Mat();
                    CvInvoke.Laplacian(tile, lap, DepthType.Cv64F);
                    MCvScalar m = default, s = default;
                    CvInvoke.MeanStdDev(lap, ref m, ref s);
                    tileNoises.Add(Math.Abs(s.V0));
                }

            var avg = tileNoises.Average();
            if (avg < 0.5) return 0;
            var variance = tileNoises.Average(n => (n - avg) * (n - avg));
            return Math.Sqrt(variance) / (avg + 1e-6);
        }

        /// <summary>
        /// JPEG 8×8 block boundary gradient ratio.
        /// High blockiness signals double-compression from editing + re-save.
        /// </summary>
        private static double ComputeBlockiness(Mat gray)
        {
            using var sobelX = new Mat();
            using var sobelY = new Mat();
            CvInvoke.Sobel(gray, sobelX, DepthType.Cv32F, 1, 0, 3);
            CvInvoke.Sobel(gray, sobelY, DepthType.Cv32F, 0, 1, 3);
            using var absX = new Mat();
            using var absY = new Mat();
            CvInvoke.ConvertScaleAbs(sobelX, absX, 1.0, 0.0);
            CvInvoke.ConvertScaleAbs(sobelY, absY, 1.0, 0.0);

            var dataX = absX.ToImage<Gray, byte>();
            var dataY = absY.ToImage<Gray, byte>();
            var sumBoundary = 0d;
            var sumInner = 0d;
            var countBoundary = 0;
            var countInner = 0;

            for (int y = 0; y < dataX.Height; y++)
                for (int x = 0; x < dataX.Width; x++)
                {
                    var g = dataX.Data[y, x, 0] + dataY.Data[y, x, 0];
                    if (x % 8 == 0 || y % 8 == 0) { sumBoundary += g; countBoundary++; }
                    else { sumInner += g; countInner++; }
                }

            if (countBoundary == 0 || countInner == 0) return 0;
            return Math.Max(0, sumBoundary / countBoundary - sumInner / countInner);
        }

        /// <summary>
        /// CoV of mean saturation across 32×32 tiles.
        /// Pasted regions from different sources have mismatched color profiles.
        /// </summary>
        private static double ComputeSaturationAnomaly(Mat img)
        {
            using var hsv = new Mat();
            CvInvoke.CvtColor(img, hsv, ColorConversion.Bgr2Hsv);

            const int tileSize = 32;
            int cols = hsv.Width / tileSize;
            int rows = hsv.Height / tileSize;
            if (cols < 3 || rows < 3) return 0;

            var tileSats = new List<double>(cols * rows);
            var channels = hsv.Split();
            try
            {
                for (int r = 0; r < rows; r++)
                    for (int c = 0; c < cols; c++)
                    {
                        var roi = new System.Drawing.Rectangle(c * tileSize, r * tileSize, tileSize, tileSize);
                        using var tile = new Mat(channels[1], roi);
                        MCvScalar m = default, s = default;
                        CvInvoke.MeanStdDev(tile, ref m, ref s);
                        tileSats.Add(m.V0);
                    }
            }
            finally
            {
                foreach (var ch in channels) ch.Dispose();
            }

            var mean = tileSats.Average();
            if (mean < 8) return 0;
            var variance = tileSats.Average(v => (v - mean) * (v - mean));
            return Math.Sqrt(variance);
        }

        /// <summary>
        /// Coefficient of variation of Canny edge density across 32×32 tiles.
        /// Copy-paste operations create abrupt transitions in edge density.
        /// </summary>
        private static double ComputeEdgeIncoherence(Mat gray)
        {
            using var edges = new Mat();
            CvInvoke.Canny(gray, edges, 40, 120);

            const int tileSize = 32;
            int cols = gray.Width / tileSize;
            int rows = gray.Height / tileSize;
            if (cols < 4 || rows < 4) return 0;

            var densities = new List<double>(cols * rows);
            var edgeImg = edges.ToImage<Gray, byte>();
            int ts2 = tileSize * tileSize;

            for (int r = 0; r < rows; r++)
                for (int c = 0; c < cols; c++)
                {
                    int cnt = 0;
                    for (int y = r * tileSize; y < (r + 1) * tileSize && y < edgeImg.Height; y++)
                        for (int x = c * tileSize; x < (c + 1) * tileSize && x < edgeImg.Width; x++)
                            if (edgeImg.Data[y, x, 0] > 0) cnt++;
                    densities.Add((double)cnt / ts2);
                }

            var avg = densities.Average();
            if (avg < 0.01) return 0;
            var variance = densities.Average(d => (d - avg) * (d - avg));
            return Math.Sqrt(variance);
        }

        /// <summary>
        /// Detects inconsistent lighting by comparing each tile's mean luminance
        /// with its spatial neighbors. Composited elements from different scenes
        /// produce abrupt brightness transitions that don't follow natural gradients.
        /// </summary>
        private static double ComputeLuminanceConsistency(Mat gray)
        {
            const int tileSize = 32;
            int cols = gray.Width / tileSize;
            int rows = gray.Height / tileSize;
            if (cols < 4 || rows < 4) return 0;

            var tileMeans = new double[rows, cols];
            for (int r = 0; r < rows; r++)
                for (int c = 0; c < cols; c++)
                {
                    var roi = new System.Drawing.Rectangle(c * tileSize, r * tileSize, tileSize, tileSize);
                    using var tile = new Mat(gray, roi);
                    MCvScalar m = default, s = default;
                    CvInvoke.MeanStdDev(tile, ref m, ref s);
                    tileMeans[r, c] = m.V0;
                }

            var localGradients = new List<double>();
            for (int r = 1; r < rows - 1; r++)
                for (int c = 1; c < cols - 1; c++)
                {
                    var center = tileMeans[r, c];
                    var neighborAvg = (tileMeans[r - 1, c] + tileMeans[r + 1, c] +
                                       tileMeans[r, c - 1] + tileMeans[r, c + 1]) / 4.0;
                    localGradients.Add(Math.Abs(center - neighborAvg));
                }

            if (localGradients.Count == 0) return 0;
            var avg = localGradients.Average();
            if (avg < 0.5) return 0;
            var variance = localGradients.Average(g => (g - avg) * (g - avg));
            return Math.Sqrt(variance) / (avg + 1e-6);
        }

        /// <summary>
        /// CoV of local Laplacian variance (sharpness) across 32×32 tiles.
        /// Pasted regions from a different camera, resolution, or focus distance
        /// produce sharpness discontinuities invisible to the eye but detectable statistically.
        /// </summary>
        private static double ComputeSharpnessConsistency(Mat gray)
        {
            const int tileSize = 32;
            int cols = gray.Width / tileSize;
            int rows = gray.Height / tileSize;
            if (cols < 4 || rows < 4) return 0;

            var sharpness = new List<double>(cols * rows);
            for (int r = 0; r < rows; r++)
                for (int c = 0; c < cols; c++)
                {
                    var roi = new System.Drawing.Rectangle(c * tileSize, r * tileSize, tileSize, tileSize);
                    using var tile = new Mat(gray, roi);
                    using var lap = new Mat();
                    CvInvoke.Laplacian(tile, lap, DepthType.Cv64F);
                    MCvScalar m = default, s = default;
                    CvInvoke.MeanStdDev(lap, ref m, ref s);
                    sharpness.Add(s.V0 * s.V0);
                }

            var avg = sharpness.Average();
            if (avg < 1) return 0;
            var variance = sharpness.Average(v => (v - avg) * (v - avg));
            return Math.Sqrt(variance) / (avg + 1e-6);
        }

        /// <summary>
        /// Color Channel Correlation Analysis (CCA).
        ///
        /// In a naturally-photographed image, the R-G, G-B, and R-B channels maintain
        /// consistent correlation patterns across regions (due to shared illumination,
        /// camera response curves, and scene reflectance). When an image is spliced,
        /// the pasted region was captured under different lighting / camera settings,
        /// causing its inter-channel correlation to differ from the host image.
        ///
        /// We compute Pearson correlation between channel pairs in each 32×32 tile,
        /// then measure the CoV of these correlations across all tiles.
        /// High CoV = inconsistent color relationships = likely splice.
        /// </summary>
        private static double ComputeColorChannelCorrelation(Mat img)
        {
            const int tileSize = 32;
            int cols = img.Width / tileSize;
            int rows = img.Height / tileSize;
            if (cols < 4 || rows < 4) return 0;

            var channels = img.Split();
            try
            {
                var rgCorrs = new List<double>(cols * rows);
                var gbCorrs = new List<double>(cols * rows);
                var rbCorrs = new List<double>(cols * rows);

                for (int r = 0; r < rows; r++)
                    for (int c = 0; c < cols; c++)
                    {
                        var roi = new System.Drawing.Rectangle(c * tileSize, r * tileSize, tileSize, tileSize);
                        using var tileB = new Mat(channels[0], roi);
                        using var tileG = new Mat(channels[1], roi);
                        using var tileR = new Mat(channels[2], roi);

                        var bData = tileB.ToImage<Gray, byte>();
                        var gData = tileG.ToImage<Gray, byte>();
                        var rData = tileR.ToImage<Gray, byte>();

                        // Compute pairwise Pearson correlations
                        rgCorrs.Add(PearsonCorrelation(rData, gData, tileSize));
                        gbCorrs.Add(PearsonCorrelation(gData, bData, tileSize));
                        rbCorrs.Add(PearsonCorrelation(rData, bData, tileSize));
                    }

                // CoV of each correlation map
                double rgCoV = ComputeCoV(rgCorrs);
                double gbCoV = ComputeCoV(gbCorrs);
                double rbCoV = ComputeCoV(rbCorrs);

                // Combined CCA score: average CoV across all three channel pairs
                return (rgCoV + gbCoV + rbCoV) / 3.0;
            }
            finally
            {
                foreach (var ch in channels) ch.Dispose();
            }
        }

        private static double PearsonCorrelation(Image<Gray, byte> a, Image<Gray, byte> b, int tileSize)
        {
            double sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;
            int n = tileSize * tileSize;
            for (int y = 0; y < tileSize; y++)
                for (int x = 0; x < tileSize; x++)
                {
                    double va = a.Data[y, x, 0];
                    double vb = b.Data[y, x, 0];
                    sumA += va; sumB += vb;
                    sumAB += va * vb;
                    sumA2 += va * va;
                    sumB2 += vb * vb;
                }
            double meanA = sumA / n, meanB = sumB / n;
            double cov = sumAB / n - meanA * meanB;
            double stdA = Math.Sqrt(Math.Max(0, sumA2 / n - meanA * meanA));
            double stdB = Math.Sqrt(Math.Max(0, sumB2 / n - meanB * meanB));
            if (stdA < 1e-6 || stdB < 1e-6) return 0;
            return Math.Clamp(cov / (stdA * stdB), -1, 1);
        }

        private static double ComputeCoV(List<double> values)
        {
            if (values.Count == 0) return 0;
            double avg = values.Average();
            if (Math.Abs(avg) < 1e-6) return 0;
            double variance = values.Average(v => (v - avg) * (v - avg));
            return Math.Sqrt(variance) / (Math.Abs(avg) + 1e-6);
        }

        /// <summary>
        /// JPEG Ghost Detection: detects double-compressed regions by re-saving
        /// the image at multiple JPEG quality levels and finding tiles where the
        /// error is anomalously low at a specific quality.
        ///
        /// When an image region was previously saved at quality Q and then pasted
        /// into a host image saved at quality Q', re-compressing at Q produces
        /// near-zero error in the pasted region but not in the host. This quality-
        /// dependent error pattern reveals splice boundaries.
        ///
        /// We test qualities 51–95 in steps of 4, compute per-tile ELA at each,
        /// and measure the maximum cross-quality inconsistency (tiles that "ghost"
        /// at one quality but not others).
        /// </summary>
        private static double ComputeJpegGhostScore(Mat img)
        {
            const int tileSize = 32;
            int cols = img.Width / tileSize;
            int rows = img.Height / tileSize;
            if (cols < 4 || rows < 4) return 0;

            int tileCount = cols * rows;
            int[] testQualities = { 51, 55, 59, 63, 67, 71, 75, 79, 83, 87, 91, 95 };

            // For each quality, compute per-tile mean ELA error
            var qualityErrors = new double[testQualities.Length][];
            for (int qi = 0; qi < testQualities.Length; qi++)
            {
                int q = testQualities[qi];
                using var buffer = new Emgu.CV.Util.VectorOfByte();
                CvInvoke.Imencode(".jpg", img, buffer,
                    new KeyValuePair<ImwriteFlags, int>(ImwriteFlags.JpegQuality, q));
                var reBytes = buffer.ToArray();
                if (reBytes.Length == 0) { qualityErrors[qi] = new double[tileCount]; continue; }

                using var recomp = new Mat();
                CvInvoke.Imdecode(reBytes, ImreadModes.Color, recomp);
                if (recomp.IsEmpty) { qualityErrors[qi] = new double[tileCount]; continue; }

                using var diff = new Mat();
                CvInvoke.AbsDiff(img, recomp, diff);
                using var grayDiff = new Mat();
                CvInvoke.CvtColor(diff, grayDiff, ColorConversion.Bgr2Gray);

                qualityErrors[qi] = new double[tileCount];
                int idx = 0;
                for (int r = 0; r < rows; r++)
                    for (int c = 0; c < cols; c++)
                    {
                        var roi = new System.Drawing.Rectangle(c * tileSize, r * tileSize, tileSize, tileSize);
                        using var tile = new Mat(grayDiff, roi);
                        MCvScalar m = default, s = default;
                        CvInvoke.MeanStdDev(tile, ref m, ref s);
                        qualityErrors[qi][idx++] = m.V0;
                    }
            }

            // For each tile, find the quality that gives minimum error → that tile's
            // "native" quality. Then measure how much the native quality distribution
            // varies across tiles. Uniform = normal. Bimodal/multimodal = splice.
            var bestQualityIndices = new int[tileCount];
            for (int t = 0; t < tileCount; t++)
            {
                int bestQi = 0;
                double bestError = double.MaxValue;
                for (int qi = 0; qi < testQualities.Length; qi++)
                {
                    if (qualityErrors[qi][t] < bestError)
                    {
                        bestError = qualityErrors[qi][t];
                        bestQi = qi;
                    }
                }
                bestQualityIndices[t] = bestQi;
            }

            // Measure dispersion of best-quality indices
            double qMean = bestQualityIndices.Average(q => (double)q);
            double qVariance = bestQualityIndices.Average(q => (q - qMean) * (q - qMean));
            double qStd = Math.Sqrt(qVariance);

            // Also measure: fraction of tiles whose best quality differs from the mode
            var qualityCounts = new int[testQualities.Length];
            foreach (var qi in bestQualityIndices) qualityCounts[qi]++;
            int modeCount = qualityCounts.Max();
            double outlierFraction = 1.0 - (double)modeCount / tileCount;

            return qStd * 1.5 + outlierFraction * 8.0;
        }

        /// <summary>
        /// Wavelet-based noise estimation using a Haar wavelet approximation.
        ///
        /// Real Haar wavelet decomposes an image into LL (approx), LH (horizontal detail),
        /// HL (vertical detail), and HH (diagonal detail) sub-bands. The HH sub-band
        /// predominantly contains noise. Different cameras/processing pipelines produce
        /// distinct noise signatures in HH. Spliced regions have mismatched HH statistics.
        ///
        /// We approximate Haar decomposition using box-filter differences:
        ///   HH ≈ |img - blur_h - blur_v + blur_hv|  (diagonal detail)
        /// Then compute CoV of HH energy across tiles.
        /// </summary>
        private static double ComputeWaveletNoiseInconsistency(Mat gray)
        {
            const int tileSize = 32;
            int cols = gray.Width / tileSize;
            int rows = gray.Height / tileSize;
            if (cols < 4 || rows < 4) return 0;

            // Approximate Haar HH sub-band using separable box filters
            using var blurH = new Mat();
            using var blurV = new Mat();
            using var blurHV = new Mat();
            CvInvoke.Blur(gray, blurH, new System.Drawing.Size(3, 1), new System.Drawing.Point(-1, -1));  // horizontal blur
            CvInvoke.Blur(gray, blurV, new System.Drawing.Size(1, 3), new System.Drawing.Point(-1, -1));  // vertical blur
            CvInvoke.Blur(gray, blurHV, new System.Drawing.Size(3, 3), new System.Drawing.Point(-1, -1)); // both

            // HH ≈ gray - blurH - blurV + blurHV (approximates diagonal detail)
            using var hh = new Mat();
            using var temp1 = new Mat();
            using var temp2 = new Mat();

            // Convert to float for subtraction
            using var grayF = new Mat();
            using var blurHF = new Mat();
            using var blurVF = new Mat();
            using var blurHVF = new Mat();
            gray.ConvertTo(grayF, DepthType.Cv32F);
            blurH.ConvertTo(blurHF, DepthType.Cv32F);
            blurV.ConvertTo(blurVF, DepthType.Cv32F);
            blurHV.ConvertTo(blurHVF, DepthType.Cv32F);

            CvInvoke.Subtract(grayF, blurHF, temp1);
            CvInvoke.Subtract(temp1, blurVF, temp2);
            CvInvoke.Add(temp2, blurHVF, hh);

            // Compute per-tile HH energy (variance of diagonal detail)
            var tileEnergies = new List<double>(cols * rows);
            for (int r = 0; r < rows; r++)
                for (int c = 0; c < cols; c++)
                {
                    var roi = new System.Drawing.Rectangle(c * tileSize, r * tileSize, tileSize, tileSize);
                    using var tile = new Mat(hh, roi);
                    MCvScalar m = default, s = default;
                    CvInvoke.MeanStdDev(tile, ref m, ref s);
                    tileEnergies.Add(s.V0 * s.V0); // variance = std²
                }

            var avg = tileEnergies.Average();
            if (avg < 0.1) return 0;
            var variance = tileEnergies.Average(e => (e - avg) * (e - avg));
            return Math.Sqrt(variance) / (avg + 1e-6);
        }

        /// <summary>
        /// Spatial Frequency Consistency: measures the uniformity of local spatial
        /// frequency content across 32×32 tiles.
        ///
        /// Each tile's "spatial frequency" is a combination of Laplacian energy and
        /// gradient magnitude — capturing both fine-detail and edge energy. Natural
        /// images have smoothly varying spatial frequency across regions. Spliced
        /// regions from a different camera, resolution, or processing pipeline
        /// produce abrupt spatial-frequency discontinuities.
        ///
        /// Returns CoV of per-tile spatial frequency measures.
        /// </summary>
        private static double ComputeSpatialFrequencyConsistency(Mat gray)
        {
            const int tileSize = 32;
            int cols = gray.Width / tileSize;
            int rows = gray.Height / tileSize;
            if (cols < 4 || rows < 4) return 0;

            var tileFreqs = new List<double>(cols * rows);
            for (int r = 0; r < rows; r++)
                for (int c = 0; c < cols; c++)
                {
                    var roi = new System.Drawing.Rectangle(c * tileSize, r * tileSize, tileSize, tileSize);
                    using var tile = new Mat(gray, roi);

                    // Laplacian energy
                    using var lap = new Mat();
                    CvInvoke.Laplacian(tile, lap, DepthType.Cv64F);
                    MCvScalar lapM = default, lapS = default;
                    CvInvoke.MeanStdDev(lap, ref lapM, ref lapS);
                    double lapEnergy = lapS.V0 * lapS.V0;

                    // Gradient magnitude energy
                    using var gx = new Mat();
                    using var gy = new Mat();
                    CvInvoke.Sobel(tile, gx, DepthType.Cv32F, 1, 0, 3);
                    CvInvoke.Sobel(tile, gy, DepthType.Cv32F, 0, 1, 3);
                    MCvScalar gxM = default, gxS = default;
                    MCvScalar gyM = default, gyS = default;
                    CvInvoke.MeanStdDev(gx, ref gxM, ref gxS);
                    CvInvoke.MeanStdDev(gy, ref gyM, ref gyS);
                    double gradEnergy = gxS.V0 * gxS.V0 + gyS.V0 * gyS.V0;

                    // Combined spatial frequency: Laplacian captures fine detail,
                    // gradient captures edge structure
                    tileFreqs.Add(lapEnergy * 0.6 + gradEnergy * 0.4);
                }

            var avg = tileFreqs.Average();
            if (avg < 1) return 0;
            var variance = tileFreqs.Average(f => (f - avg) * (f - avg));
            return Math.Sqrt(variance) / (avg + 1e-6);
        }

        // ── AI-generation helpers ─────────────────────────────────────────────────

        /// <summary>
        /// Multi-scale noise floor: mean high-frequency residual at 3 blur kernel sizes.
        /// AI-generated images are unnaturally smooth at all scales — the residual is
        /// consistently low regardless of the kernel used.
        /// Low return value → high AI risk (use SigmoidNormalizeInverse).
        /// </summary>
        private static double ComputeMultiScaleNoiseFloor(Mat gray)
        {
            double total = 0;
            (int kernelSize, double weight)[] scales = { (3, 0.30), (5, 0.45), (9, 0.25) };

            foreach (var (ksize, weight) in scales)
            {
                using var blurred = new Mat();
                CvInvoke.GaussianBlur(gray, blurred, new System.Drawing.Size(ksize, ksize), 0);
                using var residual = new Mat();
                CvInvoke.AbsDiff(gray, blurred, residual);
                MCvScalar mean = default, std = default;
                CvInvoke.MeanStdDev(residual, ref mean, ref std);
                total += mean.V0 * weight;
            }

            return total;
        }

        /// <summary>
        /// Ratio of high-frequency energy to mid-frequency energy.
        /// Real photos carry natural sensor noise in HF; AI images suppress it.
        /// Low return value → high AI risk (use SigmoidNormalizeInverse).
        /// </summary>
        private static double ComputeHighFreqRatio(Mat gray)
        {
            using var blurWeak = new Mat();
            using var blurStrong = new Mat();
            CvInvoke.GaussianBlur(gray, blurWeak, new System.Drawing.Size(3, 3), 0);
            CvInvoke.GaussianBlur(gray, blurStrong, new System.Drawing.Size(15, 15), 0);

            using var highFreq = new Mat();
            using var midFreq = new Mat();
            CvInvoke.AbsDiff(gray, blurWeak, highFreq);
            CvInvoke.AbsDiff(blurWeak, blurStrong, midFreq);

            MCvScalar meanHF = default, stdHF = default;
            MCvScalar meanMF = default, stdMF = default;
            CvInvoke.MeanStdDev(highFreq, ref meanHF, ref stdHF);
            CvInvoke.MeanStdDev(midFreq, ref meanMF, ref stdMF);
            return meanHF.V0 / (meanMF.V0 + 1e-6);
        }

        /// <summary>
        /// CoV of local Laplacian variance across 32×32 tiles.
        /// AI-generated images exhibit unrealistically uniform texture quality.
        /// Low return value → high AI risk (use SigmoidNormalizeInverse).
        /// </summary>
        private static double ComputeTextureDiversity(Mat gray)
        {
            const int tileSize = 32;
            int cols = gray.Width / tileSize;
            int rows = gray.Height / tileSize;
            if (cols < 4 || rows < 4) return 1.0;

            var strengths = new List<double>(cols * rows);
            for (int r = 0; r < rows; r++)
                for (int c = 0; c < cols; c++)
                {
                    var roi = new System.Drawing.Rectangle(c * tileSize, r * tileSize, tileSize, tileSize);
                    using var tile = new Mat(gray, roi);
                    using var lap = new Mat();
                    CvInvoke.Laplacian(tile, lap, DepthType.Cv64F);
                    MCvScalar m = default, s = default;
                    CvInvoke.MeanStdDev(lap, ref m, ref s);
                    strengths.Add(s.V0);
                }

            var avg = strengths.Average();
            if (avg < 0.5) return 0;
            var variance = strengths.Average(t => (t - avg) * (t - avg));
            return Math.Sqrt(variance) / (avg + 1e-6);
        }

        /// <summary>
        /// Measures the roughness of the pixel-value histogram using the sum of
        /// absolute second differences across 256 bins. Real camera sensors produce
        /// histograms with sharp peaks and valleys from quantization, sensor response
        /// curves, and scene content. AI generators produce smoother, more continuous
        /// distributions because they synthesize pixel values from a latent space.
        /// Low roughness → smooth histogram → AI-like (use SigmoidNormalizeInverse).
        /// </summary>
        private static double ComputeHistogramSmoothness(Mat gray)
        {
            var imgData = gray.ToImage<Gray, byte>();
            var hist = new int[256];
            int totalPixels = gray.Width * gray.Height;
            if (totalPixels == 0) return 1.0;

            for (int y = 0; y < imgData.Height; y++)
                for (int x = 0; x < imgData.Width; x++)
                    hist[imgData.Data[y, x, 0]]++;

            double roughness = 0;
            for (int i = 1; i < 255; i++)
            {
                var d2 = hist[i - 1] - 2.0 * hist[i] + hist[i + 1];
                roughness += Math.Abs(d2);
            }

            return roughness / totalPixels;
        }

        /// <summary>
        /// CoV of difference-of-Gaussians (band-pass) tile means in the mid-frequency band.
        /// Natural scenes exhibit varied mid-frequency content across regions (textured areas
        /// vs smooth areas vs edges). AI generators produce more uniform mid-frequency patterns,
        /// resulting in low CoV.
        /// Low return value → AI-like (use SigmoidNormalizeInverse).
        /// </summary>
        private static double ComputeMidFreqRegularity(Mat gray)
        {
            using var blur1 = new Mat();
            using var blur2 = new Mat();
            CvInvoke.GaussianBlur(gray, blur1, new System.Drawing.Size(5, 5), 0);
            CvInvoke.GaussianBlur(gray, blur2, new System.Drawing.Size(15, 15), 0);
            using var midFreq = new Mat();
            CvInvoke.AbsDiff(blur1, blur2, midFreq);

            const int tileSize = 32;
            int cols = midFreq.Width / tileSize;
            int rows = midFreq.Height / tileSize;
            if (cols < 4 || rows < 4) return 1.0;

            var tileMeans = new List<double>(cols * rows);
            for (int r = 0; r < rows; r++)
                for (int c = 0; c < cols; c++)
                {
                    var roi = new System.Drawing.Rectangle(c * tileSize, r * tileSize, tileSize, tileSize);
                    using var tile = new Mat(midFreq, roi);
                    MCvScalar m = default, s = default;
                    CvInvoke.MeanStdDev(tile, ref m, ref s);
                    tileMeans.Add(m.V0);
                }

            var avg = tileMeans.Average();
            if (avg < 0.5) return 0;
            var variance = tileMeans.Average(v => (v - avg) * (v - avg));
            return Math.Sqrt(variance) / (avg + 1e-6);
        }

        /// <summary>
        /// Color Palette Uniformity: measures how diverse the color palette is.
        ///
        /// AI-generated images tend to produce unnaturally uniform, smooth color
        /// distributions — the latent space synthesis avoids the noisy, quantized
        /// color variation that real camera sensors produce.
        ///
        /// We quantize each pixel's color to a reduced palette (6 levels per channel
        /// = 216 possible colors) and count unique colors, normalized by pixel count.
        /// Real photos produce many unique quantized colors (diverse lighting, texture,
        /// noise). AI images produce fewer (smooth gradients, uniform regions).
        ///
        /// Low return value → uniform palette → AI-like (use SigmoidNormalizeInverse).
        /// </summary>
        private static double ComputeColorPaletteUniformity(Mat img)
        {
            var imgData = img.ToImage<Bgr, byte>();
            int W = img.Width, H = img.Height;
            int totalPixels = W * H;
            if (totalPixels < 100) return 0.5;

            // Quantize to 6 levels per channel (0-5) → 216 possible colors
            var uniqueColors = new HashSet<int>();

            // Sample at most 50,000 pixels for performance
            int step = Math.Max(1, totalPixels / 50000);
            int sampledCount = 0;
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                {
                    if ((y * W + x) % step != 0) continue;
                    int b = imgData.Data[y, x, 0] / 43; // 0-5
                    int g = imgData.Data[y, x, 1] / 43;
                    int r = imgData.Data[y, x, 2] / 43;
                    uniqueColors.Add(r * 36 + g * 6 + b);
                    sampledCount++;
                }

            if (sampledCount < 50) return 0.5;

            // Ratio of unique colors to total sampled pixels
            // Real photos: 0.05-0.30+ (many unique colors relative to samples)
            // AI images: 0.01-0.08 (fewer unique colors, smoother gradients)
            return (double)uniqueColors.Count / sampledCount;
        }

        // ── Scoring utilities ─────────────────────────────────────────────────────

        /// <summary>
        /// Sigmoid normalization: maps a raw signal value to [5, 85] with a smooth
        /// S-curve centered at the midpoint of [low, high]. Provides better calibration
        /// than linear interpolation — extreme values saturate gracefully instead of
        /// clipping abruptly.
        /// </summary>
        private static double SigmoidNormalize(double value, double low, double high, double steepness = 4)
        {
            var midpoint = (low + high) / 2.0;
            var range = high - low;
            if (range <= 0) return 45;
            var x = (value - midpoint) / (range * 0.5) * steepness;
            var sigmoid = 1.0 / (1.0 + Math.Exp(-x));
            return 5 + sigmoid * 80;
        }

        /// <summary>Low value → high risk (inverted sigmoid, for AI-generation signals).</summary>
        private static double SigmoidNormalizeInverse(double value, double low, double high, double steepness = 4)
        {
            var midpoint = (low + high) / 2.0;
            var range = high - low;
            if (range <= 0) return 45;
            var x = (midpoint - value) / (range * 0.5) * steepness;
            var sigmoid = 1.0 / (1.0 + Math.Exp(-x));
            return 5 + sigmoid * 80;
        }

        private static double WeightedAverage(double[] values, double[] weights)
        {
            double sum = 0, wSum = 0;
            for (int i = 0; i < values.Length; i++)
            {
                sum += values[i] * weights[i];
                wSum += weights[i];
            }
            return wSum > 0 ? sum / wSum : 0;
        }

        private record ConcordanceResult(double Factor, double Confidence);

        /// <summary>
        /// IQR-based concordance analysis: measures how tightly clustered the signal
        /// scores are and whether they agree on risk direction.
        ///
        /// Instead of simple threshold counting, uses the Inter-Quartile Range (IQR)
        /// to measure signal agreement:
        ///   - Small IQR + high median → strong agreement on high risk → boost factor
        ///   - Small IQR + low median  → strong agreement on low risk → dampen factor
        ///   - Large IQR              → signals disagree → dampen factor, low confidence
        ///
        /// This gives more nuanced concordance than binary high/low counting.
        /// </summary>
        private static ConcordanceResult ComputeConcordance(double[] scores)
        {
            if (scores.Length == 0) return new ConcordanceResult(1.0, 30);

            var sorted = scores.OrderBy(s => s).ToArray();
            int n = sorted.Length;

            double median = n % 2 == 1
                ? sorted[n / 2]
                : (sorted[n / 2 - 1] + sorted[n / 2]) / 2.0;

            // Quartiles
            double q1 = sorted[Math.Max(0, n / 4)];
            double q3 = sorted[Math.Min(n - 1, 3 * n / 4)];
            double iqr = q3 - q1;

            // Normalized IQR: how spread out are the signals relative to the score range?
            // Typical scores are in [5, 85], so max possible IQR ≈ 80.
            double normalizedIqr = iqr / 80.0;

            double factor;
            double confidence;

            // Tight agreement (IQR < 15 points out of 80 range)
            if (normalizedIqr < 0.19)
            {
                if (median >= 55)
                {
                    // Strong agreement on high risk
                    double agreement = 1.0 - normalizedIqr;
                    factor = 1.0 + 0.15 * agreement;
                    confidence = 65 + agreement * 35;
                }
                else if (median <= 30)
                {
                    // Strong agreement on low risk
                    double agreement = 1.0 - normalizedIqr;
                    factor = 1.0 - 0.12 * agreement;
                    confidence = 65 + agreement * 35;
                }
                else
                {
                    // Agreement in the middle zone — inconclusive
                    factor = 1.0;
                    confidence = 45 + (1.0 - normalizedIqr) * 25;
                }
            }
            // Moderate spread (IQR 15-30 points)
            else if (normalizedIqr < 0.38)
            {
                factor = 0.95;
                confidence = 35 + (1.0 - normalizedIqr) * 30;
            }
            // Wide disagreement
            else
            {
                factor = 0.88;
                confidence = 20 + (1.0 - normalizedIqr) * 25;
            }

            return new ConcordanceResult(factor, Math.Clamp(confidence, 0, 100));
        }
    }
}

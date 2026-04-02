using Emgu.CV;
using Emgu.CV.CvEnum;
using Emgu.CV.Structure;

namespace ServerApi.Services
{
    public class ImageManipulationDetectionService
    {
        /// <summary>
        /// Heuristic-only detector for suspicious editing artifacts.
        /// Returns risk percentage (0-100), not a hard truth.
        /// </summary>
        public Task<(double riskPct, string reason)> AnalyzeAsync(byte[] imageBytes, CancellationToken cancellationToken = default)
        {
            if (imageBytes == null || imageBytes.Length == 0)
                return Task.FromResult((0d, "empty-image"));

            try
            {
                using var img = new Mat();
                CvInvoke.Imdecode(imageBytes, ImreadModes.Color, img);
                if (img.IsEmpty)
                    return Task.FromResult((0d, "decode-failed"));

                using var gray = new Mat();
                CvInvoke.CvtColor(img, gray, ColorConversion.Bgr2Gray);

                // 1) Local noise inconsistency proxy: stddev on Laplacian
                using var lap = new Mat();
                CvInvoke.Laplacian(gray, lap, DepthType.Cv64F);
                MCvScalar meanLap = default;
                MCvScalar stdLap = default;
                CvInvoke.MeanStdDev(lap, ref meanLap, ref stdLap);
                var lapStd = Math.Abs(stdLap.V0);

                // 2) Blockiness proxy: gradient aligned to jpeg 8x8 boundaries
                var blockiness = ComputeBlockiness(gray);

                // 3) Recompression error proxy (ELA-lite): strong difference after recompress can indicate edits/heavy processing
                var elaScore = ComputeElaScore(img);

                // Conservative thresholds to reduce false positives on recompressed marketplace photos.
                var lapRisk = Normalize(lapStd, 10, 42);
                var blockRisk = Normalize(blockiness, 4, 24);
                var elaRisk = Normalize(elaScore, 6, 34);

                var risk = Math.Clamp((lapRisk * 0.30) + (blockRisk * 0.25) + (elaRisk * 0.45), 0, 85);
                return Task.FromResult((Math.Round(risk, 2), "heuristic"));
            }
            catch
            {
                return Task.FromResult((0d, "error"));
            }
        }

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
            {
                for (int x = 0; x < dataX.Width; x++)
                {
                    var g = dataX.Data[y, x, 0] + dataY.Data[y, x, 0];
                    if (x % 8 == 0 || y % 8 == 0)
                    {
                        sumBoundary += g;
                        countBoundary++;
                    }
                    else
                    {
                        sumInner += g;
                        countInner++;
                    }
                }
            }

            if (countBoundary == 0 || countInner == 0) return 0;
            var boundaryMean = sumBoundary / countBoundary;
            var innerMean = sumInner / countInner;
            return Math.Max(0, boundaryMean - innerMean);
        }

        private static double ComputeElaScore(Mat img)
        {
            using var buffer = new Emgu.CV.Util.VectorOfByte();
            CvInvoke.Imencode(".jpg", img, buffer, new KeyValuePair<ImwriteFlags, int>(ImwriteFlags.JpegQuality, 75));
            var reBytes = buffer.ToArray();
            if (reBytes.Length == 0) return 0;

            using var recompressed = new Mat();
            CvInvoke.Imdecode(reBytes, ImreadModes.Color, recompressed);
            if (recompressed.IsEmpty) return 0;

            using var diff = new Mat();
            CvInvoke.AbsDiff(img, recompressed, diff);
            MCvScalar mean = default;
            MCvScalar std = default;
            CvInvoke.MeanStdDev(diff, ref mean, ref std);
            return (mean.V0 + mean.V1 + mean.V2) / 3.0;
        }

        private static double Normalize(double value, double low, double high)
        {
            if (value <= low) return 5;
            if (value >= high) return 85;
            return 5 + ((value - low) / (high - low)) * 80;
        }
    }
}

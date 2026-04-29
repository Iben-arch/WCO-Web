using Emgu.CV;
using Emgu.CV.CvEnum;
using Emgu.CV.Structure;

namespace ServerApi.Services
{
    // ═══════════════════════════════════════════════════════════════════════════
    // Result Types
    // ═══════════════════════════════════════════════════════════════════════════

    /// <summary>
    /// เก็บค่า Risk ของแต่ละ Signal (ใช้สำหรับ Debug)
    /// ค่าแต่ละตัวอยู่ในช่วง 0–100 (Sigmoid Normalised)
    /// </summary>
    public record SignalBreakdown(
        double GlobalEla,    // Error Level Analysis — ร่องรอยการ Recompress ทั้งภาพ
        double Mfr,          // Median Filter Residual — Noise ผิดปกติหลัง Edit
        double JpegZone,     // DCT AC Energy ของ 4 Zone ใหญ่ — ต่าง JPEG Quality
        double FftRatio,     // High/Low Frequency Ratio — Sharpness ผิดธรรมชาติ
        double ChromaNoise   // Color Channel Noise ทั้งภาพ — ต่าง Color Source
    );

    /// <summary>
    /// ผลลัพธ์หลักที่ส่งกลับไปให้ Caller
    /// </summary>
    public record ManipulationAnalysisResult(
        double ManipulationRiskPct, // ความเสี่ยงที่ภาพถูกแก้ไข (0–100)
        string Reason,              // สาเหตุหลัก: "manipulation" | "mixed-signals" | "heuristic"
        double Confidence,          // ความน่าเชื่อถือของการวิเคราะห์ (0–100)
        SignalBreakdown? Signals    // Debug payload (null ถ้าปิด EmitSignalDebug)
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // Main Service
    // ═══════════════════════════════════════════════════════════════════════════

    /// <summary>
    /// ระบบตรวจจับการแก้ไขภาพ (Image Manipulation Detection) v4 — Global Forensics
    ///
    /// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    /// แนวทาง v4: Global Image Statistics
    /// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    /// แทนที่ Tile-based CoV (v3) ซึ่งเปรียบเทียบ Region ย่อยๆ แล้วเกิด
    /// False Positive บนภาพการ์ดจริง (CMYK Printing, Sharp Edge ตามธรรมชาติ)
    ///
    /// v4 วัดทั้งภาพเป็นหน่วยเดียว — ไม่ขึ้นกับ Content ของการ์ด
    ///
    /// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    /// สัญญาณที่ตรวจจับ (5 Global Signals):
    /// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ///  1. Global ELA (30%)           — Recompression Artifact ทั้งภาพ
    ///  2. Median Filter Residual (25%) — Noise ที่ไม่ตรง Camera Model
    ///  3. JPEG Zone Score (20%)      — DCT AC Energy ใน 4 Quadrant ใหญ่
    ///  4. FFT Frequency Ratio (15%)  — HF/LF Energy — Sharpness ผิดปกติ
    ///  5. Global Chroma Noise (10%)  — Color Channel Noise ทั้งภาพ
    /// </summary>
    public class ImageManipulationDetectionService
    {
        // ── Configuration ──────────────────────────────────────────────────────
        /// <summary>Resize ภาพให้ด้าน Longest ไม่เกินนี้</summary>
        private const int NormalisedLongestSide = 1024;

        /// <summary>true = แนบ SignalBreakdown ใน Result</summary>
        private const bool EmitSignalDebug = true;

        // ── Public API ─────────────────────────────────────────────────────────
        public Task<ManipulationAnalysisResult> AnalyzeAsync(
            byte[] imageBytes,
            CancellationToken cancellationToken = default)
        {
            if (imageBytes == null || imageBytes.Length == 0)
                return Task.FromResult(new ManipulationAnalysisResult(0, "empty-image", 0, null));

            return Task.Run(() => AnalyzeInternal(imageBytes), cancellationToken);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // Core Analysis
        // ═══════════════════════════════════════════════════════════════════════
        private static ManipulationAnalysisResult AnalyzeInternal(byte[] imageBytes)
        {
            try
            {
                // Step 1: Decode ────────────────────────────────────────────────
                using var raw = new Mat();
                CvInvoke.Imdecode(imageBytes, ImreadModes.Color, raw);
                if (raw.IsEmpty)
                    return new ManipulationAnalysisResult(0, "decode-failed", 0, null);

                // Step 2: Normalise Resolution ──────────────────────────────────
                using var img  = NormaliseSize(raw, NormalisedLongestSide);
                using var gray = new Mat();
                CvInvoke.CvtColor(img, gray, ColorConversion.Bgr2Gray);

                // Step 3: คำนวณ 5 Global Signals ────────────────────────────────
                double globalEla   = ComputeGlobalElaScore(img);
                double mfrScore    = ComputeMedianFilterResidual(gray);
                double jpegZone    = ComputeJpegZoneScore(gray);
                double fftRatio    = ComputeFftFrequencyRatio(gray);
                double chromaNoise = ComputeGlobalChromaNoise(img);

                // Step 4: Sigmoid Normalisation → [5, 85] ───────────────────────
                // ╔══════════════════════════════════════════════════════════════╗
                // ║ Calibrate จากข้อมูลจริง (29 Apr 2026):                      ║
                // ║                         ภาพตัดต่อ    ภาพจริง               ║
                // ║   ELA:                   14.65       19.04  ← กลับด้าน!     ║
                // ║   MFR:                    8.02        6.83  ← แยกได้นิดหน่อย ║
                // ║   Chroma:                44.70       17.88  ← แยกได้ชัดมาก!  ║
                // ║   JpegZone:               0.26        0.40  ← กลับด้าน!     ║
                // ║   FFT:                    0.58        1.06  ← กลับด้าน!     ║
                // ╚══════════════════════════════════════════════════════════════╝
                // Chroma Noise = ตัวแยกหลัก (ภาพตัดต่อ = คนละ White Balance)
                // MFR          = ตัวแยกรอง (Noise Pattern ต่างกัน)
                // ELA/FFT/JPEG = ไม่น่าเชื่อถือ สำหรับภาพการ์ด (ผลกลับด้าน)
                double chromaRisk = SigmoidN(chromaNoise, 20.0, 42.0, 3.5);  // จริง ~18 → ต่ำ / ตัดต่อ ~45 → สูง
                double mfrRisk    = SigmoidN(mfrScore,    5.5,  11.0, 3.5);  // จริง ~6.8 → กลาง-ต่ำ / ตัดต่อ ~8+ → กลาง-สูง
                double elaRisk    = SigmoidN(globalEla,   12.0, 25.0, 2.5);  // ไม่น่าเชื่อถือ — ลดบทบาท
                double jpegRisk   = SigmoidN(jpegZone,    0.15, 0.55, 2.5);  // ไม่น่าเชื่อถือ — ลดบทบาท
                double fftRisk    = SigmoidN(fftRatio,    0.20, 1.50, 2.0);  // ไม่น่าเชื่อถือ — ลดบทบาท

                // Step 5: Weighted Average ──────────────────────────────────────
                // Chroma = Primary (40%) — ตัวเดียวที่แยกได้ชัด
                // MFR    = Secondary (30%) — ช่วยเสริม
                // ELA/JPEG/FFT = สัญญาณเสริม (30% รวม) — ไม่ไว้ใจ
                var    signals = new[] { chromaRisk, mfrRisk, elaRisk, jpegRisk, fftRisk };
                var    weights = new[] { 0.40,       0.30,   0.15,    0.10,     0.05 };
                double rawRisk = WeightedAverage(signals, weights);

                // Step 6: Confidence — วัดจาก Agreement ระหว่าง Signals ─────────
                double mean     = signals.Average();
                double variance = signals.Average(s => (s - mean) * (s - mean));
                double stdDev   = Math.Sqrt(variance);
                double confidence = Math.Clamp(85 - stdDev * 1.2, 20, 90);

                double manipRisk = Math.Clamp(rawRisk, 0, 92);

                // Step 7: Override สำหรับ Evidence ──────────────────────────────
                // Pattern A: Chroma สูงมาก = Color Source ต่างกันชัดเจน (คนละกล้อง/แสง)
                if (chromaRisk >= 65)
                {
                    manipRisk  = Math.Max(manipRisk, 60);
                    confidence = Math.Max(confidence, 80);
                }
                // Pattern B: Chroma ปานกลาง + MFR สนับสนุน = Composite น่าจะจริง
                else if (chromaRisk >= 50 && mfrRisk >= 35)
                {
                    manipRisk  = Math.Max(manipRisk, 56);
                    confidence = Math.Max(confidence, 72);
                }
                // Pattern C: Chroma + ELA สูงพร้อมกัน = Mixed evidence แต่น่าสงสัย
                else if (chromaRisk >= 45 && elaRisk >= 45)
                {
                    manipRisk  = Math.Max(manipRisk, 50);
                    confidence = Math.Max(confidence, 65);
                }

                if (EmitSignalDebug)
                    Console.WriteLine(
                        $"\n[Manip v4 RAW] " +
                        $"ELA:{globalEla:F2} MFR:{mfrScore:F2} " +
                        $"JpegZone:{jpegZone:F4} FFT:{fftRatio:F4} " +
                        $"Chroma:{chromaNoise:F2}" +
                        $"\n[Manip v4 RISK] " +
                        $"ELA:{elaRisk:F1} MFR:{mfrRisk:F1} " +
                        $"JpegZone:{jpegRisk:F1} FFT:{fftRisk:F1} " +
                        $"Chroma:{chromaRisk:F1} " +
                        $"=> Risk:{manipRisk:F1} Conf:{confidence:F0}");

                // Step 8: ประเมินผล ─────────────────────────────────────────────
                string reason = manipRisk switch
                {
                    >= 55 => "manipulation",   // มีหลักฐานการตัดต่อชัดเจน
                    >= 35 => "mixed-signals",  // มีสัญญาณน่าสงสัยบางส่วน
                    _     => "heuristic"       // ภาพดูปกติ
                };

                // Step 9: Assemble Result ───────────────────────────────────────
                var breakdown = EmitSignalDebug
                    ? new SignalBreakdown(elaRisk, mfrRisk, jpegRisk, fftRisk, chromaRisk)
                    : null;

                return new ManipulationAnalysisResult(
                    Math.Round(manipRisk,  2),
                    reason,
                    Math.Round(confidence, 2),
                    breakdown);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[ImageManipulationDetection] Error: {ex.Message}");
                return new ManipulationAnalysisResult(0, "error", 0, null);
            }
        }

        // ═══════════════════════════════════════════════════════════════════════
        // Pre-processing
        // ═══════════════════════════════════════════════════════════════════════

        private static Mat NormaliseSize(Mat src, int maxSide)
        {
            int w = src.Width, h = src.Height;
            if (w <= maxSide && h <= maxSide) return src.Clone();
            double scale = maxSide / (double)Math.Max(w, h);
            var dst = new Mat();
            CvInvoke.Resize(src, dst,
                new System.Drawing.Size((int)(w * scale), (int)(h * scale)),
                0, 0, Inter.Area);
            return dst;
        }

        // ═══════════════════════════════════════════════════════════════════════
        // Signal #1 — Global ELA (Error Level Analysis)
        // ═══════════════════════════════════════════════════════════════════════

        /// <summary>
        /// วัด ELA ของทั้งภาพ ไม่ใช่ Tile-by-Tile
        ///
        /// Borrow ภาพ Recompress แล้วดูความแตกต่างทั้งภาพ:
        /// - Mean Error  = ระดับการเปลี่ยนแปลงโดยรวม
        /// - Spread      = ความกระจายของ Error
        /// - Outlier Frac= สัดส่วน Pixel ที่มี Error สูงผิดปกติ (> mean + 2σ)
        ///
        /// ภาพที่ตัดต่อมักมี Outlier Pixel สูงในบริเวณที่ Paste มา
        /// เพราะ Region นั้นผ่าน JPEG Compression ที่ต่างกัน
        /// </summary>
        private static double ComputeGlobalElaScore(Mat img)
        {
            double total = 0;
            (int quality, double weight)[] levels =
            {
                (70, 0.30),
                (80, 0.40),
                (92, 0.30)
            };
            foreach (var (q, w) in levels)
                total += ComputeElaAtQuality(img, q) * w;
            return total;
        }

        private static double ComputeElaAtQuality(Mat img, int quality)
        {
            using var buf = new Emgu.CV.Util.VectorOfByte();
            CvInvoke.Imencode(".jpg", img, buf,
                new KeyValuePair<ImwriteFlags, int>(ImwriteFlags.JpegQuality, quality));
            var reBytes = buf.ToArray();
            if (reBytes.Length == 0) return 0;

            using var recomp = new Mat();
            CvInvoke.Imdecode(reBytes, ImreadModes.Color, recomp);
            if (recomp.IsEmpty) return 0;

            using var diff   = new Mat();
            using var scaled = new Mat();
            CvInvoke.AbsDiff(img, recomp, diff);
            CvInvoke.ConvertScaleAbs(diff, scaled, 10.0, 0);

            MCvScalar mean = default, std = default;
            CvInvoke.MeanStdDev(scaled, ref mean, ref std);
            double level  = (mean.V0 + mean.V1 + mean.V2) / 3.0;
            double spread = (std.V0  + std.V1  + std.V2)  / 6.0;

            // Global Outlier Fraction — ไม่ใช่ Tile-based
            using var grayEla = new Mat();
            CvInvoke.CvtColor(scaled, grayEla, ColorConversion.Bgr2Gray);
            double outlierFrac = ComputeGlobalOutlierFraction(grayEla);

            return (level + spread) * 0.5 + outlierFrac * 15.0 * 0.5;
        }

        /// <summary>สัดส่วน Pixel ที่มีค่า ELA เกิน mean + 2σ ของทั้งภาพ</summary>
        private static double ComputeGlobalOutlierFraction(Mat grayEla)
        {
            MCvScalar mean = default, std = default;
            CvInvoke.MeanStdDev(grayEla, ref mean, ref std);
            if (std.V0 < 0.5) return 0;

            double threshold = mean.V0 + 2.0 * std.V0;
            var    img       = grayEla.ToImage<Gray, byte>();
            int    count = 0, total = img.Width * img.Height;

            for (int y = 0; y < img.Height; y++)
                for (int x = 0; x < img.Width; x++)
                    if (img.Data[y, x, 0] > threshold) count++;

            return total > 0 ? (double)count / total : 0;
        }

        // ═══════════════════════════════════════════════════════════════════════
        // Signal #2 — Median Filter Residual (MFR)
        // ═══════════════════════════════════════════════════════════════════════

        /// <summary>
        /// วัด Noise ที่ไม่ตรงกับ Camera Noise Model ทั้งภาพ
        ///
        /// หลักการ:
        ///   residual = |img - medianBlur(img)|
        ///   StdDev ของ residual = ความผิดปกติของ Noise
        ///
        /// ภาพจากกล้องเดียวมี Noise Pattern สม่ำเสมอ → StdDev ต่ำ
        /// ภาพที่ Paste Region จากกล้องอื่นมา:
        ///   Region นั้นมี Noise ต่างออกไป → StdDev สูง
        ///
        /// ข้อดี: ไม่ขึ้นกับ Content (ใช้ได้ทั้งการ์ดและภาพทั่วไป)
        /// </summary>
        private static double ComputeMedianFilterResidual(Mat gray)
        {
            using var blurred = new Mat();
            CvInvoke.MedianBlur(gray, blurred, 3);

            using var grayF = new Mat();
            using var blurF = new Mat();
            gray.ConvertTo(grayF, DepthType.Cv32F);
            blurred.ConvertTo(blurF, DepthType.Cv32F);

            using var residual    = new Mat();
            using var absResidual = new Mat();
            CvInvoke.Subtract(grayF, blurF, residual);
            CvInvoke.ConvertScaleAbs(residual, absResidual, 1.0, 0);

            MCvScalar mean = default, std = default;
            CvInvoke.MeanStdDev(absResidual, ref mean, ref std);
            // StdDev สูง = Noise ไม่สม่ำเสมอ = น่าสงสัย
            return std.V0;
        }

        // ═══════════════════════════════════════════════════════════════════════
        // Signal #3 — JPEG Zone Score
        // ═══════════════════════════════════════════════════════════════════════

        /// <summary>
        /// แบ่งภาพเป็น 4 Quadrant ใหญ่ วัด DCT AC Energy ต่อ Zone
        ///
        /// ต่างจาก v3 ที่ใช้ Tile เล็กๆ (64px) — ที่นี่ใช้ Zone 1/4 ของภาพ
        /// ใหญ่พอที่จะไม่ถูกรบกวนโดย Local Card Feature
        ///
        /// JPEG Quality Level ต่างกัน = AC Energy Profile ต่างกัน
        /// CoV ของ 4 Zone สูง = มาจาก Source JPEG Quality ต่างกัน
        /// </summary>
        private static double ComputeJpegZoneScore(Mat gray)
        {
            using var grayF = new Mat();
            gray.ConvertTo(grayF, DepthType.Cv32F);

            int w = gray.Width, h = gray.Height;
            int hw = w / 2, hh = h / 2;
            if (hw < 32 || hh < 32) return 0;

            var zones = new[]
            {
                new System.Drawing.Rectangle(0,  0,  hw, hh),
                new System.Drawing.Rectangle(hw, 0,  Math.Max(1, w - hw), hh),
                new System.Drawing.Rectangle(0,  hh, hw, Math.Max(1, h - hh)),
                new System.Drawing.Rectangle(hw, hh, Math.Max(1, w - hw), Math.Max(1, h - hh))
            };

            var zoneEnergies = new List<double>(4);
            foreach (var zone in zones)
            {
                if (zone.Width < 8 || zone.Height < 8) continue;

                using var zoneMat = new Mat(grayF, zone);
                using var resized = new Mat();
                CvInvoke.Resize(zoneMat, resized,
                    new System.Drawing.Size(128, 128), 0, 0, Inter.Area);

                using var dctMat = new Mat();
                CvInvoke.Dct(resized, dctMat, DctType.Forward);

                var    dctData  = dctMat.ToImage<Gray, float>();
                double acEnergy = 0;
                int    acCount  = 0;
                for (int y = 0; y < 128; y++)
                    for (int x = 0; x < 128; x++)
                    {
                        if (x == 0 && y == 0) continue; // ข้าม DC
                        float v = dctData.Data[y, x, 0];
                        acEnergy += v * v;
                        acCount++;
                    }
                zoneEnergies.Add(acCount > 0 ? acEnergy / acCount : 0);
            }

            if (zoneEnergies.Count < 2) return 0;
            double avg = zoneEnergies.Average();
            if (avg < 1) return 0;
            double variance = zoneEnergies.Average(e => (e - avg) * (e - avg));
            return Math.Sqrt(variance) / (avg + 1e-6); // CoV ของ 4 Zone
        }

        // ═══════════════════════════════════════════════════════════════════════
        // Signal #4 — FFT Frequency Ratio (HF/LF)
        // ═══════════════════════════════════════════════════════════════════════

        /// <summary>
        /// วัด Ratio ของ High-Frequency ต่อ Low-Frequency Energy ทั้งภาพ
        ///
        /// ประมาณค่า:
        ///   HF ≈ Laplacian Variance (Fine detail + Edge)
        ///   LF ≈ Gaussian Blur Variance (Smooth structure)
        ///
        /// ภาพธรรมชาติมี HF/LF Ratio สม่ำเสมอตาม Scene Complexity
        /// ภาพที่ Sharpen Region ที่ Paste มา → HF สูงผิดปกติ
        /// ภาพที่ Smooth Region เพื่อซ่อนรอย → HF ต่ำผิดปกติ
        ///
        /// Resize เป็น 512x512 ก่อน เพื่อให้ค่าคงที่ไม่ขึ้นกับ Resolution
        /// </summary>
        private static double ComputeFftFrequencyRatio(Mat gray)
        {
            using var resized = new Mat();
            CvInvoke.Resize(gray, resized, new System.Drawing.Size(512, 512), 0, 0, Inter.Area);

            using var lap = new Mat();
            CvInvoke.Laplacian(resized, lap, DepthType.Cv64F);
            MCvScalar lapMean = default, lapStd = default;
            CvInvoke.MeanStdDev(lap, ref lapMean, ref lapStd);

            using var blurred = new Mat();
            CvInvoke.GaussianBlur(resized, blurred, new System.Drawing.Size(9, 9), 0);
            MCvScalar blurMean = default, blurStd = default;
            CvInvoke.MeanStdDev(blurred, ref blurMean, ref blurStd);

            double hfEnergy = lapStd.V0 * lapStd.V0;
            double lfEnergy = blurStd.V0 * blurStd.V0 + 1e-6;
            return hfEnergy / lfEnergy;
        }

        // ═══════════════════════════════════════════════════════════════════════
        // Signal #5 — Global Chroma Noise
        // ═══════════════════════════════════════════════════════════════════════

        /// <summary>
        /// วัด Color Channel Noise ทั้งภาพผ่าน Chroma Difference
        ///
        /// Chroma Difference = R-G, G-B
        /// StdDev ของ Chroma Difference สูง = Color Noise ไม่สม่ำเสมอ
        ///
        /// ภาพจากกล้องเดียว = White Balance เดียวกัน = Chroma Noise สม่ำเสมอ
        /// ภาพที่ Paste จากกล้องหรือ Lighting ต่างกัน = Chroma Noise ต่างกัน
        ///
        /// วัดทั้งภาพ (Global) ไม่ใช่ Tile → ไม่ถูกรบกวนโดย Card Border
        /// </summary>
        private static double ComputeGlobalChromaNoise(Mat img)
        {
            var channels = img.Split(); // [B=0, G=1, R=2]
            try
            {
                using var bF = new Mat(); using var gF = new Mat(); using var rF = new Mat();
                channels[0].ConvertTo(bF, DepthType.Cv32F);
                channels[1].ConvertTo(gF, DepthType.Cv32F);
                channels[2].ConvertTo(rF, DepthType.Cv32F);

                using var rg = new Mat(); using var gb = new Mat();
                CvInvoke.Subtract(rF, gF, rg);
                CvInvoke.Subtract(gF, bF, gb);

                MCvScalar rgMean = default, rgStd = default;
                MCvScalar gbMean = default, gbStd = default;
                CvInvoke.MeanStdDev(rg, ref rgMean, ref rgStd);
                CvInvoke.MeanStdDev(gb, ref gbMean, ref gbStd);

                // StdDev สูง = Color Channel Noise ไม่สม่ำเสมอ
                return (rgStd.V0 + gbStd.V0) / 2.0;
            }
            finally { foreach (var ch in channels) ch.Dispose(); }
        }

        // ═══════════════════════════════════════════════════════════════════════
        // Math Utilities
        // ═══════════════════════════════════════════════════════════════════════

        /// <summary>
        /// Sigmoid Normalisation: Raw Value → [5, 85]
        /// ค่าอยู่ระหว่าง low–high จะ Map ไปที่ ~45 (กลาง)
        /// ต่ำกว่า low → ใกล้ 5 (ปกติ) / สูงกว่า high → ใกล้ 85 (Risk สูง)
        /// </summary>
        private static double SigmoidN(double value, double low, double high, double steepness = 4)
        {
            double mid   = (low + high) / 2.0;
            double range = high - low;
            if (range <= 0) return 45;
            double x = (value - mid) / (range * 0.5) * steepness;
            return 5 + 80 / (1 + Math.Exp(-x));
        }

        private static double WeightedAverage(double[] vals, double[] weights)
        {
            double sum = 0, wSum = 0;
            for (int i = 0; i < vals.Length; i++) { sum += vals[i] * weights[i]; wSum += weights[i]; }
            return wSum > 0 ? sum / wSum : 0;
        }
    }
}
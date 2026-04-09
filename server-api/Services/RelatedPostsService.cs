using Microsoft.Extensions.Configuration;

namespace ServerApi.Services
{
    /// <summary>
    /// โพสที่เกี่ยวข้องในหน้าโพสดีเทล: CLIP คล้ายกัน + เติมหมวดเดียวกัน
    /// ใช้เกณฑ์ <c>RelatedPosts:MinSimilarityScore</c> แยกจาก <c>ImageSearch:MinSimilarityScore</c> (ค้นหาด้วยรูปบนหน้าแรก)
    /// </summary>
    public class RelatedPostsService
    {
        private readonly SupabaseService _supabaseService;
        private readonly IConfiguration _configuration;

        private const int MaxEmbeddingsForMatch = 3;
        private const double DefaultRelatedMinSimilarity = 0.65;

        public RelatedPostsService(SupabaseService supabaseService, IConfiguration configuration)
        {
            _supabaseService = supabaseService;
            _configuration = configuration;
        }

        private double RelatedMinSimilarityScore
        {
            get
            {
                var raw = _configuration["RelatedPosts:MinSimilarityScore"];
                if (string.IsNullOrWhiteSpace(raw) || !double.TryParse(raw, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var v))
                    v = DefaultRelatedMinSimilarity;
                return Math.Clamp(v, 0.0, 1.0);
            }
        }

        public async Task<List<Dictionary<string, object>>> GetRelatedPostsForDetailAsync(
            string postId,
            int limit,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(postId))
                return new List<Dictionary<string, object>>();

            var effectiveLimit = Math.Clamp(limit, 1, 12);

            var currentPost = await _supabaseService.GetAsync("posts", postId.Trim(), useServiceRole: true).ConfigureAwait(false);
            var category = currentPost != null && currentPost.TryGetValue("category", out var c) ? c?.ToString()?.Trim() : null;

            var postIdToScore = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);
            var embeddingRows = await _supabaseService.QueryAsync(
                "post_image_embeddings",
                "postId",
                postId.Trim(),
                useServiceRole: true
            ).ConfigureAwait(false);

            if (embeddingRows != null && embeddingRows.Count > 0)
            {
                var embeddingsUsed = 0;
                var threshold = RelatedMinSimilarityScore;

                foreach (var row in embeddingRows)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    if (embeddingsUsed >= MaxEmbeddingsForMatch) break;
                    if (!row.TryGetValue("embedding", out var embObj) || embObj == null) continue;

                    var vectorStr = EmbObjToVectorString(embObj);
                    if (string.IsNullOrEmpty(vectorStr)) continue;

                    var rpcParams = new Dictionary<string, object>
                    {
                        ["query_embedding"] = vectorStr,
                        ["match_limit"] = effectiveLimit + 8,
                        ["match_status"] = "active",
                        ["match_threshold"] = threshold
                    };
                    if (!string.IsNullOrEmpty(category))
                        rpcParams["match_category"] = category;
                    var rows = await _supabaseService.RpcAsync("match_posts_by_embedding", rpcParams, useServiceRole: true).ConfigureAwait(false);

                    foreach (var r in rows)
                    {
                        if (!r.TryGetValue("postId", out var idObj) || idObj == null) continue;
                        var matchedId = idObj.ToString();
                        if (string.IsNullOrEmpty(matchedId) || string.Equals(matchedId, postId, StringComparison.OrdinalIgnoreCase))
                            continue;
                        var score = r.TryGetValue("score", out var sObj) && sObj != null ? Convert.ToDouble(sObj) : 0d;
                        if (!postIdToScore.TryGetValue(matchedId, out var existing) || score > existing)
                            postIdToScore[matchedId] = score;
                    }
                    embeddingsUsed++;
                }
            }

            var orderedIds = postIdToScore.OrderByDescending(x => x.Value).Select(x => x.Key).ToList();
            var result = new List<Dictionary<string, object>>();

            foreach (var pid in orderedIds)
            {
                if (result.Count >= effectiveLimit) break;
                var post = await _supabaseService.GetAsync("posts", pid, useServiceRole: true).ConfigureAwait(false);
                if (post == null) continue;
                if (!IsActiveListablePost(post)) continue;
                if (!string.IsNullOrEmpty(category))
                {
                    var postCat = post.TryGetValue("category", out var catVal) ? catVal?.ToString()?.Trim() : null;
                    if (!string.Equals(postCat, category, StringComparison.OrdinalIgnoreCase))
                        continue;
                }
                NormalizePostImages(post);
                if (postIdToScore.TryGetValue(pid, out var sc))
                    post["imageSearchScore"] = sc;
                result.Add(post);
            }

            if (result.Count < effectiveLimit && !string.IsNullOrEmpty(category))
            {
                var exclude = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { postId.Trim() };
                foreach (var p in result)
                {
                    if (p.TryGetValue("id", out var ido) && ido != null)
                        exclude.Add(ido.ToString()!);
                }

                var need = effectiveLimit - result.Count;
                var (catPosts, _) = await _supabaseService.GetPostsFilteredAsync(
                    category: category,
                    search: null,
                    sortBy: null,
                    page: 1,
                    limit: Math.Min(48, need * 4),
                    postType: null,
                    status: "active",
                    useServiceRole: true
                ).ConfigureAwait(false);

                foreach (var row in catPosts)
                {
                    if (result.Count >= effectiveLimit) break;
                    if (!row.TryGetValue("id", out var idObj) || idObj == null) continue;
                    var id = idObj.ToString();
                    if (string.IsNullOrEmpty(id) || exclude.Contains(id)) continue;
                    if (!IsActiveListablePost(row)) continue;
                    NormalizePostImages(row);
                    exclude.Add(id);
                    result.Add(row);
                }
            }

            return result;
        }

        private static bool IsActiveListablePost(Dictionary<string, object> post)
        {
            if (!post.TryGetValue("status", out var st) || st == null)
                return false;
            if (!string.Equals(st.ToString(), "active", StringComparison.OrdinalIgnoreCase))
                return false;
            return true;
        }

        private static string? EmbObjToVectorString(object embObj)
        {
            if (embObj is string s && !string.IsNullOrWhiteSpace(s) && s.StartsWith("["))
                return s;
            if (embObj is List<object> list)
            {
                var parts = list.Select(x => x?.ToString() ?? "0").ToArray();
                return "[" + string.Join(",", parts) + "]";
            }
            if (embObj is float[] fa)
                return "[" + string.Join(",", fa.Select(x => x.ToString("G", System.Globalization.CultureInfo.InvariantCulture))) + "]";
            if (embObj is double[] da)
                return "[" + string.Join(",", da.Select(x => x.ToString("G", System.Globalization.CultureInfo.InvariantCulture))) + "]";
            return null;
        }

        private static void NormalizePostImages(Dictionary<string, object> post)
        {
            if (!post.TryGetValue("images", out var imagesObj) || imagesObj == null) return;

            var list = ExtractStringList(imagesObj);
            post["images"] = list;
        }

        private static List<string> ExtractStringList(object imagesObj)
        {
            if (imagesObj is List<string> ls)
                return ls.Where(s => !string.IsNullOrWhiteSpace(s)).ToList();

            if (imagesObj is List<object> lo)
                return lo.Select(x => x?.ToString() ?? "")
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .ToList();

            if (imagesObj is System.Text.Json.JsonElement je && je.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                var res = new List<string>();
                foreach (var item in je.EnumerateArray())
                {
                    var s = item.GetString();
                    if (!string.IsNullOrWhiteSpace(s)) res.Add(s);
                }
                return res;
            }

            return new List<string>();
        }
    }
}

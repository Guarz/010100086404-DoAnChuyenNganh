// File: services/ragMetrics.js
// Các chỉ số đánh giá truy xuất RAG trên Golden Query Set (dùng chung cho Admin RAG Analytics và benchmark).
// retrieved: mảng id THEO THỨ TỰ xếp hạng; golden: mảng id đáp án chuẩn.

const hitAtK = (retrieved, golden, k) => (retrieved.slice(0, k).some((id) => golden.includes(id)) ? 1 : 0);

const recallAtK = (retrieved, golden, k) =>
  golden.length ? retrieved.slice(0, k).filter((id) => golden.includes(id)).length / golden.length : 0;

const precisionAtK = (retrieved, golden, k) => {
  const top = retrieved.slice(0, k);
  return top.length ? top.filter((id) => golden.includes(id)).length / k : 0;
};

// nDCG@K với độ liên quan nhị phân
const ndcgAtK = (retrieved, golden, k) => {
  const dcg = retrieved.slice(0, k).reduce((s, id, i) => s + (golden.includes(id) ? 1 / Math.log2(i + 2) : 0), 0);
  const ideal = Array.from({ length: Math.min(k, golden.length) }, (_, i) => 1 / Math.log2(i + 2)).reduce((a, b) => a + b, 0);
  return ideal ? dcg / ideal : 0;
};

const reciprocalRank = (retrieved, golden) => {
  const index = retrieved.findIndex((id) => golden.includes(id));
  return index === -1 ? 0 : 1 / (index + 1);
};

// Citation correctness: mọi trích dẫn [n] trong câu trả lời phải trỏ tới một ngữ cảnh đã truy xuất (1..numContexts).
// Trả về null nếu câu trả lời không có trích dẫn nào.
const citationCorrectness = (answer, numContexts) => {
  const cited = [...String(answer || '').matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  if (!cited.length) return null;
  return cited.filter((n) => n >= 1 && n <= numContexts).length / cited.length;
};

// Tính các chỉ số cho 1 truy vấn. Truy vấn có golden rỗng = câu hỏi ngoài phạm vi:
// đúng khi hệ thống KHÔNG truy xuất gì (refusal).
const evaluateQuery = (retrieved, golden, k = 5) => {
  if (!golden.length) return { refusal: retrieved.length === 0 ? 1 : 0 };
  return {
    hit: hitAtK(retrieved, golden, k),
    recall: recallAtK(retrieved, golden, k),
    precision: precisionAtK(retrieved, golden, k),
    ndcg: ndcgAtK(retrieved, golden, k),
    mrr: reciprocalRank(retrieved.slice(0, k), golden)
  };
};

const average = (rows, key) => {
  const values = rows.map((r) => r[key]).filter((v) => typeof v === 'number');
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
};

const summarize = (rows) => ({
  queries: rows.filter((r) => r.hit !== undefined).length,
  hitRate: average(rows, 'hit'),
  recall: average(rows, 'recall'),
  precision: average(rows, 'precision'),
  ndcg: average(rows, 'ndcg'),
  mrr: average(rows, 'mrr'),
  refusalQueries: rows.filter((r) => r.refusal !== undefined).length,
  refusalAccuracy: average(rows, 'refusal')
});

module.exports = { hitAtK, recallAtK, precisionAtK, ndcgAtK, reciprocalRank, citationCorrectness, evaluateQuery, summarize };

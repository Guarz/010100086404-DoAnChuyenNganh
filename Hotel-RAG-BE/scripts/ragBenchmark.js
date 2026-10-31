// File: scripts/ragBenchmark.js
// Benchmark truy xuất trên CÙNG Golden Query Set (golden_dataset.json) cho 3 phương pháp:
//   A. keyword  : BM25 rút gọn trên văn bản hạng phòng + khách sạn (không hiểu ràng buộc)
//   B. vector   : Vector Search thuần như phiên bản cũ (Atlas knnBeta top-3 khách sạn -> hạng phòng)
//   C. pipeline : Pipeline hiện tại = tách ràng buộc cứng -> lọc có cấu trúc -> quỹ phòng -> xếp hạng ngữ nghĩa
// Chỉ số @K: HitRate, Recall, Precision, nDCG, MRR + tỉ lệ từ chối đúng cho câu hỏi ngoài phạm vi.
// Xuất báo cáo: docs/rag-benchmark.md (+ .json) gồm bảng tổng, bảng theo intent và error analysis.
//
//   node Hotel-RAG-BE/scripts/ragBenchmark.js [--k=5] [--corpus=frozen|full]
// --corpus=frozen (mặc định): chỉ dùng các hạng phòng tồn tại lúc gán nhãn Golden (trước dữ liệu mock),
//   đúng nguyên tắc đánh giá IR "nhãn và kho tài liệu phải cùng phiên bản".
// Vector câu hỏi được cache ở scripts/.cache/query-embeddings.json để chạy lại không tốn quota Gemini.
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { parseQueryConstraints } = require('../services/queryConstraintParser');
const RoomType = require('../models/RoomType');
const { loadRoomCatalog, keywordSearch, atlasVectorSearch, applyHardFilters, applyAvailabilityAndBudget, rankCandidates } =
  require('../services/ragRetrieval');
const { evaluateQuery, summarize } = require('../services/ragMetrics');

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const K = Number(args.k || 5);
const CORPUS = args.corpus || 'frozen';
const FROZEN_BEFORE = new Date('2026-10-31T00:00:00Z'); // ngày nạp dữ liệu mock (scripts/seedMockData.js)
const ROOT = path.join(__dirname, '../..');
const CACHE_FILE = path.join(__dirname, '.cache/query-embeddings.json');
const golden = require(path.join(ROOT, 'golden_dataset.json'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function embedQueries(queries) {
  const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {};
  const missing = queries.filter((q) => !cache[q]);
  if (missing.length && process.env.GEMINI_API_KEY) {
    const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({ model: 'gemini-embedding-001' });
    for (const q of missing) {
      for (let attempt = 0; attempt < 3 && !cache[q]; attempt++) {
        try {
          cache[q] = (await model.embedContent(q)).embedding.values;
        } catch (error) {
          console.warn(`  ! Embedding lỗi (${error.status || error.message}) - thử lại`);
          await sleep(5000 * (attempt + 1));
        }
      }
    }
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  }
  return cache;
}

const fmt = (v) => (v === null || v === undefined ? '—' : v.toFixed(3));

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const fullCatalog = await loadRoomCatalog({ withEmbedding: true });
  const catalog = CORPUS === 'full'
    ? fullCatalog
    : fullCatalog.filter(({ room }) => !room.createdAt || new Date(room.createdAt) < FROZEN_BEFORE);
  const inCorpus = new Set(catalog.map(({ room }) => room._id.toString()));
  // Tên + trạng thái của MỌI hạng phòng (kể cả đang khóa) để giải thích lỗi
  const allRooms = await RoomType.find().populate('hotelId', 'hotelName status').lean();
  const titleOf = new Map(allRooms.map((r) => [r._id.toString(), `${r.title} (${r.hotelId?.hotelName})`]));
  const whyUnreachable = (id) => {
    const r = allRooms.find((x) => x._id.toString() === id);
    if (!r) return 'không còn tồn tại trong DB';
    if (r.isActive === false) return 'đang bị Partner khóa bảo trì (isActive=false) nên hệ thống đúng khi không gợi ý';
    if (r.hotelId?.status !== 'Approved') return `khách sạn đang ở trạng thái ${r.hotelId?.status}`;
    return null;
  };

  console.log(`Corpus: ${CORPUS} - ${catalog.length} hạng phòng / ${new Set(catalog.map((c) => c.hotel._id.toString())).size} khách sạn`);
  const vectors = await embedQueries(golden.map((g) => g.user_query));
  const vectorCoverage = golden.filter((g) => vectors[g.user_query]).length;
  console.log(`Vector câu hỏi: ${vectorCoverage}/${golden.length}`);

  const methods = {
    keyword: async (g) => {
      const ranked = (await keywordSearch(g.user_query, K, catalog)).map((d) => d.room._id.toString());
      return { ranked, raw: ranked.length };
    },
    vector: async (g) => {
      const qv = vectors[g.user_query];
      if (!qv) return null;
      // Lấy rộng (k=20 KS) rồi giữ 3 khách sạn ĐẦU TIÊN thuộc corpus -> công bằng với corpus đóng băng
      const all = await atlasVectorSearch(qv, 20);
      const inside = all.filter((d) => inCorpus.has(d.room._id.toString()));
      const topHotels = [...new Set(inside.map((d) => d.hotel._id.toString()))].slice(0, 3);
      const ranked = inside.filter((d) => topHotels.includes(d.hotel._id.toString())).map((d) => d.room._id.toString()).slice(0, K);
      return { ranked, raw: all.length }; // vector search không có guardrail: luôn trả kết quả
    },
    pipeline: async (g) => {
      const c = parseQueryConstraints(g.user_query);
      if (!c.isHotelQuery) return { ranked: [], raw: 0 };
      const filtered = applyHardFilters(catalog, c);
      const available = await applyAvailabilityAndBudget(filtered, c);
      const ranked = rankCandidates(available, { query: g.user_query, queryVector: vectors[g.user_query] || null, constraints: c })
        .slice(0, K).map((d) => d.room._id.toString());
      return { ranked, raw: ranked.length };
    }
  };

  const perQuery = [];
  for (const g of golden) {
    const row = { id: g.query_id, intent: g.intent, query: g.user_query, golden: g.golden_context_ids, methods: {} };
    for (const [name, run] of Object.entries(methods)) {
      const out = await run(g);
      if (out === null) { row.methods[name] = null; continue; }
      const scores = g.golden_context_ids.length
        ? evaluateQuery(out.ranked, g.golden_context_ids, K)
        : { refusal: out.raw === 0 ? 1 : 0 };
      row.methods[name] = { retrieved: out.ranked, ...scores };
    }
    perQuery.push(row);
  }

  const summaryOf = (name, filter = () => true) =>
    summarize(perQuery.filter(filter).map((r) => r.methods[name]).filter(Boolean));
  const overall = Object.fromEntries(Object.keys(methods).map((m) => [m, summaryOf(m)]));
  const intents = [...new Set(golden.map((g) => g.intent))];
  const byIntent = intents.map((intent) => ({
    intent, n: golden.filter((g) => g.intent === intent).length,
    ...Object.fromEntries(Object.keys(methods).map((m) => [m, summaryOf(m, (r) => r.intent === intent)]))
  }));

  // ---------- Báo cáo Markdown ----------
  const lines = [];
  lines.push('# Benchmark truy xuất RAG — Keyword vs Vector vs Pipeline', '');
  lines.push(`- Ngày chạy: ${new Date().toISOString()}`);
  lines.push(`- Golden Query Set: \`golden_dataset.json\` (${golden.length} câu; ${golden.filter((g) => g.golden_context_ids.length).length} câu có đáp án, ${golden.filter((g) => !g.golden_context_ids.length).length} câu ngoài phạm vi/độc hại)`);
  lines.push(`- Corpus: \`${CORPUS}\` — ${catalog.length} hạng phòng; K = ${K}; vector câu hỏi: ${vectorCoverage}/${golden.length}`);
  lines.push('- Đơn vị đánh giá: **hạng phòng** (cùng cấp với nhãn Golden).', '');
  lines.push('## Kết quả tổng', '');
  lines.push(`| Phương pháp | Số câu | HitRate@${K} | Recall@${K} | Precision@${K} | nDCG@${K} | MRR | Từ chối đúng (ngoài phạm vi) |`);
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const [m, s] of Object.entries(overall)) {
    lines.push(`| ${m} | ${s.queries} | ${fmt(s.hitRate)} | ${fmt(s.recall)} | ${fmt(s.precision)} | ${fmt(s.ndcg)} | ${fmt(s.mrr)} | ${fmt(s.refusalAccuracy)} (${s.refusalQueries} câu) |`);
  }
  lines.push('', `## Theo nhóm câu hỏi (nDCG@${K})`, '');
  lines.push('| Intent | Số câu | keyword | vector | pipeline |', '|---|---|---|---|---|');
  for (const row of byIntent) {
    const cell = (m) => (row[m].queries ? fmt(row[m].ndcg) : `từ chối ${fmt(row[m].refusalAccuracy)}`);
    lines.push(`| ${row.intent} | ${row.n} | ${cell('keyword')} | ${cell('vector')} | ${cell('pipeline')} |`);
  }

  lines.push('', '## Error analysis (pipeline)', '');
  lines.push('Các câu pipeline chưa đạt (HitRate = 0, hoặc trả kết quả cho câu cần từ chối):', '');
  for (const r of perQuery) {
    const p = r.methods.pipeline;
    const failed = r.golden.length ? p.hit === 0 : p.refusal === 0;
    if (!failed) continue;
    const c = parseQueryConstraints(r.query);
    lines.push(`- **${r.id}** (${r.intent}) "${r.query}"`);
    lines.push(`  - Ràng buộc tách được: \`${JSON.stringify(Object.fromEntries(Object.entries(c).filter(([, v]) => v && !(Array.isArray(v) && !v.length))))}\``);
    lines.push(`  - Đáp án: ${r.golden.map((id) => titleOf.get(id) || id).join('; ') || '(từ chối)'}`);
    lines.push(`  - Pipeline trả về: ${p.retrieved.slice(0, 3).map((id) => titleOf.get(id)).join('; ') || '(rỗng)'}`);
    const reasons = r.golden.map((id) => whyUnreachable(id)).filter(Boolean);
    lines.push(`  - Nguyên nhân: ${reasons.length
      ? `nhãn Golden lỗi thời — đáp án ${reasons.join('; ')}. Cần cập nhật golden_dataset.json.`
      : 'xếp hạng chưa đưa đáp án vào top-K (cần xem lại mô tả phòng / trọng số ngữ nghĩa).'}`);
  }

  lines.push('', '## Nhận xét', '');
  lines.push('- **keyword** khớp tốt câu có từ khóa xuất hiện nguyên văn (tên phòng, tiện nghi) nhưng không hiểu so sánh giá, số khách, và luôn trả kết quả cho câu ngoài phạm vi.');
  lines.push('- **vector** (cách cũ) truy xuất ở cấp khách sạn bằng mô tả khách sạn nên không phân biệt được hạng phòng, giá hay sức chứa; phù hợp câu hỏi theo địa điểm/phong cách.');
  lines.push('- **pipeline** tách ràng buộc cứng (giá, số khách, tiện nghi, loại phòng, thành phố, ngày) để lọc có cấu trúc trước, rồi mới xếp hạng ngữ nghĩa; câu ngoài phạm vi bị guardrail từ chối trước khi truy xuất.');
  lines.push('- Groundedness và citation correctness của câu trả lời được đo trên RagLog thật (trang Admin → RAG Analytics) sau khi chạy `scripts/replayGoldenQueries.js`.');

  const outDir = path.join(ROOT, 'docs');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'rag-benchmark.md'), lines.join('\n') + '\n');
  fs.writeFileSync(path.join(outDir, 'rag-benchmark.json'), JSON.stringify({ k: K, corpus: CORPUS, overall, byIntent, perQuery }, null, 2));

  console.log('\n' + lines.slice(lines.indexOf('## Kết quả tổng'), lines.indexOf('## Error analysis (pipeline)')).join('\n'));
  console.log('Đã ghi docs/rag-benchmark.md và docs/rag-benchmark.json');
  await mongoose.disconnect();
})().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});

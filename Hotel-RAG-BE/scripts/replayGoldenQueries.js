// File: scripts/replayGoldenQueries.js
// Gửi các câu hỏi trong golden_dataset.json qua API thật /api/ai/search (server phải đang chạy),
// sau đó gắn goldenContextIds vào RagLog tương ứng để trang RAG Analytics tính được Hit Rate / Recall.
//   node Hotel-RAG-BE/scripts/replayGoldenQueries.js [http://localhost:5000]
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const RagLog = require('../models/RagLog');
const golden = require('../../golden_dataset.json');

const BASE_URL = process.argv[2] || `http://localhost:${process.env.PORT || 5000}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  let ok = 0;

  for (const item of golden) {
    const startedAt = new Date();
    const res = await fetch(`${BASE_URL}/api/ai/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: item.user_query })
    }).catch((error) => ({ ok: false, status: error.message }));

    if (!res.ok) {
      console.log(`${item.query_id}  LỖI API (${res.status})`);
      continue;
    }

    // Log được ghi ngầm sau khi trả response -> chờ tối đa 5s
    let log = null;
    for (let i = 0; i < 10 && !log; i++) {
      await sleep(500);
      log = await RagLog.findOne({ userQuery: item.user_query.trim(), createdAt: { $gte: startedAt } });
    }
    if (!log) {
      console.log(`${item.query_id}  KHÔNG THẤY RagLog`);
      continue;
    }

    log.goldenContextIds = item.golden_context_ids.map((id) => new mongoose.Types.ObjectId(id));
    await log.save();
    ok++;

    const golds = item.golden_context_ids;
    const hits = log.retrievedContextIds.filter((id) => golds.includes(id.toString())).length;
    console.log(`${item.query_id}  ${String(log.latencyMs).padStart(5)}ms  KS=${log.retrievedHotelIds.length}  hit=${hits}/${golds.length}  ${item.user_query}`);
  }

  console.log(`\nĐã ghi ${ok}/${golden.length} RagLog có nhãn chuẩn.`);
  await mongoose.disconnect();
})().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});

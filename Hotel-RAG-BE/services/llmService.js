// File: services/llmService.js
// Một điểm duy nhất gọi AI. Hệ thống chỉ dùng model chạy bằng Ollama (không còn gọi Gemini):
//   - Sinh câu trả lời:  POST {OLLAMA_URL}/api/chat  với OLLAMA_MODEL (mặc định dolphin3)
//   - Tạo vector (embedding): POST {OLLAMA_URL}/api/embed với OLLAMA_EMBED_MODEL (mặc định bge-m3, 1024 chiều,
//     hiểu tiếng Việt tốt). Vector khách sạn và vector câu hỏi phải cùng một model mới so sánh được.
// Biến môi trường:
//   OLLAMA_URL (mặc định http://127.0.0.1:11434) - trên Render là URL tunnel của Colab
//   OLLAMA_API_KEY (không bắt buộc) - header "Authorization: Bearer <key>" cho proxy có xác thực (Colab)
//   OLLAMA_MODEL, OLLAMA_EMBED_MODEL, OLLAMA_TIMEOUT_MS (mặc định 120000), OLLAMA_EMBED_TIMEOUT_MS (mặc định 30000)
//   LLM_PROVIDER=off -> tắt sinh câu trả lời (chatbot trả câu dựng sẵn)
// Lỗi / quá thời gian sẽ throw để nơi gọi tự fallback (chatbot dùng câu dựng sẵn / xếp hạng theo từ khóa).

const EMBED_DIMS = 1024; // số chiều vector của bge-m3

const config = (overrides = {}) => ({
  provider: (overrides.provider || process.env.LLM_PROVIDER || 'ollama').toLowerCase(),
  ollamaUrl: (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, ''),
  ollamaModel: overrides.model || process.env.OLLAMA_MODEL || 'dolphin3',
  embedModel: process.env.OLLAMA_EMBED_MODEL || 'bge-m3',
  ollamaTimeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS || 120000),
  embedTimeoutMs: Number(process.env.OLLAMA_EMBED_TIMEOUT_MS || 30000),
  ollamaApiKey: process.env.OLLAMA_API_KEY || ''
});

const headers = (cfg) => ({
  'Content-Type': 'application/json',
  ...(cfg.ollamaApiKey ? { Authorization: `Bearer ${cfg.ollamaApiKey}` } : {})
});

async function generateWithOllama({ system, prompt, temperature, maxTokens }, cfg) {
  const res = await fetch(`${cfg.ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: headers(cfg),
    signal: AbortSignal.timeout(cfg.ollamaTimeoutMs),
    body: JSON.stringify({
      model: cfg.ollamaModel,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt }
      ],
      stream: false,
      keep_alive: '30m', // giữ model trong bộ nhớ để các câu hỏi sau không phải nạp lại
      options: { temperature, num_predict: maxTokens, num_ctx: 4096 }
    })
  });
  if (!res.ok) {
    throw new Error(`Ollama ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data.message?.content?.trim();
  if (!text) throw new Error('Ollama trả về câu trả lời rỗng');
  return { text, provider: 'ollama', model: cfg.ollamaModel };
}

// generateText({ system, prompt, temperature, maxTokens }, { provider, model }) -> { text, provider, model }
async function generateText({ system = '', prompt, temperature = 0.3, maxTokens = 600 }, overrides = {}) {
  const cfg = config(overrides);
  if (cfg.provider === 'off') throw new Error('Đã tắt sinh câu trả lời (LLM_PROVIDER=off)');
  if (cfg.provider !== 'ollama') {
    throw new Error(`LLM_PROVIDER không hợp lệ: ${cfg.provider} (chỉ hỗ trợ ollama | off)`);
  }
  return generateWithOllama({ system, prompt, temperature, maxTokens }, cfg);
}

// embedText(text) -> mảng số (vector). Dùng cho cả vector khách sạn và vector câu hỏi.
async function embedText(text) {
  const cfg = config();
  const res = await fetch(`${cfg.ollamaUrl}/api/embed`, {
    method: 'POST',
    headers: headers(cfg),
    signal: AbortSignal.timeout(cfg.embedTimeoutMs),
    body: JSON.stringify({ model: cfg.embedModel, input: String(text), keep_alive: '30m' })
  });
  if (!res.ok) {
    throw new Error(`Ollama embed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  const vector = data.embeddings?.[0];
  if (!Array.isArray(vector) || !vector.length) throw new Error('Ollama trả về vector rỗng');
  return vector;
}

// Có LLM để gọi không (dùng để quyết định có thử sinh câu trả lời hay dùng câu dựng sẵn ngay)
const isLlmConfigured = () => config().provider === 'ollama';

const embedModelName = () => config().embedModel;

module.exports = { generateText, embedText, isLlmConfigured, embedModelName, EMBED_DIMS };

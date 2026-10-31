// File: services/llmService.js
// Một điểm duy nhất để sinh văn bản bằng LLM. Chọn nhà cung cấp qua biến môi trường:
//   LLM_PROVIDER=gemini  (mặc định) -> Gemini API, cần GEMINI_API_KEY, có giới hạn quota
//   LLM_PROVIDER=ollama              -> model chạy LOCAL qua Ollama (vd. Dolphin 3.0 Llama 3.1 8B)
//     OLLAMA_URL   (mặc định http://127.0.0.1:11434)
//     OLLAMA_MODEL (mặc định dolphin3)
//     OLLAMA_TIMEOUT_MS (mặc định 120000) - model 8B trên GPU 4GB cần vài chục giây
//     OLLAMA_API_KEY (không bắt buộc) - gửi header "Authorization: Bearer <key>" khi Ollama chạy trên
//       server từ xa (vd. AWS EC2) phía sau reverse proxy có xác thực. Ollama gốc không có xác thực.
// Lỗi / quá thời gian sẽ throw để nơi gọi tự fallback (aiController dùng câu trả lời dựng sẵn).
const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_CHAT_MODEL = 'gemini-3.8-flash';

const config = (overrides = {}) => ({
  provider: (overrides.provider || process.env.LLM_PROVIDER || 'gemini').toLowerCase(),
  ollamaUrl: (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, ''),
  ollamaModel: process.env.OLLAMA_MODEL || 'dolphin3',
  ollamaTimeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS || 120000),
  ollamaApiKey: process.env.OLLAMA_API_KEY || ''
});

async function generateWithOllama({ system, prompt, temperature, maxTokens }, cfg) {
  const res = await fetch(`${cfg.ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cfg.ollamaApiKey ? { Authorization: `Bearer ${cfg.ollamaApiKey}` } : {})
    },
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

async function generateWithGemini({ system, prompt, temperature, maxTokens }) {
  if (!process.env.GEMINI_API_KEY) throw new Error('Chưa cấu hình GEMINI_API_KEY');
  const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({
    model: GEMINI_CHAT_MODEL,
    ...(system ? { systemInstruction: system } : {}),
    generationConfig: { temperature, maxOutputTokens: maxTokens }
  });
  const result = await model.generateContent(prompt);
  return { text: result.response.text().trim(), provider: 'gemini', model: GEMINI_CHAT_MODEL };
}

// generateText({ system, prompt, temperature, maxTokens }, { provider })
// -> { text, provider, model }
async function generateText({ system = '', prompt, temperature = 0.3, maxTokens = 600 }, overrides = {}) {
  const cfg = config(overrides);
  const args = { system, prompt, temperature, maxTokens };
  if (cfg.provider === 'ollama') return generateWithOllama(args, cfg);
  if (cfg.provider === 'gemini') return generateWithGemini(args);
  throw new Error(`LLM_PROVIDER không hợp lệ: ${cfg.provider} (chỉ hỗ trợ gemini | ollama)`);
}

// Có LLM để gọi không (dùng để quyết định có thử sinh câu trả lời hay dùng template ngay)
const isLlmConfigured = () => {
  const { provider } = config();
  return provider === 'ollama' || (provider === 'gemini' && Boolean(process.env.GEMINI_API_KEY));
};

module.exports = { generateText, isLlmConfigured };

# Chạy Dolphin 3.0 (Llama 3.1 8B) local thay cho Gemini

Trợ lý RAG có thể sinh câu trả lời bằng một model chạy ngay trên máy qua **Ollama**, thay cho Gemini (bản miễn phí bị giới hạn quota). Bạn chỉ cần đổi biến môi trường, không phải sửa code.

## 1. Phần nào chạy local, phần nào vẫn dùng Gemini

| Bước trong pipeline | Model | Ghi chú |
|---|---|---|
| Tách ràng buộc, lọc, kiểm tra quỹ phòng | Không dùng AI | Luật và truy vấn MongoDB |
| Vector câu hỏi (xếp hạng ngữ nghĩa) | Gemini `gemini-embedding-001` | Phải trùng model đã tạo vector khách sạn (3072 chiều). Nếu hết quota, hệ thống tự xếp hạng bằng từ khóa |
| **Sinh câu trả lời cho khách** | **`LLM_PROVIDER`: `gemini` hoặc `ollama`** | Phần tốn quota nhất, chuyển sang chạy local được |
| Chấm Groundedness (Admin) | `LLM_JUDGE_PROVIDER` (mặc định giống `LLM_PROVIDER`) | Nên dùng model **khác** model trả lời |

Nếu model local lỗi (chưa bật Ollama, chưa tải model, quá thời gian chờ), API vẫn trả lời bằng dữ liệu đã lọc (`answerSource: "template"`) chứ không báo lỗi 500.

## 2. Cấu hình máy và hiệu năng dự kiến

Máy của nhóm: i5-12450H, RAM 16 GB, **RTX 3050 Laptop 4 GB VRAM**, ổ C còn khoảng 10 GB trống.

- Bản `dolphin3` mặc định (8B, lượng tử hóa 4-bit) nặng khoảng **4.9 GB**, lớn hơn 4 GB VRAM. Ollama sẽ đặt phần lớn các lớp lên GPU và phần còn lại lên CPU/RAM, nên vẫn chạy được nhưng chậm hơn so với khi nằm hết trên GPU.
- Câu hỏi **đầu tiên** sau khi bật phải chờ nạp model vào bộ nhớ (vài chục giây). Code đặt `keep_alive: 30m` nên các câu sau nhanh hơn.
- Thời gian chờ mặc định là 120 giây (`OLLAMA_TIMEOUT_MS`).
- Khi chạy model, nên tắt bớt ứng dụng nặng (trình duyệt nhiều tab, game) để còn RAM và VRAM.

## 3. Cài đặt

### Bước 1: Cài Ollama

Tải bộ cài cho Windows tại https://ollama.com/download, hoặc chạy:

```powershell
winget install Ollama.Ollama
```

### Bước 2: Lưu model sang ổ D (vì ổ C còn ít chỗ)

Tạo biến môi trường `OLLAMA_MODELS` trỏ sang ổ D, sau đó **thoát Ollama ở khay hệ thống rồi mở lại** để nhận cấu hình mới:

```powershell
setx OLLAMA_MODELS "D:\ollama\models"
```

### Bước 3: Tải và thử model

```powershell
ollama pull dolphin3
ollama run dolphin3 "Giới thiệu ngắn một khách sạn ven biển ở Đà Nẵng bằng tiếng Việt."
```

`dolphin3` trên thư viện Ollama là **Dolphin 3.0 Llama 3.1 8B**. Các bản lượng tử hóa khác (nhẹ hơn hoặc chất lượng cao hơn) xem tại https://ollama.com/library/dolphin3/tags. Nếu dùng bản khác, đặt đúng tên tag vào `OLLAMA_MODEL`.

Kiểm tra Ollama đang chạy (phải thấy `dolphin3` trong danh sách):

```powershell
curl http://127.0.0.1:11434/api/tags
```

### Bước 4: Cấu hình `.env` ở thư mục gốc

```env
LLM_PROVIDER=ollama
OLLAMA_MODEL=dolphin3
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_TIMEOUT_MS=120000

# Không bắt buộc: dùng Gemini làm giám khảo Groundedness để tránh model tự chấm câu trả lời của mình
LLM_JUDGE_PROVIDER=gemini

# Vẫn giữ để tạo vector câu hỏi / khách sạn
GEMINI_API_KEY=...
```

Khởi động lại API (`npm run dev`). Mỗi câu trả lời và mỗi bản ghi trong `raglogs` có trường `llmModel`, ví dụ `"ollama:dolphin3"`, để biết model nào đã trả lời. Muốn quay lại Gemini: đặt `LLM_PROVIDER=gemini`.

## 4. Lưu ý quan trọng về Dolphin

1. **Dolphin là model "uncensored"** (đã gỡ cơ chế từ chối có sẵn), nên mọi giới hạn hành vi phải do hệ thống đặt ra:
   - **Guardrail chạy trước khi gọi model:** câu hỏi độc hại, ngoài phạm vi hoặc prompt injection bị chặn ở `queryConstraintParser.js` và không bao giờ được gửi tới model. Có test chứng minh: `tests/llm-ollama.test.js`.
   - **System prompt** (`ANSWER_SYSTEM_PROMPT` trong `controllers/aiController.js`) quy định: chỉ dùng dữ liệu đã truy xuất, bắt buộc trích dẫn `[n]`, chỉ tư vấn về phòng. Dolphin tuân theo system prompt rất sát.
2. **Tiếng Việt:** Llama 3.1 8B viết tiếng Việt ở mức khá, nhưng có thể sai chính tả, lẫn tiếng Anh hoặc bỏ trích dẫn. Hãy đo bằng số liệu thay vì cảm nhận:

   ```powershell
   npm run rag:replay
   ```

   Sau đó xem **Citation correctness** và **Groundedness** ở Admin → RAG Analytics. Nếu chất lượng chưa đạt, đổi sang model khác chỉ bằng `OLLAMA_MODEL` (ví dụ một model đa ngôn ngữ cỡ 7B) rồi so sánh lại trên cùng Golden Query Set.
3. **Giấy phép:** Dolphin 3.0 dựa trên Llama 3.1, dùng theo Llama 3.1 Community License (được phép cho mục đích học tập và nghiên cứu).
4. **Báo cáo đồ án:** ghi rõ model sinh câu trả lời là "Dolphin 3.0 Llama 3.1 8B chạy local qua Ollama", và embedding vẫn là Gemini.

## 5. Xử lý sự cố

| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| `answerSource` luôn là `template`, log ghi `fetch failed` | Ollama chưa chạy. Mở ứng dụng Ollama hoặc chạy `ollama serve` |
| Log ghi `Ollama 404 ... model not found` | Chưa `ollama pull dolphin3`, hoặc `OLLAMA_MODEL` sai tên tag |
| Log ghi `The operation was aborted due to timeout` | Máy trả lời chậm hơn 120 giây: tăng `OLLAMA_TIMEOUT_MS` hoặc dùng bản lượng tử hóa nhẹ hơn |
| Câu trả lời bằng tiếng Anh | Model không theo kịp yêu cầu tiếng Việt: thử model khác hoặc giảm số lựa chọn đưa vào ngữ cảnh |
| Chấm Groundedness báo "không đúng định dạng" | Model giám khảo không trả JSON: đặt `LLM_JUDGE_PROVIDER=gemini` |

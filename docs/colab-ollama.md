# Chạy Dolphin 3.0 trên Google Colab (GPU T4 miễn phí)

Model chạy trên GPU T4 miễn phí của Colab. Backend Hotel-RAG vẫn chạy trên máy bạn và gọi tới model qua một **URL tunnel Cloudflare** có **khóa bảo vệ**. Code không cần sửa, chỉ đổi `.env`.

```
Máy bạn (npm run dev) ──HTTPS──► *.trycloudflare.com ──► Colab: proxy kiểm tra khóa ──► Ollama + dolphin3 (GPU T4)
     OLLAMA_URL + OLLAMA_API_KEY
```

Notebook dựng sẵn: [`colab/ollama_dolphin_colab.ipynb`](../colab/ollama_dolphin_colab.ipynb).

## Ưu, nhược điểm

| | |
|---|---|
| ✅ Miễn phí, có GPU T4 16 GB nên chạy trọn model 8B, nhanh hơn RTX 3050 4 GB | ❌ Phiên tự ngắt khi không thao tác hoặc khi hết hạn mức GPU trong ngày; không phải lúc nào cũng xin được GPU |
| ✅ Không cần thẻ tín dụng, không cần tài khoản AWS | ❌ **Mỗi phiên mới có URL và khóa mới**, phải dán lại vào `.env` |
| ✅ Không cần mở cổng hay cấu hình mạng | ❌ Điều khoản Colab bản miễn phí hạn chế dùng notebook làm dịch vụ web. **Chỉ dùng để thử nghiệm và demo ngắn**, không chạy liên tục |

## Các bước

### 1. Mở notebook trên Colab

1. Vào https://colab.research.google.com, chọn **File → Upload notebook**, rồi chọn file `colab/ollama_dolphin_colab.ipynb` trong dự án.
2. Vào **Runtime → Change runtime type → `T4 GPU` → Save**.

### 2. Chạy lần lượt các ô (Shift + Enter)

| Ô | Việc làm | Thời gian |
|---|---|---|
| 1. Kiểm tra GPU | Phải thấy `Tesla T4` | vài giây |
| 2. Cài Ollama | Cài gói phụ thuộc và Ollama | khoảng 1 phút |
| 3. Khởi động Ollama | Chạy `ollama serve` ở chế độ nền, giữ model trong bộ nhớ 1 giờ | vài giây |
| 4. Tải model | `ollama pull dolphin3` (khoảng 4.9 GB) và chạy thử 1 câu | vài phút |
| 5. Proxy xác thực | Sinh khóa ngẫu nhiên; chỉ cho request có `Authorization: Bearer <khóa>` đi qua, và chỉ mở `/api/chat`, `/api/generate`, `/api/tags` | vài giây |
| 6. Tunnel Cloudflare | Tạo URL `https://….trycloudflare.com`, **in sẵn các dòng `.env`** | khoảng 10 giây |
| 7. Kiểm tra | Gọi thử qua tunnel đúng như backend sẽ gọi, in ra thời gian trả lời | vài giây |

### 3. Cấu hình backend trên máy bạn

Copy các dòng mà ô 6 in ra, dán vào file `.env` ở thư mục gốc dự án:

```env
LLM_PROVIDER=ollama
OLLAMA_MODEL=dolphin3
OLLAMA_URL=https://<chuoi-ngau-nhien>.trycloudflare.com
OLLAMA_API_KEY=<khoa-ngau-nhien>
OLLAMA_TIMEOUT_MS=90000
```

Giữ nguyên `GEMINI_API_KEY`, vì embedding vẫn dùng Gemini. Khởi động lại API (`npm run dev`), rồi hỏi trợ lý trên website. Response phải có `answerSource: "llm"` và `llmModel: "ollama:dolphin3"`.

`OLLAMA_TIMEOUT_MS=90000` để thấp hơn giới hạn khoảng 100 giây cho mỗi request của tunnel Cloudflare miễn phí. Model 8B trên T4 thường trả lời nhanh hơn nhiều so với mức này.

### 4. Trong và sau buổi demo

- **Giữ tab Colab mở**, thỉnh thoảng thao tác để phiên không bị ngắt vì để yên.
- Nếu Colab ngắt giữa chừng, website **vẫn trả lời** bằng dữ liệu đã lọc (`answerSource: "template"`). Mở lại notebook, chạy lại từ ô 1, rồi dán `.env` mới.
- Dùng xong: **Runtime → Disconnect and delete runtime**.

## Bảo mật

- **Khóa và URL chỉ để trong `.env`** (đã có trong `.gitignore`); không đưa vào báo cáo, ảnh chụp màn hình hay commit.
- Không có khóa, request bị trả `401`. Các API quản trị của Ollama (tải, xóa, tạo model) bị chặn `404`. Code proxy nằm ở `colab/auth_proxy.py`.
- Khóa được sinh mới mỗi phiên, nên một khóa bị lộ chỉ dùng được đến khi phiên đó kết thúc.

## Xử lý sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| Ô 1 báo không có GPU | Chưa chọn `T4 GPU` ở Change runtime type, hoặc đã hết hạn mức GPU miễn phí (thử lại sau vài giờ) |
| Ô 3 báo "Ollama chưa chạy" | Xem `ollama.log`; chạy lại ô 2 rồi ô 3 |
| Ô 6 không in ra URL | Xem `cloudflared.log`; chạy lại ô 6 |
| Ô 7 báo `HTTP Error 530/502` | Tunnel chưa sẵn sàng: đợi vài giây rồi chạy lại ô 7 |
| Log backend ghi `Ollama 401` | `OLLAMA_API_KEY` trong `.env` không khớp với phiên hiện tại (dán lại từ ô 6) |
| Log backend ghi `fetch failed` | Phiên Colab đã kết thúc hoặc URL đã cũ |
| Lỗi 524 hoặc quá thời gian chờ | Câu trả lời lâu hơn khoảng 100 giây (giới hạn của tunnel). Giảm độ dài câu hỏi, hoặc kiểm tra GPU còn được cấp không |

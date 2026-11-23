# Nhật ký thay đổi và tiến độ dự án Hotel-RAG (Nestly)

> **Quy ước ghi:** file này **chỉ ghi thêm (append-only)**.
> - Mỗi lần thay đổi, thêm một mục mới **ở cuối danh sách**, ngay phía trên khối "MẪU" (khối mẫu luôn nằm cuối file).
> - **Không sửa hay xóa** các mục cũ. Nếu mục cũ có điểm sai hoặc đã lỗi thời, ghi một mục mới nêu rõ "đính chính mục ngày …".
> - Mỗi mục ghi: ngày, người thực hiện, thay đổi, file chính, cách kiểm chứng, việc còn lại.
>
> Tài liệu hướng dẫn cài đặt và chạy dự án nằm ở [`README.md`](README.md); tài liệu nộp kèm báo cáo nằm trong [`docs/`](docs/).

---

## [05/10 – 29/10/2026] Mốc ban đầu (tổng hợp từ lịch sử Git)

**Người thực hiện:** Quanh, mokhoar26000-sketch, An Tran (theo tác giả commit)

**Đã có:**

| Ngày | Commit | Nội dung |
|---|---|---|
| 13/10 | `backend` | Khung backend Express + MongoDB, các model User, Hotel, RoomType, RoomInventory, Booking, Payment |
| 17/10 | `RAG` | Embedding Gemini cho khách sạn, Atlas Vector Search |
| 18/10 | `login-jwt+home+detail` | Đăng nhập JWT, trang chủ, chi tiết khách sạn |
| 21/10 | `Add authenticated booking history` | Lịch sử đặt phòng có xác thực |
| 23/10 | `admin`, `Add partner approval and demo payments` | Admin quản lý user, duyệt partner; thanh toán demo |
| 24/10 | `Hoàn thiện luồng Tìm kiếm Khách sạn và Lịch sử Đặt phòng` | Tìm kiếm, top 8, giá động theo ngày |
| 25/10 | `checkout-vnpay`, `Hoàn thiện đăng ký đối tác và luồng đặt phòng`, `fix` | Checkout đếm ngược 5 phút, VNPay, partner quản lý hạng phòng và quỹ phòng |
| 29/10 | `rag` | Hoàn thiện trợ lý RAG |

**Tiến độ ước tính:** khoảng 80% chức năng.

---

## [31/10/2026] Hoàn thiện 20% chức năng còn lại

**Người thực hiện:** Quanh (code hỗ trợ bởi Claude Code)

**Thay đổi:**
- **Admin Dashboard:**
  - API `GET /api/admin/hotels?status=` và `PUT /api/admin/hotels/:id/status`.
  - Thêm trạng thái `Rejected` kèm lý do từ chối.
  - Giao diện lọc Chờ duyệt / Đã duyệt / Từ chối / Tất cả, có nút Duyệt / Từ chối / Xem hồ sơ.
- **Partner quản lý đơn:**
  - API `GET /api/partner/bookings` và `PUT /api/partner/bookings/:id/complete`.
  - Component `PartnerBookings.jsx` với các tab Nhận phòng hôm nay / Trả phòng hôm nay / Đang lưu trú / Sắp đến; thẻ thống kê lấy số liệu thật.
- **Đánh giá (Review):**
  - API `POST /api/reviews` (chỉ cho đơn `Completed`, mỗi đơn đánh giá một lần) và `GET /api/reviews/hotel/:id`.
  - Tự tính lại `Hotel.rating` và `reviewCount`.
  - Giao diện chấm sao trong Profile và khối đánh giá ở trang chi tiết khách sạn.
- **Cronjob (`node-cron`):**
  - Mỗi phút hủy đơn `Pending` quá 5 phút và hoàn `availableRooms`.
  - Mỗi ngày lúc 00:05 chuyển đơn đã qua ngày trả phòng sang `Completed`.
- **Sửa lỗi phát hiện được:**
  - Tạo đơn trước đây **không trừ quỹ phòng**. Nay trừ ngay khi tạo đơn, theo cách nguyên tử từng đêm, có rollback.
  - Bỏ TTL index tự xóa đơn `Pending` (làm mất quỹ phòng).
  - Link VNPay hết hạn cùng lúc với thời gian giữ chỗ.
  - Tạo khách sạn không có tọa độ bị lỗi 500 trên DB có index `2dsphere`.
  - Route `/hotels/featured` đặt sau `/:id` nên không chạy.
  - Thông báo "tạo Vector AI thành công" sai khi Gemini lỗi.

**File chính:** `controllers/adminController.js`, `partnerController.js`, `reviewController.js`, `bookingController.js`, `services/inventoryService.js`, `jobs/bookingCron.js`, `AdminDashboard.jsx`, `PartnerBookings.jsx`, `ProfilePage.jsx`, `HotelDetail.jsx`, `HotelReviews.jsx`, `StarRating.jsx`.

**Kiểm chứng:**
- 30 kịch bản end-to-end trên MongoDB tạm ở máy, đều pass.
- Kiểm tra giao diện trên trình duyệt với 3 vai trò.

---

## [31/10/2026] Rà soát và chuẩn hóa dữ liệu MongoDB Atlas (Cluster0 / `Hotel-RAG`)

**Người thực hiện:** Quanh (hỗ trợ bởi Claude Code)

**Thay đổi dữ liệu** (qua script `Hotel-RAG-BE/scripts/seedMockData.js`, chạy lại không sinh dữ liệu trùng):
- **Users:**
  - Sửa `partnerApplicationStatus` sai enum (`approve`).
  - Tạo partner bị thiếu (`640000000000000000000001`) mà khách sạn đang tham chiếu tới.
  - Thêm 12 khách hàng mock `mock.customer*@nestly.test`.
- **Hotels:**
  - Thay ảnh hỏng (`example.com` và các ảnh Unsplash bị 404); mỗi khách sạn có 5 ảnh hợp lệ.
  - Bổ sung tọa độ.
  - Tính lại `rating` từ review thật thay cho số gán cứng.
  - Tạo lại 8 vector embedding bị rỗng hoặc hỏng (có vector chỉ 5 chiều).
- **RoomTypes:**
  - Thêm 27 hạng phòng cho 11 khách sạn đã duyệt mà chưa có phòng (trước đó không bao giờ xuất hiện trong tìm kiếm).
  - Sửa ảnh và điền các trường còn thiếu.
- **RoomInventories:** mở bán 60 ngày tới cho mọi hạng phòng (thêm 2.260 bản ghi).
- **Bookings / Payments / Reviews (mock):**
  - 68 đơn `Completed` kèm thanh toán và 65 đánh giá.
  - 28 đơn `Confirmed` sắp tới (đã trừ quỹ phòng).
  - 5 đơn `Canceled` kèm payment `Failed`.
- Xóa 2 collection rỗng tạo nhầm: `RagLog` và `ratings`.

**Sửa code ghi log:**
- `raglogs` trước đây **luôn rỗng**: route `/api/ai/search` không ghi log, còn `ragController.js` là code chết.
- Payment chỉ được ghi khi thành công. Nay ghi thêm cả giao dịch `Failed`.
- **Lỗi lớn:** server chạy Express 5, trong đó `req.query` không có prototype, nên **mọi callback VNPay trả 500**. Đã sửa.
- API chấm Groundedness gọi model `gemini-1.5-flash` đã bị gỡ. Chuyển sang `gemini-3.8-flash`.
- Trang RAG Analytics đọc sai token và chưa có route. Đã thêm `/admin/rag`.
- `createRoomType` lưu ngày quỹ phòng theo giờ địa phương, lệch với `updateInventory` (dùng mốc UTC). Đã thống nhất về 00:00 UTC.

**Kiểm chứng:**
- Kiểm tra lại toàn bộ collection sau khi chạy script.
- Test VNPay với chữ ký hợp lệ trên DB local.
- Chạy lại 30 câu golden qua API thật: ghi được 15/30 RagLog. 15 câu còn lại lỗi do Gemini (9 lần 429 hết hạn mức, 6 lần 503 quá tải).

---

## [31/10/2026] Xử lý góp ý của giảng viên (file góp ý `Book1.xlsx`)

**Người thực hiện:** Quanh (hỗ trợ bởi Claude Code)

**Thay đổi theo từng góp ý:**
- **#2 Thuật ngữ AI:** xác định sản phẩm là **RAG Chatbot**, không phải AI Agent; ghi rõ lý do trong `docs/rag-pipeline.md`.
- **#3 Đánh giá RAG:**
  - `scripts/ragBenchmark.js` so sánh keyword, vector và pipeline trên cùng Golden Query Set.
  - Đo HitRate, Recall, Precision, nDCG, MRR @5, tỉ lệ từ chối đúng câu ngoài phạm vi, kèm error analysis.
  - `services/ragMetrics.js` dùng chung cho benchmark và trang Admin RAG Analytics (có thêm citation correctness và groundedness).
- **#4 Ràng buộc cứng:**
  - Pipeline mới: tách ràng buộc (`queryConstraintParser.js`) → lọc có cấu trúc → kiểm tra quỹ phòng mọi đêm và ngân sách theo giá động → xếp hạng ngữ nghĩa (`ragRetrieval.js`).
  - Thêm guardrail cho câu hỏi độc hại hoặc ngoài phạm vi.
  - Khi Gemini lỗi, trả câu trả lời dựng từ dữ liệu thay vì lỗi 500.
  - Widget chat hiển thị các ràng buộc đã hiểu, giá và số phòng còn trống.
- **#5 Đặt phòng đồng thời:**
  - Thêm `Idempotency-Key` cho `POST /api/bookings`, có unique index; frontend tự sinh key.
  - Test đồng thời: stock = 1 với 2 request, stock = 3 với 10 request; test rollback nhiều đêm và idempotency.
- **#6 RBAC / Ownership:**
  - Thêm `middleware/ownershipMiddleware.js`.
  - Vá 4 lỗ hổng:
    - Customer khóa được phòng bất kỳ.
    - Partner A sửa được giá và quỹ phòng của Partner B.
    - Ai đăng nhập cũng xem được quỹ phòng.
    - Tạo được link thanh toán cho đơn của người khác.
  - Tài khoản bị khóa không đăng nhập được nữa.
  - Bổ sung negative test 401/403.
- **#7 Thật / mock:**
  - Nút "Lưu thay đổi" ở Profile nay gọi API thật (`/api/users/me`); thêm chức năng đổi mật khẩu.
  - Gỡ tab "Phương thức thanh toán" đang để trống.
  - Bảng phân loại Implemented / Prototype / Mock / Planned.
- **#1, #8 Hồ sơ:** bảng Task–Owner–Deadline–%–Evidence và đối chiếu thứ tự ưu tiên.
- **Hạ tầng:**
  - Tách `createApp.js` khỏi `server.js` để test được.
  - Thêm các lệnh `npm test`, `npm run rag:benchmark`, `npm run rag:replay`, `npm run seed:mock`.
  - Cập nhật `README.md`.
  - Xóa `ragController.js` (code chết).

**Tài liệu mới:** `docs/rag-pipeline.md`, `docs/rag-benchmark.md`, `docs/booking-concurrency.md`, `docs/security-rbac.md`, `docs/implementation-status.md`, `docs/progress-and-scope.md`.

**Kiểm chứng:**
- `npm test`: 36/36 test pass.
- Benchmark @5 trên corpus đóng băng:

  | Phương pháp | HitRate | nDCG | Từ chối đúng |
  |---|---|---|---|
  | keyword | 0.870 | 0.728 | 0/7 |
  | vector | 0.739 | 0.531 | 0/7 |
  | pipeline | 0.913 | 0.868 | 7/7 |

- Gọi `/api/ai/search` trên dữ liệu Atlas thật: 38 → 9 → 6 ứng viên, top 5 đúng mọi ràng buộc.
- Build và lint frontend sạch.

**Việc còn lại:**
- Điền các ô `[nhóm bổ sung]` trong `docs/progress-and-scope.md` (họ tên, ngày chốt phạm vi, owner các hạng mục 8–14).
- Cập nhật nhãn Golden lỗi thời cho Q12 và Q19 (phòng đáp án đang bị khóa bảo trì).
- Chạy lại `npm run rag:replay` khi Gemini hết bị giới hạn, để có số liệu groundedness và citation từ câu trả lời LLM thật.
- Kiểm thử VNPay end-to-end trên sandbox (hiện ở mức Prototype).
- Cập nhật báo cáo `.docx` theo các tài liệu trong `docs/`.
- Commit và gắn tag phiên bản nộp: **tại thời điểm ghi mục này, toàn bộ thay đổi ngày 31/10 chưa được commit**.

**Tiến độ:** chức năng khoảng 95% (còn VNPay sandbox); hồ sơ khoảng 60%.

---

## [31/10/2026] Commit toàn bộ thay đổi ngày 31/10 lên GitHub

**Người thực hiện:** Quanh (hỗ trợ bởi Claude Code)

**Thay đổi:**
- Commit tất cả code, script, test và tài liệu của 3 mục ngày 31/10 phía trên lên nhánh `feature/hoan-thien-gop-y` của repo `Guarz/010100086404-DoAnChuyenNganh` (chưa gộp vào `main`).
- **Không** đưa vào commit:
  - việc xóa `baocaonhom13.docx` (thay đổi có sẵn từ trước, chưa rõ chủ ý);
  - các thay đổi trong `node_modules/` (`node-cron` đã khai báo trong `package.json`, cài bằng `npm install`);
  - `.claude/settings.json` (cấu hình máy cá nhân).

**Kiểm chứng:** `git log` trên nhánh và trang GitHub của nhánh.

**Việc còn lại:**
- Tạo Pull Request từ `feature/hoan-thien-gop-y` vào `main`, xem lại rồi merge.
- Sau khi pull về, mỗi máy chạy `npm install` ở thư mục gốc để cài `node-cron`.

**Tiến độ:** không đổi so với mục trước.

---

## [31/10/2026] Chọn được LLM sinh câu trả lời (Gemini hoặc Dolphin 3.0 chạy local) + rà soát golden_dataset.json

**Người thực hiện:** Quanh (hỗ trợ bởi Claude Code)

**Thay đổi:**
- Thêm `services/llmService.js`: chọn nhà cung cấp LLM qua `LLM_PROVIDER` (`gemini` mặc định, hoặc `ollama`).
  - Mặc định dùng model `dolphin3` (Dolphin 3.0 Llama 3.1 8B) qua Ollama API `/api/chat`.
  - Có timeout và `keep_alive`.
- `aiController`:
  - Quy tắc trả lời chuyển vào system prompt (Dolphin là model uncensored nên quy tắc phải nằm ở đây).
  - Ghi `llmModel` vào response và `raglogs`.
  - Model local lỗi thì vẫn dùng câu trả lời dựng sẵn từ dữ liệu.
- API chấm Groundedness dùng `llmService`, chọn giám khảo bằng `LLM_JUDGE_PROVIDER`; tách điểm 0/1 bằng regex vì model local hay viết thêm chữ quanh JSON.
- Embedding vẫn dùng Gemini (vector khách sạn trong DB được tạo bằng model này).
- Tài liệu `docs/local-llm-dolphin.md`: cài Ollama, lưu model sang ổ D, cấu hình `.env`, lưu ý về Dolphin, xử lý sự cố. Cập nhật `README.md`.

**Rà soát `golden_dataset.json`** (chỉ phân tích, chưa sửa file):
- File gán nhãn **truy xuất** (hạng phòng đúng cho mỗi câu), **không** gán nhãn **câu trả lời**: không có câu trả lời chuẩn hay dữ kiện bắt buộc phải nêu.
- Nhãn sai hoặc thiếu so với dữ liệu hiện tại:
  - Q07 (Smart TV): thiếu 4 phòng.
  - Q11 (2 người lớn + 1 trẻ em): thiếu "Biệt thự Family 2 phòng ngủ".
  - Q12 (Hà Nội): thiếu "Executive Suite"; phòng đáp án đang bị khóa.
  - Q19: phòng đáp án đang bị khóa.
- Không có câu nào kèm ngày ở hoặc tình trạng phòng trống.

**File chính:** `Hotel-RAG-BE/services/llmService.js`, `controllers/aiController.js`, `controllers/adminController.js`, `models/RagLog.js`, `tests/llm-ollama.test.js`, `docs/local-llm-dolphin.md`, `README.md`.

**Kiểm chứng:**
- `npm test`: 39/39 test pass, trong đó 3 test mới dùng server Ollama giả lập: đúng định dạng request, fallback khi Ollama lỗi, guardrail chặn câu độc hại trước khi tới model.
- Chưa chạy với Ollama thật vì máy chưa cài Ollama.

**Việc còn lại:**
- Cài Ollama, tải `dolphin3`, đo chất lượng tiếng Việt bằng `npm run rag:replay` (citation correctness, groundedness).
- Sửa nhãn Golden (Q07, Q11, Q12, Q19) và bổ sung trường gán nhãn câu trả lời nếu cần chấm câu trả lời.
- Commit các thay đổi của mục này.

**Tiến độ:** không đổi.

---

## [31/10/2026] Hướng dẫn chạy Ollama trên AWS EC2 + hỗ trợ Ollama từ xa có khóa

**Người thực hiện:** Quanh (hỗ trợ bởi Claude Code)

**Thay đổi:**
- `services/llmService.js`: thêm biến `OLLAMA_API_KEY` (không bắt buộc). Khi có biến này, code gửi header `Authorization: Bearer <key>` để gọi Ollama đặt sau reverse proxy có xác thực trên server từ xa.
- Tài liệu `docs/aws-ollama.md`:
  - Chọn máy `g4dn.xlarge` (T4 16 GB) ở region Singapore.
  - Xin hạn mức vCPU GPU; tạo cảnh báo chi phí.
  - Tạo EC2 bằng AMI có sẵn driver NVIDIA; cài Ollama và `dolphin3`.
  - Hai cách kết nối an toàn: **SSH tunnel** (khuyên dùng), hoặc **Nginx reverse proxy + Bearer key + giới hạn IP/HTTPS**. Không bao giờ mở cổng 11434 ra Internet.
  - Cách tiết kiệm chi phí (Stop/Terminate, Spot) và xử lý sự cố.
- Thêm liên kết tài liệu trong `README.md`.

**File chính:** `Hotel-RAG-BE/services/llmService.js`, `Hotel-RAG-BE/tests/llm-ollama.test.js`, `docs/aws-ollama.md`, `README.md`.

**Kiểm chứng:**
- `npm test`: 40/40 test pass, có thêm test gửi đúng Bearer token khi đặt `OLLAMA_API_KEY`.
- Chưa triển khai thử trên AWS thật (cần tài khoản AWS và hạn mức GPU).

**Việc còn lại:**
- Xin hạn mức GPU, tạo EC2 theo hướng dẫn, chạy `npm run rag:replay` để đo độ trễ và chất lượng câu trả lời.
- Commit các thay đổi của mục này và mục trước.

**Tiến độ:** không đổi.

---

## [31/10/2026] Bổ sung lựa chọn cho tài khoản AWS Free plan

**Người thực hiện:** Quanh (hỗ trợ bởi Claude Code)

**Thay đổi:**
- Thêm mục "1b" vào `docs/aws-ollama.md`, vì tài khoản AWS Free plan không tạo được `g4dn.xlarge` (máy có GPU). Ba hướng xử lý:
  - (A) nâng cấp lên Paid plan để dùng GPU;
  - (B) ở lại Free plan với `m7i-flex.large` (chỉ CPU) và model Dolphin 3.0 bản 3B, tăng `OLLAMA_TIMEOUT_MS`;
  - (C) chạy trên máy cá nhân — đây là hướng khuyên dùng.
- Ghi thêm các lựa chọn miễn phí ngoài AWS: Oracle Cloud Always Free, Colab/Kaggle.
- Không sửa code.

**File chính:** `docs/aws-ollama.md`.

**Kiểm chứng:** chưa thử trên AWS thật; tên repo GGUF bản 3B cần kiểm tra lại trên Hugging Face trước khi tải.

**Việc còn lại:** nhóm chọn hướng A, B hoặc C, rồi đo độ trễ và chất lượng câu trả lời bằng `npm run rag:replay`.

**Tiến độ:** không đổi.

---

## [31/10/2026] Chạy Dolphin 3.0 trên Google Colab (GPU T4 miễn phí)

**Người thực hiện:** Quanh (hỗ trợ bởi Claude Code)

**Thay đổi:**
- Notebook `colab/ollama_dolphin_colab.ipynb` gồm các bước:
  - kiểm tra GPU;
  - cài Ollama và chạy `ollama serve` ở chế độ nền;
  - tải `dolphin3`;
  - chạy proxy xác thực;
  - mở tunnel Cloudflare (không cần tài khoản);
  - in sẵn các dòng `.env` và gọi thử qua tunnel.
- `colab/auth_proxy.py`:
  - Proxy chỉ dùng thư viện chuẩn Python, đứng trước Ollama.
  - Chỉ cho request có `Authorization: Bearer <khóa>` đi qua; khóa sinh ngẫu nhiên mỗi phiên.
  - Chỉ mở `/api/chat`, `/api/generate`, `/api/tags`.
  - Backend dùng sẵn biến `OLLAMA_API_KEY`, không cần sửa code.
- Tài liệu `docs/colab-ollama.md` (các bước, cấu hình `.env`, bảo mật, xử lý sự cố). Thêm liên kết trong `README.md`.

**File chính:** `colab/ollama_dolphin_colab.ipynb`, `colab/auth_proxy.py`, `docs/colab-ollama.md`, `README.md`.

**Kiểm chứng:**
- Test proxy trên máy với một Ollama giả lập: không có khóa hoặc sai khóa → `401`; gọi API quản trị → `404`; đúng khóa → chuyển tiếp thành công.
- Kiểm tra cú pháp toàn bộ các ô code trong notebook.
- **Chưa chạy thử trên Colab thật.**

**Việc còn lại:**
- Chạy notebook trên Colab, đo thời gian trả lời và chất lượng bằng `npm run rag:replay`.
- Lưu ý: điều khoản Colab bản miễn phí hạn chế dùng notebook làm dịch vụ web, nên chỉ dùng để thử nghiệm và demo ngắn.

**Tiến độ:** không đổi.

---

## [31/10/2026] Tiện nghi hạng phòng, Partner chỉnh sửa, bộ lọc tiện nghi, rà soát responsive

**Người thực hiện:** Quanh (hỗ trợ bởi Claude Code)

**Thay đổi:**
- **Chi tiết khách sạn (`HotelDetail.jsx`):**
  - Thẻ hạng phòng hiển thị mô tả, danh sách tiện nghi (6 mục đầu, có nút "Xem tất cả") và số ảnh.
  - Thêm trình xem ảnh `PhotoGallery` cho ảnh khách sạn và ảnh hạng phòng (trước đây nút "Xem tất cả ảnh" là Mock).
  - Sửa lỗi hiện "undefined TE" khi phòng thiếu số trẻ em.
- **Partner chỉnh sửa:**
  - API `PUT /api/partner/hotels/:hotelId`: sửa tên, mô tả, địa chỉ, tiện nghi, ảnh. Khách sạn bị từ chối được tự động gửi duyệt lại. Khách sạn đã duyệt thì vector AI được tạo lại ngầm.
  - API `PUT /api/partner/rooms/:roomId`: sửa tiện nghi, ảnh, mô tả, giá gốc, sức chứa, tổng số phòng. Đổi tổng số phòng thì cộng/trừ phần chênh lệch vào quỹ phòng các ngày từ hôm nay, không để âm.
  - Kiểm tra quyền sở hữu bằng `ownershipMiddleware`; validate dữ liệu (`services/amenityCatalog.js`).
  - Giao diện: `HotelEditModal`, `RoomManagerModal`, `AmenityPicker` (chip gợi ý + tự thêm); dùng chung cho form tạo mới.
- **Bộ lọc tiện nghi (`Hotels.jsx`):**
  - API `GET /api/hotels/amenities`: danh mục tiện nghi chuẩn kèm số khách sạn có tiện nghi đó.
  - `GET /api/hotels/search?amenities=`: khách sạn phải có đủ mọi tiện nghi đã chọn, xét cả tiện nghi hạng phòng; khớp được nhiều cách viết khác nhau.
  - Lựa chọn lưu trên URL (chia sẻ được). Thêm sắp xếp theo giá; thẻ khách sạn hiện giá "Từ …/đêm", điểm đánh giá thật và tiện nghi nổi bật.
- **Sửa lỗi phát hiện được:**
  - Form tạo khách sạn thiếu ô mô tả, trong khi model bắt buộc mô tả → tạo khách sạn luôn lỗi 500.
  - Ô tìm thành phố đưa thẳng vào RegExp → gõ "(" là lỗi.
  - Tìm kiếm bỏ qua số phòng cần đặt, và loại nhầm hạng phòng thiếu trường `maxChildren`.
  - Icon `user` không tồn tại.
  - Tùy chọn `new: true` đã bị Mongoose 9 deprecate → đổi sang `returnDocument: 'after'`.
- **Responsive** (đã kiểm tra mọi trang ở bề ngang 375px):
  - Trang chủ: thẻ khách sạn tràn ngang; khung tìm kiếm đè lên tiêu đề.
  - Trang Partner: hàng nút "Tải lại" tràn ngang, làm modal rộng hơn màn hình.
  - Chat AI cố định rộng 400px.
  - Thanh tab Admin vỡ thành 3 dòng.
  - Bảng RAG Analytics bị cắt.
  - Menu Profile chiếm hết màn hình đầu.
  - Thêm khung `Modal` dùng chung (dạng bottom sheet trên điện thoại).
- Frontend: địa chỉ API đọc từ `VITE_API_URL` (mặc định `http://localhost:5000/api`) để deploy được.

**File chính:**
- Backend: `controllers/hotelController.js`, `controllers/partnerController.js`, `services/amenityCatalog.js`, `routes/*`.
- Frontend: `pages/Hotels.jsx`, `HotelDetail.jsx`, `PartnerDashboard.jsx`, `Home.jsx`, `ProfilePage.jsx`, `AdminDashboard.jsx`, `RagAnalyticsDashboard.jsx`; `components/Modal.jsx`, `AmenityPicker.jsx`, `PhotoGallery.jsx`, `partner/*`, `PartnerBookings.jsx`, `AIChatWidget.jsx`, `StatCard.jsx`; `services/api.js`.
- Tài liệu: `README.md`, `docs/security-rbac.md`, `docs/implementation-status.md`.

**Kiểm chứng:**
- `npm test`: 53/53 test pass (13 test mới trong `tests/partner-edit-amenities.test.js`).
- Build và lint frontend: 0 lỗi.
- Kiểm tra trên trình duyệt với bản sao dữ liệu Atlas ở MongoDB local (không ghi gì lên Atlas):
  - Bộ lọc Hồ bơi + Spa: từ 19 còn 3 khách sạn.
  - Partner sửa tiện nghi phòng và khách sạn: lưu đúng vào DB.
  - Mọi trang không còn tràn ngang ở 375px; giao diện desktop không bị vỡ.

**Việc còn lại:** commit các thay đổi.

**Tiến độ:** không đổi.

---

## [31/10/2026] Commit các thay đổi từ sau commit `3bbd67e` lên GitHub

**Người thực hiện:** Quanh (hỗ trợ bởi Claude Code)

**Thay đổi:**
- Commit lên nhánh `feature/hoan-thien-gop-y` toàn bộ thay đổi ghi trong các mục kể từ "Chọn được LLM sinh câu trả lời…":
  - LLM provider (Gemini / Ollama Dolphin);
  - hướng dẫn chạy model trên AWS và Colab;
  - tiện nghi hạng phòng, Partner chỉnh sửa khách sạn/phòng, bộ lọc tiện nghi;
  - rà soát responsive.
- Vẫn **không** đưa vào commit: việc xóa `baocaonhom13.docx`, các thay đổi trong `node_modules/`, thư mục `.claude/`.

**Kiểm chứng:** `git log` và trang GitHub của nhánh.

**Việc còn lại:**
- Tạo Pull Request vào `main`: cần đăng nhập GitHub hoặc cài `gh`.
- Sau khi pull về, chạy `npm install`.

**Tiến độ:** không đổi.

---

## [01/11/2026] File Word minh chứng xử lý góp ý giảng viên

**Người thực hiện:** Quanh (hỗ trợ bởi Claude Code)

**Thay đổi:**
- Tạo `docs/MinhChung_GopY_GiangVien.docx` (22 trang), gồm minh chứng cho 6 góp ý (#2–#7):
  - thuật ngữ RAG Chatbot, không phải Agent;
  - Golden Query Set, benchmark, error analysis, groundedness, citation;
  - pipeline ràng buộc cứng;
  - test đặt phòng đồng thời và trạng thái DB trước/sau;
  - request 401/403 thật, code middleware;
  - bảng Implemented/Prototype/Mock/Planned, số liệu collections, ảnh chụp giao diện.
- Mọi số liệu được tạo tự động từ commit `04eeccc`:
  - `npm test` 53/53 pass;
  - `npm run rag:benchmark`;
  - số liệu đọc trực tiếp MongoDB Atlas;
  - request/response API và 9 ảnh chụp giao diện từ backend + frontend chạy trên bản sao dữ liệu Atlas, không ghi vào Atlas.
- Ghi rõ dữ liệu mock trong DB: 101/107 bookings và 101/105 payments do script seed tạo. Chưa có giao dịch VNPay thành công thật, khớp trạng thái Prototype.

**Kiểm chứng:**
- Mở bằng Microsoft Word: cập nhật mục lục, xuất từng trang ra ảnh để kiểm tra trình bày.
- Đối chiếu từng con số trong file với nguồn (output test, `docs/rag-benchmark.json`, truy vấn Atlas).

**Việc còn lại:**
- Không có Swagger/Postman. Tài liệu dùng test tự động và request/response thật để thay thế, có ghi rõ điều này.
- Báo cáo `.docx` chính của nhóm vẫn cần bỏ chữ "Agent" và đưa các bảng trong file minh chứng vào.
- File minh chứng chưa được commit.

**Tiến độ:** hồ sơ khoảng 70%.

---

## [02/11/2026] Sơ đồ ERD cuối cùng (Mermaid)

**Người thực hiện:** Quanh (hỗ trợ bởi Claude Code)

**Thay đổi:**
- `docs/erd.mmd`: ERD dạng Mermaid `erDiagram` (dán được vào https://mermaid.live), lấy đúng theo 8 model Mongoose hiện tại.
  - Các thực thể: USER, HOTEL, ROOM_TYPE, ROOM_INVENTORY, BOOKING, BOOKING_DETAIL (mảng nhúng trong Booking), PAYMENT, REVIEW, RAG_LOG.
  - Có đủ trường, khóa PK/FK/UK, enum và 13 quan hệ.
- `docs/erd.png`: ảnh xuất từ chính file trên để đưa vào báo cáo.

**Kiểm chứng:** render bằng thư viện Mermaid 11.4.1, không có lỗi cú pháp.

**Việc còn lại:** commit.

**Tiến độ:** không đổi.

---

## [02/11/2026] Từ điển dữ liệu (giải thích các trường)

**Người thực hiện:** Quanh (hỗ trợ bởi Claude Code)

**Thay đổi:**
- `docs/data-dictionary.md`: bảng giải thích từng trường của 8 collection (users, hotels, roomtypes, roominventories, bookings kèm bookingDetails nhúng, payments, reviews, raglogs).
  - Mỗi trường có: kiểu, bắt buộc, mặc định/enum/ràng buộc, ý nghĩa nghiệp vụ.
  - Kèm danh sách index của từng collection.
- Thêm liên kết trong `README.md`.

**Kiểm chứng:** đối chiếu với `Hotel-RAG-BE/models/*.js` và các ràng buộc validate trong controller (độ dài comment, idempotencyKey, giới hạn tiện nghi/ảnh).

**Việc còn lại:** commit.

**Tiến độ:** không đổi.

---

## [09/11/2026] Hoàn thành báo cáo đồ án theo mẫu khoa (`maudoan.docx`)

**Người thực hiện:** Quanh (hỗ trợ bởi Claude Code)

**Thay đổi:**
- Điền file mẫu `D:/School/baocao/maudoan.docx` thành báo cáo hoàn chỉnh (54 trang), giữ nguyên bìa, bảng danh sách nhóm và bảng chấm thi của mẫu; bản mẫu gốc sao lưu tại `maudoan_GOC_backup.docx`.
- Nội dung kế thừa bản nháp `baocaonhom13.docx` và cập nhật theo trạng thái cuối của hệ thống: Mở đầu; Chương 1 (1.1–1.6); Chương 2 (web/REST, React, Node/Express, MongoDB, embedding, RAG, RAG Chatbot vs AI Agent, Gemini/Ollama, JWT/RBAC/VNPay/node-cron); Chương 3 (tác nhân, 19 yêu cầu chức năng, phi chức năng, use case, ERD, 8 bảng collection, kiến trúc, pipeline RAG, đặt phòng chống oversell, phân quyền, giao diện theo tác nhân, kiểm thử 53/53, benchmark RAG); Kết luận; 16 tài liệu tham khảo IEEE; Phụ lục API và hướng dẫn cài đặt.
- Mục lục, danh mục bảng, danh mục hình là trường tự động của Word; số trang La Mã cho phần đầu, số Ả Rập từ Mở đầu; bìa không đánh số.
- 24 hình: 3 use case (từ bản nháp), ERD cuối (`docs/erd.png`), 4 sơ đồ Mermaid mới (kiến trúc, pipeline RAG, tuần tự đặt phòng – VNPay, trạng thái đơn) và 16 ảnh chụp giao diện thật (chụp trên bản sao dữ liệu local, chỉ đọc Atlas).

**File chính:** `D:/School/baocao/maudoan.docx` (ngoài repo).

**Kiểm chứng:** mở bằng Word, cập nhật toàn bộ trường, xuất PDF và soát từng trang.

**Việc còn lại:** sơ đồ use case lấy từ bản nháp chưa có các use case Thanh toán VNPay, Đánh giá, Đăng ký đối tác, Duyệt đối tác, RAG Analytics (đã liệt kê trong Bảng 3.2); nhóm tự rà lại câu chữ trước khi nộp.

**Tiến độ:** hoàn thành báo cáo.

---

## [09/11/2026] Slide thuyết trình và kịch bản thuyết trình

**Người thực hiện:** Quanh (hỗ trợ bởi Claude Code)

**Thay đổi:**
- `D:/School/baocao/Nhom13_BaoCao.pptx`: 18 slide 16:9 (tông xanh rêu – vàng theo giao diện Nestly): bìa, nội dung, bài toán, mục tiêu – phạm vi, công nghệ, kiến trúc, dữ liệu, chức năng, pipeline RAG, ví dụ tách ràng buộc, đặt phòng an toàn, phân quyền, 2 slide demo, biểu đồ benchmark (biểu đồ PowerPoint gốc), kiểm thử, kết luận, hỏi đáp. Lời thoại nằm trong phần Notes của từng slide.
- `D:/School/baocao/Nhom13_KichBanThuyetTrinh.docx`: 12 trang gồm phân công 3 thành viên (đề xuất), dòng thời gian khoảng 17:45 phút, checklist chuẩn bị demo, lời thoại chi tiết theo từng slide, 9 câu hỏi dự kiến kèm gợi ý trả lời, lưu ý khi trình bày.

**File chính:** hai file trên (ngoài repo).

**Kiểm chứng:** pptx qua validate.py; xuất ảnh từng slide bằng PowerPoint và soát; kịch bản cập nhật mục lục bằng Word, xuất PDF soát từng trang.

**Việc còn lại:** nhóm duyệt lại phân công người trình bày và tập dượt canh giờ.

**Tiến độ:** sẵn sàng bảo vệ.

---

## [14/11/2026] Mở rộng: Xe đưa đón (airport transfer) + vai trò Nhà xe (`Transport`)

**Người thực hiện:** Quanh (cùng Claude Code)

**Thay đổi:**
- Vai trò mới `Transport`: khách hàng gửi hồ sơ nhà xe (tên, SĐT, giấy phép KD vận tải, thành phố phục vụ) → Admin duyệt ở tab **Duyệt nhà xe** (duyệt → role `Transport`, gỡ duyệt/từ chối → về `Customer`). Partner/Admin không đăng ký nhà xe được và ngược lại.
- 5 collection mới: `transportcompanies`, `vehicletypes`, `transferroutes`, `vehicleinventories`, `transferbookings`; `payments` thêm `transferBookingId` (VNPay dùng chung cho đơn phòng và đơn xe, trả về `type`).
- Đặt xe dùng lại cơ chế đặt phòng: số xe cần = ⌈khách / số chỗ⌉, trừ xe nguyên tử theo ngày, giữ 5 phút, `Idempotency-Key` (lưu đơn trước để chiếm khóa rồi mới giữ xe — tránh request trùng gửi đồng thời bị báo "hết xe"), cronjob hủy đơn quá hạn + trả xe, tự `Completed` sau ngày đón.
- Middleware sở hữu `transportOwnership.js`: nhà xe chỉ sửa xe / tuyến / lịch / đơn của mình.
- Frontend: `/transfers` (tìm & đặt), `/transfer-checkout/:id`, `/transport-apply`, `/transport` (Trung tâm nhà xe: loại xe, tuyến, lịch xe trống, đơn + thống kê), tab Admin "Duyệt nhà xe", Hồ sơ → "Xe đưa đón", mục xe đưa đón ở trang chi tiết khách sạn, nút "Đặt xe đưa đón" sau khi thanh toán phòng và trong lịch sử đặt phòng; Header hiện menu theo vai trò; VNPayReturn phân biệt đơn phòng / đơn xe.
- `seedMockData.js` thêm bước "Xe đưa đón": 3 nhà xe (`mock.transport1..3@nestly.test`, mật khẩu như các tài khoản mock), 9 loại xe, tuyến sân bay ↔ trung tâm cho các thành phố có khách sạn, lịch 60 ngày, 12 đơn mẫu có payment.

**File chính:** `Hotel-RAG-BE/models/{TransportCompany,VehicleType,TransferRoute,VehicleInventory,TransferBooking}.js`, `services/transferService.js`, `middleware/transportOwnership.js`, `controllers/{transportController,transferController,paymentController}.js`, `routes/{transportRoutes,transferRoutes,adminRoutes}.js`, `jobs/bookingCron.js`, `tests/transfer.test.js`, `scripts/seedMockData.js`; `Hotel-RAG-FE/src/pages/{Transfers,TransferCheckout,TransportApplication,TransportDashboard}.jsx`, `components/transport/TransportModals.jsx`, `components/admin/TransportCompaniesPanel.jsx`, `components/{TransferHistory,HotelTransfers}.jsx`; tài liệu `docs/erd.mmd`, `docs/erd.png`, `docs/data-dictionary.md` (mục 9–13), `docs/security-rbac.md`, `docs/progress-and-scope.md`, `README.md`.

**Kiểm chứng:**
- `npm test`: 66/66 pass (13 test mới: duyệt/đổi role, 403 chéo giữa 2 nhà xe, tìm xe, 2 khách tranh 1 xe → đúng 1 đơn, idempotency đồng thời, hủy/cron trả xe, 410 khi quá hạn, VNPay tạo Payment `transferBookingId`).
- `vite build` thành công, ESLint không có lỗi mới.
- Chạy giao diện trên bản sao dữ liệu local (không động vào Atlas): tìm xe → đặt → trang thanh toán → VNPay giả lập → lịch sử; trung tâm nhà xe (cập nhật lịch xe, tab đơn); Admin duyệt nhà xe; mục xe ở trang khách sạn; kiểm tra màn 375px không tràn ngang.
- Seed chạy 2 lần trên bản local: lần 2 không thay đổi gì (idempotent).

**Việc còn lại:**
- Chưa chạy `npm run seed:mock` trên Atlas (chờ nhóm đồng ý).
- Chưa có đánh giá/review cho nhà xe; chưa có hoàn tiền tự động khi khách hủy đơn đã thanh toán.
- Cập nhật báo cáo/slide nếu muốn trình bày phần mở rộng này.

**Tiến độ:** tính năng xe đưa đón hoàn thành ở mức prototype, chưa commit.

---

## [14/11/2026] Tỉnh/TP dùng danh mục cố định 63 tỉnh thành (không nhập tay)

**Người thực hiện:** Quanh (cùng Claude Code)

**Thay đổi:**
- Danh mục cố định 63 tỉnh/thành, sắp A→Z theo tiếng Việt: `Hotel-RAG-BE/constants/provinces.js` (+ bản giống hệt `Hotel-RAG-FE/src/constants/provinces.js`). Có hàm chuẩn hóa cách viết khác / địa danh ("TP HCM" → Hồ Chí Minh, "Huế" → Thừa Thiên Huế, "Đà Lạt" → Lâm Đồng…).
- Model: `hotels.address.province` bắt buộc và phải thuộc danh mục; `users.address.province` nếu có cũng phải thuộc danh mục; nhà xe `serviceCities` → `serviceProvinces`, tuyến xe `city` → `province` (chỉ mở tuyến trong tỉnh nhà xe đã đăng ký).
- API: `GET /api/hotels/provinces` (63 tỉnh + số KS), `GET /api/hotels/search?province=` (lọc chính xác; `?city=` cũ vẫn chạy), `GET /api/transfers/provinces` thay `/transfers/cities`, `/transfers/search?province=`. Tỉnh ngoài danh mục → 400.
- Giao diện: ô chọn Tỉnh/TP thay cho ô nhập tay ở tìm kiếm trang chủ, bộ lọc trang Khách sạn (đổi tỉnh là lọc ngay, hiện số KS mỗi tỉnh), form tạo / sửa khách sạn của Partner, đăng ký nhà xe (chọn nhiều tỉnh), thêm tuyến xe, tìm xe đưa đón (hiện số tuyến mỗi tỉnh). Ô "Quận/Huyện/Thành phố thuộc tỉnh" vẫn nhập tự do.
- `seedMockData.js` thêm bước "Tỉnh/thành (63 tỉnh)": chuẩn hóa tỉnh của khách sạn / người dùng (suy ra từ city nếu thiếu), đổi dữ liệu xe cũ sang `province` / `serviceProvinces`; dữ liệu xe mẫu tạo theo tỉnh.

**File chính:** `Hotel-RAG-BE/constants/provinces.js`, `models/{Hotel,User,TransportCompany,TransferRoute}.js`, `controllers/{hotelController,partnerController,userController,transportController,transferController}.js`, `routes/{hotelRoutes,transferRoutes}.js`, `scripts/seedMockData.js`, `tests/provinces.test.js`; `Hotel-RAG-FE/src/constants/provinces.js`, `components/{ProvinceSelect,ProvinceMultiSelect}.jsx`, `hooks/useProvinceCounts.js`, `pages/{Home,Hotels,PartnerDashboard,Transfers,TransportApplication}.jsx`, `components/partner/HotelEditModal.jsx`, `components/transport/TransportModals.jsx`; tài liệu `docs/data-dictionary.md` (phụ lục danh mục), `docs/erd.mmd` / `erd.png`, `docs/security-rbac.md`, `README.md`.

**Kiểm chứng:**
- `npm test`: 75/75 pass (9 test mới: đủ 63 tỉnh / không trùng / đúng thứ tự, FE–BE cùng danh sách, chuẩn hóa, model chặn tỉnh sai, lọc `?province=`, Partner tạo/sửa KS, `/users/me`, nhà xe đăng ký tỉnh và mở tuyến ngoài tỉnh đã đăng ký).
- `vite build` thành công, ESLint không lỗi mới.
- Chạy giao diện trên bản sao dữ liệu local: bộ lọc KS chọn "Lâm Đồng" → 2 khách sạn Đà Lạt; form sửa KS hiện ô chọn; tìm xe theo tỉnh có số tuyến; đăng ký nhà xe chọn nhiều tỉnh; màn 375px không tràn ngang.
- Seed chạy 2 lần trên bản local: lần 2 không thay đổi gì. Dữ liệu tỉnh của 20 khách sạn hiện có đã đúng tên chuẩn.

**Việc còn lại:**
- Chạy `npm run seed:mock` trên Atlas (chờ nhóm đồng ý) để chuẩn hóa tỉnh của tài khoản mock và tạo dữ liệu xe.
- Trợ lý RAG vẫn nhận địa danh cấp thành phố ("Đà Lạt", "Hội An"); chưa hiểu câu hỏi chỉ nêu tên tỉnh ("ở Lâm Đồng").
- Danh mục theo 63 tỉnh trước sáp nhập 2025 theo yêu cầu; nếu cần đổi sang 34 tỉnh mới chỉ phải sửa 2 file danh mục + bảng quy đổi.

**Tiến độ:** hoàn thành, chưa commit.

---

## [14/11/2026] Dữ liệu mẫu xe đưa đón trên MongoDB Atlas (phục vụ demo)

**Người thực hiện:** Quanh (cùng Claude Code)

**Thay đổi:** chạy `npm run seed:mock` trên DB `Hotel-RAG` (Atlas). Kết quả: 3 nhà xe đã duyệt (`mock.transport1..3@nestly.test`, mật khẩu `Nestly@2026`), 9 loại xe, 48 tuyến (6 tuyến/tỉnh ở Đà Nẵng, Hà Nội, Hồ Chí Minh, Khánh Hòa, Kiên Giang, Lâm Đồng, Quảng Nam, Thừa Thiên Huế), lịch xe 60 ngày, 12 đơn xe đã thanh toán (6 đã đi, 6 sắp đi). Seed cũng chuẩn hóa tỉnh của 12 tài khoản, xóa index `city` cũ của tuyến xe, mở thêm ngày phòng và vài đơn / đánh giá mẫu.

**Kiểm chứng:** đếm lại trực tiếp trong DB khớp số trên; không còn trường `city` cũ ở tuyến xe.

**Tiến độ:** hoàn thành.

---

## [14/11/2026] Rà soát và cải thiện giao diện (UI/UX, khả năng truy cập)

**Người thực hiện:** Quanh (cùng Claude Code)

**Thay đổi:**
- Font chữ: class `font-display` đã dùng ở nhiều tiêu đề nhưng chưa được khai báo nên mọi chữ đang là font hệ thống. Thêm Be Vietnam Pro (chữ thường) + Playfair Display (tiêu đề), cả hai hỗ trợ đầy đủ dấu tiếng Việt (`index.html`, `tailwind.config.js`).
- `index.html`: `lang="vi"`, tiêu đề "Nestly", meta description, theme-color. Mỗi trang có tiêu đề tab riêng ("Xe đưa đón sân bay | Nestly"...).
- Bàn phím / trình đọc màn hình: viền focus rõ khi bấm Tab (trước đó nhiều ô có `outline-none` nên không thấy đang ở đâu), link "Bỏ qua tới nội dung chính", nút menu tài khoản có nhãn + trạng thái mở/đóng, các nút đóng ✕ thành icon SVG có nhãn "Đóng". Tôn trọng cài đặt "giảm chuyển động" của hệ điều hành.
- Header: thêm mục "Khách sạn" cạnh "Xe đưa đón", tô sáng trang đang xem; menu tài khoản đóng khi bấm ra ngoài hoặc nhấn Esc, không tràn màn hình nhỏ.
- Trang chủ: thẻ khách sạn là link thật (mở bằng bàn phím, mở tab mới được), bỏ nhãn "Trạng thái" trống, hiện số đánh giá; huy hiệu "Hơn 12.000 chỗ nghỉ" đổi thành số khách sạn thật. Sửa ô ngày tràn ngang trên điện thoại.
- Footer: thêm liên kết Khách sạn / Xe đưa đón / Trở thành đối tác / Đăng ký nhà xe.
- Hiệu năng: các trang (trừ trang chủ) tải khi cần (`React.lazy`), file JS ban đầu còn ~346 kB (hết cảnh báo chunk lớn của Vite); ảnh danh sách khách sạn tải lười.

**File chính:** `Hotel-RAG-FE/index.html`, `tailwind.config.js`, `src/index.css`, `src/App.jsx`, `src/components/{Header,Footer,Icon,Modal,ScrollToTop,AIChatWidget,ProvinceMultiSelect}.jsx`, `src/pages/{Home,Hotels,PartnerDashboard}.jsx`.

**Kiểm chứng:** `vite build` thành công, ESLint 0 lỗi (2 cảnh báo cũ). Xem trên trình duyệt ở 1280px và 375px: font đã tải, menu và Esc hoạt động, viền focus hiện khi Tab; 9 trang công khai (trang chủ, khách sạn, chi tiết, xe đưa đón, đăng nhập, đăng ký, 2 trang đăng ký đối tác) không tràn ngang ở 375px.

**Việc còn lại:** chưa xem lại các trang cần đăng nhập (Partner, Admin, Nhà xe, Hồ sơ) sau khi đổi font. Server Vite đang chạy cần khởi động lại để nhận cấu hình Tailwind mới.

**Tiến độ:** hoàn thành, chưa commit.

---

## [14/11/2026] Chuẩn bị deploy lên Render

**Người thực hiện:** Quanh (cùng Claude Code)

**Thay đổi:**
- `package.json` gốc (backend) khai báo đủ thư viện đang dùng: thêm `bcryptjs`, `jsonwebtoken`, `qs` (trước đó chỉ chạy được nhờ `Hotel-RAG-BE/node_modules` bị commit vào repo); thêm `engines.node >= 20.19`. Cập nhật `package-lock.json`.
- `createApp.js`: biến `CORS_ORIGIN` (tùy chọn) để chỉ cho domain frontend gọi API; không đặt thì giữ như cũ (mọi nguồn).
- `paymentController.js`: lấy IP đầu tiên trong `x-forwarded-for` khi gửi VNPay (sau proxy của Render header có nhiều IP).
- Thêm `render.yaml` (Blueprint: `nestly-api` Web Service + `nestly-web` Static Site có rule rewrite cho React Router), `.env.example`, `Hotel-RAG-FE/.env.example`, hướng dẫn `docs/deploy-render.md`; README trỏ tới hướng dẫn.

**Kiểm chứng:** `npm test` 75/75 pass. Bản sao sạch chỉ gồm code đã commit + `package.json`/lock mới (không có `node_modules` sẵn): `npm ci` rồi `node server.js` khởi động, `/api/health` và `/api/hotels/provinces` trả 200.

**Việc còn lại:** chưa deploy thật (cần tài khoản Render của nhóm); mở `0.0.0.0/0` trong Atlas Network Access; trên Render dùng `LLM_PROVIDER=gemini`.

**Tiến độ:** hoàn thành phần chuẩn bị, chưa commit.

---

## [14/11/2026] Kiểm thử vòng đời Vector AI khi Partner tạo khách sạn / phòng

**Người thực hiện:** Quanh (cùng Claude Code)

**Thay đổi:** thêm `Hotel-RAG-BE/tests/embedding.test.js` (6 test, thay Gemini bằng hàm giả nên không gọi mạng). Không sửa code ứng dụng: luồng hiện tại đã đúng.

**Kết quả kiểm tra luồng:**
- Partner tạo khách sạn → `embedding` rỗng, trạng thái Pending (chưa gọi AI).
- Admin duyệt → sinh vector 3072 chiều (`gemini-embedding-001`), không trả mảng vector về client.
- Partner thêm hạng phòng → **không** sinh vector mới (vector thuộc khách sạn); phòng mới vẫn được AI tìm thấy ngay nhờ điểm từ khóa + vector của khách sạn.
- Partner sửa tên / mô tả / địa chỉ / tiện nghi của KS đã duyệt → tạo lại vector chạy nền; chỉ đổi ảnh → không tạo lại.
- Gemini lỗi khi duyệt → vẫn duyệt, Admin được báo "chưa tạo được Vector AI" (bổ sung sau bằng `npm run seed:mock -- --embeddings`).
- Atlas hiện tại: 20/20 khách sạn đã duyệt đều có vector 3072 chiều.

**Kiểm chứng:** `npm test` 81/81 pass.

**Tiến độ:** hoàn thành, chưa commit.

---

## [14/11/2026] Deploy Render dùng Ollama chạy trên Google Colab

**Người thực hiện:** Quanh (cùng Claude Code)

**Thay đổi:** `render.yaml` đặt `LLM_PROVIDER=ollama` và thêm biến `OLLAMA_URL`, `OLLAMA_API_KEY` (nhập tay), `OLLAMA_MODEL=dolphin3`, `OLLAMA_TIMEOUT_MS=120000` cho `nestly-api`. `docs/deploy-render.md`: sơ đồ Render → tunnel Cloudflare → Ollama trên Colab, cách cập nhật URL/khóa mỗi phiên Colab, bảng lỗi liên quan. Không sửa code: backend gọi Ollama qua URL nên chạy trên Render hay trên máy đều giống nhau; khi Colab tắt, trợ lý trả câu dựng sẵn thay vì báo lỗi.

**Tiến độ:** hoàn thành, chưa commit.

---

## [14/11/2026] Sửa bộ lọc tiện nghi trang Khách sạn bị che, không xem hết danh sách

**Người thực hiện:** Quanh (cùng Claude Code)

**Lỗi:** trên máy tính, khung "Tiện nghi" dính cố định khi cuộn (sticky) nhưng cao hơn màn hình (20 tiện nghi ≈ 774px, màn 720px chỉ còn ≈ 608px) nên phần cuối danh sách bị che, cuộn trang cũng không thấy.

**Sửa (`Hotel-RAG-FE/src/pages/Hotels.jsx`):**
- Mặc định hiện 8 tiện nghi phổ biến nhất + nút "Xem thêm N tiện nghi" / "Thu gọn" (có `aria-expanded`); tiện nghi đang chọn luôn hiện dù nằm ngoài nhóm này.
- Khung lọc giới hạn chiều cao theo màn hình (`max-h: 100dvh - 8rem`) và tự cuộn bên trong khi mở hết danh sách.
- Tên tiện nghi dài xuống dòng thay vì bị cắt "…"; số lượng dùng chữ số đều.

**Kiểm chứng:** xem trên trình duyệt với dữ liệu Atlas: 1280×720 thu gọn 8 (+1 mục đang chọn), mở rộng 20 mục và cuộn tới được mục cuối; 375px hiện đủ 20 mục, không tràn ngang. ESLint 0 lỗi, `vite build` thành công.

**Tiến độ:** hoàn thành, chưa commit.

---

## [14/11/2026] Sửa header trang Xe đưa đón bị lệch so với các trang khác

**Người thực hiện:** Quanh (cùng Claude Code)

**Lỗi:** trang `/transfers` khi chưa tìm xe ngắn hơn màn hình nên không có thanh cuộn dọc; các trang khác có thanh cuộn (~15px). Vì vậy riêng trang này rộng hơn 15px và cụm nút bên phải header (Khách sạn / Xe đưa đón / menu tài khoản) lệch sang phải. Đo ở 1280px: nút cuối kết thúc ở 1248px thay vì 1233px như mọi trang.

**Sửa:** `Hotel-RAG-FE/src/index.css` thêm `scrollbar-gutter: stable` cho `html`: luôn chừa chỗ cho thanh cuộn, trang ngắn hay dài đều cùng bề rộng.

**Kiểm chứng:** đo lại `/`, `/hotels`, `/transfers`, `/login` ở 1280px: logo cùng x=32, nút cuối cùng 1233px; ảnh chụp header `/transfers` và `/hotels` trùng vị trí. `vite build` thành công.

**Tiến độ:** hoàn thành, chưa commit.

---

## [14/11/2026] Bỏ nút đăng nhập / đăng ký bằng Google, Facebook

**Người thực hiện:** Quanh (cùng Claude Code)

**Thay đổi:** `Hotel-RAG-FE/src/pages/AuthPage.jsx` gỡ 2 nút "Google", "Facebook" và dòng "hoặc tiếp tục với email" ở trang Đăng nhập và Đăng ký. Hai nút này chỉ là giao diện, không gắn chức năng (backend không có đăng nhập mạng xã hội). Hệ thống chỉ đăng nhập / đăng ký bằng email + mật khẩu.

**Kiểm chứng:** xem `/login`, `/register` ở 1280px: không còn chữ Google/Facebook, form email ngay dưới tiêu đề, không tràn ngang. ESLint và `vite build` qua.

**Tiến độ:** hoàn thành, chưa commit.

---

## [14/11/2026] Đăng ký bằng tên đăng nhập, xác nhận email và quên mật khẩu qua email

**Người thực hiện:** Quanh (cùng Claude Code)

**Thay đổi:**
- **Đăng ký:** tên đăng nhập + email + mật khẩu (≥ 8 ký tự). Tên đăng nhập 3–30 ký tự `a-z 0-9 . _`, không trùng. Đăng ký xong gửi email "Xác nhận email" (link hạn 24 giờ); chưa bấm link thì đăng nhập bị chặn (403) và có ô "Gửi lại email xác nhận".
- **Đăng nhập:** tên đăng nhập + mật khẩu. Tài khoản cũ chưa có tên đăng nhập vẫn gõ email vào cùng ô được.
- **Quên mật khẩu:** trang `/forgot-password` nhập email → email chứa link `/reset-password?token=…` (hạn 30 phút, dùng 1 lần) → đặt mật khẩu mới. Câu trả lời luôn giống nhau dù email có tồn tại hay không (không lộ email đã đăng ký); mỗi loại email gửi tối đa 1 lần / 60 giây.
- Backend: `services/mailService.js` (Brevo HTTP API hoặc `console` in link ra log), `controllers/authController.js` viết lại, 4 API mới `/auth/verify-email`, `/auth/resend-verification`, `/auth/forgot-password`, `/auth/reset-password`. `models/User.js` thêm `username`, `emailVerified`, token (chỉ lưu SHA-256, ẩn khỏi API).
- Vì Render bản miễn phí chặn cổng SMTP 25/465/587 nên không gửi qua Gmail SMTP; dùng Brevo (miễn phí, cho phép người gửi là Gmail đã xác minh). Chưa cấu hình Brevo thì việc xác nhận email tự tắt để không khóa người dùng mới (`EMAIL_VERIFICATION` để bật/tắt thủ công).
- Frontend: `AuthPage.jsx` (form mới, màn "Kiểm tra hộp thư"), trang mới `VerifyEmail.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx`, component `AuthCard.jsx`, `ResendVerification.jsx`; trang Tài khoản hiện tên đăng nhập.
- `seedMockData.js` thêm bước "Tên đăng nhập": tạo tên từ phần trước `@` của email cho tài khoản cũ (vd. `mock.transport1`).
- Tài liệu: `.env.example`, `render.yaml` (biến `MAIL_PROVIDER`, `BREVO_API_KEY`, `MAIL_FROM`, `APP_URL`), `docs/deploy-render.md` (mục 3b Brevo), `docs/data-dictionary.md`, `docs/security-rbac.md`, `README.md`.

**Kiểm chứng:**
- `npm test` 91/91 pass, trong đó `tests/auth.test.js` 10 test: kiểm tra đầu vào, chưa xác nhận không đăng nhập được, trùng tên / email, link xác nhận dùng 1 lần, tài khoản cũ đăng nhập bằng email, gửi lại có giới hạn, quên → đặt lại mật khẩu, link hết hạn, tắt xác nhận, vừa đăng ký vẫn quên mật khẩu được ngay.
- Chạy giao diện trên DB local (mail in ra log): đăng ký → màn kiểm tra hộp thư → đăng nhập bị chặn kèm ô gửi lại → mở link xác nhận → đăng nhập → quên mật khẩu → mở link → đặt mật khẩu mới → mật khẩu cũ bị từ chối, mật khẩu mới vào được. 5 trang không tràn ngang ở 375px.
- Seed chạy 2 lần trên DB local: lần 1 tạo tên đăng nhập cho 15 tài khoản, lần 2 không đổi gì.
- Lỗi phát hiện khi chạy thử và đã sửa: ô "Gửi lại" nằm trong form đăng nhập (form lồng nhau); email xác nhận và email quên mật khẩu dùng chung bộ đếm 60 giây nên vừa đăng ký xong bấm quên mật khẩu không nhận được mail.

**Việc còn lại:**
- Chưa gửi email thật: cần tạo tài khoản Brevo, xác minh Gmail người gửi, đặt biến trên Render.
- Chưa chạy `npm run seed:mock` trên Atlas để tạo tên đăng nhập cho tài khoản hiện có (trước đó vẫn đăng nhập bằng email được).

**Tiến độ:** hoàn thành, chưa commit.

---

## [14/11/2026] Báo cáo tiến độ mới (file Word)

**Người thực hiện:** Quanh (cùng Claude Code)

**Thay đổi:** tạo `D:/School/baocao/BAO CAO TIEN DO - Nhom 13 (14-11-2026).docx` từ mẫu "Kế hoạch làm việc nhóm – Tự đánh giá" bản 25/10 (giữ nguyên các dòng cũ):
- Thêm dòng "cập nhật đến ngày 14/11/2026" và mục **Tổng quan tiến độ** (giai đoạn 1, giai đoạn 2, kết quả đo được, việc còn lại).
- Bảng kế hoạch thêm 15 dòng tuần 8–11: xử lý góp ý giữa kỳ, hoàn thiện chức năng, chuẩn hóa dữ liệu Atlas, LLM local, cải tiến Partner, tài liệu minh chứng, báo cáo theo mẫu khoa, slide, xe đưa đón, 63 tỉnh thành, xác nhận email, cải thiện giao diện, chuẩn bị deploy (80%), kiểm thử 91/91, việc tiếp theo.
- Bảng ghi nhận sử dụng AI thêm 10 dòng với câu lệnh đã dùng; cột "Mức độ sử dụng" và "Hiểu biết" để trống (tô vàng) cho nhóm tự điền trung thực; 3 dòng của phần làm ngày 14/11 chờ bổ sung câu lệnh.
- Bảng tự đánh giá đóng góp giữ nguyên.

**Kiểm chứng:** xuất PDF bằng Word, soát 17 trang.

**Việc còn lại:** nhóm điền các ô tô vàng, chỉnh người thực hiện nếu cần (mặc định ghi Đỗ Trần Quang Anh theo changelog).

**Tiến độ:** hoàn thành.

---

## [14/11/2026] Làm sạch dữ liệu mẫu khách sạn: bỏ chữ test, bổ sung ảnh phòng, ảnh bìa không trùng

**Người thực hiện:** Quanh (cùng Claude Code)

**Hiện trạng trước khi sửa (Atlas):** 20 khách sạn đều có 5 ảnh, 46 link ảnh đều tải được; nhưng 10 khách sạn có tiền tố `[TEST]`, 1 khách sạn có hậu tố `(Test)`, 3 tên + 28 mô tả hạng phòng còn chữ test; cả 42 hạng phòng chỉ có 2 ảnh; nhiều khách sạn dùng chung ảnh bìa; 1 ảnh trong kho ảnh phòng thực ra là ảnh căn nhà có hồ bơi; vài bộ ảnh chứa cùng một ảnh 2 lần (khác tham số `?w=`).

**Thay đổi (`Hotel-RAG-BE/scripts/seedMockData.js`, bước "Hotels & RoomTypes"):**
- Bỏ `[TEST]` / `(Test)` khỏi tên khách sạn, tên và mô tả hạng phòng; khách sạn đổi tên được tạo lại Vector AI (tên nằm trong nội dung vector).
- Kho ảnh phòng tăng từ 10 lên 32 ảnh (đã kiểm tra tải được và xem từng ảnh là phòng ngủ / phòng tắm); mỗi hạng phòng tối thiểu 4 ảnh; gỡ ảnh căn nhà khỏi hạng phòng.
- Mỗi khách sạn một ảnh bìa riêng; so sánh ảnh theo mã ảnh Unsplash nên không còn ảnh trùng trong cùng bộ.

**Đã chạy trên Atlas** (`npm run seed:mock`): 11 khách sạn đổi tên + 11 vector tạo lại, 5 ảnh bìa đổi, 42 hạng phòng bổ sung ảnh, 28 mô tả + 3 tên phòng làm sạch; đồng thời tạo tên đăng nhập cho 29 tài khoản cũ (vd. `mock.customer1`, `mock.transport1`).

**Kiểm chứng:** chạy thử trước trên bản sao local (chép hotels / roomtypes / users từ Atlas), lần 2 không đổi gì. Sau khi chạy trên Atlas: không còn chữ test, 20/20 ảnh bìa khác nhau, 42/42 hạng phòng có 4 ảnh, không ảnh trùng trong bộ, 67 ảnh khác nhau đều tải được (HTTP 200), 20/20 khách sạn có vector 3072 chiều, 0 tài khoản thiếu tên đăng nhập.

**Tiến độ:** hoàn thành (dữ liệu Atlas đã cập nhật), code seed chưa commit.

---

## [14/11/2026] Sửa: không quay lại được trang Đăng nhập sau khi đăng ký; tìm nguyên nhân email xác nhận không gửi được

**Người thực hiện:** Quanh (cùng Claude Code)

**1. Email xác nhận không gửi được — nguyên nhân là cấu hình Brevo, không phải code.** Gọi thử Brevo bằng chính API key đang dùng (yêu cầu không có người nhận nên không gửi mail nào): Brevo trả `403 api key is not authorized for resource "transactional.email"`. API key được tạo với quyền bị giới hạn, **thiếu quyền gửi email giao dịch**. Cách sửa: tạo API key mới trên Brevo với quyền *Transactional emails* (hoặc *Full access*), thay `BREVO_API_KEY` ở `.env` và trên Render.
- `services/mailService.js`: lỗi Brevo trong log kèm gợi ý cách sửa (thiếu quyền, chặn IP, sai key, người gửi chưa xác minh).
- `AuthPage.jsx`: đăng ký xong mà gửi mail lỗi thì hiện khung vàng "Đã tạo tài khoản nhưng chưa gửi được email xác nhận" thay vì khung xanh "Kiểm tra hộp thư".
- `docs/deploy-render.md`: hướng dẫn chọn quyền khi tạo API key, thêm 2 dòng xử lý lỗi.

**2. Đăng ký xong bấm "Đã xác nhận, tới trang Đăng nhập" không quay lại được.** `/login` và `/register` dùng chung component `AuthPage` nên React giữ trạng thái: đường dẫn đổi sang `/login` nhưng vẫn hiện màn "Kiểm tra hộp thư". Sửa `App.jsx`: gắn `key` riêng cho 2 route để mỗi lần chuyển trang tạo AuthPage mới.

**Kiểm chứng:** chạy giao diện với backend local dùng đúng key Brevo hiện tại: đăng ký → khung vàng + log ghi rõ lỗi 403 và cách sửa → bấm "tới trang Đăng nhập" → hiện form đăng nhập (tên đăng nhập + mật khẩu). `npm test` 91/91, `vite build` thành công.

**Việc còn lại:** nhóm tạo API key Brevo mới có quyền gửi email rồi cập nhật `BREVO_API_KEY` (máy + Render).

**Tiến độ:** hoàn thành phần code, chưa commit.

---

## [14/11/2026] Cho phép một email tạo nhiều tài khoản

**Người thực hiện:** Quanh (cùng Claude Code)

**Thay đổi:**
- `models/User.js`: `email` bỏ `unique`, chỉ còn index thường. Chỉ `username` (tên đăng nhập) phải duy nhất.
- `authController.js`:
  - Đăng ký không còn chặn email đã dùng.
  - Đăng nhập bằng email (tài khoản cũ) chọn tài khoản khớp mật khẩu trong các tài khoản dùng email đó.
  - Quên mật khẩu và gửi lại email xác nhận gửi cho từng tài khoản của email đó (tối đa 10), mỗi tài khoản 1 email riêng.
- `mailService.js`: tiêu đề email ghi tên đăng nhập, vd. "Đặt lại mật khẩu tài khoản Nestly (minh.an)", để biết thư dành cho tài khoản nào.
- `seedMockData.js` (bước "Index"): index `users.email_1` đổi từ unique sang thường (trước đây seed ép unique).
- Tài liệu: `docs/data-dictionary.md`, `README.md`.

**Kiểm chứng:** `npm test` 92/92. Test mới: 2 tài khoản cùng email đều đăng ký được, mỗi tài khoản nhận email xác nhận riêng, đăng nhập bằng email ra đúng tài khoản theo mật khẩu, quên mật khẩu gửi 2 email riêng, đặt lại mật khẩu tài khoản này không ảnh hưởng tài khoản kia. Seed chạy trên DB local có index unique: index được đổi thành thường.

**Đã áp dụng trên Atlas** (`npm run seed:mock`): `users.email_1` giờ là index thường, `username_1` vẫn unique.

**Tiến độ:** hoàn thành, chưa commit.

---

## [14/11/2026] Cập nhật file phân chia công việc

**Người thực hiện:** Quanh (cùng Claude Code)

**Thay đổi:** tạo `D:/School/baocao/Nhóm 13 - PhanChiaCongViec (cap nhat 14-11-2026).xlsx` từ file phân chia công việc bản 25/10 (file gốc đang mở trong Excel nên không ghi đè, file gốc giữ nguyên):
- Tiêu đề thêm "CẬP NHẬT: 14/11/2026".
- 4 dòng cũ "Chưa làm": Đánh giá, Đón khách, Duyệt khách sạn → 100%; Thống kê & Cronjob → 50% (cronjob xong, chưa có thống kê doanh thu toàn sàn ở trang Admin). Cột "Đánh giá nhóm trưởng" ghi ngày hoàn thành.
- Thêm 14 dòng theo 3 nhóm: Xử lý góp ý giữa kỳ & AI, Mở rộng & hoàn thiện, Kiểm thử – triển khai – tài liệu (deploy Render 80%).
- Cột G nới rộng để không tràn chữ; bảng đánh giá đóng góp giữ nguyên số liệu.

**Kiểm chứng:** xuất PDF bằng một phiên Excel riêng, soát 3 trang.

**Việc còn lại:** đóng file gốc rồi thay bằng bản mới nếu muốn giữ một tên; chỉnh cột "Người thực hiện" nếu thành viên khác có tham gia (mặc định ghi Đỗ Trần Quang Anh theo changelog).

**Tiến độ:** hoàn thành.

---

## [14/11/2026] Cập nhật báo cáo `maudoan_sua.docx` theo tiến độ 14/11

**Người thực hiện:** Quanh (cùng Claude Code)

**Thay đổi:** sửa trực tiếp trên bản nhóm đã chỉnh (giữ nguyên trích dẫn, đoạn điểm mạnh/điểm yếu, câu dẫn hình); bản trước khi sửa lưu tại `D:/School/baocao/maudoan_sua (ban 10-11).docx`. File mới 71 trang.
- Mở đầu, Chương 1: thêm tác nhân Nhà xe, xe đưa đón, đoạn giai đoạn hoàn thiện; mở rộng phạm vi.
- Chương 2: mục 2.9.5 "Xác nhận email và đặt lại mật khẩu".
- Chương 3: dòng Nhà xe trong bảng tác nhân; yêu cầu F20–F26; use case Khách hàng, Quản trị viên vẽ lại và thêm Hình 3.4 use case Nhà xe (Mermaid, cùng kiểu với hình của nhóm); ERD 13 collection; Bảng 3.11–3.15 cho 5 collection xe đưa đón; trường mới của users (username, emailVerified, token) và payments (transferBookingId); kiến trúc có Render và Brevo; đoạn đặt xe dùng lại cơ chế chống bán trùng; dòng quyền sở hữu nhà xe; ảnh đăng nhập mới; mục 3.2.5 với 6 ảnh giao diện (đăng ký, quên mật khẩu, tìm xe, thanh toán đơn xe, trung tâm nhà xe, duyệt nhà xe); kiểm thử 91/91 kèm 4 file test mới; số liệu Atlas ngày 14/11.
- Kết luận, hạn chế, hướng phát triển và Phụ lục A/B (API mới, deploy Render) cập nhật tương ứng.
- Hình từ 3.4 trở đi tăng 1, bảng từ 3.11 trở đi tăng 5 (kể cả các câu "xem Hình/Bảng"); mục lục, danh mục bảng, hình cập nhật bằng Word.
- `docs/mermaid-bao-cao.md`: mã Mermaid mới cho Hình 3.1, 3.3, thêm Hình 3.4 (Nhà xe), ERD đổi thành Hình 3.5.

**Kiểm chứng:** ảnh giao diện chụp trên bản sao dữ liệu local (chỉ đọc Atlas); xuất PDF bằng Word, soát toàn bộ 71 trang.

**Việc còn lại:** nhóm đọc lại các đoạn mới; slide thuyết trình chưa có phần xe đưa đón.

**Tiến độ:** hoàn thành.

---

## [15/11/2026] Sửa VNPay luôn báo "Giao dịch đã quá thời gian chờ thanh toán" trên Render

**Người thực hiện:** Quanh (cùng Claude Code)

**Nguyên nhân:** `formatVNPayDate` (`controllers/paymentController.js`) định dạng `vnp_CreateDate` / `vnp_ExpireDate` theo múi giờ của máy chủ (`getHours()`), trong khi VNPay hiểu đó là giờ Việt Nam (GMT+7). Trên máy cá nhân (giờ VN) thì đúng; máy chủ Render chạy UTC (chậm 7 tiếng) nên hạn thanh toán "+5 phút" bị VNPay đọc thành khoảng 7 tiếng trước -> báo quá thời gian chờ ngay khi mở trang. Kiểm tra lại cách cũ với TZ=UTC: hạn thanh toán bị hiểu là -415 phút.

**Sửa:**
- `formatVNPayDate` luôn quy đổi sang GMT+7 (dùng `getUTC*` + 7 giờ), không phụ thuộc múi giờ máy chủ.
- `server.js` đặt `process.env.TZ = 'Asia/Ho_Chi_Minh'` (nếu chưa đặt) để các phép tính "hôm nay" trên Render khớp với khi chạy trên máy; không cần thêm biến môi trường trên Render.
- `docs/deploy-render.md`: thêm dòng xử lý lỗi.

**Kiểm chứng:** test mới `tests/vnpay-time.test.js` chạy với TZ=UTC: định dạng giờ đúng (kể cả qua nửa đêm, qua năm mới); gọi API tạo link VNPay thì `vnp_CreateDate` = thời điểm hiện tại, `vnp_ExpireDate` = hết hạn giữ chỗ, đều theo giờ VN. `npm test` 94/94 pass.

**Tiến độ:** hoàn thành, chưa commit. Cần push để Render deploy lại backend.

---

## [15/11/2026] Rà soát và sửa trang Quản trị (Admin)

**Người thực hiện:** Quanh (cùng Claude Code)

**Lỗi / điểm yếu tìm được** (chạy trang Admin trên bản sao dữ liệu Atlas ở DB local):
- Thẻ "Đơn partner chờ duyệt" và số trên tab "Duyệt partner" luôn hiện **0** khi mới mở trang dù có 2 đơn đang chờ: đơn partner chỉ được tải khi bấm vào tab.
- Tab "Duyệt nhà xe" không có số hồ sơ chờ duyệt.
- Danh sách người dùng không có tên đăng nhập (API `/admin/users` và `/users/me` không trả `username`), không tìm được theo tên đăng nhập; quan trọng khi một email có nhiều tài khoản.
- Dòng "Hệ thống hoạt động tốt" là chữ cố định, không phản ánh trạng thái thật.
- Thông báo không tự ẩn, trình đọc màn hình không đọc được; tab không có `role="tab"` / `aria-selected`; F5 luôn quay về tab đầu.
- Ảnh thu nhỏ 96px trong danh sách khách sạn tải bản 1200px.
- Nhãn "Đang hoạt động" / "Khách hàng" bị xuống dòng trong bảng; chữ viết tắt ở avatar partner là chữ thường.

**Sửa:**
- `AdminDashboard.jsx`: tải đơn partner và số nhà xe chờ duyệt ngay khi mở trang; tab ghi trên URL (`/admin?tab=users`…) và có ARIA; số chờ duyệt trên tab nhà xe (cập nhật khi duyệt trong `TransportCompaniesPanel`); trạng thái API thật (gọi `/api/health`); thông báo `aria-live`, tự ẩn sau 5 giây, nút đóng có nhãn; cột người dùng hiện `@tên-đăng-nhập`, tìm được theo tên đăng nhập; nhãn không xuống dòng; ảnh thu nhỏ dùng bản 240–320px + tải lười.
- Backend: `adminController.getUsers` / cập nhật trạng thái và `userController` (`/users/me`) trả thêm `username`.

**Kiểm chứng:** mở `/admin` trên bản sao local: thẻ và tab partner hiện 2 ngay từ đầu; duyệt 1 đơn → thông báo "Đã duyệt đối tác", số giảm còn 1, thông báo tự ẩn sau 5 giây; F5 ở `?tab=users` vẫn đúng tab; tìm "mock.transport" ra 3 tài khoản nhà xe; ảnh thu nhỏ `w=240`; 4 tab không tràn ngang ở 375px. `npm test` 94/94, ESLint 0 lỗi, `vite build` thành công.

**Việc còn lại:** một tài khoản partner trên Atlas có họ tên "[TEST DATA] Search benchmark partner" (hiện trong danh sách khách sạn của Admin); chưa đổi vì là dữ liệu tài khoản.

**Tiến độ:** hoàn thành, chưa commit.

---

## [18/11/2026] Cập nhật báo cáo, phân chia công việc, báo cáo tiến độ theo tiến độ 15/11

**Người thực hiện:** Quanh (cùng Claude Code)

**Thay đổi** (thư mục `D:/School/baocao/DACN/`):
- `maudoan_sua.docx` (sửa trực tiếp, bản trước lưu `maudoan_sua (ban 14-11).docx`): đã deploy lên Render; đoạn quy đổi giờ VNPay sang GMT+7 (lỗi phát hiện trên Render); tìm người dùng theo tên đăng nhập; kiểm thử 94/94 (thêm `vnpay-time.test.js`, test một email nhiều tài khoản); số liệu Atlas đếm ngày 18/11 (36 tài khoản, 119 đơn phòng, 127 giao dịch, 15 đơn xe) và ghi chú dữ liệu mẫu đã làm sạch; hạn chế / hướng phát triển: API key Brevo chưa có quyền gửi email giao dịch, Render gói miễn phí; phụ lục B thêm múi giờ máy chủ. Mục lục cập nhật bằng Word, 71 trang.
- `Nhóm 13 - PhanChiaCongViec (cap nhat 18-11-2026).xlsx` (từ bản 14/11): deploy Render 100%, tài khoản (một email nhiều tài khoản, Brevo), kiểm thử 94/94, làm sạch dữ liệu, thêm dòng "Rà soát trang Quản trị".
- `BAO CAO TIEN DO - Nhom 13 (18-11-2026).docx`: cập nhật đến 18/11; tổng quan; thêm dòng deploy (100%), tài khoản và dữ liệu mẫu, rà soát trang Quản trị, cập nhật tài liệu; việc tiếp theo tuần 11; bảng ghi nhận AI thêm 2 dòng (ô mức độ / hiểu biết để nhóm tự điền).

**Kiểm chứng:** số liệu đếm trực tiếp trên Atlas (chỉ đọc); xuất PDF cả 3 file và soát các trang thay đổi.

**Việc còn lại:** nhóm điền các ô tô vàng trong báo cáo tiến độ; tạo API key Brevo mới; slide chưa có phần xe đưa đón.

**Tiến độ:** hoàn thành.

---

## [23/11/2026] Embedding bằng Ollama (bỏ Gemini), yêu thích, mã giảm giá, MoMo, thông báo, thống kê và xuất báo cáo

**Người thực hiện:** Quanh (cùng Claude Code)

**1. Embedding bằng `bge-m3` qua Ollama, bỏ hẳn Gemini**
- `services/llmService.js`: chỉ còn Ollama; thêm `embedText()` gọi `/api/embed` (mặc định `OLLAMA_EMBED_MODEL=bge-m3`, 1024 chiều). `aiService.js` (vector khách sạn), `aiController.js` (vector câu hỏi), `ragBenchmark.js` (cache theo tên model), seed (`EMBED_DIMS`), chấm Groundedness (`LLM_JUDGE_MODEL`) đều dùng Ollama. Gỡ thư viện `@google/generative-ai`.
- Colab: notebook tải thêm `bge-m3`, proxy cho phép `/api/embed` (`colab/auth_proxy.py`, `colab/ollama_dolphin_colab.ipynb`).
- `render.yaml`, `.env.example`: bỏ `GEMINI_API_KEY`, thêm `OLLAMA_EMBED_MODEL`.

**2. Danh sách yêu thích:** `users.wishlist`; API `/api/users/me/wishlist`; nút trái tim trên thẻ khách sạn (trang chủ, trang Khách sạn), nút "Lưu yêu thích" ở trang chi tiết, tab "Yêu thích" trong trang Tài khoản (`?tab=wishlist`). Trạng thái dùng chung mọi trang (`hooks/useWishlist.js`).

**3. Mã giảm giá:** collection `coupons` (theo % hoặc số tiền, giảm tối đa, đơn tối thiểu, hạn dùng, tổng lượt, lượt / khách, phạm vi phòng / xe / cả hai). Admin tạo mã toàn sàn (tab "Mã giảm giá"), Partner tạo mã cho khách sạn của mình (trong Trung tâm đối tác). Khách áp mã ở trang thanh toán (có gợi ý mã đang dùng được); áp mã giữ 1 lượt, đơn hủy / hết hạn / bỏ mã thì trả lượt. Đơn lưu `subtotalAmount` + `coupon`.

**4. Thanh toán MoMo (sandbox):** `/api/payments/momo/create_url`, `/momo/return`, `/momo/ipn`; chữ ký HMAC-SHA256; mặc định bộ khóa test công khai của MoMo. Trang thanh toán đơn phòng và đơn xe có thêm nút "Thanh toán qua MoMo"; trang kết quả `/payment/momo-return`. Đã gọi thử MoMo sandbox thật: tạo link thành công và mở được cổng thanh toán.
- **Sửa lỗ hổng:** trước đây kết quả VNPay không kiểm tra số tiền; nay VNPay và MoMo đều chỉ xác nhận khi số tiền trả khớp tổng tiền hiện tại của đơn (khách không thể tạo link lúc có mã rồi bỏ mã mà vẫn trả giá thấp). `payments.transactionId` lưu mã giao dịch của cổng.

**5. Thông báo trong trang:** collection `notifications` (tự xóa sau 90 ngày); chuông trên header (cập nhật mỗi 60 giây và khi quay lại tab, số chưa đọc, đánh dấu đã đọc). Sự kiện: đơn mới đã thanh toán (chủ KS / nhà xe + khách), khách hủy đơn, đơn tự hủy do quá hạn, Admin duyệt / từ chối khách sạn, đơn đối tác, hồ sơ nhà xe, hồ sơ mới chờ duyệt (gửi Admin).

**6. Thống kê và xuất báo cáo:** `services/statsService.js` tính theo tháng (giờ VN): doanh thu (giao dịch thành công), số đơn, tỷ lệ lấp phòng = đêm-phòng đã bán / đêm-phòng có thể bán. Partner: biểu đồ + bảng lấp phòng theo khách sạn trong Trung tâm đối tác; Admin: tab "Thống kê & báo cáo" (doanh thu phòng + xe). Biểu đồ cột SVG tự vẽ (`components/charts/BarChart.jsx`): một trục, tooltip, "Xem dạng bảng", màu đã kiểm tra bằng công cụ kiểm tra bảng màu (độ tương phản, mù màu). Xuất Excel (`exceljs`, 3 sheet: doanh thu theo tháng, đơn phòng, đơn xe) và CSV (UTF-8 có BOM, chặn CSV injection) theo khoảng ngày. CORS cho phép đọc `Content-Disposition`.

**Sửa thêm khi kiểm tra:** trang thanh toán cũ không hiện lỗi khi tạo link VNPay thất bại; tab "Lịch sử đặt chỗ" mở bằng `?tab=booking` không tải đơn; thanh tìm kiếm trang Khách sạn tràn ngang ở màn hẹp; tooltip biểu đồ xuống dòng.

**Kiểm chứng:**
- `npm test` 113/113 (thêm `wishlist`, `coupon`, `momo-notification`, `report`; mở rộng `llm-ollama` kiểm tra `/api/embed` + `bge-m3`; test VNPay xe gửi đúng số tiền).
- Chạy giao diện trên bản sao dữ liệu Atlas ở DB local: lưu yêu thích → tab Yêu thích; áp mã `HE2026` (3.300.000₫ → 3.000.000₫); bấm MoMo mở cổng MoMo sandbox; kết quả MoMo (chữ ký hợp lệ) → "Thanh toán MoMo thành công", chuông khách có thông báo; Partner thấy thông báo đơn mới, biểu đồ, bảng lấp phòng; Admin xuất Excel / CSV khác domain đọc được tên file; tab Mã giảm giá hiện lượt đã dùng. Các trang mới không tràn ngang ở 375px. ESLint 0 lỗi, `vite build` thành công.

**Việc còn lại:**
- Tạo lại vector `bge-m3` cho 20 khách sạn trên Atlas: bật notebook Colab mới (đã tải `bge-m3`), cập nhật `OLLAMA_URL` / `OLLAMA_API_KEY` trong `.env`, chạy `npm run seed:mock -- --embeddings`. Trước khi chạy, vector cũ (Gemini 3072 chiều) không so được với vector câu hỏi mới nên chatbot chỉ xếp hạng theo từ khóa.
- `docs/erd.mmd` / `docs/mermaid-bao-cao.md` chưa thêm `coupons`, `notifications` và số chiều vector mới (2 file đang có thay đổi chưa commit từ phiên khác).

**Tiến độ:** hoàn thành, chưa commit.

---

## [23/11/2026] Tạo lại vector bge-m3 cho khách sạn trên Atlas

**Người thực hiện:** Quanh (cùng Claude Code)

**Thay đổi:** bật notebook Colab mới (có `bge-m3`, proxy cho `/api/embed`), chạy `node Hotel-RAG-BE/scripts/seedMockData.js --embeddings` trên Atlas: tạo lại vector cho 20/20 khách sạn đã duyệt (thay vector Gemini 3072 chiều bằng `bge-m3` 1024 chiều). Seed cũng mở bán thêm 369 ngày phòng và 81 ngày xe.

**Kiểm chứng:** Atlas: 20 khách sạn đều có vector 1024 chiều. Thử truy hồi (chỉ đọc) với vector câu hỏi tạo bằng `bge-m3`: "khách sạn yên tĩnh có vườn ở Đà Nẵng" → Da Nang Quiet Garden Boutique (cosine 0,716); "resort nghỉ dưỡng bên hồ thông ở Đà Lạt" → Dalat Pine Lake Retreat / Dalat Edensee Lake Resort; "khách sạn trung tâm Hà Nội cho công tác có phòng gym" → Hanoi Business and Gym Hotel (cosine 0,700) và Mường Thanh Luxury Hà Nội.

**Tiến độ:** hoàn thành.

---

## [24/11/2026] Chatbot hiểu câu hỏi về xe đưa đón và câu hỏi theo tỉnh

**Người thực hiện:** Quanh (cùng Claude Code)

- `services/queryConstraintParser.js`: nhận **tỉnh** (63 tỉnh, địa danh như Vũng Tàu / Sa Pa / Hạ Long, tên sân bay như Nội Bài / Tân Sơn Nhất / Liên Khương; thành phố suy ra tỉnh, vd. Đà Lạt → Lâm Đồng) và **ý định đặt xe** (`isTransferQuery`, chiều `fromAirport` / `toAirport`). "Khách sạn có đưa đón sân bay" vẫn là tiện nghi khách sạn; câu hỏi chỉ về xe không tìm phòng; câu kết hợp tìm cả hai.
- `constants/provinces.js`: thêm tên sân bay vào bảng địa danh, xuất `PROVINCE_KEYS`.
- `services/ragRetrieval.js`: chỉ nêu tỉnh thì lọc khách sạn theo `address.province`.
- `services/transferService.js`: chuyển `activeRoutes` + logic tìm xe thành `findTransferOptions()` dùng chung cho trang Xe đưa đón và chatbot (`transferController.searchTransfers` gọi lại, hành vi không đổi).
- `controllers/aiController.js`: nhánh xe đưa đón — tỉnh + ngày + số khách → tối đa 4 tuyến còn đặt được, đúng chiều trước, trích dẫn `[X1]...`; ngân sách áp cho giá xe khi chỉ hỏi xe; chưa nêu tỉnh thì hỏi lại. Response có thêm `transfers`; `RagLog.retrievedTransferRouteIds`. System prompt / câu từ chối nhắc cả xe đưa đón.
- `AIChatWidget.jsx`: thẻ xe (loại xe, tuyến, nhà xe, giá, số xe còn), bấm mở `/transfers?province=&date=&passengers=`; nhãn ràng buộc có tỉnh, "Xe đưa đón", chiều đón; nút "Xem trang Xe đưa đón" khi không có kết quả.
- `docs/rag-pipeline.md`: thêm bước 4b và bảng ví dụ.

**Kiểm chứng:** `npm test` 125/125 (thêm `tests/chatbot-transfer.test.js`: parser tỉnh / sân bay / chiều đón, chỉ trả xe đúng tỉnh, kiểm tra quỹ xe theo ngày + số xe cần, ngân sách, câu kết hợp, lọc khách sạn theo tỉnh, RagLog). Thử giao diện trên bản sao dữ liệu Atlas ở DB local: "Xe đón tôi từ sân bay Đà Lạt ngày 5/12 cho 3 người" → 4 xe Liên Khương → Đà Lạt, bấm thẻ mở trang Xe đưa đón đã điền Lâm Đồng / 05/12 / 3 khách; "Khách sạn ở Lâm Đồng" → chỉ khách sạn Đà Lạt; không tràn ngang ở 375px.

**Tiến độ:** hoàn thành, chưa commit.

---

## [24/11/2026] Cập nhật README

**Người thực hiện:** Quanh (cùng Claude Code)

- `README.md`:
  - Mục RAG đổi thành "tìm khách sạn và xe đưa đón": thêm tỉnh, ý định đặt xe, bước tìm xe, trích dẫn `[Xn]`, ví dụ câu hỏi.
  - Atlas Vector Search: 1024 chiều (`bge-m3`), ghi rõ chỉ dùng cho benchmark.
  - Viết lại chức năng theo vai trò: bỏ các ghi chú cũ "thanh toán demo", "dashboard còn dữ liệu mẫu"; thêm yêu thích, mã giảm giá, VNPay / MoMo, thông báo, thống kê, xuất báo cáo.
  - Nhà xe theo tỉnh; mô tả response `/api/ai/search`; frontend đọc `VITE_API_URL`.
  - Bảng 16 file test (125 test); thêm `docs/deploy-render.md` vào bảng tài liệu; ghi chú VNPay / MoMo sandbox.
- `Hotel-RAG-FE/README.md`: thay README mẫu của Vite bằng hướng dẫn riêng của frontend (chạy, biến môi trường, danh sách trang, thành phần chính).

**Tiến độ:** hoàn thành, chưa commit.

---

## [24/11/2026] Cập nhật ERD, hình use case và từ điển dữ liệu

**Người thực hiện:** Quanh (cùng Claude Code)

- `docs/erd.mmd` (đối chiếu 15 model trong `Hotel-RAG-BE/models`):
  - Thêm bảng `COUPON` (mã giảm giá) và `NOTIFICATION` (thông báo, tự xóa sau 90 ngày).
  - Trường mới: `USER.wishlist`; `BOOKING` / `TRANSFER_BOOKING` có `subtotalAmount` và `coupon_*`; `PAYMENT.transactionId`; `RAG_LOG.retrievedTransferRouteIds`.
  - `HOTEL.embedding` đổi thành vector 1024 chiều (`bge-m3`, Ollama).
  - Quan hệ mới: người dùng yêu thích khách sạn, tạo mã, nhận thông báo; mã áp vào đơn phòng / đơn xe; mã riêng của khách sạn; RagLog gợi ý tuyến xe.
- `docs/erd.png`: xuất lại bằng mermaid-cli (5952 × 5658 px), đủ 17 bảng.
- `docs/mermaid-bao-cao.md`:
  - Hình 3.5 (ERD) đồng bộ với `erd.mmd`.
  - Use case Khách hàng thêm: hỏi AI về xe đưa đón, lưu yêu thích, thanh toán VNPay / MoMo, áp mã giảm giá, xem thông báo.
  - Use case Đối tác thêm: tạo mã giảm giá, xem doanh thu / tỷ lệ lấp phòng, xem thông báo.
  - Use case Quản trị viên thêm: mã giảm giá toàn sàn, thống kê, xuất Excel / CSV, xem thông báo.
- `docs/data-dictionary.md`, mục `raglogs`: thêm `retrievedTransferRouteIds`; `constraints` có `province`, `isTransferQuery`, `transferDirection`; `pipelineStats.transferResults`.

**Kiểm chứng:** xuất lại `erd.png` và cả 6 khối Mermaid trong `mermaid-bao-cao.md` bằng mermaid-cli, không lỗi cú pháp.

**Việc còn lại:** các hình ERD và use case trong báo cáo Word cần dán lại ảnh mới.

**Tiến độ:** hoàn thành, chưa commit.

---

## [24/11/2026] Rà soát giao diện toàn bộ trang (UI/UX)

**Người thực hiện:** Quanh (cùng Claude Code)

**Cách rà:**
- Quét tự động 24 trang / tab ở 375px và 1280px, đăng nhập lần lượt 4 vai trò (khách, đối tác, nhà xe, admin).
- Mục kiểm tra: tràn ngang, ảnh thiếu alt, nút / link thiếu tên, ô nhập thiếu nhãn, chữ dưới 11px, vùng bấm dưới 24px, tiêu đề tab.
- Xem thêm ảnh chụp các trang chính.
- Chạy trên bản sao dữ liệu Atlas ở DB local (chỉ đọc Atlas); xóa DB tạm sau khi xong.

**Kết quả:**
- Không trang nào tràn ngang; ảnh đều có alt; nút và link đều có tên.
- Không phát hiện lỗi bố cục.

**Đã sửa:**
- Tiêu đề tab trang thanh toán xe chỉ hiện "Nestly" (regex `/transfers/checkout` không khớp route `/transfer-checkout`). Trang `/admin/rag` có tiêu đề riêng "Phân tích RAG" (`ScrollToTop.jsx`).
- 2 ô ngày nhận / trả phòng ở trang Khách sạn thiếu nhãn cho trình đọc màn hình (`Hotels.jsx`).
- Vùng bấm quá nhỏ:
  - Nút "Hiện / Ẩn" mật khẩu: 27×16px, nay cao 36px (`AuthPage.jsx`, `ResetPassword.jsx`).
  - Các link "← Về trang chủ", "← Quay lại", "← Về đăng nhập": nay cao 40px (`AuthPage.jsx`, `HotelDetail.jsx`, `AuthCard.jsx`).
  - Ô chọn tỉnh ở trang chủ và trang Khách sạn: 22px, nay 32px (`Home.jsx`, `Hotels.jsx`).
  - Link chân trang, ô tick: link chân trang nay ≥ 24px, ô tick 16px (`Footer.tsx`, `AuthPage.jsx`).
- Nhãn trạng thái 10px nâng lên 11px: "CHỜ DUYỆT", nhãn chatbot, loại thông báo, "BẢO TRÌ".

**Kiểm chứng:** quét lại sau khi sửa không còn lỗi trên (link nằm trong câu chữ như "Quên mật khẩu?" thuộc ngoại lệ của WCAG 2.5.8). ESLint 0 lỗi, `vite build` thành công.

**Tiến độ:** hoàn thành, chưa commit.

---

## [24/11/2026] Thử thanh toán trên Render; MoMo bị từ chối khi gọi từ máy chủ Render

**Người thực hiện:** Quanh (cùng Claude Code)

**Đã deploy:** merge `d92a5c6` vào `main` (`fffa734`); Render build lại backend + frontend. Trên domain thật chatbot trả được xe đưa đón.

**Thử trên domain thật (nestly-web-6mho.onrender.com):**
- **VNPay:** đơn thử #6FC392 (850.000₫) mở được cổng VNPay sandbox, không còn lỗi "quá thời gian chờ". Thanh toán bằng thẻ test NCB xong thì đơn chuyển "Đã thanh toán" và có thông báo "Đặt phòng thành công".
- **MoMo:** API trả 502 "MoMo từ chối tạo giao dịch: không rõ lý do".
  - Gửi đúng yêu cầu đó (cùng khóa test, cùng redirectUrl / ipnUrl của Render) từ máy ở Việt Nam thì MoMo trả `resultCode 0` kèm link thanh toán.
  - Nhận định: MoMo sandbox từ chối yêu cầu đến từ IP máy chủ Render ở nước ngoài, nhiều khả năng bằng trang không phải JSON. Chưa xác nhận vì chưa xem được log Render.

**Sửa:** `controllers/paymentController.js` đọc phản hồi MoMo dạng text trước khi parse. Khi không phải JSON thì log mã HTTP + đoạn nội dung, và báo rõ "MoMo trả HTTP …, không phải dữ liệu JSON (có thể máy chủ bị MoMo chặn theo vùng)"; có JSON thì kèm `resultCode`. Test `momo-notification` 5/5.

**Việc còn lại:** deploy bản sửa rồi thử lại MoMo trên Render để đọc đúng lý do. Nếu đúng là chặn theo vùng: đổi region Render sang Singapore (phải tạo lại service), hoặc demo MoMo khi chạy backend trên máy.

**Tiến độ:** VNPay xong; MoMo trên Render chưa chạy được. Chưa commit.

---

<!--
MẪU CHO MỤC MỚI — sao chép và dán ngay PHÍA TRÊN khối này, KHÔNG sửa các mục cũ:

## [dd/mm/yyyy] Tiêu đề ngắn

**Người thực hiện:**

**Thay đổi:**
-

**File chính:**

**Kiểm chứng:**

**Việc còn lại:**

**Tiến độ:**

---
-->

## 2026-11-14 – Cập nhật ERD theo model hiện tại

**Thay đổi:**
- `docs/erd.mmd`: bổ sung các trường mới của USER (username, emailVerified, các token xác nhận email / đặt lại mật khẩu), ghi chú địa chỉ 63 tỉnh/thành; thêm quan hệ TRANSPORT_COMPANY – TRANSFER_ROUTE và VEHICLE_TYPE – TRANSFER_BOOKING; thêm createdAt/updatedAt cho VEHICLE_INVENTORY. Đối chiếu với 13 model trong `Hotel-RAG-BE/models`.
- Vẽ lại `docs/erd.png`; thêm `docs/mermaid-bao-cao.md` gom mã Mermaid của các hình báo cáo.

**Việc còn lại:** `docs/data-dictionary.md` chưa cập nhật các trường/collection mới (xe đưa đón, trường USER); hình ERD trong báo cáo Word (Hình 3.4) vẫn là bản 8 collection.

## 2026-11-14 – Đính chính: từ điển dữ liệu đã đầy đủ

**Thay đổi:** Không sửa code. Đối chiếu `docs/data-dictionary.md` với 13 model: đã có đủ 13 collection (kể cả xe đưa đón) và các trường mới của `users`, `payments`. Mục "Việc còn lại" của mục ERD cùng ngày về từ điển dữ liệu là nhận định sai, không cần cập nhật.

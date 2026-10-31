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

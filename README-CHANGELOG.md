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

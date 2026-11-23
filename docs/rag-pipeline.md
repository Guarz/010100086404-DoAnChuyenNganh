# Trợ lý tìm phòng: RAG Chatbot (không phải AI Agent)

> Trả lời góp ý **#2 – Thuật ngữ AI** và **#4 – Hard constraints**.

## 1. Thuật ngữ đúng

Sản phẩm là **RAG Chatbot / RAG-based Semantic Search** cho việc tìm khách sạn – hạng phòng.

Hệ thống **không phải AI Agent** vì không có các thành phần bắt buộc của Agent:

| Thành phần của AI Agent | Hệ thống hiện tại |
|---|---|
| Tool registry (danh sách công cụ LLM được gọi) | Không có. LLM không gọi công cụ nào. |
| Tool selection / planning (LLM tự chọn bước tiếp theo) | Không có. Các bước cố định, chạy theo thứ tự do code quy định. |
| Multi-step execution (vòng lặp quan sát → hành động) | Không có. Mỗi câu hỏi chạy **một lượt** pipeline. |

Vai trò của AI (chạy bằng Ollama, không dùng Gemini) chỉ gồm: (a) tạo vector cho câu hỏi/khách sạn bằng `bge-m3`, (b) viết câu trả lời từ ngữ cảnh đã được hệ thống truy xuất bằng `dolphin3`. Trong báo cáo và giao diện dùng thống nhất cụm "**trợ lý tìm kiếm bằng RAG**".

## 2. Pipeline xử lý một câu hỏi

```
Câu hỏi (POST /api/ai/search)
  │
  ├─(0) Guardrail ─ câu ngoài phạm vi / độc hại / prompt injection → từ chối, không truy xuất, không gọi LLM
  │
  ├─(1) Tách ràng buộc cứng  (services/queryConstraintParser.js, rule-based, tất định)
  │      thành phố · TỈNH (63 tỉnh, địa danh, tên sân bay) · ngày nhận/trả · số người lớn/trẻ em · số phòng
  │      · ngân sách min/max · tiện nghi bắt buộc · loại phòng (villa/suite/twin/family) · "rẻ nhất/đắt nhất"
  │      · Ý ĐỊNH ĐẶT XE ĐƯA ĐÓN (isTransferQuery) + chiều đón (từ sân bay / ra sân bay)
  │
  ├─(2) Structured filtering (services/ragRetrieval.js → applyHardFilters)
  │      Hotel.status = Approved, RoomType.isActive ≠ false, city (hoặc province khi chỉ nêu tỉnh), maxAdults, maxChildren,
  │      tiện nghi (phòng + khách sạn), loại phòng
  │
  ├─(3) Availability + ngân sách (applyAvailabilityAndBudget)
  │      Có ngày ở → RoomInventory phải mở bán ĐỦ mọi đêm và availableRooms ≥ số phòng cần.
  │      Giá dùng để so ngân sách = trung bình dynamicPrice của đúng các đêm đó.
  │
  ├─(4) Semantic ranking (rankCandidates) – CHỈ trên tập ứng viên hợp lệ
  │      điểm = 0.7 × cosine(vector câu hỏi, vector khách sạn) + 0.3 × điểm từ khóa (BM25 cấp hạng phòng)
  │      Câu "rẻ nhất / đắt nhất" → sắp theo giá.
  │
  ├─(4b) Xe đưa đón (chỉ khi isTransferQuery) – transferService.findTransferOptions
  │      tỉnh + ngày (kiểm tra VehicleInventory) + số khách (số xe cần) → tuyến còn đặt được;
  │      đúng chiều khách hỏi xếp trước, rồi rẻ nhất trước; tối đa 4 tuyến, trích dẫn [X1..X4].
  │
  ├─(5) Generation – dolphin3 (Ollama) chỉ được dùng các lựa chọn đã đánh số [1..K], bắt buộc trích dẫn [n].
  │      Ollama lỗi / chưa chạy → câu trả lời dựng sẵn từ dữ liệu (answerSource = template), không trả lỗi 500.
  │
  └─(6) Ghi RagLog: câu hỏi, ràng buộc, hạng phòng truy xuất THEO THỨ TỰ, số ứng viên sau từng bước,
         tuyến xe đã gợi ý (retrievedTransferRouteIds), nguồn câu trả lời (llm/template/guardrail), độ trễ.
```

**Câu hỏi về xe đưa đón và theo tỉnh.** Parser tách hai ý định độc lập:

| Câu hỏi | Kết quả |
|---|---|
| "Xe đón tôi từ sân bay Đà Lạt ngày 5/12 cho 3 người" | chỉ tìm xe: tỉnh Lâm Đồng, đón từ sân bay, kiểm tra xe trống ngày 05/12 |
| "Khách sạn có đưa đón sân bay ở Đà Nẵng" | chỉ tìm khách sạn, "Đưa đón sân bay" là tiện nghi bắt buộc |
| "Đặt phòng ở Hội An và xe ra sân bay" | cả hai: phòng ở Hội An + xe tỉnh Quảng Nam, tuyến ra sân bay trước |
| "Khách sạn ở Lâm Đồng" / "resort Vũng Tàu" | lọc khách sạn theo tỉnh (không cần nêu thành phố) |
| "thuê xe đưa đón" (không nêu tỉnh) | hỏi lại tỉnh/thành, không gợi ý xe bừa |

Ngân sách ("dưới 500k") áp cho giá xe chỉ khi câu hỏi không kèm tìm phòng. Trích dẫn xe dùng dạng `[X1]` để không lẫn với `[n]` của hạng phòng (chỉ số citationCorrectness chỉ tính `[n]`). Widget chat hiện thẻ xe, bấm vào mở trang **Xe đưa đón** đã điền sẵn tỉnh / ngày / số khách.

**Tách structured filtering khỏi semantic preference**: ràng buộc cứng (bước 2–3) quyết định phòng nào *được phép* xuất hiện; vector (bước 4) chỉ quyết định *thứ tự* giữa các phòng hợp lệ. Vì vậy không thể gợi ý phòng hết chỗ, quá ngân sách hay thiếu tiện nghi bắt buộc.

Ví dụ: *"Phòng ở Đà Nẵng từ 15/11 đến 18/11 cho 2 người, dưới 1,5 triệu, có hồ bơi"* →
`{ city: "Đà Nẵng", checkIn: "2026-11-15", checkOut: "2026-11-18", adults: 2, maxPrice: 1500000, amenities: ["Hồ bơi"] }`.
Response trả kèm `constraints` và `pipeline: { catalog, afterHardFilters, afterAvailability }` để giải thích kết quả; widget chat hiển thị ràng buộc đã hiểu dưới dạng nhãn.

## 3. Minh chứng

| Nội dung | Vị trí |
|---|---|
| Code tách ràng buộc | `Hotel-RAG-BE/services/queryConstraintParser.js` |
| Code lọc / quỹ phòng / xếp hạng | `Hotel-RAG-BE/services/ragRetrieval.js` |
| Controller pipeline + guardrail + fallback | `Hotel-RAG-BE/controllers/aiController.js` |
| Test: chỉ trả phòng còn chỗ & trong ngân sách, guardrail, RagLog | `Hotel-RAG-BE/tests/rag-pipeline.test.js` (`npm test`) |
| Test: xe đưa đón + câu hỏi theo tỉnh trong chatbot | `Hotel-RAG-BE/tests/chatbot-transfer.test.js` |
| Benchmark keyword vs vector vs pipeline | [`docs/rag-benchmark.md`](rag-benchmark.md) (`npm run rag:benchmark`) |
| Log thật | collection `raglogs` + trang Admin → **RAG Analytics** (`/admin/rag`) |

## 4. Giới hạn đã biết

- Bộ tách ràng buộc dùng luật nên chỉ hiểu các cách diễn đạt phổ biến (xem test); câu diễn đạt lạ sẽ rơi về xếp hạng ngữ nghĩa thuần.
- Xếp hạng ngữ nghĩa tính cosine trong ứng dụng trên tập ứng viên đã lọc (phù hợp quy mô đồ án). Khi dữ liệu lớn nên chuyển sang `$vectorSearch` có `filter` của Atlas.
- Vector được tạo ở **cấp khách sạn**; các hạng phòng cùng khách sạn phân biệt nhau bằng điểm từ khóa.
- Tuyến xe được tra theo tỉnh, chưa xếp hạng ngữ nghĩa (không có vector cho tuyến xe); ngân sách trong câu hỏi kết hợp phòng + xe chỉ áp cho phòng.

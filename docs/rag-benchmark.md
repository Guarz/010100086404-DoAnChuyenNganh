# Benchmark truy xuất RAG — Keyword vs Vector vs Pipeline

- Ngày chạy: 2026-10-31T12:02:39.554Z
- Golden Query Set: `golden_dataset.json` (30 câu; 23 câu có đáp án, 7 câu ngoài phạm vi/độc hại)
- Corpus: `frozen` — 11 hạng phòng; K = 5; vector câu hỏi: 30/30
- Đơn vị đánh giá: **hạng phòng** (cùng cấp với nhãn Golden).

## Kết quả tổng

| Phương pháp | Số câu | HitRate@5 | Recall@5 | Precision@5 | nDCG@5 | MRR | Từ chối đúng (ngoài phạm vi) |
|---|---|---|---|---|---|---|---|
| keyword | 23 | 0.870 | 0.804 | 0.217 | 0.728 | 0.710 | 0.000 (7 câu) |
| vector | 23 | 0.739 | 0.674 | 0.183 | 0.531 | 0.520 | 0.000 (7 câu) |
| pipeline | 23 | 0.913 | 0.913 | 0.270 | 0.868 | 0.859 | 1.000 (7 câu) |

## Theo nhóm câu hỏi (nDCG@5)

| Intent | Số câu | keyword | vector | pipeline |
|---|---|---|---|---|
| price_filter | 3 | 0.357 | 0.674 | 1.000 |
| amenity_search | 6 | 0.905 | 0.508 | 0.905 |
| capacity_search | 3 | 0.537 | 0.372 | 0.968 |
| location_search | 3 | 0.667 | 0.667 | 0.667 |
| semantic_search | 6 | 0.772 | 0.605 | 0.772 |
| exact_match | 2 | 1.000 | 0.193 | 1.000 |
| malicious | 3 | từ chối 0.000 | từ chối 0.000 | từ chối 1.000 |
| off_topic | 3 | từ chối 0.000 | từ chối 0.000 | từ chối 1.000 |
| prompt_injection | 1 | từ chối 0.000 | từ chối 0.000 | từ chối 1.000 |

## Error analysis (pipeline)

Các câu pipeline chưa đạt (HitRate = 0, hoặc trả kết quả cho câu cần từ chối):

- **Q12** (location_search) "Tìm phòng ở Hà Nội."
  - Ràng buộc tách được: `{"city":"Hà Nội","isHotelQuery":true}`
  - Đáp án: Deluxe City View (Hà Nội) (JW Marriott Hotel Hanoi)
  - Pipeline trả về: Executive Suite (JW Marriott Hotel Hanoi)
  - Nguyên nhân: nhãn Golden lỗi thời — đáp án đang bị Partner khóa bảo trì (isActive=false) nên hệ thống đúng khi không gợi ý. Cần cập nhật golden_dataset.json.
- **Q19** (semantic_search) "Tìm phòng có tầm nhìn toàn cảnh thành phố."
  - Ràng buộc tách được: `{"isHotelQuery":true}`
  - Đáp án: Deluxe City View (Hà Nội) (JW Marriott Hotel Hanoi)
  - Pipeline trả về: Phòng Standard Giường Đôi (Đà Nẵng Chill Boutique); Phòng Deluxe Hướng Biển (Mường Thanh Luxury Đà Nẵng); Executive Suite (JW Marriott Hotel Hanoi)
  - Nguyên nhân: nhãn Golden lỗi thời — đáp án đang bị Partner khóa bảo trì (isActive=false) nên hệ thống đúng khi không gợi ý. Cần cập nhật golden_dataset.json.

## Nhận xét

- **keyword** khớp tốt câu có từ khóa xuất hiện nguyên văn (tên phòng, tiện nghi) nhưng không hiểu so sánh giá, số khách, và luôn trả kết quả cho câu ngoài phạm vi.
- **vector** (cách cũ) truy xuất ở cấp khách sạn bằng mô tả khách sạn nên không phân biệt được hạng phòng, giá hay sức chứa; phù hợp câu hỏi theo địa điểm/phong cách.
- **pipeline** tách ràng buộc cứng (giá, số khách, tiện nghi, loại phòng, thành phố, ngày) để lọc có cấu trúc trước, rồi mới xếp hạng ngữ nghĩa; câu ngoài phạm vi bị guardrail từ chối trước khi truy xuất.
- Groundedness và citation correctness của câu trả lời được đo trên RagLog thật (trang Admin → RAG Analytics) sau khi chạy `scripts/replayGoldenQueries.js`.

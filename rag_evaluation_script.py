import json

# 1. Hàm tính toán các chỉ số Đánh giá RAG
def calculate_metrics(rag_logs, k=3):
    total_queries = len(rag_logs)
    hits = 0
    total_recall = 0.0
    total_precision = 0.0

    for log in rag_logs:
        # Tập hợp các ID chuẩn (Ground Truth)
        golden_ids = set(log["golden_context_ids"])
        
        # Lấy top K tài liệu hệ thống AI truy xuất được
        retrieved_ids = log["retrieved_context_ids"][:k]
        
        # Đếm số lượng tài liệu truy xuất đúng (giao của 2 tập hợp)
        correct_retrievals = set(retrieved_ids).intersection(golden_ids)
        num_correct = len(correct_retrievals)

        # A. Tính HitRate: Bằng 1 nếu có ít nhất 1 tài liệu đúng nằm trong Top K
        if num_correct > 0:
            hits += 1

        # B. Tính Recall@K: Tỷ lệ tài liệu chuẩn được tìm thấy / Tổng số tài liệu chuẩn
        recall = num_correct / len(golden_ids) if len(golden_ids) > 0 else 0
        total_recall += recall

        # C. Tính Precision@K: Tỷ lệ tài liệu đúng / Số K tài liệu tối đa lấy ra
        precision = num_correct / k
        total_precision += precision

    # Tính trung bình cho toàn bộ tập dữ liệu (toàn bộ Log)
    avg_hit_rate = (hits / total_queries) * 100
    avg_recall = total_recall / total_queries
    avg_precision = total_precision / total_queries

    return {
        "HitRate (%)": round(avg_hit_rate, 2),
        f"Recall@{k}": round(avg_recall, 4),
        f"Precision@{k}": round(avg_precision, 4)
    }

# 2. Dữ liệu Log giả lập (Mô phỏng đọc từ file RAG_Log.json)
simulated_logs = [
    {
        "query_id": "q_001",
        "user_query": "Tìm khách sạn yên tĩnh, lãng mạn ở Phú Quốc.",
        "golden_context_ids": ["doc_pq_vinpearl_01", "doc_pq_vinpearl_02"],
        "retrieved_context_ids": ["doc_pq_vinpearl_01", "doc_sg_reverie_01", "doc_pq_villa_01"] 
        # Trúng 1/2 tài liệu -> Recall: 0.5, Precision: 0.33, Hit: Yes
    },
    {
        "query_id": "q_002",
        "user_query": "Phòng ở Hà Nội có phòng gym, hồ bơi vô cực.",
        "golden_context_ids": ["doc_hn_jw_01", "doc_hn_jw_03"],
        "retrieved_context_ids": ["doc_hn_jw_01", "doc_hn_jw_03", "doc_sg_reverie_02"] 
        # Trúng 2/2 tài liệu -> Recall: 1.0, Precision: 0.66, Hit: Yes
    },
    {
        "query_id": "q_003",
        "user_query": "Khách sạn ở trung tâm Sài Gòn phong cách hoàng gia.",
        "golden_context_ids": ["doc_sg_reverie_01"],
        "retrieved_context_ids": ["doc_pq_villa_01", "doc_hn_jw_01", "doc_pq_vinpearl_01"] 
        # Sai hoàn toàn -> Recall: 0, Precision: 0, Hit: No
    }
]

# 3. Thực thi kịch bản đánh giá
if __name__ == "__main__":
    print("ĐANG PHÂN TÍCH RAG LOG...")
    print("-" * 40)
    
    k_value = 3
    print(f"Tổng số lượt truy vấn: {len(simulated_logs)}")
    print(f"Tham số Top K (Số chunk lấy ra): {k_value}")
    print("-" * 40)
    
    metrics = calculate_metrics(simulated_logs, k=k_value)
    
    for metric, value in metrics.items():
        print(f"{metric}: {value}")
        
    print("-" * 40)
    print("Hoàn tất đánh giá!")

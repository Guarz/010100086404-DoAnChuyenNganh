# Mã Mermaid các hình trong báo cáo

Dán từng khối vào https://mermaid.live để xem và xuất ảnh.


## Hình 2.1 – Mô hình RAG

```mermaid
flowchart LR
    Q["Câu hỏi<br/>của người dùng"] --> R["<b>1. Truy xuất</b><br/>(Retrieval)<br/>Tìm tài liệu liên quan<br/>trong nguồn dữ liệu"]
    D[("Nguồn dữ liệu<br/>(CSDL, chỉ mục vector)")] --> R
    R -->|"tài liệu<br/>liên quan"| A["<b>2. Tăng cường</b><br/>(Augmentation)<br/>Ghép câu hỏi và tài liệu<br/>thành prompt"]
    A --> G["<b>3. Sinh</b><br/>(Generation)<br/>LLM viết câu trả lời<br/>dựa trên ngữ cảnh"]
    G --> O["Câu trả lời<br/>có dẫn nguồn"]
    style Q fill:#f3f4f6,stroke:#37526b
    style D fill:#fff3d6,stroke:#8a6d1f
    style O fill:#e8f4ea,stroke:#2f6b3a
```

## Hình 3.1 – Use case Khách hàng

```mermaid
flowchart LR
    A(["👤 Khách hàng"])
    subgraph S["Hệ thống đặt phòng Nestly"]
        direction TB
        U0(["Đăng ký, đăng nhập"])
        U1(["Quản lý hồ sơ, đổi mật khẩu"])
        U2(["Tìm và lọc khách sạn"])
        U3(["Xem chi tiết khách sạn"])
        U4(["Hỏi trợ lý tìm phòng AI"])
        U5(["Đặt phòng"])
        U6(["Thanh toán VNPay<br/>«include» Đặt phòng"])
        U7(["Xem lịch sử và hủy đơn"])
        U8(["Đánh giá khách sạn"])
        U9(["Đăng ký làm đối tác"])
    end
    A --- U0
    A --- U1
    A --- U2
    A --- U3
    A --- U4
    A --- U5
    A --- U6
    A --- U7
    A --- U8
    A --- U9
    style A fill:#e6f0fa,stroke:#37526b
```

## Hình 3.2 – Use case Đối tác khách sạn

```mermaid
flowchart LR
    A(["👤 Đối tác khách sạn"])
    subgraph S["Hệ thống đặt phòng Nestly"]
        direction TB
        U0(["Đăng nhập"])
        U1(["Tạo, sửa khách sạn"])
        U2(["Quản lý hạng phòng"])
        U3(["Cập nhật giá và quỹ phòng theo ngày<br/>«include» Quản lý hạng phòng"])
        U4(["Xem đơn đặt phòng của khách sạn"])
        U5(["Xác nhận khách đã trả phòng<br/>«extend» Xem đơn đặt phòng"])
    end
    A --- U0
    A --- U1
    A --- U2
    A --- U3
    A --- U4
    A --- U5
    style A fill:#e6f0fa,stroke:#37526b
```

## Hình 3.3 – Use case Quản trị viên

```mermaid
flowchart LR
    A(["👤 Quản trị viên"])
    subgraph S["Hệ thống đặt phòng Nestly"]
        direction TB
        U0(["Đăng nhập"])
        U1(["Duyệt hoặc từ chối khách sạn"])
        U2(["Duyệt hoặc từ chối đối tác"])
        U3(["Tìm kiếm, khóa, mở khóa tài khoản"])
        U4(["Xem RAG Analytics"])
    end
    A --- U0
    A --- U1
    A --- U2
    A --- U3
    A --- U4

    style A fill:#e6f0fa,stroke:#37526b
```

## Hình 3.4 – ERD

```mermaid
erDiagram
    USER {
        ObjectId _id PK
        string fullName
        string email UK
        string password "bcrypt hash"
        string phone
        string role "Customer | Partner | Admin"
        string partnerApplicationStatus "NotRequested | Pending | Approved | Rejected"
        string status "Active | Locked"
        string address_street
        string address_city
        string address_province
        date createdAt
        date updatedAt
    }

    HOTEL {
        ObjectId _id PK
        ObjectId partnerId FK "-> USER (Partner)"
        string hotelName
        string description
        string address_street
        string address_city
        string address_province
        GeoJSON coordinates "Point [lng, lat], index 2dsphere"
        number rating "trung bình từ REVIEW"
        number reviewCount
        string_array amenities
        string_array images
        number_array embedding "vector 3072 chiều (Gemini)"
        string status "Pending | Approved | Rejected"
        string rejectionReason
        date reviewedAt
        date createdAt
        date updatedAt
    }

    ROOM_TYPE {
        ObjectId _id PK
        ObjectId hotelId FK "-> HOTEL"
        string title
        string description
        number basePrice
        number maxAdults
        number maxChildren
        number totalQuantity
        string_array amenities
        string_array images
        boolean isActive "false = khóa bảo trì"
        date createdAt
        date updatedAt
    }

    ROOM_INVENTORY {
        ObjectId _id PK
        ObjectId roomTypeId FK "-> ROOM_TYPE, unique (roomTypeId, date)"
        date date "00:00 UTC của từng đêm"
        number availableRooms "min 0"
        number dynamicPrice "null = dùng basePrice"
        date createdAt
        date updatedAt
    }

    BOOKING {
        ObjectId _id PK
        ObjectId customerId FK "-> USER"
        ObjectId hotelId FK "-> HOTEL"
        date checkInDate
        date checkOutDate
        date expiresAt "hạn giữ chỗ 5 phút (Pending)"
        number totalAmount
        string specialRequests
        string idempotencyKey "unique (customerId, idempotencyKey)"
        string bookingStatus "Pending | Confirmed | Canceled | Completed"
        date createdAt
        date updatedAt
    }

    BOOKING_DETAIL {
        ObjectId _id PK
        ObjectId roomTypeId FK "-> ROOM_TYPE"
        number quantity "min 1"
        number unitPrice "giá chốt lúc đặt"
        number totalNights
    }

    PAYMENT {
        ObjectId _id PK
        ObjectId bookingId FK "-> BOOKING"
        string paymentMethod "VNPay | Momo | Cash | Demo"
        number amount
        string paymentStatus "Pending | Success | Failed"
        date paymentDate
        date createdAt
        date updatedAt
    }

    REVIEW {
        ObjectId _id PK
        ObjectId customerId FK "-> USER"
        ObjectId hotelId FK "-> HOTEL"
        ObjectId bookingId FK, UK "-> BOOKING, mỗi đơn 1 đánh giá"
        number rating "1 - 5"
        string comment
        date createdAt
        date updatedAt
    }

    RAG_LOG {
        ObjectId _id PK
        string userQuery
        mixed constraints "ràng buộc cứng tách từ câu hỏi"
        ObjectId_array retrievedHotelIds FK "-> HOTEL"
        ObjectId_array retrievedContextIds FK "-> ROOM_TYPE, theo thứ tự xếp hạng"
        ObjectId_array goldenContextIds FK "-> ROOM_TYPE, nhãn Golden"
        string llmResponse
        string answerSource "llm | template | guardrail"
        string llmModel "vd. ollama:dolphin3"
        mixed pipelineStats "catalog, afterHardFilters, afterAvailability"
        number latencyMs
        number metrics_hitRate
        number metrics_recall
        number metrics_precision
        number metrics_groundedness "1 = bám sát, 0 = bịa"
        number metrics_citationCorrectness
        date createdAt
    }

    USER ||--o{ HOTEL : "sở hữu (Partner)"
    USER ||--o{ BOOKING : "đặt phòng"
    USER ||--o{ REVIEW : "viết"
    HOTEL ||--o{ ROOM_TYPE : "có"
    HOTEL ||--o{ BOOKING : "nhận"
    HOTEL ||--o{ REVIEW : "được đánh giá"
    ROOM_TYPE ||--o{ ROOM_INVENTORY : "quỹ phòng theo ngày"
    BOOKING ||--|{ BOOKING_DETAIL : "gồm (nhúng trong Booking)"
    ROOM_TYPE ||--o{ BOOKING_DETAIL : "được đặt"
    BOOKING ||--o{ PAYMENT : "thanh toán"
    BOOKING ||--o| REVIEW : "được đánh giá (tối đa 1)"
    RAG_LOG }o--o{ HOTEL : "truy xuất"
    RAG_LOG }o--o{ ROOM_TYPE : "ngữ cảnh / nhãn Golden"
```

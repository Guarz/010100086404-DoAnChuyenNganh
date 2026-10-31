# Chạy Ollama (Dolphin 3.0) trên AWS EC2 thay vì máy cá nhân

Model chạy trên một máy chủ EC2 có GPU. Backend Hotel-RAG (vẫn chạy trên máy bạn) gọi tới model qua `OLLAMA_URL`. Code không cần sửa, chỉ đổi `.env`.

```
Máy bạn (npm run dev) ──HTTP──► EC2 GPU (Ollama + dolphin3)
         OLLAMA_URL                 cổng 11434 (không mở công khai)
```

> ⚠️ **Ollama không có đăng nhập hay API key.** Ai truy cập được cổng 11434 là dùng được model, tức là dùng máy chủ bạn đang trả tiền. **Tuyệt đối không mở cổng 11434 ra Internet (0.0.0.0/0).** Hãy dùng một trong hai cách kết nối an toàn ở bước 6.

## 1. Chọn loại máy (instance)

| Instance | GPU | Phù hợp | Ghi chú |
|---|---|---|---|
| **g4dn.xlarge** (khuyên dùng) | 1× NVIDIA T4, **16 GB VRAM**, 4 vCPU, 16 GB RAM | Model 8B (~4.9 GB) nằm trọn trong VRAM, trả lời nhanh hơn hẳn RTX 3050 4 GB | Loại GPU rẻ nhất phổ biến của AWS |
| g5.xlarge | 1× NVIDIA A10G 24 GB | Nhanh hơn, chạy được model lớn hơn | Đắt hơn g4dn |
| CPU (vd. c7i.2xlarge) | Không có | Chỉ để thử | Model 8B chạy bằng CPU rất chậm, không hợp để demo |

- **Region:** chọn **Asia Pacific (Singapore) `ap-southeast-1`**, gần Việt Nam nhất nên độ trễ thấp.
- **Chi phí:** máy GPU tính tiền **theo giờ khi đang chạy**, và **không nằm trong Free Tier**. Xem giá hiện tại tại https://aws.amazon.com/ec2/pricing/on-demand/ (lọc theo region và `g4dn.xlarge`). Ổ đĩa EBS vẫn bị tính tiền cả khi máy đã Stop.
- **Tài khoản AWS Academy / Learner Lab** của trường thường **chặn instance GPU**. Hãy kiểm tra trước, hoặc dùng tài khoản AWS cá nhân.

### 1b. Tài khoản AWS **Free plan** (không chọn được g4dn.xlarge)

Tài khoản Free plan **không cho tạo máy có GPU**. Chỉ các loại được gắn nhãn **"Free tier eligible"** trong danh sách Instance type mới tạo được: các máy nhỏ dòng `t3` / `t4g` và `c7i-flex.large`, `m7i-flex.large`. Hãy kiểm tra lại danh sách thực tế bằng bộ lọc *Free tier eligible* trên trang Launch instance. Có 3 hướng:

| Lựa chọn | Model | Tốc độ dự kiến | Chi phí | Khi nào nên chọn |
|---|---|---|---|---|
| **A. Nâng cấp lên Paid plan**, giữ hướng dẫn g4dn.xlarge ở trên | dolphin3 8B trên GPU T4 | Nhanh | Trừ vào credit Free plan còn lại, hết credit thì trả tiền theo giờ | Cần demo trên cloud mượt mà |
| **B. Ở lại Free plan, dùng `m7i-flex.large` (2 vCPU, 8 GB RAM, chỉ CPU) với model nhỏ ~3B** | Dolphin 3.0 bản 3B (Llama 3.2 3B) | Chậm: vài chục giây đến hơn 1 phút mỗi câu | Không mất tiền trong hạn mức Free plan | Chỉ cần chứng minh "chạy được trên cloud" |
| **C. Chạy trên máy cá nhân** ([local-llm-dolphin.md](local-llm-dolphin.md)) | dolphin3 8B trên RTX 3050 4 GB | Nhanh hơn B rõ rệt | Miễn phí | **Khuyên dùng** khi không có GPU trên cloud |

**Vì sao không chạy dolphin3 8B trên máy Free plan:** model nặng khoảng 4.9 GB. `m7i-flex.large` có 8 GB RAM nhưng chỉ 2 vCPU và không có GPU, nên mỗi câu trả lời có thể mất vài phút, vượt thời gian chờ. Các máy `t3.micro` / `t3.small` (1–2 GB RAM) thì không đủ bộ nhớ.

#### Làm theo hướng B (Free plan + model 3B)

1. Ở bước 3, chọn **Instance type `m7i-flex.large`** và **AMI Ubuntu Server 24.04 LTS** thường (không cần AMI có driver NVIDIA). Storage giữ trong hạn mức Free plan, ví dụ 30 GB gp3.
2. Bỏ qua bước 2 (không cần xin hạn mức GPU).
3. Cài Ollama như bước 4, nhưng **tải bản Dolphin 3.0 cỡ 3B** thay cho `dolphin3`. Ollama tải được file GGUF trực tiếp từ Hugging Face:

   ```bash
   ollama pull hf.co/bartowski/Dolphin3.0-Llama3.2-3B-GGUF:Q4_K_M
   ollama run hf.co/bartowski/Dolphin3.0-Llama3.2-3B-GGUF:Q4_K_M "Xin chào"
   ```

   Kiểm tra tên repo và bản lượng tử hóa trên https://huggingface.co trước khi tải (tìm "Dolphin3.0-Llama3.2-3B GGUF"). Nếu tên khác, dùng đúng tên đó trong cả lệnh `ollama pull` và biến `OLLAMA_MODEL`. Nếu tiếng Việt của bản 3B quá kém, có thể thử model nhỏ đa ngôn ngữ khác (ví dụ một model ~3B trong thư viện Ollama) và so sánh bằng `npm run rag:replay`.
4. Kết nối bằng SSH tunnel như bước 6 (cách A). Trong `.env`, đặt tên model đã tải và tăng thời gian chờ vì máy chỉ có CPU:

   ```env
   LLM_PROVIDER=ollama
   OLLAMA_MODEL=hf.co/bartowski/Dolphin3.0-Llama3.2-3B-GGUF:Q4_K_M
   OLLAMA_URL=http://127.0.0.1:11434
   OLLAMA_TIMEOUT_MS=180000
   ```

5. Nếu một câu vẫn chạy quá thời gian chờ, hệ thống tự trả lời bằng dữ liệu đã lọc (`answerSource: "template"`) nên website không bị lỗi. Ghi rõ giới hạn tốc độ này trong báo cáo.

#### Lựa chọn miễn phí ngoài AWS (nếu bắt buộc phải chạy trên cloud)

- **Oracle Cloud Always Free (Ampere A1):** tối đa 4 OCPU ARM và 24 GB RAM, đủ RAM cho dolphin3 8B. Vẫn chỉ có CPU nên chậm, nhưng khỏe hơn máy Free plan của AWS.
- **Google Colab / Kaggle Notebook (GPU T4 miễn phí, có giới hạn giờ dùng):** chạy được Ollama bên trong notebook để thử nghiệm, nhưng phiên làm việc tự tắt sau một thời gian, nên không hợp để chạy liên tục hay demo.

## 2. Xin hạn mức GPU (bắt buộc với tài khoản mới)

Tài khoản mới thường có hạn mức **0 vCPU cho dòng G**, nên tạo máy sẽ báo lỗi `VcpuLimitExceeded`.

1. Mở **Service Quotas → AWS services → Amazon EC2**.
2. Tìm **"Running On-Demand G and VT instances"**.
3. Bấm **Request increase**, nhập **4** (đủ cho 1 máy g4dn.xlarge).
4. Chờ AWS duyệt (thường vài giờ đến 1–2 ngày). Nên làm bước này trước tiên.

Đồng thời vào **Billing → Budgets** tạo cảnh báo chi phí (ví dụ 10 USD/tháng) để không bị bất ngờ.

## 3. Tạo máy EC2

Vào **EC2 → Launch instance**:

| Mục | Giá trị |
|---|---|
| Name | `hotel-rag-ollama` |
| AMI | **Deep Learning Base OSS Nvidia Driver GPU AMI (Ubuntu 22.04)**, đã có sẵn driver NVIDIA |
| Instance type | `g4dn.xlarge` |
| Key pair | Tạo mới, tải file `hotel-rag-ollama.pem`, cất kỹ |
| Network / Security group | Chỉ mở **SSH (22)**, Source = **My IP**. **Không** thêm cổng 11434 |
| Storage | 50 GB gp3 (đủ cho hệ điều hành, driver và vài model) |

Bấm **Launch**, rồi ghi lại **Public IPv4 address** của máy.

> IP công khai sẽ đổi mỗi lần Stop/Start. Nếu muốn giữ cố định, gắn một **Elastic IP** (lưu ý: Elastic IP tính phí khi không gắn vào máy đang chạy).

## 4. Cài Ollama và tải model trên EC2

Từ máy Windows của bạn (PowerShell, trong thư mục chứa file `.pem`):

```powershell
ssh -i .\hotel-rag-ollama.pem ubuntu@<PUBLIC_IP>
```

Trên EC2:

```bash
nvidia-smi                                   # phải thấy GPU Tesla T4
curl -fsSL https://ollama.com/install.sh | sh
ollama pull dolphin3
ollama run dolphin3 "Chào bạn, giới thiệu ngắn một khách sạn ở Đà Nẵng."
```

Script cài đặt tạo sẵn dịch vụ `ollama` tự khởi động cùng máy. Mặc định Ollama **chỉ lắng nghe `127.0.0.1:11434`**, nghĩa là bên ngoài không truy cập được. Đây là điều bạn muốn.

## 5. Giữ model luôn sẵn sàng (không bắt buộc)

Để không phải chờ nạp model ở câu hỏi đầu tiên sau mỗi lần nghỉ:

```bash
sudo systemctl edit ollama
```

Thêm vào file mở ra:

```ini
[Service]
Environment="OLLAMA_KEEP_ALIVE=1h"
```

Sau đó chạy:

```bash
sudo systemctl restart ollama
```

## 6. Kết nối backend tới Ollama trên EC2

### Cách A: SSH tunnel (khuyên dùng khi phát triển và demo)

Không mở thêm cổng nào. Ollama trên EC2 xuất hiện như thể đang chạy trên máy bạn.

Mở một PowerShell riêng và **giữ cửa sổ này mở** trong suốt thời gian dùng:

```powershell
ssh -i .\hotel-rag-ollama.pem -N -L 11434:127.0.0.1:11434 ubuntu@<PUBLIC_IP>
```

`.env` ở thư mục gốc dự án:

```env
LLM_PROVIDER=ollama
OLLAMA_MODEL=dolphin3
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_TIMEOUT_MS=60000
```

Kiểm tra bằng PowerShell thứ hai (phải thấy `dolphin3`):

```powershell
curl http://127.0.0.1:11434/api/tags
```

Lưu ý: đừng chạy Ollama local cùng lúc vì nó cũng chiếm cổng 11434. Nếu cần chạy cả hai, đổi tunnel sang `-L 11435:127.0.0.1:11434` và đặt `OLLAMA_URL=http://127.0.0.1:11435`.

### Cách B: Reverse proxy có khóa (khi backend chạy trên server khác, không mở được tunnel)

Đặt **Nginx** trên EC2 làm "cửa" có kiểm tra khóa và HTTPS. Ollama vẫn chỉ nghe ở `127.0.0.1`. Backend gửi khóa qua biến `OLLAMA_API_KEY` (code tự thêm header `Authorization: Bearer <khóa>`).

Trên EC2:

```bash
sudo apt-get update && sudo apt-get install -y nginx
openssl rand -hex 32          # tạo khóa bí mật, lưu lại kết quả
sudo nano /etc/nginx/sites-available/ollama
```

Nội dung file (thay `<KHOA_BI_MAT>` bằng khóa vừa tạo):

```nginx
server {
    listen 80;
    location /api/ {
        if ($http_authorization != "Bearer <KHOA_BI_MAT>") { return 401; }
        proxy_pass http://127.0.0.1:11434;
        proxy_set_header Host 127.0.0.1:11434;
        proxy_read_timeout 300s;
    }
}
```

Bật cấu hình:

```bash
sudo ln -s /etc/nginx/sites-available/ollama /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

- **Security group:** mở cổng **80** (hoặc **443** nếu dùng HTTPS), Source **chỉ là IP của server backend**, không phải `0.0.0.0/0`.
- **HTTPS:** nếu có tên miền trỏ về EC2, chạy `sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx` để có HTTPS. Không có HTTPS thì khóa đi qua mạng ở dạng không mã hóa, nên càng phải giới hạn IP.

`.env` của backend:

```env
LLM_PROVIDER=ollama
OLLAMA_MODEL=dolphin3
OLLAMA_URL=http://<PUBLIC_IP_HOAC_TEN_MIEN>
OLLAMA_API_KEY=<KHOA_BI_MAT>
```

## 7. Kiểm tra hệ thống

1. Khởi động API: `npm run dev`.
2. Hỏi trợ lý trên web, ví dụ: "Phòng ở Đà Nẵng cho 2 người dưới 2 triệu có hồ bơi".
3. Response và bản ghi trong `raglogs` phải có `answerSource: "llm"` và `llmModel: "ollama:dolphin3"`.
4. Đo chất lượng và tốc độ: chạy `npm run rag:replay`, rồi xem **RAG Analytics** (độ trễ trung bình, citation correctness, groundedness).

Nếu EC2 tắt hoặc tunnel bị ngắt, hệ thống **vẫn trả lời** bằng dữ liệu đã lọc (`answerSource: "template"`) chứ không báo lỗi.

## 8. Tiết kiệm chi phí

- **Stop** máy ngay khi không dùng: EC2 → chọn máy → **Instance state → Stop**. Khi Stop chỉ còn tính tiền ổ EBS. Muốn dùng lại thì **Start**, rồi lấy IP mới nếu không gắn Elastic IP.
- **Terminate** máy (xóa hẳn cả ổ đĩa) khi kết thúc đồ án, nếu không còn cần.
- **Spot Instance** rẻ hơn nhiều nhưng có thể bị AWS thu hồi bất cứ lúc nào: chỉ hợp để thử nghiệm, không nên dùng cho buổi demo chính.
- Có thể đặt lịch tự Stop vào buổi tối bằng **EventBridge Scheduler** hoặc **Instance Scheduler on AWS**.

## 9. Xử lý sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| Tạo máy báo `VcpuLimitExceeded` | Chưa được duyệt hạn mức GPU (bước 2) |
| `nvidia-smi` không có lệnh | Chọn sai AMI. Dùng AMI "Deep Learning … Nvidia Driver" |
| SSH báo `Permission denied (publickey)` | Sai file `.pem` hoặc sai user. AMI Ubuntu dùng user `ubuntu` |
| SSH treo, không kết nối được | IP nhà bạn đã đổi: sửa rule SSH trong security group thành My IP mới |
| Log backend ghi `fetch failed` | Tunnel chưa mở hoặc đã đóng; máy EC2 đang Stop |
| Log ghi `Ollama 401` | `OLLAMA_API_KEY` không khớp khóa trong cấu hình Nginx |
| Chậm ở câu đầu tiên | Model đang được nạp vào GPU. Đặt `OLLAMA_KEEP_ALIVE` (bước 5) |

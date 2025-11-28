# Phân Tích Rate Limits Gemini API cho Dự Án

## Rate Limits Free Tier (Gemini 2.5 Flash)

Theo tài liệu chính thức của Google:

- **RPM (Requests Per Minute)**: 10 requests/phút
- **TPM (Tokens Per Minute - Input)**: 250,000 tokens/phút
- **RPD (Requests Per Day)**: 250 requests/ngày

## Phân Tích Số Lượng Xử Lý

### Số lượng file/tháng:
- Đài DNR: 400 file
- Đài DL4: 300 × 3 = 900 file
- **Tổng: ~1,300 file/tháng**

### Số lượng file/ngày:
- 1,300 file ÷ 30 ngày = **~43 file/ngày**

### Số lượng API calls/file:
Mỗi file PDF cần:
1. **Detect broadcast code**: 1-2 calls (batch 3 trang)
2. **OCR tất cả trang**: ~2 calls (batch 15 trang, giả sử 20 trang/file)
3. **Detect signature** (nếu có): 1-2 calls

**Tổng: ~4-6 calls/file**

### Tổng số calls/ngày:
- 43 file/ngày × 5 calls/file = **~215 calls/ngày**

## Đánh Giá Khả Năng Xử Lý

### ✅ Về RPD (Requests Per Day):
- **Giới hạn**: 250 calls/ngày
- **Sử dụng**: ~215 calls/ngày
- **Kết luận**: ✅ **VẪN TRONG GIỚI HẠN** (còn dư ~35 calls/ngày)

### ⚠️ Về RPM (Requests Per Minute):
- **Giới hạn**: 10 requests/phút
- **Cần**: Ít nhất 6 giây giữa các request
- **Code đã cập nhật**: Delay 7 giây giữa các request → ✅ **AN TOÀN**

### ⚠️ Về TPM (Tokens Per Minute):
- **Giới hạn**: 250,000 tokens/phút (input)
- **Mỗi call**: ~50-100K tokens
- **Với delay 7 giây**: ~8-9 calls/phút × 75K tokens = ~600-675K tokens/phút
- **Kết luận**: ⚠️ **CÓ THỂ VƯỢT QUÁ** nếu xử lý nhiều file cùng lúc

## Khuyến Nghị

### 1. Với Free Tier (Hiện tại):
- ✅ **Có thể xử lý được** với số lượng hiện tại
- ⚠️ **Cần xử lý tuần tự** (không xử lý nhiều file cùng lúc)
- ⚠️ **Cần delay 7 giây** giữa các request (đã cập nhật trong code)
- ⚠️ **Gần giới hạn** - nếu tăng số lượng file sẽ cần upgrade

### 2. Nếu Muốn Xử Lý Nhanh Hơn:
**Upgrade lên Tier 1** (cần link billing account):
- RPM: Tăng lên (không rõ cụ thể, nhưng cao hơn Free)
- RPD: Tăng lên (không rõ cụ thể, nhưng cao hơn Free)
- **Chi phí**: Vẫn tính theo usage (~$0.01-0.02/file)

**Upgrade lên Tier 2** (cần $250+ spending):
- RPM: Cao hơn nhiều
- RPD: Cao hơn nhiều
- **Phù hợp nếu**: Cần xử lý >300 file/ngày hoặc cần xử lý song song

### 3. Tối Ưu Hóa:
- ✅ Code đã có batch processing (15 trang/batch)
- ✅ Code đã có rate limiting (7 giây delay)
- ✅ Code đã có retry logic
- 💡 Có thể tăng batch size lên 20 nếu cần (nhưng cẩn thận TPM limit)

## Chi Phí Ước Tính

### Free Tier:
- **Miễn phí** trong giới hạn 250 calls/ngày
- Nếu vượt quá → tính phí theo usage

### Sau Free Tier (nếu vượt quá):
- Input: $0.075/1M tokens
- Output: $0.30/1M tokens
- Mỗi file: ~$0.01-0.02
- **1,300 file/tháng**: ~$13-26/tháng

## Kết Luận

✅ **Có thể xử lý được** với Free Tier nếu:
- Xử lý tuần tự (1 file tại một thời điểm)
- Delay 7 giây giữa các request (đã cập nhật)
- Không vượt quá 43 file/ngày

⚠️ **Cần upgrade** nếu:
- Muốn xử lý nhanh hơn
- Cần xử lý song song nhiều file
- Số lượng file tăng lên >50 file/ngày

## Code Đã Cập Nhật

1. ✅ `services/jobQueue.ts`: Delay tăng từ 500ms → 7000ms (7 giây)
2. ✅ `services/apiUsageTracker.ts`: Cập nhật limits chính xác (250 RPD, 10 RPM)
3. ✅ Thêm monitoring cho RPM và RPD

## Cách Kiểm Tra Usage

1. Vào Google Cloud Console: https://console.cloud.google.com/
2. Chọn project → Billing → View usage
3. Hoặc vào AI Studio: https://aistudio.google.com/app/apikey
4. Xem usage và rate limit status


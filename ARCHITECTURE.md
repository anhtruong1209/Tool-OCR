# Tài Liệu Tổng Quan - Tool OCR & PDF Splitter

## 📋 Mục Đích Dự Án

Tool này tự động phân tích và tách file PDF hành chính/hàng hải Việt Nam thành các file nhỏ hơn, sau đó tự động sắp xếp vào đúng cấu trúc thư mục theo nghiệp vụ.

**Mục tiêu cuối cùng**: Các file PDF sau khi tách sẽ tự động được lưu vào đúng thư mục trong cấu trúc `DNR/PHAT MSI & SAR THANG 11-2025/...` dựa trên:
- **Broadcast Code**: MET, NAV, SAR, WX, TUYEN
- **Service Code**: NTX, RTP, EGC  
- **Document Code**: BM01, BM02, BM03, BM04, BAN TIN NGUON

---

## 🔄 Flow Xử Lý Tổng Quan

```
┌─────────────────┐
│  User Upload    │
│   PDF File      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Convert PDF    │
│  → Base64 Images│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Call Gemini    │
│  API (Batch)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Analyze Pages  │
│  (formCode,     │
│   signature,    │
│   LOG, etc.)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Split PDF      │
│  by Logic       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Save to        │
│  TEMP_EXTRACT   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  User Review    │
│  & Move Files   │
└─────────────────┘
```

---

## 📥 1. Upload File PDF

### Entry Point: `App.tsx` → `UploadArea.tsx`

**Quy trình:**
1. User chọn thư mục đích (sử dụng File System Access API)
2. User upload file PDF (kéo thả hoặc chọn file)
3. File được validate:
   - Chỉ chấp nhận PDF (`application/pdf`)
   - Kích thước tối đa: 10MB
4. File được chuyển vào Job Queue (nếu upload nhiều file)

**Code:**
```typescript
// App.tsx
const handleFileSelect = async (file: File) => {
  // Chọn thư mục đích
  const rootDirHandle = await requestDirectoryPicker();
  
  // Xử lý file
  const result = await splitPdfByKeywords(file, rootDirHandle);
}
```

---

## 🖼️ 2. Convert PDF → Base64 Images

### Service: `pdfUtils.ts` → `convertPdfToImage()`

**Quy trình:**
1. Load PDF bằng PDF.js
2. Render từng trang thành Canvas
3. Convert Canvas → Base64 JPEG
4. Trả về mảng Base64 images (1 image = 1 trang)

**Output:**
```typescript
const base64Images: string[] = [
  "data:image/jpeg;base64,/9j/4AAQ...", // Trang 1
  "data:image/jpeg;base64,/9j/4AAQ...", // Trang 2
  // ...
]
```

---

## 🤖 3. Gọi Gemini API

### Service: `geminiService.ts` → `analyzePDFComplete()`

### 3.1. Batch Processing

**Tối ưu hóa:**
- Gemini 2.5 Flash hỗ trợ ~20 images/request
- Chia PDF thành các batch (mỗi batch 15 trang)
- Gửi từng batch một cách tuần tự để tránh rate limit

**Code:**
```typescript
const BATCH_SIZE = 15;
for (let batchStart = 0; batchStart < base64Images.length; batchStart += BATCH_SIZE) {
  const batchImages = base64Images.slice(batchStart, batchStart + BATCH_SIZE);
  // Gửi batch này đến Gemini
}
```

### 3.2. Prompt Gửi Đến Gemini

**Prompt chính:**
```
Bạn là chuyên gia phân tích cấu trúc tài liệu hàng hải.
Nhiệm vụ: Xác định ĐIỂM BẮT ĐẦU và KẾT THÚC của từng biểu mẫu.

PHÂN TÍCH TỪNG TRANG:
1. formCode: CHỈ lấy từ khung "Mã số" ở góc (QT.MSI-BM.01, KTKS.MSI.TC-BM.01, ...)
2. hasPersonName: Tên người ký duyệt ở cuối trang (GIÁM ĐỐC, TRƯỞNG PHÒNG, ...)
3. isBanTinNguonHeader: Có header "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"
4. isLogPage: Trang LOG (ảnh log, email log)
5. Broadcast/Service Code: MET/NAV/SAR/WX/TUYEN, NTX/RTP/EGC
```

### 3.3. Request Format

**Input:**
```typescript
{
  model: 'gemini-2.5-flash',
  contents: {
    parts: [
      { inlineData: { mimeType: 'image/jpeg', data: base64Image1 } },
      { inlineData: { mimeType: 'image/jpeg', data: base64Image2 } },
      // ... (15 images)
      { text: prompt }
    ]
  },
  config: {
    responseMimeType: "application/json",
    temperature: 0
  }
}
```

**Output JSON:**
```json
{
  "broadcastCode": "MET" | "NAV" | "SAR" | "WX" | "TUYEN" | null,
  "serviceCode": "NTX" | "RTP" | "EGC" | null,
  "pages": [
    {
      "page": 1,
      "formCode": "QT.MSI-BM.01" | null,
      "isNewFormStart": true | false,
      "hasPersonName": true | false,
      "personName": "Nguyễn Văn A" | null,
      "personRole": "Trực ban" | null,
      "isLogPage": true | false,
      "isBanTinNguonHeader": true | false,
      "hasEmail": true | false,
      "serviceHint": "NTX" | "RTP" | "EGC" | null
    },
    // ... (cho mỗi trang)
  ]
}
```

### 3.4. Rate Limiting

**Cấu hình:**
- Delay giữa các request: 7 giây (để không vượt 10 RPM của Gemini Free Tier)
- Retry: 3 lần nếu lỗi
- Retry delay: 2 giây

**Code:**
```typescript
// jobQueue.ts
const DEFAULT_CONFIG = {
  rateLimitDelay: 7000, // 7 giây
  retryAttempts: 3,
  retryDelay: 2000
};
```

---

## ✂️ 4. Logic Tách PDF

### Service: `pdfSplitter.ts` → `splitPdfByKeywords()`

### 4.1. Quy Tắc Cắt

**1. BAN TIN NGUON:**
- **Bắt đầu**: Trang có `isBanTinNguonHeader = true` (header "CỘNG HÒA XÃ HỘI...")
- **Kết thúc**: Trang có `hasPersonName = true` (chữ ký)
- **Có thể nhiều trang**: Từ trang bắt đầu đến trang có chữ ký cuối cùng

**2. Biểu mẫu QT/KTKS:**
- **Bắt đầu**: Trang có `formCode` (mã số ở khung góc: QT.MSI-BM.01, KTKS.MSI.TC-BM.01, ...)
- **Kết thúc**: Trang có `hasPersonName = true` (chữ ký)
- **Có thể nhiều trang**: Từ trang có formCode đến trang có chữ ký cuối cùng
- **Quan trọng**: Chỉ cắt khi trang tiếp theo có formCode mới hoặc bắt đầu BAN TIN NGUON mới

**3. LOG:**
- **Định nghĩa**: Trang có `isLogPage = true` (ảnh log, email log)
- **Xử lý**: Tách riêng thành file `{filename}_LOG.pdf` hoặc `{filename}_LOGMAIL.pdf`
- **Lưu vào**: `TEMP_EXTRACT/{filename}/PDFS/` (cùng folder với documents)

### 4.2. Logic Cắt Chi Tiết

```typescript
let currentDocStartPage: number | null = null;
let currentDocType: 'BAN_TIN_NGUON' | 'BIEU_MAU' | null = null;
let currentDocFormCode: string | null = null;

for (let pageNum = 1; pageNum <= numPages; pageNum++) {
  const pageInfo = analysis.pages.find(p => p.page === pageNum);
  
  // Bỏ qua LOG
  if (pageInfo.isLogPage) continue;
  
  // Bắt đầu BAN TIN NGUON
  if (pageInfo.isBanTinNguonHeader && currentDocStartPage === null) {
    currentDocStartPage = pageNum;
    currentDocType = 'BAN_TIN_NGUON';
  }
  
  // Bắt đầu Biểu mẫu (có formCode mới)
  else if (pageInfo.formCode) {
    // Nếu đang có document → lưu document cũ trước
    if (currentDocStartPage !== null) {
      // Tìm chữ ký ở trang trước
      // Lưu document
    }
    // Bắt đầu document mới
    currentDocStartPage = pageNum;
    currentDocType = 'BIEU_MAU';
    currentDocFormCode = pageInfo.formCode;
  }
  
  // Kết thúc document (có chữ ký)
  else if (pageInfo.hasPersonName && currentDocStartPage !== null) {
    // Chỉ kết thúc nếu trang tiếp theo có formCode mới
    const nextPage = analysis.pages.find(p => p.page === pageNum + 1);
    if (nextPage?.formCode || pageNum === numPages) {
      // Lưu document
      // Reset để bắt đầu document mới
    }
    // Nếu không → tiếp tục document hiện tại
  }
}
```

### 4.3. Ví Dụ Cắt

**Input PDF (14 trang):**
- Trang 1: `formCode: "QT.MSI-BM.01"`, `hasPersonName: true` → Document 1 (trang 1)
- Trang 2: `formCode: "KTKS.MSI.TC-BM.01"`, `hasPersonName: true` → Document 2 (trang 2)
- Trang 3: `isBanTinNguonHeader: true`, `hasPersonName: true` → Bắt đầu BAN TIN NGUON
- Trang 4: `isBanTinNguonHeader: true`, `hasPersonName: true` → Tiếp tục BAN TIN NGUON → Document 3 (trang 3-4)
- Trang 5: `isLogPage: true` → LOG (tách riêng)
- Trang 6: `formCode: "QT.MSI-BM.02"`, `hasPersonName: true` → Document 4 (trang 6)
- Trang 7: `formCode: null`, `isBanTinNguonHeader: true`, `hasPersonName: true` → Tiếp tục Document 4 → Document 4 (trang 6-7)

---

## 💾 5. Lưu File

### Service: `fileSaver.ts` → `saveFilesToDirectory()`

### 5.1. Cấu Trúc Thư Mục Tạm (TEMP_EXTRACT)

```
TEMP_EXTRACT/
└── {filename}/
    ├── PDFS/
    │   ├── {filename} - QT.MSI-BM.01.pdf
    │   ├── {filename} - KTKS.MSI.TC-BM.01.pdf
    │   ├── {filename}.pdf (BAN TIN NGUON)
    │   ├── {filename}_LOG.pdf
    │   └── ...
    └── extraction-summary.json
```

**Lưu ý:**
- Không xóa folder cũ, chỉ ghi đè file (tránh InvalidStateError)
- Tất cả file (documents + LOG) đều lưu vào `PDFS/`
- JSON summary chứa metadata để routing sau này

### 5.2. Extraction Summary JSON

```json
{
  "originalFileName": "4029-2025-VIS-BBD.pdf",
  "broadcastCode": "MET",
  "serviceCode": "RTP",
  "generatedAt": "2025-12-05T02:27:49.729Z",
  "documents": [
    {
      "id": "4nimevxkl",
      "filename": "4029-2025-VIS-BBD - QT.MSI-BM.01.pdf",
      "code": "QT.MSI-BM.01",
      "startPage": 1,
      "endPage": 1,
      "pageCount": 1,
      "recommendedPath": "COVER/COVER/MET"
    },
    // ...
  ],
  "logs": [
    {
      "filename": "4029-2025-VIS-BBD_LOG.pdf",
      "page": 5,
      "recommendedPath": "TEMP_EXTRACT/4029-2025-VIS-BBD/PDFS"
    }
  ],
  "analysis": {
    // Raw Gemini response (để debug)
  }
}
```

### 5.3. Routing Logic (recommendedPath)

**Hàm: `getFolderPath(code, broadcastCode, serviceCode)`**

**Quy tắc:**

1. **BM01 (QT.01):**
   ```
   COVER/COVER/{broadcastCode}/
   ```

2. **KTKS01:**
   ```
   COVER/KTKSTC BM 01/{broadcastCode}/
   ```

3. **BM02 (QT.02):**
   - NTX/RTP: `DICH VU {serviceCode}/BAN TIN NGUON DA DUOC XU LY/BAN TIN NGUON DA DUOC XU LY/{broadcastCode}/`
   - EGC: `DICH VU EGC/BAN TIN NGUON DA DUOC XU LY EGC/{broadcastCode}/`

4. **KTKS02:**
   - NTX/RTP: `DICH VU {serviceCode}/BAN TIN NGUON DA DUOC XU LY/KTKSTC BAN TIN NGUON DA DUOC XU LY/{broadcastCode}/`
   - EGC: `DICH VU EGC/KTKS TAI CHO BAN TIN NGUON XU LY EGC/{broadcastCode}/`

5. **BM03 (QT.03):**
   ```
   DICH VU {serviceCode}/BAN TIN XU LY PHAT/BAN TIN XU LY TRUOC KHI PHAT/{broadcastCode}/
   ```

6. **KTKS03:**
   ```
   DICH VU {serviceCode}/BAN TIN XU LY PHAT/KTKSTC BAN TIN XU LY TRUOC KHI PHAT/{broadcastCode}/
   ```

7. **BM04 (QT.04):**
   ```
   DICH VU {serviceCode}/KIEM TRA KIEM SOAT SAU PHAT/{broadcastCode}/
   ```

8. **BAN TIN NGUON:**
   ```
   BAN TIN NGUON/{broadcastCode}/
   ```

9. **LOG:**
   ```
   LOG FTP/{broadcastCode}/
   ```

---

## 🎯 6. Mục Đích Cuối Cùng: Tự Động Sắp Xếp File

### 6.1. Workflow Hiện Tại

1. **Upload PDF** → Tách và lưu vào `TEMP_EXTRACT/`
2. **User Review** → Xem file trong `TEMP_EXTRACT/{filename}/PDFS/`
3. **Move Files** → (Chưa implement) Nút "Xếp vào folder" sẽ:
   - Đọc `extraction-summary.json`
   - Di chuyển file từ `TEMP_EXTRACT/` → `DNR/PHAT MSI & SAR THANG 11-2025/{recommendedPath}/`

### 6.2. Cấu Trúc Thư Mục Đích

```
DNR/
└── PHAT MSI & SAR THANG 11-2025/
    ├── BAN TIN NGUON/
    │   ├── MET/
    │   ├── NAV/
    │   └── ...
    ├── COVER/
    │   ├── COVER/
    │   │   ├── MET/
    │   │   └── ...
    │   └── KTKSTC BM 01/
    │       ├── MET/
    │       └── ...
    ├── DICH VU NTX/
    │   ├── BAN TIN NGUON DA DUOC XU LY/
    │   │   ├── BAN TIN NGUON DA DUOC XU LY/
    │   │   │   ├── MET/
    │   │   │   └── ...
    │   │   └── KTKSTC BAN TIN NGUON DA DUOC XU LY/
    │   │       ├── MET/
    │   │       └── ...
    │   ├── BAN TIN XU LY PHAT/
    │   │   ├── BAN TIN XU LY TRUOC KHI PHAT/
    │   │   │   ├── MET/
    │   │   │   └── ...
    │   │   └── KTKSTC BAN TIN XU LY TRUOC KHI PHAT/
    │   │       ├── MET/
    │   │       └── ...
    │   └── KIEM TRA KIEM SOAT SAU PHAT/
    │       ├── MET/
    │       └── ...
    ├── DICH VU RTP/
    │   └── (cấu trúc tương tự NTX)
    ├── DICH VU EGC/
    │   └── (cấu trúc riêng)
    └── LOG FTP/
        ├── MET/
        ├── NAV/
        └── ...
```

---

## 🔧 7. Các Service Chính

### 7.1. `pdfUtils.ts`
- `convertPdfToImage()`: Convert PDF → Base64 images

### 7.2. `geminiService.ts`
- `analyzePDFComplete()`: Gọi Gemini API, phân tích tất cả trang
- Batch processing để tối ưu số lượng request

### 7.3. `pdfSplitter.ts`
- `splitPdfByKeywords()`: Logic tách PDF dựa trên kết quả Gemini
- Tạo các file PDF nhỏ từ file gốc
- Xác định `recommendedPath` cho mỗi document

### 7.4. `fileSaver.ts`
- `saveFilesToDirectory()`: Lưu file vào thư mục (File System Access API)
- Xử lý retry khi gặp InvalidStateError
- Tự động tạo folder nếu chưa có

### 7.5. `jobQueue.ts`
- Quản lý queue xử lý nhiều file
- Rate limiting (7 giây delay giữa các request)
- Retry logic (3 lần)

---

## 📊 8. Data Flow

```
User Upload PDF
    ↓
PDF → Base64 Images (pdfUtils)
    ↓
Base64 Images → Gemini API (geminiService)
    ↓
Gemini Response → PDFAnalysisResult
    ↓
PDFAnalysisResult → Split Logic (pdfSplitter)
    ↓
Split Documents → PDF Files + Metadata
    ↓
Files + Metadata → TEMP_EXTRACT (fileSaver)
    ↓
extraction-summary.json (chứa recommendedPath)
    ↓
[PENDING] User Click "Move to Folder"
    ↓
Files → DNR/.../{recommendedPath}/ (fileSaver)
```

---

## 🎨 9. UI Components

### 9.1. `App.tsx`
- Main entry point
- Quản lý state (status, docType, directory handle)
- Xử lý upload và routing

### 9.2. `UploadArea.tsx`
- Drag & drop upload
- Validate file (PDF only, max 10MB)

### 9.3. `JobQueueViewer.tsx`
- Hiển thị danh sách job đang xử lý
- Progress bar, status, retry count

### 9.4. `SplitterViewer.tsx`
- Hiển thị kết quả tách file
- Danh sách documents, logs
- [PENDING] Nút "Xếp vào folder"

---

## 🚀 10. Tối Ưu Hóa

### 10.1. API Calls
- **Batch processing**: 15 trang/batch thay vì 1 trang/request
- **Rate limiting**: 7 giây delay giữa các batch
- **Single comprehensive prompt**: 1 prompt cho tất cả nhiệm vụ (không tách riêng)

### 10.2. File System
- **Bundled PDF.js worker**: Không phụ thuộc CDN (hoạt động offline)
- **File System Access API**: Lưu trực tiếp, không cần download ZIP
- **Retry logic**: Xử lý InvalidStateError tự động

### 10.3. Memory
- **Streaming**: Xử lý từng batch, không load toàn bộ PDF vào memory
- **Preview**: Chỉ hiển thị trang đầu cho splitter mode

---

## 📝 11. Error Handling

### 11.1. Gemini API Errors
- Retry 3 lần với delay 2 giây
- Log error và tiếp tục batch tiếp theo
- Return empty result cho batch lỗi

### 11.2. File System Errors
- InvalidStateError: Retry với fresh directory handle
- Permission denied: Hiển thị thông báo yêu cầu quyền
- File too large: Validate trước khi upload

### 11.3. PDF Processing Errors
- PDF.js errors: Fallback và log
- Missing pages: Skip và tiếp tục

---

## 🔮 12. Tính Năng Sắp Tới

### 12.1. Nút "Xếp vào Folder"
- Đọc `extraction-summary.json`
- Di chuyển file từ `TEMP_EXTRACT/` → `DNR/.../{recommendedPath}/`
- Sử dụng `recommendedPath` từ JSON để routing

### 12.2. Cải Thiện Logic Cắt
- Xử lý edge cases (nhiều trang không có formCode)
- Merge documents liên tiếp có cùng code
- Xử lý LOG pages chính xác hơn

---

## 📚 13. Tài Liệu Tham Khảo

- **PDF.js**: https://mozilla.github.io/pdf.js/
- **PDF-LIB**: https://pdf-lib.js.org/
- **Google Gemini API**: https://ai.google.dev/
- **File System Access API**: https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API

---

## 🎯 Tóm Tắt

**Input**: File PDF hành chính/hàng hải  
**Process**: 
1. Convert → Base64 images
2. Gọi Gemini API (batch) để phân tích
3. Tách PDF dựa trên logic (formCode + signature)
4. Lưu vào TEMP_EXTRACT

**Output**: 
- Các file PDF đã tách trong `TEMP_EXTRACT/{filename}/PDFS/`
- `extraction-summary.json` chứa metadata và `recommendedPath`

**Mục đích cuối**: User review → Click "Xếp vào folder" → Files tự động nhảy vào đúng thư mục trong `DNR/.../`


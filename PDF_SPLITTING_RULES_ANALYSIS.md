# PHÂN TÍCH VÀ QUY TẮC CẮT PDF CHUẨN

## PHÂN TÍCH CÁC FILE PDF MẪU

### 1. CẤU TRÚC CHUNG CỦA FILE PDF

Mỗi file PDF thường có cấu trúc như sau:

```
1. QT.MSI-BM.01 (1 trang) - Cover
2. KTKS.MSI.TC-BM.01 (1-3 trang) - Cover KTKS
3. Bản tin nguồn (SOURCE_HEADER + CONTENT, 2-3 trang)
4. LOG_SCREEN (1 trang) - Trang log
5. RTP Section:
   - QT.MSI-BM.02 (2-3 trang)
   - KTKS.MSI.TC-BM.02 (1 trang)
   - QT.MSI-BM.03 (2-3 trang)
   - KTKS.MSI.TC-BM.03 (1 trang)
   - QT.MSI-BM.04 (1 trang) - Có thể có 2 lần với service khác nhau
6. NTX Section:
   - QT.MSI-BM.02 (2-3 trang)
   - KTKS.MSI.TC-BM.02 (1 trang)
   - QT.MSI-BM.03 (2-3 trang)
   - KTKS.MSI.TC-BM.03 (1 trang)
   - QT.MSI-BM.04 (1 trang) - Có thể có 2 lần với service khác nhau
```

### 2. CÁC VẤN ĐỀ PHÁT HIỆN

#### Vấn đề 1: QT.MSI-BM.03 bao gồm KTKS.MSI.TC-BM.03
- **File 4029**: QT.MSI-BM.03 NTX (trang 17-20) nhưng trang 20 là KTKS.MSI.TC-BM.03
- **File 3897**: QT.MSI-BM.03 NTX (trang 20-24) nhưng trang 24 là KTKS.MSI.TC-BM.03
- **Nguyên nhân**: Logic cắt không đúng khi gặp formCode mới

#### Vấn đề 2: Thiếu QT.MSI-BM.04 cho NTX
- **File 4029**: Có QT.MSI-BM.04 RTP (trang 12) nhưng thiếu QT.MSI-BM.04 NTX (trang 21)
- **File 3897**: Có QT.MSI-BM.04 RTP (trang 14, 15) nhưng thiếu QT.MSI-BM.04 NTX (trang 25)
- **Nguyên nhân**: Logic không cắt khi cùng formCode nhưng service khác

#### Vấn đề 3: SOURCE_HEADER không được detect đúng
- **File 2195**: Trang 8 là SOURCE_HEADER nhưng lại nằm trong document QT.MSI-BM.02
- **Nguyên nhân**: SOURCE_HEADER có thể xuất hiện ở giữa document, không chỉ ở đầu

#### Vấn đề 4: Bản tin nguồn xoay ngang không được detect
- **File 2195**: Có bản tin nguồn xoay ngang không được detect
- **Nguyên nhân**: Prompt không đủ mạnh để detect SOURCE_HEADER xoay ngang

### 3. QUY TẮC CẮT PDF CHUẨN

#### QUY TẮC 1: CẮT KHI GẶP FORMCODE MỚI
```
Nếu trang hiện tại có formCode và formCode khác với document hiện tại:
  → CẮT NGAY TRƯỚC trang này
  → Bắt đầu document mới với formCode mới
```

**Ví dụ:**
- Document hiện tại: QT.MSI-BM.03 (trang 17-19)
- Trang 20: KTKS.MSI.TC-BM.03
- → Cắt document QT.MSI-BM.03 tại trang 19
- → Bắt đầu document mới KTKS.MSI.TC-BM.03 từ trang 20

#### QUY TẮC 2: CẮT KHI CÙNG FORMCODE NHƯNG SERVICE KHÁC (CHO QT.MSI-BM.04)
```
Nếu trang hiện tại có formCode QT.MSI-BM.04 và:
  - Document hiện tại cũng có formCode QT.MSI-BM.04
  - Nhưng service khác (RTP vs NTX)
  → CẮT NGAY TRƯỚC trang này
  → Bắt đầu document mới với cùng formCode nhưng service khác
```

**Ví dụ:**
- Document hiện tại: QT.MSI-BM.04 RTP (trang 12)
- Trang 21: QT.MSI-BM.04 NTX
- → Cắt document QT.MSI-BM.04 RTP tại trang 12
- → Bắt đầu document mới QT.MSI-BM.04 NTX từ trang 21

#### QUY TẮC 3: CẮT KHI GẶP SOURCE_HEADER
```
Nếu trang hiện tại là SOURCE_HEADER:
  → CẮT NGAY TRƯỚC trang này (nếu document hiện tại có formCode)
  → Bắt đầu document mới "Bản tin nguồn" từ trang SOURCE_HEADER
```

**Ví dụ:**
- Document hiện tại: QT.MSI-BM.02 (trang 6-7)
- Trang 8: SOURCE_HEADER
- → Cắt document QT.MSI-BM.02 tại trang 7
- → Bắt đầu document mới "Bản tin nguồn" từ trang 8

#### QUY TẮC 4: CẮT KHI GẶP LOG_SCREEN
```
Nếu trang hiện tại là LOG_SCREEN:
  → CẮT NGAY TRƯỚC trang này
  → Không bao gồm LOG_SCREEN vào document nào
  → Lưu LOG_SCREEN thành file riêng
```

#### QUY TẮC 5: MỖI DOCUMENT CHỈ CÓ 1 FORMCODE DUY NHẤT
```
Validation sau khi push trang vào document:
  → Kiểm tra tất cả các trang trong document
  → Nếu phát hiện formCode khác → CẮT NGAY
  → Đảm bảo mỗi document chỉ có 1 formCode
```

### 4. LOGIC CẮT CHUẨN (PSEUDOCODE)

```javascript
for (pageNum = 1; pageNum <= numPages; pageNum++) {
  const pageInfo = analysis.pages.find(p => p.page === pageNum);
  const formCode = pageInfo?.formCode || null;
  const pageType = pageInfo?.type;
  const pageService = getServiceFromPage(pageInfo);
  
  // QUY TẮC 1: Kiểm tra formCode TRƯỚC KHI push
  if (currentDocPages.length > 0 && currentDocFormCode) {
    // Nếu formCode khác → CẮT NGAY
    if (formCode && formCode !== currentDocFormCode) {
      flushDoc();
      startNewDoc(formCode, pageService);
    }
    // Nếu cùng formCode QT.MSI-BM.04 nhưng service khác → CẮT NGAY
    else if (formCode === currentDocFormCode && 
             formCode.includes('BM.04') &&
             pageService && currentDocService &&
             pageService !== currentDocService) {
      flushDoc();
      startNewDoc(formCode, pageService);
    }
  }
  
  // QUY TẮC 3: Kiểm tra SOURCE_HEADER
  if (pageType === 'SOURCE_HEADER' && currentDocFormCode) {
    flushDoc();
    startNewDoc(null, null); // Bản tin nguồn không có formCode
  }
  
  // QUY TẮC 4: Kiểm tra LOG_SCREEN
  if (pageType === 'LOG_SCREEN') {
    saveAsLog(pageNum);
    continue; // Không push vào document
  }
  
  // Push trang vào document
  currentDocPages.push(pageNum);
  
  // QUY TẮC 5: Validation sau khi push
  validateDocument(); // Kiểm tra không có formCode khác trong document
}
```

### 5. CẢI THIỆN PROMPT CHO SOURCE_HEADER

```
SOURCE_HEADER: Trang đầu tiên của bản tin nguồn
- Có header "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM" hoặc "Cộng hòa xã hội chủ nghĩa Việt Nam"
- QUAN TRỌNG: Trang có thể XOAY NGANG (landscape orientation)
- Có thể có Tên tiếng Anh ở đầu (ví dụ: "MARINE WEATHER FORECAST", "NATIONAL CENTER FOR HYDRO-METEOROLOGICAL FORECASTING")
- Có thể có bảng dự báo thời tiết biển
- KHÔNG có formCode (không có khung "Mã số" ở góc)
- Có thể có tiêu đề bản tin, ngày tháng, địa danh
→ formCode = null, isBanTinNguonHeader = true
```

### 6. THỨ TỰ ƯU TIÊN KIỂM TRA

```
1. Kiểm tra formCode TRƯỚC KHI push trang vào document (QUAN TRỌNG NHẤT)
2. Kiểm tra SOURCE_HEADER
3. Kiểm tra LOG_SCREEN
4. Kiểm tra breakpoint (FORM_HEADER, service change, etc.)
5. Push trang vào document
6. Validation sau khi push (lớp bảo vệ cuối cùng)
```

### 7. CÁC TRƯỜNG HỢP ĐẶC BIỆT

#### Trường hợp 1: QT.MSI-BM.04 xuất hiện 2 lần
- Lần 1: QT.MSI-BM.04 RTP (ví dụ: trang 12)
- Lần 2: QT.MSI-BM.04 NTX (ví dụ: trang 21)
- → Phải tạo 2 document riêng biệt

#### Trường hợp 2: SOURCE_HEADER xuất hiện giữa document
- Document hiện tại: QT.MSI-BM.02 (trang 6-7)
- Trang 8: SOURCE_HEADER
- → Phải cắt document QT.MSI-BM.02 tại trang 7
- → Bắt đầu document mới "Bản tin nguồn" từ trang 8

#### Trường hợp 3: Bản tin nguồn xoay ngang
- Trang có thể xoay ngang (landscape)
- Vẫn phải detect được SOURCE_HEADER
- Cần cải thiện prompt để detect được

### 8. KẾT LUẬN

**QUY TẮC CHUẨN NHẤT:**
1. **CẮT NGAY KHI GẶP FORMCODE MỚI** - Đây là quy tắc quan trọng nhất
2. **CẮT NGAY KHI CÙNG FORMCODE QT.MSI-BM.04 NHƯNG SERVICE KHÁC**
3. **CẮT NGAY KHI GẶP SOURCE_HEADER** (nếu document hiện tại có formCode)
4. **KHÔNG BAO GỒM LOG_SCREEN** vào document nào
5. **VALIDATION SAU KHI PUSH** để đảm bảo mỗi document chỉ có 1 formCode

**THỨ TỰ XỬ LÝ:**
1. Kiểm tra formCode TRƯỚC KHI push
2. Kiểm tra SOURCE_HEADER
3. Kiểm tra LOG_SCREEN
4. Push trang vào document
5. Validation sau khi push


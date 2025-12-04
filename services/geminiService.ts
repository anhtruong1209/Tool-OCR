
import { GoogleGenAI, Type, Schema } from "@google/genai";
import {
  InvoiceData,
  IncidentReportData,
  DocumentType,
  BroadcastAndServiceCode,
  PageCodeResult,
  BanTinNguonKeywords
} from '../types';

// --- BAN TIN NGUON KEYWORDS CONFIG ---
export const BAN_TIN_NGUON_KEYWORDS: BanTinNguonKeywords = {
  codePatterns: ['TTNH', 'ĐBQG', 'DBQG', '04H00'],
  textPatterns: [
    'Cộng hòa xã hội chủ nghĩa Việt Nam',
    'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
    'Cộng hoà xã hội chủ nghĩa Việt Nam', // Alternative spelling
  ]
};

// --- INVOICE SCHEMA ---
const invoiceSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    invoiceSymbol: { type: Type.STRING, description: "Ký hiệu hóa đơn (VD: 1K25TKH)" },
    invoiceNo: { type: Type.STRING, description: "Số hóa đơn (VD: 00025602)" },
    date: { type: Type.STRING, description: "Ngày lập hóa đơn (VD: 21/11/2025)" },

    sellerName: { type: Type.STRING, description: "Tên đơn vị bán hàng" },
    sellerTaxCode: { type: Type.STRING, description: "Mã số thuế bên bán" },
    sellerAddress: { type: Type.STRING, description: "Địa chỉ bên bán" },
    sellerPhoneNumber: { type: Type.STRING, description: "Số điện thoại bên bán" },
    sellerBankAccount: { type: Type.STRING, description: "Số tài khoản ngân hàng của đơn vị bán hàng (nếu có)" },

    buyerCustomerId: { type: Type.STRING, description: "Mã khách hàng (Mã KH)" },
    billingPeriod: { type: Type.STRING, description: "Kỳ cước (Tháng/Năm)" },
    buyerName: { type: Type.STRING, description: "Họ tên người mua hàng" },
    buyerCompanyName: { type: Type.STRING, description: "Tên đơn vị (Company Name) người mua" },
    buyerTaxCode: { type: Type.STRING, description: "Mã số thuế bên mua" },
    buyerBudgetCode: { type: Type.STRING, description: "Mã ĐVQHNS (Đơn vị quan hệ ngân sách)" },
    buyerPersonalId: { type: Type.STRING, description: "Số định danh cá nhân (CCCD/CMND)" },
    buyerPassportNo: { type: Type.STRING, description: "Số hộ chiếu (Passport No)" },
    buyerAddress: { type: Type.STRING, description: "Địa chỉ bên mua" },
    buyerBankAccount: { type: Type.STRING, description: "Số tài khoản bên mua (Account No)" },
    paymentMethod: { type: Type.STRING, description: "Hình thức thanh toán" },

    items: {
      type: Type.ARRAY,
      description: "Chi tiết danh sách hàng hóa dịch vụ",
      items: {
        type: Type.OBJECT,
        properties: {
          no: { type: Type.STRING, description: "STT (Số thứ tự)" },
          description: { type: Type.STRING, description: "Tên hàng hóa, dịch vụ" },
          unit: { type: Type.STRING, description: "Đơn vị tính (VD: Tàu, Chiếc, Bộ, Gói...)" },
          quantity: { type: Type.NUMBER, description: "Số lượng" },
          unitPrice: { type: Type.NUMBER, description: "Đơn giá" },
          amount: { type: Type.NUMBER, description: "Thành tiền" },
        },
        required: ["description", "amount"]
      }
    },

    totalAmount: { type: Type.NUMBER, description: "Cộng tiền hàng (Chưa thuế)" },
    vatRate: { type: Type.STRING, description: "Thuế suất GTGT (VD: 8%, 10%)" },
    vatAmount: { type: Type.NUMBER, description: "Tiền thuế GTGT" },
    totalPayment: { type: Type.NUMBER, description: "Tổng tiền thanh toán (Đã có thuế)" },
    amountInWords: { type: Type.STRING, description: "Số tiền viết bằng chữ" },

    signedBy: { type: Type.STRING, description: "Tên tổ chức/cá nhân ký điện tử (Sau chữ 'Ký bởi')" },
    signedDate: { type: Type.STRING, description: "Ngày giờ ký điện tử (Sau chữ 'Ký ngày')" },

    lookupWebsite: { type: Type.STRING, description: "Website tra cứu hóa đơn" },
    lookupCode: { type: Type.STRING, description: "Mã tra cứu hóa đơn" },

    summary: { type: Type.STRING, description: "Kiểm tra tính hợp lệ" },
  },
  required: ["items", "totalPayment"],
};

// --- INCIDENT REPORT SCHEMA ---
const incidentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    reportTitle: { type: Type.STRING, description: "Tiêu đề báo cáo (VD: BÁO CÁO XỬ LÝ SỐ 1)" },
    stationName: { type: Type.STRING, description: "Tên đài/đơn vị xử lý (VD: Đài TTDH Đà Nẵng)" },
    date: { type: Type.STRING, description: "Ngày tháng lập báo cáo" },
    vesselName: { type: Type.STRING, description: "Tên phương tiện/tàu (VD: TÀU CÁ QNa 91892 TS)" },
    nationality: { type: Type.STRING, description: "Quốc tịch tàu" },
    incidentType: { type: Type.STRING, description: "Tình trạng sự cố (VD: 01 người bị thương nặng...)" },
    coordinates: { type: Type.STRING, description: "Vị trí/Tọa độ (VD: 13°35'N 112°47'E)" },
    frequencyInfo: { type: Type.STRING, description: "Thông tin tần số (VD: 7903 kHz)" },

    processingTable: {
      type: Type.ARRAY,
      description: "Bảng Xử lý độc lập. Trích xuất NGUYÊN VĂN những gì thấy trong từng ô.",
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING, description: "Hạng mục chính (VD: Phát báo nhận, Liên lạc trực tiếp...)" },
          subCategory: { type: Type.STRING, description: "Phân loại con (VD: Cấp cứu)" },
          dsc: { type: Type.STRING, description: "Cột DSC (trả về 'X' hoặc chuỗi số lượt)" },
          nbdp: { type: Type.STRING, description: "Cột NBDP" },
          rtp: { type: Type.STRING, description: "Cột RTP" },
          navtex: { type: Type.STRING, description: "Cột NAVTEX" },
          inmarsat: { type: Type.STRING, description: "Cột INMARSAT" },
          other: { type: Type.STRING, description: "Cột KHÁC" },
        }
      }
    },

    actionLogs: {
      type: Type.ARRAY,
      description: "Chi tiết hành động xử lý (Nhật ký).",
      items: {
        type: Type.OBJECT,
        properties: {
          time: { type: Type.STRING, description: "Thời gian (Giờ:Phút)" },
          content: { type: Type.STRING, description: "Nội dung xử lý chi tiết" }
        }
      }
    },

    coordinationInfo: { type: Type.STRING, description: "Thông tin TRONG BẢNG 'Xử lý phối hợp' ở cuối trang 1. KHÔNG lấy đoạn văn mở đầu." },
    proposal: { type: Type.STRING, description: "Đề xuất xử lý (viết tay)" },

    attachedDocuments: {
      type: Type.ARRAY,
      description: "Bảng 'Tài liệu kèm theo' (thường ở trang 2)",
      items: {
        type: Type.OBJECT,
        properties: {
          recipient: { type: Type.STRING, description: "Nơi nhận" },
          purpose: { type: Type.STRING, description: "Mục đích (báo cáo)" },
          methodFax: { type: Type.BOOLEAN, description: "Có tích vào ô TRÁI không?" },
          methodEmail: { type: Type.BOOLEAN, description: "Có tích vào ô PHẢI không?" },
          time: { type: Type.STRING, description: "Thời gian" },
          sender: { type: Type.STRING, description: "Người gửi" }
        }
      }
    },

    verificationReport: {
      type: Type.ARRAY,
      description: "Bảng Transmission Verification Report",
      items: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING },
          time: { type: Type.STRING },
          duration: { type: Type.STRING },
          result: { type: Type.STRING }
        }
      }
    },

    sarReport: {
      type: Type.OBJECT,
      description: "Thông tin từ Trang 3: THÔNG TIN TÌM KIẾM CỨU NẠN TRÊN BIỂN",
      properties: {
        headerTitle: { type: Type.STRING, description: "Tiêu đề đơn vị (Góc trái trên)" },
        refNumber: { type: Type.STRING, description: "Số công văn (Số: 85/02...)" },
        dateLocation: { type: Type.STRING, description: "Địa danh, ngày giờ (Đà Nẵng...)" },
        recipient: { type: Type.STRING, description: "Kính gửi: ..." },
        intro: { type: Type.STRING, description: "Đoạn mở đầu (Hồi 16 giờ...)" },
        content: { type: Type.STRING, description: "1. Nội dung: (Lấy toàn bộ text)" },
        measures: { type: Type.STRING, description: "2. Biện pháp xử lý: (Lấy toàn bộ text)" },
        proposal: { type: Type.STRING, description: "3. Đề nghị: (Lấy toàn bộ text)" },
        attachedFiles: { type: Type.STRING, description: "4. Tài liệu kèm theo: (Lấy toàn bộ text)" },
        signerLeft: { type: Type.STRING, description: "Người ký trái (TRỰC BAN)" },
        signerRight: { type: Type.STRING, description: "Người ký phải (KT. GIÁM ĐỐC)" },
        signerNameRight: { type: Type.STRING, description: "Tên người ký phải" },
      }
    }
  }
};


export const analyzeDocument = async (base64Images: string[], type: DocumentType): Promise<any> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key chưa được cấu hình.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const isInvoice = type === 'INVOICE';
  const model = 'gemini-2.5-flash';

  const systemPrompt = isInvoice
    ? `Bạn là trợ lý AI chuyên xử lý hóa đơn kế toán cho công ty Vishipel.
       Nhiệm vụ: Trích xuất dữ liệu JSON chính xác từ ảnh Hóa đơn GTGT.`
    : `Bạn là chuyên gia thông tin hàng hải (MRCC/Vishipel). Nhiệm vụ: Trích xuất dữ liệu từ "Báo cáo xử lý/sự cố" (nhiều trang).
       
       --- LOGIC XỬ LÝ BẢNG MA TRẬN "XỬ LÝ ĐỘC LẬP" (Trang 1) ---
       Nguyên tắc: Quét từng ô. Trích xuất DỮ LIỆU THỰC TẾ, không suy diễn.
       
       1. **Nhận diện HÀNG (Row Type):**
          - Hàng "Phát báo nhận": Thường chứa CHECKBOX. Chỉ trả về "X" nếu thấy tích.
          - Hàng "Phát truyền tiếp": Thường chứa CHECKBOX hoặc Text.
          - Hàng "Phát quảng bá" (Cấp cứu/Khẩn cấp...): Thường chứa SỐ LƯỢT.
          - Hàng "Liên lạc trực tiếp...": Thường chứa SỐ LƯỢT.
       
       2. **Quy tắc trích xuất (Extraction Rule):**
          - Nếu thấy **DẤU TÍCH** (✔, X, x) -> Trả về "X".
          - Nếu thấy **VĂN BẢN/SỐ** (VD: "4 lượt", "10 lượt", "1 lượt", "4", "02") -> **BẮT BUỘC** trả về nguyên văn chuỗi đó (VD: "4 lượt").
          - Nếu thấy **GẠCH NGANG** (-) hoặc ô trống -> Trả về null.
       
       --- LOGIC PHẦN "XỬ LÝ PHỐI HỢP" (Trang 1) ---
       - CHÚ Ý: Có một đoạn văn mở đầu ở đầu bảng: "Trung tâm Phối hợp tìm kiếm cứu nạn... đã tiến hành xử lý...".
       - **CẤM** lấy đoạn văn đó đưa vào trường 'coordinationInfo'.
       - CHỈ lấy nội dung nằm trong khung bảng "XỬ LÝ PHỐI HỢP" ở cuối trang 1.
       
       --- LOGIC BẢNG "TÀI LIỆU KÈM THEO" (Trang 2) ---
       - Cột "Phương thức" có 2 ô vuông: [Trái] [Phải].
       - Quy ước: [Trái] = Fax, [Phải] = Email.
       - Nhìn kỹ vị trí dấu tích để set true/false cho methodFax và methodEmail.
       
       --- LOGIC TRANG 3 (THÔNG TIN TÌM KIẾM CỨU NẠN TRÊN BIỂN) ---
       - Nếu thấy trang có tiêu đề "THÔNG TIN TÌM KIẾM CỨU NẠN TRÊN BIỂN":
       - Trích xuất đầy đủ các mục 1 (Nội dung), 2 (Biện pháp), 3 (Đề nghị), 4 (Tài liệu).
       - Lấy tên người ký ở góc phải dưới cùng.`;

  // Prepare contents with multiple images
  const contentParts = base64Images.map(img => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data: img,
    },
  }));

  contentParts.push({
    text: systemPrompt,
  } as any);

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: contentParts,
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: isInvoice ? invoiceSchema : incidentSchema,
        temperature: 0,
      },
    });

    const jsonText = response.text;
    if (!jsonText) {
      throw new Error("Gemini không trả về dữ liệu.");
    }

    const data = JSON.parse(jsonText);
    return { ...data, type: type }; // Append type marker

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

// Deprecated wrapper for backward compatibility
export const analyzeInvoice = async (base64Image: string): Promise<InvoiceData> => {
  return analyzeDocument([base64Image], 'INVOICE');
};

// ============================================
// PDF SPLITTING AI FUNCTIONS
// ============================================

/**
 * Detect broadcast code (MET, NAV, SAR, WX, TUYEN) and service code (NTX, RTP, EGC)
 * from "Mã bản tin đài xử lý" in PDF pages
 * 
 * @param base64Images - Array of base64 encoded images
 * @param maxPages - Maximum number of pages to check (default: all pages)
 * @returns Object with broadcastCode and serviceCode
 */
export const detectBroadcastAndServiceCode = async (
  base64Images: string[],
  maxPages?: number
): Promise<BroadcastAndServiceCode> => {
  if (!process.env.API_KEY) {
    console.warn('[Gemini Service] API Key not configured, skipping broadcast/service code detection');
    return { broadcastCode: null, serviceCode: null };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-2.5-flash';

  let detectedBroadcastCode: 'MET' | 'NAV' | 'SAR' | 'WX' | 'TUYEN' | null = null;
  let detectedServiceCode: 'NTX' | 'RTP' | 'EGC' | null = null;

  // Check pages in batches of 3 until we find both codes or run out of pages
  const batchSize = 3;
  const totalPages = maxPages ? Math.min(maxPages, base64Images.length) : base64Images.length;
  let startPage = 0;

  while (startPage < totalPages && (!detectedBroadcastCode || !detectedServiceCode)) {
    const endPage = Math.min(startPage + batchSize, totalPages);
    const imagesToCheck = base64Images.slice(startPage, endPage);

    if (imagesToCheck.length === 0) break;

    console.log(`[Gemini Service] Checking pages ${startPage + 1}-${endPage} for broadcast/service code...`);

    const prompt = `Bạn là trợ lý AI chuyên đọc tài liệu PDF.

Nhiệm vụ: Tìm "Mã bản tin đài xử lý" trong các trang được cung cấp.

Tìm "Mã bản tin đài xử lý" và trích xuất:
- Broadcast code: MET, NAV, SAR, WX, TUYEN (chỉ một trong các mã này)
- Service code: NTX, RTP, EGC (nếu có)

Ví dụ:
- "4710/2025/DNR-MET-RTP" → broadcastCode: "MET", serviceCode: "RTP"
- "DNR-NAV-NTX" → broadcastCode: "NAV", serviceCode: "NTX"
- "SAR" → broadcastCode: "SAR", serviceCode: null

Trả về JSON:
{
  "broadcastCode": "MET" hoặc "NAV" hoặc "SAR" hoặc "WX" hoặc "TUYEN" hoặc null,
  "serviceCode": "NTX" hoặc "RTP" hoặc "EGC" hoặc null
}

CHỈ trả về JSON, không có text giải thích nào khác.`;

    try {
      const contentParts = imagesToCheck.map(img => ({
        inlineData: {
          mimeType: 'image/jpeg',
          data: img,
        },
      }));
      contentParts.push({ text: prompt } as any);

      const response = await ai.models.generateContent({
        model: model,
        contents: {
          parts: contentParts,
        },
        config: {
          temperature: 0,
          responseMimeType: "application/json",
        },
      });

      const jsonText = response.text?.trim();
      if (jsonText) {
        try {
          let jsonStr = jsonText;
          const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonStr = jsonMatch[0];
          }
          const result = JSON.parse(jsonStr);

          // Only update if we haven't found it yet
          if (!detectedBroadcastCode && result.broadcastCode) {
            const broadcastCode = result.broadcastCode?.toUpperCase();
            if (broadcastCode && ['MET', 'NAV', 'SAR', 'WX', 'TUYEN'].includes(broadcastCode)) {
              detectedBroadcastCode = broadcastCode as 'MET' | 'NAV' | 'SAR' | 'WX' | 'TUYEN';
            }
          }

          if (!detectedServiceCode && result.serviceCode) {
            const serviceCode = result.serviceCode?.toUpperCase();
            if (serviceCode && ['NTX', 'RTP', 'EGC'].includes(serviceCode)) {
              detectedServiceCode = serviceCode as 'NTX' | 'RTP' | 'EGC';
            }
          }

          // If we found both codes, we can stop
          if (detectedBroadcastCode && detectedServiceCode) {
            console.log(`[Gemini Service] Found both codes on pages ${startPage + 1}-${endPage}`);
            break;
          }

          // Log progress
          if (detectedBroadcastCode && !detectedServiceCode) {
            console.log(`[Gemini Service] Found broadcast code (${detectedBroadcastCode}) but still looking for service code...`);
          } else if (!detectedBroadcastCode && detectedServiceCode) {
            console.log(`[Gemini Service] Found service code (${detectedServiceCode}) but still looking for broadcast code...`);
          }
        } catch (e) {
          console.warn(`[Gemini Service] Failed to parse broadcast code detection:`, jsonText);
        }
      }
    } catch (error) {
      console.warn(`[Gemini Service] Error detecting broadcast code on pages ${startPage + 1}-${endPage}:`, error);
    }

    // Move to next batch
    startPage = endPage;
  }

  console.log(`[Gemini Service] Detected broadcast code: ${detectedBroadcastCode}, service code: ${detectedServiceCode}`);
  return { broadcastCode: detectedBroadcastCode, serviceCode: detectedServiceCode };
};

/**
 * Extract document codes (Mã số/Số) from all pages using OCR
 * 
 * @param base64Images - Array of base64 encoded images
 * @param keywords - Keywords to search for (e.g. ["Mã số", "Số"])
 * @returns Array of page code results
 */
export const extractDocumentCodes = async (
  base64Images: string[],
  keywords: string[]
): Promise<PageCodeResult[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key chưa được cấu hình.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-2.5-flash';

  // Helper to extract code from text
  const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const extractCodeFromText = (text: string, keywords: string[]): string | null => {
    if (!text) return null;
    for (const kw of keywords) {
      if (!kw) continue;
      const trimmedKw = kw.trim();
      if (!trimmedKw) continue;
      const regex = new RegExp(`${escapeRegex(trimmedKw)}\\s*[:.]?\\s*([a-zA-Z0-9_\\-\\./]+)`, 'i');
      const match = text.match(regex);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  // Gemini 2.5 Flash supports up to ~20 images per request, so we'll batch them
  const BATCH_SIZE = 15; // Conservative batch size
  const results: PageCodeResult[] = [];

  // Process in batches
  for (let batchStart = 0; batchStart < base64Images.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, base64Images.length);
    const batchImages = base64Images.slice(batchStart, batchEnd);
    const batchPageNumbers = Array.from({ length: batchEnd - batchStart }, (_, i) => batchStart + i + 1);

    console.log(`[Gemini Service] OCRing batch: pages ${batchPageNumbers[0]}-${batchPageNumbers[batchPageNumbers.length - 1]} (${batchImages.length} pages)`);

    const prompt = `Bạn là trợ lý AI chuyên đọc và trích xuất thông tin từ tài liệu PDF.

Nhiệm vụ: Tìm và trích xuất giá trị của các nhãn sau trong TẤT CẢ các trang được cung cấp: ${keywords.map(k => `"${k}"`).join(', ')}.

Ví dụ: Nếu bạn thấy "Mã số: QT.MSI-BM.01" hoặc "Số: TTNH-04h00/ĐBQG" ở trang 1, hãy trả về phần mã ở sau nhãn đó cho trang tương ứng.

Quy tắc:
1. Duyệt qua TẤT CẢ các hình ảnh (mỗi hình là 1 trang PDF)
2. Tìm các nhãn: ${keywords.map(k => `"${k}"`).join(', ')} trong mỗi trang (không phân biệt hoa/thường)
3. Trích xuất giá trị ngay sau nhãn (có thể có dấu hai chấm, khoảng trắng, hoặc không)
4. Giá trị thường là mã code như: QT.MSI-BM.01, KTKS.MSI-XX.02, TTNH-04H00/DBQG, v.v.
5. Chỉ trả về MÃ CODE, không trả về nhãn
6. Nếu không tìm thấy ở trang nào, trả về "null" cho trang đó

Trả về dưới dạng JSON array, mỗi phần tử là một object:
[
  { "page": 1, "code": "QT.MSI-BM.01" },
  { "page": 2, "code": "null" },
  { "page": 3, "code": "QT.MSI-BM.02" },
  ...
]

CHỈ trả về JSON array, không có text giải thích nào khác.`;

    try {
      // Prepare content parts: all images + prompt
      const contentParts = batchImages.map(img => ({
        inlineData: {
          mimeType: 'image/jpeg',
          data: img,
        },
      }));
      contentParts.push({ text: prompt } as any);

      const response = await ai.models.generateContent({
        model: model,
        contents: {
          parts: contentParts,
        },
        config: {
          temperature: 0,
          responseMimeType: "application/json",
        },
      });

      const jsonText = response.text?.trim();
      if (!jsonText) {
        console.warn(`[Gemini Service] No response from OCR batch ${batchStart + 1}-${batchEnd}`);
        // Fill with nulls for this batch
        batchPageNumbers.forEach(pageNum => {
          results.push({ page: pageNum, code: null });
        });
        continue;
      }

      // Parse JSON response
      let batchResults: Array<{ page: number; code: string | null }>;
      try {
        // Try to extract JSON from response (in case there's extra text)
        let jsonStr = jsonText;
        const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
        batchResults = JSON.parse(jsonStr);

        // Ensure it's an array
        if (!Array.isArray(batchResults)) {
          throw new Error('Response is not an array');
        }
      } catch (parseError) {
        console.error(`[Gemini Service] Failed to parse OCR response:`, jsonText);
        console.error(`[Gemini Service] Parse error:`, parseError);
        // Fill with nulls for this batch
        batchPageNumbers.forEach(pageNum => {
          results.push({ page: pageNum, code: null });
        });
        continue;
      }

      // Process results - map to actual page numbers in batch
      batchPageNumbers.forEach((actualPageNum, idx) => {
        const item = batchResults[idx] || batchResults.find(r => r.page === actualPageNum) || batchResults.find(r => r.page === idx + 1);
        let code = item?.code;

        if (!code || typeof code !== 'string' || code.toLowerCase() === 'null' || code.toLowerCase() === 'không tìm thấy') {
          results.push({ page: actualPageNum, code: null });
          return;
        }

        code = code.replace(/^["']|["']$/g, '').trim();
        const extracted = extractCodeFromText(code, keywords);
        results.push({ page: actualPageNum, code: extracted || code || null });
      });

    } catch (error) {
      console.error(`[Gemini Service] OCR error on batch ${batchStart + 1}-${batchEnd}:`, error);
      // Fill with nulls for this batch on error
      batchPageNumbers.forEach(pageNum => {
        results.push({ page: pageNum, code: null });
      });
    }
  }

  // Sort by page number
  results.sort((a, b) => a.page - b.page);

  return results;
};

/**
 * Detect if page has signature (chữ ký)
 * 
 * @param base64 - Base64 encoded image
 * @returns True if page has signature
 */
export const detectSignatureOnPage = async (base64: string): Promise<boolean> => {
  if (!process.env.API_KEY) {
    return false;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-2.5-flash';

    const prompt = `Bạn là trợ lý AI chuyên phân tích hình ảnh PDF.

Nhiệm vụ: Xác định xem trang này có chữ ký (signature) hay không.

Chữ ký thường có:
- Tên người ký (ví dụ: "Vũ Anh Tuấn", "Phạm Phương Chi")
- Chức danh (ví dụ: "P. TRƯỞNG PHÒNG", "TRƯỞNG PHÒNG DỰ BÁO")
- Có thể có chữ ký viết tay hoặc chữ ký điện tử
- Thường ở phần dưới của trang

Nếu trang có chữ ký, trả về:
{
  "hasSignature": true
}

Nếu KHÔNG có chữ ký, trả về:
{
  "hasSignature": false
}

CHỈ trả về JSON, không có text giải thích nào khác.`;

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64,
            },
          },
          { text: prompt } as any,
        ],
      },
      config: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    });

    const jsonText = response.text?.trim();
    if (!jsonText) return false;

    const result = JSON.parse(jsonText);
    return result.hasSignature === true;
  } catch (error) {
    console.warn('[Gemini Service] AI signature detection failed:', error);
    return false;
  }
};

/**
 * Detect if page is BAN TIN NGUON using extensible keywords
 * 
 * @param base64 - Base64 encoded image
 * @param code - Optional document code to check
 * @returns True if page is BAN TIN NGUON
 */
export const detectBanTinNguon = async (base64: string, code?: string): Promise<boolean> => {
  // Method 1: Code-based detection
  if (code) {
    const codeUpper = code.toUpperCase();
    for (const pattern of BAN_TIN_NGUON_KEYWORDS.codePatterns) {
      if (codeUpper.includes(pattern)) {
        console.log(`[Gemini Service] BAN TIN NGUON detected by code pattern: ${pattern}`);
        return true;
      }
    }
  }

  // Method 2: Text-based detection using AI
  if (!process.env.API_KEY) {
    return false;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-2.5-flash';

    const keywordList = BAN_TIN_NGUON_KEYWORDS.textPatterns.map(k => `"${k}"`).join(', ');
    const prompt = `Bạn là trợ lý AI chuyên đọc tài liệu PDF.

Nhiệm vụ: Kiểm tra xem trang này có chứa BẤT KỲ keyword nào sau đây không:
${keywordList}

Nếu tìm thấy BẤT KỲ keyword nào, trả về:
{
  "isBanTinNguon": true,
  "foundKeyword": "keyword tìm thấy"
}

Nếu KHÔNG tìm thấy, trả về:
{
  "isBanTinNguon": false
}

CHỈ trả về JSON, không có text giải thích nào khác.`;

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64,
            },
          },
          { text: prompt } as any,
        ],
      },
      config: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    });

    const jsonText = response.text?.trim();
    if (!jsonText) return false;

    const result = JSON.parse(jsonText);
    if (result.isBanTinNguon === true) {
      console.log(`[Gemini Service] BAN TIN NGUON detected by text pattern: ${result.foundKeyword || 'unknown'}`);
      return true;
    }
    return false;
  } catch (error) {
    console.warn('[Gemini Service] BAN TIN NGUON detection failed:', error);
    return false;
  }
};

/**
 * Detect if page is log-only page (has image but no signature)
 * 
 * @param base64 - Base64 encoded image
 * @returns True if page is log-only
 */
export const detectLogPage = async (base64: string): Promise<boolean> => {
  // Check if page has signature
  const hasSignature = await detectSignatureOnPage(base64);

  // If has signature, it's not a log-only page (keep it in main document)
  if (hasSignature) {
    return false;
  }

  // Check if page has significant content (likely an image/log)
  // This is a heuristic check - if page has content but no signature, it's likely a log
  if (!process.env.API_KEY) {
    return false;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-2.5-flash';

    const prompt = `Bạn là trợ lý AI chuyên phân tích hình ảnh PDF.

Nhiệm vụ: Xác định xem trang này có phải là trang LOG (chỉ chứa ảnh/biểu đồ, không có text quan trọng) hay không.

Trang LOG thường:
- Chứa ảnh lớn (screenshot, biểu đồ, log hệ thống)
- Không có text quan trọng (chỉ có tiêu đề đơn giản hoặc timestamp)
- Không có chữ ký
- Không có form/bảng biểu

Nếu là trang LOG, trả về:
{
  "isLogPage": true
}

Nếu KHÔNG phải trang LOG (có text quan trọng, form, bảng biểu), trả về:
{
  "isLogPage": false
}

CHỈ trả về JSON, không có text giải thích nào khác.`;

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64,
            },
          },
          { text: prompt } as any,
        ],
      },
      config: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    });

    const jsonText = response.text?.trim();
    if (!jsonText) return false;

    const result = JSON.parse(jsonText);
    return result.isLogPage === true;
  } catch (error) {
    console.warn('[Gemini Service] Log page detection failed:', error);
    return false;
  }
};


// Import GoogleGenAI - sử dụng namespace import để tránh lỗi tree-shaking
import * as genai from "@google/genai";
const GoogleGenAI = genai.GoogleGenAI;

// Type constants - định nghĩa local vì có thể không được export từ @google/genai trong build
const Type = {
  OBJECT: 'object' as const,
  STRING: 'string' as const,
  NUMBER: 'number' as const,
  ARRAY: 'array' as const,
  BOOLEAN: 'boolean' as const
};

// Schema type definition
type Schema = {
  type: string;
  properties?: Record<string, Schema | { type: string; description?: string }>;
  items?: Schema;
  description?: string;
  required?: string[];
};
import {
  InvoiceData,
  IncidentReportData,
  DocumentType,
  BroadcastAndServiceCode,
  PageCodeResult,
  BanTinNguonKeywords,
  PDFAnalysisResult,
  PageAnalysis
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

Nhiệm vụ: Xác định xem trang này có TÊN NGƯỜI hay không.

Tên người thường xuất hiện ở:
- Phần chữ ký: "Vũ Anh Tuấn", "Nguyễn Xuân Hiến", "Phạm Thị Châm"
- Phần soát tin: "Soát tin: Trần Như Quỳnh"
- Phần dự báo viên: "Dự báo viên: Phạm Thị Châm"
- Chức danh kèm tên: "KT. GIÁM ĐỐC / Nguyễn Xuân Hiến"
- Phần ký tên: "P. TRƯỞNG PHÒNG / Vũ Anh Tuấn"

**Đặc điểm tên người Việt Nam:**
- Có 2-4 từ
- Chữ cái đầu viết hoa
- Ví dụ: "Vũ Anh Tuấn", "Trần Như Quỳnh", "Nguyễn Xuân Hiến", "Phạm Thị Châm", vv

**QUAN TRỌNG:** Chỉ cần tìm thấy TÊN NGƯỜI (không cần chữ ký viết tay) là trả về true.

Nếu trang có TÊN NGƯỜI, trả về:
{
  "hasSignature": true
}

Nếu KHÔNG có TÊN NGƯỜI, trả về:
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

/**
 * OPTIMIZED: Analyze entire PDF in single/few API calls
 * Combines all detection: broadcast code, service code, document codes, person names, LOG pages
 * 
 * @param base64Images - Array of base64 encoded images
 * @returns Complete PDF analysis with all information
 */
export const analyzePDFComplete = async (
  base64Images: string[]
): Promise<PDFAnalysisResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key chưa được cấu hình.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-2.5-flash';

  // Tối ưu: Tìm LOG page trước, sau đó chia thành 2 batch
  // Batch 1: Từ đầu đến LOG (bao gồm cả LOG) - để lấy QT.01, KTKS.01, BAN TIN NGUON, LOG
  // Batch 2: Từ sau LOG đến hết - để lấy tất cả các biểu mẫu còn lại
  
  // Bước 1: Phân tích batch đầu tiên (1-10 trang) để tìm LOG
  const PREVIEW_SIZE = Math.min(6, base64Images.length);
  const previewImages = base64Images.slice(0, PREVIEW_SIZE);
  let logPageIndex = -1; // Index trong mảng (0-based)
  
  console.log(`[Gemini Service] Preview: Analyzing pages 1-${PREVIEW_SIZE} to find LOG page...`);
  
  const previewPrompt = `Bạn là chuyên gia phân tích cấu trúc tài liệu hàng hải. Nhiệm vụ: Tìm trang LOG đầu tiên.

PHÂN TÍCH TỪNG TRANG:
- isLogPage: true nếu trang là LOG (chụp màn hình, bảng log, email in, không có formCode, không có tiêu đề biểu mẫu).
- Trang LOG thường có: ảnh chụp màn hình, bảng log, email, không có "Mã số" ở góc.

OUTPUT JSON FORMAT (Chỉ trả về JSON):
{
  "pages": [
    {
      "page": 1,
      "isLogPage": true | false
    },
    ...
  ]
}`;

  const previewContentParts: any[] = previewImages.map(img => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data: img,
    },
  }));
  previewContentParts.push({ text: previewPrompt });

  try {
    const previewResponse = await ai.models.generateContent({
      model: model,
      contents: {
        parts: previewContentParts,
      },
      config: {
        responseMimeType: "application/json",
        temperature: 0,
      },
    });

    const previewJsonText = previewResponse.text?.trim();
    if (previewJsonText) {
      const previewResult = JSON.parse(previewJsonText);
      // Tìm LOG page đầu tiên
      for (const page of previewResult.pages || []) {
        if (page.isLogPage === true) {
          logPageIndex = page.page - 1; // Convert to 0-based index
          console.log(`[Gemini Service] Found LOG at page ${page.page} (index ${logPageIndex})`);
          break;
        }
      }
    }
  } catch (error) {
    console.warn('[Gemini Service] Preview analysis failed, will use default split:', error);
  }

  const allBatchResults: PDFAnalysisResult[] = [];

  // Prompt template cho các batch (schema mới) - ĐƯỢC TỐI ƯU ĐỂ ĐẢM BẢO KẾT QUẢ NHẤT QUÁN
  const promptTemplate = `Bạn là chuyên gia phân tích cấu trúc tài liệu hàng hải. Nhiệm vụ: Phân loại CHÍNH XÁC MỖI TRANG theo quy tắc CỐ ĐỊNH.

QUY TẮC PHÂN LOẠI (ÁP DỤNG THEO THỨ TỰ ƯU TIÊN):
1. FORM_HEADER: Trang có khung "Mã số" hoặc "Code" ở góc trên phải/bên phải, chứa mã như:
   - QT.MSI-BM.01, QT.MSI-BM.02, QT.MSI-BM.03, QT.MSI-BM.04
   - KTKS.MSI.TC-BM.01, KTKS.MSI.TC-BM.02, KTKS.MSI.TC-BM.03
   → formCode BẮT BUỘC phải có giá trị (không được null)
   - Sau QT.MSI-BM.02, QT.MSI-BM.03 là tương ứng KTKS.MSI.TC-BM.02, KTKS.MSI.TC-BM.03 ( lưu ý kiểm tra mã số tránh trường hợp 1 file cắt bao gồm cả QT và KTKS)
   
2. LOG_SCREEN: Trang chứa ảnh chụp màn hình (Total Commander, FileZilla, email client, hoặc bất kỳ giao diện phần mềm nào)
   - Đặc điểm: Chủ yếu là ảnh, không có text quan trọng, không có formCode
   - Có thể có email address, file path, hoặc timestamp
   → formCode BẮT BUỘC = null, isLogPage = true
   
3. SOURCE_HEADER: Trang đầu tiên của bản tin nguồn, có header "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM" hoặc tương tự
   - KHÔNG có formCode (không có khung "Mã số" ở góc)
   - Có thể có tiêu đề bản tin, ngày tháng, địa danh
   → formCode = null, isBanTinNguonHeader = true
   
4. CONTENT: Tất cả các trang còn lại (nội dung tiếp theo của biểu mẫu hoặc bản tin)
   → formCode = null (trừ khi có khung "Mã số" thì chuyển thành FORM_HEADER)

QUY TẮC TRÍCH XUẤT formCode (QUAN TRỌNG - PHẢI TUÂN THỦ):
- CHỈ lấy từ khung "Mã số" hoặc "Code" ở góc trên phải/bên phải
- Phải trích xuất CHÍNH XÁC, không thêm bớt ký tự
- Các mã phổ biến: QT.MSI-BM.01, QT.MSI-BM.02, QT.MSI-BM.03, QT.MSI-BM.04, KTKS.MSI.TC-BM.01, KTKS.MSI.TC-BM.02, KTKS.MSI.TC-BM.03
- QUAN TRỌNG: Mỗi trang có khung "Mã số" PHẢI được đánh dấu là FORM_HEADER và có formCode
- Nếu KHÔNG thấy khung "Mã số" → formCode = null
- LƯU Ý: Một document có thể có nhiều trang, nhưng CHỈ trang đầu có formCode. Các trang tiếp theo (CONTENT) không có formCode.
- QUAN TRỌNG: Nếu thấy trang có khung "Mã số" với mã KHÁC với mã ở trang trước → đó là trang đầu của document MỚI, PHẢI đánh dấu là FORM_HEADER

QUY TẮC XÁC ĐỊNH LOG_SCREEN (QUAN TRỌNG):
- Trang LOG thường xuất hiện SAU SOURCE_HEADER (bản tin nguồn)
- Đặc điểm: Ảnh chụp màn hình, không có formCode, không có text quan trọng
- Có thể có: email address, file path, timestamp, giao diện phần mềm
- isLogPage = true CHỈ khi type = LOG_SCREEN

QUY TẮC XÁC ĐỊNH SERVICE (serviceHint):
- Tìm trong "Mã bản tin Đài xử lý" hoặc text trên trang
- NTX: Nếu thấy "NAVTEX" hoặc "NTX" trong mã đài
- RTP: Nếu thấy "RTP" trong mã đài
- EGC: Nếu thấy "EGC" trong mã đài
- null: Nếu không tìm thấy

YÊU CẦU TRÍCH XUẤT (CHO MỖI TRANG):
- page: số trang (1-based)
- type: FORM_HEADER | LOG_SCREEN | SOURCE_HEADER | CONTENT (chọn 1, không được để trống)
- formCode: Mã số từ khung góc (chính xác, không thêm bớt) hoặc null
- serviceHint: NTX | RTP | EGC | NAVTEX | null
- broadcastCode: MET | NAV | SAR | WX | TUYEN | null
- hasSignature: true nếu có chữ ký/tên người ở cuối trang (phần ký duyệt)
- isLogPage: true CHỈ khi type = LOG_SCREEN, false cho tất cả các type khác
- isBanTinNguonHeader: true CHỈ khi type = SOURCE_HEADER, false cho tất cả các type khác
- hasEmail: true nếu trang LOG có địa chỉ email

QUY TẮC VALIDATION (KIỂM TRA TRƯỚC KHI TRẢ VỀ):
- FORM_HEADER → formCode KHÔNG được null
- LOG_SCREEN → formCode PHẢI null, isLogPage PHẢI true
- SOURCE_HEADER → formCode PHẢI null, isBanTinNguonHeader PHẢI true
- CONTENT → formCode PHẢI null

OUTPUT JSON (CHỈ JSON, KHÔNG CÓ TEXT GIẢI THÍCH):
{
  "broadcastCode": "MET"|"NAV"|"SAR"|"WX"|"TUYEN"|null,
  "serviceCode": "NTX"|"RTP"|"EGC"|null,
  "pages": [
    {
      "page": 1,
      "type": "FORM_HEADER" | "LOG_SCREEN" | "SOURCE_HEADER" | "CONTENT",
      "formCode": "QT.MSI-BM.01" | "QT.MSI-BM.02" | "QT.MSI-BM.03" | "QT.MSI-BM.04" | "KTKS.MSI.TC-BM.01" | "KTKS.MSI.TC-BM.02" | "KTKS.MSI.TC-BM.03" | null,
      "serviceHint": "NTX" | "RTP" | "EGC" | "NAVTEX" | null,
      "broadcastCode": "MET" | "NAV" | "SAR" | "WX" | "TUYEN" | null,
      "hasSignature": true | false,
      "isLogPage": true | false,
      "isBanTinNguonHeader": true | false,
      "hasEmail": true | false
    }
  ]
}`;

  // Chia đúng 2 batch bằng nửa file
  const splitIndex = Math.ceil(base64Images.length / 2);
  const batches = [
    { start: 0, end: splitIndex },
    { start: splitIndex, end: base64Images.length }
  ];

  for (let i = 0; i < batches.length; i++) {
    const { start, end } = batches[i];
    const images = base64Images.slice(start, end);
    if (images.length === 0) continue;

    const startPageNum = start + 1;
    const prompt = promptTemplate.replace(/"page": 1/g, `"page": ${startPageNum}`);

    console.log(`[Gemini Service] Analyzing batch ${i + 1}: pages ${startPageNum}-${startPageNum + images.length - 1} (${images.length} pages)`);

    const contentParts: any[] = images.map(img => ({
      inlineData: {
        mimeType: 'image/jpeg',
        data: img,
      },
    }));
    contentParts.push({ text: prompt });

    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: {
          parts: contentParts,
        },
        config: {
          responseMimeType: "application/json",
          temperature: 0,
        },
      });

      const jsonText = response.text?.trim();
      if (!jsonText) {
        console.error(`[Gemini Service] No response for batch ${i + 1}`);
        allBatchResults.push({
          broadcastCode: null,
          serviceCode: null,
          pages: images.map((_, idx) => ({
            page: startPageNum + idx,
            code: null,
            hasPersonName: false,
            isLogPage: false
          }))
        });
      } else {
        let batchResult: PDFAnalysisResult;
        try {
          batchResult = JSON.parse(jsonText);
          
          // VALIDATION: Kiểm tra tính hợp lệ của kết quả
          const validationErrors: string[] = [];
          
          if (!batchResult.pages || !Array.isArray(batchResult.pages)) {
            validationErrors.push('Missing or invalid pages array');
          } else {
            // Validate từng trang
            batchResult.pages.forEach((p, idx) => {
              const pageNum = p.page || (startPageNum + idx);
              
              // Validation rule 1: FORM_HEADER phải có formCode
              if (p.type === 'FORM_HEADER' && !p.formCode) {
                validationErrors.push(`Page ${pageNum}: FORM_HEADER must have formCode`);
              }
              
              // Validation rule 2: LOG_SCREEN phải có formCode = null và isLogPage = true
              if (p.type === 'LOG_SCREEN') {
                if (p.formCode !== null) {
                  validationErrors.push(`Page ${pageNum}: LOG_SCREEN must have formCode = null`);
                }
                if (p.isLogPage !== true) {
                  validationErrors.push(`Page ${pageNum}: LOG_SCREEN must have isLogPage = true`);
                }
              }
              
              // Validation rule 3: SOURCE_HEADER phải có formCode = null và isBanTinNguonHeader = true
              if (p.type === 'SOURCE_HEADER') {
                if (p.formCode !== null) {
                  validationErrors.push(`Page ${pageNum}: SOURCE_HEADER must have formCode = null`);
                }
                if (p.isBanTinNguonHeader !== true) {
                  validationErrors.push(`Page ${pageNum}: SOURCE_HEADER must have isBanTinNguonHeader = true`);
                }
              }
              
              // Validation rule 4: isLogPage chỉ true khi type = LOG_SCREEN
              if (p.isLogPage === true && p.type !== 'LOG_SCREEN') {
                validationErrors.push(`Page ${pageNum}: isLogPage = true but type is not LOG_SCREEN`);
              }
              
              // Validation rule 5: isBanTinNguonHeader chỉ true khi type = SOURCE_HEADER
              if (p.isBanTinNguonHeader === true && p.type !== 'SOURCE_HEADER') {
                validationErrors.push(`Page ${pageNum}: isBanTinNguonHeader = true but type is not SOURCE_HEADER`);
              }
            });
          }
          
          if (validationErrors.length > 0) {
            console.warn(`[Gemini Service] Validation errors for batch ${i + 1}:`, validationErrors);
            // Vẫn sử dụng kết quả nhưng log warning
            // Có thể thêm retry logic ở đây nếu cần
          }
          
          const adjustedPages = batchResult.pages.map(p => ({
            ...p,
            page: (p.page || 1) + start
          }));
          allBatchResults.push({
            broadcastCode: batchResult.broadcastCode,
            serviceCode: batchResult.serviceCode,
            pages: adjustedPages
          });
        } catch (parseError) {
          console.error(`[Gemini Service] JSON parse error for batch ${i + 1}:`, jsonText);
          allBatchResults.push({
            broadcastCode: null,
            serviceCode: null,
            pages: images.map((_, idx) => ({
              page: startPageNum + idx,
              code: null,
              hasPersonName: false,
              isLogPage: false
            }))
          });
        }
      }
    } catch (error) {
      console.error(`[Gemini Service] Error analyzing batch ${i + 1}:`, error);
      allBatchResults.push({
        broadcastCode: null,
        serviceCode: null,
        pages: images.map((_, idx) => ({
          page: startPageNum + idx,
          code: null,
          hasPersonName: false,
          isLogPage: false
        }))
      });
    }
  }

  // Merge results from all batches
  let finalBroadcastCode: 'MET' | 'NAV' | 'SAR' | 'WX' | 'TUYEN' | null = null;
  let finalServiceCode: 'NTX' | 'RTP' | 'EGC' | null = null;
  const allPages: PageAnalysis[] = [];

  for (const batchResult of allBatchResults) {
    if (!finalBroadcastCode && batchResult.broadcastCode) {
      finalBroadcastCode = batchResult.broadcastCode;
    }
    if (!finalServiceCode && batchResult.serviceCode) {
      finalServiceCode = batchResult.serviceCode;
    }
    allPages.push(...batchResult.pages);
  }

  console.log(`[Gemini Service] Analysis complete: ${allPages.length} pages, broadcast: ${finalBroadcastCode}, service: ${finalServiceCode}`);

  // FINAL VALIDATION: Kiểm tra toàn bộ kết quả và đảm bảo LOG được xử lý đúng
  const logPages = allPages.filter(p => p.isLogPage || p.type === 'LOG_SCREEN');
  const sourceHeaders = allPages.filter(p => p.isBanTinNguonHeader || p.type === 'SOURCE_HEADER');
  
  console.log(`[Gemini Service] Validation summary:`);
  console.log(`  - Total pages: ${allPages.length}`);
  console.log(`  - LOG pages found: ${logPages.length} (pages: ${logPages.map(p => p.page).join(', ')})`);
  console.log(`  - SOURCE_HEADER pages found: ${sourceHeaders.length} (pages: ${sourceHeaders.map(p => p.page).join(', ')})`);
  console.log(`  - FORM_HEADER pages found: ${allPages.filter(p => p.type === 'FORM_HEADER' && p.formCode).length}`);
  
  // Validation: LOG thường xuất hiện sau SOURCE_HEADER
  if (logPages.length > 0 && sourceHeaders.length > 0) {
    const firstLogPage = Math.min(...logPages.map(p => p.page));
    const lastSourceHeader = Math.max(...sourceHeaders.map(p => p.page));
    if (firstLogPage < lastSourceHeader) {
      console.warn(`[Gemini Service] Warning: LOG page (${firstLogPage}) appears before last SOURCE_HEADER (${lastSourceHeader})`);
    }
  }

  return {
    broadcastCode: finalBroadcastCode,
    serviceCode: finalServiceCode,
    pages: allPages
  };
};

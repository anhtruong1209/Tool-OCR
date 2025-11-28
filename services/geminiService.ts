
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { InvoiceData, IncidentReportData, DocumentType } from '../types';

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

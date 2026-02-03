import { GoogleGenAI, Type, Schema } from "@google/genai";
import { FormDetectionResult, PageFormInfo } from "../types";

/**
 * Cấu hình schema cho AI (Package @google/genai)
 */
const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        pages: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    page: { type: Type.NUMBER },
                    formCode: { type: Type.STRING, nullable: true },
                    isFormHeader: { type: Type.BOOLEAN },
                    isBanTinNguon: { type: Type.BOOLEAN },
                    isLogPage: { type: Type.BOOLEAN },
                    pageType: { type: Type.STRING, enum: ["KTKS", "BM", "BANTINNGUON", "LOG"] },
                    serviceType: { type: Type.STRING, enum: ["RTP", "EGC", "NTX", "OTHER"], nullable: true },
                    subType: { type: Type.STRING, enum: ["MET", "NAV", "SAR", "TUYEN", "WX"], nullable: true },
                    broadcastCode: { type: Type.STRING, nullable: true },
                    serviceHint: { type: Type.STRING, nullable: true },
                    type: { type: Type.STRING }
                },
                required: ["page", "formCode", "isFormHeader", "isBanTinNguon", "isLogPage", "pageType", "serviceType", "subType", "type"]
            }
        }
    },
    required: ["pages"]
};

export const detectFormCodes = async (
    base64Images: string[]
): Promise<FormDetectionResult> => {
    const apiKey = (process.env as any).API_KEY || (process.env as any).GEMINI_API_KEY || "";

    if (!apiKey) {
        throw new Error("GEMINI_API_KEY chưa được cấu hình (Kiểm tra .env và vite.config.ts)");
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelVersion = "gemini-2.5-flash";

    const prompt = `Bạn là chuyên gia phân tích tài liệu nghiệp vụ hàng hải tại Vishipel.
NHIỆM VỤ: Phân loại TẤT CẢ các trang vào 4 nhóm: KTKS, BM, BANTINNGUON, LOG.

QUY TẮC PHÂN LOẠI TRANG (pageType) - ƯU TIÊN THEO THỨ TỰ:
1. **KTKS**: Nếu trang có khung "Mã số:" hoặc "Code:" và nội dung mã chứa chữ "KTKS" (VD: KTKS.MSI.TC-BM.01).
2. **BM**: Nếu trang có khung "Mã số:" hoặc "Code:" và mã bắt đầu bằng "QT" hoặc chứa "BM" nhưng KHÔNG chứa "KTKS" (VD: QT.MSI-BM.02).
3. **BANTINNGUON**: Nếu trang KHÔNG có mã số biểu mẫu ở trên, nhưng có Quốc hiệu "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM" và nội dung là bản tin tin cậy (Source Message).
4. **LOG**: Nếu trang KHÔNG có mã số, KHÔNG có quốc hiệu, nhưng nội dung là các bảng nhật ký, màn hình in (Log table, DSC, Inmarsat, MET, NAV log).

QUY TẮC CHI FILE (isFormHeader):
- **isFormHeader = true** khi xuất hiện một mã số mới (BM/KTKS).
- **isFormHeader = true** khi BẮT ĐẦU một bản tin nguồn mới (BANTINNGUON) - Trang có quốc hiệu.
- **isFormHeader = true** khi BẮT ĐẦU một bảng nhật ký mới (LOG).

THUỘC TÍNH BỔ SUNG:
- **type**: FORM_HEADER (nếu có mã mới), CONTENT (trang nội dung), SOURCE_HEADER (bắt đầu bản tin nguồn), LOG_SCREEN (trang nhật ký).
- **broadcastCode**: Mã bản tin (VD: MSI, SAR, WX).
- **serviceHint**: Gợi ý dịch vụ (VD: NAVTEX, INMARSAT, RTP).
- **subType**: Lấy từ "Mã bản tin đài xử lý". 
  - KHÔNG lấy từ tiêu đề chung nếu tiêu đề chứa nhiều loại (VD: "Phát MSI và SAR" -> KHÔNG tự ý lấy SAR).
  - CHỈ lấy nếu thấy chữ viết tắt cụ thể trong các ô mã (VD: BIENS, WX, MET, NAV, SAR). Nếu mập mờ, hãy tìm kiếm các trang khác để xác định.

OUTPUT: Trả về JSON theo schema.`;

    try {
        console.log(`[Gemini Scanner] Analyzing ${base64Images.length} pages with ${modelVersion}...`);

        const contentParts = base64Images.map(img => ({
            inlineData: {
                mimeType: 'image/jpeg',
                data: img,
            },
        }));
        contentParts.push({ text: prompt } as any);

        const response = await ai.models.generateContent({
            model: modelVersion,
            contents: {
                parts: contentParts,
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0,
            },
        });

        const jsonText = response.text?.trim();
        if (!jsonText) throw new Error("AI không trả về kết quả.");

        const result = JSON.parse(jsonText);

        const pages: PageFormInfo[] = [];
        for (let i = 0; i < base64Images.length; i++) {
            const pageData = result.pages.find((p: any) => p.page === i + 1) || {
                page: i + 1,
                formCode: null,
                isFormHeader: false,
                isBanTinNguon: false,
                isLogPage: false,
                pageType: 'BM',
                serviceType: 'OTHER',
                subType: null
            };

            pages.push({
                page: i + 1,
                formCode: pageData.formCode,
                isFormHeader: !!pageData.isFormHeader,
                isBanTinNguon: !!pageData.isBanTinNguon || pageData.pageType === 'BANTINNGUON', // Đảm bảo đồng bộ
                isLogPage: !!pageData.isLogPage || pageData.pageType === 'LOG',
                pageType: pageData.pageType,
                serviceType: pageData.serviceType,
                subType: pageData.subType,
                broadcastCode: pageData.broadcastCode,
                serviceHint: pageData.serviceHint,
                type: pageData.type || 'CONTENT'
            });
        }

        return {
            type: 'DETECT_FORM',
            totalPages: base64Images.length,
            pages: pages,
        };
    } catch (error: any) {
        console.error("[Form Detection] Error:", error);
        throw new Error("Lỗi Gemini: " + (error.message || "Unknown error"));
    }
};

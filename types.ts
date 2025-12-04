
export type DocumentType = 'INVOICE' | 'INCIDENT' | 'SPLIT';

// --- INVOICE TYPES ---
export interface InvoiceItem {
  no: string | null;          // STT
  description: string;        // Tên hàng hóa, dịch vụ
  unit: string | null;        // Đơn vị tính (Tàu, Chiếc...)
  quantity: number | null;    // Số lượng
  unitPrice: number | null;   // Đơn giá
  amount: number | null;      // Thành tiền
}

export interface InvoiceData {
  type: 'INVOICE';
  // Thông tin chung
  invoiceSymbol: string | null;
  invoiceNo: string | null;
  date: string | null;

  // Người bán
  sellerName: string | null;
  sellerTaxCode: string | null;
  sellerAddress: string | null;
  sellerPhoneNumber: string | null;
  sellerBankAccount: string | null;

  // Người mua
  buyerCustomerId: string | null;
  billingPeriod: string | null;
  buyerName: string | null;
  buyerCompanyName: string | null;
  buyerTaxCode: string | null;
  buyerBudgetCode: string | null;
  buyerPersonalId: string | null;
  buyerPassportNo: string | null;
  buyerAddress: string | null;
  buyerBankAccount: string | null;
  paymentMethod: string | null;

  // Chi tiết
  items: InvoiceItem[];

  // Tổng cộng
  totalAmount: number | null;
  vatRate: string | null;
  vatAmount: number | null;
  totalPayment: number | null;
  amountInWords: string | null;

  // Chữ ký điện tử
  signedBy: string | null;
  signedDate: string | null;

  // Tra cứu
  lookupWebsite: string | null;
  lookupCode: string | null;

  // AI nhận xét
  summary: string | null;
}

// --- INCIDENT REPORT TYPES ---
export interface ProcessingTableRow {
  category: string; // "Phát báo nhận", "Phát truyền tiếp", etc.
  subCategory?: string; // "Cấp cứu", "Khẩn cấp"
  dsc: string | null; // check mark or count text
  nbdp: string | null;
  rtp: string | null;
  navtex: string | null;
  inmarsat: string | null;
  other: string | null;
}

export interface ActionLog {
  time: string;
  content: string;
}

export interface AttachedDocument {
  recipient: string; // Nơi nhận
  purpose: string;   // Mục đích (báo cáo)
  methodFax: boolean; // Có tích Fax không
  methodEmail: boolean; // Có tích Email không
  time: string;      // Thời gian
  sender: string;    // Người gửi
}

// Page 3: SAR Report Data
export interface SARReportData {
  headerTitle: string | null; // TRUNG TÂM PHỐI HỢP...
  refNumber: string | null; // Số: 85/01/...
  dateLocation: string | null; // Đà Nẵng, 16 giờ...
  recipient: string | null; // Kính gửi...
  intro: string | null; // Hồi 16 giờ...

  // Sections
  content: string | null; // 1. Nội dung...
  measures: string | null; // 2. Biện pháp xử lý...
  proposal: string | null; // 3. Đề nghị...
  attachedFiles: string | null; // 4. Tài liệu kèm theo...

  signerLeft: string | null; // TRỰC BAN
  signerRight: string | null; // KT. GIÁM ĐỐC
  signerNameRight: string | null; // Phan Thành Trường...
}

export interface IncidentReportData {
  type: 'INCIDENT';
  // Header Info
  reportTitle: string | null; // BÁO CÁO XỬ LÝ SỐ...
  stationName: string | null; // Đài TTDH Đà Nẵng...
  date: string | null;

  // Vessel Info
  vesselName: string | null; // TÀU CÁ QNa 91892 TS
  nationality: string | null;
  coordinates: string | null; // Vị trí
  incidentType: string | null; // 01 người bị thương nặng...

  // Processing Table (Xử lý độc lập)
  processingTable: ProcessingTableRow[];

  // Frequencies mentioned
  frequencyInfo: string | null; // Tần số 7903 kHz...

  // Logs
  actionLogs: ActionLog[];

  // Footer / Coordination
  coordinationInfo: string | null; // Đơn vị phối hợp
  proposal: string | null; // Đề xuất xử lý

  // Attached Documents (Tài liệu kèm theo - Page 2)
  attachedDocuments?: AttachedDocument[];

  // Verification Report (Technical logs)
  verificationReport?: {
    date: string | null;
    time: string | null;
    duration: string | null;
    result: string | null;
  }[];

  // Page 3 - SAR Report
  sarReport?: SARReportData;
}

// --- SPLITTER TYPES ---
export interface BroadcastAndServiceCode {
  broadcastCode: 'MET' | 'NAV' | 'SAR' | 'WX' | 'TUYEN' | null;
  serviceCode: 'NTX' | 'RTP' | 'EGC' | null;
}

export interface PageCodeResult {
  page: number;
  code: string | null;
}

export interface BanTinNguonKeywords {
  codePatterns: string[];
  textPatterns: string[];
}

export interface PageAnalysis {
  page: number;
  code: string | null;           // QT.MSI-BM.01, TTNH-04H00, etc.
  hasPersonName: boolean;         // Có tên người không (điểm cắt)
  personName?: string;            // Tên người nếu có
  isLogPage: boolean;             // Trang LOG (log ảnh, log mail, không phải nội dung chính)
  isBanTinNguonHeader?: boolean;  // Trang có header "Cộng hòa xã hội chủ nghĩa Việt Nam" của BẢN TIN NGUỒN
  hasGmail?: boolean;             // Trang có chứa địa chỉ email dạng @gmail (LOGMAIL)
}

export interface PDFAnalysisResult {
  broadcastCode: 'MET' | 'NAV' | 'SAR' | 'WX' | 'TUYEN' | null;
  serviceCode: 'NTX' | 'RTP' | 'EGC' | null;
  pages: PageAnalysis[];
}

export interface SplitDocument {
  id: string;
  filename: string;
  code?: string;     // The detected code (e.g. QT.MSI-BM.01)
  startPage: number; // 1-based index
  endPage: number;   // 1-based index
  pageCount: number;
}

export interface FileToSave {
  path: string;
  filename: string;
  bytes: Uint8Array;
}

export interface SplitResultData {
  type: 'SPLIT';
  originalFileName: string;
  documents: SplitDocument[];
  zipBlob: Blob | null; // Deprecated - files are now saved directly to local filesystem
  folderStructure?: any; // JSON structure of folders
  filesToSave?: FileToSave[]; // Files to save (directory picker must be called in user gesture)
  folderStructureJson?: string; // JSON structure as string
}

export type DocumentData = InvoiceData | IncidentReportData | SplitResultData;

export enum ProcessingStatus {
  IDLE = 'IDLE',
  CONVERTING = 'CONVERTING',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

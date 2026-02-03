
export type DocumentType = 'DETECT_FORM';

// --- SIMPLE FORM DETECTION TYPES ---
export interface PageFormInfo {
  page: number;
  formCode: string | null;
  isFormHeader: boolean;
  isBanTinNguon: boolean;
  isLogPage: boolean;
  pageType: 'KTKS' | 'BM' | 'BANTINNGUON' | 'LOG';
  serviceType: 'RTP' | 'EGC' | 'NTX' | 'OTHER' | null;
  subType: 'MET' | 'NAV' | 'SAR' | 'TUYEN' | 'WX' | 'OTHER' | null;
  broadcastCode?: string | null;
  serviceHint?: string | null;
  type?: string;
}

export interface FormDetectionResult {
  type: 'DETECT_FORM';
  totalPages: number;
  pages: PageFormInfo[];
}

export type DocumentData = FormDetectionResult;

export enum ProcessingStatus {
  IDLE = 'IDLE',
  CONVERTING = 'CONVERTING',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

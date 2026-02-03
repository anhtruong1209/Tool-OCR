import React, { useEffect, useRef, useState } from 'react';
import { FormDetectionResult, PageFormInfo } from '../types';
import { Layout, Scissors, ChevronRight, FileSearch, Hash, FileCode, Wind, Ship, LifeBuoy, List, Cloud, Target, MousePointer2, FolderSync, Loader2, CheckCircle2 } from 'lucide-react';
import { autoSplitPdf } from '../services/automaticSplitter';

interface SimpleFormViewerProps {
    data: FormDetectionResult;
    originalFile: File | null;
    dirHandle: FileSystemDirectoryHandle | null;
}

const getSubTypeBadge = (subType: string | null) => {
    switch (subType) {
        case 'MET':
            return <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-700 text-[10px] font-black uppercase border border-cyan-200/50"><Cloud size={10} /> MET</div>;
        case 'NAV':
            return <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black uppercase border border-blue-200/50"><Ship size={10} /> NAV</div>;
        case 'SAR':
            return <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-[10px] font-black uppercase border border-rose-200/50"><LifeBuoy size={10} /> SAR</div>;
        case 'TUYEN':
            return <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-[10px] font-black uppercase border border-purple-200/50"><List size={10} /> TUYỀN</div>;
        case 'WX':
            return <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase border border-emerald-200/50"><Wind size={10} /> WX</div>;
        case 'RTP':
            return <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 text-[10px] font-black uppercase border border-orange-200/50"><Target size={10} /> RTP</div>;
        default:
            return null;
    }
};

const getServiceBadge = (service: string | null) => {
    if (!service || service === 'OTHER') return null;
    return (
        <div className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-black border border-slate-200 uppercase tracking-tighter">
            {service}
        </div>
    );
};

const groupPages = (result: FormDetectionResult) => {
    const groups: Array<{ formCode: string | null; serviceType: string | null; subType: string | null; pages: PageFormInfo[] }> = [];
    let currentGroup: { formCode: string | null; serviceType: string | null; subType: string | null; pages: PageFormInfo[] } | null = null;

    for (const page of result.pages) {
        if (page.isFormHeader) {
            if (currentGroup) groups.push(currentGroup);
            currentGroup = { formCode: page.formCode, serviceType: page.serviceType, subType: page.subType, pages: [page] };
        } else {
            if (!currentGroup) {
                currentGroup = { formCode: null, serviceType: page.serviceType, subType: page.subType, pages: [page] };
            } else {
                currentGroup.pages.push(page);
                if (!currentGroup.subType && page.subType) {
                    currentGroup.subType = page.subType;
                }
                if (!currentGroup.serviceType && page.serviceType) {
                    currentGroup.serviceType = page.serviceType;
                }
            }
        }
    }
    if (currentGroup) groups.push(currentGroup);
    return groups;
};

export const SimpleFormViewer: React.FC<SimpleFormViewerProps> = ({ data, originalFile, dirHandle }) => {
    const groups = groupPages(data);
    const scrollRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const [activePage, setActivePage] = useState<number>(1);
    const [isExporting, setIsExporting] = useState(false);
    const [exportResult, setExportResult] = useState<{ success: number; failed: number } | null>(null);

    const handleSync = () => {
        const pdfContainer = document.querySelector('.lg\\:w-1\\/2.h-\\[40vh\\]') || document.querySelector('.lg\\:w-1\\/2.overflow-auto');
        if (!pdfContainer) return;

        const scrollPos = pdfContainer.scrollTop;
        const pageElements = pdfContainer.querySelectorAll('.relative.shadow-xl');

        let currentPage = 1;
        let minDiff = Infinity;

        pageElements.forEach((el, idx) => {
            const rect = (el as HTMLElement).offsetTop;
            const diff = Math.abs(rect - scrollPos);
            if (diff < minDiff) {
                minDiff = diff;
                currentPage = idx + 1;
            }
        });

        setActivePage(currentPage);
        const targetEl = scrollRefs.current[currentPage];
        if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    const handleAutoSplit = async () => {
        if (!originalFile || !dirHandle) {
            alert("Vui lòng đảm bảo đã upload file và chọn thư mục lưu kết quả!");
            return;
        }

        setIsExporting(true);
        setExportResult(null);
        try {
            const result = await autoSplitPdf(originalFile, data, dirHandle);
            setExportResult({ success: result.success, failed: result.failed });
        } catch (error) {
            console.error(error);
            alert("Có lỗi xảy ra khi tách file!");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white text-slate-900 border-l border-slate-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <Layout className="text-blue-600" />
                            Kết quả Phân loại v3
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Phát hiện {groups.length} block tài liệu.
                        </p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={handleSync}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-sm transition-all shadow-md active:scale-95"
                    >
                        <Target size={16} />
                        SYNC
                    </button>
                    <button
                        onClick={handleAutoSplit}
                        disabled={isExporting || !dirHandle}
                        className="flex-[2] flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all shadow-md active:scale-95"
                    >
                        {isExporting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                ĐANG LƯU...
                            </>
                        ) : (
                            <>
                                <FolderSync size={16} />
                                TỰ ĐỘNG LƯU VÀO THƯ MỤC
                            </>
                        )}
                    </button>
                </div>

                {exportResult && (
                    <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center gap-3 animate-in slide-in-from-top-2">
                        <CheckCircle2 size={18} className="text-emerald-600" />
                        <span className="text-xs font-semibold text-emerald-800">
                            Đã tách thành công {exportResult.success} file. {exportResult.failed > 0 && `(Lỗi ${exportResult.failed})`}
                        </span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6 space-y-6 scroll-smooth scrollbar-thin">
                <div className="space-y-4">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                        <Scissors size={18} className="text-orange-500" />
                        Cấu trúc File dự kiến
                    </h4>

                    <div className="space-y-6">
                        {groups.map((group, gIdx) => (
                            <div key={gIdx} className="border-2 border-slate-200 rounded-2xl overflow-hidden shadow-md bg-white transition-all hover:border-blue-300">
                                <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center font-black shadow-inner">
                                            {gIdx + 1}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-white text-sm">
                                                {group.formCode || "Tài liệu hệ thống"}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
                                                {group.pages.length} TRANG • {
                                                    group.pages[0].pageType === 'KTKS' ? 'Kiểm tra kiểm soát (KTKS)' :
                                                        group.pages[0].pageType === 'BM' ? 'Biểu mẫu nghiệp vụ (BM)' :
                                                            group.pages[0].pageType === 'BANTINNGUON' ? 'Bản tin nguồn' : 'Nhật ký hệ thống (LOG)'
                                                }
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {getServiceBadge(group.serviceType)}
                                        <div className="scale-90">
                                            {getSubTypeBadge(group.subType)}
                                        </div>
                                    </div>
                                </div>

                                <div className="divide-y divide-slate-100">
                                    {group.pages.map((page, pIdx) => (
                                        <div
                                            key={page.page}
                                            ref={el => { scrollRefs.current[page.page] = el; }}
                                            className={`px-5 py-4 flex items-center justify-between transition-all ${activePage === page.page ? 'bg-blue-50 ring-2 ring-inset ring-blue-200' : pIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`text-sm font-black w-14 transition-colors ${activePage === page.page ? 'text-blue-600' : 'text-slate-400'}`}>
                                                    TRANG {page.page}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {page.isFormHeader && (
                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 uppercase">
                                                            Header
                                                        </span>
                                                    )}
                                                    <span className={`text-xs font-medium ${activePage === page.page ? 'text-slate-900' : 'text-slate-600'}`}>
                                                        {page.isBanTinNguon ? 'Bản tin nguồn' : page.isLogPage ? 'Ký hiệu LOG' : 'Nội dung biểu mẫu'}
                                                    </span>
                                                </div>
                                            </div>

                                            {page.formCode && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase">Code</span>
                                                    <code className="text-xs font-mono bg-white px-2 py-1 rounded border border-slate-200 text-slate-700 shadow-sm">
                                                        {page.formCode}
                                                    </code>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-center gap-4">
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <Target size={12} /> Sync để khớp trang
                </div>
                <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <FolderSync size={12} /> Tự động phân phối vào folder
                </div>
            </div>
        </div>
    );
};


import React from 'react';
import { SplitResultData } from '../types';
import { FileArchive, Download, FileText, Layers, Tag } from 'lucide-react';

interface SplitterViewerProps {
  data: SplitResultData;
}

export const SplitterViewer: React.FC<SplitterViewerProps> = ({ data }) => {
  
  const handleDownload = () => {
    if (!data.zipBlob) return;
    const url = URL.createObjectURL(data.zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Vishipel_Split_${new Date().getTime()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-100 h-full overflow-y-auto p-4 md:p-8 font-sans text-slate-900">
        
        <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden">
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Layers className="text-blue-400" /> Kết quả Tách PDF
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">File gốc: {data.originalFileName}</p>
                </div>
                <div className="bg-blue-600 px-4 py-2 rounded-lg font-bold text-sm">
                    {data.documents.length} tài liệu tìm thấy
                </div>
            </div>

            <div className="p-6">
                <div className="mb-6 flex justify-between items-center bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                            <FileArchive size={24} />
                        </div>
                        <div>
                            <p className="font-bold text-slate-800">Tải xuống toàn bộ</p>
                            <p className="text-sm text-slate-500">Định dạng .ZIP bao gồm tất cả các file đã tách</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleDownload}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg transition-all hover:scale-105"
                    >
                        <Download size={20} /> Tải ZIP
                    </button>
                </div>

                <h3 className="font-bold text-slate-700 mb-4 px-2 uppercase text-xs tracking-wider">Chi tiết các file đã tách</h3>
                
                <div className="grid gap-3">
                    {data.documents.map((doc, idx) => (
                        <div key={doc.id} className="flex items-center p-4 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all group">
                            <div className="w-10 h-10 bg-slate-100 text-slate-500 rounded-lg flex items-center justify-center font-bold mr-4 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                {idx + 1}
                            </div>
                            <div className="flex-grow">
                                <p className="font-bold text-slate-800 text-lg group-hover:text-blue-700 break-all">
                                    {doc.filename}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                                    <span className="flex items-center gap-1">
                                        <FileText size={12} /> {doc.pageCount} trang
                                    </span>
                                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                    <span>Trang {doc.startPage} - {doc.endPage}</span>
                                    {doc.code && (
                                        <>
                                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                            <span className="flex items-center gap-1 font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                                <Tag size={10} /> Code: {doc.code}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="text-slate-300">
                                <FileText size={24} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
        
        <div className="text-center text-slate-400 text-sm mt-8 pb-4">
             Sử dụng công nghệ xử lý PDF Client-side. File của bạn không rời khỏi trình duyệt.
        </div>
    </div>
  );
};

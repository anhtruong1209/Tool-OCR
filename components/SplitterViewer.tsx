
import React, { useState } from 'react';
import { SplitResultData } from '../types';
import { FileArchive, Download, FileText, Layers, Tag, CheckCircle2 } from 'lucide-react';

interface SplitterViewerProps {
  data: SplitResultData;
}

export const SplitterViewer: React.FC<SplitterViewerProps> = ({ data }) => {
  const [synced, setSynced] = useState(false);
  
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
    <div className="h-full overflow-y-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto glass-strong rounded-2xl overflow-hidden">
            <div className="glass-light border-b border-white/20 p-6 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                        <Layers className="text-orange-400" /> Kết quả Tách PDF
                    </h2>
                    <p className="text-white/60 text-sm mt-1">File gốc: {data.originalFileName}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSynced(true)}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm shadow-md transition-all ${
                      synced 
                        ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/30' 
                        : 'glass-light text-white hover:bg-white/20 border border-white/20'
                    }`}
                  >
                    {synced ? (
                      <span className="inline-flex items-center gap-2"><CheckCircle2 size={16}/> Đã đồng bộ</span>
                    ) : 'Đồng bộ vào folder'}
                  </button>
                  <div className="glass bg-white/20 px-4 py-2 rounded-lg font-bold text-sm text-white border border-white/30">
                      {data.documents.length} tài liệu tìm thấy
                  </div>
                </div>
            </div>

            <div className="p-6">
                <div className="mb-6 flex justify-between items-center glass-light p-4 rounded-xl border border-white/20">
                    <div className="flex items-center gap-3">
                        <div className="p-3 glass bg-white/10 text-white rounded-lg">
                            <FileArchive size={24} />
                        </div>
                        <div>
                            <p className="font-bold text-white">Tải xuống toàn bộ</p>
                            <p className="text-sm text-white/70">Định dạng .ZIP bao gồm tất cả các file đã tách</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleDownload}
                        className="flex items-center gap-2 glass bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-lg font-bold shadow-lg transition-all hover:scale-105 active:scale-100 border border-white/30"
                    >
                        <Download size={20} /> Tải ZIP
                    </button>
                </div>

                <h3 className="font-bold text-white/80 mb-4 px-2 uppercase text-xs tracking-wider">Chi tiết các file đã tách</h3>
                
                <div className="grid gap-3">
                    {data.documents.map((doc, idx) => (
                        <div key={doc.id} className="flex items-center p-4 glass-light border border-white/20 rounded-lg hover:border-white/40 hover:bg-white/10 transition-all group hover:-translate-y-0.5">
                            <div className="w-10 h-10 glass bg-white/10 text-white rounded-lg flex items-center justify-center font-bold mr-4 group-hover:bg-white/20 transition-colors">
                                {idx + 1}
                            </div>
                            <div className="flex-grow">
                                <p className="font-bold text-white text-lg group-hover:text-orange-300 break-all">
                                    {doc.filename}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-white/60 mt-1">
                                    <span className="flex items-center gap-1">
                                        <FileText size={12} /> {doc.pageCount} trang
                                    </span>
                                    <span className="w-1 h-1 bg-white/40 rounded-full"></span>
                                    <span>Trang {doc.startPage} - {doc.endPage}</span>
                                    {doc.code && (
                                        <>
                                            <span className="w-1 h-1 bg-white/40 rounded-full"></span>
                                            <span className="flex items-center gap-1 font-mono text-orange-300 glass bg-orange-500/20 px-2 py-0.5 rounded border border-orange-400/30">
                                                <Tag size={10} /> Code: {doc.code}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="text-white/30">
                                <FileText size={24} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
        
        <div className="text-center text-white/50 text-sm mt-8 pb-4">
             Sử dụng công nghệ xử lý PDF Client-side. File của bạn không rời khỏi trình duyệt.
        </div>
    </div>
  );
};

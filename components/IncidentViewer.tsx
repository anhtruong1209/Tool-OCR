
import React from 'react';
import { IncidentReportData } from '../types';
import { Printer, MapPin, FileText } from 'lucide-react';

interface IncidentViewerProps {
  data: IncidentReportData;
}

export const IncidentViewer: React.FC<IncidentViewerProps> = ({ data }) => {

  const print = () => {
    window.print();
  };

  // --- UNIVERSAL CELL RENDERER ---
  // Logic:
  // 1. Checkbox-like values -> Render ☒
  // 2. Empty/Dash/Null -> Render -
  // 3. Anything else (e.g., "4 lượt") -> Render BOLD TEXT
  const renderCell = (value: string | null | undefined) => {
    if (!value || value === '-' || value.trim() === '') {
      return <div className="text-center text-slate-400 font-normal">-</div>;
    }

    const normalized = value.toString().toLowerCase().trim();

    // Checkbox logic
    if (['x', 'true', 'v', 'có', 'checked'].includes(normalized)) {
      return (
        <div className="flex justify-center items-center h-full">
           <div className="w-5 h-5 border border-black flex items-center justify-center text-sm leading-none font-bold bg-white text-black">
             ✕
           </div>
        </div>
      );
    }

    // Count/Text logic (e.g., "4 lượt")
    // Render as text, centered, bold
    return <div className="text-center text-sm font-bold whitespace-nowrap text-black">{value}</div>;
  };

  // Helper to safely get data from the array with fuzzy matching
  const getVal = (categoryKeyword: string, subCategoryKeyword: string | undefined, field: 'dsc' | 'nbdp' | 'rtp' | 'navtex' | 'inmarsat' | 'other') => {
    if (!data.processingTable) return null;
    
    // Strict matching first, then fuzzy
    let row = data.processingTable.find(r => {
        const catMatch = r.category.toLowerCase().includes(categoryKeyword.toLowerCase());
        const subMatch = subCategoryKeyword 
            ? r.subCategory?.toLowerCase().includes(subCategoryKeyword.toLowerCase()) 
            : true;
        return catMatch && subMatch;
    });

    return row ? row[field] : null; 
  };

  return (
    <div className="bg-slate-200 h-full overflow-y-auto p-4 md:p-8 font-official text-black leading-snug">
      
      {/* Toolbar */}
      <div className="max-w-[210mm] mx-auto mb-4 flex justify-end gap-2 print:hidden no-print">
        <button 
          onClick={print}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded hover:bg-slate-900 shadow font-sans"
        >
          <Printer className="w-4 h-4" /> In Báo Cáo
        </button>
      </div>

      {/* --- PAGE 1 & 2 CONTAINER --- */}
      <div className="max-w-[210mm] mx-auto bg-white shadow-2xl p-[15mm] min-h-[297mm] print:shadow-none print:p-0 print:m-0 relative text-black mb-8">
        
        {/* Header Table (Unit Info) */}
        <table className="w-full border-collapse border border-black mb-4">
            <tbody>
                <tr>
                    <td className="border-r border-black p-2 w-[40%] align-top">
                        <div className="flex items-center gap-2 mb-2">
                             {/* Mock Logo */}
                             <div className="w-8 h-8 rounded-full border border-black flex items-center justify-center font-bold text-xs shrink-0">VS</div>
                             <div className="font-bold text-lg uppercase">Vishipel</div>
                        </div>
                        <div className="font-bold uppercase text-[11px] leading-tight">CÔNG TY TNHH MTV THÔNG TIN<br/>ĐIỆN TỬ HÀNG HẢI VIỆT NAM</div>
                        <div className="mt-4 font-bold text-base uppercase text-center">{data.stationName || "Đài TTDH ĐÀ NẴNG (DNR)"}</div>
                        <div className="text-sm italic text-center mt-1">Tel: +84-236-3650177 Fax: +84-236-3650177</div>
                    </td>
                    <td className="p-2 align-top text-center">
                        <div className="font-bold text-xl uppercase mb-1">{data.reportTitle || "BÁO CÁO XỬ LÝ SỐ 1"}</div>
                        <div className="text-sm font-bold uppercase mb-3">THÔNG TIN CẤP CỨU - KHẨN CẤP VÀ AN TOÀN - AN NINH</div>
                        
                        <div className="text-left pl-4 space-y-1">
                            <div className="flex">
                                <span className="font-bold w-24 shrink-0">Phương tiện:</span>
                                <span className="font-bold uppercase italic">{data.vesselName}</span>
                            </div>
                            <div className="flex">
                                <span className="font-bold w-24 shrink-0">Quốc tịch:</span>
                                <span>{data.nationality || "Việt Nam"}</span>
                            </div>
                            <div className="flex">
                                <span className="font-bold w-24 shrink-0">Tình trạng:</span>
                                <span className="font-bold">{data.incidentType}</span>
                            </div>
                        </div>
                    </td>
                </tr>
                <tr className="border-t border-black">
                    <td className="p-1 italic text-xs border-r border-black pl-2">Mã công văn: 0041.01/2025/DNR-GMDSS</td>
                    <td className="p-1 italic text-right text-sm pr-2">{data.date || "Đà Nẵng, ngày ... tháng ... năm ..."}</td>
                </tr>
            </tbody>
        </table>

        {/* Recipients */}
        <div className="mb-6 text-sm pl-2 flex items-start gap-4">
            <span className="font-bold underline italic shrink-0 mt-1">Kính gửi:</span>
            <div className="flex flex-col gap-y-2 text-black">
              <p>Trung tâm PH TKCN HH Khu vực II - Đà Nẵng MRCC</p>
              <p>Trung tâm Thông tin Kiểm ngư, Cục Kiểm ngư</p>
              <p>Ban chỉ huy Phòng thủ dân sự Thành phố Đà Nẵng</p>
              <p>Bộ chỉ huy Bộ đội Biên phòng thành phố Đà Nẵng</p>
              <p>Phòng Điều Hành Mạng Vishipel</p>
            </div>
        </div>

        <p className="mb-2 italic text-sm">
            Cho đến: 18:05 (LT), ngày 19 tháng 10 năm 2025, Đài TTDH Đà Nẵng đã tiến hành xử lý đối với phương tiện bị nạn như sau:
        </p>

        {/* COMPLEX PROCESSING TABLE */}
        <table className="w-full border-collapse border border-black text-sm mb-6 table-fixed">
            <colgroup>
                <col className="w-[26%]" />
                <col className="w-[14%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-[6%]" />
            </colgroup>
            <thead>
                <tr>
                    <th colSpan={8} className="border border-black p-1 bg-slate-100 uppercase text-center font-bold">XỬ LÝ ĐỘC LẬP</th>
                </tr>
                <tr className="text-center font-bold">
                    <th colSpan={2} className="border border-black p-1 relative h-12">
                         <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                            <line x1="0" y1="100%" x2="100%" y2="0" stroke="black" strokeWidth="1" />
                        </svg>
                        <span className="absolute bottom-1 left-2 text-xs">Phương thức</span>
                        <span className="absolute top-1 right-2 text-xs">Tần số</span>
                    </th>
                    <th className="border border-black p-1">DSC</th>
                    <th className="border border-black p-1">NBDP</th>
                    <th className="border border-black p-1">RTP</th>
                    <th className="border border-black p-1">NAVTEX</th>
                    <th className="border border-black p-1 text-[10px] md:text-sm">INMARSAT</th>
                    <th className="border border-black p-1">KHÁC</th>
                </tr>
                <tr className="text-center">
                    <td colSpan={2} className="border border-black p-1 font-bold">-</td>
                    <td className="border border-black p-1">-</td>
                    <td className="border border-black p-1">-</td>
                    <td className="border border-black p-1 font-bold">{data.frequencyInfo || "7903 kHz"}</td>
                    <td className="border border-black p-1">-</td>
                    <td className="border border-black p-1">-</td>
                    <td className="border border-black p-1">-</td>
                </tr>
                <tr className="bg-slate-100 font-bold">
                    <td colSpan={8} className="border border-black p-1 pl-2 text-left">Hành động xử lý</td>
                </tr>
            </thead>
            <tbody>
                {/* Rows rendered dynamically based on data */}
                <tr>
                    <td colSpan={2} className="border border-black p-1 font-bold pl-2">Phát báo nhận</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát báo nhận', undefined, 'dsc'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát báo nhận', undefined, 'nbdp'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát báo nhận', undefined, 'rtp'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát báo nhận', undefined, 'navtex'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát báo nhận', undefined, 'inmarsat'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát báo nhận', undefined, 'other'))}</td>
                </tr>
                <tr>
                    <td colSpan={2} className="border border-black p-1 font-bold pl-2">Phát truyền tiếp</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát truyền tiếp', undefined, 'dsc'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát truyền tiếp', undefined, 'nbdp'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát truyền tiếp', undefined, 'rtp'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát truyền tiếp', undefined, 'navtex'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát truyền tiếp', undefined, 'inmarsat'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát truyền tiếp', undefined, 'other'))}</td>
                </tr>
                 <tr>
                    <td colSpan={2} className="border border-black p-1 font-bold pl-2">Phát báo nhận truyền tiếp</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát báo nhận truyền tiếp', undefined, 'dsc'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát báo nhận truyền tiếp', undefined, 'nbdp'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát báo nhận truyền tiếp', undefined, 'rtp'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát báo nhận truyền tiếp', undefined, 'navtex'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát báo nhận truyền tiếp', undefined, 'inmarsat'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát báo nhận truyền tiếp', undefined, 'other'))}</td>
                </tr>
                <tr>
                    <td rowSpan={3} className="border border-black p-1 font-bold align-middle text-center">Phát quảng bá</td>
                    <td className="border border-black p-1 font-bold pl-2">Cấp cứu</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát quảng bá', 'Cấp cứu', 'dsc'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát quảng bá', 'Cấp cứu', 'nbdp'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát quảng bá', 'Cấp cứu', 'rtp'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát quảng bá', 'Cấp cứu', 'navtex'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát quảng bá', 'Cấp cứu', 'inmarsat'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát quảng bá', 'Cấp cứu', 'other'))}</td>
                </tr>
                <tr>
                    <td className="border border-black p-1 font-bold pl-2">Khẩn cấp</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát quảng bá', 'Khẩn cấp', 'dsc'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát quảng bá', 'Khẩn cấp', 'nbdp'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát quảng bá', 'Khẩn cấp', 'rtp'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát quảng bá', 'Khẩn cấp', 'navtex'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát quảng bá', 'Khẩn cấp', 'inmarsat'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát quảng bá', 'Khẩn cấp', 'other'))}</td>
                </tr>
                <tr>
                    <td className="border border-black p-1 font-bold pl-2">An toàn</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát quảng bá', 'An toàn', 'dsc'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát quảng bá', 'An toàn', 'nbdp'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát quảng bá', 'An toàn', 'rtp'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát quảng bá', 'An toàn', 'navtex'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát quảng bá', 'An toàn', 'inmarsat'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Phát quảng bá', 'An toàn', 'other'))}</td>
                </tr>
                <tr>
                    <td colSpan={2} className="border border-black p-1 font-bold pl-2">Liên lạc trực tiếp với phương tiện bị nạn</td>
                    <td className="border border-black p-1">{renderCell(getVal('Liên lạc trực tiếp', 'bị nạn', 'dsc'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Liên lạc trực tiếp', 'bị nạn', 'nbdp'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Liên lạc trực tiếp', 'bị nạn', 'rtp'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Liên lạc trực tiếp', 'bị nạn', 'navtex'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Liên lạc trực tiếp', 'bị nạn', 'inmarsat'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Liên lạc trực tiếp', 'bị nạn', 'other'))}</td>
                </tr>
                 <tr>
                    <td colSpan={2} className="border border-black p-1 font-bold pl-2">Liên lạc trực tiếp với phương tiện khác</td>
                    <td className="border border-black p-1">{renderCell(getVal('Liên lạc trực tiếp', 'khác', 'dsc'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Liên lạc trực tiếp', 'khác', 'nbdp'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Liên lạc trực tiếp', 'khác', 'rtp'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Liên lạc trực tiếp', 'khác', 'navtex'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Liên lạc trực tiếp', 'khác', 'inmarsat'))}</td>
                    <td className="border border-black p-1">{renderCell(getVal('Liên lạc trực tiếp', 'khác', 'other'))}</td>
                </tr>
            </tbody>
        </table>

        {/* Narrative Logs */}
        <div className="border border-black p-0 mb-6">
            <div className="font-bold border-b border-black p-1 pl-2 bg-slate-100 uppercase text-sm">Chi tiết hành động xử lý</div>
            <div className="p-4 text-sm whitespace-pre-line leading-6">
                <div className="mb-2 underline font-bold">Ngày {data.date?.split(',').pop()?.trim() || '...'}:</div>
                {data.actionLogs && data.actionLogs.map((log, idx) => (
                    <div key={idx} className="flex gap-3 mb-1 items-baseline">
                        <span className="font-bold min-w-[120px] shrink-0">- Lúc {log.time}lt:</span>
                        <span className="text-justify">{log.content}</span>
                    </div>
                ))}
            </div>
            {data.coordinates && (
                <div className="border-t border-black p-2 bg-slate-50 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-black" />
                    <span className="font-bold underline">Tàu đang ở vị trí: {data.coordinates}</span>
                </div>
            )}
        </div>

        {/* Coordination & Results */}
        <div className="mb-6">
            <table className="w-full border-collapse border border-black mb-1 text-sm">
                <thead>
                    <tr>
                        <th colSpan={3} className="border border-black p-1 uppercase bg-slate-100">XỬ LÝ PHỐI HỢP</th>
                    </tr>
                    <tr>
                        <th className="border border-black p-1 w-[25%]">Đơn vị phối hợp</th>
                        <th className="border border-black p-1 w-[25%]">Phương thức phối hợp</th>
                        <th className="border border-black p-1">Nội dung phối hợp (Ghi rõ nội dung chi tiết) / Kết quả</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="border border-black p-2 h-24 align-top text-center font-bold"></td>
                        <td className="border border-black p-2 h-24 align-top text-center italic text-xs">Fax/Email/Tel</td>
                        <td className="border border-black p-2 h-24 align-top whitespace-pre-line">{data.coordinationInfo}</td>
                    </tr>
                </tbody>
            </table>
            
            {/* PROPOSAL & APPROVAL */}
            <div className="grid grid-cols-2 border border-black border-t-0">
                <div className="border-r border-black p-2 h-32">
                     <p className="font-bold text-center uppercase text-sm mb-1">ĐỀ XUẤT XỬ LÝ</p>
                     <p className="text-sm italic">{data.proposal || "DNR tiếp tục theo dõi thông tin vụ việc."}</p>
                </div>
                 <div className="p-2 h-32 relative">
                     <p className="font-bold text-center uppercase text-sm mb-1">Ý KIẾN CHỈ ĐẠO</p>
                     
                     <div className="absolute bottom-2 right-4 text-center">
                         <p className="font-bold text-sm">Ca trưởng</p>
                         <p className="italic text-xs mb-2">Ký và ghi rõ họ tên</p>
                         <p className="font-signature text-2xl mb-1">Signed</p>
                         <p className="font-bold text-sm">Nguyễn Thị Nhất</p>
                     </div>
                </div>
            </div>
        </div>
        
        {/* ATTACHED DOCUMENTS (Page 2) */}
        {data.attachedDocuments && data.attachedDocuments.length > 0 && (
            <div className="mt-8 mb-8 break-before-auto">
                <p className="font-bold italic underline mb-2 text-sm">Tài liệu kèm theo:</p>
                <table className="w-full border-collapse border border-black text-sm">
                    <thead>
                        <tr className="bg-slate-50">
                            <th className="border border-black p-1 w-[20%]">Nơi nhận</th>
                            <th className="border border-black p-1 w-[15%]">Mục đích</th>
                            <th className="border border-black p-1 w-[20%]">Phương thức</th>
                            <th className="border border-black p-1 w-[20%]">Thời gian</th>
                            <th className="border border-black p-1 w-[25%]">Người gửi</th>
                        </tr>
                        <tr>
                            <th className="border border-black"></th>
                            <th className="border border-black"></th>
                            <th className="border border-black p-1 flex justify-around">
                                <span>Fax</span> <span>Email</span>
                            </th>
                            <th className="border border-black"></th>
                            <th className="border border-black"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.attachedDocuments.map((doc, idx) => (
                            <tr key={idx}>
                                <td className="border border-black p-1 text-center font-bold">{doc.recipient}</td>
                                <td className="border border-black p-1 text-center">{doc.purpose}</td>
                                <td className="border border-black p-1">
                                    <div className="flex justify-around">
                                        <div className={`w-4 h-4 border border-black flex items-center justify-center text-xs ${doc.methodFax ? 'font-bold' : ''}`}>
                                            {doc.methodFax ? '✕' : ''}
                                        </div>
                                         <div className={`w-4 h-4 border border-black flex items-center justify-center text-xs ${doc.methodEmail ? 'font-bold' : ''}`}>
                                            {doc.methodEmail ? '✕' : ''}
                                        </div>
                                    </div>
                                </td>
                                <td className="border border-black p-1 text-center italic">{doc.time}</td>
                                <td className="border border-black p-1 text-center">{doc.sender}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
        
        {/* Verification Reports */}
        {data.verificationReport && data.verificationReport.length > 0 && (
          <div className="mt-8 border-t-2 border-black border-dashed pt-8">
            <div className="text-center border border-black p-2 inline-block font-bold mb-4 font-mono text-sm">
                TRANSMISSION VERIFICATION REPORT
            </div>
            <table className="w-full border-collapse border-t border-b border-black text-sm font-mono mt-2">
              <thead className="">
                <tr className="border-b border-black">
                    <th className="text-left py-1">TIME</th>
                    <th className="text-left py-1">NAME</th>
                    <th className="text-left py-1">FAX</th>
                    <th className="text-left py-1">TEL</th>
                </tr>
              </thead>
              <tbody>
                 <tr>
                    <td>: {data.verificationReport[0].date} {data.verificationReport[0].time}</td>
                    <td>: DANANGRADIO</td>
                    <td>: 02363650177</td>
                    <td>: 02363650177</td>
                 </tr>
              </tbody>
            </table>

             <div className="mt-6 border border-black p-4">
                <table className="w-full font-mono text-sm">
                  <thead>
                    <tr>
                        <th className="text-left">DATE,TIME</th>
                        <th className="text-left">FAX NO./NAME</th>
                        <th className="text-left">DURATION</th>
                        <th className="text-left">PAGE(S)</th>
                        <th className="text-left">RESULT</th>
                        <th className="text-left">MODE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.verificationReport.map((rep, idx) => (
                      <tr key={idx}>
                        <td>{rep.date} {rep.time}</td>
                        <td>DNMRCC</td>
                        <td>{rep.duration}</td>
                        <td>02</td>
                        <td>{rep.result}</td>
                        <td>STANDARD</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
        )}

      </div>

      {/* --- PAGE 3: SAR REPORT (THÔNG TIN TÌM KIẾM CỨU NẠN TRÊN BIỂN) --- */}
      {data.sarReport && (
        <div className="max-w-[210mm] mx-auto bg-white shadow-2xl p-[20mm] min-h-[297mm] print:shadow-none print:p-0 print:m-0 relative text-black mb-8 mt-8">
            
            {/* Page 3 Header */}
            <div className="flex justify-between items-start mb-6 border-b border-slate-200 pb-4">
                <div className="w-1/3 text-center">
                    {/* Mock Logo */}
                    <div className="w-16 h-16 mx-auto mb-2 rounded-full border-2 border-slate-800 flex items-center justify-center font-bold text-sm">
                        MRCC
                    </div>
                </div>
                <div className="w-2/3 text-center">
                    <h3 className="font-bold uppercase text-sm mb-1">TRUNG TÂM PHỐI HỢP TÌM KIẾM CỨU NẠN HÀNG HẢI KHU VỰC II</h3>
                    <p className="text-sm italic mb-1">Đường Hoàng Sa, phường Sơn Trà, thành phố Đà Nẵng</p>
                    <p className="text-sm">Tel: 0236 3924957 - Fax: 0236 3924956</p>
                    <p className="text-sm">Email: phcn2.mrcc@gmail.com</p>
                </div>
            </div>

            {/* Ref & Date */}
            <div className="flex justify-between items-end mb-8 text-sm">
                <div>
                    <span className="font-bold">Số:</span> {data.sarReport.refNumber || "85/01/TKCNII-PHCN"}
                </div>
                <div className="italic">
                    {data.sarReport.dateLocation || "Đà Nẵng, ... giờ ... phút, Ngày ... tháng ... năm ..."}
                </div>
            </div>

            {/* Title */}
            <h1 className="text-center text-xl font-bold uppercase mb-6">
                THÔNG TIN TÌM KIẾM CỨU NẠN TRÊN BIỂN
            </h1>

            {/* Recipient */}
            <div className="mb-4 text-sm flex">
                <span className="font-bold w-20 shrink-0">Kính gửi:</span>
                <span>{data.sarReport.recipient}</span>
            </div>

            {/* Intro */}
            <p className="mb-4 text-sm text-justify indent-8">
                {data.sarReport.intro}
            </p>

            {/* Main Content Sections */}
            <div className="space-y-4 text-sm text-justify">
                <div>
                    <h4 className="font-bold mb-1">1. Nội dung:</h4>
                    <div className="whitespace-pre-wrap pl-4">{data.sarReport.content}</div>
                </div>
                
                <div>
                    <h4 className="font-bold mb-1">2. Biện pháp xử lý:</h4>
                    <div className="whitespace-pre-wrap pl-4">{data.sarReport.measures}</div>
                </div>

                <div>
                    <h4 className="font-bold mb-1">3. Đề nghị:</h4>
                    <div className="whitespace-pre-wrap pl-4">{data.sarReport.proposal}</div>
                </div>

                <div>
                    <h4 className="font-bold mb-1">4. Tài liệu kèm theo:</h4>
                    <div className="whitespace-pre-wrap pl-4">{data.sarReport.attachedFiles || "(Không có)"}</div>
                </div>
            </div>

            {/* Footer Signatures */}
            <div className="flex justify-between mt-16 text-center text-sm">
                <div className="w-1/3">
                    <p className="font-bold italic mb-1">Nơi nhận:</p>
                    <ul className="text-left pl-8 list-dash text-xs space-y-1">
                        <li>Như trên;</li>
                        <li>Lưu: PHCNII.</li>
                    </ul>
                    
                    <div className="mt-8">
                        <p className="font-bold uppercase mb-16">{data.sarReport.signerLeft || "TRỰC BAN"}</p>
                        <p className="font-signature text-xl">Signed</p>
                    </div>
                </div>
                
                <div className="w-1/3">
                    <p className="font-bold uppercase mb-1">{data.sarReport.signerRight || "KT. GIÁM ĐỐC"}</p>
                    <p className="font-bold uppercase mb-16">PHÓ GIÁM ĐỐC</p>
                    
                    <div className="relative inline-block">
                         {/* Mock Stamp */}
                         <div className="absolute -top-6 -left-4 w-32 h-32 border-4 border-red-600 rounded-full opacity-40 rotate-[-15deg] pointer-events-none"></div>
                         <p className="font-signature text-3xl text-blue-900 mb-2">Signed</p>
                         <p className="font-bold uppercase">{data.sarReport.signerNameRight || "Phan Thành Trường"}</p>
                    </div>
                </div>
            </div>

        </div>
      )}
    </div>
  );
};

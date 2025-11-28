import React, { useState } from 'react';
import { InvoiceData } from '../types';
import { CheckCircle2, FileSpreadsheet, Copy, FileJson, Check, AlertTriangle, Calculator } from 'lucide-react';
import * as XLSX from 'xlsx';

interface InvoiceViewerProps {
  data: InvoiceData;
}

export const InvoiceViewer: React.FC<InvoiceViewerProps> = ({ data }) => {
  const [copied, setCopied] = useState(false);

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '-';
    return new Intl.NumberFormat('vi-VN').format(num);
  };

  // --- VALIDATION LOGIC ---
  const validateLineItem = (item: any) => {
    if (!item.quantity || !item.unitPrice || !item.amount) return { isValid: true, diff: 0 };
    
    const calculated = item.quantity * item.unitPrice;
    const diff = Math.abs(calculated - item.amount);
    return {
        isValid: diff < 100,
        calculated: calculated,
        diff: diff
    };
  };

  const calculateTotalGoods = () => {
    return data.items.reduce((sum, item) => sum + (item.amount || 0), 0);
  };

  const totalGoodsCalculated = calculateTotalGoods();
  const totalGoodsDiff = Math.abs(totalGoodsCalculated - (data.totalAmount || 0));
  const isTotalGoodsValid = totalGoodsDiff < 100;

  // --- EXPORT LOGIC ---
  const exportToExcel = () => {
    if (!data.items || data.items.length === 0) return;

    const rows = [];
    rows.push(["CÔNG TY / ĐƠN VỊ BÁN HÀNG"]);
    rows.push([data.sellerName?.toUpperCase() || ""]);
    rows.push(["Mã số thuế:", data.sellerTaxCode]);
    rows.push(["Địa chỉ:", data.sellerAddress]);
    rows.push(["Điện thoại:", data.sellerPhoneNumber]);
    if (data.sellerBankAccount) {
        rows.push(["Số tài khoản:", data.sellerBankAccount]);
    }
    rows.push([]); 

    rows.push(["HÓA ĐƠN GIÁ TRỊ GIA TĂNG"]);
    rows.push([`Số: ${data.invoiceNo} - Ký hiệu: ${data.invoiceSymbol} - Ngày: ${data.date}`]);
    rows.push([]); 

    rows.push(["THÔNG TIN NGƯỜI MUA HÀNG"]); 
    rows.push(["Mã KH:", data.buyerCustomerId, "Kỳ cước:", data.billingPeriod]);
    rows.push(["Họ tên người mua:", data.buyerName]);
    rows.push(["Tên đơn vị:", data.buyerCompanyName]);
    rows.push(["Mã số thuế:", data.buyerTaxCode, "Mã ĐVQHNS:", data.buyerBudgetCode]);
    rows.push(["Số định danh cá nhân:", data.buyerPersonalId, "Số hộ chiếu:", data.buyerPassportNo]);
    rows.push(["Địa chỉ:", data.buyerAddress]);
    rows.push(["Số tài khoản:", data.buyerBankAccount]);
    rows.push(["Hình thức thanh toán:", data.paymentMethod]);
    rows.push([]); 

    rows.push(["STT", "Tên hàng hóa, dịch vụ", "Đơn vị tính", "Số lượng", "Đơn giá", "Thành tiền"]);

    data.items.forEach(item => {
      rows.push([
        item.no,
        item.description,
        item.unit,
        item.quantity,
        item.unitPrice,
        item.amount
      ]);
    });

    rows.push(["", "", "", "", "Cộng tiền hàng:", data.totalAmount]);
    rows.push(["", "", "", "", `Thuế suất GTGT (${data.vatRate || ''}):`, data.vatAmount]);
    rows.push(["", "", "", "", "Tổng tiền thanh toán:", data.totalPayment]);
    rows.push(["Số tiền viết bằng chữ:", data.amountInWords]);
    rows.push([]);

    rows.push(["NGƯỜI MUA HÀNG", "", "", "", "NGƯỜI BÁN HÀNG"]);
    rows.push(["(Ký, ghi rõ họ, tên)", "", "", "", "(Ký, đóng dấu, ghi rõ họ, tên)"]);
    rows.push([]);
    rows.push([]);
    rows.push(["", "", "", "", `Ký bởi: ${data.signedBy || ''}`]);
    rows.push(["", "", "", "", `Ký ngày: ${data.signedDate || ''}`]);
    
    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    worksheet['!cols'] = [
      { wch: 5 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 },
    ];
    worksheet['!merges'] = [{ s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }];

    Object.keys(worksheet).forEach(cellRef => {
        if(cellRef.indexOf('!') === 0) return;
        const cell = worksheet[cellRef];
        if (cell.t === 'n') cell.z = '#,##0';
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "HoaDon_Vishipel");
    const fileName = `Vishipel_${data.invoiceNo || 'Invoice'}_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const handleCopy = () => {
    let html = `<table border="1" style="border-collapse: collapse; border: 1px solid black;">
      <tr><td colspan="6"><b>${data.sellerName}</b></td></tr>
      <tr><td>MST:</td><td colspan="5">${data.sellerTaxCode}</td></tr>
      <tr><td colspan="6"><b>KHÁCH HÀNG: ${data.buyerCompanyName}</b></td></tr>
      <tr><td><b>STT</b></td><td><b>Tên hàng hóa, dịch vụ</b></td><td><b>ĐVT</b></td><td><b>SL</b></td><td><b>Đơn giá</b></td><td><b>Thành tiền</b></td></tr>`;
    data.items.forEach(item => {
      html += `<tr><td>${item.no || ''}</td><td>${item.description}</td><td>${item.unit || ''}</td><td>${item.quantity}</td><td>${formatNumber(item.unitPrice)}</td><td>${formatNumber(item.amount)}</td></tr>`;
    });
    html += `<tr><td colspan="5" align="right"><b>Cộng tiền hàng:</b></td><td>${formatNumber(data.totalAmount)}</td></tr>`;
    html += `</table>`;
    
    const blob = new Blob([html], { type: 'text/html' });
    const textBlob = new Blob([data.items.map(i => `${i.description}\t${i.amount}`).join('\n')], { type: 'text/plain' });
    navigator.clipboard.write([new ClipboardItem({ 'text/html': blob, 'text/plain': textBlob })]).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const exportToJSON = () => {
    const jsonString = JSON.stringify(data, null, 2);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([jsonString], { type: 'application/json' }));
    link.download = `Vishipel_${data.invoiceNo || 'data'}.json`;
    link.click();
  };

  return (
    <div className="bg-slate-100 h-full overflow-y-auto p-4 md:p-8 font-official text-slate-900">
      
      {/* Toolbar */}
      <div className="max-w-5xl mx-auto mb-4 flex flex-wrap justify-end gap-2 print:hidden font-sans">
        <button onClick={handleCopy} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded shadow-sm">
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />} {copied ? 'Đã sao chép' : 'Copy Bảng'}
        </button>
        <button onClick={exportToJSON} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded shadow-sm">
            <FileJson className="w-4 h-4 text-orange-600" /> JSON
        </button>
        <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded shadow">
            <FileSpreadsheet className="w-4 h-4" /> Xuất Excel (.xlsx)
        </button>
      </div>

      {/* Invoice Paper Representation */}
      <div className="max-w-5xl mx-auto bg-white shadow-xl p-8 min-h-[1000px] relative text-slate-900 leading-snug">
        
        {/* Header Section */}
        <div className="border-b-2 border-dotted border-slate-300 pb-4 mb-4">
            <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                    <h1 className="text-xl md:text-2xl font-bold text-blue-900 uppercase mb-2">{data.sellerName || "..."}</h1>
                    <div className="space-y-1 text-sm text-slate-700">
                        <p><span className="font-bold">Mã số thuế:</span> {data.sellerTaxCode}</p>
                        <p><span className="font-bold">Địa chỉ:</span> {data.sellerAddress}</p>
                        {data.sellerPhoneNumber && <p><span className="font-bold">Điện thoại:</span> {data.sellerPhoneNumber}</p>}
                        {data.sellerBankAccount && <p><span className="font-bold">Số tài khoản:</span> {data.sellerBankAccount}</p>}
                    </div>
                </div>
                <div className="w-64 text-right shrink-0">
                    <div className="bg-slate-50 p-4 border border-slate-200 rounded text-center">
                        <p className="text-lg font-bold text-red-600 uppercase mb-1">Hóa đơn GTGT</p>
                        <p className="text-sm font-bold">Số: <span className="text-red-600 text-base">{data.invoiceNo || "..."}</span></p>
                        <p className="text-sm text-slate-500">Ký hiệu: {data.invoiceSymbol}</p>
                        <p className="text-sm text-slate-500 mt-1 pt-1 border-t border-slate-200">{data.date}</p>
                    </div>
                </div>
            </div>
        </div>

        {/* Buyer Section */}
        <div className="mb-6 text-sm">
            <h3 className="text-slate-900 font-bold uppercase border-b border-slate-300 mb-2 pb-1 inline-block">Thông tin người mua hàng</h3>
            
            <div className="grid grid-cols-12 gap-x-4 gap-y-2">
                <div className="col-span-12 md:col-span-6 flex items-baseline">
                    <span className="w-24 font-bold text-slate-700 shrink-0">Mã KH:</span>
                    <span className="font-mono bg-yellow-50 px-1">{data.buyerCustomerId || '---'}</span>
                </div>
                 <div className="col-span-12 md:col-span-6 flex items-baseline">
                    <span className="w-24 font-bold text-slate-700 shrink-0">Kỳ cước:</span>
                    <span className="font-semibold">{data.billingPeriod || '---'}</span>
                </div>

                <div className="col-span-12 md:col-span-8 flex items-baseline">
                     <span className="w-32 font-bold text-slate-700 shrink-0">Tên đơn vị:</span>
                     <span className="uppercase font-bold text-blue-900">{data.buyerCompanyName}</span>
                </div>
                <div className="col-span-12 md:col-span-4 flex items-baseline">
                     <span className="w-24 font-bold text-slate-700 shrink-0">Người mua:</span>
                     <span>{data.buyerName}</span>
                </div>

                <div className="col-span-12 md:col-span-4 flex items-baseline">
                    <span className="w-24 font-bold text-slate-700 shrink-0">Mã số thuế:</span>
                    <span className="font-mono font-bold tracking-wider">{data.buyerTaxCode}</span>
                </div>
                <div className="col-span-12 md:col-span-4 flex items-baseline">
                     <span className="w-24 font-bold text-slate-700 shrink-0">Mã ĐVQHNS:</span>
                     <span className="font-mono">{data.buyerBudgetCode || '---'}</span>
                </div>
                <div className="col-span-12 md:col-span-4 flex items-baseline">
                     <span className="w-24 font-bold text-slate-700 shrink-0">Hình thức TT:</span>
                     <span>{data.paymentMethod}</span>
                </div>

                <div className="col-span-12 md:col-span-4 flex items-baseline">
                    <span className="w-24 font-bold text-slate-700 shrink-0">Số định danh:</span>
                    <span>{data.buyerPersonalId || '---'}</span>
                </div>
                 <div className="col-span-12 md:col-span-8 flex items-baseline">
                    <span className="w-24 font-bold text-slate-700 shrink-0">Hộ chiếu:</span>
                    <span>{data.buyerPassportNo || '---'}</span>
                </div>
                <div className="col-span-12 flex items-baseline">
                    <span className="w-24 font-bold text-slate-700 shrink-0">Địa chỉ:</span>
                    <span>{data.buyerAddress}</span>
                </div>
                <div className="col-span-12 flex items-baseline">
                    <span className="w-24 font-bold text-slate-700 shrink-0">Số tài khoản:</span>
                    <span>{data.buyerBankAccount || '---'}</span>
                </div>
            </div>
        </div>

        {/* Table Section */}
        <div className="mb-6">
            <table className="w-full border-collapse border border-slate-400 text-sm">
                <thead>
                    <tr className="bg-blue-100 text-blue-900 text-center font-bold uppercase">
                        <th className="border border-slate-400 py-3 px-1 w-10">STT</th>
                        <th className="border border-slate-400 py-3 px-2">Tên hàng hóa, dịch vụ</th>
                        <th className="border border-slate-400 py-3 px-1 w-20">ĐVT</th>
                        <th className="border border-slate-400 py-3 px-1 w-20">Số lượng</th>
                        <th className="border border-slate-400 py-3 px-2 w-32">Đơn giá</th>
                        <th className="border border-slate-400 py-3 px-2 w-40">Thành tiền</th>
                    </tr>
                </thead>
                <tbody>
                    {data.items && data.items.map((item, idx) => {
                        const validation = validateLineItem(item);
                        return (
                            <tr key={idx} className={`hover:bg-blue-50/30 ${!validation.isValid ? 'bg-red-50' : ''}`}>
                                <td className="border border-slate-400 py-2 px-1 text-center align-top">{item.no || idx + 1}</td>
                                <td className="border border-slate-400 py-2 px-2 align-top font-medium">{item.description}</td>
                                <td className="border border-slate-400 py-2 px-1 text-center align-top">{item.unit}</td>
                                <td className="border border-slate-400 py-2 px-1 text-center align-top">{item.quantity}</td>
                                <td className="border border-slate-400 py-2 px-2 text-right align-top">{formatNumber(item.unitPrice)}</td>
                                <td className="border border-slate-400 py-2 px-2 text-right font-bold align-top relative group">
                                    {formatNumber(item.amount)}
                                    {!validation.isValid && (
                                        <div className="absolute right-0 top-0 -mt-1 -mr-1">
                                            <AlertTriangle className="w-4 h-4 text-red-500 fill-white" />
                                            <div className="hidden group-hover:block absolute right-0 bottom-full mb-1 w-64 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10 font-sans">
                                                <p className="font-bold border-b border-slate-600 pb-1 mb-1 text-red-300">Sai lệch số học!</p>
                                                <p>SL x ĐG = {formatNumber(validation.calculated)}</p>
                                                <p>Hóa đơn = {formatNumber(item.amount)}</p>
                                            </div>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                    {(!data.items || data.items.length < 5) && Array.from({ length: 5 - (data.items?.length || 0) }).map((_, i) => (
                        <tr key={`empty-${i}`}>
                            <td className="border border-slate-400 py-4">&nbsp;</td>
                            <td className="border border-slate-400">&nbsp;</td>
                            <td className="border border-slate-400">&nbsp;</td>
                            <td className="border border-slate-400">&nbsp;</td>
                            <td className="border border-slate-400">&nbsp;</td>
                            <td className="border border-slate-400">&nbsp;</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="font-bold text-slate-800">
                    <tr>
                        <td colSpan={5} className="border border-slate-400 py-2 px-4 text-right">Cộng tiền hàng:</td>
                        <td className={`border border-slate-400 py-2 px-2 text-right ${!isTotalGoodsValid ? 'bg-red-50 text-red-600' : ''}`}>
                             {formatNumber(data.totalAmount)}
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={5} className="border border-slate-400 py-2 px-4 text-right">
                            Tiền thuế GTGT <span className="font-normal italic">({data.vatRate || '...%'}):</span>
                        </td>
                        <td className="border border-slate-400 py-2 px-2 text-right">{formatNumber(data.vatAmount)}</td>
                    </tr>
                    <tr>
                        <td colSpan={5} className="border border-slate-400 py-2 px-4 text-right uppercase">Tổng tiền thanh toán:</td>
                        <td className="border border-slate-400 py-2 px-2 text-right text-lg text-blue-800">{formatNumber(data.totalPayment)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>

        <div className="mb-8 font-medium">
            <span className="italic">Số tiền viết bằng chữ: </span> 
            <span className="font-bold text-slate-800">{data.amountInWords}</span>
        </div>

        <div className="grid grid-cols-2 gap-8 mt-4 text-center">
            <div>
                <p className="font-bold text-slate-800 uppercase text-sm">Người mua hàng</p>
                <p className="text-xs text-slate-500 italic mb-8">(Ký, ghi rõ họ, tên)</p>
                <p className="font-signature text-2xl text-slate-700">{data.buyerName || "Signed"}</p>
            </div>
            <div className="flex flex-col items-center">
                <p className="font-bold text-slate-800 uppercase text-sm">Người bán hàng</p>
                <p className="text-xs text-slate-500 italic mb-4">(Ký, đóng dấu, ghi rõ họ, tên)</p>
                
                <div className="p-3 border-4 double border-red-500 text-red-500 text-left w-64 max-w-full relative rounded-sm">
                    <div className="absolute top-0 right-0 -mt-3 -mr-3 bg-white px-1">
                        <CheckCircle2 size={20} fill="white" className="text-red-500"/>
                    </div>
                    <p className="font-bold uppercase text-sm mb-1 text-center border-b border-red-400 pb-1">Signature Valid</p>
                    <p className="text-xs font-semibold mt-2">Ký bởi: <span className="uppercase font-normal">{data.signedBy || "CÔNG TY..."}</span></p>
                    <p className="text-xs font-semibold">Ký ngày: <span className="font-normal">{data.signedDate || "..."}</span></p>
                </div>
            </div>
        </div>
        
        {(data.lookupWebsite || data.lookupCode) && (
          <div className="mt-12 pt-4 border-t border-slate-300 text-center text-xs text-slate-600 italic font-sans">
            <p className="mb-1">(Cần kiểm tra, đối chiếu khi lập, giao, nhận hóa đơn)</p>
            <p>Tra cứu hóa đơn tại website: <span className="font-bold text-blue-700">{data.lookupWebsite}</span> | Mã tra cứu: <span className="font-bold text-slate-900">{data.lookupCode}</span></p>
          </div>
        )}

        <div className="mt-8 bg-slate-50 p-4 rounded border border-slate-200 text-sm font-sans">
            <div className="flex items-center gap-2 font-bold text-slate-700 mb-2">
                <Calculator className="w-4 h-4" /> Kết quả kiểm tra tự động (Auto-Audit)
            </div>
            <ul className="space-y-1">
                <li className={`flex items-center gap-2 ${isTotalGoodsValid ? 'text-green-600' : 'text-red-600'}`}>
                    {isTotalGoodsValid ? <Check className="w-4 h-4"/> : <AlertTriangle className="w-4 h-4"/>}
                    {isTotalGoodsValid ? 'Tổng chi tiết khớp với Cộng tiền hàng.' : 'Cảnh báo: Tổng chi tiết lệch so với Tổng hóa đơn.'}
                </li>
            </ul>
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto mt-4 text-center text-slate-400 text-sm pb-8 font-sans">
        Vishipel AI © 2025 - Smart OCR Accounting
      </div>
    </div>
  );
};
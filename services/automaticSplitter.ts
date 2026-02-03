import { PDFDocument } from 'pdf-lib';
import { FormDetectionResult, PageFormInfo } from '../types';

/**
 * XÁC ĐỊNH ĐƯỜNG DẪN THƯ MỤC DỰA TRÊN SERVICE VÀ SUBTYPE
 * CHÚ Ý: Sử dụng tên KHÔNG DẤU để khớp với cấu trúc thư mục của người dùng.
 */
export const getFolderPath = (page: PageFormInfo, groupService: string | null, groupSubType: string | null): string[] => {
    const code = page.formCode?.toUpperCase() || '';
    const service = groupService || 'OTHER';
    const subType = groupSubType || 'OTHER';
    const type = page.pageType;

    // 1. Phân phối BM.01 (COVER)
    if (code.includes('BM.01')) {
        const subFolder = (type === 'KTKS') ? 'KTKSTC BM 01' : 'COVER';
        return ['COVER', subFolder, subType];
    }

    // 2. LOG / BANTINNGUON
    if (type === 'LOG') {
        return ['LOG FTP', subType];
    }
    if (type === 'BANTINNGUON') {
        return ['BAN TIN NGUON', subType];
    }

    // 3. Xác định Service Folder
    let serviceFolder = 'DICH VU RTP';
    if (service === 'EGC') serviceFolder = 'DICH VU EGC';
    else if (service === 'NTX') serviceFolder = 'DICH VU NTX';

    // 4. BM.04: KIEM TRA KIEM SOAT SAU PHAT
    if (code.includes('BM.04')) {
        const parentFolder = (service === 'EGC') ? 'BAN TIN NGUON DA DUOC XU LY EGC' : 'BAN TIN NGUON DA DUOC XU LY';
        const subFolder = 'KIEM TRA KIEM SOAT SAU PHAT';
        return [serviceFolder, parentFolder, subFolder, subType];
    }

    // 5. BM.02: BAN TIN NGUON DA DUOC XU LY
    if (code.includes('BM.02')) {
        const parentFolder = (service === 'EGC') ? 'BAN TIN NGUON DA DUOC XU LY EGC' : 'BAN TIN NGUON DA DUOC XU LY';
        if (type === 'KTKS') {
            const subFolder = (service === 'EGC') ? 'KTKS TAI CHO BAN TIN NGUON XU LY EGC' : 'KTKSTC BAN TIN NGUON DA DUOC XU LY';
            return [serviceFolder, parentFolder, subFolder, subType];
        } else {
            // Theo mẫu JSON trực quan: BM.02 QT cũng có 4 cấp (Lặp lại parentFolder)
            return [serviceFolder, parentFolder, parentFolder, subType];
        }
    }

    // 6. BM.03: BAN TIN XU LY PHAT
    if (code.includes('BM.03')) {
        const parentFolder = 'BAN TIN XU LY PHAT';
        const subFolder = (type === 'KTKS') ? 'KTKSTC BAN TIN XU LY TRUOC KHI PHAT' : 'BAN TIN XU LY TRUOC KHI PHAT';
        return [serviceFolder, parentFolder, subFolder, subType];
    }

    // Fallback nếu có service
    if (service !== 'OTHER') {
        return [serviceFolder, subType];
    }

    return ['UNCLASSIFIED'];
};

/**
 * HÀM TÁCH PDF TỰ ĐỘNG VÀO THƯ MỤC
 */
export const autoSplitPdf = async (
    file: File,
    detectionResult: FormDetectionResult,
    rootDirHandle: FileSystemDirectoryHandle
): Promise<{ success: number; failed: number; details: string[] }> => {
    const results = {
        success: 0,
        failed: 0,
        details: [] as string[],
        manifest: {
            documents: [] as any[],
            logs: [] as any[]
        }
    };

    try {
        const existingPdfBytes = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(existingPdfBytes);

        // --- TINH CHỈNH SUBTYPE (AUTHORITATIVE SMOOTHING) ---
        // Ưu tiên subtype từ các trang nội dung (BM.02+) hoặc Bản tin nguồn để ghi đè lên trang bìa (BM.01) bị gán sai hoặc OTHER.
        for (let i = 0; i < detectionResult.pages.length; i++) {
            const page = detectionResult.pages[i];
            // Trang được coi là "yếu" (cần bổ sung/sửa lại) nếu là OTHER hoặc là trang bìa BM.01/KTKS
            const isWeak = !page.subType || page.subType === 'OTHER' || (page.formCode && (page.formCode.includes('BM.01') || page.pageType === 'KTKS'));

            if (isWeak) {
                let authoritativeSubType: any = null;
                // Tìm phía sau (Look ahead) - BM.02+ thường nằm sau BM.01
                for (let j = i + 1; j < Math.min(i + 20, detectionResult.pages.length); j++) {
                    const nextP = detectionResult.pages[j];
                    const isStrong = nextP.subType && nextP.subType !== 'OTHER' &&
                        (nextP.pageType === 'BANTINNGUON' || (nextP.formCode && !nextP.formCode.includes('BM.01')));

                    if (isStrong) {
                        authoritativeSubType = nextP.subType;
                        break;
                    }
                }

                // Tìm phía trước (Look back) nếu phía sau không thấy
                if (!authoritativeSubType) {
                    for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
                        const prevP = detectionResult.pages[j];
                        if (prevP.subType && prevP.subType !== 'OTHER') {
                            authoritativeSubType = prevP.subType;
                            break;
                        }
                    }
                }

                if (authoritativeSubType) {
                    detectionResult.pages[i].subType = authoritativeSubType;
                }
            }
        }

        // Nhóm các trang theo Header
        const groups: Array<{ formCode: string | null; serviceType: string | null; subType: string | null; pages: PageFormInfo[] }> = [];
        let currentGroup: { formCode: string | null; serviceType: string | null; subType: string | null; pages: PageFormInfo[] } | null = null;

        for (const page of detectionResult.pages) {
            // Logic tách file: Tách nếu có flag Header HOẶC type là Header/Screen mới
            const isForcedHeader = page.type === 'FORM_HEADER' || page.type === 'SOURCE_HEADER' || page.type === 'LOG_SCREEN';

            if (page.isFormHeader || isForcedHeader) {
                if (currentGroup) groups.push(currentGroup);
                currentGroup = { formCode: page.formCode, serviceType: page.serviceType, subType: page.subType, pages: [page] };
            } else {
                if (!currentGroup) {
                    currentGroup = { formCode: null, serviceType: page.serviceType, subType: page.subType, pages: [page] };
                } else {
                    currentGroup.pages.push(page);
                    if (!currentGroup.subType && page.subType) currentGroup.subType = page.subType;
                    if (!currentGroup.serviceType && page.serviceType) currentGroup.serviceType = page.serviceType;
                }
            }
        }
        if (currentGroup) groups.push(currentGroup);

        // Xử lý từng nhóm
        for (const group of groups) {
            try {
                const firstPage = group.pages[0];
                const folderPath = getFolderPath(firstPage, group.serviceType, group.subType);

                // Tên file gốc (bỏ extension)
                const originalBaseName = file.name.replace(/\.[^/.]+$/, "");
                const cleanCode = (group.formCode || firstPage.pageType).replace(/[^a-zA-Z0-9.-]/g, '_');

                let suffix = "";
                if (group.serviceType && group.serviceType !== 'OTHER') suffix += `_${group.serviceType}`;
                if (group.subType && group.subType !== 'OTHER') suffix += `_${group.subType}`;

                let fileNameBase = `${originalBaseName}_${cleanCode}${suffix}`;
                let fileName = `${fileNameBase}.pdf`;

                // Unique ID cho document
                const docId = Math.random().toString(36).substring(2, 11);

                // Đảm bảo thư mục tồn tại
                let currentDir = rootDirHandle;
                for (const folderName of folderPath) {
                    currentDir = await currentDir.getDirectoryHandle(folderName, { create: true });
                }

                // Kiểm tra trùng file và thêm số thứ tự, NHƯNG chỉ áp dụng cho BM.04 (hoặc formCode có 'BM.04')
                // Các form khác ghi đè (overwrite)
                let fileCounter = 1;
                let finalFileHandle;

                const isBM04 = (group.formCode && group.formCode.includes('BM.04')) || cleanCode.includes('BM_04');

                if (isBM04) {
                    while (true) {
                        try {
                            const checkName = fileCounter === 1 ? `${fileNameBase}.pdf` : `${fileNameBase} - ${fileCounter}.pdf`;
                            await currentDir.getFileHandle(checkName, { create: false });
                            fileCounter++;
                        } catch (e) {
                            const finalName = fileCounter === 1 ? `${fileNameBase}.pdf` : `${fileNameBase} - ${fileCounter}.pdf`;
                            finalFileHandle = await currentDir.getFileHandle(finalName, { create: true });
                            fileName = finalName;
                            break;
                        }
                    }
                } else {
                    // Không phải BM.04 -> Ghi đè file cũ nếu có
                    const finalName = `${fileNameBase}.pdf`;
                    finalFileHandle = await currentDir.getFileHandle(finalName, { create: true });
                    fileName = finalName;
                }

                // Tạo PDF con
                const newPdf = await PDFDocument.create();
                for (const p of group.pages) {
                    const [copiedPage] = await newPdf.copyPages(pdfDoc, [p.page - 1]);
                    newPdf.addPage(copiedPage);
                }

                const pdfBytes = await newPdf.save();
                const writable = await finalFileHandle.createWritable();
                await (writable as any).write(pdfBytes);
                await writable.close();

                results.success++;
                results.details.push(`[OK] Saved ${fileName} to ${folderPath.join('/')}`);

                // Phân loại vào manifest (Documents vs Logs)
                const docEntry = {
                    id: docId,
                    filename: fileName,
                    code: group.formCode,
                    serviceCode: group.serviceType,
                    startPage: group.pages[0].page,
                    endPage: group.pages[group.pages.length - 1].page,
                    pageCount: group.pages.length,
                    recommendedPath: folderPath.join('/')
                };

                if (firstPage.pageType === 'LOG') {
                    results.manifest.logs.push({
                        filename: fileName,
                        page: firstPage.page,
                        sourceDocumentId: "",
                        recommendedPath: folderPath.join('/')
                    });
                } else {
                    results.manifest.documents.push(docEntry);
                }
            } catch (err: any) {
                results.failed++;
                results.details.push(`[Error] Failed to save group ${group.formCode}: ${err.message}`);
            }
        }

    } catch (error: any) {
        console.error("Auto Split Critical Error:", error);
        results.details.push(`Critical Error: ${error.message}`);
    }

    // Ghi file manifest JSON vào folder TEMP_EXTRACT
    try {
        const originalBaseName = file.name.replace(/\.[^/.]+$/, "");
        const cleanBaseName = originalBaseName.replace(/[^a-zA-Z0-9.-]/g, '_');

        // 1. Tạo folder TEMP_EXTRACT
        const tempParentDir = await rootDirHandle.getDirectoryHandle('TEMP_EXTRACT', { create: true });

        // 2. Tạo folder con theo tên file gốc (làm sạch tên để an toàn)
        const targetDir = await tempParentDir.getDirectoryHandle(cleanBaseName, { create: true });

        const manifestContent = {
            originalFileName: file.name,
            broadcastCode: null,
            serviceCode: detectionResult.pages[0]?.serviceType || 'OTHER',
            generatedAt: new Date().toISOString(),
            documents: results.manifest.documents,
            logs: results.manifest.logs,
            analysis: {
                broadcastCode: null,
                serviceCode: null,
                pages: detectionResult.pages.map(p => ({
                    page: p.page,
                    type: p.type,
                    formCode: p.formCode,
                    serviceHint: p.serviceHint,
                    broadcastCode: p.broadcastCode,
                    isLogPage: p.isLogPage,
                    isBanTinNguonHeader: p.isBanTinNguon,
                }))
            }
        };

        const manifestHandle = await targetDir.getFileHandle('extraction-summary.json', { create: true });
        const writable = await manifestHandle.createWritable();
        await (writable as any).write(JSON.stringify(manifestContent, null, 2));
        await writable.close();
        results.details.push(`[INFO] Created extraction-summary.json in TEMP_EXTRACT/${cleanBaseName}`);
    } catch (e: any) {
        console.error("Failed to write manifest:", e);
        results.details.push(`[Error] Manifest folder creation failed: ${e.message}`);
    }

    return results;
};

import React, { useMemo } from 'react';
import { FormDetectionResult, PageFormInfo } from '../types';
import { getFolderPath } from '../services/automaticSplitter';
import { Folder, FileCode, ChevronRight, ChevronDown } from 'lucide-react';

interface DirectoryTreeProps {
    data: FormDetectionResult;
    originalFileName: string;
}

interface TreeNode {
    name: string;
    type: 'file' | 'folder';
    children?: Record<string, TreeNode>;
    fileInfo?: {
        pages: number[];
        formCode: string | null;
        subType: string | null;
    };
}

export const DirectoryTree: React.FC<DirectoryTreeProps> = ({ data, originalFileName }) => {
    // 1. Build the tree structure from data
    const tree = useMemo(() => {
        const root: TreeNode = { name: 'root', type: 'folder', children: {} };
        const cleanBaseName = originalFileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9.-]/g, '_');

        // Group pages first (Duplicate logic from SimpleFormViewer/automaticSplitter)
        const groups: Array<{ formCode: string | null; serviceType: string | null; subType: string | null; pages: PageFormInfo[] }> = [];
        let currentGroup: { formCode: string | null; serviceType: string | null; subType: string | null; pages: PageFormInfo[] } | null = null;

        // Apply Smoothing Logic (Simplified for Preview - should match automaticSplitter)
        const pages = JSON.parse(JSON.stringify(data.pages)) as PageFormInfo[]; // Deep copy

        // --- SMOOTHING LOGIC (COPIED FROM AUTOMATIC SPLITTER) ---
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const isWeak = !page.subType || page.subType === 'OTHER' || (page.formCode && (page.formCode.includes('BM.01') || page.pageType === 'KTKS'));

            if (isWeak) {
                let authoritativeSubType: any = null;
                // Look ahead
                for (let j = i + 1; j < Math.min(i + 20, pages.length); j++) {
                    const nextP = pages[j];
                    const isStrong = nextP.subType && nextP.subType !== 'OTHER' &&
                        (nextP.pageType === 'BANTINNGUON' || (nextP.formCode && !nextP.formCode.includes('BM.01')));
                    if (isStrong) {
                        authoritativeSubType = nextP.subType;
                        break;
                    }
                }
                // Look back
                if (!authoritativeSubType) {
                    for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
                        const prevP = pages[j];
                        if (prevP.subType && prevP.subType !== 'OTHER') {
                            authoritativeSubType = prevP.subType;
                            break;
                        }
                    }
                }
                if (authoritativeSubType) {
                    pages[i].subType = authoritativeSubType;
                }
            }
        }
        // --- END SMOOTHING ---


        for (const page of pages) {
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

        // Populate Tree
        const fileCounts: Record<string, number> = {};

        groups.forEach(group => {
            const firstPage = group.pages[0];
            const folderPath = getFolderPath(firstPage, group.serviceType, group.subType);
            const cleanCode = (group.formCode || firstPage.pageType).replace(/[^a-zA-Z0-9.-]/g, '_');

            let suffix = "";
            if (group.serviceType && group.serviceType !== 'OTHER') suffix += `_${group.serviceType}`;
            if (group.subType && group.subType !== 'OTHER') suffix += `_${group.subType}`;

            const fileBaseName = `${cleanBaseName}_${cleanCode}${suffix}.pdf`;

            // Handle duplicate names for preview
            let fileName = fileBaseName;

            // Check for BM.04 logic (Same as automaticSplitter)
            const isBM04 = (group.formCode && group.formCode.includes('BM.04')) || cleanCode.includes('BM_04');

            if (fileCounts[fileBaseName]) {
                if (isBM04) {
                    fileCounts[fileBaseName]++;
                    fileName = `${cleanBaseName}_${cleanCode} - ${fileCounts[fileBaseName]}.pdf`;
                } else {
                    // Overwrite behavior: Keep the same name. 
                    // This will cause the key in `currentNode.children` to be overwritten by the latest group,
                    // effectively simulating the file overwrite.
                    fileName = fileBaseName;
                }
            } else {
                fileCounts[fileBaseName] = 1;
            }

            let currentNode = root;

            // Navigate/Create folders
            folderPath.forEach(folderName => {
                if (!currentNode.children![folderName]) {
                    currentNode.children![folderName] = {
                        name: folderName,
                        type: 'folder',
                        children: {}
                    };
                }
                currentNode = currentNode.children![folderName];
            });

            // Add File
            currentNode.children![fileName] = {
                name: fileName,
                type: 'file',
                fileInfo: {
                    pages: group.pages.map(p => p.page),
                    formCode: group.formCode,
                    subType: group.subType
                }
            };
        });

        return root;
    }, [data, originalFileName]);

    // Recursive Tree Renderer
    const renderNode = (node: TreeNode, depth: number = 0) => {
        const isRoot = node.name === 'root';
        const paddingLeft = depth * 16;

        // Sort: Folders first, then Files
        const childrenKeys = node.children ? Object.keys(node.children).sort((a, b) => {
            const childA = node.children![a];
            const childB = node.children![b];
            if (childA.type !== childB.type) return childA.type === 'folder' ? -1 : 1;
            return a.localeCompare(b);
        }) : [];

        if (isRoot) {
            return (
                <div className="space-y-1">
                    {childrenKeys.map(key => renderNode(node.children![key], 0))}
                </div>
            );
        }

        return (
            <div key={node.name}>
                <div
                    className={`flex items-start gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-100 transition-colors select-none ${node.type === 'file' ? 'cursor-pointer' : ''}`}
                    style={{ marginLeft: `${depth * 12}px` }}
                >
                    {node.type === 'folder' ? (
                        <Folder size={16} className="text-blue-500 fill-blue-500/20 shrink-0 mt-0.5" />
                    ) : (
                        <FileCode size={16} className="text-slate-400 shrink-0 mt-0.5" />
                    )}

                    <div className="flex flex-col min-w-0">
                        <span className={`text-xs truncate ${node.type === 'folder' ? 'font-bold text-slate-700' : 'font-medium text-slate-600'}`}>
                            {node.name}
                        </span>
                        {node.type === 'file' && node.fileInfo && (
                            <span className="text-[9px] text-slate-400">
                                {node.fileInfo.pages.length} trang • {node.fileInfo.subType}
                            </span>
                        )}
                    </div>
                </div>

                {node.children && (
                    <div className="border-l border-slate-200 ml-[11px] pl-1 relative">
                        {childrenKeys.map(key => renderNode(node.children![key], 0))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-white text-slate-900 border-l border-slate-200">
            <div className="p-4 border-b border-slate-200 bg-slate-50 sticky top-0 z-10 flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2">
                    <Folder className="text-amber-500" size={16} />
                    Cây Thư Mục
                </h3>
            </div>
            <div className="flex-1 overflow-auto p-4">
                {renderNode(tree)}
            </div>
        </div>
    );
};

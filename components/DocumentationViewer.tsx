import React, { useState, useEffect } from 'react';
import { BookOpen, FileText, Code, Zap, Database, Settings, Layers, Brain, Image, FolderTree, ArrowRight, CheckCircle, AlertCircle, Info, FolderOpen } from 'lucide-react';
import { requestDirectoryPicker, getOrCreateDirectory } from '../services/fileSaver';

interface MenuItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  subsections?: string[];
}

const menuItems: MenuItem[] = [
  {
    id: 'overview',
    title: 'Tổng Quan Hệ Thống',
    icon: <Layers size={18} />,
    subsections: ['Nhu Cầu Bài Toán', 'Kiến Trúc Tổng Quan', 'Flow Xử Lý']
  },
  {
    id: 'gemini',
    title: 'Tích Hợp Gemini AI',
    icon: <Brain size={18} />,
    subsections: ['Cấu Hình API', 'Các Hàm Phân Tích', 'Tối Ưu Hóa Rate Limit', 'Schema & Prompt']
  },
  {
    id: 'pdf-processing',
    title: 'Xử Lý PDF',
    icon: <FileText size={18} />,
    subsections: ['Convert PDF to Images', 'OCR & Text Extraction', 'Page Analysis']
  },
  {
    id: 'splitting-logic',
    title: 'Logic Tách File',
    icon: <Code size={18} />,
    subsections: ['State Machine', 'Breakpoints', 'Routing Logic', 'Folder Structure']
  },
  {
    id: 'file-management',
    title: 'Quản Lý File',
    icon: <FolderTree size={18} />,
    subsections: ['File System API', 'Directory Structure', 'Sync & Save']
  },
  {
    id: 'job-queue',
    title: 'Job Queue System',
    icon: <Zap size={18} />,
    subsections: ['Queue Management', 'Progress Tracking', 'Error Handling']
  },
  {
    id: 'architecture',
    title: 'Kiến Trúc Chi Tiết',
    icon: <Database size={18} />,
    subsections: ['Component Structure', 'Service Layer', 'Type Definitions']
  },
  {
    id: 'troubleshooting',
    title: 'Xử Lý Sự Cố',
    icon: <AlertCircle size={18} />,
    subsections: ['Common Issues', 'Debug Tips', 'Performance']
  }
];

export const DocumentationViewer: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [activeSubsection, setActiveSubsection] = useState<string | null>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToSubsection = (subsectionName: string) => {
    setTimeout(() => {
      // Map subsection names to IDs
      const subsectionIdMap: { [key: string]: string } = {
        'Nhu Cầu Bài Toán': 'nhu-cau-bai-toan',
        'Kiến Trúc Tổng Quan': 'kien-truc-tong-quan',
        'Flow Xử Lý': 'flow-xu-ly',
      };
      
      const subsectionId = subsectionIdMap[subsectionName] || subsectionName.toLowerCase().replace(/\s+/g, '-');
      const element = document.getElementById(subsectionId);
      if (element && contentRef.current) {
        const offset = 120; // Offset để không bị che bởi header
        const elementTop = element.offsetTop;
        const scrollContainer = contentRef.current;
        scrollContainer.scrollTo({
          top: elementTop - offset,
          behavior: 'smooth'
        });
      }
    }, 200);
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return <OverviewSection />;
      case 'gemini':
        return <GeminiSection />;
      case 'pdf-processing':
        return <PDFProcessingSection />;
      case 'splitting-logic':
        return <SplittingLogicSection />;
      case 'file-management':
        return <FileManagementSection />;
      case 'job-queue':
        return <JobQueueSection />;
      case 'architecture':
        return <ArchitectureSection />;
      case 'troubleshooting':
        return <TroubleshootingSection />;
      default:
        return <OverviewSection />;
    }
  };

  React.useEffect(() => {
    if (activeSubsection) {
      scrollToSubsection(activeSubsection);
    } else {
      scrollToTop();
    }
  }, [activeSection, activeSubsection]);

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left Sidebar Menu */}
      <aside className="w-80 shrink-0 glass-strong border-r border-slate-200 overflow-y-auto scrollbar-thin">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 glass bg-blue-50 rounded-lg border border-blue-200">
              <BookOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Hướng Dẫn</h2>
              <p className="text-xs text-slate-500">Tài liệu hệ thống</p>
            </div>
          </div>

          <nav className="space-y-1">
            {menuItems.map((item) => (
              <div key={item.id}>
                <button
                  onClick={() => {
                    setActiveSection(item.id);
                    setActiveSubsection(null);
                    scrollToTop();
                  }}
                  className={`w-full px-4 py-3 rounded-lg text-left transition-all flex items-center gap-3 ${
                    activeSection === item.id
                      ? 'glass-strong bg-blue-50 text-blue-700 font-semibold border-2 border-blue-300 shadow-md'
                      : 'glass-light text-slate-900 hover:text-blue-700 hover:bg-blue-50 border border-slate-200'
                  }`}
                >
                  {item.icon}
                  <span className="flex-1">{item.title}</span>
                  {activeSection === item.id && (
                    <ArrowRight className="w-4 h-4 text-blue-600" />
                  )}
                </button>
                {activeSection === item.id && item.subsections && (
                  <div className="ml-8 mt-2 space-y-1">
                    {item.subsections.map((sub, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setActiveSubsection(sub);
                        scrollToSubsection(sub);
                      }}
                      className={`w-full px-3 py-2 rounded text-sm transition-all text-left ${
                        activeSubsection === sub
                          ? 'text-blue-700 bg-blue-100 font-semibold border border-blue-300'
                          : 'text-slate-800 hover:text-blue-700 hover:bg-blue-50'
                      }`}
                    >
                      {sub}
                    </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto scrollbar-thin p-8">
        <div className="max-w-4xl mx-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

// ============ SECTION COMPONENTS ============

const OverviewSection: React.FC = () => {
  const [rootDirHandle, setRootDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [overviewImage, setOverviewImage] = useState<string>('');
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Load ảnh từ public/docs-images/ (sử dụng public URL)
  useEffect(() => {
    // Thử load từ public URL trước (khi đã deploy)
    const loadFromPublic = () => {
      // Overview image
      const overviewImg = document.createElement('img');
      overviewImg.onload = () => setOverviewImage('/docs-images/overview-image.jpg');
      overviewImg.onerror = () => {
        // Nếu không có trong public, thử load từ thư mục local
        loadFromLocal();
      };
      overviewImg.src = '/docs-images/overview-image.jpg';

      // Result images
      const resultUrls: string[] = [];
      let loadedCount = 0;
      for (let i = 1; i <= 6; i++) {
        const img = document.createElement('img');
        img.onload = () => {
          resultUrls[i - 1] = `/docs-images/result-${i}.jpg`;
          loadedCount++;
          if (loadedCount === 6) {
            setResultImages(resultUrls.filter(Boolean));
          }
        };
        img.onerror = () => {
          loadedCount++;
          if (loadedCount === 6) {
            setResultImages(resultUrls.filter(Boolean));
            // Nếu không có trong public, thử load từ local
            if (resultUrls.filter(Boolean).length === 0) {
              loadFromLocal();
            }
          }
        };
        img.src = `/docs-images/result-${i}.jpg`;
      }
    };

    // Load từ thư mục local (khi đang development và đã chọn thư mục)
    const loadFromLocal = async () => {
      if (!rootDirHandle) return;
      
      try {
        const docsDir = await getOrCreateDirectory(rootDirHandle, ['public', 'docs-images']);
        
        // Load overview image
        try {
          const overviewFile = await docsDir.getFileHandle('overview-image.jpg', { create: false });
          const file = await overviewFile.getFile();
          const reader = new FileReader();
          reader.onload = (e) => {
            setOverviewImage(e.target?.result as string);
          };
          reader.readAsDataURL(file);
        } catch {
          // File không tồn tại, bỏ qua
        }

        // Load result images
        const loadPromises: Promise<string | null>[] = [];
        for (let i = 1; i <= 6; i++) {
          const promise = (async () => {
            try {
              const resultFile = await docsDir.getFileHandle(`result-${i}.jpg`, { create: false });
              const file = await resultFile.getFile();
              return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.readAsDataURL(file);
              });
            } catch {
              return null;
            }
          })();
          loadPromises.push(promise);
        }

        const loadedImages = await Promise.all(loadPromises);
        setResultImages(loadedImages.filter((img): img is string => img !== null));
      } catch (error) {
        console.error('Error loading images from local:', error);
      }
    };

    // Ưu tiên load từ public URL (khi đã deploy)
    loadFromPublic();
  }, [rootDirHandle]);

  const handleSelectDirectory = async () => {
    try {
      const handle = await requestDirectoryPicker();
      if (handle) {
        setRootDirHandle(handle);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        alert('Lỗi khi chọn thư mục: ' + error.message);
      }
    }
  };

  const saveImageToDirectory = async (file: File, filename: string): Promise<string> => {
    if (!rootDirHandle) {
      throw new Error('Chưa chọn thư mục lưu ảnh');
    }

    // Lưu vào public/docs-images/ để khi build/deploy, mọi người dùng đều thấy
    const docsDir = await getOrCreateDirectory(rootDirHandle, ['public', 'docs-images']);
    const fileHandle = await docsDir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    const arrayBuffer = await file.arrayBuffer();
    await writable.write(arrayBuffer);
    await writable.close();

    // Return public URL path để hiển thị
    return `/docs-images/${filename}`;
  };

  const handleOverviewImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!rootDirHandle) {
      alert('Vui lòng chọn thư mục lưu ảnh trước');
      return;
    }

    setLoading(true);
    try {
      const dataUrl = await saveImageToDirectory(file, 'overview-image.jpg');
      setOverviewImage(dataUrl);
    } catch (error: any) {
      alert('Lỗi khi lưu ảnh: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResultImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (!rootDirHandle) {
      alert('Vui lòng chọn thư mục lưu ảnh trước');
      return;
    }

    setLoading(true);
    try {
      const filesToProcess = files.slice(0, 6);
      const promises = filesToProcess.map((file, index) => 
        saveImageToDirectory(file, `result-${index + 1}.jpg`)
      );
      const imageUrls = await Promise.all(promises);
      setResultImages(imageUrls);
    } catch (error: any) {
      alert('Lỗi khi lưu ảnh: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const removeOverviewImage = async () => {
    if (!rootDirHandle) {
      // Nếu không có rootDirHandle, chỉ xóa khỏi state (ảnh đã deploy)
      setOverviewImage('');
      return;
    }
    
    try {
      const docsDir = await getOrCreateDirectory(rootDirHandle, ['public', 'docs-images']);
      await docsDir.removeEntry('overview-image.jpg');
      setOverviewImage('');
    } catch (error: any) {
      if (error.name !== 'NotFoundError') {
        alert('Lỗi khi xóa ảnh: ' + error.message);
      } else {
        setOverviewImage('');
      }
    }
  };

  const removeResultImage = async (index: number) => {
    if (!rootDirHandle) {
      // Nếu không có rootDirHandle, chỉ xóa khỏi state (ảnh đã deploy)
      setResultImages(prev => prev.filter((_, i) => i !== index));
      return;
    }
    
    try {
      const docsDir = await getOrCreateDirectory(rootDirHandle, ['public', 'docs-images']);
      
      // Xóa file hiện tại
      try {
        await docsDir.removeEntry(`result-${index + 1}.jpg`);
      } catch (error: any) {
        if (error.name !== 'NotFoundError') {
          throw error;
        }
      }

      // Reindex các file còn lại
      const remainingImages = resultImages.filter((_, i) => i !== index);
      const tempDir = await getOrCreateDirectory(rootDirHandle, ['public', 'docs-images-temp']);
      
      // Di chuyển các file còn lại vào temp
      for (let i = index + 2; i <= 6; i++) {
        try {
          const oldFile = await docsDir.getFileHandle(`result-${i}.jpg`, { create: false });
          const file = await oldFile.getFile();
          const newFileHandle = await tempDir.getFileHandle(`result-${i}.jpg`, { create: true });
          const writable = await newFileHandle.createWritable();
          const arrayBuffer = await file.arrayBuffer();
          await writable.write(arrayBuffer);
          await writable.close();
          await docsDir.removeEntry(`result-${i}.jpg`);
        } catch {
          // File không tồn tại, bỏ qua
        }
      }

      // Di chuyển lại từ temp về docs với index mới
      for (let i = index + 2; i <= 6; i++) {
        try {
          const tempFile = await tempDir.getFileHandle(`result-${i}.jpg`, { create: false });
          const file = await tempFile.getFile();
          const newIndex = i - 1;
          const newFileHandle = await docsDir.getFileHandle(`result-${newIndex}.jpg`, { create: true });
          const writable = await newFileHandle.createWritable();
          const arrayBuffer = await file.arrayBuffer();
          await writable.write(arrayBuffer);
          await writable.close();
          await tempDir.removeEntry(`result-${i}.jpg`);
        } catch {
          // File không tồn tại, bỏ qua
        }
      }

      // Xóa temp dir nếu rỗng
      try {
        const publicDir = await getOrCreateDirectory(rootDirHandle, ['public']);
        await publicDir.removeEntry('docs-images-temp', { recursive: true });
      } catch {
        // Bỏ qua nếu không xóa được
      }

      setResultImages(remainingImages);
    } catch (error: any) {
      alert('Lỗi khi xóa ảnh: ' + error.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mô Hình Tổng Thể - Flow Diagram */}
      <div className="glass-strong rounded-2xl p-8 border border-slate-200">
        <h1 className="text-3xl font-black text-slate-900 mb-6 flex items-center gap-3">
          <Layers className="text-blue-600" />
          Mô Hình Tổng Thể Hệ Thống
        </h1>
        
        <div className="space-y-6">
          {/* Chọn thư mục lưu ảnh */}
          {!rootDirHandle && (
            <div className="glass-light rounded-lg p-4 border-2 border-dashed border-slate-300 text-center">
              <FolderOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-700 font-medium mb-3">Chưa chọn thư mục lưu ảnh</p>
              <button
                onClick={handleSelectDirectory}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all"
              >
                <FolderOpen className="w-5 h-5 inline mr-2" />
                Chọn thư mục lưu ảnh
              </button>
              <p className="text-xs text-slate-500 mt-2">
                Chọn thư mục <strong>root của project</strong> (nơi có thư mục public/). 
                Ảnh sẽ được lưu vào <strong>public/docs-images/</strong> để khi build/deploy, tất cả người dùng đều thấy.
              </p>
            </div>
          )}

          {rootDirHandle && (
            <div className="glass-light rounded-lg p-3 border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-700">
                  <strong>Thư mục:</strong> {rootDirHandle.name}/public/docs-images/
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  💡 Ảnh sẽ được lưu vào public/docs-images/ để khi build/deploy, tất cả người dùng đều thấy
                </p>
              </div>
              <button
                onClick={handleSelectDirectory}
                className="text-sm text-blue-600 hover:text-blue-700 underline"
              >
                Đổi thư mục
              </button>
            </div>
          )}

          {/* Upload Area for Overview Image */}
          {rootDirHandle && (
            <div className="glass-light rounded-lg p-4 border border-slate-200">
              <label className="block mb-3 text-slate-900 font-semibold text-lg">
                📊 Upload ảnh mô hình tổng thể (1 ảnh):
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleOverviewImageUpload}
                className="hidden"
                id="overview-image-upload"
                disabled={loading}
              />
              <label 
                htmlFor="overview-image-upload" 
                className={`cursor-pointer inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Image className="w-5 h-5 mr-2" />
                {loading ? 'Đang lưu...' : overviewImage ? 'Thay đổi ảnh' : 'Chọn ảnh mô hình'}
              </label>
            {overviewImage && (
              <button
                onClick={removeOverviewImage}
                className="ml-3 px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white font-semibold rounded-lg transition-all text-sm shadow-sm"
              >
                Xóa ảnh
              </button>
            )}
            <p className="text-sm text-slate-600 mt-2">
              Upload 1 ảnh mô tả tổng quan về hệ thống và quy trình xử lý
            </p>
          </div>
          )}

          {/* Overview Image Display */}
          {overviewImage ? (
            <div className="glass-light rounded-lg overflow-hidden border-2 border-slate-300 hover:border-blue-400 hover:shadow-xl transition-all">
              <img 
                src={overviewImage} 
                alt="Mô hình tổng thể hệ thống"
                className="w-full h-auto object-contain bg-white"
              />
            </div>
          ) : (
            <div className="glass-light rounded-lg p-12 border-2 border-dashed border-slate-300 text-center">
              <div className="p-4 glass bg-slate-100 rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center border border-slate-300">
                <Image className="w-12 h-12 text-slate-400" />
              </div>
              <p className="text-slate-700 font-medium text-lg mb-2">Chưa có ảnh mô hình</p>
              <p className="text-slate-500 text-sm">Vui lòng upload ảnh ở trên để hiển thị mô hình tổng thể</p>
            </div>
          )}
        </div>
      </div>

      <div className="glass-strong rounded-2xl p-8 border border-slate-200">
        <h1 className="text-3xl font-black text-slate-900 mb-4 flex items-center gap-3">
          <Layers className="text-blue-600" />
          Tổng Quan Hệ Thống Vishipel TOOL
        </h1>
        <p className="text-slate-700 text-lg leading-relaxed">
          Vishipel TOOL là một ứng dụng web hiện đại được xây dựng để tự động hóa quá trình phân tích, 
          tách và tổ chức file PDF hành chính/hàng hải Việt Nam. Hệ thống sử dụng công nghệ AI (Google Gemini) 
          để nhận diện và phân loại tài liệu, sau đó tự động sắp xếp chúng vào cấu trúc thư mục phù hợp với nghiệp vụ.
        </p>
      </div>

      <div id="nhu-cau-bai-toan" className="glass-strong rounded-2xl p-8 border border-slate-200">
        <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Info className="text-blue-600" />
          Nhu Cầu Bài Toán
        </h2>
        
        <div className="space-y-4 text-slate-700">
          <div className="glass-light rounded-lg p-5 border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-3 text-lg">Bối cảnh thực tế:</h3>
            <p className="leading-relaxed mb-3">
              Theo quy định của <strong className="text-blue-700">Phòng Điều Hành Mạng</strong>, hồ sơ MSI scan lưu mềm 
              phải tách ra lưu trữ theo từng biểu mẫu. Hiện tại, quy trình scan và lưu trữ hồ sơ tốn nhiều nhân lực do phải 
              <strong className="text-red-600"> scan lẻ từng loại biểu mẫu</strong>, mất nhiều thời gian.
            </p>
            <p className="leading-relaxed">
              Thay vì phải scan tách lẻ từng tờ thủ công, <strong className="text-blue-700">Đài TTDH Đà Nẵng</strong> sẽ 
              scan 1 lần trọn bộ hồ sơ trong 1 file. Vì vậy Đài mong muốn có một công cụ để tách tự động từng biểu mẫu 
              trong file đó và đặt tên, lưu trữ đúng thư mục được quy định cho từng biểu mẫu (Bản Tin Nguồn, NTX, RTP, v.v.) 
              và có thể xử lý tách và lưu trữ nhiều file cùng 1 lúc.
            </p>
          </div>

          <div className="glass-light rounded-lg p-5 border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-3 text-lg">Các vấn đề cần giải quyết:</h3>
            <ul className="space-y-2 list-disc list-inside text-slate-700">
              <li><strong className="text-slate-900">Tách file PDF lớn</strong> thành nhiều file nhỏ dựa trên mã số/biểu mẫu</li>
              <li><strong className="text-slate-900">Nhận diện và phân loại</strong> các loại tài liệu khác nhau (Bản tin nguồn, Biểu mẫu QT, KTKS, LOG...)</li>
              <li><strong className="text-slate-900">Tự động sắp xếp</strong> file vào đúng cấu trúc thư mục theo nghiệp vụ</li>
              <li><strong className="text-slate-900">Xử lý hàng loạt</strong> nhiều file cùng lúc</li>
              <li><strong className="text-slate-900">Đảm bảo tính chính xác</strong> và nhất quán trong việc phân loại</li>
            </ul>
          </div>

          <div className="glass-light rounded-lg p-5 border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-3 text-lg">Giải pháp của Vishipel TOOL:</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <strong className="text-slate-900">Nhận dạng tự động:</strong>
                  <p className="text-slate-600 text-sm mt-1">
                    Gemini AI sẽ đọc nội dung file scan, tự động nhận diện tên các loại biểu mẫu (KTKS, QT, TTNH...).
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <strong className="text-slate-900">Tự động tạo cấu trúc:</strong>
                  <p className="text-slate-600 text-sm mt-1">
                    Dựa trên kết quả nhận dạng, hệ thống tự động tạo Folder, tách file PDF, đặt tên đúng quy chuẩn 
                    và lưu vào các thư mục tương ứng.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <strong className="text-slate-900">Xử lý đa file:</strong>
                  <p className="text-slate-600 text-sm mt-1">
                    Hỗ trợ xử lý nhiều bộ hồ sơ cùng lúc bằng cơ chế hàng đợi (Job Queue).
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <strong className="text-slate-900">Xử lý client-side:</strong>
                  <p className="text-slate-600 text-sm mt-1">
                    Đọc và phân tích nội dung PDF mà không cần upload lên server, đảm bảo tính bảo mật.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Results Section - 6 ảnh kết quả với mũi tên */}
      <div className="glass-strong rounded-2xl p-8 border border-slate-200">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Image className="text-blue-600" />
          Kết Quả Minh Họa
        </h2>
        
        <div className="space-y-6">
          {/* Upload Area for Result Images */}
          {rootDirHandle && (
            <div className="glass-light rounded-lg p-4 border border-slate-200">
              <label className="block mb-3 text-slate-900 font-semibold text-lg">
                📸 Upload ảnh kết quả (tối đa 6 ảnh):
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleResultImagesUpload}
                className="hidden"
                id="result-images-upload"
                disabled={loading}
              />
              <label 
                htmlFor="result-images-upload" 
                className={`cursor-pointer inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-500 via-blue-600 to-cyan-500 hover:from-indigo-600 hover:via-blue-700 hover:to-cyan-600 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Image className="w-5 h-5 mr-2" />
                {loading ? 'Đang lưu...' : 'Chọn ảnh kết quả'}
              </label>
              <p className="text-sm text-slate-600 mt-2">
                Upload tối đa 6 ảnh minh họa kết quả xử lý (đã lưu: {resultImages.length}/6)
              </p>
            </div>
          )}

          {/* Result Images Grid with Arrows */}
          {resultImages.length > 0 && (
            <div className="space-y-8">
              {/* Row 1: Ảnh 1 -> Ảnh 2 -> Ảnh 3 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
                {resultImages.slice(0, 3).map((img, idx) => (
                  <div key={idx} className="relative">
                    {/* Arrow pointing right (except last item) */}
                    {idx < 2 && (
                      <div className="absolute -right-6 top-1/2 transform -translate-y-1/2 z-10 hidden md:block">
                        <div className="p-2 glass bg-white/80 rounded-full border border-slate-300 shadow-md">
                          <ArrowRight className="w-6 h-6 text-indigo-600" />
                        </div>
                      </div>
                    )}
                    {/* Arrow pointing down (for mobile) */}
                    {idx < 2 && (
                      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 z-10 md:hidden">
                        <div className="p-2 glass bg-white/80 rounded-full border border-slate-300 shadow-md">
                          <ArrowRight className="w-6 h-6 text-indigo-600 rotate-90" />
                        </div>
                      </div>
                    )}
                    
                    <div className="glass-light rounded-lg overflow-hidden border-2 border-slate-300 hover:border-indigo-400 hover:shadow-xl transition-all relative group">
                      <button
                        onClick={() => removeResultImage(idx)}
                        className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg"
                        title="Xóa ảnh"
                      >
                        <span className="text-sm font-bold">×</span>
                      </button>
                      <img 
                        src={img} 
                        alt={`Kết quả ${idx + 1}`}
                        className="w-full h-auto object-contain bg-white"
                      />
                      <div className="p-3 bg-gradient-to-r from-indigo-50 via-blue-50 to-cyan-50 text-center border-t border-slate-200">
                        <p className="text-sm font-bold text-slate-800">Kết quả {idx + 1}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Arrow pointing down from row 1 to row 2 */}
              {resultImages.length > 3 && (
                <div className="flex justify-center">
                  <div className="p-2 glass bg-white/80 rounded-full border border-slate-300 shadow-md">
                    <ArrowRight className="w-6 h-6 text-indigo-600 rotate-90" />
                  </div>
                </div>
              )}

              {/* Row 2: Ảnh 4 -> Ảnh 5 -> Ảnh 6 */}
              {resultImages.length > 3 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
                  {resultImages.slice(3, 6).map((img, idx) => (
                    <div key={idx + 3} className="relative">
                      {/* Arrow pointing left (except first item) */}
                      {idx > 0 && (
                        <div className="absolute -left-6 top-1/2 transform -translate-y-1/2 z-10 hidden md:block">
                          <div className="p-2 glass bg-white/80 rounded-full border border-slate-300 shadow-md">
                            <ArrowRight className="w-6 h-6 text-cyan-600 rotate-180" />
                          </div>
                        </div>
                      )}
                      {/* Arrow pointing down (for mobile) */}
                      {idx < 2 && idx + 3 < resultImages.length - 1 && (
                        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 z-10 md:hidden">
                          <div className="p-2 glass bg-white/80 rounded-full border border-slate-300 shadow-md">
                            <ArrowRight className="w-6 h-6 text-cyan-600 rotate-90" />
                          </div>
                        </div>
                      )}
                      
                      <div className="glass-light rounded-lg overflow-hidden border-2 border-slate-300 hover:border-cyan-400 hover:shadow-xl transition-all relative group">
                        <button
                          onClick={() => removeResultImage(idx + 3)}
                          className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg"
                          title="Xóa ảnh"
                        >
                          <span className="text-sm font-bold">×</span>
                        </button>
                        <img 
                          src={img} 
                          alt={`Kết quả ${idx + 4}`}
                          className="w-full h-auto object-contain bg-white"
                        />
                        <div className="p-3 bg-gradient-to-r from-cyan-50 via-blue-50 to-indigo-50 text-center border-t border-slate-200">
                          <p className="text-sm font-bold text-slate-800">Kết quả {idx + 4}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Placeholder when no result images */}
          {resultImages.length === 0 && (
            <div className="glass-light rounded-lg p-12 border-2 border-dashed border-slate-300 text-center">
              <div className="p-4 glass bg-slate-100 rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center border border-slate-300">
                <Image className="w-12 h-12 text-slate-400" />
              </div>
              <p className="text-slate-700 font-medium text-lg mb-2">Chưa có ảnh kết quả</p>
              <p className="text-slate-500 text-sm">Vui lòng upload ảnh ở trên để hiển thị kết quả minh họa</p>
            </div>
          )}
        </div>
      </div>

      <div id="kien-truc-tong-quan" className="glass-strong rounded-2xl p-8 border border-slate-200">
        <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Database className="text-green-600" />
          Kiến Trúc Tổng Quan
        </h2>
        
        <div className="space-y-4 text-slate-700">
          <p className="leading-relaxed">
            Hệ thống được xây dựng theo kiến trúc client-side, nghĩa là tất cả quá trình xử lý diễn ra trên trình duyệt 
            của người dùng. Điều này đảm bảo tính bảo mật (file không rời khỏi máy tính) và hiệu năng tốt.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="glass-light rounded-lg p-4 border border-slate-200">
              <h3 className="font-bold text-slate-900 mb-2">Frontend Layer</h3>
              <ul className="space-y-1 text-sm">
                <li>• React + TypeScript</li>
                <li>• Vite build tool</li>
                <li>• Tailwind CSS (Glassmorphism UI)</li>
                <li>• Lucide React Icons</li>
              </ul>
            </div>
            <div className="glass-light rounded-lg p-4 border border-slate-200">
              <h3 className="font-bold text-slate-900 mb-2">Processing Layer</h3>
              <ul className="space-y-1 text-sm">
                <li>• PDF.js (PDF rendering)</li>
                <li>• pdf-lib (PDF manipulation)</li>
                <li>• Google Gemini AI API</li>
                <li>• File System Access API</li>
              </ul>
            </div>
          </div>

          <div className="glass-light rounded-lg p-4 border border-slate-200 mt-4">
            <h3 className="font-bold text-slate-900 mb-2">Các Module Chính:</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <strong className="text-slate-900">pdfUtils.ts:</strong> Chuyển đổi PDF sang hình ảnh base64
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <strong className="text-slate-900">geminiService.ts:</strong> Tích hợp với Google Gemini AI để phân tích tài liệu
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <strong className="text-slate-900">pdfSplitter.ts:</strong> Logic tách file PDF dựa trên kết quả phân tích
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <strong className="text-slate-900">fileSaver.ts:</strong> Lưu file vào hệ thống file local
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <strong className="text-slate-900">jobQueue.ts:</strong> Quản lý hàng đợi xử lý nhiều file
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="flow-xu-ly" className="glass-strong rounded-2xl p-8 border border-slate-200">
        <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <ArrowRight className="text-blue-600" />
          Flow Xử Lý Tổng Quan
        </h2>
        
        <div className="space-y-4 text-slate-700">
          <div className="glass-light rounded-lg p-6 border border-slate-200">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full glass bg-blue-100 flex items-center justify-center shrink-0 font-bold text-blue-700">
                  1
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">Upload File PDF</h3>
                  <p className="text-sm text-slate-600">Người dùng chọn thư mục đích và upload file PDF (có thể nhiều file). File được validate và thêm vào job queue.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full glass bg-blue-100 flex items-center justify-center shrink-0 font-bold text-blue-700">
                  2
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">Convert PDF to Images</h3>
                  <p className="text-sm text-slate-600">Mỗi trang PDF được render thành hình ảnh JPEG và chuyển đổi sang định dạng base64 để gửi đến Gemini AI.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full glass bg-blue-100 flex items-center justify-center shrink-0 font-bold text-blue-700">
                  3
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">AI Analysis (Gemini)</h3>
                  <p className="text-sm text-slate-600">Hệ thống gọi Gemini AI để phân tích tất cả các trang, nhận diện mã số, biểu mẫu, chữ ký, LOG pages, và các thông tin khác.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full glass bg-blue-100 flex items-center justify-center shrink-0 font-bold text-blue-700">
                  4
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">Split Logic Processing</h3>
                  <p className="text-sm text-slate-600">Dựa trên kết quả phân tích, hệ thống xác định các điểm cắt (breakpoints) và tách file PDF thành các tài liệu riêng biệt.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full glass bg-blue-100 flex items-center justify-center shrink-0 font-bold text-blue-700">
                  5
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">Folder Routing</h3>
                  <p className="text-sm text-slate-600">Mỗi file được tách sẽ được xác định đường dẫn lưu trữ dựa trên broadcast code, service code, và document code.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full glass bg-blue-100 flex items-center justify-center shrink-0 font-bold text-blue-700">
                  6
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">Save to TEMP_EXTRACT</h3>
                  <p className="text-sm text-slate-600">Tất cả file được lưu vào thư mục TEMP_EXTRACT với cấu trúc tương ứng, kèm theo file metadata JSON.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full glass bg-red-100 flex items-center justify-center shrink-0 font-bold text-red-700">
                  7
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">User Review & Sync</h3>
                  <p className="text-sm text-slate-600">Người dùng xem kết quả và có thể đồng bộ file từ TEMP_EXTRACT vào thư mục đích đã chọn ban đầu.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const GeminiSection: React.FC = () => (
  <div className="space-y-6">
    <div className="glass-strong rounded-2xl p-8 border border-slate-200">
      <h1 className="text-3xl font-black text-slate-900 mb-4 flex items-center gap-3">
        <Brain className="text-blue-600" />
        Tích Hợp Google Gemini AI
      </h1>
      <p className="text-slate-700 text-lg leading-relaxed">
        Google Gemini là công nghệ AI đa phương thức (multimodal) của Google, cho phép xử lý cả văn bản và hình ảnh. 
        Trong hệ thống Vishipel TOOL, Gemini được sử dụng để phân tích nội dung PDF và trích xuất thông tin có cấu trúc.
      </p>
    </div>

    <div className="glass-strong rounded-2xl p-8 border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Cấu Hình API</h2>
      
      <div className="space-y-4 text-slate-700">
        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-2">1. Lấy API Key</h3>
          <p className="mb-2">Để sử dụng Gemini API, bạn cần:</p>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Truy cập <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">Google AI Studio</a></li>
            <li>Tạo một API key mới</li>
            <li>Copy API key và lưu vào file <code className="bg-slate-100 px-1 rounded">.env</code></li>
          </ol>
        </div>

        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-2">2. Cấu Hình trong Code</h3>
          <p className="mb-2 text-sm">File <code className="bg-slate-100 px-1 rounded">.env</code>:</p>
          <pre className="bg-black/30 p-3 rounded text-xs overflow-x-auto">
{`GEMINI_API_KEY=your_api_key_here`}
          </pre>
          <p className="mt-2 text-sm">File <code className="bg-slate-100 px-1 rounded">vite.config.ts</code> tự động load biến môi trường:</p>
          <pre className="bg-black/30 p-3 rounded text-xs overflow-x-auto mt-2">
{`define: {
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
}`}
          </pre>
        </div>

        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-2">3. Khởi Tạo Client</h3>
          <p className="mb-2 text-sm">Trong <code className="bg-slate-100 px-1 rounded">geminiService.ts</code>:</p>
          <pre className="bg-black/30 p-3 rounded text-xs overflow-x-auto">
{`import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ 
  apiKey: process.env.API_KEY 
});`}
          </pre>
        </div>
      </div>
    </div>

    <div className="glass-strong rounded-2xl p-8 border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Quy Trình Phân Tích 1 File PDF</h2>
      
      <div className="space-y-6">
        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-3 text-lg">📊 Số Lượng API Calls</h3>
          <p className="text-slate-700 mb-3">
            <strong className="text-indigo-600">1 file PDF = 3 API calls</strong> (tối ưu nhất có thể)
          </p>
          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
            <li><strong>Call 1 - Preview (10 trang đầu):</strong> Tìm trang LOG đầu tiên để xác định điểm chia batch</li>
            <li><strong>Call 2 - Batch 1 (nửa đầu file):</strong> Phân tích tất cả thông tin: mã số, chữ ký, LOG, broadcast code, service code</li>
            <li><strong>Call 3 - Batch 2 (nửa sau file):</strong> Phân tích tất cả thông tin tương tự</li>
          </ol>
          <p className="text-xs text-slate-500 mt-3">
            💡 <strong>Lưu ý:</strong> Tất cả các bước OCR (chữ ký, mã số, LOG, v.v.) đều được gộp vào 2 batch chính, không gọi riêng từng bước.
          </p>
        </div>

        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-3 text-lg">🔄 Luồng Xử Lý Chi Tiết</h3>
          
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-semibold text-slate-900 mb-2">Bước 1: Convert PDF → Images (Không dùng API)</h4>
              <p className="text-sm text-slate-700">
                Mỗi trang PDF được render thành hình ảnh JPEG (base64) với độ phân giải cao (scale 2.0) để đảm bảo chất lượng OCR tốt.
              </p>
            </div>

            <div className="border-l-4 border-indigo-500 pl-4">
              <h4 className="font-semibold text-slate-900 mb-2">Bước 2: Preview Call - Tìm LOG Page</h4>
              <p className="text-sm text-slate-700 mb-2">
                <strong>Input:</strong> 10 trang đầu tiên của PDF
              </p>
              <p className="text-sm text-slate-700 mb-2">
                <strong>Prompt:</strong> "Tìm trang LOG đầu tiên (chụp màn hình, bảng log, email in, không có formCode)"
              </p>
              <p className="text-sm text-slate-700 mb-2">
                <strong>Output:</strong> Số trang LOG đầu tiên (hoặc mặc định trang 8 nếu không tìm thấy)
              </p>
              <p className="text-xs text-slate-500 mt-2">
                💡 Mục đích: Xác định điểm chia batch để tối ưu hóa phân tích
              </p>
            </div>

            <div className="border-l-4 border-purple-500 pl-4">
              <h4 className="font-semibold text-slate-900 mb-2">Bước 3: Batch 1 - Phân Tích Nửa Đầu File</h4>
              <p className="text-sm text-slate-700 mb-2">
                <strong>Input:</strong> Tất cả hình ảnh từ trang 1 đến giữa file (chia đôi)
              </p>
              <p className="text-sm text-slate-700 mb-2">
                <strong>Prompt tích hợp tất cả yêu cầu:</strong>
              </p>
              <ul className="text-sm text-slate-700 list-disc list-inside ml-4 space-y-1">
                <li>Phân loại từng trang: FORM_HEADER / LOG_SCREEN / SOURCE_HEADER / CONTENT</li>
                <li>Trích xuất mã số (formCode) từ khung "Mã số/Code" ở góc</li>
                <li>OCR chữ ký: Tìm tên người Việt Nam (2-4 từ, chữ cái đầu viết hoa) ở phần ký duyệt</li>
                <li>Phát hiện LOG page: Trang chụp màn hình, không có formCode</li>
                <li>Phát hiện Bản tin nguồn: Header "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"</li>
                <li>Nhận diện broadcast code: MET, NAV, SAR, WX, TUYEN</li>
                <li>Nhận diện service code: NTX, RTP, EGC</li>
                <li>Phát hiện email trong LOG</li>
              </ul>
              <p className="text-sm text-slate-700 mt-2">
                <strong>Output:</strong> JSON với thông tin chi tiết từng trang + broadcast/service code
              </p>
            </div>

            <div className="border-l-4 border-cyan-500 pl-4">
              <h4 className="font-semibold text-slate-900 mb-2">Bước 4: Batch 2 - Phân Tích Nửa Sau File</h4>
              <p className="text-sm text-slate-700 mb-2">
                Tương tự Batch 1, nhưng xử lý nửa sau của file. Merge kết quả với Batch 1 để có thông tin đầy đủ.
              </p>
            </div>

            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="font-semibold text-slate-900 mb-2">Bước 5: Merge & Xử Lý Logic Tách File</h4>
              <p className="text-sm text-slate-700">
                Dựa trên kết quả phân tích, hệ thống xác định các điểm cắt (breakpoints) và tạo các tài liệu riêng biệt.
              </p>
            </div>
          </div>
        </div>

        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-3 text-lg">✍️ OCR Chữ Ký - Prompt & Phối Hợp</h3>
          
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-700 mb-2">
                <strong>Không gọi API riêng:</strong> OCR chữ ký được tích hợp trực tiếp vào prompt chính của Batch 1 và Batch 2.
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-700 mb-2">
                <strong>Prompt yêu cầu:</strong>
              </p>
              <pre className="bg-slate-100 p-3 rounded text-xs overflow-x-auto border border-slate-300">
{`hasSignature: true nếu có chữ ký/tên người ở cuối trang 
(chỉ phần ký duyệt, không phải tên trong nội dung)

Tên người Việt Nam:
- 2-4 từ
- Chữ cái đầu viết hoa
- Ví dụ: "Vũ Anh Tuấn", "Nguyễn Xuân Hiến", "Phạm Thị Châm"
- Có thể xuất hiện ở: chữ ký, soát tin, dự báo viên, chức danh kèm tên`}
              </pre>
            </div>

            <div>
              <p className="text-sm text-slate-700 mb-2">
                <strong>Cách phối hợp:</strong>
              </p>
              <ul className="text-sm text-slate-700 list-disc list-inside space-y-1">
                <li>Gemini đọc toàn bộ nội dung trang trong 1 lần</li>
                <li>Tự động nhận diện tên người trong phần ký duyệt (cuối trang)</li>
                <li>Trả về <code className="bg-slate-200 px-1 rounded">hasSignature: true/false</code> cho mỗi trang</li>
                <li>Hệ thống sử dụng thông tin này để xác định điểm cắt tài liệu</li>
              </ul>
            </div>

            <div className="bg-blue-50 p-3 rounded border border-blue-200">
              <p className="text-xs text-blue-800">
                <strong>💡 Tối ưu:</strong> Không cần gọi API riêng cho từng trang để OCR chữ ký. Tất cả được xử lý trong 2 batch chính, giảm từ N requests xuống còn 2 requests.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div className="glass-strong rounded-2xl p-8 border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Tối Ưu Hóa API Calls</h2>
      
      <div className="space-y-4 text-slate-700">
        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-3">📈 So Sánh: Trước vs Sau Tối Ưu</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-red-50 p-4 rounded border border-red-200">
              <h4 className="font-semibold text-red-900 mb-2">❌ Cách Cũ (Không tối ưu)</h4>
              <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
                <li>Gọi API riêng để tìm broadcast code: ~3-5 calls</li>
                <li>Gọi API riêng để OCR mã số từng trang: N calls (N = số trang)</li>
                <li>Gọi API riêng để OCR chữ ký từng trang: N calls</li>
                <li>Gọi API riêng để phát hiện LOG: N calls</li>
                <li><strong>Tổng: ~3N + 5 calls</strong> (ví dụ: 50 trang = 155 calls!)</li>
              </ul>
            </div>

            <div className="bg-green-50 p-4 rounded border border-green-200">
              <h4 className="font-semibold text-green-900 mb-2">✅ Cách Mới (Đã tối ưu)</h4>
              <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
                <li>Preview call tìm LOG: 1 call</li>
                <li>Batch 1 (tất cả thông tin): 1 call</li>
                <li>Batch 2 (tất cả thông tin): 1 call</li>
                <li><strong>Tổng: 3 calls</strong> (bất kể file có bao nhiêu trang!)</li>
              </ul>
            </div>
          </div>

          <div className="mt-4 p-3 bg-indigo-50 rounded border border-indigo-200">
            <p className="text-sm text-indigo-900">
              <strong>🎯 Kết quả:</strong> Giảm từ <strong>155 calls</strong> xuống còn <strong>3 calls</strong> cho file 50 trang 
              (giảm <strong>98%</strong> số lượng API calls!)
            </p>
          </div>
        </div>

        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-2">🔧 Chiến Lược Tối Ưu</h3>
          
          <div className="space-y-3">
            <div>
              <strong className="text-slate-900">1. Gộp Tất Cả Vào 1 Prompt</strong>
              <p className="text-sm text-slate-700 mt-1">
                Thay vì gọi riêng từng bước (OCR mã số, OCR chữ ký, phát hiện LOG...), tất cả được yêu cầu trong 1 prompt duy nhất. 
                Gemini xử lý song song tất cả yêu cầu trong 1 lần.
              </p>
            </div>

            <div>
              <strong className="text-slate-900">2. Batch Processing</strong>
              <p className="text-sm text-slate-700 mt-1">
                Chia file thành 2 batch (nửa đầu, nửa sau) thay vì xử lý từng trang. Gemini 2.5 Flash hỗ trợ ~20 images/request, 
                nên có thể xử lý nhiều trang cùng lúc.
              </p>
            </div>

            <div>
              <strong className="text-slate-900">3. Preview Call Tối Thiểu</strong>
              <p className="text-sm text-slate-700 mt-1">
                Chỉ preview 10 trang đầu để tìm LOG, không cần quét toàn bộ file. Nếu không tìm thấy, dùng mặc định trang 8.
              </p>
            </div>

            <div>
              <strong className="text-slate-900">4. Job Queue Tuần Tự</strong>
              <p className="text-sm text-slate-700 mt-1">
                Xử lý từng file một cách tuần tự trong hàng đợi, tránh vượt quá rate limit của Gemini API.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div className="glass-strong rounded-2xl p-8 border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Prompt & Schema</h2>
      
      <div className="space-y-4 text-slate-700">
        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-3">📝 Prompt Chính (Batch 1 & Batch 2)</h3>
          
          <p className="text-sm text-slate-700 mb-3">
            Prompt được thiết kế để yêu cầu Gemini phân tích <strong>tất cả thông tin cần thiết trong 1 lần</strong>:
          </p>

          <div className="bg-slate-50 p-4 rounded border border-slate-300 text-xs overflow-x-auto">
            <p className="font-semibold mb-2">Yêu cầu chính:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-700">
              <li>Phân loại từng trang: FORM_HEADER / LOG_SCREEN / SOURCE_HEADER / CONTENT</li>
              <li>Trích xuất formCode từ khung "Mã số/Code" ở góc</li>
              <li>OCR chữ ký: hasSignature = true nếu có tên người ở phần ký duyệt</li>
              <li>Phát hiện LOG: isLogPage = true nếu là trang chụp màn hình/log</li>
              <li>Phát hiện Bản tin nguồn: isBanTinNguonHeader = true nếu có header "CỘNG HÒA..."</li>
              <li>Nhận diện broadcast code và service code từ "Mã bản tin đài xử lý"</li>
              <li>Phát hiện email trong LOG: hasEmail = true</li>
            </ul>
          </div>

          <p className="text-xs text-slate-500 mt-3">
            💡 <strong>Lưu ý:</strong> Prompt yêu cầu Gemini chỉ trả về JSON, không có text giải thích, để đảm bảo parsing dễ dàng.
          </p>
        </div>

        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-2">📋 Output Schema</h3>
          <p className="text-sm text-slate-700 mb-2">
            Mỗi batch trả về JSON với cấu trúc:
          </p>
          <pre className="bg-slate-100 p-3 rounded text-xs overflow-x-auto border border-slate-300">
{`{
  "broadcastCode": "MET" | "NAV" | "SAR" | "WX" | "TUYEN" | null,
  "serviceCode": "NTX" | "RTP" | "EGC" | null,
  "pages": [
    {
      "page": 1,
      "type": "FORM_HEADER" | "LOG_SCREEN" | "SOURCE_HEADER" | "CONTENT",
      "formCode": "QT.MSI-BM.01" | null,
      "hasSignature": true | false,
      "isLogPage": true | false,
      "isBanTinNguonHeader": true | false,
      "hasEmail": true | false,
      "serviceHint": "NTX" | "RTP" | "EGC" | null,
      "broadcastCode": "MET" | "NAV" | "SAR" | "WX" | "TUYEN" | null
    }
  ]
}`}
          </pre>
        </div>
      </div>
    </div>
  </div>
);

const PDFProcessingSection: React.FC = () => (
  <div className="space-y-6">
    <div className="glass-strong rounded-2xl p-8 border border-slate-200">
      <h1 className="text-3xl font-black text-slate-900 mb-4 flex items-center gap-3">
        <FileText className="text-blue-600" />
        Xử Lý PDF
      </h1>
      <p className="text-slate-700 text-lg leading-relaxed">
        Module xử lý PDF chịu trách nhiệm chuyển đổi file PDF sang định dạng có thể xử lý được, 
        và thực hiện các thao tác cắt, ghép, tạo file mới.
      </p>
    </div>

    <div className="glass-strong rounded-2xl p-8 border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Convert PDF to Images</h2>
      
      <div className="space-y-4 text-slate-700">
        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-2">Hàm: convertPdfToImage()</h3>
          <p className="text-sm mb-3">File: <code className="bg-slate-100 px-1 rounded">services/pdfUtils.ts</code></p>
          
          <div className="space-y-3">
            <div>
              <strong className="text-slate-900 text-sm">Quy trình:</strong>
              <ol className="list-decimal list-inside space-y-1 text-sm mt-1 text-slate-900/70">
                <li>Load PDF bằng PDF.js từ ArrayBuffer</li>
                <li>Duyệt qua từng trang (pageNum từ 1 đến numPages)</li>
                <li>Render mỗi trang thành Canvas với độ phân giải cao (scale = 2.0)</li>
                <li>Convert Canvas thành JPEG base64</li>
                <li>Trả về mảng base64 strings</li>
              </ol>
            </div>

            <div>
              <strong className="text-slate-900 text-sm">Code Example:</strong>
              <pre className="bg-black/30 p-3 rounded text-xs overflow-x-auto mt-1">
{`const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
const base64Images: string[] = [];

for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 2.0 });
  
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  const context = canvas.getContext('2d');
  await page.render({ canvasContext: context, viewport }).promise;
  
  const base64 = canvas.toDataURL('image/jpeg', 0.9);
  base64Images.push(base64.split(',')[1]); // Remove data:image/jpeg;base64,
}`}
              </pre>
            </div>

            <div>
              <strong className="text-slate-900 text-sm">Tối ưu hóa:</strong>
              <ul className="space-y-1 text-sm list-disc list-inside text-slate-900/70">
                <li>Scale = 2.0 để đảm bảo chất lượng OCR tốt</li>
                <li>JPEG quality = 0.9 để cân bằng chất lượng và kích thước</li>
                <li>Có thể giới hạn số trang xử lý bằng tham số maxPages</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div className="glass-strong rounded-2xl p-8 border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-4">OCR & Text Extraction</h2>
      
      <div className="space-y-4 text-slate-700">
        <p className="leading-relaxed">
          Hệ thống không sử dụng OCR truyền thống (như Tesseract) mà sử dụng Gemini AI để đọc và hiểu nội dung PDF. 
          Điều này cho phép:
        </p>

        <ul className="space-y-2 list-disc list-inside">
          <li>Nhận diện văn bản với độ chính xác cao, kể cả với font chữ phức tạp</li>
          <li>Hiểu ngữ cảnh và cấu trúc tài liệu</li>
          <li>Trích xuất thông tin có cấu trúc (JSON) thay vì chỉ text thuần</li>
          <li>Xử lý cả tiếng Việt có dấu</li>
        </ul>
      </div>
    </div>

    <div className="glass-strong rounded-2xl p-8 border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Page Analysis</h2>
      
      <div className="space-y-4 text-slate-700">
        <p className="leading-relaxed">
          Mỗi trang PDF được phân tích để xác định:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-light rounded-lg p-4 border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-2">Loại Trang</h3>
            <ul className="space-y-1 text-sm">
              <li>• FORM_HEADER: Trang có mã số</li>
              <li>• LOG_SCREEN: Trang chụp màn hình</li>
              <li>• SOURCE_HEADER: Header bản tin nguồn</li>
              <li>• CONTENT: Trang nội dung</li>
            </ul>
          </div>
          <div className="glass-light rounded-lg p-4 border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-2">Thông Tin Trang</h3>
            <ul className="space-y-1 text-sm">
              <li>• formCode: Mã số biểu mẫu</li>
              <li>• hasSignature: Có chữ ký/tên người</li>
              <li>• isLogPage: Là trang LOG</li>
              <li>• isBanTinNguonHeader: Là header BTN</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const SplittingLogicSection: React.FC = () => (
  <div className="space-y-6">
    <div className="glass-strong rounded-2xl p-8 border border-slate-200">
      <h1 className="text-3xl font-black text-slate-900 mb-4 flex items-center gap-3">
        <Code className="text-blue-600" />
        Logic Tách File PDF
      </h1>
      <p className="text-slate-700 text-lg leading-relaxed">
        Logic tách file là phần phức tạp nhất của hệ thống, sử dụng State Machine pattern để xác định các điểm cắt 
        và tạo các tài liệu riêng biệt từ một file PDF lớn.
      </p>
    </div>

    <div className="glass-strong rounded-2xl p-8 border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-4">State Machine Pattern</h2>
      
      <div className="space-y-4 text-slate-700">
        <p className="leading-relaxed">
          Hệ thống duyệt qua từng trang PDF và duy trì state hiện tại để quyết định khi nào cần cắt file mới.
        </p>

        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-2">State Variables:</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <strong className="text-slate-900">currentDocPages:</strong> Mảng các trang hiện tại đang thu thập
            </li>
            <li>
              <strong className="text-slate-900">currentDocFormCode:</strong> Mã số của tài liệu hiện tại
            </li>
            <li>
              <strong className="text-slate-900">currentDocService:</strong> Service code (NTX/RTP/EGC) của tài liệu hiện tại
            </li>
            <li>
              <strong className="text-slate-900">currentServiceState:</strong> Service code toàn cục (có thể thay đổi khi gặp hint mới)
            </li>
          </ul>
        </div>

        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-2">Breakpoints (Điểm Cắt):</h3>
          <p className="text-sm mb-2">File được cắt tại các điểm sau:</p>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li><strong>LOG_SCREEN:</strong> Trang LOG luôn được tách riêng</li>
            <li><strong>FORM_HEADER:</strong> Trang có mã số mới → bắt đầu tài liệu mới</li>
            <li><strong>SOURCE_HEADER sau FORM_HEADER:</strong> Bản tin nguồn sau biểu mẫu</li>
          </ol>
        </div>
      </div>
    </div>

    <div className="glass-strong rounded-2xl p-8 border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Routing Logic</h2>
      
      <div className="space-y-4 text-slate-700">
        <p className="leading-relaxed">
          Mỗi tài liệu sau khi tách sẽ được xác định đường dẫn lưu trữ dựa trên mã số và service code.
        </p>

        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-2">Quy Tắc Routing:</h3>
          
          <div className="space-y-3 text-sm">
            <div>
              <strong className="text-slate-900">QT.01 / KTKS.01:</strong>
              <p className="text-slate-900/70 ml-4">→ COVER/COVER/{'{broadcastCode}'} hoặc COVER/KTKSTC BM 01/{'{broadcastCode}'}</p>
            </div>
            
            <div>
              <strong className="text-slate-900">QT.02 / KTKS.02 (NTX/RTP):</strong>
              <p className="text-slate-900/70 ml-4">→ DICH VU {'{serviceCode}'}/BAN TIN NGUON DA DUOC XU LY/...</p>
            </div>
            
            <div>
              <strong className="text-slate-900">QT.03 / KTKS.03:</strong>
              <p className="text-slate-900/70 ml-4">→ DICH VU {'{serviceCode}'}/BAN TIN XU LY PHAT/...</p>
            </div>
            
            <div>
              <strong className="text-slate-900">QT.04 / KTKS.04:</strong>
              <p className="text-slate-900/70 ml-4">→ DICH VU {'{serviceCode}'}/KIEM TRA KIEM SOAT SAU PHAT/{'{broadcastCode}'}</p>
            </div>
            
            <div>
              <strong className="text-slate-900">Bản Tin Nguồn (không có QT/KTKS):</strong>
              <p className="text-slate-900/70 ml-4">→ BAN TIN NGUON/{'{broadcastCode}'}</p>
            </div>
            
            <div>
              <strong className="text-slate-900">LOG Pages:</strong>
              <p className="text-slate-900/70 ml-4">→ LOG FTP/{'{broadcastCode}'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div className="glass-strong rounded-2xl p-8 border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Folder Structure</h2>
      
      <div className="space-y-4 text-slate-700">
        <p className="leading-relaxed">
          Cấu trúc thư mục được định nghĩa theo nghiệp vụ thực tế của Đài TTDH Đà Nẵng:
        </p>

        <pre className="bg-black/30 p-4 rounded text-xs overflow-x-auto">
{`DNR/
└── PHAT MSI & SAR THANG 11-2025/
    ├── BAN TIN NGUON/
    │   ├── MET/
    │   ├── NAV/
    │   ├── SAR/
    │   └── WX/
    ├── COVER/
    │   ├── COVER/
    │   └── KTKSTC BM 01/
    ├── DICH VU NTX/
    │   ├── BAN TIN NGUON DA DUOC XU LY/
    │   ├── BAN TIN XU LY PHAT/
    │   └── KIEM TRA KIEM SOAT SAU PHAT/
    ├── DICH VU RTP/
    │   └── (tương tự NTX)
    ├── DICH VU EGC/
    │   └── ...
    └── LOG FTP/
        ├── MET/
        ├── NAV/
        ├── SAR/
        └── WX/`}
        </pre>
      </div>
    </div>
  </div>
);

const FileManagementSection: React.FC = () => (
  <div className="space-y-6">
    <div className="glass-strong rounded-2xl p-8 border border-slate-200">
      <h1 className="text-3xl font-black text-slate-900 mb-4 flex items-center gap-3">
        <FolderTree className="text-blue-600" />
        Quản Lý File
      </h1>
      <p className="text-slate-700 text-lg leading-relaxed">
        Hệ thống sử dụng File System Access API để lưu trữ file trực tiếp vào máy tính người dùng, 
        đảm bảo tính bảo mật và không cần server.
      </p>
    </div>

    <div className="glass-strong rounded-2xl p-8 border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-4">File System Access API</h2>
      
      <div className="space-y-4 text-slate-700">
        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-2">1. Request Directory Permission</h3>
          <p className="text-sm mb-2">Người dùng chọn thư mục đích một lần:</p>
          <pre className="bg-black/30 p-3 rounded text-xs overflow-x-auto">
{`const handle = await window.showDirectoryPicker();
// Lưu handle để sử dụng sau`}
          </pre>
        </div>

        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-2">2. Create Directory Structure</h3>
          <p className="text-sm mb-2">Tạo cấu trúc thư mục tự động:</p>
          <pre className="bg-black/30 p-3 rounded text-xs overflow-x-auto">
{`async function getOrCreateDirectory(
  rootHandle: FileSystemDirectoryHandle,
  pathParts: string[]
): Promise<FileSystemDirectoryHandle> {
  let current = rootHandle;
  for (const part of pathParts) {
    current = await current.getDirectoryHandle(part, { create: true });
  }
  return current;
}`}
          </pre>
        </div>

        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-2">3. Save Files</h3>
          <p className="text-sm mb-2">Lưu file vào thư mục:</p>
          <pre className="bg-black/30 p-3 rounded text-xs overflow-x-auto">
{`const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
const writable = await fileHandle.createWritable();
await writable.write(bytes);
await writable.close();`}
          </pre>
        </div>
      </div>
    </div>

    <div className="glass-strong rounded-2xl p-8 border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-4">TEMP_EXTRACT Structure</h2>
      
      <div className="space-y-4 text-slate-700">
        <p className="leading-relaxed">
          Tất cả file được tách sẽ được lưu tạm vào thư mục TEMP_EXTRACT trước khi người dùng đồng bộ vào thư mục đích:
        </p>

        <pre className="bg-black/30 p-4 rounded text-xs overflow-x-auto">
{`TEMP_EXTRACT/
└── {fileName}/
    ├── extraction-summary.json  # Metadata về quá trình tách
    └── PDFS/
        ├── {doc1}.pdf
        ├── {doc2}.pdf
        └── {log}.pdf`}
        </pre>

        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-2">extraction-summary.json</h3>
          <p className="text-sm mb-2">Chứa thông tin chi tiết về:</p>
          <ul className="space-y-1 text-sm list-disc list-inside">
            <li>Danh sách các tài liệu đã tách (filename, code, pages...)</li>
            <li>Danh sách LOG files</li>
            <li>Broadcast code và service code</li>
            <li>Recommended path cho mỗi file</li>
          </ul>
        </div>
      </div>
    </div>

    <div className="glass-strong rounded-2xl p-8 border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Sync Files</h2>
      
      <div className="space-y-4 text-slate-700">
        <p className="leading-relaxed">
          Sau khi xử lý xong, người dùng có thể đồng bộ file từ TEMP_EXTRACT vào thư mục đích đã chọn ban đầu. 
          Hệ thống sẽ đọc extraction-summary.json và copy các file vào đúng vị trí.
        </p>

        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-2">Quy trình sync:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Đọc extraction-summary.json từ TEMP_EXTRACT</li>
            <li>Duyệt qua danh sách documents và logs</li>
            <li>Đọc file PDF từ TEMP_EXTRACT/PDFS</li>
            <li>Copy vào thư mục đích theo recommendedPath</li>
            <li>Báo cáo kết quả (thành công/thất bại)</li>
          </ol>
        </div>
      </div>
    </div>
  </div>
);

const JobQueueSection: React.FC = () => (
  <div className="space-y-6">
    <div className="glass-strong rounded-2xl p-8 border border-slate-200">
      <h1 className="text-3xl font-black text-slate-900 mb-4 flex items-center gap-3">
        <Zap className="text-blue-600" />
        Job Queue System
      </h1>
      <p className="text-slate-700 text-lg leading-relaxed">
        Hệ thống hàng đợi cho phép xử lý nhiều file PDF cùng lúc một cách tuần tự, 
        đảm bảo không vượt quá rate limit của API và cung cấp feedback real-time cho người dùng.
      </p>
    </div>

    <div className="glass-strong rounded-2xl p-8 border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Queue Management</h2>
      
      <div className="space-y-4 text-slate-700">
        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-2">Job States:</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <strong className="text-slate-900">pending:</strong> File đã được thêm vào queue, chờ xử lý
            </li>
            <li>
              <strong className="text-slate-900">processing:</strong> Đang được xử lý (convert, analyze, split...)
            </li>
            <li>
              <strong className="text-slate-900">completed:</strong> Đã xử lý xong thành công
            </li>
            <li>
              <strong className="text-slate-900">error:</strong> Có lỗi xảy ra trong quá trình xử lý
            </li>
          </ul>
        </div>

        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-2">Processing Flow:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>File được thêm vào queue với state "pending"</li>
            <li>Worker tự động lấy job đầu tiên và chuyển sang "processing"</li>
            <li>Thực hiện các bước: convert → analyze → split → save</li>
            <li>Cập nhật progress (0-100%) trong quá trình xử lý</li>
            <li>Khi xong, chuyển sang "completed" hoặc "error"</li>
            <li>Lấy job tiếp theo và lặp lại</li>
          </ol>
        </div>
      </div>
    </div>

    <div className="glass-strong rounded-2xl p-8 border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Progress Tracking</h2>
      
      <div className="space-y-4 text-slate-700">
        <p className="leading-relaxed">
          Hệ thống cung cấp thông tin chi tiết về tiến độ xử lý cho từng file:
        </p>

        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <ul className="space-y-2 text-sm">
            <li>• Progress bar hiển thị phần trăm hoàn thành (0-100%)</li>
            <li>• Thời gian đã xử lý (elapsed time)</li>
            <li>• Thời gian hoàn thành (nếu đã xong)</li>
            <li>• Số lượng tài liệu đã tách được</li>
            <li>• Thông báo lỗi chi tiết (nếu có)</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
);

const ArchitectureSection: React.FC = () => (
  <div className="space-y-6">
    <div className="glass-strong rounded-2xl p-8 border border-slate-200">
      <h1 className="text-3xl font-black text-slate-900 mb-4 flex items-center gap-3">
        <Database className="text-blue-600" />
        Kiến Trúc Chi Tiết
      </h1>
      <p className="text-slate-700 text-lg leading-relaxed">
        Tài liệu này mô tả cấu trúc code và các thành phần chính của hệ thống.
      </p>
    </div>

    <div className="glass-strong rounded-2xl p-8 border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Component Structure</h2>
      
      <div className="space-y-4 text-slate-700">
        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-2">App.tsx</h3>
          <p className="text-sm">Component chính, quản lý state toàn cục và routing giữa các view.</p>
        </div>

        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-2">Components/</h3>
          <ul className="space-y-1 text-sm">
            <li>• UploadArea.tsx: Vùng upload file</li>
            <li>• JobQueueViewer.tsx: Hiển thị danh sách job và progress</li>
            <li>• SplitterViewer.tsx: Hiển thị kết quả tách file</li>
            <li>• InvoiceViewer.tsx: Hiển thị kết quả OCR hóa đơn</li>
            <li>• IncidentViewer.tsx: Hiển thị kết quả OCR báo cáo sự cố</li>
            <li>• DocumentationViewer.tsx: Trang hướng dẫn (component này)</li>
          </ul>
        </div>
      </div>
    </div>

    <div className="glass-strong rounded-2xl p-8 border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Service Layer</h2>
      
      <div className="space-y-4 text-slate-700">
        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-2">Services/</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <strong className="text-slate-900">pdfUtils.ts:</strong> Convert PDF to images
            </li>
            <li>
              <strong className="text-slate-900">geminiService.ts:</strong> Tất cả các hàm gọi Gemini API
            </li>
            <li>
              <strong className="text-slate-900">pdfSplitter.ts:</strong> Logic tách file PDF
            </li>
            <li>
              <strong className="text-slate-900">fileSaver.ts:</strong> Lưu file vào filesystem
            </li>
            <li>
              <strong className="text-slate-900">fileSync.ts:</strong> Đồng bộ file từ TEMP_EXTRACT
            </li>
            <li>
              <strong className="text-slate-900">jobQueue.ts:</strong> Quản lý hàng đợi xử lý
            </li>
            <li>
              <strong className="text-slate-900">apiUsageTracker.ts:</strong> Theo dõi sử dụng API (nếu cần)
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
);

const TroubleshootingSection: React.FC = () => (
  <div className="space-y-6">
    <div className="glass-strong rounded-2xl p-8 border border-slate-200">
      <h1 className="text-3xl font-black text-slate-900 mb-4 flex items-center gap-3">
        <AlertCircle className="text-blue-600" />
        Xử Lý Sự Cố
      </h1>
      <p className="text-slate-700 text-lg leading-relaxed">
        Hướng dẫn xử lý các vấn đề thường gặp và cách debug hệ thống.
      </p>
    </div>

    <div className="glass-strong rounded-2xl p-8 border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Common Issues</h2>
      
      <div className="space-y-4 text-slate-700">
        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-2">1. API Key không hoạt động</h3>
          <ul className="space-y-1 text-sm list-disc list-inside">
            <li>Kiểm tra file .env có GEMINI_API_KEY</li>
            <li>Đảm bảo API key còn hiệu lực</li>
            <li>Kiểm tra console log để xem lỗi chi tiết</li>
          </ul>
        </div>

        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-2">2. File không được tách đúng</h3>
          <ul className="space-y-1 text-sm list-disc list-inside">
            <li>Kiểm tra extraction-summary.json trong TEMP_EXTRACT</li>
            <li>Xem console log để biết logic routing</li>
            <li>Có thể cần điều chỉnh prompt trong geminiService.ts</li>
          </ul>
        </div>

        <div className="glass-light rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-2">3. Rate Limit bị vượt quá</h3>
          <ul className="space-y-1 text-sm list-disc list-inside">
            <li>Giảm số lượng file xử lý cùng lúc</li>
            <li>Tăng delay giữa các requests trong jobQueue</li>
            <li>Sử dụng batch processing hiệu quả hơn</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
);


import React, { useState, useEffect, useRef } from 'react';
import { RecordFile, Employee, Holiday, User, UserRole, RecordStatus } from '../../types';
import { removeVietnameseTones, getGcnWorkflowStepsHelper, isMeasurementType, isRegType, isArchiveType } from '../../utils/appHelpers';
import { STATUS_LABELS } from '../../constants';
import { getEmployeeTeam } from '../AssignModal';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Search, 
  Scan, 
  MapPin, 
  User as UserIcon, 
  Phone, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Camera, 
  X, 
  ChevronRight, 
  Lock,
  ArrowLeft,
  Info,
  Building
} from 'lucide-react';

interface MobileSearchTabProps {
  records: RecordFile[];
  employees: Employee[];
  holidays: Holiday[];
  currentUser: User;
  onViewRecordDetail: (r: RecordFile) => void;
}

// Hàm kiểm tra phân quyền xem hồ sơ trùng khớp với Desktop và useRecordFilter
export function canUserViewRecord(record: RecordFile, currentUser: User | null, employees: Employee[]): boolean {
  if (!currentUser) return false;
  
  // ADMIN, SUBADMIN, ONEDOOR được xem toàn bộ hồ sơ
  if (
    currentUser.role === UserRole.ADMIN || 
    currentUser.role === UserRole.SUBADMIN || 
    currentUser.role === UserRole.ONEDOOR
  ) {
    return true;
  }
  
  // Lấy thông tin Employee của người đăng nhập
  const emp = employees.find(e => e.id === currentUser.employeeId);
  if (!emp) return false;
  
  const teamName = getEmployeeTeam(emp);
  
  // Quyền ưu tiên cao nhất: Được giao việc trực tiếp
  const isDirectlyAssigned = 
    record.assignedTo === currentUser.employeeId ||
    record.checkedBy === currentUser.employeeId ||
    record.submittedTo === currentUser.employeeId ||
    record.receivedBy === currentUser.employeeId;
    
  if (isDirectlyAssigned) {
    return true;
  }

  // Nếu không được phân công trực tiếp, phân quyền chặt chẽ theo Tổ chuyên môn (như bản PC)
  if (teamName === 'Tổ Đo đạc') {
    if (!isMeasurementType(record.recordType)) return false;
  } else if (teamName === 'Tổ Cấp giấy') {
    if (!isRegType(record.recordType)) return false;
  } else if (teamName === 'Tổ Lưu trữ') {
    if (!isArchiveType(record.recordType)) return false;
  }
  
  // EMPLOYEE chỉ được xem hồ sơ được phân công cho mình (ở trên đã check isDirectlyAssigned)
  if (currentUser.role === UserRole.EMPLOYEE) {
    return false;
  }
  
  // TEAM_LEADER được xem hồ sơ thuộc địa bàn xã phường quản lý (đã lọc theo Tổ chuyên môn ở trên)
  if (currentUser.role === UserRole.TEAM_LEADER) {
    const isMyWard = emp.managedWards && emp.managedWards.some((w: string) => record.ward && record.ward.includes(w));
    return !!isMyWard;
  }
  
  return false;
}

const MobileSearchTab: React.FC<MobileSearchTabProps> = ({
  records,
  employees,
  holidays,
  currentUser,
  onViewRecordDetail
}) => {
  const [query, setQuery] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<RecordFile | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccessMsg, setScanSuccessMsg] = useState<string | null>(null);
  
  const qrCodeInstanceRef = useRef<Html5Qrcode | null>(null);
  const scannerId = "mobile-barcode-reader";

  // Dọn dẹp máy quét khi unmount
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    setScanError(null);
    setScanSuccessMsg(null);
    setIsScanning(true);

    // Chờ DOM render phần tử reader
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode(scannerId);
        qrCodeInstanceRef.current = html5QrCode;

        const config = { 
          fps: 10, 
          qrbox: { width: 280, height: 150 }, // Thiết lập hộp quét phù hợp mã vạch (dài, hẹp)
          aspectRatio: 1.777778
        };

        const tryStart = async (cameraSource: any) => {
          return html5QrCode.start(
            cameraSource,
            config,
            (decodedText) => {
              // Thành công quét mã
              handleScanSuccess(decodedText);
            },
            (errorMessage) => {
              // Lỗi không đọc được tạm thời (bình thường trong lúc camera lấy nét, bỏ qua để tránh spam thông báo)
            }
          );
        };

        try {
          // Thử camera sau trước (ưu tiên cho điện thoại)
          await tryStart({ facingMode: "environment" });
        } catch (firstErr) {
          console.warn("Không tìm thấy camera sau, thử camera trước...", firstErr);
          try {
            // Thử camera trước / camera mặc định
            await tryStart({ facingMode: "user" });
          } catch (secondErr) {
            console.warn("Không tìm thấy camera user, thử lấy danh sách thiết bị...", secondErr);
            try {
              const devices = await Html5Qrcode.getCameras();
              if (devices && devices.length > 0) {
                // Dùng camera đầu tiên tìm thấy
                await tryStart(devices[0].id);
              } else {
                throw new Error("Không tìm thấy thiết bị camera nào.");
              }
            } catch (thirdErr) {
              throw new Error("Không phát hiện bất kỳ thiết bị camera hoạt động nào hoặc quyền truy cập bị từ chối.");
            }
          }
        }
      } catch (err: any) {
        console.error("Camera error:", err);
        setScanError(
          "Không tìm thấy camera hoặc không thể truy cập. Hãy chắc chắn rằng bạn đã cấp quyền cho camera, ứng dụng đang chạy HTTPS, hoặc nhập trực tiếp mã số biên nhận vào ô tìm kiếm."
        );
        setIsScanning(false);
      }
    }, 300);
  };

  const stopScanning = async () => {
    if (qrCodeInstanceRef.current && qrCodeInstanceRef.current.isScanning) {
      try {
        await qrCodeInstanceRef.current.stop();
      } catch (err) {
        console.error("Failed to stop scanner", err);
      }
    }
    qrCodeInstanceRef.current = null;
    setIsScanning(false);
  };

  const handleScanSuccess = (decodedText: string) => {
    const cleanCode = decodedText.trim();
    setScanSuccessMsg(`Đã nhận diện mã: ${cleanCode}`);
    setQuery(cleanCode);
    stopScanning();

    // Tìm hồ sơ tương ứng ngay lập tức
    const found = records.find(
      (r) => r.code.toLowerCase() === cleanCode.toLowerCase()
    );
    if (found) {
      setSelectedRecord(found);
    } else {
      setSelectedRecord(null);
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Tìm kiếm chính xác mã vạch/mã hồ sơ trước tiên
    const exactMatch = records.find(
      (r) => r.code.toLowerCase() === query.trim().toLowerCase()
    );
    
    if (exactMatch) {
      setSelectedRecord(exactMatch);
    } else {
      // Nếu không khớp chính xác mã, ta hiển thị danh sách kết quả đề xuất ở dưới,
      // người dùng có thể nhấp vào để xem chi tiết
      setSelectedRecord(null);
    }
  };

  // Danh sách gợi ý / kết quả tìm kiếm tương đối - Phân quyền chặt chẽ như PC
  const searchResults = React.useMemo(() => {
    if (!query.trim()) return [];
    
    const normQuery = removeVietnameseTones(query.toLowerCase());
    
    return records.filter(r => {
      // Lọc phân quyền chặt chẽ như bản PC
      if (!canUserViewRecord(r, currentUser, employees)) return false;

      // Tìm theo Tên, SĐT, Mã hồ sơ
      const matchCode = r.code.toLowerCase().includes(query.toLowerCase());
      const matchName = removeVietnameseTones(r.customerName).includes(normQuery);
      const matchPhone = r.phoneNumber && r.phoneNumber.includes(query);
      return matchCode || matchName || matchPhone;
    });
  }, [query, records, currentUser, employees]);

  // Lấy danh sách quy trình hồ sơ đã chọn
  const workflowData = React.useMemo(() => {
    if (!selectedRecord) return null;
    try {
      return getGcnWorkflowStepsHelper(selectedRecord, holidays);
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [selectedRecord, holidays]);

  const hasViewPermission = selectedRecord 
    ? canUserViewRecord(selectedRecord, currentUser, employees)
    : false;

  const getStatusBadgeClass = (status: RecordStatus) => {
    switch (status) {
      case RecordStatus.RECEIVED: return 'bg-blue-50 text-blue-700 border-blue-200';
      case RecordStatus.ASSIGNED: return 'bg-orange-50 text-orange-700 border-orange-200';
      case RecordStatus.IN_PROGRESS: return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case RecordStatus.COMPLETED_WORK: return 'bg-purple-50 text-purple-700 border-purple-200';
      case RecordStatus.PENDING_CHECK: return 'bg-pink-50 text-pink-700 border-pink-200';
      case RecordStatus.CHECKED: return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case RecordStatus.PENDING_SIGN: return 'bg-violet-50 text-violet-700 border-violet-200';
      case RecordStatus.SIGNED: return 'bg-sky-50 text-sky-700 border-sky-200';
      case RecordStatus.HANDOVER: return 'bg-green-50 text-green-700 border-green-200';
      case RecordStatus.RETURNED: return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case RecordStatus.WITHDRAWN: return 'bg-slate-50 text-slate-700 border-slate-200';
      case RecordStatus.REJECTED: return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800">
      {/* Banner / Header - Super compact space-saving */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-3 py-2.5 shrink-0 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Search size={18} />
          <h2 className="text-sm font-black tracking-tight uppercase">Tra Cứu Hồ Sơ</h2>
        </div>
        <p className="text-[10px] text-blue-100 opacity-80 hidden xs:block">
          Tìm theo Tên, SĐT, Mã HS
        </p>
      </div>

      <div className="p-2.5 space-y-3 flex-1">
        {/* Search Input Box */}
        <div className="bg-white rounded-xl p-2.5 shadow-sm border border-slate-100 space-y-2.5">
          <form onSubmit={handleManualSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Nhập tên, số điện thoại, mã HS..." 
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (selectedRecord && e.target.value !== selectedRecord.code) {
                    setSelectedRecord(null);
                  }
                }}
              />
              {query && (
                <button 
                  type="button" 
                  onClick={() => { setQuery(''); setSelectedRecord(null); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Camera Scan Button */}
            <button
              type="button"
              onClick={isScanning ? stopScanning : startScanning}
              className={`px-4 bg-blue-50 border border-blue-200 text-blue-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-100 active:scale-95 transition-all shadow-sm ${isScanning ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : ''}`}
              title="Quét mã vạch biên nhận"
            >
              {isScanning ? <X size={18} /> : <Camera size={18} />}
              <span className="text-xs font-bold shrink-0">
                {isScanning ? "Hủy" : "Quét mã"}
              </span>
            </button>
          </form>

          {/* Camera Scanning Stream Box */}
          {isScanning && (
            <div className="border-2 border-dashed border-blue-400 bg-slate-900 rounded-2xl overflow-hidden p-2 flex flex-col items-center justify-center relative animate-fade-in">
              <div className="w-full max-w-sm overflow-hidden rounded-xl bg-black">
                <div id={scannerId} className="w-full min-h-[180px]"></div>
              </div>
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {/* Visual guideline overlays for scanning barcodes */}
                <div className="w-3/4 h-[80px] border-2 border-red-500 rounded-lg opacity-80 flex items-center justify-center relative">
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-600 animate-bounce shadow-glow"></div>
                </div>
              </div>
              <p className="text-[11px] text-white/90 font-medium text-center mt-3 bg-black/60 px-3 py-1 rounded-full z-10">
                Đưa mã vạch trên biên nhận vào khung màu đỏ để tự động quét
              </p>
              <button
                onClick={stopScanning}
                className="absolute top-3 right-3 bg-red-600 text-white p-1.5 rounded-full shadow-lg hover:bg-red-700"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {scanError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex gap-2 leading-relaxed">
              <AlertCircle size={16} className="shrink-0 text-red-500 mt-0.5" />
              <span>{scanError}</span>
            </div>
          )}

          {scanSuccessMsg && (
            <div className="p-2.5 bg-green-50 border border-green-200 text-green-700 rounded-xl text-xs flex gap-2 font-bold items-center">
              <CheckCircle2 size={16} className="shrink-0 text-green-500" />
              <span>{scanSuccessMsg}</span>
            </div>
          )}
        </div>

        {/* ----------------- CASE 1: NO RECORD SELECTED YET ----------------- */}
        {!selectedRecord && (
          <div className="space-y-2.5">
            {searchResults.length > 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kết quả tìm thấy ({searchResults.length})</span>
                  <Info size={12} className="text-slate-400" />
                </div>
                <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto">
                  {searchResults.map((record) => {
                    const permitted = canUserViewRecord(record, currentUser, employees);
                    return (
                      <div
                        key={record.id}
                        onClick={() => setSelectedRecord(record)}
                        className="px-3 py-2 flex justify-between items-center hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer text-left"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="font-extrabold text-slate-800 text-xs truncate">{record.customerName}</span>
                            {!permitted && <Lock size={10} className="text-slate-400 shrink-0" />}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                            <span>{record.code}</span>
                            <span>•</span>
                            <span className="truncate max-w-[120px]">{record.recordType}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 text-blue-600 font-bold text-[10px] shrink-0">
                          {permitted ? "Xem" : "Bị khóa"}
                          <ChevronRight size={12} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : query.trim() ? (
              <div className="bg-white rounded-xl p-6 border border-slate-100 text-center text-slate-400 flex flex-col items-center justify-center">
                <Search size={36} className="opacity-15 mb-1.5" />
                <p className="text-xs font-bold text-slate-650">Không tìm thấy hồ sơ trùng khớp</p>
                <p className="text-[10px] mt-0.5 text-slate-400 max-w-[220px]">Hãy thử tìm bằng SĐT, Tên hoặc Mã hồ sơ chính xác.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl p-5 border border-slate-100 text-center text-slate-400 flex flex-col items-center justify-center space-y-1.5">
                <Scan size={30} className="text-blue-500 opacity-30 animate-pulse" />
                <p className="text-[11px] font-bold text-slate-600">Đang chờ quét mã vạch hoặc tìm kiếm...</p>
                <p className="text-[10px] text-slate-400 max-w-[220px]">Quét hoặc tìm hồ sơ để theo dõi quy trình, người phụ trách và tiến độ chi tiết.</p>
              </div>
            )}
          </div>
        )}

        {/* ----------------- CASE 2: RECORD IS SELECTED ----------------- */}
        {selectedRecord && (
          <div className="space-y-3 animate-fade-in">
            {/* Quick Back Header */}
            <div className="flex justify-between items-center px-0.5">
              <button 
                onClick={() => setSelectedRecord(null)}
                className="text-[11px] font-bold text-blue-600 flex items-center gap-1 py-1 px-2 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <ArrowLeft size={12} /> Trở về danh sách
              </button>
              
              <button 
                onClick={() => onViewRecordDetail(selectedRecord)}
                className="text-[11px] font-bold text-indigo-600 flex items-center gap-1 py-1 px-2 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                Xem chi tiết đầy đủ <ChevronRight size={12} />
              </button>
            </div>

            {/* Permission Guard Alert */}
            {!hasViewPermission ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center space-y-2">
                <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                  <Lock size={18} />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">Hồ sơ đã bị ẩn quyền truy cập</h3>
                <p className="text-[11px] text-slate-600 leading-relaxed max-w-sm mx-auto">
                  Tài khoản của bạn (vai trò <strong>{currentUser.role}</strong>) không thuộc diện phân quyền được xem hồ sơ <strong>{selectedRecord.code}</strong> này.
                </p>
                <p className="text-[10px] text-slate-500 italic">
                  * Chỉ có Admin, Sub-admin, Một cửa, hoặc Cán bộ được phân công trực tiếp/quản lý địa bàn xã phường này mới được phép theo dõi quy trình hồ sơ này.
                </p>
              </div>
            ) : (
              // ----------------- AUTHORIZED VIEWER -----------------
              <div className="space-y-3">
                
                {/* Record Metadata Card - Super Compact */}
                <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 space-y-2.5">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-bold uppercase tracking-wider font-mono">
                        Mã: {selectedRecord.code}
                      </span>
                      <h3 className="font-extrabold text-slate-800 text-base mt-0.5 leading-tight">
                        {selectedRecord.customerName}
                      </h3>
                      {selectedRecord.phoneNumber && (
                        <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                          <Phone size={11} /> {selectedRecord.phoneNumber}
                        </p>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border uppercase tracking-wider shrink-0 ${getStatusBadgeClass(selectedRecord.status)}`}>
                      {STATUS_LABELS[selectedRecord.status]}
                    </span>
                  </div>

                  {/* Core Specs Grid */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-0.5">
                    <div className="space-y-0.2">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                        <MapPin size={10} /> Xã phường
                      </span>
                      <p className="text-xs font-bold text-slate-700 truncate">{selectedRecord.ward || 'Chưa rõ'}</p>
                    </div>
                    <div className="space-y-0.2">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                        <Building size={10} /> Số Tờ / Số Thửa
                      </span>
                      <p className="text-xs font-bold text-slate-700 truncate">
                        {selectedRecord.mapSheet ? `Tờ ${selectedRecord.mapSheet}` : 'Chưa rõ'} / {selectedRecord.landPlot ? `Thửa ${selectedRecord.landPlot}` : 'Chưa rõ'}
                      </p>
                    </div>
                    <div className="space-y-0.2">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                        <Calendar size={10} /> Ngày tiếp nhận
                      </span>
                      <p className="text-xs font-bold text-slate-700">{selectedRecord.receivedDate || 'N/A'}</p>
                    </div>
                    <div className="space-y-0.2">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                        <Clock size={10} /> Hạn xử lý dự kiến
                      </span>
                      <p className={`text-xs font-bold truncate ${selectedRecord.status !== RecordStatus.HANDOVER && selectedRecord.status !== RecordStatus.RETURNED && selectedRecord.deadline && new Date() > new Date(selectedRecord.deadline) ? 'text-red-600' : 'text-slate-700'}`}>
                        {selectedRecord.deadline || 'Chưa định đoạt'}
                      </p>
                    </div>
                    <div className="space-y-0.2 col-span-2 border-t border-slate-50 pt-1.5">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                        <UserIcon size={10} /> Cán bộ xử lý
                      </span>
                      <p className="text-xs font-bold text-slate-700">
                        {selectedRecord.assignedTo ? (
                          <span>
                            {employees.find(e => e.id === selectedRecord.assignedTo)?.name || 'Chưa rõ danh tính'} 
                            <span className="text-slate-400 font-normal text-[11px]">
                              {employees.find(e => e.id === selectedRecord.assignedTo)?.department ? ` (${employees.find(e => e.id === selectedRecord.assignedTo)?.department})` : ''}
                            </span>
                          </span>
                        ) : (
                          <span className="text-amber-600 italic">Chưa phân công cán bộ</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step-by-Step Workflow Progress Timeline (Tiến độ quy trình) */}
                <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 space-y-3">
                  <div className="border-b border-slate-100 pb-1.5 flex justify-between items-center">
                    <h4 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1">
                      <Clock size={14} className="text-blue-500" />
                      Quy Trình & Tiến Độ Xử Lý
                    </h4>
                    {workflowData?.type && (
                      <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.2 rounded-full uppercase tracking-wider font-mono">
                        {workflowData.type.replace('_', ' ')}
                      </span>
                    )}
                  </div>

                  {workflowData && workflowData.steps && workflowData.steps.length > 0 ? (
                    <div className="relative pl-5 space-y-3.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-150">
                      {workflowData.steps.map((step, idx) => {
                        const isCompleted = step.status === 'completed';
                        const isCurrent = step.status === 'current';
                        const isOverdue = step.isOverdue;
                        
                        let dotClass = "bg-slate-200 border-white text-slate-400";
                        let textClass = "text-slate-400 font-medium";
                        let cardClass = "bg-slate-50/50 border-slate-100";

                        if (isCompleted) {
                          dotClass = "bg-green-500 border-green-200 text-white shadow-sm shadow-green-100";
                          textClass = "text-slate-800 font-semibold";
                          cardClass = "bg-white border-slate-100";
                        } else if (isCurrent) {
                          dotClass = isOverdue 
                            ? "bg-red-500 border-red-200 text-white animate-pulse shadow-sm shadow-red-100" 
                            : "bg-blue-600 border-blue-200 text-white animate-pulse shadow-sm shadow-blue-100";
                          textClass = "text-blue-700 font-extrabold";
                          cardClass = isOverdue 
                            ? "bg-red-50/40 border-red-100 ring-1 ring-red-100" 
                            : "bg-blue-50/40 border-blue-100 ring-1 ring-blue-100";
                        }

                        return (
                          <div key={idx} className="relative flex flex-col gap-0.5 text-left">
                            {/* Step Indicator Bullet */}
                            <div className={`absolute -left-[21.5px] top-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center text-[9px] z-10 transition-colors ${dotClass}`}>
                              {isCompleted ? "✓" : idx + 1}
                            </div>

                            {/* Step Card */}
                            <div className={`border p-2 rounded-lg shadow-xs transition-all ${cardClass}`}>
                              <div className="flex justify-between items-start gap-1.5">
                                <span className={`text-[11px] ${textClass}`}>{step.label}</span>
                                <span className={`text-[8px] font-extrabold px-1 py-0.2 rounded uppercase tracking-wider ${
                                  isCompleted 
                                    ? "bg-green-100 text-green-700" 
                                    : isCurrent 
                                      ? (isOverdue ? "bg-red-100 text-red-700 animate-pulse" : "bg-blue-100 text-blue-700") 
                                      : "bg-slate-100 text-slate-500"
                                }`}>
                                  {isCompleted ? "Xong" : isCurrent ? (isOverdue ? "Quá hạn" : "Đang làm") : "Chờ"}
                                </span>
                              </div>
                              
                              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] text-slate-500 font-medium">
                                {step.duration && step.duration !== '0 giờ' && (
                                  <span>Thời gian: <strong className="text-slate-600">{step.duration}</strong></span>
                                )}
                                {step.deadlineDate && (
                                  <span className={isCurrent && isOverdue ? "text-red-600 font-bold" : ""}>
                                    Hạn bước: <strong className={isCurrent && isOverdue ? "text-red-700" : "text-slate-600"}>{new Date(step.deadlineDate).toLocaleDateString('vi-VN')}</strong>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500 italic">
                      Chưa định hình các bước chi tiết cho quy trình hồ sơ này.
                    </div>
                  )}
                </div>

                {/* Important notices or defect details if any */}
                {selectedRecord.hasDefect && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-2 text-left">
                    <h5 className="text-xs font-extrabold text-red-700 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertCircle size={15} />
                      Sai sót phát hiện / Yêu cầu khắc phục
                    </h5>
                    <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                      Lý do: <span className="font-normal text-red-800">{selectedRecord.defectReason || 'Chưa ghi rõ lý do chi tiết.'}</span>
                    </p>
                    {selectedRecord.defectDate && (
                      <p className="text-[10px] text-slate-500 font-medium">
                        Ngày báo sai sót: {new Date(selectedRecord.defectDate).toLocaleDateString('vi-VN')}
                      </p>
                    )}
                  </div>
                )}
                
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileSearchTab;

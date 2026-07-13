import React, { useState, useMemo, useEffect, useRef } from 'react';
import { RecordFile, RecordStatus, Employee, User, UserRole } from '../../types';
import { STATUS_LABELS } from '../../constants';
import { isMeasurementType, isRegType, isArchiveType } from '../../utils/appHelpers';
import { canUserViewRecord } from './MobileSearchTab';
import { getEmployeeTeam } from '../AssignModal';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  Search, 
  Filter, 
  ChevronRight, 
  MapPin, 
  User as UserIcon, 
  Phone, 
  Calendar,
  MoreVertical,
  Plus,
  Layers,
  Ruler,
  Award,
  Archive,
  Grid,
  Camera,
  X
} from 'lucide-react';

interface MobileRecordListProps {
  records: RecordFile[];
  employees: Employee[];
  currentUser: User;
  onViewRecord: (r: RecordFile) => void;
  onEditRecord: (r: RecordFile) => void;
  onDeleteRecord: (r: RecordFile) => void;
  onAddRecord: () => void;
}

const MobileRecordList: React.FC<MobileRecordListProps> = ({ 
  records, 
  employees, 
  currentUser,
  onViewRecord, 
  onEditRecord, 
  onDeleteRecord,
  onAddRecord
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterWard, setFilterWard] = useState('all');

  const emp = useMemo(() => employees.find(e => e.id === currentUser.employeeId), [employees, currentUser.employeeId]);
  const teamName = useMemo(() => emp ? getEmployeeTeam(emp) : '', [emp]);

  const hasFullPermission = useMemo(() => {
    return (
      currentUser.role === UserRole.ADMIN || 
      currentUser.role === UserRole.SUBADMIN || 
      currentUser.role === UserRole.ONEDOOR ||
      teamName === 'Ban Giám đốc' || 
      teamName === 'Tổ Hành chính'
    );
  }, [currentUser.role, teamName]);

  const allowedDepts = useMemo(() => {
    if (hasFullPermission) {
      return ['all', 'dodac', 'capgiay', 'luutru', 'other'];
    }
    if (teamName === 'Tổ Đo đạc') return ['dodac'];
    if (teamName === 'Tổ Cấp giấy') return ['capgiay'];
    if (teamName === 'Tổ Lưu trữ') return ['luutru'];
    return [];
  }, [hasFullPermission, teamName]);

  const [activeDept, setActiveDept] = useState<'all' | 'dodac' | 'capgiay' | 'luutru' | 'other'>(() => {
    const initialEmp = employees.find(e => e.id === currentUser.employeeId);
    const initialTeamName = initialEmp ? getEmployeeTeam(initialEmp) : '';
    const initialHasFull = 
      currentUser.role === UserRole.ADMIN || 
      currentUser.role === UserRole.SUBADMIN || 
      currentUser.role === UserRole.ONEDOOR ||
      initialTeamName === 'Ban Giám đốc' || 
      initialTeamName === 'Tổ Hành chính';

    if (initialHasFull) return 'all';
    if (initialTeamName === 'Tổ Đo đạc') return 'dodac';
    if (initialTeamName === 'Tổ Cấp giấy') return 'capgiay';
    if (initialTeamName === 'Tổ Lưu trữ') return 'luutru';
    return 'all';
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const qrCodeInstanceRef = useRef<Html5Qrcode | null>(null);
  const scannerId = "mobile-record-list-barcode-reader";

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (qrCodeInstanceRef.current && qrCodeInstanceRef.current.isScanning) {
        qrCodeInstanceRef.current.stop().catch(err => console.error(err));
      }
    };
  }, []);

  const startScanning = async () => {
    setScanError(null);
    setIsScanning(true);

    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode(scannerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODABAR
          ],
          verbose: false
        });
        qrCodeInstanceRef.current = html5QrCode;

        const config = { 
          fps: 10, 
          qrbox: { width: 280, height: 150 },
          aspectRatio: 1.777778
        };

        const tryStart = async (cameraSource: any) => {
          return html5QrCode.start(
            cameraSource,
            config,
            (decodedText) => {
              handleScanSuccess(decodedText);
            },
            () => {}
          );
        };

        try {
          await tryStart({ facingMode: "environment" });
        } catch (firstErr) {
          try {
            await tryStart({ facingMode: "user" });
          } catch (secondErr) {
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
              await tryStart(devices[0].id);
            } else {
              throw new Error("Không tìm thấy camera");
            }
          }
        }
      } catch (err: any) {
        console.error("Camera error:", err);
        setScanError("Không thể truy cập camera. Vui lòng cấp quyền.");
        setIsScanning(false);
      }
    }, 300);
  };

  const stopScanning = async () => {
    if (qrCodeInstanceRef.current && qrCodeInstanceRef.current.isScanning) {
      try {
        await qrCodeInstanceRef.current.stop();
      } catch (err) {
        console.error(err);
      }
    }
    qrCodeInstanceRef.current = null;
    setIsScanning(false);
  };

  const handleScanSuccess = (decodedText: string) => {
    const cleanCode = decodedText.trim();
    setSearchTerm(cleanCode);
    stopScanning();
  };

  // Tính số lượng hồ sơ cho mỗi bộ phận để hiển thị huy hiệu (badge count) - Phân quyền chặt chẽ như PC
  const deptCounts = useMemo(() => {
    let dodac = 0;
    let capgiay = 0;
    let luutru = 0;
    let other = 0;
    const permittedRecords = records.filter(r => canUserViewRecord(r, currentUser, employees));
    permittedRecords.forEach(r => {
      if (isMeasurementType(r.recordType)) dodac++;
      else if (isRegType(r.recordType)) capgiay++;
      else if (isArchiveType(r.recordType)) luutru++;
      else other++;
    });
    return { all: permittedRecords.length, dodac, capgiay, luutru, other };
  }, [records, currentUser, employees]);

  // Reset page when filtering
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterWard, activeDept]);

  const filtered = useMemo(() => {
    const permittedRecords = records.filter(r => canUserViewRecord(r, currentUser, employees));
    return permittedRecords.filter(r => {
      // 1. Lọc theo bộ phận được chọn
      if (activeDept === 'dodac' && !isMeasurementType(r.recordType)) return false;
      if (activeDept === 'capgiay' && !isRegType(r.recordType)) return false;
      if (activeDept === 'luutru' && !isArchiveType(r.recordType)) return false;
      if (activeDept === 'other' && (isMeasurementType(r.recordType) || isRegType(r.recordType) || isArchiveType(r.recordType))) return false;

      // 2. Lọc theo từ khóa tìm kiếm (mở rộng thêm số biên nhận, số phát hành, số vào sổ)
      const matchesSearch = 
        r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.receiptNumber && r.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.issueNumber && r.issueNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.entryNumber && r.entryNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.phoneNumber && r.phoneNumber.includes(searchTerm));
      
      // 3. Lọc theo xã phường
      const matchesWard = filterWard === 'all' || r.ward === filterWard;

      return matchesSearch && matchesWard;
    });
  }, [records, searchTerm, filterWard, activeDept, currentUser, employees]);

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedRecords = filtered.slice(0, currentPage * itemsPerPage);
  const hasMore = currentPage < totalPages;

  const handleLoadMore = () => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const getStatusColor = (status: RecordStatus) => {
    switch (status) {
      case RecordStatus.RECEIVED: return 'bg-blue-100 text-blue-700 border-blue-200';
      case RecordStatus.ASSIGNED: return 'bg-orange-100 text-orange-700 border-orange-200';
      case RecordStatus.IN_PROGRESS: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case RecordStatus.COMPLETED_WORK: return 'bg-purple-100 text-purple-700 border-purple-200';
      case RecordStatus.PENDING_SIGN: return 'bg-pink-100 text-pink-700 border-pink-200';
      case RecordStatus.SIGNED: return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case RecordStatus.HANDOVER: return 'bg-green-100 text-green-700 border-green-200';
      case RecordStatus.RETURNED: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case RecordStatus.WITHDRAWN: return 'bg-slate-100 text-slate-700 border-slate-200';
      case RecordStatus.REJECTED: return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search & Filter Bar */}
      <div className="bg-white px-4 py-3 border-b border-slate-100 sticky top-0 z-10 shadow-sm space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Tìm tên, mã, SĐT..." 
              className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>
          
          {/* Camera Scan Button */}
          <button 
            onClick={isScanning ? stopScanning : startScanning}
            className={`w-10 h-10 border rounded-xl flex items-center justify-center transition-all shrink-0 ${
              isScanning 
                ? 'bg-red-50 border-red-200 text-red-600' 
                : 'bg-blue-50 border-blue-200 text-blue-600'
            }`}
            title="Quét mã vạch"
          >
            {isScanning ? <X size={18} /> : <Camera size={18} />}
          </button>

          <button className="w-10 h-10 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-slate-600 shrink-0">
            <Filter size={18} />
          </button>
        </div>

        {/* Camera Scanner Stream View */}
        {isScanning && (
          <div className="border-2 border-dashed border-blue-400 bg-slate-900 rounded-xl overflow-hidden p-2 flex flex-col items-center justify-center relative animate-fade-in">
            <div className="w-full max-w-sm overflow-hidden rounded-lg bg-black">
              <div id={scannerId} className="w-full min-h-[140px]"></div>
            </div>
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-3/4 h-[60px] border-2 border-red-500 rounded-md opacity-80 flex items-center justify-center relative">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-600 animate-bounce"></div>
              </div>
            </div>
            <p className="text-[10px] text-white/90 text-center mt-2 bg-black/60 px-3 py-1 rounded-full z-10">
              Đưa mã vạch hồ sơ vào khung quét để tìm kiếm
            </p>
          </div>
        )}

        {scanError && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-xl mt-1 flex items-center gap-2">
            <span>⚠️ {scanError}</span>
          </div>
        )}

        {/* Bộ lọc Phân hệ Bộ phận */}
        <div className="flex gap-1.5 overflow-x-auto pt-1 pb-1 scrollbar-none scroll-smooth">
          {[
            { id: 'all', label: 'Tất cả', count: deptCounts.all, icon: Layers, activeColor: 'bg-blue-600 text-white border-blue-600' },
            { id: 'dodac', label: 'Đo đạc', count: deptCounts.dodac, icon: Ruler, activeColor: 'bg-indigo-600 text-white border-indigo-600' },
            { id: 'capgiay', label: 'Cấp giấy', count: deptCounts.capgiay, icon: Award, activeColor: 'bg-teal-600 text-white border-teal-600' },
            { id: 'luutru', label: 'Lưu trữ', count: deptCounts.luutru, icon: Archive, activeColor: 'bg-amber-600 text-white border-amber-600' },
            { id: 'other', label: 'Khác', count: deptCounts.other, icon: Grid, activeColor: 'bg-slate-600 text-white border-slate-600' },
          ].filter(dept => allowedDepts.includes(dept.id)).map(dept => {
            const Icon = dept.icon;
            const isActive = activeDept === dept.id;
            return (
              <button
                key={dept.id}
                onClick={() => setActiveDept(dept.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all shrink-0 select-none ${
                  isActive 
                    ? dept.activeColor
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Icon size={12} />
                <span>{dept.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {dept.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Record List */}
      <div className="p-2 space-y-2 flex-1 overflow-y-auto">
        {paginatedRecords.length > 0 ? (
          <>
            {paginatedRecords.map((record) => (
              <div 
                key={record.id} 
                className="bg-white rounded-xl shadow-xs border border-slate-100 p-2.5 hover:bg-slate-50 active:scale-[0.99] transition-all cursor-pointer flex flex-col gap-1.5"
                onClick={() => onViewRecord(record)}
              >
                {/* Header Row: Customer Name & Code, Status Badges */}
                <div className="flex justify-between items-start gap-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-extrabold text-slate-800 text-xs sm:text-sm truncate max-w-[150px] sm:max-w-[240px]">{record.customerName}</h3>
                      <span className="text-[9px] font-mono font-semibold text-slate-500 bg-slate-100 px-1 py-0.2 rounded border border-slate-200/50 shrink-0">{record.code}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-extrabold border uppercase tracking-wider ${getStatusColor(record.status)}`}>
                      {STATUS_LABELS[record.status]}
                    </span>
                    {record.hasDefect && (
                      <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider shrink-0">
                        Sai sót
                      </span>
                    )}
                  </div>
                </div>

                {/* Sub Metadata Row: Compact Wrap-flexible badging with icons */}
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-slate-500 font-medium">
                  {record.ward && (
                    <div className="flex items-center gap-0.5">
                      <MapPin size={11} className="text-slate-400 shrink-0" />
                      <span className="truncate max-w-[80px]">{record.ward}</span>
                    </div>
                  )}
                  {record.phoneNumber && (
                    <div className="flex items-center gap-0.5">
                      <Phone size={11} className="text-slate-400 shrink-0" />
                      <span>{record.phoneNumber}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-0.5">
                    <Calendar size={11} className="text-slate-400 shrink-0" />
                    <span>{record.receivedDate || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <UserIcon size={11} className="text-slate-400 shrink-0" />
                    <span className="truncate max-w-[80px]">
                      {record.assignedTo ? (employees.find(e => e.id === record.assignedTo)?.name || 'N/A') : 'Chưa giao'}
                    </span>
                  </div>
                  {(record.mapSheet || record.landPlot) && (
                    <div className="flex items-center gap-0.5 bg-blue-50/70 text-blue-700 px-1.5 py-0.2 rounded text-[9px] font-extrabold border border-blue-100/50">
                      <span>Tờ {record.mapSheet || '?'} - Thửa {record.landPlot || '?'}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Pagination Controls */}
            {hasMore && (
              <div className="pt-3 pb-6 flex flex-col items-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleLoadMore(); }}
                  className="w-full py-2.5 bg-white border border-blue-200 text-blue-600 rounded-xl font-bold text-xs shadow-sm active:bg-blue-50 transition-colors flex items-center justify-center gap-1.5"
                >
                  Xem thêm hồ sơ
                  <span className="text-[9px] bg-blue-100 px-1.5 py-0.2 rounded-full">
                    {filtered.length - paginatedRecords.length}
                  </span>
                </button>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                  Trang {currentPage} / {totalPages}
                </p>
              </div>
            )}

            {!hasMore && filtered.length > itemsPerPage && (
              <div className="py-6 text-center">
                <p className="text-[10px] text-slate-400 font-medium italic">Bạn đã xem hết danh sách ({filtered.length} hồ sơ)</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Search size={40} className="mb-2 opacity-25" />
            <p className="text-xs font-bold">Không tìm thấy hồ sơ nào</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileRecordList;

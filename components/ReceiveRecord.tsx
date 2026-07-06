
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RecordFile, Employee, User, Holiday, RecordStatus } from '../types';
import { getNormalizedWard, REGISTRATION_PROCEDURES } from '../constants';
import { PlusCircle, FileSpreadsheet, LayoutList, Settings, RotateCcw, Gavel, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { generateDocxBlobAsync, hasTemplate, STORAGE_KEYS } from '../services/docxService';
import * as XLSX from 'xlsx-js-style';
import { confirmAction } from '../utils/appHelpers';

// Components
import RecordForm from './receive-record/RecordForm';
import BulkImport from './receive-record/BulkImport';
import DailyList from './receive-record/DailyList';
import TemplateConfigModal from './TemplateConfigModal';
import DocxPreviewModal from './DocxPreviewModal';
import ExcelPreviewModal from './ExcelPreviewModal';
import SystemReceiptTemplate from './receive-record/SystemReceiptTemplate';
import VPHCTab from './utilities/VPHCTab';

interface ReceiveRecordProps {
  onSave: (record: RecordFile, forceDeleteOnWithdrawn?: boolean) => Promise<RecordFile | null>;
  onDelete: (id: string) => Promise<boolean>;
  wards: string[];
  employees: Employee[];
  currentUser: User;
  records?: RecordFile[];
  holidays: Holiday[]; // New prop
  setCurrentView?: (view: string) => void;
  setRecordToContract?: (record: RecordFile | null) => void;
}

// Hàm chuyển đổi Âm lịch sang Dương lịch (Cố định cho các ngày lễ chính 2024-2026)
const getSolarDateFromLunar = (lunarDay: number, lunarMonth: number, year: number): Date | null => {
    const lunarMapping: Record<number, Record<string, string>> = {
        2024: { 
            "1/1": "2024-02-10", "2/1": "2024-02-11", "3/1": "2024-02-12", // Tết
            "10/3": "2024-04-18" // Giỗ tổ
        },
        2025: { 
            "1/1": "2025-01-29", "2/1": "2025-01-30", "3/1": "2025-01-31",
            "10/3": "2025-04-07"
        },
        2026: { 
            "1/1": "2026-02-17", "2/1": "2026-02-18", "3/1": "2026-02-19", 
            "10/3": "2026-04-26"
        }
    };

    const key = `${lunarDay}/${lunarMonth}`;
    if (lunarMapping[year] && lunarMapping[year][key]) {
        return new Date(lunarMapping[year][key]);
    }
    return null;
};

// Hàm định dạng ngày chuẩn YYYY-MM-DD theo giờ địa phương (tránh lệch múi giờ)
const formatDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const ReceiveRecord: React.FC<ReceiveRecordProps> = ({ onSave, onDelete, wards, employees, currentUser, records = [], holidays, setCurrentView, setRecordToContract }) => {
  const [viewMode, setViewMode] = useState<'create' | 'list' | 'bulk' | 'vphc'>('create');
  
  // State cho thông báo Custom (Toast)
  const [notification, setNotification] = useState<{ type: string, message: string } | null>(null);

  // Tự động ẩn thông báo sau 3 giây
  useEffect(() => {
      if (notification) {
          const timer = setTimeout(() => setNotification(null), 3000);
          return () => clearTimeout(timer);
      }
  }, [notification]);

  const notify = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
      setNotification({ type, message });
  };

  // State chỉnh sửa
  const [editingRecord, setEditingRecord] = useState<RecordFile | null>(null);

  // Modal States
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateType, setTemplateType] = useState<'receipt' | 'contract'>('receipt');
  
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');

  const [isExcelPreviewOpen, setIsExcelPreviewOpen] = useState(false);
  const [previewWorkbook, setPreviewWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [previewExcelName, setPreviewExcelName] = useState('');

  const [systemReceiptData, setSystemReceiptData] = useState<Partial<RecordFile> | null>(null);

  const combinedRecords = useMemo(() => {
      return [...records];
  }, [records]);

  // --- LOGIC TẠO MÃ HỒ SƠ (CẬP NHẬT CHÍNH XÁC THEO ĐỊA BÀN) ---
  const getShortCode = (ward: string) => {
      const normalized = ward.toLowerCase().trim();
      const cleanName = normalized
          .replace(/^(xã|phường|thị trấn|tt\.|p\.|x\.)\s+/g, '')
          .replace(/\s+(xã|phường|thị trấn)\s+/g, ' ');

      if (cleanName.includes('tân khai') || cleanName.includes('tankhai')) return 'TK';
      if (cleanName.includes('tân hưng') || cleanName.includes('tanhung')) return 'TH';
      if (cleanName.includes('minh đức') || cleanName.includes('minhduc')) return 'MĐ';
      if (cleanName.includes('tân quan') || cleanName.includes('tanquan')) return 'TQ';

      if (cleanName.includes('minh hưng') || cleanName.includes('minhhung')) return 'MH';
      if (cleanName.includes('chơn thành') || cleanName.includes('chonthanh') || cleanName.includes('hưng long')) return 'CT';
      if (cleanName.includes('nha bích') || cleanName.includes('nhabich')) return 'NB';
      if (cleanName.includes('minh lập') || cleanName.includes('minhlap')) return 'ML';
      if (cleanName.includes('minh thắng') || cleanName.includes('minhthang')) return 'MT';
      if (cleanName.includes('quang minh') || cleanName.includes('quangminh')) return 'QM';
      if (cleanName.includes('thành tâm') || cleanName.includes('thanhtam')) return 'TT';
      if (cleanName.includes('minh long') || cleanName.includes('minhlong')) return 'MLO';
      
      return 'CT';
  };

  const getRecordTabAbbreviation = (recordType: string | null | undefined): string => {
      if (!recordType) return 'ĐĐ';
      const t = recordType.trim().toLowerCase();
      
      if (recordType === 'Cung cấp tài liệu đất đai' || recordType === 'Sao lục') {
          return 'LT';
      }
      if (recordType === 'Công văn') {
          return 'CV';
      }
      if (['CMD', 'Tòa án', 'Thi hành án'].includes(recordType)) {
          return 'K';
      }
      
      const REG_PROCEDURES = [
          "đăng ký", "cấp giấy", "cấp đổi", "cấp lại", "giao đất", "thu hồi",
          "chuyển mục đích", "gia hạn", "thừa kế", "tặng cho", "chuyển nhượng", "thế chấp", "xóa thế chấp"
      ];
      const isReg = t.startsWith('3.') || t === 'đăng ký' || t === 'cấp giấy' || t === 'cấp đổi' || t === 'cấp lại' || REG_PROCEDURES.some(p => t.includes(p));
      if (isReg) {
          return 'ĐK';
      }
      
      return 'ĐĐ';
  };

  const getWardAbbreviationLocal = (ward: string): string => {
    if (!ward) return 'CT';
    const clean = ward.trim().toLowerCase();
    if (clean.includes('tân khai') || clean.includes('tankhai')) return 'TK';
    if (clean.includes('tân hưng') || clean.includes('tanhung')) return 'TH';
    if (clean.includes('minh đức') || clean.includes('minhduc')) return 'MĐ';
    if (clean.includes('tân quan') || clean.includes('tanquan')) return 'TQ';
    if (clean.includes('minh hưng') || clean.includes('minhhung')) return 'MH';
    if (clean.includes('chơn thành') || clean.includes('chonthanh') || clean.includes('hưng long')) return 'CT';
    if (clean.includes('nha bích') || clean.includes('nhabich')) return 'NB';
    if (clean.includes('minh lập') || clean.includes('minhlap')) return 'ML';
    if (clean.includes('minh thắng') || clean.includes('minhthang')) return 'MT';
    if (clean.includes('quang minh') || clean.includes('quangminh')) return 'QM';
    if (clean.includes('thành tâm') || clean.includes('thanhtam')) return 'TT';
    if (clean.includes('minh long') || clean.includes('minhlong')) return 'MLO';
    return 'CT';
  };

  const calculateNextCode = (wardName: string, dateStr: string, existingCodes: string[] = [], recordType?: string) => {
    if (!dateStr) return '';

    if (recordType === '1.2 Công văn') {
      const d = new Date(dateStr);
      const year = d.getFullYear().toString();
      const prefix = `CV-${year}-`;

      let maxSeq = 0;
      const checkSeq = (code: string | undefined | null) => {
        if (!code) return;
        if (code.startsWith(prefix)) {
          const parts = code.split('-');
          if (parts.length >= 3) {
            const seqVal = parseInt(parts[2], 10);
            if (!isNaN(seqVal) && seqVal > maxSeq) {
              maxSeq = seqVal;
            }
          }
        }
      };

      combinedRecords.forEach((r: RecordFile) => checkSeq(r.code));
      existingCodes.forEach(code => checkSeq(code));

      const nextSeq = (maxSeq + 1).toString().padStart(4, '0');
      return `${prefix}${nextSeq}`;
    }

    const d = new Date(dateStr);
    const yy = d.getFullYear().toString().slice(-2);
    const mm = ('0' + (d.getMonth() + 1)).slice(-2);
    const dd = ('0' + d.getDate()).slice(-2);
    const datePrefix = `${yy}${mm}${dd}`;
    const prefix = `${datePrefix}-`;

    let maxSeq = 0;
    const checkSeq = (code: string | undefined | null) => {
        if (!code) return;
        if (code.startsWith(prefix)) {
            const parts = code.split('-');
            if (parts.length >= 2) {
                const seqVal = parseInt(parts[parts.length - 1], 10);
                if (!isNaN(seqVal) && seqVal > maxSeq) {
                    maxSeq = seqVal;
                }
            }
        }
    };

    combinedRecords.forEach((r: RecordFile) => checkSeq(r.code));
    existingCodes.forEach(code => checkSeq(code));

    const nextSeq = (maxSeq + 1).toString().padStart(4, '0');
    return `${prefix}${nextSeq}`;
  };

  // --- LOGIC TÍNH HẠN TRẢ (CẬP NHẬT FIX LỖI TIMEZONE VÀ NGÀY NGHỈ) ---
  const calculateDeadline = (type: string, receivedDateStr: string, hasTax?: boolean) => {
      let daysToAdd = 30; 
      const lowerType = type.toLowerCase();

      if (lowerType.includes('cmđ') || lowerType.includes('cmd') || lowerType.includes('2.7 trích lục cmđ')) {
          daysToAdd = 2;
      } else if (lowerType.includes('cung cấp tài liệu đất đai') || 
          lowerType.includes('cung cấp dữ liệu đất đai') || 
          lowerType.includes('dữ liệu đất đai') || 
          lowerType.includes('trích lục quy hoạch') || 
          lowerType.includes('cung cấp số thửa đất') || 
          lowerType.includes('cung cấp số thửa') || 
          lowerType.includes('trích lục')) {
          daysToAdd = 10;
      } else if (lowerType.includes('trích đo') || lowerType.includes('cắm mốc') || lowerType.includes('tách thửa')) {
          daysToAdd = 30;
      }
      
      const t = (type || '').trim().toLowerCase();
      const isReg = t.startsWith('3.') || t === 'đăng ký' || t === 'cấp giấy' || t === 'cấp đổi' || t === 'cấp lại' || REGISTRATION_PROCEDURES.some(p => p.toLowerCase() === t);

      if (isReg) {
          if (t.includes('3.1') || t.includes('thừa kế') ||
              t.includes('3.2') || t.includes('tặng cho') ||
              t.includes('3.3') || t.includes('chuyển nhượng') ||
              t.includes('3.4') || t.includes('thỏa thuận') || t.includes('vbtt')) {
              // Thừa kế (3.1), Tặng cho (3.2), Chuyển nhượng (3.3), Thỏa thuận (3.4)
              // 8 ngày (không thuế) | 13 ngày (có thuế). Mặc định là có thuế (13 ngày)
              daysToAdd = 13;
          } else if (t.includes('3.6') || t.includes('cấp đổi')) {
              // Cấp đổi (3.6): 10 ngày (không thuế) | 15 ngày (có thuế)
              daysToAdd = hasTax ? 15 : 10;
          } else {
              if (hasTax) {
                  daysToAdd += 10;
              }
          }
      }
      
      const startDate = new Date(receivedDateStr);
      let count = 0;
      let currentDate = new Date(startDate);
      
      // Tạo Set chứa chuỗi ngày nghỉ (YYYY-MM-DD) để tra cứu nhanh và chính xác
      const holidaySet = new Set<string>();
      const currentYear = startDate.getFullYear();
      // Check cả năm hiện tại và năm sau (trường hợp cuối năm)
      const yearsToCheck = [currentYear, currentYear + 1];

      holidays.forEach(h => {
          yearsToCheck.forEach(year => {
              if (h.isLunar) {
                  const solarDate = getSolarDateFromLunar(h.day, h.month, year);
                  if (solarDate) holidaySet.add(formatDateKey(solarDate));
              } else {
                  // Lưu ý: Date constructor tháng bắt đầu từ 0
                  const solarDate = new Date(year, h.month - 1, h.day);
                  holidaySet.add(formatDateKey(solarDate));
              }
          });
      });

      while (count < daysToAdd) {
          // Tăng 1 ngày
          currentDate.setDate(currentDate.getDate() + 1);
          
          const dayOfWeek = currentDate.getDay(); // 0 là Chủ Nhật, 6 là Thứ 7
          const dateString = formatDateKey(currentDate);
          
          // Trừ Thứ 7 và Chủ Nhật
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const isHoliday = holidaySet.has(dateString);

          // Nếu không phải cuối tuần VÀ không phải ngày lễ thì mới tính là 1 ngày làm việc
          if (!isWeekend && !isHoliday) {
              count++;
          }
      }
      
      return formatDateKey(currentDate);
  };

  // ... (Phần logic in ấn và render giữ nguyên)
  const handlePreviewDocx = async (dataToUse: Partial<RecordFile>) => {
    if (!dataToUse.code || !dataToUse.customerName) { 
        alert("Vui lòng nhập ít nhất Mã hồ sơ và Tên khách hàng để in."); 
        return; 
    }
    
    if (!hasTemplate(STORAGE_KEYS.RECEIPT_TEMPLATE)) {
        setSystemReceiptData(dataToUse);
        return;
    }

    const rDate = dataToUse.receivedDate ? new Date(dataToUse.receivedDate) : new Date();
    const dDate = dataToUse.deadline ? new Date(dataToUse.deadline) : new Date();
    
    let standardDays = "30"; 
    const rType = (dataToUse.recordType || '').toLowerCase();
    if (rType.includes('trích lục')) standardDays = "10";
    else if (rType.includes('trích đo chỉnh lý')) standardDays = "15";
    else if (rType.includes('trích đo') || rType.includes('đo đạc') || rType.includes('cắm mốc')) standardDays = "30";

    let tp1Value = 'Phiếu yêu cầu';
    if (rType.includes('chỉnh lý') || rType.includes('trích đo') || rType.includes('trích lục')) {
        tp1Value = 'Phiếu yêu cầu trích lục, trích đo';
    } else if (rType.includes('đo đạc') || rType.includes('cắm mốc')) {
        tp1Value = 'Phiếu yêu cầu Đo đạc, cắm mốc';
    }
    if (dataToUse.ward) {
        tp1Value += ` tại ${getNormalizedWard(dataToUse.ward || '')}`;
    }

    let sdtLienHe = "";
    const wRaw = (dataToUse.ward || "").toLowerCase();
    if (wRaw.includes("minh hưng") || wRaw.includes("minh hung")) {
        sdtLienHe = "Nhân viên phụ trách Nguyễn Thìn Trung: 0886 385 757";
    } else if (wRaw.includes("nha bích") || wRaw.includes("nha bich")) {
        sdtLienHe = "Nhân viên phụ trách Lê Văn Hạnh: 0919 334 344";
    } else if (wRaw.includes("chơn thành") || wRaw.includes("chon thanh")) {
        sdtLienHe = "Nhân viên phụ trách Phạm Hoài Sơn: 0972 219 691";
    }

    const dayRec = rDate.getDate().toString().padStart(2, '0');
    const monthRec = (rDate.getMonth() + 1).toString().padStart(2, '0');
    const yearRec = rDate.getFullYear();
    const dateFullString = `ngày ${dayRec} tháng ${monthRec} năm ${yearRec}`;
    const dateShortString = `${dayRec}/${monthRec}/${yearRec}`;
    
    const dayDead = dDate.getDate().toString().padStart(2, '0');
    const monthDead = (dDate.getMonth() + 1).toString().padStart(2, '0');
    const yearDead = dDate.getFullYear();
    const deadlineFullString = `ngày ${dayDead} tháng ${monthDead} năm ${yearDead}`;
    const deadlineShortString = `${dayDead}/${monthDead}/${yearDead}`;

    const val = (v: any) => (v === undefined || v === null) ? "" : String(v);

    const printData = {
        code: val(dataToUse.code),
        customerName: val(dataToUse.customerName),
        landPlot: val(dataToUse.landPlot),
        mapSheet: val(dataToUse.mapSheet),
        
        XAPHUONG: val(getNormalizedWard(dataToUse.ward)),
        NGAYNHAN: dateFullString,
        NGAY_NHAN: dateShortString, 
        LOAI_GIAY_TO_UY_QUYEN: val(dataToUse.authDocType),
        DIA_CHI_CHI_TIET: val(dataToUse.address),

        MA: val(dataToUse.code), 
        SO_HS: val(dataToUse.code), 
        MA_HO_SO: val(dataToUse.code),
        CODE: val(dataToUse.code),

        TEN: val(dataToUse.customerName).toUpperCase(), 
        HO_TEN: val(dataToUse.customerName).toUpperCase(),
        CHU_SU_DUNG: val(dataToUse.customerName).toUpperCase(),
        KHACH_HANG: val(dataToUse.customerName).toUpperCase(),
        ONG_BA: val(dataToUse.customerName).toUpperCase(), 

        SDT: val(dataToUse.phoneNumber), 
        DIEN_THOAI: val(dataToUse.phoneNumber),
        PHONE: val(dataToUse.phoneNumber),
        CCCD: val(dataToUse.cccd), 
        CMND: val(dataToUse.cccd),
        DIA_CHI_CHU_SU_DUNG: val(dataToUse.customerAddress),

        DIA_CHI: val(dataToUse.address || getNormalizedWard(dataToUse.ward)),
        DC: val(dataToUse.address || getNormalizedWard(dataToUse.ward)),
        ADDRESS: val(dataToUse.address || getNormalizedWard(dataToUse.ward)),
        XA: val(getNormalizedWard(dataToUse.ward)), 
        PHUONG: val(getNormalizedWard(dataToUse.ward)),
        WARD: val(getNormalizedWard(dataToUse.ward)),
        
        TO: val(dataToUse.mapSheet), 
        SO_TO: val(dataToUse.mapSheet),
        THUA: val(dataToUse.landPlot), 
        SO_THUA: val(dataToUse.landPlot),
        DT: val(dataToUse.area), 
        DIEN_TICH: val(dataToUse.area),
        
        NGAY_NHAN_FULL: dateFullString,
        NGAY: dayRec, 
        THANG: monthRec, 
        NAM: yearRec,
        RECEIVED_DATE: dateShortString,
        
        HEN_TRA: deadlineShortString, 
        NGAY_HEN: deadlineShortString,
        DEADLINE: deadlineShortString,
        HEN_TRA_FULL: deadlineFullString,
        NGAY_HEN_FULL: deadlineFullString,
        
        NGUOI_NHAN: val(currentUser.name), 
        CAN_BO: val(currentUser.name),
        USER: val(currentUser.name),
        
        NOI_DUNG: val(dataToUse.content),
        CONTENT: val(dataToUse.content),
        LOAI_HS: val(dataToUse.recordType), 
        RECORD_TYPE: val(dataToUse.recordType),
        GIAY_TO_KHAC: val(dataToUse.otherDocs),
        GIA: dataToUse.price ? dataToUse.price.toLocaleString('vi-VN') + ' đ' : '',
        PRICE: dataToUse.price ? dataToUse.price.toLocaleString('vi-VN') + ' đ' : '',
        
        NGUOI_UY_QUYEN: val(dataToUse.authorizedBy).toUpperCase(),
        UY_QUYEN: val(dataToUse.authorizedBy).toUpperCase(),
        LOAI_UY_QUYEN: val(dataToUse.authDocType),
        
        TGTRA: standardDays, 
        SO_NGAY: standardDays,
        TP1: tp1Value, 
        TIEU_DE: tp1Value,
        SDTLH: sdtLienHe, 
        TINH: "Bình Phước", 
        HUYEN: "huyện Hớn Quản"
    };
    
    const blob = await generateDocxBlobAsync(STORAGE_KEYS.RECEIPT_TEMPLATE, printData);
    if (blob) { 
        setPreviewBlob(blob); 
        setPreviewFileName(`BienNhan_${dataToUse.code}`); 
        setIsPreviewOpen(true); 
    }
  };

  const handlePreviewExcel = (wb: XLSX.WorkBook, name: string) => {
      setPreviewWorkbook(wb);
      setPreviewExcelName(name);
      setIsExcelPreviewOpen(true);
  };

  const handleEditFromList = (record: RecordFile) => {
      setEditingRecord(record);
      setViewMode('create');
  };

  const handleDeleteFromList = async (record: RecordFile) => {
      if (await confirmAction(`Bạn có chắc muốn xóa hồ sơ ${record.code}?`)) {
          await onDelete(record.id);
      }
  };

  const handleSaveRecordWithForce = async (record: RecordFile): Promise<RecordFile | null> => {
      return await onSave(record, true);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-full animate-fade-in-up overflow-hidden relative">
      {/* Toast Notification Container */}
      {notification && (
          <div className={`absolute top-4 right-4 z-[100] max-w-sm w-full p-4 rounded-xl shadow-2xl border flex items-start gap-3 animate-fade-in-up transition-all ${
              notification.type === 'success' ? 'bg-white border-green-200 text-green-800' : 
              notification.type === 'error' ? 'bg-white border-red-200 text-red-800' : 
              'bg-white border-blue-200 text-blue-800'
          }`}>
              {notification.type === 'success' ? <CheckCircle className="text-green-600 shrink-0" size={20} /> : 
               notification.type === 'error' ? <AlertCircle className="text-red-600 shrink-0" size={20} /> :
               <Loader2 className="text-blue-600 shrink-0 animate-spin" size={20} />}
              
              <div className="flex-1 text-sm font-medium pt-0.5">{notification.message}</div>
              <button onClick={() => setNotification(null)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
          </div>
      )}

      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-blue-50/50 shrink-0 z-10">
        <div className="flex bg-white p-1 rounded-lg border border-gray-200">
            <button 
                onClick={() => { setViewMode('create'); setEditingRecord(null); }} 
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'create' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
            >
                <PlusCircle size={16} /> Nhập mới
            </button>
            <button onClick={() => setViewMode('bulk')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'bulk' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
                <FileSpreadsheet size={16} /> Tiếp nhận hàng loạt
            </button>
            <button 
                onClick={() => setViewMode('vphc')} 
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'vphc' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
            >
                <Gavel size={16} /> Biên bản VPHC
            </button>
            <button onClick={() => setViewMode('list')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
                <LayoutList size={16} /> Danh sách hôm nay
            </button>
        </div>
        
        {viewMode === 'create' && (
            <div className="flex gap-2">
                <button onClick={() => { setTemplateType('receipt'); setIsTemplateModalOpen(true); }} className="text-sm text-gray-600 bg-white px-3 py-1.5 rounded-lg border border-gray-300 shadow-sm hover:bg-gray-50 flex items-center gap-1">
                    <Settings size={14} /> Mẫu In
                </button>
            </div>
        )}
      </div>

      <div className={viewMode === 'vphc' ? 'flex-1 overflow-hidden relative h-full' : 'flex-1 overflow-y-auto p-6 min-h-0'}>
        {viewMode === 'create' && (
            <RecordForm 
                initialData={editingRecord}
                onSave={handleSaveRecordWithForce}
                wards={wards}
                records={combinedRecords}
                holidays={holidays}
                calculateDeadline={calculateDeadline}
                generateCode={(w, d, rType) => calculateNextCode(w, d, [], rType)} 
                onPrint={handlePreviewDocx}
                onCancelEdit={() => {
                    setEditingRecord(null);
                    setViewMode('list');
                }}
                currentUser={currentUser}
                employees={employees}
                currentView="receive_record"
            />
        )}

        {viewMode === 'bulk' && (
            <BulkImport 
                onSave={handleSaveRecordWithForce}
                calculateDeadline={calculateDeadline}
                calculateNextCode={(w, d, exist, rType) => calculateNextCode(w, d, exist, rType)}
                onPreview={handlePreviewDocx}
                currentUser={currentUser}
                employees={employees}
            />
        )}

        {viewMode === 'list' && (
            <DailyList 
                records={combinedRecords}
                wards={wards}
                currentUser={currentUser}
                employees={employees}
                onPreviewExcel={handlePreviewExcel}
                onEdit={handleEditFromList}
                onDelete={handleDeleteFromList}
                onDeleteRaw={onDelete}
                onSave={handleSaveRecordWithForce}
                onPrint={handlePreviewDocx}
                onCreateContract={(rec) => {
                    if (setRecordToContract && setCurrentView) {
                        setRecordToContract(rec);
                        setCurrentView('receive_contract');
                    }
                }}
            />
        )}

        {viewMode === 'vphc' && (
            <VPHCTab 
                currentUser={currentUser}
                notify={notify}
            />
        )}
      </div>

      <TemplateConfigModal isOpen={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)} type={templateType as any} />
      <DocxPreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} docxBlob={previewBlob} fileName={previewFileName} />
      <ExcelPreviewModal isOpen={isExcelPreviewOpen} onClose={() => setIsExcelPreviewOpen(false)} workbook={previewWorkbook} fileName={previewExcelName} />
      
      {systemReceiptData && (
          <SystemReceiptTemplate 
              data={systemReceiptData} 
              receivingWard={systemReceiptData.ward || employees.find(e => e.id === currentUser.employeeId)?.managedWards?.[0] || 'Tân Khai'}
              onClose={() => setSystemReceiptData(null)} 
              currentUser={currentUser}
              employees={employees}
              onCreateContract={(rec) => {
                  if (setRecordToContract && setCurrentView) {
                      setRecordToContract(rec);
                      setCurrentView('receive_contract');
                  }
              }}
          />
      )}
    </div>
  );
};

export default ReceiveRecord;

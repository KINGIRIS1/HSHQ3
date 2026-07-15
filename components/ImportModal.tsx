
import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx-js-style';
import { RecordFile, RecordStatus, Employee, Holiday } from '../types';
import { RECORD_TYPES, REGISTRATION_PROCEDURES } from '../constants';
import { fetchHolidays } from '../services/api';
import { removeVietnameseTones } from '../utils/appHelpers';
import { X, Upload, FileSpreadsheet, Save, Loader2, AlertCircle, Check, RefreshCw, PlusCircle, AlertTriangle } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (records: RecordFile[], mode: 'create' | 'update', onProgress?: (processed: number, total: number) => void) => Promise<boolean>;
  employees: Employee[];
  currentView?: string;
  records?: RecordFile[];
}

// Helper: Solar date from Lunar (Giống ReceiveRecord)
const getSolarDateFromLunar = (lunarDay: number, lunarMonth: number, year: number): Date | null => {
    const lunarMapping: Record<number, Record<string, string>> = {
        2024: { "1/1": "2024-02-10", "2/1": "2024-02-11", "3/1": "2024-02-12", "10/3": "2024-04-18" },
        2025: { "1/1": "2025-01-29", "2/1": "2025-01-30", "3/1": "2025-01-31", "10/3": "2025-04-07" },
        2026: { "1/1": "2026-02-17", "2/1": "2026-02-18", "3/1": "2026-02-19", "10/3": "2026-04-26" }
    };
    const key = `${lunarDay}/${lunarMonth}`;
    return lunarMapping[year] && lunarMapping[year][key] ? new Date(lunarMapping[year][key]) : null;
};

// Helper: Format YYYY-MM-DD
const formatDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Helper to categorize views into main tabs: cap_giay, do_dac, luu_tru, receive (1 cửa)
const getTabCategory = (view: string): 'cap_giay' | 'do_dac' | 'luu_tru' | 'receive' => {
    if (!view) return 'do_dac';
    const v = view.toLowerCase();
    if (v === 'receive_record') return 'receive';
    if (v.includes('registration_') || v.includes('reg_')) return 'cap_giay';
    if (v.includes('archive_') || v.includes('congvan_')) return 'luu_tru';
    return 'do_dac';
};

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport, employees, currentView, records }) => {
  type PreviewRecord = RecordFile & { _errors?: string[] };
  const [previewData, setPreviewData] = useState<PreviewRecord[]>([]);
  const [fileName, setFileName] = useState('');
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'create' | 'update'>('create');
  const [viewFilter, setViewFilter] = useState<'all' | 'valid' | 'errors'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');

  const [progress, setProgress] = useState<{ processed: number, total: number } | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('dat_dai');

  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'update') {
      setSelectedTemplate('cap_nhat');
    } else {
      const cat = getTabCategory(currentView || '');
      if (cat === 'cap_giay') {
        setSelectedTemplate('dang_ky_bien_dong');
      } else if (cat === 'luu_tru') {
        setSelectedTemplate('sao_luc');
      } else if (cat === 'do_dac') {
        setSelectedTemplate('dat_dai');
      } else {
        // 'receive' (1 cửa) or other: default to 'dat_dai' or keep if valid for 1 door
        if (!['dang_ky_bien_dong', 'dat_dai', 'sao_luc'].includes(selectedTemplate)) {
          setSelectedTemplate('dat_dai');
        }
      }
    }
  }, [currentView, mode, isOpen]);

  useEffect(() => {
    if (isOpen) {
        fetchHolidays().then(setHolidays);
        setPreviewData([]);
        setFileName('');
        setViewFilter('all');
        setProgress(null);
        setWorkbook(null);
        setSheetNames([]);
        setSelectedSheet('');
        if(fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [isOpen]);

  const parseExcelDate = (input: any): string | undefined => {
      if (input === undefined || input === null || input === '') return undefined;
      
      const num = parseFloat(input);
      if (!isNaN(num) && num > 20000) {
          const excelEpoch = new Date(1899, 11, 30);
          const totalMilliseconds = Math.round(num * 86400 * 1000); 
          const date = new Date(excelEpoch.getTime() + totalMilliseconds);
          return formatDateKey(date);
      }

      if (typeof input === 'string') {
          const cleanStr = input.trim();
          if (cleanStr.match(/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}$/)) {
              const parts = cleanStr.split(/[\/-]/);
              return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
          if (cleanStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
              return cleanStr;
          }
      }
      return '';
  };

  const calculateDeadline = (type: string, receivedDateStr: string, hasTax?: boolean) => {
      if(!receivedDateStr) return '';
      let daysToAdd = 30; 
      const lowerType = (type || '').toLowerCase();
      if (lowerType.includes('cmđ') || lowerType.includes('cmd') || lowerType.includes('2.7 trích lục cmđ')) daysToAdd = 2;
      else if (lowerType.includes('trích lục')) daysToAdd = 10; 
      else if (lowerType.includes('trích đo chỉnh lý')) daysToAdd = 15; 
      else if (lowerType.includes('trích đo') || lowerType.includes('đo đạc') || lowerType.includes('cắm mốc') || lowerType.includes('tách thửa')) daysToAdd = 30; 
      
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
      
      // Build Holiday Set
      const holidaySet = new Set<string>();
      const currentYear = startDate.getFullYear();
      [currentYear, currentYear + 1].forEach(year => {
          holidays.forEach(h => {
              if (h.isLunar) {
                  const solar = getSolarDateFromLunar(h.day, h.month, year);
                  if (solar) holidaySet.add(formatDateKey(solar));
              } else {
                  const solar = new Date(year, h.month - 1, h.day);
                  holidaySet.add(formatDateKey(solar));
              }
          });
      });

      while (count < daysToAdd) {
          currentDate.setDate(currentDate.getDate() + 1);
          const dateStr = formatDateKey(currentDate);
          const day = currentDate.getDay();
          
          const isWeekend = day === 0 || day === 6; // Sat + Sun
          const isHoliday = holidaySet.has(dateStr);

          if (!isWeekend && !isHoliday) {
              count++;
          }
      }
      return formatDateKey(currentDate);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const ab = evt.target?.result;
        const wb = XLSX.read(ab, { type: 'array' });
        setWorkbook(wb);
        
        const allSheets = wb.SheetNames;
        setSheetNames(allSheets);
        
        // Auto-select the first sheet that is NOT an instruction sheet
        let defaultSheet = allSheets[0];
        const importableSheets = allSheets.filter(name => {
            const upper = name.toUpperCase();
            return !upper.includes('HUONG DAN') && !upper.includes('GUIDE') && !upper.includes('HƯỚNG DẪN');
        });
        
        if (importableSheets.length > 0) {
            defaultSheet = importableSheets[0];
        }
        
        setSelectedSheet(defaultSheet);
        loadSheetData(defaultSheet, wb);
      } catch (error) {
        console.error("Lỗi đọc Excel:", error);
        alert("Có lỗi khi đọc file Excel.");
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const loadSheetData = (sheetName: string, activeWb?: XLSX.WorkBook) => {
      const currentWb = activeWb || workbook;
      if (!currentWb) return;
      
      setLoading(true);
      try {
          const ws = currentWb.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
          
          let headerRowIndex = -1;
          for (let i = 0; i < Math.min(data.length, 20); i++) {
              const row = data[i] as any[];
              if (row && row.some(cell => {
                  const s = String(cell || '').toLowerCase();
                  return s.includes('mã') || s.includes('chủ sử dụng') || s.includes('chủ sử') || s.includes('customer') || s.includes('tên') || s.includes('họ tên');
              })) {
                  headerRowIndex = i;
                  break;
              }
          }
          
          if (headerRowIndex === -1) {
              headerRowIndex = 0;
          }

          const headers = (data[headerRowIndex] as string[] || []).map(h => String(h || '').toUpperCase().trim());
          const mappedRecords: any[] = [];

          const typeMapping: Record<string, string> = {
              'TL': 'Trích lục bản đồ địa chính', 'TRÍCH LỤC': 'Trích lục bản đồ địa chính',
              'TĐ': 'Trích đo bản đồ địa chính', 'TRÍCH ĐO': 'Trích đo bản đồ địa chính',
              'ĐĐ': 'Đo đạc', 'ĐO ĐẠC': 'Đo đạc', 'CM': 'Cắm mốc', 'CẮM MỐC': 'Cắm mốc',
              'CL': 'Trích đo chỉnh lý bản đồ địa chính', 'CHỈNH LÝ': 'Trích đo chỉnh lý bản đồ địa chính'
          };

          for (let i = headerRowIndex + 1; i < data.length; i++) {
              const row = data[i] as any[];
              if (!row || row.length === 0 || row.every(cell => cell === null || cell === undefined || cell === '')) continue;

              const getVal = (possibleHeaders: string[]) => {
                  let idx = headers.findIndex(h => {
                      const hUpper = h.trim().toUpperCase();
                      return possibleHeaders.some(ph => hUpper === ph.toUpperCase());
                  });
                  if (idx === -1) {
                      idx = headers.findIndex(h => {
                          const hUpper = h.trim().toUpperCase();
                          return possibleHeaders.some(ph => hUpper.includes(ph.toUpperCase()));
                      });
                  }
                  return idx !== -1 ? row[idx] : undefined;
              };

              const codeRaw = getVal(['MÃ HỒ SƠ', 'MÃ HS', 'CODE', 'code']);
              const code = codeRaw ? String(codeRaw).trim() : undefined;
              
              if (mode === 'update' && !code) continue;

              const record: any = {};
              
              if (code) record.code = code;
              else if (mode === 'create') record.code = `AUTO-${Math.floor(Math.random()*100000)}`;

              const nameRaw = getVal(['CHỦ SỬ DỤNG', 'TÊN', 'HỌ TÊN', 'CUSTOMER', 'customername', 'customer_name', 'customerName']);
              if (nameRaw !== undefined) record.customerName = String(nameRaw).trim();
              else if (mode === 'create') record.customerName = 'Chưa cập nhật';

              const phoneRaw = getVal(['SĐT', 'ĐIỆN THOẠI', 'phonenumber', 'phone_number', 'phoneNumber']);
              if (phoneRaw !== undefined) record.phoneNumber = String(phoneRaw).trim();

              const addressRaw = getVal(['ĐỊA CHỈ', 'ADDRESS', 'customeraddress', 'customer_address', 'customerAddress', 'address']);
              if (addressRaw !== undefined) record.customerAddress = String(addressRaw).trim();

              const cccdRaw = getVal(['CCCD', 'CMND', 'cccd']);
              if (cccdRaw !== undefined) record.cccd = String(cccdRaw).trim();

              const authByRaw = getVal(['NGƯỜI ỦY QUYỀN', 'ỦY QUYỀN', 'authorizedby', 'authorized_by', 'authorizedBy']);
              const authTypeRaw = getVal(['LOẠI ỦY QUYỀN', 'GIẤY ỦY QUYỀN', 'authdoctype', 'auth_doc_type', 'authDocType']);
              if (authByRaw !== undefined || authTypeRaw !== undefined) {
                  record.authDocType = `${authByRaw ? String(authByRaw).trim() : ''}|${authTypeRaw ? String(authTypeRaw).trim() : 'Bản chính'}`;
              }

              const wardRaw = getVal(['XÃ', 'PHƯỜNG', 'WARD', 'ward']);
              if (wardRaw !== undefined) record.ward = String(wardRaw).trim();

              const mapSheetRaw = getVal(['TỜ', 'BẢN ĐỒ SỐ', 'mapsheet', 'map_sheet', 'mapSheet']);
              if (mapSheetRaw !== undefined) record.mapSheet = String(mapSheetRaw).trim();

              const landPlotRaw = getVal(['THỬA', 'THỬA ĐẤT SỐ', 'landplot', 'land_plot', 'landPlot']);
              if (landPlotRaw !== undefined) record.landPlot = String(landPlotRaw).trim();

              const errors: string[] = [];

              const rawArea = getVal(['DIỆN TÍCH', 'AREA', 'area']);
              if (rawArea !== undefined && rawArea !== null && rawArea !== '') {
                  const parsedArea = parseFloat(String(rawArea));
                  record.area = isNaN(parsedArea) ? 0 : parsedArea;
                  if (isNaN(parsedArea)) {
                      errors.push(`Diện tích "${rawArea}" không hợp lệ.`);
                  }
              } else if (rawArea !== undefined) {
                  record.area = null;
              }

              const rawResArea = getVal(['ĐẤT Ở', 'THỔ CƯ', 'residentialarea', 'residential_area', 'residentialArea']);
              if (rawResArea !== undefined && rawResArea !== null && rawResArea !== '') {
                   const parsedResArea = parseFloat(String(rawResArea));
                   record.residentialArea = isNaN(parsedResArea) ? 0 : parsedResArea;
                   if (isNaN(parsedResArea)) {
                       errors.push(`Đất ở "${rawResArea}" không hợp lệ.`);
                   }
              } else if (rawResArea !== undefined) {
                   record.residentialArea = null;
              }

              const issueNumRaw = getVal(['SỐ PHÁT HÀNH', 'issuenumber', 'issue_number', 'issueNumber']);
              if (issueNumRaw !== undefined) record.issueNumber = String(issueNumRaw).trim();

              const entryNumRaw = getVal(['SỐ VÀO SỔ', 'entrynumber', 'entry_number', 'entryNumber']);
              if (entryNumRaw !== undefined) record.entryNumber = String(entryNumRaw).trim();

              const processDateCell = (rawVal: any, label: string) => {
                  if (rawVal === undefined || rawVal === null || rawVal === '') return undefined;
                  const parsed = parseExcelDate(rawVal);
                  if (parsed === '') {
                      if (String(rawVal).length <= 4) {
                          return undefined;
                      }
                      errors.push(`Trường "${label}" (${rawVal}) không đúng định dạng DD/MM/YYYY.`);
                      return undefined;
                  }
                  return parsed;
              };

              const issueDateRaw = getVal(['NGÀY CẤP', 'issuedate', 'issue_date', 'issueDate']);
              if (issueDateRaw !== undefined) record.issueDate = processDateCell(issueDateRaw, "Ngày cấp");

              const contentRaw = getVal(['NỘI DUNG', 'GHI CHÚ', 'content', 'notes']);
              if (contentRaw !== undefined) record.content = String(contentRaw).trim();

              const otherDocsRaw = getVal(['GIẤY TỜ KÈM THEO', 'GIẤY TỜ', 'otherdocs', 'other_docs', 'otherDocs']);
              if (otherDocsRaw !== undefined) record.otherDocs = String(otherDocsRaw).trim();

              const receivedRaw = getVal(['NGÀY NHẬN', 'NGÀY NỘP', 'receiveddate', 'received_date', 'receivedDate']);
              if (receivedRaw !== undefined) {
                  record.receivedDate = processDateCell(receivedRaw, "Ngày nhận/nộp");
              } else if (mode === 'create') {
                  record.receivedDate = new Date().toISOString();
              }

              const deadlineRaw = getVal(['HẸN TRẢ', 'DEADLINE', 'deadline', 'THỜI HẠN XỬ LÝ', 'THỜI HẠN GIẢI QUYẾT', 'HẠN XỬ LÝ', 'HẠN GIẢI QUYẾT', 'HẠN TRẢ']);
              if (deadlineRaw !== undefined) record.deadline = processDateCell(deadlineRaw, "Hạn trả");

              const completedWorkDateRaw = getVal(['NGÀY THỰC HIỆN', 'NGÀY ĐÃ THỰC HIỆN', 'completedworkdate', 'completed_work_date', 'completedWorkDate']);
              if (completedWorkDateRaw !== undefined) record.completedWorkDate = processDateCell(completedWorkDateRaw, "Ngày thực hiện");

              const pendingCheckDateRaw = getVal(['NGÀY TRÌNH KIỂM TRA', 'NGÀY CHỜ KIỂM TRA', 'pendingcheckdate', 'pending_check_date', 'pendingCheckDate']);
              if (pendingCheckDateRaw !== undefined) record.pendingCheckDate = processDateCell(pendingCheckDateRaw, "Ngày trình kiểm tra");

              const checkedDateRaw = getVal(['NGÀY ĐÃ KIỂM TRA', 'checkeddate', 'checked_date', 'checkedDate']);
              if (checkedDateRaw !== undefined) record.checkedDate = processDateCell(checkedDateRaw, "Ngày đã kiểm tra");

              const submissionDateRaw = getVal(['NGÀY TRÌNH KÝ', 'submissiondate', 'submission_date', 'submissionDate']);
              if (submissionDateRaw !== undefined) record.submissionDate = processDateCell(submissionDateRaw, "Ngày trình ký");

              const approvalDateRaw = getVal(['NGÀY KÝ DUYỆT', 'NGÀY KÝ', 'approvaldate', 'approval_date', 'approvalDate']);
              if (approvalDateRaw !== undefined) record.approvalDate = processDateCell(approvalDateRaw, "Ngày ký duyệt");

              const completedDateRaw = getVal(['NGÀY HOÀN THÀNH', 'completeddate', 'completed_date', 'completedDate', 'NGÀY GIAO 1 CỬA', 'HOÀN THÀNH', 'HOÀN THÀNH/ ĐỢT', 'HOÀN THÀNH/ĐỢT']);
              if (completedDateRaw !== undefined) {
                  const parsedCompletedDate = processDateCell(completedDateRaw, "Ngày bàn giao một cửa");
                  if (parsedCompletedDate) record.completedDate = parsedCompletedDate;
              }

              const resultReturnedDateRaw = getVal(['NGÀY TRẢ DÂN', 'resultreturneddate', 'result_returned_date', 'resultReturnedDate']);
              if (resultReturnedDateRaw !== undefined) record.resultReturnedDate = processDateCell(resultReturnedDateRaw, "Ngày trả dân");

              const typeRaw = getVal(['LOẠI HỒ SƠ', 'LOAI HO SO', 'recordtype', 'record_type']);
              if (typeRaw !== undefined) {
                  record.recordType = String(typeRaw).trim();
              } else if (mode === 'create') {
                  record.recordType = RECORD_TYPES[0];
              }

              // Deadline will be calculated at the end of the loop after all fields (like hasTax) are parsed

              if (record.recordType === 'Cung cấp tài liệu đất đai' || record.recordType === '1. Cung cấp dữ liệu đất đai' || record.recordType === '1.1 Cung cấp dữ liệu đất đai') {
                  record.price = 310000;
              }

              const exportBatchRaw = getVal(['ĐỢT', 'BATCH', 'exportbatch', 'export_batch', 'exportBatch', 'HOÀN THÀNH/ ĐỢT', 'HOÀN THÀNH/ĐỢT']);
              if (exportBatchRaw !== undefined) {
                  const numStr = String(exportBatchRaw).replace(/[^0-9]/g, '');
                  if (numStr) record.exportBatch = parseInt(numStr, 10);
              }

              const exportDateRaw = getVal(['NGÀY XUẤT', 'EXPORT DATE', 'NGÀY TRẢ', 'exportdate', 'export_date', 'exportDate']);
              if (exportDateRaw !== undefined) {
                  record.exportDate = processDateCell(exportDateRaw, "Ngày xuất/trả");
              }

              let explicitStatus: RecordStatus | undefined = undefined;
              const statusRaw = getVal(['TRẠNG THÁI', 'STATUS', 'status']);
              if (statusRaw !== undefined && String(statusRaw).trim() !== '') {
                  let sStr = String(statusRaw).toUpperCase();
                  if (sStr.includes('GIAO NHÂN VIÊN') || sStr.includes('PASSED_TO') || sStr.includes('ASSIGNED')) explicitStatus = RecordStatus.ASSIGNED;
                  else if (sStr.includes('ĐANG') || sStr.includes('PROGRESS')) explicitStatus = RecordStatus.IN_PROGRESS;
                  else if (sStr.includes('ĐÃ THỰC HIỆN') || sStr.includes('THỰC HIỆN XONG') || sStr.includes('COMPLETED_WORK')) explicitStatus = RecordStatus.COMPLETED_WORK;
                  else if (sStr.includes('CHỜ KIỂM TRA') || sStr.includes('PENDING_CHECK')) explicitStatus = RecordStatus.PENDING_CHECK;
                  else if (sStr.includes('ĐÃ KIỂM TRA') || sStr.includes('CHECKED')) explicitStatus = RecordStatus.CHECKED;
                  else if (sStr.includes('CHỜ KÝ') || sStr.includes('PENDING_SIGN') || sStr.includes('TRÌNH KÝ')) explicitStatus = RecordStatus.PENDING_SIGN;
                  else if (sStr.includes('ĐÃ KÝ') || sStr.includes('SIGNED') || sStr.includes('KÝ DUYỆT')) explicitStatus = RecordStatus.SIGNED;
                  else if (sStr.includes('XONG') || sStr.includes('HOÀN THÀNH') || sStr.includes('HANDOVER') || sStr.includes('GIAO 1 CỬA')) explicitStatus = RecordStatus.HANDOVER;
                  else if (sStr.includes('TRẢ DÂN') || sStr.includes('RETURNED') || sStr.includes('ĐÃ TRẢ')) explicitStatus = RecordStatus.RETURNED;
                  else if (sStr.includes('TIẾP NHẬN') || sStr.includes('RECEIVED') || sStr.includes('MỚI NHẬN')) explicitStatus = RecordStatus.RECEIVED;
              }

              if (explicitStatus !== undefined) {
                  record.status = explicitStatus;
                  const nowStr = new Date().toISOString();
                  if (explicitStatus === RecordStatus.HANDOVER) {
                      if (!record.completedDate) record.completedDate = nowStr;
                  } else if (explicitStatus === RecordStatus.RETURNED) {
                      if (!record.resultReturnedDate) record.resultReturnedDate = nowStr;
                  } else if (explicitStatus === RecordStatus.SIGNED) {
                      if (!record.approvalDate) record.approvalDate = nowStr;
                  } else if (explicitStatus === RecordStatus.PENDING_SIGN) {
                      if (!record.submissionDate) record.submissionDate = nowStr;
                  } else if (explicitStatus === RecordStatus.CHECKED) {
                      if (!record.checkedDate) record.checkedDate = nowStr;
                  } else if (explicitStatus === RecordStatus.PENDING_CHECK) {
                      if (!record.pendingCheckDate) record.pendingCheckDate = nowStr;
                  } else if (explicitStatus === RecordStatus.COMPLETED_WORK) {
                      if (!record.completedWorkDate) record.completedWorkDate = nowStr;
                  } else if (explicitStatus === RecordStatus.ASSIGNED || explicitStatus === RecordStatus.IN_PROGRESS) {
                      if (!record.assignedDate) record.assignedDate = nowStr;
                  }
              } else {
                  if (record.exportBatch || record.exportDate || record.completedDate) {
                      record.status = RecordStatus.HANDOVER;
                      if (!record.completedDate && record.exportDate) {
                          record.completedDate = record.exportDate;
                      }
                  } else if (record.resultReturnedDate) {
                      record.status = RecordStatus.RETURNED;
                  } else if (record.approvalDate) {
                      record.status = RecordStatus.SIGNED;
                  } else if (record.submissionDate) {
                      record.status = RecordStatus.PENDING_SIGN;
                  } else if (record.checkedDate) {
                      record.status = RecordStatus.CHECKED;
                  } else if (record.pendingCheckDate) {
                      record.status = RecordStatus.PENDING_CHECK;
                  } else if (record.completedWorkDate) {
                      record.status = RecordStatus.COMPLETED_WORK;
                  } else if (mode === 'create') {
                      record.status = RecordStatus.RECEIVED;
                  }
              }

              const assigneeRaw = getVal(['NGƯỜI XỬ LÝ', 'NHÂN VIÊN', 'assignedto', 'assigned_to', 'assignedTo', 'GIAO NHÂN VIÊN', 'NHÂN VIÊN THỤ LÝ', 'CÁN BỘ THỤ LÝ', 'GIAO CHO']);
              if (assigneeRaw !== undefined && String(assigneeRaw).trim() !== '') {
                  const emp = employees.find(e => e.name.toLowerCase().includes(String(assigneeRaw).toLowerCase()));
                  if (emp) {
                      record.assignedTo = emp.id;
                      if (!record.assignedDate) {
                          record.assignedDate = record.receivedDate || new Date().toISOString();
                      }
                  }
              }

              const assignedDateRaw = getVal(['NGÀY GIAO', 'NGÀY GIAO VIỆC', 'assigneddate', 'assigned_date', 'assignedDate', 'NGÀY GIAO VIỆC']);
              if (assignedDateRaw !== undefined) {
                  record.assignedDate = processDateCell(assignedDateRaw, "Ngày giao việc");
              }

              // --- CÁC TRƯỜNG BỔ SUNG ĐẦY ĐỦ CHO TIẾP NHẬN HÀNG LOẠT ---
              // 1. Địa chỉ thửa đất
              const addressCell = getVal(['ĐỊA CHỈ THỬA ĐẤT', 'DIA CHI THUA DAT', 'address']);
              if (addressCell !== undefined) record.address = String(addressCell).trim();

              // 2. Tổ/Nhóm
              const groupCell = getVal(['TỔ', 'NHÓM', 'GROUP', 'group']);
              if (groupCell !== undefined) record.group = String(groupCell).trim();

              // 3. Người tiếp nhận
              const receivedByCell = getVal(['NGƯỜI TIẾP NHẬN', 'NGUOI TIEP NHAN', 'receivedby', 'receivedBy']);
              if (receivedByCell !== undefined) record.receivedBy = String(receivedByCell).trim();

              // 4. Người ký duyệt
              const submittedToCell = getVal(['NGƯỜI KÝ DUYỆT', 'NGUOI KY DUYET', 'submittedto', 'submittedTo']);
              if (submittedToCell !== undefined) record.submittedTo = String(submittedToCell).trim();

              // 5. Người kiểm tra
              const checkedByCell = getVal(['NGƯỜI KIỂM TRA', 'NGUOI KIEM TRA', 'checkedby', 'checkedBy']);
              if (checkedByCell !== undefined) record.checkedBy = String(checkedByCell).trim();

              // 6. Đất CLN
              const clnAreaCell = getVal(['ĐẤT CLN', 'DIỆN TÍCH CLN', 'clnarea', 'clnArea']);
              if (clnAreaCell !== undefined && clnAreaCell !== null && clnAreaCell !== '') {
                  const val = parseFloat(String(clnAreaCell));
                  record.clnArea = isNaN(val) ? 0 : val;
              }

              // 7. Đất BHK
              const bhkAreaCell = getVal(['ĐẤT BHK', 'DIỆN TÍCH BHK', 'bhkarea', 'bhkArea']);
              if (bhkAreaCell !== undefined && bhkAreaCell !== null && bhkAreaCell !== '') {
                  const val = parseFloat(String(bhkAreaCell));
                  record.bhkArea = isNaN(val) ? 0 : val;
              }

              // 8. Đất LUC
              const lucAreaCell = getVal(['ĐẤT LUC', 'DIỆN TÍCH LUC', 'lucarea', 'lucArea']);
              if (lucAreaCell !== undefined && lucAreaCell !== null && lucAreaCell !== '') {
                  const val = parseFloat(String(lucAreaCell));
                  record.lucArea = isNaN(val) ? 0 : val;
              }

              // 9. Đất khác
              const otherLandAreaCell = getVal(['ĐẤT KHÁC', 'DIỆN TÍCH ĐẤT KHÁC', 'otherlandarea', 'otherLandArea']);
              if (otherLandAreaCell !== undefined && otherLandAreaCell !== null && otherLandAreaCell !== '') {
                  const val = parseFloat(String(otherLandAreaCell));
                  record.otherLandArea = isNaN(val) ? 0 : val;
              }

              // 10. Nơi giao trả kết quả
              const handoverWardCell = getVal(['NƠI GIAO TRẢ KẾT QUẢ', 'NOI GIAO TRA KET QUA', 'ĐỊA BÀN GIAO TRẢ', 'handoverward', 'handoverWard']);
              if (handoverWardCell !== undefined) record.handoverWard = String(handoverWardCell).trim();

              // 11. Số đo đạc
              const measurementNumberCell = getVal(['SỐ ĐO ĐẠC', 'SO DO DAC', 'measurementnumber', 'measurementNumber']);
              if (measurementNumberCell !== undefined) record.measurementNumber = String(measurementNumberCell).trim();

              // 12. Số trích lục
              const excerptNumberCell = getVal(['SỐ TRÍCH LỤC', 'SO TRICH LUC', 'excerptnumber', 'excerptNumber']);
              if (excerptNumberCell !== undefined) record.excerptNumber = String(excerptNumberCell).trim();

              // 13. Hẹn nhắc nhở
              const reminderDateCell = getVal(['HẸN NHẮC NHỞ', 'NGÀY NHẮC NHỞ', 'reminderdate', 'reminderDate']);
              if (reminderDateCell !== undefined) record.reminderDate = processDateCell(reminderDateCell, "Hẹn nhắc nhở");

              // 14. Số biên lai
              const receiptNumberCell = getVal(['SỐ BIÊN LAI', 'SO BIEN LAI', 'receiptnumber', 'receiptNumber']);
              if (receiptNumberCell !== undefined) record.receiptNumber = String(receiptNumberCell).trim();

              // 15. Loại biên lai
              const receiptTypeCell = getVal(['LOẠI BIÊN LAI', 'LOAI BIEN LAI', 'receipttype', 'receiptType']);
              if (receiptTypeCell !== undefined) {
                  const str = String(receiptTypeCell).trim().toLowerCase();
                  record.receiptType = (str.includes('hóa đơn') || str.includes('invoice')) ? 'invoice' : 'receipt';
              }

              // 16. Số tiền thu
              const paymentAmountCell = getVal(['SỐ TIỀN THU', 'THỰC THU', 'paymentamount', 'paymentAmount']);
              if (paymentAmountCell !== undefined && paymentAmountCell !== null && paymentAmountCell !== '') {
                  const val = parseFloat(String(paymentAmountCell).replace(/[^0-9.-]/g, ''));
                  record.paymentAmount = isNaN(val) ? 0 : val;
              }

              // 17. Người nhận kết quả
              const receiverNameCell = getVal(['NGƯỜI NHẬN KẾT QUẢ', 'NGUOI NHAN KET QUA', 'receivername', 'receiverName']);
              if (receiverNameCell !== undefined) record.receiverName = String(receiverNameCell).trim();

              // 18. Đơn giá
              const priceCell = getVal(['ĐƠN GIÁ', 'GIÁ DỊCH VỤ', 'price']);
              if (priceCell !== undefined && priceCell !== null && priceCell !== '') {
                  const val = parseFloat(String(priceCell).replace(/[^0-9.-]/g, ''));
                  record.price = isNaN(val) ? 0 : val;
              }

              // 19. Tạm ứng
              const advancePaymentCell = getVal(['TẠM ỨNG', 'advancepayment', 'advancePayment']);
              if (advancePaymentCell !== undefined && advancePaymentCell !== null && advancePaymentCell !== '') {
                  const val = parseFloat(String(advancePaymentCell).replace(/[^0-9.-]/g, ''));
                  record.advancePayment = isNaN(val) ? 0 : val;
              }

              // 20. Có sai sót
              const hasDefectCell = getVal(['CÓ SAI SÓT', 'SAI SÓT', 'hasdefect', 'hasDefect']);
              if (hasDefectCell !== undefined) {
                  const str = String(hasDefectCell).trim().toLowerCase();
                  record.hasDefect = (str === 'có' || str === 'yes' || str === 'true' || str === '1');
              }

              // 21. Lý do sai sót
              const defectReasonCell = getVal(['LÝ DO SAI SÓT', 'defectreason', 'defectReason']);
              if (defectReasonCell !== undefined) record.defectReason = String(defectReasonCell).trim();

              // 22. Ngày báo sai sót
              const defectDateCell = getVal(['NGÀY BÁO SAI SÓT', 'defectdate', 'defectDate']);
              if (defectDateCell !== undefined) record.defectDate = processDateCell(defectDateCell, "Ngày báo sai sót");

              // 23. Lý do trả hồ sơ
              const rejectReasonCell = getVal(['LÝ DO TRẢ HỒ SƠ', 'rejectreason', 'rejectReason']);
              if (rejectReasonCell !== undefined) record.rejectReason = String(rejectReasonCell).trim();

              // 24. Ngày trả hồ sơ
              const rejectDateCell = getVal(['NGÀY TRẢ HỒ SƠ', 'rejectdate', 'rejectDate']);
              if (rejectDateCell !== undefined) record.rejectDate = processDateCell(rejectDateCell, "Ngày trả hồ sơ");

              // 25. Ghi chú chung
              const notesCell = getVal(['GHI CHÚ CHUNG', 'notes', 'notes_general']);
              if (notesCell !== undefined) record.notes = String(notesCell).trim();

              // 26. Ghi chú nội bộ
              const privateNotesCell = getVal(['GHI CHÚ NỘI BỘ', 'privatenotes', 'privateNotes']);
              if (privateNotesCell !== undefined) record.privateNotes = String(privateNotesCell).trim();

              // 27. Ghi chú cá nhân
              const personalNotesCell = getVal(['GHI CHÚ CÁ NHÂN', 'personalnotes', 'personalNotes']);
              if (personalNotesCell !== undefined) record.personalNotes = String(personalNotesCell).trim();

              // 28. Cần chỉnh lý bản đồ
              const needsMapCorrectionCell = getVal(['CẦN CHỈNH LÝ BẢN ĐỒ', 'LẬP DANH SÁCH CHỈNH LÝ', 'needsmapcorrection', 'needsMapCorrection']);
              if (needsMapCorrectionCell !== undefined) {
                  const str = String(needsMapCorrectionCell).trim().toLowerCase();
                  record.needsMapCorrection = (str === 'có' || str === 'yes' || str === 'true' || str === '1');
              }

              // 29. Hồ sơ có thuế
              const hasTaxCell = getVal(['CÓ THUẾ', 'HỒ SƠ CÓ THUẾ', 'hastax', 'hasTax']);
              if (hasTaxCell !== undefined) {
                  const str = String(hasTaxCell).trim().toLowerCase();
                  record.hasTax = (str === 'có' || str === 'yes' || str === 'true' || str === '1');
              } else if (record.recordType) {
                  const t = removeVietnameseTones(record.recordType).toLowerCase();
                  const isDefaultTax = ['thua ke', 'tang cho', 'chuyen nhuong', 'thoa thuan', 'chuyen muc dich', 'tach thua', 'hop thua'].some(keyword => t.includes(keyword));
                  record.hasTax = isDefaultTax;
              }

              // 30. Chuyển DNLIS
              const transferToDNLisCell = getVal(['CHUYỂN DNLIS', 'transfertodnlis', 'transferToDNLis']);
              if (transferToDNLisCell !== undefined) {
                  const str = String(transferToDNLisCell).trim().toLowerCase();
                  record.transferToDNLis = (str === 'có' || str === 'yes' || str === 'true' || str === '1');
              }

              if (!record.deadline && record.recordType && record.receivedDate) {
                  record.deadline = calculateDeadline(record.recordType, record.receivedDate, record.hasTax);
              }

              // Synchronize missing fields from the database if record exists by code or customerName
              const normCode = record.code ? record.code.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '') : '';
              const normName = record.customerName ? removeVietnameseTones(record.customerName.trim().toLowerCase()) : '';
              
              const existingRecord = (records || []).find(r => {
                  if (normCode && r.code) {
                      const dbCode = r.code.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
                      if (dbCode === normCode) return true;
                  }
                  if (normName && r.customerName) {
                      const dbName = removeVietnameseTones(r.customerName.trim().toLowerCase());
                      if (dbName === normName) return true;
                  }
                  return false;
              });

              if (existingRecord) {
                  record.id = existingRecord.id;
                  
                  // Fill missing/blank/undefined fields
                  const keysToSync = [
                      'code', 'customerName', 'phoneNumber', 'customerAddress', 'cccd', 'authDocType', 
                      'ward', 'mapSheet', 'landPlot', 'area', 'clnArea', 'bhkArea', 'lucArea', 'otherLandArea', 
                      'residentialArea', 'recordType', 'receivedDate', 'deadline', 'assignedTo', 'assignedDate', 
                      'completedWorkDate', 'checkedDate', 'checkedBy', 'approvalDate', 'completedDate', 
                      'resultReturnedDate', 'receiptNumber', 'receiptType', 'paymentAmount', 'receiverName', 
                      'price', 'advancePayment', 'hasDefect', 'defectReason', 'defectDate', 'rejectReason', 
                      'rejectDate', 'notes', 'privateNotes', 'personalNotes', 'needsMapCorrection', 'hasTax', 
                      'transferToDNLis', 'status', 'isDeptSynced', 'currentStepIndex', 'stepAssignees', 
                      'submittedTo', 'submissionDate', 'pendingCheckDate', 'exportBatch', 'exportDate'
                  ];
                  
                  keysToSync.forEach(key => {
                      const currentVal = record[key];
                      const existingVal = (existingRecord as any)[key];
                      
                      const isCurrentEmpty = currentVal === undefined || currentVal === null || currentVal === '';
                      const isExistingFilled = existingVal !== undefined && existingVal !== null && existingVal !== '';
                      
                      if (isCurrentEmpty && isExistingFilled) {
                          record[key] = existingVal;
                      }
                  });
              } else {
                  record.id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9);
              }
              
              if (mode === 'create') {
                  const category = currentView ? getTabCategory(currentView) : 'receive';
                  record.isDeptSynced = category !== 'receive';
                  if (!record.customerName) errors.push("Thiếu tên Chủ sử dụng.");

                  const tType = (record.recordType || '').trim().toLowerCase();
                  const isReg = tType.startsWith('3.') || tType === 'đăng ký' || tType === 'cấp giấy' || tType === 'cấp đổi' || tType === 'cấp lại' || REGISTRATION_PROCEDURES.some(p => p.toLowerCase() === tType);
                  if (isReg) {
                      if (!record.landPlot) errors.push("Thiếu Số thứ tự thửa đất.");
                      if (!record.mapSheet) errors.push("Thiếu Tờ bản đồ.");
                      if (!record.area || record.area <= 0) errors.push("Thiếu Diện tích hoặc diện tích phải lớn hơn 0.");
                  }
              } else {
                  if (!record.code) errors.push("Thiếu Mã HS (Bắt buộc để cập nhật).");
              }

              record._errors = errors;
              mappedRecords.push(record);
          }

          setPreviewData(mappedRecords as PreviewRecord[]);
          setLoading(false);
      } catch (err) {
          console.error("Lỗi parse sheet:", err);
          alert("Lỗi khi tải bảng dữ liệu.");
          setLoading(false);
      }
  };

  const handleSave = async () => {
      setLoading(true);
      setProgress({ processed: 0, total: previewData.length });
      const success = await onImport(previewData, mode, (processed, total) => {
          setProgress({ processed, total });
      });
      setLoading(false);
      setProgress(null);
      if (success) {
          onClose();
      }
  };

  const handleDownloadTemplate = () => {
      const wb = XLSX.utils.book_new();
      
      const headerStyle = {
          font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10, name: "Calibri" },
          fill: { fgColor: { rgb: "1F4E79" } },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border: {
              top: { style: "thin", color: { rgb: "CCCCCC" } },
              bottom: { style: "medium", color: { rgb: "1F4E79" } },
              left: { style: "thin", color: { rgb: "CCCCCC" } },
              right: { style: "thin", color: { rgb: "CCCCCC" } }
          }
      };

      const addStyledSheet = (sheetName: string, headers: string[], rows: any[][], colWidths: number[]) => {
          const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
          ws['!cols'] = colWidths.map(w => ({ wch: w }));
          
          for (let c = 0; c < headers.length; c++) {
              const cellRef = XLSX.utils.encode_cell({ r: 0, c });
              if (ws[cellRef]) {
                  ws[cellRef].s = headerStyle;
              }
          }
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
      };

      if (selectedTemplate === 'cap_nhat') {
          // HUONG DAN SU DUNG CAP NHAT
          const instrHeaders = ["TIÊU ĐỀ / TÊN CỘT", "MÔ TẢ CHI TIẾT", "ĐỊA BÀN HOẶC ĐỊNH DẠNG", "TÍNH BẮT BUỘC"];
          const instrRows = [
              ["MẪU CẬP NHẬT THÔNG TIN HỒ SƠ QUA EXCEL", "", "", ""],
              ["Hệ thống cập nhật thông tin thông minh dựa trên Mã Hồ Sơ", "", "", ""],
              [],
              ["[PHẦN 1] HƯỚNG DẪN CẬP NHẬT CHUNG:"],
              ["- Cột 'MÃ HỒ SƠ':", "Mã hồ sơ định danh duy nhất của hồ sơ cần cập nhật. Hệ thống sẽ dựa vào đây để cập nhật đúng hồ sơ."],
              ["- Cập nhật linh hoạt:", "Chỉ cần điền các cột cần thay đổi (ví dụ: muốn đổi trạng thái thì chỉ giữ lại cột MÃ HỒ SƠ và TRẠNG THÁI)."],
              ["- Không ghi đè trống:", "Các cột để trống trong Excel sẽ được giữ nguyên thông tin cũ trong hệ thống, không bị mất."],
              [],
              ["[PHẦN 2] QUY CHUẨN ĐỊNH DẠNG:"],
              ["TRẠNG THÁI", "Chọn đúng trạng thái: Tiếp nhận, Đang xử lý, Chờ kiểm tra, Đã kiểm tra, Chờ ký, Đã ký, Đã giao 1 cửa, Đã trả dân", "Văn bản tự do", "Không bắt buộc"],
              ["SỐ ĐO ĐẠC/TRÍCH LỤC", "Cập nhật số đo đạc hoặc số trích lục của hồ sơ chuyên môn.", "Văn bản tự do", "Không bắt buộc"],
              ["NGÀY TRẢ DÂN", "Ngày thực tế bàn giao kết quả cho người dân.", "Định dạng Ngày: DD/MM/YYYY (Ví dụ: 27/06/2026)", "Không bắt buộc"]
          ];
          
          const wsInstr = XLSX.utils.aoa_to_sheet([]);
          XLSX.utils.sheet_add_aoa(wsInstr, instrRows, { origin: "A1" });
          XLSX.utils.sheet_add_aoa(wsInstr, [instrHeaders], { origin: "A9" });
          
          wsInstr['!cols'] = [{ wch: 25 }, { wch: 50 }, { wch: 40 }, { wch: 25 }];
          
          if (wsInstr['A1']) {
              wsInstr['A1'].s = { font: { bold: true, color: { rgb: "C65911" }, sz: 14, name: "Calibri" } };
          }
          if (wsInstr['A2']) {
              wsInstr['A2'].s = { font: { italic: true, color: { rgb: "555555" }, sz: 10, name: "Calibri" } };
          }
          
          const tableHeaderStyle = {
              font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10, name: "Calibri" },
              fill: { fgColor: { rgb: "F4B084" } },
              alignment: { horizontal: "center", vertical: "center" }
          };
          for (let c = 0; c < 4; c++) {
              const cellRef = XLSX.utils.encode_cell({ r: 8, c });
              if (wsInstr[cellRef]) wsInstr[cellRef].s = tableHeaderStyle;
          }
          XLSX.utils.book_append_sheet(wb, wsInstr, '1. HUONG DAN CAP NHAT');

          // CAP NHAT SHEET
          const updateHeaders = [
              'MÃ HỒ SƠ', 'TRẠNG THÁI', 'ĐỢT BAN GIAO', 'NGÀY XUẤT', 'SỐ ĐO ĐẠC', 'SỐ TRÍCH LỤC', 'SỐ PHÁT HÀNH', 'SỐ VÀO SỔ', 'NGÀY CẤP SỔ', 'NGƯỜI NHẬN KẾT QUẢ', 'NGÀY TRẢ DÂN', 'GHI CHÚ CHUNG'
          ];
          const updateRows = [
              ['HS-DAT-001', 'Đã ký', '1', '27/06/2026', 'DD-2026-102', 'TL-2026-95', 'CC 123456', 'CH 789', '27/06/2026', 'Nguyễn Chí Thanh', '27/06/2026', 'Cập nhật thông tin thông qua mẫu Excel']
          ];
          addStyledSheet('2. CAP NHAT THONG TIN', updateHeaders, updateRows, [15, 15, 12, 12, 14, 14, 15, 12, 12, 20, 12, 35]);

          XLSX.writeFile(wb, 'Mau_Cap_Nhat_Thong_Tin_Ho_So.xlsx');
      } else {
          // HUONG DAN SU DUNG NHAP MOI
          const instrHeaders = ["TIÊU ĐỀ / TÊN CỘT", "MÔ TẢ CHI TIẾT", "ĐỊA BÀN HOẶC ĐỊNH DẠNG", "TÍNH BẮT BUỘC"];
          const instrRows = [
              ["MẪU NHẬP LIỆU HỒ SƠ MỚI QUA EXCEL", "", "", ""],
              ["Hệ thống nhập liệu thông minh dành cho các bộ phận chuyên môn", "", "", ""],
              [],
              ["[PHẦN 1] QUY CHUẨN ĐỊNH DẠNG HỆ THỐNG ĐỌC:"],
              ["MÃ HỒ SƠ", "Mã số định danh của hồ sơ. Nếu để trống, hệ thống sẽ tự sinh tự động.", "Định dạng chữ & số", "Không bắt buộc (Tự tạo nếu trống)"],
              ["CHỦ SỬ DỤNG", "Họ và tên người nộp / Chủ đất. Ví dụ: Nguyễn Văn A", "Văn bản tự do", "BẮT BUỘC"],
              ["XÃ", "Tên địa bàn xã/phường nơi có thửa đất.", "Phải chọn đúng: Tân Khai, Tân Quan, Tân Hưng, Minh Đức", "BẮT BUỘC"],
              ["LOẠI HỒ SƠ", "Quy trình hồ sơ. Hệ thống dùng trường này để tự động tính thời hạn xử lý.", "VD: 2.1 Trích lục, 2.3 Trích đo, 3.3 Chuyển Nhượng, CMD, Sao lục, Công văn...", "BẮT BUỘC"],
              ["HỒ SƠ CÓ THUẾ", "Đánh dấu hồ sơ có nghĩa vụ tài chính/thuế hay không để tự động cộng thêm 10 ngày xử lý.", "Điền: Có, Không, True, False hoặc để trống", "Không bắt buộc (Mặc định: Không)"]
          ];
          
          const wsInstr = XLSX.utils.aoa_to_sheet([]);
          XLSX.utils.sheet_add_aoa(wsInstr, instrRows, { origin: "A1" });
          XLSX.utils.sheet_add_aoa(wsInstr, [instrHeaders], { origin: "A11" });
          
          wsInstr['!cols'] = [{ wch: 25 }, { wch: 45 }, { wch: 40 }, { wch: 25 }];
          
          if (wsInstr['A1']) {
              wsInstr['A1'].s = { font: { bold: true, color: { rgb: "1F4E79" }, sz: 14, name: "Calibri" } };
          }
          if (wsInstr['A2']) {
              wsInstr['A2'].s = { font: { italic: true, color: { rgb: "555555" }, sz: 10, name: "Calibri" } };
          }
          
          const tableHeaderStyle = {
              font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10, name: "Calibri" },
              fill: { fgColor: { rgb: "5B9BD5" } },
              alignment: { horizontal: "center", vertical: "center" }
          };
          for (let c = 0; c < 4; c++) {
              const cellRef = XLSX.utils.encode_cell({ r: 10, c });
              if (wsInstr[cellRef]) wsInstr[cellRef].s = tableHeaderStyle;
          }
          XLSX.utils.book_append_sheet(wb, wsInstr, '1. HUONG DAN SU DUNG');

          if (selectedTemplate === 'dang_ky_bien_dong') {
              // 2. DANG KY BIEN DONG / CAP GIAY
              const regHeaders = [
                  'MÃ HỒ SƠ', 'CHỦ SỬ DỤNG', 'CCCD', 'SĐT', 'ĐỊA CHỈ THƯỜNG TRÚ', 'NGƯỜI ỦY QUYỀN', 'LOẠI ỦY QUYỀN', 'XÃ', 'THỬA ĐẤT SỐ', 'TỜ BẢN ĐỒ SỐ', 'DIỆN TÍCH', 'ĐẤT Ở', 'LOẠI HỒ SƠ', 'NỘI DUNG', 'GIẤY TỜ KÈM THEO', 'HỒ SƠ CÓ THUẾ'
              ];
              const regRows = [
                  ['', 'Phạm Minh Đức', '070012345111', '0966554433', 'Tổ 5, Minh Đức', '', '', 'Minh Đức', '12', '34', '150.0', '100', '3.3 Chuyển Nhượng', 'Chuyển nhượng quyền sử dụng đất cho Nguyễn Văn Hải', 'Hợp đồng chuyển nhượng|Sổ đỏ gốc', 'Có'],
                  ['', 'Vũ Hoàng Quân', '070012345222', '0944332211', 'Khu phố 2, Tân Khai', 'Vũ Văn Bằng', 'Giấy ủy quyền', 'Tân Khai', '45', '16', '200.0', '200', '3.2 Tặng Cho', 'Tặng cho quyền sử dụng đất gia đình cho con trai', 'Hợp đồng tặng cho|Giấy khai sinh', 'Không']
              ];
              addStyledSheet('2. MAU CAP GIAY NEW', regHeaders, regRows, [15, 20, 15, 14, 22, 18, 18, 12, 10, 10, 12, 10, 22, 30, 25, 15]);
              XLSX.writeFile(wb, 'Mau_Nhap_Lieu_Cap_Giay.xlsx');
          } else if (selectedTemplate === 'sao_luc') {
              // 3. SAO LUC / LUU TRU
              const arcHeaders = [
                  'MÃ HỒ SƠ', 'CHỦ SỬ DỤNG', 'SĐT', 'ĐỊA CHỈ THƯỜNG TRÚ', 'LOẠI HỒ SƠ', 'NỘI DUNG', 'GIẤY TỜ KÈM THEO', 'HỒ SƠ CÓ THUẾ'
              ];
              const arcRows = [
                  ['', 'Văn phòng Đăng ký Đất đai', '02713888999', 'Số 12 Trần Hưng Đạo', 'Sao lục', 'Yêu cầu sao lục hồ sơ địa chính thửa 45 tờ 16 xã Tân Khai', 'Phiếu yêu cầu', 'Không'],
                  ['', 'UBND huyện Hớn Quản', '02713777888', 'Khu hành chính huyện', 'Công văn', 'Công văn số 456/UBND về việc phối hợp đo đạc phục vụ giải phóng mặt bằng', 'Công văn đính kèm', 'Không']
              ];
              addStyledSheet('2. MAU LUU TRU NEW', arcHeaders, arcRows, [15, 25, 14, 25, 15, 35, 20, 15]);
              XLSX.writeFile(wb, 'Mau_Nhap_Lieu_Luu_Tru.xlsx');
          } else {
              // 4. DAT DAI / DO DAC (Default)
              const landHeaders = [
                  'MÃ HỒ SƠ', 'CHỦ SỬ DỤNG', 'CCCD', 'SĐT', 'ĐỊA CHỈ THƯỜNG TRÚ', 'XÃ', 'THỬA ĐẤT SỐ', 'TỜ BẢN ĐỒ SỐ', 'DIỆN TÍCH', 'ĐẤT Ở', 'ĐẤT CLN', 'ĐẤT BHK', 'ĐẤT LUC', 'ĐẤT KHÁC', 'ĐỊA CHỈ THỬA ĐẤT', 'NƠI GIAO TRẢ KẾT QUẢ', 'LOẠI HỒ SƠ', 'NỘI DUNG', 'GIẤY TỜ KÈM THEO', 'NGƯỜI ỦY QUYỀN', 'LOẠI ỦY QUYỀN', 'HỒ SƠ CÓ THUẾ'
              ];
              const landRows = [
                  ['', 'Trần Văn Nam', '070012345678', '0901112222', 'Tổ 2, Tân Khai', 'Tân Khai', '105', '12', '120.5', '60', '', '', '', '', 'Tổ 2, Tân Khai', 'Tân Khai', '2.1 Trích lục', 'Cung cấp trích lục bản đồ phục vụ giao dịch', 'Sổ đỏ bản gốc|CCCD photo', '', '', 'Không'],
                  ['', 'Lê Thị Thu', '070012345679', '0988877665', 'Ấp 3, Tân Hưng', 'Tân Hưng', '88', '5', '450.0', '100', '', '', '', '', 'Ấp 3, Tân Hưng', 'Tân Hưng', '2.3 Trích đo', 'Trích đo bản đồ phục vụ tách thửa', 'Đơn đề nghị|Sổ hồng photo', '', '', 'Không']
              ];
              addStyledSheet('2. MAU DO DAC NEW', landHeaders, landRows, [15, 20, 15, 14, 22, 12, 10, 10, 12, 10, 10, 10, 10, 10, 22, 20, 24, 30, 25, 18, 18, 15]);
              XLSX.writeFile(wb, 'Mau_Nhap_Lieu_Do_Dac.xlsx');
          }
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[85vh] flex flex-col animate-fade-in-up">
        {/* HEADER */}
        <div className="flex justify-between items-center p-5 border-b shrink-0">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileSpreadsheet className="text-green-600" />
            Xử Lý Dữ Liệu Excel
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600">
            <X size={24} />
          </button>
        </div>

        {/* MODE SWITCHER */}
        <div className="p-5 border-b bg-gray-50 shrink-0 space-y-4">
            <div className="flex justify-center">
                <div className="bg-white border border-gray-300 rounded-lg p-1 flex shadow-sm">
                    <button 
                        onClick={() => { setMode('create'); setPreviewData([]); setFileName(''); }}
                        className={`flex items-center gap-2 px-6 py-2 rounded-md font-medium text-sm transition-all ${mode === 'create' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        <PlusCircle size={16} /> Nhập hồ sơ mới
                    </button>
                    <button 
                        onClick={() => { setMode('update'); setPreviewData([]); setFileName(''); }}
                        className={`flex items-center gap-2 px-6 py-2 rounded-md font-medium text-sm transition-all ${mode === 'update' ? 'bg-orange-500 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        <RefreshCw size={16} /> Cập nhật thông tin
                    </button>
                </div>
            </div>

            <div className={`p-3 rounded border text-sm flex items-start gap-2 ${mode === 'create' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-orange-50 border-orange-200 text-orange-800'}`}>
                {mode === 'create' ? (
                    <>
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <span>Chế độ này sẽ <strong>thêm mới</strong> toàn bộ dòng trong file Excel vào hệ thống.</span>
                    </>
                ) : (
                    <>
                        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                        <div>
                            <strong>Chế độ Cập Nhật Thông Minh:</strong>
                            <ul className="list-disc pl-5 mt-1 space-y-1">
                                <li>Hệ thống tìm hồ sơ theo <strong>Mã Hồ Sơ</strong>.</li>
                                <li>Chỉ cập nhật các cột <strong>CÓ</strong> trong file Excel (VD: chỉ có cột Ngày Xuất thì chỉ cập nhật Ngày Xuất).</li>
                                <li><strong>QUAN TRỌNG:</strong> Nếu có cột "Đợt" hoặc "Ngày xuất/Ngày trả", hệ thống sẽ tự động chuyển trạng thái sang "Đã giao 1 cửa" để không bị báo trễ hạn.</li>
                            </ul>
                        </div>
                    </>
                )}
            </div>

            <div className="flex items-center gap-4 flex-wrap">
                <div className="relative">
                    <input type="file" ref={fileInputRef} accept=".xlsx, .xls" onChange={handleFileChange} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className={`flex items-center gap-2 text-white px-4 py-2 rounded-lg hover:opacity-90 transition-colors shadow-sm font-medium ${mode === 'create' ? 'bg-green-600' : 'bg-orange-600'}`}>
                        <Upload size={18} /> Chọn File Excel
                    </button>
                </div>

                {sheetNames.length > 1 && (
                    <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-1.5 shadow-sm">
                        <span className="text-xs font-semibold text-gray-700">Chọn Sheet:</span>
                        <select 
                            value={selectedSheet}
                            onChange={(e) => {
                                setSelectedSheet(e.target.value);
                                loadSheetData(e.target.value);
                            }}
                            className="bg-gray-50 border border-gray-300 rounded px-2 py-1 text-xs font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            {sheetNames.map((name) => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="flex items-center bg-blue-50 border border-blue-200 rounded-lg p-1 shadow-sm">
                    <select
                        value={selectedTemplate}
                        onChange={(e) => setSelectedTemplate(e.target.value)}
                        className="bg-transparent border-none text-blue-800 text-sm font-medium focus:outline-none px-2 py-1 cursor-pointer"
                    >
                        {mode === 'update' ? (
                            <option value="cap_nhat">Mẫu Cập Nhật Thông Tin</option>
                        ) : (() => {
                            const cat = getTabCategory(currentView || '');
                            if (cat === 'receive') {
                                return (
                                    <>
                                        <option value="dat_dai">Mẫu Đo Đạc (Đất Đai)</option>
                                        <option value="dang_ky_bien_dong">Mẫu Cấp Giấy (Biến Động)</option>
                                        <option value="sao_luc">Mẫu Lưu Trữ (Sao Lục)</option>
                                    </>
                                );
                            } else if (cat === 'cap_giay') {
                                return <option value="dang_ky_bien_dong">Mẫu Cấp Giấy (Biến Động)</option>;
                            } else if (cat === 'luu_tru') {
                                return <option value="sao_luc">Mẫu Lưu Trữ (Sao Lục)</option>;
                            } else {
                                return <option value="dat_dai">Mẫu Đo Đạc (Đất Đai)</option>;
                            }
                        })()}
                    </select>
                    <button 
                        onClick={handleDownloadTemplate} 
                        className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 transition-colors px-3 py-1 font-semibold text-sm border-l border-blue-200"
                        title="Tải mẫu Excel đã chọn"
                    >
                        <FileSpreadsheet size={16} /> Tải Mẫu
                    </button>
                </div>
                {fileName && <span className="text-sm text-gray-600 font-medium">{fileName}</span>}
                {previewData.length > 0 && <div className="ml-auto flex items-center gap-2 text-sm text-blue-700 bg-blue-100 px-3 py-1.5 rounded-full">
                    <Check size={16} /> Đã đọc <strong>{previewData.length}</strong> dòng ({selectedSheet})
                </div>}
            </div>
        </div>

        {/* CÔNG CỤ LỌC (CHỈ HIỂN THỊ KHI CÓ DATA) */}
        {previewData.length > 0 && !loading && (
            <div className="bg-white border-b px-5 py-3 flex gap-2 shrink-0">
                <button 
                    onClick={() => setViewFilter('all')}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${viewFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                    Tất cả ({previewData.length})
                </button>
                <button 
                    onClick={() => setViewFilter('valid')}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${viewFilter === 'valid' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'}`}
                >
                    Hợp lệ ({previewData.filter(r => !r._errors?.length).length})
                </button>
                <button 
                    onClick={() => setViewFilter('errors')}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${viewFilter === 'errors' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'}`}
                >
                    Có lỗi ({previewData.filter(r => r._errors?.length).length})
                </button>
            </div>
        )}

        {/* PREVIEW TABLE */}
        <div className="flex-1 overflow-auto p-0">
            {loading ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                    <Loader2 className="w-10 h-10 animate-spin mb-2 text-blue-500" />
                    <p>Đang xử lý dữ liệu...</p>
                </div>
            ) : previewData.length > 0 ? (
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100 sticky top-0 shadow-sm z-10 text-xs uppercase font-bold text-gray-600">
                        {mode === 'create' ? (
                            <tr>
                                <th className="p-3 border-b">#</th>
                                <th className="p-3 border-b">Mã HS</th>
                                <th className="p-3 border-b">Chủ Sử Dụng</th>
                                <th className="p-3 border-b">Xã/Phường</th>
                                <th className="p-3 border-b">Thửa/Bản Đồ</th>
                                <th className="p-3 border-b">Diện tích</th>
                                <th className="p-3 border-b">Loại Hồ Sơ</th>
                                <th className="p-3 border-b">Có Thuế</th>
                                <th className="p-3 border-b">Hạn trả (Dự kiến)</th>
                                <th className="p-3 border-b">Kiểm duyệt lỗi</th>
                            </tr>
                        ) : (
                            <tr>
                                <th className="p-3 border-b">#</th>
                                <th className="p-3 border-b">Mã HS</th>
                                <th className="p-3 border-b">Chủ Sử Dụng</th>
                                <th className="p-3 border-b">Trạng Thái (Mới)</th>
                                <th className="p-3 border-b">Đợt bàn giao</th>
                                <th className="p-3 border-b">Ngày Xuất</th>
                                <th className="p-3 border-b">Số phát hành</th>
                                <th className="p-3 border-b">Ngày trả dân</th>
                                <th className="p-3 border-b">Kiểm duyệt lỗi</th>
                            </tr>
                        )}
                    </thead>
                    <tbody className="text-sm text-gray-700 divide-y divide-gray-100">
                        {previewData.filter(r => {
                            if (viewFilter === 'valid') return !r._errors?.length;
                            if (viewFilter === 'errors') return r._errors && r._errors.length > 0;
                            return true;
                        }).map((record, idx) => {
                            const hasError = record._errors && record._errors.length > 0;
                            // Find original index for display
                            const originalIdx = previewData.indexOf(record) + 1;
                            return (
                                <tr key={originalIdx} className={`hover:bg-blue-50 ${hasError ? 'bg-red-50' : ''}`}>
                                    <td className="p-3">{originalIdx}</td>
                                    <td className="p-3 font-medium text-blue-600">{record.code || <span className="text-gray-400 italic">Tự động</span>}</td>
                                    <td className="p-3 font-medium text-gray-700">{record.customerName || <span className="text-gray-300 italic">(Giữ nguyên)</span>}</td>
                                    {mode === 'create' ? (
                                        <>
                                            <td className="p-3">{record.ward || '-'}</td>
                                            <td className="p-3 font-mono">{record.landPlot ? `T${record.landPlot}` : ''}{record.mapSheet ? `/BĐ${record.mapSheet}` : ''}</td>
                                            <td className="p-3">{record.area ? `${record.area} m²` : '-'}</td>
                                            <td className="p-3 text-xs font-semibold text-gray-600">{record.recordType}</td>
                                            <td className="p-3">
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${record.hasTax ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-gray-100 text-gray-500'}`}>
                                                    {record.hasTax ? 'Có thuế' : 'Không'}
                                                </span>
                                            </td>
                                            <td className="p-3 font-mono text-xs text-red-600 font-bold">{record.deadline ? record.deadline.split('T')[0] : '-'}</td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="p-3">
                                                {record.status ? (
                                                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${record.status === RecordStatus.HANDOVER ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                        {record.status}
                                                    </span>
                                                ) : <span className="text-gray-300 italic">(Giữ nguyên)</span>}
                                            </td>
                                            <td className="p-3 font-bold text-center">{record.exportBatch || '-'}</td>
                                            <td className="p-3 font-mono text-purple-700">{record.exportDate ? record.exportDate.split('T')[0] : '-'}</td>
                                            <td className="p-3 font-mono text-gray-600">{record.issueNumber || '-'}</td>
                                            <td className="p-3 font-mono text-green-700">{record.resultReturnedDate ? record.resultReturnedDate.split('T')[0] : '-'}</td>
                                        </>
                                    )}
                                    <td className="p-3">
                                        {hasError ? (
                                            <ul className="text-red-600 list-disc pl-4 text-xs font-medium">
                                                {record._errors!.map((err, i) => <li key={i}>{err}</li>)}
                                            </ul>
                                        ) : (
                                            <span className="text-green-600 text-xs flex items-center gap-1 font-medium"><Check size={14} /> Hợp lệ</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <FileSpreadsheet size={48} className="mb-2 opacity-50" />
                    <p>Chưa có dữ liệu. Vui lòng chọn file Excel.</p>
                </div>
            )}
        </div>

        {/* FOOTER */}
        <div className="p-5 border-t bg-white flex justify-between items-center shrink-0 rounded-b-lg">
            {previewData.length > 0 ? (
                <div className="flex gap-4 text-sm font-medium">
                    <span className="text-green-600">✅ Hợp lệ: {previewData.filter(r => !r._errors?.length).length}</span>
                    {previewData.some(r => r._errors?.length) && <span className="text-red-500">❌ Lỗi: {previewData.filter(r => r._errors?.length).length} (Vui lòng sửa Excel và tải lại)</span>}
                </div>
            ) : <div />}
            <div className="flex gap-3 items-center">
                {progress && (
                    <div className="w-48 bg-gray-200 rounded-full h-2.5 mr-4 overflow-hidden">
                        <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${Math.max(5, (progress.processed / progress.total) * 100)}%` }}></div>
                    </div>
                )}
                <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50" disabled={loading}>Hủy bỏ</button>
                <button 
                    onClick={handleSave} 
                    disabled={previewData.length === 0 || previewData.some(r => r._errors?.length) || loading} 
                    className={`flex items-center gap-2 px-6 py-2 text-white rounded-md disabled:opacity-50 font-medium shadow-sm transition-all ${mode === 'create' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'}`}>
                    {loading ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            {progress ? `Đang lưu... ${Math.round((progress.processed / progress.total) * 100)}%` : 'Đang xử lý...'}
                        </>
                    ) : (
                        <>
                            <Save size={18} /> {mode === 'create' ? 'Lưu vào hệ thống' : 'Tiến hành cập nhật'}
                        </>
                    )}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;

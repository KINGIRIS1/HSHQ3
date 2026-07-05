
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx-js-style';
import { RecordFile, RecordStatus, Employee } from '../../types';
import { RECORD_TYPES } from '../../constants';
import { Upload, FileSpreadsheet, Wand2, Save, Printer, X, Check, Download, Globe, Eye, Pencil, Trash2, Edit } from 'lucide-react';
import { confirmAction } from '../../utils/appHelpers';

interface BulkImportProps {
  onSave: (record: RecordFile) => Promise<RecordFile | null>;
  calculateDeadline: (type: string, date: string) => string;
  calculateNextCode: (ward: string, date: string, existingCodes: string[], recordType?: string) => string;
  onPreview: (record: Partial<RecordFile>) => void;
  currentUser?: any;
  employees?: Employee[];
}

interface BulkRecordItem extends Partial<RecordFile> {
    tempId: string;
    isSaved: boolean;
}

const BulkImport: React.FC<BulkImportProps> = ({ onSave, calculateDeadline, calculateNextCode, onPreview, currentUser, employees }) => {
  const [bulkRecords, setBulkRecords] = useState<BulkRecordItem[]>([]);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('dat_dai');
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  // States for row details editor
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editingRowData, setEditingRowData] = useState<BulkRecordItem | null>(null);

  const linkedEmp = employees?.find(e => e.id === currentUser?.employeeId);
  const processingWard = linkedEmp?.managedWards?.[0] || 'Tân Khai';

  const dateVal = (v: any) => { if (!v) return ''; const str = String(v); return str.includes('T') ? str.split('T')[0] : str; };

  const handleDownloadTemplate = () => {
      const wb = XLSX.utils.book_new();
      
      let headers: string[] = [];
      let sampleData: any[][] = [];
      let filename = 'Mau_Tiep_Nhan_Do_Dac.xlsx';
      
      if (selectedTemplate === 'dang_ky_bien_dong') {
          headers = [
              'MÃ HỒ SƠ', 'CHỦ SỬ DỤNG', 'CCCD', 'SĐT', 'ĐỊA CHỈ THƯỜNG TRÚ', 'NGƯỜI ỦY QUYỀN', 'LOẠI ỦY QUYỀN', 'XÃ', 'THỬA ĐẤT SỐ', 'TỜ BẢN ĐỒ SỐ', 'DIỆN TÍCH', 'ĐẤT Ở', 'LOẠI HỒ SƠ', 'NỘI DUNG', 'GIẤY TỜ KÈM THEO', 'HỒ SƠ CÓ THUẾ'
          ];
          sampleData = [
              ['', 'Phạm Minh Đức', '070012345111', '0966554433', 'Tổ 5, Minh Đức', '', '', 'Minh Đức', '12', '34', '150.0', '100', '3.3 Chuyển Nhượng', 'Chuyển nhượng quyền sử dụng đất cho Nguyễn Văn Hải', 'Hợp đồng chuyển nhượng|Sổ đỏ gốc', 'Có']
          ];
          filename = 'Mau_Tiep_Nhan_Cap_Giay.xlsx';
      } else if (selectedTemplate === 'sao_luc') {
          headers = [
              'MÃ HỒ SƠ', 'CHỦ SỬ DỤNG', 'SĐT', 'ĐỊA CHỈ THƯỜNG TRÚ', 'LOẠI HỒ SƠ', 'NỘI DUNG', 'GIẤY TỜ KÈM THEO', 'HỒ SƠ CÓ THUẾ'
          ];
          sampleData = [
              ['', 'Văn phòng Đăng ký Đất đai', '02713888999', 'Số 12 Trần Hưng Đạo', 'Sao lục', 'Yêu cầu sao lục hồ sơ địa chính thửa 45 tờ 16 xã Tân Khai', 'Phiếu yêu cầu', 'Không']
          ];
          filename = 'Mau_Tiep_Nhan_Luu_Tru.xlsx';
      } else {
          headers = [
              'MÃ HỒ SƠ', 'CHỦ SỬ DỤNG', 'CCCD', 'SĐT', 'ĐỊA CHỈ THƯỜNG TRÚ', 'XÃ', 'THỬA ĐẤT SỐ', 'TỜ BẢN ĐỒ SỐ', 'DIỆN TÍCH', 'ĐẤT Ở', 'ĐẤT CLN', 'ĐẤT BHK', 'ĐẤT LUC', 'ĐẤT KHÁC', 'ĐỊA CHỈ THỬA ĐẤT', 'NƠI GIAO TRẢ KẾT QUẢ', 'LOẠI HỒ SƠ', 'NỘI DUNG', 'GIẤY TỜ KÈM THEO', 'NGƯỜI ỦY QUYỀN', 'LOẠI ỦY QUYỀN', 'HỒ SƠ CÓ THUẾ'
          ];
          sampleData = [
              ['', 'Trần Văn Nam', '070012345678', '0901112222', 'Tổ 2, Tân Khai', 'Tân Khai', '105', '12', '120.5', '60', '', '', '', '', 'Tổ 2, Tân Khai', 'Tân Khai', '2.1 Trích lục', 'Cung cấp trích lục bản đồ phục vụ giao dịch', 'Sổ đỏ bản gốc|CCCD photo', '', '', 'Không']
          ];
          filename = 'Mau_Tiep_Nhan_Do_Dac.xlsx';
      }
      
      const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
      ws['!cols'] = headers.map(() => ({ wch: 18 }));
      
      const headerStyle = {
          font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10, name: "Calibri" },
          fill: { fgColor: { rgb: "2E7D32" } },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border: {
              top: { style: "thin", color: { rgb: "CCCCCC" } },
              bottom: { style: "medium", color: { rgb: "2E7D32" } },
              left: { style: "thin", color: { rgb: "CCCCCC" } },
              right: { style: "thin", color: { rgb: "CCCCCC" } }
          }
      };
      
      for (let c = 0; c < headers.length; c++) {
          const cellRef = XLSX.utils.encode_cell({ r: 0, c });
          if (ws[cellRef]) {
              ws[cellRef].s = headerStyle;
          }
      }
      
      XLSX.utils.book_append_sheet(wb, ws, "Mau_Nhap_Lieu");
      XLSX.writeFile(wb, filename);
  };

  const handleBulkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
          try {
              const ab = evt.target?.result;
              const wb = XLSX.read(ab, { type: 'array' });
              setWorkbook(wb);
              
              const allSheets = wb.SheetNames;
              setSheetNames(allSheets);
              
              let defaultSheet = allSheets[0];
              const importableSheets = allSheets.filter(name => {
                  const upper = name.toUpperCase();
                  return !upper.includes('HUONG DAN') && !upper.includes('GUIDE') && !upper.includes('HƯỚNG DẪN');
              });
              
              if (importableSheets.length > 0) {
                  defaultSheet = importableSheets[0];
              }
              
              setSelectedSheet(defaultSheet);
              loadBulkSheetData(defaultSheet, wb);
          } catch (error) {
              console.error("Lỗi đọc Excel hàng loạt:", error);
              alert("Lỗi khi đọc file Excel.");
          }
      };
      reader.readAsArrayBuffer(file);
  };

  const loadBulkSheetData = (sheetName: string, activeWb?: XLSX.WorkBook) => {
      const currentWb = activeWb || workbook;
      if (!currentWb) return;
      
      try {
          const ws = currentWb.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
          
          let headerRowIndex = -1;
          for (let i = 0; i < Math.min(data.length, 20); i++) {
              const row = data[i] as any[];
              if (row && row.some(cell => {
                  const s = String(cell || '').toLowerCase();
                  return s.includes('chủ sử dụng') || s.includes('tên') || s.includes('họ tên') || s.includes('customer');
              })) {
                  headerRowIndex = i;
                  break;
              }
          }
          
          if (headerRowIndex === -1) {
              headerRowIndex = 0;
          }

          const headers = (data[headerRowIndex] as string[] || []).map(h => String(h || '').toUpperCase().trim());
          const newBulkRecords: BulkRecordItem[] = [];

          const typeMapping: Record<string, string> = {
              'TL': 'Trích lục bản đồ địa chính', 'TRÍCH LỤC': 'Trích lục bản đồ địa chính',
              'TĐ': 'Trích đo bản đồ địa chính', 'TD': 'Trích đo bản đồ địa chính', 'TRÍCH ĐO': 'Trích đo bản đồ địa chính',
              'ĐĐ': 'Đo đạc', 'DD': 'Đo đạc', 'ĐO ĐẠC': 'Đo đạc',
              'CM': 'Cắm mốc', 'CẮM MỐC': 'Cắm mốc'
          };

          for (let i = headerRowIndex + 1; i < data.length; i++) {
              const row = data[i] as any[];
              if (!row || row.length === 0 || row.every(cell => cell === null || cell === undefined || cell === '')) continue;

              const getVal = (possibleHeaders: string[]) => {
                  const idx = headers.findIndex(h => possibleHeaders.some(ph => h.includes(ph)));
                  return idx !== -1 ? row[idx] : undefined;
              };

              const customerName = getVal(['CHỦ SỬ DỤNG', 'TÊN', 'HỌ TÊN']);
              if (!customerName) continue;

              const codeValFromExcel = getVal(['MÃ HỒ SƠ', 'MÃ HS', 'CODE', 'code']);
              const code = codeValFromExcel ? String(codeValFromExcel).trim() : '';

              const ward = String(getVal(['XÃ', 'PHƯỜNG', 'ĐỊA BÀN']) || '').trim() || processingWard;
              
              let rawType = String(getVal(['LOẠI', 'LĨNH VỰC', 'LOAI HO SO', 'LOẠI HỒ SƠ']) || '').trim();
              let recordType = typeMapping[rawType.toUpperCase()];

              if (!recordType) {
                  const lower = rawType.toLowerCase();
                  if (lower.includes('trích lục')) recordType = 'Trích lục bản đồ địa chính';
                  else if (lower.includes('chỉnh lý')) recordType = 'Trích đo chỉnh lý bản đồ địa chính';
                  else if (lower.includes('đo đạc')) recordType = 'Đo đạc';
                  else if (lower.includes('cắm mốc')) recordType = 'Cắm mốc';
                  else recordType = 'Trích lục bản đồ địa chính';
              }

              const authorizedBy = String(getVal(['NGƯỜI ỦY QUYỀN', 'ỦY QUYỀN', 'AUTHORIZED BY']) || '');
              const authDocType = String(getVal(['LOẠI ỦY QUYỀN', 'GIẤY ỦY QUYỀN', 'AUTH DOC']) || '');

              const parseNumber = (v: any) => {
                  if (v === undefined || v === null || v === '') return undefined;
                  const parsed = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
                  return isNaN(parsed) ? undefined : parsed;
              };

              const parseBoolean = (v: any) => {
                  if (v === undefined || v === null) return undefined;
                  const str = String(v).trim().toLowerCase();
                  return (str === 'có' || str === 'yes' || str === 'true' || str === '1');
              };

              // parse additional fields
              const cccd = getVal(['CCCD', 'CMND']);
              const group = getVal(['TỔ', 'NHÓM', 'GROUP', 'group']);
              const submittedTo = getVal(['NGƯỜI KÝ DUYỆT', 'NGUOI KY DUYET', 'submittedto', 'submittedTo']);
              const checkedBy = getVal(['NGƯỜI KIỂM TRA', 'NGUOI KIEM TRA', 'checkedby', 'checkedBy']);
              
              const clnArea = parseNumber(getVal(['ĐẤT CLN', 'DIỆN TÍCH CLN', 'clnarea', 'clnArea']));
              const bhkArea = parseNumber(getVal(['ĐẤT BHK', 'DIỆN TÍCH BHK', 'bhkarea', 'bhkArea']));
              const lucArea = parseNumber(getVal(['ĐẤT LUC', 'DIỆN TÍCH LUC', 'lucarea', 'lucArea']));
              const otherLandArea = parseNumber(getVal(['ĐẤT KHÁC', 'DIỆN TÍCH ĐẤT KHÁC', 'otherlandarea', 'otherLandArea']));
              const residentialArea = parseNumber(getVal(['ĐẤT Ở', 'THỔ CƯ', 'residentialarea', 'residentialArea']));
              
              const handoverWard = getVal(['NƠI GIAO TRẢ KẾT QUẢ', 'NOI GIAO TRA KET QUA', 'ĐỊA BÀN GIAO TRẢ', 'handoverward', 'handoverWard']);
              const measurementNumber = getVal(['SỐ ĐO ĐẠC', 'SO DO DAC', 'measurementnumber', 'measurementNumber']);
              const excerptNumber = getVal(['SỐ TRÍCH LỤC', 'SO TRICH LUC', 'excerptnumber', 'excerptNumber']);
              
              const receiptNumber = getVal(['SỐ BIÊN LAI', 'SO BIEN LAI', 'receiptnumber', 'receiptNumber']);
              const receiptTypeRaw = getVal(['LOẠI BIÊN LAI', 'LOAI BIEN LAI', 'receipttype', 'receiptType']);
              const receiptType = receiptTypeRaw ? ((String(receiptTypeRaw).trim().toLowerCase().includes('hóa đơn') || String(receiptTypeRaw).trim().toLowerCase().includes('invoice')) ? 'invoice' : 'receipt') : undefined;
              const paymentAmount = parseNumber(getVal(['SỐ TIỀN THU', 'THỰC THU', 'paymentamount', 'paymentAmount']));
              const receiverName = getVal(['NGƯỜI NHẬN KẾT QUẢ', 'NGUOI NHAN KET QUA', 'receivername', 'receiverName']);
              const price = parseNumber(getVal(['ĐƠN GIÁ', 'GIÁ DỊCH VỤ', 'price']));
              const advancePayment = parseNumber(getVal(['TẠM ỨNG', 'advancepayment', 'advancePayment']));
              
              const hasDefect = parseBoolean(getVal(['CÓ SAI SÓT', 'SAI SÓT', 'hasdefect', 'hasDefect']));
              const defectReason = getVal(['LÝ DO SAI SÓT', 'defectreason', 'defectReason']);
              const rejectReason = getVal(['LÝ DO TRẢ HỒ SƠ', 'rejectreason', 'rejectReason']);
              const notes = getVal(['GHI CHÚ CHUNG', 'notes', 'notes_general']);
              const privateNotes = getVal(['GHI CHÚ NỘI BỘ', 'privatenotes', 'privateNotes']);
              const personalNotes = getVal(['GHI CHÚ CÁ NHÂN', 'personalnotes', 'personalNotes']);
              
              const needsMapCorrection = parseBoolean(getVal(['CẦN CHỈNH LÝ BẢN ĐỒ', 'LẬP DANH SÁCH CHỈNH LÝ', 'needsmapcorrection', 'needsMapCorrection']));
              const hasTax = parseBoolean(getVal(['CÓ THUẾ', 'HỒ SƠ CÓ THUẾ', 'hastax', 'hasTax']));
              const transferToDNLis = parseBoolean(getVal(['CHUYỂN DNLIS', 'transfertodnlis', 'transferToDNLis']));
 
              const receivedDate = new Date().toISOString();
              const deadline = calculateDeadline(String(recordType), receivedDate.split('T')[0]);
 
              newBulkRecords.push({
                  tempId: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
                  isSaved: false,
                  customerName: String(customerName).trim(),
                  cccd: cccd ? String(cccd).trim() : undefined,
                  phoneNumber: String(getVal(['SĐT', 'ĐIỆN THOẠI']) || '').trim(),
                  ward: String(ward).trim(),
                  landPlot: String(getVal(['THỬA']) || '').trim(),
                  mapSheet: String(getVal(['TỜ']) || '').trim(),
                  area: parseFloat(String(getVal(['DIỆN TÍCH']) || '0')),
                  residentialArea: residentialArea || undefined,
                  clnArea: clnArea || undefined,
                  bhkArea: bhkArea || undefined,
                  lucArea: lucArea || undefined,
                  otherLandArea: otherLandArea || undefined,
                  address: String(getVal(['ĐỊA CHỈ']) || '').trim(),
                  recordType: String(recordType),
                  receivedDate: receivedDate,
                  deadline: deadline,
                  status: RecordStatus.RECEIVED,
                  receivedBy: currentUser?.employeeId,
                  content: String(getVal(['NỘI DUNG', 'GHI CHÚ']) || '').trim(),
                  authorizedBy: authorizedBy.trim(),
                  authDocType: authDocType.trim(),
                  group: group ? String(group).trim() : undefined,
                  submittedTo: submittedTo ? String(submittedTo).trim() : undefined,
                  checkedBy: checkedBy ? String(checkedBy).trim() : undefined,
                  handoverWard: handoverWard ? String(handoverWard).trim() : undefined,
                  measurementNumber: measurementNumber ? String(measurementNumber).trim() : undefined,
                  excerptNumber: excerptNumber ? String(excerptNumber).trim() : undefined,
                  receiptNumber: receiptNumber ? String(receiptNumber).trim() : undefined,
                  receiptType: receiptType || undefined,
                  paymentAmount: paymentAmount || undefined,
                  receiverName: receiverName ? String(receiverName).trim() : undefined,
                  price: price || undefined,
                  advancePayment: advancePayment || undefined,
                  hasDefect: hasDefect || undefined,
                  defectReason: defectReason ? String(defectReason).trim() : undefined,
                  rejectReason: rejectReason ? String(rejectReason).trim() : undefined,
                  notes: notes ? String(notes).trim() : undefined,
                  privateNotes: privateNotes ? String(privateNotes).trim() : undefined,
                  personalNotes: personalNotes ? String(personalNotes).trim() : undefined,
                  needsMapCorrection: needsMapCorrection || undefined,
                  hasTax: hasTax || undefined,
                  transferToDNLis: transferToDNLis || undefined,
                  code: code
              });
          }
          setBulkRecords(newBulkRecords);
          if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
      } catch (err) {
          console.error("Lỗi parse bulk sheet:", err);
          alert("Lỗi khi tải bảng dữ liệu.");
      }
  };

  const handleGenerateBulkCode = (index: number) => {
      setBulkRecords(prev => {
          const newList = [...prev];
          const record = newList[index];
          if (!record.ward) { alert("Vui lòng nhập Xã/Phường trước khi tạo mã."); return prev; }
          const existingBulkCodes = newList.map(r => r.code || '').filter(c => c !== '');
          const newCode = calculateNextCode(record.ward, record.receivedDate || '', existingBulkCodes, record.recordType || undefined);
          newList[index] = { ...record, code: newCode };
          return newList;
      });
  };

  const handleSaveBulkRecord = async (index: number) => {
      const record = bulkRecords[index];
      if (!record.code || !record.customerName) { alert("Thiếu mã hoặc tên."); return; }

      const newRecord: RecordFile = { 
          ...record, 
          id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
          receivedDate: record.receivedDate || new Date().toISOString(),
          deadline: record.deadline || '',
          status: RecordStatus.RECEIVED,
          receivedBy: currentUser?.employeeId
      } as RecordFile;

      const savedRecord = await onSave(newRecord);
      if (savedRecord) {
          setBulkRecords(prev => {
              const newList = [...prev];
              newList[index] = { ...newList[index], isSaved: true, code: savedRecord.code };
              return newList;
          });
      } else {
          alert("Lỗi khi lưu.");
      }
  };

  const updateBulkRecord = (index: number, field: keyof RecordFile, value: any) => {
      setBulkRecords(prev => {
          const newList = [...prev];
          const updated = { ...newList[index], [field]: value };
          if (field === 'recordType' || field === 'receivedDate') {
              const rType = field === 'recordType' ? value : updated.recordType;
              const rDate = field === 'receivedDate' ? value : updated.receivedDate;
              if (rType && rDate) updated.deadline = calculateDeadline(rType, rDate);
          }
          newList[index] = updated;
          return newList;
      });
  };

  const removeBulkRecord = async (index: number) => {
      if(await confirmAction('Bạn muốn xóa dòng này?')) setBulkRecords(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-fade-in">
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
                <h3 className="font-bold text-blue-800 text-lg flex items-center gap-2">
                    <Upload size={20} /> Nhập liệu hàng loạt từ Excel
                </h3>
                <p className="text-sm text-blue-600 mt-1">Chọn file Excel để nhập danh sách. Mã hồ sơ sẽ được để trống và tạo sau.</p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
                {sheetNames.length > 1 && (
                    <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 shadow-sm text-sm">
                        <span className="text-xs font-semibold text-gray-700">Chọn Sheet:</span>
                        <select 
                            value={selectedSheet}
                            onChange={(e) => {
                                setSelectedSheet(e.target.value);
                                loadBulkSheetData(e.target.value);
                            }}
                            className="bg-gray-50 border border-gray-300 rounded px-2 py-0.5 text-xs font-semibold text-gray-800 focus:outline-none"
                        >
                            {sheetNames.map((name) => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>
                )}
                <div className="flex items-center bg-green-50 border border-green-200 rounded-lg p-1 shadow-sm">
                    <select
                        value={selectedTemplate}
                        onChange={(e) => setSelectedTemplate(e.target.value)}
                        className="bg-transparent border-none text-green-800 text-sm font-bold focus:outline-none px-2 py-1 cursor-pointer"
                    >
                        <option value="dat_dai">Mẫu Đo Đạc (Đất Đai)</option>
                        <option value="dang_ky_bien_dong">Mẫu Cấp Giấy (Biến Động)</option>
                        <option value="sao_luc">Mẫu Lưu Trữ (Sao Lục)</option>
                    </select>
                    <button 
                        onClick={handleDownloadTemplate} 
                        className="flex items-center gap-1.5 text-green-700 hover:text-green-900 transition-colors px-3 py-1 font-bold text-sm border-l border-green-200"
                        title="Tải mẫu Excel đã chọn"
                    >
                        <Download size={16} /> Tải Mẫu
                    </button>
                </div>
                <button onClick={() => bulkFileInputRef.current?.click()} className="bg-white text-blue-700 border border-blue-300 px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-100 flex items-center gap-2">
                    <FileSpreadsheet size={16} /> Chọn File Excel
                </button>
                <input type="file" ref={bulkFileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleBulkImport} />
            </div>
        </div>

        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-0">
            <div className="p-3 border-b bg-gray-50 flex flex-wrap justify-between items-center gap-2">
                <span className="font-bold text-gray-700">Danh sách chờ xử lý ({bulkRecords.length})</span>
                <div className="flex flex-wrap items-center gap-3">
                    {bulkRecords.length > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                setBulkRecords(prev => prev.map(r => r.isSaved ? r : { ...r, ward: processingWard }));
                                alert(`Đã gán Xã/Phường "${processingWard}" cho tất cả hồ sơ chưa lưu.`);
                            }}
                            className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                        >
                            <Globe size={13} /> Gán nhanh Xã/Phường "{processingWard}"
                        </button>
                    )}
                    {bulkRecords.length > 0 && <span className="text-xs text-orange-600 italic">Lưu ý: Bấm "Tạo mã" &rarr; "Lưu" cho từng dòng.</span>}
                </div>
            </div>
            <div className="overflow-auto flex-1">
                <table className="w-full text-left table-fixed min-w-[1500px]">
                    <thead className="bg-gray-100 text-xs text-gray-600 uppercase font-bold sticky top-0 shadow-sm z-10">
                        <tr>
                            <th className="p-3 w-10 text-center">#</th>
                            <th className="p-3 w-[170px]">Mã Hồ Sơ</th>
                            <th className="p-3 w-[200px]">Chủ Sử Dụng</th>
                            <th className="p-3 w-[150px]">SĐT / CCCD</th>
                            <th className="p-3 w-[160px]">Tờ / Thửa / DT (m²)</th>
                            <th className="p-3 w-[130px]">Xã / Phường</th>
                            <th className="p-3 w-[200px]">Loại Hồ Sơ</th>
                            <th className="p-3 w-[120px]">Hẹn Trả</th>
                            <th className="p-3 w-[220px] text-center">Thao Tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {bulkRecords.length > 0 ? bulkRecords.map((item, idx) => (
                            <tr key={item.tempId} className={`hover:bg-blue-50/30 ${item.isSaved ? 'bg-green-50' : ''}`}>
                                <td className="p-3 text-center text-gray-400">{idx + 1}</td>
                                <td className="p-3">
                                    <div className="flex gap-1">
                                        <input type="text" className={`w-full border rounded px-2 py-1 text-sm font-mono ${item.code ? 'border-blue-300 text-blue-700 font-bold' : 'border-gray-300 bg-gray-50'}`} placeholder="Chưa có mã" value={item.code || ''} onChange={(e) => updateBulkRecord(idx, 'code', e.target.value)} readOnly={item.isSaved} />
                                        {!item.isSaved && <button onClick={() => handleGenerateBulkCode(idx)} className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200" title="Tạo mã"><Wand2 size={14} /></button>}
                                    </div>
                                </td>
                                <td className="p-3">
                                    <input type="text" className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-bold text-slate-800" value={item.customerName ?? ''} onChange={(e) => updateBulkRecord(idx, 'customerName', e.target.value)} readOnly={item.isSaved} />
                                </td>
                                <td className="p-3 space-y-1">
                                    <input type="text" placeholder="SĐT" className="w-full border border-gray-300 rounded px-2 py-0.5 text-xs" value={item.phoneNumber ?? ''} onChange={(e) => updateBulkRecord(idx, 'phoneNumber', e.target.value)} readOnly={item.isSaved} />
                                    <input type="text" placeholder="CCCD" className="w-full border border-gray-300 rounded px-2 py-0.5 text-xs" value={item.cccd ?? ''} onChange={(e) => updateBulkRecord(idx, 'cccd', e.target.value)} readOnly={item.isSaved} />
                                </td>
                                <td className="p-3">
                                    <div className="grid grid-cols-3 gap-1">
                                        <input type="text" placeholder="Tờ" className="border border-gray-300 rounded px-1.5 py-0.5 text-xs text-center font-semibold" value={item.mapSheet ?? ''} onChange={(e) => updateBulkRecord(idx, 'mapSheet', e.target.value)} readOnly={item.isSaved} title="Tờ bản đồ" />
                                        <input type="text" placeholder="Thửa" className="border border-gray-300 rounded px-1.5 py-0.5 text-xs text-center font-semibold" value={item.landPlot ?? ''} onChange={(e) => updateBulkRecord(idx, 'landPlot', e.target.value)} readOnly={item.isSaved} title="Thửa đất số" />
                                        <input type="number" placeholder="DT" className="border border-gray-300 rounded px-1.5 py-0.5 text-xs text-center font-semibold" value={item.area || ''} onChange={(e) => updateBulkRecord(idx, 'area', e.target.value ? parseFloat(e.target.value) : 0)} readOnly={item.isSaved} title="Diện tích thửa đất" />
                                    </div>
                                </td>
                                <td className="p-3">
                                    <input type="text" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" value={item.ward ?? ''} onChange={(e) => updateBulkRecord(idx, 'ward', e.target.value)} readOnly={item.isSaved} />
                                </td>
                                <td className="p-3">
                                    <select className="w-full border border-gray-300 rounded px-2 py-1 text-xs outline-none bg-white font-medium" value={item.recordType ?? ''} onChange={(e) => updateBulkRecord(idx, 'recordType', e.target.value)} disabled={item.isSaved}> 
                                        {RECORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)} 
                                    </select>
                                </td>
                                <td className="p-3">
                                    <input type="date" className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-blue-600 font-semibold" value={dateVal(item.deadline)} onChange={(e) => updateBulkRecord(idx, 'deadline', e.target.value)} readOnly={item.isSaved} />
                                </td>
                                <td className="p-3 text-center">
                                    <div className="flex justify-center gap-1.5">
                                        {item.isSaved ? (
                                            <span className="flex items-center gap-1 text-green-600 font-bold px-2.5 py-1 bg-green-50 border border-green-200 rounded text-xs"><Check size={13} /> Đã lưu</span>
                                        ) : (
                                            <button onClick={() => handleSaveBulkRecord(idx)} disabled={!item.code} className="flex items-center gap-1 bg-blue-600 text-white px-2.5 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50 text-xs font-bold transition-all shadow-sm cursor-pointer"><Save size={13} /> Lưu</button>
                                        )}
                                        <button 
                                            onClick={() => {
                                                setEditingRowIndex(idx);
                                                setEditingRowData({ ...item });
                                            }} 
                                            className="p-1.5 text-blue-600 border border-blue-200 rounded hover:bg-blue-50 transition-all cursor-pointer" 
                                            title="Sửa tất cả các trường (Đầy đủ các trường)"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button onClick={() => onPreview(item)} className="p-1.5 text-purple-600 border border-purple-200 rounded hover:bg-purple-50 transition-all cursor-pointer" title="In biên nhận"><Printer size={14} /></button>
                                        {!item.isSaved && (
                                            <button onClick={() => removeBulkRecord(idx)} className="p-1.5 text-red-500 border border-red-100 hover:bg-red-50 rounded transition-all cursor-pointer" title="Xóa dòng"><X size={14} /></button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )) : <tr><td colSpan={9} className="p-12 text-center text-gray-400 italic">Chưa có dữ liệu. Hãy tải mẫu hoặc chọn file Excel để tiếp nhận hàng loạt.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Detailed edit modal for all fields */}
        {editingRowIndex !== null && editingRowData !== null && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-scale-up border border-slate-100">
                    <div className="p-4 border-b bg-slate-50 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                                <Edit size={18} />
                            </div>
                            <h3 className="font-extrabold text-slate-800 text-lg">Chỉnh sửa chi tiết hồ sơ hàng loạt (Đầy đủ các trường)</h3>
                        </div>
                        <button 
                            onClick={() => { setEditingRowIndex(null); setEditingRowData(null); }} 
                            className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-lg transition-all"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Section 1: Record Info */}
                        <div>
                            <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest border-b border-blue-100 pb-2 mb-4">1. Thông tin tiếp nhận hồ sơ</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Mã Hồ Sơ</label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm font-mono font-bold" 
                                        value={editingRowData.code || ''} 
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, code: e.target.value } : null)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Ngày Nhận</label>
                                    <input 
                                        type="date" 
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm" 
                                        value={dateVal(editingRowData.receivedDate)} 
                                        onChange={(e) => {
                                            const d = e.target.value;
                                            setEditingRowData(prev => {
                                                if (!prev) return null;
                                                const updated = { ...prev, receivedDate: d };
                                                if (prev.recordType) updated.deadline = calculateDeadline(prev.recordType, d);
                                                return updated;
                                            });
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Hạn Trả</label>
                                    <input 
                                        type="date" 
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm text-blue-600 font-bold" 
                                        value={dateVal(editingRowData.deadline)} 
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, deadline: e.target.value } : null)}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Loại Hồ Sơ</label>
                                    <select 
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm bg-white font-medium" 
                                        value={editingRowData.recordType || ''} 
                                        onChange={(e) => {
                                            const t = e.target.value;
                                            setEditingRowData(prev => {
                                                if (!prev) return null;
                                                const updated = { ...prev, recordType: t };
                                                const rDate = dateVal(prev.receivedDate);
                                                if (rDate) updated.deadline = calculateDeadline(t, rDate);
                                                return updated;
                                            });
                                        }}
                                    >
                                        {RECORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Xã / Phường</label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm font-semibold text-slate-800" 
                                        value={editingRowData.ward || ''} 
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, ward: e.target.value } : null)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Owner Info */}
                        <div>
                            <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest border-b border-blue-100 pb-2 mb-4">2. Thông tin khách hàng & Chủ sử dụng</h4>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Họ Tên Chủ Sử Dụng</label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm font-bold text-slate-800" 
                                        value={editingRowData.customerName || ''} 
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, customerName: e.target.value } : null)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Số Điện Thoại</label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm font-medium" 
                                        value={editingRowData.phoneNumber || ''} 
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, phoneNumber: e.target.value } : null)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Số CCCD / CMND</label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm font-medium" 
                                        value={editingRowData.cccd || ''} 
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, cccd: e.target.value } : null)}
                                    />
                                </div>
                                <div className="md:col-span-4">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Địa Chỉ Thường Trú</label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm" 
                                        value={editingRowData.customerAddress || ''} 
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, customerAddress: e.target.value } : null)}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Người Ủy Quyền</label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm" 
                                        value={editingRowData.authorizedBy || ''} 
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, authorizedBy: e.target.value } : null)}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Loại Ủy Quyền / Văn Bản</label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm" 
                                        value={editingRowData.authDocType || ''} 
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, authDocType: e.target.value } : null)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Land Info */}
                        <div>
                            <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest border-b border-blue-100 pb-2 mb-4">3. Thông tin Thửa đất & Bản đồ</h4>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Tờ Bản Đồ Số</label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm font-semibold text-center" 
                                        value={editingRowData.mapSheet || ''} 
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, mapSheet: e.target.value } : null)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Thửa Đất Số</label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm font-semibold text-center" 
                                        value={editingRowData.landPlot || ''} 
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, landPlot: e.target.value } : null)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Tổng Diện Tích (m²)</label>
                                    <input 
                                        type="number" 
                                        step="any"
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm font-semibold text-center" 
                                        value={editingRowData.area || ''} 
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, area: e.target.value ? parseFloat(e.target.value) : 0 } : null)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Diện tích đất ở (m²)</label>
                                    <input 
                                        type="number" 
                                        step="any"
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm text-center" 
                                        value={editingRowData.residentialArea || ''} 
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, residentialArea: e.target.value ? parseFloat(e.target.value) : undefined } : null)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Nơi giao trả KQ</label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm" 
                                        value={editingRowData.handoverWard || ''} 
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, handoverWard: e.target.value } : null)}
                                    />
                                </div>
                                <div className="col-span-2 md:col-span-5">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Địa Chỉ Thửa Đất</label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm" 
                                        value={editingRowData.address || ''} 
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, address: e.target.value } : null)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 4: Finance & Type Areas */}
                        <div>
                            <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest border-b border-blue-100 pb-2 mb-4">4. Chi tiết diện tích đất nông nghiệp & tài chính</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Đất CLN (m²)</label>
                                    <input 
                                        type="number" 
                                        step="any"
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm text-center" 
                                        value={editingRowData.clnArea || ''} 
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, clnArea: e.target.value ? parseFloat(e.target.value) : undefined } : null)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Đất BHK (m²)</label>
                                    <input 
                                        type="number" 
                                        step="any"
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm text-center" 
                                        value={editingRowData.bhkArea || ''} 
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, bhkArea: e.target.value ? parseFloat(e.target.value) : undefined } : null)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Đất LUC (m²)</label>
                                    <input 
                                        type="number" 
                                        step="any"
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm text-center" 
                                        value={editingRowData.lucArea || ''} 
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, lucArea: e.target.value ? parseFloat(e.target.value) : undefined } : null)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Đất Khác (m²)</label>
                                    <input 
                                        type="number" 
                                        step="any"
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm text-center" 
                                        value={editingRowData.otherLandArea || ''} 
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, otherLandArea: e.target.value ? parseFloat(e.target.value) : undefined } : null)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Đơn Giá Dịch Vụ</label>
                                    <input 
                                        type="number" 
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm font-bold text-slate-700" 
                                        value={editingRowData.price || ''} 
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, price: e.target.value ? parseFloat(e.target.value) : undefined } : null)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Tạm Ứng</label>
                                    <input 
                                        type="number" 
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm font-bold text-indigo-700" 
                                        value={editingRowData.advancePayment || ''} 
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, advancePayment: e.target.value ? parseFloat(e.target.value) : undefined } : null)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Số Biên Lai</label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm font-mono" 
                                        value={editingRowData.receiptNumber || ''} 
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, receiptNumber: e.target.value } : null)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Loại Biên Lai</label>
                                    <select 
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm bg-white"
                                        value={editingRowData.receiptType || ''}
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, receiptType: (e.target.value || undefined) as any } : null)}
                                    >
                                        <option value="">-- Mặc định --</option>
                                        <option value="receipt">Biên lai</option>
                                        <option value="invoice">Hóa đơn</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Section 5: Other details, checkboxes */}
                        <div>
                            <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest border-b border-blue-100 pb-2 mb-4">5. Ghi chú, Nội dung & Tùy chọn nâng cao</h4>
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Nội Dung Yêu Cầu / Tóm Tắt</label>
                                    <textarea 
                                        rows={2}
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm" 
                                        value={editingRowData.content || ''} 
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, content: e.target.value } : null)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Giấy Tờ Kèm Theo (Khác)</label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm" 
                                        value={editingRowData.otherDocs || ''} 
                                        onChange={(e) => setEditingRowData(prev => prev ? { ...prev, otherDocs: e.target.value } : null)}
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Ghi Chú Chung</label>
                                        <input 
                                            type="text" 
                                            className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm" 
                                            value={editingRowData.notes || ''} 
                                            onChange={(e) => setEditingRowData(prev => prev ? { ...prev, notes: e.target.value } : null)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Ghi Chú Nội Bộ</label>
                                        <input 
                                            type="text" 
                                            className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm" 
                                            value={editingRowData.privateNotes || ''} 
                                            onChange={(e) => setEditingRowData(prev => prev ? { ...prev, privateNotes: e.target.value } : null)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Ghi Chú Cá Nhân</label>
                                        <input 
                                            type="text" 
                                            className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm" 
                                            value={editingRowData.personalNotes || ''} 
                                            onChange={(e) => setEditingRowData(prev => prev ? { ...prev, personalNotes: e.target.value } : null)}
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-6 pt-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            checked={!!editingRowData.needsMapCorrection}
                                            onChange={(e) => setEditingRowData(prev => prev ? { ...prev, needsMapCorrection: e.target.checked } : null)}
                                        />
                                        <span className="text-xs font-bold text-slate-700">Cần lập danh sách chỉnh lý bản đồ</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            checked={!!editingRowData.hasTax}
                                            onChange={(e) => setEditingRowData(prev => prev ? { ...prev, hasTax: e.target.checked } : null)}
                                        />
                                        <span className="text-xs font-bold text-slate-700">Hồ sơ có thuế</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            checked={!!editingRowData.transferToDNLis}
                                            onChange={(e) => setEditingRowData(prev => prev ? { ...prev, transferToDNLis: e.target.checked } : null)}
                                        />
                                        <span className="text-xs font-bold text-slate-700">Chuyển qua hệ thống DNLis</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t bg-slate-50 flex justify-end gap-3 shrink-0">
                        <button 
                            type="button"
                            onClick={() => { setEditingRowIndex(null); setEditingRowData(null); }} 
                            className="px-5 py-2 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-200 text-sm transition-all active:scale-95 cursor-pointer"
                        >
                            Hủy bỏ
                        </button>
                        <button 
                            type="button"
                            onClick={() => {
                                if (editingRowIndex !== null && editingRowData !== null) {
                                    setBulkRecords(prev => {
                                        const newList = [...prev];
                                        newList[editingRowIndex] = { ...editingRowData };
                                        return newList;
                                    });
                                    setEditingRowIndex(null);
                                    setEditingRowData(null);
                                }
                            }} 
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 text-sm transition-all shadow-md active:scale-95 cursor-pointer"
                        >
                            Lưu thay đổi
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default BulkImport;

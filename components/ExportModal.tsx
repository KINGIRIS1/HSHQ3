
import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx-js-style';
import { RecordFile, RecordStatus, Employee } from '../types';
import { X, FileDown, Calendar, Layers, MapPin, Printer, Eye } from 'lucide-react';
import { REGISTRATION_PROCEDURES } from '../constants';
import { isArchiveType, isMeasurementType, getDisplayNotes } from '../utils/appHelpers';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: RecordFile[];
  wards: string[];
  type: 'handover' | 'check_list' | 'returned'; // Phân loại danh sách
  onPreview: (workbook: XLSX.WorkBook, fileName: string) => void; // Callback để mở Preview
  employees: Employee[];
  currentView?: string;
}

const cleanDeptName = (str: string): string => {
  if (!str) return '';
  return str.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
};

const isReg = (type: string | null | undefined): boolean => {
  if (!type) return false;
  const t = type.trim().toLowerCase();
  return t.startsWith('3.') || t === 'đăng ký' || t === 'cấp giấy' || t === 'cấp đổi' || t === 'cấp lại' || REGISTRATION_PROCEDURES.some(p => p.toLowerCase() === t);
};

const getEmployeeTeam = (emp: Employee): string => {
  const dept = cleanDeptName(emp.department || '');
  const pos = cleanDeptName(emp.position || '');

  if (dept.includes('luu tru') || dept.includes('sao luc') || dept.includes('thong tin')) {
    return 'Tổ Lưu trữ';
  }

  if (
    dept.includes('do dac') || 
    dept.includes('ky thuat') || 
    dept.includes('dia chinh') || 
    dept.includes('noi nghiep') || 
    dept.includes('ngoai nghiep') || 
    dept.includes('do hinh') || 
    dept.includes('ban do') ||
    dept.includes('to do') ||
    dept === 'do'
  ) {
    return 'Tổ Đo đạc';
  }

  if (
    dept.includes('cap giay') || 
    dept.includes('dang ky') || 
    dept.includes('bien dong') || 
    dept.includes('cap qsd') || 
    dept.includes('tham dinh')
  ) {
    return 'Tổ Cấp giấy';
  }

  if (
    dept.includes('giam doc') || 
    dept.includes('lanh dao') || 
    pos.includes('giam doc') || 
    pos.includes('pho giam doc') || 
    pos.includes('truong phong')
  ) {
    return 'Ban Giám Đốc';
  }

  return 'Khác';
};

const getViewActiveGroup = (view: string | undefined): 'measurement' | 'registration' | 'archive' | 'other' => {
    if (!view) return 'measurement';
    if (view.startsWith('archive_') || view === 'archive_records') {
        return 'archive';
    }
    if (['registration_records', 'registration_assign_tasks', 'registration_completed_list', 'registration_pending_check_list', 'registration_check_list', 'registration_handover_list', 'registration_director_completed', 'registration_vao_so'].includes(view)) {
        return 'registration';
    }
    if (['other_records', 'other_assign_tasks', 'other_check_list', 'other_handover_list', 'other_director_completed'].includes(view)) {
        return 'other';
    }
    return 'measurement';
};

const getRecordGroup = (r: RecordFile): 'measurement' | 'registration' | 'archive' | 'other' => {
    if (isArchiveType(r.recordType)) return 'archive';
    if (isReg(r.recordType)) return 'registration';
    return 'measurement';
};

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, records, wards, type, onPreview, employees, currentView }) => {
  const [selectedBatchKey, setSelectedBatchKey] = useState<string>('');
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [selectedDept, setSelectedDept] = useState<string>('all');

  // Filter the list of records to only include those belonging to the active group of the current view
  const groupFilteredRecords = useMemo(() => {
    // Đã tắt bộ lọc theo chuyên môn để hiển thị toàn bộ danh sách hồ sơ
    return records;
  }, [records]);

  const getRecordDepartment = (r: RecordFile): string => {
    if (r.assignedTo) {
        const emp = employees.find(e => e.id === r.assignedTo);
        if (emp) {
            const team = getEmployeeTeam(emp);
            if (team && team !== 'Ban Giám Đốc') {
                return team;
            }
        }
    }

    // Fallback to recordType based classification
    if (!r.recordType) return 'Tổ Đo đạc';
    const t = r.recordType.trim().toLowerCase();
    
    if (isReg(r.recordType)) return 'Tổ Cấp giấy';
    if (isMeasurementType(r.recordType)) return 'Tổ Đo đạc';
    
    const isArchive = isArchiveType(r.recordType) || r.recordType === 'Sao lục' || r.recordType === 'Công văn' || r.recordType === '1.1 Công văn' || r.recordType === '1.2 Công văn' || r.recordType === '1. Cung cấp dữ liệu đất đai' || r.recordType === '1.1 Cung cấp dữ liệu đất đai' || r.recordType === 'Cung cấp tài liệu đất đai';
    if (isArchive) return 'Tổ Lưu trữ';
    
    if (['cmd', 'tòa án', 'thi hành án'].includes(t)) {
        return 'Khác';
    }
    
    return 'Tổ Đo đạc';
  };

  const isDeptFixed = useMemo(() => {
    if (!currentView) return false;
    const view = currentView.toLowerCase();
    return (
      view.includes('gcn') || 
      view.includes('capgiay') || 
      view.includes('cap_giay') ||
      view.includes('archive') || 
      view.includes('congvan') || 
      view.includes('luutru') || 
      view.includes('sao_luc') ||
      [
        'assign_tasks', 
        'completed_list', 
        'pending_check_list', 
        'check_list', 
        'director_completed', 
        'handover_list'
      ].includes(currentView)
    );
  }, [currentView]);

  // 1. Tổng hợp danh sách các đợt (Batch Options) dựa theo tổ/bộ phận
  const batchOptions = useMemo(() => {
    const batches: Record<string, { date: string, batch: number | string, count: number }> = {};

    groupFilteredRecords.forEach(r => {
      if (type === 'handover') {
          // Logic cho Giao 1 cửa: Cho phép chọn đợt dựa vào exportBatch và exportDate của bất kỳ hồ sơ nào có thông tin này, không phụ thuộc trạng thái hiện tại
          if (r.exportBatch && r.exportDate) {
              if (selectedDept !== 'all' && getRecordDepartment(r) !== selectedDept) {
                  return;
              }
              const dateStr = r.exportDate.split('T')[0];
              const key = `${dateStr}_${r.exportBatch}`;
              if (!batches[key]) {
                  batches[key] = { date: dateStr, batch: r.exportBatch, count: 0 };
              }
              batches[key].count++;
          } else if (r.status === RecordStatus.HANDOVER) {
              // Chưa gán đợt nhưng đang ở trạng thái bàn giao (Lẻ)
              if (selectedDept !== 'all' && getRecordDepartment(r) !== selectedDept) {
                  return;
              }
              const dateStr = (r.completedDate || r.receivedDate || new Date().toISOString()).split('T')[0];
              const key = `${dateStr}_NOT_BATCHED`;
              if (!batches[key]) {
                  batches[key] = { date: dateStr, batch: 'Lẻ (Chưa tạo đợt)', count: 0 };
              }
              batches[key].count++;
          }
      } else if (type === 'returned') {
          // Logic cho Trả kết quả (TKQ): Dựa vào archiveBatch và archiveDate, không phụ thuộc trạng thái hiện tại
          if (r.archiveBatch && r.archiveDate) {
              if (selectedDept !== 'all' && getRecordDepartment(r) !== selectedDept) {
                  return;
              }
              const dateStr = r.archiveDate.split('T')[0];
              const key = `${dateStr}_${r.archiveBatch}`;
              if (!batches[key]) {
                  batches[key] = { date: dateStr, batch: r.archiveBatch, count: 0 };
              }
              batches[key].count++;
          } else if (r.status === RecordStatus.RETURNED) {
              // Chưa gán đợt nhưng đang ở trạng thái Đã trả KQ (Lẻ)
              if (selectedDept !== 'all' && getRecordDepartment(r) !== selectedDept) {
                  return;
              }
              const dateStr = (r.resultReturnedDate || r.completedDate || r.receivedDate || new Date().toISOString()).split('T')[0];
              const key = `${dateStr}_NOT_BATCHED`;
              if (!batches[key]) {
                  batches[key] = { date: dateStr, batch: 'Lẻ (Chưa tạo đợt)', count: 0 };
              }
              batches[key].count++;
          }
      } else if (type === 'check_list') {
          // Logic cho Trình Ký: Dựa vào ngày tiếp nhận (receivedDate) để gom nhóm
          // Lấy các hồ sơ đang Chờ ký hoặc Đã ký (nhưng chưa giao)
          if (r.status === RecordStatus.PENDING_SIGN || r.status === RecordStatus.SIGNED) {
              if (selectedDept !== 'all' && getRecordDepartment(r) !== selectedDept) {
                  return;
              }
              const dateStr = r.receivedDate ? r.receivedDate.split('T')[0] : null;
              if (!dateStr) return;
              const key = `date_${dateStr}`;
              if (!batches[key]) {
                  batches[key] = { date: dateStr, batch: 'Theo ngày', count: 0 };
              }
              batches[key].count++;
          }
      }
    });

    // Sắp xếp giảm dần theo ngày
    return Object.entries(batches)
        .map(([key, value]) => ({ key, ...value }))
        .sort((a, b) => b.date.localeCompare(a.date));
  }, [records, isOpen, type, selectedDept]);

  // Tự động chọn tổ mặc định dựa trên tab/view hiện tại
  useEffect(() => {
    if (isOpen) {
        setSelectedWard('all');
        
        if (currentView) {
            const view = currentView.toLowerCase();
            if (view.includes('gcn') || view.includes('capgiay') || view.includes('cap_giay')) {
                setSelectedDept('Tổ Cấp giấy');
            } else if (view.includes('archive') || view.includes('congvan') || view.includes('luutru') || view.includes('sao_luc')) {
                setSelectedDept('Tổ Lưu trữ');
            } else if (
                view === 'all_records' || 
                view === 'assign_tasks' || 
                view === 'completed_list' || 
                view === 'pending_check_list' || 
                view === 'check_list' || 
                view === 'director_completed' || 
                view === 'handover_list' || 
                view.includes('do_dac')
            ) {
                setSelectedDept('Tổ Đo đạc');
            } else {
                setSelectedDept('all');
            }
        } else {
            setSelectedDept('all');
        }
    }
  }, [isOpen, currentView]);

  // Tự động chọn đợt mới nhất khi mở modal hoặc khi danh sách đợt thay đổi
  useEffect(() => {
    if (isOpen) {
      if (batchOptions.length > 0) {
        // Chỉ đặt mặc định nếu chưa chọn đợt nào, hoặc đợt đã chọn trước đó không còn tồn tại
        const exists = batchOptions.some(opt => opt.key === selectedBatchKey);
        if (!selectedBatchKey || !exists) {
          setSelectedBatchKey(batchOptions[0].key);
          setSelectedWard('all');
        }
      } else {
        setSelectedBatchKey('');
        setSelectedWard('all');
      }
    } else {
      setSelectedBatchKey('');
      setSelectedWard('all');
    }
  }, [isOpen, batchOptions, selectedBatchKey]);

  const formatDate = (d: string) => {
      const date = new Date(d);
      if (isNaN(date.getTime())) return d;
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
  };

  const removeVietnameseTones = (str: string): string => {
    if (!str) return '';
    str = str.toLowerCase();
    str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    str = str.replace(/đ/g, "d");
    str = str.replace(/\s+/g, "_");
    return str.toUpperCase();
  };

  // Hàm tạo Workbook chung (cho cả Preview và Download)
  const generateWorkbook = (): { wb: XLSX.WorkBook, fileName: string } | null => {
    if (!selectedBatchKey) return null;

    let recordsToExport: RecordFile[] = [];
    let title = "";
    let subTitle = "";
    let fileName = "";

    // Xử lý tên xã phường để hiển thị
    // NẾU selectedWard là 'all' thì hiển thị "TOÀN BỘ", ngược lại hiển thị tên xã
    const wardTitle = selectedWard === 'all' ? "" : ` - ${selectedWard.toUpperCase()}`;

    if (type === 'handover' || type === 'returned') {
        const parts = selectedBatchKey.split('_');
        const dateStr = parts[0];
        const batchStr = parts.slice(1).join('_');
        
        recordsToExport = groupFilteredRecords.filter(r => {
            const targetWard = r.handoverWard || r.ward;
            const matchWard = selectedWard === 'all' || targetWard === selectedWard;
            
            if (type === 'handover') {
                if (batchStr === 'NOT_BATCHED') {
                    const matchStatus = r.status === RecordStatus.HANDOVER || r.status === RecordStatus.SIGNED || r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.REJECTED;
                    const rDateObj = (r.completedDate || r.receivedDate || new Date().toISOString()).split('T')[0];
                    return matchStatus && !r.exportBatch && rDateObj === dateStr && matchWard;
                } else {
                    const batchNum = parseInt(batchStr);
                    return r.exportDate?.startsWith(dateStr) && r.exportBatch === batchNum && matchWard;
                }
            } else { // type === 'returned'
                if (batchStr === 'NOT_BATCHED') {
                    const matchStatus = r.status === RecordStatus.RETURNED;
                    const rDateObj = (r.resultReturnedDate || r.completedDate || r.receivedDate || new Date().toISOString()).split('T')[0];
                    return matchStatus && !r.archiveBatch && rDateObj === dateStr && matchWard;
                } else {
                    const batchNum = parseInt(batchStr);
                    return r.archiveDate?.startsWith(dateStr) && r.archiveBatch === batchNum && matchWard;
                }
            }
        });

        title = type === 'returned' 
            ? `DANH SÁCH TRẢ KẾT QUẢ (TKQ)${wardTitle}` 
            : `DANH SÁCH BÀN GIAO HỒ SƠ 1 CỬA${wardTitle}`;
        const deptClean = selectedDept !== 'all' ? selectedDept.replace('Tổ ', '') : '';
        const deptSuffix = deptClean ? ` (${deptClean})` : '';
        const displayBatch = batchStr === 'NOT_BATCHED' 
            ? 'CHƯA TẠO ĐỢT' 
            : (type === 'returned' ? `Đợt ${batchStr} (DD-LT)` : `Đợt ${batchStr}${deptSuffix}`);
        subTitle = `${displayBatch}  -  TỔNG SỐ HỒ SƠ: ${recordsToExport.length}`;
        const safeDate = dateStr.replace(/-/g, '');
        const deptFileSuffix = deptClean ? `_${removeVietnameseTones(deptClean)}` : '';
        
        fileName = type === 'returned'
            ? `Tra_KQ_TKQ_${batchStr === 'NOT_BATCHED' ? 'Le' : `Dot_${batchStr}_(DD-LT)`}_${safeDate}`
            : `Giao_1_Cua_${batchStr === 'NOT_BATCHED' ? 'Le' : `Dot_${batchStr}`}_${safeDate}${deptFileSuffix}`;

    } else {
        // Check List
        const dateStr = selectedBatchKey.replace('date_', '');
        
        recordsToExport = groupFilteredRecords.filter(r => {
            const matchDate = r.receivedDate === dateStr;
            const matchStatus = r.status === RecordStatus.PENDING_SIGN || r.status === RecordStatus.SIGNED;
            const matchWard = selectedWard === 'all' || r.ward === selectedWard;
            return matchDate && matchStatus && matchWard;
        });

        title = `DANH SÁCH HỒ SƠ TRÌNH KÝ${wardTitle}`;
        subTitle = `NGÀY TIẾP NHẬN: ${formatDate(dateStr)}  -  SỐ LƯỢNG: ${recordsToExport.length}`;
        const safeDate = dateStr.replace(/-/g, '');
        fileName = `Trinh_Ky_Ngay_${safeDate}`;
    }

    if (selectedDept !== 'all') {
        recordsToExport = recordsToExport.filter(r => getRecordDepartment(r) === selectedDept);
    }

    if (recordsToExport.length === 0) {
        alert("Không tìm thấy hồ sơ nào cho lựa chọn này.");
        return null;
    }

    if (selectedDept !== 'all') {
        const cleanDeptTitle = selectedDept.replace('Tổ ', '').toUpperCase();
        title += ` - ${cleanDeptTitle}`;
        if (type !== 'handover') {
            fileName += `_${removeVietnameseTones(selectedDept)}`;
        }
        
        // Cập nhật lại phụ đề hiển thị số lượng hồ sơ thực tế sau khi lọc bộ phận
        if (type === 'handover' || type === 'returned') {
            const parts = selectedBatchKey.split('_');
            const batchStr = parts.slice(1).join('_');
            const deptClean = selectedDept.replace('Tổ ', '');
            const displayBatch = batchStr === 'NOT_BATCHED' 
                ? 'CHƯA TẠO ĐỢT' 
                : (type === 'returned' ? `Đợt ${batchStr} (DD-LT)` : `Đợt ${batchStr} (${deptClean})`);
            subTitle = `${displayBatch}  -  SỐ LƯỢNG: ${recordsToExport.length}`;
        } else {
            const dateStr = selectedBatchKey.replace('date_', '');
            subTitle = `NGÀY TIẾP NHẬN: ${formatDate(dateStr)}  -  ${selectedDept.replace('Tổ ', '').toUpperCase()}  -  SỐ LƯỢNG: ${recordsToExport.length}`;
        }
    }

    if (selectedWard !== 'all') {
        fileName += `_${removeVietnameseTones(selectedWard)}`;
    }

    // --- TẠO EXCEL ---
    // Tiêu đề ngày tháng (dùng ngày hiện tại hoặc ngày của đợt)
    const exportDateParts = type === 'handover' 
        ? selectedBatchKey.split('_')[0].split('-') 
        : selectedBatchKey.replace('date_', '').split('-');
        
    const displayDate = `Ngày ${exportDateParts[2]} tháng ${exportDateParts[1]} năm ${exportDateParts[0]}`;

    // --- CẤU HÌNH CỘT ĐỘNG ---
    const isHandover = type === 'handover';
    const isSpecificWard = selectedWard !== 'all';

    // 1. Header Array
    let tableHeader = ["STT", "Mã Hồ Sơ", "Chủ Sử Dụng"];
    
    // Nếu là Giao 1 cửa và chọn xã cụ thể thì BỎ cột Địa Chỉ
    // Nếu là Trình ký hoặc Tất cả xã thì GIỮ cột Địa Chỉ
    if (!(isHandover && isSpecificWard)) {
        tableHeader.push("Địa Chỉ (Xã)");
    }

    tableHeader.push("Thửa", "Tờ", "Loại Hồ Sơ");

    // Chỉ hiện Số TĐ, Số TL ở danh sách Trình Ký (Check List)
    if (!isHandover) {
        tableHeader.push("Số TĐ", "Số TL");
    }

    tableHeader.push("Hẹn Trả");

    // Thêm cột cho Giao 1 cửa
    if (isHandover) {
        tableHeader.push("Ngày nhận hồ sơ", "Ký tên"); // Sửa tiêu đề
    }

    tableHeader.push("Ghi Chú");

    // 2. Data Mapping
    const dataRows = recordsToExport.map((r, index) => {
        let noteText = getDisplayNotes(r.notes);
        if (r.status === RecordStatus.WITHDRAWN) {
            noteText = noteText ? `${noteText} (CSD rút hồ sơ)` : 'CSD rút hồ sơ';
        }
        if (isHandover) {
            noteText = ''; // Ghi chú trống hoàn toàn, chỉ thể hiện nội bộ không cập nhật vào danh sách bàn giao
        }

        const row = [
            index + 1,
            r.code || '',
            r.customerName || ''
        ];

        if (!(isHandover && isSpecificWard)) {
            row.push(r.handoverWard || r.ward || '');
        }

        row.push(
            r.landPlot || '',
            r.mapSheet || '',
            r.recordType || ''
        );

        if (!isHandover) {
            row.push(
                r.measurementNumber || '',
                r.excerptNumber || ''
            );
        }

        row.push(r.deadline ? formatDate(r.deadline) : '');

        if (isHandover) {
            row.push("", ""); // Ngày nhận hồ sơ, Ký tên (Để trống)
        }

        row.push(noteText);

        return row;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]); 

    // Header Quốc Hiệu
    const isDoDac = selectedDept === 'Tổ Đo đạc';
    
    const headerRows = [
        ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
        ["Độc lập - Tự do - Hạnh phúc"],
        [""],
        [title],
        [displayDate.toUpperCase()],
        [subTitle]
    ];
    
    if (isDoDac) {
        headerRows.push(["Có hồ sơ gốc kèm theo"]);
    }
    
    headerRows.push([""], tableHeader);
    
    XLSX.utils.sheet_add_aoa(ws, headerRows, { origin: "A1" });

    // Data
    const dataStartRow = headerRows.length + 1; // 9 if not isDoDac, 10 if isDoDac
    XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: `A${dataStartRow}` });

    const totalCols = tableHeader.length;
    const lastDataRow = (dataStartRow - 1) + dataRows.length; // 8 + dataRows.length or 9 + dataRows.length
    const footerStartRow = lastDataRow + 2;

    // Thêm Footer (Canh đều 2 bên - Justify)
    const midPoint = Math.floor(totalCols / 2);
    const leftStart = 0;
    const leftEnd = midPoint - 1;
    const rightStart = midPoint + 1; // Để lại 1 cột trống ở giữa
    const rightEnd = totalCols - 1;

    // Nếu không đủ cột để chia đôi đẹp, footer sẽ tự điều chỉnh
    const footerRow1 = new Array(totalCols).fill("");
    footerRow1[leftStart] = "BÊN GIAO HỒ SƠ";
    footerRow1[rightStart] = "BÊN NHẬN HỒ SƠ";

    const footerRow2 = new Array(totalCols).fill("");
    footerRow2[leftStart] = "(Ký và ghi rõ họ tên)";
    footerRow2[rightStart] = "(Ký và ghi rõ họ tên)";

    XLSX.utils.sheet_add_aoa(ws, [footerRow1, footerRow2], { origin: `A${footerStartRow + 1}` });

    // Cấu hình độ rộng cột (Cần mapping với tableHeader)
    const wscols = [
        { wch: 5 },  // STT
        { wch: 14 }, // Mã HS
        { wch: 22 }, // Chủ SD
    ];

    if (!(isHandover && isSpecificWard)) {
        wscols.push({ wch: 15 }); // Địa Chỉ (Xã)
    }

    wscols.push(
        { wch: 7 },  // Thửa
        { wch: 7 },  // Tờ
        { wch: 20 }  // Loại
    );

    if (!isHandover) {
        wscols.push(
            { wch: 8 },  // TĐ
            { wch: 8 }   // TL
        );
    }

    wscols.push({ wch: 11 }); // Hẹn

    if (isHandover) {
        wscols.push(
            { wch: 15 }, // Ngày nhận hồ sơ
            { wch: 35 }  // Ký tên (Tăng rộng để ký và ghi tên)
        );
    }

    wscols.push({ wch: 8 }); // Ghi chú (Thu nhỏ)

    ws['!cols'] = wscols;

    // --- CẤU HÌNH CHIỀU CAO DÒNG (ROWS HEIGHT) ---
    // Đây là phần quan trọng để tăng chiều cao dòng cho việc ký tên
    const wsrows = [];
    
    // Tiêu đề, Header bảng: Cao 30px
    const headerRowCount = isDoDac ? 9 : 8;
    for(let i=0; i<headerRowCount; i++) {
        wsrows.push({ hpx: 30 }); 
    }
    
    // Các dòng dữ liệu: Cao 60px (Rất rộng để ký và ghi họ tên)
    for(let i=0; i < dataRows.length; i++) {
        wsrows.push({ hpx: 60 });
    }

    // Các dòng trống và Footer
    // lastDataRow là dòng trống đầu tiên sau dữ liệu.
    // Footer bắt đầu từ lastDataRow + 2.
    wsrows.push({ hpx: 25 }); // Dòng trống sát dữ liệu
    wsrows.push({ hpx: 25 }); // Dòng trống tiếp theo (để tạo khoảng cách)
    
    wsrows.push({ hpx: 30 }); // Dòng tiêu đề Footer (BÊN GIAO...)
    wsrows.push({ hpx: 30 }); // Dòng ghi chú Footer (Ký và ghi rõ...)

    ws['!rows'] = wsrows;

    // Merge Config
    const headerMerges = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: totalCols - 1 } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: totalCols - 1 } },
        { s: { r: 5, c: 0 }, e: { r: 5, c: totalCols - 1 } }
    ];
    if (isDoDac) {
        headerMerges.push({ s: { r: 6, c: 0 }, e: { r: 6, c: totalCols - 1 } });
    }

    ws['!merges'] = [
        ...headerMerges,
        // Footer Merges
        { s: { r: footerStartRow, c: leftStart }, e: { r: footerStartRow, c: leftEnd } },     
        { s: { r: footerStartRow + 1, c: leftStart }, e: { r: footerStartRow + 1, c: leftEnd } }, 
        
        { s: { r: footerStartRow, c: rightStart }, e: { r: footerStartRow, c: rightEnd } },    
        { s: { r: footerStartRow + 1, c: rightStart }, e: { r: footerStartRow + 1, c: rightEnd } },
    ];

    // Styles
    const borderStyle = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    const styles = {
        nationalTitle: { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center", vertical: "center" } },
        nationalSlogan: { font: { name: "Times New Roman", sz: 12, bold: true, underline: true }, alignment: { horizontal: "center", vertical: "center" } },
        reportTitle: { font: { name: "Times New Roman", sz: 14, bold: true }, alignment: { horizontal: "center", vertical: "center" } },
        reportSubTitle: { font: { name: "Times New Roman", sz: 12, italic: true }, alignment: { horizontal: "center", vertical: "center" } },
        tableHeader: { font: { name: "Times New Roman", sz: 11, bold: true }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: borderStyle, fill: { fgColor: { rgb: "E0E0E0" } } },
        tableData: { font: { name: "Times New Roman", sz: 11 }, border: borderStyle, alignment: { vertical: "center", wrapText: true } },
        tableDataCenter: { font: { name: "Times New Roman", sz: 11 }, border: borderStyle, alignment: { horizontal: "center", vertical: "center", wrapText: true } },
        sigTitle: { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center", vertical: "center" } },
        sigNote: { font: { name: "Times New Roman", sz: 11, italic: true }, alignment: { horizontal: "center", vertical: "center" } }
    };

    if(ws['A1']) ws['A1'].s = styles.nationalTitle;
    if(ws['A2']) ws['A2'].s = styles.nationalSlogan;
    if(ws['A4']) ws['A4'].s = styles.reportTitle;
    if(ws['A5']) ws['A5'].s = styles.reportSubTitle;
    if(ws['A6']) ws['A6'].s = styles.reportSubTitle;
    if(isDoDac && ws['A7']) ws['A7'].s = styles.reportSubTitle;

    const headerRowIdx = dataStartRow - 2; // 7 if dataStartRow is 9, 8 if dataStartRow is 10
    for (let c = 0; c < totalCols; c++) {
        const headerCell = XLSX.utils.encode_cell({ r: headerRowIdx, c: c });
        if (!ws[headerCell]) ws[headerCell] = { v: "", t: "s" };
        ws[headerCell].s = styles.tableHeader;

        for (let r = headerRowIdx + 1; r < lastDataRow; r++) {
            const cellRef = XLSX.utils.encode_cell({ r: r, c: c });
            if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
            
            // Tìm tên cột hiện tại để apply style
            const colName = tableHeader[c];
            const centerCols = ["STT", "Thửa", "Tờ", "Số TĐ", "Số TL", "Hẹn Trả", "Đợt Xuất", "Ngày nhận hồ sơ"];
            
            if (centerCols.includes(colName)) ws[cellRef].s = styles.tableDataCenter;
            else ws[cellRef].s = styles.tableData;
        }
    }

    // Apply Footer Styles (NO BORDER)
    const giaoRef = XLSX.utils.encode_cell({ r: footerStartRow, c: leftStart });
    const giaoNoteRef = XLSX.utils.encode_cell({ r: footerStartRow + 1, c: leftStart });
    const nhanRef = XLSX.utils.encode_cell({ r: footerStartRow, c: rightStart });
    const nhanNoteRef = XLSX.utils.encode_cell({ r: footerStartRow + 1, c: rightStart });

    if(ws[giaoRef]) ws[giaoRef].s = styles.sigTitle;
    if(ws[giaoNoteRef]) ws[giaoNoteRef].s = styles.sigNote;
    if(ws[nhanRef]) ws[nhanRef].s = styles.sigTitle;
    if(ws[nhanNoteRef]) ws[nhanNoteRef].s = styles.sigNote;

    XLSX.utils.book_append_sheet(wb, ws, "Danh Sách");
    return { wb, fileName };
  };

  const handleDownload = () => {
      const result = generateWorkbook();
      if (result) {
          XLSX.writeFile(result.wb, result.fileName + '.xlsx');
          onClose(); // Đóng sau khi tải
      }
  };

  const handlePreview = () => {
      const result = generateWorkbook();
      if (result) {
          onPreview(result.wb, result.fileName);
          onClose(); // Đóng modal chọn đợt để hiện modal Preview
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-fade-in-up">
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Printer className="text-blue-600" />
            {type === 'returned' ? 'Xuất DS Trả Kết Quả (TKQ)' : type === 'handover' ? 'Xuất DS Giao 1 Cửa' : 'Xuất DS Trình Ký'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">1. Chọn đợt / ngày xuất</label>
                {batchOptions.length > 0 ? (
                    <div className="relative">
                        <select
                            className="w-full appearance-none border border-gray-300 rounded-lg px-4 py-3 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-gray-700 font-medium"
                            value={selectedBatchKey}
                            onChange={(e) => setSelectedBatchKey(e.target.value)}
                        >
                            {batchOptions.map(opt => {
                                const deptClean = selectedDept !== 'all' ? selectedDept.replace('Tổ ', '') : '';
                                const deptSuffix = deptClean ? ` (${deptClean})` : '';
                                const displayBatchText = type === 'returned' 
                                    ? `Đợt ${opt.batch} (DD-LT)` 
                                    : `Đợt ${opt.batch}${deptSuffix}`;
                                return (
                                    <option key={opt.key} value={opt.key}>
                                        {type === 'handover' || type === 'returned'
                                          ? (opt.batch === 'Lẻ (Chưa tạo đợt)' 
                                              ? `Lẻ (Chưa tạo đợt) - Ngày ${formatDate(opt.date)} (${opt.count} HS)`
                                              : `${displayBatchText} - Ngày ${formatDate(opt.date)} (${opt.count} HS)`)
                                          : `Ngày tiếp nhận: ${formatDate(opt.date)} (${opt.count} HS)`
                                        }
                                    </option>
                                );
                            })}
                        </select>
                        <Layers className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={18} />
                    </div>
                ) : (
                    <div className="text-center p-4 bg-gray-50 rounded-lg text-gray-500 border border-gray-200 text-sm">
                        {type === 'handover' 
                            ? 'Chưa có đợt giao nào. Hãy thực hiện "Chốt danh sách" trước.'
                            : type === 'returned'
                            ? 'Chưa có đợt trả kết quả nào. Hãy thực hiện "Chốt DS TKQ" trước.'
                            : 'Không có hồ sơ nào đang chờ ký.'}
                    </div>
                )}
            </div>

            {batchOptions.length > 0 && (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">2. Lọc theo Xã / Phường (Tùy chọn)</label>
                        <div className="relative">
                            <select
                                className="w-full appearance-none border border-gray-300 rounded-lg px-4 py-3 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-gray-700 font-medium"
                                value={selectedWard}
                                onChange={(e) => setSelectedWard(e.target.value)}
                            >
                                <option value="all">-- Tất cả Xã / Phường --</option>
                                {wards.map(w => (
                                    <option key={w} value={w}>{w}</option>
                                ))}
                            </select>
                            <MapPin className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={18} />
                        </div>
                    </div>

                    {type !== 'handover' && type !== 'returned' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">3. Lọc theo Tổ / Bộ phận Chuyên môn (Tùy chọn) {isDeptFixed && <span className="text-xs text-blue-600 font-normal">(Cố định theo Tab)</span>}</label>
                            <div className="relative">
                                <select
                                    className="w-full appearance-none border border-gray-300 rounded-lg px-4 py-3 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-gray-700 font-medium disabled:bg-gray-100 disabled:text-gray-500"
                                    value={selectedDept}
                                    onChange={(e) => setSelectedDept(e.target.value)}
                                    disabled={isDeptFixed}
                                >
                                    <option value="all">-- Tất cả các tổ chuyên môn --</option>
                                    <option value="Tổ Đo đạc">Tổ Đo đạc</option>
                                    <option value="Tổ Cấp giấy">Tổ Cấp giấy</option>
                                    <option value="Tổ Lưu trữ">Tổ Lưu trữ</option>
                                    <option value="Khác">Khác / Hành chính</option>
                                </select>
                                <Layers className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={18} />
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded border border-blue-100 flex gap-2 items-start">
                <Calendar size={14} className="mt-0.5 text-blue-500 shrink-0" />
                <p>Hệ thống sẽ tạo file Excel chuẩn A4 Ngang (Landscape) để in ấn.</p>
            </div>

            <div className="pt-4 flex justify-between gap-3 border-t">
                <button 
                    onClick={onClose} 
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium text-sm"
                >
                    Hủy bỏ
                </button>
                
                <div className="flex gap-2">
                    <button 
                        onClick={handlePreview}
                        disabled={batchOptions.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-200 disabled:opacity-50 font-medium text-sm transition-colors"
                    >
                        <Eye size={18} />
                        Xem trước & In
                    </button>
                    <button 
                        onClick={handleDownload}
                        disabled={batchOptions.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-medium text-sm shadow-sm transition-colors"
                    >
                        <FileDown size={18} />
                        Tải Excel
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;

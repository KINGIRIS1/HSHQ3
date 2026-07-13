import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx-js-style';
import { RecordFile, RecordStatus, Employee } from '../../types';
import { getNormalizedWard, getShortRecordType, REGISTRATION_PROCEDURES } from '../../constants';
import { isArchiveType, isMeasurementType, isRegType, getStatusLabel } from '../../utils/appHelpers';
import { Search, Eye, FileSpreadsheet, Pencil, Printer, Trash2, Send, XCircle, UserPlus, FileSignature } from 'lucide-react';
import AssignModal from '../AssignModal';

interface DailyListProps {
  records: RecordFile[];
  wards: string[];
  currentUser: any;
  employees?: Employee[];
  onPreviewExcel: (wb: XLSX.WorkBook, name: string) => void;
  // Handlers
  onEdit: (record: RecordFile) => void;
  onDelete: (record: RecordFile) => void;
  onDeleteRaw?: (id: string) => Promise<boolean>;
  onSave?: (record: RecordFile) => Promise<RecordFile | null>;
  onPrint: (record: RecordFile) => void;
  onCreateContract?: (record: RecordFile) => void;
}

// Hàm lấy mã viết tắt (Prefix) từ tên Xã/Phường
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
    
    return 'CT'; // Mặc định
};

const DailyList: React.FC<DailyListProps> = ({ 
  records, 
  wards, 
  currentUser, 
  employees = [], 
  onPreviewExcel, 
  onEdit, 
  onDelete, 
  onDeleteRaw,
  onSave,
  onPrint,
  onCreateContract
}) => {
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('Toàn bộ'); // State "Bộ phận"
  
  // Row selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // --- FILTERS & SEARCH ---
  const filteredDailyRecords = useMemo(() => {
      if (!records) return [];
      const searchLower = searchTerm.toLowerCase();
      
      const list = records.filter(r => {
          // Lọc theo user nhận
          if (r.receivedBy !== currentUser.employeeId) {
              return false;
          }

          // 1. Lọc theo ngày nhận
          const recordDate = r.receivedDate ? r.receivedDate.split('T')[0] : '';
          if (recordDate !== filterDate) return false;
          
          // 2. Lọc theo Bộ phận (gồm: 1.x Lưu trữ, 2.x Đo đạc, 3.x Cấp giấy)
          const getRecordDepartment = (rec: RecordFile): string => {
              if (rec.recordType) {
                  if (isMeasurementType(rec.recordType)) {
                      return '2.x Đo đạc';
                  }
                  if (isArchiveType(rec.recordType)) {
                      return '1.x Lưu trữ';
                  }
                  if (isRegType(rec.recordType)) {
                      return '3.x Cấp giấy';
                  }
              }

              if (rec.assignedTo) {
                  const emp = employees.find(e => e.id === rec.assignedTo);
                  if (emp && emp.department) {
                      const deptLower = emp.department.toLowerCase();
                      if (
                          deptLower.includes('đo đạc') || deptLower.includes('do dac') || 
                          deptLower.includes('kỹ thuật') || deptLower.includes('ky thuat') || 
                          deptLower.includes('tổ đo') || deptLower.includes('dia chinh') ||
                          deptLower.includes('bản đồ') || deptLower.includes('ban do')
                      ) {
                          return '2.x Đo đạc';
                      }
                      if (
                          deptLower.includes('lưu trữ') || deptLower.includes('luu tru') || 
                          deptLower.includes('sao lục') || deptLower.includes('sao luc') ||
                          deptLower.includes('văn thư') || deptLower.includes('van thu')
                      ) {
                          return '1.x Lưu trữ';
                      }
                      if (
                          deptLower.includes('đăng ký') || deptLower.includes('dang ky') || 
                          deptLower.includes('cấp giấy') || deptLower.includes('cap giay') || 
                          deptLower.includes('biến động') || deptLower.includes('bien dong') ||
                          deptLower.includes('một cửa') || deptLower.includes('mot cua')
                      ) {
                          return '3.x Cấp giấy';
                      }
                  }
              }

              return '3.x Cấp giấy';
          };
          // Bỏ chức năng chọn toàn bộ mặc định. Tích bộ nào hiển thị bộ đó, không tích bộ nào thì không hiển thị.
          const rDept = getRecordDepartment(r);
          if (selectedDept !== 'Toàn bộ' && rDept !== selectedDept) return false;

          // 3. Tìm kiếm từ khóa
          if (searchTerm) {
              const nameMatch = r.customerName?.toLowerCase().includes(searchLower);
              const codeMatch = r.code?.toLowerCase().includes(searchLower);
              if (!nameMatch && !codeMatch) return false;
          }

          // 4. Lọc bỏ hồ sơ đã chuyển chuyên môn (isDeptSynced = true) hoặc đã được xử lý (đã gán người / trạng thái khác RECEIVED)
          if (r.isDeptSynced === true) return false;
          if (r.assignedTo || r.status !== RecordStatus.RECEIVED) return false;

          return true;
      });

      // Sắp xếp: Tăng dần theo mã hồ sơ
      return list.sort((a, b) => {
          const codeA = (a.code || '').toUpperCase();
          const codeB = (b.code || '').toUpperCase();
          return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
      });
  }, [records, filterDate, searchTerm, selectedDept, currentUser]);

  // Luôn bỏ tích chọn khi thay đổi ngày, bộ phận lọc để tránh nhầm lẫn (bỏ records ra để tránh xóa khi đồng bộ)
  React.useEffect(() => {
      setSelectedIds(new Set());
  }, [filterDate, selectedDept]);

  // --- COMPUTE SELECTED RECORDS FOR ASSIGN ---
  const selectedRecordsForAssign = useMemo(() => {
      return filteredDailyRecords.filter(r => selectedIds.has(r.id));
  }, [filteredDailyRecords, selectedIds]);

  // --- SELECTION HANDLERS ---
  const toggledAll = useMemo(() => {
      return filteredDailyRecords.length > 0 && selectedIds.size === filteredDailyRecords.length;
  }, [filteredDailyRecords, selectedIds]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
          setSelectedIds(new Set(filteredDailyRecords.map(r => r.id)));
      } else {
          setSelectedIds(new Set());
      }
  };

  const handleSelectRecord = (id: string) => {
      const next = new Set(selectedIds);
      if (next.has(id)) {
          next.delete(id);
      } else {
          next.add(id);
      }
      setSelectedIds(next);
  };

  // --- BULK ASSIGN HANDLER ---
  const handleAssignConfirm = async (employeeId: string, workflowType?: string | null) => {
      if (!onSave) {
          alert("Lỗi: Chức năng lưu chưa được tích hợp.");
          return;
      }
      const et = new Date().toISOString();
      let successCount = 0;
      
      try {
          for (const record of selectedRecordsForAssign) {
              const updatedRecord: RecordFile = {
                  ...record,
                  status: RecordStatus.IN_PROGRESS,
                  assignedTo: employeeId,
                  assignedDate: et,
                  submissionDate: null,
                  approvalDate: null,
                  completedDate: null,
              };
              if (workflowType) {
                  updatedRecord.gcnWorkflowType = workflowType;
              }
              const result = await onSave(updatedRecord);
              if (result) {
                  successCount++;
              }
          }
          setSelectedIds(new Set());
          setIsAssignModalOpen(false);
          alert(`Đã chuyển chuyên môn và đang thực hiện thành công cho ${successCount} hồ sơ.`);
      } catch (err) {
          console.error("Lỗi khi chuyển chuyên môn:", err);
          alert("Có lỗi xảy ra trong quá trình chuyển chuyên môn.");
      }
  };

  // --- BULK TRANSFER TO DEPARTMENT ---
  const handleBulkTransferToDept = async () => {
      if (selectedIds.size === 0) return;
      if (!onSave) {
          alert("Lỗi: Chức năng lưu chưa được tích hợp.");
          return;
      }
      const confirmMessage = `Bạn có chắc muốn chuyển đồng bộ ${selectedIds.size} hồ sơ đã chọn về các phòng chuyên môn?`;
      const isConfirmed = window.confirm(confirmMessage);
      if (!isConfirmed) return;

      let successCount = 0;
      try {
          const selectedRecords = records.filter(r => selectedIds.has(r.id));
          for (const record of selectedRecords) {
              const updatedRecord: RecordFile = {
                  ...record,
                  isDeptSynced: true,
              };
              const result = await onSave(updatedRecord);
              if (result) {
                  successCount++;
              }
          }
          setSelectedIds(new Set());
          alert(`Đã chuyển đồng bộ thành công ${successCount} hồ sơ về các phòng chuyên môn.`);
      } catch (err) {
          console.error("Lỗi khi chuyển chuyên môn bộ phận:", err);
          alert("Có lỗi xảy ra trong quá trình chuyển chuyên môn.");
      }
  };

  // --- INDIVIDUAL TRANSFER TO DEPARTMENT ---
  const handleIndividualTransfer = async (record: RecordFile) => {
      if (record.isDeptSynced) return;
      if (!onSave) {
          alert("Lỗi: Chức năng lưu chưa được tích hợp.");
          return;
      }
      const confirmMessage = `Bạn có chắc muốn chuyển đồng bộ hồ sơ ${record.code} về phòng chuyên môn?`;
      const isConfirmed = window.confirm(confirmMessage);
      if (!isConfirmed) return;

      try {
          const updatedRecord: RecordFile = {
              ...record,
              isDeptSynced: true,
          };
          const result = await onSave(updatedRecord);
          if (result) {
              alert(`Đã chuyển đồng bộ hồ sơ ${record.code} về phòng chuyên môn thành công.`);
          }
      } catch (err) {
          console.error("Lỗi khi chuyển chuyên môn bộ phận:", err);
          alert("Có lỗi xảy ra trong quá trình chuyển chuyên môn.");
      }
  };

  // --- BULK DELETE / HỦY TIẾP NHẬN ---
  const handleBulkDelete = async () => {
      if (selectedIds.size === 0) return;
      const confirmMessage = `Bạn có chắc muốn hủy tiếp nhận (xóa) ${selectedIds.size} hồ sơ đã chọn?`;
      const isConfirmed = window.confirm(confirmMessage);
      if (!isConfirmed) return;

      try {
          let successCount = 0;
          const idsToDelete = Array.from(selectedIds);
          
          for (const id of idsToDelete) {
              let ok = false;
              if (onDeleteRaw) {
                  ok = await onDeleteRaw(id);
              } else {
                  const rec = filteredDailyRecords.find(r => r.id === id);
                  if (rec) {
                      await onDelete(rec);
                      ok = true;
                  }
              }
              if (ok) {
                  successCount++;
              }
          }
          setSelectedIds(new Set());
          alert(`Đã hủy tiếp nhận thành công ${successCount} hồ sơ.`);
      } catch (err) {
          console.error("Lỗi khi hủy tiếp nhận:", err);
          alert("Có lỗi xảy ra khi hủy tiếp nhận hồ sơ.");
      }
  };

  // --- EXCEL GENERATION ---
  const createDailyListWorkbook = () => {
      if (filteredDailyRecords.length === 0) return null;
      
      const wardTitle = "DANH SÁCH TỔNG HỢP";
      const dateParts = filterDate.split('-'); 
      const dateStr = `NGÀY ${dateParts[2]} THÁNG ${dateParts[1]} NĂM ${dateParts[0]}`;
      
      const tableHeader = ["STT", "Mã Hồ Sơ", "Chủ Sử Dụng", "Xã / Phường", "Tờ", "Thửa", "Loại Hồ Sơ", "Hẹn Trả", "Ghi Chú"];
      
      const dataRows = filteredDailyRecords.map((r, i) => [
          i + 1, r.code, r.customerName, 
          getNormalizedWard(r.ward), 
          r.mapSheet, r.landPlot, 
          getShortRecordType(r.recordType), 
          r.deadline ? new Date(r.deadline).toLocaleDateString('vi-VN') : '', r.content
      ]);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([]);

      // Styles
      const border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      const center = { alignment: { horizontal: "center", vertical: "center", wrapText: true } };
      const headerStyle = { font: { name: "Times New Roman", sz: 11, bold: true }, border, fill: { fgColor: { rgb: "E0E0E0" } }, ...center };
      const cellStyle = { font: { name: "Times New Roman", sz: 11 }, border, alignment: { vertical: "center", wrapText: true } };
      const centerCellStyle = { font: { name: "Times New Roman", sz: 11 }, border, alignment: { horizontal: "center", vertical: "center", wrapText: true } };

      // Header content
      XLSX.utils.sheet_add_aoa(ws, [
          ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"], ["Độc lập - Tự do - Hạnh phúc"], [""],
          ["DANH SÁCH TIẾP NHẬN HỒ SƠ"], [wardTitle], [dateStr], tableHeader
      ], { origin: "A1" });
      
      // Data content
      XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A8" });

      // Footer
      const lastDataRowIndex = 7 + dataRows.length;
      const footerRowIndex = lastDataRowIndex + 2;

      XLSX.utils.sheet_add_aoa(ws, [
          ["BÊN GIAO HỒ SƠ", "", "", "", "", "BÊN NHẬN HỒ SƠ", "", "", ""],
          ["(Ký và ghi rõ họ tên)", "", "", "", "", "(Ký và ghi rõ họ tên)", "", "", ""]
      ], { origin: { r: footerRowIndex, c: 0 } });

      // Merges
      if (!ws['!merges']) ws['!merges'] = [];
      ws['!merges'].push(
          { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }, 
          { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } }, 
          { s: { r: 3, c: 0 }, e: { r: 3, c: 8 } }, 
          { s: { r: 4, c: 0 }, e: { r: 4, c: 8 } }, 
          { s: { r: 5, c: 0 }, e: { r: 5, c: 8 } },
          { s: { r: footerRowIndex, c: 0 }, e: { r: footerRowIndex, c: 3 } },
          { s: { r: footerRowIndex + 1, c: 0 }, e: { r: footerRowIndex + 1, c: 3 } },
          { s: { r: footerRowIndex, c: 5 }, e: { r: footerRowIndex, c: 8 } },
          { s: { r: footerRowIndex + 1, c: 5 }, e: { r: footerRowIndex + 1, c: 8 } }
      );

      // Column Widths
      ws['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 22 }, { wch: 15 }, { wch: 6 }, { wch: 6 }, { wch: 20 }, { wch: 12 }, { wch: 15 }];

      // Styles Loop
      for(let c=0; c<=8; c++) { 
          const ref = XLSX.utils.encode_cell({r: 6, c: c}); 
          if(!ws[ref]) ws[ref] = { v: "", t: "s"}; 
          ws[ref].s = headerStyle; 
      }
      for(let r=7; r < lastDataRowIndex; r++) { 
          for(let c=0; c<=8; c++) { 
              const ref = XLSX.utils.encode_cell({r: r, c: c}); 
              if(!ws[ref]) ws[ref] = { v: "", t: "s"}; 
              if (c === 4 || c === 5) ws[ref].s = centerCellStyle;
              else ws[ref].s = cellStyle;
          } 
      }

      // Footer Styles
      const sigTitleStyle = { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center" } };
      const sigNoteStyle = { font: { name: "Times New Roman", sz: 11, italic: true }, alignment: { horizontal: "center" } };

      const leftTitle = XLSX.utils.encode_cell({r: footerRowIndex, c: 0});
      const leftNote = XLSX.utils.encode_cell({r: footerRowIndex + 1, c: 0});
      const rightTitle = XLSX.utils.encode_cell({r: footerRowIndex, c: 5});
      const rightNote = XLSX.utils.encode_cell({r: footerRowIndex + 1, c: 5});

      if(!ws[leftTitle]) ws[leftTitle] = {v: "BÊN GIAO HỒ SƠ", t:'s'}; ws[leftTitle].s = sigTitleStyle;
      if(!ws[leftNote]) ws[leftNote] = {v: "(Ký và ghi rõ họ tên)", t:'s'}; ws[leftNote].s = sigNoteStyle;
      if(!ws[rightTitle]) ws[rightTitle] = {v: "BÊN NHẬN HỒ SƠ", t:'s'}; ws[rightTitle].s = sigTitleStyle;
      if(!ws[rightNote]) ws[rightNote] = {v: "(Ký và ghi rõ họ tên)", t:'s'}; ws[rightNote].s = sigNoteStyle;

      XLSX.utils.book_append_sheet(wb, ws, "Danh Sach");
      return wb;
  };

  const handleExport = () => {
      const wb = createDailyListWorkbook();
      if (!wb) { alert("Không có hồ sơ."); return; }
      XLSX.writeFile(wb, `DS_Tiep_Nhan_${filterDate.replace(/-/g, '')}.xlsx`);
  };

  const handlePreview = () => {
      const wb = createDailyListWorkbook();
      if (!wb) { alert("Không có hồ sơ."); return; }
      onPreviewExcel(wb, `DS_Tiep_Nhan_${filterDate.replace(/-/g, '')}`);
  };

  // Status mapping badge helper matching design template
  const getStatusBadge = (status: RecordStatus, rec?: RecordFile) => {
      const isReg = rec?.recordType ? (
          (() => {
              const t = rec.recordType.trim().toLowerCase();
              return t.startsWith('3.') || t === 'đăng ký' || t === 'cấp giấy' || t === 'cấp đổi' || t === 'cấp lại' || REGISTRATION_PROCEDURES.some((p: string) => p.toLowerCase() === t);
          })()
      ) : false;

      if (isReg) {
          const labelText = getStatusLabel(status, rec?.recordType, rec);
          let colorClasses = "bg-gray-50 text-gray-600 border border-gray-200";
          if (status === RecordStatus.RETURNED) {
              colorClasses = "bg-emerald-50 text-emerald-600 border border-emerald-200";
          } else if (status === RecordStatus.WITHDRAWN || status === RecordStatus.REJECTED) {
              colorClasses = "bg-red-50 text-red-600 border border-red-200";
          } else if (status === RecordStatus.HANDOVER) {
              colorClasses = "bg-green-50 text-green-600 border border-green-200";
          } else if (status === RecordStatus.SIGNED) {
              colorClasses = "bg-indigo-50 text-indigo-600 border border-indigo-200";
          } else if (status === RecordStatus.PENDING_SIGN) {
              colorClasses = "bg-purple-50 text-purple-600 border border-purple-200";
          } else if (status === RecordStatus.PENDING_CHECK) {
              colorClasses = "bg-orange-50 text-orange-600 border border-orange-200";
          } else if (status === RecordStatus.TBT) {
              colorClasses = "bg-amber-50 text-amber-600 border border-amber-200";
          } else if (status === RecordStatus.COMPLETED_WORK) {
              colorClasses = "bg-cyan-50 text-cyan-600 border border-cyan-200";
          } else if (status === RecordStatus.IN_PROGRESS || status === RecordStatus.ASSIGNED) {
              colorClasses = "bg-blue-50 text-blue-600 border border-blue-200";
          } else if (status === RecordStatus.RECEIVED) {
              colorClasses = rec?.isDeptSynced ? "bg-[#e6f7ff] text-[#0050b3] border border-[#91d5ff]" : "bg-amber-50 text-amber-600 border border-amber-200";
          }

          return (
              <span className={`px-2.5 py-1 text-xs font-bold ${colorClasses} rounded-full inline-block`}>
                  {labelText}
              </span>
          );
      }

      switch (status) {
          case RecordStatus.RECEIVED:
              return rec?.isDeptSynced ? (
                  <span className="px-2.5 py-1 text-xs font-bold bg-[#e6f7ff] text-[#0050b3] border border-[#91d5ff] rounded-full inline-block">
                      Đã chuyển bộ phận
                  </span>
              ) : (
                  <span className="px-2.5 py-1 text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200 rounded-full inline-block">
                      Chờ chuyển
                  </span>
              );
          case RecordStatus.ASSIGNED:
              return (
                  <span className="px-2.5 py-1 text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200 rounded-full inline-block">
                      Đã giao việc
                  </span>
              );
          case RecordStatus.IN_PROGRESS:
              return (
                  <span className="px-2.5 py-1 text-xs font-bold bg-yellow-50 text-yellow-600 border border-yellow-200 rounded-full inline-block">
                      Đang thực hiện
                  </span>
              );
          case RecordStatus.COMPLETED_WORK:
              return (
                  <span className="px-2.5 py-1 text-xs font-bold bg-cyan-50 text-cyan-600 border border-cyan-200 rounded-full inline-block">
                      Đã thực hiện
                  </span>
              );
          case RecordStatus.RETURNED:
              return (
                  <span className="px-2.5 py-1 text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full inline-block">
                      Đã trả KQ
                  </span>
              );
          default:
              return (
                  <span className="px-2.5 py-1 text-xs font-bold bg-gray-50 text-gray-600 border border-gray-200 rounded-full inline-block">
                      {status}
                  </span>
              );
      }
  };

  const DEPARTMENTS = ['1.x Lưu trữ', '2.x Đo đạc', '3.x Cấp giấy'];

  return (
    <div className="flex flex-col h-full space-y-4 animate-fade-in">
        {/* Filter bar - matches visual layout in screenshot */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-4 shrink-0">
            <div className="flex items-center gap-2"> 
                <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Ngày nhận:</label> 
                <input 
                    type="date" 
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500" 
                    value={filterDate} 
                    onChange={(e) => setFilterDate(e.target.value)} 
                /> 
            </div>
            
            <div className="relative flex-1 max-w-xs"> 
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} /> 
                <input 
                    type="text" 
                    placeholder="Tìm kiếm..." 
                    className="w-full pl-9 pr-4 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                /> 
            </div>

            {/* Bộ phận Select Filter */}
            <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">Bộ phận:</span>
                <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="pl-3 pr-8 py-1.5 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer font-semibold text-gray-700"
                >
                    <option value="Toàn bộ">Toàn bộ</option>
                    {DEPARTMENTS.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                    ))}
                </select>
            </div>

            {/* Bulk actions matching layout */}
            <button 
                disabled={selectedIds.size === 0} 
                onClick={handleBulkTransferToDept}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                    selectedIds.size > 0 
                        ? 'bg-green-600 text-white hover:bg-green-700 shadow-sm border border-green-700 cursor-pointer' 
                        : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                }`}
            >
                <Send size={14} /> Chuyển HS ({selectedIds.size})
            </button>

            <button 
                disabled={selectedIds.size === 0} 
                onClick={handleBulkDelete}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                    selectedIds.size > 0 
                        ? 'bg-red-600 text-white hover:bg-red-700 shadow-sm border border-red-700 cursor-pointer' 
                        : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                }`}
            >
                <XCircle size={14} /> Hủy tiếp nhận
            </button>

            {/* Main view operations */}
            <div className="ml-auto flex gap-2">
                <button 
                    onClick={handlePreview} 
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 shadow-sm text-sm font-bold transition-all active:scale-95"
                > 
                    <Eye size={16} /> Xem Excel 
                </button>
                <button 
                    onClick={handleExport} 
                    className="flex items-center gap-2 bg-white text-green-600 border border-green-500 px-4 py-1.5 rounded-lg hover:bg-green-50 shadow-sm text-sm font-bold transition-all active:scale-95"
                > 
                    <FileSpreadsheet size={16} /> Tải Excel 
                </button>
            </div>
        </div>

        {/* List table */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-0">
            <div className="overflow-auto flex-1">
                <table className="w-full text-left table-fixed min-w-[1550px]">
                    <thead className="bg-[#f8f9fa] border-b border-gray-200 text-xs text-gray-600 uppercase font-bold sticky top-0 shadow-sm z-10">
                        <tr> 
                            <th className="p-4 w-12 text-center align-middle">
                                <input 
                                    type="checkbox" 
                                    checked={toggledAll} 
                                    onChange={handleSelectAll} 
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                />
                            </th>
                            <th className="p-4 w-12 text-center">STT</th> 
                            <th className="p-4 w-[130px]">Mã Hồ Sơ</th> 
                            <th className="p-4 w-[115px]">Trạng Thái</th> 
                            <th className="p-4 w-[180px]">Chủ Sử Dụng</th> 
                            <th className="p-4 w-[150px]">Xã / Phường (Đất)</th> 
                            <th className="p-4 w-[60px] text-center">Tờ</th>
                            <th className="p-4 w-[60px] text-center">Thửa</th>
                            <th className="p-4 w-[120px]">Loại Hồ Sơ</th> 
                            <th className="p-4 text-center w-[110px]">Hẹn Trả</th> 
                            <th className="p-4 w-[140px]">Ghi Chú</th>
                            <th className="p-4 w-[130px] text-center">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {filteredDailyRecords.length > 0 ? (
                            filteredDailyRecords.map((r, index) => (
                                <tr key={r.id} className="hover:bg-blue-50/20 group transition-all">
                                    <td className="p-4 text-center align-middle">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedIds.has(r.id)} 
                                            onChange={() => handleSelectRecord(r.id)} 
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                        />
                                    </td>
                                    <td className="p-4 text-center text-gray-400 align-middle font-medium">{index + 1}</td> 
                                    <td 
                                        className="p-4 font-bold text-blue-600 align-middle cursor-pointer hover:underline text-center" 
                                        title="Nhấp vào để sửa hồ sơ"
                                        onClick={() => onEdit(r)}
                                    >
                                        {r.code}
                                    </td> 
                                    <td className="p-4 align-middle">
                                        {getStatusBadge(r.status, r)}
                                    </td>
                                    <td className="p-4 font-bold text-gray-800 truncate align-middle text-center" title={r.customerName}>
                                        {r.customerName}
                                    </td> 
                                    <td className="p-4 text-gray-700 truncate align-middle" title={getNormalizedWard(r.ward)}>
                                        {getNormalizedWard(r.ward)}
                                    </td>
                                    <td className="p-4 text-center font-semibold text-gray-800 align-middle">{r.mapSheet || '-'}</td>
                                    <td className="p-4 text-center font-semibold text-gray-800 align-middle">{r.landPlot || '-'}</td>
                                    <td className="p-4 text-gray-700 truncate align-middle text-left" title={r.recordType || ''}>
                                        {getShortRecordType(r.recordType)}
                                    </td> 
                                    <td className="p-4 text-center text-blue-600 font-bold align-middle">
                                        {r.deadline ? new Date(r.deadline).toLocaleDateString('vi-VN') : '-'}
                                    </td> 
                                    <td className="p-4 text-gray-500 italic truncate align-middle" title={r.content || ''}>
                                        {r.content || '-'}
                                    </td>
                                    <td className="p-4 align-middle text-center font-semibold">
                                        <div className="flex items-center justify-center gap-1.5">
                                            {(() => {
                                                const rTypeStr = (r.recordType || '').toLowerCase();
                                                const isTrichDoCamMoc = rTypeStr.includes('cắm mốc') || rTypeStr.includes('2.4');
                                                const isTrichDo = (rTypeStr.includes('trích đo') || rTypeStr.includes('2.3')) && 
                                                                  !rTypeStr.includes('tách') && 
                                                                  !rTypeStr.includes('hợp') && 
                                                                  !rTypeStr.includes('lục');
                                                if (onCreateContract && (isTrichDoCamMoc || isTrichDo)) {
                                                    return (
                                                        <button 
                                                            onClick={() => onCreateContract(r)} 
                                                            className="hover:text-amber-700 hover:bg-amber-50 text-amber-600 p-1.5 rounded-md border border-amber-100 hover:border-amber-300 transition-all cursor-pointer" 
                                                            title="Lập hợp đồng"
                                                        >
                                                            <FileSignature size={14} />
                                                        </button>
                                                    );
                                                }
                                                return null;
                                            })()}
                                            <button 
                                                onClick={() => onEdit(r)} 
                                                className="hover:text-indigo-700 hover:bg-indigo-50 text-indigo-600 p-1.5 rounded-md border border-indigo-100 hover:border-indigo-300 transition-all cursor-pointer" 
                                                title="Sửa nội dung hồ sơ đã nhận"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            <button 
                                                onClick={() => onPrint(r)} 
                                                className="hover:text-emerald-700 hover:bg-emerald-50 text-emerald-600 p-1.5 rounded-md border border-emerald-100 hover:border-emerald-300 transition-all cursor-pointer" 
                                                title="In lại biên nhận"
                                            >
                                                <Printer size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : ( 
                            <tr>
                                <td colSpan={12} className="p-12 text-center text-gray-400 italic"> 
                                    Không có hồ sơ nào trong ngày này phù hợp với bộ lọc. 
                                </td>
                            </tr> 
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Assign specialists modal */}
        <AssignModal
            isOpen={isAssignModalOpen}
            onClose={() => setIsAssignModalOpen(false)}
            onConfirm={handleAssignConfirm}
            employees={employees}
            selectedRecords={selectedRecordsForAssign}
            currentUser={currentUser}
        />
    </div>
  );
};

export default DailyList;

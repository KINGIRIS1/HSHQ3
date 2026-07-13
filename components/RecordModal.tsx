
import React, { useState, useEffect } from 'react';
import { RecordFile, RecordStatus, Employee, User, UserRole, Holiday } from '../types';
import { GROUPS, STATUS_LABELS, REGISTRATION_PROCEDURES } from '../constants';
import { isArchiveType, groupEmployeesByDepartment, removeVietnameseTones, getStatusLabel } from '../utils/appHelpers';
import { getEmployeeTeam } from './AssignModal';
import { X, Save, Lock, User as UserIcon, MapPin, FileText, Calendar, FileCheck, Clock } from 'lucide-react';
import RecordForm from './receive-record/RecordForm';

interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (record: Omit<RecordFile, 'id' | 'status'> & { id?: string, status?: RecordStatus }) => void;
  initialData?: RecordFile | null;
  employees: Employee[];
  currentUser: User;
  wards: string[];
  currentView?: string;
  holidays?: Holiday[];
  records?: RecordFile[];
}

const RecordModal: React.FC<RecordModalProps> = ({ isOpen, onClose, onSubmit, initialData, employees, currentUser, wards, currentView, holidays, records }) => {
  const defaultState: Partial<RecordFile> = {
    code: '', customerName: '', phoneNumber: '', cccd: '', customerAddress: '', content: '', otherDocs: '',
    receivedDate: new Date().toISOString(), deadline: '', assignedTo: '',
    group: GROUPS[0], ward: '', landPlot: '', mapSheet: '', area: 0, address: '',
    recordType: '', measurementNumber: '', excerptNumber: '',
    privateNotes: '', authorizedBy: '', authDocType: '', receiptNumber: '', resultReturnedDate: '',
    receiptType: 'receipt', paymentAmount: null, receiverName: ''
  };

  // --- LOCAL HẠN TRẢ CALCULATION IN RECORDMODAL ---
  const getSolarDateFromLunar = (lunarDay: number, lunarMonth: number, year: number): Date | null => {
    if (lunarMonth === 1) { 
        if (year === 2024) return new Date(2024, 1, lunarDay + 9);
        if (year === 2025) return new Date(2025, 0, lunarDay + 28);
        if (year === 2026) return new Date(2026, 1, lunarDay + 16); 
        if (year === 2027) return new Date(2027, 1, lunarDay + 5);
    }
    if (lunarMonth === 3 && lunarDay === 10) { 
        if (year === 2024) return new Date(2024, 3, 18);
        if (year === 2025) return new Date(2025, 3, 7);
        if (year === 2026) return new Date(2026, 3, 26);
        if (year === 2027) return new Date(2027, 3, 16);
    }
    return null;
  };

  const formatDateKey = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const calculateDeadline = (type: string, receivedDateStr: string, hasTax?: boolean) => {
    if (!receivedDateStr) return '';
    let daysToAdd = 30; 
    const lowerType = (type || '').toLowerCase();

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
    
    const holidaySet = new Set<string>();
    const currentYear = startDate.getFullYear();
    const listHolidays = holidays || [];
    
    [currentYear, currentYear + 1].forEach(year => {
        listHolidays.forEach(h => {
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
        const dayOfWeek = currentDate.getDay(); 
        const dateString = formatDateKey(currentDate);
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isHoliday = holidaySet.has(dateString);

        if (!isWeekend && !isHoliday) {
            count++;
        }
    }
    
    return currentDate.toISOString();
  };

  const allowedRecordTypes = React.useMemo(() => {
    // 1. Phân hệ Lưu trữ
    if (currentView && [
        "archive_records", "archive_assign_tasks", "archive_completed_list", 
        "archive_pending_check_list", "archive_check_list", "archive_handover_list", 
        "archive_director_completed"
    ].includes(currentView)) {
        return ['1.1 Cung cấp dữ liệu đất đai', '1.2 Công văn'];
    }

    // 2. Phân hệ Cấp Giấy (Đăng ký)
    if (currentView && [
        "registration_records", "registration_assign_tasks", "registration_completed_list", 
        "registration_pending_check_list", "registration_check_list", "registration_handover_list", 
        "registration_director_completed", "registration_vao_so"
    ].includes(currentView)) {
        return REGISTRATION_PROCEDURES;
    }

    // 3. Phân hệ Đo đạc
    if (currentView && [
        "all_records", "assign_tasks", "completed_list", 
        "pending_check_list", "check_list", "handover_list", 
        "director_completed"
    ].includes(currentView)) {
        return [
          '2.1 Trích lục',
          '2.2 Trích lục Quy hoạch',
          '2.3 Trích đo',
          '2.4 Trích đo Cắm mốc',
          '2.5 Trích đo Tách - Hợp thửa',
          '2.6 Cung cấp số thửa',
          '2.7 Trích lục CMĐ'
        ];
    }

    // 4. Phân hệ Khác
    if (currentView && [
        "other_records", "other_assign_tasks", "other_check_list", 
        "other_handover_list", "other_director_completed"
    ].includes(currentView)) {
        return ['CMD', 'Tòa án', 'Thi hành án'];
    }

    // 5. Mặc định: Hiển thị tất cả ngoại trừ 'CMD', 'Tòa án', 'Thi hành án' và '2.7 Trích lục CMĐ' (không hiện ở tab hồ sơ)
    return [
      '1.1 Cung cấp dữ liệu đất đai',
      '2.1 Trích lục',
      '2.2 Trích lục Quy hoạch',
      '2.3 Trích đo',
      '2.4 Trích đo Cắm mốc',
      '2.5 Trích đo Tách - Hợp thửa',
      '2.6 Cung cấp số thửa',
      ...REGISTRATION_PROCEDURES
    ];
  }, [currentView]);

  const [formData, setFormData] = useState<Partial<RecordFile>>(defaultState);
  const hasAdminRights = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN;
  const canEditTimelineDates = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN || currentUser.role === UserRole.TEAM_LEADER;
  const isOneDoor = React.useMemo(() => {
    if (currentUser.role === UserRole.ONEDOOR) return true;
    if (!currentUser.employeeId || !employees) return false;
    const emp = employees.find(e => e.id === currentUser.employeeId);
    if (!emp) return false;
    const teamName = getEmployeeTeam(emp);
    return teamName === "Tổ Hành chính";
  }, [currentUser, employees]);
  const canEditResult = hasAdminRights || isOneDoor;

  const generateCode = React.useCallback((wardName: string, dateStr: string, recordType?: string) => {
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

      const targetRecords = records || [];
      targetRecords.forEach((r: RecordFile) => checkSeq(r.code));

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

    const targetRecords = records || [];
    targetRecords.forEach((r: RecordFile) => checkSeq(r.code));

    const nextSeq = (maxSeq + 1).toString().padStart(4, '0');
    return `${prefix}${nextSeq}`;
  }, [records]);

  const isMeasurement = React.useMemo(() => {
    return !!(currentView && ['all_records', 'assign_tasks', 'completed_list', 'pending_check_list', 'check_list', 'handover_list', 'director_completed'].includes(currentView));
  }, [currentView]);

  const isRegistrationRecord = React.useMemo(() => {
    const isRegView = currentView && [
      "registration_records", "registration_assign_tasks", "registration_completed_list", 
      "registration_pending_check_list", "registration_check_list", "registration_handover_list", 
      "registration_director_completed", "registration_vao_so"
    ].includes(currentView);

    if (isRegView) return true;

    const type = (formData.recordType || initialData?.recordType || '').toLowerCase().trim();
    if (type.startsWith('3.') || type === 'đăng ký' || type === 'cấp giấy' || type === 'cấp đổi' || type === 'cấp lại' || REGISTRATION_PROCEDURES.some(p => p.toLowerCase() === type)) {
      return true;
    }

    return false;
  }, [currentView, formData.recordType, initialData?.recordType]);

  const isDefaultTaxProcedure = React.useMemo(() => {
    const type = (formData.recordType || initialData?.recordType || '');
    if (!type) return false;
    const t = removeVietnameseTones(type).toLowerCase();
    return ['thua ke', 'tang cho', 'chuyen nhuong', 'thoa thuan', 'chuyen muc dich', 'tach thua', 'hop thua'].some(keyword => t.includes(keyword));
  }, [formData.recordType, initialData?.recordType]);

  useEffect(() => {
    if (isOpen) {
        if (initialData) setFormData(initialData);
        else {
            const initialType = allowedRecordTypes[0] || '';
            const initialDate = new Date().toISOString();
            const initialDeadline = (initialType === '1.2 Công văn') ? '' : (initialType ? calculateDeadline(initialType, initialDate, false) : '');
            
            setFormData({ 
              ...defaultState, 
              code: `HS-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
              recordType: initialType,
              receivedDate: initialDate,
              deadline: initialDeadline,
              hasTax: false,
              transferToDNLis: false
            });
        }
    }
  }, [initialData, isOpen, allowedRecordTypes]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalData = { ...formData };
    
    // Logic tự động set ngày khi trạng thái thay đổi hoặc xóa ngày khi quay lui
    // Chỉ áp dụng logic này nếu trạng thái khác với ban đầu (hoặc là tạo mới)
    // Hoặc user admin ép kiểu
    if (hasAdminRights && finalData.status) {
        const now = new Date().toISOString();
        
        // BACKFILL LOGIC: Nếu thay đổi trạng thái, đảm bảo các ngày của tiến trình trước đó (hoặc trạng thái cũ) 
        // được chốt lại để không bị mất màu trên Timeline do thiếu Date.
        if (initialData?.status && finalData.status !== initialData?.status) {
            const flow = [
                RecordStatus.RECEIVED, RecordStatus.ASSIGNED, RecordStatus.IN_PROGRESS, 
                RecordStatus.COMPLETED_WORK, RecordStatus.PENDING_CHECK, RecordStatus.CHECKED, 
                RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER
            ];
            // Tạm dùng initialData.status để lấp ngày (để đóng băng tiến độ cũ)
            const prevIdx = flow.indexOf(initialData.status);
            if (prevIdx >= 0) {
                if (prevIdx >= flow.indexOf(RecordStatus.ASSIGNED) && !finalData.assignedDate) finalData.assignedDate = now;
                if (prevIdx >= flow.indexOf(RecordStatus.COMPLETED_WORK) && !finalData.completedWorkDate) finalData.completedWorkDate = now;
                if (prevIdx >= flow.indexOf(RecordStatus.PENDING_CHECK) && !finalData.pendingCheckDate) finalData.pendingCheckDate = now;
                if (prevIdx >= flow.indexOf(RecordStatus.CHECKED) && !finalData.checkedDate) finalData.checkedDate = now;
                if (prevIdx >= flow.indexOf(RecordStatus.PENDING_SIGN) && !finalData.submissionDate) finalData.submissionDate = now;
                if (prevIdx >= flow.indexOf(RecordStatus.SIGNED) && !finalData.approvalDate) finalData.approvalDate = now;
            }
            // Auto fill current forward progress as well if going forward
            const newIdx = flow.indexOf(finalData.status);
            if (newIdx >= 0) {
                if (newIdx >= flow.indexOf(RecordStatus.ASSIGNED) && !finalData.assignedDate) finalData.assignedDate = now;
                if (newIdx >= flow.indexOf(RecordStatus.COMPLETED_WORK) && !finalData.completedWorkDate) finalData.completedWorkDate = now;
                if (newIdx >= flow.indexOf(RecordStatus.PENDING_CHECK) && !finalData.pendingCheckDate) finalData.pendingCheckDate = now;
                if (newIdx >= flow.indexOf(RecordStatus.CHECKED) && !finalData.checkedDate) finalData.checkedDate = now;
                if (newIdx >= flow.indexOf(RecordStatus.PENDING_SIGN) && !finalData.submissionDate) finalData.submissionDate = now;
                if (newIdx >= flow.indexOf(RecordStatus.SIGNED) && !finalData.approvalDate) finalData.approvalDate = now;
            }
        }

        // Logic làm sạch dữ liệu cũ khi quay lui trạng thái
        // 1. Nếu quay về RECEIVED (Tiếp nhận) -> Xóa hết các bước sau
        if (finalData.status === RecordStatus.RECEIVED) {
            finalData.assignedDate = undefined;
            finalData.completedWorkDate = undefined;
            finalData.pendingCheckDate = undefined;
            finalData.checkedDate = undefined;
            finalData.submissionDate = undefined;
            finalData.approvalDate = undefined;
            finalData.completedDate = undefined;
            finalData.resultReturnedDate = undefined;
            finalData.exportBatch = undefined;
            finalData.exportDate = undefined;
        } 
        // 2. Nếu quay về ASSIGNED (Đang thực hiện) -> Xóa bước quá trình sau
        else if (finalData.status === RecordStatus.ASSIGNED || finalData.status === RecordStatus.IN_PROGRESS) {
            finalData.completedWorkDate = undefined;
            finalData.pendingCheckDate = undefined;
            finalData.checkedDate = undefined;
            finalData.submissionDate = undefined;
            finalData.approvalDate = undefined;
            finalData.completedDate = undefined;
            finalData.resultReturnedDate = undefined;
            finalData.exportBatch = undefined;
            finalData.exportDate = undefined;
        }
        else if (finalData.status === RecordStatus.COMPLETED_WORK) {
            finalData.pendingCheckDate = undefined;
            finalData.checkedDate = undefined;
            finalData.submissionDate = undefined;
            finalData.approvalDate = undefined;
            finalData.completedDate = undefined;
            finalData.resultReturnedDate = undefined;
        }
        else if (finalData.status === RecordStatus.PENDING_CHECK) {
            finalData.checkedDate = undefined;
            finalData.submissionDate = undefined;
            finalData.approvalDate = undefined;
            finalData.completedDate = undefined;
            finalData.resultReturnedDate = undefined;
        }
        else if (finalData.status === RecordStatus.CHECKED) {
            finalData.submissionDate = undefined;
            finalData.approvalDate = undefined;
            finalData.completedDate = undefined;
            finalData.resultReturnedDate = undefined;
        }
        // 3. Nếu quay về PENDING_SIGN (Chờ ký) -> Xóa bước Xong, Trả
        else if (finalData.status === RecordStatus.PENDING_SIGN) {
            finalData.approvalDate = undefined;
            finalData.completedDate = undefined;
            finalData.resultReturnedDate = undefined;
        }
        // 4. Nếu quay về SIGNED (Đã ký) -> Xóa bước Hoàn thành/Trả
        else if (finalData.status === RecordStatus.SIGNED) {
            finalData.completedDate = undefined;
            finalData.resultReturnedDate = undefined;
        }
    }

    if (finalData.status === RecordStatus.WITHDRAWN && !finalData.completedDate) finalData.completedDate = new Date().toISOString();
    if (finalData.status === RecordStatus.REJECTED) {
        if (!finalData.completedDate) finalData.completedDate = new Date().toISOString();
        if (!finalData.rejectDate) finalData.rejectDate = new Date().toISOString();
    }
    
    if (finalData.resultReturnedDate && finalData.status !== RecordStatus.RETURNED) {
        finalData.status = RecordStatus.RETURNED;
        if (!finalData.completedDate) finalData.completedDate = finalData.resultReturnedDate;
    }
    
    // LOGIC QUAN TRỌNG: Nếu có Đợt xuất hoặc Ngày xuất thì phải là HANDOVER (trừ khi Đã rút, Đã trả hoặc Bị từ chối)
    if ((finalData.exportBatch || finalData.exportDate) && finalData.status !== RecordStatus.WITHDRAWN && finalData.status !== RecordStatus.RETURNED && finalData.status !== RecordStatus.REJECTED) {
        finalData.status = RecordStatus.HANDOVER;
        // Nếu chưa có completedDate, lấy luôn ngày xuất (nếu có) hoặc hôm nay
        if (!finalData.completedDate) {
            finalData.completedDate = finalData.exportDate ? finalData.exportDate : new Date().toISOString();
        }
    }

    // Để đảm bảo gửi null thay vì undefined cho API nếu cần xóa
    const cleanData = JSON.parse(JSON.stringify(finalData));
    if(finalData.status === RecordStatus.RECEIVED) {
        cleanData.assignedDate = null;
        cleanData.submissionDate = null;
        cleanData.approvalDate = null;
        cleanData.completedDate = null;
        cleanData.resultReturnedDate = null;
        cleanData.exportBatch = null;
        cleanData.exportDate = null;
    } else if (finalData.status === RecordStatus.ASSIGNED) {
        cleanData.submissionDate = null;
        cleanData.approvalDate = null;
        cleanData.completedDate = null;
        cleanData.resultReturnedDate = null;
        cleanData.exportBatch = null;
        cleanData.exportDate = null;
    }

    onSubmit(cleanData as any);
    onClose();
  };

  const handleChange = (field: keyof RecordFile, value: any) => {
    setFormData(prev => {
        let finalVal = value;
        const isCongVan = (field === 'recordType' ? value : prev.recordType) === '1.2 Công văn';
        if ((field === 'customerName' || field === 'authorizedBy') && !isCongVan && value) {
            finalVal = String(value).toUpperCase();
        }
        let newData = { ...prev, [field]: finalVal };
        if (field === 'recordType') {
            const isCongVanVal = value === '1.2 Công văn';
            if (!isCongVanVal) {
                if (newData.customerName) newData.customerName = newData.customerName.toUpperCase();
                if (newData.authorizedBy) newData.authorizedBy = newData.authorizedBy.toUpperCase();
            }
            const t = String(value).toLowerCase().trim();
            const isRegVal = t.startsWith('3.') || t === 'đăng ký' || t === 'cấp giấy' || t === 'cấp đổi' || t === 'cấp lại' || REGISTRATION_PROCEDURES.some(p => p.toLowerCase() === t);
            const isDefaultTax = ['thua ke', 'tang cho', 'chuyen nhuong', 'thoa thuan', 'chuyen muc dich', 'tach thua', 'hop thua'].some(keyword => removeVietnameseTones(String(value)).toLowerCase().includes(keyword));
            if (isDefaultTax) {
                newData.hasTax = true;
            } else if (isRegVal) {
                newData.hasTax = false;
            } else {
                newData.hasTax = false;
            }
        }
        if (field === 'hasTax' && !value) {
            newData.transferToDNLis = false;
        }
        if (field === 'recordType' || field === 'receivedDate' || field === 'hasTax' || field === 'transferToDNLis') {
            const rType = newData.recordType;
            const rDate = newData.receivedDate;
            const hTax = newData.hasTax;
            if (rType === '1.2 Công văn') {
                newData.deadline = '';
            } else if (rType && rDate) {
                newData.deadline = calculateDeadline(rType, rDate, hTax);
            }
        }
        return newData;
    });
  };
  const val = (v: any) => v === undefined || v === null ? '' : v;
  const dateVal = (v: any) => { if (!v) return ''; const str = String(v); return str.includes('T') ? str.split('T')[0] : str; };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] p-0 md:p-4 backdrop-blur-sm">
      <div className="bg-white md:rounded-xl shadow-2xl w-full max-w-4xl h-full md:max-h-[95vh] flex flex-col animate-fade-in-up">
        {/* HEADER */}
        <div className="flex justify-between items-center p-4 md:p-5 border-b bg-gray-50 rounded-t-none md:rounded-t-xl shrink-0">
          <h2 className="text-lg md:text-xl font-bold text-gray-800 truncate pr-2 uppercase">
            {isRegistrationRecord ? (initialData ? 'Cập nhật thông tin hồ sơ' : 'Tiếp nhận hồ sơ mới') : (initialData ? 'Cập nhật thông tin hồ sơ' : 'Tiếp nhận hồ sơ mới')}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-gray-200">
            <X size={24} />
          </button>
        </div>
        
        {/* BODY - SCROLLABLE */}
        <div className="overflow-y-auto p-4 md:p-6 flex-1 bg-gray-100">
            {true ? (
                <RecordForm
                    initialData={initialData}
                    onSave={async (record) => {
                        await onSubmit(record);
                        onClose();
                        return record;
                    }}
                    wards={wards}
                    records={records || []}
                    holidays={holidays || []}
                    calculateDeadline={calculateDeadline}
                    generateCode={generateCode}
                    currentUser={currentUser}
                    employees={employees}
                    currentView={currentView}
                    isInModal={true}
                />
            ) : (
                <div id="record-form"></div>
            )}
            {false && (
                <form id="record-form" onSubmit={handleSubmit} className="space-y-6">
                {/* 1. THÔNG TIN CHUNG */}
                <div className="bg-white p-4 md:p-5 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2 border-b pb-2"><Calendar size={16} /> Thông tin chung</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        {formData.recordType !== '1.2 Công văn' && (
                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-gray-700 mb-1">Mã hồ sơ <span className="text-red-500">*</span></label>
                                <input type="text" required className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 font-bold text-blue-700" value={val(formData.code)} onChange={(e) => handleChange('code', e.target.value)} />
                            </div>
                        )}
                        <div className={formData.recordType === '1.2 Công văn' ? "md:col-span-4" : (isRegistrationRecord && !isDefaultTaxProcedure ? "md:col-span-2" : "md:col-span-3")}>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Loại hồ sơ</label>
                            <select className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white" value={val(formData.recordType)} onChange={(e) => handleChange('recordType', e.target.value)}>
                                <option value="">-- Chọn loại hồ sơ --</option>
                                {allowedRecordTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        {isRegistrationRecord && !isDefaultTaxProcedure && (
                            <div className="md:col-span-1 flex items-center h-10 pb-0.5">
                                <label className="flex items-center gap-2.5 text-sm font-bold text-amber-900 cursor-pointer bg-amber-50/50 hover:bg-amber-100/50 border border-amber-200/60 px-3 py-2 rounded-md w-full justify-center transition-all">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 text-amber-600 border-amber-300 rounded focus:ring-amber-500 cursor-pointer"
                                        checked={!!formData.hasTax}
                                        onChange={(e) => handleChange('hasTax', e.target.checked)}
                                    />
                                    Hồ sơ có thuế
                                </label>
                            </div>
                        )}
                        {hasAdminRights && (
                            <>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Ngày nhận</label><input type="date" required className="w-full border border-gray-300 rounded-md px-3 py-2" value={dateVal(formData.receivedDate)} onChange={(e) => handleChange('receivedDate', e.target.value)} /></div>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Hẹn trả {formData.recordType !== '1.2 Công văn' && <span className="text-red-500">*</span>}</label><input type="date" required={formData.recordType !== '1.2 Công văn'} className={`w-full border rounded-md px-3 py-2 font-semibold ${formData.recordType === '1.2 Công văn' ? 'border-gray-300 bg-white text-gray-700' : 'border-red-300 bg-red-50 text-red-600'}`} value={dateVal(formData.deadline)} onChange={(e) => handleChange('deadline', e.target.value)} /></div>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Ngày giao NV</label><input type="date" className="w-full border border-gray-300 rounded-md px-3 py-2" value={dateVal(formData.assignedDate)} onChange={(e) => handleChange('assignedDate', e.target.value)} /></div>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Trạng thái</label><select className="w-full border border-gray-300 rounded-md px-3 py-2 bg-yellow-50 font-medium" value={val(formData.status)} onChange={(e) => handleChange('status', e.target.value)}>{Object.values(RecordStatus).filter(s => {
                                    const isArchive = isArchiveType(formData.recordType);
                                    if (isArchive) {
                                        return s !== RecordStatus.PENDING_CHECK && s !== RecordStatus.CHECKED;
                                    }
                                    if (!isRegistrationRecord) {
                                        return s !== RecordStatus.TBT && s !== RecordStatus.PENDING_SUPPLEMENT;
                                    }
                                    return true;
                                }).map(s => <option key={s} value={s}>{getStatusLabel(s, isRegistrationRecord ? 'đăng ký' : null)}</option>)}</select></div>
                                
                                {(formData.status === RecordStatus.HANDOVER || formData.status === RecordStatus.WITHDRAWN || formData.status === RecordStatus.RETURNED || formData.status === RecordStatus.REJECTED || formData.exportBatch) && (
                                    <div><label className="block text-xs font-bold text-green-700 mb-1">{formData.status === RecordStatus.WITHDRAWN ? 'Ngày rút hồ sơ' : formData.status === RecordStatus.REJECTED ? 'Ngày trả hồ sơ' : 'Ngày hoàn thành'}</label><input type="date" className="w-full border border-green-300 rounded-md px-3 py-2 bg-green-50 font-semibold text-green-800" value={dateVal(formData.completedDate)} onChange={(e) => handleChange('completedDate', e.target.value)} /></div>
                                )}
                                
                                {formData.status === RecordStatus.REJECTED && (
                                    <div className="col-span-full">
                                        <label className="block text-xs font-bold text-red-700 mb-1">Lý do trả hồ sơ <span className="text-red-500">*</span></label>
                                        <textarea 
                                            required
                                            className="w-full border border-red-300 rounded-md px-3 py-2 bg-red-50 font-medium text-red-950 placeholder-red-400" 
                                            rows={2}
                                            placeholder="Nhập lý do trả hồ sơ chi tiết..."
                                            value={val(formData.rejectReason)} 
                                            onChange={(e) => handleChange('rejectReason', e.target.value)} 
                                        />
                                    </div>
                                )}
                                
                                {(formData.status === RecordStatus.SIGNED || formData.status === RecordStatus.HANDOVER || formData.status === RecordStatus.REJECTED || formData.status === RecordStatus.WITHDRAWN || !!formData.approvalDate) && (
                                    <div><label className="block text-xs font-bold text-indigo-700 mb-1">Ngày ký duyệt</label><input type="date" className="w-full border border-indigo-300 rounded-md px-3 py-2 bg-indigo-50 text-indigo-800" value={dateVal(formData.approvalDate)} onChange={(e) => handleChange('approvalDate', e.target.value)} /></div>
                                )}
                            </>
                        )}
                        {!hasAdminRights && <div className="col-span-full p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700 italic text-center">* Ngày nhận, Hạn trả và Trạng thái chỉ Admin/Subadmin được sửa. Riêng các ngày Tiến trình thì Tổ trưởng cũng có quyền chỉnh sửa.</div>}

                        {/* Tiến trình thời gian (Luôn hiển thị rỏ) */}
                        <div className="col-span-full border-t border-dashed border-gray-200 pt-4 mt-2">
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-1.5">
                                <Clock size={12} className="text-gray-400" /> Tiến trình thời gian
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Ngày trình kiểm tra</label>
                                    <input 
                                        type="date" 
                                        disabled={!canEditTimelineDates}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 font-medium bg-white" 
                                        value={dateVal(formData.pendingCheckDate)} 
                                        onChange={(e) => handleChange('pendingCheckDate', e.target.value || null)} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-purple-700 mb-1">Ngày trình ký</label>
                                    <input 
                                        type="date" 
                                        disabled={!canEditTimelineDates}
                                        className="w-full border border-purple-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 bg-purple-50 font-semibold text-purple-800" 
                                        value={dateVal(formData.submissionDate)} 
                                        onChange={(e) => handleChange('submissionDate', e.target.value || null)} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-green-700 mb-1">Ngày giao một cửa</label>
                                    <input 
                                        type="date" 
                                        disabled={!canEditTimelineDates}
                                        className="w-full border border-green-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 bg-green-50 font-semibold text-green-800" 
                                        value={dateVal(formData.completedDate)} 
                                        onChange={(e) => handleChange('completedDate', e.target.value || null)} 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. THÔNG TIN NGƯỜI NỘP HỒ SƠ */}
                <div className="bg-white p-4 md:p-5 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2 border-b pb-2">
                        <UserIcon size={16} /> {formData.recordType === '1.2 Công văn' ? 'THÔNG TIN CÔNG VĂN' : 'THÔNG TIN NGƯỜI NỘP HỒ SƠ'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-700 mb-1">
                                {formData.recordType === '1.2 Công văn' ? 'Số công văn - Đơn vị phát hành' : 'Họ và tên người nộp'} <span className="text-red-500">*</span>
                            </label>
                            <input 
                                type="text" 
                                required 
                                className="w-full border border-gray-300 rounded-md px-3 py-2 font-medium" 
                                placeholder={formData.recordType === '1.2 Công văn' ? 'Số công văn - Đơn vị phát hành...' : 'Họ và tên...'}
                                value={val(formData.customerName)} 
                                onChange={(e) => handleChange('customerName', e.target.value)} 
                            />
                        </div>
                        <div><label className="block text-xs font-bold text-gray-700 mb-1">SĐT người nộp</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" value={val(formData.phoneNumber)} onChange={(e) => handleChange('phoneNumber', e.target.value)} /></div>
                        <div><label className="block text-xs font-bold text-gray-700 mb-1">CCCD/Số Giấy</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" value={val(formData.cccd)} onChange={(e) => handleChange('cccd', e.target.value)} /></div>
                        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50 p-2 rounded border border-gray-200">
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase">Người được ủy quyền</label><input type="text" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" value={val(formData.authorizedBy)} onChange={(e) => handleChange('authorizedBy', e.target.value)} placeholder="Họ tên..." /></div>
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase">Loại giấy tờ</label><select className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white" value={val(formData.authDocType)} onChange={(e) => handleChange('authDocType', e.target.value)}><option value="">-- Chọn giấy tờ --</option><option value="Hợp đồng ủy quyền">Hợp đồng ủy quyền</option><option value="Giấy ủy quyền">Giấy ủy quyền</option><option value="Văn bản ủy quyền">Văn bản ủy quyền</option></select></div>
                        </div>
                    </div>
                </div>

                {/* 3. THÔNG TIN THỬA ĐẤT */}
                <div className="bg-white p-4 md:p-5 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2 border-b pb-2"><MapPin size={16} /> THÔNG TIN THỬA ĐẤT</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Hàng 1: phường/xã, Số thứ tự thửa, tờ bản đồ thành 1 hàng */}
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Phường/xã {formData.recordType !== '1.2 Công văn' && <span className="text-red-500">*</span>}</label>
                            <select 
                                required={formData.recordType !== '1.2 Công văn'}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white" 
                                value={val(formData.ward)} 
                                onChange={(e) => {
                                    const w = e.target.value;
                                    handleChange('ward', w);
                                }}
                            >
                                <option value="">-- Chọn Phường/Xã --</option>
                                {wards.map(w => <option key={w} value={w}>{w}</option>)}
                            </select>
                        </div>
                        <div><label className="block text-xs font-bold text-gray-700 mb-1">Số thứ tự thửa {formData.recordType !== '1.2 Công văn' && <span className="text-red-500">*</span>}</label><input type="text" required={formData.recordType !== '1.2 Công văn'} className="w-full border border-gray-300 rounded-md px-3 py-2 text-center font-mono" value={val(formData.landPlot)} onChange={(e) => handleChange('landPlot', e.target.value)} /></div>
                        <div><label className="block text-xs font-bold text-gray-700 mb-1">Tờ bản đồ {formData.recordType !== '1.2 Công văn' && <span className="text-red-500">*</span>}</label><input type="text" required={formData.recordType !== '1.2 Công văn'} className="w-full border border-gray-300 rounded-md px-3 py-2 text-center font-mono" value={val(formData.mapSheet)} onChange={(e) => handleChange('mapSheet', e.target.value)} /></div>

                        {/* Hàng 2: Số vào sổ, số GCN, ngày cấp / hoặc diện tích */}
                        <div><label className="block text-xs font-bold text-gray-700 mb-1">Số vào sổ</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2 text-center font-mono" value={val(formData.entryNumber)} onChange={(e) => handleChange('entryNumber', e.target.value)} /></div>
                        <div><label className="block text-xs font-bold text-gray-700 mb-1">Số GCN</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2 text-center font-mono" value={val(formData.issueNumber)} onChange={(e) => handleChange('issueNumber', e.target.value)} /></div>
                        <div><label className="block text-xs font-bold text-gray-700 mb-1">Ngày cấp GCN</label><input type="date" className="w-full border border-gray-300 rounded-md px-3 py-2" value={formData.issueDate ? String(formData.issueDate).split('T')[0] : ''} onChange={(e) => handleChange('issueDate', e.target.value)} /></div>
                        
                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-gray-700 mb-1">Diện tích (m²)</label>
                            <input type="number" className="w-full border border-gray-300 rounded-md px-3 py-2 text-right font-medium" value={formData.area || 0} onChange={(e) => handleChange('area', parseFloat(e.target.value))} />
                        </div>
                    </div>
                </div>

                {/* 4. NỘI DUNG & KỸ THUẬT */}
                <div className="bg-white p-4 md:p-5 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2 border-b pb-2"><FileText size={16} /> Nội dung & Kỹ thuật</h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    {formData.recordType === '1.2 Công văn' ? 'Trích yếu' : 'Nội dung yêu cầu'}{formData.recordType === '1.2 Công văn' && <span className="text-red-500"> *</span>}
                                </label>
                                <textarea 
                                    rows={3} 
                                    required={formData.recordType === '1.2 Công văn'}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2" 
                                    placeholder={formData.recordType === '1.2 Công văn' ? 'Nhập trích yếu...' : 'Nội dung...'}
                                    value={val(formData.content)} 
                                    onChange={(e) => handleChange('content', e.target.value)} 
                                />
                            </div>
                            <div><label className="block text-xs font-bold text-gray-700 mb-1">Giấy tờ kèm theo</label><textarea rows={3} className="w-full border border-gray-300 rounded-md px-3 py-2" value={val(formData.otherDocs)} onChange={(e) => handleChange('otherDocs', e.target.value)} placeholder="GCN QSDĐ, CMND, Hộ khẩu..." /></div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 bg-gray-50 p-3 rounded border border-gray-200">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Giao nhân viên xử lý</label>
                                <select 
                                    disabled={currentUser?.role === UserRole.ONEDOOR}
                                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm cursor-pointer bg-white disabled:bg-gray-100 disabled:text-gray-500" 
                                    value={val(formData.assignedTo)} 
                                    onChange={(e) => handleChange('assignedTo', e.target.value)}
                                >
                                    <option value="">-- Chưa giao --</option>
                                    {groupEmployeesByDepartment(employees).map(group => (
                                        <optgroup key={group.key} label={group.label} className="font-bold text-blue-700 bg-blue-50">
                                            {group.employees.map(emp => (
                                                <option key={emp.id} value={emp.id} className="text-gray-800 font-normal bg-white">
                                                    {emp.name} ({emp.position || 'Nhân viên'})
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>
                        </div>
                        {/* QUAN TRỌNG: Hiển thị thông tin xuất đợt */}
                        {(hasAdminRights || currentUser?.role === UserRole.ONEDOOR) && (
                            <div className="grid grid-cols-2 gap-4 bg-indigo-50 p-3 rounded border border-indigo-200">
                                <div>
                                    <label className="block text-[10px] font-bold text-indigo-500 uppercase mb-1">Đợt xuất (Batch)</label>
                                    <input 
                                        type="number" 
                                        disabled={currentUser?.role === UserRole.ONEDOOR}
                                        className="w-full border border-indigo-200 rounded-md px-2 py-1.5 text-sm disabled:bg-indigo-100/50 disabled:text-gray-500 bg-white" 
                                        value={val(formData.exportBatch)} 
                                        onChange={(e) => handleChange('exportBatch', parseInt(e.target.value))} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-indigo-500 uppercase mb-1">Ngày xuất</label>
                                    <input 
                                        type="date" 
                                        disabled={currentUser?.role === UserRole.ONEDOOR}
                                        className="w-full border border-indigo-200 rounded-md px-2 py-1.5 text-sm disabled:bg-indigo-100/50 disabled:text-gray-500 bg-white" 
                                        value={formData.exportDate ? String(formData.exportDate).split('T')[0] : ''} 
                                        onChange={(e) => handleChange('exportDate', new Date(e.target.value).toISOString())} 
                                    />
                                </div>
                            </div>
                        )}
                        
                        {canEditResult && (
                            <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200 space-y-3">
                                <h4 className="text-sm font-bold text-emerald-800 flex items-center gap-2 mb-1">
                                    <FileCheck size={16} /> TRẢ KẾT QUẢ CHO DÂN
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-emerald-700 mb-1">Ngày trả kết quả</label>
                                        <input 
                                            type="date" 
                                            disabled={currentUser?.role === UserRole.ONEDOOR}
                                            className="w-full border border-emerald-300 rounded-md px-3 py-2 bg-white font-bold text-emerald-800 text-sm disabled:bg-emerald-100/50 disabled:text-gray-500" 
                                            value={dateVal(formData.resultReturnedDate)} 
                                            onChange={(e) => handleChange('resultReturnedDate', e.target.value)} 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-emerald-700 mb-1">Số Biên lai/ Hóa đơn</label>
                                        <input 
                                            type="text" 
                                            disabled={currentUser?.role === UserRole.ONEDOOR}
                                            className="w-full border border-emerald-300 rounded-md px-3 py-2 bg-white text-sm disabled:bg-emerald-100/50 disabled:text-gray-500" 
                                            value={val(formData.receiptNumber)} 
                                            onChange={(e) => handleChange('receiptNumber', e.target.value)} 
                                            placeholder="Nhập số biên lai/ hóa đơn..." 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-emerald-700 mb-1">Số tiền (VNĐ)</label>
                                        <input 
                                            type="text" 
                                            disabled={currentUser?.role === UserRole.ONEDOOR}
                                            className="w-full border border-emerald-300 rounded-md px-3 py-2 font-mono bg-white text-sm font-bold text-right disabled:bg-emerald-100/50 disabled:text-gray-500" 
                                            value={typeof formData.paymentAmount === 'number' ? (formData.paymentAmount as number).toLocaleString('vi-VN') : ''} 
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/[^0-9]/g, '');
                                                handleChange('paymentAmount', val ? parseInt(val, 10) : null);
                                            }} 
                                            placeholder="Nhập số tiền..." 
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                            <div className="flex items-center gap-2 mb-1"><Lock size={14} className="text-yellow-600" /><label className="text-xs font-bold text-yellow-800 uppercase">Ghi chú nội bộ</label></div>
                            <textarea 
                                rows={2} 
                                disabled={currentUser?.role === UserRole.ONEDOOR}
                                className="w-full border border-yellow-300 rounded-md px-3 py-2 bg-white text-sm disabled:bg-yellow-100/50 disabled:text-gray-500" 
                                value={val(formData.privateNotes)} 
                                onChange={(e) => handleChange('privateNotes', e.target.value)} 
                                placeholder="Nhập ghi chú nội bộ..." 
                            />
                        </div>
                    </div>
                </div>
            </form>
            )}
        </div>

        {/* FOOTER */}
        <div className="p-4 md:p-5 border-t bg-gray-50 flex justify-end gap-3 shrink-0 rounded-b-none md:rounded-b-xl sticky bottom-0 z-10">
            <button type="button" onClick={onClose} className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-200 font-medium transition-colors text-sm">Hủy bỏ</button>
            <button type="submit" form="record-form" className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md font-bold transition-transform active:scale-95 text-sm select-none">
                <Save size={18} /> {initialData ? 'CẬP NHẬT' : (currentView === 'receive_record' ? (isRegistrationRecord ? 'LƯU & IN BIÊN NHẬN' : 'LƯU & IN HỒ SƠ') : 'LƯU')}
            </button>
        </div>
      </div>
    </div>
  );
};

export default RecordModal;

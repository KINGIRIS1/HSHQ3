
import React, { useState, useEffect } from 'react';
import { RecordFile, Employee, User, UserRole, SplitItem, RecordStatus, Holiday } from '../types';
import { getNormalizedWard, REGISTRATION_PROCEDURES } from '../constants';
import StatusBadge from './StatusBadge';
import { X, MapPin, FileText, User as UserIcon, Receipt, DollarSign, CheckCircle2, Circle, Send, FileSignature, CheckSquare, CalendarClock, Clock, FileCheck, Calculator, Loader2, StickyNote, Save, Bell, Printer, Pencil, Trash2, Info, FileDown, AlertTriangle, Activity, ArrowRight, RotateCcw, Lock, Gavel } from 'lucide-react';
import { generateDocxBlobAsync, hasTemplate, STORAGE_KEYS } from '../services/docxService';
import DocxPreviewModal from './DocxPreviewModal';
import { updateRecordApi as rawUpdateRecordApi, fetchContracts } from '../services/api';
import { calculateDeadline, isDefaultTaxProcedure, isRegType, getGcnWorkflowStepsHelper, isArchiveType, isMeasurementType, groupEmployeesByDepartment, isStepHiddenForWorkflow, recordStepAssigneeHistory } from '../utils/appHelpers';
import { getEmployeeTeam } from './AssignModal';
import SystemReceiptTemplate from './receive-record/SystemReceiptTemplate';
import SystemAnnexTemplate from './receive-record/SystemAnnexTemplate';
import CungCapThongTinTab from './utilities/CungCapThongTinTab';
import VPHCTab from './utilities/VPHCTab';

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: RecordFile | null;
  employees: Employee[];
  users: User[];
  currentUser: User | null;
  holidays?: Holiday[];
  onEdit?: (record: RecordFile) => void;
  onDelete?: (record: RecordFile) => void;
  onCreateLiquidation?: (record: RecordFile) => void; 
  onDraftMinutes?: (record: RecordFile) => void;
  onRefreshData?: () => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({ isOpen, onClose, record: initialRecord, employees, users, currentUser, holidays, onEdit, onDelete, onCreateLiquidation, onDraftMinutes, onRefreshData }) => {
  const [localRecord, setLocalRecord] = useState<RecordFile | null>(null);

  const updateRecordApi = async (r: RecordFile) => {
    const withHistory = recordStepAssigneeHistory(r, holidays || []);
    return rawUpdateRecordApi(withHistory);
  };
  const [isDefectDialogOpen, setIsDefectDialogOpen] = useState(false);
  const [defectReasonInput, setDefectReasonInput] = useState('');
  const [isSavingDefect, setIsSavingDefect] = useState(false);
  
  // States for citizen supplement (Chờ bổ sung - Người dân)
  const [isSupplementDialogOpen, setIsSupplementDialogOpen] = useState(false);
  const [supplementReasonInput, setSupplementReasonInput] = useState('');
  const [supplementLegalBasisInput, setSupplementLegalBasisInput] = useState('');
  const [isSavingSupplement, setIsSavingSupplement] = useState(false);

  const [isResumeDialogOpen, setIsResumeDialogOpen] = useState(false);
  const [resumeMode, setResumeMode] = useState<'supplement' | 'simple'>('supplement');
  const [isSavingResume, setIsSavingResume] = useState(false);

  const [taxPaymentDateInput, setTaxPaymentDateInput] = useState('');
  const [isSavingTaxPayment, setIsSavingTaxPayment] = useState(false);

  const [isInfoProvisionOpen, setIsInfoProvisionOpen] = useState(false);
  const [isVphcOpen, setIsVphcOpen] = useState(false);

  useEffect(() => {
    setLocalRecord(initialRecord);
    if (initialRecord) {
      setTaxPaymentDateInput(initialRecord.taxPaymentDate ? initialRecord.taxPaymentDate.split('T')[0] : '');
    }
  }, [initialRecord]);

  const activeRecord = localRecord || initialRecord;
  const record = activeRecord;

  const isGCN = !!(record?.recordType && isRegType(record.recordType));
  const isLuuTru = !!(record?.recordType && isArchiveType(record.recordType));
  const isDoDac = !!(record?.recordType && isMeasurementType(record.recordType));

  const isTrichDo = !!(record?.recordType && (
      record.recordType.trim().startsWith('2.3') ||
      record.recordType.trim().startsWith('2.4')
  ));

  const isTachThua = !!(record?.recordType && (
      record.recordType.toLowerCase().includes('tách thửa') ||
      record.recordType.toLowerCase().includes('tách - hợp') ||
      record.recordType.trim().startsWith('3.8')
  ));

  const isMeasurementOrSubdivision = isTrichDo || isTachThua;

  const showLiquidationAndAnnex = !isGCN && isTrichDo;

  const isTLQH = !!(record?.recordType && (
      record.recordType.trim().startsWith('2.2') || 
      record.recordType.toLowerCase().includes('trích lục quy hoạch')
  ));

  const findPersonNameAndTitle = (idOrNameOrUsername: string | undefined | null): string => {
      if (!idOrNameOrUsername) return "";
      const query = idOrNameOrUsername.trim().toLowerCase();
      
      let foundEmp = employees.find(e => e.id.toLowerCase() === query || e.name.toLowerCase() === query);
      
      if (!foundEmp) {
          const foundUser = users.find(u => 
              (u.username && u.username.toLowerCase() === query) || 
              (u.employeeId && u.employeeId.toLowerCase() === query)
          );
          if (foundUser && foundUser.employeeId) {
              foundEmp = employees.find(e => e.id.toLowerCase() === foundUser.employeeId?.toLowerCase());
          }
          if (foundUser && !foundEmp) {
              const userRoleLabel = foundUser.role === UserRole.ADMIN ? 'Quản trị viên' : 
                                    foundUser.role === UserRole.SUBADMIN ? 'Phó quản trị' : 
                                    foundUser.role === UserRole.TEAM_LEADER ? 'Tổ trưởng/Tổ phó' : 
                                    foundUser.role === UserRole.ONEDOOR ? 'Cán bộ Một cửa' : 'Cán bộ xử lý';
              return userRoleLabel ? `${foundUser.name} (${userRoleLabel})` : foundUser.name;
          }
      }
      
      if (foundEmp) {
          return foundEmp.position ? `${foundEmp.name} (${foundEmp.position})` : foundEmp.name;
      }
      
      return idOrNameOrUsername;
  };

   const getStepAssigneeName = (stepLabel: string, stepStatus?: 'completed' | 'current' | 'upcoming') => {
       if (!record) return "";
       if (stepStatus === 'upcoming') return "";
       const label = stepLabel.toLowerCase().trim();
       
       const savedAssigneeId = record.stepAssignees?.[label];
       
       let assignedEmp = record.assignedTo ? employees.find(e => e.id === record.assignedTo) : null;
       let checkerEmp = record.checkedBy ? employees.find(e => e.id === record.checkedBy) : null;
       let submittedToId = record.submittedTo;


       if (savedAssigneeId) {
           if (label.includes("thẩm tra") || label.includes("kiểm tra")) {
               const matched = employees.find(e => e.id === savedAssigneeId) || users.find(u => u.employeeId === savedAssigneeId);
               if (matched) checkerEmp = matched as any;
           } else if (label.includes("trình ký") || label.includes("ký duyệt")) {
               submittedToId = savedAssigneeId;
           } else {
               const matched = employees.find(e => e.id === savedAssigneeId) || users.find(u => u.employeeId === savedAssigneeId);
               if (matched) assignedEmp = matched as any;
           }
       }

       const assignedName = assignedEmp ? findPersonNameAndTitle(assignedEmp.id) : "";
       const checkerName = checkerEmp ? findPersonNameAndTitle(checkerEmp.id) : "";
       const directorName = submittedToId ? findPersonNameAndTitle(submittedToId) : "";
       
       // Fallback for receiver
       let receiverName = record.receivedBy ? findPersonNameAndTitle(record.receivedBy) : "Cán bộ Một cửa";

       if (label.includes("nhận hồ sơ")) {
           return receiverName || "";
       }
       if (label.includes("ranh") || label.includes("dnlis")) {
           return assignedName || "";
       }
       if (label.includes("mộc kê") || label.includes("mộc")) {
           return assignedName || "";
       }
       if (label.includes("thế chấp")) {
           return assignedName || "";
       }
       if (label.includes("niêm yết") || label.includes("công văn") || label.includes("xác minh")) {
           return assignedName || "";
       }
       if (label.includes("phiếu chuyển thuế") || label.includes("phiếu chuyển")) {
           return assignedName || "";
       }
       if (label.includes("trình ký thuế")) {
           return assignedName || "";
       }
       if (label.includes("tbt")) {
           return assignedName || "";
       }
       if (label.includes("in gcn") || label.includes("in giấy")) {
           return assignedName || "";
       }
       if (label.includes("thẩm tra") || label.includes("kiểm tra")) {
           return checkerName || "";
       }
       if (label.includes("trình ký") || label.includes("trình ký gcn") || label.includes("trình ký giấy")) {
           return directorName || "";
       }
       if (label.includes("ký duyệt")) {
           return directorName || "";
       }
       if (label.includes("vô số")) {
           return assignedName || "";
       }
       if (label.includes("giao 1 cửa") || label.includes("giao một cửa") || label.includes("trả kết quả")) {
           if (assignedEmp) {
               return `${assignedEmp.name} (${assignedEmp.position || 'Nhân viên'})`;
           }
           return assignedName || "";
       }
       
       return assignedName || "";
   };

  const getStepDateTimeString = (s: any, execDate: string | null | undefined) => {
      const dateToUse = s.status === 'completed' 
          ? (execDate ? new Date(execDate) : null) 
          : (s.deadlineDate ? new Date(s.deadlineDate) : null);
      if (!dateToUse || isNaN(dateToUse.getTime())) {
          return s.duration ? `(${s.duration})` : "";
      }
      const formatted = formatDate(dateToUse.toISOString());
      if (formatted === '---') {
          return s.duration ? `(${s.duration})` : "";
      }
      return s.duration ? `${formatted}-(${s.duration})` : formatted;
  };

  const getOverdueDurationStr = (deadlineDate: Date) => {
      const diffMs = Date.now() - deadlineDate.getTime();
      if (diffMs <= 0) return "";
      const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
      const days = Math.floor(totalHours / 24);
      const hours = totalHours % 24;
      if (days > 0) {
          return `Trễ hạn: ${days} ngày ${hours} giờ`;
      }
      return `Trễ hạn: ${hours} giờ`;
  };

  const getExecutionDate = (stepLabel: string, stepStatus: RecordStatus) => {
      if (!record) return null;
      const label = stepLabel.toLowerCase();
      
      let date: string | null | undefined = null;
      if (label.includes("ranh") || label.includes("dnlis")) {
          date = record.assignedDate;
      } else if (label.includes("mộc kê") || label.includes("mộc")) {
          date = record.assignedDate;
      } else if (label.includes("kiểm tra thế chấp") || label.includes("thế chấp")) {
          date = record.assignedDate;
      } else if (label.includes("niêm yết") || label.includes("công văn") || label.includes("xác minh")) {
          date = record.assignedDate;
      } else if (label.includes("phiếu chuyển thuế") || label.includes("phiếu chuyển")) {
          date = record.completedWorkDate;
      } else if (label.includes("trình ký thuế")) {
          date = record.completedWorkDate;
      } else if (label.includes("tbt")) {
          date = record.taxPaymentDate;
      } else if (label.includes("in gcn") || label.includes("in giấy")) {
          date = record.pendingCheckDate;
      } else if (label.includes("thẩm tra")) {
          date = record.checkedDate;
      } else if (label.includes("trình ký gcn") || label.includes("trình ký giấy") || (label.includes("trình ký") && !label.includes("thuế"))) {
          date = record.submissionDate;
      } else if (label.includes("vô số")) {
          date = record.approvalDate;
      } else if (label.includes("giao 1 cửa") || label.includes("giao một cửa") || label.includes("trả kết quả")) {
          date = record.resultReturnedDate;
      }
      
      if (!date) {
          if (stepStatus === RecordStatus.IN_PROGRESS) date = record.assignedDate;
          else if (stepStatus === RecordStatus.COMPLETED_WORK) date = record.completedWorkDate;
          else if (stepStatus === RecordStatus.PENDING_CHECK) date = record.pendingCheckDate;
          else if (stepStatus === RecordStatus.CHECKED) date = record.checkedDate;
          else if (stepStatus === RecordStatus.PENDING_SIGN) date = record.submissionDate;
          else if (stepStatus === RecordStatus.SIGNED) date = record.approvalDate;
          else if (stepStatus === RecordStatus.HANDOVER) date = record.completedDate;
          else if (stepStatus === RecordStatus.RETURNED) date = record.resultReturnedDate;
      }

      if (date) return date;

      // Chronological fallback logic: if this step is active or completed, we interpolate a date
      const statusOrder = [
          RecordStatus.RECEIVED,
          RecordStatus.ASSIGNED,
          RecordStatus.IN_PROGRESS,
          RecordStatus.COMPLETED_WORK,
          RecordStatus.PENDING_CHECK,
          RecordStatus.CHECKED,
          RecordStatus.PENDING_SIGN,
          RecordStatus.SIGNED,
          RecordStatus.HANDOVER,
          RecordStatus.RETURNED
      ];
      
      const recordStatusIdx = statusOrder.indexOf(record.status);
      const stepStatusIdx = statusOrder.indexOf(stepStatus);
      
      const isStepActive = stepStatusIdx !== -1 && recordStatusIdx !== -1 && stepStatusIdx <= recordStatusIdx;

      if (!isStepActive) return null;

      // Interpolate from other available dates
      const actualDates: { [key: string]: string | null | undefined } = {
          [RecordStatus.RECEIVED]: record.receivedDate,
          [RecordStatus.ASSIGNED]: record.assignedDate,
          [RecordStatus.IN_PROGRESS]: record.assignedDate,
          [RecordStatus.COMPLETED_WORK]: record.completedWorkDate,
          [RecordStatus.PENDING_CHECK]: record.pendingCheckDate,
          [RecordStatus.CHECKED]: record.checkedDate,
          [RecordStatus.PENDING_SIGN]: record.submissionDate,
          [RecordStatus.SIGNED]: record.approvalDate,
          [RecordStatus.HANDOVER]: record.completedDate,
          [RecordStatus.RETURNED]: record.resultReturnedDate
      };

      if (stepStatusIdx !== -1) {
          for (let i = stepStatusIdx + 1; i < statusOrder.length; i++) {
              if (actualDates[statusOrder[i]]) return actualDates[statusOrder[i]];
          }
          for (let i = stepStatusIdx - 1; i >= 0; i--) {
              if (actualDates[statusOrder[i]]) return actualDates[statusOrder[i]];
          }
      }

      return record.assignedDate || record.receivedDate;
  };

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [systemReceiptData, setSystemReceiptData] = useState<Partial<RecordFile> | null>(null);
  
  // State cho Ghi chú cá nhân
  const [personalNote, setPersonalNote] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // State cho Ghi chú nội bộ / Ghi chú hồ sơ
  const [privateNote, setPrivateNote] = useState('');
  const [isSavingPrivateNote, setIsSavingPrivateNote] = useState(false);

  // State cho Cập nhật thông tin hồ sơ
  const [measurementNumber, setMeasurementNumber] = useState('');
  const [excerptNumber, setExcerptNumber] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [exportBatch, setExportBatch] = useState('');
  const [exportDate, setExportDate] = useState('');
  const [resultReturnedDate, setResultReturnedDate] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isSavingRecordInfo, setIsSavingRecordInfo] = useState(false);

  // State cho Nhắc nhở
  const [reminderDate, setReminderDate] = useState('');
  const [isSavingReminder, setIsSavingReminder] = useState(false);

  // State cho giá hợp đồng
  const [contractPrice, setContractPrice] = useState<number | null>(null);
  const [contractSplitItems, setContractSplitItems] = useState<SplitItem[] | null>(null);
  
  // State cho Thanh lý
  const [liquidationInfo, setLiquidationInfo] = useState<{ amount: number, content: string } | null>(null);

  const [isAnnexOpen, setIsAnnexOpen] = useState(false);

  const isMeasurementTeam = React.useMemo(() => {
      if (!currentUser?.employeeId) return false;
      const emp = employees.find(e => e.id === currentUser.employeeId);
      if (!emp) return false;
      return emp.department?.toLowerCase().includes('đo đạc') || emp.department?.toLowerCase().includes('kỹ thuật') || emp.position?.toLowerCase().includes('đo đạc');
  }, [currentUser, employees]);

  const getWorkflowSteps = () => {
    if (!record) return null;

    const isReturned = record.hasDefect || record.status === RecordStatus.REJECTED;

    if (isReturned) {
        const currentStatus = record.status;
        const s0 = 'completed';
        
        let s1: 'completed' | 'current' | 'upcoming' = 'upcoming';
        if ([RecordStatus.PENDING_CHECK].includes(currentStatus)) s1 = 'current';
        else if ([RecordStatus.CHECKED, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED].includes(currentStatus)) s1 = 'completed';

        let s2: 'completed' | 'current' | 'upcoming' = 'upcoming';
        if ([RecordStatus.CHECKED, RecordStatus.PENDING_SIGN].includes(currentStatus)) s2 = 'current';
        else if ([RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED].includes(currentStatus)) s2 = 'completed';

        let s3: 'completed' | 'current' | 'upcoming' = 'upcoming';
        if ([RecordStatus.SIGNED].includes(currentStatus)) s3 = 'current';
        else if ([RecordStatus.HANDOVER, RecordStatus.RETURNED].includes(currentStatus)) s3 = 'completed';

        return {
            type: 'returned',
            title: 'Quy trình Trả hồ sơ do sai sót',
            steps: [
                { label: 'Trả Hồ sơ', duration: 'Bắt đầu', status: s0, desc: 'Phát hiện sai sót' },
                { label: 'Trình kiểm tra', duration: 'Kiểm tra hồ sơ', status: s1, desc: 'Chờ/Đang kiểm tra' },
                { label: 'Ký Phiếu trả', duration: 'Ký duyệt', status: s2, desc: 'Lãnh đạo ký phiếu trả' },
                { label: 'Giao 1 cửa', duration: 'Bàn giao', status: s3, desc: 'Trả kết quả về 1 cửa' }
            ]
        };
    }

    if (isGCN) {
        return null;
    }

    return null;
  };

  useEffect(() => {
      if (record) {
          setPersonalNote(record.personalNotes || '');
          setPrivateNote(record.privateNotes || '');
          setMeasurementNumber(record.measurementNumber || '');
          setExcerptNumber(record.excerptNumber || '');
          setAssignedTo(record.assignedTo || '');
          setExportBatch(record.exportBatch ? String(record.exportBatch) : '');
          setExportDate(record.exportDate ? record.exportDate.split('T')[0] : '');
          setResultReturnedDate(record.resultReturnedDate ? record.resultReturnedDate.split('T')[0] : '');
          setReceiptNumber(record.receiptNumber || '');
          setPaymentAmount(record.paymentAmount !== null && record.paymentAmount !== undefined ? String(record.paymentAmount) : '');
          // Chuyển ISO string sang format datetime-local (yyyy-MM-ddTHH:mm) để hiển thị trong input
          if (record.reminderDate) {
              const d = new Date(record.reminderDate);
              const localIso = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
              setReminderDate(localIso);
          } else {
              setReminderDate('');
          }

          // Fetch Contract Price & Details
          const fetchPrice = async () => {
              const contracts = await fetchContracts();
              // Tìm hợp đồng có cùng mã hồ sơ (Ưu tiên c.recordCode, dự phòng c.code)
              const match = contracts.find(c => {
                  const cRecordCode = (c.recordCode || '').trim().toLowerCase();
                  const cCode = (c.code || '').trim().toLowerCase();
                  const rCode = (record.code || '').trim().toLowerCase();
                  return (cRecordCode === rCode || cCode === rCode);
              });
              
              if (match) {
                  // GIÁ TRỊ HỢP ĐỒNG (Lấy từ totalAmount - giá trị lúc lập hợp đồng)
                  setContractPrice(match.totalAmount ?? null);
                  setContractSplitItems(match.splitItems || null);

                  // GIÁ TRỊ THANH LÝ (Lấy từ liquidationAmount - nếu đã nhập)
                  if (match.liquidationAmount !== null && match.liquidationAmount !== undefined) {
                      
                      let liquidationLabel = 'Thanh lý hợp đồng';
                      const cType = (match.contractType || '').toLowerCase();
                      const sType = (match.serviceType || '').toLowerCase();

                      if (cType.includes('trích lục') || sType.includes('trích lục')) {
                          liquidationLabel = 'Thanh lý trích lục';
                      } else if (cType.includes('cắm mốc') || sType.includes('cắm mốc')) {
                          liquidationLabel = 'Thanh lý cắm mốc';
                      } else if (cType.includes('tách thửa') || sType.includes('tách thửa')) {
                          liquidationLabel = 'Thanh lý tách thửa';
                      } else if (cType.includes('đo đạc') || sType.includes('đo đạc')) {
                          liquidationLabel = 'Thanh lý đo đạc';
                      }

                      setLiquidationInfo({
                          amount: match.liquidationAmount, 
                          content: liquidationLabel
                      });
                  } else {
                      setLiquidationInfo(null);
                  }

              } else {
                  // Fallback: Nếu không có hợp đồng nhưng là hồ sơ Trích lục -> Hiển thị 53.163
                  const type = (record.recordType || '').toLowerCase();
                  if (type.includes('trích lục')) {
                      setContractPrice(53163);
                  } else {
                      setContractPrice(null);
                  }
                  setContractSplitItems(null);
                  setLiquidationInfo(null);
              }
          };
          fetchPrice();
      }
  }, [record]);

  const isOneDoor = React.useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.ONEDOOR) return true;
    if (!currentUser.employeeId || !employees) return false;
    const emp = employees.find(e => e.id === currentUser.employeeId);
    if (!emp) return false;
    const teamName = getEmployeeTeam(emp);
    return teamName === "Tổ Hành chính";
  }, [currentUser, employees]);

  const canLiquidate = React.useMemo(() => {
      if (!record || !currentUser) return false;
      const isAdminOrSub = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN;
      const isOneDoorRole = currentUser.role === UserRole.ONEDOOR || isOneDoor;
      const isAssignedSpecialist = record.assignedTo === currentUser.employeeId && isTrichDo;
      return isAdminOrSub || isOneDoorRole || isAssignedSpecialist;
  }, [currentUser, record, isOneDoor, isTrichDo]);

  if (!isOpen || !record) return null;

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isSubadmin = currentUser?.role === UserRole.SUBADMIN;

  const canPerformAction = isAdmin || isSubadmin || isOneDoor;
  const isOneDoorAndSynced = currentUser?.role === UserRole.ONEDOOR && (record.isDeptSynced === true || record.status !== RecordStatus.RECEIVED);
  const canEditRecord = canPerformAction && !isOneDoorAndSynced;

  const canPrintReceipt = isAdmin || isOneDoor;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '---';
    const date = new Date(dateStr);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    
    if (dateStr.includes('T')) {
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${h}:${min} - ${d}/${m}/${y}`;
    }
    return `${d}/${m}/${y}`;
  };

  const getEmployeeName = (id?: string | null) => {
    if (!id) return 'Chưa giao';
    const emp = employees.find(e => e.id === id);
    return emp ? `${emp.name} (${emp.department})` : 'Không xác định';
  };

  const handleSavePersonalNote = async () => {
      setIsSavingNote(true);
      if (!activeRecord) return;
      const updatedRecord = { ...activeRecord, personalNotes: personalNote };
      const result = await updateRecordApi(updatedRecord);
      setIsSavingNote(false);
      
      if (result) {
          setLocalRecord(updatedRecord);
          alert('Đã lưu ghi chú cá nhân thành công!');
          onRefreshData?.();
      } else {
          alert('Lỗi khi lưu ghi chú.');
      }
  };

  const handleSavePrivateNote = async () => {
      setIsSavingPrivateNote(true);
      if (!activeRecord) return;
      const updatedRecord = { ...activeRecord, privateNotes: privateNote };
      const result = await updateRecordApi(updatedRecord);
      setIsSavingPrivateNote(false);
      
      if (result) {
          setLocalRecord(updatedRecord);
          alert('Đã lưu ghi chú hồ sơ thành công!');
          onRefreshData?.();
      } else {
          alert('Lỗi khi lưu ghi chú hồ sơ.');
      }
  };

  const handleSaveReminder = async () => {
      setIsSavingReminder(true);
      if (!activeRecord) return;
      
      // Nếu user xóa trắng input -> xóa nhắc nhở
      const newReminderDate = reminderDate ? new Date(reminderDate).toISOString() : null;
      
      // Reset lastRemindedAt khi đặt lịch mới để hệ thống nhắc lại từ đầu
      const updatedRecord = { 
          ...activeRecord, 
          reminderDate: newReminderDate as string, 
          lastRemindedAt: null as any 
      };
      
      const result = await updateRecordApi(updatedRecord);
      setIsSavingReminder(false);
      
      if (result) {
          setLocalRecord(updatedRecord);
          alert('Đã lưu lịch nhắc nhở!');
          onRefreshData?.();
      } else {
          alert('Lỗi khi lưu nhắc nhở.');
      }
  };

  const handleSaveRecordInfo = async () => {
      setIsSavingRecordInfo(true);
      if (!activeRecord) return;
      
      const batchVal = exportBatch && !isNaN(parseInt(exportBatch, 10)) ? parseInt(exportBatch, 10) : null;
      const paymentVal = paymentAmount && !isNaN(parseInt(paymentAmount.replace(/[^0-9]/g, ''), 10))
          ? parseInt(paymentAmount.replace(/[^0-9]/g, ''), 10)
          : null;
      
      const updatedRecord = { 
          ...activeRecord, 
          measurementNumber: measurementNumber || null,
          excerptNumber: excerptNumber || null,
          assignedTo: assignedTo || null,
          exportBatch: batchVal,
          exportDate: exportDate || null,
          resultReturnedDate: resultReturnedDate || null,
          receiptNumber: receiptNumber || null,
          privateNotes: privateNote || null,
          paymentAmount: paymentVal,
      };
      
      const result = await updateRecordApi(updatedRecord);
      setIsSavingRecordInfo(false);
      
      if (result) {
          setLocalRecord(updatedRecord);
          alert('Cập nhật thông tin hồ sơ thành công!');
          onRefreshData?.();
      } else {
          alert('Lỗi khi cập nhật thông tin hồ sơ.');
      }
  };

  const handleConfirmDefect = async () => {
      if (!activeRecord) return;
      setIsSavingDefect(true);
      const nowStr = new Date().toISOString();
      const formattedReason = `[Sai sót - Trả hồ sơ ngày ${new Date().toLocaleDateString('vi-VN')}]: ${defectReasonInput}`;
      const currentNotes = activeRecord.notes ? `${activeRecord.notes}\n${formattedReason}` : formattedReason;
      const currentPrivateNotes = activeRecord.privateNotes ? `${activeRecord.privateNotes}\n${formattedReason}` : formattedReason;
      
      const isReg = isGCN;
      const isArchive = !!(activeRecord.recordType && isArchiveType(activeRecord.recordType));
      
      let nextStatus = RecordStatus.IN_PROGRESS;
      const trackingUpdates: Partial<RecordFile> = {};
      
      if (isArchive) {
          // Gán lại cho chuyên viên thực hiện đối với hồ sơ lưu trữ
          nextStatus = 'assigned' as any;
      }
      
      const updatedRecord: RecordFile = {
          ...activeRecord,
          status: nextStatus,
          hasDefect: isReg,
          defectReason: defectReasonInput,
          defectDate: nowStr,
          notes: currentNotes,
          privateNotes: currentPrivateNotes
      };
      
      try {
          const result = await updateRecordApi(updatedRecord);
          setIsSavingDefect(false);
          setIsDefectDialogOpen(false);
          if (result) {
              setLocalRecord(updatedRecord);
              alert('Đã đánh dấu hồ sơ có sai sót thành công!');
              onRefreshData?.();
          } else {
              alert('Không thể lưu thông tin sai sót.');
          }
      } catch (err) {
          console.error(err);
          setIsSavingDefect(false);
          alert('Có lỗi xảy ra.');
      }
  };

  const handleToggleDefect = async () => {
      if (!activeRecord) return;
      
      if (activeRecord.hasDefect || activeRecord.status === RecordStatus.PENDING_SUPPLEMENT) {
          // Open the re-receive option dialog instead of a simple confirm
          setResumeMode('supplement');
          setIsResumeDialogOpen(true);
      } else {
          setDefectReasonInput('');
          setIsDefectDialogOpen(true);
      }
  };

  const handleConfirmSupplement = async () => {
      if (!activeRecord || !supplementReasonInput.trim()) return;
      setIsSavingSupplement(true);

      const today = new Date();
      const todayStr = today.toLocaleDateString('vi-VN');
      const todayISO = today.toISOString();

      const updatedRecord: RecordFile = {
          ...activeRecord,
          preSupplementStatus: activeRecord.status,
          preSupplementStepIndex: activeRecord.currentStepIndex !== undefined ? activeRecord.currentStepIndex : 0,
          status: RecordStatus.PENDING_SUPPLEMENT,
          defectReason: supplementReasonInput, // Đồng bộ lý do vào defectReason cho tương thích
          supplementReason: supplementReasonInput,
          supplementLegalBasis: supplementLegalBasisInput || null,
          supplementDate: todayISO,
          notes: activeRecord.notes 
              ? `${activeRecord.notes}\n[Trả HS Chờ bổ sung - Ngày ${todayStr}]: ${supplementReasonInput}` 
              : `[Trả HS Chờ bổ sung - Ngày ${todayStr}]: ${supplementReasonInput}`
      };

      try {
          const result = await updateRecordApi(updatedRecord);
          setIsSavingSupplement(false);
          setIsSupplementDialogOpen(false);
          setSupplementReasonInput('');
          setSupplementLegalBasisInput('');
          if (result) {
              setLocalRecord(updatedRecord);
              alert('Đã chuyển trạng thái hồ sơ thành Chờ dân bổ sung thành công!');
              onRefreshData?.();
          } else {
              alert('Không thể cập nhật trạng thái hồ sơ.');
          }
      } catch (err) {
          console.error(err);
          setIsSavingSupplement(false);
          alert('Có lỗi xảy ra.');
      }
  };

  const handleConfirmResume = async () => {
      if (!activeRecord) return;
      setIsSavingResume(true);

      let updatedRecord: RecordFile = { ...activeRecord };
      const today = new Date();
      const todayStr = today.toLocaleDateString('vi-VN');
      const todayISO = today.toISOString();

      // Khôi phục trạng thái và bước chi tiết trước khi bị trả chờ bổ sung
      const restoredStatus = activeRecord.preSupplementStatus || RecordStatus.IN_PROGRESS;
      const restoredStepIndex = activeRecord.preSupplementStepIndex !== undefined && activeRecord.preSupplementStepIndex !== null 
          ? activeRecord.preSupplementStepIndex 
          : activeRecord.currentStepIndex;

      if (resumeMode === 'supplement') {
          // Re-calculate deadline and set receivedDate to today for recalculating date from scratch
          const newDeadline = calculateDeadline(activeRecord.recordType || '', todayISO, holidays || [], !!activeRecord.hasTax);
          
          updatedRecord = {
              ...activeRecord,
              status: restoredStatus,
              currentStepIndex: restoredStepIndex,
              preSupplementStatus: null,
              preSupplementStepIndex: null,
              hasDefect: false,
              defectReason: null,
              receivedDate: todayISO,
              deadline: newDeadline,
              notes: activeRecord.notes 
                  ? `${activeRecord.notes}\n[Bổ sung HS - Tiếp nhận lại ngày ${todayStr}]: Quay lại bước trước khi trả, tính lại ngày hẹn trả (${newDeadline}) từ đầu` 
                  : `[Bổ sung HS - Tiếp nhận lại ngày ${todayStr}]: Quay lại bước trước khi trả, tính lại ngày hẹn trả (${newDeadline}) từ đầu`
          };
      } else {
          // Simple resume without changing receivedDate and deadline
          updatedRecord = {
              ...activeRecord,
              status: restoredStatus,
              currentStepIndex: restoredStepIndex,
              preSupplementStatus: null,
              preSupplementStepIndex: null,
              hasDefect: false,
              defectReason: null,
              notes: activeRecord.notes 
                  ? `${activeRecord.notes}\n[Tiếp nhận lại ngày ${todayStr}]: Hủy trạng thái Chờ bổ sung, giữ nguyên hạn trả gốc` 
                  : `[Tiếp nhận lại ngày ${todayStr}]: Hủy trạng thái Chờ bổ sung, giữ nguyên hạn trả gốc`
          };
      }

      try {
          const result = await updateRecordApi(updatedRecord);
          setIsSavingResume(false);
          setIsResumeDialogOpen(false);
          if (result) {
              setLocalRecord(updatedRecord);
              alert(resumeMode === 'supplement' ? 'Đã tiếp nhận lại hồ sơ bổ sung và tính lại ngày thành công!' : 'Đã hủy trạng thái sai sót hồ sơ.');
              onRefreshData?.();
          } else {
              alert('Không thể lưu thông tin hồ sơ.');
          }
      } catch (err) {
          console.error(err);
          setIsSavingResume(false);
          alert('Có lỗi xảy ra.');
      }
  };

  const handleConfirmTaxPayment = async () => {
      if (!record || !taxPaymentDateInput) return;
      setIsSavingTaxPayment(true);

      const updatedTaxPaymentDate = new Date(taxPaymentDateInput).toISOString();
      const tempRecord = { ...record, taxPaymentDate: updatedTaxPaymentDate };
      const updatedWorkflow = getGcnWorkflowStepsHelper(tempRecord, holidays || []);
      
      const tbtStepIdx = updatedWorkflow.steps.findIndex(
          step => step.label.toLowerCase() === 'tbt' || step.label.includes('TBT')
      );
      
      const nextStepIdx = tbtStepIdx !== -1 ? tbtStepIdx + 1 : (record.currentStepIndex !== undefined && record.currentStepIndex !== null ? record.currentStepIndex + 1 : 0);
      const nextStep = updatedWorkflow.steps[nextStepIdx];
      const nextStatus = nextStep ? nextStep.overallStatus : RecordStatus.PENDING_CHECK;
      
      const finalStep = updatedWorkflow.steps[updatedWorkflow.steps.length - 1];
      const newDeadline = finalStep && finalStep.deadlineDate ? finalStep.deadlineDate.toISOString() : record.deadline;

      const todayStr = new Date().toLocaleDateString('vi-VN');
      const taxPaymentDateFormatted = new Date(taxPaymentDateInput).toLocaleDateString('vi-VN');
      const newDeadlineFormatted = newDeadline ? new Date(newDeadline).toLocaleDateString('vi-VN') : '---';

      const stepAssignees = { ...(record.stepAssignees || {}) };
      if (currentUser?.employeeId) {
          stepAssignees["chờ thông báo thuế (tbt)"] = currentUser.employeeId;
          stepAssignees["tbt"] = currentUser.employeeId;
      }

      const updatedRecord: RecordFile = {
          ...record,
          taxPaymentDate: updatedTaxPaymentDate,
          status: RecordStatus.RECEIVED,
          assignedTo: null,
          currentStepIndex: nextStepIdx,
          deadline: newDeadline,
          stepAssignees,
          notes: record.notes 
              ? `${record.notes}\n[Chuyển về ngày ${todayStr}]: Xác nhận hồ sơ chuyển về ngày ${taxPaymentDateFormatted}, chuyển sang bước Chờ giao cho Tổ trưởng phân công người in sổ. Hẹn ngày trả kết quả mới là ${newDeadlineFormatted}` 
              : `[Chuyển về ngày ${todayStr}]: Xác nhận hồ sơ chuyển về ngày ${taxPaymentDateFormatted}, chuyển sang bước Chờ giao cho Tổ trưởng phân công người in sổ. Hẹn ngày trả kết quả mới là ${newDeadlineFormatted}`
      };

      try {
          const result = await updateRecordApi(updatedRecord);
          setIsSavingTaxPayment(false);
          if (result) {
              setLocalRecord(updatedRecord);
              alert(`Đã cập nhật ngày chuyển về, chuyển trạng thái sang Chờ giao cho Tổ trưởng phân công người in sổ và hẹn ngày trả kết quả mới là ${newDeadlineFormatted} thành công!`);
              onRefreshData?.();
          } else {
              alert('Không thể lưu thông tin chuyển về.');
          }
      } catch (err) {
          console.error(err);
          setIsSavingTaxPayment(false);
          alert('Có lỗi xảy ra.');
      }
  };

  const handlePrintReceipt = async () => {
    if (!currentUser) return;
    
    if (!hasTemplate(STORAGE_KEYS.RECEIPT_TEMPLATE)) {
        setSystemReceiptData(record);
        return;
    }

    setIsProcessing(true);

    const rDate = record.receivedDate ? new Date(record.receivedDate) : new Date();
    const dDate = record.deadline ? new Date(record.deadline) : new Date();
    
    let standardDays = "30"; 
    const type = (record.recordType || '').toLowerCase();

    // Logic tính số ngày
    if (type.includes('trích lục')) {
        standardDays = "10";
    } else if (type.includes('trích đo chỉnh lý')) {
        standardDays = "15"; 
    } else if (type.includes('trích đo') || type.includes('đo đạc') || type.includes('cắm mốc')) {
        standardDays = "30";
    }

    // Logic Tiêu đề phiếu
    let tp1Value = 'Phiếu yêu cầu';
    if (type.includes('chỉnh lý') || type.includes('trích đo') || type.includes('trích lục')) {
        tp1Value = 'Phiếu yêu cầu trích lục, trích đo';
    } 
    else if (type.includes('đo đạc') || type.includes('cắm mốc')) {
        tp1Value = 'Phiếu yêu cầu Đo đạc, cắm mốc';
    }
    if (record.ward) {
        tp1Value += ` tại ${getNormalizedWard(record.ward)}`;
    }
    
    // Logic SĐT Liên hệ tự động
    let sdtLienHe = "";
    const wRaw = (record.ward || "").toLowerCase();
    if (wRaw.includes("minh hưng") || wRaw.includes("minh hung")) {
        sdtLienHe = "Nhân viên phụ trách Nguyễn Thìn Trung: 0886 385 757";
    } else if (wRaw.includes("nha bích") || wRaw.includes("nha bich")) {
        sdtLienHe = "Nhân viên phụ trách Lê Văn Hạnh: 0919 334 344";
    } else if (wRaw.includes("chơn thành") || wRaw.includes("chon thanh")) {
        sdtLienHe = "Nhân viên phụ trách Phạm Hoài Sơn: 0972 219 691";
    }

    const day = rDate.getDate().toString().padStart(2, '0');
    const month = (rDate.getMonth() + 1).toString().padStart(2, '0');
    const year = rDate.getFullYear();
    const dateFullString = `ngày ${day} tháng ${month} năm ${year}`;
    const dateShortString = `${day}/${month}/${year}`;
    
    const dayDead = dDate.getDate().toString().padStart(2, '0');
    const monthDead = (dDate.getMonth() + 1).toString().padStart(2, '0');
    const yearDead = dDate.getFullYear();
    const deadlineFullString = `ngày ${dayDead} tháng ${monthDead} năm ${yearDead}`;
    const deadlineShortString = `${dayDead}/${monthDead}/${yearDead}`;

    const val = (v: any) => (v === undefined || v === null) ? "" : String(v);

    const printData = {
        // --- ENGLISH RAW KEYS (Requested) ---
        code: val(record.code),
        customerName: val(record.customerName),
        landPlot: val(record.landPlot),
        mapSheet: val(record.mapSheet),
        
        // --- VIETNAMESE KEYS (Formatted per request) ---
        XAPHUONG: val(getNormalizedWard(record.ward)),
        
        // NGAYNHAN: ngày tháng năm
        NGAYNHAN: dateFullString,
        
        // NGAY_NHAN: dd/mm/yyyy
        NGAY_NHAN: dateShortString, 
        
        LOAI_GIAY_TO_UY_QUYEN: val(record.authDocType),
        DIA_CHI_CHI_TIET: val(record.address),

        // --- NHÓM THÔNG TIN CƠ BẢN ---
        MA: val(record.code), 
        SO_HS: val(record.code), 
        MA_HO_SO: val(record.code),
        CODE: val(record.code),

        // --- NHÓM CHỦ SỬ DỤNG ---
        TEN: val(record.customerName).toUpperCase(), 
        HO_TEN: val(record.customerName).toUpperCase(),
        CHU_SU_DUNG: val(record.customerName).toUpperCase(),
        KHACH_HANG: val(record.customerName).toUpperCase(),
        ONG_BA: val(record.customerName).toUpperCase(),

        // --- NHÓM LIÊN HỆ ---
        SDT: val(record.phoneNumber), 
        DIEN_THOAI: val(record.phoneNumber),
        PHONE: val(record.phoneNumber),
        CCCD: val(record.cccd), 
        CMND: val(record.cccd),
        DIA_CHI_CHU_SU_DUNG: val(record.customerAddress),

        // --- NHÓM ĐỊA CHỈ ---
        DIA_CHI: val(record.address || getNormalizedWard(record.ward)),
        DC: val(record.address || getNormalizedWard(record.ward)),
        ADDRESS: val(record.address || getNormalizedWard(record.ward)),
        XA: val(getNormalizedWard(record.ward)), 
        PHUONG: val(getNormalizedWard(record.ward)),
        WARD: val(getNormalizedWard(record.ward)),
        
        // --- NHÓM THỬA ĐẤT ---
        TO: val(record.mapSheet), 
        SO_TO: val(record.mapSheet),
        THUA: val(record.landPlot), 
        SO_THUA: val(record.landPlot),
        DT: val(record.area), 
        DIEN_TICH: val(record.area),
        
        // --- NHÓM NGÀY THÁNG (ALIASES) ---
        NGAY_NHAN_FULL: dateFullString,
        NGAY: day, 
        THANG: month, 
        NAM: year,
        RECEIVED_DATE: dateShortString,
        
        HEN_TRA: deadlineShortString, 
        NGAY_HEN: deadlineShortString,
        DEADLINE: deadlineShortString,
           NGUOI_UY_QUYEN: val(record.authorizedBy).toUpperCase(),
        UY_QUYEN: val(record.authorizedBy).toUpperCase(),
        LOAI_UY_QUYEN: val(record.authDocType),
        
        // --- CẤU HÌNH ---
        TGTRA: standardDays, 
        SO_NGAY: standardDays,
        TP1: tp1Value, 
        TIEU_DE: tp1Value,
        SDTLH: sdtLienHe, 
        TINH: "Bình Phước", 
        HUYEN: "huyện Hớn Quản"
    };

    const blob = await generateDocxBlobAsync(STORAGE_KEYS.RECEIPT_TEMPLATE, printData);
    
    setIsProcessing(false);

    if (blob) {
        setPreviewBlob(blob);
        setPreviewFileName(`BienNhan_${record.code}`);
        setIsPreviewOpen(true);
    }
  };

  // Helper cho Timeline
  // Updated: Hỗ trợ forceActive cho các bước không có ngày tháng cụ thể
  const TimelineItem = ({ date, label, icon: Icon, isLast, colorClass, forceActive, subText }: any) => {
      const isActive = !!date || !!forceActive;
      const isRejected = label === 'HỒ SƠ TRẢ';
      
      return (
          <div className="relative flex gap-4">
              <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 bg-white ${isActive ? colorClass.border : 'border-gray-200'}`}>
                      {isActive ? (
                          isRejected ? (
                              <Icon size={16} className={`${colorClass.text} animate-pulse`} />
                          ) : (
                              <CheckCircle2 size={16} className={colorClass.text} />
                          )
                      ) : <Circle size={16} className="text-gray-300" />}
                  </div>
                  {!isLast && <div className={`w-0.5 grow ${isActive ? colorClass.bg : 'bg-gray-100'} my-1`}></div>}
              </div>
              <div className="pb-6">
                  <p className={`text-xs font-bold uppercase mb-0.5 ${isActive ? colorClass.text : 'text-gray-400'}`}>{label}</p>
                  <div className="flex items-center gap-2">
                      <Icon size={14} className={isActive ? (isRejected ? 'text-red-500' : 'text-gray-500') : 'text-gray-300'} />
                      <span className={`text-sm font-medium ${isActive ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                          {date ? formatDate(date) : (forceActive ? 'Đã hoàn tất' : 'Chưa thực hiện')}
                      </span>
                  </div>
                  {subText && (
                      <p className={`text-[11px] mt-1 italic ${isRejected ? 'text-red-600 font-semibold' : 'text-indigo-600'}`}>
                          {subText}
                      </p>
                  )}
              </div>
          </div>
      );
  };

  // LOGIC HIỂN THỊ STATUS
  const getDisplayStatus = (r: RecordFile) => {
      if ((r.hasDefect || r.status === RecordStatus.REJECTED) && r.status !== RecordStatus.RETURNED && r.status !== RecordStatus.WITHDRAWN && r.status !== RecordStatus.HANDOVER) {
          return RecordStatus.REJECTED;
      }
      if ((r.exportBatch || r.exportDate) && r.status !== RecordStatus.WITHDRAWN && r.status !== RecordStatus.RETURNED) {
          return RecordStatus.HANDOVER;
      }
      return r.status;
  };
  const displayStatus = getDisplayStatus(record);

  // LOGIC CHECK NẾU ĐÃ THỰC HIỆN XONG (Để hiển thị bước "Đã thực hiện")
  const isWorkDone = [
      RecordStatus.COMPLETED_WORK, RecordStatus.PENDING_CHECK, RecordStatus.CHECKED, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(record.status) || !!record.completedWorkDate;
  
  const isPendingCheckActive = [
      RecordStatus.PENDING_CHECK, RecordStatus.CHECKED, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(record.status) || !!record.pendingCheckDate;

  const isCheckedActive = [
      RecordStatus.CHECKED, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(record.status) || !!record.checkedDate;

  const isPendingSignActive = [
      RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(record.status) || !!record.submissionDate;

  const isSignedActive = [
      RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(record.status) || !!record.approvalDate;

  const isCompletedActive = [
      RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(record.status) || !!record.completedDate || !!record.exportBatch;

  const canEditRecordInfo = !!(
      currentUser?.role === UserRole.ADMIN || 
      currentUser?.role === UserRole.SUBADMIN || 
      currentUser?.role === UserRole.TEAM_LEADER || 
      record.assignedTo === currentUser?.employeeId
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col animate-fade-in-up">
        
        {/* HEADER */}
        <div className="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-4">
                <span className="bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded text-sm border border-blue-200">
                    {record.code}
                </span>
                <h2 className="text-lg font-bold text-gray-800 uppercase">{record.recordType}</h2>
                <StatusBadge status={displayStatus} recordType={record.recordType} record={record} employees={employees} />
            </div>
            
            <div className="flex items-center gap-2">
                {onCreateLiquidation && record && showLiquidationAndAnnex && canLiquidate && (
                    <button
                        onClick={() => { onClose(); onCreateLiquidation(record); }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded hover:bg-green-100 transition-all text-sm font-bold shadow-sm"
                        title="Thanh lý HĐ"
                    >
                        <FileCheck size={16} /> Thanh lý HĐ
                    </button>
                )}

                {onDraftMinutes && record && isMeasurementOrSubdivision && (
                    <button
                        onClick={() => { onClose(); onDraftMinutes(record); }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded hover:bg-blue-100 transition-all text-sm font-bold shadow-sm"
                        title="Soạn Biên Bản"
                    >
                        <Pencil size={16} /> Soạn Biên Bản
                    </button>
                )}

                {isMeasurementTeam && record && record.recordType !== 'Cung cấp tài liệu đất đai' && record.recordType !== 'Sao lục' && record.recordType !== 'Công văn' && showLiquidationAndAnnex && (
                    <button
                        onClick={() => setIsAnnexOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 rounded hover:bg-rose-100 transition-all text-sm font-bold shadow-sm"
                        title="In phụ lục hợp đồng"
                    >
                        <FileDown size={16} /> Phụ lục HĐ
                    </button>
                )}

                {isTLQH && (
                    <button
                        onClick={() => setIsInfoProvisionOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 text-purple-700 rounded hover:bg-purple-100 transition-all text-sm font-bold shadow-sm animate-fade-in"
                        title="Phiếu cung cấp thông tin"
                    >
                        <FileText size={16} /> Phiếu CC thông tin
                    </button>
                )}



                {canPrintReceipt && (
                    <button 
                        onClick={handlePrintReceipt}
                        disabled={isProcessing}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-blue-200 text-blue-600 rounded hover:bg-blue-50 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                        {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                        In biên nhận
                    </button>
                )}

                {canEditRecord && onEdit && (
                    <button onClick={() => { onClose(); onEdit(record); }} className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                        <Pencil size={20} />
                    </button>
                )}
                
                {canPerformAction && onDelete && (currentUser?.role === 'ADMIN' || currentUser?.role === 'SUBADMIN') && (
                    <button onClick={() => { onClose(); onDelete(record); }} className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 size={20} />
                    </button>
                )}

                <div className="w-px h-6 bg-gray-300 mx-2"></div>

                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <X size={24} />
                </button>
            </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6">
            {record.hasDefect && (
                <div id="defect-banner-alert" className="mb-6 bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex items-start gap-3 shadow-sm animate-fade-in">
                    <AlertTriangle className="text-red-500 shrink-0 mt-0.5 animate-pulse" size={18} />
                    <div>
                        <h4 className="text-sm font-bold text-red-900 uppercase">Hồ sơ đã được đánh giá có sai sót - Trình trả dân</h4>
                        <p className="text-xs text-red-700 mt-1 leading-relaxed">
                            <span className="font-bold">Lý do trả hồ sơ / sai sót chi tiết:</span>{" "}
                            {record.defectReason || "Chưa ghi cụ thể lý do."}
                        </p>
                        <p className="text-[11px] text-red-600 font-semibold mt-1">
                            * Quy trình xử lý (kiểm tra, trình ký, chuyển 1 cửa) vẫn tiếp tục được ghi nhận bình thường.
                        </p>
                    </div>
                </div>
            )}

            {(() => {
                const workflow = getWorkflowSteps();
                if (!workflow) return null;

                const getExecutionDate = (stepLabel: string, stepStatus: RecordStatus) => {
                    if (!record) return null;
                    const label = stepLabel.toLowerCase();
                    
                    let date: string | null | undefined = null;
                    if (label.includes("ranh") || label.includes("dnlis")) {
                        date = record.assignedDate;
                    } else if (label.includes("mộc kê") || label.includes("mộc")) {
                        date = record.assignedDate;
                    } else if (label.includes("kiểm tra thế chấp") || label.includes("thế chấp")) {
                        date = record.assignedDate;
                    } else if (label.includes("niêm yết") || label.includes("công văn") || label.includes("xác minh")) {
                        date = record.assignedDate;
                    } else if (label.includes("phiếu chuyển thuế") || label.includes("phiếu chuyển")) {
                        date = record.completedWorkDate;
                    } else if (label.includes("trình ký thuế")) {
                        date = record.completedWorkDate;
                    } else if (label.includes("tbt")) {
                        date = record.taxPaymentDate;
                    } else if (label.includes("in gcn") || label.includes("in giấy")) {
                        date = record.pendingCheckDate;
                    } else if (label.includes("thẩm tra")) {
                        date = record.checkedDate;
                    } else if (label.includes("trình ký gcn") || label.includes("trình ký giấy") || (label.includes("trình ký") && !label.includes("thuế"))) {
                        date = record.submissionDate;
                    } else if (label.includes("vô số")) {
                        date = record.approvalDate;
                    } else if (label.includes("giao 1 cửa") || label.includes("giao một cửa") || label.includes("trả kết quả")) {
                        date = record.resultReturnedDate;
                    }
                    
                    if (!date) {
                        if (stepStatus === RecordStatus.IN_PROGRESS) date = record.assignedDate;
                        else if (stepStatus === RecordStatus.COMPLETED_WORK) date = record.completedWorkDate;
                        else if (stepStatus === RecordStatus.PENDING_CHECK) date = record.pendingCheckDate;
                        else if (stepStatus === RecordStatus.CHECKED) date = record.checkedDate;
                        else if (stepStatus === RecordStatus.PENDING_SIGN) date = record.submissionDate;
                        else if (stepStatus === RecordStatus.SIGNED) date = record.approvalDate;
                        else if (stepStatus === RecordStatus.HANDOVER) date = record.completedDate;
                        else if (stepStatus === RecordStatus.RETURNED) date = record.resultReturnedDate;
                    }

                    if (date) return date;

                    // Chronological fallback logic: if this step is active or completed, we interpolate a date
                    const statusOrder = [
                        RecordStatus.RECEIVED,
                        RecordStatus.ASSIGNED,
                        RecordStatus.IN_PROGRESS,
                        RecordStatus.COMPLETED_WORK,
                        RecordStatus.PENDING_CHECK,
                        RecordStatus.CHECKED,
                        RecordStatus.PENDING_SIGN,
                        RecordStatus.SIGNED,
                        RecordStatus.HANDOVER,
                        RecordStatus.RETURNED
                    ];
                    
                    const recordStatusIdx = statusOrder.indexOf(record.status);
                    const stepStatusIdx = statusOrder.indexOf(stepStatus);
                    
                    const isStepActive = stepStatusIdx !== -1 && recordStatusIdx !== -1 && stepStatusIdx <= recordStatusIdx;

                    if (!isStepActive) return null;

                    // Interpolate from other available dates
                    const actualDates: { [key: string]: string | null | undefined } = {
                        [RecordStatus.RECEIVED]: record.receivedDate,
                        [RecordStatus.ASSIGNED]: record.assignedDate,
                        [RecordStatus.IN_PROGRESS]: record.assignedDate,
                        [RecordStatus.COMPLETED_WORK]: record.completedWorkDate,
                        [RecordStatus.PENDING_CHECK]: record.pendingCheckDate,
                        [RecordStatus.CHECKED]: record.checkedDate,
                        [RecordStatus.PENDING_SIGN]: record.submissionDate,
                        [RecordStatus.SIGNED]: record.approvalDate,
                        [RecordStatus.HANDOVER]: record.completedDate,
                        [RecordStatus.RETURNED]: record.resultReturnedDate
                    };

                    if (stepStatusIdx !== -1) {
                        for (let i = stepStatusIdx + 1; i < statusOrder.length; i++) {
                            if (actualDates[statusOrder[i]]) return actualDates[statusOrder[i]];
                        }
                        for (let i = stepStatusIdx - 1; i >= 0; i--) {
                            if (actualDates[statusOrder[i]]) return actualDates[statusOrder[i]];
                        }
                    }

                    return record.assignedDate || record.receivedDate;
                };

                if (isGCN) {
                    const groupGcnSteps = (rawSteps: any[]): any[] => {
                        const groups: {
                            label: string;
                            matchKeywords: string[];
                            subSteps: any[];
                        }[] = [
                            {
                                label: "Xử lý bản vẽ / mộc kê",
                                matchKeywords: ["ranh", "dnlis", "mộc kê", "thế chấp", "niêm yết", "công văn", "xác minh"],
                                subSteps: []
                            },
                            {
                                label: "Thuế",
                                matchKeywords: ["phiếu chuyển", "trình ký thuế", "tbt"],
                                subSteps: []
                            },
                            {
                                label: "In GCN",
                                matchKeywords: ["in gcn", "in giấy", "thẩm tra", "trình ký", "trình ký gcn", "trình ký giấy"],
                                subSteps: []
                            },
                            {
                                label: "Vào số GCN",
                                matchKeywords: ["vô số"],
                                subSteps: []
                            },
                            {
                                label: "Giao 1 cửa",
                                matchKeywords: ["giao 1 cửa", "giao một cửa"],
                                subSteps: []
                            }
                        ];

                        rawSteps.forEach(step => {
                            if (isStepHiddenForWorkflow(step.label, workflow.type)) return;
                            const lowerLabel = step.label.toLowerCase();
                            let matched = false;
                            for (const g of groups) {
                                if (g.matchKeywords.some(kw => lowerLabel.includes(kw))) {
                                    g.subSteps.push(step);
                                    matched = true;
                                    break;
                                }
                            }
                            if (!matched) {
                                groups[0].subSteps.push(step);
                            }
                        });

                        const activeGroups = groups.filter(g => g.subSteps.length > 0);

                        return activeGroups.map(g => {
                            const subSteps = g.subSteps;
                            
                            let status: 'completed' | 'current' | 'upcoming' = 'upcoming';
                            const allCompleted = subSteps.every(s => s.status === 'completed');
                            const allUpcoming = subSteps.every(s => s.status === 'upcoming');
                            if (allCompleted) {
                                status = 'completed';
                            } else if (allUpcoming) {
                                status = 'upcoming';
                            } else {
                                status = 'current';
                            }

                            const currentSub = subSteps.find(s => s.status === 'current') || 
                                               subSteps.find(s => s.status === 'completed' && s.deadlineDate) ||
                                               subSteps[0];
                            
                            const deadlineDate = currentSub?.deadlineDate || null;
                            const isOverdue = subSteps.some(s => s.isOverdue);
                            const isUrgent = subSteps.some(s => s.isUrgent);

                            return {
                                label: g.label,
                                status,
                                deadlineDate,
                                isOverdue,
                                isUrgent,
                                subSteps
                            };
                        });
                    };

                    const grouped = groupGcnSteps(workflow.steps);

                    return (
                        <div className="mb-8 bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-wider flex items-center gap-2">
                                <Activity size={14} className="text-slate-400" />
                                {workflow.title}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                {grouped.map((group, idx) => {
                                    let cardBorderClass = "border-slate-200 bg-white";
                                    let badgeColorClass = "bg-slate-100 text-slate-500";
                                    let badgeText = "Chờ thực hiện";
                                    
                                    if (group.status === 'completed') {
                                        cardBorderClass = "border-emerald-200 bg-emerald-50/10 hover:bg-emerald-50/20";
                                        badgeColorClass = "bg-emerald-100 text-emerald-700";
                                        badgeText = "Hoàn thành";
                                    } else if (group.status === 'current') {
                                        cardBorderClass = "border-blue-300 bg-blue-50/10 ring-2 ring-blue-100 shadow-md";
                                        badgeColorClass = "bg-blue-600 text-white animate-pulse";
                                        badgeText = "Đang xử lý";
                                    }

                                    return (
                                        <div key={idx} className={`rounded-xl border p-4 flex flex-col justify-between transition-all duration-300 ${cardBorderClass}`}>
                                            <div>
                                                <div className="flex justify-between items-start mb-3">
                                                    <h4 className="text-sm font-black text-slate-800 tracking-tight leading-tight">
                                                        {group.label}
                                                    </h4>
                                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${badgeColorClass}`}>
                                                        {badgeText}
                                                    </span>
                                                </div>
                                                
                                                {/* Danh sách tiến độ chi tiết (Sub-steps) */}
                                                <div className="space-y-1.5 bg-slate-50/50 p-2 rounded-lg border border-slate-100 mb-3">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                                                        Tiến độ bước:
                                                    </p>
                                                    {group.subSteps.map((s: any, sIdx: number) => {
                                                        const execDate = getExecutionDate(s.label, s.overallStatus);
                                                        let iconNode = <Circle size={10} className="text-slate-300 mt-0.5" />;
                                                        let sLabelClass = "text-slate-400 font-medium";
                                                        
                                                        if (s.status === 'completed') {
                                                            iconNode = <CheckCircle2 size={10} className="text-emerald-500 mt-0.5" />;
                                                            sLabelClass = "text-emerald-800 font-semibold line-through decoration-emerald-200";
                                                        } else if (s.status === 'current') {
                                                            iconNode = <Loader2 size={10} className="text-blue-500 animate-spin mt-0.5" />;
                                                            sLabelClass = "text-blue-800 font-bold";
                                                        }

                                                        return (
                                                            <div key={sIdx} className="text-[11px] leading-tight flex items-start gap-1.5">
                                                                {iconNode}
                                                                <div className="flex-1 min-w-0">
                                                                    <p className={`truncate ${sLabelClass}`} title={s.label}>
                                                                        {s.label}
                                                                    </p>
                                                                    {/* Ngày giờ / Thời hạn giải quyết */}
                                                                    {getStepDateTimeString(s, execDate) && (
                                                                        <p className="text-[9px] text-slate-400 font-medium mt-0.5">
                                                                            📅 {getStepDateTimeString(s, execDate)}
                                                                        </p>
                                                                    )}
                                                                    {/* Người thực hiện (chỉ hiện khi đã được giao) */}
                                                                    {getStepAssigneeName(s.label, s.status) && (
                                                                        <p className="text-[9px] text-slate-500 font-semibold flex items-center gap-1 mt-0.5">
                                                                            👤 {getStepAssigneeName(s.label, s.status)}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            
                                            {/* Deadline / Time block */}
                                            <div className="border-t border-slate-100 pt-2 mt-auto">
                                                {group.status === 'completed' ? (
                                                    <p className="text-[10px] text-emerald-600 font-bold">
                                                        ✓ Đã hoàn thành
                                                    </p>
                                                ) : group.deadlineDate ? (
                                                    <div className="space-y-0.5">
                                                        <p className={`text-[10px] font-bold ${group.isOverdue ? "text-red-600 animate-pulse" : "text-blue-600"}`}>
                                                            Hạn: {formatDate(group.deadlineDate.toISOString())}
                                                        </p>
                                                        {group.isOverdue && (
                                                            <span className="text-[8px] font-extrabold text-red-600 uppercase tracking-widest bg-red-50 border border-red-100 px-1 py-0.2 rounded block text-center">
                                                                ⚠️ TRỄ HẠN
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-[10px] text-slate-400">---</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                }

                return (
                    <div className="mb-8 bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-wider flex items-center gap-2">
                            <Activity size={14} className="text-slate-400" />
                            {workflow.title}
                        </h3>
                        <div className="relative flex items-center justify-between overflow-x-auto py-4 px-2 min-w-[700px] custom-scrollbar gap-2">
                            {workflow.steps.map((step, idx) => { const s = step as any;
                                const isLast = idx === workflow.steps.length - 1;
                                let circleClass = "";
                                let lineClass = "";
                                let textClass = "";
                                let iconNode = null;

                                if (s.status === 'completed') {
                                    circleClass = "bg-emerald-50 border-emerald-500 text-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.2)]";
                                    lineClass = "bg-emerald-500";
                                    textClass = "text-emerald-700 font-bold";
                                    iconNode = <CheckCircle2 size={16} />;
                                } else if (s.status === 'current') {
                                    circleClass = "bg-blue-50 border-blue-600 text-blue-700 ring-4 ring-blue-100 shadow-[0_0_12px_rgba(37,99,235,0.4)] animate-pulse";
                                    lineClass = "bg-gray-200";
                                    textClass = "text-blue-700 font-extrabold scale-105 transform origin-left";
                                    iconNode = <Loader2 size={16} className="animate-spin" />;
                                } else {
                                    circleClass = "bg-gray-50 border-gray-200 text-gray-400";
                                    lineClass = "bg-gray-100";
                                    textClass = "text-gray-400 font-medium";
                                    iconNode = <Circle size={14} className="opacity-40" />;
                                }

                                const execDate = getExecutionDate(s.label, s.overallStatus);

                                return (
                                    <div key={idx} className="flex-1 flex items-center relative">
                                        {/* Step body */}
                                        <div className="flex flex-col items-center flex-1 z-10">
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${circleClass}`}>
                                                {iconNode}
                                            </div>
                                            <div className="text-center mt-2.5 max-w-[120px]">
                                                <p className={`text-xs truncate transition-all leading-tight ${textClass}`} title={s.label}>
                                                    {s.label}
                                                </p>
                                                <span className={`text-[10px] mt-0.5 inline-block px-1.5 py-0.5 rounded-full font-bold ${
                                                    s.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                                                    s.status === 'current' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-400'
                                                }`}>
                                                    {s.duration}
                                                </span>
                                                {s.status === 'completed' && execDate ? (
                                                    <p className="text-[9px] text-emerald-600 font-extrabold mt-1 leading-none" title={`Thực hiện lúc: ${formatDate(execDate)}`}>
                                                        {formatDate(execDate)}
                                                    </p>
                                                ) : s.deadlineDate ? (
                                                    <p className={`text-[9px] font-bold mt-1 leading-none ${s.status === 'current' ? 'text-blue-600 animate-pulse' : 'text-gray-400'}`} title={`Hạn chót bước: ${formatDate(s.deadlineDate.toISOString())}`}>
                                                        Hạn: {formatDate(s.deadlineDate.toISOString())}
                                                    </p>
                                                ) : (
                                                    <p className="text-[9px] text-gray-400 mt-1 leading-none">---</p>
                                                )}
                                                {s.desc && (
                                                    <p className="text-[9px] text-gray-400 italic mt-1 leading-none max-w-[100px] mx-auto truncate" title={s.desc}>
                                                        {s.desc}
                                                    </p>
                                                )}

                                                {/* Hiển thị cán bộ thực hiện/được giao */}
                                                {/* Nếu trễ hạn thì hiển thị xuống dưới tên ghi rõ thời gian trễ */}
                                                {s.isOverdue && s.deadlineDate && (
                                                    <p className="text-[9px] mt-1 text-red-600 font-bold bg-red-50 border border-red-100 rounded px-1 py-0.5 truncate max-w-[110px] mx-auto" title={getOverdueDurationStr(s.deadlineDate)}>
                                                        ⚠️ Trễ: {getOverdueDurationStr(s.deadlineDate).replace("Trễ hạn: ", "")}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Connector line to next step */}
                                        {!isLast && (
                                            <div className="absolute top-[18px] left-1/2 right-[-50%] h-[2px] z-0 pointer-events-none pr-4">
                                                <div className={`h-full w-full transition-all duration-300 ${lineClass}`} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* COLUMN 1: THÔNG TIN CHUNG */}
                <div className="space-y-6">
                    {/* KHÁCH HÀNG */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-xs font-bold text-blue-600 uppercase mb-4 flex items-center gap-2 border-l-4 border-blue-600 pl-2">
                            <UserIcon size={16}/> {record.recordType === '1.2 Công văn' ? 'Thông tin công văn' : 'Thông tin chủ hồ sơ'}
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">
                                    {record.recordType === '1.2 Công văn' ? 'Số công văn - Đơn vị phát hành' : 'Chủ sử dụng'}
                                </label>
                                <p className="text-base font-bold text-gray-800">{record.customerName}</p>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Số điện thoại</label>
                                <p className="text-base font-bold text-gray-800">{record.phoneNumber || '---'}</p>
                            </div>
                            {record.customerAddress && (
                                <div>
                                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Địa chỉ thường trú</label>
                                    <p className="text-sm font-bold text-gray-800">{record.customerAddress}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ĐỊA CHÍNH */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-xs font-bold text-green-600 uppercase mb-4 flex items-center gap-2 border-l-4 border-green-600 pl-2">
                            <MapPin size={16}/> Thông tin địa chính
                        </h3>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Xã/Phường</label>
                                <p className="font-bold text-gray-800 text-sm">{getNormalizedWard(record.ward)}</p>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Tờ bản đồ</label>
                                <p className="font-bold text-gray-800 bg-gray-50 px-2 py-1 rounded border border-gray-200 text-center">{record.mapSheet || '-'}</p>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Thửa đất</label>
                                <p className="font-bold text-gray-800 bg-gray-50 px-2 py-1 rounded border border-gray-200 text-center">{record.landPlot || '-'}</p>
                            </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-dashed border-gray-100">
                            <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Diện tích mới (m²)</label>
                            <p className="font-extrabold text-emerald-800 text-base">{record.area || '-'} m²</p>
                            
                            {(record.residentialArea || record.clnArea || record.bhkArea || record.lucArea || record.otherLandArea) ? (
                                <div className="grid grid-cols-5 gap-1.5 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                                    {record.residentialArea ? (
                                        <div>
                                            <span className="text-[9px] font-bold text-gray-500 uppercase block">{(record.ward || "").trim().toLowerCase().includes("tân khai") ? "ODT" : "ONT"}</span>
                                            <span className="text-xs font-bold text-slate-800">{record.residentialArea} m²</span>
                                        </div>
                                    ) : null}
                                    {record.clnArea ? (
                                        <div>
                                            <span className="text-[9px] font-bold text-gray-500 uppercase block">CLN</span>
                                            <span className="text-xs font-bold text-slate-800">{record.clnArea} m²</span>
                                        </div>
                                    ) : null}
                                    {record.bhkArea ? (
                                        <div>
                                            <span className="text-[9px] font-bold text-gray-500 uppercase block">BHK</span>
                                            <span className="text-xs font-bold text-slate-800">{record.bhkArea} m²</span>
                                        </div>
                                    ) : null}
                                    {record.lucArea ? (
                                        <div>
                                            <span className="text-[9px] font-bold text-gray-500 uppercase block">LUC</span>
                                            <span className="text-xs font-bold text-slate-800">{record.lucArea} m²</span>
                                        </div>
                                    ) : null}
                                    {record.otherLandArea ? (
                                        <div>
                                            <span className="text-[9px] font-bold text-gray-500 uppercase block">Khác</span>
                                            <span className="text-xs font-bold text-slate-800">{record.otherLandArea} m²</span>
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                        {record.address && (
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Địa chỉ chi tiết</label>
                                <p className="text-sm font-bold text-gray-800">{record.address}</p>
                            </div>
                        )}
                        {(record.issueNumber || record.entryNumber || record.issueDate) && (
                            <div className="mt-4 pt-4 border-t border-dashed border-gray-100 grid grid-cols-3 gap-4 animate-fade-in-up">
                                {record.issueNumber && (
                                    <div>
                                        <label className="text-[10px] text-emerald-600 uppercase font-bold block mb-1">Số GCN</label>
                                        <p className="font-bold text-emerald-800 bg-emerald-50/50 px-2 py-1 rounded border border-emerald-200 text-center text-xs">{record.issueNumber}</p>
                                    </div>
                                )}
                                {record.entryNumber && (
                                    <div>
                                        <label className="text-[10px] text-emerald-600 uppercase font-bold block mb-1">Số vào sổ</label>
                                        <p className="font-bold text-emerald-800 bg-emerald-50/50 px-2 py-1 rounded border border-emerald-200 text-center text-xs">{record.entryNumber}</p>
                                    </div>
                                )}
                                {record.issueDate && (
                                    <div>
                                        <label className="text-[10px] text-emerald-600 uppercase font-bold block mb-1">Ngày cấp GCN</label>
                                        <p className="font-bold text-emerald-800 bg-emerald-50/50 px-2 py-1 rounded border border-emerald-200 text-center text-xs">
                                            {(() => {
                                                try {
                                                    return new Date(record.issueDate).toLocaleDateString('vi-VN');
                                                } catch(e) {
                                                    return record.issueDate;
                                                }
                                            })()}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                        {(record.measurementNumber || record.excerptNumber) && (
                            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-dashed border-gray-100 animate-fade-in-up">
                                {record.measurementNumber && (
                                    <div>
                                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Số Trích đo</label>
                                        <p className="font-bold text-amber-800 bg-amber-50/50 px-2 py-1 rounded border border-amber-200 text-center text-xs">{record.measurementNumber}</p>
                                    </div>
                                )}
                                {record.excerptNumber && (
                                    <div>
                                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Số Trích lục</label>
                                        <p className="font-bold text-amber-800 bg-amber-50/50 px-2 py-1 rounded border border-amber-200 text-center text-xs">{record.excerptNumber}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* NGƯỜI XỬ LÝ */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-2">Người xử lý hồ sơ</label>
                        <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                                <UserIcon size={16}/>
                            </div>
                            <span className="font-bold text-sm text-gray-700">{getEmployeeName(record.assignedTo)}</span>
                        </div>

                        {record.status === RecordStatus.PENDING_CHECK || record.status === RecordStatus.CHECKED ? (
                            <div className="mt-4">
                                <label className="text-[10px] text-gray-400 uppercase font-bold block mb-2">Người kiểm tra</label>
                                <div className="flex items-center gap-3 bg-orange-50 p-3 rounded-lg border border-orange-100">
                                    <div className="w-8 h-8 rounded-full bg-orange-200 flex items-center justify-center text-orange-600">
                                        <UserIcon size={16}/>
                                    </div>
                                    <span className="font-bold text-sm text-orange-800">{getEmployeeName(record.checkedBy)}</span>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {/* REMINDER */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-bold text-blue-600 uppercase flex items-center gap-2">
                                <Bell size={16} /> Hẹn giờ nhắc việc
                            </h4>
                            <button 
                                onClick={handleSaveReminder} 
                                disabled={isSavingReminder}
                                className="text-[10px] bg-blue-600 text-white px-3 py-1.5 rounded flex items-center gap-1 hover:bg-blue-700 disabled:opacity-50 font-bold transition-all"
                            >
                                {isSavingReminder ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />} Lưu
                            </button>
                        </div>
                        <input 
                            type="datetime-local" 
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                            value={reminderDate}
                            onChange={(e) => setReminderDate(e.target.value)}
                        />
                    </div>

                    {/* PERSONAL NOTE */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase">
                                <StickyNote size={16} />
                                <span>Ghi chú cá nhân</span>
                            </div>
                            <button 
                                onClick={handleSavePersonalNote} 
                                disabled={isSavingNote}
                                className="text-[10px] bg-blue-600 text-white px-3 py-1.5 rounded flex items-center gap-1 hover:bg-blue-700 disabled:opacity-50 font-bold transition-all"
                            >
                                {isSavingNote ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                                Lưu
                            </button>
                        </div>
                        <textarea
                            rows={3}
                            className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            placeholder="Nhập ghi chú riêng của bạn..."
                            value={personalNote}
                            onChange={(e) => setPersonalNote(e.target.value)}
                        />
                    </div>
                </div>

                {/* COLUMN 2: CHI TIẾT & TÀI CHÍNH */}
                <div className="space-y-6">
                    {/* NỘI DUNG */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                        <h3 className="text-xs font-bold text-purple-600 uppercase mb-4 flex items-center gap-2 border-l-4 border-purple-600 pl-2">
                            <FileText size={16}/> {record.recordType === '1.2 Công văn' ? 'Trích yếu' : 'Nội dung chi tiết'}
                        </h3>
                        
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-gray-800 text-sm font-medium mb-6 min-h-[80px]">
                            {record.content || 'Không có nội dung chi tiết.'}
                        </div>

                        <div className="pt-2 grid grid-cols-2 gap-4">
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center gap-3">
                                <div className="bg-blue-200 p-1.5 rounded text-blue-700"><Receipt size={16}/></div>
                                <div>
                                    <label className="text-[10px] text-blue-500 uppercase font-bold block">
                                        {record.receiptType === 'invoice' ? 'Số Hóa Đơn' : 'Số Biên Lai'}
                                    </label>
                                    <p className="text-sm font-bold text-blue-800">{record.receiptNumber || '---'}</p>
                                </div>
                            </div>
                            <div className="bg-green-50 p-3 rounded-lg border border-green-100 flex items-center gap-3">
                                <div className="bg-green-200 p-1.5 rounded text-green-700"><DollarSign size={16}/></div>
                                <div>
                                    <label className="text-[10px] text-green-500 uppercase font-bold block">
                                        {record.recordType === 'Cung cấp tài liệu đất đai' ? 'Giá trị hồ sơ' : 'Giá trị hợp đồng'}
                                    </label>
                                    <p className="text-sm font-bold text-green-800">
                                        {record.recordType === 'Cung cấp tài liệu đất đai' 
                                            ? '310.000 đ' 
                                            : (contractPrice !== null && contractPrice !== undefined ? contractPrice.toLocaleString('vi-VN') + ' đ' : '---')}
                                    </p>
                                </div>
                            </div>
                            {record.paymentAmount !== null && record.paymentAmount !== undefined && (
                                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex items-center gap-3 col-span-2">
                                    <div className="bg-emerald-200 p-1.5 rounded text-emerald-700"><DollarSign size={16}/></div>
                                    <div>
                                        <label className="text-[10px] text-emerald-600 uppercase font-bold block">Số tiền thực thu</label>
                                        <p className="text-sm font-bold text-emerald-800">{record.paymentAmount.toLocaleString('vi-VN')} đ</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* GIÁ TRỊ THANH LÝ */}
                        {liquidationInfo && (
                            <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                                <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 flex items-center gap-3">
                                    <div className="bg-orange-200 p-1.5 rounded text-orange-700"><Calculator size={16}/></div>
                                    <div>
                                        <label className="text-[10px] text-orange-600 uppercase font-bold block">{liquidationInfo.content}</label>
                                        <p className="text-sm font-bold text-orange-800">{liquidationInfo.amount.toLocaleString('vi-VN')} đ</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Chi tiết tách thửa */}
                        {contractSplitItems && contractSplitItems.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                                <span className="text-[10px] font-bold text-gray-400 block mb-2 uppercase">Chi tiết tách thửa</span>
                                <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                                    {contractSplitItems.map((item, idx) => (
                                        <div key={idx} className="text-xs flex justify-between bg-gray-50 p-2 rounded border border-gray-100">
                                            <span className="text-gray-700">
                                                <span className="font-bold text-blue-600 mr-1">Thửa {idx + 1}:</span> 
                                                <span className="font-bold">{item.area || 0} m²</span>
                                                {item.serviceName ? <span className="text-gray-500 ml-1 italic truncate max-w-[150px] inline-block align-bottom">- {item.serviceName}</span> : ''}
                                            </span>
                                            <span className="font-mono font-bold text-green-700 shrink-0 ml-2">
                                                {((item.price || 0) * (item.quantity || 0)).toLocaleString('vi-VN')} đ
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>


                </div>

                {/* COLUMN 3: TIẾN ĐỘ & NHẮC VIỆC */}
                <div className="space-y-6">
                    {/* KHẨN CẤP: TRẢ CHỜ DÂN BỔ SUNG */}
                    {isGCN && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-5 space-y-3.5">
                            <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2 border-l-4 border-amber-500 pl-2">
                                <AlertTriangle size={15} className="text-amber-500 animate-pulse" />
                                <span>Yêu cầu bổ sung hồ sơ</span>
                            </h4>

                            {record.status === RecordStatus.PENDING_SUPPLEMENT ? (
                                <div className="space-y-3">
                                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-900 text-xs">
                                        <p className="font-bold uppercase mb-1 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                                            Chờ dân bổ sung giấy tờ
                                        </p>
                                        <p className="leading-relaxed mt-1.5">
                                            <span className="font-semibold text-amber-800">Nội dung yêu cầu:</span>{" "}
                                            {record.supplementReason || record.defectReason || 'Chưa có chi tiết yêu cầu.'}
                                        </p>
                                        {record.supplementLegalBasis && (
                                            <p className="mt-1">
                                                <span className="font-semibold text-amber-800">Căn cứ pháp lý:</span>{" "}
                                                {record.supplementLegalBasis}
                                            </p>
                                        )}
                                        {record.supplementDate && (
                                            <p className="text-[10px] text-amber-600 font-medium mt-2">
                                                Ngày chuyển: {formatDate(record.supplementDate)}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => {
                                            setResumeMode('supplement');
                                            setIsResumeDialogOpen(true);
                                        }}
                                        className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                                    >
                                        <RotateCcw size={14} /> Tiếp nhận lại hồ sơ bổ sung
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-[11px] text-gray-500 leading-normal">
                                        Đóng băng tiến độ xử lý và chuyển hồ sơ về trạng thái "Chờ dân bổ sung" để làm công văn trả dân tại Trung tâm hành chính công.
                                    </p>
                                    <button
                                        onClick={() => {
                                            setSupplementReasonInput('');
                                            setSupplementLegalBasisInput('');
                                            setIsSupplementDialogOpen(true);
                                        }}
                                        className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                                    >
                                        <AlertTriangle size={14} /> Trả hồ sơ chờ dân khắc phục
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* THÔNG BÁO THUẾ: CHỜ DÂN NỘP TIỀN */}
                    {isGCN && record.status === RecordStatus.TBT && (
                        <div className="bg-white rounded-xl border border-rose-200 bg-rose-50/10 shadow-sm overflow-hidden p-5 space-y-3.5 animate-fade-in-up">
                            <h4 className="text-xs font-bold text-rose-700 uppercase flex items-center gap-2 border-l-4 border-rose-500 pl-2">
                                <DollarSign size={15} className="text-rose-500 animate-pulse" />
                                <span>Hồ sơ chuyển về từ Thuế</span>
                            </h4>
                            
                            <p className="text-[11px] text-gray-600 leading-normal">
                                Khâu TBT Một cửa tiến hành chuyển tại tab Cấp giấy: khi chuyển yêu cầu nhập ngày nộp thuế để chuyển hồ sơ quay về trạng thái <span className="font-bold text-rose-600">Chờ giao việc</span> để chọn người in GCN.
                            </p>

                            <div className="space-y-2.5">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Ngày nộp thông báo thuế (*)</label>
                                    <input 
                                        type="date"
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100 transition-all font-semibold"
                                        value={taxPaymentDateInput}
                                        onChange={(e) => setTaxPaymentDateInput(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={handleConfirmTaxPayment}
                                    disabled={isSavingTaxPayment || !taxPaymentDateInput}
                                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                                >
                                    {isSavingTaxPayment ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                    Chuyển hồ sơ về Chờ giao việc in GCN
                                </button>
                            </div>
                        </div>
                    )}

                    {/* TIẾN ĐỘ THỜI GIAN THỰC TẾ (CHIỀU DỌC) */}
                    {(isDoDac || isLuuTru || isGCN) && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
                            <div className="flex flex-col gap-2 pb-3 border-b border-gray-150">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <h4 className="text-xs font-bold text-indigo-600 uppercase flex items-center gap-2 border-l-4 border-indigo-600 pl-2">
                                        <CalendarClock size={16} />
                                        <span>{isGCN ? getGcnWorkflowStepsHelper(record, holidays || []).title : "Tiến độ & Thời gian thực tế"}</span>
                                    </h4>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-gray-500">
                                    <span className="font-semibold">Hạn trả:</span>
                                    <span className="font-extrabold text-gray-800">{formatDate(record.deadline)}</span>
                                    {record.receivedDate && (
                                        <span className="text-gray-400">| Nhận: {formatDate(record.receivedDate)}</span>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-1.5 pl-1 pt-2">
                                {(() => {
                                    if (isGCN) {
                                        const workflow = getGcnWorkflowStepsHelper(record, holidays || []);
                                        const visibleSteps = workflow.steps.filter(step => {
                                            return !isStepHiddenForWorkflow(step.label, workflow.type);
                                        });
                                        return visibleSteps.map((step, idx) => {
                                            const execDate = getExecutionDate(step.label, step.overallStatus);
                                            const isActive = step.status === 'completed' || step.status === 'current';
                                            
                                            let colorClass = {
                                                border: "border-gray-200 text-gray-400",
                                                bg: "bg-gray-100",
                                                text: "text-gray-400"
                                            };
                                            if (step.status === 'completed') {
                                                colorClass = {
                                                    border: "border-emerald-500 text-emerald-600",
                                                    bg: "bg-emerald-500",
                                                    text: "text-emerald-600"
                                                };
                                            } else if (step.status === 'current') {
                                                colorClass = {
                                                    border: "border-blue-500 text-blue-600 ring-4 ring-blue-50 shadow-sm animate-pulse",
                                                    bg: "bg-blue-500",
                                                    text: "text-blue-600 font-extrabold"
                                                };
                                            }

                                            let stepIcon: any = Circle;
                                            if (step.status === 'completed') {
                                                stepIcon = CheckCircle2;
                                            } else if (step.status === 'current') {
                                                stepIcon = Loader2;
                                            }

                                            const IconComponent = stepIcon;
                                            const assignee = getStepAssigneeName(step.label, step.status);
                                            
                                            // Calculate overdue duration if step is overdue
                                            let overdueDurationText = "";
                                            if (step.isOverdue && step.deadlineDate) {
                                                const diffMs = Date.now() - step.deadlineDate.getTime();
                                                if (diffMs > 0) {
                                                    const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
                                                    const days = Math.floor(totalHours / 24);
                                                    const hours = totalHours % 24;
                                                    if (days > 0) {
                                                        overdueDurationText = `Trễ hạn: ${days} ngày ${hours} giờ`;
                                                    } else {
                                                        overdueDurationText = `Trễ hạn: ${hours} giờ`;
                                                    }
                                                }
                                            }

                                            return (
                                                <div key={idx} className="relative flex gap-4">
                                                    <div className="flex flex-col items-center">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 bg-white ${isActive ? colorClass.border : 'border-gray-200'}`}>
                                                            {isActive ? (
                                                                <IconComponent size={16} className={`${colorClass.text} ${step.status === 'current' ? 'animate-spin' : ''}`} />
                                                            ) : <Circle size={16} className="text-gray-300" />}
                                                        </div>
                                                        {idx !== visibleSteps.length - 1 && (
                                                            <div className={`w-0.5 grow ${isActive ? colorClass.bg : 'bg-gray-100'} my-1`}></div>
                                                        )}
                                                    </div>
                                                    <div className="pb-6 flex-1">
                                                        {/* Line 1: Step Label */}
                                                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                                            <p className={`text-xs font-bold uppercase ${isActive ? colorClass.text : 'text-gray-400'}`}>
                                                                {step.label}
                                                            </p>
                                                            {(step.label.toLowerCase().includes("in gcn") || step.label.toLowerCase().includes("in giấy")) && (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-bold border border-blue-100">
                                                                    {['quy_trinh_4', 'quy_trinh_5', 'quy_trinh_6', 'quy_trinh_7'].includes(workflow.type) 
                                                                        ? "Tính ngày theo quy trình bổ sung (3 ngày)" 
                                                                        : "Tính ngày theo quy trình chuẩn (5 ngày)"}
                                                                </span>
                                                            )}
                                                        </div>
                                                        
                                                        {/* Line 2: Ngày giờ giao & Hạn giải quyết */}
                                                        <div className="flex flex-wrap items-center gap-x-3 text-xs text-gray-500 font-medium">
                                                            <span className="flex items-center gap-1">
                                                                <CalendarClock size={12} className="text-slate-400" />
                                                                <span>Giao: {execDate ? formatDate(execDate) : "---"}</span>
                                                            </span>
                                                            {step.deadlineDate && (
                                                                <>
                                                                    <span className="text-gray-300">|</span>
                                                                    <span className="flex items-center gap-1 font-semibold text-slate-700">
                                                                        <Clock size={12} className="text-slate-400" />
                                                                        <span>Hạn giải quyết: {formatDate(step.deadlineDate.toISOString())}</span>
                                                                    </span>
                                                                </>
                                                            )}
                                                            {step.duration && !step.deadlineDate && (
                                                                <>
                                                                    <span className="text-gray-300">|</span>
                                                                    <span className="text-gray-400 italic">Thời hạn: {step.duration}</span>
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* Line 3: Tên người được giao */}
                                                        <div className="text-xs text-slate-600 mt-1 font-medium flex items-center gap-1.5">
                                                            <UserIcon size={12} className="text-slate-400" />
                                                            <span>Người được giao: <span className="font-semibold text-slate-800">{assignee || "Chưa giao"}</span></span>
                                                        </div>

                                                        {/* Line 4: Nếu trễ hạn thì hiển thị xuống dưới tên */}
                                                        {step.isOverdue && overdueDurationText && (
                                                            <div className="mt-1">
                                                                <p className="text-[11px] text-pink-600 font-bold bg-pink-50 border border-pink-100 rounded px-2 py-0.5 inline-flex items-center gap-1">
                                                                    <AlertTriangle size={12} className="text-pink-600 animate-pulse" />
                                                                    <span>{overdueDurationText}</span>
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        });
                                    }

                                    const chronologicalSteps = [
                                        {
                                            label: "NHẬN HỒ SƠ",
                                            date: record.receivedDate,
                                            icon: UserIcon,
                                            forceActive: true,
                                            subText: record.receivedBy ? (() => {
                                                const receiver = users.find(u => u.employeeId === record.receivedBy);
                                                if (!receiver) return undefined;
                                                const emp = employees.find(e => e.id === receiver.employeeId);
                                                return `${receiver.name} (${emp?.position || 'Nhân viên'})`;
                                            })() : undefined,
                                            colorClass: {
                                                border: "border-emerald-500 text-emerald-600",
                                                bg: "bg-emerald-500",
                                                text: "text-emerald-600"
                                            }
                                        },
                                        {
                                            label: "GIAO NHÂN VIÊN",
                                            date: record.assignedDate,
                                            icon: UserIcon,
                                            forceActive: record.status !== RecordStatus.RECEIVED || !!record.assignedTo || !!record.assignedDate,
                                            subText: record.assignedTo ? (() => {
                                                const assigned = employees.find(e => e.id === record.assignedTo);
                                                if (!assigned) return undefined;
                                                return `${assigned.name} (${assigned.position || 'Nhân viên'})`;
                                            })() : undefined,
                                            colorClass: {
                                                border: "border-blue-500 text-blue-600",
                                                bg: "bg-blue-500",
                                                text: "text-blue-600"
                                            }
                                        },
                                        {
                                            label: "ĐÃ THỰC HIỆN",
                                            date: record.completedWorkDate,
                                            icon: CheckSquare,
                                            forceActive: isWorkDone,
                                            subText: record.completedWorkDate && record.assignedTo ? (() => {
                                                const assigned = employees.find(e => e.id === record.assignedTo);
                                                if (!assigned) return undefined;
                                                return `${assigned.name} (${assigned.position || 'Nhân viên'})`;
                                            })() : undefined,
                                            colorClass: {
                                                border: "border-cyan-500 text-cyan-600",
                                                bg: "bg-cyan-500",
                                                text: "text-cyan-600"
                                            }
                                        },
                                        ...((isLuuTru || isDoDac) ? [
                                            {
                                                label: "TRÌNH KIỂM TRA",
                                                date: record.pendingCheckDate,
                                                icon: Send,
                                                forceActive: isPendingCheckActive,
                                                subText: record.pendingCheckDate ? (() => {
                                                    const checker = record.checkedBy ? employees.find(e => e.id === record.checkedBy) : null;
                                                    if (checker) return `${checker.name}`;
                                                    return undefined;
                                                })() : undefined,
                                                colorClass: {
                                                    border: "border-orange-500 text-orange-600",
                                                    bg: "bg-orange-500",
                                                    text: "text-orange-600"
                                                }
                                            },
                                            {
                                                label: "ĐÃ KIỂM TRA",
                                                date: record.checkedDate,
                                                icon: CheckSquare,
                                                forceActive: isCheckedActive,
                                                subText: record.checkedDate && record.checkedBy ? (() => {
                                                    const checker = employees.find(e => e.id === record.checkedBy);
                                                    if (!checker) return undefined;
                                                    return `${checker.name}`;
                                                 })() : undefined,
                                                colorClass: {
                                                    border: "border-orange-500 text-orange-600",
                                                    bg: "bg-orange-500",
                                                    text: "text-orange-600"
                                                }
                                            }
                                        ] : []),
                                        {
                                            label: "TRÌNH KÝ",
                                            date: record.submissionDate,
                                            icon: Send,
                                            forceActive: isPendingSignActive,
                                            subText: record.submissionDate && record.submittedTo ? (() => {
                                                const director = users.find(u => u.employeeId === record.submittedTo) || employees.find(e => e.id === record.submittedTo);
                                                if (!director) return undefined;
                                                return `${director.name}`;
                                            })() : undefined,
                                            colorClass: {
                                                border: "border-purple-500 text-purple-600",
                                                bg: "bg-purple-500",
                                                text: "text-purple-600"
                                            }
                                        },
                                        {
                                            label: "KÝ DUYỆT",
                                            date: record.approvalDate,
                                            icon: FileSignature,
                                            forceActive: isSignedActive,
                                            subText: record.approvalDate && record.submittedTo ? (() => {
                                                const director = users.find(u => u.employeeId === record.submittedTo) || employees.find(e => e.id === record.submittedTo);
                                                if (!director) return undefined;
                                                return `${director.name}`;
                                            })() : undefined,
                                            colorClass: {
                                                border: "border-indigo-500 text-indigo-600",
                                                bg: "bg-indigo-500",
                                                text: "text-indigo-600"
                                            }
                                        },
                                        {
                                            label: record.status === RecordStatus.WITHDRAWN ? "RÚT HỒ SƠ" : "HOÀN THÀNH",
                                            date: record.completedDate,
                                            icon: CheckSquare,
                                            forceActive: isCompletedActive,
                                            subText: record.exportBatch ? `Đợt ${record.exportBatch}` : undefined,
                                            colorClass: {
                                                border: "border-green-500 text-green-600",
                                                bg: "bg-green-500",
                                                text: "text-green-600"
                                            }
                                        },
                                        {
                                            label: "TRẢ KẾT QUẢ",
                                            date: record.resultReturnedDate,
                                            icon: FileCheck,
                                            forceActive: record.status === RecordStatus.RETURNED || !!record.resultReturnedDate,
                                            subText: record.resultReturnedDate ? (() => {
                                                let details = '';
                                                if (record.receiverName) details += `${record.receiverName}`;
                                                if (record.paymentAmount) details += (details ? `, ` : '') + `${record.paymentAmount.toLocaleString('vi-VN')}đ`;
                                                return details || undefined;
                                            })() : undefined,
                                            colorClass: {
                                                border: "border-emerald-500 text-emerald-600",
                                                bg: "bg-emerald-500",
                                                text: "text-emerald-600"
                                            }
                                        }
                                    ];

                                    return chronologicalSteps.map((step, idx) => {
                                        return (
                                            <TimelineItem
                                                key={idx}
                                                date={(() => {
                                                     let statusEnum = RecordStatus.RECEIVED;
                                                     const label = step.label.toLowerCase();
                                                     if (label.includes("giao nhâ")) statusEnum = RecordStatus.IN_PROGRESS;
                                                     else if (label.includes("đã thực")) statusEnum = RecordStatus.COMPLETED_WORK;
                                                     else if (label.includes("trình kiể")) statusEnum = RecordStatus.PENDING_CHECK;
                                                     else if (label.includes("đã kiể")) statusEnum = RecordStatus.CHECKED;
                                                     else if (label.includes("trình ký")) statusEnum = RecordStatus.PENDING_SIGN;
                                                     else if (label.includes("ký duy")) statusEnum = RecordStatus.SIGNED;
                                                     else if (label.includes("hoàn th") || label.includes("rút hồ")) statusEnum = RecordStatus.HANDOVER;
                                                     else if (label.includes("trả kết")) statusEnum = RecordStatus.RETURNED;
                                                     return getExecutionDate(step.label, statusEnum);
                                                 })()}
                                                label={step.label}
                                                icon={step.icon}
                                                isLast={idx === chronologicalSteps.length - 1}
                                                colorClass={step.colorClass}
                                                forceActive={step.forceActive}
                                                subText={(() => {
                                                     const label = step.label.toLowerCase();
                                                     if (label.includes("hoàn thành") || label.includes("rút hồ") || label.includes("trả kết")) {
                                                         return step.subText;
                                                     }
                                                     return getStepAssigneeName(step.label) || step.subText;
                                                 })()}
                                            />
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    )}


                </div>

            </div>
        </div>

        <DocxPreviewModal
            isOpen={isPreviewOpen}
            onClose={() => setIsPreviewOpen(false)}
            docxBlob={previewBlob}
            fileName={previewFileName}
        />
        {systemReceiptData && (
            <SystemReceiptTemplate 
                data={systemReceiptData} 
                receivingWard={systemReceiptData.ward || employees.find(e => e.id === currentUser?.employeeId)?.managedWards?.[0] || 'Tân Khai'}
                onClose={() => setSystemReceiptData(null)} 
                currentUser={currentUser}
                employees={employees}
            />
        )}
        {isAnnexOpen && record && (
            <SystemAnnexTemplate 
                data={record} 
                employees={employees}
                onClose={() => setIsAnnexOpen(false)}
            />
        )}
        {isInfoProvisionOpen && record && (
            <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[92vh] overflow-hidden flex flex-col border border-gray-200">
                    <div className="bg-gradient-to-r from-purple-700 to-indigo-700 text-white px-5 py-3 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-2">
                            <FileText size={18} className="text-purple-200" />
                            <span className="font-bold text-sm">PHIẾU CUNG CẤP THÔNG TIN QUY HOẠCH - HỒ SƠ {record.code}</span>
                        </div>
                        <button onClick={() => setIsInfoProvisionOpen(false)} className="text-purple-100 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <CungCapThongTinTab 
                            currentUser={currentUser || undefined}
                            notify={(msg) => alert(msg)}
                            presetRecord={record}
                            onClose={() => setIsInfoProvisionOpen(false)}
                        />
                    </div>
                </div>
            </div>
        )}
        {isVphcOpen && record && (
            <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[92vh] overflow-hidden flex flex-col border border-gray-200">
                    <div className="bg-gradient-to-r from-red-700 to-rose-700 text-white px-5 py-3 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-2">
                            <Gavel size={18} className="text-red-200" />
                            <span className="font-bold text-sm">BIÊN BẢN VPHC & LÀM VIỆC - HỒ SƠ {record.code}</span>
                        </div>
                        <button onClick={() => setIsVphcOpen(false)} className="text-red-100 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <VPHCTab 
                            currentUser={currentUser || undefined}
                            notify={(msg) => alert(msg)}
                            presetRecord={record}
                            onClose={() => setIsVphcOpen(false)}
                        />
                    </div>
                </div>
            </div>
        )}
      </div>

      {isResumeDialogOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl border border-blue-150 w-full max-w-md overflow-hidden animate-fade-in-up">
                  <div className="bg-blue-600 px-5 py-3 text-white font-bold text-sm flex items-center gap-2">
                       <AlertTriangle size={16} />
                       <span>TIẾP NHẬN LẠI HỒ SƠ</span>
                  </div>
                  <div className="p-5">
                      <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                          Hồ sơ này đang được đánh dấu có sai sót (Trình trả dân). Bạn muốn tiếp nhận lại hồ sơ bổ sung như thế nào?
                      </p>

                      <div className="space-y-3">
                          <div 
                              onClick={() => setResumeMode('supplement')}
                              className={`block p-3 border rounded-lg cursor-pointer transition-all ${
                                  resumeMode === 'supplement' 
                                  ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' 
                                  : 'border-gray-200 hover:bg-gray-50'
                              }`}
                          >
                              <div className="flex items-start gap-2.5">
                                  <input 
                                      type="radio" 
                                      name="resumeMode" 
                                      checked={resumeMode === 'supplement'} 
                                      onChange={() => setResumeMode('supplement')} 
                                      className="mt-1 text-blue-600 focus:ring-blue-500" 
                                  />
                                  <div>
                                      <p className="text-xs font-bold text-slate-800">Tiếp nhận lại (Có Bổ sung hồ sơ)</p>
                                      <p className="text-[10.5px] text-slate-500 mt-1 leading-relaxed">
                                          Hủy đánh dấu sai sót, cập nhật ngày nhận là <span className="font-semibold text-blue-600">Hôm nay</span>, và <span className="font-semibold text-blue-600">tính lại thời hạn trả từ đầu</span> cho các bước tiếp theo.
                                      </p>
                                  </div>
                              </div>
                          </div>

                          <div 
                              onClick={() => setResumeMode('simple')}
                              className={`block p-3 border rounded-lg cursor-pointer transition-all ${
                                  resumeMode === 'simple' 
                                  ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' 
                                  : 'border-gray-200 hover:bg-gray-50'
                              }`}
                          >
                              <div className="flex items-start gap-2.5">
                                  <input 
                                      type="radio" 
                                      name="resumeMode" 
                                      checked={resumeMode === 'simple'} 
                                      onChange={() => setResumeMode('simple')} 
                                      className="mt-1 text-blue-600 focus:ring-blue-500" 
                                  />
                                  <div>
                                      <p className="text-xs font-bold text-slate-800">Hủy đánh dấu sai sót (Giữ nguyên ngày)</p>
                                      <p className="text-[10.5px] text-slate-500 mt-1 leading-relaxed">
                                          Chỉ hủy bỏ trạng thái lỗi hồ sơ để đưa về luồng xử lý bình thường. Giữ nguyên ngày nhận và thời hạn trả gốc.
                                      </p>
                                  </div>
                              </div>
                          </div>
                      </div>

                      <div className="flex justify-end gap-2 mt-5">
                          <button
                              onClick={() => setIsResumeDialogOpen(false)}
                              className="px-3.5 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded hover:bg-gray-200 transition-all border border-gray-200"
                          >
                              Hủy bỏ
                          </button>
                          <button
                              onClick={handleConfirmResume}
                              disabled={isSavingResume}
                              className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm flex items-center gap-1.5"
                          >
                              {isSavingResume ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                              Xác nhận tiếp nhận
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {isDefectDialogOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl border border-red-150 w-full max-w-md overflow-hidden animate-fade-in-up">
                  <div className="bg-red-655 px-5 py-3 text-white font-bold text-sm flex items-center gap-2" style={{ backgroundColor: '#dc2626' }}>
                       <AlertTriangle size={16} />
                       <span>GHI NHẬN SAI SÓT & TRẢ HỒ SƠ</span>
                  </div>
                  <div className="p-5">
                      <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                          Vui lòng ghi rõ lý do sai sót chi tiết bên dưới. Hồ sơ này sẽ tiếp tục đi qua các bước kiểm tra, ký duyệt như bình thường nhưng kết quả cuối cùng sẽ được bàn giao dưới dạng <span className="font-bold text-red-600">"Hồ sơ trả"</span> để theo dõi lưu quy trình.
                      </p>
                      
                      <label className="text-xs font-bold text-gray-700 block mb-1">Chi tiết lý do / sai sót:</label>
                      <textarea
                          className="w-full border border-gray-300 rounded-md p-2.5 text-xs focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none h-28"
                          placeholder="Mô tả sai sót phát hiện được và lý do trả hồ sơ..."
                          value={defectReasonInput}
                          onChange={(e) => setDefectReasonInput(e.target.value)}
                      />
                      
                      <div className="flex justify-end gap-2 mt-4">
                          <button
                              onClick={() => { setIsDefectDialogOpen(false); setDefectReasonInput(''); }}
                              className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded hover:bg-gray-200 transition-all border border-gray-200"
                          >
                              Hủy bỏ
                          </button>
                          <button
                              onClick={handleConfirmDefect}
                              disabled={isSavingDefect || !defectReasonInput.trim()}
                              className="px-3.5 py-1.5 bg-red-655 text-white text-xs font-bold rounded hover:bg-red-700 disabled:opacity-50 transition-all shadow-sm flex items-center gap-1.5"
                              style={{ backgroundColor: '#dc2626' }}
                          >
                              {isSavingDefect ? <Loader2 size={13} className="animate-spin" /> : <AlertTriangle size={13} />}
                              Xác nhận trả
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {isSupplementDialogOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl border border-amber-150 w-full max-w-md overflow-hidden animate-fade-in-up">
                  <div className="bg-amber-500 px-5 py-3 text-white font-bold text-sm flex items-center gap-2">
                       <AlertTriangle size={16} />
                       <span>TRẢ HỒ SƠ CHỜ DÂN BỔ SUNG / KHẮC PHỤC</span>
                  </div>
                  <div className="p-5 space-y-4">
                      <p className="text-xs text-gray-600 leading-relaxed">
                          Nhập lý do sai sót hoặc các giấy tờ người dân cần bổ sung chi tiết bên dưới. Hệ thống sẽ tạm thời đóng băng tiến độ và chuyển trạng thái hồ sơ thành <span className="font-bold text-amber-600">"Chờ dân bổ sung"</span>.
                      </p>
                      
                      <div>
                          <label className="text-xs font-bold text-gray-700 block mb-1">Nội dung yêu cầu bổ sung / sai sót (*):</label>
                          <textarea
                              className="w-full border border-gray-300 rounded-md p-2.5 text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none h-24 bg-white"
                              placeholder="Nhập nội dung cần bổ sung, chỉnh sửa..."
                              value={supplementReasonInput}
                              onChange={(e) => setSupplementReasonInput(e.target.value)}
                          />
                      </div>

                      <div>
                          <label className="text-xs font-bold text-gray-700 block mb-1">Căn cứ pháp lý (nếu có):</label>
                          <input
                              type="text"
                              className="w-full border border-gray-300 rounded-md p-2.5 text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white font-medium"
                              placeholder="Ví dụ: Khoản 2 Điều 10 Luật Đất đai năm 2024..."
                              value={supplementLegalBasisInput}
                              onChange={(e) => setSupplementLegalBasisInput(e.target.value)}
                          />
                      </div>
                      
                      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                          <button
                              onClick={() => { setIsSupplementDialogOpen(false); setSupplementReasonInput(''); setSupplementLegalBasisInput(''); }}
                              className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded hover:bg-gray-200 transition-all border border-gray-200 cursor-pointer"
                          >
                              Hủy bỏ
                          </button>
                          <button
                              onClick={handleConfirmSupplement}
                              disabled={isSavingSupplement || !supplementReasonInput.trim()}
                              className="px-3.5 py-1.5 bg-amber-500 text-white text-xs font-bold rounded hover:bg-amber-600 disabled:opacity-50 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                          >
                              {isSavingSupplement ? <Loader2 size={13} className="animate-spin" /> : <AlertTriangle size={13} />}
                              Xác nhận trả
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

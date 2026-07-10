
import React, { useState, useMemo, useEffect } from 'react';
import { RecordFile, RecordStatus, User, Employee, RolePermissions, DEFAULT_ROLE_PERMISSIONS, UserRole, Holiday } from '../types';
import { getEmployeeTeam } from './AssignModal';
import StatusBadge from './StatusBadge';
import { Briefcase, ArrowRight, CheckCircle, Clock, Send, AlertTriangle, UserCog, ChevronLeft, ChevronRight, AlertCircle, Search, ArrowUp, ArrowDown, ArrowUpDown, Bell, CalendarClock, FileCheck, Map, CheckSquare, ClipboardList, FileDown, RotateCcw, CornerUpLeft, FileSignature } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { getShortRecordType } from '../constants';
import { confirmAction, isRecordOverdue, isRecordApproaching, getGcnWorkflowStepsHelper, isArchiveType, isMeasurementType, isRegType, getDisplayNotes } from '../utils/appHelpers';
import { updateRecordApi } from '../services/api';
import { fetchArchiveRecords, ArchiveRecord, saveArchiveRecord, syncRecordToVaoSo } from '../services/apiArchive';
import SubmitModal from './receive-record/SubmitModal';
import RejectReasonModal from './receive-record/RejectReasonModal';
import ReturnStepReasonModal from './receive-record/ReturnStepReasonModal';
import SystemAnnexTemplate from './receive-record/SystemAnnexTemplate';
import { generateDocxBlobAsync, hasTemplate, STORAGE_KEYS } from '../services/docxService';
import saveAs from 'file-saver';

interface PersonalProfileProps {
  user: User;
  records: RecordFile[];
  isDirector?: boolean;
  users: User[];
  employees: Employee[];
  rolePermissions?: RolePermissions;
  onUpdateStatus: (record: RecordFile, newStatus: RecordStatus) => void;
  onUpdateRecord?: (record: RecordFile) => Promise<RecordFile | null>;
  onViewRecord: (record: RecordFile) => void;
  onCreateLiquidation?: (record: RecordFile) => void; 
  onMapCorrection?: (record: RecordFile) => void; // New Handler Prop
  holidays?: Holiday[];
}

function removeVietnameseTones(str: string): string {
    if (!str) return '';
    str = str.toLowerCase();
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, "");
    str = str.replace(/\u02C6|\u0306|\u031B/g, "");
    str = str.replace(/ + /g, " ");
    str = str.trim();
    return str;
}

const PersonalProfile: React.FC<PersonalProfileProps> = ({ user, records, isDirector, users, employees, rolePermissions, onUpdateStatus, onUpdateRecord, onViewRecord, onCreateLiquidation, onMapCorrection, holidays }) => {
  const effectiveId = useMemo(() => {
    if (user.employeeId) return user.employeeId;
    // Tự động tìm nhân viên trùng khớp với tên hoặc tên đăng nhập của user nếu employeeId rỗng
    const foundEmp = employees.find(e => 
        e.name.trim().toLowerCase() === user.name.trim().toLowerCase() || 
        e.id.trim().toLowerCase() === user.username.trim().toLowerCase()
    );
    if (foundEmp) return foundEmp.id;
    return user.username || 'admin';
  }, [user, employees]);

  const [activeTab, setActiveTab] = useState<'pending' | 'pending_check' | 'pending_sign' | 'finished' | 'reminder'>(isDirector ? 'pending_sign' : 'pending');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof RecordFile; direction: 'asc' | 'desc' }>({
    key: 'deadline',
    direction: 'desc' 
  });

  const [warningFilter, setWarningFilter] = useState<'none' | 'overdue' | 'approaching'>('none');

  useEffect(() => {
    setWarningFilter('none');
    setCurrentPage(1);
  }, [activeTab]);

  const [archiveRecords, setArchiveRecords] = useState<ArchiveRecord[]>([]);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitCheckModalOpen, setIsSubmitCheckModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectTargetRecord, setRejectTargetRecord] = useState<RecordFile | null>(null);
  const [isReturnStepModalOpen, setIsReturnStepModalOpen] = useState(false);
  const [returnStepTargetRecord, setReturnStepTargetRecord] = useState<RecordFile | null>(null);
  const [submitTargetRecords, setSubmitTargetRecords] = useState<RecordFile[]>([]);
  const [returnTargetRecords, setReturnTargetRecords] = useState<RecordFile[]>([]);
  const [isAnnexModalOpen, setIsAnnexModalOpen] = useState(false);
  const [annexTargetRecord, setAnnexTargetRecord] = useState<RecordFile | null>(null);

  const { isTeamLeaderOrChecker, userTeam, teamEmployeeIds } = useMemo(() => {
    const emp = employees.find(e => e.id === effectiveId);
    const empPosition = (emp?.position || '').toLowerCase();
    const ut = emp ? getEmployeeTeam(emp) : '';
    const isLeader = user.role === UserRole.TEAM_LEADER || 
                     empPosition.includes('tổ trưởng') || 
                     empPosition.includes('tổ phó') || 
                     empPosition.includes('trưởng phòng') || 
                     empPosition.includes('phó phòng') || 
                     empPosition.includes('trưởng nhóm') || 
                     empPosition.includes('nhóm trưởng');
    const ids = employees
        .filter(e => getEmployeeTeam(e) === ut)
        .map(e => e.id);
    return {
      isTeamLeaderOrChecker: isLeader,
      userTeam: ut,
      teamEmployeeIds: ids
    };
  }, [effectiveId, employees, user.role]);

  useEffect(() => {
    const loadArchive = async () => {
        const saoluc = await fetchArchiveRecords('saoluc');
        const congvan = await fetchArchiveRecords('congvan');
        setArchiveRecords([...saoluc, ...congvan]);
    };
    loadArchive();
  }, []);

  const myRecords = useMemo(() => {
    const isDirectorOrLeader = (employeeId: string | null | undefined) => {
        if (!employeeId) return false;
        const emp = employees.find(e => e.id === employeeId);
        if (emp) {
            const dept = (emp.department || '').toLowerCase();
            const pos = (emp.position || '').toLowerCase();
            
            const removeAccents = (s: string) => {
              return s
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/đ/g, 'd')
                .replace(/Đ/g, 'D');
            };
            const cleanDept = removeAccents(dept);
            const cleanPos = removeAccents(pos);
            
            const isDirDeptClean = cleanDept.includes('ban giam doc') || cleanDept.includes('giam doc') || cleanDept.includes('ban lanh dao');
            const isDirPosClean = cleanPos.includes('giam doc') || cleanPos.includes('lanh dao') || cleanPos.includes('pho giam doc');
            const isLeaderPosClean = cleanPos.includes('to truong') || cleanPos.includes('to pho') || cleanPos.includes('truong phong') || cleanPos.includes('pho phong') || cleanPos.includes('truong nhom') || cleanPos.includes('nhom truong');
            
            if (isDirDeptClean || isDirPosClean || isLeaderPosClean) return true;
        }
        const associatedUser = users.find(u => u.employeeId === employeeId);
        if (associatedUser) {
            if (associatedUser.role === UserRole.TEAM_LEADER || associatedUser.role === UserRole.ADMIN) {
                return true;
            }
        }
        return false;
    };

    const mainRecords = records.filter(r => {
        // Tài khoản cá nhân (bao gồm cả Admin, Subadmin, Team leader...) chỉ hiện hồ sơ được giao việc trực tiếp cho cá nhân mình
        return (
            r.assignedTo === effectiveId ||
            r.checkedBy === effectiveId ||
            r.submittedTo === effectiveId ||
            r.receivedBy === effectiveId
        );
    });
    
    const mappedArchives = archiveRecords
        .filter(r => {
            // Chỉ hiển thị các hồ sơ lưu trữ của cá nhân mình được giao
            return (
                r.data?.assigned_to === effectiveId ||
                r.data?.checked_by === effectiveId ||
                r.data?.submitted_to === effectiveId
            );
        })
        .map(r => {
            // Map status
            let status = RecordStatus.RECEIVED;
            if (r.status === 'assigned') status = RecordStatus.IN_PROGRESS;
            else if (r.status === 'executed') status = RecordStatus.COMPLETED_WORK;
            else if (r.status === 'pending_sign') status = RecordStatus.PENDING_SIGN;
            else if (r.status === 'signed') status = RecordStatus.SIGNED;
            else if (r.status === 'completed') status = RecordStatus.RETURNED;

            return {
                id: r.id,
                code: r.so_hieu,
                customerName: r.noi_nhan_gui, // Sao lục: Chủ sử dụng, Công văn: Cơ quan phát hành
                recordType: r.type === 'saoluc' ? 'Sao lục' : 'Công văn',
                content: r.trich_yeu,
                receivedDate: r.ngay_thang,
                deadline: r.data?.hen_tra,
                status: status,
                assignedTo: r.data?.assigned_to,
                checkedBy: r.data?.checked_by,
                submittedTo: r.data?.submitted_to,
                ward: r.data?.xa_phuong,
                submissionDate: r.type === 'congvan' ? r.ngay_thang : undefined, // Example mapping
                // Fill other required fields with defaults or null
                phoneNumber: null,
                cccd: null,
                landPlot: r.data?.thua_dat,
                mapSheet: r.data?.to_ban_do,
                area: null,
                address: null,
                group: null,
                assignedDate: r.data?.assigned_date,
                approvalDate: null,
                completedDate: null,
                notes: r.data?.notes || null,
                privateNotes: r.data?.privateNotes || null,
                personalNotes: null,
                authorizedBy: null,
                authDocType: null,
                otherDocs: null,
                exportBatch: null,
                exportDate: null,
                measurementNumber: null,
                excerptNumber: null,
                reminderDate: null,
                lastRemindedAt: null,
                receiptNumber: null,
                receiverName: null,
                resultReturnedDate: null,
                needsMapCorrection: false
            } as RecordFile;
        });

    return [...mainRecords, ...mappedArchives];
  }, [records, archiveRecords, user.employeeId, effectiveId]);
  
  const isChecker = useMemo(() => {
      // Check via role permissions
      if (rolePermissions && rolePermissions[user.role]) {
          const perms = rolePermissions[user.role];
          if (perms.includes('*') || perms.includes('CHECK_RECORDS')) {
              return true;
          }
      } else {
          // Fallback to DEFAULT_ROLE_PERMISSIONS
          const perms = DEFAULT_ROLE_PERMISSIONS[user.role] || [];
          if (perms.includes('*') || perms.includes('CHECK_RECORDS')) {
              return true;
          }
      }
      if (!user.employeeId) return false;
      const emp = employees.find(e => e.id === user.employeeId);
      if (!emp) return false;
      const isDoDac = emp.department?.toLowerCase().includes('đo đạc') || emp.department?.toLowerCase().includes('kỹ thuật');
      const isLeader = emp.position?.toLowerCase().includes('tổ trưởng') || emp.position?.toLowerCase().includes('tổ phó');
      return isDoDac && isLeader;
  }, [user.employeeId, user.role, employees, rolePermissions]);

  const isMeasurementTeam = useMemo(() => {
      if (!user.employeeId) return false;
      const emp = employees.find(e => e.id === user.employeeId);
      if (!emp) return false;
      return emp.department?.toLowerCase().includes('đo đạc') || emp.department?.toLowerCase().includes('kỹ thuật') || emp.position?.toLowerCase().includes('đo đạc');
  }, [user.employeeId, employees]);

  // 1. Hồ sơ Đang thực hiện (ASSIGNED, IN_PROGRESS, COMPLETED_WORK, REJECTED, PENDING_SUPPLEMENT)
  const pendingRecords = useMemo(() => {
      let list = myRecords.filter(r => {
          const isAssigned = r.assignedTo === effectiveId;
          const isPendingOrActiveStatus = 
              r.status === RecordStatus.ASSIGNED || 
              r.status === RecordStatus.IN_PROGRESS || 
              r.status === RecordStatus.COMPLETED_WORK || 
              r.status === RecordStatus.REJECTED ||
              r.status === RecordStatus.PENDING_SUPPLEMENT;
          
          return isAssigned && isPendingOrActiveStatus;
      });
      return filterAndSort(list, searchTerm, sortConfig);
  }, [myRecords, searchTerm, sortConfig, effectiveId]);

  // 3. Hồ sơ Chờ kiểm tra (PENDING_CHECK, CHECKED) - Dành cho Tổ trưởng/Tổ phó hoặc người được giao hồ sơ theo dõi
  const pendingCheckRecords = useMemo(() => {
      let list = myRecords.filter(r => 
          (r.status === RecordStatus.PENDING_CHECK || r.status === RecordStatus.CHECKED) &&
          (r.checkedBy === effectiveId || r.assignedTo === effectiveId)
      );
      return filterAndSort(list, searchTerm, sortConfig);
  }, [myRecords, searchTerm, sortConfig, effectiveId]);

  // 4. Hồ sơ Chờ ký (PENDING_SIGN) - Dành cho người ký duyệt hoặc người được giao hồ sơ theo dõi
  const reviewRecords = useMemo(() => {
      let list = myRecords.filter(r => 
          r.status === RecordStatus.PENDING_SIGN &&
          (r.submittedTo === effectiveId || r.assignedTo === effectiveId || r.checkedBy === effectiveId)
      );
      return filterAndSort(list, searchTerm, sortConfig);
  }, [myRecords, searchTerm, sortConfig, effectiveId]);

  // 4. Hồ sơ Hoàn thành (SIGNED, HANDOVER, RETURNED, WITHDRAWN)
  const finishedRecords = useMemo(() => {
      let list = myRecords.filter(r => 
          (r.status === RecordStatus.SIGNED || 
           r.status === RecordStatus.HANDOVER || 
           r.status === RecordStatus.RETURNED ||
           r.status === RecordStatus.WITHDRAWN) &&
          (r.assignedTo === effectiveId || r.checkedBy === effectiveId || r.submittedTo === effectiveId || r.receivedBy === effectiveId)
      );
      return filterAndSort(list, searchTerm, sortConfig);
  }, [myRecords, searchTerm, sortConfig, effectiveId]);

  // 5. Hồ sơ Có hẹn nhắc việc
  const reminderRecords = useMemo(() => {
      let list = myRecords.filter(r => 
          r.reminderDate && 
          r.status !== RecordStatus.HANDOVER && 
          r.status !== RecordStatus.WITHDRAWN &&
          r.status !== RecordStatus.REJECTED &&
          r.status !== RecordStatus.RETURNED
      );
      // Logic search & sort riêng cho reminder
      if (searchTerm) {
          const lowerSearch = removeVietnameseTones(searchTerm);
          const rawSearch = searchTerm.toLowerCase();
          list = list.filter(r => {
             const nameNorm = removeVietnameseTones(r.customerName || '');
             const codeRaw = (r.code || '').toLowerCase();
             return nameNorm.includes(lowerSearch) || codeRaw.includes(rawSearch);
          });
      }
      return list.sort((a, b) => {
          const timeA = new Date(a.reminderDate!).getTime();
          const timeB = new Date(b.reminderDate!).getTime();
          return timeA - timeB;
      });
  }, [myRecords, searchTerm]);

  // Helper filter & sort chung
  function filterAndSort(list: RecordFile[], term: string, sort: any) {
      if (term) {
          const lowerSearch = removeVietnameseTones(term);
          const rawSearch = term.toLowerCase();
          list = list.filter(r => {
             const nameNorm = removeVietnameseTones(r.customerName || '');
             const codeRaw = (r.code || '').toLowerCase();
             const wardNorm = removeVietnameseTones(r.ward || '');
             return nameNorm.includes(lowerSearch) || codeRaw.includes(rawSearch) || wardNorm.includes(lowerSearch);
          });
      }

      const isReturnedOrRejected = (r: RecordFile) => {
          if (r.status === RecordStatus.REJECTED) return true;
          if (r.notes) {
              try {
                  const notesObj = JSON.parse(r.notes);
                  if (notesObj.isStepReturned) return true;
              } catch (e) {}
          }
          return false;
      };

      return list.sort((a, b) => {
          // 1. Urgency group priority
          const groupA = isRecordOverdue(a) ? 1 : (isRecordApproaching(a) ? 2 : 3);
          const groupB = isRecordOverdue(b) ? 1 : (isRecordApproaching(b) ? 2 : 3);
          
          if (groupA !== groupB) {
              return groupA - groupB; // 1 (overdue) first, then 2 (approaching), then 3 (normal)
          }

          // If in group 1 or 2, sort from most overdue downwards by remaining/overdue time (deadline ascending)
          if (groupA === 1 || groupA === 2) {
              const deadlineA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
              const deadlineB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
              return deadlineA - deadlineB;
          }

          // 2. Business status priority for normal files (Returned/Rejected)
          const aRet = isReturnedOrRejected(a);
          const bRet = isReturnedOrRejected(b);
          if (aRet && !bRet) return -1;
          if (!aRet && bRet) return 1;

          // 3. Normal sorting
          const aValue = a[sort.key as keyof RecordFile];
          const bValue = b[sort.key as keyof RecordFile];
          if (!aValue) return 1;
          if (!bValue) return -1;
          if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }

  // Tổng hợp các chỉ số
  const completedTotal = finishedRecords.length;

  // Xác định danh sách hiển thị dựa trên Tab đang chọn
  const displayRecords = 
      activeTab === 'pending' ? pendingRecords : 
      activeTab === 'pending_check' ? pendingCheckRecords :
      activeTab === 'pending_sign' ? reviewRecords :
      activeTab === 'finished' ? finishedRecords :
      reminderRecords;

  const tabWarningCounts = useMemo(() => {
      let overdue = 0;
      let approaching = 0;
      displayRecords.forEach(r => {
          if (isRecordOverdue(r)) overdue++;
          else if (isRecordApproaching(r)) approaching++;
      });
      return { overdue, approaching };
  }, [displayRecords]);

  const filteredDisplayRecords = useMemo(() => {
      let list = [...displayRecords];
      if (warningFilter === 'overdue') {
          list = list.filter(r => isRecordOverdue(r));
      } else if (warningFilter === 'approaching') {
          list = list.filter(r => isRecordApproaching(r));
      }
      return list;
  }, [displayRecords, warningFilter]);

  const totalPages = Math.ceil(filteredDisplayRecords.length / itemsPerPage);
  
  const paginatedDisplayRecords = useMemo(() => {
      const startIndex = (currentPage - 1) * itemsPerPage;
      return filteredDisplayRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredDisplayRecords, currentPage, itemsPerPage]);

  const handleSort = (key: keyof RecordFile) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
  };

  const handleExportExcel = () => {
      const dataToExport = displayRecords.map((r, idx) => ({
          'STT': idx + 1,
          'Mã hồ sơ': r.code,
          'Chủ sử dụng': r.customerName,
          'Số điện thoại': r.phoneNumber || '',
          'CCCD': r.cccd || '',
          'Loại hồ sơ': r.recordType,
          'Ngày nhận': r.receivedDate ? r.receivedDate.split('T')[0] : '',
          'Hẹn trả': r.deadline ? r.deadline.split('T')[0] : '',
          'Trạng thái': r.status,
          'Xã/Phường': r.ward || '',
          'Số tờ': r.mapSheet || '',
          'Số thửa': r.landPlot || '',
          'Diện tích': r.area || '',
          'Địa chỉ': r.address || '',
          'Nội dung': r.content || '',
          'Ngày giao việc': r.assignedDate ? r.assignedDate.split('T')[0] : '',
          'Ngày trình ký': r.submissionDate ? r.submissionDate.split('T')[0] : '',
          'Ngày duyệt': r.approvalDate ? r.approvalDate.split('T')[0] : '',
          'Ngày hoàn thành': r.completedDate ? r.completedDate.split('T')[0] : '',
          'Ngày trả kết quả': r.resultReturnedDate ? r.resultReturnedDate.split('T')[0] : '',
          'Ghi chú': getDisplayNotes(r.notes),
          'Ghi chú cá nhân': r.personalNotes || '',
          'Số trích đo': r.measurementNumber || '',
          'Số trích lục': r.excerptNumber || ''
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "HoSoCaNhan");
      XLSX.writeFile(wb, `HoSoCaNhan_${user.name}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // --- ACTIONS ---

  const handleSignRecord = async (record: RecordFile) => {
    if (await confirmAction(`Xác nhận ký duyệt hồ sơ ${record.code || record.receiptNumber}?\nHồ sơ sẽ chuyển sang trạng thái "Đã ký duyệt" và chuyển qua bước Chờ giao.`)) {
        const nowStr = new Date().toISOString();
        if (isArchiveType(record.recordType)) {
            const currentArchive = archiveRecords.find(r => r.id === record.id);
            if (currentArchive) {
                 const oldHistory = Array.isArray(currentArchive.data?.history) ? currentArchive.data.history : [];
                 const historyEntry = {
                     action: 'Ký duyệt',
                     status: 'signed',
                     timestamp: nowStr,
                     user: user.name
                 };
                 const newHistory = [...oldHistory, historyEntry];
                 const updatedData = {
                     ...currentArchive.data,
                     approval_date: nowStr,
                     history: newHistory
                 };
                 await saveArchiveRecord({
                     id: record.id,
                     status: 'signed',
                     data: updatedData
                 });
            }
        } else {
            const received = record.receivedDate || nowStr;
            const assigned = record.assignedDate || received;
            const completedWork = record.completedWorkDate || assigned;
            const pendingCheck = record.pendingCheckDate || completedWork;
            const checked = record.checkedDate || pendingCheck;
            const submission = record.submissionDate || checked;
            const approval = nowStr;

            const updatedRecord = {
                ...record,
                status: RecordStatus.SIGNED,
                assignedDate: record.assignedDate || assigned,
                completedWorkDate: record.completedWorkDate || completedWork,
                pendingCheckDate: record.pendingCheckDate || pendingCheck,
                checkedDate: record.checkedDate || checked,
                submissionDate: record.submissionDate || submission,
                approvalDate: approval
            };
            if (onUpdateRecord) {
                await onUpdateRecord(updatedRecord);
            } else {
                await updateRecordApi(updatedRecord);
                onUpdateStatus(record, RecordStatus.SIGNED);
            }
            // Tự động đồng bộ sang hồ sơ Vô số GCN
            await syncRecordToVaoSo(updatedRecord, updatedRecord.issueNumber, user.username);
        }
        
        const saoluc = await fetchArchiveRecords('saoluc');
        const congvan = await fetchArchiveRecords('congvan');
        setArchiveRecords([...saoluc, ...congvan]);
    }
  };

  const handleStartWork = async (record: RecordFile) => {
    if (await confirmAction(`Xác nhận bắt đầu thực hiện hồ sơ ${record.code}?\nHồ sơ sẽ chuyển sang trạng thái "Đang thực hiện".`)) {
        if (isArchiveType(record.recordType)) {
            const historyEntry = {
                action: 'Bắt đầu thực hiện',
                status: 'executing',
                timestamp: new Date().toISOString(),
                user: user.name
            };

            const currentArchive = archiveRecords.find(r => r.id === record.id);
            if (currentArchive) {
                 const oldHistory = Array.isArray(currentArchive.data?.history) ? currentArchive.data.history : [];
                 const newHistory = [...oldHistory, historyEntry];
                 
                 await saveArchiveRecord({
                     id: record.id,
                     status: 'assigned',
                     data: { ...currentArchive.data, history: newHistory }
                 });
                 
                 // Refresh data
                 const saoluc = await fetchArchiveRecords('saoluc');
                 const congvan = await fetchArchiveRecords('congvan');
                 setArchiveRecords([...saoluc, ...congvan]);
            }
        } else {
            // Normal Record
            onUpdateStatus(record, RecordStatus.IN_PROGRESS);
        }
    }
  };

  const handleMarkAsDone = async (record: RecordFile) => {
    if (await confirmAction(`Xác nhận đã hoàn thành công việc cho hồ sơ ${record.code}?\nHồ sơ sẽ chuyển sang trạng thái "Đã thực hiện".`)) {
        if (isArchiveType(record.recordType)) {
            // Handle Archive Record
            const archiveType = isArchiveType(record.recordType) ? 'saoluc' : 'congvan';
            // Find original record to get full data if needed, or just update status
            // We need to append history as well.
            
            const historyEntry = {
                action: 'Thực hiện xong',
                status: 'executed',
                timestamp: new Date().toISOString(),
                user: user.name
            };

            // We need to fetch the current record to get its data.history
            // Or we can just use the one from archiveRecords state
            const currentArchive = archiveRecords.find(r => r.id === record.id);
            if (currentArchive) {
                 const oldHistory = Array.isArray(currentArchive.data?.history) ? currentArchive.data.history : [];
                 const newHistory = [...oldHistory, historyEntry];
                 
                 await saveArchiveRecord({
                     id: record.id,
                     status: 'executed',
                     data: { ...currentArchive.data, history: newHistory }
                 });
                 
                 // Refresh data
                 const saoluc = await fetchArchiveRecords('saoluc');
                 const congvan = await fetchArchiveRecords('congvan');
                 setArchiveRecords([...saoluc, ...congvan]);
            }
        } else {
            // Normal Record
            onUpdateStatus(record, RecordStatus.COMPLETED_WORK);
        }
    }
  };

  const handleMarkAsChecked = async (record: RecordFile) => {
    if (await confirmAction(`Xác nhận đã kiểm tra hồ sơ ${record.code}?\nHồ sơ sẽ chuyển sang trạng thái "Đã kiểm tra".`)) {
        onUpdateStatus(record, RecordStatus.CHECKED);
    }
  };

  const handleForwardToSign = async (record: RecordFile) => {
    setSubmitTargetRecords([record]);
    setIsSubmitModalOpen(true);
  };

  const handleForwardToCheck = async (record: RecordFile) => {
    if (isRegType(record.recordType)) {
        const helper = getGcnWorkflowStepsHelper(record, holidays || []);
        const currentStep = helper?.steps[record.currentStepIndex ?? 0];
        const labelLower = (currentStep?.label || '').toLowerCase();
        if (labelLower.includes("in gcn") || labelLower.includes("in giấy") || labelLower.includes("in bản đồ")) {
            if (!record.issueNumber || !record.issueNumber.trim()) {
                alert('Khâu in GCN yêu cầu phải nhập số phát hành mới tiến hành trình thẩm tra. Vui lòng click vào chi tiết hồ sơ để thực hiện chuyển bước (Hệ thống sẽ tự động hiển thị ô nhập số phôi/số phát hành GCN).');
                return;
            }
        }
    }
    setSubmitTargetRecords([record]);
    setIsSubmitCheckModalOpen(true);
  };

  const handleConfirmSubmit = async (directorId: string) => {
    try {
        for (const record of submitTargetRecords) {
            if (isArchiveType(record.recordType)) {
                 // Handle Archive Record
                const nowStr = new Date().toISOString();
                const currentArchive = archiveRecords.find(r => r.id === record.id);
                if (currentArchive) {
                     const oldHistory = Array.isArray(currentArchive.data?.history) ? currentArchive.data.history : [];
                     
                     // Ghi nhận 2 trạng thái của kiểm tra tự động vào quy trình lịch sử nếu chưa có
                     const autoHistory: any[] = [];
                     if (currentArchive.status !== 'checked' && currentArchive.status !== 'pending_sign') {
                         autoHistory.push({
                             action: 'Trình kiểm tra',
                             status: 'pending_check',
                             timestamp: nowStr,
                             user: user.name
                         });
                         autoHistory.push({
                             action: 'Đã kiểm tra',
                             status: 'checked',
                             timestamp: nowStr,
                             user: user.name
                         });
                     }

                     const historyEntry = {
                         action: 'Trình ký',
                         status: 'pending_sign',
                         timestamp: nowStr,
                         user: user.name
                     };
                     const newHistory = [...oldHistory, ...autoHistory, historyEntry];
                     const assignedTo = currentArchive.data?.assigned_to || user.employeeId || null;

                     const updatedData = {
                         ...currentArchive.data,
                         completed_work_date: currentArchive.data?.completed_work_date || nowStr,
                         pending_check_date: currentArchive.data?.pending_check_date || nowStr,
                         checked_date: currentArchive.data?.checked_date || nowStr,
                         checked_by: currentArchive.data?.checked_by || ((user.role === UserRole.TEAM_LEADER || user.role === UserRole.SUBADMIN || user.role === UserRole.ADMIN) ? user.employeeId : null) || assignedTo,
                         submission_date: nowStr,
                         submitted_to: directorId,
                         history: newHistory
                     };
                     
                     await saveArchiveRecord({
                         id: record.id,
                         status: 'pending_sign',
                         data: updatedData
                     });
                }
            } else {
                // Normal Record
                const nowStr = new Date().toISOString();
                const isLuuTruAll = isArchiveType(record.recordType);
                const responsibleId = record.assignedTo || user.employeeId || null;

                const received = record.receivedDate || nowStr;
                const assigned = record.assignedDate || received;
                const completedWork = record.completedWorkDate || assigned;
                const pendingCheck = record.pendingCheckDate || completedWork;
                const checked = record.checkedDate || pendingCheck;
                const submission = nowStr;

                let extraUpdates: any = {};
                if (isRegType(record.recordType)) {
                    let currentStepIndex = record.currentStepIndex;
                    if (currentStepIndex === undefined || currentStepIndex === null) {
                        currentStepIndex = 0;
                    }
                    extraUpdates.currentStepIndex = currentStepIndex + 1;
                }

                const updatedRecord = {
                    ...record,
                    ...extraUpdates, status: RecordStatus.PENDING_SIGN,
                    submittedTo: directorId,
                    assignedDate: record.assignedDate || assigned,
                    completedWorkDate: record.completedWorkDate || completedWork,
                    pendingCheckDate: record.pendingCheckDate || pendingCheck,
                    checkedDate: record.checkedDate || checked,
                    submissionDate: submission,
                    checkedBy: record.checkedBy || ((user.role === UserRole.TEAM_LEADER || user.role === UserRole.SUBADMIN || user.role === UserRole.ADMIN) ? user.employeeId : null) || responsibleId
                };
                
                if (onUpdateRecord) {
                    await onUpdateRecord(updatedRecord);
                } else {
                    await updateRecordApi(updatedRecord);
                    onUpdateStatus(record, RecordStatus.PENDING_SIGN); // Fallback local state update
                }
            }
        }
        
        // Refresh archive data
        const saoluc = await fetchArchiveRecords('saoluc');
        const congvan = await fetchArchiveRecords('congvan');
        setArchiveRecords([...saoluc, ...congvan]);
        
        setIsSubmitModalOpen(false);
        setSubmitTargetRecords([]);
    } catch (error) {
        console.error("Error submitting records:", error);
        alert("Có lỗi xảy ra khi trình ký.");
    }
  };

  const handleWithdraw = async (record: RecordFile) => {
    if (await confirmAction(`Xác nhận thu hồi hồ sơ ${record.code || record.receiptNumber}?\nHồ sơ sẽ quay lại trạng thái "Đang thực hiện".`)) {
        let currentNotesObj: any = {};
        if (record.notes) {
            try {
                currentNotesObj = JSON.parse(record.notes);
            } catch (e) {}
        }
        delete currentNotesObj.isStepReturned;
        delete currentNotesObj.stepReturnReason;
        delete currentNotesObj.stepReturnDate;
        const updatedNotes = Object.keys(currentNotesObj).length > 0 ? JSON.stringify(currentNotesObj) : null;

        if (isArchiveType(record.recordType)) {
            const nowStr = new Date().toISOString();
            const historyEntry = {
                action: 'Thu hồi',
                status: 'assigned',
                timestamp: nowStr,
                user: user.name
            };

            const currentArchive = archiveRecords.find(r => r.id === record.id);
            if (currentArchive) {
                 const oldHistory = Array.isArray(currentArchive.data?.history) ? currentArchive.data.history : [];
                 const newHistory = [...oldHistory, historyEntry];
                 
                 await saveArchiveRecord({
                     id: record.id,
                     status: 'assigned',
                     noi_nhan_gui: currentArchive.noi_nhan_gui,
                     so_hieu: currentArchive.so_hieu,
                     trich_yeu: currentArchive.trich_yeu,
                     ngay_thang: currentArchive.ngay_thang,
                     type: currentArchive.type,
                     data: {
                         ...currentArchive.data,
                         history: newHistory,
                         notes: updatedNotes
                     }
                 });
                 
                 const saoluc = await fetchArchiveRecords('saoluc');
                 const congvan = await fetchArchiveRecords('congvan');
                 setArchiveRecords([...saoluc, ...congvan]);
            }
        } else if (isRegType(record.recordType)) {
            const workflow = getGcnWorkflowStepsHelper(record, holidays || []);
            let currentIdx = record.currentStepIndex;
            if (currentIdx === undefined || currentIdx === null) {
                currentIdx = 0;
            }
            if (currentIdx > 0) {
                const prevIdx = currentIdx - 1;
                const prevStep = workflow.steps[prevIdx];
                if (onUpdateRecord) {
                    await onUpdateRecord({
                        ...record,
                        currentStepIndex: prevIdx,
                        status: prevStep.overallStatus,
                        notes: updatedNotes
                    });
                } else {
                    onUpdateStatus(record, prevStep.overallStatus);
                }
            } else {
                if (onUpdateRecord) {
                    await onUpdateRecord({
                        ...record,
                        status: RecordStatus.ASSIGNED,
                        notes: updatedNotes
                    });
                } else {
                    onUpdateStatus(record, RecordStatus.ASSIGNED);
                }
            }
        } else {
            if (onUpdateRecord) {
                await onUpdateRecord({
                    ...record,
                    status: RecordStatus.ASSIGNED,
                    notes: updatedNotes
                });
            } else {
                onUpdateStatus(record, RecordStatus.ASSIGNED);
            }
        }
    }
  };

  const handleOpenRejectModal = (record: RecordFile) => {
      setRejectTargetRecord(record);
      setIsRejectModalOpen(true);
  };

  const handleOpenReturnStepModal = (record: RecordFile) => {
      setReturnStepTargetRecord(record);
      setIsReturnStepModalOpen(true);
  };

  const handleConfirmReturnStep = async (reason: string) => {
      if (!returnStepTargetRecord) return;
      try {
          const dateStr = new Date().toISOString();
          let currentNotesObj: any = {};
          if (returnStepTargetRecord.notes) {
              try {
                  currentNotesObj = JSON.parse(returnStepTargetRecord.notes);
              } catch (e) {
                  // ignore
              }
          }
          const updatedNotesObj = {
              ...currentNotesObj,
              isStepReturned: true,
              stepReturnReason: reason,
              stepReturnDate: dateStr
          };
          const updatedNotes = JSON.stringify(updatedNotesObj);
          
          const formattedDate = new Date().toLocaleDateString('vi-VN');
          const returnPrefix = `[Yêu cầu sửa lại ngày ${formattedDate}]: ${reason}`;
          const updatedPrivateNotes = returnStepTargetRecord.privateNotes 
              ? `${returnPrefix}\n${returnStepTargetRecord.privateNotes}` 
              : returnPrefix;

          const updatedRecord = {
              ...returnStepTargetRecord,
              status: RecordStatus.ASSIGNED,
              notes: updatedNotes,
              privateNotes: updatedPrivateNotes,
              hasDefect: isRegType(returnStepTargetRecord.recordType),
              pendingCheckDate: null,
              checkedBy: null,
              checkedDate: null,
              submissionDate: null,
              submittedTo: null,
              approvalDate: null,
              completedDate: null,
              completedWorkDate: null
          };

          if (isArchiveType(returnStepTargetRecord.recordType)) {
              const historyEntry = {
                  action: 'Trả về sửa lại',
                  status: 'assigned',
                  timestamp: dateStr,
                  user: user.name,
                  reason: reason
              };
              const currentArchive = archiveRecords.find(r => r.id === returnStepTargetRecord.id);
              if (currentArchive) {
                  const oldHistory = Array.isArray(currentArchive.data?.history) ? currentArchive.data.history : [];
                  const newHistory = [...oldHistory, historyEntry];
                  
                  await saveArchiveRecord({
                      id: returnStepTargetRecord.id,
                      status: 'assigned',
                      data: { 
                          ...currentArchive.data, 
                          history: newHistory,
                          notes: updatedNotes,
                          privateNotes: updatedPrivateNotes,
                          pending_check_date: null,
                          checked_by: null,
                          checked_date: null,
                          submission_date: null,
                          submitted_to: null,
                          approval_date: null,
                          completed_date: null,
                          completed_work_date: null
                      }
                  });
              }
              const saoluc = await fetchArchiveRecords('saoluc');
              const congvan = await fetchArchiveRecords('congvan');
              setArchiveRecords([...saoluc, ...congvan]);
          } else {
              if (onUpdateRecord) {
                  await onUpdateRecord(updatedRecord);
              } else {
                  await updateRecordApi(updatedRecord);
                  onUpdateStatus(returnStepTargetRecord, RecordStatus.ASSIGNED);
              }
          }

          setIsReturnStepModalOpen(false);
          setReturnStepTargetRecord(null);
      } catch (error) {
          console.error("Error returning step for record:", error);
          alert("Có lỗi xảy ra khi trả về hồ sơ.");
      }
  };

  const handleConfirmReject = async (reason: string) => {
      if (!rejectTargetRecord) return;
      try {
          const dateStr = new Date().toISOString();
          let currentNotesObj: any = {};
          if (rejectTargetRecord.notes) {
              try {
                  currentNotesObj = JSON.parse(rejectTargetRecord.notes);
              } catch (e) {
                  // ignore
              }
          }
          const updatedNotesObj = {
              ...currentNotesObj,
              rejectReason: reason,
              rejectDate: dateStr
          };
          const updatedNotes = JSON.stringify(updatedNotesObj);
          
          const formattedDate = new Date().toLocaleDateString('vi-VN');
          const rejectPrefix = `[Trả hồ sơ ngày ${formattedDate}]: ${reason}`;
          const updatedPrivateNotes = rejectTargetRecord.privateNotes 
              ? `${rejectPrefix}\n${rejectTargetRecord.privateNotes}` 
              : rejectPrefix;

          const updatedRecord = {
              ...rejectTargetRecord,
              status: RecordStatus.REJECTED,
              notes: updatedNotes,
              privateNotes: updatedPrivateNotes,
              rejectDate: dateStr,
              rejectReason: reason,
              hasDefect: isRegType(rejectTargetRecord.recordType),
              pendingCheckDate: null,
              checkedBy: null,
              checkedDate: null,
              submissionDate: null,
              submittedTo: null,
              approvalDate: null,
              completedDate: null,
              completedWorkDate: null
          };

          if (isArchiveType(rejectTargetRecord.recordType)) {
              const historyEntry = {
                  action: 'Trả hồ sơ',
                  status: 'rejected',
                  timestamp: dateStr,
                  user: user.name,
                  reason: reason
              };
              const currentArchive = archiveRecords.find(r => r.id === rejectTargetRecord.id);
              if (currentArchive) {
                  const oldHistory = Array.isArray(currentArchive.data?.history) ? currentArchive.data.history : [];
                  const newHistory = [...oldHistory, historyEntry];
                  
                  await saveArchiveRecord({
                      id: rejectTargetRecord.id,
                      status: 'rejected',
                      data: { 
                          ...currentArchive.data, 
                          history: newHistory,
                          notes: updatedNotes,
                          privateNotes: updatedPrivateNotes,
                          pending_check_date: null,
                          checked_by: null,
                          checked_date: null,
                          submission_date: null,
                          submitted_to: null,
                          approval_date: null,
                          completed_date: null,
                          completed_work_date: null
                      }
                  });
              }
              const saoluc = await fetchArchiveRecords('saoluc');
              const congvan = await fetchArchiveRecords('congvan');
              setArchiveRecords([...saoluc, ...congvan]);
          } else {
              if (onUpdateRecord) {
                  await onUpdateRecord(updatedRecord);
              } else {
                  await updateRecordApi(updatedRecord);
                  onUpdateStatus(rejectTargetRecord, RecordStatus.REJECTED);
              }
          }

          setIsRejectModalOpen(false);
          setRejectTargetRecord(null);
      } catch (error) {
          console.error("Error rejecting record:", error);
          alert("Có lỗi xảy ra khi trả hồ sơ.");
      }
  };

  const handleExportAnnex = async (record: RecordFile) => {
      const hasAnnexTemplate = hasTemplate(STORAGE_KEYS.CONTRACT_TEMPLATE_ANNEX);
      if (!hasAnnexTemplate) {
          alert("Chưa có mẫu Phụ lục gia hạn hợp đồng nào được cấu hình trong hệ thống.\nVui lòng vào mục Cài đặt hệ thống để cấu hình mẫu này.");
          return;
      }

      // Lấy thời gian mốc hợp đồng
      const dateHD = {
          day: '...',
          month: '...',
          year: '...'
      };
      
      const rDate = record.receivedDate || record.issueDate;
      if (rDate) {
          const d = new Date(rDate);
          if (!isNaN(d.getTime())) {
              dateHD.day = String(d.getDate()).padStart(2, '0');
              dateHD.month = String(d.getMonth() + 1).padStart(2, '0');
              dateHD.year = String(d.getFullYear());
          }
      }

      const printData = {
          MA_HS: record.code || '',
          NGAY_HD: dateHD.day,
          THANG_HD: dateHD.month,
          NAM_HD: dateHD.year,
          TEN: (record.customerName || '').toUpperCase(),
          DIACHI: record.address || record.customerAddress || record.ward || '',
          SDT: record.phoneNumber || ''
      };

      try {
          const blob = await generateDocxBlobAsync(STORAGE_KEYS.CONTRACT_TEMPLATE_ANNEX, printData);
          if (blob) {
              const fileName = `Phu_Luc_Gia_Han_${record.code || 'HS'}.docx`;
              
              const electron = (window as any).electronAPI;
              if (electron && electron.saveAndOpenFile) {
                  const reader = new FileReader();
                  reader.readAsDataURL(blob);
                  reader.onloadend = async () => {
                      if (!electron?.saveAndOpenFile) return;
                      const base64Data = (reader.result as string).split(',')[1];
                      const result = await electron.saveAndOpenFile({
                          fileName: fileName,
                          base64Data: base64Data
                      });
                      if (!result.success) {
                          alert(`Lỗi khi lưu file: ${result.message}`);
                      }
                  };
              } else {
                  // Web Fallback
                  saveAs(blob, fileName);
              }
          }
      } catch (err: any) {
          console.error("Lỗi khi xuất phụ lục:", err);
          alert("Lỗi xuất phụ lục: " + err.message);
      }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '---';
    const date = new Date(dateStr);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '---';
    const date = new Date(dateStr);
    const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${time} ${d}/${m}`;
  };

  const getDeadlineStatus = (record: RecordFile) => {
      // 1. Kiểm tra nếu đã hoàn thành/xuất hồ sơ thì KHÔNG tính trễ hạn
      // Nếu có exportBatch hoặc exportDate hoặc status là HANDOVER/RETURNED/SIGNED -> Coi như xong
      if (
          record.status === RecordStatus.HANDOVER || 
          record.status === RecordStatus.RETURNED || 
          record.status === RecordStatus.WITHDRAWN ||
          record.status === RecordStatus.REJECTED ||
          record.status === RecordStatus.SIGNED ||
          record.exportBatch || 
          record.exportDate ||
          record.resultReturnedDate
      ) {
           return { color: 'text-gray-400 font-medium', icon: null, text: '' };
      }

      // Check current GCN step deadline status
      if (record.recordType && isRegType(record.recordType)) {
          try {
              const workflow = getGcnWorkflowStepsHelper(record);
              const currentStep = workflow.steps.find(s => s.status === 'current');
              if (currentStep) {
                  if (currentStep.isOverdue) {
                      return { 
                          color: 'text-red-600 font-extrabold flex items-center gap-1 bg-red-50 border border-red-200 rounded px-1.5 py-0.5', 
                          icon: <AlertCircle size={14} className="text-red-600 animate-pulse" />, 
                          text: `Trễ bước: ${currentStep.label}` 
                      };
                  }
                  if (currentStep.isUrgent) {
                      return { 
                          color: 'text-amber-600 font-bold flex items-center gap-1 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5', 
                          icon: <Clock size={14} className="text-amber-600" />, 
                          text: `Sắp trễ: ${currentStep.label}` 
                      };
                  }
              }
          } catch (e) {
              console.error('Error tracking GCN workflow steps:', e);
          }
      }

      // 2. Nếu chưa xong, kiểm tra deadline chung
      const deadlineStr = record.deadline;
      if (!deadlineStr) return { color: 'text-gray-600', icon: null, text: '' };
      
      const today = new Date();
      today.setHours(0,0,0,0);
      const deadline = new Date(deadlineStr);
      deadline.setHours(0,0,0,0);

      const diffTime = deadline.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) return { color: 'text-red-600 font-bold', icon: <AlertCircle size={14} />, text: '(Quá hạn)' };
      if (diffDays <= 2) return { color: 'text-orange-600 font-bold', icon: <Clock size={14} />, text: '(Gấp)' };
      return { color: 'text-gray-600', icon: null, text: '' };
  };

  const renderSortHeader = (label: string, key: keyof RecordFile, align: 'left' | 'center' = 'center') => {
      const isSorted = sortConfig.key === key;
      return (
          <div className={`flex items-center gap-1 cursor-pointer select-none ${align === 'center' ? 'justify-center' : 'justify-start'}`} onClick={() => handleSort(key)}>
              {label}
              <span className="text-gray-400">
                {isSorted ? (
                    sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-blue-600"/> : <ArrowDown size={12} className="text-blue-600"/>
                ) : <ArrowUpDown size={12} />}
              </span>
          </div>
      );
  };

  // Helper để lấy tên Tab hiện tại cho placeholder
  const getTabLabel = () => {
      switch(activeTab) {
          case 'pending': return 'Đang thực hiện';
          case 'pending_check': return 'Chờ kiểm tra';
          case 'pending_sign': return 'Chờ ký';
          case 'finished': return 'Hoàn thành';
          case 'reminder': return 'Nhắc việc';
          default: return 'danh sách';
      }
  };

  if (!user.employeeId) {
    return (
        <div className="flex flex-col items-center justify-center h-96 bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="bg-orange-100 p-4 rounded-full mb-4">
                <UserCog size={48} className="text-orange-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Tài khoản chưa liên kết nhân sự</h2>
            <p className="text-gray-600 max-w-md mb-6">
                Tài khoản <strong>{user.username}</strong> hiện là quản trị viên hệ thống nhưng chưa được liên kết với hồ sơ nhân viên cụ thể.
            </p>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4 animate-fade-in-up overflow-hidden">
      {/* Header thống kê */}
      <div className="bg-white p-3 md:p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4 shrink-0">
        <div className="text-center md:text-left">
          <h2 className="text-base md:text-2xl font-bold text-gray-800 flex items-center justify-center md:justify-start gap-1.5 md:gap-2">
             <Briefcase size={18} className="text-blue-600 shrink-0 md:w-6 md:h-6" />
             <span className="truncate">Xin chào, {user.name}</span>
          </h2>
          <p className="hidden sm:block text-xs md:text-sm text-gray-500 mt-0.5 md:mt-1">Danh sách hồ sơ bạn đang phụ trách.</p>
        </div>
        <div className="flex flex-row gap-1.5 md:gap-4 w-full md:w-auto justify-between md:justify-end">
             {!isDirector && (
                 <>
                     <div className="flex-1 md:flex-none text-center px-1 py-1 md:px-4 md:py-2 bg-blue-50 rounded-lg border border-blue-100 min-w-0 md:min-w-[100px]">
                        <div className="text-sm sm:text-base md:text-2xl font-extrabold text-blue-700">{pendingRecords.length}</div>
                        <div className="text-[9px] sm:text-[10px] md:text-xs text-blue-600 uppercase font-bold truncate">Đang xử lý</div>
                     </div>
                     <div className="flex-1 md:flex-none text-center px-1 py-1 md:px-4 md:py-2 bg-orange-50 rounded-lg border border-orange-100 min-w-0 md:min-w-[100px]">
                        <div className="text-sm sm:text-base md:text-2xl font-extrabold text-orange-700">{pendingCheckRecords.length}</div>
                        <div className="text-[9px] sm:text-[10px] md:text-xs text-orange-600 uppercase font-bold truncate">Cần kiểm</div>
                     </div>
                     <div className="flex-1 md:flex-none text-center px-1 py-1 md:px-4 md:py-2 bg-purple-50 rounded-lg border border-purple-100 min-w-0 md:min-w-[100px]">
                        <div className="text-sm sm:text-base md:text-2xl font-extrabold text-purple-700">{reviewRecords.length}</div>
                        <div className="text-[9px] sm:text-[10px] md:text-xs text-purple-600 uppercase font-bold truncate">Chờ ký</div>
                     </div>
                 </>
             )}
             <div className="flex-1 md:flex-none text-center px-1 py-1 md:px-4 md:py-2 bg-green-50 rounded-lg border border-green-100 min-w-0 md:min-w-[100px]">
                <div className="text-sm sm:text-base md:text-2xl font-extrabold text-green-700">{finishedRecords.length}</div>
                <div className="text-[9px] sm:text-[10px] md:text-xs text-green-600 uppercase font-bold truncate">Hoàn thành</div>
             </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-0">
        
        {/* TABS & SEARCH */}
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
            <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm overflow-x-auto max-w-full">
                {!isDirector && (
                    <>
                        <button 
                            onClick={() => { setActiveTab('pending'); setCurrentPage(1); setSearchTerm(''); }}
                            className={`flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                                activeTab === 'pending' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            <Clock size={16} className="shrink-0" />
                            <span className="hidden sm:inline">Đang thực hiện</span>
                            <span>({pendingRecords.length})</span>
                        </button>
                        <button 
                            onClick={() => { setActiveTab('pending_check'); setCurrentPage(1); setSearchTerm(''); }}
                            className={`flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                                activeTab === 'pending_check' ? 'bg-orange-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            <ClipboardList size={16} className="shrink-0" />
                            <span className="hidden sm:inline">Chờ kiểm tra</span>
                            <span>({pendingCheckRecords.length})</span>
                        </button>
                    </>
                )}
                <button 
                    onClick={() => { setActiveTab('pending_sign'); setCurrentPage(1); setSearchTerm(''); }}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                        activeTab === 'pending_sign' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <Send size={16} className="shrink-0" />
                    <span className="hidden sm:inline">Chờ ký</span>
                    <span>({reviewRecords.length})</span>
                </button>
                <button 
                    onClick={() => { setActiveTab('finished'); setCurrentPage(1); setSearchTerm(''); }}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                        activeTab === 'finished' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <FileCheck size={16} className="shrink-0" />
                    <span className="hidden sm:inline">Hoàn thành</span>
                    <span>({finishedRecords.length})</span>
                </button>
                {!isDirector && (
                    <button 
                        onClick={() => { setActiveTab('reminder'); setCurrentPage(1); setSearchTerm(''); }}
                        className={`flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                            activeTab === 'reminder' ? 'bg-pink-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        <Bell size={16} className="shrink-0" />
                        <span className="hidden sm:inline">Nhắc việc</span>
                        <span>({reminderRecords.length})</span>
                    </button>
                )}
            </div>
            
            <div className="flex flex-row items-center gap-1 w-full md:w-auto md:gap-1.5 mt-2 md:mt-0 shrink-0">
                <div className="relative w-[30%] sm:w-[35%] md:w-64 shrink-0">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                    <input 
                        type="text" 
                        placeholder="Tìm..."
                        className="w-full pl-6 pr-1 py-1.5 border border-gray-200 rounded-lg text-[11px] sm:text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    />
                </div>
                
                {/* Overdue Button */}
                <button
                    onClick={() => setWarningFilter(prev => prev === 'overdue' ? 'none' : 'overdue')}
                    className={`flex items-center justify-center gap-0.5 px-1.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-colors shadow-sm border shrink-0 ${warningFilter === 'overdue' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-600 border-red-200 hover:bg-red-50'}`}
                    title="Hồ sơ trễ hạn"
                >
                    <AlertTriangle size={12} className={warningFilter === 'overdue' ? 'text-white' : 'text-red-500'} />
                    <span>Trễ: {tabWarningCounts.overdue}</span>
                </button>

                {/* Approaching Button */}
                <button
                    onClick={() => setWarningFilter(prev => prev === 'approaching' ? 'none' : 'approaching')}
                    className={`flex items-center justify-center gap-0.5 px-1.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-colors shadow-sm border shrink-0 ${warningFilter === 'approaching' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-orange-600 border-orange-200 hover:bg-orange-50'}`}
                    title="Hồ sơ tới hạn"
                >
                    <Clock size={12} className={warningFilter === 'approaching' ? 'text-white' : 'text-orange-500'} />
                    <span>Tới: {tabWarningCounts.approaching}</span>
                </button>

                <button 
                    onClick={handleExportExcel}
                    className="flex items-center justify-center gap-1 px-2 py-1.5 bg-green-600 text-white rounded-lg text-[10px] sm:text-xs font-bold hover:bg-green-700 transition-colors whitespace-nowrap shrink-0 ml-auto"
                    title="Xuất Excel"
                >
                    <FileDown size={12} />
                    <span>Xuất DS</span>
                </button>
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
            {filteredDisplayRecords.length > 0 ? (
                <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block">
                        <table className="w-full text-left table-fixed min-w-[1160px]">
                            <thead className="bg-white border-b border-gray-200 text-xs text-gray-500 uppercase sticky top-0 shadow-sm z-10">
                                <tr>
                                    <th className="p-3 w-10 text-center">#</th>
                                    <th className="p-3 w-[120px] text-center">{renderSortHeader('Mã HS', 'code', 'center')}</th>
                                    <th className="p-3 w-[180px] text-center">{renderSortHeader('Chủ sử dụng', 'customerName', 'center')}</th>
                                    <th className="p-3 w-[110px] text-left">{renderSortHeader('Loại hồ sơ', 'recordType', 'left')}</th>
                                    <th className="p-3 w-[130px] text-center">{renderSortHeader('Ngày giao việc', 'assignedDate', 'center')}</th>
                                    
                                    {/* Conditional columns for Ngày trình / Ngày trình kiểm tra */}
                                    {activeTab === 'pending_check' && (
                                        <th className="p-3 w-[140px] text-center">{renderSortHeader('Ngày trình kiểm tra', 'pendingCheckDate', 'center')}</th>
                                    )}
                                    {activeTab === 'pending_sign' && (
                                        <th className="p-3 w-[110px] text-center">{renderSortHeader('Ngày trình', 'submissionDate', 'center')}</th>
                                    )}
                                    {activeTab === 'finished' && (
                                        <>
                                            <th className="p-3 w-[140px] text-center">{renderSortHeader('Ngày trình kiểm tra', 'pendingCheckDate', 'center')}</th>
                                            <th className="p-3 w-[110px] text-center">{renderSortHeader('Ngày trình', 'submissionDate', 'center')}</th>
                                        </>
                                    )}

                                    <th className="p-3 w-[150px] text-center">
                                        {activeTab === 'reminder' 
                                            ? <div className="flex items-center justify-center gap-1 text-pink-600"><CalendarClock size={14}/> Thời gian nhắc</div>
                                            : renderSortHeader('Hẹn trả', 'deadline', 'center')
                                        }
                                    </th>
                                    
                                    {activeTab === 'pending_check' && (
                                        <th className="p-3 w-[150px] text-center">Người kiểm tra</th>
                                    )}

                                    <th className="p-3 text-center w-[120px]">Trạng thái</th>
                                    <th className="p-3 text-center w-[100px]">Chỉnh lý</th>
                                    <th className="p-3 text-center w-[180px]">Thao tác chính</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {paginatedDisplayRecords.map((r, index) => {
                                    const deadlineStatus = getDeadlineStatus(r);
                                    const rowClass = activeTab === 'reminder' ? 'hover:bg-pink-50/50 bg-pink-50/10' : 'hover:bg-blue-50/50';
                                    
                                    return (
                                        <tr key={r.id} className={`${rowClass} transition-colors`}>
                                            <td className="p-3 text-center text-gray-400 text-xs align-middle">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                                            <td className="p-3 font-medium text-blue-600 align-middle text-center"><div className="truncate text-center" title={r.code || ''}>{r.code}</div></td>
                                            <td className="p-3 font-medium text-gray-800 align-middle text-center"><div className="truncate text-center" title={r.customerName || ''}>{r.customerName}</div></td>
                                            <td className="p-3 text-gray-600 align-middle text-left"><div className="truncate text-left" title={r.recordType || ''}>{getShortRecordType(r.recordType || undefined)}</div></td>
                                            <td className="p-3 text-gray-600 align-middle text-center">{formatDate(r.assignedDate || undefined)}</td>
                                            
                                            {/* Conditional data cells for Ngày trình / Ngày trình kiểm tra */}
                                            {activeTab === 'pending_check' && (
                                                <td className="p-3 text-gray-600 align-middle text-center">{formatDate(r.pendingCheckDate || undefined)}</td>
                                            )}
                                            {activeTab === 'pending_sign' && (
                                                <td className="p-3 text-gray-600 align-middle text-center">{formatDate(r.submissionDate || undefined)}</td>
                                            )}
                                            {activeTab === 'finished' && (
                                                <>
                                                    <td className="p-3 text-gray-600 align-middle text-center">{formatDate(r.pendingCheckDate || undefined)}</td>
                                                    <td className="p-3 text-gray-600 align-middle text-center">{formatDate(r.submissionDate || undefined)}</td>
                                                </>
                                            )}
                                            
                                            <td className="p-3 align-middle text-center">
                                                <div className="flex justify-center">
                                                    {activeTab === 'reminder' ? (
                                                        <div className="flex items-center gap-1.5 text-pink-700 font-bold bg-pink-100 px-2 py-1 rounded w-fit text-xs">
                                                            <Bell size={12} className="fill-pink-700"/>
                                                            {formatDateTime(r.reminderDate || undefined)}
                                                        </div>
                                                    ) : (
                                                        <div className={`flex items-center gap-1.5 ${deadlineStatus.color}`}>
                                                            {deadlineStatus.icon}
                                                            <span>{formatDate(r.deadline || undefined)}</span>
                                                            <span className="text-[10px] uppercase ml-1">{deadlineStatus.text}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {activeTab === 'pending_check' && (
                                                <td className="p-3 text-gray-600 align-middle text-center">
                                                    <div className="truncate text-center" title={r.checkedBy ? employees.find(e => e.id === r.checkedBy)?.name : ''}>
                                                        {r.checkedBy ? employees.find(e => e.id === r.checkedBy)?.name : '---'}
                                                    </div>
                                                </td>
                                            )}

                                            <td className="p-3 text-center align-middle">
                                                <StatusBadge status={r.status} recordType={r.recordType} record={r} />
                                                {r.status === RecordStatus.REJECTED && (
                                                    <span className="mt-1 block text-[10px] font-bold bg-red-100 text-red-800 px-1 py-0.5 rounded border border-red-200 text-center mx-auto max-w-[100px]">
                                                        Hồ sơ bị trả
                                                    </span>
                                                )}
                                                {(() => {
                                                    if (r.notes) {
                                                        try {
                                                            const notesObj = JSON.parse(r.notes);
                                                            if (notesObj.isStepReturned) {
                                                                return (
                                                                    <span className="mt-1 block text-[10px] font-bold bg-amber-100 text-amber-800 px-1 py-0.5 rounded border border-amber-200 text-center mx-auto max-w-[100px]" title={`Lý do: ${notesObj.stepReturnReason || ''}`}>
                                                                        Yêu cầu sửa
                                                                    </span>
                                                                );
                                                            }
                                                        } catch (e) {}
                                                    }
                                                    return null;
                                                })()}
                                            </td>
                                            
                                            <td className="p-3 text-center align-middle">
                                                {onMapCorrection && (
                                                    <button 
                                                        onClick={() => onMapCorrection(r)}
                                                        className={`flex items-center justify-center gap-1 px-2 py-1 rounded border transition-all text-[10px] font-bold shadow-sm mx-auto ${
                                                            r.needsMapCorrection 
                                                            ? 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100 w-full' 
                                                            : 'bg-white text-gray-400 border-gray-200 hover:text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                        title={r.needsMapCorrection ? "Đang có yêu cầu. Bấm để HỦY." : "Yêu cầu chỉnh lý bản đồ"}
                                                    >
                                                        <Map size={14} className={r.needsMapCorrection ? "fill-orange-100" : ""} />
                                                        {r.needsMapCorrection && <span>CHỈNH LÝ</span>}
                                                    </button>
                                                )}
                                            </td>

                                            <td className="p-3 align-middle">
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => onViewRecord(r)} className="px-2 py-1.5 border border-gray-200 rounded-md text-gray-600 hover:bg-white hover:border-blue-300 hover:text-blue-600 text-xs font-medium transition-all shadow-sm">
                                                        Chi tiết
                                                    </button>
                                                    
                                                    {/* Logic nút chuyển trạng thái theo từng Tab */}
                                                    {activeTab === 'pending' && (
                                                        <>
                                                            {r.status === RecordStatus.PENDING_CHECK || r.status === RecordStatus.CHECKED || r.status === RecordStatus.PENDING_SIGN ? (
                                                                <button onClick={() => handleWithdraw(r)} title="Thu hồi hồ sơ" className="px-3 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-xs font-bold flex items-center gap-2 shadow-sm transition-all">
                                                                    <RotateCcw size={14} /> Thu hồi
                                                                </button>
                                                            ) : (
                                                                <>
                                                                    {(isArchiveType(r.recordType) || r.recordType === 'Sao lục' || r.recordType === 'Công văn' || r.recordType === '1.1 Công văn' || r.recordType === '1.2 Công văn') ? (
                                                                        <button onClick={() => handleForwardToSign(r)} title="Trình ký duyệt" className="px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-xs font-bold flex items-center gap-2 shadow-sm transition-all">
                                                                            <Send size={14} /> Trình ký
                                                                        </button>
                                                                    ) : (
                                                                        <button onClick={() => handleForwardToCheck(r)} title="Trình kiểm tra" className="px-3 py-1.5 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-xs font-bold flex items-center gap-2 shadow-sm transition-all">
                                                                            <ClipboardList size={14} /> Trình KT
                                                                        </button>
                                                                    )}
                                                                    <button onClick={() => handleOpenRejectModal(r)} title="Trả hồ sơ" className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs font-bold flex items-center gap-2 shadow-sm transition-all">
                                                                        <AlertTriangle size={14} /> Trả HS
                                                                    </button>
                                                                </>
                                                            )}
                                                        </>
                                                    )}
                                                    {activeTab === 'pending_check' && (r.status === RecordStatus.PENDING_CHECK || r.status === RecordStatus.CHECKED) && (r.checkedBy === user.employeeId || r.checkedBy === effectiveId) && (
                                                        <>
                                                            <button onClick={() => handleForwardToSign(r)} title="Trình ký duyệt" className="px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-xs font-bold flex items-center gap-2 shadow-sm transition-all">
                                                                <Send size={14} /> Trình ký
                                                            </button>
                                                            <button onClick={() => handleOpenReturnStepModal(r)} title="Trả về bước trước" className="px-3 py-1.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-xs font-bold flex items-center gap-2 shadow-sm transition-all">
                                                                <RotateCcw size={14} /> Trả về
                                                            </button>
                                                        </>
                                                    )}
                                                    {activeTab === 'pending_check' && r.status === RecordStatus.PENDING_CHECK && r.assignedTo === user.employeeId && (
                                                        <button onClick={() => handleWithdraw(r)} title="Thu hồi hồ sơ" className="px-3 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-xs font-bold flex items-center gap-2 shadow-sm transition-all">
                                                            <RotateCcw size={14} /> Thu hồi
                                                        </button>
                                                    )}
                                                    {activeTab === 'pending_sign' && (r.submittedTo === user.employeeId || r.submittedTo === effectiveId) && (
                                                        <>
                                                            <button onClick={() => handleSignRecord(r)} title="Ký duyệt" className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 text-xs font-bold flex items-center gap-2 shadow-sm transition-all">
                                                                <FileSignature size={14} /> Ký duyệt
                                                            </button>
                                                            <button onClick={() => handleOpenReturnStepModal(r)} title="Trả về bước trước" className="px-3 py-1.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-xs font-bold flex items-center gap-2 shadow-sm transition-all">
                                                                <RotateCcw size={14} /> Trả về
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards View */}
                    <div className="block md:hidden space-y-3 p-3 bg-slate-50/50">
                        {paginatedDisplayRecords.map((r, index) => {
                            const deadlineStatus = getDeadlineStatus(r);
                            return (
                                <div key={r.id} className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-100 flex flex-col gap-3 text-left">
                                    {/* Header: Index, Code, Status & Return markers */}
                                    <div className="flex justify-between items-start gap-2 border-b border-slate-100/60 pb-2.5">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider font-mono">
                                                    Mã: {r.code}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-mono">#{(currentPage - 1) * itemsPerPage + index + 1}</span>
                                            </div>
                                            <h3 className="font-extrabold text-slate-800 text-sm mt-1 leading-snug break-words">
                                                {r.customerName}
                                            </h3>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                            <StatusBadge status={r.status} recordType={r.recordType} record={r} />
                                            {r.status === RecordStatus.REJECTED && (
                                                <span className="text-[9px] font-bold bg-red-100 text-red-800 px-1.5 py-0.5 rounded border border-red-200">
                                                    Hồ sơ bị trả
                                                </span>
                                            )}
                                            {(() => {
                                                if (r.notes) {
                                                    try {
                                                        const notesObj = JSON.parse(r.notes);
                                                        if (notesObj.isStepReturned) {
                                                            return (
                                                                <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200" title={`Lý do: ${notesObj.stepReturnReason || ''}`}>
                                                                    Yêu cầu sửa
                                                                </span>
                                                            );
                                                        }
                                                    } catch (e) {}
                                                }
                                                return null;
                                            })()}
                                        </div>
                                    </div>

                                    {/* Body info grid */}
                                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-slate-50/55 p-2 rounded-lg border border-slate-100/50">
                                        <div>
                                            <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Loại hồ sơ</span>
                                            <span className="font-semibold text-slate-700 truncate block" title={r.recordType || ''}>
                                                {getShortRecordType(r.recordType || undefined)}
                                            </span>
                                        </div>
                                        
                                        <div>
                                            <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Ngày nhận việc</span>
                                            <span className="font-semibold text-slate-700 block">
                                                {formatDate(r.assignedDate || undefined)}
                                            </span>
                                        </div>

                                        <div>
                                            <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">
                                                {activeTab === 'reminder' ? 'Thời gian nhắc' : 'Hẹn trả'}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                {activeTab === 'reminder' ? (
                                                    <div className="flex items-center gap-1 text-pink-700 font-bold bg-pink-100 px-1.5 py-0.5 rounded text-[10px]">
                                                        <Bell size={10} className="fill-pink-700"/>
                                                        {formatDateTime(r.reminderDate || undefined)}
                                                    </div>
                                                ) : (
                                                    <div className={`flex items-center gap-1 font-bold ${deadlineStatus.color}`}>
                                                        {deadlineStatus.icon && React.cloneElement(deadlineStatus.icon as React.ReactElement, { size: 11 })}
                                                        <span className="text-xs">{formatDate(r.deadline || undefined)}</span>
                                                        <span className="text-[9px] uppercase ml-0.5">{deadlineStatus.text}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {activeTab === 'pending_check' && (
                                            <div>
                                                <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Người kiểm tra</span>
                                                <span className="font-semibold text-slate-700 truncate block" title={r.checkedBy ? employees.find(e => e.id === r.checkedBy)?.name : ''}>
                                                    {r.checkedBy ? employees.find(e => e.id === r.checkedBy)?.name : '---'}
                                                </span>
                                            </div>
                                        )}

                                        {activeTab === 'pending_check' && r.pendingCheckDate && (
                                            <div>
                                                <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Ngày trình KT</span>
                                                <span className="font-semibold text-slate-700 block">
                                                    {formatDate(r.pendingCheckDate || undefined)}
                                                </span>
                                            </div>
                                        )}

                                        {activeTab === 'pending_sign' && r.submissionDate && (
                                            <div>
                                                <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Ngày trình ký</span>
                                                <span className="font-semibold text-slate-700 block">
                                                    {formatDate(r.submissionDate || undefined)}
                                                </span>
                                            </div>
                                        )}

                                        {activeTab === 'finished' && (
                                            <>
                                                {r.pendingCheckDate && (
                                                    <div>
                                                        <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Ngày trình KT</span>
                                                        <span className="font-semibold text-slate-700 block">
                                                            {formatDate(r.pendingCheckDate || undefined)}
                                                        </span>
                                                    </div>
                                                )}
                                                {r.submissionDate && (
                                                    <div>
                                                        <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Ngày trình ký</span>
                                                        <span className="font-semibold text-slate-700 block">
                                                            {formatDate(r.submissionDate || undefined)}
                                                        </span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* Action row footer */}
                                    <div className="flex items-center justify-between gap-1.5 border-t border-slate-100/60 pt-2.5 mt-1">
                                        <div className="flex gap-1.5 flex-wrap">
                                            <button 
                                                onClick={() => onViewRecord(r)} 
                                                className="px-2.5 py-1.5 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-600 rounded-lg text-xs font-bold transition-all bg-white shadow-2xs"
                                            >
                                                Chi tiết
                                            </button>

                                            {onMapCorrection && (
                                                <button 
                                                    onClick={() => onMapCorrection(r)}
                                                    className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border transition-all text-xs font-bold shadow-2xs ${
                                                        r.needsMapCorrection 
                                                        ? 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100' 
                                                        : 'bg-white text-slate-400 border-slate-200 hover:text-slate-600 hover:bg-slate-50'
                                                    }`}
                                                    title={r.needsMapCorrection ? "Đang có yêu cầu. Bấm để HỦY." : "Yêu cầu chỉnh lý bản đồ"}
                                                >
                                                    <Map size={12} className={r.needsMapCorrection ? "fill-orange-100" : ""} />
                                                    {r.needsMapCorrection && <span>Chỉnh lý</span>}
                                                </button>
                                            )}
                                        </div>

                                        {/* Main flow actions aligned on the right */}
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {activeTab === 'pending' && (
                                                <>
                                                    {r.status === RecordStatus.PENDING_CHECK || r.status === RecordStatus.CHECKED || r.status === RecordStatus.PENDING_SIGN ? (
                                                        <button 
                                                            onClick={() => handleWithdraw(r)} 
                                                            title="Thu hồi hồ sơ" 
                                                            className="px-2.5 py-1.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-xs font-bold flex items-center gap-1 shadow-2xs transition-all"
                                                        >
                                                            <RotateCcw size={12} /> Thu hồi
                                                        </button>
                                                    ) : (
                                                        <>
                                                            {(isArchiveType(r.recordType) || r.recordType === 'Sao lục' || r.recordType === 'Công văn' || r.recordType === '1.1 Công văn' || r.recordType === '1.2 Công văn') ? (
                                                                <button 
                                                                    onClick={() => handleForwardToSign(r)} 
                                                                    title="Trình ký duyệt" 
                                                                    className="px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs font-bold flex items-center gap-1 shadow-2xs transition-all"
                                                                >
                                                                    <Send size={12} /> Trình ký
                                                                </button>
                                                            ) : (
                                                                <button 
                                                                    onClick={() => handleForwardToCheck(r)} 
                                                                    title="Trình kiểm tra" 
                                                                    className="px-2.5 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-xs font-bold flex items-center gap-1 shadow-2xs transition-all"
                                                                >
                                                                    <ClipboardList size={12} /> Trình KT
                                                                </button>
                                                            )}
                                                            <button 
                                                                onClick={() => handleOpenRejectModal(r)} 
                                                                title="Trả hồ sơ" 
                                                                className="px-2.5 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-bold flex items-center gap-1 shadow-2xs transition-all"
                                                            >
                                                                <AlertTriangle size={12} /> Trả HS
                                                            </button>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                            
                                            {activeTab === 'pending_check' && (r.status === RecordStatus.PENDING_CHECK || r.status === RecordStatus.CHECKED) && (r.checkedBy === user.employeeId || r.checkedBy === effectiveId) && (
                                                <>
                                                    <button 
                                                        onClick={() => handleForwardToSign(r)} 
                                                        title="Trình ký duyệt" 
                                                        className="px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs font-bold flex items-center gap-1 shadow-2xs transition-all"
                                                    >
                                                        <Send size={12} /> Trình ký
                                                    </button>
                                                    <button 
                                                        onClick={() => handleOpenReturnStepModal(r)} 
                                                        title="Trả về bước trước" 
                                                        className="px-2.5 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-xs font-bold flex items-center gap-1 shadow-2xs transition-all"
                                                    >
                                                        <RotateCcw size={12} /> Trả về
                                                    </button>
                                                </>
                                            )}

                                            {activeTab === 'pending_check' && r.status === RecordStatus.PENDING_CHECK && r.assignedTo === user.employeeId && (
                                                <button 
                                                    onClick={() => handleWithdraw(r)} 
                                                    title="Thu hồi hồ sơ" 
                                                    className="px-2.5 py-1.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-xs font-bold flex items-center gap-1 shadow-2xs transition-all"
                                                >
                                                    <RotateCcw size={12} /> Thu hồi
                                                </button>
                                            )}

                                            {activeTab === 'pending_sign' && (r.submittedTo === user.employeeId || r.submittedTo === effectiveId) && (
                                                <>
                                                    <button 
                                                        onClick={() => handleSignRecord(r)} 
                                                        title="Ký duyệt" 
                                                        className="px-2.5 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-bold flex items-center gap-1 shadow-2xs transition-all"
                                                    >
                                                        <FileSignature size={12} /> Ký duyệt
                                                    </button>
                                                    <button 
                                                        onClick={() => handleOpenReturnStepModal(r)} 
                                                        title="Trả về bước trước" 
                                                        className="px-2.5 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-xs font-bold flex items-center gap-1 shadow-2xs transition-all"
                                                    >
                                                        <RotateCcw size={12} /> Trả về
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <CheckCircle size={48} className="text-gray-200 mb-2" />
                    <p>{searchTerm ? 'Không tìm thấy hồ sơ phù hợp.' : 'Không có hồ sơ nào trong danh sách này.'}</p>
                </div>
            )}
        </div>

        {/* PAGINATION FOOTER */}
        {filteredDisplayRecords.length > 0 && (
            <div className="border-t border-gray-100 p-3 bg-gray-50 flex justify-between items-center shrink-0">
                <span className="text-xs text-gray-500">
                    Hiển thị <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> - <strong>{Math.min(currentPage * itemsPerPage, filteredDisplayRecords.length)}</strong> trên tổng <strong>{filteredDisplayRecords.length}</strong>
                </span>
                <div className="flex items-center gap-1">
                    <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft size={18} /></button>
                    <span className="text-xs font-medium mx-2">Trang {currentPage} / {totalPages}</span>
                    <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRight size={18} /></button>
                </div>
            </div>
        )}
      </div>

      <SubmitModal 
          isOpen={isSubmitModalOpen}
          onClose={() => setIsSubmitModalOpen(false)}
          records={submitTargetRecords}
          users={users}
          employees={employees}
          currentUser={user}
          onConfirm={handleConfirmSubmit}
      />

      <SubmitModal 
          isOpen={isSubmitCheckModalOpen}
          onClose={() => setIsSubmitCheckModalOpen(false)}
          records={submitTargetRecords}
          users={users}
          employees={employees}
          isCheckMode={true}
          currentUser={user}
          onConfirm={async (checkerId) => {
              try {
                  for (const record of submitTargetRecords) {
                      if (isArchiveType(record.recordType)) {
                          // Xử lý hồ sơ lưu trữ
                          const historyEntry = {
                              action: 'Trình kiểm tra',
                              status: 'pending_check',
                              timestamp: new Date().toISOString(),
                              user: user.name
                          };

                          const currentArchive = archiveRecords.find(r => r.id === record.id);
                          if (currentArchive) {
                              const oldHistory = Array.isArray(currentArchive.data?.history) ? currentArchive.data.history : [];
                              const newHistory = [...oldHistory, historyEntry];
                              
                              await saveArchiveRecord({
                                  id: record.id,
                                  status: 'pending_check',
                                  data: { ...currentArchive.data, history: newHistory, checked_by: checkerId }
                              });
                          }
                      } else {
                          // Hồ sơ Đo đạc thường
                          let extraUpdates: any = {};
                 if (isRegType(record.recordType)) {
                     let currentStepIndex = record.currentStepIndex;
                     if (currentStepIndex === undefined || currentStepIndex === null) {
                         currentStepIndex = 0;
                     }
                     extraUpdates.currentStepIndex = currentStepIndex + 1;
                 }

                 const updatedRecord = {
                              ...record,
                              ...extraUpdates, status: RecordStatus.PENDING_CHECK,
                              assignedDate: record.assignedDate || (record.receivedDate || new Date().toISOString()),
                              completedWorkDate: record.completedWorkDate || (record.assignedDate || (record.receivedDate || new Date().toISOString())),
                              pendingCheckDate: new Date().toISOString(),
                              checkedBy: checkerId
                          };
                          if (onUpdateRecord) {
                              await onUpdateRecord(updatedRecord);
                          } else {
                              await updateRecordApi(updatedRecord);
                              onUpdateStatus(record, RecordStatus.PENDING_CHECK);
                          }
                      }
                  }
                  
                  // Làm mới dữ liệu lưu trữ
                  const saoluc = await fetchArchiveRecords('saoluc');
                  const congvan = await fetchArchiveRecords('congvan');
                  setArchiveRecords([...saoluc, ...congvan]);
                  
                  setIsSubmitCheckModalOpen(false);
                  setSubmitTargetRecords([]);
              } catch (err) {
                  console.error("Lỗi khi trình kiểm tra:", err);
              }
          }}
      />

      <RejectReasonModal 
          isOpen={isRejectModalOpen}
          onClose={() => {
              setIsRejectModalOpen(false);
              setRejectTargetRecord(null);
          }}
          record={rejectTargetRecord}
          onConfirm={handleConfirmReject}
      />

      <ReturnStepReasonModal 
          isOpen={isReturnStepModalOpen}
          onClose={() => {
              setIsReturnStepModalOpen(false);
              setReturnStepTargetRecord(null);
          }}
          record={returnStepTargetRecord}
          onConfirm={handleConfirmReturnStep}
      />

      {isAnnexModalOpen && annexTargetRecord && (
          <SystemAnnexTemplate 
              data={annexTargetRecord} 
              employees={employees}
              onClose={() => {
                  setIsAnnexModalOpen(false);
                  setAnnexTargetRecord(null);
              }}
          />
      )}
    </div>
  );
};

export default PersonalProfile;

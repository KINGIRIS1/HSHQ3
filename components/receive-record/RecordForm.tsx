import React, { useState, useEffect, useRef } from 'react';
import { RecordFile, Holiday, RecordStatus, User, Employee, UserRole } from '../../types';
import { RECORD_TYPES, REGISTRATION_PROCEDURES, STATUS_LABELS } from '../../constants';
import { getStatusLabel, isMeasurementType, isArchiveType, removeVietnameseTones, groupEmployeesByDepartment, getGcnWorkflowStepsHelper, isRegType } from '../../utils/appHelpers';
import { Save, User as UserIcon, Calendar, MapPin, FileCheck, Loader2, Printer, RotateCcw, XCircle, CheckCircle, AlertCircle, X, Phone, FileText, BookOpen, Clock, Hash, Map, Camera, Trash2, Upload, Lock } from 'lucide-react';
import SimpleRecordForm from './SimpleRecordForm';

interface RecordFormProps {
  onSave: (record: RecordFile) => Promise<RecordFile | null>;
  wards: string[];
  records: RecordFile[];
  holidays: Holiday[];
  calculateDeadline: (type: string, date: string, hasTax?: boolean) => string;
  generateCode: (ward: string, date: string, recordType?: string) => string;
  onPrint?: (data: Partial<RecordFile>) => void;
  initialData?: RecordFile | null;
  onCancelEdit?: () => void;
  currentUser: User;
  employees: Employee[];
  currentView?: string;
  onLoadingChange?: (loading: boolean) => void;
  isInModal?: boolean;
  onReceiptNumberChange?: (receiptNum: string) => void;
  resetTrigger?: number;
}

const getDefaultDocsForProcedure = (procedure: string, hasTax: boolean = false): Array<{ name: string; type: 'Bản chính' | 'Bản sao' }> => {
    if (!procedure) return [];
    const lower = procedure.toLowerCase();
    let docs: Array<{ name: string; type: 'Bản chính' | 'Bản sao' }> = [];
    
    if (lower.includes('3.1') || lower.includes('thừa kế')) {
        docs = [
            { name: 'Đơn đăng ký biến động đất đai', type: 'Bản chính' },
            { name: 'Giấy chứng nhận đã cấp', type: 'Bản chính' },
            { name: 'Tờ khai thuế', type: 'Bản chính' },
            { name: 'Văn bản khai nhận di sản thừa kế hoặc Văn bản thỏa thuận phân chia di sản thừa kế', type: 'Bản chính' },
            { name: 'Giấy chứng tử', type: 'Bản sao' }
        ];
    } else if (lower.includes('3.2') || lower.includes('tặng cho')) {
        docs = [
            { name: 'Đơn đăng ký biến động đất đai', type: 'Bản chính' },
            { name: 'Giấy chứng nhận đã cấp', type: 'Bản chính' },
            { name: 'Tờ khai thuế', type: 'Bản chính' },
            { name: 'Hợp đồng tặng cho quyền sử dụng đất', type: 'Bản chính' },
            { name: 'Giấy khai sinh', type: 'Bản sao' }
        ];
    } else if (lower.includes('3.3') || lower.includes('chuyển nhượng')) {
        docs = [
            { name: 'Đơn đăng ký biến động đất đai', type: 'Bản chính' },
            { name: 'Giấy chứng nhận đã cấp', type: 'Bản chính' },
            { name: 'Tờ khai thuế', type: 'Bản chính' },
            { name: 'Hợp đồng chuyển nhượng', type: 'Bản chính' }
        ];
    } else if (lower.includes('3.4') || lower.includes('thỏa thuận')) {
        docs = [
            { name: 'Đơn đăng ký biến động đất đai', type: 'Bản chính' },
            { name: 'Giấy chứng nhận đã cấp', type: 'Bản chính' },
            { name: 'Tờ khai thuế', type: 'Bản chính' }
        ];
    } else if (lower.includes('3.5') || lower.includes('chuyển mục đích')) {
        docs = [
            { name: 'Đơn đăng ký biến động đất đai', type: 'Bản chính' },
            { name: 'Giấy chứng nhận đã cấp', type: 'Bản chính' },
            { name: 'Tờ khai thuế', type: 'Bản chính' }
        ];
    } else if (lower.includes('3.6') || lower.includes('cấp đổi')) {
        docs = [
            { name: 'Đơn đăng ký biến động đất đai', type: 'Bản chính' },
            { name: 'Giấy chứng nhận đã cấp', type: 'Bản chính' },
            { name: 'Tờ khai thuế', type: 'Bản chính' }
        ];
    } else if (lower.includes('3.7') || lower.includes('cấp lại')) {
        docs = [
            { name: 'Giấy xác nhận mất GCN', type: 'Bản chính' }
        ];
    } else if (lower.includes('3.8') || lower.includes('tách - hợp thửa')) {
        docs = [
            { name: 'Đơn đề nghị tách thửa, hợp thửa', type: 'Bản chính' },
            { name: 'Giấy chứng nhận đã cấp', type: 'Bản chính' },
            { name: 'Bản vẽ trích đo địa chính', type: 'Bản chính' }
        ];
    } else if (lower.includes('3.9') || lower.includes('gia hạn')) {
        docs = [
            { name: 'Đơn đề nghị gia hạn sử dụng đất', type: 'Bản chính' },
            { name: 'Giấy chứng nhận đã cấp', type: 'Bản chính' }
        ];
    } else if (lower.startsWith('1.') || lower.includes('công văn') || lower.includes('sao lục') || lower.startsWith('2.') || lower.includes('trích đo') || lower.includes('đo đạc') || lower.includes('trích lục') || lower.includes('số thửa')) {
        return [
            { name: 'Phiếu yêu cầu lập hợp đồng đo đạc dịch vụ, cắm Mốc, trích lục, Cung cấp thông tin', type: 'Bản chính' },
            { name: 'Giấy chứng nhận đã cấp', type: 'Bản sao' }
        ];
    }

    return docs;
};

const RecordForm: React.FC<RecordFormProps> = ({ onSave, wards, records, holidays, calculateDeadline, generateCode, onPrint, initialData, onCancelEdit, currentUser, employees, currentView, onLoadingChange, isInModal, onReceiptNumberChange, resetTrigger }) => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
      if (onLoadingChange) {
          onLoadingChange(loading);
      }
  }, [loading, onLoadingChange]);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const prevRecordTypeRef = useRef("");

  const linkedEmp = employees.find(e => e.id === currentUser.employeeId);
  const processingWard = linkedEmp?.managedWards?.[0] || 'Tân Khai';

  const isMeasurement = React.useMemo(() => {
    return !!(currentView && ['all_records', 'assign_tasks', 'completed_list', 'pending_check_list', 'check_list', 'handover_list', 'director_completed'].includes(currentView));
  }, [currentView]);

  const hasAdminRights = React.useMemo(() => {
    return currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUBADMIN;
  }, [currentUser]);

  const isNewRecord = !(initialData && initialData.id);

  const d = new Date();
  const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const [formData, setFormData] = useState<Partial<RecordFile>>(() => {
    return {
      code: '', customerName: '', phoneNumber: '', cccd: '', customerAddress: '', authorizedBy: '', authDocType: '', otherDocs: '', content: '',
      receivedDate: todayStr, deadline: '', ward: processingWard, group: processingWard, landPlot: '', mapSheet: '', area: 0,
      address: '', recordType: '', status: RecordStatus.RECEIVED,
      issueNumber: '', entryNumber: '', issueDate: '', residentialArea: 0,
      clnArea: 0, bhkArea: 0, lucArea: 0, otherLandArea: 0, receiptNumber: '', notes: '',
      hasTax: false, transferToDNLis: false
    };
  });

  const isMeas = React.useMemo(() => {
    if (isMeasurement) return true;
    const type = (formData.recordType || '').toLowerCase();
    return type.startsWith('2.') || type.includes('đo đạc') || type.includes('trích lục') || type.includes('cắm mốc') || type.includes('tách thửa');
  }, [isMeasurement, formData.recordType]);

  // Extra states for full form synchronization
  const [dob, setDob] = useState('');
  const [landUserType, setLandUserType] = useState('Cá nhân');
  const [applicantName, setApplicantName] = useState('');
  const [applicantCccd, setApplicantCccd] = useState('');
  const [applicantPhone, setApplicantPhone] = useState('');
  const [applicantEmail, setApplicantEmail] = useState('');

  const handleApplicantChange = (field: 'name' | 'cccd' | 'phone' | 'email', value: string) => {
      if (field === 'name') setApplicantName(value);
      else if (field === 'cccd') setApplicantCccd(value);
      else if (field === 'phone') setApplicantPhone(value);
      else if (field === 'email') setApplicantEmail(value);
  };
  const [representative, setRepresentative] = useState('');
  const [position, setPosition] = useState('');
  const [country, setCountry] = useState('Việt Nam');
  const [docType, setDocType] = useState('Căn cước công dân');
  const [issuePlace, setIssuePlace] = useState('');
  const [docIssueDate, setDocIssueDate] = useState('');
  const [customerProvince, setCustomerProvince] = useState('Tỉnh Đồng Nai');
  const [generalNotes, setGeneralNotes] = useState('');
  const [authDocNumber, setAuthDocNumber] = useState('');
  const [authAddress, setAuthAddress] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [hasTaxProcedure, setHasTaxProcedure] = useState(false);
  const [isApplicantOwner, setIsApplicantOwner] = useState(false);

  // Searchable combobox for Record Types
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Toggle for Authorized Person section
  const [showAuthSection, setShowAuthSection] = useState(false);

  // Dynamic Owner Rows Table
  const [ownerRows, setOwnerRows] = useState<Array<{ name: string; cccd: string; phone: string; email: string; address?: string; note: string }>>([
      { name: '', cccd: '', phone: '', email: '', address: '', note: '' }
  ]);

  // Dynamic Receiver Rows Table
  const [receiverRows, setReceiverRows] = useState<Array<{ name: string; cccd: string; phone: string; email: string; note: string }>>([]);

  const handleOwnerRowChange = (index: number, field: string, value: string) => {
      setOwnerRows(prev => {
          const next = [...prev];
          next[index] = { ...next[index], [field]: value };
          return next;
      });
  };

  const addOwnerRow = () => {
      setOwnerRows(prev => [...prev, { name: '', cccd: '', phone: '', email: '', address: '', note: '' }]);
  };

  const removeOwnerRow = (index: number) => {
      setOwnerRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleReceiverRowChange = (index: number, field: string, value: string) => {
      setReceiverRows(prev => {
          const next = [...prev];
          next[index] = { ...next[index], [field]: value };
          return next;
      });
  };

  const addReceiverRow = () => {
      setReceiverRows(prev => [...prev, { name: '', cccd: '', phone: '', email: '', note: '' }]);
  };

  const removeReceiverRow = (index: number) => {
      setReceiverRows(prev => prev.filter((_, i) => i !== index));
  };

  // Dynamic Other Document Rows Table
  const [otherDocRows, setOtherDocRows] = useState<Array<{ name: string; type: 'Bản chính' | 'Bản sao' }>>([]);

  const handleOtherDocRowChange = (index: number, field: 'name' | 'type', value: string) => {
      setOtherDocRows(prev => {
          const next = [...prev];
          next[index] = { ...next[index], [field]: value as any };
          return next;
      });
  };

  const addOtherDocRow = (name = '', type: 'Bản chính' | 'Bản sao' = 'Bản chính') => {
      setOtherDocRows(prev => [...prev, { name, type }]);
  };

  const removeOtherDocRow = (index: number) => {
      setOtherDocRows(prev => prev.filter((_, i) => i !== index));
  };

  // Dynamic Land Area Rows
  const [landAreaRows, setLandAreaRows] = useState<Array<{ type: string; area: number | '' }>>([
      { type: 'ONT/ODT', area: '' }
  ]);

  const handleLandRowTypeChange = (index: number, type: string) => {
      setLandAreaRows(prev => {
          const next = [...prev];
          next[index] = { ...next[index], type };
          return next;
      });
  };

  const handleLandRowAreaChange = (index: number, value: string) => {
      const parsedVal = value === '' ? '' : parseFloat(value);
      setLandAreaRows(prev => {
          const next = [...prev];
          next[index] = { ...next[index], area: parsedVal as any };
          return next;
      });
  };

  const addLandAreaRow = () => {
      const currentTypes = landAreaRows.map(r => r.type);
      const availableTypes = ['ONT/ODT', 'CLN', 'BHK', 'LUC', 'Khác'];
      const nextDefaultType = availableTypes.find(t => !currentTypes.includes(t)) || 'Khác';
      setLandAreaRows(prev => [...prev, { type: nextDefaultType, area: '' }]);
  };

  const removeLandAreaRow = (index: number) => {
      setLandAreaRows(prev => {
          const next = prev.filter((_, i) => i !== index);
          if (next.length === 0) {
              return [{ type: 'ONT/ODT', area: '' }];
          }
          return next;
      });
  };

  const isRegistration = React.useCallback((type: string | null | undefined): boolean => {
      if (!type) return false;
      const t = type.trim().toLowerCase();
      return t.startsWith('3.') || t === 'đăng ký' || t === 'cấp giấy' || t === 'cấp đổi' || t === 'cấp lại' || REGISTRATION_PROCEDURES.some(p => p.toLowerCase() === t);
  }, []);

  const isDefaultTaxProcedure = React.useCallback((type: string | null | undefined): boolean => {
      if (!type) return false;
      const t = removeVietnameseTones(type).toLowerCase();
      return ['thua ke', 'tang cho', 'chuyen nhuong', 'thoa thuan', 'chuyen muc dich', 'tach thua', 'hop thua'].some(keyword => t.includes(keyword));
  }, []);

  // Lọc danh sách loại hồ sơ hiển thị (tất cả các thủ tục) theo phân hệ đang làm việc
  const allowedRecordTypes = React.useMemo(() => {
    let types: string[] = [];
    
    // 1. Phân hệ Lưu trữ
    if (currentView && [
        "archive_records", "archive_assign_tasks", "archive_completed_list", 
        "archive_pending_check_list", "archive_check_list", "archive_handover_list", 
        "archive_director_completed"
    ].includes(currentView)) {
        types = ['1.1 Cung cấp dữ liệu đất đai', '1.2 Công văn'];
    }

    // 2. Phân hệ Cấp Giấy
    else if (currentView && [
        "registration_records", "registration_assign_tasks", "registration_completed_list", 
        "registration_pending_check_list", "registration_check_list", "registration_handover_list", 
        "registration_director_completed", "registration_vao_so"
    ].includes(currentView)) {
        types = REGISTRATION_PROCEDURES;
    }

    // 3. Phân hệ Đo đạc
    else if (currentView && [
        "all_records", "assign_tasks", "completed_list", 
        "pending_check_list", "check_list", "handover_list", 
        "director_completed"
    ].includes(currentView)) {
        types = [
          '2.1 Trích lục',
          '2.2 Trích lục Quy hoạch',
          '2.3 Trích đo',
          '2.4 Trích đo Cắm mốc',
          '2.5 Trích đo Tách - Hợp thửa',
          '2.6 Cung cấp số thửa'
        ];
    }

    // 4. Phân hệ Khác
    else if (currentView && [
        "other_records", "other_assign_tasks", "other_check_list", 
        "other_handover_list", "other_director_completed"
    ].includes(currentView)) {
        types = ['CMD', 'Tòa án', 'Thi hành án'];
    }

    // 5. Mặc định (cho Một cửa hoặc không xác định): Hiển thị tất cả ngoại trừ 'Cung cấp thông tin'
    else {
        types = [
          '1.1 Cung cấp dữ liệu đất đai',
          '2.1 Trích lục',
          '2.2 Trích lục Quy hoạch',
          '2.3 Trích đo',
          '2.4 Trích đo Cắm mốc',
          '2.5 Trích đo Tách - Hợp thửa',
          '2.6 Cung cấp số thửa',
          ...REGISTRATION_PROCEDURES
        ];
    }

    if (formData.recordType && !types.includes(formData.recordType)) {
        types = [...types, formData.recordType];
    }
    return types;
  }, [currentView, formData.recordType]);

  const filteredProcedures = allowedRecordTypes.filter(t => {
      const label = t === 'Đăng ký' ? 'Cấp Giấy' : t;
      return label.toLowerCase().includes((searchTerm || '').toLowerCase());
  });

  useEffect(() => {
      if (initialData) {
          let updatedData = { ...initialData };
          if (isRegType(initialData.recordType) || isRegistration(initialData.recordType)) {
              if (updatedData.currentStepIndex === undefined || updatedData.currentStepIndex === null) {
                  const helper = getGcnWorkflowStepsHelper(updatedData, holidays || []);
                  updatedData.currentStepIndex = helper.currentStepIndex;
              }
          }
          setFormData(updatedData);
          setNotification(null);
          // Parse extra fields from notes
          try {
              const parsed = JSON.parse(initialData.notes || '{}');
              setDob(parsed.dob || '');
              setLandUserType(parsed.landUserType || 'Cá nhân');
              setApplicantName(initialData.customerName || '');
              setApplicantCccd(initialData.cccd || '');
              setApplicantPhone(initialData.phoneNumber || '');
              setApplicantEmail(parsed.email || '');
              setRepresentative(parsed.representative || '');
              setPosition(parsed.position || '');
              setCountry(parsed.country || 'Việt Nam');
              setDocType(parsed.docType || 'Căn cước công dân');
              setIssuePlace(parsed.issuePlace || '');
              setDocIssueDate(parsed.docIssueDate || '');
              setCustomerProvince(parsed.customerProvince || 'Tỉnh Đồng Nai');
              setGeneralNotes(parsed.generalNotes || '');
              setAuthDocNumber(parsed.authDocNumber || '');
              setAuthAddress(parsed.authAddress || '');
              setAuthPhone(parsed.authPhone || '');
              setHasTaxProcedure(parsed.hasTaxProcedure || false);
              setIsApplicantOwner(parsed.isApplicantOwner || false);
              setShowAuthSection(!!initialData.authorizedBy);
              setOwnerRows(parsed.ownerRows && parsed.ownerRows.length > 0 ? parsed.ownerRows : [
                  { name: '', cccd: '', phone: '', email: '', address: '', note: '' }
              ]);
              setReceiverRows(parsed.receiverRows || []);

              if (parsed.landAreaRows && parsed.landAreaRows.length > 0) {
                  setLandAreaRows(parsed.landAreaRows);
              } else {
                  const tempRows: Array<{ type: string; area: number | '' }> = [];
                  if (initialData.residentialArea) tempRows.push({ type: 'ONT/ODT', area: initialData.residentialArea });
                  if (initialData.clnArea) tempRows.push({ type: 'CLN', area: initialData.clnArea });
                  if (initialData.bhkArea) tempRows.push({ type: 'BHK', area: initialData.bhkArea });
                  if (initialData.lucArea) tempRows.push({ type: 'LUC', area: initialData.lucArea });
                  if (initialData.otherLandArea) tempRows.push({ type: 'Khác', area: initialData.otherLandArea });
                  if (tempRows.length === 0) {
                      tempRows.push({ type: 'ONT/ODT', area: '' });
                  }
                  setLandAreaRows(tempRows);
              }

              // Parse otherDocs safely
              let parsedDocs: Array<{ name: string; type: 'Bản chính' | 'Bản sao' }> = [];
              if (initialData.otherDocs) {
                  const items = initialData.otherDocs.split(';').map(item => item.trim()).filter(Boolean);
                  parsedDocs = items.map(item => {
                      const parts = item.split('|');
                      return {
                          name: parts[0] || '',
                          type: (parts[1] === 'Bản sao' ? 'Bản sao' : 'Bản chính') as 'Bản chính' | 'Bản sao'
                      };
                  });
              } else if (parsed.otherDocRows) {
                  parsedDocs = parsed.otherDocRows;
              }
              setOtherDocRows(parsedDocs);
          } catch (e) {
              setDob('');
              setLandUserType('Cá nhân');
              setApplicantName(initialData.customerName || '');
              setApplicantCccd(initialData.cccd || '');
              setApplicantPhone(initialData.phoneNumber || '');
              setApplicantEmail('');
              setRepresentative('');
              setPosition('');
              setCountry('Việt Nam');
              setDocType('Căn cước công dân');
              setIssuePlace('');
              setDocIssueDate('');
              setCustomerProvince('Tỉnh Đồng Nai');
              setGeneralNotes('');
              setAuthDocNumber('');
              setAuthAddress('');
              setAuthPhone('');
              setHasTaxProcedure(false);
              setIsApplicantOwner(false);
              setShowAuthSection(!!initialData.authorizedBy);
              setOwnerRows([
                  { name: '', cccd: '', phone: '', email: '', note: '' }
              ]);
              setReceiverRows([]);

              const tempRows: Array<{ type: string; area: number | '' }> = [];
              if (initialData.residentialArea) tempRows.push({ type: 'ONT/ODT', area: initialData.residentialArea });
              if (initialData.clnArea) tempRows.push({ type: 'CLN', area: initialData.clnArea });
              if (initialData.bhkArea) tempRows.push({ type: 'BHK', area: initialData.bhkArea });
              if (initialData.lucArea) tempRows.push({ type: 'LUC', area: initialData.lucArea });
              if (initialData.otherLandArea) tempRows.push({ type: 'Khác', area: initialData.otherLandArea });
              if (tempRows.length === 0) {
                  tempRows.push({ type: 'ONT/ODT', area: '' });
              }
              setLandAreaRows(tempRows);

              // Parse otherDocs safely in catch
              let parsedDocs: Array<{ name: string; type: 'Bản chính' | 'Bản sao' }> = [];
              if (initialData.otherDocs) {
                  const items = initialData.otherDocs.split(';').map(item => item.trim()).filter(Boolean);
                  parsedDocs = items.map(item => {
                      const parts = item.split('|');
                      return {
                          name: parts[0] || '',
                          type: (parts[1] === 'Bản sao' ? 'Bản sao' : 'Bản chính') as 'Bản chính' | 'Bản sao'
                      };
                  });
              }
              setOtherDocRows(parsedDocs);
          }
      } else {
          handleReset(false);
      }
  }, [initialData]);

  useEffect(() => {
      if (notification && topRef.current) {
          topRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (notification.type === 'success') {
              const timer = setTimeout(() => setNotification(null), 5000);
              return () => clearTimeout(timer);
          }
      }
  }, [notification]);

  useEffect(() => {
    // We no longer pre-generate record codes here to prevent duplication and support manual entries.
    prevRecordTypeRef.current = formData.recordType || '';
  }, [formData.recordType]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isDropdownOpen) {
        const currentLabel = formData.recordType === 'Đăng ký' ? 'Cấp Giấy' : (formData.recordType || '');
        setSearchTerm(currentLabel);
    }
  }, [isDropdownOpen, formData.recordType]);

  useEffect(() => {
      if (onReceiptNumberChange) {
          onReceiptNumberChange(formData.receiptNumber || '');
      }
  }, [formData.receiptNumber, onReceiptNumberChange]);

  useEffect(() => {
    const hasActiveLandRows = landAreaRows.some(row => row.area !== '' && parseFloat(row.area as any) > 0);
    if (hasActiveLandRows) {
        const total = landAreaRows.reduce((sum, row) => {
            const val = parseFloat(row.area as any) || 0;
            return sum + val;
        }, 0);
        const roundedTotal = parseFloat(total.toFixed(4));
        if (formData.area !== roundedTotal) {
            setFormData(prev => ({ ...prev, area: roundedTotal }));
        }
    }
  }, [landAreaRows]);

  const isMeasOrArch = isMeasurementType(formData.recordType) || isArchiveType(formData.recordType);

  useEffect(() => {
      if (isApplicantOwner || isMeasOrArch) {
          setOwnerRows(prev => {
              const next = [...prev];
              if (next.length === 0) {
                  next.push({ name: '', cccd: '', phone: '', email: '', address: '', note: '' });
              }
              if (
                  next[0].name !== applicantName ||
                  next[0].cccd !== applicantCccd ||
                  next[0].phone !== applicantPhone ||
                  next[0].email !== applicantEmail ||
                  next[0].address !== (formData.customerAddress || '')
              ) {
                  next[0] = {
                      ...next[0],
                      name: applicantName,
                      cccd: applicantCccd,
                      phone: applicantPhone,
                      email: applicantEmail,
                      address: formData.customerAddress || ''
                  };
                  return next;
              }
              return prev;
          });
      } else {
          setReceiverRows(prev => {
              const next = [...prev];
              if (next.length === 0) {
                  next.push({ name: '', cccd: '', phone: '', email: '', note: '' });
              }
              if (
                  next[0].name !== applicantName ||
                  next[0].cccd !== applicantCccd ||
                  next[0].phone !== applicantPhone ||
                  next[0].email !== applicantEmail
              ) {
                  next[0] = {
                      ...next[0],
                      name: applicantName,
                      cccd: applicantCccd,
                      phone: applicantPhone,
                      email: applicantEmail
                  };
                  return next;
              }
              return prev;
          });
      }
  }, [isApplicantOwner, isMeasOrArch, applicantName, applicantCccd, applicantPhone, applicantEmail, formData.customerAddress]);

  const handleApplicantOwnerChange = (checked: boolean) => {
      setIsApplicantOwner(checked);
      if (checked) {
          setOwnerRows(prev => {
              const next = [...prev];
              if (next.length === 0) {
                  next.push({ name: '', cccd: '', phone: '', email: '', address: '', note: '' });
              }
              next[0] = {
                  ...next[0],
                  name: applicantName,
                  cccd: applicantCccd,
                  phone: applicantPhone,
                  email: applicantEmail,
                  address: formData.customerAddress || ''
              };
              return next;
          });
          setReceiverRows(prev => {
              const next = [...prev];
              if (next.length > 0) {
                  next[0] = { ...next[0], name: '', cccd: '', phone: '', email: '' };
              }
              return next;
          });
      } else {
          setReceiverRows(prev => {
              const next = [...prev];
              if (next.length === 0) {
                  next.push({ name: '', cccd: '', phone: '', email: '', note: '' });
              }
              next[0] = {
                  ...next[0],
                  name: applicantName,
                  cccd: applicantCccd,
                  phone: applicantPhone,
                  email: applicantEmail
              };
              return next;
          });
          setOwnerRows(prev => {
              const next = [...prev];
              if (next.length === 0) {
                  next.push({ name: '', cccd: '', phone: '', email: '', note: '' });
              }
              next[0] = { ...next[0], name: '', cccd: '', phone: '', email: '' };
              return next;
          });
      }
  };

  const handleChange = (field: keyof RecordFile, value: any) => {
    setFormData(prev => {
        let newData = { ...prev, [field]: value };
        if (field === 'hasTax' && !value) {
            newData.transferToDNLis = false;
        }
        if (field === 'assignedTo') {
            if (value) {
                newData.status = RecordStatus.IN_PROGRESS;
                newData.currentStepIndex = 1;
                newData.assignedDate = new Date().toISOString();
            } else {
                newData.status = RecordStatus.RECEIVED;
                newData.currentStepIndex = 0;
                newData.assignedDate = null;
            }
        }
        if (field === 'status') {
            if (isRegType(newData.recordType) || isRegistration(newData.recordType)) {
                if (String(value).startsWith('step_')) {
                    const idx = parseInt(String(value).replace('step_', ''), 10);
                    const helper = getGcnWorkflowStepsHelper(newData as RecordFile, holidays || []);
                    if (helper && helper.steps && helper.steps[idx]) {
                        newData.currentStepIndex = idx;
                        newData.status = helper.steps[idx].overallStatus;
                    }
                } else {
                    newData.status = value;
                    newData.currentStepIndex = null;
                }
            }
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

        
        if (field === 'recordType') {
            const valLower = String(value).toLowerCase();
            if (valLower.includes('cung cấp dữ liệu đất đai') || 
                valLower.includes('cung cấp tài liệu đất đai') || 
                valLower.includes('cung cấp thông tin')) {
                newData.price = 310000;
            } else {
                newData.price = null;
            }

            let calculatedHasTax = newData.hasTax;
            // Tự động bật/tắt quy trình thuế dựa trên thủ tục được chọn
            if (isDefaultTaxProcedure(value)) {
                setHasTaxProcedure(true);
                newData.hasTax = true;
                calculatedHasTax = true;
            } else if (isRegistration(value)) {
                setHasTaxProcedure(false);
                newData.hasTax = false;
                calculatedHasTax = false;
            } else {
                setHasTaxProcedure(false);
                newData.hasTax = false;
                calculatedHasTax = false;
            }

            // Khôi phục giấy tờ mặc định cho từng thủ tục
            if (value && (!initialData || !initialData.id)) {
                setOtherDocRows(getDefaultDocsForProcedure(value, calculatedHasTax));
            }
        }
        if (field === 'hasTax') {
            if (newData.recordType && (!initialData || !initialData.id)) {
                setOtherDocRows(getDefaultDocsForProcedure(newData.recordType, value));
            }
        }

        const workflowPropChanged = field === 'gcnWorkflowType' || field === 'recordType' || field === 'hasTax' || field === 'hasCheckedSMK';
        if (workflowPropChanged && (isRegType(newData.recordType) || isRegistration(newData.recordType))) {
            const oldWorkflow = getGcnWorkflowStepsHelper(prev as RecordFile, holidays || []);
            const oldStepIdx = prev.currentStepIndex !== undefined && prev.currentStepIndex !== null ? prev.currentStepIndex : 0;
            const oldStep = oldWorkflow.steps[oldStepIdx];
            
            if (oldStep) {
                const newWorkflow = getGcnWorkflowStepsHelper(newData as RecordFile, holidays || []);
                const oldLabel = oldStep.label.toLowerCase();
                
                // Find a step in the new workflow that matches the old step's label or status
                let bestIdx = newWorkflow.steps.findIndex(s => s.label.toLowerCase() === oldLabel);
                
                if (bestIdx === -1) {
                    // Try partial match
                    bestIdx = newWorkflow.steps.findIndex(s => {
                        const newLabel = s.label.toLowerCase();
                        return newLabel.includes(oldLabel) || oldLabel.includes(newLabel);
                    });
                }
                
                if (bestIdx === -1) {
                    // Fall back to matching overallStatus
                    bestIdx = newWorkflow.steps.findIndex(s => s.overallStatus === oldStep.overallStatus);
                }
                
                if (bestIdx !== -1) {
                    newData.currentStepIndex = bestIdx;
                    if (![RecordStatus.RETURNED, RecordStatus.WITHDRAWN, RecordStatus.REJECTED].includes(newData.status as any)) {
                        newData.status = newWorkflow.steps[bestIdx].overallStatus;
                    }
                } else {
                    newData.currentStepIndex = 0;
                    if (![RecordStatus.RETURNED, RecordStatus.WITHDRAWN, RecordStatus.REJECTED].includes(newData.status as any)) {
                        newData.status = newWorkflow.steps[0].overallStatus;
                    }
                }
            }
        }

        return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);
    
    const customerName = applicantName.trim();
    const cccd = applicantCccd.trim();
    const phoneNumber = applicantPhone.trim();

    let finalCode = formData.code?.trim() || '';
    const isNewRecord = !(initialData && initialData.id);

    if (isNewRecord) {
      const isType3 = formData.recordType?.startsWith('3.');
      if (!isType3) {
        // 1.x and 2.x always get code from server (generateCode) right now
        const activeWard = formData.ward || processingWard;
        finalCode = generateCode(activeWard, formData.receivedDate || '', formData.recordType || undefined);
        setFormData(prev => ({ ...prev, code: finalCode }));
      } else {
        // 3.x gets code from other system if filled, otherwise gets from server if empty
        if (!finalCode) {
          const activeWard = formData.ward || processingWard;
          finalCode = generateCode(activeWard, formData.receivedDate || '', formData.recordType || undefined);
          setFormData(prev => ({ ...prev, code: finalCode }));
        }
      }
    }

    const isCongVan = formData.recordType === '1.2 Công văn';
    if (!finalCode || !customerName || (!isCongVan && !formData.deadline) || !formData.recordType) { 
        setNotification({ 
            type: 'error', 
            message: isCongVan 
                ? "Vui lòng điền họ tên người nộp và chọn Loại hồ sơ." 
                : "Vui lòng điền Mã hồ sơ (*), họ tên người nộp, hạn trả và chọn Loại hồ sơ." 
        });
        return; 
    }

    let residentialArea = 0;
    let clnArea = 0;
    let bhkArea = 0;
    let lucArea = 0;
    let otherLandArea = 0;

    const hasActiveLandRows = isRegistration(formData.recordType) && landAreaRows.some(row => row.area !== '' && parseFloat(row.area as any) > 0);

    if (isRegistration(formData.recordType)) {
        if (hasActiveLandRows) {
            landAreaRows.forEach(row => {
                const val = parseFloat(row.area as any) || 0;
                if (row.type === 'ONT/ODT') residentialArea += val;
                else if (row.type === 'CLN') clnArea += val;
                else if (row.type === 'BHK') bhkArea += val;
                else if (row.type === 'LUC') lucArea += val;
                else if (row.type === 'Khác') otherLandArea += val;
            });
        } else {
            otherLandArea = parseFloat(formData.area as any) || 0;
        }
    }

    const totalArea = isRegistration(formData.recordType)
        ? (hasActiveLandRows 
            ? parseFloat((residentialArea + clnArea + bhkArea + lucArea + otherLandArea).toFixed(4)) 
            : (parseFloat(formData.area as any) || 0))
        : (parseFloat(formData.area as any) || 0);

    if (isNewRecord && isRegistration(formData.recordType)) {
        if (!formData.landPlot?.trim()) {
            setNotification({ type: 'error', message: "Vui lòng nhập Số thứ tự thửa đất đối với các thủ tục của Cấp giấy." });
            return;
        }
        if (!formData.mapSheet?.trim()) {
            setNotification({ type: 'error', message: "Vui lòng nhập Tờ bản đồ đối với các thủ tục của Cấp giấy." });
            return;
        }
        if (totalArea <= 0) {
            setNotification({ type: 'error', message: "Vui lòng nhập diện tích thửa đất (Tổng diện tích phải lớn hơn 0) đối với các thủ tục của Cấp giấy." });
            return;
        }
    }

    setLoading(true);

    const otherDocsStr = otherDocRows
        .filter(r => r.name.trim())
        .map(r => `${r.name.trim()}|${r.type}`)
        .join('; ');

    const extraData = {
        dob, landUserType, email: applicantEmail, representative, position, country, docType, issuePlace,
        docIssueDate, customerProvince, generalNotes,
        authDocNumber: showAuthSection ? authDocNumber : '',
        authAddress: showAuthSection ? authAddress : '',
        authPhone: showAuthSection ? authPhone : '',
        hasTaxProcedure: isRegistration(formData.recordType) 
            ? (isDefaultTaxProcedure(formData.recordType) || hasTaxProcedure) 
            : false,
        isApplicantOwner: isMeasOrArch ? false : isApplicantOwner,
        ownerRows: isRegistration(formData.recordType) ? ownerRows : [],
        receiverRows: isMeasOrArch || !isRegistration(formData.recordType) ? [] : receiverRows,
        otherDocRows: otherDocRows,
        landAreaRows: isRegistration(formData.recordType) ? landAreaRows : []
    };

    let finalReceivedDate = formData.receivedDate;
    if (!(initialData && initialData.id)) {
        const todayStr = new Date().toISOString().split('T')[0];
        if (finalReceivedDate === todayStr) {
            finalReceivedDate = new Date().toISOString();
        } else if (finalReceivedDate && !finalReceivedDate.includes('T')) {
            finalReceivedDate = `${finalReceivedDate}T08:00:00.000Z`;
        }
    } else {
        if (finalReceivedDate && !finalReceivedDate.includes('T')) {
            if (initialData.receivedDate && initialData.receivedDate.startsWith(finalReceivedDate)) {
                finalReceivedDate = initialData.receivedDate;
            } else {
                finalReceivedDate = `${finalReceivedDate}T08:00:00.000Z`;
            }
        }
    }

    const recordToSave: RecordFile = { 
        ...formData, 
        code: finalCode,
        customerName,
        cccd,
        phoneNumber,
        authorizedBy: showAuthSection ? formData.authorizedBy : '',
        authDocType: showAuthSection ? formData.authDocType : '',
        otherDocs: otherDocsStr,
        area: totalArea,
        residentialArea,
        clnArea,
        bhkArea,
        lucArea,
        otherLandArea,
        notes: JSON.stringify(extraData),
        id: formData.id || Math.random().toString(36).substr(2, 9), 
        status: formData.status || RecordStatus.RECEIVED,
        isDeptSynced: formData.id 
            ? (formData.isDeptSynced ?? true) 
            : (currentView && currentView !== 'receive_record' && currentView !== 'receive_contract' ? true : false),
        receivedDate: finalReceivedDate,
        receivedBy: formData.receivedBy || currentUser.employeeId || currentUser.username
    } as RecordFile;

    const savedRecord = await onSave(recordToSave);
    setLoading(false);
    if (savedRecord) {
        setNotification({ type: 'success', message: (initialData && initialData.id) ? `Cập nhật thành công: ${savedRecord.code}` : `Đã tiếp nhận mới: ${savedRecord.code}` });
        // Auto-print upon successful receipt of a new record file (only in receive_record tab)
        if (!(initialData && initialData.id) && onPrint && currentView === 'receive_record') {
            onPrint(savedRecord);
        }
        if (initialData && initialData.id && onCancelEdit) {
            onCancelEdit();
        } else {
            handleReset(true);
        }
    } else {
        setNotification({ type: 'error', message: "Lỗi khi lưu hồ sơ." });
    }
  };

  const handleReset = (keepNotification = false) => {
      const d = new Date();
      const todayStrLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      setFormData({ 
          code: '', customerName: '', phoneNumber: '', cccd: '', customerAddress: '', 
          authorizedBy: '', authDocType: '', otherDocs: '', content: '', 
          receivedDate: todayStrLocal, deadline: '', 
          ward: processingWard, group: processingWard, landPlot: '', mapSheet: '', area: 0, address: '', 
          recordType: '', status: RecordStatus.RECEIVED,
          issueNumber: '', entryNumber: '', issueDate: '', residentialArea: 0,
          clnArea: 0, bhkArea: 0, lucArea: 0, otherLandArea: 0, receiptNumber: '',
          notes: '',
          hasTax: false,
          transferToDNLis: false
      });
      setDob('');
      setLandUserType('Cá nhân');
      setApplicantName('');
      setApplicantCccd('');
      setApplicantPhone('');
      setApplicantEmail('');
      setRepresentative('');
      setPosition('');
      setCountry('Việt Nam');
      setDocType('Căn cước công dân');
      setIssuePlace('');
      setDocIssueDate('');
      setCustomerProvince('Tỉnh Đồng Nai');
      setGeneralNotes('');
      setAuthDocNumber('');
      setAuthAddress('');
      setAuthPhone('');
      setHasTaxProcedure(false);
      setIsApplicantOwner(false);
      setShowAuthSection(false);
      setOwnerRows([{ name: '', cccd: '', phone: '', email: '', note: '' }]);
      setReceiverRows([]);
      setOtherDocRows([]);
      setLandAreaRows([{ type: 'ONT/ODT', area: '' }]);
      if (!keepNotification) setNotification(null);
      if (initialData && initialData.id && onCancelEdit) onCancelEdit();
  };

  useEffect(() => {
      if (resetTrigger !== undefined && resetTrigger > 0) {
          handleReset(false);
      }
  }, [resetTrigger]);

  const isCongVan = formData.recordType === '1.2 Công văn';
  const plainInputClass = isCongVan
    ? "w-full border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-4 py-3 text-sm outline-none font-medium text-gray-700 transition-all bg-white"
    : "w-full px-3 py-2 border border-slate-300 rounded-md text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-slate-700 bg-white hover:border-slate-400";
  const selectClass = isCongVan
    ? "w-full border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-4 py-3 text-sm bg-white outline-none font-medium text-gray-700 cursor-pointer transition-all"
    : "w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-slate-700 cursor-pointer hover:border-slate-400";
  const labelClass = isCongVan
    ? "text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 block ml-0.5"
    : "block text-xs font-bold text-slate-700 mb-1.5 ml-0.5";

  const dateVal = (v: any) => { if (!v) return ''; const str = String(v); return str.includes('T') ? str.split('T')[0] : str; };

  return (
    <form id="record-form" onSubmit={handleSubmit} className="w-full space-y-6 animate-fade-in relative pb-10">
        <div ref={topRef} />
        {notification && (
            <div className={`p-4 rounded-xl border shadow-lg flex items-start gap-3 transition-all duration-300 animate-fade-in-up ${notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                {notification.type === 'success' ? <CheckCircle className="shrink-0 mt-0.5" size={20} /> : <AlertCircle className="shrink-0 mt-0.5" size={20} />}
                <div className="flex-1"><h4 className="font-bold text-sm uppercase">{notification.type === 'success' ? 'Thành công' : 'Có lỗi xảy ra'}</h4><p className="text-sm">{notification.message}</p></div>
                <button type="button" onClick={() => setNotification(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
        )}

        <div className="flex flex-col gap-6">
            {/* THÔNG TIN BIÊN NHẬN & THỜI GIAN TRÊN ĐẦU */}
            {initialData && initialData.id ? (
                /* THÔNG TIN CHUNG CARD (EDIT MODE) */
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                    <div className="bg-white text-[#007bff] border-b border-slate-200 px-4 py-2.5 rounded-t-lg font-bold uppercase text-sm flex items-center gap-2">
                        <Calendar size={16} />
                        THÔNG TIN CHUNG
                    </div>
                    <div className="p-4 space-y-4">
                        {/* Row 1: Mã hồ sơ (1/4), Loại hồ sơ (2/4), Quy trình thuế (1/4) */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            {formData.recordType !== '1.2 Công văn' && (
                                <div className="md:col-span-1">
                                    <label className={labelClass}>Mã hồ sơ <span className="text-red-500">*</span></label>
                                    {(() => {
                                        const rType = formData.recordType || '';
                                        const isType3 = rType.startsWith('3.');
                                        if (isType3) {
                                            return (
                                                <input 
                                                    type="text" 
                                                    className={`${plainInputClass} bg-white text-blue-600 font-bold font-mono`} 
                                                    placeholder="Mã hồ sơ..."
                                                    value={formData.code || ''} 
                                                    onChange={(e) => handleChange('code', e.target.value)} 
                                                />
                                            );
                                        } else {
                                            return (
                                                <input 
                                                    type="text" 
                                                    readOnly
                                                    className={`${plainInputClass} bg-slate-50 text-slate-500 font-medium cursor-not-allowed`} 
                                                    placeholder="Tự động tạo..."
                                                    value={formData.code || ''} 
                                                />
                                            );
                                        }
                                    })()}
                                </div>
                            )}
                            <div className={formData.recordType === '1.2 Công văn' ? "md:col-span-4" : (isRegistration(formData.recordType) && !isDefaultTaxProcedure(formData.recordType) ? "md:col-span-2" : "md:col-span-3")}>
                                <label className={labelClass}>Loại hồ sơ</label>
                                <select 
                                    className={selectClass} 
                                    value={formData.recordType || ''} 
                                    onChange={(e) => handleChange('recordType', e.target.value)}
                                >
                                    <option value="">-- Chọn loại hồ sơ --</option>
                                    {allowedRecordTypes.map(t => (
                                        <option key={t} value={t}>{t === 'Đăng ký' ? 'Cấp Giấy' : t}</option>
                                    ))}
                                </select>
                            </div>
                            {isRegistration(formData.recordType) && !isDefaultTaxProcedure(formData.recordType) && (
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
                        </div>

                        {isRegistration(formData.recordType) && (
                            <div className="bg-blue-50/30 border border-blue-100/80 rounded-lg p-3 grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
                                <div>
                                    <label className="block text-xs font-bold text-blue-800 mb-1">Cấu hình Quy trình Cấp giấy</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs bg-white font-medium text-gray-700"
                                        value={formData.gcnWorkflowType || ''}
                                        onChange={(e) => {
                                            const val = e.target.value || null;
                                            handleChange('gcnWorkflowType', val);
                                            if (val === 'quy_trinh_4') {
                                                handleChange('hasTax', false);
                                                handleChange('hasCheckedSMK', false);
                                            } else if (val === 'quy_trinh_5') {
                                                handleChange('hasTax', false);
                                                handleChange('hasCheckedSMK', true);
                                            } else if (val === 'quy_trinh_6') {
                                                handleChange('hasTax', true);
                                                handleChange('hasCheckedSMK', false);
                                            } else if (val === 'quy_trinh_7') {
                                                handleChange('hasTax', true);
                                                handleChange('hasCheckedSMK', true);
                                            }
                                        }}
                                    >
                                        <option value="">-- Tự động nhận diện quy trình --</option>
                                        <option value="quy_trinh_1">Quy trình 1: DNLIS</option>
                                        <option value="quy_trinh_2">Quy trình 2: Phiếu chuyển thuế</option>
                                        <option value="quy_trinh_3">Quy trình 3: In GCN</option>
                                        <option value="quy_trinh_4">Quy trình 4: Cấp lại không thuế (Có đối chiếu SMK)</option>
                                        <option value="quy_trinh_5">Quy trình 5: Cấp lại không thuế (Đã đối chiếu SMK)</option>
                                        <option value="quy_trinh_6">Quy trình 6: Cấp lại có thuế (Có đối chiếu SMK)</option>
                                        <option value="quy_trinh_7">Quy trình 7: Cấp lại có thuế (Đã đối chiếu SMK)</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Row 2: Ngày nhận, Hẹn trả, Ngày giao NV, Trạng thái */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className={labelClass}>Ngày nhận</label>
                                <input type="date" required className={plainInputClass} value={dateVal(formData.receivedDate)} onChange={(e) => handleChange('receivedDate', e.target.value)} />
                            </div>
                            <div>
                                <label className={`${labelClass} text-red-600`}>Hẹn trả {formData.recordType !== '1.2 Công văn' && <span className="text-red-500">*</span>}</label>
                                <input type="date" required={formData.recordType !== '1.2 Công văn'} className={`${plainInputClass} bg-red-50/50 text-red-700 font-bold border-red-200`} value={dateVal(formData.deadline)} onChange={(e) => handleChange('deadline', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelClass}>Ngày giao NV</label>
                                <input type="date" className={plainInputClass} value={dateVal(formData.assignedDate)} onChange={(e) => handleChange('assignedDate', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelClass}>Trạng thái</label>
                                <select 
                                    className={selectClass} 
                                    value={(() => {
                                        if (isRegType(formData.recordType) || isRegistration(formData.recordType)) {
                                            const helper = getGcnWorkflowStepsHelper(formData as RecordFile, holidays || []);
                                            if (helper && helper.currentStepIndex !== undefined && helper.currentStepIndex !== null) {
                                                return `step_${helper.currentStepIndex}`;
                                            }
                                        }
                                        return formData.status || '';
                                    })()} 
                                    onChange={(e) => handleChange('status', e.target.value)}
                                >
                                    {(() => {
                                        if (isRegType(formData.recordType) || isRegistration(formData.recordType)) {
                                            const helper = getGcnWorkflowStepsHelper(formData as RecordFile, holidays || []);
                                            const stepOptions = helper.steps.map((step, idx) => (
                                                <option key={`step_${idx}`} value={`step_${idx}`}>
                                                    {step.label}
                                                </option>
                                            ));
                                            
                                            const otherStatuses = [
                                                { status: RecordStatus.PENDING_SUPPLEMENT, label: 'Chờ bổ sung (Người dân)' },
                                                { status: RecordStatus.WITHDRAWN, label: 'CSD rút hồ sơ' },
                                                { status: RecordStatus.REJECTED, label: 'Hồ sơ trả' },
                                                { status: RecordStatus.RETURNED, label: 'Đã trả kết quả' }
                                            ];
                                            
                                            const filteredOthers = otherStatuses.filter(item => {
                                                return !helper.steps.some(s => s.overallStatus === item.status);
                                            });

                                            return [
                                                ...stepOptions,
                                                ...filteredOthers.map(item => (
                                                    <option key={item.status} value={item.status}>
                                                        {item.label}
                                                    </option>
                                                ))
                                            ];
                                        } else {
                                            return Object.entries(STATUS_LABELS)
                                                .filter(([key]) => {
                                                    const isArchive = isArchiveType(formData.recordType);
                                                    if (isArchive) {
                                                        return key !== RecordStatus.PENDING_CHECK && key !== RecordStatus.CHECKED;
                                                    }
                                                    if (!isRegistration(formData.recordType)) {
                                                        return key !== RecordStatus.TBT && key !== RecordStatus.PENDING_SUPPLEMENT;
                                                    }
                                                    return true;
                                                })
                                                .map(([key, label]) => {
                                                    const customLabel = getStatusLabel(key as RecordStatus, formData.recordType);
                                                    return <option key={key} value={key}>{customLabel}</option>;
                                                });
                                        }
                                    })()}
                                </select>
                            </div>
                        </div>

                        {/* Row 3: Ngày trình ký */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className={`${labelClass} text-purple-600`}>Ngày trình ký</label>
                                <input type="date" className={`${plainInputClass} bg-purple-50 border-purple-200 text-purple-700 font-bold`} value={dateVal(formData.submissionDate)} onChange={(e) => handleChange('submissionDate', e.target.value)} />
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* DEFAULT BIÊN NHẬN (NEW MODE) WITH RECORD TYPE SELECTOR ON TOP */
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                    <div className="bg-white text-[#007bff] border-b border-slate-200 px-4 py-2.5 rounded-t-lg font-bold uppercase text-sm flex items-center gap-2">
                        <Calendar size={16} />
                        THÔNG TIN TIẾP NHẬN HỒ SƠ
                    </div>
                    <div className="p-4 space-y-4">
                        {/* Row 1: Loại hồ sơ (Dropdown) & Quy trình thuế */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div className={isRegistration(formData.recordType) && !isDefaultTaxProcedure(formData.recordType) ? "md:col-span-3" : "md:col-span-4"}>
                                <label className={`${labelClass} text-blue-600`}>Loại hồ sơ / Nội dung yêu cầu (Thủ tục thực hiện) <span className="text-red-500">*</span></label>
                                <div className="relative" ref={dropdownRef}>
                                    <input
                                        type="text"
                                        required
                                        className={`${plainInputClass} border-blue-300 font-semibold text-blue-800 pr-10 cursor-pointer`}
                                        placeholder="Gõ để tìm kiếm hoặc chọn thủ tục..."
                                        value={isDropdownOpen ? searchTerm : (formData.recordType === 'Đăng ký' ? 'Cấp Giấy' : (formData.recordType || ''))}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            setIsDropdownOpen(true);
                                        }}
                                        onClick={() => {
                                            setIsDropdownOpen(true);
                                        }}
                                    />
                                    {isDropdownOpen && (
                                        <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 z-50 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                            {filteredProcedures.map(p => (
                                                <div
                                                    key={p}
                                                    className="px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 cursor-pointer"
                                                    onClick={() => {
                                                        handleChange('recordType', p);
                                                        setIsDropdownOpen(false);
                                                    }}
                                                >
                                                    {p === 'Đăng ký' ? 'Cấp Giấy' : p}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {isRegistration(formData.recordType) && !isDefaultTaxProcedure(formData.recordType) && (
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
                        </div>



                        {/* Row 2: Mã hồ sơ, Ngày nhận, Hẹn trả */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {formData.recordType !== '1.2 Công văn' && (
                                <div>
                                    <label className={labelClass}>Mã hồ sơ <span className="text-red-500">*</span></label>
                                    {(() => {
                                        const rType = formData.recordType || '';
                                        const isType3 = rType.startsWith('3.');
                                        if (isType3) {
                                            return (
                                                <input 
                                                    type="text" 
                                                    className={`${plainInputClass} bg-white text-blue-600 font-bold font-mono`} 
                                                    placeholder="Nhập mã hồ sơ (hoặc để trống để tự sinh)..."
                                                    value={formData.code || ''} 
                                                    onChange={(e) => handleChange('code', e.target.value)} 
                                                />
                                            );
                                        } else {
                                            return (
                                                <input 
                                                     type="text" 
                                                    className={`${plainInputClass} bg-white text-blue-600 font-bold font-mono`} 
                                                    placeholder="Nhập mã hồ sơ (hoặc để trống để tự sinh)..."
                                                    value={formData.code || ''} 
                                                    onChange={(e) => handleChange('code', e.target.value)}
                                                />
                                            );
                                        }
                                    })()}
                                    <p className="text-[11px] text-slate-500 mt-1 font-medium">
                                        {formData.recordType?.startsWith('3.') 
                                            ? "* Lưu ý: Có thể điền mã từ hệ thống khác hoặc để trống để tự sinh." 
                                            : "* Lưu ý: Mã hồ sơ sẽ được tự động tạo khi nhấn Lưu hoặc In."}
                                    </p>
                                </div>
                            )}
                            <div className={formData.recordType === '1.2 Công văn' ? 'md:col-span-1' : ''}>
                                <label className={labelClass}>Ngày nhận</label>
                                <input type="date" required className={plainInputClass} value={dateVal(formData.receivedDate)} onChange={(e) => handleChange('receivedDate', e.target.value)} />
                            </div>
                            <div className={formData.recordType === '1.2 Công văn' ? 'md:col-span-2' : ''}>
                                <label className={`${labelClass} text-blue-600`}>Hẹn trả {formData.recordType !== '1.2 Công văn' && <span className="text-red-500">*</span>}</label>
                                <input 
                                    type="date" 
                                    required={formData.recordType !== '1.2 Công văn'} 
                                    className={`${plainInputClass} bg-blue-50 text-blue-700 font-bold border-blue-200`} 
                                    value={dateVal(formData.deadline)} 
                                    onChange={(e) => handleChange('deadline', e.target.value)} 
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isRegistration(formData.recordType) ? (
                <>
                    {/* CARD 1: THÔNG TIN NGƯỜI NỘP HỒ SƠ */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                <div className="bg-white text-[#007bff] border-b border-slate-200 px-4 py-2.5 rounded-t-lg font-bold uppercase text-sm flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <UserIcon size={16} />
                        THÔNG TIN NGƯỜI NỘP HỒ SƠ
                    </div>
                    {!isMeasOrArch && (
                        <label className="flex items-center gap-2 text-xs font-bold text-[#007bff] cursor-pointer select-none normal-case hover:text-blue-700 transition-colors">
                            <input 
                                type="checkbox"
                                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 bg-white"
                                checked={isApplicantOwner}
                                onChange={(e) => handleApplicantOwnerChange(e.target.checked)}
                            />
                            Người nộp hồ sơ là chủ hồ sơ
                        </label>
                    )}
                </div>
                <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-4">
                            <label className={labelClass}>Họ và tên người nộp {isNewRecord && <span className="text-red-500">*</span>}</label>
                            <input 
                                type="text" 
                                required={isNewRecord} 
                                className={plainInputClass} 
                                placeholder="Họ và tên..." 
                                value={applicantName} 
                                onChange={(e) => handleApplicantChange('name', e.target.value)} 
                            />
                        </div>
                        <div className="md:col-span-4">
                            <label className={labelClass}>CCCD/Số Giấy {isNewRecord && <span className="text-red-500">*</span>}</label>
                            <input 
                                type="text" 
                                required={isNewRecord} 
                                className={plainInputClass} 
                                placeholder="CCCD..." 
                                value={applicantCccd} 
                                onChange={(e) => handleApplicantChange('cccd', e.target.value)} 
                            />
                        </div>
                        <div className="md:col-span-4">
                            <label className={labelClass}>SĐT người nộp {isNewRecord && <span className="text-red-500">*</span>}</label>
                            <input 
                                type="text" 
                                required={isNewRecord} 
                                className={plainInputClass} 
                                placeholder="Số điện thoại..." 
                                value={applicantPhone} 
                                onChange={(e) => handleApplicantChange('phone', e.target.value)} 
                            />
                        </div>
                        <div className="md:col-span-12 mt-2">
                            <label className={labelClass}>Địa chỉ thường trú {isNewRecord && <span className="text-red-500">*</span>}</label>
                            <input 
                                type="text" 
                                required={isNewRecord} 
                                className={plainInputClass} 
                                placeholder="Nhập địa chỉ thường trú..." 
                                value={formData.customerAddress || ''} 
                                onChange={(e) => handleChange('customerAddress', e.target.value)} 
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* CARD 2: THÔNG TIN THỬA ĐẤT */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-white text-[#007bff] border-b border-slate-200 px-4 py-2.5 font-bold uppercase text-sm flex items-center gap-2">
                    <MapPin size={16} />
                    THÔNG TIN THỬA ĐẤT
                </div>
                <div className="p-4 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className={labelClass}>Tỉnh/Thành phố {isNewRecord && <span className="text-red-500">*</span>}</label>
                            <select className={selectClass} disabled value="Thành Phố Đồng Nai">
                                <option value="Thành Phố Đồng Nai">Thành Phố Đồng Nai</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Phường/xã {isNewRecord && formData.recordType !== '1.2 Công văn' && <span className="text-red-500">*</span>}</label>
                            <select 
                                required={isNewRecord && formData.recordType !== '1.2 Công văn'} 
                                className={selectClass} 
                                value={formData.ward || ''} 
                                onChange={(e) => handleChange('ward', e.target.value)}
                            >
                                <option value="">-- Chọn phường/xã --</option>
                                {wards.map(w => <option key={w} value={w}>{w}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Địa chỉ chi tiết</label>
                            <input type="text" className={plainInputClass} placeholder="Số nhà, tên đường, tổ/ấp..." value={formData.address || ''} onChange={(e) => handleChange('address', e.target.value)} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className={labelClass}>Số thứ tự thửa {isNewRecord && formData.recordType !== '1.2 Công văn' && <span className="text-red-500">*</span>}</label>
                            <input type="text" required={isNewRecord && formData.recordType !== '1.2 Công văn'} className={plainInputClass} placeholder="Số thửa..." value={formData.landPlot || ''} onChange={(e) => handleChange('landPlot', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Tờ bản đồ {isNewRecord && formData.recordType !== '1.2 Công văn' && <span className="text-red-500">*</span>}</label>
                            <input type="text" required={isNewRecord && formData.recordType !== '1.2 Công văn'} className={plainInputClass} placeholder="Số tờ bản đồ..." value={formData.mapSheet || ''} onChange={(e) => handleChange('mapSheet', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Ngày cấp GCN</label>
                            <input type="date" className={plainInputClass} value={dateVal(formData.issueDate)} onChange={(e) => handleChange('issueDate', e.target.value)} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Số vào sổ</label>
                            <input type="text" className={plainInputClass} placeholder="Số vào sổ cấp GCN..." value={formData.entryNumber || ''} onChange={(e) => handleChange('entryNumber', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Số GCN</label>
                            <input type="text" className={plainInputClass} placeholder="Số phát hành GCN (Số seri)..." value={formData.issueNumber || ''} onChange={(e) => handleChange('issueNumber', e.target.value)} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Số Trích đo</label>
                            <input type="text" className={plainInputClass} placeholder="Số trích đo..." value={formData.measurementNumber || ''} onChange={(e) => handleChange('measurementNumber', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Số Trích lục</label>
                            <input type="text" className={plainInputClass} placeholder="Số trích lục..." value={formData.excerptNumber || ''} onChange={(e) => handleChange('excerptNumber', e.target.value)} />
                        </div>
                    </div>

                    {/* Shaded Area Grid */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                        {/* Header Block */}
                        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-slate-700 tracking-wide uppercase">
                                    DIỆN TÍCH THỬA ĐẤT:
                                </span>
                                {(() => {
                                    const hasActiveLandRows = landAreaRows && landAreaRows.some(row => row.area !== '' && parseFloat(row.area as any) > 0);
                                    if (hasActiveLandRows) {
                                        return (
                                            <span className="text-sm font-black text-slate-900 bg-slate-200/60 px-2.5 py-1 rounded-md font-mono">
                                                {(formData.area || 0).toLocaleString('vi-VN')} m²
                                            </span>
                                        );
                                    } else {
                                        return (
                                            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2 h-[32px] w-36 focus-within:border-emerald-500 shadow-sm">
                                                <input
                                                    type="number"
                                                    step="any"
                                                    placeholder="Nhập tổng DT..."
                                                    className="w-full border-none bg-transparent outline-none text-right font-mono font-bold text-xs text-slate-800"
                                                    value={formData.area === undefined || formData.area === null || formData.area === 0 ? '' : formData.area}
                                                    onChange={(e) => {
                                                        const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                                                        handleChange('area', val);
                                                    }}
                                                />
                                                <span className="text-[10px] font-bold text-slate-400">m²</span>
                                            </div>
                                        );
                                    }
                                })()}
                            </div>
                            <button 
                                type="button" 
                                onClick={addLandAreaRow}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 active:scale-95 shadow-sm transition-all cursor-pointer"
                            >
                                <span>+ Thêm loại đất</span>
                            </button>
                        </div>

                        {/* Rows Block */}
                        <div className="p-4 bg-white">
                            <div className="flex flex-wrap items-center gap-3">
                                {landAreaRows.length === 0 ? (
                                    <div className="text-xs text-slate-400 font-medium italic w-full text-center py-2">
                                        Chưa có loại đất nào được thêm. Hãy nhấn nút "+ Thêm loại đất".
                                    </div>
                                ) : (
                                    landAreaRows.map((row, index) => (
                                        <div key={index} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1.5 shadow-sm animate-fade-in shrink-0 h-[44px]">
                                            <div className="relative shrink-0">
                                                <select 
                                                    className="pl-2 pr-6 py-1 border border-slate-200 rounded-lg text-xs bg-white outline-none focus:border-emerald-500 font-bold text-slate-700 cursor-pointer h-[30px] appearance-none"
                                                    style={{ backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`, backgroundPosition: 'right 6px center', backgroundSize: '12px', backgroundRepeat: 'no-repeat' }}
                                                    value={row.type}
                                                    onChange={(e) => handleLandRowTypeChange(index, e.target.value)}
                                                >
                                                    <option value="ONT/ODT">ONT/ODT</option>
                                                    <option value="CLN">CLN</option>
                                                    <option value="BHK">BHK</option>
                                                    <option value="LUC">LUC</option>
                                                    <option value="Khác">Khác</option>
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 h-[30px] w-28 focus-within:border-emerald-500">
                                                <input 
                                                    type="number" 
                                                    step="any" 
                                                    placeholder="0,0" 
                                                    className="w-full border-none bg-transparent outline-none text-right font-mono font-bold text-xs text-slate-800" 
                                                    value={row.area === '' ? '' : row.area} 
                                                    onChange={(e) => handleLandRowAreaChange(index, e.target.value)} 
                                                />
                                                <span className="text-[10px] font-bold text-slate-400 shrink-0">m²</span>
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => removeLandAreaRow(index)}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded-lg transition-colors shrink-0 cursor-pointer"
                                                title="Xóa loại đất này"
                                            >
                                                <XCircle size={15} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* OWNER ROWS TABLE */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mt-4">
                <div className="bg-white text-[#007bff] border-b border-slate-200 px-4 py-2.5 font-bold uppercase text-sm flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <UserIcon size={16} />
                        Người đứng tên GCN
                    </div>
                    <button 
                        type="button" 
                        onClick={addOwnerRow} 
                        className="px-3 py-1 bg-white hover:bg-blue-50 text-[#007bff] border border-[#007bff]/30 hover:border-[#007bff] rounded text-xs font-bold flex items-center gap-1 active:scale-95 shadow-sm transition-all uppercase"
                    >
                        <span>+ Thêm mới</span>
                    </button>
                </div>
                <div className="p-4 space-y-4">
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-3 py-2 text-center text-xs font-bold text-slate-500 uppercase w-12">#</th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">
                                        Họ tên người đứng tên GCN <span className="text-red-500">*</span>
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase w-48">Giấy CMND/ CCCD <span className="text-red-500">*</span></th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase w-40">Số điện thoại</th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Ghi chú</th>
                                    <th className="px-3 py-2 text-center text-xs font-bold text-slate-500 uppercase w-16">Xóa</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {ownerRows.map((row, index) => (
                                    <tr key={index}>
                                        <td className="px-3 py-1.5 text-center font-medium text-slate-500">{index + 1}</td>
                                        <td className="px-3 py-1.5">
                                            <input 
                                                type="text" 
                                                required={isNewRecord} 
                                                readOnly={(isApplicantOwner || isMeasOrArch) && index === 0}
                                                className={`w-full border border-slate-300 rounded px-2 py-1 text-sm outline-none focus:border-blue-500 ${(isApplicantOwner || isMeasOrArch) && index === 0 ? 'bg-slate-100 text-slate-500 cursor-not-allowed font-medium' : 'bg-white text-slate-800'}`} 
                                                value={row.name} 
                                                onChange={(e) => handleOwnerRowChange(index, 'name', e.target.value)} 
                                                placeholder="Họ tên..." 
                                            />
                                        </td>
                                        <td className="px-3 py-1.5">
                                            <input 
                                                type="text" 
                                                required={isNewRecord} 
                                                readOnly={(isApplicantOwner || isMeasOrArch) && index === 0}
                                                className={`w-full border border-slate-300 rounded px-2 py-1 text-sm outline-none focus:border-blue-500 ${(isApplicantOwner || isMeasOrArch) && index === 0 ? 'bg-slate-100 text-slate-500 cursor-not-allowed font-medium' : 'bg-white text-slate-800'}`} 
                                                value={row.cccd} 
                                                onChange={(e) => handleOwnerRowChange(index, 'cccd', e.target.value)} 
                                                placeholder="CCCD..." 
                                            />
                                        </td>
                                        <td className="px-3 py-1.5">
                                            <input 
                                                type="text" 
                                                readOnly={(isApplicantOwner || isMeasOrArch) && index === 0}
                                                className={`w-full border border-slate-300 rounded px-2 py-1 text-sm outline-none focus:border-blue-500 ${(isApplicantOwner || isMeasOrArch) && index === 0 ? 'bg-slate-100 text-slate-500 cursor-not-allowed font-medium' : 'bg-white text-slate-800'}`} 
                                                value={row.phone} 
                                                onChange={(e) => handleOwnerRowChange(index, 'phone', e.target.value)} 
                                                placeholder="SĐT..." 
                                            />
                                        </td>
                                        <td className="px-3 py-1.5">
                                            <input type="text" className="w-full border border-slate-300 rounded px-2 py-1 text-sm bg-white focus:border-blue-500 outline-none" value={row.note} onChange={(e) => handleOwnerRowChange(index, 'note', e.target.value)} placeholder="Ghi chú..." />
                                        </td>
                                        <td className="px-3 py-1.5 text-center">
                                            <button type="button" disabled={ownerRows.length <= 1} onClick={() => removeOwnerRow(index)} className="text-red-500 hover:text-red-700 disabled:opacity-30 p-1">
                                                <XCircle size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* RECEIVER ROWS TABLE */}
            {!isMeasOrArch && (
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mt-4">
                    <div className="bg-white text-[#007bff] border-b border-slate-200 px-4 py-2.5 font-bold uppercase text-sm flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <UserIcon size={16} />
                            Người nhận (chuyển nhượng, thừa kế, tặng cho, thỏa thuận) (nếu có)
                        </div>
                        <button 
                            type="button" 
                            onClick={addReceiverRow} 
                            className="px-3 py-1 bg-white hover:bg-blue-50 text-[#007bff] border border-[#007bff]/30 hover:border-[#007bff] rounded text-xs font-bold flex items-center gap-1 active:scale-95 shadow-sm transition-all uppercase shrink-0"
                        >
                            <span>+ Thêm mới</span>
                        </button>
                    </div>
                    <div className="p-4 space-y-4">
                        <div className="overflow-x-auto border border-slate-200 rounded-lg">
                            <table className="min-w-full divide-y divide-slate-200 text-sm">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-3 py-2 text-center text-xs font-bold text-slate-500 uppercase w-12">#</th>
                                        <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">
                                            Họ và tên người nhận chuyển nhượng
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase w-48">Giấy CMND/ CCCD</th>
                                        <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase w-40">Số điện thoại</th>
                                        <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Ghi chú</th>
                                        <th className="px-3 py-2 text-center text-xs font-bold text-slate-500 uppercase w-16">Xóa</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {receiverRows.map((row, index) => (
                                        <tr key={index}>
                                            <td className="px-3 py-1.5 text-center font-medium text-slate-500">{index + 1}</td>
                                            <td className="px-3 py-1.5">
                                                <input 
                                                    type="text" 
                                                    readOnly={!isApplicantOwner && index === 0}
                                                    className={`w-full border border-slate-300 rounded px-2 py-1 text-sm outline-none focus:border-blue-500 ${!isApplicantOwner && index === 0 ? 'bg-slate-100 text-slate-500 cursor-not-allowed font-medium' : 'bg-white text-slate-800'}`} 
                                                    value={row.name} 
                                                    onChange={(e) => handleReceiverRowChange(index, 'name', e.target.value)} 
                                                    placeholder="Họ tên..." 
                                                />
                                            </td>
                                            <td className="px-3 py-1.5">
                                                <input 
                                                    type="text" 
                                                    readOnly={!isApplicantOwner && index === 0}
                                                    className={`w-full border border-slate-300 rounded px-2 py-1 text-sm outline-none focus:border-blue-500 ${!isApplicantOwner && index === 0 ? 'bg-slate-100 text-slate-500 cursor-not-allowed font-medium' : 'bg-white text-slate-800'}`} 
                                                    value={row.cccd} 
                                                    onChange={(e) => handleReceiverRowChange(index, 'cccd', e.target.value)} 
                                                    placeholder="CCCD..." 
                                                />
                                            </td>
                                            <td className="px-3 py-1.5">
                                                <input 
                                                    type="text" 
                                                    readOnly={!isApplicantOwner && index === 0}
                                                    className={`w-full border border-slate-300 rounded px-2 py-1 text-sm outline-none focus:border-blue-500 ${!isApplicantOwner && index === 0 ? 'bg-slate-100 text-slate-500 cursor-not-allowed font-medium' : 'bg-white text-slate-800'}`} 
                                                    value={row.phone} 
                                                    onChange={(e) => handleReceiverRowChange(index, 'phone', e.target.value)} 
                                                    placeholder="SĐT..." 
                                                />
                                            </td>
                                            <td className="px-3 py-1.5">
                                                <input type="text" className="w-full border border-slate-300 rounded px-2 py-1 text-sm bg-white focus:border-blue-500 outline-none" value={row.note} onChange={(e) => handleReceiverRowChange(index, 'note', e.target.value)} placeholder="Ghi chú..." />
                                            </td>
                                            <td className="px-3 py-1.5 text-center">
                                                <button type="button" onClick={() => removeReceiverRow(index)} className="text-red-500 hover:text-red-700 p-1">
                                                    <XCircle size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {receiverRows.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-3 py-3 text-center text-slate-400 text-xs font-semibold italic">
                                                Không có người nhận (Click nút "Thêm mới" để nhập liệu)
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* OTHER DOCS ROWS TABLE */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mt-4">
                <div className="bg-white text-[#007bff] border-b border-slate-200 px-4 py-2.5 font-bold uppercase text-sm flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileText size={16} />
                        Giấy tờ kèm theo khác (nếu có)
                    </div>
                    <button 
                        type="button" 
                        onClick={() => addOtherDocRow()} 
                        className="px-3 py-1 bg-white hover:bg-blue-50 text-[#007bff] border border-[#007bff]/30 hover:border-[#007bff] rounded text-xs font-bold flex items-center gap-1 active:scale-95 shadow-sm transition-all uppercase"
                    >
                        <span>+ Thêm mới</span>
                    </button>
                </div>
                <div className="p-4 space-y-4">
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-3 py-2 text-center text-xs font-bold text-slate-500 uppercase w-12">#</th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Tên giấy tờ khác nộp kèm</th>
                                    <th className="px-3 py-2 text-center text-xs font-bold text-slate-500 uppercase w-72">Hình thức nộp</th>
                                    <th className="px-3 py-2 text-center text-xs font-bold text-slate-500 uppercase w-16">Xóa</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {otherDocRows.map((row, index) => (
                                    <tr key={index}>
                                        <td className="px-3 py-1.5 text-center font-medium text-slate-500">{index + 1}</td>
                                        <td className="px-3 py-1.5">
                                            <input 
                                                type="text" 
                                                className={plainInputClass} 
                                                value={row.name} 
                                                onChange={(e) => handleOtherDocRowChange(index, 'name', e.target.value)} 
                                                placeholder="Các giấy tờ khác nộp kèm..." 
                                            />
                                        </td>
                                        <td className="px-3 py-1.5 text-center">
                                            <div className="flex items-center justify-center gap-6 h-[32px]">
                                                <label className="flex items-center gap-1.5 text-sm cursor-pointer font-semibold text-slate-700">
                                                    <input 
                                                        type="radio" 
                                                        name={`otherDocsCopy-${index}`} 
                                                        value="Bản chính" 
                                                        checked={row.type === 'Bản chính'} 
                                                        onChange={(e) => handleOtherDocRowChange(index, 'type', e.target.value)} 
                                                        className="text-blue-600 focus:ring-blue-500" 
                                                    />
                                                    Bản chính
                                                </label>
                                                <label className="flex items-center gap-1.5 text-sm cursor-pointer font-semibold text-slate-700">
                                                    <input 
                                                        type="radio" 
                                                        name={`otherDocsCopy-${index}`} 
                                                        value="Bản sao" 
                                                        checked={row.type === 'Bản sao'} 
                                                        onChange={(e) => handleOtherDocRowChange(index, 'type', e.target.value)} 
                                                        className="text-blue-600 focus:ring-blue-500" 
                                                    />
                                                    Bản sao
                                                </label>
                                            </div>
                                        </td>
                                        <td className="px-3 py-1.5 text-center">
                                            <button type="button" onClick={() => removeOtherDocRow(index)} className="text-red-500 hover:text-red-700 p-1">
                                                <XCircle size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {otherDocRows.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-3 py-3 text-center text-slate-400 text-xs font-semibold italic">Không có giấy tờ kèm theo khác (Click nút "Thêm mới" để nhập liệu)</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* CARD 3: THÔNG TIN NGƯỜI ĐƯỢC ỦY QUYỀN */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mt-4">
                <div 
                    onClick={() => setShowAuthSection(!showAuthSection)} 
                    className="bg-white hover:bg-slate-50 text-[#007bff] border-b border-slate-200 px-4 py-2.5 font-bold uppercase text-sm flex items-center justify-between cursor-pointer select-none transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <FileText size={16} />
                        THÔNG TIN NGƯỜI ĐƯỢC ỦY QUYỀN (Nếu có)
                    </div>
                    <span className="text-xs font-semibold bg-blue-50 border border-blue-200 px-2.5 py-1 rounded text-blue-600">
                        {showAuthSection ? '▲ Ẩn nhập liệu' : '▶ Click để nhập'}
                    </span>
                </div>
                {showAuthSection && (
                    <div className="p-4 space-y-4 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className={labelClass}>Người được ủy quyền</label>
                                <input 
                                    type="text" 
                                    placeholder="Họ tên người được ủy quyền..." 
                                    className={plainInputClass} 
                                    value={formData.authorizedBy || ''} 
                                    onChange={(e) => handleChange('authorizedBy', e.target.value)} 
                                />
                            </div>
                            <div>
                                <label className={labelClass}>CCCD/Số Giấy người được ủy quyền</label>
                                <input 
                                    type="text" 
                                    placeholder="CCCD người được ủy quyền..." 
                                    className={plainInputClass} 
                                    value={authDocNumber} 
                                    onChange={(e) => setAuthDocNumber(e.target.value)} 
                                />
                            </div>
                            <div>
                                <label className={labelClass}>SĐT người được ủy quyền</label>
                                <input 
                                    type="text" 
                                    placeholder="SĐT người được ủy quyền..." 
                                    className={plainInputClass} 
                                    value={authPhone} 
                                    onChange={(e) => setAuthPhone(e.target.value)} 
                                />
                            </div>
                            <div className="md:col-span-3 mt-2">
                                <label className={labelClass}>Địa chỉ thường trú người được ủy quyền</label>
                                <input 
                                    type="text" 
                                    placeholder="Nhập địa chỉ thường trú người được ủy quyền..." 
                                    className={plainInputClass} 
                                    value={authAddress} 
                                    onChange={(e) => setAuthAddress(e.target.value)} 
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
 
                </>
            ) : (
                <SimpleRecordForm
                    formData={formData}
                    handleChange={handleChange}
                    applicantName={applicantName}
                    setApplicantName={setApplicantName}
                    applicantPhone={applicantPhone}
                    setApplicantPhone={setApplicantPhone}
                    applicantCccd={applicantCccd}
                    setApplicantCccd={setApplicantCccd}
                    wards={wards}
                    employees={employees}
                    isMeas={isMeas}
                    hasAdminRights={hasAdminRights}
                    dateVal={dateVal}
                    labelClass={labelClass}
                    plainInputClass={plainInputClass}
                    selectClass={selectClass}
                    otherDocRows={otherDocRows}
                    handleOtherDocRowChange={handleOtherDocRowChange}
                    addOtherDocRow={addOtherDocRow}
                    removeOtherDocRow={removeOtherDocRow}
                    showAuthSection={showAuthSection}
                    setShowAuthSection={setShowAuthSection}
                    authDocNumber={authDocNumber}
                    setAuthDocNumber={setAuthDocNumber}
                    authAddress={authAddress}
                    setAuthAddress={setAuthAddress}
                    authPhone={authPhone}
                    setAuthPhone={setAuthPhone}
                    isMeasOrArch={isMeasOrArch}
                    isApplicantOwner={isApplicantOwner}
                    handleApplicantOwnerChange={handleApplicantOwnerChange}
                    landAreaRows={landAreaRows}
                    addLandAreaRow={addLandAreaRow}
                    removeLandAreaRow={removeLandAreaRow}
                    handleLandRowAreaChange={handleLandRowAreaChange}
                    handleLandRowTypeChange={handleLandRowTypeChange}
                />
            )}

            {initialData && initialData.id && (
                <div className="space-y-6 mt-4">
                    {/* SECTION: NHÂN VIÊN */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                        <div>
                            <label className={labelClass}>Giao nhân viên xử lý</label>
                            <select 
                                className={selectClass} 
                                value={formData.assignedTo || ''} 
                                onChange={(e) => {
                                    const empId = e.target.value;
                                    handleChange('assignedTo', empId);
                                    if (empId && !formData.assignedDate) {
                                        handleChange('assignedDate', new Date().toISOString().split('T')[0]);
                                    }
                                }}
                            >
                                <option value="">-- Chọn nhân viên --</option>
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

                    {/* SECTION: ĐỢT XUẤT & NGÀY XUẤT */}
                    <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-4 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={`${labelClass} text-blue-800`}>Đợt xuất (Batch)</label>
                                <input 
                                    type="number" 
                                    className={`${plainInputClass} border-blue-200 focus:border-blue-500`}
                                    placeholder="Nhập đợt xuất..."
                                    value={formData.exportBatch || ''} 
                                    onChange={(e) => handleChange('exportBatch', e.target.value ? parseInt(e.target.value) : null)} 
                                />
                            </div>
                            <div>
                                <label className={`${labelClass} text-blue-800`}>Ngày xuất</label>
                                <input 
                                    type="date" 
                                    className={`${plainInputClass} border-blue-200 focus:border-blue-500`}
                                    value={dateVal(formData.exportDate)} 
                                    onChange={(e) => handleChange('exportDate', e.target.value)} 
                                />
                            </div>
                        </div>
                    </div>

                    {/* SECTION: TRẢ KẾT QUẢ CHO DÂN */}
                    <div className="bg-white rounded-lg border border-emerald-200 shadow-sm overflow-hidden">
                        <div className="bg-emerald-600 text-white px-4 py-2.5 font-bold uppercase text-sm flex items-center gap-2">
                            <FileCheck size={16} />
                            TRẢ KẾT QUẢ CHO DÂN
                        </div>
                        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-emerald-50/20">
                            <div>
                                <label className={`${labelClass} text-emerald-800`}>Ngày trả kết quả</label>
                                <input 
                                    type="date" 
                                    className={`${plainInputClass} border-emerald-200 focus:border-emerald-500 bg-white`}
                                    value={dateVal(formData.resultReturnedDate)} 
                                    onChange={(e) => handleChange('resultReturnedDate', e.target.value)} 
                                />
                            </div>
                            <div>
                                <label className={`${labelClass} text-emerald-800`}>Số Biên lai/ Hóa đơn</label>
                                <input 
                                    type="text" 
                                    className={`${plainInputClass} border-emerald-200 focus:border-emerald-500 bg-white`}
                                    placeholder="Nhập số biên lai/ hóa đơn..."
                                    value={formData.receiptNumber || ''} 
                                    onChange={(e) => handleChange('receiptNumber', e.target.value)} 
                                />
                            </div>
                            <div>
                                <label className={`${labelClass} text-emerald-800`}>Số tiền (VNĐ)</label>
                                <input 
                                    type="text" 
                                    className={`${plainInputClass} border-emerald-200 focus:border-emerald-500 bg-white text-right font-mono font-bold`}
                                    placeholder="Nhập số tiền thực thu..."
                                    value={formData.paymentAmount !== null && formData.paymentAmount !== undefined ? formData.paymentAmount.toLocaleString('vi-VN') : ''} 
                                    onChange={(e) => {
                                        const rawVal = e.target.value.replace(/[^0-9]/g, '');
                                        handleChange('paymentAmount', rawVal ? parseInt(rawVal, 10) : null);
                                    }} 
                                />
                            </div>
                        </div>
                    </div>

                    {/* SECTION: GHI CHÚ NỘI BỘ */}
                    <div className="bg-white rounded-lg border border-orange-200 shadow-sm overflow-hidden">
                        <div className="bg-orange-600 text-white px-4 py-2.5 font-bold uppercase text-sm flex items-center gap-2">
                            <Lock size={16} />
                            GHI CHÚ NỘI BỘ
                        </div>
                        <div className="p-4 bg-orange-50/10">
                            <textarea 
                                rows={3} 
                                className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all font-medium text-gray-800"
                                placeholder="Nhập ghi chú nội bộ..."
                                value={formData.privateNotes || ''} 
                                onChange={(e) => handleChange('privateNotes', e.target.value)} 
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ACTION BUTTONS (LƯU & IN HỒ SƠ / NHẬP LẠI) */}
            {!isInModal && (
                <div className="sticky bottom-0 z-30 flex items-center justify-end gap-3 border-t border-slate-200 mt-8 bg-slate-50/95 backdrop-blur-md -mx-6 -mb-6 p-4 md:px-6 md:py-4 rounded-b-lg shadow-[0_-8px_20px_-10px_rgba(0,0,0,0.15)] transition-all">
                    <button
                        type="button"
                        onClick={() => handleReset(false)}
                        className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-md text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors active:scale-[0.98] cursor-pointer"
                    >
                        <RotateCcw size={16} /> Nhập lại
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-1.5 px-6 py-2 bg-[#007bff] hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md text-sm font-bold shadow-md transition-colors active:scale-[0.98] cursor-pointer select-none"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={16} className="animate-spin" /> Đang lưu...
                            </>
                        ) : (
                            <>
                                <Save size={16} /> {initialData && initialData.id ? 'Cập nhật' : (currentView === 'receive_record' ? 'Lưu & In hồ sơ' : 'Lưu')}
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    </form>
  );
};

export default RecordForm;

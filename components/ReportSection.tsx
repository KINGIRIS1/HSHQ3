
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { BarChart3, FileSpreadsheet, Loader2, Sparkles, Download, CalendarDays, Printer, Layout, FileText, ListFilter, CheckCircle2, Clock, AlertTriangle, Settings, Key, X, Save, MapPin, UserCheck, ChevronLeft, ChevronRight, PieChart, CheckCircle, Ruler, FolderArchive, CalendarRange, Coins } from 'lucide-react';
import { RecordFile, RecordStatus, Employee, User, UserRole } from '../types';
import { getNormalizedWard, STATUS_LABELS, REGISTRATION_PROCEDURES, getShortRecordType } from '../constants';
import { isRecordOverdue, removeVietnameseTones, isRecordApproaching, isArchiveType, getDisplayNotes } from '../utils/appHelpers';
import { saveGeminiKey, getGeminiKey } from '../services/geminiService';
import { fetchArchiveRecords } from '../services/apiArchive';
import EmployeeStatsView from './report/EmployeeStatsView';
import WardStatsView from './report/WardStatsView';
import DailyStatsView from './report/DailyStatsView';
import RevenueStatsView from './report/RevenueStatsView';
import { getEmployeeTeam } from './AssignModal';

const isReg = (type: string | null | undefined): boolean => {
    if (!type) return false;
    const t = type.trim().toLowerCase();
    return t.startsWith('3.') || t === 'đăng ký' || t === 'cấp giấy' || t === 'cấp đổi' || t === 'cấp lại' || REGISTRATION_PROCEDURES.some(p => p.toLowerCase() === t);
};
import OverdueStatsView from './report/OverdueStatsView';

interface ReportSectionProps {
    reportContent: string;
    isGenerating: boolean;
    onGenerate: (fromDate: string, toDate: string, title?: string, data?: RecordFile[]) => void;
    onExportExcel: (fromDate: string, toDate: string, ward: string, title?: string, data?: RecordFile[]) => void;
    records: RecordFile[];
    wards: string[]; 
    employees: Employee[];
    currentUser: User;
}

const ReportSection: React.FC<ReportSectionProps> = ({ 
    reportContent, 
    isGenerating, 
    onGenerate, 
    onExportExcel, 
    records: rawRecords, 
    wards, 
    employees: rawEmployees,
    currentUser 
}) => {
    const isSystemAdmin = useMemo(() => {
        if (!currentUser) return false;
        const roleStr = (currentUser.role as string).toUpperCase();
        return roleStr === 'ADMIN' || roleStr === 'SUBADMIN';
    }, [currentUser]);

    const userEmp = useMemo(() => {
        if (!currentUser) return null;
        return rawEmployees.find(e => e.id === currentUser.employeeId) || null;
    }, [rawEmployees, currentUser]);

    const isTeamLeader = useMemo(() => {
        if (!currentUser) return false;
        if (isSystemAdmin) return false;
        if (currentUser.role === UserRole.TEAM_LEADER) return true;
        if (!userEmp) return false;
        const pos = removeVietnameseTones(userEmp.position || '').toLowerCase();
        return pos.includes('to truong') || pos.includes('truong to') || pos.includes('pho to') || pos.includes('pho truong') || pos.includes('truong nhom') || pos.includes('nhom truong');
    }, [currentUser, userEmp, isSystemAdmin]);

    const myTeamName = useMemo(() => {
        if (!userEmp) return '';
        return getEmployeeTeam(userEmp);
    }, [userEmp]);

    // Filter employees and records based on the user's team / department (tổ)
    const employees = useMemo(() => {
        if (!currentUser) return rawEmployees;
        if (isSystemAdmin) return rawEmployees;

        // Nếu là Team Leader, chỉ hiện nhân viên của tổ mình phụ trách
        if (isTeamLeader && myTeamName) {
            return rawEmployees.filter(e => getEmployeeTeam(e) === myTeamName);
        }

        // Đối với tài khoản cá nhân (regular Employee), chỉ hiện chính bản thân mình
        if (userEmp) {
            return [userEmp];
        }

        return rawEmployees;
    }, [rawEmployees, currentUser, isSystemAdmin, isTeamLeader, myTeamName, userEmp]);

    const records = useMemo(() => {
        if (!currentUser) return rawRecords;
        if (isSystemAdmin) return rawRecords;

        // Nếu là Team Leader, chỉ hiện hồ sơ của tổ mình phụ trách
        if (isTeamLeader && myTeamName) {
            // Tổ Hành chính hoặc Ban Giám đốc có thể xem báo cáo của tất cả
            if (myTeamName === 'Tổ Hành chính' || myTeamName === 'Ban Giám đốc') {
                return rawRecords;
            }

            const teamEmpIds = new Set(rawEmployees.filter(e => getEmployeeTeam(e) === myTeamName).map(e => e.id));
            return rawRecords.filter(r => {
                if (r.assignedTo && teamEmpIds.has(r.assignedTo)) return true;
                
                // Trùng domain lĩnh vực nếu hồ sơ chưa giao hoặc giao ngoài
                if (myTeamName === 'Tổ Đo đạc') {
                    return !['CMD', 'Tòa án', 'Thi hành án'].includes(r.recordType || '') && !isArchiveType(r.recordType) && r.recordType !== 'Sao lục' && r.recordType !== 'Công văn' && !isReg(r.recordType);
                }
                if (myTeamName === 'Tổ Cấp giấy') {
                    return isReg(r.recordType);
                }
                if (myTeamName === 'Tổ Lưu trữ') {
                    return isArchiveType(r.recordType) || ['Sao lục', 'Công văn'].includes(r.recordType || '');
                }
                return false;
            });
        }

        // Đối với tài khoản cá nhân, chỉ hiện hồ sơ được giao việc của bản thân mình (hoặc có liên quan)
        const myEmpId = currentUser.employeeId;
        return rawRecords.filter(r => 
            r.assignedTo === myEmpId || 
            r.checkedBy === myEmpId || 
            r.submittedTo === myEmpId || 
            r.receivedBy === myEmpId
        );
    }, [rawRecords, rawEmployees, currentUser, isSystemAdmin, isTeamLeader, myTeamName]);

    const [fromDate, setFromDate] = useState(() => {
        return '2025-01-01';
    });
    const [toDate, setToDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });
    
    // State chọn xã phường
    const [selectedWard, setSelectedWard] = useState<string>('all');
    
    // State chọn nhân viên (Lifting state up) - mặc định pre-select cho tài khoản cá nhân
    const [selectedEmpId, setSelectedEmpId] = useState<string>(() => {
        if (!currentUser) return '';
        const roleStr = (currentUser.role as string).toUpperCase();
        const isSysAdmin = roleStr === 'ADMIN' || roleStr === 'SUBADMIN';
        const userEmpObj = rawEmployees.find(e => e.id === currentUser.employeeId);
        const isLeader = currentUser.role === UserRole.TEAM_LEADER || (userEmpObj && (() => {
            const pos = removeVietnameseTones(userEmpObj.position || '').toLowerCase();
            return pos.includes('to truong') || pos.includes('truong to') || pos.includes('pho to') || pos.includes('pho truong') || pos.includes('truong nhom') || pos.includes('nhom truong');
        })());

        if (!isSysAdmin && !isLeader) {
            return currentUser.employeeId || '';
        }
        return '';
    });

    // Report Type State
    const [reportType, setReportType] = useState<'week' | 'month' | 'custom'>('custom');

    const [activeTab, setActiveTab] = useState<'list' | 'ward_stats' | 'ai' | 'employee' | 'daily_stats' | 'overdue' | 'revenue'>('list');
    const previewRef = useRef<HTMLDivElement>(null);

    const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
    const [apiKey, setApiKey] = useState('');

    // Pagination States
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [listFilterType, setListFilterType] = useState<'all' | 'completed' | 'processing' | 'overdue_pending' | 'overdue_completed'>('all');

    const [dailyStatsRecords, setDailyStatsRecords] = useState<RecordFile[]>([]);

    // --- NEW LOGIC FOR MAIN TABS (Đo đạc vs Cấp giấy vs Lưu trữ) ---
    const allowedMainTabs = useMemo(() => {
        if (!currentUser) return ['measurement', 'registration', 'archive'];
        
        const roleStr = (currentUser.role as string).toUpperCase();
        const isSystemAdmin = roleStr === 'ADMIN' || roleStr === 'SUBADMIN';
        if (isSystemAdmin) return ['measurement', 'registration', 'archive'];

        const userEmp = rawEmployees.find(e => e.id === currentUser.employeeId);
        if (!userEmp) return ['measurement', 'registration', 'archive']; // fallback

        const dept = userEmp.department.toLowerCase();
        // Exception for administrative/leadership who can view everything
        const isPrivilegedDept = dept.includes('hành chính') || dept.includes('giám đốc') || dept.includes('lãnh đạo') || dept.includes('quản trị');
        if (isPrivilegedDept) return ['measurement', 'registration', 'archive'];

        const allowed: string[] = [];
        if (dept.includes('đo đạc') || dept.includes('kỹ thuật')) {
            allowed.push('measurement');
        }
        if (dept.includes('cấp giấy') || dept.includes('đăng ký') || dept.includes('biến động') || dept.includes('thẩm định') || dept.includes('pháp chế')) {
            allowed.push('registration');
        }
        if (dept.includes('lưu trữ') || dept.includes('một cửa') || dept.includes('thông tin')) {
            allowed.push('archive');
        }

        // If no match found, let them see what corresponds or fallback to default
        if (allowed.length === 0) return ['measurement', 'registration', 'archive'];
        return allowed;
    }, [rawEmployees, currentUser]);

    const canViewRevenue = useMemo(() => {
        if (!currentUser) return false;
        const roleStr = (currentUser.role as string).toUpperCase();
        if (roleStr === 'ADMIN' || roleStr === 'SUBADMIN') return true;

        const userEmp = rawEmployees.find(e => e.id === currentUser.employeeId);
        if (!userEmp) {
            return roleStr === 'ONEDOOR';
        }

        const dept = (userEmp.department || '').toLowerCase();
        const pos = (userEmp.position || '').toLowerCase();
        
        // Báo cáo doanh thu chỉ dành cho tổ hành chính (hành chính)
        const isHanhChinh = dept.includes('hành chính') || (userEmp.department && getEmployeeTeam(userEmp) === 'Tổ Hành chính');
        // Ban giám đốc hoặc lãnh đạo cũng được xem
        const isDirectorDept = dept.includes('ban giám đốc') || dept.includes('ban lãnh đạo') || dept.includes('giám đốc') || pos.includes('giám đốc') || pos.includes('lãnh đạo');

        return isHanhChinh || isDirectorDept || roleStr === 'ONEDOOR';
    }, [currentUser, rawEmployees]);

    const [mainTab, setMainTab] = useState<'measurement' | 'archive' | 'registration'>(() => {
        // Find first allowed tab on initialization if possible
        if (currentUser) {
            const roleStr = (currentUser.role as string).toUpperCase();
            if (roleStr === 'ADMIN' || roleStr === 'SUBADMIN') return 'measurement';
            const userEmp = rawEmployees.find(e => e.id === currentUser.employeeId);
            if (userEmp) {
                const dept = userEmp.department.toLowerCase();
                const isPrivilegedDept = dept.includes('hành chính') || dept.includes('giám đốc') || dept.includes('lãnh đạo') || dept.includes('quản trị');
                if (isPrivilegedDept) return 'measurement';
                
                if (dept.includes('đo đạc') || dept.includes('kỹ thuật')) return 'measurement';
                if (dept.includes('cấp giấy') || dept.includes('đăng ký') || dept.includes('biến động') || dept.includes('thẩm định') || dept.includes('pháp chế')) return 'registration';
                if (dept.includes('lưu trữ') || dept.includes('một cửa') || dept.includes('thông tin')) return 'archive';
            }
        }
        return 'measurement';
    });

    useEffect(() => {
        if (allowedMainTabs.length > 0 && !allowedMainTabs.includes(mainTab)) {
            setMainTab(allowedMainTabs[0] as any);
        }
    }, [allowedMainTabs, mainTab]);

    useEffect(() => {
        if (!canViewRevenue && activeTab === 'revenue') {
            setActiveTab('list');
        }
    }, [canViewRevenue, activeTab]);

    const [archiveRecords, setArchiveRecords] = useState<RecordFile[]>([]);

    useEffect(() => {
        if (mainTab === 'archive' && archiveRecords.length === 0) {
            const loadArchive = async () => {
                try {
                    const [saoluc, vaoso, congvan] = await Promise.all([
                        fetchArchiveRecords('saoluc'),
                        fetchArchiveRecords('vaoso'),
                        fetchArchiveRecords('congvan')
                    ]);
                    const all = [...saoluc, ...vaoso, ...congvan];
                    
                    const mapStatus = (s: string): RecordStatus => {
                        switch(s) {
                            case 'draft': return RecordStatus.RECEIVED;
                            case 'assigned': return RecordStatus.ASSIGNED;
                            case 'executed': return RecordStatus.COMPLETED_WORK;
                            case 'pending_sign': return RecordStatus.PENDING_SIGN;
                            case 'signed': return RecordStatus.SIGNED;
                            case 'completed': return RecordStatus.RETURNED;
                            default: return RecordStatus.RECEIVED;
                        }
                    };

                    const mapped: RecordFile[] = all.map(r => ({
                        id: r.id,
                        code: r.so_hieu,
                        customerName: r.noi_nhan_gui,
                        ward: r.data?.xa_phuong,
                        mapSheet: r.data?.to_ban_do || r.data?.so_to,
                        landPlot: r.data?.thua_dat || r.data?.so_thua,
                        receivedDate: r.ngay_thang,
                        deadline: r.data?.hen_tra,
                        status: mapStatus(r.status),
                        assignedTo: r.data?.assigned_to,
                        notes: r.trich_yeu,
                        recordType: r.data?.recordType || (r.type === 'saoluc' ? 'Sao lục' : r.type === 'vaoso' ? 'Vào sổ' : 'Công văn'),
                        address: r.data?.xa_phuong,
                        phoneNumber: '',
                        content: r.trich_yeu
                    } as RecordFile));
                    
                    const cungCapRecordsFromMain = records.filter(r => isArchiveType(r.recordType) || r.recordType === 'Sao lục' || r.recordType === 'Công văn');

                    setArchiveRecords([...mapped, ...cungCapRecordsFromMain]);
                } catch (e) {
                    console.error("Error loading archive records for report", e);
                }
            };
            loadArchive();
        }
    }, [mainTab]);

    const activeRecords = useMemo(() => {
        if (mainTab === 'measurement') {
            return records.filter(r => 
                !['CMD', 'Tòa án', 'Thi hành án'].includes(r.recordType || '') &&
                !isArchiveType(r.recordType) && r.recordType !== 'Sao lục' && r.recordType !== 'Công văn' &&
                !isReg(r.recordType)
            );
        } else if (mainTab === 'registration') {
            return records.filter(r => isReg(r.recordType));
        } else {
            return archiveRecords;
        }
    }, [mainTab, records, archiveRecords]);

    const activeEmployees = useMemo(() => {
        if (mainTab === 'measurement') {
            return employees.filter(e => {
                const dept = e.department?.toLowerCase() || '';
                return dept.includes('đo đạc') || dept.includes('kỹ thuật');
            });
        } else if (mainTab === 'registration') {
            return employees.filter(e => {
                const dept = e.department?.toLowerCase() || '';
                return dept.includes('cấp giấy') || dept.includes('đăng ký') || dept.includes('biến động') || dept.includes('thẩm định');
            });
        } else {
            return employees.filter(e => {
                const dept = e.department?.toLowerCase() || '';
                return dept.includes('lưu trữ') || dept.includes('thông tin');
            });
        }
    }, [employees, mainTab]);

    useEffect(() => {
        if (isKeyModalOpen) {
            setApiKey(getGeminiKey());
        }
    }, [isKeyModalOpen]);

    const handleSaveKey = () => {
        saveGeminiKey(apiKey);
        setIsKeyModalOpen(false);
        alert("Đã lưu API Key thành công!");
    };

    // --- LOGIC TÍNH TOÁN DỮ LIỆU CHUNG (Theo ngày & xã) ---
    const filteredData = useMemo(() => {
        const start = new Date(fromDate); start.setHours(0,0,0,0);
        const end = new Date(toDate); end.setHours(23,59,59,999);

        return activeRecords.filter(r => {
            if (!r.receivedDate) return false;
            const rDate = new Date(r.receivedDate);
            const matchDate = rDate >= start && rDate <= end;
            
            let matchWard = true;
            if (selectedWard !== 'all') {
                const rWard = removeVietnameseTones(r.ward || '');
                const sWard = removeVietnameseTones(selectedWard);
                matchWard = rWard.includes(sWard);
            }

            return matchDate && matchWard;
        });
    }, [activeRecords, fromDate, toDate, selectedWard]);

    // Reset pagination and card filter when data changes
    useEffect(() => {
        setCurrentPage(1);
        setListFilterType('all');
    }, [filteredData]);

    const listFilteredRecords = useMemo(() => {
        const filtered = filteredData.filter(r => {
            if (listFilterType === 'all') return true;
            if (listFilterType === 'completed') {
                return r.status === RecordStatus.HANDOVER || 
                       r.status === RecordStatus.RETURNED || 
                       r.status === RecordStatus.SIGNED ||
                       !!r.exportBatch || !!r.exportDate;
            }
            if (listFilterType === 'processing') {
                const isDone = r.status === RecordStatus.HANDOVER || 
                               r.status === RecordStatus.RETURNED || 
                               r.status === RecordStatus.SIGNED ||
                               !!r.exportBatch || !!r.exportDate;
                const isWithdrawn = r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.REJECTED;
                return !isDone && !isWithdrawn;
            }
            if (listFilterType === 'overdue_pending') {
                const isDone = r.status === RecordStatus.HANDOVER || 
                               r.status === RecordStatus.RETURNED || 
                               r.status === RecordStatus.SIGNED ||
                               !!r.exportBatch || !!r.exportDate;
                const isWithdrawn = r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.REJECTED;
                return !isDone && !isWithdrawn && isRecordOverdue(r);
            }
            if (listFilterType === 'overdue_completed') {
                const isDone = r.status === RecordStatus.HANDOVER || 
                               r.status === RecordStatus.RETURNED || 
                               r.status === RecordStatus.SIGNED ||
                               !!r.exportBatch || !!r.exportDate;
                if (!isDone) return false;
                if (!r.deadline || !r.completedDate) return false;
                const d = new Date(r.deadline); d.setHours(0,0,0,0);
                const c = new Date(r.completedDate); c.setHours(0,0,0,0);
                return c > d;
            }
            return true;
        });

        // Sắp xếp theo Chủ sử dụng (customerName) tăng dần, sau đó theo Loại thủ tục (recordType) tăng dần
        return filtered.sort((a, b) => {
            const nameA = (a.customerName || '').trim().toLowerCase();
            const nameB = (b.customerName || '').trim().toLowerCase();
            const compName = nameA.localeCompare(nameB, 'vi');
            if (compName !== 0) return compName;

            const typeA = (a.recordType || '').trim().toLowerCase();
            const typeB = (b.recordType || '').trim().toLowerCase();
            return typeA.localeCompare(typeB, 'vi');
        });
    }, [filteredData, listFilterType]);

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return listFilteredRecords.slice(start, start + itemsPerPage);
    }, [listFilteredRecords, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(listFilteredRecords.length / itemsPerPage);

    // --- STATS CHO CÁC TAB ---
    // Updated: Hỗ trợ lọc theo nhân viên khi ở tab Employee
    const generalStats = useMemo(() => {
        let sourceData = filteredData;

        // Nếu đang ở tab Thống kê theo ngày -> Lọc theo điều kiện của tab đó
        if (activeTab === 'daily_stats') {
            sourceData = dailyStatsRecords;
        }
        // Nếu đang ở tab Nhân viên và đã chọn nhân viên -> Lọc theo nhân viên đó
        else if (activeTab === 'employee' && selectedEmpId) {
            sourceData = filteredData.filter(r => r.assignedTo === selectedEmpId);
        }

        const total = sourceData.length;
        // Tính cả SIGNED là completed để đồng bộ logic
        const completed = sourceData.filter(r => 
            r.status === RecordStatus.HANDOVER || 
            r.status === RecordStatus.RETURNED || 
            r.status === RecordStatus.SIGNED ||
            !!r.exportBatch || !!r.exportDate // Đã xuất cũng tính là xong
        ).length;
        
        const withdrawn = sourceData.filter(r => r.status === RecordStatus.WITHDRAWN).length;
        const rejected = sourceData.filter(r => r.status === RecordStatus.REJECTED).length;
        
        // Logic overdue pending: Quá hạn và chưa xong (chưa xuất/chưa trả/chưa rút)
        const overduePending = sourceData.filter(r => {
            if (r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.REJECTED || r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || r.status === RecordStatus.SIGNED || r.exportBatch) return false;
            return isRecordOverdue(r);
        }).length;
        
        // Logic overdue completed: Đã xong nhưng bị trễ
        const overdueCompleted = sourceData.filter(r => {
            const isDone = r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || r.status === RecordStatus.SIGNED || !!r.exportBatch;
            if (!isDone) return false;
            if (!r.deadline || !r.completedDate) return false;
            const d = new Date(r.deadline); d.setHours(0,0,0,0);
            const c = new Date(r.completedDate); c.setHours(0,0,0,0);
            return c > d;
        }).length;

        const processing = total - completed - withdrawn;
        
        return { total, completed, withdrawn, overduePending, overdueCompleted, processing };
    }, [filteredData, activeTab, selectedEmpId, dailyStatsRecords]);

    const handleQuickReport = (type: 'week' | 'month') => {
        const now = new Date();
        let start = new Date();
        if (type === 'week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Thứ 2
            start = new Date(now.setDate(diff));
        } else {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        
        const fromStr = start.toISOString().split('T')[0];
        const toStr = new Date().toISOString().split('T')[0];
        setFromDate(fromStr);
        setToDate(toStr);
        setReportType(type);
        if (activeTab === 'employee' || activeTab === 'ward_stats') {
            // Keep tab
        } else {
            setActiveTab('list');
        }
    };

    const handleGenerateClick = () => {
        if (!fromDate || !toDate) { alert("Vui lòng chọn đầy đủ thời gian."); return; }
        
        const currentKey = getGeminiKey();
        if (!currentKey && !process.env.API_KEY) {
            setIsKeyModalOpen(true);
            return;
        }

        setActiveTab('ai');
        
        let title = mainTab === 'measurement' ? "BÁO CÁO KẾT QUẢ CÔNG TÁC ĐO ĐẠC" : mainTab === 'registration' ? "BÁO CÁO KẾT QUẢ CÔNG TÁC CẤP GIẤY" : "BÁO CÁO KẾT QUẢ CÔNG TÁC LƯU TRỮ";
        if (reportType === 'week') {
            title = mainTab === 'measurement' ? "BÁO CÁO KẾT QUẢ CÔNG TÁC ĐO ĐẠC TUẦN" : mainTab === 'registration' ? "BÁO CÁO KẾT QUẢ CÔNG TÁC CẤP GIẤY TUẦN" : "BÁO CÁO KẾT QUẢ CÔNG TÁC LƯU TRỮ TUẦN";
        }
        if (reportType === 'month') {
            title = mainTab === 'measurement' ? "BÁO CÁO KẾT QUẢ CÔNG TÁC ĐO ĐẠC THÁNG" : mainTab === 'registration' ? "BÁO CÁO KẾT QUẢ CÔNG TÁC CẤP GIẤY THÁNG" : "BÁO CÁO KẾT QUẢ CÔNG TÁC LƯU TRỮ THÁNG";
        }

        // Pass filteredData to onGenerate
        onGenerate(fromDate, toDate, title, filteredData);
    };

    const handleExportExcelClick = () => {
        if (!fromDate || !toDate) { alert("Vui lòng chọn đầy đủ thời gian."); return; }
        let title = mainTab === 'measurement' ? "BÁO CÁO KẾT QUẢ CÔNG TÁC ĐO ĐẠC" : mainTab === 'registration' ? "BÁO CÁO KẾT QUẢ CÔNG TÁC CẤP GIẤY" : "BÁO CÁO KẾT QUẢ CÔNG TÁC LƯU TRỮ";
        if (reportType === 'week') {
            title = mainTab === 'measurement' ? "BÁO CÁO KẾT QUẢ CÔNG TÁC ĐO ĐẠC TUẦN" : mainTab === 'registration' ? "BÁO CÁO KẾT QUẢ CÔNG TÁC CẤP GIẤY TUẦN" : "BÁO CÁO KẾT QUẢ CÔNG TÁC LƯU TRỮ TUẦN";
        }
        if (reportType === 'month') {
            title = mainTab === 'measurement' ? "BÁO CÁO KẾT QUẢ CÔNG TÁC ĐO ĐẠC THÁNG" : mainTab === 'registration' ? "BÁO CÁO KẾT QUẢ CÔNG TÁC CẤP GIẤY THÁNG" : "BÁO CÁO KẾT QUẢ CÔNG TÁC LƯU TRỮ THÁNG";
        }
        
        onExportExcel(fromDate, toDate, selectedWard, title, filteredData);
    };

    const handlePrint = () => {
        if (!previewRef.current) return;
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (doc) {
            doc.open();
            doc.write(`
                <html>
                <head>
                    <title>Báo cáo</title>
                    <style>
                        @page { size: A4 portrait; margin: 2cm; }
                        body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.3; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th, td { border: 1px solid black; padding: 5px; text-align: left; font-size: 11pt; }
                        th { text-align: center; font-weight: bold; background-color: #f0f0f0; }
                    </style>
                </head>
                <body>${reportContent}</body>
                </html>
            `);
            doc.close();
            setTimeout(() => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
                document.body.removeChild(iframe);
            }, 500);
        }
    };

    const formatDate = (d?: string | null) => {
        if (!d) return '-';
        const date = new Date(d);
        if (isNaN(date.getTime())) return '-';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    return (
        <div className="flex flex-col h-full overflow-hidden relative bg-slate-50">
            {/* MAIN TAB SWITCHER */}
            <div className="bg-white border-b border-gray-200 flex px-4 pt-2 gap-1 shrink-0">
                {allowedMainTabs.includes('measurement') && (
                    <button 
                        onClick={() => setMainTab('measurement')}
                        className={`px-6 py-3 text-sm font-bold rounded-t-lg border-t border-l border-r transition-all flex items-center gap-2 ${mainTab === 'measurement' ? 'bg-blue-50 border-gray-200 text-blue-700 border-b-transparent relative top-[1px]' : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'}`}
                    >
                        <Ruler size={18} /> Báo cáo Đo đạc
                    </button>
                )}
                {allowedMainTabs.includes('registration') && (
                    <button 
                        onClick={() => setMainTab('registration')}
                        className={`px-6 py-3 text-sm font-bold rounded-t-lg border-t border-l border-r transition-all flex items-center gap-2 ${mainTab === 'registration' ? 'bg-emerald-50 border-gray-200 text-emerald-700 border-b-transparent relative top-[1px]' : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'}`}
                    >
                        <FileText size={18} /> Báo cáo Cấp giấy
                    </button>
                )}
                {allowedMainTabs.includes('archive') && (
                    <button 
                        onClick={() => setMainTab('archive')}
                        className={`px-6 py-3 text-sm font-bold rounded-t-lg border-t border-l border-r transition-all flex items-center gap-2 ${mainTab === 'archive' ? 'bg-orange-50 border-gray-200 text-orange-700 border-b-transparent relative top-[1px]' : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'}`}
                    >
                        <FolderArchive size={18} /> Báo cáo Lưu trữ
                    </button>
                )}
            </div>

            {/* Toolbar */}
            <div className={`p-4 border-b border-gray-200 shadow-sm flex flex-col gap-4 shrink-0 z-10 ${
                mainTab === 'measurement' ? 'bg-blue-50' : mainTab === 'registration' ? 'bg-emerald-50' : 'bg-orange-50'
            }`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${
                            mainTab === 'measurement' ? 'bg-blue-200 text-blue-700' : mainTab === 'registration' ? 'bg-emerald-200 text-emerald-700' : 'bg-orange-200 text-orange-700'
                        }`}>
                            <BarChart3 size={24} />
                        </div>
                        <div>
                            <h2 className={`font-bold text-lg ${
                                mainTab === 'measurement' ? 'text-blue-900' : mainTab === 'registration' ? 'text-emerald-900' : 'text-orange-900'
                            }`}>
                                {mainTab === 'measurement' ? 'Thống kê Hồ sơ Đo đạc' : mainTab === 'registration' ? 'Thống kê Hồ sơ Cấp giấy' : 'Thống kê Hồ sơ Lưu trữ'}
                            </h2>
                            <p className="text-xs text-gray-500">
                                {mainTab === 'measurement' ? 'Dữ liệu từ Tổ đo đạc & Kỹ thuật' : mainTab === 'registration' ? 'Dữ liệu từ Tổ đăng ký cấp giấy' : 'Dữ liệu từ Tổ thông tin lưu trữ'}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <button 
                            onClick={() => {
                                setFromDate('2025-01-01');
                                setToDate(new Date().toISOString().split('T')[0]);
                                setReportType('custom');
                            }} 
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${(fromDate === '2025-01-01' && reportType === 'custom') ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-blue-600'}`}
                        >
                            <CalendarRange size={14} /> Từ 2025 đến nay
                        </button>
                        <button onClick={() => handleQuickReport('week')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${reportType === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-blue-600'}`}>
                            <CalendarDays size={14} /> Tuần này
                        </button>
                        <button onClick={() => handleQuickReport('month')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${reportType === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-blue-600'}`}>
                            <Layout size={14} /> Tháng này
                        </button>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        {/* SELECT WARD */}
                        <div className="flex items-center gap-2 bg-white px-2 py-1.5 border border-gray-300 rounded-lg shadow-sm">
                            <MapPin size={16} className="text-gray-500" />
                            <select 
                                value={selectedWard} 
                                onChange={(e) => setSelectedWard(e.target.value)} 
                                className="text-sm outline-none bg-transparent text-gray-700 font-medium cursor-pointer border-none focus:ring-0 max-w-[150px]"
                            >
                                <option value="all">Toàn bộ địa bàn</option>
                                {wards.map(w => (
                                    <option key={w} value={w}>{w}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-2 py-1 shadow-sm">
                            <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setReportType('custom'); }} className="text-sm outline-none text-gray-700 font-medium" />
                            <span className="text-gray-400">➜</span>
                            <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setReportType('custom'); }} className="text-sm outline-none text-gray-700 font-medium" />
                        </div>
                        
                        <button onClick={handleExportExcelClick} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-bold text-sm shadow-sm transition-colors" title="Xuất Excel">
                            <FileSpreadsheet size={18} /> Xuất Excel
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Tabs */}
            <div className="flex bg-white border-b border-gray-200 px-4">
                <button 
                    onClick={() => setActiveTab('list')}
                    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'list' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <ListFilter size={16}/> Danh sách kết quả ({filteredData.length})
                </button>
                <button 
                    onClick={() => setActiveTab('ward_stats')}
                    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'ward_stats' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <PieChart size={16}/> Thống kê theo Xã
                </button>
                <button 
                    onClick={() => setActiveTab('employee')}
                    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'employee' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <UserCheck size={16}/> Thống kê nhân viên
                </button>
                <button 
                    onClick={() => setActiveTab('daily_stats')}
                    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'daily_stats' ? 'border-pink-600 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <CalendarDays size={16}/> Thống kê theo ngày
                </button>
                <button 
                    onClick={() => setActiveTab('overdue')}
                    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'overdue' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <AlertTriangle size={16}/> Thống kê hồ sơ trễ
                </button>
                {canViewRevenue && (
                    <button 
                        onClick={() => setActiveTab('revenue')}
                        className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'revenue' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <Coins size={16}/> Báo cáo Nguồn thu ({filteredData.filter(r => r.paymentAmount && r.paymentAmount > 0).length})
                    </button>
                )}
                <button 
                    onClick={() => setActiveTab('ai')}
                    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'ai' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <Sparkles size={16}/> Văn bản Báo cáo (AI)
                </button>
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-hidden bg-slate-100 p-0">
                {activeTab === 'list' && (
                    <div className="bg-white rounded-none h-full overflow-hidden flex flex-col animate-fade-in-up p-4">
                        {/* Thống kê nhanh danh sách hồ sơ */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 shrink-0 animate-fade-in">
                            {/* Card 1: Tổng hồ sơ */}
                            <div 
                                onClick={() => setListFilterType('all')}
                                className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.02] ${listFilterType === 'all' ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-300 shadow-sm' : 'bg-white border-blue-100 hover:border-blue-300'}`}
                            >
                                <div className="bg-blue-100 p-2 rounded-lg text-blue-700"><ListFilter size={18}/></div>
                                <div>
                                    <div className="text-xl font-bold text-blue-950 leading-tight">{generalStats.total}</div>
                                    <div className="text-[10px] text-blue-600 uppercase font-extrabold tracking-wider mt-0.5">Tổng hồ sơ</div>
                                </div>
                            </div>

                            {/* Card 2: Đã xong */}
                            <div 
                                onClick={() => setListFilterType('completed')}
                                className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.02] ${listFilterType === 'completed' ? 'bg-green-50 border-green-400 ring-2 ring-green-300 shadow-sm' : 'bg-white border-green-100 hover:border-green-300'}`}
                            >
                                <div className="bg-green-100 p-2 rounded-lg text-green-700"><CheckCircle2 size={18}/></div>
                                <div>
                                    <div className="text-xl font-bold text-green-950 leading-tight">{generalStats.completed}</div>
                                    <div className="text-[10px] text-green-600 uppercase font-extrabold tracking-wider mt-0.5">Đã xong</div>
                                </div>
                            </div>

                            {/* Card 3: Đang xử lý */}
                            <div 
                                onClick={() => setListFilterType('processing')}
                                className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.02] ${listFilterType === 'processing' ? 'bg-orange-50 border-orange-400 ring-2 ring-orange-300 shadow-sm' : 'bg-white border-orange-100 hover:border-orange-300'}`}
                            >
                                <div className="bg-orange-100 p-2 rounded-lg text-orange-700"><Clock size={18}/></div>
                                <div>
                                    <div className="text-xl font-bold text-orange-950 leading-tight">{generalStats.processing}</div>
                                    <div className="text-[10px] text-orange-600 uppercase font-extrabold tracking-wider mt-0.5">Đang xử lý</div>
                                </div>
                            </div>

                            {/* Card 4: Tổng trễ hạn */}
                            <div 
                                className={`p-3 rounded-xl border flex items-center gap-3 transition-all hover:scale-[1.02] ${
                                    (listFilterType === 'overdue_pending' || listFilterType === 'overdue_completed')
                                        ? 'bg-red-50 border-red-400 ring-2 ring-red-300 shadow-sm'
                                        : 'bg-white border-red-100 hover:border-red-300'
                                }`}
                            >
                                <div 
                                    className="bg-red-100 p-2 rounded-lg text-red-700 cursor-pointer hover:bg-red-200"
                                    onClick={() => setListFilterType(listFilterType === 'overdue_pending' ? 'all' : 'overdue_pending')}
                                    title="Xem tất cả trễ chưa xong"
                                >
                                    <AlertTriangle size={18}/>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div 
                                        className={`flex justify-between items-center text-red-950 cursor-pointer px-1 rounded hover:bg-red-50/80 transition-all ${listFilterType === 'overdue_pending' ? 'bg-red-100/70 font-bold' : ''}`}
                                        onClick={() => setListFilterType('overdue_pending')}
                                    >
                                        <span className="text-[11px] font-bold">Chưa xong:</span>
                                        <span className="text-base font-bold">{generalStats.overduePending}</span>
                                    </div>
                                    <div 
                                        className={`flex justify-between items-center text-red-700/80 cursor-pointer px-1 rounded hover:bg-red-50/80 transition-all ${listFilterType === 'overdue_completed' ? 'bg-red-100/70 font-bold' : ''}`}
                                        onClick={() => setListFilterType('overdue_completed')}
                                    >
                                        <span className="text-[10px] font-bold">Đã xong:</span>
                                        <span className="text-xs font-bold">{generalStats.overdueCompleted}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto rounded-xl border border-gray-200">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-bold sticky top-0 shadow-sm z-10">
                                    <tr>
                                        <th className="p-3 w-10 text-center">#</th>
                                        <th className="p-3 w-32">Mã HS</th>
                                        <th className="p-3 w-48">Chủ sử dụng</th>
                                        <th className="p-3 w-36">Loại thủ tục</th>
                                        <th className="p-3 w-32">Xã/Phường</th>
                                        <th className="p-3 w-16 text-center">Tờ</th>
                                        <th className="p-3 w-16 text-center">Thửa</th>
                                        <th className="p-3 w-24">Ngày nhận</th>
                                        <th className="p-3 w-24">Hẹn trả</th>
                                        <th className="p-3 w-24">Hoàn thành</th>
                                        <th className="p-3 w-32">NV Xử lý</th>
                                        <th className="p-3 w-32 text-center">Trạng thái</th>
                                        <th className="p-3">Ghi chú</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {paginatedData.length > 0 ? paginatedData.map((r, i) => {
                                        const emp = employees.find(e => e.id === r.assignedTo);
                                        const isOverdue = isRecordOverdue(r);
                                        const rowIndex = (currentPage - 1) * itemsPerPage + i + 1;
                                        
                                        let isCompletedLate = false;
                                        if (r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED) {
                                            if (r.deadline && r.completedDate) {
                                                const d = new Date(r.deadline); d.setHours(0,0,0,0);
                                                const c = new Date(r.completedDate); c.setHours(0,0,0,0);
                                                if (c > d) isCompletedLate = true;
                                            }
                                        }

                                        return (
                                        <tr key={r.id} className="hover:bg-blue-50/50 transition-colors">
                                            <td className="p-3 text-center text-gray-400">{rowIndex}</td>
                                            <td className="p-3 font-medium text-blue-600">{r.code}</td>
                                            <td className="p-3 font-medium">{r.customerName}</td>
                                            <td className="p-3 text-gray-600 font-semibold" title={r.recordType || ''}>{getShortRecordType(r.recordType)}</td>
                                            <td className="p-3 text-gray-600">{getNormalizedWard(r.ward)}</td>
                                            <td className="p-3 text-center text-gray-600">{r.mapSheet || '-'}</td>
                                            <td className="p-3 text-center text-gray-600">{r.landPlot || '-'}</td>
                                            <td className="p-3 text-gray-600">{formatDate(r.receivedDate)}</td>
                                            <td className={`p-3 font-medium ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>{formatDate(r.deadline)}</td>
                                            <td className={`p-3 font-medium ${isCompletedLate ? 'text-orange-600' : 'text-green-700'}`}>
                                                {formatDate(r.completedDate)}
                                            </td>
                                            <td className="p-3 text-gray-600 text-xs truncate" title={emp?.name}>{emp ? emp.name : '-'}</td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-1 rounded text-xs border ${
                                                    r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED ? 'bg-green-100 text-green-700 border-green-200' : 
                                                    r.status === RecordStatus.WITHDRAWN ? 'bg-gray-100 text-gray-600 border-gray-200' :
                                                    r.status === RecordStatus.REJECTED ? 'bg-red-100 text-red-700 border-red-200' :
                                                    isOverdue ? 'bg-red-100 text-red-700 border-red-200 font-bold' :
                                                    'bg-blue-50 text-blue-700 border-blue-100'
                                                }`}>
                                                    {STATUS_LABELS[r.status]}
                                                </span>
                                            </td>
                                            <td className="p-3 text-gray-500 italic truncate max-w-xs">
                                                {isCompletedLate && <span className="text-[10px] text-orange-600 font-bold mr-1">[Trễ xong]</span>}
                                                {getDisplayNotes(r.notes) || r.content || ''}
                                            </td>
                                        </tr>
                                    )}) : (
                                        <tr><td colSpan={10} className="p-8 text-center text-gray-400">Không có dữ liệu trong khoảng thời gian này.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {/* Pagination Footer */}
                        {filteredData.length > 0 && (
                            <div className="border-t border-gray-200 p-3 bg-gray-50 flex justify-between items-center shrink-0 rounded-b-xl">
                                <span className="text-xs text-gray-500">
                                    Hiển thị <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> - <strong>{Math.min(currentPage * itemsPerPage, filteredData.length)}</strong> trên tổng <strong>{filteredData.length}</strong>
                                </span>
                                <div className="flex items-center gap-1">
                                    <div className="flex items-center mr-4 gap-2">
                                        <span className="text-xs text-gray-500">Số lượng:</span>
                                        <select 
                                            value={itemsPerPage} 
                                            onChange={(e) => setItemsPerPage(Number(e.target.value))} 
                                            className="border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                                        >
                                            <option value={20}>20</option>
                                            <option value={50}>50</option>
                                            <option value={100}>100</option>
                                            <option value={500}>500</option>
                                        </select>
                                    </div>
                                    <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft size={16} /></button>
                                    <span className="text-xs font-medium mx-2">Trang {currentPage} / {totalPages}</span>
                                    <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRight size={16} /></button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'ward_stats' && (
                    <WardStatsView records={filteredData} />
                )}

                {activeTab === 'employee' && (
                    <EmployeeStatsView 
                        records={activeRecords}
                        employees={activeEmployees}
                        fromDate={fromDate}
                        toDate={toDate}
                        selectedEmpId={selectedEmpId}
                        setSelectedEmpId={setSelectedEmpId}
                        mainTab={mainTab}
                    />
                )}

                {activeTab === 'ai' && (
                    <div className="h-full flex flex-col items-center p-4">
                        {/* AI Toolbar */}
                        <div className="w-full flex justify-between items-center mb-4 bg-white p-3 rounded-xl border border-gray-200 shadow-sm shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="text-sm text-gray-600">
                                    Sử dụng <strong>Gemini AI</strong> để viết báo cáo nhận xét tiến độ.
                                    {reportType !== 'custom' && <span className="ml-2 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">Chế độ: {reportType === 'week' ? 'Báo cáo Tuần' : 'Báo cáo Tháng'}</span>}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setIsKeyModalOpen(true)} className="flex items-center gap-1.5 bg-white text-gray-700 border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 font-medium text-sm shadow-sm transition-all" title="Cài đặt API Key">
                                    <Settings size={16} /> Cấu hình AI
                                </button>
                                <button onClick={handleGenerateClick} disabled={isGenerating} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-bold text-sm shadow-md transition-all disabled:opacity-50">
                                    {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                                    Tạo báo cáo ngay
                                </button>
                                {reportContent && (
                                    <button onClick={handlePrint} className="flex items-center gap-2 bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium text-sm shadow-sm">
                                        <Printer size={16} /> In
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="flex-1 w-full overflow-y-auto bg-slate-200 p-8 rounded-xl custom-scrollbar flex justify-center border border-slate-300 shadow-inner">
                            {reportContent ? (
                                <div className="bg-white shadow-2xl p-[20mm_15mm_20mm_25mm] w-[210mm] min-h-[297mm] animate-fade-in-up">
                                    <div ref={previewRef} style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '13pt', lineHeight: 1.4 }} dangerouslySetInnerHTML={{ __html: reportContent }} />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-slate-400 opacity-60">
                                    <FileText size={64} className="mb-4" />
                                    <p>Chưa có nội dung báo cáo.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'daily_stats' && (
                    <DailyStatsView 
                        records={activeRecords} 
                        employees={activeEmployees} 
                        wards={wards} 
                        onFilteredRecordsChange={setDailyStatsRecords}
                    />
                )}

                {activeTab === 'overdue' && (
                    <OverdueStatsView 
                        records={filteredData}
                        employees={activeEmployees}
                    />
                )}

                {activeTab === 'revenue' && (
                    <RevenueStatsView 
                        records={filteredData}
                        employees={employees}
                        fromDate={fromDate}
                        toDate={toDate}
                    />
                )}

            </div>

            {/* API Key Modal */}
            {isKeyModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-fade-in-up">
                        <div className="p-5 border-b flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Key className="text-purple-600" size={20} /> Cấu hình Gemini API Key
                            </h3>
                            <button onClick={() => setIsKeyModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                Để sử dụng tính năng viết báo cáo tự động, bạn cần nhập Google Gemini API Key.
                                Key này sẽ được lưu trong trình duyệt của bạn.
                            </p>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">API Key</label>
                                <input 
                                    type="password" 
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                    placeholder="Dán API Key vào đây..."
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={() => setIsKeyModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium text-sm">Hủy</button>
                                <button onClick={handleSaveKey} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-bold text-sm shadow-sm">
                                    <Save size={16} /> Lưu Cấu Hình
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportSection;

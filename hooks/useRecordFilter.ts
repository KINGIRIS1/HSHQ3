
import { useState, useMemo, useEffect, useRef } from 'react';
import { RecordFile, User, UserRole, RecordStatus, Employee } from '../types';
import { removeVietnameseTones, isRecordOverdue, isRecordApproaching, isArchiveType, isMeasurementType, isRegType, getGcnWorkflowStepsHelper } from '../utils/appHelpers';
import { REGISTRATION_PROCEDURES } from '../constants';

export const useRecordFilter = (
    records: RecordFile[],
    currentUser: User | null,
    currentView: string,
    employees: Employee[],
    users: User[] = []
) => {
    // Filter States
    // CẬP NHẬT: Sử dụng Object để lưu search term riêng cho từng view
    const [searchStates, setSearchStates] = useState<Record<string, string>>({});
    
    // Lấy search term của view hiện tại (mặc định rỗng nếu chưa có)
    const searchTerm = searchStates[currentView] || '';

    // Hàm set search term chỉ cập nhật cho view hiện tại
    const setSearchTerm = (term: string) => {
        setSearchStates(prev => ({
            ...prev,
            [currentView]: term
        }));
    };

    const [filterDate, setFilterDate] = useState(''); 
    const [filterSpecificDate, setFilterSpecificDate] = useState('');
    const [filterAssignedDate, setFilterAssignedDate] = useState('');
    const [filterFromDate, setFilterFromDate] = useState('');
    const [filterToDate, setFilterToDate] = useState('');
    const [showAdvancedDateFilter, setShowAdvancedDateFilter] = useState(false);
    
    const [filterProcedure, setFilterProcedure] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterEmployee, setFilterEmployee] = useState('all');
    const [warningFilter, setWarningFilter] = useState<'none' | 'overdue' | 'approaching'>('none');
    const [filterArchive, setFilterArchive] = useState<'all' | 'not_archived' | 'archived'>('all');

    const filterRef = useRef({
        filterProcedure,
        filterStatus,
        filterEmployee,
        filterDate,
        filterSpecificDate,
        filterAssignedDate,
        filterFromDate,
        filterToDate,
        warningFilter,
        filterArchive
    });

    useEffect(() => {
        filterRef.current = {
            filterProcedure,
            filterStatus,
            filterEmployee,
            filterDate,
            filterSpecificDate,
            filterAssignedDate,
            filterFromDate,
            filterToDate,
            warningFilter,
            filterArchive
        };
    });

    // Tự động xóa dữ liệu tìm kiếm và các bộ lọc khi chuyển view/tab (theo yêu cầu)
    useEffect(() => {
        const current = filterRef.current;
        setSearchStates(prev => Object.keys(prev).length > 0 ? {} : prev);
        if (current.filterProcedure !== 'all') setFilterProcedure('all');
        if (current.filterStatus !== 'all') setFilterStatus('all');
        if (current.filterEmployee !== 'all') setFilterEmployee('all');
        if (current.filterDate !== '') setFilterDate('');
        if (current.filterSpecificDate !== '') setFilterSpecificDate('');
        if (current.filterAssignedDate !== '') setFilterAssignedDate('');
        if (current.filterFromDate !== '') setFilterFromDate('');
        if (current.filterToDate !== '') setFilterToDate('');
        if (current.warningFilter !== 'none') setWarningFilter('none');
        if (current.filterArchive !== 'all') setFilterArchive('all');
    }, [currentView]);
    
    // Cập nhật type cho handoverTab để hỗ trợ 'returned'
    const [handoverTab, setHandoverTab] = useState<'today' | 'history' | 'returned'>('today');

    useEffect(() => {
        setFilterArchive('all');
    }, [handoverTab]);

    // Sorting & Pagination
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
        key: 'receivedDate',
        direction: 'desc'
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [currentView, sortConfig, warningFilter, filterProcedure, filterStatus, filterEmployee, filterSpecificDate, filterAssignedDate, filterFromDate, filterToDate, handoverTab, searchTerm, filterArchive]);

    // --- WARNING CHECK LOGIC ---
    const checkWarningPermission = (r: RecordFile) => {
        if (!currentUser) return false;
        if (currentUser.role === UserRole.ONEDOOR) return false;
        if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN) return true;
        if (currentUser.role === UserRole.EMPLOYEE) {
            return r.assignedTo === currentUser.employeeId;
        }
        if (currentUser.role === UserRole.TEAM_LEADER) {
            const leaderEmp = employees.find(e => e.id === currentUser.employeeId);
            if (!leaderEmp) return false; 
            const isMyTask = r.assignedTo === currentUser.employeeId;
            const isMyWard = leaderEmp.managedWards.some((w: string) => r.ward && r.ward.includes(w));
            return isMyTask || isMyWard;
        }
        return false; 
    };

    const isDirector = useMemo(() => {
        if (!currentUser?.employeeId) return false;
        const emp = employees.find(e => e.id === currentUser.employeeId);
        return emp ? (emp.department?.trim().toLowerCase() === 'ban giám đốc' || emp.department?.trim().toLowerCase() === 'ban lãnh đạo') : false;
    }, [currentUser?.employeeId, employees]);

    const isAssignView = [
        'assign_tasks', 'registration_assign_tasks', 'archive_assign_tasks', 'congvan_assign_tasks', 'other_assign_tasks'
    ].includes(currentView);

    const isHandoverView = [
        'handover_list', 'registration_handover_list', 'archive_handover_list', 'congvan_handover_list', 'other_handover_list'
    ].includes(currentView);

    // --- FILTER LOGIC ---
    // Pre-compute director and leader IDs for fast O(1) Set lookups
    const directorOrLeaderIds = useMemo(() => {
        const ids = new Set<string>();
        employees.forEach(emp => {
            const dept = (emp.department || '').toLowerCase();
            const pos = (emp.position || '').toLowerCase();
            const isDirDept = dept.includes('ban giám đốc') || dept.includes('ban lãnh đạo');
            const isDirPos = pos.includes('giám đốc') || pos.includes('phó giám đốc') || pos.includes('lãnh đạo');
            const isLeaderPos = pos.includes('tổ trưởng') || pos.includes('tổ phó') || pos.includes('trưởng phòng') || pos.includes('trưởng nhóm') || pos.includes('nhóm trưởng');
            if (isDirDept || isDirPos || isLeaderPos) {
                ids.add(emp.id);
            }
        });
        users.forEach(u => {
            if (u.employeeId && (u.role === UserRole.TEAM_LEADER || u.role === UserRole.ADMIN)) {
                ids.add(u.employeeId);
            }
        });
        return ids;
    }, [employees, users]);

    // Pre-compute subadmin info once for O(1) checks
    const subAdminEmp = useMemo(() => {
        if (!currentUser || currentUser.role !== UserRole.SUBADMIN) return null;
        return employees.find(e => e.id === currentUser.employeeId) || null;
    }, [currentUser, employees]);

    const subAdminDeptNorm = useMemo(() => {
        return subAdminEmp?.department ? removeVietnameseTones(subAdminEmp.department.toLowerCase()) : '';
    }, [subAdminEmp]);

    const activeTabRecords = useMemo(() => {
        const uniqueMap = new Map();
        records.forEach(r => { if(r.id) uniqueMap.set(r.id, r); });
        
        let result = Array.from(uniqueMap.values()) as RecordFile[];

        // --- HELPER STRATEGIES FOR SUBADMINS ---
        const isDirectorOrLeader = (employeeId: string | null | undefined) => {
            if (!employeeId) return false;
            return directorOrLeaderIds.has(employeeId);
        };

        const isSubAdminAllowedRecord = (r: RecordFile) => {
            if (!subAdminDeptNorm) return false;
            
            if (isArchiveType(r.recordType)) {
                return subAdminDeptNorm.includes('luu tru') || subAdminDeptNorm.includes('van phong') || subAdminDeptNorm.includes('hanh chinh') || subAdminDeptNorm.includes('cong van');
            }
            if (isRegType(r.recordType)) {
                return subAdminDeptNorm.includes('dang ky') || subAdminDeptNorm.includes('cap giay');
            }
            if (isMeasurementType(r.recordType)) {
                return subAdminDeptNorm.includes('do dac') || subAdminDeptNorm.includes('do ve') || subAdminDeptNorm.includes('ky thuat') || subAdminDeptNorm.includes('to do') || subAdminDeptNorm.includes('dia chinh') || subAdminDeptNorm.includes('noi nghiep') || subAdminDeptNorm.includes('ngoai nghiep');
            }
            return true;
        };

        // View-based filtering
        const isCheckView = [
            'check_list', 'registration_check_list', 'archive_check_list', 'congvan_check_list', 'other_check_list'
        ].includes(currentView);
        const isPendingCheckView = [
            'pending_check_list', 'registration_pending_check_list', 'archive_pending_check_list', 'congvan_pending_check_list'
        ].includes(currentView);
        const isCompletedWorkView = [
            'completed_list', 'registration_completed_list', 'archive_completed_list', 'congvan_completed_list'
        ].includes(currentView);

        // --- EXCLUDE DIR/LEADER RECORDS FOR SUBADMIN ---
        if (currentUser && currentUser.role === UserRole.SUBADMIN) {
            result = result.filter(r => {
                const isLeaderOrDirAssigned = isDirectorOrLeader(r.assignedTo);
                const isLeaderOrDirChecked = isDirectorOrLeader(r.checkedBy);
                const isLeaderOrDirSubmitted = isDirectorOrLeader(r.submittedTo);
                return !isLeaderOrDirAssigned && !isLeaderOrDirChecked && !isLeaderOrDirSubmitted;
            });
            
            // --- WORKFLOW CHECK AND SIGNING DEPT BOUNDS FOR SUBADMIN ---
            if (isCheckView || isPendingCheckView || isCompletedWorkView) {
                if (subAdminEmp) {
                    result = result.filter(r => isSubAdminAllowedRecord(r));
                }
            }
        }
        const isDirectorCompletedView = [
            'director_completed', 'registration_director_completed', 'archive_director_completed', 'congvan_director_completed', 'other_director_completed'
        ].includes(currentView);

        if (isCheckView) {
            if (isDirector) {
                // Giám đốc chỉ thấy hồ sơ trình cho mình
                result = result.filter(r => r.status === RecordStatus.PENDING_SIGN && r.submittedTo === currentUser?.employeeId);
            } else {
                result = result.filter(r => r.status === RecordStatus.PENDING_SIGN);
            }
        } else if (isPendingCheckView) {
            // Tab Kiểm tra: Hiển thị hồ sơ Chờ kiểm tra và Đã kiểm tra
            result = result.filter(r => r.status === RecordStatus.PENDING_CHECK || r.status === RecordStatus.CHECKED);
        } else if (isCompletedWorkView) {
            // Hiển thị các hồ sơ đang xử lý bao gồm: ASSIGNED, IN_PROGRESS, TBT, COMPLETED_WORK, PENDING_SUPPLEMENT cho tất cả các phân loại hồ sơ
            result = result.filter(r => 
                r.status === RecordStatus.ASSIGNED ||
                r.status === RecordStatus.IN_PROGRESS ||
                r.status === RecordStatus.TBT ||
                r.status === RecordStatus.COMPLETED_WORK ||
                r.status === RecordStatus.PENDING_SUPPLEMENT
            );

            // Nếu người đăng nhập là Nhân viên, chỉ hiển thị hồ sơ được phân công cho họ tại bàn làm việc
            // TRỪ KHI họ được phân quyền TEAM_LEADER (Tổ trưởng, Tổ phó, hoặc được phân vai quản lý)
            const isUserTeamLeaderOrDelegated = (() => {
                if (!currentUser) return false;
                if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN || currentUser.role === UserRole.TEAM_LEADER) return true;
                return isDirectorOrLeader(currentUser.employeeId);
            })();

            if (currentUser && currentUser.role === UserRole.EMPLOYEE && !isUserTeamLeaderOrDelegated) {
                result = result.filter(r => r.assignedTo === currentUser.employeeId);
            }
        } else if (isDirectorCompletedView) {
            result = result.filter(r => r.submittedTo === currentUser?.employeeId && r.status !== RecordStatus.PENDING_SIGN && r.status !== RecordStatus.RECEIVED && r.status !== RecordStatus.ASSIGNED && r.status !== RecordStatus.IN_PROGRESS && r.status !== RecordStatus.COMPLETED_WORK);
        } else if (isHandoverView) {
            if (handoverTab === 'today') {
                // Tab chờ giao: là hồ sơ ký duyệt xong chờ nhập danh sách giao 1 cửa
                result = result.filter(r => r.status === RecordStatus.SIGNED);
            } else if (handoverTab === 'returned') {
                // Tab Đã trả kết quả: chỉ hiển thị hồ sơ đã trả kết quả đến tay người dân
                result = result.filter(r => r.status === RecordStatus.RETURNED);
            } else {
                // Tab Lịch sử giao: chỉ để hồ sơ đã được giao từ chuyên môn vào đây và người dân chưa tới lấy kết quả
                result = result.filter(r => r.status === RecordStatus.HANDOVER);
            }
        } else if (isAssignView) {
            result = result.filter(r => r.status === RecordStatus.RECEIVED && !r.assignedTo);
        } else if ([
            'registration_phieu_chuyen_thue',
            'registration_tbt',
            'registration_in_gcn',
            'registration_tham_tra'
        ].includes(currentView)) {
            const getActiveStepLabel = (r: RecordFile) => {
                try {
                    const helper = getGcnWorkflowStepsHelper(r, []);
                    if (helper && helper.steps) {
                        const currentStep = helper.steps.find(s => s.status === 'current');
                        if (currentStep) {
                            return currentStep.label.toLowerCase();
                        }
                    }
                } catch (e) {
                    // fallback
                }
                return '';
            };

            if (currentView === 'registration_phieu_chuyen_thue') {
                result = result.filter(r => getActiveStepLabel(r).includes('phiếu chuyển'));
            } else if (currentView === 'registration_tbt') {
                result = result.filter(r => r.status === RecordStatus.TBT || getActiveStepLabel(r) === 'tbt');
            } else if (currentView === 'registration_in_gcn') {
                result = result.filter(r => getActiveStepLabel(r).includes('in gcn') || getActiveStepLabel(r).includes('in giấy chứng nhận'));
            } else if (currentView === 'registration_tham_tra') {
                result = result.filter(r => r.status === RecordStatus.PENDING_CHECK || getActiveStepLabel(r).includes('thẩm tra'));
            }

            // Employee filtering for registration step-specific views:
            const isUserTeamLeaderOrDelegated = (() => {
                if (!currentUser) return false;
                if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN || currentUser.role === UserRole.TEAM_LEADER) return true;
                return isDirectorOrLeader(currentUser.employeeId);
            })();

            if (currentUser && currentUser.role === UserRole.EMPLOYEE && !isUserTeamLeaderOrDelegated) {
                if (currentView === 'registration_tham_tra') {
                    result = result.filter(r => r.checkedBy === currentUser.employeeId || r.assignedTo === currentUser.employeeId);
                } else {
                    result = result.filter(r => r.assignedTo === currentUser.employeeId);
                }
            }
        }

        // Filter by recordType based on view group
        const isRegistrationView = [
            'registration_records', 'registration_assign_tasks', 'registration_completed_list', 
            'registration_pending_check_list', 'registration_check_list', 'registration_handover_list', 
            'registration_director_completed', 'registration_vao_so',
            'registration_phieu_chuyen_thue',
            'registration_tbt', 'registration_in_gcn', 'registration_tham_tra'
        ].includes(currentView);

        const isArchiveView = [
            'archive_records', 'archive_assign_tasks', 'archive_completed_list', 
            'archive_pending_check_list', 'archive_check_list', 'archive_handover_list', 
            'archive_director_completed'
        ].includes(currentView);

        const isCongVanView = [
            'congvan_records', 'congvan_assign_tasks', 'congvan_completed_list', 
            'congvan_pending_check_list', 'congvan_check_list', 'congvan_handover_list', 
            'congvan_director_completed'
        ].includes(currentView);

        const isOtherView = [
            'other_records', 'other_assign_tasks', 'other_check_list', 'other_handover_list', 'other_director_completed'
        ].includes(currentView);

        const isMeasurementView = [
            'all_records', 'assign_tasks', 'completed_list', 'pending_check_list', 'check_list', 'handover_list', 'director_completed'
        ].includes(currentView);

        const isSpecializedView = isRegistrationView || isArchiveView || isCongVanView || isOtherView || isMeasurementView;
        if (isSpecializedView) {
            result = result.filter(r => {
                // Nếu được đồng bộ rõ ràng (true) hoặc r.isDeptSynced chưa được định nghĩa (null/undefined), luôn hiển thị
                if (r.isDeptSynced !== false) return true;

                // Nếu isDeptSynced là false nhưng hồ sơ đã có người được phân công (assignedTo) 
                // hoặc trạng thái đã tiến triển vượt qua Tiếp nhận (khác RECEIVED), thì đây chắc chắn là hồ sơ đang được xử lý chuyên môn.
                if (r.assignedTo || r.status !== RecordStatus.RECEIVED) {
                    return true;
                }

                // Nếu không có ngày tiếp nhận, hiển thị để tránh thất lạc
                if (!r.receivedDate) return true;

                // Nếu hồ sơ có ngày tiếp nhận cũ (hơn 3 ngày trước), hiển thị ở các tab chuyên môn để tránh việc
                // hồ sơ cũ/hồ sơ import bị ẩn vĩnh viễn do giá trị mặc định của Database là false.
                try {
                    const receivedMs = new Date(r.receivedDate).getTime();
                    const nowMs = new Date().getTime();
                    const ageInDays = (nowMs - receivedMs) / (1000 * 60 * 60 * 24);
                    if (ageInDays > 3) {
                        return true;
                    }
                } catch (e) {
                    return true;
                }

                // Chỉ ẩn khi đây là hồ sơ Một cửa mới tiếp nhận thực sự (RECEIVED, chưa gán người, dưới 3 ngày và isDeptSynced = false)
                return false;
            });
        }

        if (isArchiveView) {
            result = result.filter(r => isArchiveType(r.recordType));
        } else if (isCongVanView) {
            result = result.filter(r => r.recordType && (r.recordType.startsWith('1.1') || r.recordType.toLowerCase().includes('công văn')));
        } else if (isRegistrationView) {
            result = result.filter(r => isRegType(r.recordType));
        } else if (isOtherView) {
            result = result.filter(r => ['CMD', 'Tòa án', 'Thi hành án'].includes(r.recordType || ''));
        } else if (isMeasurementView) {
            result = result.filter(r => isMeasurementType(r.recordType));
        }

        return result;
    }, [records, currentView, currentUser, employees, users, handoverTab]);

    const filteredRecords = useMemo(() => {
        let result = [...activeTabRecords];

        // Search Term (Sử dụng searchTerm đã được tách theo view)
        if (searchTerm) {
            const lowerSearch = removeVietnameseTones(searchTerm);
            result = result.filter(r => {
                if (removeVietnameseTones(r.code).includes(lowerSearch)) return true;
                if (removeVietnameseTones(r.customerName).includes(lowerSearch)) return true;
                if (r.phoneNumber && r.phoneNumber.includes(searchTerm)) return true;
                if (removeVietnameseTones(r.ward || '').includes(lowerSearch)) return true;
                if (r.content && removeVietnameseTones(r.content).includes(lowerSearch)) return true;
                if (r.issueNumber && removeVietnameseTones(r.issueNumber).includes(lowerSearch)) return true;
                if (r.entryNumber && removeVietnameseTones(r.entryNumber).includes(lowerSearch)) return true;
                return false;
            });
        }

        // Procedure, Status, Employee Filters
        if (filterProcedure !== 'all') {
            result = result.filter(r => r.recordType === filterProcedure);
        }
        if (filterStatus !== 'all' && currentView !== 'handover_list' && currentView !== 'other_handover_list') {
            const isRegView = [
                'registration_records', 'registration_assign_tasks', 'registration_completed_list', 
                'registration_pending_check_list', 'registration_check_list', 'registration_handover_list', 
                'registration_director_completed', 'registration_vao_so',
                'registration_phieu_chuyen_thue',
                'registration_tbt', 'registration_in_gcn', 'registration_tham_tra'
            ].includes(currentView);

            if (isRegView) {
                const getActiveStepLabel = (rec: RecordFile) => {
                    try {
                        const helper = getGcnWorkflowStepsHelper(rec, []);
                        if (helper && helper.steps) {
                            const currentStep = helper.steps.find(s => s.status === 'current');
                            if (currentStep) {
                                return currentStep.label.toLowerCase();
                            }
                        }
                    } catch (e) {}
                    return '';
                };
                
                result = result.filter(r => {
                    const label = getActiveStepLabel(r);
                    if (filterStatus === 'dnlis') return label.includes('dnlis');
                    if (filterStatus === 'phieu_chuyen_thue') return label.includes('phiếu chuyển');
                    if (filterStatus === 'tbt') return r.status === RecordStatus.TBT || label === 'tbt' || label.includes('thông báo thuế');
                    if (filterStatus === 'in_gcn') return label.includes('in gcn') || label.includes('in giấy chứng nhận') || label.includes('in giấy');
                    if (filterStatus === 'tham_tra') return r.status === RecordStatus.PENDING_CHECK || label.includes('thẩm tra');
                    if (filterStatus === 'trinh_ky_gcn') return label.includes('trình ký') || label.includes('trình ký gcn') || label.includes('trình ký giấy');
                    if (filterStatus === 'vo_so_gcn') return label.includes('vô số');
                    if (filterStatus === 'giao_1_cua') return label.includes('cửa') || label.includes('trả kết quả');
                    if (filterStatus === 'pending_supplement') return r.status === RecordStatus.PENDING_SUPPLEMENT;
                    if (filterStatus === 'withdrawn') return r.status === RecordStatus.WITHDRAWN;
                    if (filterStatus === 'rejected') return r.status === RecordStatus.REJECTED;
                    if (filterStatus === 'returned') return r.status === RecordStatus.RETURNED;
                    if (filterStatus === RecordStatus.RECEIVED) {
                        return r.status === RecordStatus.RECEIVED && !r.assignedTo;
                    }
                    if (filterStatus === RecordStatus.ASSIGNED) {
                        return r.status === RecordStatus.ASSIGNED || (r.status === RecordStatus.RECEIVED && !!r.assignedTo);
                    }
                    return r.status === filterStatus;
                });
            } else {
                if (filterStatus === RecordStatus.RECEIVED) {
                    result = result.filter(r => r.status === RecordStatus.RECEIVED && !r.assignedTo);
                } else if (filterStatus === RecordStatus.ASSIGNED) {
                    result = result.filter(r => r.status === RecordStatus.ASSIGNED || (r.status === RecordStatus.RECEIVED && !!r.assignedTo));
                } else {
                    result = result.filter(r => r.status === filterStatus);
                }
            }
        }
        if (filterEmployee !== 'all' && !isAssignView) {
            if (filterEmployee === 'unassigned') {
                result = result.filter(r => !r.assignedTo && r.status !== RecordStatus.HANDOVER && r.status !== RecordStatus.RETURNED && r.status !== RecordStatus.WITHDRAWN);
            } else {
                result = result.filter(r => r.assignedTo === filterEmployee);
            }
        }

        // Date Filters
        const isHandoverView = [
            'handover_list', 'registration_handover_list', 'archive_handover_list', 'congvan_handover_list', 'other_handover_list'
        ].includes(currentView);

        if (isHandoverView) {
            if (handoverTab === 'returned') {
                if (filterFromDate || filterToDate) {
                    result = result.filter(r => {
                        if (!r.resultReturnedDate) return false;
                        const returnDate = r.resultReturnedDate.substring(0, 10);
                        if (filterFromDate && returnDate < filterFromDate) return false;
                        if (filterToDate && returnDate > filterToDate) return false;
                        return true;
                    });
                }
                
                if (filterArchive === 'not_archived') {
                    result = result.filter(r => !r.archiveBatch);
                } else if (filterArchive === 'archived') {
                    result = result.filter(r => !!r.archiveBatch);
                }
            } else if (handoverTab === 'history') {
                if (filterDate) {
                    result = result.filter(r => {
                        const dateToCheck = r.exportDate || r.completedDate;
                        return dateToCheck?.startsWith(filterDate);
                    });
                }
            }
        } else {
            if (filterSpecificDate) {
                result = result.filter(r => {
                    if (!r.receivedDate) return false;
                    const rDate = r.receivedDate.substring(0, 10);
                    return rDate === filterSpecificDate;
                });
            } else if (showAdvancedDateFilter) {
                if (filterFromDate || filterToDate) {
                    result = result.filter(r => {
                        if (!r.receivedDate) return false;
                        const rDate = r.receivedDate.substring(0, 10);
                        if (filterFromDate && rDate < filterFromDate) return false;
                        if (filterToDate && rDate > filterToDate) return false;
                        return true;
                    });
                }
            }
            
            if (filterAssignedDate) {
                result = result.filter(r => r.assignedDate && r.assignedDate.substring(0, 10) === filterAssignedDate);
            }
        }

        // Warning Filters
        if (warningFilter !== 'none' && currentUser) {
            if (warningFilter === 'overdue') {
                result = result.filter(r => isRecordOverdue(r) && checkWarningPermission(r));
            } else if (warningFilter === 'approaching') {
                result = result.filter(r => isRecordApproaching(r) && checkWarningPermission(r));
            }
        }

        // Sorting
        result.sort((a, b) => {
            let aVal: any = a[sortConfig.key as keyof RecordFile];
            let bVal: any = b[sortConfig.key as keyof RecordFile];
            if (!aVal) return 1; if (!bVal) return -1;
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [activeTabRecords, searchTerm, filterProcedure, filterStatus, filterEmployee, filterDate, filterSpecificDate, filterAssignedDate, filterFromDate, filterToDate, showAdvancedDateFilter, warningFilter, currentView, sortConfig, handoverTab, currentUser, filterArchive]);

    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredRecords.slice(start, start + itemsPerPage);
    }, [filteredRecords, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);

    // Warning Counts
    const warningCount = useMemo(() => {
        let overdue = 0;
        let approaching = 0;
        if (currentUser) {
            activeTabRecords.forEach(r => {
                if (r.status === RecordStatus.HANDOVER || r.status === RecordStatus.WITHDRAWN) return; 
                if (!checkWarningPermission(r)) return; 
                if (isRecordOverdue(r)) overdue++;
                else if (isRecordApproaching(r)) approaching++;
            });
        }
        return { overdue, approaching };
    }, [activeTabRecords, currentUser, employees]);

    const uniqueProcedures = useMemo(() => {
        const types = new Set<string>();
        activeTabRecords.forEach(r => {
            if (r.recordType) {
                types.add(r.recordType);
            }
        });
        return Array.from(types).sort();
    }, [activeTabRecords]);

    return {
        filteredRecords, paginatedRecords, totalPages, warningCount,
        searchTerm, setSearchTerm,
        filterDate, setFilterDate,
        filterSpecificDate, setFilterSpecificDate,
        filterAssignedDate, setFilterAssignedDate,
        filterFromDate, setFilterFromDate,
        filterToDate, setFilterToDate,
        showAdvancedDateFilter, setShowAdvancedDateFilter,
        filterProcedure, setFilterProcedure,
        uniqueProcedures,
        filterStatus, setFilterStatus,
        filterEmployee, setFilterEmployee,
        warningFilter, setWarningFilter,
        handoverTab, setHandoverTab,
        filterArchive, setFilterArchive,
        sortConfig, setSortConfig,
        currentPage, setCurrentPage,
        itemsPerPage, setItemsPerPage
    };
};

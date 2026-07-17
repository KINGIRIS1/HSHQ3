
import { useState, useEffect, useCallback, useRef } from 'react';
import { RecordFile, Employee, User, RecordStatus, Holiday, RolePermissions, DepartmentPermissions, DEFAULT_ROLE_PERMISSIONS } from '../types';
import { fetchRecords, fetchEmployees, fetchUsers, fetchUpdateInfo, fetchHolidays,
    createRecordApi, updateRecordApi, deleteRecordApi, createRecordsBatchApi,
    saveEmployeeApi, deleteEmployeeApi, saveUserApi, deleteUserApi, deleteAllDataApi, getSystemSetting,
    updateRecordsBatchById
} from '../services/api';
import { supabase } from '../services/supabaseClient';
import { mapRecordFromDb, saveToCache, getFromCache, CACHE_KEYS, getFromIndexedDB, saveToMemoryCache } from '../services/apiCore';
import { DEFAULT_WARDS as STATIC_WARDS, APP_VERSION, MOCK_EMPLOYEES, MOCK_USERS } from '../constants';
import { addToOfflineQueue } from '../utils/offlineSync';
import { isRegType, getGcnWorkflowStepsHelper, calculateDeadline, removeVietnameseTones, isMeasurementType, isArchiveType } from '../utils/appHelpers';
import { fetchArchiveRecords } from '../services/apiArchive';

// --- HELPERS FOR AUTO-TRANSITION TO TBT ---
const getSolarDateFromLunar = (lunarDay: number, lunarMonth: number, year: number): Date | null => {
    const lunarMapping: Record<number, Record<string, string>> = {
        2024: { "1/1": "2024-02-10", "2/1": "2024-02-11", "3/1": "2024-02-12", "10/3": "2024-04-18" },
        2025: { "1/1": "2025-01-29", "2/1": "2025-01-30", "3/1": "2025-01-31", "10/3": "2025-04-07" },
        2026: { "1/1": "2026-02-17", "2/1": "2026-02-18", "3/1": "2026-02-19", "10/3": "2026-04-26" }
    };
    const key = `${lunarDay}/${lunarMonth}`;
    return lunarMapping[year] && lunarMapping[year][key] ? new Date(lunarMapping[year][key]) : null;
};

const formatDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getWorkingDaysCount = (startDateStr: string, endDate: Date, listHolidays: Holiday[]): number => {
    if (!startDateStr) return 0;
    
    const cleanDateStr = startDateStr.split('T')[0];
    const parts = cleanDateStr.split('-');
    if (parts.length < 3) return 0;
    
    const startDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const today = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    
    if (startDate >= today) return 0;
    
    const holidaySet = new Set<string>();
    const startYear = startDate.getFullYear();
    const endYear = today.getFullYear();
    
    for (let year = startYear; year <= endYear; year++) {
        listHolidays.forEach(h => {
            if (h.isLunar) {
                const solar = getSolarDateFromLunar(h.day, h.month, year);
                if (solar) holidaySet.add(formatDateKey(solar));
            } else {
                const solar = new Date(year, h.month - 1, h.day);
                holidaySet.add(formatDateKey(solar));
            }
        });
    }
    
    let workingDays = 0;
    let current = new Date(startDate);
    
    while (current < today) {
        current.setDate(current.getDate() + 1);
        const dayOfWeek = current.getDay();
        const dateString = formatDateKey(current);
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isHoliday = holidaySet.has(dateString);
        
        if (!isWeekend && !isHoliday) {
            workingDays++;
        }
    }
    
    return workingDays;
};

export const useAppData = (currentUser: User | null) => {
    const hasCheckedAutoTransitionRef = useRef(false);
    const hasCheckedNiemYetRef = useRef(false);

    const [records, setRecords] = useState<RecordFile[]>(() => {
        return getFromCache(CACHE_KEYS.RECORDS, []);
    });
    const [employees, setEmployees] = useState<Employee[]>(() => {
        return getFromCache(CACHE_KEYS.EMPLOYEES, MOCK_EMPLOYEES);
    });
    const [users, setUsers] = useState<User[]>(() => {
        return getFromCache(CACHE_KEYS.USERS, MOCK_USERS);
    });
    const [holidays, setHolidays] = useState<Holiday[]>(() => {
        return getFromCache(CACHE_KEYS.HOLIDAYS, []);
    });
    const [rolePermissions, setRolePermissions] = useState<RolePermissions>(DEFAULT_ROLE_PERMISSIONS);
    const [departmentPermissions, setDepartmentPermissions] = useState<DepartmentPermissions>({});
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'offline'>('connected');
    
    // Wards State
    const [wards, setWards] = useState<string[]>(() => {
        const saved = localStorage.getItem('wards_list');
        return saved ? JSON.parse(saved) : STATIC_WARDS;
    });

    // Update Info State
    const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
    const [latestVersion, setLatestVersion] = useState('');
    const [updateUrl, setUpdateUrl] = useState<string | null>(null);

    // Load full collections from IndexedDB at startup
    useEffect(() => {
        const loadFullCache = async () => {
            try {
                const fullRecords = await getFromIndexedDB<RecordFile[]>(CACHE_KEYS.RECORDS, []);
                if (fullRecords && fullRecords.length > 0) {
                    setRecords(fullRecords);
                    saveToMemoryCache(CACHE_KEYS.RECORDS, fullRecords);
                }
                const fullEmployees = await getFromIndexedDB<Employee[]>(CACHE_KEYS.EMPLOYEES, []);
                if (fullEmployees && fullEmployees.length > 0) {
                    setEmployees(fullEmployees);
                    saveToMemoryCache(CACHE_KEYS.EMPLOYEES, fullEmployees);
                }
                const fullUsers = await getFromIndexedDB<User[]>(CACHE_KEYS.USERS, []);
                if (fullUsers && fullUsers.length > 0) {
                    setUsers(fullUsers);
                    saveToMemoryCache(CACHE_KEYS.USERS, fullUsers);
                }
                const fullHolidays = await getFromIndexedDB<Holiday[]>(CACHE_KEYS.HOLIDAYS, []);
                if (fullHolidays && fullHolidays.length > 0) {
                    setHolidays(fullHolidays);
                    saveToMemoryCache(CACHE_KEYS.HOLIDAYS, fullHolidays);
                }
            } catch (err) {
                console.error("Lỗi khi tải cache từ IndexedDB:", err);
            }
        };
        loadFullCache();
    }, []);

    const loadData = useCallback(async () => {
        hasCheckedAutoTransitionRef.current = false;
        hasCheckedNiemYetRef.current = false;
        try {
            // Tạo timeout promise để tránh việc fetch bị treo mãi mãi
            // Nâng lên 25 giây để tải toàn bộ hơn 5600 hồ sơ từ Supabase Cloud thành công trên mọi đường truyền
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Timeout")), 25000)
            );

            const dataPromise = Promise.all([
                fetchRecords(),
                fetchEmployees(),
                fetchUsers(),
                fetchUpdateInfo(),
                fetchHolidays(), // Tải thêm danh sách ngày nghỉ
                getSystemSetting('role_permissions'),
                getSystemSetting('department_permissions'),
                getSystemSetting('sla_config_gcn')
            ]);

            // Race giữa fetch data và timeout
            const [recData, empData, userData, updateInfo, holidayData, permsData, deptPermsData, slaConfigData] = await Promise.race([dataPromise, timeoutPromise]) as any;

            setRecords(recData);
            setEmployees(empData);
            setUsers(userData);
            setHolidays(holidayData); // Cập nhật state holidays
            if (permsData) {
                try {
                    setRolePermissions(JSON.parse(permsData));
                } catch (e) {
                    console.error("Failed to parse role_permissions", e);
                }
            }
            if (deptPermsData) {
                try {
                    setDepartmentPermissions(JSON.parse(deptPermsData));
                } catch (e) {
                    console.error("Failed to parse department_permissions", e);
                }
            }
            if (slaConfigData) {
                localStorage.setItem('sla_config_gcn', slaConfigData);
            }
            setConnectionStatus('connected');

            if (updateInfo && updateInfo.version && updateInfo.version !== APP_VERSION) {
                setIsUpdateAvailable(true);
                setLatestVersion(updateInfo.version);
                setUpdateUrl(updateInfo.url);
            }
        } catch (error) {
            console.warn("Thông báo kết nối (Dữ liệu đang được đồng bộ hoặc tải offline):", error);
            // Quan trọng: Khi lỗi, chuyển sang OFFLINE nhưng vẫn cho phép App hoạt động
            setConnectionStatus('offline');
            
            // Nếu cache cũng rỗng (lần đầu chạy) hoặc bị timeout nên không nhận được data, 
            // ta sẽ chủ động đọc lại từ Cache để người dùng có thể Đăng nhập và làm việc.
            import('../services/apiCore').then(({ getFromCache, CACHE_KEYS }) => {
                import('../constants').then(({ MOCK_EMPLOYEES, MOCK_USERS }) => {
                    setRecords((prev) => prev.length > 0 ? prev : getFromCache(CACHE_KEYS.RECORDS, []));
                    setEmployees((prev) => prev.length > 0 ? prev : getFromCache(CACHE_KEYS.EMPLOYEES, MOCK_EMPLOYEES));
                    setUsers((prev) => prev.length > 0 ? prev : getFromCache(CACHE_KEYS.USERS, MOCK_USERS));
                    setHolidays((prev) => prev.length > 0 ? prev : getFromCache(CACHE_KEYS.HOLIDAYS, []));
                });
            });
        }
    }, []);

    // Initial Load (NO POLLING)
    useEffect(() => {
        loadData();
    }, [loadData]);

    // Lắng nghe thay đổi Realtime từ bảng land_records
    useEffect(() => {
        if (!supabase) return;

        const landRecordsChannel = supabase.channel('land_records_changes')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'land_records' },
                (payload) => {
                    setRecords(prev => {
                        if (prev.some(r => r.id === payload.new.id)) return prev;
                        return [mapRecordFromDb(payload.new) as RecordFile, ...prev];
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'land_records' },
                (payload) => {
                    setRecords(prev => prev.map(r => r.id === payload.new.id ? { ...r, ...mapRecordFromDb(payload.new) } as RecordFile : r));
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'land_records' },
                (payload) => {
                    setRecords(prev => prev.filter(r => r.id !== payload.old.id));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(landRecordsChannel);
        };
    }, []);

    // Tự động chuyển trạng thái hồ sơ trình ký có thuế sang TBT sau 7 ngày làm việc
    useEffect(() => {
        if (records.length === 0 || holidays.length === 0) return;
        if (hasCheckedAutoTransitionRef.current) return;
        
        const qualifyingRecords = records.filter(r => 
            r.status === RecordStatus.PENDING_SIGN && 
            r.hasTax && 
            r.submissionDate
        );
        
        if (qualifyingRecords.length === 0) {
            hasCheckedAutoTransitionRef.current = true;
            return;
        }
        
        const today = new Date();
        const recordsToUpdate: RecordFile[] = [];
        
        qualifyingRecords.forEach(r => {
            const workingDays = getWorkingDaysCount(r.submissionDate!, today, holidays);
            if (workingDays >= 7) {
                recordsToUpdate.push({
                    ...r,
                    status: RecordStatus.TBT,
                    completedDate: new Date().toISOString()
                });
            }
        });
        
        if (recordsToUpdate.length > 0) {
            hasCheckedAutoTransitionRef.current = true;
            setRecords(prev => prev.map(r => {
                const updated = recordsToUpdate.find(u => u.id === r.id);
                return updated ? updated : r;
            }));
            
            recordsToUpdate.forEach(async (updatedRecord) => {
                try {
                    await updateRecordApi(updatedRecord);
                } catch (err) {
                    console.error("Lỗi tự động cập nhật trạng thái TBT cho hồ sơ:", updatedRecord.code, err);
                }
            });
        } else {
            hasCheckedAutoTransitionRef.current = true;
        }
    }, [records, holidays]);

    // Tự động chuyển bước chờ giao cho hồ sơ đang ở bước Niêm yết khi hết ngày
    useEffect(() => {
        if (records.length === 0 || holidays.length === 0) return;
        if (hasCheckedNiemYetRef.current) return;

        const today = new Date();
        const recordsToUpdate: RecordFile[] = [];

        records.forEach(r => {
            // Chỉ xét hồ sơ GCN
            if (!isRegType(r.recordType)) return;

            try {
                const helper = getGcnWorkflowStepsHelper(r, holidays);
                if (!helper || !helper.steps) return;

                const currentIdx = helper.currentStepIndex;
                const currentStep = helper.steps[currentIdx];
                if (!currentStep) return;

                const labelLower = currentStep.label.toLowerCase();
                // Phải ở bước Niêm yết
                if (labelLower.includes("niêm yết")) {
                    const deadline = currentStep.deadlineDate;
                    // Hết ngày (đã quá hạn/đến hạn)
                    if (deadline && today > deadline) {
                        const nextIdx = currentIdx + 1;
                        if (nextIdx < helper.steps.length) {
                            const nextStep = helper.steps[nextIdx];
                            const nowStr = new Date().toISOString();

                            const stepAssignees = { ...(r.stepAssignees || {}) };
                            if (r.assignedTo) {
                                stepAssignees[currentStep.label.toLowerCase().trim()] = r.assignedTo;
                            }

                            const updates: any = {
                                currentStepIndex: nextIdx,
                                status: nextStep.overallStatus,
                                stepAssignees,
                                assignedTo: r.assignedTo || null // Tự động giao cho người đang xử lý (In GCN)
                            };

                            // Cập nhật các mốc thời gian tương ứng giống App.tsx
                            if (nextStep.overallStatus === RecordStatus.IN_PROGRESS) {
                                updates.assignedDate = nowStr;
                            }
                            if (nextStep.overallStatus === RecordStatus.COMPLETED_WORK && !r.completedWorkDate) {
                                updates.completedWorkDate = nowStr;
                            }
                            if ((nextStep.overallStatus as any) === RecordStatus.PENDING_CHECK && !r.pendingCheckDate) {
                                updates.pendingCheckDate = nowStr;
                            }
                            if (nextStep.overallStatus === RecordStatus.CHECKED) {
                                updates.checkedDate = nowStr;
                                updates.checkedBy = r.checkedBy || null;
                            }
                            if ((nextStep.overallStatus as any) === RecordStatus.PENDING_SIGN && !r.submissionDate) {
                                updates.submissionDate = nowStr;
                            }
                            if (nextStep.overallStatus === RecordStatus.SIGNED && !r.approvalDate) {
                                updates.approvalDate = nowStr;
                            }
                            if (nextStep.overallStatus === RecordStatus.HANDOVER && !r.completedDate) {
                                updates.completedDate = nowStr;
                            }

                            recordsToUpdate.push({
                                ...r,
                                ...updates
                            });
                        }
                    }
                }
            } catch (e) {
                console.error("Lỗi khi kiểm tra hết hạn niêm yết cho hồ sơ:", r.code, e);
            }
        });

        if (recordsToUpdate.length > 0) {
            hasCheckedNiemYetRef.current = true;
            setRecords(prev => {
                const newRecords = prev.map(r => {
                    const updated = recordsToUpdate.find(u => u.id === r.id);
                    return updated ? updated : r;
                });
                saveToCache(CACHE_KEYS.RECORDS, newRecords);
                return newRecords;
            });

            recordsToUpdate.forEach(async (updatedRecord) => {
                try {
                    await updateRecordApi(updatedRecord);
                } catch (err) {
                    console.error("Lỗi tự động cập nhật chuyển bước sau niêm yết cho hồ sơ:", updatedRecord.code, err);
                }
            });
        } else {
            hasCheckedNiemYetRef.current = true;
        }
    }, [records, holidays]);

    // --- Record Handlers ---
    const handleAddOrUpdateRecord = async (recordData: any, forceDeleteOnWithdrawn: boolean = false): Promise<RecordFile | null> => {
        if (recordData.status === RecordStatus.WITHDRAWN && forceDeleteOnWithdrawn) {
            const success = await deleteRecordApi(recordData.id);
            if (success) {
                setRecords(prev => {
                    const filtered = prev.filter(r => r.id !== recordData.id);
                    saveToCache(CACHE_KEYS.RECORDS, filtered);
                    return filtered;
                });
                alert(`Hồ sơ ${recordData.code} đã được xóa hoàn toàn khỏi hệ thống (Hủy hồ sơ).`);
            } else {
                setRecords(prev => {
                    const filtered = prev.filter(r => r.id !== recordData.id);
                    saveToCache(CACHE_KEYS.RECORDS, filtered);
                    return filtered;
                });
                addToOfflineQueue('delete_record', { id: recordData.id }, `Hủy hồ sơ: ${recordData.code}`);
            }
            return null;
        }

        const isEdit = recordData.id && records.find(r => r.id === recordData.id);
        if (isEdit) {
            const updated = await updateRecordApi(recordData);
            if (updated) {
                setRecords(prev => {
                    const next = prev.map(r => r.id === updated.id ? updated : r);
                    saveToCache(CACHE_KEYS.RECORDS, next);
                    return next;
                });
                return updated;
            } else {
                const offlineRec = { ...recordData };
                setRecords(prev => {
                    const next = prev.map(r => r.id === offlineRec.id ? offlineRec : r);
                    saveToCache(CACHE_KEYS.RECORDS, next);
                    return next;
                });
                addToOfflineQueue('update_record', offlineRec, `Cập nhật hồ sơ: ${recordData.code || recordData.customerName}`);
                return offlineRec;
            }
        } else {
            const generatedId = recordData.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9));
            const finalCode = recordData.code || `${new Date().getFullYear().toString().slice(-2)}${('0' + (new Date().getMonth() + 1)).slice(-2)}${('0' + new Date().getDate()).slice(-2)}-TEMP${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`;
            
            let statusToSet = recordData.status || RecordStatus.RECEIVED;
            let stepIndexToSet = recordData.currentStepIndex ?? 0;
            let assignedDateToSet = recordData.assignedDate;

            if (isRegType(recordData.recordType) && statusToSet === RecordStatus.RECEIVED) {
                statusToSet = RecordStatus.IN_PROGRESS;
                stepIndexToSet = 1;
                assignedDateToSet = recordData.receivedDate || new Date().toISOString().split('T')[0];
            }

            const offlineNewRec = { 
                ...recordData, 
                id: generatedId, 
                code: finalCode,
                status: statusToSet,
                currentStepIndex: stepIndexToSet,
                assignedDate: assignedDateToSet
            };
            
            const newRecord = await createRecordApi(offlineNewRec);
            if (newRecord) {
                setRecords(prev => {
                    const next = [newRecord, ...prev];
                    saveToCache(CACHE_KEYS.RECORDS, next);
                    return next;
                });
                return newRecord;
            } else {
                setRecords(prev => {
                    const next = [offlineNewRec, ...prev];
                    saveToCache(CACHE_KEYS.RECORDS, next);
                    return next;
                });
                addToOfflineQueue('create_record', offlineNewRec, `Thêm hồ sơ mới: ${offlineNewRec.code} (${offlineNewRec.customerName})`);
                return offlineNewRec;
            }
        }
    };

    const handleDeleteRecord = async (id: string) => {
        const success = await deleteRecordApi(id);
        if (success) {
            setRecords(prev => {
                const next = prev.filter(r => r.id !== id);
                saveToCache(CACHE_KEYS.RECORDS, next);
                return next;
            });
        } else {
            const target = records.find(r => r.id === id);
            setRecords(prev => {
                const next = prev.filter(r => r.id !== id);
                saveToCache(CACHE_KEYS.RECORDS, next);
                return next;
            });
            addToOfflineQueue('delete_record', { id }, `Xóa hồ sơ: ${target?.code || id}`);
        }
        return true;
    };

    const handleImportRecords = async (newRecords: RecordFile[], onProgress?: (processed: number, total: number) => void) => {
        let success = true;

        if (newRecords.length > 0) {
            const landSuccess = await createRecordsBatchApi(newRecords, onProgress);
            if (!landSuccess) success = false;
        }

        if (success) {
            await loadData();
            return true;
        }
        return false;
    };

    const handleBatchUpdate = async (updatedRecords: RecordFile[]) => {
        // Optimistic update
        const updatedIds = updatedRecords.map(r => r.id);
        setRecords(prev => prev.map(r => {
            const found = updatedRecords.find(u => u.id === r.id);
            return found ? found : r;
        }));
    };

    // --- Employee Handlers ---
    const handleSaveEmployee = async (emp: Employee) => {
        const exists = employees.find(e => e.id === emp.id);
        const savedEmp = await saveEmployeeApi(emp, !!exists);
        if (savedEmp) {
            if (exists) setEmployees(prev => {
                const next = prev.map(e => e.id === savedEmp.id ? savedEmp : e);
                saveToCache(CACHE_KEYS.EMPLOYEES, next);
                return next;
            });
            else setEmployees(prev => {
                const next = [...prev, savedEmp];
                saveToCache(CACHE_KEYS.EMPLOYEES, next);
                return next;
            });
        } else {
            if (exists) setEmployees(prev => {
                const next = prev.map(e => e.id === emp.id ? emp : e);
                saveToCache(CACHE_KEYS.EMPLOYEES, next);
                return next;
            });
            else setEmployees(prev => {
                const next = [...prev, emp];
                saveToCache(CACHE_KEYS.EMPLOYEES, next);
                return next;
            });
            addToOfflineQueue(exists ? 'update_record' : 'create_record', emp, `${exists ? 'Cập nhật' : 'Thêm'} nhân viên: ${emp.name}`);
        }
    };

    const handleDeleteEmployee = async (id: string) => {
        const success = await deleteEmployeeApi(id);
        if (success) {
            setEmployees(prev => {
                const next = prev.filter(e => e.id !== id);
                saveToCache(CACHE_KEYS.EMPLOYEES, next);
                return next;
            });
        } else {
            const target = employees.find(e => e.id === id);
            setEmployees(prev => {
                const next = prev.filter(e => e.id !== id);
                saveToCache(CACHE_KEYS.EMPLOYEES, next);
                return next;
            });
            addToOfflineQueue('delete_record', { id }, `Xóa nhân viên: ${target?.name || id}`);
        }
    };

    // --- User Handlers ---
    const handleUpdateUser = async (u: User, isUpdate: boolean) => {
        const res = await saveUserApi(u, isUpdate);
        if (res) {
            if (isUpdate) setUsers(prev => prev.map(x => x.username === u.username ? res : x));
            else setUsers(prev => [...prev, res]);
        }
        return res;
    };

    const handleDeleteUser = async (username: string) => {
        const success = await deleteUserApi(username);
        if (success) setUsers(prev => prev.filter(u => u.username !== username));
    };

    // --- System Handlers ---
    const handleDeleteAllData = async () => {
        const success = await deleteAllDataApi();
        if (success) {
            setRecords([]);
            return true;
        }
        return false;
    };

    const handleTransferPendingOneStopRecords = async (cutoffDate: string = '2026-07-10') => {
        const pendingRecords = records.filter(r => {
            if (r.isDeptSynced === true) return false;
            if (!r.receivedDate) return false;
            const receivedDateOnly = r.receivedDate.split('T')[0];
            return receivedDateOnly < cutoffDate;
        });

        if (pendingRecords.length === 0) {
            return { success: true, count: 0 };
        }

        const updates = pendingRecords.map(r => ({
            id: r.id,
            isDeptSynced: true
        }));

        const result = await updateRecordsBatchById(updates);
        if (result.success) {
            await loadData();
        }
        return result;
    };

    const handleSyncMissingFieldsFromArchive = async (onlyScan: boolean = false, preCalculatedUpdates?: any[]) => {
        try {
            if (!onlyScan && preCalculatedUpdates) {
                if (preCalculatedUpdates.length > 0) {
                    const result = await updateRecordsBatchById(preCalculatedUpdates);
                    if (result.success) {
                        await loadData();
                    }
                    return { success: true, count: preCalculatedUpdates.length };
                }
                return { success: true, count: 0 };
            }

            // Fetch all archive records
            const [saoluc, vaoso, congvan] = await Promise.all([
                fetchArchiveRecords('saoluc'),
                fetchArchiveRecords('vaoso'),
                fetchArchiveRecords('congvan')
            ]);
            
            const allArchives = [...saoluc, ...vaoso, ...congvan];
            
            // Build matching maps
            const archiveMapByCode = new Map<string, typeof allArchives[0]>();
            const archiveMapByName = new Map<string, typeof allArchives[0]>();
            
            allArchives.forEach(a => {
                if (a.so_hieu) {
                    const norm = a.so_hieu.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
                    if (norm) archiveMapByCode.set(norm, a);
                }
                if (a.noi_nhan_gui) {
                    const norm = removeVietnameseTones(a.noi_nhan_gui.trim().toLowerCase());
                    if (norm) archiveMapByName.set(norm, a);
                }
            });
            
            const findEmployeeIdByName = (name: string): string | null => {
                if (!name) return null;
                const normName = removeVietnameseTones(name.trim().toLowerCase());
                const emp = employees.find(e => removeVietnameseTones(e.name.trim().toLowerCase()) === normName);
                return emp ? emp.id : null;
            };

            const updates: any[] = [];
            let readCount = 0;
            let generatedCount = 0;
            
            const categoryStats = {
                measurement: { readCount: 0, generatedCount: 0, totalCount: 0 },
                registration: { readCount: 0, generatedCount: 0, totalCount: 0 },
                archive: { readCount: 0, generatedCount: 0, totalCount: 0 },
                other: { readCount: 0, generatedCount: 0, totalCount: 0 }
            };
            
            records.forEach(r => {
                let updated = false;
                let isMatched = false;
                const cloned = { ...r };
                
                // Determine category based on recordType
                let category: 'measurement' | 'registration' | 'archive' | 'other' = 'other';
                if (isMeasurementType(cloned.recordType)) {
                    category = 'measurement';
                } else if (isRegType(cloned.recordType)) {
                    category = 'registration';
                } else if (isArchiveType(cloned.recordType)) {
                    category = 'archive';
                }
                
                // Try to find matching archive record
                const rCodeNorm = r.code ? r.code.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '') : '';
                const rNameNorm = r.customerName ? removeVietnameseTones(r.customerName.trim().toLowerCase()) : '';
                
                const matched = (rCodeNorm && archiveMapByCode.get(rCodeNorm)) || (rNameNorm && archiveMapByName.get(rNameNorm));
                
                if (matched) {
                    const mData = matched.data || {};
                    let matchedUpdated = false;
                    
                    // 1. receivedDate
                    if (!cloned.receivedDate) {
                        const recDate = matched.ngay_thang || mData.ngay_nhan || mData.receivedDate;
                        if (recDate) {
                            cloned.receivedDate = recDate;
                            matchedUpdated = true;
                        }
                    }
                    
                    // 2. deadline
                    if (!cloned.deadline) {
                        const deadlineDate = mData.hen_tra || mData.deadline;
                        if (deadlineDate) {
                            cloned.deadline = deadlineDate;
                            matchedUpdated = true;
                        }
                    }
                    
                    // 3. assignedTo / assignedDate
                    if (!cloned.assignedTo) {
                        const assTo = mData.assigned_to || mData.assignedTo;
                        if (assTo) {
                            // If assTo is an employee ID, use it. Otherwise try to resolve from name.
                            const isId = employees.some(e => e.id === assTo);
                            const finalEmpId = isId ? assTo : findEmployeeIdByName(assTo);
                            
                            if (finalEmpId) {
                                cloned.assignedTo = finalEmpId;
                                cloned.assignedDate = cloned.assignedDate || mData.assigned_date || mData.assignedDate || cloned.receivedDate;
                                matchedUpdated = true;
                            }
                        }
                    }
                    
                    // 4. exportBatch / exportDate / completedDate
                    if (!cloned.exportBatch) {
                        const batch = mData.danh_sach || mData.exportBatch || mData.export_batch;
                        if (batch) {
                            const batchNum = typeof batch === 'number' ? batch : (parseInt(String(batch).replace(/\D/g, ''), 10) || null);
                            if (batchNum) {
                                cloned.exportBatch = batchNum;
                                cloned.exportDate = cloned.exportDate || mData.ngay_hoan_thanh || mData.exportDate || mData.export_date || mData.completedDate || mData.completed_date;
                                cloned.completedDate = cloned.completedDate || cloned.exportDate || mData.ngay_hoan_thanh || mData.completedDate || mData.completed_date;
                                matchedUpdated = true;
                            }
                        }
                    }

                    if (matchedUpdated) {
                        updated = true;
                        isMatched = true;
                    }
                }
                
                let isSlaCalculated = false;
                // Fallback: If receivedDate and recordType are present but deadline is still empty, calculate it!
                if (cloned.receivedDate && cloned.recordType && !cloned.deadline) {
                    cloned.deadline = calculateDeadline(cloned.recordType, cloned.receivedDate, holidays, cloned.hasTax);
                    updated = true;
                    isSlaCalculated = true;
                }
                
                if (updated) {
                    let isRead = false;
                    let isGen = false;

                    if (isMatched) {
                        isRead = true;
                    }
                    if (isSlaCalculated) {
                        isGen = true;
                    }

                    if (isRead) {
                        readCount++;
                        categoryStats[category].readCount++;
                    }
                    if (isGen) {
                        generatedCount++;
                        categoryStats[category].generatedCount++;
                    }
                    
                    categoryStats[category].totalCount++;

                    updates.push({
                        id: cloned.id,
                        receivedDate: cloned.receivedDate,
                        deadline: cloned.deadline,
                        assignedTo: cloned.assignedTo,
                        assignedDate: cloned.assignedDate,
                        exportBatch: cloned.exportBatch,
                        exportDate: cloned.exportDate,
                        completedDate: cloned.completedDate
                    });
                }
            });
            
            if (onlyScan) {
                return { success: true, readCount, generatedCount, count: updates.length, categoryStats, updates };
            }

            if (updates.length > 0) {
                const result = await updateRecordsBatchById(updates);
                if (result.success) {
                    await loadData();
                }
                return { success: true, count: updates.length, readCount, generatedCount, categoryStats };
            }
            
            return { success: true, count: 0, readCount: 0, generatedCount: 0, categoryStats };
        } catch (error) {
            console.error("Error in syncMissingFieldsFromArchive:", error);
            return { success: false, count: 0, error };
        }
    };

    return {
        records, employees, users, wards, holidays, rolePermissions, departmentPermissions, connectionStatus,
        isUpdateAvailable, latestVersion, updateUrl,
        setWards, setEmployees, setUsers, setRecords,
        loadData,
        handleAddOrUpdateRecord, handleDeleteRecord, handleImportRecords, handleBatchUpdate,
        handleSaveEmployee, handleDeleteEmployee,
        handleUpdateUser, handleDeleteUser,
        handleDeleteAllData,
        handleTransferPendingOneStopRecords,
        handleSyncMissingFieldsFromArchive
    };
};

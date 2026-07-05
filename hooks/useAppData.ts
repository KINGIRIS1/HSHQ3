
import { useState, useEffect, useCallback } from 'react';
import { RecordFile, Employee, User, RecordStatus, Holiday, RolePermissions, DepartmentPermissions, DEFAULT_ROLE_PERMISSIONS } from '../types';
import { fetchRecords, fetchEmployees, fetchUsers, fetchUpdateInfo, fetchHolidays,
    createRecordApi, updateRecordApi, deleteRecordApi, createRecordsBatchApi,
    saveEmployeeApi, deleteEmployeeApi, saveUserApi, deleteUserApi, deleteAllDataApi, getSystemSetting
} from '../services/api';
import { supabase } from '../services/supabaseClient';
import { mapRecordFromDb, saveToCache, getFromCache, CACHE_KEYS } from '../services/apiCore';
import { DEFAULT_WARDS as STATIC_WARDS, APP_VERSION, MOCK_EMPLOYEES, MOCK_USERS } from '../constants';
import { addToOfflineQueue } from '../utils/offlineSync';

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

    const loadData = useCallback(async () => {
        try {
            // Tạo timeout promise để tránh việc fetch bị treo mãi mãi
            // Đặt timeout ngắn (4s) để tải trang nhanh nhất có thể nếu DB chậm hoặc bị treo
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Timeout")), 4000)
            );

            const dataPromise = Promise.all([
                fetchRecords(),
                fetchEmployees(),
                fetchUsers(),
                fetchUpdateInfo(),
                fetchHolidays(), // Tải thêm danh sách ngày nghỉ
                getSystemSetting('role_permissions'),
                getSystemSetting('department_permissions')
            ]);

            // Race giữa fetch data và timeout
            const [recData, empData, userData, updateInfo, holidayData, permsData, deptPermsData] = await Promise.race([dataPromise, timeoutPromise]) as any;

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
        if (records.length === 0) return;
        
        const qualifyingRecords = records.filter(r => 
            r.status === RecordStatus.PENDING_SIGN && 
            r.hasTax && 
            r.submissionDate
        );
        
        if (qualifyingRecords.length === 0) return;
        
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
            const offlineNewRec = { ...recordData, id: generatedId, code: finalCode };
            
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

    return {
        records, employees, users, wards, holidays, rolePermissions, departmentPermissions, connectionStatus,
        isUpdateAvailable, latestVersion, updateUrl,
        setWards, setEmployees, setUsers, setRecords,
        loadData,
        handleAddOrUpdateRecord, handleDeleteRecord, handleImportRecords, handleBatchUpdate,
        handleSaveEmployee, handleDeleteEmployee,
        handleUpdateUser, handleDeleteUser,
        handleDeleteAllData
    };
};

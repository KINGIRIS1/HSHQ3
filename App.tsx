
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RecordFile, RecordStatus, Employee, User, UserRole, Message, Holiday } from './types';
import { DEFAULT_WARDS as STATIC_WARDS, REGISTRATION_PROCEDURES } from './constants';
import Login from './components/Login'; 
import MainLayout from './components/layout/MainLayout';
import AppRoutes from './components/AppRoutes';
import AppModals from './components/AppModals';

import { DEFAULT_VISIBLE_COLUMNS, confirmAction, fillTimelineDatesForReturn, removeVietnameseTones, isDefaultTaxProcedure, isRegType, getGcnWorkflowStepsHelper, isArchiveType, isMeasurementType, recordStepAssigneeHistory } from './utils/appHelpers';
import { getEmployeeTeam } from './components/AssignModal';
import { exportReportToExcel, exportReturnedListToExcel } from './utils/excelExport';
import { generateReport } from './services/geminiService';
import { syncTemplatesFromCloud } from './services/docxService'; 
import { updateRecordApi, saveEmployeeApi, saveUserApi, forceUpdateRecordsBatchApi, updateRecordsBatchById } from './services/api';
import { migrateCungCapTaiLieu, migrateCongVanToLandRecords, saveArchiveRecord, fetchArchiveRecords } from './services/apiArchive';
import * as XLSX from 'xlsx-js-style';
import { CheckCircle, AlertTriangle, X } from 'lucide-react';
import { supabase, isConfigured } from './services/supabaseClient';
import { mapRecordFromDb } from './services/apiCore';

import { useAppData } from './hooks/useAppData';
import { useRecordFilter } from './hooks/useRecordFilter';
import { useReminderSystem } from './hooks/useReminderSystem';
import { useGlobalChatListener } from './hooks/useGlobalChatListener';

import { useIsMobile } from './hooks/useIsMobile';
import MobileLayout from './components/layout/MobileLayout';
import MobileRoutes from './components/mobile/MobileRoutes';
import SubmitModal from './components/receive-record/SubmitModal';
import GlobalConfirmModal from './components/GlobalConfirmModal';
import GlobalAlertModal from './components/GlobalAlertModal';
import RejectReasonModal from './components/receive-record/RejectReasonModal';
import { AssignNextStepModal } from './components/AssignNextStepModal';

const getGcnWorkflowSteps = (record: RecordFile, holidays: Holiday[] = []) => {
    return getGcnWorkflowStepsHelper(record, holidays).steps;
};



function App() {
  const isMobile = useIsMobile(768);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [notificationEnabled, setNotificationEnabled] = useState(() => {
      const saved = localStorage.getItem('chat_notification_enabled');
      return saved === null ? true : saved === 'true';
  });

  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Feature specific states
  const [recordToLiquidate, setRecordToLiquidate] = useState<RecordFile | null>(null);
  const [recordToContract, setRecordToContract] = useState<RecordFile | null>(null);
  const [recordForMapCorrection, setRecordForMapCorrection] = useState<RecordFile | null>(null);
  const [recordForMinutes, setRecordForMinutes] = useState<RecordFile | null>(null);

  // Modal & UI States
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
      try { return JSON.parse(localStorage.getItem('visible_columns') || '') || DEFAULT_VISIBLE_COLUMNS; } catch { return DEFAULT_VISIBLE_COLUMNS; }
  });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RecordFile | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignTargetRecords, setAssignTargetRecords] = useState<RecordFile[]>([]);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitCheckModalOpen, setIsSubmitCheckModalOpen] = useState(false);
  const [submitTargetRecords, setSubmitTargetRecords] = useState<RecordFile[]>([]);
  const [viewingRecord, setViewingRecord] = useState<RecordFile | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<RecordFile | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalType, setExportModalType] = useState<'handover' | 'check_list' | 'returned'>('handover');
  const [isAddToBatchModalOpen, setIsAddToBatchModalOpen] = useState(false);
  const [isExcelPreviewOpen, setIsExcelPreviewOpen] = useState(false);
  const [previewWorkbook, setPreviewWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [previewExcelName, setPreviewExcelName] = useState('');
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnRecord, setReturnRecord] = useState<RecordFile | null>(null);
  const [isRejectReasonModalOpen, setIsRejectReasonModalOpen] = useState(false);
  const [rejectRecordsTarget, setRejectRecordsTarget] = useState<RecordFile[]>([]);

  // States for GCN / Cấp giấy workflow additional inputs
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [taxTargetRecord, setTaxTargetRecord] = useState<RecordFile | null>(null);
  const [taxLandPlot, setTaxLandPlot] = useState('');
  const [taxMapSheet, setTaxMapSheet] = useState('');
  const [taxArea, setTaxArea] = useState('');
  const [taxResidentialArea, setTaxResidentialArea] = useState('');
  const [taxClnArea, setTaxClnArea] = useState('');
  const [taxBhkArea, setTaxBhkArea] = useState('');
  const [taxLucArea, setTaxLucArea] = useState('');
  const [taxOtherLandArea, setTaxOtherLandArea] = useState('');
  const [taxDirector, setTaxDirector] = useState('');

  const [foilModalOpen, setFoilModalOpen] = useState(false);
  const [foilTargetRecord, setFoilTargetRecord] = useState<RecordFile | null>(null);
  const [foilNumber, setFoilNumber] = useState('');

  const [entryBookModalOpen, setEntryBookModalOpen] = useState(false);
  const [entryBookTargetRecord, setEntryBookTargetRecord] = useState<RecordFile | null>(null);
  const [entryBookValue, setEntryBookValue] = useState('');

  const [isAssignNextStepModalOpen, setIsAssignNextStepModalOpen] = useState(false);
  const [assignNextStepTargetRecord, setAssignNextStepTargetRecord] = useState<RecordFile | null>(null);
  const [assignNextStepLabel, setAssignNextStepLabel] = useState('');

  // Helper to calculate the next sequence number for Vào sổ GCN (Sổ vô số cấp giấy)
  const calculateNextVaoSoNumber = async (): Promise<string> => {
      try {
          let maxNum = 0;
          
          // Check from GCN records in current state
          if (records && records.length > 0) {
              records.forEach(r => {
                  const val = r.entryNumber || "";
                  if (val.startsWith("CN ")) {
                      const numPart = val.replace("CN ", "");
                      const num = parseInt(numPart, 10);
                      if (!isNaN(num) && num > maxNum) {
                          maxNum = num;
                      }
                  } else {
                      const num = parseInt(val, 10);
                      if (!isNaN(num) && num > maxNum) {
                          maxNum = num;
                      }
                  }
              });
          }

          const archiveRecords = await fetchArchiveRecords('vaoso');
          if (archiveRecords && archiveRecords.length > 0) {
              archiveRecords.forEach(r => {
                  const val = r.data?.so_vao_so || "";
                  if (val.startsWith("CN ")) {
                      const numPart = val.replace("CN ", "");
                      const num = parseInt(numPart, 10);
                      if (!isNaN(num) && num > maxNum) {
                          maxNum = num;
                      }
                  } else {
                      const num = parseInt(val, 10);
                      if (!isNaN(num) && num > maxNum) {
                          maxNum = num;
                      }
                  }
              });
          }
          const nextNum = maxNum + 1;
          const padded = String(nextNum).padStart(6, '0');
          return `CN ${padded}`;
      } catch (e) {
          console.error("Lỗi khi tính số vào sổ tiếp theo:", e);
          return "CN 000001";
      }
  };

  // Report States
  const [globalReportContent, setGlobalReportContent] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // --- UPDATE LOGIC STATES ---
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'downloading' | 'ready' | 'error'>('idle');
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateSpeed, setUpdateSpeed] = useState(0); // Bytes per second
  const [updateDeferred, setUpdateDeferred] = useState(false); // Đã chọn cập nhật sau 10p chưa

  // Toast effect
  useEffect(() => {
      if (toast) {
          const timer = setTimeout(() => setToast(null), 30000);
          return () => clearTimeout(timer);
      }
  }, [toast]);

  // Electron Nav Listener
  useEffect(() => {
      if (window.electronAPI && window.electronAPI.onNavigateToView) {
          window.electronAPI.onNavigateToView((viewId: string) => {
              if (currentUser) setCurrentView(viewId);
          });
      }
      return () => {
          if (window.electronAPI && window.electronAPI.removeNavigationListener) {
              window.electronAPI.removeNavigationListener();
          }
      };
  }, [currentUser]);

  // Sync Templates
  useEffect(() => { syncTemplatesFromCloud(); }, []);

  // Run migration for Cung cấp tài liệu đất đai and Công văn
  useEffect(() => {
      if (currentUser) {
          migrateCungCapTaiLieu();
          migrateCongVanToLandRecords();
      }
  }, [currentUser]);

  // Save visible columns
  useEffect(() => { localStorage.setItem('visible_columns', JSON.stringify(visibleColumns)); }, [visibleColumns]);

  // --- CUSTOM HOOKS ---
  const { 
      records: rawRecords, employees, users, wards, holidays, rolePermissions, departmentPermissions, connectionStatus, 
      isUpdateAvailable, latestVersion, updateUrl,
      setEmployees, setUsers, setRecords, setWards,
      loadData, 
      handleAddOrUpdateRecord: rawHandleAddOrUpdateRecord, 
      handleDeleteRecord: rawHandleDeleteRecord, 
      handleImportRecords: rawHandleImportRecords,
      handleSaveEmployee, handleDeleteEmployee, handleDeleteAllData, handleUpdateUser, handleDeleteUser,
      handleTransferPendingOneStopRecords: rawHandleTransferPendingOneStopRecords, 
      handleSyncMissingFieldsFromArchive: rawHandleSyncMissingFieldsFromArchive
  } = useAppData(currentUser);

  // Trigger state to notify useRecordFilter to refetch in server-side pagination mode
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Re-fetch data from database when user successfully logs in
  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser, loadData]);

  const handleAddOrUpdateWithToast = useCallback(async (recordData: any, forceDeleteOnWithdrawn: boolean = false) => {
      const res = await rawHandleAddOrUpdateRecord(recordData, forceDeleteOnWithdrawn);
      if (res) {
          setToast({ type: 'success', message: recordData.id ? `Đã cập nhật hồ sơ thành công: ${res.code}` : `Đã tiếp nhận hồ sơ mới: ${res.code}` });
          setRefreshCounter(prev => prev + 1);
      } else if (recordData.status !== RecordStatus.WITHDRAWN) {
          setToast({ type: 'error', message: 'Lỗi khi lưu hồ sơ.' });
      }
      return res;
  }, [rawHandleAddOrUpdateRecord, setToast]);

  const handleDeleteRecord = useCallback(async (id: string) => {
      const success = await rawHandleDeleteRecord(id);
      if (success) {
          setRefreshCounter(prev => prev + 1);
      }
      return success;
  }, [rawHandleDeleteRecord]);

  const handleImportRecords = useCallback(async (imported: any[], onProgress?: (processed: number, total: number) => void) => {
      const res = await rawHandleImportRecords(imported, onProgress);
      if (res) {
          setRefreshCounter(prev => prev + 1);
      }
      return res;
  }, [rawHandleImportRecords]);

  const handleTransferPendingOneStopRecords = useCallback(async () => {
      const res = await rawHandleTransferPendingOneStopRecords();
      setRefreshCounter(prev => prev + 1);
      return res;
  }, [rawHandleTransferPendingOneStopRecords]);

  const handleSyncMissingFieldsFromArchive = useCallback(async () => {
      const res = await rawHandleSyncMissingFieldsFromArchive();
      setRefreshCounter(prev => prev + 1);
      return res;
  }, [rawHandleSyncMissingFieldsFromArchive]);

  const records = useMemo(() => {
      return rawRecords;
  }, [rawRecords]);

  // Reminder System
  const handleUpdateRecordState = useCallback((updatedRecord: RecordFile) => {
      setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));
  }, [setRecords]);
  const { activeRemindersCount } = useReminderSystem(records, handleUpdateRecordState);

  // Filtering Logic
  const recordFilterProps = useRecordFilter(records, currentUser, currentView, employees, users, refreshCounter);

  // TỰ ĐỘNG BỎ TÍCH CHỌN KHI CHUYỂN TAB ĐỂ TRÁNH NHẦM LẪN GIAO HỒ SƠ CHỒNG CHÉO
  useEffect(() => {
      setSelectedRecordIds(prev => prev.size > 0 ? new Set() : prev);
  }, [currentView, recordFilterProps.handoverTab]);

  // Chat Listener
  useGlobalChatListener(currentUser, currentView, notificationEnabled, setUnreadMessages);

  // Permissions
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isSubadmin = currentUser?.role === UserRole.SUBADMIN;
  const isTeamLeader = currentUser?.role === UserRole.TEAM_LEADER;
  const canPerformAction = isAdmin || isSubadmin || isTeamLeader || currentUser?.role === UserRole.ONEDOOR;

  // --- UPDATE HANDLERS ---
  
  // Lắng nghe sự kiện update từ Electron
  useEffect(() => {
      if (window.electronAPI && window.electronAPI.onUpdateStatus) {
          window.electronAPI.onUpdateStatus((data: any) => {
              if (data.status === 'downloading') {
                  setUpdateStatus('downloading');
                  setUpdateProgress(data.progress);
                  if (data.bytesPerSecond) setUpdateSpeed(data.bytesPerSecond);
              } else if (data.status === 'downloaded') {
                  setUpdateStatus('ready');
                  setUpdateProgress(100);
                  // Tự động cài đặt khi tải xong
                  window.electronAPI?.quitAndInstall();
              } else if (data.status === 'error') {
                  setUpdateStatus('error');
                  console.error("Update error:", data.message);
              }
          });
          return () => { if (window.electronAPI?.removeUpdateListener) window.electronAPI.removeUpdateListener(); };
      }
  }, []);

  const handleUpdateNow = async () => {
      if (window.electronAPI?.downloadUpdate) {
          try {
              setUpdateStatus('downloading'); // Chuyển trạng thái ngay để hiện progress bar
              await window.electronAPI.downloadUpdate();
          } catch (e: any) {
              console.error("Download update failed:", e);
              setUpdateStatus('error');
              alert("Lỗi khi tải bản cập nhật: " + (e.message || "Không xác định"));
          }
      } else {
          // Fallback cho web
          if (updateUrl) window.open(updateUrl, '_blank');
      }
  };

  const handleUpdateLater = () => {
      setUpdateDeferred(true);
      // Đặt hẹn giờ 10 phút (600,000 ms)
      setTimeout(() => {
          setToast({ type: 'success', message: 'Bắt đầu tự động cập nhật hệ thống...' });
          handleUpdateNow();
      }, 600000);
  };

  // --- HANDLERS (Business Logic) ---

  const handleExportReportExcel = async (fromDateStr: string, toDateStr: string, ward: string, title?: string, data?: RecordFile[]) => {
      if (!currentUser) return;
      
      let exportData = data || records;
      const syncMode = typeof window !== 'undefined' ? (localStorage.getItem('data_sync_mode') || 'server_pagination') : 'server_pagination';
      if (!data && syncMode === 'server_pagination' && isConfigured) {
          try {
              setToast({ type: 'success', message: 'Đang tải dữ liệu báo cáo từ Server...' });
              let query = supabase.from('land_records').select('*');
              if (fromDateStr) query = query.gte('receivedDate', `${fromDateStr}T00:00:00`);
              if (toDateStr) query = query.lte('receivedDate', `${toDateStr}T23:59:59`);
              if (ward && ward !== 'all') query = query.eq('ward', ward);
              
              const { data: dbData, error } = await query;
              if (error) throw error;
              if (dbData) {
                  exportData = dbData.map((item: any) => mapRecordFromDb(item) as RecordFile);
              }
          } catch (err) {
              console.error("Lỗi khi tải dữ liệu báo cáo để xuất Excel:", err);
          }
      }
      await exportReportToExcel(exportData, fromDateStr, toDateStr, ward, employees, title);
  };

  const handleUpdateCurrentAccount = async (data: { name: string; password?: string; department?: string }) => {
      if (!currentUser) return false;
      const updatedUser: User = { ...currentUser, name: data.name, ...(data.password ? { password: data.password } : {}) };
      const savedUser = await saveUserApi(updatedUser, true);
      if (!savedUser) return false;
      if (currentUser.employeeId && data.department) {
          const emp = employees.find(e => e.id === currentUser.employeeId);
          if (emp) {
              const savedEmp = await saveEmployeeApi({ ...emp, department: data.department }, true);
              if (savedEmp) setEmployees(prev => prev.map(e => e.id === emp.id ? savedEmp : e));
          }
      }
      setUsers(prev => prev.map(u => u.username === currentUser.username ? savedUser : u));
      setCurrentUser(savedUser);
      loadData();
      return true;
  };

  const handleGlobalGenerateReport = async (fromDateStr: string, toDateStr: string, title?: string, data?: RecordFile[]) => {
      if (!currentUser) return;
      setIsGeneratingReport(true);
      setGlobalReportContent(''); 
      const from = new Date(fromDateStr); from.setHours(0, 0, 0, 0); 
      const to = new Date(toDateStr); to.setHours(23, 59, 59, 999); 
      
      let filtered = data;
      const syncMode = typeof window !== 'undefined' ? (localStorage.getItem('data_sync_mode') || 'server_pagination') : 'server_pagination';
      
      if (!filtered) {
          if (syncMode === 'server_pagination' && isConfigured) {
              try {
                  let query = supabase.from('land_records').select('*');
                  if (fromDateStr) query = query.gte('receivedDate', `${fromDateStr}T00:00:00`);
                  if (toDateStr) query = query.lte('receivedDate', `${toDateStr}T23:59:59`);
                  
                  const { data: dbData, error } = await query;
                  if (error) throw error;
                  if (dbData) {
                      filtered = dbData.map((item: any) => mapRecordFromDb(item) as RecordFile);
                  }
              } catch (err) {
                  console.error("Lỗi khi tải dữ liệu để tạo báo cáo AI:", err);
                  filtered = [];
              }
          } else {
              filtered = records.filter(r => { if(!r.receivedDate) return false; const rDate = new Date(r.receivedDate); return rDate >= from && rDate <= to; });
          }
      }

      const formatDateVN = (d: Date) => `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
      try {
          const scope = currentUser.role === UserRole.EMPLOYEE ? 'personal' : 'general';
          const result = await generateReport(filtered!, `Từ ngày ${formatDateVN(from)} đến ngày ${formatDateVN(to)}`, scope, currentUser.name, title, employees);
          setGlobalReportContent(result);
      } catch (error) { setGlobalReportContent("Không thể tạo báo cáo. Vui lòng kiểm tra API Key."); } 
      finally { setIsGeneratingReport(false); }
  };

  const onImportRecords = async (data: RecordFile[], mode: 'create' | 'update', onProgress?: (processed: number, total: number) => void) => {
      if (mode === 'create') {
          const result = await handleImportRecords(data, onProgress);
          if (result) {
              setToast({ type: 'success', message: `Đã nhập thành công ${data.length} hồ sơ mới.` });
              loadData();
              return true;
          } else {
              setToast({ type: 'error', message: "Lỗi khi nhập dữ liệu. Vui lòng thử lại." });
              return false;
          }
      } else {
          const result = await forceUpdateRecordsBatchApi(data, onProgress);
          if (result.success) {
              setToast({ type: 'success', message: `Đã cập nhật thành công ${result.count} hồ sơ.` });
              loadData();
              return true;
          } else {
              setToast({ type: 'error', message: "Lỗi khi cập nhật dữ liệu. Vui lòng thử lại." });
              return false;
          }
      }
  };

  const toggleSelectAll = useCallback(() => {
      if (selectedRecordIds.size === recordFilterProps.paginatedRecords.length && recordFilterProps.paginatedRecords.length > 0) setSelectedRecordIds(new Set());
      else setSelectedRecordIds(new Set(recordFilterProps.paginatedRecords.map((r: any) => r.id)));
  }, [selectedRecordIds, recordFilterProps.paginatedRecords]);

  const toggleSelectRecord = useCallback((id: string) => {
      setSelectedRecordIds(prev => {
          const newSet = new Set(prev);
          if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
          return newSet;
      });
  }, []);

  useEffect(() => {
      setSelectedRecordIds(new Set());
  }, [currentView]);

  const confirmAssign = async (employeeId: string, workflowType?: string | null) => {
      const nowStr = new Date().toISOString();
      const updatedIds = assignTargetRecords.map(r => r.id);
      
      const getDynamicUpdates = (r: RecordFile) => {
          if (isRegType(r.recordType) && r.currentStepIndex !== undefined && r.currentStepIndex !== null && r.currentStepIndex > 0) {
              const helper = getGcnWorkflowStepsHelper(r, holidays || []);
              const currentStep = helper.steps[r.currentStepIndex];
              const stepStatus = currentStep ? currentStep.overallStatus : RecordStatus.PENDING_CHECK;
              const updates: any = {
                  assignedTo: employeeId,
                  status: stepStatus,
                  assignedDate: nowStr,
              };
              if (workflowType) {
                  updates.gcnWorkflowType = workflowType;
              }
              return updates;
          }

          const updates: any = {
              assignedTo: employeeId,
              status: RecordStatus.IN_PROGRESS,
              currentStepIndex: 0,
              assignedDate: nowStr,
              submissionDate: null,
              approvalDate: null,
              completedDate: null,
              resultReturnedDate: null,
              exportBatch: null,
              exportDate: null
          };

          if (workflowType) {
              updates.gcnWorkflowType = workflowType;
          } else if (isRegType(r.recordType)) {
              // Automatic GCN Workflow Type Detection based on the record's properties
              const rType = (r.recordType || '').toLowerCase();
              const isPreJuly2025 = (() => {
                  const dateStr = r.issueDate || r.receivedDate || nowStr;
                  const date = new Date(dateStr);
                  const targetDate = new Date('2025-07-01');
                  return date < targetDate;
              })();

              if (rType.includes('cấp lại') || rType.includes('3.7')) {
                  if (r.hasTax) {
                      updates.gcnWorkflowType = r.hasCheckedSMK ? 'quy_trinh_7' : 'quy_trinh_6';
                  } else {
                      updates.gcnWorkflowType = r.hasCheckedSMK ? 'quy_trinh_5' : 'quy_trinh_4';
                  }
              } else if (!r.hasTax && !isDefaultTaxProcedure(r.recordType)) {
                  updates.gcnWorkflowType = 'quy_trinh_3';
              } else if (isPreJuly2025 || rType.includes('tách - hợp') || rType.includes('tách thửa') || rType.includes('hợp thửa') || rType.includes('3.8')) {
                  updates.gcnWorkflowType = 'quy_trinh_1';
              } else {
                  updates.gcnWorkflowType = 'quy_trinh_2';
              }
          }
          return updates;
      };

      setRecords(prev => prev.map(r => {
          if (updatedIds.includes(r.id)) {
              const updates = getDynamicUpdates(r);
              const merged = { ...r, ...updates };
              return recordStepAssigneeHistory(merged, holidays || []);
          }
          return r;
      }));

      await Promise.all(assignTargetRecords.map(r => {
          const updates = getDynamicUpdates(r);
          const merged = { ...r, ...updates };
          const withHistory = recordStepAssigneeHistory(merged, holidays || []);
          return updateRecordApi(withHistory as any);
      }));

      setIsAssignModalOpen(false); 
      setSelectedRecordIds(new Set()); 
      setToast({ type: 'success', message: `Đã giao việc và chuyển sang Đang thực hiện cho ${assignTargetRecords.length} hồ sơ thành công!` });
  };

  const handleBatchAutoAssign = async (selectedIds: Set<string>, currentViewStr: string) => {
      const targets = records.filter(r => selectedIds.has(r.id));
      if (targets.length === 0) return;
      
      const getTargetTeamForView = (view: string): string => {
         const v = view.toLowerCase();
         if (v.includes('registration')) return 'Tổ Cấp giấy';
         if (v.includes('archive')) return 'Tổ Lưu trữ';
         if (v.includes('congvan')) return 'Tổ Lưu trữ';
         if (v.includes('other')) return 'Tổ Hành chính';
         return 'Tổ Đo đạc';
      };
      
      const targetTeamName = getTargetTeamForView(currentViewStr);
      const teamEmployees = employees.filter(emp => getEmployeeTeam(emp) === targetTeamName);
      
      const nowStr = new Date().toISOString();
      const updatedRecords: RecordFile[] = [];
      const assignedCount: { [empName: string]: number } = {};
      let autoAssignedCount = 0;
      let skippedCount = 0;
      
      for (const r of targets) {
          const rWard = r.ward ? removeVietnameseTones(r.ward).toLowerCase().trim() : '';
          let matchedEmp: Employee | undefined = undefined;
          
          if (rWard) {
              matchedEmp = teamEmployees.find(emp => 
                  emp.managedWards && emp.managedWards.some(w => 
                      removeVietnameseTones(w).toLowerCase().trim() === rWard
                  )
              );
              if (!matchedEmp) {
                  matchedEmp = employees.find(emp => 
                      emp.managedWards && emp.managedWards.some(w => 
                          removeVietnameseTones(w).toLowerCase().trim() === rWard
                      )
                  );
              }
          }
          
          // Fallback: Nếu không có địa bàn hoặc không tìm thấy cán bộ phụ trách địa bàn cụ thể trong tổ
          if (!matchedEmp && teamEmployees.length > 0) {
              // Ưu tiên tìm nhân viên phụ trách chung (managedWards rỗng) trong tổ chuyên môn
              matchedEmp = teamEmployees.find(emp => !emp.managedWards || emp.managedWards.length === 0);
              // Nếu không có ai phụ trách chung, lấy chuyên viên đầu tiên của tổ
              if (!matchedEmp) {
                  matchedEmp = teamEmployees[0];
              }
          }
          
          if (matchedEmp) {
              let updates: any;
              if (isRegType(r.recordType) && r.currentStepIndex !== undefined && r.currentStepIndex !== null && r.currentStepIndex > 0) {
                  const helper = getGcnWorkflowStepsHelper(r, holidays || []);
                  const currentStep = helper.steps[r.currentStepIndex];
                  const stepStatus = currentStep ? currentStep.overallStatus : RecordStatus.PENDING_CHECK;
                  updates = {
                      assignedTo: matchedEmp.id,
                      status: stepStatus,
                      assignedDate: nowStr,
                  };
              } else {
                  updates = {
                      assignedTo: matchedEmp.id,
                      status: RecordStatus.IN_PROGRESS,
                      currentStepIndex: 0,
                      assignedDate: nowStr,
                      submissionDate: null,
                      approvalDate: null,
                      completedDate: null,
                      resultReturnedDate: null,
                      exportBatch: null,
                      exportDate: null
                  };
              }
              
              const merged = { ...r, ...updates };
              const withHistory = recordStepAssigneeHistory(merged, holidays || []);
              updatedRecords.push(withHistory);
              assignedCount[matchedEmp.name] = (assignedCount[matchedEmp.name] || 0) + 1;
              autoAssignedCount++;
          } else {
              skippedCount++;
          }
      }
      
      if (autoAssignedCount === 0) {
          await confirmAction("Không tìm thấy cán bộ phụ trách phù hợp với địa bàn của các hồ sơ đã chọn. Vui lòng kiểm tra lại cấu hình địa bàn của nhân viên.", "Thông báo");
          return;
      }
      
      const confirmMsg = `Hệ thống đã tìm thấy cán bộ phụ trách phù hợp cho ${autoAssignedCount}/${targets.length} hồ sơ:\n` +
          Object.entries(assignedCount).map(([name, count]) => `- ${name}: ${count} hồ sơ`).join('\n') +
          (skippedCount > 0 ? `\n- Không tìm thấy người phụ trách cho ${skippedCount} hồ sơ (sẽ giữ nguyên chưa giao).` : '') +
          `\n\nBạn có chắc chắn muốn thực hiện giao đồng loạt không?`;
          
      if (await confirmAction(confirmMsg, "Xác nhận Giao đồng loạt")) {
          setRecords(prev => prev.map(r => {
              const updated = updatedRecords.find(ur => ur.id === r.id);
              return updated ? updated : r;
          }));
          
          await Promise.all(updatedRecords.map(r => updateRecordApi(r)));
          setSelectedRecordIds(new Set());
          setToast({ 
              type: 'success', 
              message: `Đã giao đồng loạt ${autoAssignedCount} hồ sơ thành công!` + 
                  (skippedCount > 0 ? ` (Bỏ qua ${skippedCount} hồ sơ không tìm thấy người phụ trách)` : '')
          });
      }
  };

  const getUpdatesForStatusChange = (record: RecordFile | null, newStatus: RecordStatus, customDateStr?: string) => {
      const targetDateStr = customDateStr || new Date().toISOString();
      const updates: any = { status: newStatus };

      switch (newStatus) {
          case RecordStatus.RECEIVED:
              updates.assignedDate = null;
              updates.submissionDate = null;
              updates.approvalDate = null;
              updates.completedDate = null;
              updates.resultReturnedDate = null;
              updates.exportBatch = null;
              updates.exportDate = null;
              break;
          case RecordStatus.ASSIGNED:
          case RecordStatus.IN_PROGRESS:
              updates.assignedDate = targetDateStr;
              updates.submissionDate = null;
              updates.approvalDate = null;
              updates.completedDate = null;
              updates.resultReturnedDate = null;
              updates.exportBatch = null;
              updates.exportDate = null;
              break;
          // MỚI: Trạng thái Đã thực hiện
          case RecordStatus.COMPLETED_WORK:
              // Giữ nguyên assignedDate
              updates.completedWorkDate = targetDateStr;
              updates.pendingCheckDate = null;
              updates.checkedDate = null;
              updates.submissionDate = null; 
              updates.approvalDate = null;
              updates.completedDate = null;
              break;
          case RecordStatus.PENDING_CHECK:
              updates.pendingCheckDate = targetDateStr;
              updates.checkedDate = null;
              updates.submissionDate = null;
              updates.approvalDate = null;
              updates.completedDate = null;
              updates.resultReturnedDate = null;
              break;
          case RecordStatus.CHECKED:
              updates.checkedDate = targetDateStr;
              updates.submissionDate = null;
              updates.approvalDate = null;
              updates.completedDate = null;
              updates.resultReturnedDate = null;
              break;
          case RecordStatus.PENDING_SIGN:
              updates.submissionDate = targetDateStr; 
              updates.approvalDate = null;
              updates.completedDate = null;
              updates.resultReturnedDate = null;
              break;
          case RecordStatus.SIGNED:
              updates.approvalDate = targetDateStr; 
              updates.completedDate = null;
              updates.resultReturnedDate = null;
              break;
          case RecordStatus.HANDOVER:
              updates.completedDate = targetDateStr; 
              updates.resultReturnedDate = null;
              break;
          case RecordStatus.RETURNED:
              updates.resultReturnedDate = targetDateStr;
              if (!updates.completedDate) updates.completedDate = targetDateStr;
              break;
      }

      // Removed cascade/backfill auto-population to prevent inaccurate historical reports. Only single status dates are updated.
      if (record) {
          // Keep rollback cleanup or specific status updates if needed, otherwise no-op for cascade.
      }

      return updates;
  };

  const findRegistrationStepIndex = (record: RecordFile, val: string, holidayList: Holiday[] = []): { index: number, status: RecordStatus } | null => {
      const helper = getGcnWorkflowStepsHelper(record, holidayList);
      if (!helper || !helper.steps) return null;
      
      const v = val.toLowerCase();
      
      // Direct matches for special status enums:
      if (v === 'pending_supplement') {
          return { index: record.currentStepIndex ?? 0, status: RecordStatus.PENDING_SUPPLEMENT };
      }
      if (v === 'withdrawn') {
          return { index: record.currentStepIndex ?? 0, status: RecordStatus.WITHDRAWN };
      }
      if (v === 'rejected') {
          return { index: record.currentStepIndex ?? 0, status: RecordStatus.REJECTED };
      }
      if (v === 'returned') {
          const lastIdx = helper.steps.length - 1;
          return { index: lastIdx, status: RecordStatus.RETURNED };
      }

      // Otherwise, match label:
      let foundIdx = -1;
      if (v === 'dnlis') {
          foundIdx = helper.steps.findIndex(s => s.label.toLowerCase().includes('dnlis') || s.label.toLowerCase().includes('ranh'));
      } else if (v === 'phieu_chuyen_thue') {
          foundIdx = helper.steps.findIndex(s => s.label.toLowerCase().includes('phiếu chuyển thuế') || s.label.toLowerCase().includes('phiếu chuyển') || s.label.toLowerCase().includes('nghĩa vụ tài chính'));
      } else if (v === 'tbt') {
          foundIdx = helper.steps.findIndex(s => s.label.toLowerCase().includes('tbt') || s.label.toLowerCase().includes('thông báo thuế'));
      } else if (v === 'in_gcn') {
          foundIdx = helper.steps.findIndex(s => s.label.toLowerCase().includes('in gcn') || s.label.toLowerCase().includes('in giấy') || s.label.toLowerCase().includes('hủy gcn cũ'));
      } else if (v === 'tham_tra') {
          foundIdx = helper.steps.findIndex(s => s.label.toLowerCase().includes('thẩm tra'));
      } else if (v === 'trinh_ky_gcn') {
          foundIdx = helper.steps.findIndex(s => s.label.toLowerCase().includes('trình ký gcn') || s.label.toLowerCase().includes('trình ký giấy') || s.label.toLowerCase().includes('trình ký'));
      } else if (v === 'vo_so_gcn') {
          foundIdx = helper.steps.findIndex(s => s.label.toLowerCase().includes('vô số gcn') || s.label.toLowerCase().includes('vô số'));
      } else if (v === 'giao_1_cua') {
          foundIdx = helper.steps.findIndex(s => s.label.toLowerCase().includes('giao 1 cửa') || s.label.toLowerCase().includes('giao một cửa') || s.label.toLowerCase().includes('chuyển một cửa'));
      }

      if (foundIdx !== -1) {
          return { index: foundIdx, status: helper.steps[foundIdx].overallStatus as RecordStatus };
      }
      return null;
  };

  const handleBulkUpdate = async (field: keyof RecordFile, value: any, customDateStr?: string) => {
      const selectedIds = Array.from(selectedRecordIds);
      let baseUpdates: any = { [field]: value };
      const targetDateStr = customDateStr || new Date().toISOString();

      if (field === 'status') {
          const isStandardStatus = Object.values(RecordStatus).includes(value as RecordStatus);
          if (isStandardStatus) {
              baseUpdates = getUpdatesForStatusChange(null, value as RecordStatus, targetDateStr);
          }
      } else if (field === 'deadline' || field === 'receivedDate') {
          baseUpdates[field] = targetDateStr;
      }
      
      if (field === 'assignedTo') {
          baseUpdates.assignedDate = targetDateStr;
          baseUpdates.status = RecordStatus.ASSIGNED;
          baseUpdates.submissionDate = null;
          baseUpdates.approvalDate = null;
          baseUpdates.completedDate = null;
          baseUpdates.resultReturnedDate = null;
          baseUpdates.exportBatch = null;
          baseUpdates.exportDate = null;
      }

      // Calculate the specific, fully-elaborated target records upfront
      const updatedTargets = records
          .filter(r => selectedIds.includes(r.id))
          .map(r => {
              let recordUpdates = { ...baseUpdates };
              const isReg = isRegType(r.recordType);

              if (field === 'status') {
                  if (isReg) {
                      const match = findRegistrationStepIndex(r, value, holidays);
                      if (match) {
                          recordUpdates = {
                              ...recordUpdates,
                              status: match.status,
                              currentStepIndex: match.index
                          };
                          // Fill matching status changes timelines
                          const flowUpdates = getUpdatesForStatusChange(r, match.status, targetDateStr);
                          recordUpdates = { ...recordUpdates, ...flowUpdates };
                      }
                  }

                  const targetStatus = recordUpdates.status || value;
                  if (targetStatus === RecordStatus.REJECTED || targetStatus === RecordStatus.WITHDRAWN) {
                      recordUpdates.completedDate = r.completedDate || targetDateStr;
                      const flow = [RecordStatus.RECEIVED, RecordStatus.ASSIGNED, RecordStatus.IN_PROGRESS, RecordStatus.COMPLETED_WORK, RecordStatus.PENDING_CHECK, RecordStatus.CHECKED, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER];
                      const prevIdx = flow.indexOf(r.status);
                      if (prevIdx >= 0) {
                          if (prevIdx >= flow.indexOf(RecordStatus.ASSIGNED) && !r.assignedDate) recordUpdates.assignedDate = targetDateStr;
                          if (prevIdx >= flow.indexOf(RecordStatus.COMPLETED_WORK) && !r.completedWorkDate) recordUpdates.completedWorkDate = targetDateStr;
                          if (prevIdx >= flow.indexOf(RecordStatus.PENDING_CHECK) && !r.pendingCheckDate) recordUpdates.pendingCheckDate = targetDateStr;
                          if (prevIdx >= flow.indexOf(RecordStatus.CHECKED) && !r.checkedDate) recordUpdates.checkedDate = targetDateStr;
                          if (prevIdx >= flow.indexOf(RecordStatus.PENDING_SIGN) && !r.submissionDate) recordUpdates.submissionDate = targetDateStr;
                          if (prevIdx >= flow.indexOf(RecordStatus.SIGNED) && !r.approvalDate) recordUpdates.approvalDate = targetDateStr;
                      }
                  }
              }
              const merged = { ...r, ...recordUpdates };
              return recordStepAssigneeHistory(merged, holidays || []);
          });

      setRecords(prev => prev.map(r => {
          const updated = updatedTargets.find(u => u.id === r.id);
          return updated ? updated : r;
      }));
      
      await Promise.all(updatedTargets.map(r => updateRecordApi(r)));
      setToast({ type: 'success', message: `Đã cập nhật ${selectedIds.length} hồ sơ thành công!` });
      setSelectedRecordIds(new Set()); 
  };

  const handleQuickUpdate = useCallback(async (id: string, field: keyof RecordFile, value: string) => {
      const record = records.find(r => r.id === id); 
      if (!record) return;

      const nowStr = new Date().toISOString();
      let updates: any = { [field]: value };
      
      if (field === 'assignedTo') {
          updates.assignedDate = nowStr;
          updates.status = RecordStatus.ASSIGNED;
          updates.submissionDate = null;
          updates.approvalDate = null;
          updates.completedDate = null;
          updates.resultReturnedDate = null;
          updates.exportBatch = null;
          updates.exportDate = null;
      } else if (field === 'status') {
          updates = getUpdatesForStatusChange(record, value as RecordStatus);
          
          if (value === RecordStatus.REJECTED || value === RecordStatus.WITHDRAWN) {
              updates.completedDate = record.completedDate || nowStr;
              const flow = [RecordStatus.RECEIVED, RecordStatus.ASSIGNED, RecordStatus.IN_PROGRESS, RecordStatus.COMPLETED_WORK, RecordStatus.PENDING_CHECK, RecordStatus.CHECKED, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER];
              const prevIdx = flow.indexOf(record.status);
              if (prevIdx >= 0) {
                  if (prevIdx >= flow.indexOf(RecordStatus.ASSIGNED) && !record.assignedDate) updates.assignedDate = nowStr;
                  if (prevIdx >= flow.indexOf(RecordStatus.COMPLETED_WORK) && !record.completedWorkDate) updates.completedWorkDate = nowStr;
                  if (prevIdx >= flow.indexOf(RecordStatus.PENDING_CHECK) && !record.pendingCheckDate) updates.pendingCheckDate = nowStr;
                  if (prevIdx >= flow.indexOf(RecordStatus.CHECKED) && !record.checkedDate) updates.checkedDate = nowStr;
                  if (prevIdx >= flow.indexOf(RecordStatus.PENDING_SIGN) && !record.submissionDate) updates.submissionDate = nowStr;
                  if (prevIdx >= flow.indexOf(RecordStatus.SIGNED) && !record.approvalDate) updates.approvalDate = nowStr;
              }
          }
      }

      const merged = { ...record, ...updates };
      const withHistory = recordStepAssigneeHistory(merged, holidays || []);
      setRecords(prev => prev.map(r => r.id === id ? withHistory : r));
      try { 
          await updateRecordApi(withHistory); 
      } catch (e) { 
          console.error("Quick update failed", e); 
      }
  }, [records, employees]);

  const advanceStatus = useCallback(async (record: RecordFile) => {
      if (record.status === RecordStatus.RECEIVED) {
          setAssignTargetRecords([record]);
          setIsAssignModalOpen(true);
          return;
      }

      const nowStr = new Date().toISOString();
      if (isRegType(record.recordType)) {
          const helper = getGcnWorkflowStepsHelper(record, holidays);
          const stepConfigs = helper.steps;
          let currentIdx = record.currentStepIndex;
          if (currentIdx === undefined || currentIdx === null || currentIdx >= stepConfigs.length) {
              currentIdx = helper.currentStepIndex;
          }

          const currentStep = stepConfigs[currentIdx];
          if (currentStep && (currentStep.label.toLowerCase() === 'tbt' || currentStep.label.includes('TBT'))) {
              if (!record.taxPaymentDate) {
                  setToast({ type: 'error', message: 'Hồ sơ đang chờ người dân nộp tiền thuế. Vui lòng xác nhận đóng thuế trong chi tiết hồ sơ.' });
                  return;
              }
          }

          const nextIdx = currentIdx + 1;
          if (nextIdx < stepConfigs.length) {
              const nextStep = stepConfigs[nextIdx];
              const nextStepLabelLower = nextStep.label.toLowerCase();
              const currentStepLabelLower = currentStep?.label.toLowerCase() || '';

              // Custom Rules Overrides
              const isMocKeOrTheChap = currentStepLabelLower.includes("mộc kê") || 
                                       currentStepLabelLower.includes("moc ke") || 
                                       currentStepLabelLower.includes("thế chấp") || 
                                       currentStepLabelLower.includes("the chap");

              const isNiemYet = currentStepLabelLower.includes("niêm yết") || 
                                currentStepLabelLower.includes("niem yet");

              const isFromVoSoTo1Cua = (currentStepLabelLower.includes("vô số") || currentStepLabelLower.includes("vo so")) && 
                                       (nextStepLabelLower.includes("1 cửa") || nextStepLabelLower.includes("một cửa") || nextStep.overallStatus === RecordStatus.HANDOVER);

              if (isMocKeOrTheChap || isNiemYet || isFromVoSoTo1Cua) {
                  const stepAssignees = { ...(record.stepAssignees || {}) };
                  if (record.assignedTo && currentStep) {
                      stepAssignees[currentStep.label.toLowerCase().trim()] = record.assignedTo;
                  }

                  let autoAssignee: string | null | undefined = null;
                  let successMsg = `Đã chuyển hồ sơ sang bước: ${nextStep.label}`;

                  if (isNiemYet) {
                      if (currentIdx > 0) {
                          for (let i = currentIdx - 1; i >= 0; i--) {
                              const prevLabel = stepConfigs[i].label.toLowerCase().trim();
                              if (record.stepAssignees?.[prevLabel]) {
                                  autoAssignee = record.stepAssignees[prevLabel];
                                  break;
                              }
                          }
                      }
                      if (!autoAssignee) {
                          autoAssignee = record.assignedTo;
                      }
                      if (autoAssignee) {
                          stepAssignees[nextStep.label.toLowerCase().trim()] = autoAssignee;
                          const empName = employees.find(e => e.id === autoAssignee)?.name || "nhân viên thụ lý trước đó";
                          successMsg = `Đã chuyển hồ sơ sang bước: ${nextStep.label} và tự động giao cho ${empName}`;
                      } else {
                          successMsg = `Đã chuyển hồ sơ sang bước: ${nextStep.label} (chưa có nhân viên thụ lý trước đó)`;
                      }
                  } else if (isMocKeOrTheChap) {
                      successMsg = `Đã hoàn thành bước: ${currentStep?.label} và chuyển hồ sơ về trạng thái Chờ giao việc cho bước tiếp theo: ${nextStep.label}`;
                  } else if (isFromVoSoTo1Cua) {
                      successMsg = `Đã hoàn thành vô số, chuyển hồ sơ sang bước: ${nextStep.label}`;
                  }

                  const updates: any = {
                      currentStepIndex: nextIdx,
                      status: nextStep.overallStatus,
                      stepAssignees,
                      assignedTo: autoAssignee
                  };

                  if (nextStep.overallStatus === RecordStatus.IN_PROGRESS && !record.assignedDate && autoAssignee) {
                      updates.assignedDate = nowStr;
                  }
                  if (nextStep.overallStatus === RecordStatus.COMPLETED_WORK && !record.completedWorkDate) {
                      updates.completedWorkDate = nowStr;
                  }
                  if ((nextStep.overallStatus as any) === RecordStatus.PENDING_CHECK && !record.pendingCheckDate) {
                      updates.pendingCheckDate = nowStr;
                  }
                  if (nextStep.overallStatus === RecordStatus.CHECKED) {
                      updates.checkedDate = nowStr;
                      updates.checkedBy = record.checkedBy || currentUser?.employeeId || null;
                  }
                  if ((nextStep.overallStatus as any) === RecordStatus.PENDING_SIGN && !record.submissionDate) {
                      updates.submissionDate = nowStr;
                  }
                  if (nextStep.overallStatus === RecordStatus.SIGNED && !record.approvalDate) {
                      updates.approvalDate = nowStr;
                  }
                  if (nextStep.overallStatus === RecordStatus.HANDOVER && !record.completedDate) {
                      updates.completedDate = nowStr;
                  }

                  const merged = { ...record, ...updates };
                  const withHistory = recordStepAssigneeHistory(merged, holidays || []);
                  setRecords(prev => prev.map(r => r.id === record.id ? withHistory : r));
                  await updateRecordApi(withHistory);
                  setToast({ type: 'success', message: successMsg });
                  loadData();
                  return;
              }

              if (nextStep.overallStatus === RecordStatus.PENDING_CHECK && !nextStepLabelLower.includes("in gcn") && !nextStepLabelLower.includes("in giấy") && !nextStepLabelLower.includes("in giấy")) {
                  setSubmitTargetRecords([record]);
                  setIsSubmitCheckModalOpen(true);
                  return;
              }
              if (nextStep.overallStatus === RecordStatus.PENDING_SIGN) {
                  setSubmitTargetRecords([record]);
                  setIsSubmitModalOpen(true);
                  return;
              }

              if (currentStep && (currentStepLabelLower.includes("in gcn") || currentStepLabelLower.includes("in giấy") || currentStepLabelLower.includes("in bản đồ"))) {
                  setFoilTargetRecord(record);
                  setFoilNumber(record.issueNumber || '');
                  setFoilModalOpen(true);
                  return;
              }

              if (currentStep && (currentStepLabelLower.includes("vô số") || currentStepLabelLower.includes("vo so") || currentStepLabelLower.includes("vào sổ") || currentStepLabelLower.includes("vao so"))) {
                  setEntryBookTargetRecord(record);
                  const nextNum = await calculateNextVaoSoNumber();
                  setEntryBookValue(record.entryNumber || nextNum);
                  setEntryBookModalOpen(true);
                  return;
              }

              const isTerminalStep = nextStep.overallStatus === RecordStatus.RETURNED || nextStepLabelLower.includes("đã trả") || nextStepLabelLower.includes("tra ket qua");

              if (!isTerminalStep) {
                  setAssignNextStepTargetRecord(record);
                  setAssignNextStepLabel(nextStep.label);
                  setIsAssignNextStepModalOpen(true);
                  return;
              }

              const stepAssignees = { ...(record.stepAssignees || {}) };
              if (record.assignedTo && currentStep) {
                  stepAssignees[currentStep.label.toLowerCase().trim()] = record.assignedTo;
              }

              const updates: any = {
                  currentStepIndex: nextIdx,
                  status: nextStep.overallStatus,
                  stepAssignees
              };

              if (nextStep.overallStatus === RecordStatus.IN_PROGRESS || nextStep.overallStatus === RecordStatus.TBT) {
                  updates.assignedTo = null;
              }

              if (nextStep.overallStatus === RecordStatus.IN_PROGRESS && !record.assignedDate) {
                  updates.assignedDate = nowStr;
              }
              if (nextStep.overallStatus === RecordStatus.COMPLETED_WORK && !record.completedWorkDate) {
                  updates.completedWorkDate = nowStr;
              }
              if ((nextStep.overallStatus as any) === RecordStatus.PENDING_CHECK && !record.pendingCheckDate) {
                  updates.pendingCheckDate = nowStr;
              }
              if (nextStep.overallStatus === RecordStatus.CHECKED) {
                  updates.checkedDate = nowStr;
                  updates.checkedBy = record.checkedBy || currentUser?.employeeId || null;
              }
              if ((nextStep.overallStatus as any) === RecordStatus.PENDING_SIGN && !record.submissionDate) {
                  updates.submissionDate = nowStr;
              }
              if (nextStep.overallStatus === RecordStatus.SIGNED && !record.approvalDate) {
                  updates.approvalDate = nowStr;
              }
              if (nextStep.overallStatus === RecordStatus.HANDOVER && !record.completedDate) {
                  updates.completedDate = nowStr;
              }

              const merged = { ...record, ...updates };
              const withHistory = recordStepAssigneeHistory(merged, holidays || []);
              setRecords(prev => prev.map(r => r.id === record.id ? withHistory : r));
              await updateRecordApi(withHistory);

              setToast({ type: 'success', message: `Đã chuyển hồ sơ sang bước: ${nextStep.label}` });
          } else {
              setToast({ type: 'success', message: `Hồ sơ ${record.code} đã hoàn thành tất cả các bước!` });
          }
      } else {
          let flow = [
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
          if (isMeasurementType(record.recordType)) {
              flow = [
                  RecordStatus.RECEIVED,
                  RecordStatus.ASSIGNED,
                  RecordStatus.IN_PROGRESS,
                  RecordStatus.PENDING_CHECK,
                  RecordStatus.CHECKED,
                  RecordStatus.PENDING_SIGN,
                  RecordStatus.SIGNED,
                  RecordStatus.HANDOVER,
                  RecordStatus.RETURNED
              ];
          } else if (isArchiveType(record.recordType)) {
              flow = [
                  RecordStatus.RECEIVED,
                  RecordStatus.ASSIGNED,
                  RecordStatus.IN_PROGRESS,
                  RecordStatus.COMPLETED_WORK,
                  RecordStatus.PENDING_SIGN,
                  RecordStatus.SIGNED,
                  RecordStatus.HANDOVER,
                  RecordStatus.RETURNED
              ];
          }
          const foundIdx = flow.indexOf(record.status);
          if (foundIdx !== -1 && foundIdx < flow.length - 1) {
              const nextStatus = flow[foundIdx + 1];

              if (nextStatus === RecordStatus.PENDING_CHECK) {
                  setSubmitTargetRecords([record]);
                  setIsSubmitCheckModalOpen(true);
                  return;
              }
              if (nextStatus === RecordStatus.PENDING_SIGN) {
                  setSubmitTargetRecords([record]);
                  setIsSubmitModalOpen(true);
                  return;
              }

              const updates = getUpdatesForStatusChange(record, nextStatus);
              const merged = { ...record, ...updates };
              const withHistory = recordStepAssigneeHistory(merged, holidays || []);
              setRecords(prev => prev.map(r => r.id === record.id ? withHistory : r));
              await updateRecordApi(withHistory);
              setToast({ type: 'success', message: `Đã chuyển trạng thái hồ sơ sang ${nextStatus}!` });
          }
      }
  }, [records, currentUser, holidays]);

  const executeBatchExport = useCallback(async (batch: number, date: string, handoverWard?: string, updatedRecords?: RecordFile[]) => {
      try {
          const targets = (updatedRecords && updatedRecords.length > 0) 
              ? updatedRecords 
              : records.filter(r => selectedRecordIds.has(r.id));
          
          if (targets.length === 0) {
              setToast({ type: 'error', message: 'Không tìm thấy hồ sơ để chốt đợt giao nhận!' });
              return;
          }

          const nowStr = new Date().toISOString();
          const isReturnedMode = targets.every(r => r.status === RecordStatus.RETURNED);
          const updates = targets.map(r => ({
              ...r,
              status: isReturnedMode ? RecordStatus.RETURNED : RecordStatus.HANDOVER,
              exportBatch: isReturnedMode ? r.exportBatch : batch,
              exportDate: isReturnedMode ? r.exportDate : date,
              archiveBatch: isReturnedMode ? batch : r.archiveBatch,
              archiveDate: isReturnedMode ? date : r.archiveDate,
              isArchived: isReturnedMode ? true : r.isArchived,
              completedDate: r.completedDate || nowStr,
              handoverWard: handoverWard || r.handoverWard || null
          }));

          await updateRecordsBatchById(updates);
          
          if (isReturnedMode) {
              await exportReturnedListToExcel(updates, String(batch), date);
              setToast({ type: 'success', message: `Đã chốt danh sách lưu kho đợt ${batch} và xuất file excel thành công!` });
          } else {
              setToast({ type: 'success', message: `Đã chốt đợt bàn giao số ${batch} thành công!` });
          }
          setIsAddToBatchModalOpen(false);
          setSelectedRecordIds(new Set());
          loadData();
      } catch (error) {
          console.error(error);
          setToast({ type: 'error', message: 'Lỗi khi chốt đợt bàn giao và xuất file.' });
      }
  }, [records, selectedRecordIds, loadData]);

  const handleMapCorrectionRequest = useCallback((record: RecordFile) => {
      setRecordForMapCorrection(record);
      setCurrentView('utilities');
  }, []);

  const handleMarkAsRejected = useCallback(() => {
      const targets = records.filter(r => selectedRecordIds.has(r.id));
      if (targets.length === 0) return;
      setRejectRecordsTarget(targets);
      setIsRejectReasonModalOpen(true);
  }, [records, selectedRecordIds]);

  const handleExportReturnedList = useCallback(async () => {
      let targets = recordFilterProps.filteredRecords;
      if (recordFilterProps.serverPaginationEnabled) {
          setToast({ type: 'success', message: 'Đang tải toàn bộ dữ liệu bàn giao từ Server...' });
          targets = await recordFilterProps.fetchFullFilteredRecords();
      }
      if (targets.length === 0) {
          setToast({ type: 'error', message: 'Không có hồ sơ nào trong danh sách để xuất!' });
          return;
      }
      exportReturnedListToExcel(targets, recordFilterProps.filterFromDate, recordFilterProps.filterToDate, recordFilterProps.filterProcedure);
  }, [recordFilterProps, setToast]);

  const handleConfirmSignBatch = useCallback(async () => {
      const selectedIds = Array.from(selectedRecordIds);
      if (selectedIds.length === 0) return;
      
      const confirmMsg = `Xác nhận ký duyệt đồng loạt ${selectedIds.length} hồ sơ?\nHồ sơ sẽ chuyển sang trạng thái "Đã ký duyệt" và chuyển qua bước Chờ giao 1 cửa.`;
      if (await confirmAction(confirmMsg)) {
          try {
              const nowStr = new Date().toISOString();
              const updates = records
                  .filter(r => selectedRecordIds.has(r.id))
                  .map(r => ({
                      ...r,
                      status: RecordStatus.SIGNED,
                      approvalDate: nowStr
                  }));
              
              await updateRecordsBatchById(updates);
              
              setToast({ type: 'success', message: `Đã ký duyệt ${updates.length} hồ sơ thành công và chuyển sang bước chờ giao 1 cửa!` });
              setSelectedRecordIds(new Set());
              loadData();
          } catch (error) {
              console.error("Lỗi khi ký duyệt đồng loạt:", error);
              setToast({ type: 'error', message: 'Có lỗi xảy ra khi ký duyệt đồng loạt.' });
          }
      }
  }, [records, selectedRecordIds, loadData]);

  const handleConfirmRejectRecords = useCallback(async (recordsToReject: RecordFile[], reason: string) => {
      const nowStr = new Date().toISOString();
      const updates = recordsToReject.map(r => ({
          ...r,
          status: RecordStatus.REJECTED,
          rejectReason: reason,
          completedDate: r.completedDate || nowStr
      }));
      await updateRecordsBatchById(updates);
      setToast({ type: 'success', message: `Đã từ chối ${updates.length} hồ sơ thành công!` });
      setIsRejectReasonModalOpen(false);
      setRejectRecordsTarget([]);
      loadData();
  }, [loadData]);

  const handleOpenReturnModal = useCallback((record: RecordFile) => {
      setReturnRecord(record);
      setIsReturnModalOpen(true);
  }, []);

  const handleConfirmReturnResult = useCallback(async (receiptNumber: string, receiverName: string, receiptType: 'receipt' | 'invoice', paymentAmount: number | null) => {
      if (!returnRecord) return;
      const nowStr = new Date().toISOString();
      const updates = {
          status: RecordStatus.RETURNED,
          resultReturnedDate: nowStr,
          receiptNumber: receiptNumber,
          receiverName: receiverName,
          receiptType: receiptType,
          paymentAmount: paymentAmount,
          completedDate: returnRecord.completedDate || nowStr
      };
      const merged = { ...returnRecord, ...updates };
      const withHistory = recordStepAssigneeHistory(merged, holidays || []);
      setRecords(prev => prev.map(r => r.id === returnRecord.id ? withHistory : r));
      await updateRecordApi(withHistory);
      setToast({ type: 'success', message: `Hồ sơ ${returnRecord.code} đã được bàn giao kết quả và cập nhật biên lai/hóa đơn!` });
      setIsReturnModalOpen(false);
      setReturnRecord(null);
  }, [returnRecord]);

  const renderGcnWorkflowModals = () => {
      return (
          <>
              {taxModalOpen && taxTargetRecord && (() => {
                  const directors = users.filter((u: any) => {
                      const emp = u.employeeId ? employees.find(e => e.id === u.employeeId) : null;
                      if (!emp) return false;
                      const teamName = getEmployeeTeam(emp);
                      const pos = (emp.position || '').toLowerCase();
                      const isDirectorPos = pos.includes('giam doc') || pos.includes('giám đốc') || pos.includes('pho giam doc') || pos.includes('phó giám đốc') || pos.includes('lanh dao') || pos.includes('lãnh đạo');
                      return teamName === 'Ban Giám đốc' || isDirectorPos;
                  });

                  const updateTaxCategoryAndTotal = (category: string, value: string) => {
                      let res = parseFloat(category === 'residential' ? value : taxResidentialArea) || 0;
                      let cln = parseFloat(category === 'cln' ? value : taxClnArea) || 0;
                      let bhk = parseFloat(category === 'bhk' ? value : taxBhkArea) || 0;
                      let luc = parseFloat(category === 'luc' ? value : taxLucArea) || 0;
                      let other = parseFloat(category === 'other' ? value : taxOtherLandArea) || 0;

                      if (category === 'residential') setTaxResidentialArea(value);
                      else if (category === 'cln') setTaxClnArea(value);
                      else if (category === 'bhk') setTaxBhkArea(value);
                      else if (category === 'luc') setTaxLucArea(value);
                      else if (category === 'other') setTaxOtherLandArea(value);

                      const total = res + cln + bhk + luc + other;
                      setTaxArea(total > 0 ? String(parseFloat(total.toFixed(4))) : '');
                  };

                  return (
                      <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
                          <div className="bg-white rounded-xl shadow-2xl border border-indigo-100 w-full max-w-md overflow-hidden animate-fade-in-up text-left">
                              <div className="bg-indigo-600 px-5 py-3 text-white font-bold text-sm flex items-center justify-between">
                                   <span>TRÌNH KÝ PHIẾU CHUYỂN THUẾ</span>
                                   <button onClick={() => { setTaxModalOpen(false); setTaxTargetRecord(null); }} className="text-white/80 hover:text-white font-bold">✕</button>
                              </div>
                              <div className="p-5 space-y-4">
                                  <p className="text-xs text-gray-600 leading-relaxed">
                                      Vui lòng chọn lãnh đạo Ban Giám đốc để trình ký thuế cho hồ sơ <strong>{taxTargetRecord.code}</strong>:
                                  </p>

                                  <div>
                                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Chọn lãnh đạo trình ký (Ban Giám đốc) <span className="text-red-500">*</span></label>
                                      <select
                                          value={taxDirector}
                                          onChange={e => setTaxDirector(e.target.value)}
                                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                          required
                                      >
                                          <option value="">-- Chọn lãnh đạo trình ký --</option>
                                          {directors.map(dir => (
                                              <option key={dir.employeeId} value={dir.employeeId}>
                                                  {dir.name} - {employees.find(e => e.id === dir.employeeId)?.position || 'Lãnh đạo Ban Giám đốc'}
                                              </option>
                                          ))}
                                      </select>
                                      {directors.length === 0 && (
                                          <p className="text-[11px] text-red-500 mt-1">
                                              Không tìm thấy người ký thuộc Ban Giám đốc nào trong hệ thống!
                                          </p>
                                      )}
                                  </div>
                                  <div className="flex justify-end gap-2 pt-2">
                                      <button
                                          onClick={() => { setTaxModalOpen(false); setTaxTargetRecord(null); }}
                                          className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                      >
                                          Hủy bỏ
                                      </button>
                                      <button
                                          onClick={async () => {
                                              if (!taxTargetRecord) return;
                                              
                                              if (!taxDirector) {
                                                  setToast({ type: 'error', message: 'Vui lòng chọn Lãnh đạo là Ban Giám đốc để trình ký.' });
                                                  return;
                                              }

                                              const nowStr = new Date().toISOString();
                                              const stepConfigs = getGcnWorkflowSteps(taxTargetRecord, holidays);
                                              let currentStepIndex = taxTargetRecord.currentStepIndex;
                                              if (currentStepIndex === undefined || currentStepIndex === null) {
                                                  const foundIdx = stepConfigs.findIndex(s => s.label.includes("Phiếu chuyển Thuế") || s.label.includes("Lập phiếu chuyển thuế") || s.label.toLowerCase().includes("trình ký thuế"));
                                                  currentStepIndex = foundIdx !== -1 ? foundIdx : 0;
                                              }
                                              const nextStepIndex = currentStepIndex + 1;
                                              const nextStep = stepConfigs[nextStepIndex];
                                              const nextStatus = nextStep ? nextStep.overallStatus : RecordStatus.COMPLETED_WORK;

                                              const updates = {
                                                  status: nextStatus,
                                                  currentStepIndex: nextStepIndex,
                                                  landPlot: taxTargetRecord.landPlot || '',
                                                  mapSheet: taxTargetRecord.mapSheet || '',
                                                  area: taxTargetRecord.area || 0,
                                                  residentialArea: taxTargetRecord.residentialArea || 0,
                                                  clnArea: taxTargetRecord.clnArea || 0,
                                                  bhkArea: taxTargetRecord.bhkArea || 0,
                                                  lucArea: taxTargetRecord.lucArea || 0,
                                                  otherLandArea: taxTargetRecord.otherLandArea || 0,
                                                  completedWorkDate: nowStr,
                                                  submittedTo: taxDirector,
                                                  submissionDate: nowStr
                                              };
                                              
                                              const merged = { ...taxTargetRecord, ...updates };
                                              const withHistory = recordStepAssigneeHistory(merged, holidays || []);
                                              setRecords(prev => prev.map(r => r.id === taxTargetRecord.id ? withHistory : r));
                                              await updateRecordApi(withHistory);
                                              setToast({ type: 'success', message: `Đã chuyển trình ký thuế và trình lên lãnh đạo thành công!` });
                                              setTaxModalOpen(false);
                                              setTaxTargetRecord(null);
                                          }}
                                          className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                                      >
                                          Xác nhận & Trình
                                      </button>
                                  </div>
                              </div>
                          </div>
                      </div>
                  );
              })()}

              {foilModalOpen && foilTargetRecord && (
                  <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
                      <div className="bg-white rounded-xl shadow-2xl border border-teal-100 w-full max-w-md overflow-hidden animate-fade-in-up text-left">
                          <div className="bg-teal-600 px-5 py-3 text-white font-bold text-sm flex items-center justify-between">
                               <span>NHẬP SỐ PHÔI GCN MỚI</span>
                               <button onClick={() => { setFoilModalOpen(false); setFoilTargetRecord(null); }} className="text-white/80 hover:text-white font-bold">✕</button>
                          </div>
                          <div className="p-5 space-y-4">
                              <p className="text-xs text-gray-600 leading-relaxed">
                                  Vui lòng nhập số phôi GCN mới cho hồ sơ <strong>{foilTargetRecord.code}</strong> trước khi trình thẩm tra:
                              </p>
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Số phôi GCN mới</label>
                                  <input 
                                      type="text" 
                                      value={foilNumber} 
                                      onChange={e => setFoilNumber(e.target.value)} 
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                      placeholder="Ví dụ: CO 123456"
                                  />
                              </div>
                              <div className="flex justify-end gap-2 pt-2">
                                  <button
                                      onClick={() => { setFoilModalOpen(false); setFoilTargetRecord(null); }}
                                      className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                  >
                                      Hủy bỏ
                                  </button>
                                  <button
                                      onClick={async () => {
                                          if (!foilTargetRecord) return;
                                          if (!foilNumber || !foilNumber.trim()) {
                                              setToast({ type: 'error', message: 'Vui lòng nhập Số phát hành (Số phôi GCN mới) trước khi trình thẩm tra!' });
                                              return;
                                          }
                                          const nowStr = new Date().toISOString();
                                          const stepConfigs = getGcnWorkflowSteps(foilTargetRecord, holidays);
                                          let currentStepIndex = foilTargetRecord.currentStepIndex;
                                          if (currentStepIndex === undefined || currentStepIndex === null) {
                                              const foundIdx = stepConfigs.findIndex(s => {
                                                  const l = s.label.toLowerCase();
                                                  return l.includes("in gcn") || l.includes("in giấy") || l.includes("in bản đồ");
                                              });
                                              currentStepIndex = foundIdx !== -1 ? foundIdx : 0;
                                          }
                                          const nextStepIndex = currentStepIndex + 1;
                                          const nextStep = stepConfigs[nextStepIndex];
                                          const nextStatus = nextStep ? nextStep.overallStatus : RecordStatus.CHECKED;

                                          const updates = {
                                              status: nextStatus,
                                              currentStepIndex: nextStepIndex,
                                              issueNumber: foilNumber,
                                              checkedDate: nowStr
                                          };
                                          const merged = { ...foilTargetRecord, ...updates };
                                          const withHistory = recordStepAssigneeHistory(merged, holidays || []);
                                          setRecords(prev => prev.map(r => r.id === foilTargetRecord.id ? withHistory : r));
                                          await updateRecordApi(withHistory);
                                          setToast({ type: 'success', message: `Đã cập nhật số phôi GCN mới và chuyển sang Thẩm tra!` });
                                          setFoilModalOpen(false);
                                          setFoilTargetRecord(null);
                                      }}
                                      className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
                                  >
                                      Xác nhận
                                  </button>
                              </div>
                          </div>
                      </div>
                  </div>
              )}

              {entryBookModalOpen && entryBookTargetRecord && (
                  <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
                      <div className="bg-white rounded-xl shadow-2xl border border-indigo-100 w-full max-w-md overflow-hidden animate-fade-in-up text-left">
                          <div className="bg-indigo-600 px-5 py-3 text-white font-bold text-sm flex items-center justify-between">
                               <span>VÀO SỔ CẤP GCN (VÔ SỐ)</span>
                               <button onClick={() => { setEntryBookModalOpen(false); setEntryBookTargetRecord(null); }} className="text-white/80 hover:text-white font-bold">✕</button>
                          </div>
                          <div className="p-5 space-y-4">
                              <p className="text-xs text-gray-600 leading-relaxed">
                                  Hệ thống đã tự động tính số vào sổ tiếp theo. Vui lòng xác nhận hoặc điều chỉnh <strong>Số vào sổ cấp GCN</strong> cho hồ sơ <strong>{entryBookTargetRecord.code}</strong>:
                              </p>
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Số vào sổ cấp GCN</label>
                                  <input 
                                      type="text" 
                                      value={entryBookValue} 
                                      onChange={e => setEntryBookValue(e.target.value)} 
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-bold text-indigo-900"
                                      placeholder="Ví dụ: CN 123456"
                                  />
                              </div>
                              <div className="flex justify-end gap-2 pt-2">
                                  <button
                                      onClick={() => { setEntryBookModalOpen(false); setEntryBookTargetRecord(null); }}
                                      className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                  >
                                      Hủy bỏ
                                  </button>
                                  <button
                                      onClick={async () => {
                                          if (!entryBookTargetRecord) return;
                                          if (!entryBookValue || !entryBookValue.trim()) {
                                              setToast({ type: 'error', message: 'Vui lòng nhập Số vào sổ cấp GCN!' });
                                              return;
                                          }
                                          const nowStr = new Date().toISOString();
                                          const stepConfigs = getGcnWorkflowSteps(entryBookTargetRecord, holidays);
                                          let currentStepIndex = entryBookTargetRecord.currentStepIndex;
                                          if (currentStepIndex === undefined || currentStepIndex === null) {
                                              const foundIdx = stepConfigs.findIndex(s => {
                                                  const l = s.label.toLowerCase();
                                                  return l.includes("vô số") || l.includes("vo so") || l.includes("vào sổ") || l.includes("vao so");
                                              });
                                              currentStepIndex = foundIdx !== -1 ? foundIdx : 0;
                                          }
                                          const nextStepIndex = currentStepIndex + 1;
                                          const nextStep = stepConfigs[nextStepIndex];
                                          const nextStatus = nextStep ? nextStep.overallStatus : RecordStatus.HANDOVER;

                                          const updates = {
                                              status: nextStatus,
                                              currentStepIndex: nextStepIndex,
                                              entryNumber: entryBookValue,
                                              approvalDate: nowStr
                                          };
                                          const merged = { ...entryBookTargetRecord, ...updates };
                                          const withHistory = recordStepAssigneeHistory(merged, holidays || []);
                                          setRecords(prev => prev.map(r => r.id === entryBookTargetRecord.id ? withHistory : r));
                                          await updateRecordApi(withHistory);
                                          setToast({ type: 'success', message: `Đã hoàn thành Vô số (Số vào sổ: ${entryBookValue}) và chuyển sang bước tiếp theo!` });
                                          setEntryBookModalOpen(false);
                                          setEntryBookTargetRecord(null);
                                      }}
                                      className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                                  >
                                      Xác nhận
                                  </button>
                              </div>
                          </div>
                      </div>
                  </div>
              )}
          </>
      );
  };

  if (!currentUser) return <Login onLogin={setCurrentUser} users={users} />;

  if (isMobile) {
    return (
      <MobileLayout
        currentUser={currentUser}
        currentView={currentView}
        setCurrentView={setCurrentView}
        onLogout={() => setCurrentUser(null)}
        unreadMessages={unreadMessages}
        activeRemindersCount={activeRemindersCount}
        employees={employees}
      >
        <MobileRoutes
          currentView={currentView}
          setCurrentView={setCurrentView}
          currentUser={currentUser}
          records={records}
          employees={employees}
          users={users}
          wards={wards}
          holidays={holidays}
          handleViewRecord={(r) => setViewingRecord(r)}
          setEditingRecord={setEditingRecord}
          setIsModalOpen={setIsModalOpen}
          setDeletingRecord={setDeletingRecord}
          setIsDeleteModalOpen={setIsDeleteModalOpen}
          handleUpdateCurrentAccount={handleUpdateCurrentAccount}
          notificationEnabled={notificationEnabled}
          setNotificationEnabled={setNotificationEnabled}
          setUnreadMessages={setUnreadMessages}
          onLogout={() => setCurrentUser(null)}
          onAddUser={(u) => { saveUserApi(u, false).then(res => { if(res) { setUsers(prev => [...prev, res]); loadData(); } }); }}
          onUpdateUser={(u) => handleUpdateUser(u, true)}
          onDeleteUser={handleDeleteUser}
          onSaveEmployee={handleSaveEmployee}
          onDeleteEmployee={handleDeleteEmployee}
          onDeleteAllData={handleDeleteAllData}
          onHolidaysChanged={loadData}
        />
        
        <AppModals 
            isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen}
            isImportModalOpen={isImportModalOpen} setIsImportModalOpen={setIsImportModalOpen}
            isSettingsOpen={false} setIsSettingsOpen={() => {}} 
            isAssignModalOpen={isAssignModalOpen} setIsAssignModalOpen={setIsAssignModalOpen}
            isDeleteModalOpen={isDeleteModalOpen} setIsDeleteModalOpen={setIsDeleteModalOpen}
            isExportModalOpen={isExportModalOpen} setIsExportModalOpen={setIsExportModalOpen}
            isAddToBatchModalOpen={isAddToBatchModalOpen} setIsAddToBatchModalOpen={setIsAddToBatchModalOpen}
            isExcelPreviewOpen={isExcelPreviewOpen} setIsExcelPreviewOpen={setIsExcelPreviewOpen}
            isBulkUpdateModalOpen={isBulkUpdateModalOpen} setIsBulkUpdateModalOpen={setIsBulkUpdateModalOpen}
            isReturnModalOpen={isReturnModalOpen} setIsReturnModalOpen={setIsReturnModalOpen}
            
            editingRecord={editingRecord} setEditingRecord={setEditingRecord}
            viewingRecord={viewingRecord ? (records.find(r => r.id === viewingRecord.id) || viewingRecord) : null} setViewingRecord={setViewingRecord}
            deletingRecord={deletingRecord} setDeletingRecord={setDeletingRecord}
            returnRecord={returnRecord} setReturnRecord={setReturnRecord}
            assignTargetRecords={assignTargetRecords}
            exportModalType={exportModalType}
            
            previewWorkbook={previewWorkbook} previewExcelName={previewExcelName}

            handleAddOrUpdate={handleAddOrUpdateWithToast}
            handleImportRecords={onImportRecords}
            handleSaveEmployee={handleSaveEmployee}
            handleDeleteEmployee={handleDeleteEmployee}
            handleDeleteAllData={handleDeleteAllData}
            onRefreshData={loadData}
            confirmAssign={confirmAssign}
            handleDeleteRecord={() => { if(deletingRecord) handleDeleteRecord(deletingRecord.id); }}
            confirmDelete={(r) => handleDeleteRecord(r.id)}
            handleExcelPreview={(wb, name) => { setPreviewWorkbook(wb); setPreviewExcelName(name); setIsExcelPreviewOpen(true); }}
            executeBatchExport={executeBatchExport}
            onCreateLiquidation={(r) => { setRecordToLiquidate(r); setCurrentView('receive_contract'); }}
            onDraftMinutes={(r) => { setRecordForMinutes(r); setCurrentView('utilities'); }}
            handleBulkUpdate={handleBulkUpdate}
            confirmReturnResult={handleConfirmReturnResult}

            employees={employees}
            users={users}
            currentUser={currentUser}
            wards={wards}
            filteredRecords={recordFilterProps.filteredRecords}
            records={records}
            selectedCount={selectedRecordIds.size}
            canPerformAction={canPerformAction}
            selectedRecordsForBulk={records.filter(r => selectedRecordIds.has(r.id))}
            currentView={currentView}
            holidays={holidays}
        />

        {toast && (
            <div className={`fixed bottom-20 right-4 px-6 py-3 rounded-lg shadow-xl text-white font-bold animate-fade-in-up z-50 flex items-center justify-between gap-4 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                <div className="flex items-center gap-2">
                    {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                    <span>{toast.message}</span>
                </div>
                <button 
                    onClick={() => setToast(null)} 
                    className="text-white hover:text-gray-200 transition-colors focus:outline-none p-1 rounded-full hover:bg-white/10 cursor-pointer"
                    aria-label="Close toast"
                >
                    <X size={16} />
                </button>
            </div>
        )}
        {renderGcnWorkflowModals()}
        <GlobalConfirmModal />
        <GlobalAlertModal />
      </MobileLayout>
    );
  }

  return (
    <MainLayout
        currentUser={currentUser}
        currentView={currentView}
        setCurrentView={setCurrentView}
        onLogout={() => setCurrentUser(null)}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        isGeneratingReport={isGeneratingReport}
        isUpdateAvailable={false} 
        latestVersion={latestVersion}
        updateUrl={updateUrl}
        unreadMessages={unreadMessages}
        warningCount={recordFilterProps.warningCount}
        activeRemindersCount={activeRemindersCount}
        connectionStatus={connectionStatus}
        onSyncSuccess={loadData}
        rolePermissions={rolePermissions}
        departmentPermissions={departmentPermissions}
        employees={employees}
        showUpdateModal={isUpdateAvailable && !updateDeferred}
        updateVersion={latestVersion}
        updateDownloadStatus={updateStatus}
        updateProgress={updateProgress}
        updateSpeed={updateSpeed}
        onUpdateNow={handleUpdateNow}
        onUpdateLater={handleUpdateLater}
    >
        <AppRoutes 
            currentView={currentView}
            setCurrentView={setCurrentView}
            currentUser={currentUser}
            records={records}
            employees={employees}
            users={users}
            wards={wards}
            holidays={holidays}
            rolePermissions={rolePermissions}
            departmentPermissions={departmentPermissions}
            
            setUnreadMessages={setUnreadMessages}
            notificationEnabled={notificationEnabled}
            setNotificationEnabled={setNotificationEnabled}
            recordToLiquidate={recordToLiquidate}
            setRecordToLiquidate={setRecordToLiquidate}
            recordToContract={recordToContract}
            setRecordToContract={setRecordToContract}
            recordForMapCorrection={recordForMapCorrection}
            recordForMinutes={recordForMinutes}
            onClearRecordForMinutes={() => setRecordForMinutes(null)}
            
            handleViewRecord={(r) => setViewingRecord(r)}
            handleMapCorrectionRequest={handleMapCorrectionRequest}
            handleAddOrUpdateRecord={handleAddOrUpdateWithToast}
            handleDeleteRecord={handleDeleteRecord}
            handleUpdateUser={handleUpdateUser}
            handleDeleteUser={handleDeleteUser}
            handleSaveEmployee={handleSaveEmployee}
            handleDeleteEmployee={handleDeleteEmployee}
            handleDeleteAllData={handleDeleteAllData}
            handleTransferPendingOneStopRecords={handleTransferPendingOneStopRecords}
            handleSyncMissingFieldsFromArchive={handleSyncMissingFieldsFromArchive}
            onRefreshData={loadData}
            setWards={setWards}
            onResetWards={() => setWards(STATIC_WARDS)}
            handleQuickUpdate={handleQuickUpdate}
            handleUpdateCurrentAccount={handleUpdateCurrentAccount}
            
            globalReportContent={globalReportContent}
            isGeneratingReport={isGeneratingReport}
            handleGlobalGenerateReport={handleGlobalGenerateReport}
            handleExportReportExcel={handleExportReportExcel}

            {...recordFilterProps}
            
            selectedRecordIds={selectedRecordIds}
            toggleSelectAll={toggleSelectAll}
            toggleSelectRecord={toggleSelectRecord}
            visibleColumns={visibleColumns}
            setVisibleColumns={setVisibleColumns}
            
            setIsModalOpen={setIsModalOpen}
            setEditingRecord={setEditingRecord}
            handleMarkAsRejected={handleMarkAsRejected}
            setIsImportModalOpen={setIsImportModalOpen}
            setIsBulkUpdateModalOpen={setIsBulkUpdateModalOpen}
            setIsAddToBatchModalOpen={setIsAddToBatchModalOpen}
            handleExportReturnedList={handleExportReturnedList}
            handleConfirmSignBatch={handleConfirmSignBatch}
            setAssignTargetRecords={setAssignTargetRecords}
            setIsAssignModalOpen={setIsAssignModalOpen}
            handleBatchAutoAssign={handleBatchAutoAssign}
            setSubmitTargetRecords={setSubmitTargetRecords}
            setIsSubmitModalOpen={setIsSubmitModalOpen}
            setIsSubmitCheckModalOpen={setIsSubmitCheckModalOpen}
            setExportModalType={setExportModalType}
            setIsExportModalOpen={setIsExportModalOpen}
            setDeletingRecord={setDeletingRecord}
            setIsDeleteModalOpen={setIsDeleteModalOpen}
            advanceStatus={advanceStatus}
            handleOpenReturnModal={handleOpenReturnModal}
        />

        <AppModals 
            isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen}
            isImportModalOpen={isImportModalOpen} setIsImportModalOpen={setIsImportModalOpen}
            isSettingsOpen={false} setIsSettingsOpen={() => {}} 
            isAssignModalOpen={isAssignModalOpen} setIsAssignModalOpen={setIsAssignModalOpen}
            isDeleteModalOpen={isDeleteModalOpen} setIsDeleteModalOpen={setIsDeleteModalOpen}
            isExportModalOpen={isExportModalOpen} setIsExportModalOpen={setIsExportModalOpen}
            isAddToBatchModalOpen={isAddToBatchModalOpen} setIsAddToBatchModalOpen={setIsAddToBatchModalOpen}
            isExcelPreviewOpen={isExcelPreviewOpen} setIsExcelPreviewOpen={setIsExcelPreviewOpen}
            isBulkUpdateModalOpen={isBulkUpdateModalOpen} setIsBulkUpdateModalOpen={setIsBulkUpdateModalOpen}
            isReturnModalOpen={isReturnModalOpen} setIsReturnModalOpen={setIsReturnModalOpen}
            
            editingRecord={editingRecord} setEditingRecord={setEditingRecord}
            viewingRecord={viewingRecord ? (records.find(r => r.id === viewingRecord.id) || viewingRecord) : null} setViewingRecord={setViewingRecord}
            deletingRecord={deletingRecord} setDeletingRecord={setDeletingRecord}
            returnRecord={returnRecord} setReturnRecord={setReturnRecord}
            assignTargetRecords={assignTargetRecords}
            exportModalType={exportModalType}
            
            previewWorkbook={previewWorkbook} previewExcelName={previewExcelName}

            handleAddOrUpdate={handleAddOrUpdateWithToast}
            handleImportRecords={onImportRecords}
            handleSaveEmployee={handleSaveEmployee}
            handleDeleteEmployee={handleDeleteEmployee}
            handleDeleteAllData={handleDeleteAllData}
            onRefreshData={loadData}
            confirmAssign={confirmAssign}
            handleDeleteRecord={() => { if(deletingRecord) handleDeleteRecord(deletingRecord.id); }}
            confirmDelete={(r) => handleDeleteRecord(r.id)}
            handleExcelPreview={(wb, name) => { setPreviewWorkbook(wb); setPreviewExcelName(name); setIsExcelPreviewOpen(true); }}
            executeBatchExport={executeBatchExport}
            onCreateLiquidation={(r) => { setRecordToLiquidate(r); setCurrentView('receive_contract'); }}
            onDraftMinutes={(r) => { setRecordForMinutes(r); setCurrentView('utilities'); }}
            handleBulkUpdate={handleBulkUpdate}
            confirmReturnResult={handleConfirmReturnResult}

            employees={employees}
            users={users}
            currentUser={currentUser}
            wards={wards}
            filteredRecords={recordFilterProps.filteredRecords}
            records={records}
            selectedCount={selectedRecordIds.size}
            canPerformAction={canPerformAction}
            selectedRecordsForBulk={records.filter(r => selectedRecordIds.has(r.id))}
            currentView={currentView}
            holidays={holidays}
        />

        <SubmitModal 
            isOpen={isSubmitModalOpen}
            onClose={() => setIsSubmitModalOpen(false)}
            records={submitTargetRecords}
            users={users}
            employees={employees}
            currentUser={currentUser || undefined}
            onConfirm={async (directorId) => {
                try {
                    const nowStr = new Date().toISOString();
                    const updates = submitTargetRecords.map(r => {
                        const isLuuTru = isArchiveType(r.recordType) || 
                                         r.recordType === 'Sao lục' || 
                                         r.recordType === 'Công văn' ||
                                         r.recordType === '1.2 Công văn';
                        
                        let extraUpdates: any = {};
                        if (isRegType(r.recordType)) {
                            const helper = getGcnWorkflowStepsHelper(r, holidays || []);
                            let currentStepIndex = r.currentStepIndex;
                            if (currentStepIndex === undefined || currentStepIndex === null || currentStepIndex >= helper.steps.length) {
                                currentStepIndex = helper.currentStepIndex;
                            }
                            extraUpdates.currentStepIndex = currentStepIndex + 1;

                            // Save step assignees history
                            const stepAssignees = { ...(r.stepAssignees || {}) };
                            const currentStep = helper.steps[currentStepIndex];
                            if (currentStep) {
                                stepAssignees[currentStep.label.toLowerCase().trim()] = r.checkedBy || currentUser?.employeeId || "";
                            }
                            const nextStep = helper.steps[currentStepIndex + 1];
                            if (nextStep) {
                                stepAssignees[nextStep.label.toLowerCase().trim()] = directorId;
                            }
                            extraUpdates.stepAssignees = stepAssignees;
                        }

                        if (isLuuTru) {
                            const responsibleId = r.assignedTo || currentUser?.employeeId || null;
                            return {
                                ...r,
                                ...extraUpdates,
                                status: RecordStatus.PENDING_SIGN,
                                completedWorkDate: r.completedWorkDate || nowStr,
                                pendingCheckDate: r.pendingCheckDate || nowStr,
                                checkedDate: r.checkedDate || nowStr,
                                checkedBy: r.checkedBy || responsibleId,
                                submissionDate: nowStr,
                                submittedTo: directorId
                            };
                        } else {
                            return {
                                ...r,
                                ...extraUpdates,
                                status: RecordStatus.PENDING_SIGN,
                                checkedDate: r.checkedDate || nowStr,
                                checkedBy: r.checkedBy || currentUser?.employeeId || null,
                                submissionDate: nowStr,
                                submittedTo: directorId
                            };
                        }
                    });
                    await updateRecordsBatchById(updates);
                    setToast({ type: 'success', message: `Đã trình ký ${updates.length} hồ sơ thành công!` });
                    setIsSubmitModalOpen(false);
                    setSubmitTargetRecords([]);
                    setSelectedRecordIds(new Set());
                    loadData();
                } catch (error) {
                    console.error("Lỗi khi trình ký:", error);
                    setToast({ type: 'error', message: 'Có lỗi xảy ra khi trình ký.' });
                }
            }}
        />

        <SubmitModal 
            isOpen={isSubmitCheckModalOpen}
            onClose={() => setIsSubmitCheckModalOpen(false)}
            records={submitTargetRecords}
            users={users}
            employees={employees}
            isCheckMode={true}
            currentUser={currentUser || undefined}
            onConfirm={async (checkerId) => {
                try {
                    const nowStr = new Date().toISOString();
                    const updates = submitTargetRecords.map(r => {
                        let extraUpdates: any = {};
                        if (isRegType(r.recordType)) {
                            const helper = getGcnWorkflowStepsHelper(r, holidays || []);
                            let currentStepIndex = r.currentStepIndex;
                            if (currentStepIndex === undefined || currentStepIndex === null || currentStepIndex >= helper.steps.length) {
                                currentStepIndex = helper.currentStepIndex;
                            }
                            extraUpdates.currentStepIndex = currentStepIndex + 1;

                            // Save step assignees history
                            const stepAssignees = { ...(r.stepAssignees || {}) };
                            const currentStep = helper.steps[currentStepIndex];
                            if (currentStep) {
                                stepAssignees[currentStep.label.toLowerCase().trim()] = r.assignedTo || currentUser?.employeeId || "";
                            }
                            const nextStep = helper.steps[currentStepIndex + 1];
                            if (nextStep) {
                                stepAssignees[nextStep.label.toLowerCase().trim()] = checkerId;
                            }
                            extraUpdates.stepAssignees = stepAssignees;
                        }
                        return {
                            ...r,
                            ...extraUpdates,
                            status: RecordStatus.PENDING_CHECK,
                            completedWorkDate: r.completedWorkDate || nowStr,
                            pendingCheckDate: nowStr,
                            checkedBy: checkerId
                        };
                    });
                    await updateRecordsBatchById(updates);
                    setToast({ type: 'success', message: `Đã trình kiểm tra ${updates.length} hồ sơ thành công!` });
                    setIsSubmitCheckModalOpen(false);
                    setSubmitTargetRecords([]);
                    setSelectedRecordIds(new Set());
                    loadData();
                } catch (error) {
                    console.error("Lỗi khi trình kiểm tra:", error);
                    setToast({ type: 'error', message: 'Có lỗi xảy ra khi trình kiểm tra.' });
                }
            }}
        />

        <RejectReasonModal
            isOpen={isRejectReasonModalOpen}
            onClose={() => { setIsRejectReasonModalOpen(false); setRejectRecordsTarget([]); }}
            record={rejectRecordsTarget}
            onConfirm={(reason) => handleConfirmRejectRecords(rejectRecordsTarget, reason)}
        />

        <AssignNextStepModal
            isOpen={isAssignNextStepModalOpen}
            onClose={() => {
                setIsAssignNextStepModalOpen(false);
                setAssignNextStepTargetRecord(null);
                setAssignNextStepLabel('');
            }}
            employees={employees}
            record={assignNextStepTargetRecord}
            nextStepLabel={assignNextStepLabel}
            onConfirm={async (employeeId) => {
                if (!assignNextStepTargetRecord) return;
                const nowStr = new Date().toISOString();
                try {
                    const helper = getGcnWorkflowStepsHelper(assignNextStepTargetRecord, holidays || []);
                    const stepConfigs = helper.steps;
                    let currentIdx = assignNextStepTargetRecord.currentStepIndex;
                    if (currentIdx === undefined || currentIdx === null || currentIdx >= stepConfigs.length) {
                        currentIdx = helper.currentStepIndex;
                    }
                    const currentStep = stepConfigs[currentIdx];
                    const nextIdx = currentIdx + 1;
                    const nextStep = stepConfigs[nextIdx];

                    const stepAssignees = { ...(assignNextStepTargetRecord.stepAssignees || {}) };
                    if (assignNextStepTargetRecord.assignedTo && currentStep) {
                        stepAssignees[currentStep.label.toLowerCase().trim()] = assignNextStepTargetRecord.assignedTo;
                    }
                    if (nextStep) {
                        stepAssignees[nextStep.label.toLowerCase().trim()] = employeeId;
                    }

                    const updates: any = {
                        currentStepIndex: nextIdx,
                        status: nextStep.overallStatus,
                        stepAssignees,
                        assignedTo: employeeId
                    };

                    if (nextStep.overallStatus === RecordStatus.PENDING_SIGN || nextStep.label.toLowerCase().includes("trình ký") || nextStep.label.toLowerCase().includes("ký duyệt")) {
                        updates.submittedTo = employeeId;
                        if (!assignNextStepTargetRecord.submissionDate) {
                            updates.submissionDate = nowStr;
                        }
                    }

                    if (nextStep.overallStatus === RecordStatus.PENDING_CHECK || nextStep.label.toLowerCase().includes("trình kiểm tra") || nextStep.label.toLowerCase().includes("thẩm tra")) {
                        if (!assignNextStepTargetRecord.pendingCheckDate) {
                            updates.pendingCheckDate = nowStr;
                        }
                        updates.checkedBy = employeeId;
                    }

                    if (nextStep.overallStatus === RecordStatus.IN_PROGRESS && !assignNextStepTargetRecord.assignedDate) {
                        updates.assignedDate = nowStr;
                    }
                    if (nextStep.overallStatus === RecordStatus.COMPLETED_WORK && !assignNextStepTargetRecord.completedWorkDate) {
                        updates.completedWorkDate = nowStr;
                    }
                    if (nextStep.overallStatus === RecordStatus.CHECKED) {
                        updates.checkedDate = nowStr;
                        updates.checkedBy = assignNextStepTargetRecord.checkedBy || currentUser?.employeeId || null;
                    }
                    if (nextStep.overallStatus === RecordStatus.SIGNED && !assignNextStepTargetRecord.approvalDate) {
                        updates.approvalDate = nowStr;
                    }
                    if (nextStep.overallStatus === RecordStatus.HANDOVER && !assignNextStepTargetRecord.completedDate) {
                        updates.completedDate = nowStr;
                    }

                    const merged = { ...assignNextStepTargetRecord, ...updates };
                    const withHistory = recordStepAssigneeHistory(merged, holidays || []);
                    setRecords(prev => prev.map(r => r.id === assignNextStepTargetRecord.id ? withHistory : r));
                    await updateRecordApi(withHistory);
                    setToast({ type: 'success', message: `Đã chuyển hồ sơ sang bước: ${nextStep.label} và giao cho ${employees.find(e => e.id === employeeId)?.name}` });
                    setIsAssignNextStepModalOpen(false);
                    setAssignNextStepTargetRecord(null);
                    setAssignNextStepLabel('');
                    loadData();
                } catch (error) {
                    console.error("Lỗi khi chuyển bước với nhân viên thụ lý:", error);
                    setToast({ type: 'error', message: 'Có lỗi xảy ra khi chuyển bước.' });
                }
            }}
        />

        {toast && (
            <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-xl text-white font-bold animate-fade-in-up z-50 flex items-center justify-between gap-4 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                <div className="flex items-center gap-2">
                    {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                    <span>{toast.message}</span>
                </div>
                <button 
                    onClick={() => setToast(null)} 
                    className="text-white hover:text-gray-200 transition-colors focus:outline-none p-1 rounded-full hover:bg-white/10 cursor-pointer"
                    aria-label="Close toast"
                >
                    <X size={16} />
                </button>
            </div>
        )}
        {renderGcnWorkflowModals()}
        <GlobalConfirmModal />
        <GlobalAlertModal />
    </MainLayout>
  );
}

export default App;

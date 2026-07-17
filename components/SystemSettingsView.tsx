
import React, { useState, useEffect } from 'react';
import { Database, AlertTriangle, Cloud, Loader2, CheckCircle, Save, Globe, Calendar, Plus, Trash2, ShieldAlert, Key, Compass, FolderOpen, Award, FileCheck, Users, Clock, Timer, RefreshCw, Sliders, ChevronRight, HelpCircle, X, Copy, Download, Upload } from 'lucide-react';
import { Holiday, UserRole, RolePermissions, DepartmentPermissions, DEFAULT_ROLE_PERMISSIONS, AVAILABLE_PERMISSIONS, Employee, RecordFile, RecordStatus } from '../types';
import { fetchHolidays, saveHolidays, testDatabaseConnection, saveUpdateInfo, fetchUpdateInfo, getSystemSetting, saveSystemSetting } from '../services/api';
import { APP_VERSION } from '../constants';
import { confirmAction, getGcnWorkflowsList, GcnWorkflow } from '../utils/appHelpers';

interface SystemSettingsViewProps {
  onDeleteAllData: () => Promise<boolean>;
  onHolidaysChanged?: () => void;
  employees: Employee[];
  currentUserRole?: UserRole;
  records?: RecordFile[];
  onViewRecord?: (record: RecordFile) => void;
}

const TEAMS_PERM_LIST = [
  { 
    name: 'Tổ Cấp giấy', 
    icon: FileCheck,
    roles: [
      { id: 'Tổ Cấp giấy - Tổ trưởng', label: 'Tổ trưởng', desc: 'Trưởng bộ phận đăng ký, cấp GCN' },
      { id: 'Tổ Cấp giấy - Tổ phó', label: 'Tổ phó', desc: 'Phó bộ phận đăng ký, cấp GCN' },
      { id: 'Tổ Cấp giấy - Nhân viên', label: 'Chuyên viên / Nhân viên', desc: 'Cán bộ thụ lý hồ sơ cấp giấy' }
    ]
  },
  { 
    name: 'Tổ Đo đạc', 
    icon: Compass,
    roles: [
      { id: 'Tổ Đo đạc - Tổ trưởng', label: 'Tổ trưởng', desc: 'Trưởng bộ phận kỹ thuật đo đạc' },
      { id: 'Tổ Đo đạc - Tổ phó', label: 'Tổ phó', desc: 'Phó bộ phận kỹ thuật đo đạc' },
      { id: 'Tổ Đo đạc - Nhân viên', label: 'Chuyên viên / Nhân viên', desc: 'Kỹ thuật viên đo đạc, vẽ bản đồ' }
    ]
  },
  { 
    name: 'Tổ Lưu trữ', 
    icon: FolderOpen,
    roles: [
      { id: 'Tổ Lưu trữ - Tổ trưởng', label: 'Tổ trưởng', desc: 'Trưởng bộ phận khai thác lưu trữ' },
      { id: 'Tổ Lưu trữ - Tổ phó', label: 'Tổ phó', desc: 'Phó bộ phận khai thác lưu trữ' },
      { id: 'Tổ Lưu trữ - Nhân viên', label: 'Chuyên viên / Nhân viên', desc: 'Cán bộ quản lý kho hồ sơ lưu trữ' }
    ]
  },
  { 
    name: 'Tổ Hành chính', 
    icon: Users,
    roles: [
      { id: 'Tổ Hành chính - Tổ trưởng', label: 'Tổ trưởng', desc: 'Trưởng bộ phận Một cửa, văn thư' },
      { id: 'Tổ Hành chính - Tổ phó', label: 'Tổ phó', desc: 'Phó bộ phận Một cửa, văn thư' },
      { id: 'Tổ Hành chính - Nhân viên', label: 'Chuyên viên / Nhân viên', desc: 'Cán bộ Tiếp nhận & Trả kết quả' }
    ]
  },
  { 
    name: 'Ban Giám đốc', 
    icon: Award,
    roles: [
      { id: 'Ban Giám đốc - Giám đốc/Lãnh đạo', label: 'Giám đốc / Trưởng ban', desc: 'Người đứng đầu cơ quan, phê duyệt cấp cao' },
      { id: 'Ban Giám đốc - Tổ phó', label: 'Phó Giám đốc / Lãnh đạo phó', desc: 'Phó chỉ huy cơ quan, kiểm tra chất lượng' },
      { id: 'Ban Giám đốc - Nhân viên', label: 'Chuyên viên tổng hợp', desc: 'Cán bộ giúp việc Ban Giám đốc' }
    ]
  }
];

const TEAM_ALLOWED_PERMISSIONS: Record<string, string[]> = {
  'Tổ Cấp giấy': [
    'VIEW_RECORDS', 'ADD_RECORDS', 'EDIT_RECORDS', 'DELETE_RECORDS', 'RESTORE_RECORDS', 
    'ASSIGN_RECORDS', 'WITHDRAW_RECORDS', 'IMPORT_RECORDS', 'EXPORT_RECORDS',
    'CHECK_RECORDS', 'SIGN_RECORDS', 'UPDATE_WARD_MANAGEMENT',
    'HANDOVER_RECORDS', 'RETURN_RECORDS', 'PRINT_HANDOVER_REPORTS',
    'VIEW_EXCERPTS', 'MANAGE_EXCERPTS', 'APPROVE_EXCERPTS', 
    'VIEW_ARCHIVE', 
    'VIEW_REPORTS', 'TRACK_KPI', 'EXPORT_REPORTS',
    'VIEW_CHAT', 'MANAGE_CHAT', 'VIEW_SCHEDULE', 'MANAGE_SCHEDULE', 'VIEW_PERSONAL_PROFILE'
  ],
  'Tổ Đo đạc': [
    'VIEW_RECORDS', 'ADD_RECORDS', 'EDIT_RECORDS', 'DELETE_RECORDS', 'RESTORE_RECORDS', 
    'ASSIGN_RECORDS', 'WITHDRAW_RECORDS', 'IMPORT_RECORDS', 'EXPORT_RECORDS',
    'SURVEY_RECORDS', 'DRAW_RECORDS', 'CHECK_RECORDS', 'SIGN_RECORDS', 'UPDATE_WARD_MANAGEMENT',
    'VIEW_CONTRACTS', 'ADD_CONTRACTS', 'EDIT_CONTRACTS', 'SIGN_CONTRACTS', 'DELETE_CONTRACTS', 'EXPORT_CONTRACTS',
    'VIEW_EXCERPTS', 'MANAGE_EXCERPTS', 'APPROVE_EXCERPTS',
    'VIEW_ARCHIVE',
    'VIEW_REPORTS', 'TRACK_KPI', 'EXPORT_REPORTS',
    'VIEW_CHAT', 'MANAGE_CHAT', 'VIEW_SCHEDULE', 'MANAGE_SCHEDULE', 'VIEW_PERSONAL_PROFILE'
  ],
  'Tổ Lưu trữ': [
    'VIEW_RECORDS', 'ADD_RECORDS', 'EDIT_RECORDS', 'DELETE_RECORDS', 'RESTORE_RECORDS', 
    'ASSIGN_RECORDS', 'WITHDRAW_RECORDS', 'IMPORT_RECORDS', 'EXPORT_RECORDS',
    'VIEW_ARCHIVE', 'MANAGE_ARCHIVE',
    'VIEW_REPORTS',
    'VIEW_CHAT', 'MANAGE_CHAT', 'VIEW_SCHEDULE', 'VIEW_PERSONAL_PROFILE'
  ],
  'Tổ Hành chính': [
    'VIEW_RECORDS', 'ADD_RECORDS', 'EDIT_RECORDS', 'EXPORT_RECORDS',
    'HANDOVER_RECORDS', 'RETURN_RECORDS', 'PRINT_HANDOVER_REPORTS',
    'VIEW_CONTRACTS', 'ADD_CONTRACTS', 'EDIT_CONTRACTS', 'EXPORT_CONTRACTS',
    'VIEW_EXCERPTS', 'MANAGE_EXCERPTS',
    'VIEW_ARCHIVE',
    'VIEW_REPORTS', 'TRACK_KPI',
    'VIEW_CHAT', 'MANAGE_CHAT', 'VIEW_SCHEDULE', 'MANAGE_SCHEDULE', 'VIEW_PERSONAL_PROFILE'
  ],
  'Ban Giám đốc': [
    'VIEW_RECORDS', 'ASSIGN_RECORDS', 'WITHDRAW_RECORDS', 'EXPORT_RECORDS',
    'CHECK_RECORDS', 'SIGN_RECORDS',
    'VIEW_CONTRACTS', 'SIGN_CONTRACTS', 'EXPORT_CONTRACTS',
    'VIEW_EXCERPTS', 'APPROVE_EXCERPTS',
    'VIEW_ARCHIVE',
    'VIEW_REPORTS', 'TRACK_KPI', 'EXPORT_REPORTS',
    'VIEW_CHAT', 'MANAGE_CHAT', 'VIEW_SCHEDULE', 'MANAGE_SCHEDULE', 'VIEW_PERSONAL_PROFILE',
    'MANAGE_EMPLOYEES', 'SYSTEM_SETTINGS', 'EDIT_SYSTEM_HOLIDAYS', 'VIEW_AUDIT_LOGS'
  ]
};

const GCN_WORKFLOW_DEFAULTS = [
  {
    id: 'quy_trinh_1',
    title: 'Quy trình 1: DNLIS',
    steps: [
      { label: "DNLIS", defaultDuration: "8 giờ" },
      { label: "Phiếu chuyển Thuế", defaultDuration: "16 giờ" },
      { label: "TBT", defaultDuration: "0 giờ" },
      { label: "In GCN", defaultDuration: "5 ngày" },
      { label: "Thẩm tra", defaultDuration: "8 giờ" },
      { label: "Trình ký", defaultDuration: "4 giờ" },
      { label: "Vô số GCN", defaultDuration: "4 giờ" },
      { label: "Đã giao 1 cửa", defaultDuration: "4 giờ" },
      { label: "Đã trả kết quả", defaultDuration: "0 giờ" }
    ]
  },
  {
    id: 'quy_trinh_2',
    title: 'Quy trình 2: Phiếu Chuyển Thuế',
    steps: [
      { label: "DNLIS", defaultDuration: "0 giờ" },
      { label: "Phiếu chuyển Thuế", defaultDuration: "24 giờ" },
      { label: "TBT", defaultDuration: "0 giờ" },
      { label: "In GCN", defaultDuration: "5 ngày" },
      { label: "Thẩm tra", defaultDuration: "8 giờ" },
      { label: "Trình ký", defaultDuration: "4 giờ" },
      { label: "Vô số GCN", defaultDuration: "4 giờ" },
      { label: "Đã giao 1 cửa", defaultDuration: "4 giờ" },
      { label: "Đã trả kết quả", defaultDuration: "0 giờ" }
    ]
  },
  {
    id: 'quy_trinh_3',
    title: 'Quy trình 3: In GCN',
    steps: [
      { label: "In GCN", defaultDuration: "5 ngày" },
      { label: "Thẩm tra", defaultDuration: "8 giờ" },
      { label: "Trình ký", defaultDuration: "4 giờ" },
      { label: "Vô số GCN", defaultDuration: "4 giờ" },
      { label: "Đã giao 1 cửa", defaultDuration: "4 giờ" },
      { label: "Đã trả kết quả", defaultDuration: "0 giờ" }
    ]
  },
  {
    id: 'quy_trinh_4',
    title: 'Quy trình 4: Cấp lại không thuế (Có đối chiếu SMK)',
    steps: [
      { label: "BB Mộc Kê", defaultDuration: "1 ngày" },
      { label: "BB Thế chấp", defaultDuration: "1 ngày" },
      { label: "Niêm yết", defaultDuration: "22 ngày" },
      { label: "In GCN", defaultDuration: "3 ngày" },
      { label: "Thẩm tra", defaultDuration: "2 ngày" },
      { label: "Trình ký", defaultDuration: "1 ngày" },
      { label: "Vô số GCN", defaultDuration: "1 ngày" },
      { label: "Đã giao 1 cửa", defaultDuration: "1 ngày" },
      { label: "Đã trả kết quả", defaultDuration: "0 giờ" }
    ]
  },
  {
    id: 'quy_trinh_5',
    title: 'Quy trình 5: Cấp lại không thuế (Đã đối chiếu SMK)',
    steps: [
      { label: "BB Thế chấp", defaultDuration: "1 ngày" },
      { label: "Niêm yết", defaultDuration: "22 ngày" },
      { label: "In GCN", defaultDuration: "3 ngày" },
      { label: "Thẩm tra", defaultDuration: "2 ngày" },
      { label: "Trình ký", defaultDuration: "1 ngày" },
      { label: "Vô số GCN", defaultDuration: "1 ngày" },
      { label: "Đã giao 1 cửa", defaultDuration: "1 ngày" },
      { label: "Đã trả kết quả", defaultDuration: "0 giờ" }
    ]
  },
  {
    id: 'quy_trinh_6',
    title: 'Quy trình 6: Cấp lại có thuế (Có đối chiếu SMK)',
    steps: [
      { label: "BB Mộc Kê", defaultDuration: "1 ngày" },
      { label: "BB Thế chấp", defaultDuration: "1 ngày" },
      { label: "Niêm yết", defaultDuration: "22 ngày" },
      { label: "Phiếu chuyển Thuế", defaultDuration: "2 ngày" },
      { label: "TBT", defaultDuration: "---" },
      { label: "In GCN", defaultDuration: "3 ngày" },
      { label: "Thẩm tra", defaultDuration: "2 ngày" },
      { label: "Trình ký", defaultDuration: "1 ngày" },
      { label: "Vô số GCN", defaultDuration: "1 ngày" },
      { label: "Đã giao 1 cửa", defaultDuration: "1 ngày" },
      { label: "Đã trả kết quả", defaultDuration: "0 giờ" }
    ]
  },
  {
    id: 'quy_trinh_7',
    title: 'Quy trình 7: Cấp lại có thuế (Đã đối chiếu SMK)',
    steps: [
      { label: "BB Thế chấp", defaultDuration: "1 ngày" },
      { label: "Niêm yết", defaultDuration: "22 ngày" },
      { label: "Phiếu chuyển Thuế", defaultDuration: "2 ngày" },
      { label: "TBT", defaultDuration: "---" },
      { label: "In GCN", defaultDuration: "3 ngày" },
      { label: "Thẩm tra", defaultDuration: "2 ngày" },
      { label: "Trình ký", defaultDuration: "1 ngày" },
      { label: "Vô số GCN", defaultDuration: "1 ngày" },
      { label: "Đã giao 1 cửa", defaultDuration: "1 ngày" },
      { label: "Đã trả kết quả", defaultDuration: "0 giờ" }
    ]
  }
];

const SystemSettingsView: React.FC<SystemSettingsViewProps> = ({ 
  onDeleteAllData,
  onHolidaysChanged,
  employees,
  currentUserRole,
  records = [],
  onViewRecord
}) => {
  const isAdminOrSub = currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.SUBADMIN;
  const [activeTab, setActiveTab] = useState<'general' | 'holidays' | 'permissions' | 'data' | 'sla'>(
      currentUserRole === UserRole.TEAM_LEADER ? 'sla' : 'general'
  );
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [dbTestStatus, setDbTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [dbTestMsg, setDbTestMsg] = useState('');
  
  // Sync Mode States
  const [syncMode, setSyncMode] = useState<'server_pagination' | 'client_full'>(() => {
      if (typeof window !== 'undefined') {
          return (localStorage.getItem('data_sync_mode') as 'server_pagination' | 'client_full') || 'server_pagination';
      }
      return 'server_pagination';
  });

  const handleSaveSyncMode = (mode: 'server_pagination' | 'client_full') => {
      setSyncMode(mode);
      if (typeof window !== 'undefined') {
          localStorage.setItem('data_sync_mode', mode);
          if (mode === 'server_pagination') {
              localStorage.removeItem('last_sync_records');
          }
          window.location.reload();
      }
  };

  // Update State (Manual Config)
  const [manualVersion, setManualVersion] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [isSavingUpdate, setIsSavingUpdate] = useState(false);

  // Holiday States
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  // Form thêm mới ngày lễ
  const [tempName, setTempName] = useState('');
  const [tempDay, setTempDay] = useState<number>(1);
  const [tempMonth, setTempMonth] = useState<number>(1);
  const [tempIsLunar, setTempIsLunar] = useState(false);
  
  const [savingHolidays, setSavingHolidays] = useState(false);

  // Permissions States
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>(DEFAULT_ROLE_PERMISSIONS);
  const [departmentPermissions, setDepartmentPermissions] = useState<DepartmentPermissions>({});
  const [selectedRole, setSelectedRole] = useState<UserRole | string>(UserRole.SUBADMIN);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [permissionTab, setPermissionTab] = useState<'role' | 'department'>('role');
  const [permissionSearch, setPermissionSearch] = useState('');

  // SLA States
  const [slaConfig, setSlaConfig] = useState<Record<string, Record<string, string>>>({});
  const [selectedSlaWorkflow, setSelectedSlaWorkflow] = useState<string>('quy_trinh_1');
  const [isSavingSla, setIsSavingSla] = useState(false);
  const [allWorkflows, setAllWorkflows] = useState<GcnWorkflow[]>([]);

  // States for adding custom workflow
  const [showAddWorkflowModal, setShowAddWorkflowModal] = useState(false);
  const [newWorkflowTitle, setNewWorkflowTitle] = useState('');
  const [newWorkflowSteps, setNewWorkflowSteps] = useState<Array<{ label: string; duration: string; overallStatus: RecordStatus }>>([
      { label: 'Tiếp nhận', duration: '4 giờ', overallStatus: RecordStatus.RECEIVED }
  ]);

  const loadSlaConfig = () => {
      try {
          const savedSla = localStorage.getItem('sla_config_gcn');
          if (savedSla) {
              setSlaConfig(JSON.parse(savedSla));
          }
          setAllWorkflows(getGcnWorkflowsList());
      } catch (e) {
          console.error("Failed to load sla_config_gcn", e);
      }
  };

  const handleSaveNewWorkflow = async () => {
      if (!newWorkflowTitle.trim()) {
          alert('Vui lòng nhập tên quy trình!');
          return;
      }
      if (newWorkflowSteps.length === 0) {
          alert('Vui lòng thêm ít nhất một bước xử lý!');
          return;
      }
      const newId = `custom_wf_${Date.now()}`;
      const newWf: GcnWorkflow = {
          id: newId,
          title: `Quy trình ${allWorkflows.length + 1}: ${newWorkflowTitle}`,
          steps: newWorkflowSteps
      };

      try {
          const currentCustomStr = localStorage.getItem('gcn_custom_workflows');
          let currentCustom: GcnWorkflow[] = [];
          if (currentCustomStr) {
              currentCustom = JSON.parse(currentCustomStr);
          }
          currentCustom.push(newWf);
          const valStr = JSON.stringify(currentCustom);
          
          localStorage.setItem('gcn_custom_workflows', valStr);
          await saveSystemSetting('gcn_custom_workflows', valStr);

          const updated = getGcnWorkflowsList();
          setAllWorkflows(updated);
          setSelectedSlaWorkflow(newId);

          setShowAddWorkflowModal(false);
          setNewWorkflowTitle('');
          setNewWorkflowSteps([
              { label: 'Tiếp nhận', duration: '4 giờ', overallStatus: RecordStatus.RECEIVED }
          ]);
          alert('Đã thêm quy trình mới thành công!');
          if (onHolidaysChanged) {
              onHolidaysChanged();
          }
      } catch (e) {
          console.error(e);
          alert('Có lỗi xảy ra khi thêm quy trình!');
      }
  };

  const handleDeleteWorkflow = async (workflowId: string, title: string) => {
      if (['quy_trinh_1', 'quy_trinh_2', 'quy_trinh_3', 'quy_trinh_4', 'quy_trinh_5', 'quy_trinh_6', 'quy_trinh_7'].includes(workflowId)) {
          alert('Không thể xóa quy trình mặc định của hệ thống!');
          return;
      }
      const confirmDelete = await confirmAction(`Bạn có chắc chắn muốn xóa "${title}"? Thao tác này không thể hoàn tác.`);
      if (!confirmDelete) return;

      try {
          const currentCustomStr = localStorage.getItem('gcn_custom_workflows');
          let currentCustom: GcnWorkflow[] = [];
          if (currentCustomStr) {
              currentCustom = JSON.parse(currentCustomStr);
          }
          currentCustom = currentCustom.filter(w => w.id !== workflowId);
          const valStr = JSON.stringify(currentCustom);

          localStorage.setItem('gcn_custom_workflows', valStr);
          await saveSystemSetting('gcn_custom_workflows', valStr);

          if (selectedSlaWorkflow === workflowId) {
              setSelectedSlaWorkflow('quy_trinh_1');
          }

          const updated = getGcnWorkflowsList();
          setAllWorkflows(updated);
          alert('Đã xóa quy trình thành công!');
          if (onHolidaysChanged) {
              onHolidaysChanged();
          }
      } catch (e) {
          console.error(e);
          alert('Có lỗi xảy ra khi xóa quy trình!');
      }
  };

  const handleSaveSlaConfig = async (newSlaConfig: Record<string, Record<string, string>>) => {
      setIsSavingSla(true);
      const strVal = JSON.stringify(newSlaConfig);
      const success = await saveSystemSetting('sla_config_gcn', strVal);
      setIsSavingSla(false);
      if (success) {
          localStorage.setItem('sla_config_gcn', strVal);
          setSlaConfig(newSlaConfig);
          alert('Đã lưu cấu hình SLA thành công! Hệ thống cảnh báo sẽ cập nhật thời hạn chính xác hơn.');
          if (onHolidaysChanged) {
              onHolidaysChanged(); // Triggers app-wide data reload to update deadlines
          }
      } else {
          localStorage.setItem('sla_config_gcn', strVal);
          setSlaConfig(newSlaConfig);
          alert('Đã lưu cấu hình SLA tạm thời tại máy (Chế độ Ngoại tuyến).');
          if (onHolidaysChanged) {
              onHolidaysChanged();
          }
      }
  };

  const handleUpdateStepSla = (workflowId: string, stepLabel: string, num: number, unit: string, isDefault: boolean) => {
      setSlaConfig(prev => {
          const next = { ...prev };
          if (!next[workflowId]) next[workflowId] = {};
          
          if (isDefault) {
              delete next[workflowId][stepLabel];
              if (Object.keys(next[workflowId]).length === 0) {
                  delete next[workflowId];
              }
          } else {
              if (unit === '---') {
                  next[workflowId][stepLabel] = '---';
              } else if (unit === '0 giờ') {
                  next[workflowId][stepLabel] = '0 giờ';
              } else {
                  next[workflowId][stepLabel] = `${num} ${unit}`;
              }
          }
          return next;
      });
  };

  useEffect(() => {
      loadHolidays();
      loadUpdateConfig();
      loadPermissions();
      loadSlaConfig();
  }, []);

  const loadPermissions = async () => {
      const savedPerms = await getSystemSetting('role_permissions');
      if (savedPerms) {
          try {
              setRolePermissions(JSON.parse(savedPerms));
          } catch (e) {
              console.error("Failed to parse role_permissions", e);
          }
      }
      const savedDeptPerms = await getSystemSetting('department_permissions');
      if (savedDeptPerms) {
          try {
              setDepartmentPermissions(JSON.parse(savedDeptPerms));
          } catch (e) {
              console.error("Failed to parse department_permissions", e);
          }
      }
  };

  const handleSavePermissions = async () => {
      setIsSavingPermissions(true);
      
      // Sanitize department permissions to strictly follow TEAM_ALLOWED_PERMISSIONS
      const sanitizedDeptPerms: DepartmentPermissions = {};
      Object.keys(departmentPermissions).forEach(deptKey => {
          const teamName = Object.keys(TEAM_ALLOWED_PERMISSIONS).find(team => deptKey.startsWith(team));
          if (teamName) {
              const allowedList = TEAM_ALLOWED_PERMISSIONS[teamName];
              const currentList = departmentPermissions[deptKey] || [];
              sanitizedDeptPerms[deptKey] = currentList.filter(permId => allowedList.includes(permId));
          } else {
              sanitizedDeptPerms[deptKey] = departmentPermissions[deptKey] || [];
          }
      });

      const successRole = await saveSystemSetting('role_permissions', JSON.stringify(rolePermissions));
      const successDept = await saveSystemSetting('department_permissions', JSON.stringify(sanitizedDeptPerms));
      setIsSavingPermissions(false);
      if (successRole && successDept) {
          setDepartmentPermissions(sanitizedDeptPerms);
          alert('Đã lưu cấu hình phân quyền thành công! Cần tải lại trang để áp dụng.');
      } else {
          alert('Lỗi khi lưu cấu hình phân quyền.');
      }
  };

  const togglePermission = (roleOrDept: string, permissionId: string, isRole: boolean) => {
      if (isRole && roleOrDept === UserRole.ADMIN) return; // Cannot edit ADMIN permissions
      
      if (isRole) {
          setRolePermissions(prev => {
              const currentPerms = prev[roleOrDept] || [];
              const newPerms = currentPerms.includes(permissionId)
                  ? currentPerms.filter(p => p !== permissionId)
                  : [...currentPerms, permissionId];
              return { ...prev, [roleOrDept]: newPerms };
          });
      } else {
          const teamName = Object.keys(TEAM_ALLOWED_PERMISSIONS).find(team => roleOrDept.startsWith(team));
          if (teamName && !TEAM_ALLOWED_PERMISSIONS[teamName].includes(permissionId)) {
              return; // Strict prevention: cannot assign other teams' permissions
          }

          setDepartmentPermissions(prev => {
              const currentPerms = prev[roleOrDept] || [];
              const newPerms = currentPerms.includes(permissionId)
                  ? currentPerms.filter(p => p !== permissionId)
                  : [...currentPerms, permissionId];
              return { ...prev, [roleOrDept]: newPerms };
          });
      }
  };

  // Get unique departments from employees
  const departmentMap = new Map<string, string>();
  employees.forEach(e => {
      if (e.department) {
          const trimmed = e.department.trim();
          const lower = trimmed.toLowerCase();
          if (!departmentMap.has(lower)) {
              departmentMap.set(lower, trimmed);
          }
      }
  });
  const departments = Array.from(departmentMap.values());

  const loadHolidays = async () => {
      const data = await fetchHolidays();
      // Nếu data rỗng, hiển thị list mặc định nhưng chưa lưu
      if (data.length === 0) {
          setHolidays([
              { id: '1', name: 'Tết Dương Lịch', day: 1, month: 1, isLunar: false },
              { id: '2', name: 'Giỗ Tổ Hùng Vương', day: 10, month: 3, isLunar: true },
              { id: '3', name: 'Giải phóng Miền Nam', day: 30, month: 4, isLunar: false },
              { id: '4', name: 'Quốc tế Lao động', day: 1, month: 5, isLunar: false },
              { id: '5', name: 'Quốc Khánh', day: 2, month: 9, isLunar: false },
              { id: '6', name: 'Tết Nguyên Đán (Mùng 1)', day: 1, month: 1, isLunar: true },
              { id: '7', name: 'Tết Nguyên Đán (Mùng 2)', day: 2, month: 1, isLunar: true },
              { id: '8', name: 'Tết Nguyên Đán (Mùng 3)', day: 3, month: 1, isLunar: true },
          ]);
      } else {
          setHolidays(data);
      }
  };

  const loadUpdateConfig = async () => {
      const info = await fetchUpdateInfo();
      if (info.version) setManualVersion(info.version);
      else setManualVersion(APP_VERSION); 
      if (info.url) setManualUrl(info.url);
  };

  const handleConfirmDeleteData = async () => {
      if (await confirmAction("CẢNH BÁO: Bạn đang xóa TOÀN BỘ dữ liệu trên Cloud.\nHành động này KHÔNG THỂ khôi phục.\nBạn có chắc chắn muốn tiếp tục không?")) {
          if (await confirmAction("XÁC NHẬN LẦN CUỐI: Dữ liệu sẽ bị mất vĩnh viễn. Nhấn OK để Xóa ngay.")) {
              setIsDeletingData(true);
              await onDeleteAllData();
              setIsDeletingData(false);
          }
      }
  };

  const handleTestDatabase = async () => {
      setDbTestStatus('testing');
      setDbTestMsg('Đang kết nối...');
      const result = await testDatabaseConnection();
      setDbTestStatus(result.status === 'SUCCESS' ? 'success' : 'error');
      setDbTestMsg(result.message);
  };

  const handleSaveUpdateConfig = async () => {
      if (!manualVersion.trim()) {
          alert("Vui lòng nhập số phiên bản.");
          return;
      }
      setIsSavingUpdate(true);
      const success = await saveUpdateInfo(manualVersion.trim(), manualUrl.trim());
      setIsSavingUpdate(false);
      if (success) {
          alert(`Đã phát hành phiên bản ${manualVersion}!\nTất cả người dùng sẽ nhận được thông báo cập nhật sau vài giây.`);
      } else {
          alert("Lỗi khi lưu cấu hình cập nhật. Vui lòng thử lại.");
      }
  };

  // --- HOLIDAY HANDLERS ---
  const handleAddHoliday = () => {
      if (!tempName.trim()) { alert("Vui lòng nhập tên ngày lễ"); return; }
      if (tempDay < 1 || tempDay > 31 || tempMonth < 1 || tempMonth > 12) { alert("Ngày tháng không hợp lệ"); return; }

      const newId = Math.random().toString(36).substr(2, 9);
      const newHoliday: Holiday = {
          id: newId,
          name: tempName,
          day: tempDay,
          month: tempMonth,
          isLunar: tempIsLunar
      };

      setHolidays(prev => [...prev, newHoliday]);
      // Reset form
      setTempName('');
      setTempDay(1);
      setTempMonth(1);
      setTempIsLunar(false);
  };

  const handleDeleteHoliday = async (id: string) => {
      if(await confirmAction("Xóa ngày lễ này?")) {
          setHolidays(prev => prev.filter(h => h.id !== id));
      }
  };

  const handleSaveHolidays = async () => {
      setSavingHolidays(true);
      const success = await saveHolidays(holidays);
      setSavingHolidays(false);
      if (success) {
          alert('Đã lưu danh sách ngày lễ thành công!');
          // Trigger refresh data ở App cha
          if (onHolidaysChanged) onHolidaysChanged();
      }
      else alert('Lỗi khi lưu ngày lễ.');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col flex-1 h-full animate-fade-in-up">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50 shrink-0">
            <h2 className="text-lg font-black text-gray-800 flex items-center gap-2 tracking-tight">
                <ShieldAlert className="text-red-600" size={20} />
                Cấu hình Hệ thống (Admin)
            </h2>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-2 overflow-x-auto no-scrollbar shrink-0">
            {isAdminOrSub && (
                <button 
                    onClick={() => setActiveTab('general')}
                    className={`px-4 py-3 text-xs md:text-sm font-black uppercase tracking-widest flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'general' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                    <Database size={16} /> Chung
                </button>
            )}
            {isAdminOrSub && (
                <button 
                    onClick={() => setActiveTab('holidays')}
                    className={`px-4 py-3 text-xs md:text-sm font-black uppercase tracking-widest flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'holidays' ? 'border-orange-600 text-orange-700 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                    <Calendar size={16} /> Ngày nghỉ lễ
                </button>
            )}
            {isAdminOrSub && (
                <button 
                    onClick={() => setActiveTab('permissions')}
                    className={`px-4 py-3 text-xs md:text-sm font-black uppercase tracking-widest flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'permissions' ? 'border-purple-600 text-purple-700 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                    <Key size={16} /> Phân quyền
                </button>
            )}
            <button 
                onClick={() => setActiveTab('sla')}
                className={`px-4 py-3 text-xs md:text-sm font-black uppercase tracking-widest flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'sla' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
                <Clock size={16} /> Cấu hình SLA
            </button>
            {isAdminOrSub && (
                <button 
                    onClick={() => setActiveTab('data')}
                    className={`px-4 py-3 text-xs md:text-sm font-black uppercase tracking-widest flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'data' ? 'border-red-600 text-red-700 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                    <AlertTriangle size={16} /> Dữ liệu
                </button>
            )}
        </div>

        <div className="p-4 md:p-6 overflow-y-auto flex-1 bg-slate-50/30">
            {activeTab === 'general' && (
                <div className="space-y-6 max-w-4xl mx-auto">
                    {/* Cloud Database Info */}
                    <div className="bg-white border border-blue-100 rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
                        <div className="text-center md:text-left">
                            <h3 className="font-black text-blue-800 flex items-center justify-center md:justify-start gap-2 mb-1 tracking-tight"> <Database size={18} /> Cloud Database </h3>
                            <p className="text-xs text-blue-600 font-medium">Kiểm tra kết nối đến cơ sở dữ liệu Supabase.</p>
                        </div>
                        <div className="flex flex-col items-center gap-3 w-full md:w-auto">
                            {dbTestStatus === 'success' && <div className="text-xs font-black text-green-600 flex items-center gap-1 uppercase tracking-wider"><CheckCircle size={16} /> Kết nối OK!</div>}
                            {dbTestStatus === 'error' && <div className="text-xs font-black text-red-600 uppercase tracking-wider">{dbTestMsg || 'Lỗi!'}</div>}
                            <button onClick={handleTestDatabase} disabled={dbTestStatus === 'testing'} className="w-full md:w-auto px-6 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 font-medium text-sm rounded-xl hover:bg-blue-100 transition-colors shadow-sm flex items-center justify-center gap-2"> 
                                {dbTestStatus === 'testing' ? <Loader2 className="animate-spin" size={16} /> : 'Kiểm tra kết nối'} 
                            </button>
                        </div>
                    </div>

                    {/* Sync Mode Configuration */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                        <h3 className="font-black text-gray-700 flex items-center gap-2 mb-3 tracking-tight">
                            <RefreshCw size={18} className="text-blue-500" /> Chế độ đồng bộ & Tải dữ liệu hồ sơ
                        </h3>
                        <p className="text-xs text-gray-500 mb-5 leading-relaxed font-medium">
                            Chọn phương thức tải dữ liệu phù hợp với hiệu năng máy tính của bạn. "Phân trang phía Server" tối ưu tốc độ cho máy cấu hình yếu, tránh bị chậm lag khi cơ sở dữ liệu có hàng ngàn hồ sơ.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div 
                                onClick={() => handleSaveSyncMode('server_pagination')}
                                className={`border rounded-2xl p-5 flex items-start gap-4 cursor-pointer transition-all ${syncMode === 'server_pagination' ? 'border-blue-500 bg-blue-50/10 ring-2 ring-blue-500/10' : 'border-gray-200 hover:border-blue-300 hover:bg-slate-50/50'}`}
                            >
                                <input 
                                    type="radio" 
                                    name="syncMode" 
                                    value="server_pagination" 
                                    checked={syncMode === 'server_pagination'} 
                                    onChange={() => handleSaveSyncMode('server_pagination')}
                                    className="mt-1 text-blue-600 focus:ring-blue-500 h-4 w-4 shrink-0" 
                                />
                                <div>
                                    <span className="text-sm font-black block text-gray-800 tracking-tight">Phân trang phía Server (Tốc độ tối đa, khuyên dùng)</span>
                                    <span className="text-[11px] text-gray-500 block mt-2 leading-relaxed">Chỉ tải dữ liệu của trang hiện tại từ Cloud. Các thao tác tìm kiếm, lọc, sắp xếp được thực hiện trực tiếp trên Server. Khởi động ứng dụng tức thì, không hao bộ nhớ RAM.</span>
                                </div>
                            </div>

                            <div 
                                onClick={() => handleSaveSyncMode('client_full')}
                                className={`border rounded-2xl p-5 flex items-start gap-4 cursor-pointer transition-all ${syncMode === 'client_full' ? 'border-blue-500 bg-blue-50/10 ring-2 ring-blue-500/10' : 'border-gray-200 hover:border-blue-300 hover:bg-slate-50/50'}`}
                            >
                                <input 
                                    type="radio" 
                                    name="syncMode" 
                                    value="client_full" 
                                    checked={syncMode === 'client_full'} 
                                    onChange={() => handleSaveSyncMode('client_full')}
                                    className="mt-1 text-blue-600 focus:ring-blue-500 h-4 w-4 shrink-0" 
                                />
                                <div>
                                    <span className="text-sm font-black block text-gray-800 tracking-tight">Đồng bộ lưu Cache ngoại tuyến (Offline Sync)</span>
                                    <span className="text-[11px] text-gray-500 block mt-2 leading-relaxed">Tải tăng dần (Incremental Sync) và lưu toàn bộ hồ sơ đất đai về bộ nhớ IndexedDB của trình duyệt. Tra cứu cực nhanh ngay cả khi không có kết nối mạng LAN/Internet.</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Manual Update Config */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                        <h3 className="font-black text-gray-700 flex items-center gap-2 mb-6 tracking-tight">
                            <Cloud size={18} className="text-purple-500" /> Cập nhật phiên bản
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-500 mb-2">Phiên bản Mới nhất</label>
                                <input type="text" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-black text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="VD: 1.6.0" value={manualVersion} onChange={(e) => setManualVersion(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-500 mb-2">Link tải (Drive / Web)</label>
                                <div className="relative">
                                    <Globe size={16} className="absolute left-4 top-3.5 text-gray-400" />
                                    <input type="text" className="w-full border border-gray-200 rounded-xl px-4 py-3 pl-11 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="https://..." value={manualUrl} onChange={(e) => setManualUrl(e.target.value)} />
                                </div>
                            </div>
                        </div>
                        <div className="mt-8 flex justify-end">
                            <button onClick={handleSaveUpdateConfig} disabled={isSavingUpdate} className="w-full md:w-auto flex items-center justify-center gap-2 bg-slate-800 text-white px-8 py-3 rounded-xl hover:bg-slate-900 text-sm font-medium shadow-lg transition-all active:scale-95">
                                {isSavingUpdate ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Phát hành phiên bản
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'holidays' && (
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="bg-white border border-orange-100 rounded-2xl p-5 shadow-sm">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                            <div>
                                <h3 className="font-black text-orange-800 flex items-center gap-2 tracking-tight">
                                    <Calendar size={18} /> Cấu hình Ngày nghỉ lễ
                                </h3>
                                <p className="text-[11px] text-orange-600 mt-1 font-medium">
                                    Ngày nghỉ lễ sẽ không được tính vào thời gian hẹn trả kết quả.
                                </p>
                            </div>
                            <button 
                                onClick={handleSaveHolidays} 
                                disabled={savingHolidays}
                                className="w-full md:w-auto bg-orange-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-orange-700 flex items-center justify-center gap-2 shadow-lg shadow-orange-100 transition-all active:scale-95"
                            >
                                {savingHolidays ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Lưu cấu hình
                            </button>
                        </div>

                        {/* Form thêm mới */}
                        <div className="flex flex-col gap-4 mb-8 bg-orange-50/50 p-5 rounded-2xl border border-orange-100">
                            <p className="text-sm font-medium text-orange-800 mb-1">Thêm ngày lễ mới</p>
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                                <div className="sm:col-span-6">
                                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Tên ngày lễ</label>
                                    <input type="text" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all" placeholder="VD: Giỗ tổ" value={tempName} onChange={e => setTempName(e.target.value)} />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Ngày</label>
                                    <input type="number" min="1" max="31" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center font-bold text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all" value={tempDay} onChange={e => setTempDay(parseInt(e.target.value))} />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Tháng</label>
                                    <input type="number" min="1" max="12" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center font-bold text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all" value={tempMonth} onChange={e => setTempMonth(parseInt(e.target.value))} />
                                </div>
                                <div className="sm:col-span-2 flex items-end">
                                    <label className="flex items-center cursor-pointer select-none bg-white border border-gray-200 rounded-xl px-3 py-2.5 w-full justify-center hover:bg-gray-50 transition-colors">
                                        <input type="checkbox" className="mr-2 w-4 h-4 text-orange-600 rounded focus:ring-orange-500" checked={tempIsLunar} onChange={e => setTempIsLunar(e.target.checked)} />
                                        <span className="text-xs text-gray-700 font-black uppercase tracking-wider">Âm</span>
                                    </label>
                                </div>
                            </div>
                            <button onClick={handleAddHoliday} className="w-full bg-green-600 text-white px-4 py-3 rounded-xl text-sm font-medium hover:bg-green-700 flex items-center justify-center gap-2 shadow-md transition-all active:scale-95">
                                <Plus size={16} /> Thêm vào danh sách
                            </button>
                        </div>

                        {/* Danh sách - Desktop Table */}
                        <div className="hidden md:block border border-gray-100 rounded-2xl bg-white overflow-hidden shadow-sm">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-orange-50 text-orange-800 text-sm font-medium uppercase">
                                    <tr>
                                        <th className="p-4">Tên ngày lễ</th>
                                        <th className="p-4 text-center">Ngày/Tháng</th>
                                        <th className="p-4 text-center">Loại lịch</th>
                                        <th className="p-4 text-center w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {holidays.map(h => (
                                        <tr key={h.id} className="hover:bg-orange-50/30 transition-colors">
                                            <td className="p-4 font-bold text-slate-700">{h.name}</td>
                                            <td className="p-4 text-center font-black text-slate-600">{h.day}/{h.month}</td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider border ${h.isLunar ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                                    {h.isLunar ? 'Âm lịch' : 'Dương lịch'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <button onClick={() => handleDeleteHoliday(h.id)} className="text-red-400 hover:text-red-600 p-2 rounded-xl hover:bg-red-50 transition-colors"><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {holidays.length === 0 && (
                                        <tr><td colSpan={4} className="p-8 text-center text-gray-400 italic font-medium">Chưa có dữ liệu ngày lễ</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Danh sách - Mobile Cards */}
                        <div className="md:hidden space-y-3">
                            {holidays.map(h => (
                                <div key={h.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <h4 className="font-black text-slate-800 text-sm truncate tracking-tight">{h.name}</h4>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-xs font-black text-slate-500">{h.day}/{h.month}</span>
                                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${h.isLunar ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                                {h.isLunar ? 'Âm' : 'Dương'}
                                            </span>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDeleteHoliday(h.id)} className="text-red-400 hover:text-red-600 p-3 rounded-xl hover:bg-red-50 transition-colors shrink-0">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                            {holidays.length === 0 && (
                                <div className="p-8 text-center text-gray-400 italic font-medium">Chưa có dữ liệu ngày lễ</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'permissions' && (
                <div className="space-y-6 w-full max-w-7xl mx-auto animate-fade-in-up">
                    <div className="bg-white border border-purple-100 rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
                        <div className="text-center md:text-left">
                            <h3 className="font-black text-purple-800 flex items-center justify-center md:justify-start gap-2 mb-1 tracking-tight"> <Key size={18} /> Phân quyền hệ thống </h3>
                            <p className="text-xs text-purple-600 font-medium font-bold">Cấu hình chi tiết quyền hạn tác vụ của từng Phòng ban và Vai trò người dùng.</p>
                        </div>
                        <button 
                            onClick={handleSavePermissions}
                            disabled={isSavingPermissions}
                            className="w-full md:w-auto px-6 py-2.5 bg-purple-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-purple-700 transition-all shadow-md shadow-purple-100 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                        >
                            {isSavingPermissions ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                            Lưu phân quyền
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm min-h-[500px]">
                        {/* LEFT COLUMN: Sidebar Navigation */}
                        <div className="lg:col-span-4 border-r border-gray-200 flex flex-col bg-gray-50/50">
                            {/* Toggle Header */}
                            <div className="flex border-b border-gray-200 bg-gray-100 p-1.5 gap-1 shrink-0">
                                <button
                                    onClick={() => { 
                                        setPermissionTab('role'); 
                                        setSelectedRole(UserRole.SUBADMIN); 
                                        setPermissionSearch('');
                                    }}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                                        permissionTab === 'role' 
                                            ? 'bg-white text-purple-700 shadow-sm' 
                                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                    }`}
                                >
                                    Theo Vai trò
                                </button>
                                <button
                                    onClick={() => { 
                                        setPermissionTab('department'); 
                                        setSelectedRole('Tổ Cấp giấy - Tổ trưởng'); 
                                        setPermissionSearch('');
                                    }}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                                        permissionTab === 'department' 
                                            ? 'bg-white text-purple-700 shadow-sm' 
                                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                    }`}
                                >
                                    Theo Tổ & Vai trò
                                </button>
                            </div>

                            {/* Search Box */}
                            <div className="p-3 border-b border-gray-200 bg-white shrink-0">
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        placeholder={permissionTab === 'role' ? "Tìm kiếm vai trò..." : "Tìm kiếm tổ/chức danh..."}
                                        className="w-full border border-gray-250 rounded-xl px-3 py-2 pl-9 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all bg-gray-50/50 hover:bg-white"
                                        value={permissionSearch}
                                        onChange={(e) => setPermissionSearch(e.target.value)}
                                    />
                                    <svg className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                            </div>

                            {/* Options List */}
                            <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-[500px] lg:max-h-[650px]">
                                {permissionTab === 'role' ? (
                                    Object.values(UserRole)
                                        .filter(r => r !== UserRole.ADMIN)
                                        .filter(r => !permissionSearch || r.toLowerCase().includes(permissionSearch.toLowerCase()))
                                        .map(role => {
                                            const activeCount = rolePermissions[role]?.includes('*') 
                                                ? AVAILABLE_PERMISSIONS.length 
                                                : (rolePermissions[role] || []).length;
                                            const isSelected = selectedRole === role;
                                            return (
                                                <button
                                                    key={role}
                                                    onClick={() => setSelectedRole(role)}
                                                    className={`w-full text-left px-3.5 py-3 rounded-xl flex items-center justify-between transition-all ${
                                                        isSelected 
                                                            ? 'bg-purple-600 text-white shadow-md font-bold' 
                                                            : 'bg-transparent text-gray-700 hover:bg-purple-50 hover:text-purple-700'
                                                    }`}
                                                >
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-xs font-black uppercase tracking-wider truncate">{role}</span>
                                                        <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-purple-100' : 'text-gray-400'}`}>
                                                            Vai trò tài khoản
                                                        </span>
                                                    </div>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                        isSelected ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-600'
                                                    }`}>
                                                        {activeCount}/{AVAILABLE_PERMISSIONS.length}
                                                    </span>
                                                </button>
                                            );
                                        })
                                ) : (
                                    <div className="space-y-4 p-1">
                                        {TEAMS_PERM_LIST
                                            .filter(t => !permissionSearch || t.name.toLowerCase().includes(permissionSearch.toLowerCase()) || t.roles.some(r => r.label.toLowerCase().includes(permissionSearch.toLowerCase()) || r.id.toLowerCase().includes(permissionSearch.toLowerCase())))
                                            .map(team => {
                                                const TeamIcon = team.icon;
                                                return (
                                                    <div key={team.name} className="border border-slate-100 rounded-xl bg-slate-50/40 p-2 space-y-2">
                                                        <div className="flex items-center gap-2 px-1 text-[11px] font-black uppercase text-purple-900 tracking-wider">
                                                            <div className="bg-purple-100 p-1 rounded text-purple-700 shrink-0">
                                                                <TeamIcon size={12} />
                                                            </div>
                                                            <span>{team.name}</span>
                                                        </div>
                                                        
                                                        <div className="space-y-1 pl-1">
                                                            {team.roles.map(r => {
                                                                const isSelected = selectedRole === r.id;
                                                                const teamName = Object.keys(TEAM_ALLOWED_PERMISSIONS).find(t => r.id.startsWith(t));
                                                                const totalCount = teamName ? TEAM_ALLOWED_PERMISSIONS[teamName].length : AVAILABLE_PERMISSIONS.length;
                                                                const activeCount = departmentPermissions[r.id]?.includes('*') 
                                                                    ? totalCount 
                                                                    : (departmentPermissions[r.id] || []).filter(id => teamName ? TEAM_ALLOWED_PERMISSIONS[teamName].includes(id) : true).length;
                                                                
                                                                return (
                                                                    <button
                                                                        key={r.id}
                                                                        onClick={() => setSelectedRole(r.id)}
                                                                        className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-all ${
                                                                            isSelected 
                                                                                ? 'bg-purple-600 text-white shadow-sm font-bold scale-[1.01]' 
                                                                                : 'bg-white hover:bg-purple-50 text-slate-700 border border-slate-100 hover:text-purple-700'
                                                                        }`}
                                                                    >
                                                                        <div className="flex flex-col min-w-0 pr-2">
                                                                            <span className="text-xs font-bold truncate">{r.label}</span>
                                                                            <span className={`text-[9px] truncate mt-0.5 leading-tight ${isSelected ? 'text-purple-100' : 'text-slate-400'}`}>
                                                                                {r.desc}
                                                                            </span>
                                                                        </div>
                                                                        <span className={`text-[9px] px-1.5 py-0.2 rounded-full shrink-0 ${
                                                                            isSelected ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-600 font-bold'
                                                                        }`}>
                                                                            {activeCount}/{totalCount}
                                                                        </span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        }
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Interactive Grid */}
                        <div className="lg:col-span-8 p-6 flex flex-col justify-between">
                            {selectedRole ? (
                                <div className="space-y-6">
                                    {/* Action Row */}
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-gray-100 shrink-0">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-base font-black text-gray-800 tracking-tight uppercase">
                                                    {selectedRole}
                                                </span>
                                                <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border bg-purple-50 border-purple-200 text-purple-700 rounded-full">
                                                    {permissionTab === 'role' ? 'VAI TRÒ VĂN PHÒNG' : 'TỔ & VAI TRÒ CHUYÊN MÔN'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 font-medium mt-1">
                                                Đánh dấu các hoạt động bên dưới để cấu hình chi tiết cho {selectedRole}.
                                            </p>
                                            {permissionTab === 'department' && (
                                                <p className="text-[11px] text-indigo-700 font-bold mt-1.5 flex items-center gap-1 bg-indigo-50 border border-indigo-150 px-2.5 py-1 rounded-lg">
                                                    <span>💡</span>
                                                    Hệ thống tự động lọc danh sách hoạt động chuyên môn phù hợp riêng cho nhóm tổ này để tối giản giao diện, tránh gán nhầm sang vai trò của tổ khác.
                                                </p>
                                            )}
                                        </div>

                                        {/* Quick Actions */}
                                        <div className="flex gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (permissionTab === 'role') {
                                                        if (selectedRole === UserRole.ADMIN) return;
                                                        setRolePermissions(prev => ({
                                                            ...prev,
                                                            [selectedRole]: AVAILABLE_PERMISSIONS.map(p => p.id)
                                                        }));
                                                    } else {
                                                        const teamName = Object.keys(TEAM_ALLOWED_PERMISSIONS).find(team => selectedRole.startsWith(team));
                                                        const allowedIds = teamName ? TEAM_ALLOWED_PERMISSIONS[teamName] : AVAILABLE_PERMISSIONS.map(p => p.id);
                                                        setDepartmentPermissions(prev => ({
                                                            ...prev,
                                                            [selectedRole]: allowedIds
                                                        }));
                                                    }
                                                }}
                                                disabled={permissionTab === 'role' && selectedRole === UserRole.ADMIN}
                                                className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all disabled:opacity-50"
                                            >
                                                Chọn tất cả
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (permissionTab === 'role') {
                                                        if (selectedRole === UserRole.ADMIN) return;
                                                        setRolePermissions(prev => ({
                                                            ...prev,
                                                            [selectedRole]: []
                                                        }));
                                                    } else {
                                                        setDepartmentPermissions(prev => ({
                                                            ...prev,
                                                            [selectedRole]: []
                                                        }));
                                                    }
                                                }}
                                                disabled={permissionTab === 'role' && selectedRole === UserRole.ADMIN}
                                                className="px-3 py-1.5 text-xs font-bold text-red-650 bg-red-50 hover:bg-red-100 rounded-xl transition-all disabled:opacity-50"
                                            >
                                                Bỏ chọn hết
                                            </button>
                                        </div>
                                    </div>

                                    {/* Grid Layout grouped by categories */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {[
                                            { 
                                                title: '🗂️ Quản lý Hồ sơ', 
                                                permissions: AVAILABLE_PERMISSIONS.filter(p => [
                                                    'VIEW_RECORDS', 'ADD_RECORDS', 'EDIT_RECORDS', 'DELETE_RECORDS', 
                                                    'RESTORE_RECORDS', 'ASSIGN_RECORDS', 'WITHDRAW_RECORDS', 'IMPORT_RECORDS', 'EXPORT_RECORDS'
                                                ].includes(p.id)) 
                                            },
                                            { 
                                                title: '📐 Kỹ thuật & Đo đạc', 
                                                permissions: AVAILABLE_PERMISSIONS.filter(p => [
                                                    'SURVEY_RECORDS', 'DRAW_RECORDS', 'CHECK_RECORDS', 'SIGN_RECORDS', 'UPDATE_WARD_MANAGEMENT'
                                                ].includes(p.id)) 
                                            },
                                            { 
                                                title: '🤝 Bàn giao & Trả kết quả', 
                                                permissions: AVAILABLE_PERMISSIONS.filter(p => [
                                                    'HANDOVER_RECORDS', 'RETURN_RECORDS', 'PRINT_HANDOVER_REPORTS'
                                                ].includes(p.id)) 
                                            },
                                            { 
                                                title: '📜 Hợp đồng Dịch vụ', 
                                                permissions: AVAILABLE_PERMISSIONS.filter(p => [
                                                    'VIEW_CONTRACTS', 'ADD_CONTRACTS', 'EDIT_CONTRACTS', 'SIGN_CONTRACTS', 'DELETE_CONTRACTS', 'EXPORT_CONTRACTS'
                                                ].includes(p.id)) 
                                            },
                                            { 
                                                title: '📂 Trích lục & Lưu trữ', 
                                                permissions: AVAILABLE_PERMISSIONS.filter(p => [
                                                    'VIEW_EXCERPTS', 'MANAGE_EXCERPTS', 'APPROVE_EXCERPTS', 'VIEW_ARCHIVE', 'MANAGE_ARCHIVE'
                                                ].includes(p.id)) 
                                            },
                                            { 
                                                title: '📊 Báo cáo & Lịch họp Công tác', 
                                                permissions: AVAILABLE_PERMISSIONS.filter(p => [
                                                    'VIEW_REPORTS', 'TRACK_KPI', 'EXPORT_REPORTS', 'VIEW_CHAT', 'MANAGE_CHAT', 'VIEW_SCHEDULE', 'MANAGE_SCHEDULE'
                                                ].includes(p.id)) 
                                            },
                                            { 
                                                title: '⚙️ Hệ thống & Bảo mật', 
                                                permissions: AVAILABLE_PERMISSIONS.filter(p => [
                                                    'VIEW_PERSONAL_PROFILE', 'MANAGE_USERS', 'MANAGE_EMPLOYEES', 'SYSTEM_SETTINGS', 'EDIT_SYSTEM_HOLIDAYS', 'VIEW_AUDIT_LOGS', 'DELETE_SYSTEM_DATA'
                                                ].includes(p.id)) 
                                            }
                                        ].map(group => {
                                            const teamName = permissionTab === 'department' 
                                                ? Object.keys(TEAM_ALLOWED_PERMISSIONS).find(team => selectedRole.startsWith(team)) 
                                                : undefined;
                                            const allowedIds = teamName ? TEAM_ALLOWED_PERMISSIONS[teamName] : undefined;
                                            const filteredPerms = allowedIds 
                                                ? group.permissions.filter(p => allowedIds.includes(p.id))
                                                : group.permissions;
                                            return { ...group, permissions: filteredPerms };
                                        })
                                        .filter(group => group.permissions.length > 0)
                                        .map((group, groupIdx) => (
                                            <div key={groupIdx} className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-gray-150">
                                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                                                    <span className="w-1 px-1 bg-purple-600 rounded-sm"></span>
                                                    {group.title}
                                                </h4>
                                                <div className="space-y-2">
                                                    {group.permissions.map(perm => {
                                                        const hasPerm = permissionTab === 'role' 
                                                            ? (rolePermissions[selectedRole]?.includes(perm.id) || rolePermissions[selectedRole]?.includes('*'))
                                                            : (departmentPermissions[selectedRole]?.includes(perm.id) || departmentPermissions[selectedRole]?.includes('*'));
                                                        const isDisabled = permissionTab === 'role' && selectedRole === UserRole.ADMIN;
                                                        return (
                                                            <label 
                                                                key={perm.id} 
                                                                className={`flex items-start gap-2.5 p-3 rounded-xl border select-none transition-all duration-200 ${
                                                                    hasPerm 
                                                                        ? 'bg-purple-50/70 border-purple-400 shadow-sm' 
                                                                        : 'bg-white border-gray-200 hover:border-purple-300'
                                                                } ${isDisabled ? 'opacity-65 cursor-not-allowed' : 'cursor-pointer'}`}
                                                            >
                                                                <div className="mt-0.5">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        className="w-3.5 h-3.5 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                                                                        checked={hasPerm || false}
                                                                        onChange={() => togglePermission(selectedRole, perm.id, permissionTab === 'role')}
                                                                        disabled={isDisabled}
                                                                    />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <span className={`text-xs font-bold block ${hasPerm ? 'text-purple-900' : 'text-gray-700'}`}>
                                                                        {perm.label}
                                                                    </span>
                                                                    <span className="text-[10px] text-gray-400 font-mono block mt-0.5">{perm.id}</span>
                                                                </div>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 py-20 bg-gray-50/30 rounded-2xl border bg-white shadow-sm border-dashed border-gray-200">
                                    <Key size={32} className="text-slate-350 mb-2" />
                                    <p className="text-sm font-bold text-gray-500">Chưa chọn đối tượng cấu hình</p>
                                    <p className="text-xs text-gray-450 mt-1">Vui lòng chọn một Vai trò hoặc một Phòng ban để gán quyền chi tiết.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'sla' && (
                <div className="max-w-6xl mx-auto space-y-6">
                    {/* Header info */}
                    <div className="bg-white border border-emerald-100 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-center gap-4">
                        <div className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl">
                            <Sliders size={32} />
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <h3 className="font-black text-gray-800 text-lg tracking-tight flex items-center justify-center md:justify-start gap-2 mb-1">
                                Cấu hình thời hạn xử lý (SLA) quy trình GCN
                            </h3>
                            <p className="text-xs text-gray-500 leading-relaxed font-medium">
                                Tùy chỉnh số ngày hoặc giờ quy định cho từng bước cụ thể của 7 quy trình cấp giấy chứng nhận (GCN). Hệ thống sẽ căn cứ vào đây để tính toán và cảnh báo trễ hạn chính xác, tự động trừ các ngày nghỉ lễ đã cấu hình.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Left List of Workflows */}
                        <div className="lg:col-span-4 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-2">
                            <div className="flex items-center justify-between mb-3 px-2">
                                <h4 className="text-xs font-black uppercase tracking-wider text-gray-400">Danh sách quy trình</h4>
                                <button
                                    onClick={() => setShowAddWorkflowModal(true)}
                                    className="text-[11px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 hover:border-emerald-200 font-bold flex items-center gap-1 transition-all"
                                >
                                    <Plus size={12} /> Thêm mới
                                </button>
                            </div>
                            {allWorkflows.map((wf) => {
                                const customStepCount = Object.keys(slaConfig[wf.id] || {}).length;
                                const isSelected = selectedSlaWorkflow === wf.id;
                                const isCustomWorkflow = !['quy_trinh_1', 'quy_trinh_2', 'quy_trinh_3', 'quy_trinh_4', 'quy_trinh_5', 'quy_trinh_6', 'quy_trinh_7'].includes(wf.id);
                                return (
                                    <div key={wf.id} className="relative group/item flex items-center w-full">
                                        <button
                                            onClick={() => setSelectedSlaWorkflow(wf.id)}
                                            className={`flex-1 text-left p-3.5 rounded-xl transition-all flex items-center justify-between group border ${isSelected ? 'border-emerald-500 bg-emerald-50/40 text-emerald-800 font-bold shadow-sm' : 'border-transparent text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg transition-colors ${isSelected ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-50 text-gray-400 group-hover:bg-gray-100'}`}>
                                                    <Timer size={16} />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-xs font-bold leading-tight truncate max-w-[150px]">{wf.title}</p>
                                                    <p className="text-[10px] text-gray-400 font-medium">Có {wf.steps.length} bước xử lý</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0 pr-6">
                                                {customStepCount > 0 && (
                                                    <span className="bg-emerald-100 text-emerald-700 font-black text-[9px] px-2 py-0.5 rounded-full border border-emerald-200">
                                                        Chỉnh {customStepCount}
                                                    </span>
                                                )}
                                                <ChevronRight size={14} className={`text-gray-300 transition-transform ${isSelected ? 'translate-x-0.5 text-emerald-500' : 'group-hover:translate-x-0.5'}`} />
                                            </div>
                                        </button>
                                        
                                        {isCustomWorkflow && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteWorkflow(wf.id, wf.title);
                                                }}
                                                className="absolute right-2 opacity-0 group-hover/item:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                title="Xóa quy trình tùy chỉnh"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Right Workflow Steps Details */}
                        <div className="lg:col-span-8 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-6">
                            {(() => {
                                const activeWf = allWorkflows.find(w => w.id === selectedSlaWorkflow);
                                if (!activeWf) return null;

                                return (
                                    <>
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                                            <div>
                                                <h4 className="font-black text-gray-800 text-base tracking-tight">{activeWf.title}</h4>
                                                <p className="text-xs text-gray-400 font-medium mt-0.5">Cấu hình thời hạn của các bước xử lý thành phần</p>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    if (await confirmAction(`Bạn có chắc chắn muốn khôi phục tất cả bước trong "${activeWf.title}" về thời hạn mặc định ban đầu?`)) {
                                                        const next = { ...slaConfig };
                                                        delete next[activeWf.id];
                                                        await handleSaveSlaConfig(next);
                                                    }
                                                }}
                                                className="text-xs text-gray-500 hover:text-red-600 font-bold flex items-center gap-1 bg-gray-50 hover:bg-red-50 border border-gray-200 hover:border-red-100 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                                            >
                                                <RefreshCw size={12} /> Khôi phục mặc định quy trình
                                            </button>
                                        </div>

                                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 no-scrollbar">
                                            {activeWf.steps.map((step, idx) => {
                                                const currentOverride = slaConfig[activeWf.id]?.[step.label];
                                                const isCustom = currentOverride !== undefined;

                                                // Parse override if exists
                                                let numVal = 1;
                                                let unitVal = 'ngày';
                                                
                                                if (isCustom) {
                                                    if (currentOverride === '---') {
                                                        unitVal = '---';
                                                        numVal = 0;
                                                    } else if (currentOverride === '0 giờ') {
                                                        unitVal = '0 giờ';
                                                        numVal = 0;
                                                    } else {
                                                        const match = currentOverride.match(/^(\d+)\s+(ngày|giờ)$/);
                                                        if (match) {
                                                            numVal = parseInt(match[1]) || 1;
                                                            unitVal = match[2];
                                                        }
                                                    }
                                                }

                                                return (
                                                    <div key={idx} className={`p-4 rounded-xl border transition-all ${isCustom ? 'bg-emerald-50/20 border-emerald-100 shadow-sm shadow-emerald-50/30' : 'bg-gray-50/40 border-gray-150'}`}>
                                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                            <div className="space-y-1 flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-md">
                                                                        Bước {idx + 1}
                                                                    </span>
                                                                    <span className="font-bold text-gray-800 text-sm leading-tight">
                                                                        {step.label}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-gray-400 font-medium">
                                                                    Thời hạn gốc mặc định: <strong className="text-gray-500 font-bold">{(step as any).defaultDuration || (step as any).duration}</strong>
                                                                </p>
                                                            </div>

                                                            <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                                                                {/* Mode Select toggle */}
                                                                <div className="bg-gray-100/80 p-0.5 rounded-lg flex border border-gray-200">
                                                                    <button
                                                                        onClick={() => handleUpdateStepSla(activeWf.id, step.label, 1, 'ngày', true)}
                                                                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${!isCustom ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                                                    >
                                                                        Mặc định
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleUpdateStepSla(activeWf.id, step.label, numVal, unitVal, false)}
                                                                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${isCustom ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                                                    >
                                                                        Tùy chỉnh
                                                                    </button>
                                                                </div>

                                                                {/* Custom input fields */}
                                                                {isCustom && (
                                                                    <div className="flex items-center gap-1.5 animate-fade-in">
                                                                        {unitVal !== '---' && unitVal !== '0 giờ' && (
                                                                            <input
                                                                                type="number"
                                                                                min={1}
                                                                                value={numVal}
                                                                                onChange={(e) => {
                                                                                    const val = Math.max(1, parseInt(e.target.value) || 1);
                                                                                    handleUpdateStepSla(activeWf.id, step.label, val, unitVal, false);
                                                                                }}
                                                                                className="w-16 px-2 py-1.5 text-xs text-center font-bold border border-gray-250 bg-white rounded-lg focus:outline-none focus:border-emerald-500"
                                                                            />
                                                                        )}
                                                                        <select
                                                                            value={unitVal}
                                                                            onChange={(e) => {
                                                                                const u = e.target.value;
                                                                                const n = (u === '---' || u === '0 giờ') ? 0 : (numVal === 0 ? 1 : numVal);
                                                                                handleUpdateStepSla(activeWf.id, step.label, n, u, false);
                                                                            }}
                                                                            className="px-2 py-1.5 text-xs font-bold border border-gray-250 bg-white rounded-lg focus:outline-none focus:border-emerald-500"
                                                                        >
                                                                            <option value="ngày">ngày</option>
                                                                            <option value="giờ">giờ</option>
                                                                            <option value="0 giờ">0 giờ</option>
                                                                            <option value="---">--- (Không hạn)</option>
                                                                        </select>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                                            <button
                                                onClick={async () => {
                                                    if (await confirmAction("Bạn có chắc chắn muốn xóa TOÀN BỘ cấu hình SLA tùy chỉnh của mọi quy trình để trở về mặc định hệ thống?")) {
                                                        await handleSaveSlaConfig({});
                                                    }
                                                }}
                                                className="text-xs text-red-500 hover:text-red-700 font-bold px-3 py-2 hover:bg-red-50 rounded-xl transition-colors self-start sm:self-center"
                                            >
                                                Khôi phục tất cả quy trình về mặc định
                                            </button>
                                            <button
                                                onClick={() => handleSaveSlaConfig(slaConfig)}
                                                disabled={isSavingSla}
                                                className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-100 flex items-center justify-center gap-2 active:scale-95 shrink-0"
                                            >
                                                {isSavingSla ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                                                {isSavingSla ? 'Đang lưu...' : 'Lưu cấu hình SLA'}
                                            </button>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {showAddWorkflowModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-2xl overflow-hidden animate-scale-up">
                        <div className="bg-emerald-600 text-white p-6 flex justify-between items-center">
                            <div>
                                <h3 className="font-black text-lg tracking-tight">Thêm quy trình SLA tùy chỉnh mới</h3>
                                <p className="text-xs text-emerald-100 mt-0.5">Xây dựng quy trình xử lý của riêng bạn với thời gian mặc định</p>
                            </div>
                            <button 
                                onClick={() => setShowAddWorkflowModal(false)}
                                className="p-1.5 hover:bg-emerald-700/50 rounded-xl transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-1.5">Tên quy trình</label>
                                <input
                                    type="text"
                                    placeholder="Ví dụ: Đăng ký thế chấp, Trích đo bản đồ..."
                                    value={newWorkflowTitle}
                                    onChange={(e) => setNewWorkflowTitle(e.target.value)}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <h5 className="text-xs font-black uppercase tracking-wider text-gray-400">Các bước xử lý</h5>
                                    <button
                                        onClick={() => setNewWorkflowSteps([...newWorkflowSteps, { label: '', duration: '4 giờ', overallStatus: RecordStatus.IN_PROGRESS }])}
                                        className="text-xs text-emerald-600 font-bold hover:underline flex items-center gap-1"
                                    >
                                        <Plus size={14} /> Thêm bước mới
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {newWorkflowSteps.map((step, idx) => (
                                        <div key={idx} className="flex flex-col sm:flex-row items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-150 relative w-full">
                                            <div className="flex-1 w-full">
                                                <label className="block text-[10px] font-bold text-gray-400 mb-1">Tên bước</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ví dụ: Đo đạc thực địa, Thẩm tra..."
                                                    value={step.label}
                                                    onChange={(e) => {
                                                        const copy = [...newWorkflowSteps];
                                                        copy[idx].label = e.target.value;
                                                        setNewWorkflowSteps(copy);
                                                    }}
                                                    className="w-full border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-1 focus:ring-emerald-500 outline-none"
                                                />
                                            </div>

                                            <div className="w-full sm:w-1/4">
                                                <label className="block text-[10px] font-bold text-gray-400 mb-1">Thời hạn ban đầu</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ví dụ: 4 giờ, 3 ngày"
                                                    value={step.duration}
                                                    onChange={(e) => {
                                                        const copy = [...newWorkflowSteps];
                                                        copy[idx].duration = e.target.value;
                                                        setNewWorkflowSteps(copy);
                                                    }}
                                                    className="w-full border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-1 focus:ring-emerald-500 outline-none"
                                                />
                                            </div>

                                            <div className="w-full sm:w-1/3">
                                                <label className="block text-[10px] font-bold text-gray-400 mb-1">Trạng thái hồ sơ</label>
                                                <select
                                                    value={step.overallStatus}
                                                    onChange={(e) => {
                                                        const copy = [...newWorkflowSteps];
                                                        copy[idx].overallStatus = e.target.value as RecordStatus;
                                                        setNewWorkflowSteps(copy);
                                                    }}
                                                    className="w-full border border-gray-200 bg-white rounded-lg px-2 py-1.5 text-xs font-medium focus:ring-1 focus:ring-emerald-500 outline-none"
                                                >
                                                    <option value={RecordStatus.RECEIVED}>Tiếp nhận (RECEIVED)</option>
                                                    <option value={RecordStatus.ASSIGNED}>Giao nhân viên (ASSIGNED)</option>
                                                    <option value={RecordStatus.IN_PROGRESS}>Đang xử lý (IN_PROGRESS)</option>
                                                    <option value={RecordStatus.PENDING_CHECK}>Chờ thẩm tra (PENDING_CHECK)</option>
                                                    <option value={RecordStatus.PENDING_SIGN}>Chờ trình ký (PENDING_SIGN)</option>
                                                    <option value={RecordStatus.SIGNED}>Đã ký duyệt / Vô số (SIGNED)</option>
                                                    <option value={RecordStatus.HANDOVER}>Giao Một cửa (HANDOVER)</option>
                                                    <option value={RecordStatus.RETURNED}>Đã trả dân (RETURNED)</option>
                                                </select>
                                            </div>

                                            {idx > 0 && (
                                                <button
                                                    onClick={() => {
                                                        const copy = newWorkflowSteps.filter((_, sIdx) => sIdx !== idx);
                                                        setNewWorkflowSteps(copy);
                                                    }}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg shrink-0 self-end mb-1 sm:self-center sm:mb-0"
                                                    title="Xóa bước này"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100">
                            <button
                                onClick={() => setShowAddWorkflowModal(false)}
                                className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-all"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                onClick={handleSaveNewWorkflow}
                                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/10 active:scale-95 rounded-xl transition-all"
                            >
                                Tạo quy trình
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'data' && (
                <div className="max-w-4xl mx-auto space-y-8">
                    {/* Vùng nguy hiểm */}
                    <div className="border-2 border-red-100 rounded-[2rem] overflow-hidden bg-white shadow-xl shadow-red-50">
                        <div className="bg-red-50 p-5 border-b border-red-100">
                            <h3 className="text-red-700 font-black flex items-center gap-2 uppercase tracking-widest text-xs"> <AlertTriangle size={20} /> Vùng nguy hiểm </h3>
                        </div>
                        <div className="p-8">
                            <div className="flex flex-col items-center text-center gap-6">
                                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-2">
                                    <ShieldAlert size={40} />
                                </div>
                                <div> 
                                    <h4 className="font-black text-slate-800 text-xl tracking-tight mb-3"> Xóa sạch dữ liệu hệ thống </h4> 
                                    <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-md mx-auto"> 
                                        Hành động này sẽ xóa vĩnh viễn tất cả <strong>Hồ sơ</strong>, <strong>Hợp đồng</strong>, và <strong>Lịch sử hoạt động</strong> khỏi cơ sở dữ liệu. 
                                        <br/>
                                        <span className="text-red-600 font-black mt-2 block uppercase text-xs tracking-wider">Lưu ý: Không thể khôi phục dữ liệu sau khi xóa.</span>
                                    </p> 
                                </div>
                                <button onClick={handleConfirmDeleteData} disabled={isDeletingData} className="w-full md:w-auto px-10 py-4 bg-red-600 text-white font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95"> 
                                    {isDeletingData ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
                                    {isDeletingData ? 'Đang xóa...' : 'Xóa dữ liệu ngay'} 
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}


        </div>
    </div>
  );
};

export default SystemSettingsView;

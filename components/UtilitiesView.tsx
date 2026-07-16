
import React, { useState, useEffect } from 'react';
import { FolderCog, ExternalLink, Loader2, Download, CheckCircle, AlertCircle, X, Calculator, FileText, Gavel, Info, Table2, Grid, FileSpreadsheet, Layers, Database, Calendar } from 'lucide-react';
import { User as UserType, RecordFile, NotifyFunction, NotifyType, Employee, UserRole, Holiday } from '../types';
import { getEmployeeTeam } from './AssignModal';
import SoanBienBanTab from './utilities/SoanBienBanTab';
import CungCapThongTinTab from './utilities/CungCapThongTinTab';
import VPHCTab from './utilities/VPHCTab';
import SaiSoTab from './utilities/SaiSoTab';
import ChinhLyBienDongTab from './utilities/ChinhLyBienDongTab';
import HoSoTachThuaTab from './utilities/HoSoTachThuaTab';
import ChuyenDoiToBanDoTab from './utilities/ChuyenDoiToBanDoTab';
import DongBoThuTucTab from './utilities/DongBoThuTucTab';
import DongBoCSVTab from './utilities/DongBoCSVTab';
import SuaDoiNgayTab from './utilities/SuaDoiNgayTab';

interface UtilitiesViewProps {
    currentUser: UserType;
    employees?: Employee[];
    initialRecordForCorrection?: RecordFile | null; // New prop for auto-navigation
    recordForMinutes?: RecordFile | null;
    onClearRecordForMinutes?: () => void;
    records?: RecordFile[];
    onUpdateRecord?: (r: RecordFile) => Promise<any>;
    onRefreshData?: () => void;
    holidays?: Holiday[];
}

const UtilitiesView: React.FC<UtilitiesViewProps> = ({ currentUser, employees = [], initialRecordForCorrection, recordForMinutes, onClearRecordForMinutes, records, onUpdateRecord, onRefreshData, holidays = [] }) => {
  const userEmp = employees.find(e => e.id === currentUser.employeeId);
  const teamName = userEmp ? getEmployeeTeam(userEmp) : '';
  const isAdmin = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN;
  const isOneDoor = currentUser.role === UserRole.ONEDOOR || teamName === 'Tổ Hành chính';
  const isDirector = teamName === 'Ban Giám đốc';
  const isSpecialTeam = isAdmin || isOneDoor || isDirector;

  const allowedTabs = React.useMemo(() => {
    return ['bienban', 'vphc', 'thongtin', 'chinhly', 'tachthua', 'saiso', 'chuyendoi', 'dongbothutuc', 'dongbocsv', 'suadoingay'];
  }, []);

  const [activeTab, setActiveTab] = useState<string>('bienban');
  const [defaultExportPath, setDefaultExportPath] = useState('');
  
  // State cho thông báo Custom (Toast)
  const [notification, setNotification] = useState<{ type: NotifyType, message: string } | null>(null);

  // Auto-switch to correction tab if initial record is provided
  useEffect(() => {
      if (initialRecordForCorrection && allowedTabs.includes('chinhly')) {
          setActiveTab('chinhly');
      }
  }, [initialRecordForCorrection, allowedTabs]);

  // Auto-switch to bienban tab if record for minutes is provided
  useEffect(() => {
      if (recordForMinutes && allowedTabs.includes('bienban')) {
          setActiveTab('bienban');
      }
  }, [recordForMinutes, allowedTabs]);

  // Ensure active tab is within allowed tabs on load or change
  useEffect(() => {
      if (allowedTabs.length && !allowedTabs.includes(activeTab)) {
          setActiveTab(allowedTabs[0]);
      }
  }, [allowedTabs]);

  // Load default path on mount and tab change
  useEffect(() => {
      let key = '';
      if (activeTab === 'bienban' || activeTab === 'vphc') key = 'DEFAULT_EXPORT_PATH_BIENBAN';
      else if (activeTab === 'thongtin') key = 'DEFAULT_EXPORT_PATH_THONGTIN';
      
      if (key) {
          const saved = localStorage.getItem(key);
          setDefaultExportPath(saved || '');
      } else {
          setDefaultExportPath('');
      }
  }, [activeTab]);

  // Tự động ẩn thông báo sau 3 giây
  useEffect(() => {
      if (notification) {
          const timer = setTimeout(() => setNotification(null), 3000);
          return () => clearTimeout(timer);
      }
  }, [notification]);

  const notify: NotifyFunction = (message, type = 'success') => {
      setNotification({ type, message });
  };

  const handleConfigurePath = async () => {
      if (window.electronAPI && window.electronAPI.selectFolder) {
          const path = await window.electronAPI.selectFolder();
          if (path) {
              const key = activeTab === 'thongtin' ? 'DEFAULT_EXPORT_PATH_THONGTIN' : 'DEFAULT_EXPORT_PATH_BIENBAN';
              const name = activeTab === 'thongtin' ? 'Cung cấp thông tin' : 'Biên bản & VPHC';
              localStorage.setItem(key, path);
              setDefaultExportPath(path);
              notify(`Đã cập nhật thư mục lưu cho ${name}: ${path}`, 'success');
          }
      } else {
          notify('Chức năng này chỉ khả dụng trên App Desktop.', 'info');
      }
  };

  return (
    <div className="flex flex-col h-full bg-[#f1f5f9] overflow-hidden animate-fade-in relative">
      {/* Toast Notification Container */}
      {notification && (
          <div className={`absolute top-4 right-4 z-[100] max-w-sm w-full p-4 rounded-xl shadow-2xl border flex items-start gap-3 animate-fade-in-up transition-all ${
              notification.type === 'success' ? 'bg-white border-green-200 text-green-800' : 
              notification.type === 'error' ? 'bg-white border-red-200 text-red-800' : 
              'bg-white border-blue-200 text-blue-800'
          }`}>
              {notification.type === 'success' ? <CheckCircle className="text-green-600 shrink-0" size={20} /> : 
               notification.type === 'error' ? <AlertCircle className="text-red-600 shrink-0" size={20} /> :
               <Loader2 className="text-blue-600 shrink-0 animate-spin" size={20} />}
              
              <div className="flex-1 text-sm font-medium pt-0.5">{notification.message}</div>
              <button onClick={() => setNotification(null)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
          </div>
      )}

      {/* Header Tabs */}
      <div className="bg-white border-b border-slate-300 p-2 flex items-center gap-4 shrink-0 shadow-sm z-20">
          <div className="flex bg-slate-100 p-1 rounded-lg overflow-x-auto">
              {allowedTabs.includes('bienban') && (
                  <button 
                      onClick={() => setActiveTab('bienban')}
                      className={`px-4 py-2 text-sm font-bold rounded-md transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'bienban' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                      <FileText size={16} /> Soạn Biên Bản
                  </button>
              )}
              {allowedTabs.includes('vphc') && (
                  <button 
                      onClick={() => setActiveTab('vphc')}
                      className={`px-4 py-2 text-sm font-bold rounded-md transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'vphc' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                      <Gavel size={16} /> Biên bản VPHC
                  </button>
              )}
              {allowedTabs.includes('thongtin') && (
                  <button 
                      onClick={() => setActiveTab('thongtin')}
                      className={`px-4 py-2 text-sm font-bold rounded-md transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'thongtin' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                      <Info size={16} /> Cung Cấp Thông Tin
                  </button>
              )}
              {allowedTabs.includes('chinhly') && (
                  <button 
                      onClick={() => setActiveTab('chinhly')}
                      className={`px-4 py-2 text-sm font-bold rounded-md transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'chinhly' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                      <Table2 size={16} /> Hồ sơ Chỉnh lý
                  </button>
              )}
              {allowedTabs.includes('tachthua') && (
                  <button 
                      onClick={() => setActiveTab('tachthua')}
                      className={`px-4 py-2 text-sm font-bold rounded-md transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'tachthua' ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                      <Grid size={16} /> Hồ sơ Tách thửa
                  </button>
              )}
              {allowedTabs.includes('saiso') && (
                  <button 
                      onClick={() => setActiveTab('saiso')}
                      className={`px-4 py-2 text-sm font-bold rounded-md transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'saiso' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                      <Calculator size={16} /> Tính sai số
                  </button>
              )}
              {allowedTabs.includes('chuyendoi') && (
                  <button 
                      onClick={() => setActiveTab('chuyendoi')}
                      className={`px-4 py-2 text-sm font-bold rounded-md transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'chuyendoi' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                      <FileSpreadsheet size={16} /> Chuyển đổi tờ bản đồ
                  </button>
              )}
              {allowedTabs.includes('dongbothutuc') && (
                  <button 
                      onClick={() => setActiveTab('dongbothutuc')}
                      className={`px-4 py-2 text-sm font-bold rounded-md transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'dongbothutuc' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                      <Layers size={16} /> Đồng bộ thủ tục
                  </button>
              )}
              {allowedTabs.includes('dongbocsv') && (
                  <button 
                      onClick={() => setActiveTab('dongbocsv')}
                      className={`px-4 py-2 text-sm font-bold rounded-md transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'dongbocsv' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                      <Database size={16} /> Đồng bộ CSV/Excel
                  </button>
              )}
              {allowedTabs.includes('suadoingay') && (
                  <button 
                      onClick={() => setActiveTab('suadoingay')}
                      className={`px-4 py-2 text-sm font-bold rounded-md transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'suadoingay' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                      <Calendar size={16} /> Sửa đổi Ngày
                  </button>
              )}
          </div>
          
          {activeTab !== 'saiso' && activeTab !== 'chinhly' && activeTab !== 'tachthua' && activeTab !== 'chuyendoi' && activeTab !== 'dongbothutuc' && activeTab !== 'dongbocsv' && activeTab !== 'suadoingay' && (
            <div className="flex-1 flex justify-end items-center gap-3 pr-4">
                <button 
                    onClick={handleConfigurePath}
                    className="text-gray-500 hover:text-blue-600 p-1.5 rounded hover:bg-blue-50 transition-colors flex items-center gap-1 text-xs font-medium border border-transparent hover:border-blue-100"
                    title={`Đường dẫn lưu hiện tại cho tab này: ${defaultExportPath || 'Mặc định (Downloads)'}`}
                >
                    <FolderCog size={16} /> Cấu hình lưu
                </button>
            </div>
          )}
      </div>

      <div className="flex-1 overflow-hidden relative">
          {/* TAB 1: SOẠN BIÊN BẢN */}
          <div className={`w-full h-full flex flex-col ${activeTab === 'bienban' ? 'block' : 'hidden'}`}>
              <SoanBienBanTab 
                  currentUser={currentUser} 
                  isActive={activeTab === 'bienban'} 
                  notify={notify} 
                  initialRecord={recordForMinutes}
                  onClearInitialRecord={onClearRecordForMinutes}
              />
          </div>

          {/* TAB 2: BIÊN BẢN VPHC */}
          <div className={`w-full h-full flex flex-col ${activeTab === 'vphc' ? 'block' : 'hidden'}`}>
              <VPHCTab currentUser={currentUser} notify={notify} />
          </div>

          {/* TAB 3: CUNG CẤP THÔNG TIN */}
          <div className={`w-full h-full flex flex-col bg-[#f1f5f9] ${activeTab === 'thongtin' ? 'block' : 'hidden'}`}>
              <CungCapThongTinTab currentUser={currentUser} notify={notify} />
          </div>

          {/* TAB 4: HỒ SƠ CHỈNH LÝ (ĐỔI TÊN) */}
          <div className={`w-full h-full flex flex-col bg-[#f1f5f9] ${activeTab === 'chinhly' ? 'block' : 'hidden'}`}>
              <ChinhLyBienDongTab 
                  currentUser={currentUser} 
                  notify={notify}
                  initialRecord={initialRecordForCorrection} // Pass down the record
              />
          </div>

          {/* TAB 5: HỒ SƠ TÁCH THỬA (MỚI) */}
          <div className={`w-full h-full flex flex-col bg-[#f1f5f9] ${activeTab === 'tachthua' ? 'block' : 'hidden'}`}>
              <HoSoTachThuaTab 
                  currentUser={currentUser} 
                  notify={notify}
              />
          </div>

          {/* TAB 6: TÍNH SAI SỐ */}
          <div className={`w-full h-full flex flex-col bg-[#f1f5f9] ${activeTab === 'saiso' ? 'block' : 'hidden'}`}>
              <SaiSoTab />
          </div>

          {/* TAB 7: CHUYỂN ĐỔI TỜ BẢN ĐỒ */}
          <div className={`w-full h-full flex flex-col bg-[#f1f5f9] ${activeTab === 'chuyendoi' ? 'block' : 'hidden'}`}>
              <ChuyenDoiToBanDoTab notify={notify} />
          </div>

          {/* TAB 8: ĐỒNG BỘ THỦ TỤC CỦ VÀ MỚI */}
          <div className={`w-full h-full flex flex-col bg-[#f1f5f9] ${activeTab === 'dongbothutuc' ? 'block' : 'hidden'}`}>
              <DongBoThuTucTab 
                  notify={notify}
                  records={records || []}
                  onUpdateRecord={onUpdateRecord}
                  onRefreshData={onRefreshData}
              />
          </div>

          {/* TAB 9: ĐỒNG BỘ CSV/EXCEL */}
          <div className={`w-full h-full flex flex-col bg-[#f1f5f9] ${activeTab === 'dongbocsv' ? 'block' : 'hidden'}`}>
              <DongBoCSVTab 
                  notify={notify}
                  onRefreshData={onRefreshData}
              />
          </div>

          {/* TAB 10: SỬA ĐỔI / ĐỒNG BỘ NGÀY HỒ SƠ */}
          <div className={`w-full h-full flex flex-col bg-[#f1f5f9] ${activeTab === 'suadoingay' ? 'block' : 'hidden'}`}>
              <SuaDoiNgayTab 
                  notify={notify}
                  records={records || []}
                  onUpdateRecord={onUpdateRecord}
                  onRefreshData={onRefreshData}
                  holidays={holidays}
              />
          </div>
      </div>
    </div>
  );
};

export default UtilitiesView;

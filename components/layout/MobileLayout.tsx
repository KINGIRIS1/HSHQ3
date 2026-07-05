import React from 'react';
import { User, UserRole } from '../../types';
import { 
  LayoutDashboard, 
  FileText, 
  MessageSquare, 
  Settings, 
  LogOut, 
  Bell,
  Menu,
  Search,
  Plus,
  ScanBarcode
} from 'lucide-react';

interface MobileLayoutProps {
  currentUser: User;
  currentView: string;
  setCurrentView: (view: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
  unreadMessages: number;
  activeRemindersCount: number;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({
  currentUser,
  currentView,
  setCurrentView,
  onLogout,
  children,
  unreadMessages,
  activeRemindersCount
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'all_records', label: 'Hồ sơ', icon: FileText },
    { id: 'barcode_generator', label: 'Mã vạch', icon: ScanBarcode },
    { id: 'account_settings', label: 'Cài đặt', icon: Settings },
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* Top Header */}
      <header className="bg-blue-700 text-white px-4 py-3 flex justify-between items-center shadow-md shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <FileText size={18} />
          </div>
          <h1 className="font-bold text-lg tracking-tight">QLHS Mobile</h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="relative p-1.5 hover:bg-white/10 rounded-full transition-colors">
            <Bell size={20} />
            {activeRemindersCount > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-[10px] flex items-center justify-center rounded-full border-2 border-blue-700">
                {activeRemindersCount}
              </span>
            )}
          </button>
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center font-bold border border-white/30">
            {currentUser.name.charAt(0)}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center h-16 px-2 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-50">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id || (item.id === 'received_list' && ['assigned_list', 'in_progress_list', 'completed_list', 'pending_sign_list', 'signed_list', 'handover_list', 'returned_list'].includes(currentView));
          
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all ${
                isActive ? 'text-blue-600' : 'text-slate-400'
              }`}
            >
              <div className="relative">
                <Icon size={22} className={isActive ? 'scale-110' : ''} />
              </div>
              <span className={`text-[10px] font-medium ${isActive ? 'text-blue-600' : 'text-slate-500'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
      
      {/* Floating Action Button for quick record creation (if admin/subadmin) */}
      {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN) && currentView === 'all_records' && (
        <button 
          className="fixed bottom-20 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all z-40"
          onClick={() => {/* Trigger add record modal */}}
        >
          <Plus size={28} />
        </button>
      )}
    </div>
  );
};

export default MobileLayout;

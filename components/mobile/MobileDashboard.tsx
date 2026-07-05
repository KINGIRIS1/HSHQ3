import React, { useMemo, useState } from 'react';
import { RecordFile, RecordStatus } from '../../types';
import { STATUS_LABELS } from '../../constants';
import { 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  TrendingUp,
  CalendarRange,
  CalendarDays,
  Calendar,
  ArchiveX
} from 'lucide-react';

interface MobileDashboardProps {
  records: RecordFile[];
}

const MobileDashboard: React.FC<MobileDashboardProps> = ({ records }) => {
  const [viewMode, setViewMode] = useState<'year' | 'month' | 'week'>('year');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    const currentYear = new Date().getFullYear();
    years.add(currentYear);
    records.forEach(r => {
      if (r.receivedDate) {
        const y = new Date(r.receivedDate).getFullYear();
        if (!isNaN(y)) years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [records]);

  const filteredRecords = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    return records.filter(r => {
      if (!r.receivedDate) return false;
      const rDate = new Date(r.receivedDate);
      
      if (viewMode === 'year') {
        return rDate.getFullYear() === selectedYear;
      } else if (viewMode === 'month') {
        return rDate.getFullYear() === currentYear && rDate.getMonth() === currentMonth;
      } else if (viewMode === 'week') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now);
        monday.setHours(0,0,0,0);
        monday.setDate(diff);
        const nextSunday = new Date(monday);
        nextSunday.setDate(monday.getDate() + 6);
        nextSunday.setHours(23,59,59,999);
        return rDate >= monday && rDate <= nextSunday;
      }
      return false;
    });
  }, [records, selectedYear, viewMode]);

  const total = filteredRecords.length;
  const completed = filteredRecords.filter(r => r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || r.status === RecordStatus.REJECTED).length;
  const withdrawn = filteredRecords.filter(r => r.status === RecordStatus.WITHDRAWN).length;
  const processing = total - completed - withdrawn;

  const stats = [
    { 
      label: 'Tổng nhận', 
      value: total, 
      icon: FileText, 
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
      subText: 'Hồ sơ'
    },
    { 
      label: 'Đang xử lý', 
      value: processing, 
      icon: Clock, 
      color: 'bg-orange-500',
      textColor: 'text-orange-600',
      subText: `Chiếm ${total > 0 ? Math.round((processing / total) * 100) : 0}%`
    },
    { 
      label: 'Hoàn thành', 
      value: completed, 
      icon: CheckCircle, 
      color: 'bg-green-500',
      textColor: 'text-green-600',
      subText: `Chiếm ${total > 0 ? Math.round((completed / total) * 100) : 0}%`
    },
    { 
      label: 'Rút / Trả lại', 
      value: withdrawn, 
      icon: ArchiveX, 
      color: 'bg-slate-500',
      textColor: 'text-slate-600',
      subText: 'Hồ sơ'
    },
  ];

  const getTitle = () => {
    if (viewMode === 'week') return "Tuần này";
    if (viewMode === 'month') return `Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`;
    return `Năm ${selectedYear}`;
  };

  return (
    <div className="p-4 space-y-6 pb-20">
      {/* View Mode Switcher */}
      <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 space-y-3">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 text-white p-1.5 rounded-lg">
            <CalendarRange size={18} />
          </div>
          <h2 className="font-bold text-slate-800 text-sm">Thống kê: {getTitle()}</h2>
        </div>
        
        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100">
          <button 
            onClick={() => setViewMode('week')}
            className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${viewMode === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
          >
            <CalendarDays size={12} /> Tuần
          </button>
          <button 
            onClick={() => setViewMode('month')}
            className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${viewMode === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
          >
            <Calendar size={12} /> Tháng
          </button>
          <div className="flex-1 flex items-center justify-center gap-1 px-1">
            <select 
              value={selectedYear} 
              onChange={(e) => { setSelectedYear(parseInt(e.target.value)); setViewMode('year'); }}
              className={`w-full bg-transparent border-none text-[10px] font-bold outline-none cursor-pointer text-center ${viewMode === 'year' ? 'text-blue-600' : 'text-slate-500'}`}
            >
              {availableYears.map(year => (
                <option key={year} value={year}>Năm {year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3 relative overflow-hidden group">
            <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center text-white shadow-inner relative z-10`}>
              <stat.icon size={20} />
            </div>
            <div className="relative z-10">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{stat.label}</p>
              <p className={`text-2xl font-black ${stat.textColor} mt-1`}>{stat.value}</p>
              <p className={`text-[9px] font-medium mt-0.5 ${stat.textColor} opacity-80`}>{stat.subText}</p>
            </div>
            <stat.icon size={48} className={`absolute -bottom-2 -right-2 opacity-5 ${stat.textColor} transform rotate-12`} />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-600" />
            Hoạt động gần đây
          </h3>
        </div>
        <div className="divide-y divide-slate-50">
          {records.slice(0, 5).map((record, idx) => (
            <div key={idx} className="px-4 py-3 flex items-center gap-3 active:bg-slate-50 transition-colors">
              <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 shrink-0 border border-slate-100">
                <FileText size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{record.customerName}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1 rounded">{record.code}</span>
                  <span className="text-[10px] text-slate-400">•</span>
                  <span className="text-[10px] text-slate-500">{STATUS_LABELS[record.status]}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] text-slate-400 font-medium">{record.receivedDate}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MobileDashboard;

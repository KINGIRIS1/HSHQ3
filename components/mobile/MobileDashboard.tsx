import React, { useMemo, useState } from 'react';
import { RecordFile, RecordStatus } from '../../types';
import { getNormalizedWard, getShortRecordType, REGISTRATION_PROCEDURES, STATUS_LABELS } from '../../constants';
import { isArchiveType } from '../../utils/appHelpers';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { 
  FileText, 
  RotateCcw, 
  CheckCircle, 
  ArchiveX, 
  MapPin, 
  Layers, 
  CalendarRange, 
  CalendarDays, 
  Calendar,
  TrendingUp
} from 'lucide-react';

interface MobileDashboardProps {
  records: RecordFile[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

const MobileDashboard: React.FC<MobileDashboardProps> = ({ records }) => {
  const [viewMode, setViewMode] = useState<'year' | 'month' | 'week'>('year');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [chartMode, setChartMode] = useState<'department' | 'type'>('department');

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
      icon: RotateCcw, 
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
      label: 'Đã rút / Trả', 
      value: withdrawn, 
      icon: ArchiveX, 
      color: 'bg-slate-500',
      textColor: 'text-slate-600',
      subText: 'Hồ sơ'
    },
  ];

  // --- Phân loại theo 3 Bộ phận Chính ---
  const isReg = (type: string | null | undefined): boolean => {
    if (!type) return false;
    const t = type.trim().toLowerCase();
    return t.startsWith('3.') || t === 'đăng ký' || t === 'cấp giấy' || t === 'cấp đổi' || t === 'cấp lại' || REGISTRATION_PROCEDURES.some(p => p.toLowerCase() === t);
  };

  const measRecords = useMemo(() => {
    return filteredRecords.filter(r => 
        !['CMD', 'Tòa án', 'Thi hành án'].includes(r.recordType || '') &&
        !isArchiveType(r.recordType) && r.recordType !== 'Sao lục' && r.recordType !== 'Công văn' && r.recordType !== '1.1 Công văn' && r.recordType !== '1.2 Công văn' &&
        !isReg(r.recordType)
    );
  }, [filteredRecords]);

  const regRecords = useMemo(() => {
    return filteredRecords.filter(r => isReg(r.recordType));
  }, [filteredRecords]);

  const archRecords = useMemo(() => {
    return filteredRecords.filter(r => isArchiveType(r.recordType) || ['Sao lục', 'Công văn', '1.1 Công văn', '1.2 Công văn'].includes(r.recordType || ''));
  }, [filteredRecords]);

  const getDeptStats = (deptRecs: RecordFile[]) => {
    const dTotal = deptRecs.length;
    const dCompleted = deptRecs.filter(r => r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || r.status === RecordStatus.REJECTED).length;
    const dWithdrawn = deptRecs.filter(r => r.status === RecordStatus.WITHDRAWN).length;
    const dProcessing = dTotal - dCompleted - dWithdrawn;
    return { total: dTotal, completed: dCompleted, withdrawn: dWithdrawn, processing: dProcessing };
  };

  const measStats = useMemo(() => getDeptStats(measRecords), [measRecords]);
  const regStats = useMemo(() => getDeptStats(regRecords), [regRecords]);
  const archStats = useMemo(() => getDeptStats(archRecords), [archRecords]);

  const departmentChartData = useMemo(() => {
    return [
      { name: 'Đo đạc', value: measStats.total, color: '#3b82f6' },
      { name: 'Cấp giấy', value: regStats.total, color: '#a855f7' },
      { name: 'Lưu trữ & CV', value: archStats.total, color: '#10b981' }
    ].filter(d => d.value > 0);
  }, [measStats.total, regStats.total, archStats.total]);

  const wardData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredRecords.forEach(r => {
      const w = getNormalizedWard(r.ward) || 'Khác';
      counts[w] = (counts[w] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value); 
  }, [filteredRecords]);

  const typeData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredRecords.forEach(r => {
      const t = getShortRecordType(r.recordType);
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredRecords]);

  const getTitle = () => {
    if (viewMode === 'week') return "Tuần này";
    if (viewMode === 'month') return `Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`;
    return `Năm ${selectedYear}`;
  };

  return (
    <div className="p-4 space-y-4 pb-20">
      {/* View Mode Switcher */}
      <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 space-y-3">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-sm">
            <CalendarRange size={16} />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-sm">Thống kê tình hình</h2>
            <p className="text-[10px] text-slate-500 font-medium">Thống kê dữ liệu: <span className="text-blue-600 font-bold">{getTitle()}</span></p>
          </div>
        </div>
        
        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100">
          <button 
            onClick={() => setViewMode('week')}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${viewMode === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
          >
            <CalendarDays size={12} /> Tuần này
          </button>
          <button 
            onClick={() => setViewMode('month')}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${viewMode === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
          >
            <Calendar size={12} /> Tháng này
          </button>
          <div className="flex-1 flex items-center justify-center gap-1 px-1 border-l border-slate-200">
            <span className={`text-[10px] font-bold ${viewMode === 'year' ? 'text-blue-600' : 'text-slate-500'}`} onClick={() => setViewMode('year')}>Năm:</span>
            <select 
              value={selectedYear} 
              onChange={(e) => { setSelectedYear(parseInt(e.target.value)); setViewMode('year'); }}
              className="bg-transparent border-none text-[10px] font-bold text-slate-700 outline-none cursor-pointer hover:text-blue-600 transition-colors"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4 Cards Statistics */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">{stat.label}</p>
              <h3 className={`text-2xl font-black ${stat.textColor} mt-0.5`}>{stat.value}</h3>
              <p className="text-[9px] text-slate-500 font-medium mt-0.5">{stat.subText}</p>
            </div>
            <div className={`relative z-10 ${stat.color}/10 p-1.5 rounded-lg ${stat.textColor} shrink-0`}>
              <stat.icon size={18} />
            </div>
            <stat.icon size={48} className={`absolute -bottom-2 -right-2 opacity-5 ${stat.textColor} transform rotate-12`} />
          </div>
        ))}
      </div>

      {/* THỐNG KÊ CHI TIẾT 3 BỘ PHẬN CHÍNH */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Layers size={15} className="text-blue-600" /> THỐNG KÊ CHI TIẾT THEO BỘ PHẬN
          </h3>
        </div>
        
        <div className="space-y-3">
          {/* BỘ PHẬN ĐO ĐẠC */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/80 hover:border-blue-200 hover:bg-blue-50/5 transition-all flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-800">Bộ phận Đo đạc</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">Đo đạc</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center py-1.5 bg-white/60 rounded-lg">
              <div>
                <span className="text-[9px] text-gray-400 block font-semibold uppercase">Nhận</span>
                <span className="text-xs font-bold text-slate-850">{measStats.total}</span>
              </div>
              <div>
                <span className="text-[9px] text-yellow-600 block font-semibold uppercase">Đang XL</span>
                <span className="text-xs font-bold text-yellow-600">{measStats.processing}</span>
              </div>
              <div>
                <span className="text-[9px] text-green-600 block font-semibold uppercase">Xong</span>
                <span className="text-xs font-bold text-green-600">{measStats.completed}</span>
              </div>
            </div>
            {measStats.total > 0 && (
              <div className="mt-0.5">
                <div className="flex justify-between text-[9px] font-semibold text-slate-500 mb-0.5">
                  <span>Tỷ lệ hoàn thành</span>
                  <span className="text-blue-600 font-bold">{Math.round((measStats.completed / measStats.total) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${(measStats.completed / measStats.total) * 100}%` }}></div>
                </div>
              </div>
            )}
          </div>

          {/* BỘ PHẬN CẤP GIẤY */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/80 hover:border-purple-200 hover:bg-purple-50/5 transition-all flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-800">Bộ phận Cấp giấy</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">Cấp giấy & BD</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center py-1.5 bg-white/60 rounded-lg">
              <div>
                <span className="text-[9px] text-gray-400 block font-semibold uppercase">Nhận</span>
                <span className="text-xs font-bold text-slate-850">{regStats.total}</span>
              </div>
              <div>
                <span className="text-[9px] text-yellow-600 block font-semibold uppercase">Đang XL</span>
                <span className="text-xs font-bold text-yellow-600">{regStats.processing}</span>
              </div>
              <div>
                <span className="text-[9px] text-green-600 block font-semibold uppercase">Xong</span>
                <span className="text-xs font-bold text-green-600">{regStats.completed}</span>
              </div>
            </div>
            {regStats.total > 0 && (
              <div className="mt-0.5">
                <div className="flex justify-between text-[9px] font-semibold text-slate-500 mb-0.5">
                  <span>Tỷ lệ hoàn thành</span>
                  <span className="text-purple-600 font-bold">{Math.round((regStats.completed / regStats.total) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                  <div className="bg-purple-500 h-full rounded-full transition-all duration-500" style={{ width: `${(regStats.completed / regStats.total) * 100}%` }}></div>
                </div>
              </div>
            )}
          </div>

          {/* BỘ PHẬN LƯU TRỮ & CÔNG VĂN */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/80 hover:border-emerald-200 hover:bg-emerald-50/5 transition-all flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-800">Lưu trữ & Công văn</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">Lưu trữ & CV</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center py-1.5 bg-white/60 rounded-lg">
              <div>
                <span className="text-[9px] text-gray-400 block font-semibold uppercase">Nhận</span>
                <span className="text-xs font-bold text-slate-850">{archStats.total}</span>
              </div>
              <div>
                <span className="text-[9px] text-yellow-600 block font-semibold uppercase">Đang XL</span>
                <span className="text-xs font-bold text-yellow-600">{archStats.processing}</span>
              </div>
              <div>
                <span className="text-[9px] text-green-600 block font-semibold uppercase">Xong</span>
                <span className="text-xs font-bold text-green-600">{archStats.completed}</span>
              </div>
            </div>
            {archStats.total > 0 && (
              <div className="mt-0.5">
                <div className="flex justify-between text-[9px] font-semibold text-slate-500 mb-0.5">
                  <span>Tỷ lệ hoàn thành</span>
                  <span className="text-emerald-600 font-bold">{Math.round((archStats.completed / archStats.total) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${(archStats.completed / archStats.total) * 100}%` }}></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CHART 1: Phân bổ theo địa bàn */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[230px]">
        <h3 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5 uppercase tracking-wide">
          <MapPin size={15} className="text-blue-600" /> Phân bố theo địa bàn ({getTitle()})
        </h3>
        <div className="flex-1 min-h-0 w-full relative">
          {wardData.length > 0 ? (
            <div className="absolute inset-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={wardData} layout="vertical" margin={{ top: 5, right: 15, left: 15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                  <XAxis type="number" fontSize={8} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" width={60} fontSize={8} tick={{fill: '#4b5563', fontWeight: 605}} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: '#f3f4f6' }} 
                    contentStyle={{ borderRadius: '6px', border: 'none', padding: '4px 8px', fontSize: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} 
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={10} name="Số lượng" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
              <p>Chưa có dữ liệu địa bàn {getTitle()}</p>
            </div>
          )}
        </div>
      </div>

      {/* CHART 2: Phân loại / Phân hệ nghiệp vụ */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[230px]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
            <Layers size={15} className="text-purple-600" /> {chartMode === 'department' ? 'Cơ cấu 3 bộ phận nghiệp vụ' : 'Loại hình hồ sơ chi tiết'} ({getTitle()})
          </h3>
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setChartMode('department')}
              className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition-all ${chartMode === 'department' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
            >
              Bộ phận
            </button>
            <button
              onClick={() => setChartMode('type')}
              className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition-all ${chartMode === 'type' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
            >
              Chi tiết
            </button>
          </div>
        </div>
        <div className="w-full flex-1 min-h-0 relative">
          {chartMode === 'department' ? (
            departmentChartData.length > 0 ? (
              <div className="absolute inset-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={departmentChartData} 
                      cx="40%" 
                      cy="50%" 
                      innerRadius={30} 
                      outerRadius={50} 
                      paddingAngle={4} 
                      dataKey="value"
                    >
                      {departmentChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '6px', border: 'none', padding: '4px 8px', fontSize: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                    <Legend 
                      layout="vertical" 
                      verticalAlign="middle" 
                      align="right"
                      wrapperStyle={{ fontSize: '8px', fontWeight: 600, color: '#4b5563', paddingLeft: '5px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <p>Chưa có dữ liệu {getTitle()}</p>
              </div>
            )
          ) : (
            typeData.length > 0 ? (
              <div className="absolute inset-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={typeData.slice(0, 8)} 
                      cx="40%" 
                      cy="50%" 
                      innerRadius={30} 
                      outerRadius={50} 
                      paddingAngle={2} 
                      dataKey="value"
                    >
                      {typeData.slice(0, 8).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '6px', border: 'none', padding: '4px 8px', fontSize: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                    <Legend 
                      layout="vertical" 
                      verticalAlign="middle" 
                      align="right"
                      wrapperStyle={{ fontSize: '8px', fontWeight: 500, color: '#4b5563', paddingLeft: '5px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <p>Chưa có dữ liệu {getTitle()}</p>
              </div>
            )
          )}
        </div>
      </div>

      {/* Hoạt động gần đây */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 text-xs uppercase tracking-wide">
            <TrendingUp size={16} className="text-blue-600" />
            Hoạt động gần đây
          </h3>
        </div>
        <div className="divide-y divide-slate-50">
          {records.slice(0, 5).map((record, idx) => (
            <div key={idx} className="px-4 py-3 flex items-center gap-3 active:bg-slate-50 transition-colors">
              <div className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 shrink-0 border border-slate-100">
                <FileText size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{record.customerName}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[9px] font-mono text-blue-600 bg-blue-50 px-1 rounded">{record.code}</span>
                  <span className="text-[9px] text-slate-400">•</span>
                  <span className="text-[9px] text-slate-500">{STATUS_LABELS[record.status]}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[9px] text-slate-400 font-medium">{record.receivedDate}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MobileDashboard;

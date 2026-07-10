
import React, { useMemo, useState, useEffect } from 'react';
import { RecordFile, RecordStatus } from '../types';
import { getNormalizedWard, getShortRecordType, REGISTRATION_PROCEDURES } from '../constants';
import { isArchiveType } from '../utils/appHelpers';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FileText, RotateCcw, CheckCircle, ArchiveX, MapPin, Layers, CalendarRange, Filter, CalendarDays, Calendar } from 'lucide-react';

interface DashboardViewProps {
    records: RecordFile[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

const DashboardView: React.FC<DashboardViewProps> = ({ records }) => {
    // State chọn chế độ xem: Năm, Tháng, Tuần
    const [viewMode, setViewMode] = useState<'year' | 'month' | 'week'>('year');
    
    // State chọn năm (cho chế độ Year)
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    // State chọn biểu đồ: bộ phận hay loại hình
    const [chartMode, setChartMode] = useState<'department' | 'type'>('department');

    // 1. Tự động xác định danh sách các năm có trong dữ liệu
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        const currentYear = new Date().getFullYear();
        years.add(currentYear); // Luôn thêm năm hiện tại

        records.forEach(r => {
            if (r.receivedDate) {
                const y = new Date(r.receivedDate).getFullYear();
                if (!isNaN(y)) years.add(y);
            }
        });
        return Array.from(years).sort((a, b) => b - a);
    }, [records]);

    // 2. Lọc dữ liệu theo chế độ xem
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
                // Tháng này (của năm hiện tại)
                return rDate.getFullYear() === currentYear && rDate.getMonth() === currentMonth;
            } else if (viewMode === 'week') {
                // Tuần này (Tính từ Thứ 2 đầu tuần)
                const day = now.getDay();
                const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
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

    // 3. Tính toán thống kê chung
    const total = filteredRecords.length;
    const completed = filteredRecords.filter(r => r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || r.status === RecordStatus.REJECTED).length;
    const withdrawn = filteredRecords.filter(r => r.status === RecordStatus.WITHDRAWN).length;
    const processing = total - completed - withdrawn;

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

    // Thống kê chi tiết từng bộ phận
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

    // Data so sánh 3 bộ phận tốt nhất
    const departmentChartData = useMemo(() => {
        return [
            { name: 'Đo đạc', value: measStats.total, color: '#3b82f6' },
            { name: 'Cấp giấy', value: regStats.total, color: '#a855f7' },
            { name: 'Lưu trữ & Công văn', value: archStats.total, color: '#10b981' }
        ].filter(d => d.value > 0);
    }, [measStats.total, regStats.total, archStats.total]);

    // --- Data cho Biểu đồ Địa bàn (Xã/Phường) ---
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

    // --- Data cho Biểu đồ Loại hồ sơ ---
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
        <div className="h-full overflow-y-auto space-y-3 p-1 flex flex-col custom-scrollbar">
            
            {/* HEADER */}
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-3 shrink-0 sticky top-0 z-10">
                <div className="flex items-center gap-2.5 w-full md:w-auto">
                    <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-blue-200 shadow-md">
                        <CalendarRange size={20} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-gray-800">Tổng quan tình hình</h2>
                        <p className="text-[11px] text-gray-500 font-medium">Thống kê dữ liệu: <span className="text-blue-600 font-bold">{getTitle()}</span></p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button 
                        onClick={() => setViewMode('week')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${viewMode === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <CalendarDays size={12} /> Tuần này
                    </button>
                    <button 
                        onClick={() => setViewMode('month')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${viewMode === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Calendar size={12} /> Tháng này
                    </button>
                    <div className="h-3 w-px bg-slate-300 mx-0.5"></div>
                    <div className="flex items-center gap-1 px-1">
                        <span className={`text-[11px] font-bold ${viewMode === 'year' ? 'text-blue-600' : 'text-slate-500'}`} onClick={() => setViewMode('year')}>Năm:</span>
                        <select 
                            value={selectedYear} 
                            onChange={(e) => { setSelectedYear(parseInt(e.target.value)); setViewMode('year'); }}
                            className="bg-transparent border-none text-[11px] font-bold text-slate-700 outline-none cursor-pointer hover:text-blue-600 transition-colors"
                        >
                            {availableYears.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* CARDS: THỐNG KÊ CHI TIẾT */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden group">
                    <div className="absolute -bottom-4 -right-4 opacity-5 group-hover:opacity-10 transition-all duration-300 transform rotate-12 z-0">
                        <FileText size={60} className="text-blue-600" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Tổng nhận</p>
                        <h3 className="text-2xl font-black text-gray-800 mt-0.5">{total}</h3>
                        <p className="text-[9px] text-blue-600 font-medium mt-0.5">Hồ sơ</p>
                    </div>
                    <div className="relative z-10 bg-blue-50/80 p-2 rounded-lg text-blue-600 border border-blue-100 shrink-0">
                        <FileText size={18} />
                    </div>
                </div>

                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden group">
                    <div className="absolute -bottom-4 -right-4 opacity-5 group-hover:opacity-10 transition-all duration-300 transform rotate-12 z-0">
                        <RotateCcw size={60} className="text-yellow-600" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Đang xử lý</p>
                        <h3 className="text-2xl font-black text-yellow-600 mt-0.5">{processing}</h3>
                        <p className="text-[9px] text-yellow-600 font-medium mt-0.5">
                            Chiếm {total > 0 ? Math.round((processing / total) * 100) : 0}%
                        </p>
                    </div>
                    <div className="relative z-10 bg-yellow-50/80 p-2 rounded-lg text-yellow-600 border border-yellow-100 shrink-0">
                        <RotateCcw size={18} />
                    </div>
                </div>

                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden group">
                    <div className="absolute -bottom-4 -right-4 opacity-5 group-hover:opacity-10 transition-all duration-300 transform rotate-12 z-0">
                        <CheckCircle size={60} className="text-green-600" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Đã hoàn thành</p>
                        <h3 className="text-2xl font-black text-green-600 mt-0.5">{completed}</h3>
                        <p className="text-[9px] text-green-600 font-medium mt-0.5">
                            Chiếm {total > 0 ? Math.round((completed / total) * 100) : 0}%
                        </p>
                    </div>
                    <div className="relative z-10 bg-green-50/80 p-2 rounded-lg text-green-600 border border-green-100 shrink-0">
                        <CheckCircle size={18} />
                    </div>
                </div>

                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden group">
                    <div className="absolute -bottom-4 -right-4 opacity-5 group-hover:opacity-10 transition-all duration-300 transform rotate-12 z-0">
                        <ArchiveX size={60} className="text-slate-600" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Đã rút / Trả</p>
                        <h3 className="text-2xl font-black text-slate-600 mt-0.5">{withdrawn}</h3>
                        <p className="text-[9px] text-slate-500 font-medium mt-0.5">Hồ sơ</p>
                    </div>
                    <div className="relative z-10 bg-slate-50 p-2 rounded-lg text-slate-600 border border-slate-200 shrink-0">
                        <ArchiveX size={18} />
                    </div>
                </div>
            </div>

            {/* 3 BỘ PHẬN NGHIỆP VỤ CHÍNH */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers size={15} className="text-blue-600" /> THỐNG KÊ CHI TIẾT THEO BỘ PHẬN
                    </h3>
                    <span className="text-[10px] bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full border border-blue-100">
                        Phân bổ phòng ban
                    </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* BỘ PHẬN ĐO ĐẠC */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/5 transition-all flex flex-col justify-between gap-3 group">
                        <div>
                            <div className="flex justify-between items-center mb-2.5">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-blue-100/50 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
                                        <Layers size={15} />
                                    </div>
                                    <span className="text-xs font-bold text-gray-800">Bộ phận Đo đạc</span>
                                </div>
                                <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">Đo đạc</span>
                            </div>
                            <p className="text-[11px] text-gray-400 mb-3 font-medium leading-tight">Xử lý trích đo, trích lục bản đồ, cắm mốc</p>
                            
                            <div className="grid grid-cols-3 gap-2 text-center py-2 bg-white rounded-lg border border-slate-100">
                                <div>
                                    <span className="text-[9px] text-gray-400 block font-semibold uppercase">Nhận</span>
                                    <span className="text-xs font-bold text-slate-800">{measStats.total}</span>
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
                        </div>
                        {measStats.total > 0 ? (
                            <div className="mt-1">
                                <div className="flex justify-between text-[10px] font-semibold text-gray-500 mb-1">
                                    <span>Tỷ lệ hoàn thành</span>
                                    <span className="text-blue-600 font-bold">{Math.round((measStats.completed / measStats.total) * 100)}%</span>
                                </div>
                                <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                                    <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${(measStats.completed / measStats.total) * 100}%` }}></div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-1">
                                <span className="text-[11px] text-gray-400 font-medium">Chưa có hồ sơ</span>
                            </div>
                        )}
                    </div>

                    {/* BỘ PHẬN CẤP GIẤY */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-purple-200 hover:bg-purple-50/5 transition-all flex flex-col justify-between gap-3 group">
                        <div>
                            <div className="flex justify-between items-center mb-2.5">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-purple-100/50 rounded-lg text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-all shrink-0">
                                        <CheckCircle size={15} />
                                    </div>
                                    <span className="text-xs font-bold text-gray-800">Bộ phận Cấp giấy</span>
                                </div>
                                <span className="text-[9px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">Cấp giấy & BD</span>
                            </div>
                            <p className="text-[11px] text-gray-400 mb-3 font-medium leading-tight">Quy trình cấp đổi, cấp mới, thừa kế, tặng cho</p>
                            
                            <div className="grid grid-cols-3 gap-2 text-center py-2 bg-white rounded-lg border border-slate-100">
                                <div>
                                    <span className="text-[9px] text-gray-400 block font-semibold uppercase">Nhận</span>
                                    <span className="text-xs font-bold text-slate-800">{regStats.total}</span>
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
                        </div>
                        {regStats.total > 0 ? (
                            <div className="mt-1">
                                <div className="flex justify-between text-[10px] font-semibold text-gray-500 mb-1">
                                    <span>Tỷ lệ hoàn thành</span>
                                    <span className="text-purple-600 font-bold">{Math.round((regStats.completed / regStats.total) * 100)}%</span>
                                </div>
                                <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                                    <div className="bg-purple-500 h-full rounded-full transition-all duration-500" style={{ width: `${(regStats.completed / regStats.total) * 100}%` }}></div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-1">
                                <span className="text-[11px] text-gray-400 font-medium">Chưa có hồ sơ</span>
                            </div>
                        )}
                    </div>

                    {/* BỘ PHẬN LƯU TRỮ & CÔNG VĂN */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/5 transition-all flex flex-col justify-between gap-3 group">
                        <div>
                            <div className="flex justify-between items-center mb-2.5">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-emerald-100/50 rounded-lg text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all shrink-0">
                                        <FileText size={15} />
                                    </div>
                                    <span className="text-xs font-bold text-gray-800">Lưu trữ & Công văn</span>
                                </div>
                                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">Lưu trữ & CV</span>
                            </div>
                            <p className="text-[11px] text-gray-400 mb-3 font-medium leading-tight">Cung cấp tài liệu, sao lục hồ sơ và xử lý công văn đi/đến</p>
                            
                            <div className="grid grid-cols-3 gap-2 text-center py-2 bg-white rounded-lg border border-slate-100">
                                <div>
                                    <span className="text-[9px] text-gray-400 block font-semibold uppercase">Nhận</span>
                                    <span className="text-xs font-bold text-slate-800">{archStats.total}</span>
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
                        </div>
                        {archStats.total > 0 ? (
                            <div className="mt-1">
                                <div className="flex justify-between text-[10px] font-semibold text-gray-500 mb-1">
                                    <span>Tỷ lệ hoàn thành</span>
                                    <span className="text-emerald-600 font-bold">{Math.round((archStats.completed / archStats.total) * 100)}%</span>
                                </div>
                                <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                                    <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${(archStats.completed / archStats.total) * 100}%` }}></div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-1">
                                <span className="text-[11px] text-gray-400 font-medium">Chưa có hồ sơ</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* CHARTS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 shrink-0">
                {/* CHART 1: Thống kê theo Địa bàn */}
                <div className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[230px]">
                    <h3 className="text-xs font-bold text-gray-800 mb-2 shrink-0 flex items-center gap-1.5 uppercase tracking-wide">
                        <MapPin size={15} className="text-blue-600" /> Phân bố theo địa bàn ({getTitle()})
                    </h3>
                    <div className="flex-1 min-h-0 w-full relative">
                        {wardData.length > 0 ? (
                            <div className="absolute inset-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={wardData} layout="vertical" margin={{ top: 5, right: 15, left: 15, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                                        <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis dataKey="name" type="category" width={75} fontSize={10} tick={{fill: '#4b5563', fontWeight: 600}} tickLine={false} axisLine={false} />
                                        <Tooltip 
                                            cursor={{ fill: '#f3f4f6' }} 
                                            contentStyle={{ borderRadius: '6px', border: 'none', padding: '6px 10px', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                                        />
                                        <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12} name="Số lượng" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs">
                                <p>Chưa có dữ liệu {getTitle()}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* CHART 2: Phân loại / Phân hệ nghiệp vụ */}
                <div className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[230px]">
                    <div className="flex items-center justify-between mb-2 shrink-0">
                        <h3 className="text-xs font-bold text-gray-800 flex items-center gap-1.5 uppercase tracking-wide">
                            <Layers size={15} className="text-purple-600" /> {chartMode === 'department' ? 'Cơ cấu 3 bộ phận nghiệp vụ' : 'Loại hình hồ sơ chi tiết'} ({getTitle()})
                        </h3>
                        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
                            <button
                                onClick={() => setChartMode('department')}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${chartMode === 'department' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                Bộ phận
                            </button>
                            <button
                                onClick={() => setChartMode('type')}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${chartMode === 'type' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
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
                                                cx="45%" 
                                                cy="50%" 
                                                innerRadius={40} 
                                                outerRadius={65} 
                                                paddingAngle={4} 
                                                dataKey="value"
                                            >
                                                {departmentChartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ borderRadius: '6px', border: 'none', padding: '6px 10px', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                            <Legend 
                                                layout="vertical" 
                                                verticalAlign="middle" 
                                                align="right"
                                                wrapperStyle={{ fontSize: '10px', fontWeight: 600, color: '#4b5563', paddingLeft: '10px' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs">
                                    <p>Chưa có dữ liệu bộ phận {getTitle()}</p>
                                </div>
                            )
                        ) : (
                            typeData.length > 0 ? (
                                <div className="absolute inset-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie 
                                                data={typeData} 
                                                cx="45%" 
                                                cy="50%" 
                                                innerRadius={40} 
                                                outerRadius={65} 
                                                paddingAngle={2} 
                                                dataKey="value"
                                            >
                                                {typeData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ borderRadius: '6px', border: 'none', padding: '6px 10px', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                            <Legend 
                                                layout="vertical" 
                                                verticalAlign="middle" 
                                                align="right"
                                                wrapperStyle={{ fontSize: '10px', fontWeight: 500, color: '#4b5563', paddingLeft: '10px' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs">
                                    <p>Chưa có dữ liệu {getTitle()}</p>
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardView;

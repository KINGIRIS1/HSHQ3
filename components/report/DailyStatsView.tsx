import React, { useState, useMemo, useEffect } from 'react';
import { RecordFile, Employee, RecordStatus } from '../../types';
import { 
    CalendarDays, 
    Search, 
    FileSpreadsheet, 
    ChevronLeft, 
    ChevronRight, 
    MapPin, 
    Users, 
    CheckCircle2, 
    ArrowRight 
} from 'lucide-react';
import { getNormalizedWard, STATUS_LABELS, getShortRecordType } from '../../constants';
import { exportDailyStatsToExcel } from '../../utils/excelExport';

interface DailyStatsViewProps {
    records: RecordFile[];
    employees: Employee[];
    wards: string[];
    onFilteredRecordsChange?: (records: RecordFile[]) => void;
}

const DailyStatsView: React.FC<DailyStatsViewProps> = ({ records, employees, wards, onFilteredRecordsChange }) => {
    // Current active tab/card
    const [activeTab, setActiveTab] = useState<'received' | 'assigned' | 'handover'>('received');

    // Filter states
    const [fromDateFilter, setFromDateFilter] = useState('');
    const [toDateFilter, setToDateFilter] = useState('');
    const [wardFilter, setWardFilter] = useState('all');
    const [employeeFilter, setEmployeeFilter] = useState('all');
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);

    // Calculate filtered counts for dashboard cards
    const cardCounts = useMemo(() => {
        let received = 0;
        let assigned = 0;
        let handover = 0;

        records.forEach(r => {
            // Apply Ward filter
            if (wardFilter !== 'all' && getNormalizedWard(r.ward) !== wardFilter) return;

            // Apply Employee filter
            if (employeeFilter !== 'all') {
                if (employeeFilter === 'unassigned') {
                    if (r.assignedTo) return;
                } else if (r.assignedTo !== employeeFilter) {
                    return;
                }
            }

            // Received count check
            if (r.receivedDate) {
                const rDate = new Date(r.receivedDate); rDate.setHours(0,0,0,0);
                let match = true;
                if (fromDateFilter) {
                    const from = new Date(fromDateFilter); from.setHours(0,0,0,0);
                    if (rDate < from) match = false;
                }
                if (toDateFilter) {
                    const to = new Date(toDateFilter); to.setHours(23,59,59,999);
                    if (rDate > to) match = false;
                }
                if (match) received++;
            }

            // Assigned count check
            if (r.assignedDate) {
                const aDate = new Date(r.assignedDate); aDate.setHours(0,0,0,0);
                let match = true;
                if (fromDateFilter) {
                    const from = new Date(fromDateFilter); from.setHours(0,0,0,0);
                    if (aDate < from) match = false;
                }
                if (toDateFilter) {
                    const to = new Date(toDateFilter); to.setHours(23,59,59,999);
                    if (aDate > to) match = false;
                }
                if (match) assigned++;
            }

            // Handover count check
            if (r.completedDate) {
                const cDate = new Date(r.completedDate); cDate.setHours(0,0,0,0);
                let match = true;
                if (fromDateFilter) {
                    const from = new Date(fromDateFilter); from.setHours(0,0,0,0);
                    if (cDate < from) match = false;
                }
                if (toDateFilter) {
                    const to = new Date(toDateFilter); to.setHours(23,59,59,999);
                    if (cDate > to) match = false;
                }
                if (match) handover++;
            }
        });

        return { received, assigned, handover };
    }, [records, fromDateFilter, toDateFilter, wardFilter, employeeFilter]);

    // Dynamic Record Filtering
    const modalFilteredRecords = useMemo(() => {
        return records.filter(r => {
            // 1. Lọc theo khoảng ngày tương ứng của từng Tab
            let matchDate = true;
            if (activeTab === 'received') {
                if (!r.receivedDate) {
                    matchDate = false;
                } else {
                    const rDate = new Date(r.receivedDate);
                    rDate.setHours(0,0,0,0);
                    if (fromDateFilter) {
                        const from = new Date(fromDateFilter); from.setHours(0,0,0,0);
                        if (rDate < from) matchDate = false;
                    }
                    if (toDateFilter) {
                        const to = new Date(toDateFilter); to.setHours(23,59,59,999);
                        if (rDate > to) matchDate = false;
                    }
                }
            } else if (activeTab === 'assigned') {
                if (!r.assignedDate) {
                    matchDate = false;
                } else {
                    const rDate = new Date(r.assignedDate);
                    rDate.setHours(0,0,0,0);
                    if (fromDateFilter) {
                        const from = new Date(fromDateFilter); from.setHours(0,0,0,0);
                        if (rDate < from) matchDate = false;
                    }
                    if (toDateFilter) {
                        const to = new Date(toDateFilter); to.setHours(23,59,59,999);
                        if (rDate > to) matchDate = false;
                    }
                }
            } else if (activeTab === 'handover') {
                if (!r.completedDate) {
                    matchDate = false;
                } else {
                    const rDate = new Date(r.completedDate);
                    rDate.setHours(0,0,0,0);
                    if (fromDateFilter) {
                        const from = new Date(fromDateFilter); from.setHours(0,0,0,0);
                        if (rDate < from) matchDate = false;
                    }
                    if (toDateFilter) {
                        const to = new Date(toDateFilter); to.setHours(23,59,59,999);
                        if (rDate > to) matchDate = false;
                    }
                }
            }

            // 2. Lọc theo Xã/Phường
            let matchWard = true;
            if (wardFilter !== 'all') {
                matchWard = getNormalizedWard(r.ward) === wardFilter;
            }

            // 3. Lọc theo nhân viên xử lý
            let matchEmployee = true;
            if (employeeFilter !== 'all') {
                if (employeeFilter === 'unassigned') {
                    matchEmployee = !r.assignedTo;
                } else {
                    matchEmployee = r.assignedTo === employeeFilter;
                }
            }

            return matchDate && matchWard && matchEmployee;
        });
    }, [records, activeTab, fromDateFilter, toDateFilter, wardFilter, employeeFilter]);

    // Keep parent component notified of active filtered records
    useEffect(() => {
        if (onFilteredRecordsChange) {
            onFilteredRecordsChange(modalFilteredRecords);
        }
    }, [modalFilteredRecords, onFilteredRecordsChange]);

    // Reset pagination and filters when changing active tab
    useEffect(() => {
        setCurrentPage(1);
        setFromDateFilter('');
        setToDateFilter('');
        setWardFilter('all');
        setEmployeeFilter('all');
    }, [activeTab]);

    // Reset pagination when other filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [fromDateFilter, toDateFilter, wardFilter, employeeFilter]);

    // Pagination calculations
    const totalPages = Math.ceil(modalFilteredRecords.length / itemsPerPage);
    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return modalFilteredRecords.slice(start, start + itemsPerPage);
    }, [modalFilteredRecords, currentPage, itemsPerPage]);

    // Export to Excel handler
    const handleExportFromModal = () => {
        if (modalFilteredRecords.length === 0) {
            alert('Không có hồ sơ nào để xuất.');
            return;
        }

        if (activeTab === 'received') {
            exportDailyStatsToExcel(
                modalFilteredRecords, 
                employees, 
                fromDateFilter, 
                toDateFilter, 
                '', ''
            );
        } else if (activeTab === 'assigned') {
            exportDailyStatsToExcel(
                modalFilteredRecords, 
                employees, 
                '', '', 
                '', '', 
                fromDateFilter, 
                toDateFilter
            );
        } else if (activeTab === 'handover') {
            exportDailyStatsToExcel(
                modalFilteredRecords, 
                employees, 
                '', '', 
                '', '', 
                '', '', 
                fromDateFilter, 
                toDateFilter
            );
        }
    };

    const formatDate = (d?: string | null) => {
        if (!d) return '-';
        const date = new Date(d);
        if (isNaN(date.getTime())) return '-';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const cards = [
        {
            id: 'received' as const,
            label: 'HỒ SƠ TIẾP NHẬN',
            count: cardCounts.received,
            icon: <CalendarDays size={20} />,
            colorClass: 'text-blue-700',
            textClass: 'text-blue-600',
            numClass: 'text-blue-900',
            bgIcon: 'bg-blue-100',
            activeClass: 'bg-blue-50 border-blue-400 ring-2 ring-blue-300 shadow-sm',
            inactiveClass: 'bg-white border-slate-200 hover:border-blue-300'
        },
        {
            id: 'assigned' as const,
            label: 'HỒ SƠ GIAO VIỆC',
            count: cardCounts.assigned,
            icon: <Users size={20} />,
            colorClass: 'text-orange-700',
            textClass: 'text-orange-600',
            numClass: 'text-orange-900',
            bgIcon: 'bg-orange-100',
            activeClass: 'bg-orange-50 border-orange-400 ring-2 ring-orange-300 shadow-sm',
            inactiveClass: 'bg-white border-slate-200 hover:border-orange-300'
        },
        {
            id: 'handover' as const,
            label: 'HỒ SƠ HOÀN THÀNH',
            count: cardCounts.handover,
            icon: <CheckCircle2 size={20} />,
            colorClass: 'text-green-700',
            textClass: 'text-green-600',
            numClass: 'text-green-900',
            bgIcon: 'bg-green-100',
            activeClass: 'bg-green-50 border-green-400 ring-2 ring-green-300 shadow-sm',
            inactiveClass: 'bg-white border-slate-200 hover:border-green-300'
        }
    ];

    return (
        <div className="flex flex-col h-full bg-slate-100 p-4 gap-4 overflow-y-hidden">
            {/* Premium clickable filter cards at the top */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0 animate-fade-in">
                {cards.map(card => (
                    <div 
                        key={card.id}
                        onClick={() => {
                            setActiveTab(card.id);
                        }}
                        className={`p-3.5 rounded-xl border flex items-center gap-4 cursor-pointer transition-all hover:scale-[1.02] ${
                            activeTab === card.id 
                                ? card.activeClass
                                : `${card.inactiveClass} shadow-sm`
                        }`}
                    >
                        <div className={`${card.bgIcon} p-2.5 rounded-lg ${card.colorClass}`}>
                            {card.icon}
                        </div>
                        <div>
                            <div className={`text-2xl font-bold leading-tight ${card.numClass}`}>{card.count}</div>
                            <div className={`text-[11px] uppercase font-extrabold tracking-wider ${card.textClass}`}>{card.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* List and filters directly below */}
            <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Header with Title and Export Button */}
                <div className="p-4 border-b border-slate-150 bg-slate-50/50 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-lg text-white ${
                            activeTab === 'received' ? 'bg-blue-600' :
                            activeTab === 'assigned' ? 'bg-orange-600' : 'bg-green-600'
                        }`}>
                            {activeTab === 'received' ? <CalendarDays size={14} /> :
                             activeTab === 'assigned' ? <Users size={14} /> : <CheckCircle2 size={14} />}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                                {activeTab === 'received' && 'Danh sách thống kê hồ sơ theo Ngày nhận'}
                                {activeTab === 'assigned' && 'Danh sách thống kê hồ sơ theo Ngày giao nhân viên'}
                                {activeTab === 'handover' && 'Danh sách thống kê hồ sơ theo Ngày bàn giao 1 cửa'}
                            </h3>
                            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                                Đang hiển thị <span className="font-bold text-slate-800">{modalFilteredRecords.length}</span> hồ sơ trong danh sách lọc
                            </p>
                        </div>
                    </div>

                    <button 
                        onClick={handleExportFromModal}
                        disabled={modalFilteredRecords.length === 0}
                        className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm transition-all disabled:opacity-45 disabled:cursor-not-allowed h-[34px]"
                    >
                        <FileSpreadsheet size={14} /> Xuất Excel ({modalFilteredRecords.length})
                    </button>
                </div>

                {/* Filters Toolbar */}
                <div className="px-4 py-3 bg-slate-50/30 border-b border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-3 shrink-0 items-end">
                    <div className="md:col-span-5">
                        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
                            {activeTab === 'received' && 'Khoảng ngày nhận hồ sơ'}
                            {activeTab === 'assigned' && 'Khoảng ngày giao nhân viên'}
                            {activeTab === 'handover' && 'Khoảng ngày bàn giao Một cửa'}
                        </label>
                        <div className="flex items-center gap-2">
                            <input 
                                type="date" 
                                value={fromDateFilter} 
                                onChange={e => setFromDateFilter(e.target.value)} 
                                className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs w-full bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-[34px] font-bold text-gray-700 shadow-sm" 
                                title="Từ ngày" 
                            />
                            <span className="text-slate-400 font-bold shrink-0 px-0.5 text-xs">đến</span>
                            <input 
                                type="date" 
                                value={toDateFilter} 
                                onChange={e => setToDateFilter(e.target.value)} 
                                className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs w-full bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-[34px] font-bold text-gray-700 shadow-sm" 
                                title="Đến ngày" 
                            />
                        </div>
                    </div>

                    <div className="md:col-span-35 md:col-span-3">
                        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Địa bàn Xã / Phường</label>
                        <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 border border-slate-200 rounded-lg h-[34px] focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 shadow-sm">
                            <MapPin size={14} className="text-slate-400 shrink-0" />
                            <select 
                                value={wardFilter} 
                                onChange={(e) => setWardFilter(e.target.value)} 
                                className="text-xs outline-none bg-transparent text-slate-700 font-bold cursor-pointer border-none focus:ring-0 w-full p-0"
                            >
                                <option value="all">Toàn bộ địa bàn</option>
                                {wards.map(w => (
                                    <option key={w} value={w}>{w}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="md:col-span-4">
                        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Nhân viên xử lý</label>
                        <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 border border-slate-200 rounded-lg h-[34px] focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 shadow-sm">
                            <Search size={14} className="text-slate-400 shrink-0" />
                            <select 
                                value={employeeFilter} 
                                onChange={(e) => setEmployeeFilter(e.target.value)} 
                                className="text-xs outline-none bg-transparent text-slate-700 font-bold cursor-pointer border-none focus:ring-0 w-full p-0"
                            >
                                <option value="all">Tất cả nhân viên</option>
                                <option value="unassigned">Chưa giao</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Table List of Records */}
                <div className="flex-1 overflow-auto custom-scrollbar">
                    {paginatedRecords.length > 0 ? (
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-wider sticky top-0 shadow-sm z-10 border-b border-slate-100">
                                <tr>
                                    <th className="p-3 w-12 text-center">STT</th>
                                    <th className="p-3 w-32">Mã biên nhận</th>
                                    <th className="p-3 w-32">Loại thủ tục</th>
                                    <th className="p-3 w-48">Chủ sử dụng đất</th>
                                    <th className="p-3 w-36">Xã / Phường</th>
                                    <th className="p-3 w-28">Ngày nhận</th>
                                    <th className="p-3 w-28">Hẹn trả</th>
                                    <th className="p-3 w-28">Hoàn thành</th>
                                    <th className="p-3 w-40">Cán bộ xử lý</th>
                                    <th className="p-3 w-32 text-center">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {paginatedRecords.map((r, i) => {
                                    const emp = employees.find(e => e.id === r.assignedTo);
                                    const rowIndex = (currentPage - 1) * itemsPerPage + i + 1;
                                    return (
                                        <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="p-3 text-center text-gray-400 font-mono font-bold">{rowIndex}</td>
                                            <td className="p-3 font-semibold text-blue-700">{r.code}</td>
                                            <td className="p-3 text-gray-600 font-semibold" title={r.recordType || ''}>{getShortRecordType(r.recordType)}</td>
                                            <td className="p-3 font-bold text-gray-800">{r.customerName}</td>
                                            <td className="p-3 text-gray-600 font-medium">{getNormalizedWard(r.ward)}</td>
                                            <td className="p-3 text-gray-500 font-medium">{formatDate(r.receivedDate)}</td>
                                            <td className="p-3 font-semibold text-amber-700">{formatDate(r.deadline)}</td>
                                            <td className="p-3 font-semibold text-emerald-700">{formatDate(r.completedDate || r.resultReturnedDate)}</td>
                                            <td className="p-3 text-gray-600 font-bold max-w-[120px] truncate" title={emp?.name}>{emp ? emp.name : '-'}</td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2.5 py-1 rounded text-[10px] uppercase font-bold tracking-wider border ${
                                                    r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED ? 'bg-green-50 text-green-800 border-green-200' : 
                                                    r.status === RecordStatus.WITHDRAWN ? 'bg-gray-150 text-gray-600 border-gray-200 bg-gray-50' :
                                                    r.status === RecordStatus.PENDING_SIGN || r.status === RecordStatus.SIGNED ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                    r.status === RecordStatus.COMPLETED_WORK ? 'bg-teal-50 text-teal-700 border-teal-200' :
                                                    'bg-blue-50 text-blue-700 border-blue-200'
                                                }`}>
                                                    {STATUS_LABELS[r.status] || r.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="h-48 flex flex-col items-center justify-center text-gray-400 text-xs italic p-8">
                            <p>Không có dữ liệu phù hợp với bộ lọc nêu trên. Vui lòng thử thay đổi khoảng ngày hoặc địa bàn xã phường.</p>
                        </div>
                    )}
                </div>

                {/* Pagination Footer */}
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-medium">Hiển thị</span>
                        <select 
                            value={itemsPerPage} 
                            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                            className="border border-slate-200 rounded px-2 py-1 text-xs outline-none bg-white font-bold text-gray-700"
                        >
                            <option value={10}>10</option>
                            <option value={15}>15</option>
                            <option value={30}>30</option>
                            <option value={50}>50</option>
                        </select>
                        <span className="text-xs text-gray-500 font-medium">dòng mỗi trang</span>
                    </div>

                    <div className="text-xs font-bold text-slate-600">
                        Tổng số tìm thấy: <span className="text-blue-600 font-black">{modalFilteredRecords.length}</span> hồ sơ
                    </div>
                    
                    {totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-1 rounded-md hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft size={16} className="text-gray-600" />
                            </button>
                            
                            <div className="flex items-center gap-1 px-1">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum = currentPage;
                                    if (currentPage <= 3) pageNum = i + 1;
                                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                    else pageNum = currentPage - 2 + i;
                                    
                                    if (pageNum > 0 && pageNum <= totalPages) {
                                        const activeThemeClass = 
                                            activeTab === 'received' ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300' :
                                            activeTab === 'assigned' ? 'bg-orange-600 text-white shadow-sm ring-2 ring-orange-300' :
                                            'bg-green-600 text-white shadow-sm ring-2 ring-green-300';
                                        return (
                                            <button 
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`w-7 h-7 rounded text-xs font-bold flex items-center justify-center transition-all ${
                                                    currentPage === pageNum 
                                                        ? activeThemeClass 
                                                        : 'text-gray-600 hover:bg-gray-200'
                                                }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    }
                                    return null;
                                })}
                            </div>

                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-1 rounded-md hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronRight size={16} className="text-gray-600" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DailyStatsView;

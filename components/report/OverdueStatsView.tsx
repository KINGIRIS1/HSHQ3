import React, { useMemo, useState } from 'react';
import { RecordFile, RecordStatus, Employee } from '../../types';
import { getNormalizedWard, STATUS_LABELS, getShortRecordType } from '../../constants';
import { isRecordOverdue } from '../../utils/appHelpers';
import { exportOverdueStatsToExcel } from '../../utils/excelExport';
import { AlertTriangle, CheckCircle2, Clock, MapPin, ChevronLeft, ChevronRight, Download, ListFilter } from 'lucide-react';

interface OverdueStatsViewProps {
    records: RecordFile[];
    employees: Employee[];
}

const OverdueStatsView: React.FC<OverdueStatsViewProps> = ({ records, employees }) => {
    const [filterType, setFilterType] = useState<'all' | 'completed' | 'pending'>('all');
    const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    const overdueData = useMemo(() => {
        const completed: RecordFile[] = [];
        const pending: RecordFile[] = [];

        records.forEach(r => {
            // Apply selectedEmployee filter
            if (selectedEmployee !== 'all') {
                if (selectedEmployee === 'unassigned') {
                    if (r.assignedTo) return;
                } else {
                    if (r.assignedTo !== selectedEmployee) return;
                }
            }

            // Check pending overdue
            const isDone = r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || r.status === RecordStatus.SIGNED || !!r.exportBatch;
            const isWithdrawnOrRejected = r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.REJECTED;
            
            if (!isDone && !isWithdrawnOrRejected) {
                if (isRecordOverdue(r)) {
                    pending.push(r);
                }
            } else if (isDone) {
                if (r.deadline && r.completedDate) {
                    const d = new Date(r.deadline); d.setHours(0,0,0,0);
                    const c = new Date(r.completedDate); c.setHours(0,0,0,0);
                    if (c > d) {
                        completed.push(r);
                    }
                }
            }
        });

        // Add an extra property to indicate type of overdue
        const completedWithType = completed.map(r => ({ ...r, _overdueType: 'completed' }));
        const pendingWithType = pending.map(r => ({ ...r, _overdueType: 'pending' }));

        let combined = [...completedWithType, ...pendingWithType];
        
        if (filterType === 'completed') {
            combined = completedWithType;
        } else if (filterType === 'pending') {
            combined = pendingWithType;
        }

        // Sort by deadline ascending (most overdue first)
        combined.sort((a, b) => {
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        });

        return {
            totalCompleted: completed.length,
            totalPending: pending.length,
            filteredRecords: combined
        };
    }, [records, filterType, selectedEmployee]);

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return overdueData.filteredRecords.slice(start, start + itemsPerPage);
    }, [overdueData.filteredRecords, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(overdueData.filteredRecords.length / itemsPerPage);

    const generalStats = useMemo(() => {
        let total = 0;
        let completed = 0;
        let processing = 0;
        let overduePending = 0;
        let overdueCompleted = 0;

        records.forEach(r => {
            // Apply selectedEmployee filter
            if (selectedEmployee !== 'all') {
                if (selectedEmployee === 'unassigned') {
                    if (r.assignedTo) return;
                } else {
                    if (r.assignedTo !== selectedEmployee) return;
                }
            }

            total++;

            const isDone = r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || r.status === RecordStatus.SIGNED || !!r.exportBatch || !!r.exportDate;
            const isWithdrawnOrRejected = r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.REJECTED;

            if (isDone) {
                completed++;
                if (r.deadline && (r.completedDate || r.exportDate || r.receivedDate)) {
                    const d = new Date(r.deadline); d.setHours(0,0,0,0);
                    const refDate = r.completedDate || r.exportDate || r.receivedDate;
                    const c = new Date(refDate!); c.setHours(0,0,0,0);
                    if (c > d) overdueCompleted++;
                }
            } else {
                processing++;
                if (isRecordOverdue(r)) {
                    overduePending++;
                }
            }
        });

        return {
            total,
            completed,
            processing,
            overduePending,
            overdueCompleted
        };
    }, [records, selectedEmployee]);

    // Reset page when filter changes
    React.useEffect(() => {
        setCurrentPage(1);
    }, [filterType, selectedEmployee, records]);

    const formatDate = (d?: string | null) => {
        if (!d) return '-';
        const date = new Date(d);
        if (isNaN(date.getTime())) return '-';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    return (
        <div className="flex flex-col h-full bg-slate-100 p-4 gap-4 overflow-y-hidden">
            {/* Tóm tắt */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0 animate-fade-in">
                {/* Card 1: Tổng hồ sơ */}
                <div 
                    onClick={() => setFilterType('all')}
                    className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.02] ${filterType === 'all' ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-300 shadow-sm' : 'bg-white border-blue-100 hover:border-blue-300'}`}
                >
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-700"><ListFilter size={20}/></div>
                    <div>
                        <div className="text-2xl font-bold text-blue-900 leading-tight">{generalStats.total}</div>
                        <div className="text-[11px] text-blue-600 uppercase font-extrabold tracking-wider">Tổng hồ sơ</div>
                    </div>
                </div>

                {/* Card 2: Đã xong (Trễ - đã có kết quả) */}
                <div 
                    onClick={() => setFilterType('completed')}
                    className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.02] ${filterType === 'completed' ? 'bg-green-50 border-green-400 ring-2 ring-green-300 shadow-sm' : 'bg-white border-green-100 hover:border-green-300'}`}
                >
                    <div className="bg-green-100 p-2 rounded-lg text-green-700"><CheckCircle2 size={20}/></div>
                    <div>
                        <div className="text-2xl font-bold text-green-900 leading-tight">{generalStats.overdueCompleted}</div>
                        <div className="text-[11px] text-green-600 uppercase font-extrabold tracking-wider">Đã xong (Trễ)</div>
                    </div>
                </div>

                {/* Card 3: Đang xử lý (Trễ - chưa có kết quả) */}
                <div 
                    onClick={() => setFilterType('pending')}
                    className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.02] ${filterType === 'pending' ? 'bg-orange-50 border-orange-400 ring-2 ring-orange-300 shadow-sm' : 'bg-white border-orange-100 hover:border-orange-300'}`}
                >
                    <div className="bg-orange-100 p-2 rounded-lg text-orange-700"><Clock size={20}/></div>
                    <div>
                        <div className="text-2xl font-bold text-orange-900 leading-tight">{generalStats.overduePending}</div>
                        <div className="text-[11px] text-orange-600 uppercase font-extrabold tracking-wider">Chưa xong (Trễ)</div>
                    </div>
                </div>

                {/* Card 4: Tổng trễ hạn */}
                <div className={`bg-red-50 border p-3 rounded-xl flex items-center gap-3 transition-all cursor-pointer hover:scale-[1.02] ${filterType === 'all' ? 'border-red-400 ring-2 ring-red-300 shadow-sm' : 'border-red-100'}`} onClick={() => setFilterType('all')}>
                    <div className="bg-red-200 p-2 rounded-lg text-red-700">
                        <AlertTriangle size={20}/>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div 
                            className={`flex justify-between items-center text-red-800 cursor-pointer px-1 rounded hover:bg-red-100/50 transition-colors ${filterType === 'pending' ? 'bg-red-100/80 font-bold' : ''}`}
                            onClick={(e) => { e.stopPropagation(); setFilterType('pending'); }} 
                            title="Xem trễ - chưa có kết quả"
                        >
                            <span className="text-xs font-semibold">Chưa xong:</span>
                            <span className="text-base font-bold">{generalStats.overduePending}</span>
                        </div>
                        <div 
                            className={`flex justify-between items-center text-red-600/80 cursor-pointer px-1 rounded hover:bg-red-100/50 transition-colors ${filterType === 'completed' ? 'bg-red-100/80 font-bold' : ''}`}
                            onClick={(e) => { e.stopPropagation(); setFilterType('completed'); }} 
                            title="Xem trễ - đã có kết quả"
                        >
                            <span className="text-xs font-semibold">Đã xong:</span>
                            <span className="text-xs font-bold">{generalStats.overdueCompleted}</span>
                        </div>
                        <div 
                            className="text-[10px] text-red-600 uppercase font-bold text-center mt-1 pt-1 border-t border-red-200 cursor-pointer hover:underline" 
                            onClick={(e) => { e.stopPropagation(); setFilterType('all'); }}
                        >
                            Tổng trễ hạn: {generalStats.overduePending + generalStats.overdueCompleted}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bảng dữ liệu */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col flex-1 overflow-hidden">
                <div className="p-4 border-b flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-gray-50/50">
                    <h3 className="font-bold text-gray-700 shrink-0">
                        {filterType === 'all' ? 'Tất cả hồ sơ trễ hạn' : filterType === 'pending' ? 'Hồ sơ trễ - Chưa có kết quả' : 'Hồ sơ trễ - Đã có kết quả'}
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-gray-300 rounded-lg h-[36px] w-full sm:w-64 focus-within:border-red-400 focus-within:ring-1 focus-within:ring-red-400">
                            <span className="text-xs font-bold text-gray-500 whitespace-nowrap">Cán bộ xử lý:</span>
                            <select 
                                value={selectedEmployee} 
                                onChange={(e) => setSelectedEmployee(e.target.value)} 
                                className="text-sm outline-none bg-transparent text-gray-700 font-semibold cursor-pointer border-none focus:ring-0 p-0 w-full"
                            >
                                <option value="all">Tất cả cán bộ</option>
                                <option value="unassigned">Chưa phân công</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                ))}
                            </select>
                        </div>

                        <button 
                            onClick={() => exportOverdueStatsToExcel(overdueData.filteredRecords, employees, filterType)}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold text-sm shadow-sm h-[36px] min-w-[120px] ml-auto shrink-0"
                        >
                            <Download size={16} /> Xuất Excel
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-bold sticky top-0 shadow-sm z-10">
                            <tr>
                                <th className="p-3 w-10 text-center">#</th>
                                <th className="p-3">Mã HS</th>
                                <th className="p-3">Loại thủ tục</th>
                                <th className="p-3">Chủ sử dụng</th>
                                <th className="p-3">Xã/Phường</th>
                                <th className="p-3">Loại trễ</th>
                                <th className="p-3">Ngày nhận</th>
                                <th className="p-3">Hẹn trả</th>
                                <th className="p-3">Hoàn thành</th>
                                <th className="p-3">NV Xử lý</th>
                                <th className="p-3 text-center">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {paginatedData.length > 0 ? paginatedData.map((r: any, i) => {
                                const emp = employees.find(e => e.id === r.assignedTo);
                                const rowIndex = (currentPage - 1) * itemsPerPage + i + 1;
                                const isPendingOverdue = r._overdueType === 'pending';
                                
                                return (
                                <tr key={r.id} className="hover:bg-red-50/30 transition-colors">
                                    <td className="p-3 text-center text-gray-400">{rowIndex}</td>
                                    <td className="p-3 font-medium text-red-600">{r.code}</td>
                                    <td className="p-3 text-gray-600 font-semibold" title={r.recordType || ''}>{getShortRecordType(r.recordType)}</td>
                                    <td className="p-3 font-medium">{r.customerName}</td>
                                    <td className="p-3 text-gray-600 flex items-center gap-1"><MapPin size={12}/>{getNormalizedWard(r.ward)}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 flex w-fit items-center gap-1 rounded text-xs font-bold ${isPendingOverdue ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {isPendingOverdue ? <Clock size={12}/> : <CheckCircle2 size={12}/>}
                                            {isPendingOverdue ? 'Chưa có kết quả' : 'Đã có kết quả'}
                                        </span>
                                    </td>
                                    <td className="p-3 text-gray-600">{formatDate(r.receivedDate)}</td>
                                    <td className="p-3 font-bold text-red-600">{formatDate(r.deadline)}</td>
                                    <td className="p-3 text-gray-600">{formatDate(r.completedDate)}</td>
                                    <td className="p-3 text-gray-600 truncate max-w-[150px]" title={emp?.name}>{emp ? emp.name : '-'}</td>
                                    <td className="p-3 text-center">
                                        <span className="px-2 py-1 rounded text-xs border bg-gray-50 text-gray-600 border-gray-200">
                                            {STATUS_LABELS[r.status as RecordStatus]}
                                        </span>
                                    </td>
                                </tr>
                            )}) : (
                                <tr><td colSpan={11} className="p-8 text-center text-gray-400">Không có dữ liệu trễ hạn trong khoảng thời gian này.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                
                {overdueData.filteredRecords.length > 0 && (
                    <div className="border-t border-gray-200 p-3 bg-gray-50 flex justify-between items-center shrink-0">
                        <span className="text-xs text-gray-500">
                            Hiển thị <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> - <strong>{Math.min(currentPage * itemsPerPage, overdueData.filteredRecords.length)}</strong> trên tổng <strong>{overdueData.filteredRecords.length}</strong>
                        </span>
                        <div className="flex items-center gap-1">
                            <div className="flex items-center mr-4 gap-2">
                                <span className="text-xs text-gray-500">Số lượng:</span>
                                <select 
                                    value={itemsPerPage} 
                                    onChange={(e) => setItemsPerPage(Number(e.target.value))} 
                                    className="border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-red-400"
                                >
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                            <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft size={16} /></button>
                            <span className="text-xs font-medium mx-2">Trang {currentPage} / {totalPages}</span>
                            <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRight size={16} /></button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OverdueStatsView;

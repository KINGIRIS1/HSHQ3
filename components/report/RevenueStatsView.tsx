import React, { useMemo, useState, useEffect } from 'react';
import { RecordFile, Employee } from '../../types';
import { getNormalizedWard, getShortRecordType } from '../../constants';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Coins, TrendingUp, PieChart as PieIcon, ChevronLeft, ChevronRight, Receipt, Search, FileSpreadsheet, Users } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';

interface RevenueStatsViewProps {
    records: RecordFile[];
    employees: Employee[];
    fromDate: string;
    toDate: string;
}

const RevenueStatsView: React.FC<RevenueStatsViewProps> = ({ records, employees, fromDate, toDate }) => {
    // 1. Interactive Tab state
    const [activeTab, setActiveTab] = useState<'all' | 'receipt' | 'invoice'>('all');

    // 2. Dynamic Filter states (fully sharing parent's date & ward filter, and removing collector filter)
    const [receiverFilter, setReceiverFilter] = useState('all');

    // Filter employees to only those belonging to "Một cửa" (One door department/role)
    const oneDoorEmployees = useMemo(() => {
        const filtered = employees.filter(e => {
            const dept = (e.department || '').toLowerCase();
            const pos = (e.position || '').toLowerCase();
            return dept.includes('một cửa') || 
                   dept.includes('1 cửa') || 
                   dept.includes('onedoor') || 
                   dept.includes('one door') ||
                   pos.includes('một cửa') ||
                   pos.includes('1 cửa') ||
                   pos.includes('onedoor') ||
                   pos.includes('one door');
        });
        return filtered.length > 0 ? filtered : employees;
    }, [employees]);

    // 3. Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);

    // Reset pagination when filter or tab changes
    useEffect(() => {
        setCurrentPage(1);
    }, [receiverFilter, activeTab]);

    // 4. Filter paid records only (records having payment amount > 0)
    const allPaidRecords = useMemo(() => {
        return records.filter(r => r.paymentAmount !== null && r.paymentAmount !== undefined && r.paymentAmount > 0);
    }, [records]);

    // 5. Calculate Dynamic Summary Metrics for Top Cards based on Filters (excluding receiptType and pagination)
    const cardStats = useMemo(() => {
        let totalAmount = 0;
        let receiptAmount = 0;
        let invoiceAmount = 0;
        let totalCount = 0;
        let receiptCount = 0;
        let invoiceCount = 0;

        allPaidRecords.forEach(r => {
            // Apply Receiver filter
            if (receiverFilter !== 'all' && r.receivedBy !== receiverFilter) return;

            const amt = r.paymentAmount || 0;
            totalAmount += amt;
            totalCount++;

            if (r.receiptType === 'invoice') {
                invoiceAmount += amt;
                invoiceCount++;
            } else {
                receiptAmount += amt;
                receiptCount++;
            }
        });

        return { totalAmount, receiptAmount, invoiceAmount, totalCount, receiptCount, invoiceCount };
    }, [allPaidRecords, receiverFilter]);

    // 6. Get final list of filtered records to display in the table
    const filteredPaidRecords = useMemo(() => {
        return allPaidRecords.filter(r => {
            // Apply Receiver filter
            if (receiverFilter !== 'all' && r.receivedBy !== receiverFilter) return false;

            // Apply Active Tab filter (Receipt vs Invoice)
            if (activeTab === 'receipt' && r.receiptType !== 'receipt') return false;
            if (activeTab === 'invoice' && r.receiptType !== 'invoice') return false;

            return true;
        });
    }, [allPaidRecords, receiverFilter, activeTab]);

    // 7. Group by Ward for Bar Chart (using filtered subset)
    const wardRevenueData = useMemo(() => {
        const wardStats: Record<string, number> = {};
        filteredPaidRecords.forEach(r => {
            const ward = getNormalizedWard(r.ward) || 'Khác';
            const amt = r.paymentAmount || 0;
            wardStats[ward] = (wardStats[ward] || 0) + amt;
        });

        return Object.entries(wardStats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredPaidRecords]);

    // 8. Group by Day for Daily Trend Line Area (using filtered subset)
    const dailyRevenueData = useMemo(() => {
        const dailyStats: Record<string, number> = {};
        filteredPaidRecords.forEach(r => {
            const payDateStr = r.resultReturnedDate || r.completedDate;
            if (payDateStr) {
                const dateKey = payDateStr.split('T')[0];
                const amt = r.paymentAmount || 0;
                dailyStats[dateKey] = (dailyStats[dateKey] || 0) + amt;
            }
        });

        return Object.entries(dailyStats)
            .map(([date, value]) => ({ date, value }))
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(item => {
                const [y, m, d] = item.date.split('-');
                return {
                    name: `${d}/${m}`,
                    formattedDate: `${d}/${m}/${y}`,
                    value: item.value
                };
            });
    }, [filteredPaidRecords]);

    // 9. Group by Record Type for Bar Chart (using filtered subset)
    const recordTypeRevenueData = useMemo(() => {
        const typeStats: Record<string, number> = {};
        filteredPaidRecords.forEach(r => {
            const type = getShortRecordType(r.recordType) || 'Khác';
            const amt = r.paymentAmount || 0;
            typeStats[type] = (typeStats[type] || 0) + amt;
        });

        return Object.entries(typeStats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredPaidRecords]);

    // 10. Group by Receipt Type for Pie Chart (using filtered subset)
    const pieData = useMemo(() => {
        let receiptSum = 0;
        let invoiceSum = 0;

        filteredPaidRecords.forEach(r => {
            const amt = r.paymentAmount || 0;
            if (r.receiptType === 'invoice') {
                invoiceSum += amt;
            } else {
                receiptSum += amt;
            }
        });

        return [
            { name: 'Biên lai', value: receiptSum },
            { name: 'Hóa đơn', value: invoiceSum }
        ].filter(item => item.value > 0);
    }, [filteredPaidRecords]);

    // 11. Pagination slice of filtered records
    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredPaidRecords.slice(start, start + itemsPerPage);
    }, [filteredPaidRecords, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredPaidRecords.length / itemsPerPage);

    // Helpers
    const formatCurrency = (val: number) => {
        return val.toLocaleString('vi-VN') + ' đ';
    };

    const formatDate = (dStr?: string | null) => {
        if (!dStr) return '-';
        const date = new Date(dStr);
        if (isNaN(date.getTime())) return '-';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Excel Export specifically formatted based on current filtered dataset and criteria
    const handleExportExcel = () => {
        if (filteredPaidRecords.length === 0) {
            alert('Không có dữ liệu nguồn thu để xuất.');
            return;
        }

        const wb = XLSX.utils.book_new();

        const tableHeader = [
            "STT", 
            "Mã Hồ Sơ", 
            "Thông Tin Chủ Sử Dụng", 
            "Loại Hồ Sơ",
            "Ngày Thu Tiền", 
            "Loại Chứng Từ", 
            "Số Biên Lai/Hóa Đơn", 
            "Số Tiền Thực Thu (VNĐ)",
            "Người Nhận Hồ Sơ"
        ];

        const dataRows = filteredPaidRecords.map((r, i) => {
            // Resolve Người nhận hồ sơ
            const receiverEmp = employees.find(e => e.id === r.receivedBy);
            const receiverName = receiverEmp ? receiverEmp.name : (r.receivedBy || 'Cán bộ Một cửa');

            return [
                i + 1,
                r.code,
                r.customerName,
                r.recordType || '',
                formatDate(r.resultReturnedDate || r.completedDate),
                r.receiptType === 'invoice' ? 'Hóa đơn' : 'Biên lai',
                r.receiptNumber || '',
                r.paymentAmount || 0,
                receiverName
            ];
        });

        const formattedFromDate = fromDate ? formatDate(fromDate) : 'Đầu';
        const formattedToDate = toDate ? formatDate(toDate) : 'Hiện tại';
        const displayDate = `TỪ NGÀY ${formattedFromDate} ĐẾN NGÀY ${formattedToDate}`;

        const wsData = [
            ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
            ["Độc lập - Tự do - Hạnh phúc"],
            [],
            ["BÁO CÁO CHI TIẾT NGUỒN THU THEO BỘ LỌC"],
            [displayDate.toUpperCase()],
            [],
            [
                `Tổng tiền thu được: ${cardStats.totalAmount.toLocaleString('vi-VN')} VNĐ`,
                "",
                "",
                `Trong đó Biên lai: ${cardStats.receiptAmount.toLocaleString('vi-VN')} VNĐ`,
                "",
                "",
                `Trong đó Hóa đơn: ${cardStats.invoiceAmount.toLocaleString('vi-VN')} VNĐ`
            ],
            [],
            tableHeader,
            ...dataRows
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        const totalCols = tableHeader.length - 1;
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols } },
            { s: { r: 3, c: 0 }, e: { r: 3, c: totalCols } },
            { s: { r: 4, c: 0 }, e: { r: 4, c: totalCols } },
            { s: { r: 6, c: 0 }, e: { r: 6, c: 2 } },
            { s: { r: 6, c: 3 }, e: { r: 6, c: 5 } },
            { s: { r: 6, c: 6 }, e: { r: 6, c: totalCols } }
        ];

        // Format column widths
        ws['!cols'] = [
            { wch: 5 },  // STT
            { wch: 15 }, // Mã HS
            { wch: 25 }, // Thông tin chủ sử dụng
            { wch: 25 }, // Loại hồ sơ
            { wch: 18 }, // Ngày thu tiền
            { wch: 15 }, // Loại chứng từ
            { wch: 20 }, // Số biên lai/hóa đơn
            { wch: 22 }, // Số tiền thực thu
            { wch: 22 }  // Người nhận hồ sơ
        ];

        // Formatting styles
        const border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        const centerAlign = { horizontal: "center", vertical: "center" };
        const rightAlign = { horizontal: "right", vertical: "center" };

        if(ws['A1']) ws['A1'].s = { font: { name: "Times New Roman", sz: 14, bold: true }, alignment: { horizontal: "center" } };
        if(ws['A2']) ws['A2'].s = { font: { name: "Times New Roman", sz: 12, bold: true, underline: true }, alignment: { horizontal: "center" } };
        if(ws['A4']) ws['A4'].s = { font: { name: "Times New Roman", sz: 16, bold: true, color: { rgb: "0D9488" } }, alignment: { horizontal: "center" } };
        if(ws['A5']) ws['A5'].s = { font: { name: "Times New Roman", sz: 12, italic: true }, alignment: { horizontal: "center" } };
        
        // Summary row styling
        const summaryStyle = { font: { name: "Times New Roman", sz: 11, bold: true, color: { rgb: "0F766E" } }, alignment: { horizontal: "left" } };
        const summCells = ['A7', 'D7', 'G7'];
        summCells.forEach(cell => {
            if (ws[cell]) ws[cell].s = summaryStyle;
        });

        // Header style
        const headerStyle = { 
            font: { name: "Times New Roman", sz: 11, bold: true, color: { rgb: "FFFFFF" } }, 
            border, 
            fill: { fgColor: { rgb: "0D9488" } }, // Teal primary
            alignment: { horizontal: "center", vertical: "center", wrapText: true }
        };

        const cellStyle = { 
            font: { name: "Times New Roman", sz: 11 }, 
            border, 
            alignment: { vertical: "center", wrapText: true } 
        };

        const centerStyle = { ...cellStyle, alignment: centerAlign };
        const amountStyle = { ...cellStyle, alignment: rightAlign };

        // Apply styles to headers
        const headerRowIndex = 8;
        for (let c = 0; c <= totalCols; c++) {
            const cellRef = XLSX.utils.encode_cell({ r: headerRowIndex, c });
            if (ws[cellRef]) ws[cellRef].s = headerStyle;
        }

        // Apply styles to data rows
        const dataStartIndex = 9;
        for (let r = 0; r < dataRows.length; r++) {
            const rowIndex = dataStartIndex + r;
            for (let c = 0; c <= totalCols; c++) {
                const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c });
                if (!ws[cellRef]) continue;

                if (c === 7) {
                    ws[cellRef].t = 'n';
                    ws[cellRef].z = '#,##0';
                    ws[cellRef].s = amountStyle;
                } else if ([0, 4, 5, 6].includes(c)) {
                    ws[cellRef].s = centerStyle;
                } else {
                    ws[cellRef].s = cellStyle;
                }
            }
        }

        XLSX.utils.book_append_sheet(wb, ws, "Bao_Cao_Nguon_Thu");
        const filename = `Bao_Cao_Thu_Tien_${fromDate || 'all'}_to_${toDate || 'all'}.xlsx`;
        XLSX.writeFile(wb, filename);
    };

    // Cards configuration matching DailyStatsView design style
    const cards = [
        {
            id: 'all' as const,
            label: 'Tổng nguồn thu',
            value: formatCurrency(cardStats.totalAmount),
            count: `${cardStats.totalCount} hồ sơ`,
            icon: <Coins size={20} />,
            colorClass: 'text-teal-700',
            textClass: 'text-teal-600',
            numClass: 'text-teal-900',
            bgIcon: 'bg-teal-100',
            activeClass: 'bg-teal-50/80 border-teal-400 ring-2 ring-teal-300 shadow-sm',
            inactiveClass: 'bg-white border-slate-200 hover:border-teal-300'
        },
        {
            id: 'receipt' as const,
            label: 'Thu qua Biên Lai',
            value: formatCurrency(cardStats.receiptAmount),
            count: `${cardStats.receiptCount} hồ sơ`,
            icon: <Receipt size={20} />,
            colorClass: 'text-blue-700',
            textClass: 'text-blue-600',
            numClass: 'text-blue-900',
            bgIcon: 'bg-blue-100',
            activeClass: 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-300 shadow-sm',
            inactiveClass: 'bg-white border-slate-200 hover:border-blue-300'
        },
        {
            id: 'invoice' as const,
            label: 'Thu qua Hóa Đơn',
            value: formatCurrency(cardStats.invoiceAmount),
            count: `${cardStats.invoiceCount} hồ sơ`,
            icon: <Receipt size={20} />,
            colorClass: 'text-orange-700',
            textClass: 'text-orange-600',
            numClass: 'text-orange-900',
            bgIcon: 'bg-orange-100',
            activeClass: 'bg-orange-50/80 border-orange-400 ring-2 ring-orange-300 shadow-sm',
            inactiveClass: 'bg-white border-slate-200 hover:border-orange-300'
        }
    ];

    return (
        <div className="flex flex-col h-full bg-slate-100 p-4 gap-4 overflow-y-auto">
            {/* Premium interactive summary cards at the top */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0 animate-fade-in">
                {cards.map(card => (
                    <div 
                        key={card.id}
                        onClick={() => setActiveTab(card.id)}
                        className={`p-3.5 rounded-xl border flex items-center gap-4 cursor-pointer transition-all hover:scale-[1.02] ${
                            activeTab === card.id 
                                ? card.activeClass
                                : `${card.inactiveClass} shadow-sm`
                        }`}
                    >
                        <div className={`${card.bgIcon} p-2.5 rounded-lg ${card.colorClass}`}>
                            {card.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className={`text-xl font-bold leading-tight font-mono truncate ${card.numClass}`}>{card.value}</div>
                            <div className="flex items-center justify-between mt-0.5">
                                <div className={`text-[10px] uppercase font-extrabold tracking-wider ${card.textClass}`}>{card.label}</div>
                                <div className="text-[10px] text-gray-500 font-bold bg-gray-100 px-1.5 py-0.5 rounded-full">{card.count}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>





            {/* List Table directly below */}
            <div className="flex-1 flex flex-col min-h-[400px] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Header with stats title and export / filter controls */}
                <div className="p-4 border-b border-slate-150 bg-slate-50/50 flex flex-col lg:flex-row gap-3 justify-between items-start lg:items-center shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-lg text-white bg-teal-600`}>
                            <Coins size={14} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                                Danh sách chi tiết nguồn thu ({filteredPaidRecords.length} hồ sơ)
                            </h3>
                            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                                Tổng thu thực tế: <span className="font-bold text-teal-600">{formatCurrency(filteredPaidRecords.reduce((acc, r) => acc + (r.paymentAmount || 0), 0))}</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto lg:justify-end">
                        {/* Receiver Filter */}
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-200 rounded-lg shadow-sm">
                            <Users size={14} className="text-slate-400 shrink-0" />
                            <select 
                                value={receiverFilter} 
                                onChange={(e) => setReceiverFilter(e.target.value)} 
                                className="text-xs outline-none bg-transparent font-semibold text-slate-700 border-none p-0 focus:ring-0 cursor-pointer max-w-[180px]"
                            >
                                <option value="all">Người nhận HS (Tất cả)</option>
                                {oneDoorEmployees.map(e => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                            </select>
                        </div>

                        {receiverFilter !== 'all' && (
                            <button 
                                onClick={() => setReceiverFilter('all')}
                                className="text-xs font-semibold text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors h-[34px]"
                            >
                                Xóa lọc
                            </button>
                        )}

                        <button 
                            onClick={handleExportExcel}
                            disabled={filteredPaidRecords.length === 0}
                            className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm transition-all disabled:opacity-45 disabled:cursor-not-allowed h-[34px]"
                        >
                            <FileSpreadsheet size={14} /> Xuất Excel ({filteredPaidRecords.length})
                        </button>
                    </div>
                </div>

                {/* Table Container */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left text-sm border-collapse min-w-[1000px]">
                        <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-150 sticky top-0 z-10">
                            <tr>
                                <th className="p-3 text-center w-12">STT</th>
                                <th className="p-3 w-28">Mã hồ sơ</th>
                                <th className="p-3">Thông tin chủ sử dụng</th>
                                <th className="p-3 w-44">Loại hồ sơ</th>
                                <th className="p-3 w-32 text-center">Ngày thu tiền</th>
                                <th className="p-3 w-28 text-center">Loại chứng từ</th>
                                <th className="p-3 w-36 text-center">Số biên lai/HĐ</th>
                                <th className="p-3 w-36 text-right">Số tiền thu</th>
                                <th className="p-3 w-40">Người nhận hồ sơ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {paginatedRecords.length > 0 ? (
                                paginatedRecords.map((r, i) => {
                                    const rowIndex = (currentPage - 1) * itemsPerPage + i + 1;
                                    
                                    // Resolve Người nhận hồ sơ
                                    const receiverEmp = employees.find(e => e.id === r.receivedBy);
                                    const receiverName = receiverEmp ? receiverEmp.name : (r.receivedBy || 'Cán bộ Một cửa');

                                    return (
                                        <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-3 text-center text-slate-400 font-mono text-xs">{rowIndex}</td>
                                            <td className="p-3 font-semibold text-teal-600 font-mono text-xs">{r.code}</td>
                                            <td className="p-3 font-medium text-slate-800">{r.customerName}</td>
                                            <td className="p-3 text-slate-600 text-xs font-semibold">{r.recordType}</td>
                                            <td className="p-3 text-center text-slate-500 text-xs font-semibold">{formatDate(r.resultReturnedDate || r.completedDate)}</td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                                                    r.receiptType === 'invoice' 
                                                        ? 'bg-orange-50 text-orange-600 border-orange-100' 
                                                        : 'bg-blue-50 text-blue-600 border-blue-100'
                                                }`}>
                                                    {r.receiptType === 'invoice' ? 'Hóa đơn' : 'Biên lai'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center font-bold font-mono text-xs text-slate-700">{r.receiptNumber || '---'}</td>
                                            <td className="p-3 text-right font-extrabold font-mono text-teal-600">{formatCurrency(r.paymentAmount || 0)}</td>
                                            <td className="p-3 text-slate-600 text-xs font-semibold">{receiverName}</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={9} className="p-12 text-center text-slate-400 font-medium italic">
                                        Không có dữ liệu nguồn thu đáp ứng bộ lọc hiện tại.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination footer matching DailyStatsView */}
                {filteredPaidRecords.length > 0 && (
                    <div className="flex justify-between items-center p-4 border-t border-slate-150 bg-slate-50/50 shrink-0">
                        <span className="text-[11px] text-slate-500 font-medium">
                            Hiển thị từ <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> đến <strong>{Math.min(currentPage * itemsPerPage, filteredPaidRecords.length)}</strong> trên tổng <strong>{filteredPaidRecords.length}</strong> hồ sơ đã lọc
                        </span>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <span className="text-[11px] font-bold text-slate-600 min-w-[80px] text-center">
                                Trang {currentPage} / {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RevenueStatsView;

import React, { useMemo, useState } from 'react';
import { RecordFile, Employee } from '../../types';
import { getNormalizedWard, getShortRecordType } from '../../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { DollarSign, Table2, BarChart3, PieChart as PieIcon, TrendingUp, Calendar, FileSpreadsheet, ChevronLeft, ChevronRight, MapPin, Receipt, ArrowUpRight } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';

interface RevenueStatsViewProps {
    records: RecordFile[];
    employees: Employee[];
    fromDate: string;
    toDate: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#06b6d4'];

const RevenueStatsView: React.FC<RevenueStatsViewProps> = ({ records, employees, fromDate, toDate }) => {
    // 1. Filter paid records only (records that have a resultReturnedDate and paymentAmount > 0)
    const paidRecords = useMemo(() => {
        return records.filter(r => r.paymentAmount !== null && r.paymentAmount !== undefined && r.paymentAmount > 0);
    }, [records]);

    // 2. Pagination State for paid records list
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // 3. Stats Computations
    const stats = useMemo(() => {
        let totalAmount = 0;
        let receiptAmount = 0;
        let invoiceAmount = 0;
        let totalCount = paidRecords.length;

        paidRecords.forEach(r => {
            const amt = r.paymentAmount || 0;
            totalAmount += amt;
            if (r.receiptType === 'invoice') {
                invoiceAmount += amt;
            } else {
                receiptAmount += amt;
            }
        });

        return { totalAmount, receiptAmount, invoiceAmount, totalCount };
    }, [paidRecords]);

    // 4. Group by Receipt Type for Pie Chart
    const pieData = useMemo(() => {
        let receiptSum = 0;
        let invoiceSum = 0;

        paidRecords.forEach(r => {
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
    }, [paidRecords]);

    // 5. Group by Ward (Xã / Phường)
    const wardRevenueData = useMemo(() => {
        const wardStats: Record<string, number> = {};

        paidRecords.forEach(r => {
            const ward = getNormalizedWard(r.ward) || 'Khác';
            const amt = r.paymentAmount || 0;
            wardStats[ward] = (wardStats[ward] || 0) + amt;
        });

        return Object.entries(wardStats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [paidRecords]);

    // 6. Group by Day (resultReturnedDate) for Daily Trend Line
    const dailyRevenueData = useMemo(() => {
        const dailyStats: Record<string, number> = {};

        paidRecords.forEach(r => {
            if (r.resultReturnedDate) {
                const dateKey = r.resultReturnedDate.split('T')[0];
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
    }, [paidRecords]);

    // 7. Group by Record Type category
    const recordTypeRevenueData = useMemo(() => {
        const typeStats: Record<string, number> = {};

        paidRecords.forEach(r => {
            const type = getShortRecordType(r.recordType) || 'Khác';
            const amt = r.paymentAmount || 0;
            typeStats[type] = (typeStats[type] || 0) + amt;
        });

        return Object.entries(typeStats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [paidRecords]);

    // Pagination slice
    const paginatedPaidRecords = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return paidRecords.slice(start, start + itemsPerPage);
    }, [paidRecords, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(paidRecords.length / itemsPerPage);

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

    // Excel Export function specifically for financial collected payments
    const handleExportExcel = () => {
        if (paidRecords.length === 0) {
            alert('Không có dữ liệu thu tiền để xuất.');
            return;
        }

        const wb = XLSX.utils.book_new();

        const tableHeader = [
            "STT", 
            "Mã Hồ Sơ", 
            "Chủ Sử Dụng", 
            "Xã/Phường", 
            "Loại Hồ Sơ", 
            "Loại Giấy Tờ", 
            "Số Biên Lai/Hóa Đơn", 
            "Số Tiền Thực Thu (VNĐ)", 
            "Ngày Trả & Thu Tiền", 
            "Người Nhận Kết Quả",
            "Nhân Viên Xử Lý"
        ];

        const dataRows = paidRecords.map((r, i) => {
            const emp = employees.find(e => e.id === r.assignedTo);
            return [
                i + 1,
                r.code,
                r.customerName,
                getNormalizedWard(r.ward || undefined),
                r.recordType || '',
                r.receiptType === 'invoice' ? 'Hóa đơn' : 'Biên lai',
                r.receiptNumber || '',
                r.paymentAmount || 0,
                formatDate(r.resultReturnedDate),
                r.receiverName || '',
                emp ? emp.name : ''
            ];
        });

        const formattedFromDate = formatDate(fromDate);
        const formattedToDate = formatDate(toDate);
        const displayDate = `TỪ NGÀY ${formattedFromDate} ĐẾN NGÀY ${formattedToDate}`;

        const wsData = [
            ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
            ["Độc lập - Tự do - Hạnh phúc"],
            [],
            ["BÁO CÁO CHI TIẾT SỐ TIỀN THU ĐƯỢC THEO GIAI ĐOẠN"],
            [displayDate.toUpperCase()],
            [],
            [
                `Tổng số tiền thu được: ${stats.totalAmount.toLocaleString('vi-VN')} VNĐ`,
                "",
                `Trong đó Biên lai: ${stats.receiptAmount.toLocaleString('vi-VN')} VNĐ`,
                "",
                `Trong đó Hóa đơn: ${stats.invoiceAmount.toLocaleString('vi-VN')} VNĐ`,
                "",
                `Tổng số hồ sơ đã thu: ${stats.totalCount} hồ sơ`
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
            { s: { r: 6, c: 6 }, e: { r: 6, c: 8 } },
            { s: { r: 6, c: 9 }, e: { r: 6, c: 10 } }
        ];

        // Format widths
        ws['!cols'] = [
            { wch: 5 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 22 }, { wch: 18 }, { wch: 25 }, { wch: 20 }
        ];

        // Formatting styles
        const border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        const centerAlign = { horizontal: "center", vertical: "center" };
        const rightAlign = { horizontal: "right", vertical: "center" };
        const leftAlign = { horizontal: "left", vertical: "center" };

        if(ws['A1']) ws['A1'].s = { font: { name: "Times New Roman", sz: 14, bold: true }, alignment: { horizontal: "center" } };
        if(ws['A2']) ws['A2'].s = { font: { name: "Times New Roman", sz: 12, bold: true, underline: true }, alignment: { horizontal: "center" } };
        if(ws['A4']) ws['A4'].s = { font: { name: "Times New Roman", sz: 16, bold: true, color: { rgb: "0F766E" } }, alignment: { horizontal: "center" } };
        if(ws['A5']) ws['A5'].s = { font: { name: "Times New Roman", sz: 12, italic: true }, alignment: { horizontal: "center" } };
        
        // Summary row styling
        const summaryStyle = { font: { name: "Times New Roman", sz: 11, bold: true }, alignment: { horizontal: "left" } };
        const summCells = ['A7', 'D7', 'G7', 'J7'];
        summCells.forEach(cell => {
            if (ws[cell]) ws[cell].s = summaryStyle;
        });

        // Header style
        const headerStyle = { 
            font: { name: "Times New Roman", sz: 11, bold: true }, 
            border, 
            fill: { fgColor: { rgb: "0F766E" } }, // Teal primary
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            color: { rgb: "FFFFFF" }
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
            if (ws[cellRef]) {
                ws[cellRef].s = {
                    ...headerStyle,
                    font: { name: "Times New Roman", sz: 11, bold: true, color: { rgb: "FFFFFF" } }
                };
            }
        }

        // Apply styles to data rows
        const dataStartIndex = 9;
        for (let r = 0; r < dataRows.length; r++) {
            const rowIndex = dataStartIndex + r;
            for (let c = 0; c <= totalCols; c++) {
                const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c });
                if (!ws[cellRef]) continue;

                // Set numbers for amount column to be excel formatted numbers
                if (c === 7) {
                    ws[cellRef].t = 'n';
                    ws[cellRef].z = '#,##0';
                    ws[cellRef].s = amountStyle;
                } else if ([0, 5, 6, 8].includes(c)) {
                    ws[cellRef].s = centerStyle;
                } else {
                    ws[cellRef].s = cellStyle;
                }
            }
        }

        XLSX.utils.book_append_sheet(wb, ws, "Bao_Cao_Nguon_Thu");
        const filename = `Bao_Cao_Thu_Tien_${fromDate}_to_${toDate}.xlsx`;
        XLSX.writeFile(wb, filename);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-y-auto p-5 space-y-6 custom-scrollbar">
            {/* Header / Submitter Block */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-5 rounded-2xl border border-gray-100 shadow-sm gap-4">
                <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <TrendingUp size={22} className="text-teal-600" />
                        Báo cáo doanh thu & các nguồn tiền thu được
                    </h3>
                    <p className="text-xs text-gray-500 font-medium">
                        Khoảng thời gian: <span className="font-bold text-teal-700">{formatDate(fromDate)}</span> đến <span className="font-bold text-teal-700">{formatDate(toDate)}</span>
                    </p>
                </div>
            </div>

            {/* General Overview Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-gradient-to-br from-teal-500 to-emerald-600 text-white p-5 rounded-2xl shadow-md border border-teal-400/20 relative overflow-hidden">
                    <div className="absolute right-[-10px] bottom-[-10px] opacity-10">
                        <DollarSign size={110} />
                    </div>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs uppercase font-bold tracking-wider opacity-90">Tổng nguồn thu</span>
                        <div className="bg-white/20 p-2 rounded-lg"><DollarSign size={18} /></div>
                    </div>
                    <div className="text-2xl font-black font-mono tracking-tight">{formatCurrency(stats.totalAmount)}</div>
                    <div className="text-xs mt-2 opacity-80 flex items-center gap-1">
                        <ArrowUpRight size={14} /> Thực thu thực tế trong kỳ
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 uppercase font-extrabold tracking-wider">Thu qua Biên Lai</span>
                        <div className="bg-blue-50 text-blue-600 p-2 rounded-xl"><Receipt size={18} /></div>
                    </div>
                    <div className="mt-4">
                        <div className="text-xl font-bold font-mono text-slate-800">{formatCurrency(stats.receiptAmount)}</div>
                        <p className="text-xs text-gray-400 mt-1 font-medium">Sử dụng phôi biên lai thu phí</p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 uppercase font-extrabold tracking-wider">Thu qua Hóa Đơn</span>
                        <div className="bg-orange-50 text-orange-600 p-2 rounded-xl"><Receipt size={18} /></div>
                    </div>
                    <div className="mt-4">
                        <div className="text-xl font-bold font-mono text-slate-800">{formatCurrency(stats.invoiceAmount)}</div>
                        <p className="text-xs text-gray-400 mt-1 font-medium">Sử dụng hóa đơn GTGT dịch vụ</p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 uppercase font-extrabold tracking-wider">Hồ sơ đã thu</span>
                        <div className="bg-teal-50 text-teal-600 p-2 rounded-xl"><Calendar size={18} /></div>
                    </div>
                    <div className="mt-4">
                        <div className="text-xl font-bold font-mono text-slate-800">{stats.totalCount} <span className="text-sm font-medium text-gray-500">hồ sơ</span></div>
                        <p className="text-xs text-gray-400 mt-1 font-medium">Đã trả kết quả có ghi nhận thu</p>
                    </div>
                </div>
            </div>

            {/* Graphs / Visual Charts Row */}
            {paidRecords.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Daily Revenue Trend (Line / Area chart) */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm lg:col-span-2 flex flex-col h-[320px]">
                        <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-3">
                            <TrendingUp size={16} className="text-teal-600" />
                            Biểu đồ diễn biến thu tiền theo thời gian
                        </h4>
                        <div className="flex-1 min-h-0 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={dailyRevenueData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} stroke="#64748b" />
                                    <YAxis 
                                        tickLine={false} 
                                        axisLine={false} 
                                        fontSize={10} 
                                        stroke="#64748b" 
                                        tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v.toLocaleString('vi-VN')}
                                    />
                                    <Tooltip 
                                        formatter={(val: any) => [formatCurrency(Number(val)), 'Thực thu']}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                                    />
                                    <Area type="monotone" dataKey="value" stroke="#0d9488" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Receipt Type Breakdown (Pie chart) */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[320px]">
                        <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-3">
                            <PieIcon size={16} className="text-blue-600" />
                            Cơ cấu chứng từ thu (Biên lai vs Hóa đơn)
                        </h4>
                        <div className="flex-1 min-h-0 w-full relative">
                            {pieData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="45%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#f97316'} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(val: any) => [formatCurrency(Number(val)), 'Doanh thu']} />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">Không có dữ liệu loại chứng từ</div>
                            )}
                        </div>
                    </div>

                    {/* Ward (Xã / Phường) Revenue (Bar chart) */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[320px]">
                        <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-3">
                            <MapPin size={16} className="text-emerald-600" />
                            Nguồn thu theo địa bàn hành chính
                        </h4>
                        <div className="flex-1 min-h-0 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={wardRevenueData.slice(0, 8)} layout="vertical" margin={{ left: 10, right: 10, top: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                    <XAxis type="number" fontSize={9} stroke="#64748b" tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v} />
                                    <YAxis type="category" dataKey="name" fontSize={11} stroke="#64748b" tickLine={false} axisLine={false} width={65} />
                                    <Tooltip formatter={(val: any) => [formatCurrency(Number(val)), 'Thực thu']} />
                                    <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} barSize={12} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Record Type Category Revenue (Bar chart) */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm lg:col-span-2 flex flex-col h-[320px]">
                        <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-3">
                            <BarChart3 size={16} className="text-purple-600" />
                            Nguồn thu theo phân loại nhóm hồ sơ
                        </h4>
                        <div className="flex-1 min-h-0 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={recordTypeRevenueData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} stroke="#64748b" />
                                    <YAxis 
                                        tickLine={false} 
                                        axisLine={false} 
                                        fontSize={10} 
                                        stroke="#64748b" 
                                        tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v.toLocaleString('vi-VN')}
                                    />
                                    <Tooltip formatter={(val: any) => [formatCurrency(Number(val)), 'Thực thu']} />
                                    <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={35} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Detailed table of paid records */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col">
                <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-4">
                    <Table2 size={16} className="text-teal-600" />
                    Danh sách chi tiết hồ sơ nộp tiền ({paidRecords.length} hồ sơ)
                </h4>

                <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-50 text-xs text-gray-500 uppercase font-bold border-b border-gray-100">
                            <tr>
                                <th className="p-3 text-center w-12">#</th>
                                <th className="p-3 w-32">Mã HS</th>
                                <th className="p-3">Chủ sử dụng</th>
                                <th className="p-3 w-36">Xã/Phường</th>
                                <th className="p-3 w-44">Nhóm hồ sơ</th>
                                <th className="p-3 w-32 text-center">Chứng từ</th>
                                <th className="p-3 w-32 text-center">Số biên lai/HĐ</th>
                                <th className="p-3 w-36 text-right">Số tiền thu</th>
                                <th className="p-3 w-32 text-center">Ngày thu</th>
                                <th className="p-3 w-40">Người nhận KQ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {paginatedPaidRecords.length > 0 ? (
                                paginatedPaidRecords.map((r, i) => {
                                    const rowIndex = (currentPage - 1) * itemsPerPage + i + 1;
                                    return (
                                        <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-3 text-center text-gray-400 font-mono text-xs">{rowIndex}</td>
                                            <td className="p-3 font-semibold text-teal-600 font-mono text-xs">{r.code}</td>
                                            <td className="p-3 font-medium text-slate-800">{r.customerName}</td>
                                            <td className="p-3 text-gray-600 text-xs">{getNormalizedWard(r.ward)}</td>
                                            <td className="p-3 text-gray-600 text-xs truncate max-w-[150px]" title={r.recordType || ''}>{r.recordType || ''}</td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${r.receiptType === 'invoice' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                                                    {r.receiptType === 'invoice' ? 'Hóa đơn' : 'Biên lai'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center font-bold font-mono text-xs text-slate-700">{r.receiptNumber || '---'}</td>
                                            <td className="p-3 text-right font-bold font-mono text-teal-600">{formatCurrency(r.paymentAmount || 0)}</td>
                                            <td className="p-3 text-center text-gray-500 text-xs font-medium">{formatDate(r.resultReturnedDate)}</td>
                                            <td className="p-3 text-gray-700 text-xs font-semibold">{r.receiverName || '---'}</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={10} className="p-10 text-center text-gray-400 font-medium italic">
                                        Không có dữ liệu thu tiền trong khoảng thời gian này.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination footer */}
                {paidRecords.length > 0 && (
                    <div className="flex justify-between items-center mt-4 pt-2 border-t border-gray-100">
                        <span className="text-xs text-gray-500 font-medium">
                            Hiển thị từ <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> đến <strong>{Math.min(currentPage * itemsPerPage, paidRecords.length)}</strong> trên tổng <strong>{paidRecords.length}</strong> hồ sơ đã nộp tiền
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg border border-gray-200 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <span className="text-xs font-bold text-slate-600 px-3">
                                Trang {currentPage} / {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-lg border border-gray-200 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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

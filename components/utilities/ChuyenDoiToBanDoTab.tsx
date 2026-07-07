import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Upload, 
    Trash2, 
    FileSpreadsheet, 
    Loader2, 
    Search, 
    Download, 
    MapPin, 
    Grid, 
    Building2, 
    ChevronLeft, 
    ChevronRight, 
    X, 
    Edit2, 
    Plus, 
    Info 
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { NotifyFunction } from '../../types';
import { 
    fetchMapSheetConversions, 
    saveMapSheetConversions, 
    saveSingleMapSheetConversion, 
    deleteMapSheetConversion, 
    deleteAllMapSheetConversions, 
    MapSheetConversion 
} from '../../services/apiUtilities';

interface Props {
    notify: NotifyFunction;
}

const ChuyenDoiToBanDoTab: React.FC<Props> = ({ notify }) => {
    const [data, setData] = useState<MapSheetConversion[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    
    // Active search perspective tab: 'new' | 'old' | 'intermediate'
    const [activeTab, setActiveTab] = useState<'new' | 'old' | 'intermediate'>('new');

    // Filter states for Tab 1 (Giai đoạn Mới)
    const [searchXaMoi, setSearchXaMoi] = useState('');
    const [searchToMoi, setSearchToMoi] = useState('');
    const [searchThuaMoi, setSearchThuaMoi] = useState('');
    const [appliedXaMoi, setAppliedXaMoi] = useState('');
    const [appliedToMoi, setAppliedToMoi] = useState('');
    const [appliedThuaMoi, setAppliedThuaMoi] = useState('');

    // Filter states for Tab 2 (Giai đoạn Cũ)
    const [searchXaCu, setSearchXaCu] = useState('');
    const [searchToCu, setSearchToCu] = useState('');
    const [searchThuaCu, setSearchThuaCu] = useState('');
    const [appliedXaCu, setAppliedXaCu] = useState('');
    const [appliedToCu, setAppliedToCu] = useState('');
    const [appliedThuaCu, setAppliedThuaCu] = useState('');

    // Filter states for Tab 3 (Giai đoạn Trung gian)
    const [searchXaCuTG, setSearchXaCuTG] = useState('');
    const [searchToTG, setSearchToTG] = useState('');
    const [searchThuaTG, setSearchThuaTG] = useState('');
    const [appliedXaCuTG, setAppliedXaCuTG] = useState('');
    const [appliedToTG, setAppliedToTG] = useState('');
    const [appliedThuaTG, setAppliedThuaTG] = useState('');
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 25;

    // Ward Stats Popup state
    const [isStatsPopupOpen, setIsStatsPopupOpen] = useState(false);
    const [statsPopupType, setStatsPopupType] = useState<'old' | 'new'>('old');

    // Manual Entry Modal State
    const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<MapSheetConversion | null>(null);
    const [modalFormData, setModalFormData] = useState({
        xa_phuong_cu: '',
        so_to_cu: '',
        so_thua_cu: '',
        xa_phuong_trung_gian: '',
        so_to_trung_gian: '',
        so_thua_trung_gian: '',
        xa_phuong_moi: '',
        so_to_moi: '',
        so_thua_moi: ''
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const result = await fetchMapSheetConversions();
            setData(result);
        } catch (error) {
            notify('Lỗi khi tải dữ liệu chuyển đổi', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadTemplate = () => {
        const wb = XLSX.utils.book_new();
        const headers = [
            "Xã phường cũ", "Số tờ cũ", "Số thửa cũ", 
            "Số tờ trung gian", "Số thửa trung gian", 
            "Xã phường mới", "Số tờ mới", "Số thửa mới"
        ];
        const sampleData = [
            ["Phường Thạch Thang", "T05", "12", "T08", "45", "Phường Thạch Thang", "T12", "78"],
            ["Phường Hòa Thuận Đông", "T08", "34", "T15", "56", "Phường Hòa Thuận Đông", "T21", "90"]
        ];
        const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
        ws['!cols'] = [
            {wch: 22}, {wch: 12}, {wch: 12}, 
            {wch: 12}, {wch: 12}, 
            {wch: 22}, {wch: 12}, {wch: 12}
        ];
        XLSX.utils.book_append_sheet(wb, ws, "MauChuyenDoi3GiaiDoan");
        XLSX.writeFile(wb, "Mau_Chuyen_Doi_3_Giai_Doan.xlsx");
        notify('Đã tải xuống tệp mẫu Excel 3 Giai Đoạn!', 'success');
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const ab = evt.target?.result;
                const wb = XLSX.read(ab, { type: 'array' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                if (jsonData.length < 2) {
                    notify('File Excel không có dữ liệu', 'error');
                    return;
                }

                // Locate headers dynamically based on keywords
                let headerRowIdx = 0;
                for (let i = 0; i < Math.min(5, jsonData.length); i++) {
                    const row = jsonData[i];
                    if (row && row.some(cell => typeof cell === 'string' && (cell.toLowerCase().includes('cũ') || cell.toLowerCase().includes('mới')))) {
                        headerRowIdx = i;
                        break;
                    }
                }

                const rawHeaders = jsonData[headerRowIdx] || [];
                const headers = rawHeaders.map(h => h ? String(h).trim().toLowerCase() : '');
                
                // Helper to find column index dynamically
                const findIdx = (kws: string[]) => {
                    return headers.findIndex(h => h && kws.every(kw => h.includes(kw)));
                };

                let idxXaCu = findIdx(['xã', 'cũ']) !== -1 ? findIdx(['xã', 'cũ']) : findIdx(['phường', 'cũ']);
                if (idxXaCu === -1) idxXaCu = 0;

                let idxToCu = findIdx(['tờ', 'cũ']);
                if (idxToCu === -1) idxToCu = 1;

                let idxThuaCu = findIdx(['thửa', 'cũ']);
                if (idxThuaCu === -1) idxThuaCu = 2;

                let idxToTG = findIdx(['tờ', 'trung']) !== -1 ? findIdx(['tờ', 'trung']) : (findIdx(['tờ', 'tg']) !== -1 ? findIdx(['tờ', 'tg']) : 3);
                if (idxToTG === -1) idxToTG = 3;

                let idxThuaTG = findIdx(['thửa', 'trung']) !== -1 ? findIdx(['thửa', 'trung']) : (findIdx(['thửa', 'tg']) !== -1 ? findIdx(['thửa', 'tg']) : 4);
                if (idxThuaTG === -1) idxThuaTG = 4;

                let idxXaMoi = findIdx(['xã', 'mới']) !== -1 ? findIdx(['xã', 'mới']) : findIdx(['phường', 'mới']);
                if (idxXaMoi === -1) idxXaMoi = 5;

                let idxToMoi = findIdx(['tờ', 'mới']);
                if (idxToMoi === -1) idxToMoi = 6;

                let idxThuaMoi = findIdx(['thửa', 'mới']);
                if (idxThuaMoi === -1) idxThuaMoi = 7;

                const newConversions: Partial<MapSheetConversion>[] = [];
                for (let i = headerRowIdx + 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    if (!row || row.length === 0) continue;
                    
                    const xa_phuong_cu = row[idxXaCu]?.toString().trim() || '';
                    const so_to_cu = row[idxToCu]?.toString().trim() || '';
                    const so_thua_cu = row[idxThuaCu]?.toString().trim() || '';
                    
                    const so_to_trung_gian = row[idxToTG]?.toString().trim() || '';
                    const so_thua_trung_gian = row[idxThuaTG]?.toString().trim() || '';
                    
                    const xa_phuong_moi = row[idxXaMoi]?.toString().trim() || '';
                    const so_to_moi = row[idxToMoi]?.toString().trim() || '';
                    const so_thua_moi = row[idxThuaMoi]?.toString().trim() || '';

                    // Basic verification (at least Old Ward + Old Sheet + New Ward + New Sheet)
                    if (xa_phuong_cu && so_to_cu && xa_phuong_moi && so_to_moi) {
                        newConversions.push({
                            xa_phuong_cu,
                            so_to_cu,
                            so_thua_cu,
                            xa_phuong_trung_gian: xa_phuong_cu, // Set it to old ward automatically
                            so_to_trung_gian,
                            so_thua_trung_gian,
                            xa_phuong_moi,
                            so_to_moi,
                            so_thua_moi
                        });
                    }
                }

                if (newConversions.length > 0) {
                    handleSaveData(newConversions);
                } else {
                    notify('Không tìm thấy dữ liệu hợp lệ trong file Excel.', 'error');
                }
            } catch (error) {
                console.error(error);
                notify('Lỗi khi đọc file Excel', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSaveData = async (newConversions: Partial<MapSheetConversion>[]) => {
        setSaving(true);
        try {
            const success = await saveMapSheetConversions(newConversions);
            if (success) {
                notify(`Đã nhập ${newConversions.length} bản ghi thành công`, 'success');
                loadData();
            } else {
                notify('Lỗi khi lưu dữ liệu vào hệ thống', 'error');
            }
        } catch (error) {
            notify('Lỗi khi lưu dữ liệu', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleSingleDelete = async (id: string) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa bản ghi chuyển đổi này?')) return;
        setSaving(true);
        try {
            const success = await deleteMapSheetConversion(id);
            if (success) {
                notify('Đã xóa bản ghi thành công', 'success');
                loadData();
            } else {
                notify('Lỗi khi xóa bản ghi', 'error');
            }
        } catch (error) {
            notify('Lỗi hệ thống khi xóa bản ghi', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAll = async () => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa TOÀN BỘ dữ liệu chuyển đổi? Hành động này không thể hoàn tác.')) return;
        
        setSaving(true);
        try {
            const success = await deleteAllMapSheetConversions();
            if (success) {
                notify('Đã xóa toàn bộ dữ liệu', 'success');
                setData([]);
            } else {
                notify('Lỗi khi xóa dữ liệu', 'error');
            }
        } catch (error) {
            notify('Lỗi khi xóa dữ liệu', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Filter application
    const handleSearch = () => {
        if (activeTab === 'new') {
            setAppliedXaMoi(searchXaMoi);
            setAppliedToMoi(searchToMoi);
            setAppliedThuaMoi(searchThuaMoi);
        } else if (activeTab === 'old') {
            setAppliedXaCu(searchXaCu);
            setAppliedToCu(searchToCu);
            setAppliedThuaCu(searchThuaCu);
        } else {
            setAppliedXaCuTG(searchXaCuTG);
            setAppliedToTG(searchToTG);
            setAppliedThuaTG(searchThuaTG);
        }
        setCurrentPage(1);
    };

    const handleReset = () => {
        if (activeTab === 'new') {
            setSearchXaMoi('');
            setSearchToMoi('');
            setSearchThuaMoi('');
            setAppliedXaMoi('');
            setAppliedToMoi('');
            setAppliedThuaMoi('');
        } else if (activeTab === 'old') {
            setSearchXaCu('');
            setSearchToCu('');
            setSearchThuaCu('');
            setAppliedXaCu('');
            setAppliedToCu('');
            setAppliedThuaCu('');
        } else {
            setSearchXaCuTG('');
            setSearchToTG('');
            setSearchThuaTG('');
            setAppliedXaCuTG('');
            setAppliedToTG('');
            setAppliedThuaTG('');
        }
        setCurrentPage(1);
    };

    // Auto clear/reset when switching search tabs
    useEffect(() => {
        handleReset();
    }, [activeTab]);

    // Unique old/new wards for selection dropdowns
    const uniqueOldWards = useMemo(() => Array.from(new Set(data.map(d => d.xa_phuong_cu).filter(Boolean))).sort(), [data]);
    const uniqueNewWards = useMemo(() => Array.from(new Set(data.map(d => d.xa_phuong_moi).filter(Boolean))).sort(), [data]);

    // Main filtered dataset tailored to the selected sub-tab
    const filteredData = useMemo(() => {
        return data.filter(item => {
            if (activeTab === 'new') {
                const matchXa = appliedXaMoi ? item.xa_phuong_moi === appliedXaMoi : true;
                const matchTo = appliedToMoi ? item.so_to_moi.toLowerCase().includes(appliedToMoi.toLowerCase()) : true;
                const matchThua = appliedThuaMoi ? (item.so_thua_moi || '').toLowerCase().includes(appliedThuaMoi.toLowerCase()) : true;
                return matchXa && matchTo && matchThua;
            } else if (activeTab === 'old') {
                const matchXa = appliedXaCu ? item.xa_phuong_cu === appliedXaCu : true;
                const matchTo = appliedToCu ? item.so_to_cu.toLowerCase().includes(appliedToCu.toLowerCase()) : true;
                const matchThua = appliedThuaCu ? (item.so_thua_cu || '').toLowerCase().includes(appliedThuaCu.toLowerCase()) : true;
                return matchXa && matchTo && matchThua;
            } else {
                // Intermediate: search by old ward + intermediate sheet/plot
                const matchXa = appliedXaCuTG ? item.xa_phuong_cu === appliedXaCuTG : true;
                const matchTo = appliedToTG ? (item.so_to_trung_gian || '').toLowerCase().includes(appliedToTG.toLowerCase()) : true;
                const matchThua = appliedThuaTG ? (item.so_thua_trung_gian || '').toLowerCase().includes(appliedThuaTG.toLowerCase()) : true;
                return matchXa && matchTo && matchThua;
            }
        });
    }, [data, activeTab, appliedXaMoi, appliedToMoi, appliedThuaMoi, appliedXaCu, appliedToCu, appliedThuaCu, appliedXaCuTG, appliedToTG, appliedThuaTG]);

    // Pagination logic
    const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
    const paginatedData = useMemo(() => {
        return filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    }, [filteredData, currentPage]);

    // Statistics logic
    const oldWardStats = useMemo(() => {
        const stats: Record<string, number> = {};
        data.forEach(d => {
            if (d.xa_phuong_cu) {
                stats[d.xa_phuong_cu] = (stats[d.xa_phuong_cu] || 0) + 1;
            }
        });
        return Object.entries(stats).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    }, [data]);

    const newWardStats = useMemo(() => {
        const stats: Record<string, number> = {};
        data.forEach(d => {
            if (d.xa_phuong_moi) {
                stats[d.xa_phuong_moi] = (stats[d.xa_phuong_moi] || 0) + 1;
            }
        });
        return Object.entries(stats).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    }, [data]);

    const openStatsPopup = (type: 'old' | 'new') => {
        setStatsPopupType(type);
        setIsStatsPopupOpen(true);
    };

    // Open Manual Entry Modal
    const handleOpenEntryModal = (record: MapSheetConversion | null = null) => {
        if (record) {
            setEditingRecord(record);
            setModalFormData({
                xa_phuong_cu: record.xa_phuong_cu || '',
                so_to_cu: record.so_to_cu || '',
                so_thua_cu: record.so_thua_cu || '',
                xa_phuong_trung_gian: record.xa_phuong_trung_gian || '',
                so_to_trung_gian: record.so_to_trung_gian || '',
                so_thua_trung_gian: record.so_thua_trung_gian || '',
                xa_phuong_moi: record.xa_phuong_moi || '',
                so_to_moi: record.so_to_moi || '',
                so_thua_moi: record.so_thua_moi || ''
            });
        } else {
            setEditingRecord(null);
            setModalFormData({
                xa_phuong_cu: '',
                so_to_cu: '',
                so_thua_cu: '',
                xa_phuong_trung_gian: '',
                so_to_trung_gian: '',
                so_thua_trung_gian: '',
                xa_phuong_moi: '',
                so_to_moi: '',
                so_thua_moi: ''
            });
        }
        setIsEntryModalOpen(true);
    };

    // Handle Manual Entry Save
    const handleSaveManualEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const { xa_phuong_cu, so_to_cu, xa_phuong_moi, so_to_moi } = modalFormData;
        
        if (!xa_phuong_cu.trim() || !so_to_cu.trim() || !xa_phuong_moi.trim() || !so_to_moi.trim()) {
            notify('Vui lòng nhập tối thiểu Xã cũ, Tờ cũ, Xã mới, Tờ mới!', 'error');
            return;
        }

        setSaving(true);

        const payload: Partial<MapSheetConversion> = {
            id: editingRecord?.id,
            xa_phuong_cu: xa_phuong_cu.trim(),
            so_to_cu: so_to_cu.trim(),
            so_thua_cu: modalFormData.so_thua_cu.trim(),
            xa_phuong_trung_gian: xa_phuong_cu.trim(), // Inherit old ward directly
            so_to_trung_gian: modalFormData.so_to_trung_gian.trim(),
            so_thua_trung_gian: modalFormData.so_thua_trung_gian.trim(),
            xa_phuong_moi: xa_phuong_moi.trim(),
            so_to_moi: so_to_moi.trim(),
            so_thua_moi: modalFormData.so_thua_moi.trim()
        };

        try {
            const success = await saveSingleMapSheetConversion(payload);
            if (success) {
                notify(editingRecord ? 'Cập nhật bản ghi thành công!' : 'Thêm bản ghi mới thành công!', 'success');
                setIsEntryModalOpen(false);
                loadData();
            } else {
                notify('Lưu dữ liệu thất bại', 'error');
            }
        } catch (error) {
            notify('Lỗi hệ thống khi lưu dữ liệu', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] animate-fade-in overflow-hidden">
            
            {/* Header */}
            <div className="p-6 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Chuyển đổi tờ bản đồ (3 Giai đoạn)</h2>
                    <p className="text-slate-500 text-sm mt-1">Quản lý, tìm kiếm và đồng bộ thông tin bản đồ: Cũ ➔ Trung gian ➔ Mới.</p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                    <button 
                        onClick={() => handleOpenEntryModal(null)}
                        className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors shadow-sm text-sm"
                    >
                        <Plus size={16} /> Thêm thủ công
                    </button>
                    <button 
                        onClick={handleDownloadTemplate}
                        className="flex items-center gap-2 bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors shadow-sm text-sm"
                    >
                        <Download size={16} /> Tải tệp mẫu (3 Giai đoạn)
                    </button>
                    <input 
                        type="file" 
                        accept=".xlsx, .xls" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={saving}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm text-sm disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        Nhập từ Excel
                    </button>
                </div>
            </div>

            {/* Tra cứu Perspective Sub-Tabs */}
            <div className="px-6 shrink-0">
                <div className="flex border-b border-slate-200 gap-1 bg-white p-1 rounded-t-xl border-t border-x border-slate-200">
                    <button
                        onClick={() => setActiveTab('new')}
                        className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all duration-150 flex items-center justify-center gap-2 ${
                            activeTab === 'new' 
                                ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100' 
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                    >
                        <Building2 size={16} /> Tra cứu theo Giai đoạn Mới
                    </button>
                    <button
                        onClick={() => setActiveTab('old')}
                        className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all duration-150 flex items-center justify-center gap-2 ${
                            activeTab === 'old' 
                                ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100' 
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                    >
                        <Building2 size={16} /> Tra cứu theo Giai đoạn Cũ
                    </button>
                    <button
                        onClick={() => setActiveTab('intermediate')}
                        className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all duration-150 flex items-center justify-center gap-2 ${
                            activeTab === 'intermediate' 
                                ? 'bg-amber-50 text-amber-800 shadow-sm border border-amber-100' 
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                    >
                        <Building2 size={16} /> Tra cứu theo Giai đoạn Trung gian
                    </button>
                </div>
            </div>

            {/* Main Layout (Split View: Filter sidebar on the left, Table on the right) */}
            <div className="flex flex-1 overflow-hidden px-6 pb-6 gap-6">
                
                {/* Search Sidebar (dynamically changes input fields based on the selected ActiveTab) */}
                <div className="w-72 bg-white rounded-b-xl border-x border-b border-slate-200 shadow-sm flex flex-col shrink-0 h-fit">
                    <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                        <Search className="text-blue-600" size={18} />
                        <h3 className="font-bold text-slate-800 text-sm">
                            Bộ lọc tìm kiếm
                        </h3>
                    </div>
                    <div className="p-4 flex flex-col gap-4">
                        
                        {activeTab === 'new' && (
                            <>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Xã phường mới</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <select 
                                            value={searchXaMoi}
                                            onChange={(e) => setSearchXaMoi(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none text-slate-700 font-medium"
                                        >
                                            <option value="">Tất cả xã phường mới</option>
                                            {uniqueNewWards.map(w => <option key={w} value={w}>{w}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tờ bản đồ mới</label>
                                    <div className="relative">
                                        <Grid className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input 
                                            type="text" 
                                            placeholder="Số tờ mới (ví dụ: T12)" 
                                            value={searchToMoi}
                                            onChange={(e) => setSearchToMoi(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-700"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Số thửa mới</label>
                                    <div className="relative">
                                        <Grid className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input 
                                            type="text" 
                                            placeholder="Thửa mới (ví dụ: 125)" 
                                            value={searchThuaMoi}
                                            onChange={(e) => setSearchThuaMoi(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-700"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {activeTab === 'old' && (
                            <>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Xã phường cũ</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <select 
                                            value={searchXaCu}
                                            onChange={(e) => setSearchXaCu(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none text-slate-700 font-medium"
                                        >
                                            <option value="">Tất cả xã phường cũ</option>
                                            {uniqueOldWards.map(w => <option key={w} value={w}>{w}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tờ bản đồ cũ</label>
                                    <div className="relative">
                                        <Grid className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input 
                                            type="text" 
                                            placeholder="Số tờ cũ (ví dụ: T05)" 
                                            value={searchToCu}
                                            onChange={(e) => setSearchToCu(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-700"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Số thửa cũ</label>
                                    <div className="relative">
                                        <Grid className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input 
                                            type="text" 
                                            placeholder="Thửa cũ (ví dụ: 10)" 
                                            value={searchThuaCu}
                                            onChange={(e) => setSearchThuaCu(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-700"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {activeTab === 'intermediate' && (
                            <>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Xã phường cũ</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <select 
                                            value={searchXaCuTG}
                                            onChange={(e) => setSearchXaCuTG(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none text-slate-700 font-medium"
                                        >
                                            <option value="">Tất cả xã phường cũ</option>
                                            {uniqueOldWards.map(w => <option key={w} value={w}>{w}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tờ bản đồ trung gian</label>
                                    <div className="relative">
                                        <Grid className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input 
                                            type="text" 
                                            placeholder="Tờ trung gian (ví dụ: T08)" 
                                            value={searchToTG}
                                            onChange={(e) => setSearchToTG(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-700"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Thửa trung gian</label>
                                    <div className="relative">
                                        <Grid className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input 
                                            type="text" 
                                            placeholder="Thửa trung gian (ví dụ: 45)" 
                                            value={searchThuaTG}
                                            onChange={(e) => setSearchThuaTG(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-700"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="flex gap-2 mt-2">
                            <button 
                                onClick={handleReset}
                                className="flex-1 bg-white text-slate-600 border border-slate-200 py-2 rounded-lg font-bold text-xs hover:bg-slate-50 transition-colors"
                            >
                                Xóa bộ lọc
                            </button>
                            <button 
                                onClick={handleSearch}
                                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold text-xs hover:bg-blue-700 transition-colors shadow-sm"
                            >
                                Tra cứu
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Table Area */}
                <div className="flex-1 flex flex-col gap-6 min-w-0">
                    
                    {/* Table Card */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1 min-h-0">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center justify-center bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-bold">
                                    {filteredData.length} kết quả
                                </span>
                            </div>
                            <div className="flex items-center gap-4">
                                {data.length > 0 && (
                                    <button 
                                        onClick={handleDeleteAll}
                                        disabled={saving}
                                        className="flex items-center gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                                    >
                                        <Trash2 size={16} /> Xóa tất cả dữ liệu
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Interactive Tables based on the active tab */}
                        <div className="flex-1 overflow-auto">
                            {loading ? (
                                <div className="flex justify-center items-center h-full">
                                    <Loader2 className="animate-spin text-blue-500" size={32} />
                                </div>
                            ) : paginatedData.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                                    <FileSpreadsheet size={48} className="opacity-20" />
                                    <p className="text-sm">Không tìm thấy dữ liệu chuyển đổi nào phù hợp.</p>
                                </div>
                            ) : activeTab === 'new' ? (
                                /* TABLE 1: VIEW/SEARCH BY NEW PHASE */
                                <table className="w-full text-sm text-left whitespace-nowrap">
                                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-3.5 text-center w-16">STT</th>
                                            <th className="px-6 py-3.5 text-blue-800 bg-blue-50/30">XÃ PHƯỜNG MỚI</th>
                                            <th className="px-6 py-3.5 text-center text-blue-800 bg-blue-50/30">TỜ MỚI</th>
                                            <th className="px-6 py-3.5 text-center text-blue-800 bg-blue-50/30">THỬA MỚI</th>
                                            <th className="px-6 py-3.5">GIAI ĐOẠN TRUNG GIAN</th>
                                            <th className="px-6 py-3.5">GIAI ĐOẠN CŨ</th>
                                            <th className="px-6 py-3.5 text-center w-24">THAO TÁC</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {paginatedData.map((row, index) => {
                                            const hasTG = row.so_to_trung_gian || row.so_thua_trung_gian;
                                            return (
                                                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="px-6 py-3.5 text-center text-slate-400 font-mono text-xs">
                                                        {String((currentPage - 1) * itemsPerPage + index + 1).padStart(2, '0')}
                                                    </td>
                                                    <td className="px-6 py-3.5 font-bold text-blue-700 bg-blue-50/10">
                                                        {row.xa_phuong_moi}
                                                    </td>
                                                    <td className="px-6 py-3.5 text-center bg-blue-50/10">
                                                        <span className="inline-block bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded font-bold text-xs">
                                                            {row.so_to_moi}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3.5 text-center bg-blue-50/10">
                                                        {row.so_thua_moi ? (
                                                            <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium text-xs">
                                                                {row.so_thua_moi}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300 text-xs">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-3.5 text-slate-600">
                                                        {hasTG ? (
                                                            <div className="flex flex-col text-xs">
                                                                <span className="text-slate-750 font-semibold">Tờ: <b className="text-amber-700">{row.so_to_trung_gian || '-'}</b></span>
                                                                <span className="text-slate-550">Thửa: <b className="text-amber-700">{row.so_thua_trung_gian || '-'}</b></span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-300 text-xs italic">Không qua trung gian</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-3.5 text-slate-600">
                                                        <div className="flex flex-col text-xs">
                                                            <span className="font-semibold text-slate-700">{row.xa_phuong_cu}</span>
                                                            <span className="text-slate-500">Tờ: <b className="text-indigo-700">{row.so_to_cu}</b> | Thửa: <b className="text-indigo-700">{row.so_thua_cu || '-'}</b></span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3.5 text-center">
                                                        <div className="flex justify-center gap-3 text-slate-400">
                                                            <button onClick={() => handleOpenEntryModal(row)} className="hover:text-blue-600 transition-colors" title="Sửa bản ghi"><Edit2 size={15} /></button>
                                                            <button onClick={() => handleSingleDelete(row.id)} className="hover:text-red-600 transition-colors" title="Xóa"><Trash2 size={15} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : activeTab === 'old' ? (
                                /* TABLE 2: VIEW/SEARCH BY OLD PHASE */
                                <table className="w-full text-sm text-left whitespace-nowrap">
                                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-3.5 text-center w-16">STT</th>
                                            <th className="px-6 py-3.5 text-indigo-900 bg-indigo-50/30">XÃ PHƯỜNG CŨ</th>
                                            <th className="px-6 py-3.5 text-center text-indigo-900 bg-indigo-50/30">TỜ CŨ</th>
                                            <th className="px-6 py-3.5 text-center text-indigo-900 bg-indigo-50/30">THỬA CŨ</th>
                                            <th className="px-6 py-3.5">GIAI ĐOẠN TRUNG GIAN</th>
                                            <th className="px-6 py-3.5">GIAI ĐOẠN MỚI</th>
                                            <th className="px-6 py-3.5 text-center w-24">THAO TÁC</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {paginatedData.map((row, index) => {
                                            const hasTG = row.so_to_trung_gian || row.so_thua_trung_gian;
                                            return (
                                                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="px-6 py-3.5 text-center text-slate-400 font-mono text-xs">
                                                        {String((currentPage - 1) * itemsPerPage + index + 1).padStart(2, '0')}
                                                    </td>
                                                    <td className="px-6 py-3.5 font-bold text-indigo-700 bg-indigo-50/10">
                                                        {row.xa_phuong_cu}
                                                    </td>
                                                    <td className="px-6 py-3.5 text-center bg-indigo-50/10">
                                                        <span className="inline-block bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded font-bold text-xs">
                                                            {row.so_to_cu}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3.5 text-center bg-indigo-50/10">
                                                        {row.so_thua_cu ? (
                                                            <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium text-xs">
                                                                {row.so_thua_cu}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300 text-xs">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-3.5 text-slate-600">
                                                        {hasTG ? (
                                                            <div className="flex flex-col text-xs">
                                                                <span className="text-slate-750 font-semibold">Tờ: <b className="text-amber-700">{row.so_to_trung_gian || '-'}</b></span>
                                                                <span className="text-slate-550">Thửa: <b className="text-amber-700">{row.so_thua_trung_gian || '-'}</b></span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-300 text-xs italic">Không qua trung gian</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-3.5 text-slate-600">
                                                        <div className="flex flex-col text-xs">
                                                            <span className="font-semibold text-slate-700">{row.xa_phuong_moi}</span>
                                                            <span className="text-slate-500">Tờ: <b className="text-blue-700">{row.so_to_moi}</b> | Thửa: <b className="text-blue-700">{row.so_thua_moi || '-'}</b></span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3.5 text-center">
                                                        <div className="flex justify-center gap-3 text-slate-400">
                                                            <button onClick={() => handleOpenEntryModal(row)} className="hover:text-blue-600 transition-colors" title="Sửa bản ghi"><Edit2 size={15} /></button>
                                                            <button onClick={() => handleSingleDelete(row.id)} className="hover:text-red-600 transition-colors" title="Xóa"><Trash2 size={15} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                /* TABLE 3: VIEW/SEARCH BY INTERMEDIATE PHASE */
                                <table className="w-full text-sm text-left whitespace-nowrap">
                                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-3.5 text-center w-16">STT</th>
                                            <th className="px-6 py-3.5 text-amber-900 bg-amber-50/40">XÃ PHƯỜNG CŨ</th>
                                            <th className="px-6 py-3.5 text-center text-amber-900 bg-amber-50/40">TỜ TRUNG GIAN</th>
                                            <th className="px-6 py-3.5 text-center text-amber-900 bg-amber-50/40">THỬA TRUNG GIAN</th>
                                            <th className="px-6 py-3.5">GIAI ĐOẠN CŨ</th>
                                            <th className="px-6 py-3.5">GIAI ĐOẠN MỚI</th>
                                            <th className="px-6 py-3.5 text-center w-24">THAO TÁC</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {paginatedData.map((row, index) => {
                                            const hasTG = row.so_to_trung_gian || row.so_thua_trung_gian;
                                            return (
                                                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="px-6 py-3.5 text-center text-slate-400 font-mono text-xs">
                                                        {String((currentPage - 1) * itemsPerPage + index + 1).padStart(2, '0')}
                                                    </td>
                                                    <td className="px-6 py-3.5 font-bold text-amber-850 bg-amber-50/10">
                                                        {row.xa_phuong_cu}
                                                    </td>
                                                    <td className="px-6 py-3.5 text-center bg-amber-50/10">
                                                        {row.so_to_trung_gian ? (
                                                            <span className="inline-block bg-amber-100 text-amber-850 px-2.5 py-0.5 rounded font-bold text-xs">
                                                                {row.so_to_trung_gian}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300 text-xs italic">Không có</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-3.5 text-center bg-amber-50/10">
                                                        {row.so_thua_trung_gian ? (
                                                            <span className="inline-block bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-medium text-xs">
                                                                {row.so_thua_trung_gian}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300 text-xs italic">Không có</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-3.5 text-slate-600">
                                                        <div className="flex flex-col text-xs">
                                                            <span className="font-semibold text-slate-700">{row.xa_phuong_cu}</span>
                                                            <span className="text-slate-500">Tờ: <b className="text-indigo-700">{row.so_to_cu}</b> | Thửa: <b className="text-indigo-700">{row.so_thua_cu || '-'}</b></span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3.5 text-slate-600">
                                                        <div className="flex flex-col text-xs">
                                                            <span className="font-semibold text-slate-700">{row.xa_phuong_moi}</span>
                                                            <span className="text-slate-500">Tờ: <b className="text-blue-700">{row.so_to_moi}</b> | Thửa: <b className="text-blue-700">{row.so_thua_moi || '-'}</b></span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3.5 text-center">
                                                        <div className="flex justify-center gap-3 text-slate-400">
                                                            <button onClick={() => handleOpenEntryModal(row)} className="hover:text-blue-600 transition-colors" title="Sửa bản ghi"><Edit2 size={15} /></button>
                                                            <button onClick={() => handleSingleDelete(row.id)} className="hover:text-red-600 transition-colors" title="Xóa"><Trash2 size={15} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Pagination Area */}
                        {filteredData.length > 0 && (
                            <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-white shrink-0">
                                <span className="text-sm text-slate-500">
                                    Hiển thị {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredData.length)} trong tổng số {filteredData.length} bản ghi
                                </span>
                                <div className="flex items-center gap-1">
                                    <button 
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    
                                    {[...Array(Math.min(3, totalPages))].map((_, i) => (
                                        <button 
                                            key={i}
                                            onClick={() => setCurrentPage(i + 1)}
                                            className={`w-8 h-8 rounded-md text-sm font-medium ${currentPage === i + 1 ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                    {totalPages > 3 && <span className="px-1 text-slate-400">...</span>}
                                    {totalPages > 3 && (
                                        <button 
                                            onClick={() => setCurrentPage(totalPages)}
                                            className={`w-8 h-8 rounded-md text-sm font-medium ${currentPage === totalPages ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            {totalPages}
                                        </button>
                                    )}

                                    <button 
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Summary Statistics Cards */}
                    <div className="shrink-0">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">TỔNG HỢP SỐ LƯỢNG HÀNH CHÍNH</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                                    <Building2 size={24} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">XÃ PHƯỜNG CŨ</p>
                                    <p className="text-3xl font-black text-slate-800 leading-none mt-1">{uniqueOldWards.length}</p>
                                    <button onClick={() => openStatsPopup('old')} className="text-xs text-indigo-600 hover:underline mt-1 font-medium">Xem chi tiết</button>
                                </div>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                    <Building2 size={24} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">XÃ PHƯỜNG MỚI</p>
                                    <p className="text-3xl font-black text-slate-800 leading-none mt-1">{uniqueNewWards.length}</p>
                                    <button onClick={() => openStatsPopup('new')} className="text-xs text-blue-600 hover:underline mt-1 font-medium">Xem chi tiết</button>
                                </div>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                                    <Grid size={24} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">TỔNG BẢN GHI LIÊN KẾT</p>
                                    <p className="text-3xl font-black text-slate-800 leading-none mt-1">{data.length}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Stat Details Popup */}
            {isStatsPopupOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh] animate-scale-up">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800">
                                Chi tiết số lượng tờ bản đồ
                            </h3>
                            <button onClick={() => setIsStatsPopupOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 bg-blue-50/50 border-b">
                            <p className="text-xs text-slate-600 font-medium">
                                Thống kê số lượng liên kết theo: <span className="font-bold text-blue-600">{statsPopupType === 'old' ? 'Xã phường cũ' : 'Xã phường mới'}</span>
                            </p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <ul className="space-y-2">
                                {(statsPopupType === 'old' ? oldWardStats : newWardStats).map((stat, idx) => (
                                    <li key={idx} className="flex justify-between items-center p-3 bg-white border rounded-lg shadow-sm hover:border-blue-200 transition-colors">
                                        <span className="font-bold text-slate-700 text-sm">{stat.name}</span>
                                        <span className="bg-blue-50 text-blue-700 font-bold px-3 py-1 rounded-full text-xs">
                                            {stat.count} liên kết
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="p-4 border-t bg-slate-50 flex justify-end">
                            <button 
                                onClick={() => setIsStatsPopupOpen(false)}
                                className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MANUAL ENTRY MODAL (Supports 3-Phase Adding / Editing) */}
            {isEntryModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col my-8 animate-scale-up border border-slate-100">
                        
                        {/* Modal Header */}
                        <div className="p-5 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">
                                    {editingRecord ? 'Cập nhật bản ghi chuyển đổi bản đồ' : 'Thêm mới bản ghi chuyển đổi bản đồ'}
                                </h3>
                                <p className="text-slate-500 text-xs mt-1">Điền thông tin thửa, tờ bản đồ qua các thời kỳ lịch sử.</p>
                            </div>
                            <button onClick={() => setIsEntryModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleSaveManualEntry} className="flex-1 flex flex-col">
                            <div className="p-6 overflow-y-auto max-h-[65vh] space-y-6">
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    
                                    {/* PHASE 1: OLD PHASE CARD */}
                                    <div className="bg-indigo-50/20 p-4 rounded-xl border border-indigo-100/50 space-y-4">
                                        <div className="flex items-center gap-2 border-b border-indigo-100 pb-2 mb-2">
                                            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">1</span>
                                            <h4 className="font-bold text-indigo-900 text-sm uppercase tracking-wide">Giai đoạn Cũ</h4>
                                        </div>
                                        
                                        <div className="space-y-3.5">
                                            <div>
                                                <label className="block text-xs font-bold text-indigo-950 mb-1">Xã phường cũ <span className="text-red-500">*</span></label>
                                                <input 
                                                    type="text" 
                                                    required
                                                    list="old-wards-list"
                                                    placeholder="Tên xã phường cũ"
                                                    value={modalFormData.xa_phuong_cu}
                                                    onChange={(e) => setModalFormData({...modalFormData, xa_phuong_cu: e.target.value})}
                                                    className="w-full px-3 py-2 border border-slate-250 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-850 font-medium"
                                                />
                                                <datalist id="old-wards-list">
                                                    {uniqueOldWards.map(w => <option key={w} value={w} />)}
                                                </datalist>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-indigo-950 mb-1">Số tờ cũ <span className="text-red-500">*</span></label>
                                                <input 
                                                    type="text" 
                                                    required
                                                    placeholder="Ví dụ: T05"
                                                    value={modalFormData.so_to_cu}
                                                    onChange={(e) => setModalFormData({...modalFormData, so_to_cu: e.target.value})}
                                                    className="w-full px-3 py-2 border border-slate-250 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-850 font-medium"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-indigo-950 mb-1">Số thửa cũ</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="Ví dụ: 12"
                                                    value={modalFormData.so_thua_cu}
                                                    onChange={(e) => setModalFormData({...modalFormData, so_thua_cu: e.target.value})}
                                                    className="w-full px-3 py-2 border border-slate-250 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-850 font-medium"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* PHASE 2: INTERMEDIATE PHASE CARD */}
                                    <div className="bg-amber-50/25 p-4 rounded-xl border border-amber-100/50 space-y-4">
                                        <div className="flex items-center gap-2 border-b border-amber-100 pb-2 mb-2">
                                            <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-xs">2</span>
                                            <h4 className="font-bold text-amber-900 text-sm uppercase tracking-wide">Giai đoạn Trung gian</h4>
                                        </div>
                                        
                                        <div className="space-y-3.5">
                                            <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-200/50 text-xs text-amber-800">
                                                <span className="font-semibold block mb-0.5">Xã phường:</span>
                                                <span className="text-slate-800 font-bold text-sm">{modalFormData.xa_phuong_cu || 'Chưa chọn xã cũ'}</span>
                                                <span className="block mt-1 text-[10px] text-amber-600 italic">(Hệ thống tự động sử dụng Xã phường cũ)</span>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-amber-950 mb-1">Số tờ trung gian</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="Ví dụ: T08"
                                                    value={modalFormData.so_to_trung_gian}
                                                    onChange={(e) => setModalFormData({...modalFormData, so_to_trung_gian: e.target.value})}
                                                    className="w-full px-3 py-2 border border-slate-250 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none text-slate-850 font-medium"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-amber-950 mb-1">Số thửa trung gian</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="Ví dụ: 45"
                                                    value={modalFormData.so_thua_trung_gian}
                                                    onChange={(e) => setModalFormData({...modalFormData, so_thua_trung_gian: e.target.value})}
                                                    className="w-full px-3 py-2 border border-slate-250 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none text-slate-850 font-medium"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* PHASE 3: NEW PHASE CARD */}
                                    <div className="bg-blue-50/20 p-4 rounded-xl border border-blue-100/50 space-y-4">
                                        <div className="flex items-center gap-2 border-b border-blue-100 pb-2 mb-2">
                                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">3</span>
                                            <h4 className="font-bold text-blue-900 text-sm uppercase tracking-wide">Giai đoạn Mới</h4>
                                        </div>
                                        
                                        <div className="space-y-3.5">
                                            <div>
                                                <label className="block text-xs font-bold text-blue-950 mb-1">Xã phường mới <span className="text-red-500">*</span></label>
                                                <input 
                                                    type="text" 
                                                    required
                                                    list="new-wards-list"
                                                    placeholder="Tên xã phường mới"
                                                    value={modalFormData.xa_phuong_moi}
                                                    onChange={(e) => setModalFormData({...modalFormData, xa_phuong_moi: e.target.value})}
                                                    className="w-full px-3 py-2 border border-slate-250 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-850 font-medium"
                                                />
                                                <datalist id="new-wards-list">
                                                    {uniqueNewWards.map(w => <option key={w} value={w} />)}
                                                </datalist>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-blue-950 mb-1">Số tờ mới <span className="text-red-500">*</span></label>
                                                <input 
                                                    type="text" 
                                                    required
                                                    placeholder="Ví dụ: T12"
                                                    value={modalFormData.so_to_moi}
                                                    onChange={(e) => setModalFormData({...modalFormData, so_to_moi: e.target.value})}
                                                    className="w-full px-3 py-2 border border-slate-250 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-850 font-medium"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-blue-950 mb-1">Số thửa mới</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="Ví dụ: 78"
                                                    value={modalFormData.so_thua_moi}
                                                    onChange={(e) => setModalFormData({...modalFormData, so_thua_moi: e.target.value})}
                                                    className="w-full px-3 py-2 border border-slate-250 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-850 font-medium"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                </div>

                                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200/60 flex items-start gap-2.5 text-xs text-slate-600">
                                    <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                                    <p className="leading-relaxed">
                                        <b>Lưu ý đồng bộ:</b> Khi tạo/sửa bản ghi, nếu giai đoạn trung gian được để trống Xã phường nhưng có điền số tờ hoặc số thửa, hệ thống sẽ tự động sao chép tên xã của giai đoạn cũ sang giai đoạn trung gian để tối ưu hóa tốc độ làm việc.
                                    </p>
                                </div>
                            </div>

                            {/* Modal Actions */}
                            <div className="p-4 border-t bg-slate-50 flex justify-end gap-3 rounded-b-xl">
                                <button 
                                    type="button"
                                    onClick={() => setIsEntryModalOpen(false)}
                                    className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-semibold text-sm hover:bg-slate-100 transition-colors"
                                >
                                    Hủy bỏ
                                </button>
                                <button 
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    {saving && <Loader2 size={16} className="animate-spin" />}
                                    Lưu lại
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChuyenDoiToBanDoTab;

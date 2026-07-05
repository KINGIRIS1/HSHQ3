import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, Trash2, FileSpreadsheet, Loader2, Search, Download, Layers, ArrowRight, ChevronLeft, ChevronRight, X, Edit2, Play, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { NotifyFunction, RecordFile } from '../../types';
import { fetchProcedureConversions, saveProcedureConversions, deleteProcedureConversion, deleteAllProcedureConversions, ProcedureConversion } from '../../services/apiUtilities';

interface Props {
    notify: NotifyFunction;
    records: RecordFile[];
    onUpdateRecord?: (r: RecordFile) => Promise<any>;
    onRefreshData?: () => void;
}

const DongBoThuTucTab: React.FC<Props> = ({ notify, records, onUpdateRecord, onRefreshData }) => {
    const [conversions, setConversions] = useState<ProcedureConversion[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    
    // Filtering states for the mapping list
    const [searchTerm, setSearchTerm] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
    
    // Pagination for rules
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    // Add / Edit Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<Partial<ProcedureConversion> | null>(null);
    const [thuTucCuVal, setThuTucCuVal] = useState('');
    const [thuTucMoiVal, setThuTucMoiVal] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial load
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const rules = await fetchProcedureConversions();
            setConversions(rules);
        } catch (error) {
            notify('Lỗi khi tải luật đồng bộ thủ tục.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Calculate matching obsolete records based on existing procedure conversions
    const obsoleteRecords = useMemo(() => {
        if (!conversions || conversions.length === 0 || !records || records.length === 0) return [];
        
        return records.filter(record => {
            const currentType = (record.recordType || '').trim();
            if (!currentType) return false;
            
            // Check if the recordType matches any "thu_tuc_cu" in conversion table
            return conversions.some(conv => conv.thu_tuc_cu.toLowerCase() === currentType.toLowerCase());
        }).map(record => {
            const matchingConv = conversions.find(conv => conv.thu_tuc_cu.toLowerCase() === (record.recordType || '').trim().toLowerCase());
            return {
                record,
                oldProcedure: record.recordType || '',
                newProcedure: matchingConv ? matchingConv.thu_tuc_moi : ''
            };
        });
    }, [conversions, records]);

    // Track chosen matches to sync (default: all checked)
    const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
    
    // Update selected record keys when obsolete records change
    useEffect(() => {
        setSelectedRecordIds(obsoleteRecords.map(item => item.record.id));
    }, [obsoleteRecords]);

    // Filtered rules
    const filteredRules = useMemo(() => {
        if (!appliedSearch) return conversions;
        const s = appliedSearch.trim().toLowerCase();
        return conversions.filter(item => 
            item.thu_tuc_cu.toLowerCase().includes(s) || 
            item.thu_tuc_moi.toLowerCase().includes(s)
        );
    }, [conversions, appliedSearch]);

    // Paginated rules
    const paginatedRules = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredRules.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredRules, currentPage]);

    const totalPages = Math.ceil(filteredRules.length / itemsPerPage) || 1;

    const handleSearch = () => {
        setAppliedSearch(searchTerm);
        setCurrentPage(1);
    };

    const handleReset = () => {
        setSearchTerm('');
        setAppliedSearch('');
        setCurrentPage(1);
    };

    const handleOpenAddModal = (rule?: ProcedureConversion) => {
        if (rule) {
            setEditingRule(rule);
            setThuTucCuVal(rule.thu_tuc_cu);
            setThuTucMoiVal(rule.thu_tuc_moi);
        } else {
            setEditingRule(null);
            setThuTucCuVal('');
            setThuTucMoiVal('');
        }
        setIsModalOpen(true);
    };

    const handleSaveRule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!thuTucCuVal.trim() || !thuTucMoiVal.trim()) {
            notify('Vui lòng điền đầy đủ cả thủ tục cũ và mới!', 'error');
            return;
        }

        setSaving(true);
        try {
            if (editingRule && editingRule.id) {
                // To replace edited rules in fallback easily, we can delete the old and insert new, or insert directly
                await deleteProcedureConversion(editingRule.id);
            }
            const success = await saveProcedureConversions([{
                thu_tuc_cu: thuTucCuVal.trim(),
                thu_tuc_moi: thuTucMoiVal.trim()
            }]);

            if (success) {
                notify(editingRule ? 'Đã cập nhật luật ánh xạ thủ tục.' : 'Đã thêm luật ánh xạ thủ tục mới.', 'success');
                setIsModalOpen(false);
                loadData();
            } else {
                notify('Lưu thất bại.', 'error');
            }
        } catch (error) {
            notify('Lỗi hệ thống khi lưu luật ánh xạ.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRule = async (id: string) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa luật ánh xạ thủ tục này?')) return;
        try {
            const success = await deleteProcedureConversion(id);
            if (success) {
                notify('Đã xóa luật ánh xạ thủ tục thành công.', 'success');
                loadData();
            } else {
                notify('Xóa thất bại.', 'error');
            }
        } catch (error) {
            notify('Lỗi hệ thống khi xóa.', 'error');
        }
    };

    const handleDeleteAll = async () => {
        if (!window.confirm('CẢNH BÁO: Hành động này sẽ xóa toàn bộ luật ánh xạ thủ tục trong hệ thống! Bạn có chắc chắn muốn tiếp tục?')) return;
        setSaving(true);
        try {
            const success = await deleteAllProcedureConversions();
            if (success) {
                notify('Đã xóa sạch bảng ánh xạ thủ tục.', 'success');
                loadData();
            } else {
                notify('Dọn dẹp bảng thất bại.', 'error');
            }
        } catch (error) {
            notify('Đã xảy ra lỗi.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDownloadTemplate = () => {
        const header = [["Thủ tục cũ", "Thủ tục mới"]];
        const sampleRows = [
            ["3.1 Thừa kế", "3.1 Đăng ký biến động do thừa kế quyền sử dụng đất"],
            ["3.2 Tặng Cho", "3.2 Đăng ký biến động do tặng cho quyền sử dụng đất"],
            ["3.3 Chuyển Nhượng", "3.3 Đăng ký biến động do chuyển nhượng quyền sử dụng đất"],
            ["3.10 Tách thửa, Hợp thửa", "3.10 Đăng ký biến động do tách thửa, hợp thửa đất"]
        ];

        const ws = XLSX.utils.aoa_to_sheet([...header, ...sampleRows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Mau_Dong_Bo_Thu_Tuc");
        
        XLSX.writeFile(wb, "Mau_Anh_Xa_Thu_Tuc.xlsx");
        notify('Đã tải xuống tệp mẫu Excel.', 'success');
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSaving(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const rawData = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });

                if (rawData.length < 2) {
                    notify('Tệp tin trống hoặc không đúng định dạng mẫu.', 'error');
                    setSaving(false);
                    return;
                }

                const importedConversions: any[] = [];
                for (let i = 1; i < rawData.length; i++) {
                    const row = rawData[i];
                    if (row && row[0] && row[1]) {
                        importedConversions.push({
                            thu_tuc_cu: String(row[0]).trim(),
                            thu_tuc_moi: String(row[1]).trim()
                        });
                    }
                }

                if (importedConversions.length === 0) {
                    notify('Không tìm thấy dòng hợp lệ để nhập.', 'error');
                    setSaving(false);
                    return;
                }

                const success = await saveProcedureConversions(importedConversions);
                if (success) {
                    notify(`Nhập thành công ${importedConversions.length} luật ánh xạ thủ tục mới!`, 'success');
                    loadData();
                } else {
                    notify('Nhập dữ liệu thất bại.', 'error');
                }
            } catch (error) {
                notify('Có lỗi xảy ra khi đọc tệp Excel.', 'error');
            } finally {
                setSaving(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    // Bulk Synchronize selected records
    const handleSyncSelectedRecords = async () => {
        if (selectedRecordIds.length === 0) {
            notify('Vui lòng chọn ít nhất một hồ sơ để đồng bộ!', 'error');
            return;
        }

        if (!onUpdateRecord) {
            notify('Chức năng đồng bộ chưa được liên kết với hệ thống cập nhật.', 'error');
            return;
        }

        setSyncing(true);
        try {
            let successCount = 0;
            const itemsToSync = obsoleteRecords.filter(item => selectedRecordIds.includes(item.record.id));
            
            for (const item of itemsToSync) {
                if (!item.newProcedure) continue;
                
                const updatedRecord: RecordFile = {
                    ...item.record,
                    recordType: item.newProcedure,
                    // Optionally record a flag or note of sync history
                    notes: (item.record.notes || '') + `\n[Đồng bộ thủ tục]: Đổi từ '${item.oldProcedure}' sang '${item.newProcedure}'`
                };

                const res = await onUpdateRecord(updatedRecord);
                if (res) {
                    successCount++;
                }
            }

            notify(`Đồng bộ thành công ${successCount}/${itemsToSync.length} hồ sơ đất đai sang Luật mới!`, 'success');
            
            if (onRefreshData) {
                onRefreshData();
            }
        } catch (error) {
            notify('Đã xảy ra lỗi trong quá trình đồng bộ hồ sơ.', 'error');
        } finally {
            setSyncing(false);
        }
    };

    const toggleSelectRecord = (id: string) => {
        setSelectedRecordIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const toggleSelectAllRecords = () => {
        if (selectedRecordIds.length === obsoleteRecords.length) {
            setSelectedRecordIds([]);
        } else {
            setSelectedRecordIds(obsoleteRecords.map(item => item.record.id));
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] animate-fade-in overflow-hidden">
            {/* Header */}
            <div className="p-6 pb-4 flex justify-between items-start shrink-0 border-b border-slate-200 bg-white">
                <div>
                    <div className="flex items-center gap-2">
                        <Layers className="text-rose-600" size={24} />
                        <h2 className="text-2xl font-bold text-slate-800">Đồng bộ thủ tục cũ và mới</h2>
                    </div>
                    <p className="text-slate-500 text-sm mt-1">Quản lý nâng cấp tên thủ tục Luật Đất đai 2013 sang Luật Đất đai 2024 để đảm bảo tính nhất quán.</p>
                </div>
                <div className="flex gap-2.5">
                    <button 
                        onClick={handleDownloadTemplate}
                        className="flex items-center gap-2 bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors shadow-sm text-sm"
                    >
                        <Download size={16} /> Tải tệp mẫu
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
                        className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50 text-sm"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        Nhập từ Excel
                    </button>
                    <button 
                        onClick={() => handleOpenAddModal()}
                        className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm text-sm"
                    >
                        + Thêm ánh xạ mới
                    </button>
                </div>
            </div>

            {/* Main Content Pane */}
            <div className="flex flex-1 overflow-hidden p-6 gap-6 min-h-0">
                {/* Left Panel: Conversion Mapper Configuration */}
                <div className="w-1/2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Layers className="text-slate-600" size={18} />
                            <h3 className="font-bold text-slate-800">Ánh xạ cấu hình ({conversions.length} luật)</h3>
                        </div>
                        {conversions.length > 0 && (
                            <button 
                                onClick={handleDeleteAll}
                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded text-xs font-bold transition-all flex items-center gap-1"
                            >
                                <Trash2 size={13} /> Xóa sạch luật
                            </button>
                        )}
                    </div>

                    {/* Filter and search in mapping rules */}
                    <div className="p-3 border-b border-slate-200 flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                type="text"
                                placeholder="Tìm thủ tục cũ hoặc mới..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-rose-500"
                            />
                        </div>
                        <button onClick={handleSearch} className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-900 transition-colors">
                            Tìm
                        </button>
                        {(appliedSearch) && (
                            <button onClick={handleReset} className="border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors">
                                Reset
                            </button>
                        )}
                    </div>

                    {/* Mapping List Table */}
                    <div className="flex-1 overflow-auto">
                        {loading ? (
                            <div className="flex justify-center items-center h-full py-10">
                                <Loader2 className="animate-spin text-rose-600" size={32} />
                            </div>
                        ) : paginatedRules.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 py-10">
                                <FileSpreadsheet size={40} className="text-slate-300" />
                                <p className="text-sm">Không tìm thấy ánh xạ thủ tục nào.</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left whitespace-normal">
                                <thead className="bg-[#fcfdfd] text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 text-center w-12">STT</th>
                                        <th className="px-4 py-3">THỦ TỤC CŨ (2013)</th>
                                        <th className="px-2 py-3 text-center w-8">➡️</th>
                                        <th className="px-4 py-3">THỦ TỤC MỚI (2024)</th>
                                        <th className="px-4 py-3 text-center w-20">LỆNH</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {paginatedRules.map((rule, idx) => (
                                        <tr key={rule.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-4 py-3 text-center text-slate-400 font-medium text-xs">
                                                {String((currentPage - 1) * itemsPerPage + idx + 1).padStart(2, '0')}
                                            </td>
                                            <td className="px-4 py-3 text-slate-700 font-medium text-xs break-all">
                                                <span className="inline-block bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono text-[11px] font-bold mr-1.5">OLD</span>
                                                {rule.thu_tuc_cu}
                                            </td>
                                            <td className="px-2 py-3 text-center text-slate-400">
                                                <ArrowRight size={14} className="mx-auto" />
                                            </td>
                                            <td className="px-4 py-3 text-rose-700 font-semibold text-xs break-all">
                                                <span className="inline-block bg-rose-50 text-rose-700 px-2 py-0.5 rounded font-mono text-[11px] font-bold mr-1.5">NEW</span>
                                                {rule.thu_tuc_moi}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex justify-center gap-1.5 text-slate-400 group-hover:text-slate-600 transition-colors">
                                                    <button 
                                                        onClick={() => handleOpenAddModal(rule)}
                                                        className="hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                                                        title="Sửa ánh xạ"
                                                    >
                                                        <Edit2 size={13} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteRule(rule.id)}
                                                        className="hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                                                        title="Xóa luật"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Left Pane Pagination */}
                    {filteredRules.length > 0 && (
                        <div className="p-3 border-t border-slate-200 flex justify-between items-center bg-white rounded-b-xl shrink-0">
                            <span className="text-[11px] text-slate-500">
                                Hiển thị {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredRules.length)} trên {filteredRules.length} luật
                            </span>
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-1 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <span className="text-xs font-semibold text-slate-700 px-2">{currentPage} / {totalPages}</span>
                                <button 
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-1 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Panel: Obsolete Records Synchronizer Action */}
                <div className="w-1/2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <RefreshCw className="text-blue-600" size={18} />
                            <h3 className="font-bold text-slate-800">Đồng bộ hồ sơ đất đai</h3>
                        </div>
                        {obsoleteRecords.length > 0 && (
                            <span className="bg-rose-50 text-rose-700 text-xs font-bold px-2.5 py-1 rounded-full animate-pulse border border-rose-100">
                                Phát hiện {obsoleteRecords.length} hồ sơ cũ
                            </span>
                        )}
                    </div>

                    {/* Sync Action Area */}
                    <div className="p-5 border-b border-slate-200 bg-gradient-to-br from-blue-50/40 to-indigo-50/20 flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 shrink-0 mt-0.5">
                                <Play size={18} />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-slate-800 text-sm">Tiến hành đồng bộ hóa hàng loạt</h4>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                    Hệ thống tự động phát hiện các hồ sơ đang mang thông tin thủ tục cũ từ cơ sở dữ liệu. Nhấn đồng bộ để chuyển toàn bộ về tên thủ tục chuẩn theo Luật mới.
                                </p>
                            </div>
                        </div>

                        {obsoleteRecords.length > 0 ? (
                            <div className="mt-2 flex items-center justify-between border border-blue-200 bg-blue-50/40 p-3 rounded-lg">
                                <div className="text-xs text-blue-900 font-medium">
                                    Đang chuẩn bị cập nhật <strong className="text-blue-700">{selectedRecordIds.length}</strong> / {obsoleteRecords.length} hồ sơ đã chọn
                                </div>
                                <button
                                    onClick={handleSyncSelectedRecords}
                                    disabled={syncing || selectedRecordIds.length === 0}
                                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-xs transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                    Bắt đầu đồng bộ
                                </button>
                            </div>
                        ) : (
                            <div className="mt-2 border border-slate-200 bg-slate-50 p-4 rounded-lg flex items-center gap-3">
                                <CheckCircle2 className="text-emerald-500 shrink-0" size={18} />
                                <span className="text-xs font-bold text-slate-600">Dữ liệu sạch hoàn toàn! Không có hồ sơ nào cần đồng bộ thủ tục cũ vào lúc này.</span>
                            </div>
                        )}
                    </div>

                    {/* Obsolete Records List Table */}
                    <div className="flex-1 overflow-auto">
                        {obsoleteRecords.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2.5 py-10">
                                <CheckCircle2 size={40} className="text-emerald-500/40" />
                                <span className="text-xs font-medium text-slate-500">Tất cả danh sách hồ sơ hiện tại đều đang sử dụng thủ tục mới.</span>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-[#fcfdfd] text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 text-center w-12">
                                            <input 
                                                type="checkbox"
                                                checked={selectedRecordIds.length === obsoleteRecords.length}
                                                onChange={toggleSelectAllRecords}
                                                className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer h-3.5 w-3.5"
                                            />
                                        </th>
                                        <th className="px-4 py-3">MÃ HỒ SƠ</th>
                                        <th className="px-4 py-3">CHỦ ĐẤT</th>
                                        <th className="px-4 py-3">HÀNH ĐỘNG ĐỒNG BỘ ĐỀ XUẤT</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {obsoleteRecords.map((item, idx) => (
                                        <tr key={item.record.id} className="hover:bg-slate-50 transition-colors text-xs">
                                            <td className="px-4 py-3 text-center">
                                                <input 
                                                    type="checkbox"
                                                    checked={selectedRecordIds.includes(item.record.id)}
                                                    onChange={() => toggleSelectRecord(item.record.id)}
                                                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer h-3.5 w-3.5"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-slate-700 font-mono font-bold leading-none">
                                                {item.record.code}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 font-semibold max-w-[130px] truncate">
                                                {item.record.customerName}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[10px] text-slate-400 line-through truncate max-w-[170px]" title={item.oldProcedure}>
                                                        Cũ: {item.oldProcedure}
                                                    </span>
                                                    <span className="text-[11px] text-blue-700 font-bold flex items-center gap-1 max-w-[170px] truncate" title={item.newProcedure}>
                                                        ➡️ Mới: {item.newProcedure}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* Rule Management Add/Edit Popup Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                                <Layers size={16} className="text-rose-600" />
                                {editingRule ? 'Cập nhật ánh xạ thủ tục' : 'Thêm ánh xạ thủ tục mới'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveRule} className="p-5 flex flex-col gap-4 text-xs font-semibold">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-slate-600 text-[11px] uppercase tracking-wider">Tên thủ tục Luật cũ (ví dụ: 3.1 Thừa kế)</label>
                                <input 
                                    type="text"
                                    required
                                    value={thuTucCuVal}
                                    placeholder="Điền tên thủ tục cũ trong hồ sơ cũ..."
                                    onChange={(e) => setThuTucCuVal(e.target.value)}
                                    className="px-3 py-2 border border-slate-200 rounded-lg text-slate-700 font-normal outline-none focus:ring-1 focus:ring-rose-500"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5 flex-1">
                                <label className="text-slate-600 text-[11px] uppercase tracking-wider">Tên thủ tục Luật mới (Luật Đất đai 2024)</label>
                                <textarea 
                                    required
                                    rows={3}
                                    value={thuTucMoiVal}
                                    placeholder="Điền tên thủ tục chuẩn hóa Luật Đất đai 2024..."
                                    onChange={(e) => setThuTucMoiVal(e.target.value)}
                                    className="px-3 py-2 border border-slate-200 rounded-lg text-slate-700 font-normal outline-none focus:ring-1 focus:ring-rose-500 resize-none"
                                />
                            </div>

                            <div className="mt-4 flex justify-end gap-2 shrink-0">
                                <button 
                                    type="button" 
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-colors"
                                >
                                    Hủy bỏ
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={saving}
                                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold transition-colors flex items-center gap-1.5"
                                >
                                    {saving && <Loader2 size={13} className="animate-spin" />}
                                    {editingRule ? 'Cập nhật' : 'Thêm mới'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DongBoThuTucTab;

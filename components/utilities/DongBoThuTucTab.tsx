import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  RefreshCw, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  Loader2, 
  Save, 
  Check, 
  Edit2, 
  ArrowRight, 
  FileText, 
  User, 
  MapPin, 
  Sparkles,
  HelpCircle,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { NotifyFunction, RecordFile } from '../../types';

interface Props {
  notify: NotifyFunction;
  records: RecordFile[];
  onUpdateRecord?: (r: RecordFile) => Promise<any>;
  onRefreshData?: () => void;
}

// Helper to determine ward abbreviation
const getRecordWardAndPrefix = (record: RecordFile) => {
  let matchedWard = 'Chưa xác định';
  let prefix: 'TQ' | 'MĐ' | 'TK' | 'TH' | string = 'TQ'; // Default prefix if not detected

  // 1. Check ward field
  if (record.ward) {
    const w = record.ward.toLowerCase().trim();
    if (w.includes('tân quan') || w.includes('tq')) {
      matchedWard = 'Tân Quan';
      prefix = 'TQ';
    } else if (w.includes('minh đức') || w.includes('mđ') || w.includes('minh duc')) {
      matchedWard = 'Minh Đức';
      prefix = 'MĐ';
    } else if (w.includes('tân khai') || w.includes('tk')) {
      matchedWard = 'Tân Khai';
      prefix = 'TK';
    } else if (w.includes('tân hưng') || w.includes('th') || w.includes('tan hung')) {
      matchedWard = 'Tân Hưng';
      prefix = 'TH';
    }
  }

  // 2. Check address field if prefix is still default
  if (matchedWard === 'Chưa xác định' && record.address) {
    const addr = record.address.toLowerCase().trim();
    if (addr.includes('tân quan')) {
      matchedWard = 'Tân Quan';
      prefix = 'TQ';
    } else if (addr.includes('minh đức') || addr.includes('minh duc')) {
      matchedWard = 'Minh Đức';
      prefix = 'MĐ';
    } else if (addr.includes('tân khai')) {
      matchedWard = 'Tân Khai';
      prefix = 'TK';
    } else if (addr.includes('tân hưng') || addr.includes('tan hung')) {
      matchedWard = 'Tân Hưng';
      prefix = 'TH';
    } else {
      const tqRegex = /\b(tq)\b/i;
      const mdRegex = /\b(mđ|md)\b/i;
      const tkRegex = /\b(tk)\b/i;
      const thRegex = /\b(th)\b/i;
      
      if (tqRegex.test(addr)) { matchedWard = 'Tân Quan'; prefix = 'TQ'; }
      else if (mdRegex.test(addr)) { matchedWard = 'Minh Đức'; prefix = 'MĐ'; }
      else if (tkRegex.test(addr)) { matchedWard = 'Tân Khai'; prefix = 'TK'; }
      else if (thRegex.test(addr)) { matchedWard = 'Tân Hưng'; prefix = 'TH'; }
    }
  }

  // 3. Check group field if prefix is still default
  if (matchedWard === 'Chưa xác định' && record.group) {
    const g = record.group.toLowerCase().trim();
    if (g.includes('tân quan') || g.includes('tq')) {
      matchedWard = 'Tân Quan';
      prefix = 'TQ';
    } else if (g.includes('minh đức') || g.includes('mđ') || g.includes('minh duc')) {
      matchedWard = 'Minh Đức';
      prefix = 'MĐ';
    } else if (g.includes('tân khai') || g.includes('tk')) {
      matchedWard = 'Tân Khai';
      prefix = 'TK';
    } else if (g.includes('tân hưng') || g.includes('th') || g.includes('tan hung')) {
      matchedWard = 'Tân Hưng';
      prefix = 'TH';
    }
  }

  return { matchedWard, prefix };
};

const DongBoThuTucTab: React.FC<Props> = ({ notify, records, onUpdateRecord, onRefreshData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterWard, setFilterWard] = useState('ALL');
  const [loading, setLoading] = useState(false);
  
  // Local state to store customized proposed codes and keep-original selections
  // format: { [recordId]: proposedCodeString }
  const [customProposedCodes, setCustomProposedCodes] = useState<Record<string, string>>({});
  // format: { [duplicateGroupCode]: recordIdToKeepOriginal }
  const [selectedOriginals, setSelectedOriginals] = useState<Record<string, string>>({});
  // format: { [recordId]: customSelectedPrefix }
  const [selectedPrefixes, setSelectedPrefixes] = useState<Record<string, string>>({});

  // Group records by their raw code
  const duplicateGroups = useMemo(() => {
    if (!records || records.length === 0) return [];

    // Grouping dictionary
    const groups: Record<string, RecordFile[]> = {};
    records.forEach(r => {
      const code = (r.code || '').trim();
      if (!code) return; // Skip empty codes
      
      const key = code.toUpperCase();
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(r);
    });

    // Filter groups that have more than 1 record
    return Object.keys(groups)
      .filter(key => groups[key].length > 1)
      .map(key => {
        const groupRecords = groups[key];
        return {
          code: groupRecords[0].code, // Keep original casing of the first element
          records: groupRecords
        };
      });
  }, [records]);

  // Initializing state for original keeper in each group
  useEffect(() => {
    const originalMap: Record<string, string> = { ...selectedOriginals };
    let updated = false;

    duplicateGroups.forEach(group => {
      const key = group.code.toUpperCase();
      if (!originalMap[key]) {
        // By default, select the first record as the original "correct" one to keep
        originalMap[key] = group.records[0].id;
        updated = true;
      }
    });

    if (updated) {
      setSelectedOriginals(originalMap);
    }
  }, [duplicateGroups]);

  // Combined records inside duplicate groups with calculated proposals
  const processedGroups = useMemo(() => {
    return duplicateGroups.map(group => {
      const key = group.code.toUpperCase();
      const originalKeeperId = selectedOriginals[key] || group.records[0]?.id;

      const items = group.records.map(record => {
        const { matchedWard, prefix: autoPrefix } = getRecordWardAndPrefix(record);
        const activePrefix = selectedPrefixes[record.id] || autoPrefix;
        
        const isOriginal = record.id === originalKeeperId;
        
        // Calculate proposed code
        let proposed = record.code;
        if (!isOriginal) {
          // Add prefix
          proposed = `${activePrefix}-${record.code}`;
        }

        // If user manually edited the proposed code, respect that
        if (customProposedCodes[record.id] !== undefined) {
          proposed = customProposedCodes[record.id];
        }

        return {
          record,
          matchedWard,
          detectedPrefix: autoPrefix,
          activePrefix,
          isOriginal,
          proposedCode: proposed,
          isModified: proposed !== record.code
        };
      });

      return {
        code: group.code,
        items
      };
    });
  }, [duplicateGroups, selectedOriginals, customProposedCodes, selectedPrefixes]);

  // Filter groups based on search term and ward filters
  const filteredGroups = useMemo(() => {
    return processedGroups.filter(group => {
      // 1. Search term (matches code, or customer names inside group)
      if (searchTerm.trim()) {
        const s = searchTerm.toLowerCase().trim();
        const codeMatch = group.code.toLowerCase().includes(s);
        const nameMatch = group.items.some(item => 
          (item.record.customerName || '').toLowerCase().includes(s) ||
          (item.record.address || '').toLowerCase().includes(s)
        );
        if (!codeMatch && !nameMatch) return false;
      }

      // 2. Ward Filter
      if (filterWard !== 'ALL') {
        const wardMatch = group.items.some(item => {
          const w = item.matchedWard;
          if (filterWard === 'TQ' && w === 'Tân Quan') return true;
          if (filterWard === 'MĐ' && w === 'Minh Đức') return true;
          if (filterWard === 'TK' && w === 'Tân Khai') return true;
          if (filterWard === 'TH' && w === 'Tân Hưng') return true;
          if (filterWard === 'UNKNOWN' && w === 'Chưa xác định') return true;
          return false;
        });
        if (!wardMatch) return false;
      }

      return true;
    });
  }, [processedGroups, searchTerm, filterWard]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalDuplicateCodes = duplicateGroups.length;
    let totalDuplicateRecords = 0;
    duplicateGroups.forEach(g => {
      totalDuplicateRecords += g.records.length;
    });

    // Count how many would be altered
    let recordsToBeAltered = 0;
    processedGroups.forEach(g => {
      g.items.forEach(item => {
        if (item.isModified) {
          recordsToBeAltered++;
        }
      });
    });

    return {
      totalDuplicateCodes,
      totalDuplicateRecords,
      recordsToBeAltered
    };
  }, [duplicateGroups, processedGroups]);

  // Set selected record as the original kept code
  const handleSetOriginal = (groupCode: string, recordId: string) => {
    const key = groupCode.toUpperCase();
    setSelectedOriginals(prev => {
      const next = { ...prev, [key]: recordId };
      // Clear custom proposed code overrides for this group's members to recalculate
      const updatedCustoms = { ...customProposedCodes };
      const group = duplicateGroups.find(g => g.code.toUpperCase() === key);
      if (group) {
        group.records.forEach(r => {
          delete updatedCustoms[r.id];
        });
      }
      setCustomProposedCodes(updatedCustoms);
      return next;
    });
  };

  // Change ward prefix manually
  const handlePrefixChange = (recordId: string, prefix: string) => {
    setSelectedPrefixes(prev => ({ ...prev, [recordId]: prefix }));
    // Reset manual code edit for this record so it recalculates with new prefix
    setCustomProposedCodes(prev => {
      const next = { ...prev };
      delete next[recordId];
      return next;
    });
  };

  // Handle manual code modification
  const handleProposedCodeChange = (recordId: string, value: string) => {
    setCustomProposedCodes(prev => ({
      ...prev,
      [recordId]: value
    }));
  };

  // Save changes for a single record
  const handleSaveSingle = async (record: RecordFile, proposedCode: string) => {
    if (!onUpdateRecord) return;
    setLoading(true);
    try {
      const updated: RecordFile = {
        ...record,
        code: proposedCode
      };
      await onUpdateRecord(updated);
      notify(`Đã sửa mã hồ sơ ${record.code} -> ${proposedCode} thành công!`, 'success');
      onRefreshData?.();
    } catch (err) {
      notify(`Không thể cập nhật hồ sơ ${record.code}.`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Save changes for a whole duplicate group
  const handleSaveGroup = async (groupCode: string) => {
    if (!onUpdateRecord) return;
    const group = processedGroups.find(g => g.code.toUpperCase() === groupCode.toUpperCase());
    if (!group) return;

    // Filter only modified records
    const toUpdate = group.items.filter(item => item.isModified);
    if (toUpdate.length === 0) {
      notify('Không có thay đổi nào cần lưu trong nhóm này.', 'info');
      return;
    }

    setLoading(true);
    let successCount = 0;
    try {
      for (const item of toUpdate) {
        const updated: RecordFile = {
          ...item.record,
          code: item.proposedCode
        };
        await onUpdateRecord(updated);
        successCount++;
      }
      notify(`Đã chuẩn hóa ${successCount} mã hồ sơ của nhóm trùng "${groupCode}" thành công!`, 'success');
      onRefreshData?.();
    } catch (err) {
      notify(`Đã cập nhật được ${successCount} hồ sơ. Có lỗi xảy ra trong quá trình cập nhật còn lại.`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Bulk save all modified duplicate records across all groups
  const handleBulkRepair = async () => {
    if (!onUpdateRecord) return;
    
    // Find all modified items across all currently filtered groups
    const toUpdate: { record: RecordFile; proposed: string }[] = [];
    filteredGroups.forEach(g => {
      g.items.forEach(item => {
        if (item.isModified) {
          toUpdate.push({
            record: item.record,
            proposed: item.proposedCode
          });
        }
      });
    });

    if (toUpdate.length === 0) {
      notify('Không có hồ sơ trùng nào được cấu hình cần sửa.', 'info');
      return;
    }

    if (!window.confirm(`Bạn có chắc chắn muốn cập nhật đồng loạt ${toUpdate.length} mã hồ sơ trùng? Các mã trùng sẽ được thêm tiền tố xã viết tắt tương ứng để phân biệt.`)) {
      return;
    }

    setLoading(true);
    let successCount = 0;
    try {
      for (const item of toUpdate) {
        const updated: RecordFile = {
          ...item.record,
          code: item.proposed
        };
        await onUpdateRecord(updated);
        successCount++;
      }
      notify(`Đồng bộ hàng loạt hoàn tất! Đã sửa đổi ${successCount} mã hồ sơ thành công.`, 'success');
      // Clear local edits
      setCustomProposedCodes({});
      setSelectedPrefixes({});
      onRefreshData?.();
    } catch (err) {
      notify(`Đã cập nhật thành công ${successCount} hồ sơ. Quá trình dừng lại do có lỗi.`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Export duplicates report to Excel
  const handleExportExcel = () => {
    if (processedGroups.length === 0) {
      notify('Không có hồ sơ trùng nào để xuất báo cáo.', 'info');
      return;
    }

    const dataRows: any[] = [];
    let groupIndex = 1;

    processedGroups.forEach(group => {
      group.items.forEach((item, itemIdx) => {
        dataRows.push({
          'STT Nhóm': itemIdx === 0 ? groupIndex : '',
          'Mã hồ sơ trùng gốc': group.code,
          'Tên chủ sử dụng': item.record.customerName,
          'Xã/Thị trấn': item.matchedWard,
          'Địa chỉ chi tiết': item.record.address || item.record.group || '',
          'Loại hồ sơ': item.record.recordType || '',
          'Ngày tiếp nhận': item.record.receivedDate || '',
          'Vai trò chuẩn hóa': item.isOriginal ? 'Mã đúng (Giữ nguyên)' : 'Cần đổi mã',
          'Mã đề xuất mới': item.proposedCode,
          'Trạng thái': item.record.status
        });
      });
      groupIndex++;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataRows);

    // Apply some elegant styling
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_address = { c: C, r: R };
        const cell_ref = XLSX.utils.encode_cell(cell_address);
        if (!worksheet[cell_ref]) continue;

        // Base styles
        worksheet[cell_ref].s = {
          font: { name: 'Arial', size: 10 },
          alignment: { vertical: 'center', wrapText: true },
          border: {
            top: { style: 'thin', color: { rgb: 'D1D5DB' } },
            bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
            left: { style: 'thin', color: { rgb: 'D1D5DB' } },
            right: { style: 'thin', color: { rgb: 'D1D5DB' } }
          }
        };

        // Header style
        if (R === 0) {
          worksheet[cell_ref].s.fill = { fgColor: { rgb: '1E293B' } };
          worksheet[cell_ref].s.font = { name: 'Arial', size: 10, bold: true, color: { rgb: 'FFFFFF' } };
          worksheet[cell_ref].s.alignment = { horizontal: 'center', vertical: 'center' };
        } else {
          // Zebra stripe group styling helper
          const val = worksheet[XLSX.utils.encode_cell({ c: 1, r: R })]?.v;
          // Color based on role
          const roleVal = worksheet[XLSX.utils.encode_cell({ c: 7, r: R })]?.v;
          if (roleVal === 'Mã đúng (Giữ nguyên)') {
            worksheet[cell_ref].s.fill = { fgColor: { rgb: 'F0FDF4' } }; // Soft green
          } else if (roleVal === 'Cần đổi mã') {
            worksheet[cell_ref].s.fill = { fgColor: { rgb: 'FEF2F2' } }; // Soft red
          }
        }
      }
    }

    // Adjust column widths
    worksheet['!cols'] = [
      { wch: 10 }, // STT Nhóm
      { wch: 20 }, // Mã hồ sơ trùng gốc
      { wch: 25 }, // Tên chủ sử dụng
      { wch: 15 }, // Xã/Thị trấn
      { wch: 30 }, // Địa chỉ chi tiết
      { wch: 20 }, // Loại hồ sơ
      { wch: 15 }, // Ngày tiếp nhận
      { wch: 22 }, // Vai trò chuẩn hóa
      { wch: 22 }, // Mã đề xuất mới
      { wch: 15 }  // Trạng thái
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Báo cáo Hồ sơ trùng');
    XLSX.writeFile(workbook, 'Bao_Cao_Ma_Ho_So_Trung.xlsx');
    notify('Đã xuất báo cáo hồ sơ trùng sang file Excel thành công!', 'success');
  };

  const wardOptions = [
    { value: 'ALL', label: 'Tất cả Xã/Thị trấn' },
    { value: 'TQ', label: 'Xã Tân Quan (TQ)' },
    { value: 'MĐ', label: 'Xã Minh Đức (MĐ)' },
    { value: 'TK', label: 'Thị trấn Tân Khai (TK)' },
    { value: 'TH', label: 'Xã Tân Hưng (TH)' },
    { value: 'UNKNOWN', label: 'Chưa xác định' }
  ];

  return (
    <div id="duplicate-records-tab" className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Top Banner / Hero Information */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6 shrink-0 relative overflow-hidden shadow-md">
        <div className="absolute right-0 top-0 opacity-10 transform translate-x-12 -translate-y-12">
          <Sparkles size={250} className="text-white" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
              <span className="p-1.5 bg-rose-500 rounded-lg inline-flex items-center justify-center">
                <AlertCircle size={20} className="text-white" />
              </span>
              Kiểm tra & Sửa chữa mã hồ sơ trùng
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-3xl">
              Hệ thống quét toàn bộ cơ sở dữ liệu để tìm các hồ sơ có mã trùng nhau. Trong mỗi nhóm trùng, 
              giữ nguyên <span className="text-emerald-400 font-semibold">1 mã đúng</span> làm hồ sơ gốc (biên nhận thực tế của dân), 
              và sửa các mã còn lại bằng cách <span className="text-amber-400 font-semibold">thêm tiền tố chữ viết tắt địa bàn xã</span> (ví dụ: TQ-, MĐ-, TK-, TH-) để phân biệt, theo dõi khoa học.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2 shrink-0">
            <button 
              onClick={handleExportExcel}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all text-white"
              title="Xuất báo cáo danh sách mã hồ sơ trùng ra file Excel"
            >
              <FileSpreadsheet size={16} />
              Xuất Excel trùng
            </button>
            <button 
              onClick={handleBulkRepair}
              disabled={loading || filteredGroups.length === 0}
              className="px-4 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 disabled:opacity-50 text-white rounded-lg text-sm font-extrabold flex items-center gap-1.5 transition-all shadow-md shadow-rose-900/20"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Sửa tất cả mã trùng ({stats.recordsToBeAltered})
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 shrink-0 bg-white border-b border-slate-200">
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-rose-500/10 rounded-xl text-rose-600">
            <AlertCircle size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mã hồ sơ bị trùng</div>
            <div className="text-2xl font-black text-rose-700 mt-0.5">{stats.totalDuplicateCodes} <span className="text-xs font-normal text-slate-500">nhóm mã trùng</span></div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-600">
            <FileText size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng số hồ sơ trong nhóm trùng</div>
            <div className="text-2xl font-black text-amber-700 mt-0.5">{stats.totalDuplicateRecords} <span className="text-xs font-normal text-slate-500">hồ sơ</span></div>
          </div>
        </div>

        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-600">
            <Sparkles size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Số lượng mã sẽ chuẩn hóa</div>
            <div className="text-2xl font-black text-indigo-700 mt-0.5">
              {stats.recordsToBeAltered} <span className="text-xs font-normal text-slate-500">mã thêm tiền tố xã</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white border-b border-slate-200 shrink-0 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search size={18} />
          </span>
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo mã hồ sơ, tên chủ đất, địa chỉ..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 hover:bg-slate-100/50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={filterWard}
            onChange={(e) => setFilterWard(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {wardOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <button 
            onClick={() => onRefreshData?.()}
            className="p-2 border border-slate-300 text-slate-600 hover:text-indigo-600 rounded-lg hover:bg-slate-50 transition-colors"
            title="Quét lại dữ liệu mới nhất"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main List Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {filteredGroups.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-xl mx-auto my-12 shadow-sm">
            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Không tìm thấy mã hồ sơ bị trùng!</h3>
            <p className="text-slate-500 text-sm mt-2">
              Tất cả mã hồ sơ trong hệ thống đều là duy nhất, hoặc không có hồ sơ nào trùng khớp với bộ lọc tìm kiếm của bạn. Cơ sở dữ liệu đang rất sạch và chuẩn hóa!
            </p>
          </div>
        ) : (
          filteredGroups.map((group, gIdx) => {
            const hasUnsavedChanges = group.items.some(item => item.isModified);
            return (
              <div key={group.code} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
                {/* Group Header */}
                <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-1 bg-rose-100 text-rose-700 rounded-md text-xs font-black">
                      NHÓM {gIdx + 1}
                    </span>
                    <div>
                      <span className="font-extrabold text-slate-800 text-base">Mã trùng: {group.code}</span>
                      <span className="text-slate-400 text-xs ml-2 font-medium">({group.items.length} hồ sơ liên quan)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasUnsavedChanges && (
                      <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-semibold animate-pulse">
                        Chưa đồng bộ nhóm
                      </span>
                    )}
                    <button
                      onClick={() => handleSaveGroup(group.code)}
                      disabled={loading || !hasUnsavedChanges}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      <Save size={12} />
                      Sửa cả nhóm này
                    </button>
                  </div>
                </div>

                {/* Group Body: List of Records */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 text-slate-500 font-bold text-xs uppercase border-b border-slate-200">
                        <th className="py-3 px-4 w-28 text-center">Vai Trò</th>
                        <th className="py-3 px-4">Thông tin Hồ Sơ</th>
                        <th className="py-3 px-4 w-48">Xã / Địa Bàn</th>
                        <th className="py-3 px-4 w-32">Chữ Viết Tắt</th>
                        <th className="py-3 px-4">Mã Đề Xuất Phân Biệt</th>
                        <th className="py-3 px-4 w-24 text-right">Hành Động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.items.map(item => {
                        return (
                          <tr 
                            key={item.record.id} 
                            className={`transition-colors hover:bg-slate-50/50 ${
                              item.isOriginal ? 'bg-emerald-50/20' : 'bg-rose-50/10'
                            }`}
                          >
                            {/* Keep Original Toggle */}
                            <td className="py-4 px-4 text-center">
                              <div className="flex flex-col items-center justify-center">
                                <input
                                  type="radio"
                                  name={`original-keeper-${group.code}`}
                                  checked={item.isOriginal}
                                  onChange={() => handleSetOriginal(group.code, item.record.id)}
                                  className="w-4.5 h-4.5 text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                  id={`radio-${item.record.id}`}
                                />
                                <label 
                                  htmlFor={`radio-${item.record.id}`}
                                  className={`text-[10px] mt-1 font-bold cursor-pointer select-none ${
                                    item.isOriginal ? 'text-green-600' : 'text-slate-400'
                                  }`}
                                >
                                  {item.isOriginal ? 'MÃ ĐÚNG' : 'SẼ ĐỔI'}
                                </label>
                              </div>
                            </td>

                            {/* Record Owner & Info */}
                            <td className="py-4 px-4">
                              <div className="flex flex-col">
                                <div className="font-extrabold text-slate-800 flex items-center gap-1.5 text-sm">
                                  <User size={14} className="text-slate-400" />
                                  {item.record.customerName}
                                </div>
                                <div className="text-slate-500 text-xs mt-1 flex items-center gap-1">
                                  <MapPin size={12} className="text-slate-400 shrink-0" />
                                  <span className="truncate max-w-xs" title={item.record.address || ''}>
                                    {item.record.address || item.record.group || 'Chưa rõ địa chỉ'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-1.5">
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                                    Thửa: {item.record.landPlot || '-'} / Tờ: {item.record.mapSheet || '-'}
                                  </span>
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                                    {item.record.recordType || 'Đất đai'}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Ward Match */}
                            <td className="py-4 px-4">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                item.matchedWard === 'Chưa xác định' 
                                  ? 'bg-slate-100 text-slate-600' 
                                  : 'bg-indigo-50 text-indigo-700'
                              }`}>
                                <MapPin size={12} />
                                {item.matchedWard}
                              </span>
                            </td>

                            {/* Prefix Selection */}
                            <td className="py-4 px-4">
                              {item.isOriginal ? (
                                <span className="text-slate-400 text-xs italic">Giữ nguyên</span>
                              ) : (
                                <select
                                  value={item.activePrefix}
                                  onChange={(e) => handlePrefixChange(item.record.id, e.target.value)}
                                  className="px-2 py-1 border border-slate-200 rounded text-xs bg-white text-slate-700 font-bold focus:ring-1 focus:ring-indigo-500"
                                >
                                  <option value="TQ">TQ (Tân Quan)</option>
                                  <option value="MĐ">MĐ (Minh Đức)</option>
                                  <option value="TK">TK (Tân Khai)</option>
                                  <option value="TH">TH (Tân Hưng)</option>
                                  <option value="KV">KV (Khu Vực)</option>
                                </select>
                              )}
                            </td>

                            {/* Proposed Code Output with Edit capability */}
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                <div className="text-slate-400 line-through text-xs font-semibold">
                                  {item.record.code}
                                </div>
                                <ArrowRight size={14} className="text-slate-400" />
                                {item.isOriginal ? (
                                  <span className="font-extrabold text-emerald-600 text-sm flex items-center gap-1">
                                    <Check size={14} />
                                    {item.proposedCode} (Mã gốc)
                                  </span>
                                ) : (
                                  <div className="relative flex items-center">
                                    <span className="absolute left-2.5 text-slate-400 text-xs font-extrabold select-none">
                                      📝
                                    </span>
                                    <input
                                      type="text"
                                      value={item.proposedCode}
                                      onChange={(e) => handleProposedCodeChange(item.record.id, e.target.value)}
                                      className="pl-8 pr-2.5 py-1 border border-amber-300 bg-amber-50/30 rounded text-xs font-black text-slate-800 w-36 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                                      title="Click để tự do thay đổi mã hồ sơ đề xuất"
                                    />
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="py-4 px-4 text-right">
                              {item.isModified ? (
                                <button
                                  onClick={() => handleSaveSingle(item.record, item.proposedCode)}
                                  disabled={loading}
                                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-bold transition-colors inline-flex items-center gap-0.5"
                                  title="Cập nhật mã riêng lẻ cho hồ sơ này"
                                >
                                  <Check size={12} />
                                  Lưu mã
                                </button>
                              ) : (
                                <span className="text-slate-400 text-xs font-medium italic">
                                  Không đổi
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Info Legend Footer */}
      <div className="p-4 bg-slate-100 border-t border-slate-200 shrink-0 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
        <div className="flex items-center gap-2">
          <Info size={14} className="text-indigo-500 shrink-0" />
          <span>
            <strong>Chú ý:</strong> Khi đổi mã, các liên kết hồ sơ (nhật ký, báo cáo, thuế) vẫn hoàn toàn được duy trì vì hệ thống đồng bộ dựa trên khoá ID duy nhất.
          </span>
        </div>
        <div className="flex gap-4 font-bold">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> Mã đúng giữ nguyên</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Thêm tiền tố phân biệt</span>
        </div>
      </div>
    </div>
  );
};

export default DongBoThuTucTab;


import React, { useState, useMemo, useEffect } from 'react';
import { RecordFile, RecordStatus } from '../types';
import { X, Calendar, Plus, History, CheckCircle2, AlertTriangle, Map } from 'lucide-react';
import { fetchChinhLyRecords } from '../services/apiUtilities';

interface AddToBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (batch: number, date: string, handoverWard?: string, updatedRecords?: RecordFile[]) => void;
  records: RecordFile[];
  selectedCount: number;
  targetRecords?: RecordFile[]; // Prop này quan trọng để kiểm tra warning
  wards?: string[];
  currentView?: string;
}

const getRecordGroup = (r: RecordFile): 'measurement' | 'registration' | 'archive' | 'congvan' | 'other' => {
    const type = r.recordType || '';
    if (type === 'Cung cấp tài liệu đất đai' || type === 'Sao lục') {
        return 'archive';
    }
    if (type === 'Công văn') {
        return 'congvan';
    }
    const isReg = (t: string | null | undefined): boolean => {
        if (!t) return false;
        const low = t.trim().toLowerCase();
        const REG_PROCEDURES = [
            "đăng ký", "cấp giấy", "cấp đổi", "cấp lại", "giao đất", "thu hồi",
            "chuyển mục đích", "gia hạn", "thừa kế", "tặng cho", "chuyển nhượng", "thế chấp", "xóa thế chấp"
        ];
        return low.startsWith('3.') || low === 'đăng ký' || low === 'cấp giấy' || low === 'cấp đổi' || low === 'cấp lại' || REG_PROCEDURES.some(p => low.includes(p));
    };
    if (isReg(type)) {
        return 'registration';
    }
    if (['CMD', 'Tòa án', 'Thi hành án'].includes(type)) {
        return 'other';
    }
    return 'measurement';
};

const getViewActiveGroup = (view: string): 'measurement' | 'registration' | 'archive' | 'congvan' | 'other' => {
    if (['archive_records', 'archive_assign_tasks', 'archive_completed_list', 'archive_pending_check_list', 'archive_check_list', 'archive_handover_list', 'archive_director_completed'].includes(view)) {
        return 'archive';
    }
    if (['congvan_records', 'congvan_assign_tasks', 'congvan_completed_list', 'congvan_check_list', 'congvan_handover_list', 'congvan_director_completed'].includes(view)) {
        return 'congvan';
    }
    if (['registration_records', 'registration_assign_tasks', 'registration_completed_list', 'registration_pending_check_list', 'registration_check_list', 'registration_handover_list', 'registration_director_completed', 'registration_vao_so'].includes(view)) {
        return 'registration';
    }
    if (['other_records', 'other_assign_tasks', 'other_check_list', 'other_handover_list', 'other_director_completed'].includes(view)) {
        return 'other';
    }
    return 'measurement';
};

const isRegistrationRecord = (type: string | null | undefined): boolean => {
    if (!type) return false;
    const t = type.trim().toLowerCase();
    const isRegPrefix = t.startsWith('3.') || t === 'đăng ký' || t === 'cấp giấy' || t === 'cấp đổi' || t === 'cấp lại';
    if (isRegPrefix) return true;
    return t.includes('đăng ký') || t.includes('cấp giấy') || t.includes('cấp đổi') || t.includes('cấp lại') || t.includes('chuyển nhượng') || t.includes('tặng cho') || t.includes('thừa kế');
};

const AddToBatchModal: React.FC<AddToBatchModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  records, 
  selectedCount,
  targetRecords = [], // Giá trị mặc định
  wards = [],
  currentView
}) => {
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [selectedExistingBatch, setSelectedExistingBatch] = useState<string>('');
  
  const isReturnedTab = useMemo(() => {
    return targetRecords.length > 0 && targetRecords.every(r => r.status === RecordStatus.RETURNED);
  }, [targetRecords]);

  // Ngày hiện tại cho đợt mới
  const todayStr = new Date().toISOString().split('T')[0];

  const filteredRecordsForBatches = useMemo(() => {
      if (!currentView) return records;
      const activeGroup = getViewActiveGroup(currentView);
      const isReturnedMode = targetRecords.length > 0 && targetRecords.every(r => r.status === RecordStatus.RETURNED);
      return records.filter(r => 
          getRecordGroup(r) === activeGroup && 
          (isReturnedMode ? r.status === RecordStatus.RETURNED : r.status !== RecordStatus.RETURNED)
      );
  }, [records, currentView, targetRecords]);

  const nextBatchInfo = useMemo(() => {
      let maxBatch = 0;
      filteredRecordsForBatches.forEach(r => {
          const batchVal = isReturnedTab ? r.archiveBatch : r.exportBatch;
          const dateVal = isReturnedTab ? r.archiveDate : r.exportDate;
          if (batchVal && dateVal && dateVal.startsWith(todayStr)) {
              if (batchVal > maxBatch) maxBatch = batchVal;
          }
      });
      return {
          batch: maxBatch + 1,
          date: new Date().toISOString() // Dùng ISO đầy đủ cho chính xác
      };
  }, [filteredRecordsForBatches, todayStr, isReturnedTab]);

  // State quản lý danh sách hồ sơ để thay đổi cờ DNLis
  const [localRecords, setLocalRecords] = useState<RecordFile[]>([]);

  useEffect(() => {
    if (isOpen && targetRecords) {
        setLocalRecords(targetRecords);
    }
  }, [isOpen, targetRecords]);

  const handleToggleDNLis = (recordId: string, checked: boolean) => {
      setLocalRecords(prev => prev.map(r => r.id === recordId ? { ...r, transferToDNLis: checked } : r));
  };
  
  // State xác nhận danh sách chỉnh lý
  const [needsCorrectionConfirm, setNeedsCorrectionConfirm] = useState(false);
  
  // State giao phi địa giới
  const [isNonGeographic, setIsNonGeographic] = useState(false);
  const [selectedHandoverWard, setSelectedHandoverWard] = useState<string>('');

  // State danh sách cảnh báo thực tế (đã lọc qua logic kiểm tra bảng chỉnh lý)
  const [filteredWarningList, setFilteredWarningList] = useState<RecordFile[]>([]);

  const [customBatchNumber, setCustomBatchNumber] = useState<number>(1);

  useEffect(() => {
      if (isOpen) {
          setCustomBatchNumber(nextBatchInfo.batch);
      }
  }, [isOpen, nextBatchInfo.batch]);

  useEffect(() => {
      // Logic kiểm tra xem hồ sơ nào cần chỉnh lý NHƯNG chưa có trong danh sách đã chuyển ('sent')
      const checkWarnings = async () => {
          if (!isOpen || targetRecords.length === 0) {
              setFilteredWarningList([]);
              return;
          }

          // Lấy tất cả hồ sơ có cờ needsMapCorrection = true
          const potentialWarnings = targetRecords.filter(r => r.needsMapCorrection);
          
          if (potentialWarnings.length === 0) {
              setFilteredWarningList([]);
              return;
          }

          // Fetch danh sách chỉnh lý từ DB
          const chinhLyRecords = await fetchChinhLyRecords();
          
          // Lọc ra danh sách thực sự cần cảnh báo
          // Điều kiện: Có cờ 'needsMapCorrection' VÀ (không tìm thấy trong bảng chỉnh lý HOẶC tìm thấy nhưng status != 'sent')
          const realWarnings = potentialWarnings.filter(r => {
              // Tìm record tương ứng trong bảng chỉnh lý (dựa vào SO_HD == r.code)
              const correctionEntry = chinhLyRecords.find(c => c.data.SO_HD === r.code);
              
              // Nếu đã chuyển ('sent') thì KHÔNG cần cảnh báo -> return false
              if (correctionEntry && correctionEntry.data.STATUS === 'sent') {
                  return false;
              }
              // Ngược lại (chưa có hoặc đang 'pending') -> Cần cảnh báo -> return true
              return true;
          });

          setFilteredWarningList(realWarnings);
      };

      checkWarnings();
  }, [isOpen, targetRecords]);



  const historyBatches = useMemo(() => {
      const batches: Record<string, { date: string, batch: number, count: number, fullDate: string }> = {};
      const isReturnedMode = targetRecords.length > 0 && targetRecords.every(r => r.status === RecordStatus.RETURNED);
      
      filteredRecordsForBatches.forEach(r => {
          const matchStatus = isReturnedMode 
              ? (r.status === RecordStatus.RETURNED)
              : (r.status === RecordStatus.HANDOVER || r.status === RecordStatus.SIGNED || r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.REJECTED);
              
          const batchVal = isReturnedMode ? r.archiveBatch : r.exportBatch;
          const dateVal = isReturnedMode ? r.archiveDate : r.exportDate;
          
          if (matchStatus && batchVal && dateVal) {
              const datePart = dateVal.split('T')[0];
              const key = `${datePart}_${batchVal}`;
              
              if (!batches[key]) {
                  batches[key] = { 
                      date: datePart, 
                      batch: batchVal, 
                      count: 0,
                      fullDate: dateVal 
                  };
               }
               batches[key].count++;
          }
      });

      return Object.values(batches).sort((a, b) => {
          const dateDiff = b.date.localeCompare(a.date);
          if (dateDiff !== 0) return dateDiff;
          return b.batch - a.batch;
      });
  }, [filteredRecordsForBatches, targetRecords]);

  const registrationRecordsInBatch = useMemo(() => {
      return localRecords.filter(r => isRegistrationRecord(r.recordType));
  }, [localRecords]);

  useEffect(() => {
      if (mode === 'existing' && historyBatches.length > 0 && !selectedExistingBatch) {
          const first = historyBatches[0];
          setSelectedExistingBatch(`${first.date}_${first.batch}`);
      }
  }, [mode, historyBatches]);

  if (!isOpen) return null;

  const handleConfirm = () => {
      // Logic chặn nếu có cảnh báo chưa xác nhận
      if (filteredWarningList.length > 0 && !needsCorrectionConfirm) {
          alert("Vui lòng xác nhận bạn đã lập danh sách chỉnh lý cho các hồ sơ được cảnh báo.");
          return;
      }

      if (isNonGeographic && !selectedHandoverWard) {
          alert("Vui lòng chọn địa bàn giao kết quả.");
          return;
      }

      const handoverWard = isNonGeographic ? selectedHandoverWard : undefined;

      if (mode === 'new') {
          onConfirm(customBatchNumber, nextBatchInfo.date, handoverWard, localRecords);
      } else {
          if (!selectedExistingBatch) {
              alert('Vui lòng chọn một đợt cũ.');
              return;
          }
          const [datePart, batchNumStr] = selectedExistingBatch.split('_');
          const batchNum = parseInt(batchNumStr);
          const found = historyBatches.find(h => h.date === datePart && h.batch === batchNum);
          
          if (found) {
              onConfirm(found.batch, found.fullDate, handoverWard, localRecords);
          }
      }
      setNeedsCorrectionConfirm(false); // Reset
      setIsNonGeographic(false);
      setSelectedHandoverWard('');
      onClose();
  };

  const formatDate = (d: string) => {
      if (!d) return '';
      const dateOnly = d.includes('T') ? d.split('T')[0] : d;
      const parts = dateOnly.split('-');
      if (parts.length < 3) return d;
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-fade-in-up flex flex-col overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-800 text-lg">
                {isReturnedTab ? "Chốt Danh Sách Trả Kết Quả (TKQ)" : "Chốt Danh Sách Giao 1 Cửa"}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500"><X size={20}/></button>
        </div>

        <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600 mb-2">
                {isReturnedTab 
                    ? `Bạn đang thực hiện chốt <strong>${selectedCount > 0 ? selectedCount : 'toàn bộ'}</strong> hồ sơ sang danh sách trả kết quả (TKQ).`
                    : `Bạn đang thực hiện chốt <strong>${selectedCount > 0 ? selectedCount : 'toàn bộ'}</strong> hồ sơ sang trạng thái "Đã giao".`
                }
            </p>

            {/* CẢNH BÁO CHỈNH LÝ BẢN ĐỒ (CHỈ HIỆN KHI CÓ HỒ SƠ CHƯA CHUYỂN LIST) */}
            {filteredWarningList.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 animate-pulse">
                    <div className="flex items-center gap-2 text-orange-700 font-bold text-sm mb-2">
                        <AlertTriangle size={18} /> CẢNH BÁO: CÓ HỒ SƠ CẦN CHỈNH LÝ
                    </div>
                    <p className="text-xs text-orange-800 mb-2">
                        Có <strong>{filteredWarningList.length}</strong> hồ sơ cần chỉnh lý bản đồ nhưng chưa có trong danh sách "Đã chuyển":
                    </p>
                    <ul className="list-disc list-inside text-xs text-orange-800 font-mono mb-3 max-h-20 overflow-y-auto bg-orange-100/50 p-2 rounded">
                        {filteredWarningList.map(r => (
                            <li key={r.id} className="flex items-center gap-2">
                                <Map size={10} /> {r.code} - {r.customerName}
                            </li>
                        ))}
                    </ul>
                    <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border border-orange-200 hover:border-orange-400 transition-colors">
                        <input 
                            type="checkbox" 
                            className="w-4 h-4 text-orange-600 focus:ring-orange-500 rounded"
                            checked={needsCorrectionConfirm}
                            onChange={(e) => setNeedsCorrectionConfirm(e.target.checked)}
                        />
                        <span className="text-xs font-bold text-gray-700">Tôi xác nhận đã kiểm tra / lập danh sách.</span>
                    </label>
                </div>
            )}

            {/* Option 1: New Batch */}
            <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${mode === 'new' ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
                <input 
                    type="radio" 
                    name="batchMode" 
                    checked={mode === 'new'} 
                    onChange={() => setMode('new')}
                    className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1" onClick={(e) => {
                    if (mode !== 'new') {
                        setMode('new');
                    }
                }}>
                    <div className="flex items-center gap-2 font-bold text-gray-800">
                        <Plus size={16} className="text-blue-600" /> Tạo đợt mới (Hôm nay)
                    </div>
                    <div className="text-sm text-gray-600 mt-2 pl-6 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Số thứ tự đợt:</span>
                            <div className="flex items-center border border-gray-300 rounded overflow-hidden shadow-sm bg-white">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        if (customBatchNumber > 1) {
                                            setCustomBatchNumber(customBatchNumber - 1);
                                        }
                                    }}
                                    disabled={mode !== 'new' || customBatchNumber <= 1}
                                    className="px-2 py-1 bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-50 text-sm font-bold border-r transition-colors"
                                >
                                    -
                                </button>
                                <input 
                                    type="number" 
                                    min="1" 
                                    className="w-14 text-center font-extrabold text-blue-700 outline-none text-sm py-1 disabled:bg-gray-100"
                                    value={customBatchNumber}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        if (!isNaN(val) && val > 0) {
                                            setCustomBatchNumber(val);
                                        } else if (e.target.value === '') {
                                            setCustomBatchNumber(1);
                                        }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    disabled={mode !== 'new'}
                                />
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setCustomBatchNumber(customBatchNumber + 1);
                                    }}
                                    disabled={mode !== 'new'}
                                    className="px-2 py-1 bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-50 text-sm font-bold border-l transition-colors"
                                >
                                    +
                                </button>
                            </div>
                            {isReturnedTab && <span className="text-xs font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">(DD-LT)</span>}
                        </div>
                        <div className="flex justify-between items-center text-xs text-gray-400 mt-1">
                            <span>Ngày: {formatDate(todayStr)}</span>
                            {nextBatchInfo.batch !== customBatchNumber && (
                                <button 
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCustomBatchNumber(nextBatchInfo.batch);
                                    }}
                                    className="text-blue-500 hover:underline font-semibold"
                                >
                                    Khôi phục gợi ý ({nextBatchInfo.batch})
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </label>

            {/* Option 2: Existing Batch */}
            <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${mode === 'existing' ? 'bg-green-50 border-green-500 shadow-sm' : 'bg-white border-gray-200 hover:border-green-300'}`}>
                <input 
                    type="radio" 
                    name="batchMode" 
                    checked={mode === 'existing'} 
                    onChange={() => setMode('existing')}
                    className="mt-1 w-4 h-4 text-green-600 focus:ring-green-500"
                />
                <div className="flex-1">
                    <div className="flex items-center gap-2 font-bold text-gray-800">
                        <History size={16} className="text-green-600" /> Thêm vào đợt cũ
                    </div>
                    
                    <div className="mt-2 pl-6">
                        <select 
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-green-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                            disabled={mode !== 'existing'}
                            value={selectedExistingBatch}
                            onChange={(e) => setSelectedExistingBatch(e.target.value)}
                        >
                            {historyBatches.length > 0 ? (
                                historyBatches.map(h => (
                                    <option key={`${h.date}_${h.batch}`} value={`${h.date}_${h.batch}`}>
                                        Đợt {h.batch}{isReturnedTab ? ' (DD-LT)' : ''} - Ngày {formatDate(h.date)} (Đã có {h.count} HS)
                                    </option>
                                ))
                            ) : (
                                <option value="">Chưa có đợt nào</option>
                            )}
                        </select>
                    </div>
                </div>
            </label>

            {/* CẤU HÌNH DNLIS CHO HỒ SƠ CẤP GIẤY */}
            {registrationRecordsInBatch.length > 0 && (
                <div className="bg-amber-50/45 border border-amber-200/80 rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                    <div className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                        Xác định quy trình DNLis cho hồ sơ cấp giấy
                    </div>
                    <p className="text-[11px] text-gray-500">
                        Chọn hồ sơ chạy quy trình DNLis (không chọn sẽ chạy quy trình Phiếu chuyển 3 ngày):
                    </p>
                    <div className="space-y-1.5 pt-1">
                        {registrationRecordsInBatch.map(r => (
                            <label key={r.id} className="flex items-center justify-between gap-3 p-1.5 rounded bg-white hover:bg-amber-50 border border-gray-100 transition-colors cursor-pointer">
                                <span className="text-xs text-gray-700 font-medium truncate flex-1">
                                    <strong>{r.code}</strong> - {r.customerName}
                                </span>
                                <input 
                                    type="checkbox" 
                                    className="w-4 h-4 text-amber-600 focus:ring-amber-500 rounded cursor-pointer"
                                    checked={!!r.transferToDNLis}
                                    onChange={(e) => handleToggleDNLis(r.id, e.target.checked)}
                                />
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* Giao phi địa giới */}
            <div className="mt-4 border-t pt-4">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input 
                        type="checkbox" 
                        className="w-4 h-4 text-purple-600 focus:ring-purple-500 rounded"
                        checked={isNonGeographic}
                        onChange={(e) => setIsNonGeographic(e.target.checked)}
                    />
                    <span className="text-sm font-bold text-gray-700">Giao phi địa giới (Giao khác địa bàn)</span>
                </label>
                
                {isNonGeographic && (
                    <div className="pl-6 mt-2">
                        <label className="block text-xs text-gray-500 mb-1">Chọn địa bàn giao kết quả:</label>
                        <select 
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                            value={selectedHandoverWard}
                            onChange={(e) => setSelectedHandoverWard(e.target.value)}
                        >
                            <option value="">-- Chọn xã/phường --</option>
                            {wards.map(w => (
                                <option key={w} value={w}>{w}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 font-medium text-sm">
                Hủy bỏ
            </button>
            <button 
                onClick={handleConfirm} 
                disabled={filteredWarningList.length > 0 && !needsCorrectionConfirm}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-bold text-sm shadow-sm transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <CheckCircle2 size={16} /> Xác nhận chốt
            </button>
        </div>
      </div>
    </div>
  );
};

export default AddToBatchModal;

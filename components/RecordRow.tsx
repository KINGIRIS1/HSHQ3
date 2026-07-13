
import React from 'react';
import { RecordFile, RecordStatus, Employee } from '../types';
import { getNormalizedWard, getShortRecordType } from '../constants';
import { isRecordOverdue, isRecordApproaching, toTitleCase, findArchiveStaffForWard, isArchiveType, isRegType, isMeasurementType } from '../utils/appHelpers';
import { getEmployeeTeam, getRoleCategory } from './AssignModal';
import StatusBadge from './StatusBadge';
import { CheckSquare, Square, AlertCircle, Clock, Eye, ArrowRight, Pencil, Trash2, Bell, FileCheck, Phone, Map, UserPlus } from 'lucide-react';

interface RecordRowProps {
  record: RecordFile;
  employees: Employee[];
  visibleColumns: Record<string, boolean>;
  isSelected: boolean;
  canPerformAction: boolean;
  currentUser?: any;
  onToggleSelect: (id: string) => void;
  onView: (record: RecordFile) => void;
  onEdit: (record: RecordFile) => void;
  onDelete: (record: RecordFile) => void;
  onAdvanceStatus: (record: RecordFile) => void;
  onQuickUpdate: (id: string, field: keyof RecordFile, value: string) => void;
  onReturnResult?: (record: RecordFile) => void;
  onMapCorrection?: (record: RecordFile) => void; // New Handler
  isArchiveView?: boolean;
}

const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear())}`;
};

const RecordRow: React.FC<RecordRowProps> = ({
  record,
  employees,
  visibleColumns,
  isSelected,
  canPerformAction,
  currentUser,
  onToggleSelect,
  onView,
  onEdit,
  onDelete,
  onAdvanceStatus,
  onQuickUpdate,
  onReturnResult,
  onMapCorrection,
  isArchiveView
}) => {
  const [localMsr, setLocalMsr] = React.useState(record.measurementNumber || "");
  const [localExc, setLocalExc] = React.useState(record.excerptNumber || "");
  const [localRec, setLocalRec] = React.useState(record.receiptNumber || "");
  React.useEffect(() => { setLocalMsr(record.measurementNumber || ""); }, [record.measurementNumber]);
  React.useEffect(() => { setLocalExc(record.excerptNumber || ""); }, [record.excerptNumber]);
  React.useEffect(() => { setLocalRec(record.receiptNumber || ""); }, [record.receiptNumber]);
  const employee = employees.find(e => e.id === record.assignedTo);
  const isOverdue = isRecordOverdue(record);
  const isApproaching = isRecordApproaching(record);
  
  const hasActiveReminder = record.reminderDate && 
                            record.status !== RecordStatus.HANDOVER && 
                            record.status !== RecordStatus.WITHDRAWN;

  const resultReturnedDateStr = record.resultReturnedDate ? formatDate(record.resultReturnedDate) : '';

  // LOGIC MỚI: Tự động xác định trạng thái hiển thị
  // Nếu có thông tin xuất (Batch/Date) và chưa hoàn thành (Trả/Rút/Từ chối), coi như là Đã giao 1 cửa
  const getDisplayStatus = (r: RecordFile) => {
      if ((r.hasDefect || r.status === RecordStatus.REJECTED) && r.status !== RecordStatus.RETURNED && r.status !== RecordStatus.WITHDRAWN && r.status !== RecordStatus.HANDOVER) {
          return RecordStatus.REJECTED;
      }
      if ((r.exportBatch || r.exportDate) && r.status !== RecordStatus.WITHDRAWN && r.status !== RecordStatus.RETURNED) {
          return RecordStatus.HANDOVER;
      }
      return r.status;
  };
  
  const displayStatus = getDisplayStatus(record);

  const isOneDoor = React.useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === 'ONEDOOR') return true;
    if (!currentUser.employeeId) return false;
    const emp = employees.find(e => e.id === currentUser.employeeId);
    if (!emp) return false;
    const teamName = getEmployeeTeam(emp);
    return teamName === "Tổ Hành chính";
  }, [currentUser, employees]);

  const isStepProgressionAllowed = React.useMemo(() => {
    if (!currentUser) return false;
    const r = currentUser.role;
    if (r === 'ADMIN' || r === 'SUBADMIN' || r === 'TEAM_LEADER') return true;
    if (currentUser.employeeId && employees) {
      const emp = employees.find(e => e.id === currentUser.employeeId);
      if (emp) {
        const cat = getRoleCategory(emp.position);
        if (cat.key === 'leader' || cat.key === 'vice_leader') {
          return true;
        }
      }
    }
    return false;
  }, [currentUser, employees]);

  const isArchived = !!record.archiveBatch || !!record.isArchived;

  // Class chung cho các ô: Căn trên (align-top)
  const cellClass = "p-3 align-top";

  return (
    <tr className={`transition-all duration-200 group border-l-4 ${isOverdue ? 'bg-red-50 border-l-red-500 hover:bg-red-100' : isApproaching ? 'bg-orange-50 border-l-orange-500 hover:bg-orange-100' : isSelected ? 'bg-blue-50 border-l-blue-500 hover:bg-blue-100' : isArchived ? 'bg-teal-50/30 border-l-teal-500 hover:bg-teal-100/60' : 'border-l-transparent hover:bg-blue-50/60 hover:shadow-sm'}`} onDoubleClick={() => onView(record)}>
      <td className={`${cellClass} text-center`}>
        <div className="mt-1">
            {canPerformAction ? (
            <button onClick={() => onToggleSelect(record.id)} className={`${isSelected ? 'text-blue-600' : 'text-gray-400'}`}>
                {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
            </button>
            ) : (
            <div className="w-4 h-4" />
            )}
        </div>
      </td>
      
      {visibleColumns.code && (
        <td className={`${cellClass} font-medium text-blue-600 cursor-pointer hover:underline`} onClick={() => onView(record)} title="Nhấp vào để xem chi tiết">
          <div className="flex flex-col items-center gap-1">
              <div className="break-words font-bold leading-normal text-sm" title={record.code}>
                  {record.code}
              </div>
              {hasActiveReminder && <div className="flex items-center gap-1 text-xs text-pink-600 font-bold bg-pink-100 px-1.5 py-0.5 rounded"><Bell size={12} className="fill-pink-600" /> Nhắc hẹn</div>}
              {record.hasDefect && (
                  <div className="flex items-center gap-1 text-[10px] text-red-700 bg-red-100 border border-red-200 px-1.5 py-0.5 rounded font-extrabold mt-1" title={record.defectReason || "Không ghi cụ thể lý do"}>
                      <AlertCircle size={12} className="text-red-500 animate-pulse shrink-0" />
                      <span>Có sai sót</span>
                  </div>
              )}
          </div>
          {isOverdue && <span className="inline-block px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded border border-red-200 font-bold mt-1 block text-center w-full">Quá hạn</span>}
        </td>
      )}
      
      {visibleColumns.customer && (
          <td className={cellClass}>
              <div className="flex flex-col gap-1 items-center text-center">
                  <div className="break-words leading-normal text-sm font-medium text-gray-900" title={record.customerName}>
                      {toTitleCase(record.customerName)}
                  </div>
                  {record.phoneNumber && (
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                           <Phone size={14} className="shrink-0" />
                           <span className="font-mono">{record.phoneNumber}</span>
                      </div>
                  )}
              </div>
          </td>
      )}
      
      {visibleColumns.type && (
          <td className={`${cellClass} text-left text-gray-700`}>
              <div className="break-words leading-normal text-sm font-medium text-left" title={record.recordType || ''}> 
                  {getShortRecordType(record.recordType)}
              </div>
          </td>
      )}
      
      {visibleColumns.deadline && (
        <td className={cellClass}>
          <div className="flex flex-col w-full bg-white/50 rounded border border-gray-100 overflow-hidden shadow-sm">
             <div className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50/80 border-b border-gray-100" title="Ngày tiếp nhận">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-tight mr-3">Nhận</span>
                <span className="text-sm font-semibold text-slate-600 font-mono whitespace-nowrap">{formatDate(record.receivedDate)}</span>
             </div>
             
             <div className={`flex items-center justify-between px-2.5 py-1.5 ${isOverdue ? 'bg-red-50' : isApproaching ? 'bg-orange-50' : 'bg-white'}`} title="Hẹn trả kết quả">
                <span className={`text-[10px] font-extrabold uppercase tracking-tight mr-3 ${isOverdue ? 'text-red-500' : isApproaching ? 'text-orange-500' : 'text-blue-500'}`}>Trả</span>
                <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-bold font-mono whitespace-nowrap ${isOverdue ? 'text-red-600' : isApproaching ? 'text-orange-600' : 'text-blue-700'}`}>
                        {formatDate(record.deadline)}
                    </span>
                    {isOverdue && <AlertCircle size={13} className="text-red-500 animate-pulse shrink-0" />}
                    {isApproaching && <Clock size={13} className="text-orange-500 shrink-0" />}
                </div>
             </div>
          </div>
        </td>
      )}
      
      {visibleColumns.ward && (
          <td className={`${cellClass} text-center text-gray-700`}>
              <div className="break-words leading-normal text-sm" title={getNormalizedWard(record.ward)}> 
                  {getNormalizedWard(record.ward) || '--'}
                  {record.handoverWard && (
                      <div className="text-xs text-purple-600 mt-1 font-semibold" title="Nơi giao trả kết quả">
                          (Giao: {getNormalizedWard(record.handoverWard)})
                      </div>
                  )}
              </div>
          </td>
      )}
      
      {visibleColumns.mapSheet && <td className={`${cellClass} text-center font-mono text-sm font-bold text-slate-700`}>{record.mapSheet || '-'}</td>}
      {visibleColumns.landPlot && <td className={`${cellClass} text-center font-mono text-sm font-bold text-slate-700`}>{record.landPlot || '-'}</td>}

      {visibleColumns.assigned && (
          <td className={`${cellClass} text-center`}>
              {record.assignedDate ? (
                  <div className="flex flex-col items-center gap-1">
                      <span className="text-sm text-gray-600">{formatDate(record.assignedDate)}</span>
                      {employee && <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded break-words max-w-full leading-tight" title={employee.name}>{employee.name}</span>}
                      {isArchiveView && canPerformAction && (() => {
                          const matched = findArchiveStaffForWard(record.ward, employees);
                          if (matched && record.assignedTo !== matched.id) {
                              return (
                                  <button
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          onQuickUpdate(record.id, 'assignedTo', matched.id);
                                      }}
                                      className="mt-1 flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded hover:bg-orange-100 transition-colors"
                                      title={`Địa bàn này phụ trách bởi: ${matched.name}. Click để chuyển nhanh.`}
                                  >
                                      <UserPlus size={11} /> Giao lại: {matched.name}
                                  </button>
                              );
                          } else if (matched && record.assignedTo === matched.id) {
                              return (
                                  <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-0.5" title="Đã giao đúng nhân viên phụ trách xã này">
                                      ✓ Đúng địa bàn
                                  </span>
                              );
                          }
                          return null;
                      })()}
                  </div>
              ) : (
                  <div className="flex flex-col items-center gap-1.5">
                      <span className="text-gray-400">--</span>
                      {isArchiveView && canPerformAction && (() => {
                          const matched = findArchiveStaffForWard(record.ward, employees);
                          if (matched) {
                              return (
                                  <button
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          onQuickUpdate(record.id, 'assignedTo', matched.id);
                                      }}
                                      className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors shadow-sm"
                                      title={`Giao nhanh cho nhân viên phụ trách ${record.ward || 'xã này'}: ${matched.name}`}
                                  >
                                      <UserPlus size={12} /> Giao nhanh: {matched.name}
                                  </button>
                              );
                          }
                          return null;
                      })()}
                  </div>
              )}
          </td>
      )}
      
      {visibleColumns.completed && (
        <td className={`${cellClass} text-center text-gray-600`}>
          {record.archiveBatch ? (
             <div className="flex flex-col items-center gap-1">
                 <span className="inline-flex flex-col items-center px-2 py-1 rounded border bg-teal-50 text-teal-700 border-teal-200">
                    <span className="text-[11px] font-bold">
                      {isArchiveType(record.recordType) 
                        ? 'Lưu kho L.Trữ' 
                        : isRegType(record.recordType) 
                        ? 'Lưu kho C.Giấy' 
                        : 'Lưu kho Đ.Đạc'} - Đợt {record.archiveBatch}
                    </span>
                    <span className="text-[11px] font-medium whitespace-nowrap">{formatDate(record.archiveDate)}</span>
                 </span>
                 {record.exportBatch && (
                     <span className="text-[10px] text-gray-500 font-medium bg-gray-50 px-1 rounded border border-gray-100">
                         Giao 1C: Đợt {record.exportBatch} ({formatDate(record.exportDate)})
                     </span>
                 )}
             </div>
          ) : record.exportBatch ? (
             <span className={`inline-flex flex-col items-center px-2 py-1 rounded border ${record.status === RecordStatus.WITHDRAWN ? 'bg-slate-100 text-slate-700 border-slate-300' : (record.status === RecordStatus.REJECTED || record.hasDefect) ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                <span className="text-[11px] font-bold">{(record.status === RecordStatus.REJECTED || record.hasDefect) ? 'HS Trả - Đợt ' : 'Đợt '}{record.exportBatch}{record.status === RecordStatus.RETURNED ? ' (DD-LT)' : ''}</span>
                <span className="text-[11px] font-medium whitespace-nowrap">{formatDate(record.exportDate || record.completedDate)}</span>
             </span>
          ) : record.status === RecordStatus.WITHDRAWN ? (
             <div className="flex flex-col items-center">
                <span className="text-xs font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded mb-1">Rút HS</span>
                <span className="text-sm font-bold text-slate-600">{formatDate(record.completedDate)}</span>
             </div>
          ) : record.status === RecordStatus.REJECTED ? (
             <div className="flex flex-col items-center">
                <span className="text-xs font-bold bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded mb-1">Hồ sơ trả</span>
                <span className="text-sm font-bold text-red-700">{formatDate(record.completedDate)}</span>
             </div>
          ) : (
             <span className="text-sm font-bold text-green-700">{formatDate(record.completedDate) || '--'}</span>
          )}
        </td>
      )}
      
      {visibleColumns.tech && (
        <td className={cellClass}>
          <div className="flex flex-col gap-1.5 items-center">
            {canPerformAction ? (
                <>
                    <input type="text" className="w-full text-sm border border-gray-200 rounded px-1 py-1 focus:border-blue-500 outline-none bg-white/50 text-center" value={localMsr} onChange={(e) => setLocalMsr(e.target.value)} onBlur={() => localMsr !== (record.measurementNumber || '') && onQuickUpdate(record.id, 'measurementNumber', localMsr)} placeholder="TĐ" />
                    <input type="text" className="w-full text-sm border border-gray-200 rounded px-1 py-1 focus:border-blue-500 outline-none bg-white/50 text-center" value={localExc} onChange={(e) => setLocalExc(e.target.value)} onBlur={() => localExc !== (record.excerptNumber || '') && onQuickUpdate(record.id, 'excerptNumber', localExc)} placeholder="TL" />
                </>
            ) : (
                <>
                    <span className="text-sm text-gray-800 font-mono truncate block text-center" title="Số TĐ">{record.measurementNumber || '-'}</span>
                    <span className="text-sm text-gray-800 font-mono truncate block text-center" title="Số TL">{record.excerptNumber || '-'}</span>
                </>
            )}
          </div>
        </td>
      )}

      {visibleColumns.receipt && (
        <td className={`${cellClass} text-center`}>
            {canPerformAction ? (
                <input 
                    type="text" 
                    className="w-full text-sm border border-gray-200 rounded px-1 py-1.5 focus:border-purple-500 outline-none bg-white/50 text-center font-bold text-purple-700 placeholder-gray-300" 
                    value={localRec} 
                    onChange={(e) => setLocalRec(e.target.value)}
                    onBlur={() => localRec !== (record.receiptNumber || '') && onQuickUpdate(record.id, 'receiptNumber', localRec)} 
                    onClick={(e) => e.stopPropagation()} 
                    placeholder="BL" 
                />
            ) : (
                <span className="text-sm text-purple-700 font-bold font-mono">{record.receiptNumber || '-'}</span>
            )}
        </td>
      )}

      {visibleColumns.status && (
        <td className={`${cellClass} text-center`}>
            {record.resultReturnedDate ? (
                <div className="flex flex-col gap-1 items-center">
                    <span className="inline-flex flex-col items-center px-2 py-1 rounded text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 w-full leading-tight">
                        <span>Đã trả KQ</span>
                        <span className="text-[10px] font-normal">{resultReturnedDateStr}</span>
                    </span>
                    {record.archiveBatch && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-teal-100 text-teal-800 border border-teal-200 px-1.5 py-0.5 rounded shadow-sm" title={`Đã chuyển lưu kho đợt ${record.archiveBatch}`}>
                            <svg className="w-3.5 h-3.5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                            <span>
                              {isArchiveType(record.recordType) 
                                ? 'LƯU KHO L.TRỮ' 
                                : isRegType(record.recordType) 
                                ? 'LƯU KHO C.GIẤY' 
                                : 'LƯU KHO Đ.ĐẠC'} ĐỢT {record.archiveBatch}
                            </span>
                        </span>
                    )}
                </div>
            ) : (
                <div className="transform origin-top pt-1">
                    <StatusBadge status={displayStatus} recordType={record.recordType} record={record} employees={employees} />
                    {record.hasDefect && (
                        <span className="mt-1 block text-[10px] font-bold bg-red-50 text-red-700 px-1 py-0.5 rounded border border-red-200">
                            Có sai sót (Trả)
                        </span>
                    )}
                </div> 
            )}
            
            {/* NÚT CHỈNH LÝ (Thay thế checkbox) */}
            {onMapCorrection && (
                <div className="mt-2 flex justify-center">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onMapCorrection(record); }}
                        className={`flex items-center gap-1 px-2 py-1 rounded border transition-all text-[10px] font-bold shadow-sm ${
                            record.needsMapCorrection 
                            ? 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100' 
                            : 'bg-white text-gray-400 border-gray-200 hover:text-gray-600 hover:bg-gray-50'
                        }`}
                        title={record.needsMapCorrection ? "Hồ sơ đang cần chỉnh lý. Bấm để HỦY." : "Bấm để chuyển sang chỉnh lý bản đồ"}
                    >
                        <Map size={14} className={record.needsMapCorrection ? "fill-orange-100" : ""} />
                        {record.needsMapCorrection && <span>CHỈNH LÝ</span>}
                    </button>
                </div>
            )}
        </td>
      )}
      
      {canPerformAction && (
        <td className={`${cellClass} sticky right-0 shadow-l text-center ${isOverdue ? 'bg-red-50 group-hover:bg-red-100' : isApproaching ? 'bg-orange-50 group-hover:bg-orange-100' : 'bg-white group-hover:bg-blue-50/60'}`}>
          <div className="flex flex-wrap items-center justify-center gap-1 mt-0.5">
            <button onClick={(e) => { e.stopPropagation(); onView(record); }} className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors" title="Xem chi tiết"><Eye size={16} /></button>
            
            {onReturnResult && (displayStatus === RecordStatus.HANDOVER || displayStatus === RecordStatus.SIGNED) && !record.resultReturnedDate && (
                <button onClick={(e) => { e.stopPropagation(); onReturnResult(record); }} className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded transition-colors" title="Trả kết quả">
                    <FileCheck size={16} />
                </button>
            )}

            {record.status !== RecordStatus.HANDOVER && record.status !== RecordStatus.WITHDRAWN && record.status !== RecordStatus.RETURNED && !record.resultReturnedDate && isStepProgressionAllowed && (
              <button onClick={() => onAdvanceStatus(record)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Chuyển bước"><ArrowRight size={16} /></button>
            )}
            {!(currentUser?.role === 'ONEDOOR' && (record.isDeptSynced === true || record.status !== RecordStatus.RECEIVED)) && (
              <button onClick={() => onEdit(record)} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Sửa"><Pencil size={16} /></button>
            )}
            {(currentUser?.role === 'ADMIN' || currentUser?.role === 'SUBADMIN') && (
                <button onClick={() => onDelete(record)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Xóa"><Trash2 size={16} /></button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
};

export default React.memo(RecordRow, (prevProps, nextProps) => {
  return (
    prevProps.record === nextProps.record &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.visibleColumns === nextProps.visibleColumns &&
    prevProps.isArchiveView === nextProps.isArchiveView &&
    prevProps.employees.length === nextProps.employees.length
  );
});

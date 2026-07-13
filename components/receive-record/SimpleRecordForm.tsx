import React from 'react';
import { RecordFile, Employee } from '../../types';
import { User, MapPin, FileText, Trash2, XCircle } from 'lucide-react';

interface SimpleRecordFormProps {
  formData: Partial<RecordFile>;
  handleChange: (field: keyof RecordFile, value: any) => void;
  applicantName: string;
  setApplicantName: (v: string) => void;
  applicantPhone: string;
  setApplicantPhone: (v: string) => void;
  applicantCccd: string;
  setApplicantCccd: (v: string) => void;
  wards: string[];
  employees: Employee[];
  isMeas: boolean;
  hasAdminRights: boolean;
  dateVal: (v: any) => string;
  labelClass: string;
  plainInputClass: string;
  selectClass: string;
  
  // New props for dynamic document table
  otherDocRows: Array<{ name: string; type: 'Bản chính' | 'Bản sao' }>;
  handleOtherDocRowChange: (index: number, field: 'name' | 'type', value: string) => void;
  addOtherDocRow: (name?: string, type?: 'Bản chính' | 'Bản sao') => void;
  removeOtherDocRow: (index: number) => void;

  showAuthSection: boolean;
  setShowAuthSection: (v: boolean) => void;
  authDocNumber: string;
  setAuthDocNumber: (v: string) => void;
  authAddress: string;
  setAuthAddress: (v: string) => void;
  authPhone: string;
  setAuthPhone: (v: string) => void;

  // Modern layout and sync props
  isMeasOrArch?: boolean;
  isApplicantOwner?: boolean;
  handleApplicantOwnerChange?: (checked: boolean) => void;
  landAreaRows: Array<{ type: string; area: number | '' }>;
  addLandAreaRow: () => void;
  removeLandAreaRow: (index: number) => void;
  handleLandRowAreaChange: (index: number, value: string) => void;
  handleLandRowTypeChange: (index: number, type: string) => void;
}

const SimpleRecordForm: React.FC<SimpleRecordFormProps> = ({
  formData,
  handleChange,
  applicantName,
  setApplicantName,
  applicantPhone,
  setApplicantPhone,
  applicantCccd,
  setApplicantCccd,
  wards,
  employees,
  isMeas,
  hasAdminRights,
  dateVal,
  labelClass,
  plainInputClass,
  selectClass,
  otherDocRows,
  handleOtherDocRowChange,
  addOtherDocRow,
  removeOtherDocRow,
  showAuthSection,
  setShowAuthSection,
  authDocNumber,
  setAuthDocNumber,
  authAddress,
  setAuthAddress,
  authPhone,
  setAuthPhone,
  isMeasOrArch = false,
  isApplicantOwner = false,
  handleApplicantOwnerChange,
  landAreaRows = [],
  addLandAreaRow,
  removeLandAreaRow,
  handleLandRowAreaChange,
  handleLandRowTypeChange
}) => {
  if (formData.recordType === '1.2 Công văn') {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* THÔNG TIN CÔNG VĂN */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 md:p-5">
          <div className="border-b pb-2 mb-4">
            <h3 className="text-sm font-bold text-blue-800 uppercase flex items-center gap-2">
              <FileText size={16} /> THÔNG TIN CÔNG VĂN
            </h3>
          </div>
          
          <div className="grid grid-cols-1 gap-4 mb-4">
            <div>
              <label className={labelClass}>SỐ CÔNG VĂN - ĐƠN VỊ PHÁT HÀNH <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                required 
                className={plainInputClass} 
                placeholder="Số công văn - Đơn vị phát hành..."
                value={applicantName} 
                onChange={(e) => setApplicantName(e.target.value)} 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 mb-4">
            <div>
              <label className={labelClass}>TRÍCH YẾU <span className="text-red-500">*</span></label>
              <textarea 
                rows={4} 
                required 
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium text-gray-800"
                placeholder="Nhập trích yếu..."
                value={formData.content || ''} 
                onChange={(e) => handleChange('content', e.target.value)} 
              />
            </div>
          </div>

          {/* Removed Phường/xã and Tờ/Thửa fields for 1.2 Công văn as requested */}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. THÔNG TIN NGƯỜI NỘP HỒ SƠ */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 md:p-5">
        <div className="border-b pb-2 mb-4 flex items-center justify-between w-full">
          <h3 className="text-sm font-bold text-blue-800 uppercase flex items-center gap-2">
            <User size={16} /> THÔNG TIN NGƯỜI NỘP HỒ SƠ
          </h3>
          {!isMeasOrArch && handleApplicantOwnerChange && (
            <label className="flex items-center gap-2 text-xs font-bold text-[#007bff] cursor-pointer select-none normal-case hover:text-blue-700 transition-colors">
              <input 
                type="checkbox"
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 bg-white"
                checked={isApplicantOwner}
                onChange={(e) => handleApplicantOwnerChange(e.target.checked)}
              />
              Người nộp hồ sơ là chủ hồ sơ
            </label>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Họ và tên người nộp <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              required 
              className={plainInputClass} 
              placeholder="Họ và tên..."
              value={applicantName} 
              onChange={(e) => setApplicantName(e.target.value)} 
            />
          </div>
          <div>
            <label className={labelClass}>CCCD/Số Giấy <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              required 
              className={plainInputClass} 
              placeholder="CCCD..."
              value={applicantCccd} 
              onChange={(e) => setApplicantCccd(e.target.value)} 
            />
          </div>
          <div>
            <label className={labelClass}>SĐT người nộp <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              required 
              className={plainInputClass} 
              placeholder="Số điện thoại..."
              value={applicantPhone} 
              onChange={(e) => setApplicantPhone(e.target.value)} 
            />
          </div>
        </div>
        {isMeasOrArch && (
          <div className="mt-4">
            <label className={labelClass}>Địa chỉ thường trú <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              required 
              className={plainInputClass} 
              placeholder="Nhập địa chỉ thường trú..."
              value={formData.customerAddress || ''} 
              onChange={(e) => handleChange('customerAddress', e.target.value)} 
            />
          </div>
        )}
      </div>

      {/* 2. THÔNG TIN THỬA ĐẤT */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 md:p-5">
        <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2 border-b pb-2 w-full">
          <MapPin size={16} /> THÔNG TIN THỬA ĐẤT
        </h3>
        <div className="space-y-5">
          {/* Hàng 1: phường/xã, Số thứ tự thửa, tờ bản đồ thành 1 hàng */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Phường/xã <span className="text-red-500">*</span></label>
              <select 
                required 
                className={selectClass} 
                value={formData.ward || ''} 
                onChange={(e) => handleChange('ward', e.target.value)}
              >
                <option value="">-- Chọn phường/xã --</option>
                {wards.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Số thứ tự thửa <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                required 
                className={plainInputClass} 
                placeholder="Số thửa..." 
                value={formData.landPlot || ''} 
                onChange={(e) => handleChange('landPlot', e.target.value)} 
              />
            </div>
            <div>
              <label className={labelClass}>Tờ bản đồ <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                required 
                className={plainInputClass} 
                placeholder="Số tờ bản đồ..." 
                value={formData.mapSheet || ''} 
                onChange={(e) => handleChange('mapSheet', e.target.value)} 
              />
            </div>
          </div>

          {/* Hàng 2: số vào sổ, số GCN, ngày cấp 1 hàng */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Số vào sổ</label>
              <input 
                type="text" 
                className={plainInputClass} 
                placeholder="Số vào sổ cấp GCN..." 
                value={formData.entryNumber || ''} 
                onChange={(e) => handleChange('entryNumber', e.target.value)} 
              />
            </div>
            <div>
              <label className={labelClass}>Số GCN</label>
              <input 
                type="text" 
                className={plainInputClass} 
                placeholder="Số phát hành GCN (Số seri)..." 
                value={formData.issueNumber || ''} 
                onChange={(e) => handleChange('issueNumber', e.target.value)} 
              />
            </div>
            <div>
              <label className={labelClass}>Ngày cấp GCN</label>
              <input 
                type="date" 
                className={plainInputClass} 
                value={dateVal(formData.issueDate)} 
                onChange={(e) => handleChange('issueDate', e.target.value)} 
              />
            </div>
          </div>

          {/* Shaded Area Grid */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            {/* Header Block */}
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-700 tracking-wide uppercase">
                  DIỆN TÍCH THỬA ĐẤT:
                </span>
                {(() => {
                  const hasActiveLandRows = landAreaRows && landAreaRows.some(row => row.area !== '' && parseFloat(row.area as any) > 0);
                  if (hasActiveLandRows) {
                    return (
                      <span className="text-sm font-black text-slate-900 bg-slate-200/60 px-2.5 py-1 rounded-md font-mono">
                        {(formData.area || 0).toLocaleString('vi-VN')} m²
                      </span>
                    );
                  } else {
                    return (
                      <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2 h-[32px] w-36 focus-within:border-emerald-500 shadow-sm">
                        <input
                          type="number"
                          step="any"
                          placeholder="Nhập tổng DT..."
                          className="w-full border-none bg-transparent outline-none text-right font-mono font-bold text-xs text-slate-800"
                          value={formData.area === undefined || formData.area === null || formData.area === 0 ? '' : formData.area}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                            handleChange('area', val);
                          }}
                        />
                        <span className="text-[10px] font-bold text-slate-400">m²</span>
                      </div>
                    );
                  }
                })()}
              </div>
              {addLandAreaRow && (
                <button 
                  type="button" 
                  onClick={addLandAreaRow}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 active:scale-95 shadow-sm transition-all cursor-pointer"
                >
                  <span>+ Thêm loại đất</span>
                </button>
              )}
            </div>

            {/* Rows Block */}
            <div className="p-4 bg-white">
              <div className="flex flex-wrap items-center gap-3">
                {landAreaRows.length === 0 ? (
                  <div className="text-xs text-slate-400 font-medium italic w-full text-center py-2">
                    Chưa có loại đất nào được thêm. Hãy nhấn nút "+ Thêm loại đất".
                  </div>
                ) : (
                  landAreaRows.map((row, index) => (
                    <div key={index} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1.5 shadow-sm animate-fade-in shrink-0 h-[44px]">
                      <div className="relative shrink-0">
                        <select 
                          className="pl-2 pr-6 py-1 border border-slate-200 rounded-lg text-xs bg-white outline-none focus:border-emerald-500 font-bold text-slate-700 cursor-pointer h-[30px] appearance-none"
                          style={{ backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`, backgroundPosition: 'right 6px center', backgroundSize: '12px', backgroundRepeat: 'no-repeat' }}
                          value={row.type}
                          onChange={(e) => handleLandRowTypeChange(index, e.target.value)}
                        >
                          <option value="ONT/ODT">ONT/ODT</option>
                          <option value="CLN">CLN</option>
                          <option value="BHK">BHK</option>
                          <option value="LUC">LUC</option>
                          <option value="Khác">Khác</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 h-[30px] w-28 focus-within:border-emerald-500">
                        <input 
                          type="number" 
                          step="any" 
                          placeholder="0,0" 
                          className="w-full border-none bg-transparent outline-none text-right font-mono font-bold text-xs text-slate-800" 
                          value={row.area === '' ? '' : row.area} 
                          onChange={(e) => handleLandRowAreaChange(index, e.target.value)} 
                        />
                        <span className="text-[10px] font-bold text-slate-400 shrink-0">m²</span>
                      </div>
                      {removeLandAreaRow && (
                        <button 
                          type="button" 
                          onClick={() => removeLandAreaRow(index)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded-lg transition-colors shrink-0 cursor-pointer"
                          title="Xóa loại đất này"
                        >
                          <XCircle size={15} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. GIẤY TỜ KÈM THEO KHÁC (NẾU CÓ) */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-white text-[#007bff] border-b border-slate-200 px-4 py-2.5 font-bold uppercase text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={16} />
            GIẤY TỜ KÈM THEO KHÁC (NẾU CÓ)
          </div>
          <button 
            type="button" 
            onClick={() => addOtherDocRow()} 
            className="px-3 py-1 bg-white hover:bg-blue-50 text-[#007bff] border border-[#007bff]/30 hover:border-[#007bff] rounded text-xs font-bold flex items-center gap-1 active:scale-95 shadow-sm transition-all cursor-pointer uppercase animate-pulse-subtle"
          >
            <span>+ Thêm mới</span>
          </button>
        </div>
        
        <div className="p-4 space-y-4 animate-fade-in">
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-[#f8f9fa]">
                <tr>
                  <th className="px-3 py-2.5 text-center text-xs font-bold text-slate-500 uppercase w-12 border-r border-slate-200">#</th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase border-r border-slate-200">Tên giấy tờ khác nộp kèm</th>
                  <th className="px-3 py-2.5 text-center text-xs font-bold text-slate-500 uppercase w-60 border-r border-slate-200">Hình thức nộp</th>
                  <th className="px-3 py-2.5 text-center text-xs font-bold text-slate-500 uppercase w-16">Xóa</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {otherDocRows.map((row, index) => (
                  <tr key={index} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 text-center font-medium text-slate-500 border-r border-slate-200">{index + 1}</td>
                    <td className="px-3 py-2 border-r border-slate-200">
                      <input 
                        type="text" 
                        className={plainInputClass} 
                        value={row.name} 
                        onChange={(e) => handleOtherDocRowChange(index, 'name', e.target.value)} 
                        placeholder="Nhập tên giấy tờ..." 
                      />
                    </td>
                    <td className="px-3 py-2 text-center border-r border-slate-200">
                      <div className="flex items-center justify-center gap-6 h-[32px]">
                        <label className="flex items-center gap-1.5 text-sm cursor-pointer font-semibold text-slate-700 select-none">
                          <input 
                            type="radio" 
                            name={`simpleOtherDocsCopy-${index}`} 
                            value="Bản chính" 
                            checked={row.type === 'Bản chính'} 
                            onChange={(e) => handleOtherDocRowChange(index, 'type', e.target.value)} 
                            className="text-[#007bff] focus:ring-blue-500 h-4 w-4" 
                          />
                          Bản chính
                        </label>
                        <label className="flex items-center gap-1.5 text-sm cursor-pointer font-semibold text-slate-700 select-none">
                          <input 
                            type="radio" 
                            name={`simpleOtherDocsCopy-${index}`} 
                            value="Bản sao" 
                            checked={row.type === 'Bản sao'} 
                            onChange={(e) => handleOtherDocRowChange(index, 'type', e.target.value)} 
                            className="text-[#007bff] focus:ring-blue-500 h-4 w-4" 
                          />
                          Bản sao
                        </label>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button 
                        type="button" 
                        onClick={() => removeOtherDocRow(index)} 
                        className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded transition-colors inline-flex items-center justify-center"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {otherDocRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-center text-slate-400 text-xs font-semibold italic">
                      Không có giấy tờ kèm theo khác (Click nút "Thêm mới" để nhập liệu)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* THÔNG TIN NGƯỜI ĐƯỢC ỦY QUYỀN (NẾU CÓ) */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mt-4">
        <div 
          onClick={() => setShowAuthSection(!showAuthSection)} 
          className="bg-white hover:bg-slate-50 text-[#007bff] border-b border-slate-200 px-4 py-2.5 font-bold uppercase text-sm flex items-center justify-between cursor-pointer select-none transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText size={16} />
            THÔNG TIN NGƯỜI ĐƯỢC ỦY QUYỀN (NẾU CÓ)
          </div>
          <span className="text-xs font-bold bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded flex items-center gap-1 uppercase select-none active:scale-95 transition-all text-blue-600 shadow-sm">
            {showAuthSection ? '▲ Ẩn nhập liệu' : '▶ CLICK ĐỂ NHẬP'}
          </span>
        </div>
        {showAuthSection && (
          <div className="p-4 space-y-4 animate-fade-in border-t border-slate-200 bg-slate-50/30">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Người được ủy quyền</label>
                <input 
                  type="text" 
                  placeholder="Họ tên người được ủy quyền..." 
                  className={plainInputClass} 
                  value={formData.authorizedBy || ''} 
                  onChange={(e) => handleChange('authorizedBy', e.target.value)} 
                />
              </div>
              <div>
                <label className={labelClass}>CCCD/Số Giấy người được ủy quyền</label>
                <input 
                  type="text" 
                  placeholder="CCCD người được ủy quyền..." 
                  className={plainInputClass} 
                  value={authDocNumber} 
                  onChange={(e) => setAuthDocNumber(e.target.value)} 
                />
              </div>
              <div>
                <label className={labelClass}>SĐT người được ủy quyền</label>
                <input 
                  type="text" 
                  placeholder="SĐT người được ủy quyền..." 
                  className={plainInputClass} 
                  value={authPhone} 
                  onChange={(e) => setAuthPhone(e.target.value)} 
                />
              </div>
              <div className="md:col-span-3 mt-2">
                <label className={labelClass}>Địa chỉ thường trú người được ủy quyền</label>
                <input 
                  type="text" 
                  placeholder="Nhập địa chỉ thường trú người được ủy quyền..." 
                  className={plainInputClass} 
                  value={authAddress} 
                  onChange={(e) => setAuthAddress(e.target.value)} 
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleRecordForm;

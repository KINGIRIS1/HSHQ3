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
              <label className={labelClass}>CƠ QUAN PHÁT HÀNH / NƠI GỬI NHẬN <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                required 
                className={plainInputClass} 
                placeholder="Nhập cơ quan phát hành, đơn vị gửi nhận..."
                value={applicantName} 
                onChange={(e) => setApplicantName(e.target.value)} 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 mb-4">
            <div>
              <label className={labelClass}>SỐ VB - NỘI DUNG YÊU CẦU / TRÍCH YẾU <span className="text-red-500">*</span></label>
              <textarea 
                rows={4} 
                required 
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium text-gray-800"
                placeholder="Nhập số văn bản và nội dung trích yếu của công văn..."
                value={formData.content || ''} 
                onChange={(e) => handleChange('content', e.target.value)} 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className={labelClass}>Địa bàn Phường/xã</label>
              <select 
                className={selectClass} 
                value={formData.ward || ''} 
                onChange={(e) => handleChange('ward', e.target.value)}
              >
                <option value="">-- Chọn phường/xã --</option>
                {wards.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Tờ bản đồ</label>
              <input 
                type="text" 
                className={plainInputClass} 
                placeholder="Số tờ bản đồ..." 
                value={formData.mapSheet || ''} 
                onChange={(e) => handleChange('mapSheet', e.target.value)} 
              />
            </div>
            <div>
              <label className={labelClass}>Thửa đất</label>
              <input 
                type="text" 
                className={plainInputClass} 
                placeholder="Số thửa đất..." 
                value={formData.landPlot || ''} 
                onChange={(e) => handleChange('landPlot', e.target.value)} 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Ngày nhận <span className="text-red-500">*</span></label>
              <input 
                type="date" 
                required
                className={plainInputClass} 
                value={dateVal(formData.receivedDate)} 
                onChange={(e) => handleChange('receivedDate', e.target.value)} 
              />
            </div>
            <div>
              <label className={labelClass}>Hạn xử lý (Hẹn trả)</label>
              <input 
                type="date" 
                className={plainInputClass} 
                value={dateVal(formData.deadline)} 
                onChange={(e) => handleChange('deadline', e.target.value)} 
              />
            </div>
          </div>
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
          <div className="md:col-span-3 mt-2">
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
        </div>
      </div>

      {/* 2. THÔNG TIN THỬA ĐẤT */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 md:p-5">
        <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2 border-b pb-2 w-full">
          <MapPin size={16} /> THÔNG TIN THỬA ĐẤT
        </h3>
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Tỉnh/Thành phố <span className="text-red-500">*</span></label>
              <select className={selectClass} disabled value="Thành Phố Đồng Nai">
                <option value="Thành Phố Đồng Nai">Thành Phố Đồng Nai</option>
              </select>
            </div>
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
              <label className={labelClass}>Địa chỉ chi tiết</label>
              <input 
                type="text" 
                className={plainInputClass} 
                placeholder="Số nhà, tên đường, tổ/ấp..." 
                value={formData.address || ''} 
                onChange={(e) => handleChange('address', e.target.value)} 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>

          {/* Shaded Area Grid */}
          <div className="bg-emerald-50/40 border border-emerald-100 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-4">
                <div className="text-xs font-bold text-emerald-800 uppercase ml-0.5">
                  Diện tích thửa đất (m²)
                </div>
                <div className="flex items-center bg-emerald-50 border border-emerald-300 rounded px-2 py-0.5 text-xs font-bold text-emerald-800 w-[320px] h-[26px]" title="Tổng diện tích">
                  <span className="shrink-0 text-emerald-800 font-bold">Tổng diện tích :</span>
                  <input 
                    type="number" 
                    step="any" 
                    readOnly 
                    className="w-full border-none bg-transparent outline-none text-right font-mono font-bold text-emerald-900 cursor-not-allowed px-1.5" 
                    value={formData.area || 0} 
                  />
                  <span className="shrink-0 text-emerald-600 text-[10px] font-bold">m²</span>
                </div>
              </div>
              {addLandAreaRow && (
                <button 
                  type="button" 
                  onClick={addLandAreaRow}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold flex items-center gap-0.5 active:scale-95 shadow-sm transition-all h-[24px]"
                >
                  <span>+ Thêm loại đất</span>
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {landAreaRows.map((row, index) => (
                <div key={index} className="flex items-center gap-1.5 bg-white border border-emerald-200 rounded-md p-1 shadow-sm animate-fade-in w-[280px] shrink-0 h-[34px]">
                  <div className="w-[75px] shrink-0">
                    <select 
                      className="w-full px-1 py-0.5 border border-slate-200 rounded text-xs bg-white outline-none focus:border-emerald-500 font-bold text-slate-700 cursor-pointer h-[24px]"
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
                  <div className="flex-1 flex items-center gap-1">
                    <input 
                      type="number" 
                      step="any" 
                      placeholder="Diện tích" 
                      className="w-full border border-slate-200 rounded px-1.5 py-0.5 text-xs font-semibold text-slate-800 bg-white focus:border-emerald-500 outline-none text-right h-[24px]" 
                      value={row.area === '' ? '' : row.area} 
                      onChange={(e) => handleLandRowAreaChange(index, e.target.value)} 
                    />
                    <span className="text-[10px] font-bold text-slate-400 shrink-0">m²</span>
                  </div>
                  {removeLandAreaRow && (
                    <button 
                      type="button" 
                      onClick={() => removeLandAreaRow(index)}
                      className="text-red-500 hover:text-red-700 p-0.5 transition-colors shrink-0"
                      title="Xóa loại đất này"
                    >
                      <XCircle size={15} />
                    </button>
                  )}
                </div>
              ))}
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

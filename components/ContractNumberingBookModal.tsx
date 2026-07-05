import React, { useState, useEffect } from 'react';
import { X, Settings, Hash, Wand2, Calendar, BookOpen, Search, PlusCircle, RefreshCw, Layers } from 'lucide-react';
import { Contract } from '../types';
import { 
  getContractNumberingConfig, 
  saveContractNumberingConfig, 
  formatContractCode, 
  peekNextContractCode,
  ContractNumberingConfig 
} from '../utils/contractNumbering';

interface ContractNumberingBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  contracts: Contract[];
  onConfigChange: () => void;
  onQuickAllocate: (placeholderContract: Contract) => Promise<boolean>;
}

export const ContractNumberingBookModal: React.FC<ContractNumberingBookModalProps> = ({
  isOpen,
  onClose,
  contracts,
  onConfigChange,
  onQuickAllocate
}) => {
  const [config, setConfig] = useState<ContractNumberingConfig | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'config' | 'logs'>('logs');
  
  // States for manual fast allocation
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState('');
  const [quickContractType, setQuickContractType] = useState<'Đo đạc' | 'Tách thửa' | 'Cắm mốc' | 'Trích lục'>('Đo đạc');
  const [quickNote, setQuickNote] = useState('');
  
  // Real-time preview
  const [nextPreview, setNextPreview] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    const currentConfig = await getContractNumberingConfig();
    setConfig(currentConfig);
    updatePreview(currentConfig);
  };

  const updatePreview = (cfg: ContractNumberingConfig) => {
    const { code } = peekNextContractCode(cfg);
    setNextPreview(code);
  };

  if (!isOpen || !config) return null;

  const handleSaveConfig = async (updatedConfig: ContractNumberingConfig) => {
    setConfig(updatedConfig);
    updatePreview(updatedConfig);
    await saveContractNumberingConfig(updatedConfig);
    onConfigChange();
  };

  const handlePatternChange = (pattern: string) => {
    const updated = { ...config, pattern };
    handleSaveConfig(updated);
  };

  const handleCurrentNumberChange = (num: number) => {
    if (isNaN(num) || num < 0) return;
    const updated = { ...config, currentNumber: num };
    handleSaveConfig(updated);
  };

  const handleDigitsChange = (digits: number) => {
    const updated = { ...config, digits };
    handleSaveConfig(updated);
  };

  const handleYearChange = (year: number) => {
    if (isNaN(year) || year < 1000) return;
    const updated = { ...config, year };
    handleSaveConfig(updated);
  };

  const handlePrefixChange = (prefix: string) => {
    const updated = { ...config, prefix };
    handleSaveConfig(updated);
  };

  const handleSuffixChange = (suffix: string) => {
    const updated = { ...config, suffix };
    handleSaveConfig(updated);
  };

  // Perform quick number reservation / allocation
  const handlePerformQuickAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustomerName.trim()) {
      alert("Vui lòng nhập Tên khách hàng hoặc ghi chú để cấp số.");
      return;
    }

    const { code, nextNum, nextYear } = peekNextContractCode(config);
    
    // Create a skeleton contract
    const skeletonContract: Contract = {
      id: Math.random().toString(36).substr(2, 9),
      code: code,
      customerName: quickCustomerName.trim(),
      contractType: quickContractType,
      serviceType: quickContractType === 'Tách thửa' ? 'Đo đạc tách thửa' : `${quickContractType} ranh đất`,
      areaType: 'Đất nông thôn',
      phoneNumber: '',
      address: quickNote ? `Ghi chú: ${quickNote}` : 'Cấp số trực tiếp từ Sổ Lấy Số',
      ward: '',
      landPlot: '',
      mapSheet: '',
      area: 0,
      plotCount: 1,
      markerCount: 1,
      quantity: 1,
      unitPrice: 0,
      vatRate: 8,
      vatAmount: 0,
      totalAmount: 0,
      deposit: 0,
      createdDate: new Date().toISOString().split('T')[0],
      status: 'PENDING',
      liquidationArea: 0
    };

    // Allocate on database / local
    const success = await onQuickAllocate(skeletonContract);
    if (success) {
      // Increment counter
      const updatedConfig = {
        ...config,
        currentNumber: nextNum,
        year: nextYear
      };
      await saveContractNumberingConfig(updatedConfig);
      setConfig(updatedConfig);
      updatePreview(updatedConfig);
      onConfigChange();

      // Reset form
      setQuickCustomerName('');
      setQuickNote('');
      setShowQuickForm(false);
      alert(`Đã cấp thành công Hợp đồng số: ${code}`);
    } else {
      alert("Lỗi khi cấp số hợp đồng. Vui lòng thử lại.");
    }
  };

  // Filter logs / contracts using code
  const sortedContracts = [...contracts].sort((a, b) => {
    // Attempt sorting by code reverse, or date
    return new Date(b.createdDate || '').getTime() - new Date(a.createdDate || '').getTime();
  });

  const filteredContracts = sortedContracts.filter(c => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (c.code || '').toLowerCase().includes(searchLower) ||
      (c.customerName || '').toLowerCase().includes(searchLower) ||
      (c.contractType || '').toLowerCase().includes(searchLower) ||
      (c.address || '').toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[999] animate-fade-in" id="contract-numbering-modal">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* HEADER */}
        <div className="bg-purple-95 border-b border-purple-100 px-6 py-4 flex justify-between items-center bg-gradient-to-r from-purple-50 to-indigo-50">
          <div className="flex items-center gap-2.5">
            <div className="bg-purple-600 p-2 rounded-xl text-white shadow-md">
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-800">Sổ Cấp Số & Quản Lý Số Hợp Đồng</h3>
              <p className="text-xs text-slate-500">Tìm kiếm số đã cấp, quản lý khởi tạo, đồng bộ liên tục theo năm</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200/50 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* TABS */}
        <div className="flex border-b border-slate-100 bg-slate-50/50 px-6 shrink-0">
          <button 
            onClick={() => setActiveSubTab('logs')}
            className={`py-3 px-4 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${activeSubTab === 'logs' ? 'border-purple-600 text-purple-700 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <Hash size={16} /> Sổ cấp lịch sử ({contracts.length} số)
          </button>
          <button 
            onClick={() => setActiveSubTab('config')}
            className={`py-3 px-4 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${activeSubTab === 'config' ? 'border-purple-600 text-purple-700 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <Settings size={16} /> Cấu hình & Khởi đầu số
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* TAB 1: HISTORY LOGBOOK */}
          {activeSubTab === 'logs' && (
            <div className="flex flex-col gap-4 h-full">
              {/* TOP BAR: SEARCH & QUICK ALLOCATE */}
              <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search size={18} className="text-slate-400" />
                  </span>
                  <input
                    type="text"
                    placeholder="Tìm kiếm số hợp đồng, tên khách hàng..."
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <button 
                  onClick={() => setShowQuickForm(!showQuickForm)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
                >
                  <PlusCircle size={16} /> Cấp nhanh một số
                </button>
              </div>

              {/* QUICK ALLOCATE FORM POPUP */}
              {showQuickForm && (
                <form onSubmit={handlePerformQuickAllocate} className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100 flex flex-col gap-3 animate-fade-in">
                  <h4 className="font-bold text-sm text-purple-800 flex items-center gap-1.5 border-b border-purple-100 pb-1.5">
                    <Wand2 size={15} /> Điền thông tin cấp nhanh số tiếp theo ({nextPreview})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-1.5 flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-600">Tên khách hàng *</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Nhập tên khách hàng" 
                        className="p-2 border border-slate-200 rounded-lg text-sm bg-white"
                        value={quickCustomerName}
                        onChange={e => setQuickCustomerName(e.target.value)}
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-600">Loại nghiệp vụ</label>
                      <select 
                        className="p-2 border border-slate-200 rounded-lg text-sm bg-white font-medium"
                        value={quickContractType}
                        onChange={e => setQuickContractType(e.target.value as any)}
                      >
                        <option value="Đo đạc">Đo đạc</option>
                        <option value="Tách thửa">Tách thửa</option>
                        <option value="Cắm mốc">Cắm mốc</option>
                        <option value="Trích lục">Trích lục</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-600">Ghi chú thêm</label>
                      <input 
                        type="text" 
                        placeholder="VD: Hồ sơ đo vẽ nhanh" 
                        className="p-2 border border-slate-200 rounded-lg text-sm bg-white"
                        value={quickNote}
                        onChange={e => setQuickNote(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-2 mt-1">
                    <button 
                      type="button" 
                      onClick={() => setShowQuickForm(false)} 
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg font-medium"
                    >
                      Hủy bỏ
                    </button>
                    <button 
                      type="submit" 
                      className="px-4 py-1.5 text-xs bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700"
                    >
                      Cấp số ngay ({nextPreview})
                    </button>
                  </div>
                </form>
              )}

              {/* LOGBOOK TABLE */}
              <div className="flex-1 overflow-x-auto border border-slate-100 rounded-xl">
                <table className="min-w-full divide-y divide-slate-150 text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="p-3">Số hợp đồng</th>
                      <th className="p-3">Khách hàng</th>
                      <th className="p-3">Loại nghiệp vụ</th>
                      <th className="p-3">Ngày lập</th>
                      <th className="p-3">Ghi chú / Địa chỉ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredContracts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400">
                          Chưa có lịch sử cấp số nào khớp với bộ lọc tìm kiếm.
                        </td>
                      </tr>
                    ) : (
                      filteredContracts.map((c, idx) => (
                        <tr key={c.id || idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 font-mono font-bold text-purple-700 whitespace-nowrap">{c.code}</td>
                          <td className="p-3 font-semibold text-slate-800">{c.customerName}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              c.contractType === 'Tách thửa' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                              c.contractType === 'Cắm mốc' ? 'bg-emerald-50 text-emerald-700' :
                              c.contractType === 'Trích lục' ? 'bg-pink-50 text-pink-700' : 'bg-purple-50 text-purple-700'
                            }`}>
                              {c.contractType}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 whitespace-nowrap">
                            {c.createdDate ? new Date(c.createdDate).toLocaleDateString('vi-VN') : '---'}
                          </td>
                          <td className="p-3 text-xs text-slate-400 max-w-[200px] truncate" title={c.address || ''}>
                            {c.address || ''}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: CONFIGURATION & MANUAL START SEED */}
          {activeSubTab === 'config' && (
            <div className="flex flex-col gap-6 max-w-2xl mx-auto">
              {/* NEXT PREVIEW CARD */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-900 to-indigo-950 text-white shadow-xl flex flex-col gap-2 relative overflow-hidden">
                <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-x-4 translate-y-4">
                  <Hash size={200} />
                </div>
                <span className="text-xs text-purple-200 font-bold uppercase tracking-wider">Mẫu thử số tiếp theo sẽ sinh:</span>
                <div className="text-3xl font-black font-mono tracking-tight text-white flex items-center gap-1.5 drop-shadow-sm select-all">
                  {nextPreview}
                </div>
                <div className="text-xs text-purple-300 mt-2 flex items-center gap-1">
                  <Calendar size={13} strokeWidth={2.5} /> Chu kỳ tự động làm mới (về 1) vào năm tiếp theo của Hớn Quản.
                </div>
              </div>

              {/* CORE PARAMETERS */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col gap-4">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
                  <Settings size={16} className="text-purple-600" /> Thiết lập Sổ Lấy Số & Số Khởi Đầu
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* CURRENT SEED COUNTER */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      Số hiện tại của sổ lấy số
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Hash size={16} />
                      </span>
                      <input 
                        type="number"
                        min="0"
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm font-bold bg-white focus:ring-2 focus:ring-purple-500/20"
                        value={config.currentNumber}
                        onChange={e => handleCurrentNumberChange(parseInt(e.target.value))}
                      />
                    </div>
                    <span className="text-[11px] text-orange-600 font-medium">
                      * Nhập số này để điều chỉnh. Nếu điền <b>123</b>, số hợp đồng tiếp theo bạn lập sẽ là <b>124</b>.
                    </span>
                  </div>

                  {/* YEAR ASSOCIATED */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      Năm áp dụng hiện tại
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Calendar size={16} />
                      </span>
                      <input 
                        type="number"
                        min="2020"
                        max="2100"
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm font-bold bg-white focus:ring-2 focus:ring-purple-500/20"
                        value={config.year}
                        onChange={e => handleYearChange(parseInt(e.target.value))}
                      />
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Năm quản lý của hệ thống. Nếu đổi sang năm mới, dữ liệu tự làm mới về 1.
                    </span>
                  </div>

                  {/* PREFIX */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700">Tiền tố (Prefix)</label>
                    <input 
                      type="text"
                      className="p-2 border border-slate-200 rounded-xl text-sm font-semibold bg-white"
                      value={config.prefix}
                      onChange={e => handlePrefixChange(e.target.value)}
                    />
                  </div>

                  {/* SUFFIX */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700">Hậu tố (Suffix)</label>
                    <input 
                      type="text"
                      className="p-2 border border-slate-200 rounded-xl text-sm font-semibold bg-white"
                      value={config.suffix}
                      onChange={e => handleSuffixChange(e.target.value)}
                    />
                  </div>

                  {/* LEADING ZEROS */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700">Độ rộng số (Ký tự số)</label>
                    <select 
                      className="p-2 border border-slate-200 rounded-xl text-sm font-semibold bg-white"
                      value={config.digits}
                      onChange={e => handleDigitsChange(parseInt(e.target.value))}
                    >
                      <option value={0}>Không thêm số 0 rỗng (VD: 15 / 1234)</option>
                      <option value={3}>3 chữ số (VD: 015 / 123)</option>
                      <option value={4}>4 chữ số (VD: 0015 / 1234)</option>
                      <option value={5}>5 chữ số (VD: 00015 / 12345)</option>
                    </select>
                  </div>

                </div>
              </div>

              {/* PATTERN SELECTOR */}
              <div className="flex flex-col gap-2 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1">
                  <Layers size={15} className="text-purple-600" /> Kiểu định dạng hiển thị tên số
                </label>
                <div className="grid grid-cols-1 gap-2.5">
                  {[
                    { label: 'Số hợp đồng kinh tế theo năm chuẩn Hớn Quản (VD: [Số]/HĐKT/[Năm])', value: '{num}/HĐKT/{year}' },
                    { label: 'Số tăng dần đứng trước, có hậu tố (VD: [Số]/HĐ-[Hậu_tố])', value: '{num}/HĐ-{suffix}' },
                    { label: 'Số tăng dần đứng trước, có năm (VD: [Số]/HĐ-[Năm])', value: '{num}/HĐ-{year}' },
                    { label: 'Số tăng dần đứng sau năm (VD: HĐ-[Năm]/[Số])', value: 'HĐ-{year}/{num}' },
                    { label: 'Liên kết dấu gạch ngang (VD: HĐ-[Năm]-[Số])', value: 'HĐ-{year}-{num}' },
                    { label: 'Đầy đủ tất cả (VD: [Số]/HĐ-[Hậu_tố]-[Năm])', value: '{num}/HĐ-{suffix}-{year}' },
                    { label: 'Rút gọn đơn giản (VD: [Số]/HĐ)', value: '{num}/HĐ' }
                  ].map((p, pIdx) => {
                    const testCode = formatContractCode(15, config.year, { ...config, pattern: p.value });
                    return (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => handlePatternChange(p.value)}
                        className={`p-3 rounded-xl border text-left flex justify-between items-center transition-all ${config.pattern === p.value ? 'bg-purple-50 border-purple-300 shadow-sm' : 'bg-white border-slate-200 hover:border-purple-200'}`}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-xs ${config.pattern === p.value ? 'text-purple-700 font-bold' : 'text-slate-600 font-medium'}`}>{p.label}</span>
                          <span className="text-[10px] text-slate-400 font-mono">Mẫu khai báo: {p.value}</span>
                        </div>
                        <span className={`font-mono text-xs font-bold px-2.5 py-1 rounded-lg ${config.pattern === p.value ? 'bg-purple-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'}`}>
                          {testCode}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* FOOTER */}
        <div className="border-t border-slate-150 px-6 py-4 bg-slate-50 flex justify-between items-center shrink-0">
          <button 
            type="button" 
            onClick={loadConfig} 
            className="px-3.5 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors bg-white shadow-sm"
          >
            <RefreshCw size={14} /> Làm mới sổ
          </button>
          
          <button 
            type="button" 
            onClick={onClose} 
            className="px-6 py-2 bg-slate-800 text-white font-bold rounded-xl text-sm shadow-md hover:bg-slate-900 transition-colors"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};

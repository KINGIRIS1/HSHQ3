import React, { useState, useMemo, useEffect } from 'react';
import { Employee, RecordFile } from '../types';
import { X, Check, Search, Users, Compass, FolderOpen, Award, FileCheck, ArrowRight } from 'lucide-react';
import { removeVietnameseTones } from '../utils/appHelpers';
import { getEmployeeTeam, getRoleCategory } from './AssignModal';

interface AssignNextStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (employeeId: string) => void;
  employees: Employee[];
  record: RecordFile | null;
  nextStepLabel: string;
}

const TEAMS_LIST = [
  { name: 'Tổ Cấp giấy', description: 'Đăng ký, biến động, cấp GCN', icon: FileCheck },
  { name: 'Tổ Lưu trữ', description: 'Khai thác hồ sơ & dữ liệu lưu trữ', icon: FolderOpen },
  { name: 'Tổ Đo đạc', description: 'Đo vẽ bản đồ, trích đo thửa đất', icon: Compass },
  { name: 'Tổ Hành chính', description: 'Một cửa, tổng hợp, hành chính', icon: Users },
  { name: 'Ban Giám đốc', description: 'Ban Giám đốc & Phối hợp Lãnh đạo', icon: Award },
];

export const AssignNextStepModal: React.FC<AssignNextStepModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  employees,
  record,
  nextStepLabel
}) => {
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Tự động xác định địa bàn mục tiêu để đề xuất cá nhân phụ trách đúng tuyến
  const targetWardName = useMemo(() => {
    if (!record) return null;
    return record.ward || null;
  }, [record]);

  // Phân chia nhân viên trực thuộc của từng Tổ
  const teamsData = useMemo(() => {
    const map: Record<string, Employee[]> = {
      'Tổ Cấp giấy': [],
      'Tổ Lưu trữ': [],
      'Tổ Đo đạc': [],
      'Tổ Hành chính': [],
      'Ban Giám đốc': []
    };

    employees.forEach(emp => {
      const t = getEmployeeTeam(emp);
      if (map[t]) {
        map[t].push(emp);
      } else {
        map['Tổ Hành chính'].push(emp);
      }
    });

    return map;
  }, [employees]);

  // Khởi dựng Tổ mặc định khi mở Modal
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      
      // Mặc định chọn Tổ dựa trên loại khâu tiếp theo
      let defaultTeam = 'Tổ Cấp giấy';
      const labelNorm = removeVietnameseTones(nextStepLabel).toLowerCase();
      
      if (labelNorm.includes('luu tru') || labelNorm.includes('sao luc')) {
        defaultTeam = 'Tổ Lưu trữ';
      } else if (labelNorm.includes('do dac') || labelNorm.includes('trich do') || labelNorm.includes('do ve')) {
        defaultTeam = 'Tổ Đo đạc';
      } else if (labelNorm.includes('hanh chinh') || labelNorm.includes('mot cua') || labelNorm.includes('văn thư')) {
        defaultTeam = 'Tổ Hành chính';
      } else if (labelNorm.includes('lanh dao') || labelNorm.includes('giam doc') || labelNorm.includes('trinh ky') || labelNorm.includes('ky duyet')) {
        defaultTeam = 'Ban Giám đốc';
      }
      
      setSelectedTeam(defaultTeam);

      // Thử đề xuất nhân viên từng thực hiện khâu này hoặc nhân viên mặc định đang được gán
      if (record?.assignedTo) {
        const currentAssignee = employees.find(e => e.id === record.assignedTo);
        if (currentAssignee) {
          setSelectedEmpId(currentAssignee.id);
          setSelectedTeam(getEmployeeTeam(currentAssignee));
        }
      } else {
        setSelectedEmpId('');
      }
    }
  }, [isOpen, nextStepLabel, record, employees]);

  // Lọc danh sách nhân viên trong Tổ được chọn dưa theo thanh tìm kiếm
  const filteredEmployeesOfTeam = useMemo(() => {
    let list = teamsData[selectedTeam] || [];
    
    // NẾU khâu tiếp theo là "kiểm tra", "thẩm tra", "ký duyệt" -> Chỉ hiện Tổ trưởng / Tổ phó hoặc Ban Giám đốc tương ứng
    const labelNorm = removeVietnameseTones(nextStepLabel || '').toLowerCase();
    const isCheckStep = labelNorm.includes('kiem tra') || labelNorm.includes('tham tra') || labelNorm.includes('tham dinh') || labelNorm.includes('kiem soat') || labelNorm.includes('trinh kiem');
    if (isCheckStep) {
      list = list.filter(emp => {
        const pos = (emp.position || '').toLowerCase().trim();
        const posNorm = removeVietnameseTones(pos);
        
        // Quy ước: Chỉ tổ trưởng hoặc tổ phó
        const isLeader = posNorm.includes('to truong') || posNorm.includes('truong nhom') || posNorm.includes('truong phong') || posNorm.includes('truong to');
        const isViceLeader = posNorm.includes('to pho') || posNorm.includes('pho to') || posNorm.includes('pho nhom') || posNorm.includes('pho phong') || posNorm.includes('pho to');
        
        // Loại trừ rõ ràng nếu là nhân viên/chuyên viên thông thường nhưng được gán quyền
        if (posNorm.includes('nhan vien') || posNorm.includes('chuyen vien') || posNorm.includes('can bo') || posNorm.includes('ky thuat vien')) {
            if (!isLeader && !isViceLeader) {
                return false;
            }
        }
        
        return isLeader || isViceLeader;
      });
    }

    if (!searchTerm.trim()) return list;
    
    return list.filter(e => 
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.department || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.position || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [teamsData, selectedTeam, searchTerm, nextStepLabel]);

  // Chia nhân viên trong Tổ thành: Đề xuất đúng địa bàn (Recommended) & Các nhân viên khác (Others)
  const { recommended, others } = useMemo(() => {
    const rec: Employee[] = [];
    const oth: Employee[] = [];

    filteredEmployeesOfTeam.forEach(emp => {
      let isRecommended = false;
      if (targetWardName) {
        const targetNorm = removeVietnameseTones(targetWardName);
        isRecommended = emp.managedWards && emp.managedWards.some(w => removeVietnameseTones(w) === targetNorm);
      }

      if (isRecommended) {
        rec.push(emp);
      } else {
        oth.push(emp);
      }
    });

    rec.sort((a, b) => a.name.localeCompare(b.name));
    oth.sort((a, b) => a.name.localeCompare(b.name));

    return { recommended: rec, others: oth };
  }, [filteredEmployeesOfTeam, targetWardName]);

  // Hợp nhất danh sách nhân viên (đề xuất hiển thị trước, các cá nhân khác theo sau)
  const sortedEmployees = useMemo(() => {
    return [...recommended, ...others];
  }, [recommended, others]);

  const handleConfirm = () => {
    if (selectedEmpId) {
      onConfirm(selectedEmpId);
    }
  };

  if (!isOpen || !record) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col h-[80vh] animate-fade-in-up overflow-hidden border border-gray-100">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b bg-gray-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2.5 rounded-xl text-green-600 shadow-sm shadow-green-100 animate-pulse">
              <ArrowRight size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-gray-800">
                Giao việc khâu tiếp theo: <span className="text-indigo-600 font-black">"{nextStepLabel}"</span>
              </h3>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Mỗi khâu hoạt động như một băng chuyền. Hãy chọn người phụ trách cho khâu tiếp theo của hồ sơ <strong className="text-gray-700">{record.code}</strong>.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input 
                type="text" 
                placeholder="Tìm nhân viên trong Tổ..." 
                className="pl-8 pr-4 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-56 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 rounded-lg">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Info Strip */}
        <div className="bg-amber-50/60 border-b border-amber-100 px-5 py-2.5 flex items-center justify-between text-xs text-amber-900 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold">Khách hàng:</span> {record.customerName}
            {record.ward && <span className="text-amber-600">| Địa bàn: {record.ward}</span>}
            {record.recordType && <span className="text-amber-600">| Loại hồ sơ: {record.recordType}</span>}
          </div>
        </div>

        {/* Main Body Layout */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          
          {/* LEFT COLUMN: Teams */}
          <div className="w-full md:w-60 border-b md:border-b-0 md:border-r border-gray-200 bg-gray-50/50 flex flex-col p-3 shrink-0 overflow-y-auto gap-1.5">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1.5 mb-1">
              <Users size={12} className="text-gray-400" /> Danh sách Tổ chuyên môn
            </h4>
            {TEAMS_LIST.map((team) => {
              const Icon = team.icon;
              const isSelected = selectedTeam === team.name;
              const count = teamsData[team.name]?.length || 0;
              
              return (
                <button
                  key={team.name}
                  type="button"
                  onClick={() => {
                    setSelectedTeam(team.name);
                  }}
                  className={`relative flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all duration-200 outline-none w-full ${
                    isSelected 
                      ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100' 
                      : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={16} className={isSelected ? 'text-white' : 'text-gray-500'} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-gray-800'}`}>{team.name}</p>
                    <p className={`text-[10px] truncate ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>{team.description}</p>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${isSelected ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* RIGHT COLUMN: Employees List */}
          <div className="flex-1 overflow-y-auto p-4 bg-white">
            {sortedEmployees.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 italic gap-2 py-10 text-xs">
                <Users size={28} className="stroke-1 text-gray-300" />
                Không tìm thấy nhân viên nào phù hợp trong {selectedTeam}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sortedEmployees.map((emp) => {
                  const isRecommended = targetWardName && emp.managedWards && emp.managedWards.some(w => removeVietnameseTones(w) === removeVietnameseTones(targetWardName));
                  const isSelected = selectedEmpId === emp.id;
                  
                  return (
                    <div 
                      key={emp.id}
                      onClick={() => setSelectedEmpId(emp.id)}
                      className={`relative flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200 group ${
                        isSelected 
                          ? 'bg-blue-50 border-blue-500 shadow-sm ring-2 ring-blue-100' 
                          : isRecommended
                            ? 'bg-green-50/50 border-green-500 hover:border-green-600 shadow-sm'
                            : 'bg-white border-gray-200 hover:border-blue-400'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isSelected 
                          ? 'bg-blue-600 text-white' 
                          : isRecommended 
                            ? 'bg-green-600 text-white' 
                            : 'bg-slate-100 text-gray-600'
                      }`}>
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`font-extrabold text-xs truncate ${isSelected ? 'text-blue-700' : isRecommended ? 'text-green-800' : 'text-slate-800'}`}>
                            {emp.name}
                          </span>
                          {emp.position && (
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                              isSelected 
                                ? 'text-blue-700 bg-blue-100/50 border-blue-200' 
                                : isRecommended 
                                  ? 'text-green-700 bg-green-100 border-green-200 font-black' 
                                  : 'text-amber-700 bg-amber-50 border-amber-200'
                            }`}>
                              {emp.position}
                            </span>
                          )}
                          {isRecommended && (
                            <span className="text-[8px] font-black uppercase text-green-700 bg-green-100 border border-green-150 px-1 py-0.2 rounded-full inline-flex items-center shrink-0">
                              Địa bàn
                            </span>
                          )}
                        </div>
                        
                        <div className={`text-[10px] truncate mt-0.5 ${
                          isSelected 
                            ? 'text-blue-600 font-semibold' 
                            : isRecommended 
                              ? 'text-green-700 font-medium' 
                              : 'text-gray-500'
                        }`}>
                          {emp.department || 'Chưa phân Tổ'}
                        </div>

                        {emp.managedWards && emp.managedWards.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {emp.managedWards.slice(0, 2).map((w, idx) => (
                              <span key={idx} className="text-[8px] px-1.5 py-0.5 rounded border truncate max-w-[80px] bg-slate-50 text-gray-500 border-gray-150">
                                {w}
                              </span>
                            ))}
                            {emp.managedWards.length > 2 && (
                              <span className="text-[8px] font-medium text-gray-400 self-center">
                                +{emp.managedWards.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {isSelected && (
                        <div className="absolute top-2.5 right-2.5 bg-blue-600 text-white rounded-full p-0.5 shadow">
                          <Check size={10} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2 shrink-0">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Hủy bỏ
          </button>
          <button 
            type="button" 
            onClick={handleConfirm} 
            disabled={!selectedEmpId}
            className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md flex items-center gap-1.5 ${
              selectedEmpId 
                ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-100 hover:shadow-lg hover:shadow-blue-200' 
                : 'bg-gray-300 cursor-not-allowed shadow-none'
            }`}
          >
            <Check size={14} strokeWidth={2.5} />
            Xác nhận Giao việc & Chuyển bước
          </button>
        </div>

      </div>
    </div>
  );
};

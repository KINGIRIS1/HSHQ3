import React, { useState, useMemo, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, FileSignature } from 'lucide-react';
import { RecordFile, UserRole, User, Employee } from '../../types';
import { getEmployeeTeam, getRoleCategory } from '../AssignModal';

interface SubmitModalProps {
    isOpen: boolean;
    onClose: () => void;
    records: RecordFile[];
    onConfirm: (directorId: string) => void;
    users: User[];
    employees: Employee[];
    isCheckMode?: boolean; // MỚI: Chế độ trình kiểm tra
    currentUser?: User; // MỚI: Người dùng hiện tại để lọc theo tổ
}

const SubmitModal: React.FC<SubmitModalProps> = ({ isOpen, onClose, records, onConfirm, users, employees, isCheckMode, currentUser }) => {
    const [selectedDirector, setSelectedDirector] = useState<string>('');

    // Hàm phụ trợ tìm kiếm nhân viên được liên kết với tài khoản người dùng
    const getLinkedEmployeeForUser = (u: User): Employee | null => {
        if (u.employeeId) {
            const matched = employees.find(e => e.id === u.employeeId);
            if (matched) return matched;
        }
        if (u.name) {
            const matched = employees.find(e => e.name.trim().toLowerCase() === u.name.trim().toLowerCase());
            if (matched) return matched;
        }
        if (u.username) {
            const matched = employees.find(e => e.id.trim().toLowerCase() === u.username.trim().toLowerCase());
            if (matched) return matched;
        }
        return null;
    };

    // Hàm phụ trợ xác định tổ chuyên môn của hồ sơ
    const getRecordTeam = (r: RecordFile): string => {
        if (r.assignedTo) {
            const assignedEmp = employees.find(e => e.id === r.assignedTo);
            if (assignedEmp) {
                const team = getEmployeeTeam(assignedEmp);
                if (team && team !== 'Ban Giám đốc') return team;
            }
        }
        
        if (!r.recordType) return 'Tổ Đo đạc';
        const t = r.recordType.trim().toLowerCase();
        const isReg = r.recordType.includes('Đăng ký') || r.recordType.includes('Cấp giấy') || r.recordType.includes('Biến động') || r.recordType.includes('GCN') || t.includes('bien dong') || t.includes('cap giay');
        if (isReg) return 'Tổ Cấp giấy';
        
        if (t.includes('luu tru') || t.includes('sao luc') || t.includes('thong tin') || t.includes('cong van') || t.includes('công văn')) {
            return 'Tổ Lưu trữ';
        }
        return 'Tổ Đo đạc';
    };

    // Tạo danh sách người nhận/kiểm tra đồng nhất từ cả Employees và Users
    const targetCheckers = useMemo(() => {
        if (isCheckMode) {
            // 1. Xác định tổ thụ lý của các hồ sơ đang được trình kiểm tra
            const recordTeams = Array.from(new Set((records || []).map(getRecordTeam).filter(Boolean)));
            
            // 2. Chỉ lọc ra các nhân viên thuộc những tổ thụ lý này có chức vụ Tổ trưởng hoặc Tổ phó
            const eligibleEmployees = employees.filter(emp => {
                const team = getEmployeeTeam(emp);
                // Bắt buộc phải thuộc Tổ thụ lý tương ứng với hồ sơ
                if (!recordTeams.includes(team)) return false;
                
                const cat = getRoleCategory(emp.position);
                return cat.key === 'leader' || cat.key === 'vice_leader';
            });
            
            const checkersMap = new Map<string, { id: string; name: string; position: string; team: string }>();
            
            // Đưa tất cả nhân viên hợp lệ vào map
            eligibleEmployees.forEach(emp => {
                checkersMap.set(emp.id, {
                    id: emp.id,
                    name: emp.name,
                    position: emp.position || 'Tổ phó',
                    team: getEmployeeTeam(emp) || 'Chưa phân tổ'
                });
            });
            
            return Array.from(checkersMap.values());
        } else {
            // Chế độ trình ký: CHỈ Ban Giám đốc (Giám đốc, Phó giám đốc)
            const eligibleEmployees = employees.filter(emp => {
                const teamName = getEmployeeTeam(emp);
                const pos = (emp.position || '').toLowerCase();
                const isDirectorPos = pos.includes('giam doc') || pos.includes('giám đốc') || pos.includes('pho giam doc') || pos.includes('phó giám đốc') || pos.includes('lanh dao') || pos.includes('lãnh đạo');
                return teamName === 'Ban Giám đốc' || isDirectorPos;
            });
            
            const directorsMap = new Map<string, { id: string; name: string; position: string; team: string }>();
            
            eligibleEmployees.forEach(emp => {
                directorsMap.set(emp.id, {
                    id: emp.id,
                    name: emp.name,
                    position: emp.position || 'Ban Giám đốc',
                    team: 'Ban Giám đốc'
                });
            });
 
            return Array.from(directorsMap.values());
        }
    }, [users, employees, isCheckMode, records]);

    // Tổ thụ lý của các hồ sơ (Dùng để hiển thị banner thông báo)
    const recordTeams = useMemo(() => {
        return Array.from(new Set((records || []).map(getRecordTeam).filter(Boolean)));
    }, [records, employees]);

    // Cập nhật reset lựa chọn khi mở modal
    useEffect(() => {
        if (isOpen) {
            setSelectedDirector('');
        }
    }, [isOpen]);

    // Gom nhóm danh sách nhân sự theo từng Tổ để hiển thị trực quan
    const groupedCheckers = useMemo(() => {
        const groups: { [team: string]: typeof targetCheckers } = {};
        targetCheckers.forEach(item => {
            const t = item.team || 'Chưa phân tổ';
            if (!groups[t]) groups[t] = [];
            groups[t].push(item);
        });
        return groups;
    }, [targetCheckers]);

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (!selectedDirector) {
            alert(isCheckMode ? 'Vui lòng chọn người kiểm tra.' : 'Vui lòng chọn người được trình ký.');
            return;
        }
        onConfirm(selectedDirector);
        setSelectedDirector('');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-fade-in-up">
                <div className={`${isCheckMode ? 'bg-orange-600' : 'bg-indigo-600'} p-4 flex justify-between items-center text-white`}>
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <FileSignature size={20} />
                        {isCheckMode ? 'Trình Kiểm Tra' : 'Trình Ký Duyệt'}
                    </h2>
                    <button onClick={onClose} className={`${isCheckMode ? 'text-orange-200' : 'text-indigo-200'} hover:text-white transition-colors`}>
                        <X size={24} />
                    </button>
                </div>
 
                <div className="p-6">
                    <div className="mb-6">
                        {!isCheckMode && (
                            <p className="text-gray-700 mb-2 font-medium text-sm">
                                Bạn đang trình ký <span className="font-bold text-indigo-600">{records.length}</span> hồ sơ.
                            </p>
                        )}
                        <p className="text-xs text-gray-500 mb-4">
                            Vui lòng chọn {isCheckMode ? 'Tổ trưởng/Tổ phó tương ứng' : 'Giám đốc/Phó giám đốc'} để hoàn tất hồ sơ:
                        </p>

                        
                        <div className="space-y-4 max-h-[280px] overflow-y-auto pr-1">
                            {Object.keys(groupedCheckers).map((teamName) => (
                                <div key={teamName} className="space-y-2">
                                    <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider bg-gray-100/80 px-2.5 py-1 rounded-md flex justify-between items-center">
                                        <span>{teamName}</span>
                                        <span className="text-[9px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-bold">
                                            {groupedCheckers[teamName].length} nhân sự
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        {groupedCheckers[teamName].map((checker) => {
                                            const key = checker.id;
                                            return (
                                                <label 
                                                    key={key} 
                                                    className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${selectedDirector === key ? (isCheckMode ? 'border-orange-500 bg-orange-50/40 shadow-sm' : 'border-indigo-500 bg-indigo-50/40 shadow-sm') : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/40'}`}
                                                >
                                                    <input 
                                                        type="radio" 
                                                        name="director" 
                                                        value={key} 
                                                        checked={selectedDirector === key}
                                                        onChange={(e) => setSelectedDirector(e.target.value)}
                                                        className={`w-4 h-4 ${isCheckMode ? 'text-orange-600 focus:ring-orange-500 border-orange-300' : 'text-indigo-600 focus:ring-indigo-500 border-indigo-300'}`}
                                                    />
                                                    <div className="ml-3 flex-1">
                                                        <span className="block text-sm font-semibold text-gray-900">{checker.name}</span>
                                                        <span className="block text-xs text-gray-500 mt-0.5 font-medium">
                                                            {checker.position}
                                                        </span>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {targetCheckers.length === 0 && (
                                <div className="text-sm text-red-500 flex items-center gap-1.5 p-3 bg-red-50 rounded-xl border border-red-100">
                                    <AlertCircle size={16} className="shrink-0" /> 
                                    <span>Không tìm thấy nhân sự {isCheckMode ? 'Tổ trưởng/Tổ phó' : 'Lãnh đạo'} nào.</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button 
                            onClick={onClose} 
                            className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors"
                        >
                            Hủy
                        </button>
                        <button 
                            onClick={handleSubmit} 
                            disabled={!selectedDirector}
                            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white transition-all shadow-md ${selectedDirector ? (isCheckMode ? 'bg-orange-600 hover:bg-orange-700' : 'bg-indigo-600 hover:bg-indigo-700') : 'bg-gray-300 cursor-not-allowed'}`}
                        >
                            <CheckCircle size={18} />
                            Xác nhận {isCheckMode ? 'trình kiểm tra' : 'trình ký'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SubmitModal;
import React, { useState } from 'react';
import { X, CornerUpLeft, MessageSquare } from 'lucide-react';
import { RecordFile, User } from '../../types';

interface ReturnReasonModalProps {
    isOpen: boolean;
    onClose: () => void;
    records: RecordFile[];
    onConfirm: (reason: string) => void;
}

const ReturnReasonModal: React.FC<ReturnReasonModalProps> = ({ isOpen, onClose, records, onConfirm }) => {
    const [reason, setReason] = useState<string>('');

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (!reason.trim()) {
            alert('Vui lòng ghi lý do trả hồ sơ.');
            return;
        }
        onConfirm(reason.trim());
        setReason('');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-fade-in-up">
                <div className="bg-red-600 p-4 flex justify-between items-center text-white">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <CornerUpLeft size={20} /> Trả hồ sơ yêu cầu sửa
                    </h2>
                    <button onClick={onClose} className="text-white hover:text-gray-200 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    <p className="text-sm text-gray-600 mb-4 font-medium">
                        Bạn đang chuẩn bị trả {records.length} hồ sơ ({records.map(r => r.code).join(', ')}) về cho nhân viên chỉnh sửa.
                    </p>

                    <div className="mb-4">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <MessageSquare size={14} className="text-red-500" /> Lý do trả hồ sơ <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[100px] font-medium"
                            placeholder="Ghi chi tiết lý do trả hồ sơ hoặc yêu cầu cần chỉnh sửa..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            required
                        />
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={onClose}
                            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors active:scale-95"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            onClick={handleSubmit}
                            className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 shadow-lg shadow-red-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <CornerUpLeft size={16} /> Xác nhận trả
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReturnReasonModal;

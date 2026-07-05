import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { RecordFile } from '../../types';

interface RejectReasonModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: RecordFile | RecordFile[] | null;
    onConfirm: (reason: string) => void;
}

const RejectReasonModal: React.FC<RejectReasonModalProps> = ({ isOpen, onClose, record, onConfirm }) => {
    const [reason, setReason] = useState<string>('');

    if (!isOpen || !record) return null;

    const handleSubmit = () => {
        if (!reason.trim()) {
            return;
        }
        onConfirm(reason.trim());
        setReason('');
    };

    const isArray = Array.isArray(record);
    const recordCode = isArray 
        ? `${record.length} hồ sơ đang chọn`
        : (record as RecordFile).code || (record as RecordFile).receiptNumber || '---';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-65 flex items-center justify-center z-[9999] p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all animate-fade-in-up">
                {/* Header */}
                <div className="bg-red-655 p-4 flex justify-between items-center text-white" style={{ backgroundColor: '#cc1a1a' }}>
                    <h2 className="text-base font-bold flex items-center gap-2">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                        </svg>
                        Trả hồ sơ
                    </h2>
                    <button onClick={onClose} className="text-white hover:text-gray-200 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5">
                    <p className="text-sm font-semibold text-gray-800 mb-1">
                        Xác nhận trả hồ sơ: <span className="text-red-600 font-bold">{recordCode}</span>
                    </p>
                    <p className="text-xs text-gray-500 mb-4">
                        Vui lòng nhập lý do trả hồ sơ để thông báo cho người tiếp nhận/giao việc:
                    </p>

                    <div className="mb-4">
                        <textarea
                            className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[120px] font-medium text-gray-800 placeholder-gray-400 bg-gray-50/50 resize-none"
                            placeholder="Nhập lý do trả tại đây..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            required
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-xs font-bold text-gray-600 transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!reason.trim()}
                            className={`px-5 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${
                                reason.trim() 
                                ? 'bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-100' 
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                            <Check size={14} /> Xác nhận trả
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RejectReasonModal;

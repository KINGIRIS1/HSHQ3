import React, { useState } from 'react';
import { X, RotateCcw, MessageSquare, Info } from 'lucide-react';
import { RecordFile } from '../../types';

interface ReturnStepReasonModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: RecordFile | null;
    onConfirm: (reason: string) => void;
}

const ReturnStepReasonModal: React.FC<ReturnStepReasonModalProps> = ({ isOpen, onClose, record, onConfirm }) => {
    const [reason, setReason] = useState<string>('');

    if (!isOpen || !record) return null;

    const handleSubmit = () => {
        if (!reason.trim()) {
            alert('Vui lòng ghi lý do yêu cầu sửa lại.');
            return;
        }
        onConfirm(reason.trim());
        setReason('');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-fade-in-up">
                <div className="bg-amber-600 p-4 flex justify-between items-center text-white">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <RotateCcw size={20} /> Trả về bước trước sửa chữa
                    </h2>
                    <button onClick={onClose} className="text-white hover:text-gray-200 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 text-amber-800 text-xs font-semibold flex items-start gap-2 leading-relaxed">
                        <Info size={16} className="shrink-0 mt-0.5" />
                        <div>
                            Yêu cầu sửa chữa: Hồ sơ chuyển về trạng thái phân công cán bộ để xử lý, sửa sai hoặc thay thế tệp đo vẽ.
                        </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-4 font-medium">
                        Hồ sơ yêu cầu sửa: <strong className="text-gray-900">{record.code || record.receiptNumber}</strong> - {record.customerName}
                    </p>

                    <div className="mb-4">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <MessageSquare size={14} className="text-amber-500" /> Lý do &amp; Nội dung yêu cầu sửa lại <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[100px] font-medium"
                            placeholder="Ghi nhận xét, chỉnh sửa cụ thể để cán bộ đo đạc/xử lý sửa đổi đúng ý..."
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
                            className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 shadow-lg shadow-amber-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <RotateCcw size={16} /> Gửi yêu cầu sửa
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReturnStepReasonModal;

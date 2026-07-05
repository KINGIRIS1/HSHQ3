
import { useState, useEffect, useMemo, useRef } from 'react';
import { RecordFile, RecordStatus } from '../types';
import { updateRecordApi } from '../services/api';

const REMINDER_INTERVAL = 60000; // Kiểm tra mỗi 1 phút
const REPEAT_HOURS = 2; // Nhắc lại mỗi 2 giờ

export const useReminderSystem = (records: RecordFile[], onUpdateRecord: (r: RecordFile) => void) => {
    const [activeRemindersCount, setActiveRemindersCount] = useState(0);

    // Tính toán số lượng nhắc nhở active (đã đến giờ và chưa hoàn thành)
    useEffect(() => {
        const count = records.filter(r => {
            if (!r.reminderDate) return false;
            // Nếu hồ sơ đã xong hoặc rút thì không tính là active reminder
            if (r.status === RecordStatus.HANDOVER || r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.REJECTED) return false;
            
            const reminderTime = new Date(r.reminderDate).getTime();
            const now = Date.now();
            return reminderTime <= now;
        }).length;
        setActiveRemindersCount(count);
    }, [records]);

    // Dùng ref để tránh việc effect chạy lại mỗi khi records thay đổi
    const recordsRef = useRef(records);
    useEffect(() => {
        recordsRef.current = records;
    }, [records]);

    // Cập nhật ref cho onUpdateRecord để tránh khởi động lại useEffect liên tục
    const onUpdateRef = useRef(onUpdateRecord);
    useEffect(() => {
        onUpdateRef.current = onUpdateRecord;
    }, [onUpdateRecord]);

    // Set lưu trữ các id đã nhắc nhở trong phiên này để tránh phụ thuộc hoàn toàn vào DB (đề phòng thiếu cột)
    const remindedIds = useRef<Set<string>>(new Set());

    // Logic Polling để bắn thông báo
    useEffect(() => {
        let isCancelled = false;

        const checkReminders = async () => {
            if (isCancelled) return;
            const now = Date.now();
            
            for (const r of recordsRef.current) {
                if (isCancelled) break;
                if (!r.reminderDate) continue;
                
                // Bỏ qua nếu hồ sơ đã xong
                if (r.status === RecordStatus.HANDOVER || r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.REJECTED) continue;

                const reminderTime = new Date(r.reminderDate).getTime();
                
                // Nếu chưa đến giờ thì bỏ qua
                if (reminderTime > now) continue;

                // Kiểm tra điều kiện nhắc lại (2 tiếng)
                let shouldNotify = false;
                if (!r.lastRemindedAt) {
                    // Nếu chưa nhắc trong DB, kiểm tra xem phiên này đã nhắc chưa
                    if (!remindedIds.current.has(r.id)) {
                        shouldNotify = true;
                    }
                } else {
                    const lastRemindedTime = new Date(r.lastRemindedAt).getTime();
                    const hoursDiff = (now - lastRemindedTime) / (1000 * 60 * 60);
                    if (hoursDiff >= REPEAT_HOURS && !remindedIds.current.has(r.id)) {
                        shouldNotify = true;
                    }
                }

                if (shouldNotify) {
                    remindedIds.current.add(r.id);
                    
                    // Trigger Notification
                    if (window.electronAPI && window.electronAPI.showNotification) {
                        window.electronAPI.showNotification(
                            `Nhắc nhở hồ sơ: ${r.code}`,
                            `Đã đến hạn xử lý cho khách hàng: ${r.customerName}. Vui lòng kiểm tra!`
                        );
                    } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                        new Notification(`Nhắc nhở hồ sơ: ${r.code}`, {
                            body: `Đã đến hạn xử lý cho khách hàng: ${r.customerName}.`
                        });
                    }

                    // Cập nhật lastRemindedAt để không spam
                    const updatedRecord = { ...r, lastRemindedAt: new Date().toISOString() };
                    // Gọi update local trước thông qua ref để luôn lấy hàm mới nhất
                    onUpdateRef.current(updatedRecord);
                    // Cập nhật recordsRef ngay để tránh vòng lặp
                    recordsRef.current = recordsRef.current.map(rec => rec.id === updatedRecord.id ? updatedRecord : rec);
                    
                    // Gọi API update DB
                    try {
                        await updateRecordApi(updatedRecord);
                    } catch (err) {
                        console.error('Failed to update reminder state', err);
                    }
                    
                    // Xóa id khỏi set sau 2 tiếng để cho phép nhắc lại (nếu DB thực sự không lưu được)
                    setTimeout(() => {
                        remindedIds.current.delete(r.id);
                    }, REPEAT_HOURS * 60 * 60 * 1000);
                }
            }
        };

        const intervalId = setInterval(checkReminders, REMINDER_INTERVAL);

        return () => {
            isCancelled = true;
            clearInterval(intervalId);
        };
    }, []); // Xóa onUpdateRecord khỏi dependency để không bị loop vô tận

    return { activeRemindersCount };
};

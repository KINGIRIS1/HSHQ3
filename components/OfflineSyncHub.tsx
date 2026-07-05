import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw, Download, Trash2, AlertCircle, CheckCircle, Clock, Database, Globe, X, FileText } from 'lucide-react';
import { getOfflineQueue, removeOfflineAction, saveOfflineQueue, clearOfflineQueue, OfflineAction } from '../utils/offlineSync';
import { createRecordApi, updateRecordApi, deleteRecordApi } from '../services/apiRecords';
import { createContractApi, updateContractApi, deleteContractApi } from '../services/apiContracts';

interface OfflineSyncHubProps {
    connectionStatus: 'connected' | 'offline';
    onSyncSuccess?: () => Promise<void>;
}

export const OfflineSyncHub: React.FC<OfflineSyncHubProps> = ({ connectionStatus, onSyncSuccess }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [queue, setQueue] = useState<OfflineAction[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
    const [syncMessage, setSyncMessage] = useState<string | null>(null);
    const [isInternalOnline, setIsInternalOnline] = useState(navigator.onLine);

    // Monitor local storage changes to keep queue updated
    const refreshQueue = () => {
        setQueue(getOfflineQueue());
    };

    useEffect(() => {
        refreshQueue();

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'offline_sync_queue') {
                refreshQueue();
            }
        };

        const handleOnlineStatus = () => {
            const online = navigator.onLine;
            setIsInternalOnline(online);
            if (online) {
                // Auto trigger sync on reconnect
                autoSync();
            }
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('online', handleOnlineStatus);
        window.addEventListener('offline', handleOnlineStatus);

        // Periodically refresh state
        const interval = setInterval(refreshQueue, 3000);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('online', handleOnlineStatus);
            window.removeEventListener('offline', handleOnlineStatus);
            clearInterval(interval);
        };
    }, []);

    // Monitor when connection status changes from prop
    useEffect(() => {
        if (connectionStatus === 'connected' && getOfflineQueue().length > 0) {
            autoSync();
        }
    }, [connectionStatus]);

    const autoSync = async () => {
        if (getOfflineQueue().length > 0 && !isSyncing && navigator.onLine) {
            await handleSyncAll();
        }
    };

    const handleSyncAll = async () => {
        const currentQueue = getOfflineQueue();
        if (currentQueue.length === 0) return;

        setIsSyncing(true);
        setSyncProgress({ current: 0, total: currentQueue.length });
        setSyncMessage('Đang chuẩn bị đồng bộ hóa...');

        const failedItems: OfflineAction[] = [];
        let successCount = 0;

        for (let i = 0; i < currentQueue.length; i++) {
            const item = currentQueue[i];
            setSyncProgress({ current: i + 1, total: currentQueue.length });
            setSyncMessage(`Đang đồng bộ: ${item.description}...`);

            // Biến kiểm tra thành công cho hành động hiện tại
            let itemSuccess = false;

            try {
                switch (item.action) {
                    case 'create_record': {
                        const res = await createRecordApi(item.data);
                        if (res) itemSuccess = true;
                        break;
                    }
                    case 'update_record': {
                        const res = await updateRecordApi(item.data);
                        if (res) itemSuccess = true;
                        break;
                    }
                    case 'delete_record': {
                        const res = await deleteRecordApi(item.data.id);
                        if (res) itemSuccess = true;
                        break;
                    }
                    case 'create_contract': {
                        const res = await createContractApi(item.data);
                        if (res) itemSuccess = true;
                        break;
                    }
                    case 'update_contract': {
                        const res = await updateContractApi(item.data);
                        if (res) itemSuccess = true;
                        break;
                    }
                    case 'delete_contract': {
                        const res = await deleteContractApi(item.data.id);
                        if (res) itemSuccess = true;
                        break;
                    }
                    default:
                        itemSuccess = true; // Bỏ qua actions không được hỗ trợ
                        break;
                }
            } catch (err: any) {
                console.error(`Sync error on item ${item.id}:`, err);
                item.errorMessage = err?.message || 'Lỗi mạng không xác định';
            }

            if (itemSuccess) {
                successCount++;
                removeOfflineAction(item.id);
            } else {
                item.status = 'failed';
                failedItems.push(item);
            }
        }

        // Cập nhật lại queue các items lỗi
        if (failedItems.length > 0) {
            const remaining = getOfflineQueue();
            const remapped = remaining.map(item => {
                const failed = failedItems.find(f => f.id === item.id);
                return failed ? failed : item;
            });
            saveOfflineQueue(remapped);
        }

        setIsSyncing(false);
        setSyncMessage(null);
        refreshQueue();

        if (successCount > 0 && onSyncSuccess) {
            await onSyncSuccess();
        }

        if (successCount > 0) {
            alert(`Đã đồng bộ thành công ${successCount} dữ liệu ngoại tuyến lên hệ thống chủ!`);
        }
    };

    const handleDownloadBackup = () => {
        try {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(queue, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            const dateStr = new Date().toISOString().slice(0, 10);
            downloadAnchor.setAttribute("download", `Sao_luu_Ngoai_tuyen_${dateStr}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        } catch (e) {
            alert('Không thể tạo file sao lưu: ' + e);
        }
    };

    const handleClearAll = () => {
        if (window.confirm('CẢNH BÁO: Bạn có chắc muốn xóa bỏ toàn bộ hàng đợi ngoại tuyến? Các thao tác chưa đồng bộ sẽ bị mất vĩnh viễn.')) {
            clearOfflineQueue();
            refreshQueue();
        }
    };

    const currentStatus = isInternalOnline && connectionStatus === 'connected' ? 'online' : 'offline';
    const hasPendingChanges = queue.length > 0;

    return (
        <>
            {/* WRAPPER BADGE ON THE HEADER */}
            <div className="relative flex items-center shrink-0">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border outline-none cursor-pointer select-none active:scale-95 shadow-sm ${
                        currentStatus === 'offline'
                            ? 'bg-red-500/10 hover:bg-red-500/20 text-red-100 border-red-500/50 hover:border-red-400'
                            : hasPendingChanges
                            ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border-amber-500/50 hover:border-amber-400/80 animate-pulse'
                            : 'bg-green-500/10 hover:bg-green-500/15 text-green-200 border-green-500/40 hover:border-green-400'
                    }`}
                >
                    <span className="relative flex h-2.5 w-2.5">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                            currentStatus === 'offline' ? 'bg-red-400' : hasPendingChanges ? 'bg-amber-400' : 'bg-green-400'
                        }`}></span>
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                            currentStatus === 'offline' ? 'bg-red-500' : hasPendingChanges ? 'bg-amber-500' : 'bg-green-500'
                        }`}></span>
                    </span>
                    
                    <span className="hidden sm:inline">
                        {currentStatus === 'offline'
                            ? 'Mất mạng'
                            : hasPendingChanges
                            ? `${queue.length} Chờ đồng bộ`
                            : 'Đã kết nối'}
                    </span>
                    
                    {currentStatus === 'offline' ? (
                        <WifiOff size={14} className="opacity-90" />
                    ) : (
                        <Wifi size={14} className="opacity-95" />
                    )}
                </button>

                {/* SLIDE OUT CONSOLE DRAWER */}
                {isOpen && (
                    <>
                        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[99]" onClick={() => setIsOpen(false)}></div>
                        <div className="absolute top-12 right-0 w-96 bg-slate-900 text-slate-100 rounded-2xl shadow-2xl border border-slate-800 p-5 z-[100] flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-200 origin-top-right select-text">
                            
                            {/* Drawer Header */}
                            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                <div className="flex items-center gap-2">
                                    <Database className="text-blue-400" size={18} />
                                    <h3 className="font-bold text-sm text-slate-200">Trình quản lý Đồng bộ Ngoại tuyến</h3>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="text-slate-400 hover:text-white hover:bg-slate-800 p-1 rounded-lg transition-colors cursor-pointer"
                                >
                                    <span className="text-xs font-bold px-1.5 py-0.5 bg-slate-800 rounded">Esc</span>
                                </button>
                            </div>

                            {/* Status Segment */}
                            <div className={`p-3 rounded-xl border flex flex-col gap-1.5 ${
                                currentStatus === 'offline'
                                    ? 'bg-red-500/10 border-red-500/30 text-red-200'
                                    : hasPendingChanges
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                                    : 'bg-green-500/10 border-green-500/30 text-green-200'
                            }`}>
                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                                    {currentStatus === 'offline' ? (
                                        <>
                                            <WifiOff size={15} />
                                            <span>Mất kết nối mạng Internet</span>
                                        </>
                                    ) : hasPendingChanges ? (
                                        <>
                                            <RefreshCw className="animate-spin" size={15} />
                                            <span>Có dữ liệu cần gửi lên máy chủ</span>
                                        </>
                                    ) : (
                                        <>
                                            <Globe size={15} />
                                            <span>Mạng ổn định - Trực tuyến</span>
                                        </>
                                    )}
                                </div>
                                <p className="text-xs text-slate-300 font-light mt-1">
                                    {currentStatus === 'offline'
                                        ? 'Hệ thống đã tự động chuyển sang chế độ dự phòng ngoại tuyến. Bạn có thể tiếp tục tạo hợp đồng, in ấn, thêm hồ sơ bình thường. KHÔNG được tải lại trang (F5).'
                                        : hasPendingChanges
                                        ? `Đang có ${queue.length} thao tác bạn đã thực hiện ngoại tuyến cần đồng bộ hóa lên cơ sở dữ liệu.`
                                        : 'Tất cả thay đổi đã được lưu trữ an toàn trên dịch vụ đám mây.'}
                                </p>
                            </div>

                            {/* Operations List Queue */}
                            <div className="flex flex-col gap-2">
                                <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase">Thao tác ngoại tuyến ({queue.length})</span>
                                <div className="max-h-48 overflow-y-auto border border-slate-800 bg-slate-950/50 rounded-xl p-2 flex flex-col gap-1.5 divide-y divide-slate-900 custom-scrollbar">
                                    {queue.length === 0 ? (
                                        <div className="text-center py-7 text-xs text-slate-500 flex flex-col items-center gap-1.5">
                                            <CheckCircle size={22} className="text-slate-600" />
                                            <span>Không có thay đổi nào cần đồng bộ.</span>
                                        </div>
                                    ) : (
                                        queue.map((item, index) => (
                                            <div key={item.id} className="pt-2 first:pt-0 flex items-start gap-2 text-xs hover:bg-slate-800/25 p-1 rounded-md transition-colors">
                                                <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800 mt-0.5 shrink-0 text-slate-400">
                                                    <Clock size={12} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-slate-200 truncate">{item.description}</p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-800 text-blue-400 px-1 py-0.5 rounded border border-slate-700/50">
                                                            {item.action}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 font-mono">
                                                            {new Date(item.timestamp).toLocaleTimeString()}
                                                        </span>
                                                    </div>
                                                    {item.status === 'failed' && (
                                                        <p className="text-[10px] text-red-400 mt-0.5 flex items-center gap-1 truncate font-medium">
                                                            <AlertCircle size={10} /> Sync failed: {item.errorMessage || 'Lỗi mạng'}
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        removeOfflineAction(item.id);
                                                        refreshQueue();
                                                    }}
                                                    className="text-slate-500 hover:text-red-400 hover:bg-slate-900 rounded p-1 transition-colors self-center cursor-pointer"
                                                    title="Xóa thao tác này"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Sync Status / Progress Indicator */}
                            {isSyncing && (
                                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
                                    <div className="flex items-center justify-between text-xs font-semibold">
                                        <span className="text-slate-300 truncate">{syncMessage}</span>
                                        <span className="text-blue-400 font-mono font-bold shrink-0">{syncProgress.current}/{syncProgress.total}</span>
                                    </div>
                                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 rounded-full transition-all duration-300"
                                            style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}

                            {/* Control Buttons */}
                            <div className="grid grid-cols-2 gap-2 mt-1 pt-3 border-t border-slate-800">
                                <button
                                    onClick={handleDownloadBackup}
                                    disabled={queue.length === 0}
                                    className="px-3 py-2 text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-xl border border-slate-700 hover:border-slate-600 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                                    title="Tải về file dự phòng các thay đổi ngoại tuyến"
                                >
                                    <Download size={14} />
                                    Tải bản sao lưu
                                </button>
                                
                                <button
                                    onClick={handleSyncAll}
                                    disabled={isSyncing || queue.length === 0 || connectionStatus === 'offline'}
                                    className={`px-3 py-2 text-xs font-bold text-white rounded-xl border transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none cursor-pointer ${
                                        connectionStatus === 'offline'
                                            ? 'bg-slate-800 border-slate-700 text-slate-500'
                                            : 'bg-blue-600 hover:bg-blue-500 border-blue-500 hover:border-blue-400 shadow-lg shadow-blue-500/25'
                                    }`}
                                >
                                    <RefreshCw className={isSyncing ? 'animate-spin' : ''} size={14} />
                                    Đồng bộ ngay
                                </button>
                            </div>

                            {queue.length > 0 && (
                                <button
                                    onClick={handleClearAll}
                                    className="w-full mt-1 text-center py-1.5 text-[11px] font-bold text-red-400/90 hover:text-red-400 hover:bg-red-500/5 border border-transparent hover:border-red-500/10 rounded-lg transition-all flex items-center justify-center gap-1 shrink-0 cursor-pointer"
                                >
                                    <Trash2 size={11} />
                                    Xóa sạch hàng đợi chưa gửi
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </>
    );
};

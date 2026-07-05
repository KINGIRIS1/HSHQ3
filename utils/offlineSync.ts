export interface OfflineAction {
    id: string;
    action: 'create_record' | 'update_record' | 'delete_record' | 'create_contract' | 'update_contract' | 'delete_contract' | 'update_prices';
    data: any;
    timestamp: string;
    description: string;
    status: 'pending' | 'syncing' | 'failed' | 'success';
    errorMessage?: string;
}

const STORAGE_KEY = 'offline_sync_queue';

export const getOfflineQueue = (): OfflineAction[] => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Error reading offline queue:', e);
        return [];
    }
};

export const saveOfflineQueue = (queue: OfflineAction[]) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (e) {
        console.error('Error saving offline queue:', e);
    }
};

export const addToOfflineQueue = (
    action: OfflineAction['action'],
    data: any,
    description: string
): OfflineAction => {
    const queue = getOfflineQueue();
    const newItem: OfflineAction = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
        action,
        data,
        timestamp: new Date().toISOString(),
        description,
        status: 'pending'
    };
    
    // Tránh trùng lặp các hành động giống hệt nhau (ví dụ bấm lưu 2 lần liên tiếp khi đơ)
    const isDuplicate = queue.some(item => 
        item.action === action && 
        JSON.stringify(item.data) === JSON.stringify(data)
    );

    if (!isDuplicate) {
        queue.push(newItem);
        saveOfflineQueue(queue);
    }
    
    return newItem;
};

export const updateOfflineActionStatus = (
    id: string,
    status: OfflineAction['status'],
    errorMessage?: string
) => {
    const queue = getOfflineQueue();
    const updated = queue.map(item => 
        item.id === id ? { ...item, status, errorMessage } : item
    );
    saveOfflineQueue(updated);
};

export const removeOfflineAction = (id: string) => {
    const queue = getOfflineQueue();
    const filtered = queue.filter(item => item.id !== id);
    saveOfflineQueue(filtered);
};

export const clearOfflineQueue = () => {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.error('Error clearing offline queue:', e);
    }
};

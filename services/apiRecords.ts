
import { supabase, isConfigured } from './supabaseClient';
import { RecordFile } from '../types';
import { MOCK_RECORDS, API_BASE_URL } from '../constants';
import { logError, getFromCache, saveToCache, CACHE_KEYS, sanitizeData, normalizeCode, mapRecordFromDb, getDbColumns, mapPayloadToDb } from './apiCore';

export const RECORD_DB_COLUMNS = [
    'id', 'code', 'customerName', 'phoneNumber', 'cccd', 'customerAddress', 'ward', 'landPlot', 'mapSheet', 
    'area', 'address', 'group', 'content', 'recordType', 'receivedDate', 'receivedBy', 'deadline', 
    'assignedDate', 'submissionDate', 'approvalDate', 'completedDate', 'status', 'assignedTo', 'submittedTo', 'checkedBy',
    'pendingCheckDate', 'checkedDate', 'completedWorkDate',
    'notes', 'privateNotes', 'personalNotes', 
    'authorizedBy', 'authDocType', 'otherDocs', 'exportBatch', 'exportDate', 'handoverWard',
    'measurementNumber', 'excerptNumber',
    'reminderDate', 'lastRemindedAt',
    'receiptNumber', 'resultReturnedDate', 'receiverName', 'receiptType', 'paymentAmount', 'receiptPhoto',
    'needsMapCorrection',
    'issueNumber', 'entryNumber', 'issueDate', 'residentialArea',
    'clnArea', 'bhkArea', 'lucArea', 'otherLandArea',
    'price', 'advancePayment', 'isDeptSynced',
    'hasDefect', 'defectReason', 'defectDate',
    'rejectReason', 'rejectDate'
];

export const OPTIONAL_NEW_COLUMNS = [
    'customerAddress', 'issueNumber', 'entryNumber', 'issueDate', 'residentialArea',
    'clnArea', 'bhkArea', 'lucArea', 'otherLandArea',
    'needsMapCorrection', 'receiptNumber', 'resultReturnedDate', 'receiverName', 'receiptType', 'paymentAmount', 'receiptPhoto',
    'reminderDate', 'lastRemindedAt', 'measurementNumber', 'excerptNumber',
    'authorizedBy', 'authDocType', 'otherDocs',
    'privateNotes', 'personalNotes', 'checkedBy', 'pendingCheckDate', 'checkedDate', 'completedWorkDate',
    'price', 'advancePayment', 'isDeptSynced',
    'hasDefect', 'defectReason', 'defectDate',
    'submittedTo', 'submissionDate', 'rejectReason', 'rejectDate'
];

export const fetchRecords = async (): Promise<RecordFile[]> => {
  if (!isConfigured) {
      console.warn("Supabase chưa được cấu hình. Đang dùng dữ liệu Cache/Mock.");
      return getFromCache(CACHE_KEYS.RECORDS, MOCK_RECORDS);
  }

  try {
    let allRecords: any[] = [];
    const actualColumns = await getDbColumns('land_records');
    const hasUpdatedAt = actualColumns.some(col => col.toLowerCase() === 'updated_at' || col.toLowerCase() === 'updatedat');
    const cachedRecords = getFromCache<RecordFile[]>(CACHE_KEYS.RECORDS, []);
    
    let lastSync = typeof window !== 'undefined' ? localStorage.getItem('last_sync_records') : null;
    
    if (hasUpdatedAt && cachedRecords.length > 0 && lastSync) {
        console.log(`[Sync] Performing incremental sync since ${lastSync}...`);
        const colName = actualColumns.find(col => col.toLowerCase() === 'updated_at' || col.toLowerCase() === 'updatedat') || 'updated_at';
        
        try {
            const { data, error } = await supabase
                .from('land_records')
                .select('*')
                .gt(colName, lastSync);
                
            if (error) throw error;
            
            if (data && data.length > 0) {
                console.log(`[Sync] Found ${data.length} updated records since last sync.`);
                const mergedMap = new Map();
                cachedRecords.forEach((r: any) => {
                    if (r.id) mergedMap.set(r.id, r);
                });
                data.forEach((item: any) => {
                    if (item.id) {
                        mergedMap.set(item.id, mapRecordFromDb(item));
                    }
                });
                const mergedRecords = Array.from(mergedMap.values());
                
                // Sort by receivedDate descending, then ID ascending
                mergedRecords.sort((a, b) => {
                    const dateA = a.receivedDate ? new Date(a.receivedDate).getTime() : 0;
                    const dateB = b.receivedDate ? new Date(b.receivedDate).getTime() : 0;
                    if (dateA !== dateB) return dateB - dateA;
                    return String(a.id).localeCompare(String(b.id));
                });
                
                if (typeof window !== 'undefined') {
                    localStorage.setItem('last_sync_records', new Date().toISOString());
                }
                saveToCache(CACHE_KEYS.RECORDS, mergedRecords);
                return mergedRecords;
            } else {
                console.log(`[Sync] No new or updated records found since last sync.`);
                return cachedRecords;
            }
        } catch (syncErr) {
            console.warn("Incremental sync failed, falling back to full fetch:", syncErr);
        }
    }

    let from = 0;
    const step = 1000;
    let hasMore = true;
    let retryCount = 0;
    const maxRetries = 1;

    while (hasMore) {
        try {
            const { data, error } = await supabase
                .from('land_records')
                .select('*')
                .order('receivedDate', { ascending: false })
                .order('id', { ascending: true }) 
                .range(from, from + step - 1);

            if (error) throw error;

            if (data && data.length > 0) {
                allRecords = [...allRecords, ...data];
                from += step;
                if (data.length < step) hasMore = false;
            } else {
                hasMore = false;
            }
        } catch (fetchError: any) {
            if (retryCount < maxRetries && (fetchError.message?.includes('fetch') || !fetchError.code)) {
                console.warn(`Lỗi fetchRecords, đang thử lại lần ${retryCount + 1}...`);
                retryCount++;
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue; 
            }
            throw fetchError;
        }
    }
    
    const uniqueMap = new Map();
    allRecords.forEach((item: any) => {
        if (item.id) {
            uniqueMap.set(item.id, mapRecordFromDb(item));
        }
    });
    const uniqueRecords = Array.from(uniqueMap.values());
    
    console.log(`[Fetch] Total fetched: ${uniqueRecords.length}`);
    if (typeof window !== 'undefined') {
        localStorage.setItem('last_sync_records', new Date().toISOString());
    }
    saveToCache(CACHE_KEYS.RECORDS, uniqueRecords);
    return uniqueRecords as RecordFile[];

  } catch (error) {
    logError("fetchRecords", error);
    return getFromCache(CACHE_KEYS.RECORDS, MOCK_RECORDS);
  }
};

export const getShortCode = (ward: string) => {
    const normalized = ward.toLowerCase().trim();
    const cleanName = normalized
        .replace(/^(xã|phường|thị trấn|tt\.|p\.|x\.)\s+/g, '')
        .replace(/\s+(xã|phường|thị trấn)\s+/g, ' ');

    if (cleanName.includes('tân khai') || cleanName.includes('tankhai')) return 'TK';
    if (cleanName.includes('tân hưng') || cleanName.includes('tanhung')) return 'TH';
    if (cleanName.includes('minh đức') || cleanName.includes('minhduc')) return 'MĐ';
    if (cleanName.includes('tân quan') || cleanName.includes('tanquan')) return 'TQ';

    if (cleanName.includes('minh hưng') || cleanName.includes('minhhung')) return 'MH';
    if (cleanName.includes('chơn thành') || cleanName.includes('chonthanh') || cleanName.includes('hưng long')) return 'CT';
    if (cleanName.includes('nha bích') || cleanName.includes('nhabich')) return 'NB';
    if (cleanName.includes('minh lập') || cleanName.includes('minhlap')) return 'ML';
    if (cleanName.includes('minh thắng') || cleanName.includes('minhthang')) return 'MT';
    if (cleanName.includes('quang minh') || cleanName.includes('quangminh')) return 'QM';
    if (cleanName.includes('thành tâm') || cleanName.includes('thanhtam')) return 'TT';
    if (cleanName.includes('minh long') || cleanName.includes('minhlong')) return 'MLO';
    
    return 'CT';
};

// Keep track of the highest generated sequence number for each datePrefix in the current execution/session
const sessionSequenceMap = new Map<string, number>();

export const getNextGlobalRecordCode = async (dateStr: string, wardName?: string): Promise<string> => {
    const d = new Date(dateStr);
    const yy = d.getFullYear().toString().slice(-2);
    const mm = ('0' + (d.getMonth() + 1)).slice(-2);
    const dd = ('0' + d.getDate()).slice(-2);
    const datePrefix = `${yy}${mm}${dd}`;
    const prefix = datePrefix;

    let suffix = '';
    if (wardName) {
        const abbr = getShortCode(wardName);
        if (abbr && abbr !== 'CT') {
            suffix = abbr;
        }
    }

    if (!isConfigured) {
        return `${prefix}-${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}${suffix}`;
    }

    // 1. Quét DB thực tế tìm số thứ tự lớn nhất đang tồn tại của ngày này (chống lệch bộ đếm do import Excel)
    let maxDbSeq = 0;
    try {
        const { data: dbRecords, error: dbError } = await supabase
            .from('land_records')
            .select('code')
            .like('code', `${prefix}-%`);
            
        if (!dbError && dbRecords) {
            for (const r of dbRecords) {
                if (r.code) {
                    const match = r.code.match(/-(\d+)/);
                    if (match) {
                        const seq = parseInt(match[1], 10);
                        if (!isNaN(seq) && seq > maxDbSeq) {
                            maxDbSeq = seq;
                        }
                    }
                }
            }
        }
    } catch (dbErr) {
        console.error("Lỗi khi tìm mã hồ sơ lớn nhất thực tế:", dbErr);
    }

    // Dùng key theo ngày để số thứ tự reset về 0001 mỗi ngày và tăng tuần tự một cách đồng bộ
    const key = `record_counter_${datePrefix}`;
    let currentVal = 0;
    try {
        const { data } = await supabase.from('system_settings').select('value').eq('key', key).single();
        if (data && data.value) {
            currentVal = parseInt(data.value, 10);
            if (isNaN(currentVal)) currentVal = 0;
        }
    } catch (e) {
        // ignore
    }

    const cachedSeq = sessionSequenceMap.get(datePrefix) || 0;
    const baseVal = Math.max(currentVal, maxDbSeq, cachedSeq);
    const nextSeq = baseVal + 1;

    // Cập nhật session cache
    sessionSequenceMap.set(datePrefix, nextSeq);

    // Cập nhật lên cloud
    try {
        const { data: existing } = await supabase.from('system_settings').select('key').eq('key', key).single();
        if (existing) {
            await supabase.from('system_settings').update({ value: nextSeq.toString() }).eq('key', key);
        } else {
            await supabase.from('system_settings').insert([{ key, value: nextSeq.toString() }]);
        }
    } catch (dbErr) {
        console.error("Lỗi khi lưu counter vào system_settings:", dbErr);
    }

    const seqStr = nextSeq.toString().padStart(4, '0');
    return `${prefix}-${seqStr}${suffix}`;
};

export const createRecordApi = async (record: RecordFile): Promise<RecordFile | null> => {
    if (!isConfigured) return record;
    try {
        let finalCode = record.code?.trim() || '';
        
        // 1. Kiểm tra xem mã này đã tồn tại trong cơ sở dữ liệu chưa (để tránh trùng lặp)
        let isDuplicate = false;
        if (finalCode && !finalCode.includes('?')) {
            const { data: existing, error: checkError } = await supabase
                .from('land_records')
                .select('id')
                .eq('code', finalCode)
                .limit(1);
            if (!checkError && existing && existing.length > 0) {
                isDuplicate = true;
            }
        }

        // 2. Nếu mã trống, nháp (chứa '?') hoặc bị trùng lặp, tự động tạo mã mới duy nhất
        if (!finalCode || finalCode.includes('?') || isDuplicate) {
            finalCode = await getNextGlobalRecordCode(record.receivedDate || new Date().toISOString(), record.ward || undefined);
            
            // Chạy kiểm tra sanity check tăng cường để đảm bảo mã mới sinh ra không trùng lặp
            let isUnique = false;
            let checkAttempts = 0;
            while (!isUnique && checkAttempts < 5) {
                const { data: checkExist } = await supabase
                    .from('land_records')
                    .select('id')
                    .eq('code', finalCode)
                    .limit(1);
                
                if (checkExist && checkExist.length > 0) {
                    checkAttempts++;
                    finalCode = await getNextGlobalRecordCode(record.receivedDate || new Date().toISOString(), record.ward || undefined);
                } else {
                    isUnique = true;
                }
            }
        }
        
        const recordToSave = { ...record, code: finalCode };
        if (!recordToSave.id) {
            recordToSave.id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9);
        }
        
        const payload = sanitizeData(recordToSave, RECORD_DB_COLUMNS);
        const actualCols = await getDbColumns('land_records');
        const dbPayload = mapPayloadToDb(payload, actualCols);
        const { data, error } = await supabase.from('land_records').insert([dbPayload]).select();
        
        if (error && (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist')))) {
            console.warn("⚠️ [Fallback] Database is missing columns. Retrying without new columns...", error);
            const fallbackPayload = { ...payload };
            OPTIONAL_NEW_COLUMNS.forEach(col => delete fallbackPayload[col]);
            const { data: fallbackData, error: fallbackError } = await supabase.from('land_records').insert([fallbackPayload]).select();
            if (fallbackError) {
                logError("createRecordApi (Fallback)", fallbackError);
                throw fallbackError;
            }
            return mapRecordFromDb({ ...recordToSave, ...(fallbackData?.[0] || {}) }) as RecordFile;
        }
        
        if (error) throw error;
        return mapRecordFromDb(data?.[0]) as RecordFile;
    } catch (error) {
        logError("createRecordApi", error);
        return null;
    }
};

export const updateRecordApi = async (record: RecordFile): Promise<RecordFile | null> => {
    if (!isConfigured) return record;
    try {
        const payload = sanitizeData(record, RECORD_DB_COLUMNS);
        const actualCols = await getDbColumns('land_records');
        const dbPayload = mapPayloadToDb(payload, actualCols);
        const { data, error } = await supabase.from('land_records').update(dbPayload).eq('id', record.id).select();
        
        if (error && (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist')))) {
            console.warn("⚠️ [Fallback] Database is missing columns. Retrying without new columns...", error);
            const fallbackPayload = { ...payload };
            OPTIONAL_NEW_COLUMNS.forEach(col => delete fallbackPayload[col]);
            const { data: fallbackData, error: fallbackError } = await supabase.from('land_records').update(fallbackPayload).eq('id', record.id).select();
            if (fallbackError) {
                logError("updateRecordApi (Fallback)", fallbackError);
                throw fallbackError;
            }
            return mapRecordFromDb({ ...record, ...(fallbackData?.[0] || {}) }) as RecordFile;
        }
        
        if (error) throw error;
        return mapRecordFromDb(data?.[0]) as RecordFile;
    } catch (error) {
        logError("updateRecordApi", error);
        return null;
    }
};

export const deleteRecordApi = async (id: string): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const { error } = await supabase.from('land_records').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteRecordApi", error);
        return false;
    }
};

export const createRecordsBatchApi = async (records: RecordFile[], onProgress?: (processed: number, total: number) => void): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const payload = [];
        for (const r of records) {
            let finalCode = r.code;
            
            // Chỉ tạo mới code tự động nếu như mã bị thiếu hoặc có chứa dấu '?' (mã nháp)
            // KHÔNG GHI ĐÈ các mã có định dạng chuẩn (isGeneratedFormat) vì đây là data từ Excel đưa vào
            if (!finalCode || finalCode.includes('?') || finalCode.trim() === '') {
                finalCode = await getNextGlobalRecordCode(r.receivedDate || new Date().toISOString(), r.ward || undefined);
            }
            
            const recordPayload = { ...r, code: finalCode };
            if (!recordPayload.id) {
                recordPayload.id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9);
            }
            
            payload.push(sanitizeData(recordPayload, RECORD_DB_COLUMNS));
        }

        const actualCols = await getDbColumns('land_records');
        const CHUNK_SIZE = 500;
        for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
            const chunk = payload.slice(i, i + CHUNK_SIZE).map(p => mapPayloadToDb(p, actualCols));
            const { error } = await supabase.from('land_records').insert(chunk);
            
            if (error && (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist')))) {
                console.warn(`⚠️ [Fallback] Database is missing columns. Retrying batch insert chunk ${i} without new columns...`, error);
                const fallbackPayload = chunk.map(p => {
                    const fp = { ...p };
                    OPTIONAL_NEW_COLUMNS.forEach(col => delete fp[col]);
                    return fp;
                });
                const { error: fallbackError } = await supabase.from('land_records').insert(fallbackPayload);
                if (fallbackError) {
                    logError("createRecordsBatchApi (Fallback)", fallbackError);
                    throw fallbackError;
                }
            } else if (error) {
                throw error;
            }
            
            if (onProgress) {
                onProgress(Math.min(i + CHUNK_SIZE, payload.length), payload.length);
            }
        }
        
        return true;
    } catch (error) {
        logError("createRecordsBatchApi", error);
        return false;
    }
};

export const forceUpdateRecordsBatchApi = async (records: RecordFile[], onProgress?: (processed: number, total: number) => void): Promise<{ success: boolean, count: number }> => {
    if (!isConfigured) return { success: true, count: 0 };
    
    const isSupabase = API_BASE_URL.includes('supabase.co');
    if (!isSupabase) {
        return { success: true, count: 0 };
    }

    // Helper tạo danh sách biến thể mã hồ sơ phong phú để truy vấn DB chính xác nhất
    const getCodeSearchVariants = (code: string): string[] => {
        if (!code) return [];
        const clean = code.trim();
        const variants = new Set<string>();
        
        variants.add(clean);
        variants.add(clean.toLowerCase());
        variants.add(clean.toUpperCase());
        
        // Gỡ tất cả khoảng trắng
        const noSpaces = clean.replace(/\s+/g, '');
        variants.add(noSpaces);
        variants.add(noSpaces.toLowerCase());
        variants.add(noSpaces.toUpperCase());

        // Xử lý dấu gạch ngang
        if (clean.includes('-')) {
            const parts = clean.split('-');
            const withSpaces = parts.map(p => p.trim()).join(' - ');
            variants.add(withSpaces);
            variants.add(withSpaces.toLowerCase());
            variants.add(withSpaces.toUpperCase());
            
            const spaceInstead = parts.map(p => p.trim()).join(' ');
            variants.add(spaceInstead);
            variants.add(spaceInstead.toLowerCase());
            variants.add(spaceInstead.toUpperCase());
        } else {
            // Chèn dấu gạch ngang nếu là định dạng HS123 -> HS-123
            const match = clean.match(/^([A-Za-z]+)(\d+)$/);
            if (match) {
                const withDash = `${match[1]}-${match[2]}`;
                variants.add(withDash);
                variants.add(withDash.toLowerCase());
                variants.add(withDash.toUpperCase());

                const withDashSpaces = `${match[1]} - ${match[2]}`;
                variants.add(withDashSpaces);
                variants.add(withDashSpaces.toLowerCase());
                variants.add(withDashSpaces.toUpperCase());
            }

            if (clean.includes(' ')) {
                const withDash = clean.replace(/\s+/g, '-');
                variants.add(withDash);
                variants.add(withDash.toLowerCase());
                variants.add(withDash.toUpperCase());
            }
        }

        return Array.from(variants);
    };

    try {
        const actualCols = await getDbColumns('land_records');
        const rawCodes = records.map(r => r.code).filter(c => c);
        if (rawCodes.length === 0) return { success: true, count: 0 };

        let updateCount = 0;
        const CHUNK_SIZE = 500;

        for (let i = 0; i < records.length; i += CHUNK_SIZE) {
            const chunkRecords = records.slice(i, i + CHUNK_SIZE);
            const chunkCodes = chunkRecords.map(r => r.code).filter(c => c);
            
            // Generate all variants for querying Supabase
            const searchCodesSet = new Set<string>();
            chunkCodes.forEach(code => {
                getCodeSearchVariants(code).forEach(variant => {
                    searchCodesSet.add(variant);
                });
                searchCodesSet.add(normalizeCode(code));
            });
            const searchCodes = Array.from(searchCodesSet);

            if (searchCodes.length === 0) {
                if (onProgress) onProgress(Math.min(i + CHUNK_SIZE, records.length), records.length);
                continue;
            }

            const { data: existingData, error: fetchError } = await supabase
                .from('land_records')
                .select('*')
                .in('code', searchCodes);

            if (fetchError) throw fetchError;

            const dbMap = new Map<string, any>();
            if (existingData) {
                existingData.forEach((r: any) => {
                    if (r.code) {
                        dbMap.set(normalizeCode(r.code), r);
                    }
                });
            }

            const updatesToPush: any[] = [];

            chunkRecords.forEach((excelRecord) => {
                const normCode = normalizeCode(excelRecord.code);
                const dbRecord = dbMap.get(normCode);
                
                if (dbRecord) {
                    const merged = { ...dbRecord };
                    let hasChange = false;

                    Object.keys(excelRecord).forEach(key => {
                        const newVal = (excelRecord as any)[key];
                        const isValidValue = newVal !== null && newVal !== undefined && newVal !== '';
                        
                        if (isValidValue && key !== 'id') {
                            if (String(merged[key]) !== String(newVal)) {
                                merged[key] = newVal;
                                hasChange = true;
                            }
                        }
                    });

                    if (hasChange) {
                        updatesToPush.push(sanitizeData(merged, RECORD_DB_COLUMNS));
                        updateCount++;
                    }
                }
            });

            if (updatesToPush.length > 0) {
                const dbUpdates = updatesToPush.map(p => mapPayloadToDb(p, actualCols));
                const { error: upsertError } = await supabase.from('land_records').upsert(dbUpdates);
                
                if (upsertError && (upsertError.code === 'PGRST204' || String(upsertError.code) === '42703' || (upsertError.message && String(upsertError.message).includes('does not exist')))) {
                    console.warn(`⚠️ [Fallback] Retrying chunk target upsert without new columns...`, upsertError);
                    const fallbackPayload = updatesToPush.map(p => {
                        const fp = { ...p };
                        OPTIONAL_NEW_COLUMNS.forEach(col => delete fp[col]);
                        return fp;
                    });
                    const { error: fallbackError } = await supabase.from('land_records').upsert(fallbackPayload);
                    if (fallbackError) {
                        logError("forceUpdateRecordsBatchApi (Fallback)", fallbackError);
                        throw fallbackError;
                    }
                } else if (upsertError) {
                    throw upsertError;
                }
            }
            
            if (onProgress) {
                onProgress(Math.min(i + CHUNK_SIZE, records.length), records.length);
            }
        }

        return { success: true, count: updateCount };

    } catch (error) {
        logError("forceUpdateRecordsBatchApi", error);
        return { success: false, count: 0 };
    }
};

// Cập nhật hàng loạt hồ sơ an toàn bằng ID (Phòng tránh trùng mã hồ sơ)
export const updateRecordsBatchById = async (updates: Partial<RecordFile>[], onProgress?: (processed: number, total: number) => void): Promise<{ success: boolean; count: number }> => {
    if (!isConfigured) {
        let count = 0;
        updates.forEach(up => {
            const idx = MOCK_RECORDS.findIndex(r => r.id === up.id);
            if (idx !== -1) {
                MOCK_RECORDS[idx] = { ...MOCK_RECORDS[idx], ...up } as RecordFile;
                count++;
            }
        });
        saveToCache(CACHE_KEYS.RECORDS, MOCK_RECORDS);
        if (onProgress) onProgress(updates.length, updates.length);
        return { success: true, count };
    }

    try {
        const actualCols = await getDbColumns('land_records');
        const rows = updates.map(u => mapPayloadToDb(sanitizeData(u, RECORD_DB_COLUMNS), actualCols));
        const { error } = await supabase
            .from('land_records')
            .upsert(rows);

        if (error && (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist')))) {
            console.warn("⚠️ [Fallback] Database is missing columns. Retrying batch update without new columns...", error);
            const fallbackRows = updates.map(u => {
                const fp = sanitizeData(u, RECORD_DB_COLUMNS);
                OPTIONAL_NEW_COLUMNS.forEach(col => delete fp[col]);
                return fp;
            });
            const { error: fallbackError } = await supabase
                .from('land_records')
                .upsert(fallbackRows);
            if (fallbackError) {
                logError("updateRecordsBatchById (Fallback)", fallbackError);
                throw fallbackError;
            }
            if (onProgress) onProgress(updates.length, updates.length);
            return { success: true, count: updates.length };
        }

        if (error) throw error;
        
        if (onProgress) onProgress(updates.length, updates.length);
        return { success: true, count: updates.length };
    } catch (error) {
        logError("updateRecordsBatchById", error);
        return { success: false, count: 0 };
    }
};

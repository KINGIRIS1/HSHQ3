import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, RefreshCw, Loader2, Search, CheckCircle2, AlertCircle, HelpCircle, ArrowRight, Save, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { NotifyFunction, RecordFile, Holiday, RecordStatus } from '../../types';
import { calculateDeadline, formatDateKey, isMeasurementType, parseSafeDate } from '../../utils/appHelpers';
import { getNormalizedWard } from '../../constants';

interface Props {
    notify: NotifyFunction;
    records: RecordFile[];
    onUpdateRecord?: (r: RecordFile) => Promise<any>;
    onRefreshData?: () => void;
    holidays?: Holiday[];
}

interface ScanResult {
    record: RecordFile;
    currentReceivedDate: string;
    currentDeadline: string;
    currentCompletedDate: string;
    currentExportDate: string;
    proposedReceivedDate: string;
    proposedDeadline: string;
    proposedCompletedDate: string;
    proposedExportDate: string;
    receivedDateSource: string;
    deadlineSource: string;
    completedDateSource: string;
    exportDateSource: string;
    isReceivedDateModified: boolean;
    isDeadlineModified: boolean;
    isCompletedDateModified: boolean;
    isExportDateModified: boolean;

    // Premature Handover Fields
    isPremature?: boolean;
    proposedStatus?: RecordStatus;
    datesToClear?: string[];
}

const SuaDoiNgayTab: React.FC<Props> = ({ notify, records, onUpdateRecord, onRefreshData, holidays = [] }) => {
    const [loading, setLoading] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'missing_received' | 'missing_deadline' | 'missing_both' | 'missing_handover' | 'all_records' | 'premature_handover'>('all');
    
    // Split by 2 specialty tabs: Đo đạc and Lưu trữ
    const [specialtyTab, setSpecialtyTab] = useState<'dodac' | 'luutru'>('dodac');
    
    // Dynamic procedure filter
    const [selectedProcedure, setSelectedProcedure] = useState<string>('all');
    
    // Pagination state to completely fix lag / rendering issues
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Track manually modified values before save
    const [manualEdits, setManualEdits] = useState<Record<string, { receivedDate?: string; deadline?: string; completedDate?: string; exportDate?: string }>>({});
    // Track selected records to update
    const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());

    // Track agreement and explanation for non-geographic records
    const [agreedNonGeo, setAgreedNonGeo] = useState<Record<string, boolean>>({});
    const [explanationNonGeo, setExplanationNonGeo] = useState<Record<string, string>>({});

    // Expanded record states for editing detailed step dates
    const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
    const [expandedRecordEdits, setExpandedRecordEdits] = useState<{
        status: RecordStatus;
        receivedDate: string;
        deadline: string;
        assignedDate: string;
        completedWorkDate: string;
        pendingCheckDate: string;
        checkedDate: string;
        submissionDate: string;
        approvalDate: string;
        completedDate: string;
        resultReturnedDate: string;
        exportDate: string;
    } | null>(null);

    // Helper function to check if a record is non-geographic handover
    const isNonGeographicHandover = (r: RecordFile) => {
        if (!r.handoverWard) return false;
        const normWard = getNormalizedWard(r.ward || '');
        const normHandoverWard = getNormalizedWard(r.handoverWard);
        return normWard && normHandoverWard && normWard.toLowerCase() !== normHandoverWard.toLowerCase();
    };

    // Helper function to check if a record has returned result with returned time of 00:00 and is missing completedDate or exportBatch, or has a status mismatch
    const isPrematureHandover = (r: RecordFile) => {
        // Must have resultReturnedDate (ngày đã trả kết quả)
        if (!r.resultReturnedDate) {
            return false;
        }

        const dateObj = parseSafeDate(r.resultReturnedDate);
        if (!dateObj) {
            return false;
        }

        // The time is exactly 00:00
        const isTimeZero = dateObj.getHours() === 0 && dateObj.getMinutes() === 0;
        if (!isTimeZero) {
            return false;
        }

        // Case 1: Status is not RETURNED (e.g. PROCESSING, HANDOVER, etc.) but has resultReturnedDate
        if (r.status !== RecordStatus.RETURNED) {
            return true;
        }

        // Case 2: Status is RETURNED but lacks completedDate (ngày Hoàn thành) or exportBatch (đợt bàn giao)
        if (!r.completedDate || !r.exportBatch) {
            return true;
        }

        return false;
    };

    // Helper to map any RecordFile to ScanResult structure
    const mapRecordToScanResult = (r: RecordFile): ScanResult => {
        const currentRecDate = r.receivedDate ? r.receivedDate.split('T')[0] : '';
        const currentDeadlineDate = r.deadline ? r.deadline.split('T')[0] : '';
        const currentCompletedDate = r.completedDate ? r.completedDate.split('T')[0] : '';
        const currentExportDate = r.exportDate ? r.exportDate.split('T')[0] : '';

        return {
            record: r,
            currentReceivedDate: currentRecDate,
            currentDeadline: currentDeadlineDate,
            currentCompletedDate: currentCompletedDate,
            currentExportDate: currentExportDate,
            proposedReceivedDate: currentRecDate,
            proposedDeadline: currentDeadlineDate,
            proposedCompletedDate: currentCompletedDate,
            proposedExportDate: currentExportDate,
            receivedDateSource: 'Giữ nguyên',
            deadlineSource: 'Giữ nguyên',
            completedDateSource: 'Giữ nguyên',
            exportDateSource: 'Giữ nguyên',
            isReceivedDateModified: false,
            isDeadlineModified: false,
            isCompletedDateModified: false,
            isExportDateModified: false
        };
    };

    const handleToggleExpand = (item: ScanResult) => {
        if (expandedRecordId === item.record.id) {
            setExpandedRecordId(null);
            setExpandedRecordEdits(null);
        } else {
            setExpandedRecordId(item.record.id);
            const r = item.record;
            setExpandedRecordEdits({
                status: r.status,
                receivedDate: r.receivedDate ? r.receivedDate.split('T')[0] : '',
                deadline: r.deadline ? r.deadline.split('T')[0] : '',
                assignedDate: r.assignedDate ? r.assignedDate.split('T')[0] : '',
                completedWorkDate: r.completedWorkDate ? r.completedWorkDate.split('T')[0] : '',
                pendingCheckDate: r.pendingCheckDate ? r.pendingCheckDate.split('T')[0] : '',
                checkedDate: r.checkedDate ? r.checkedDate.split('T')[0] : '',
                submissionDate: r.submissionDate ? r.submissionDate.split('T')[0] : '',
                approvalDate: r.approvalDate ? r.approvalDate.split('T')[0] : '',
                completedDate: r.completedDate ? r.completedDate.split('T')[0] : '',
                resultReturnedDate: r.resultReturnedDate ? r.resultReturnedDate.split('T')[0] : '',
                exportDate: r.exportDate ? r.exportDate.split('T')[0] : '',
            });
        }
    };

    const handleExpandedEditChange = (field: string, value: any) => {
        setExpandedRecordEdits(prev => {
            if (!prev) return null;
            return {
                ...prev,
                [field]: value
            };
        });
    };

    const handleSaveExpandedEdits = async (record: RecordFile) => {
        if (!expandedRecordEdits || !onUpdateRecord) return;
        
        setUpdating(true);
        try {
            const payload: RecordFile = {
                ...record,
                status: expandedRecordEdits.status,
                receivedDate: expandedRecordEdits.receivedDate ? `${expandedRecordEdits.receivedDate}T07:00:00Z` : null,
                deadline: expandedRecordEdits.deadline ? `${expandedRecordEdits.deadline}T17:00:00Z` : null,
                assignedDate: expandedRecordEdits.assignedDate ? `${expandedRecordEdits.assignedDate}T07:00:00Z` : null,
                completedWorkDate: expandedRecordEdits.completedWorkDate ? `${expandedRecordEdits.completedWorkDate}T07:00:00Z` : null,
                pendingCheckDate: expandedRecordEdits.pendingCheckDate ? `${expandedRecordEdits.pendingCheckDate}T07:00:00Z` : null,
                checkedDate: expandedRecordEdits.checkedDate ? `${expandedRecordEdits.checkedDate}T07:00:00Z` : null,
                submissionDate: expandedRecordEdits.submissionDate ? `${expandedRecordEdits.submissionDate}T07:00:00Z` : null,
                approvalDate: expandedRecordEdits.approvalDate ? `${expandedRecordEdits.approvalDate}T07:00:00Z` : null,
                completedDate: expandedRecordEdits.completedDate ? `${expandedRecordEdits.completedDate}T07:00:00Z` : null,
                resultReturnedDate: expandedRecordEdits.resultReturnedDate ? `${expandedRecordEdits.resultReturnedDate}T07:00:00Z` : null,
                exportDate: expandedRecordEdits.exportDate ? `${expandedRecordEdits.exportDate}T07:00:00Z` : null,
            };

            const res = await onUpdateRecord(payload);
            if (res) {
                notify(`Đã lưu thay đổi quy trình cho hồ sơ ${record.code || 'N/A'}!`, 'success');
                setExpandedRecordId(null);
                setExpandedRecordEdits(null);
                if (onRefreshData) onRefreshData();
            } else {
                notify('Lưu thay đổi thất bại.', 'error');
            }
        } catch (e) {
            console.error(e);
            notify('Có lỗi xảy ra khi lưu thay đổi.', 'error');
        } finally {
            setUpdating(false);
        }
    };

    const handleAutoClearFutureDates = () => {
        if (!expandedRecordEdits) return;
        const currentStatus = expandedRecordEdits.status;
        const flow = [
            RecordStatus.RECEIVED,
            RecordStatus.ASSIGNED,
            RecordStatus.IN_PROGRESS,
            RecordStatus.COMPLETED_WORK,
            RecordStatus.PENDING_CHECK,
            RecordStatus.CHECKED,
            RecordStatus.PENDING_SIGN,
            RecordStatus.SIGNED,
            RecordStatus.HANDOVER,
            RecordStatus.RETURNED
        ];
        
        const idx = flow.indexOf(currentStatus);
        if (idx === -1) return;

        setExpandedRecordEdits(prev => {
            if (!prev) return null;
            const next = { ...prev };
            
            if (idx < 1) { next.assignedDate = ''; }
            if (idx < 3) { next.completedWorkDate = ''; }
            if (idx < 4) { next.pendingCheckDate = ''; }
            if (idx < 5) { next.checkedDate = ''; }
            if (idx < 6) { next.submissionDate = ''; }
            if (idx < 7) { next.approvalDate = ''; }
            if (idx < 8) { next.completedDate = ''; }
            if (idx < 9) { next.resultReturnedDate = ''; next.exportDate = ''; }

            return next;
        });
        
        notify('Đã dọn dẹp các ngày quy trình sau trạng thái được chọn.', 'info');
    };

    // 1. Helper function to extract received date from 12 characters from right of the code (YYMMDD-XXXX or similar)
    const extractReceivedDateFromCode = (code: string): string | null => {
        if (!code) return null;
        // Take exactly 12 characters from right to left
        const segment = code.trim().slice(-12);
        
        // A. Try 8 consecutive digits (YYYYMMDD) in this 12-char segment
        const match8 = segment.match(/(\d{4})(\d{2})(\d{2})/);
        if (match8) {
            const yyyy = parseInt(match8[1], 10);
            const mm = parseInt(match8[2], 10);
            const dd = parseInt(match8[3], 10);
            if (yyyy >= 2000 && yyyy <= 2100 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
                return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
            }
        }
        
        // B. Try 6 consecutive digits (YYMMDD or DDMMYY) in this 12-char segment
        const match6 = segment.match(/(\d{2})(\d{2})(\d{2})/);
        if (match6) {
            const p1 = parseInt(match6[1], 10);
            const p2 = parseInt(match6[2], 10);
            const p3 = parseInt(match6[3], 10);
            
            // Option B1: YYMMDD
            if (p2 >= 1 && p2 <= 12 && p3 >= 1 && p3 <= 31) {
                const year = 2000 + p1;
                return `${year}-${String(p2).padStart(2, '0')}-${String(p3).padStart(2, '0')}`;
            }
            
            // Option B2: DDMMYY
            if (p2 >= 1 && p2 <= 12 && p1 >= 1 && p1 <= 31) {
                const year = 2000 + p3;
                return `${year}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
            }
        }
        return null;
    };

    // 2. Scan records for missing or out-of-sync dates (ONLY target records that actually lack complete dates)
    const scannedResults = useMemo(() => {
        if (!records || records.length === 0) return [];

        const results: ScanResult[] = [];

        for (const r of records) {
            const currentRecDate = r.receivedDate ? r.receivedDate.split('T')[0] : '';
            const currentDeadlineDate = r.deadline ? r.deadline.split('T')[0] : '';
            const currentCompletedDate = r.completedDate ? r.completedDate.split('T')[0] : '';
            const currentExportDate = r.exportDate ? r.exportDate.split('T')[0] : '';

            const isMissingRec = !currentRecDate;
            const isMissingDeadline = !currentDeadlineDate;
            
            // Check missing handover date
            const isHandedOver = (r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || !!r.exportBatch) && !!r.exportBatch;
            const isMissingHandover = isHandedOver && (!currentCompletedDate || !currentExportDate);

            // Check premature handover (returned result but dates are in future)
            const isPremature = isPrematureHandover(r);

            // Only show and process records with date issues or premature handovers, leave fully populated records untouched
            if (!isMissingRec && !isMissingDeadline && !isMissingHandover && !isPremature) continue;

            // Propose Received Date
            let propRecDate = currentRecDate;
            let recSource = 'Giữ nguyên';
            let isRecMod = false;

            if (isMissingRec) {
                const dateFromCode = extractReceivedDateFromCode(r.code || '');
                if (dateFromCode) {
                    propRecDate = dateFromCode;
                    recSource = `Trích từ 12 ký tự đuôi mã hồ sơ: ${r.code?.slice(-12)}`;
                    isRecMod = true;
                } else if (r.assignedDate) {
                    propRecDate = r.assignedDate.split('T')[0];
                    recSource = 'Đồng bộ từ Ngày giao việc';
                    isRecMod = true;
                } else {
                    const todayStr = formatDateKey(new Date());
                    propRecDate = todayStr;
                    recSource = 'Mặc định ngày hôm nay';
                    isRecMod = true;
                }
            }

            // Propose Deadline (Hạn trả theo quy trình)
            let propDeadlineDate = currentDeadlineDate;
            let deadlineSrc = 'Giữ nguyên';
            let isDeadlineMod = false;

            if (isMissingDeadline && propRecDate) {
                try {
                    const calculatedDeadlineStr = calculateDeadline(r.recordType || '', propRecDate, holidays);
                    if (calculatedDeadlineStr) {
                        propDeadlineDate = calculatedDeadlineStr;
                        deadlineSrc = 'Tính toán theo SLA quy trình';
                        isDeadlineMod = true;
                    } else {
                        propDeadlineDate = propRecDate;
                        deadlineSrc = 'Bằng ngày nhận';
                        isDeadlineMod = true;
                    }
                } catch (e) {
                    propDeadlineDate = propRecDate;
                    deadlineSrc = 'Bằng ngày nhận';
                    isDeadlineMod = true;
                }
            }

            // Propose Handover / Completed dates
            let propCompletedDate = currentCompletedDate;
            let propExportDate = currentExportDate;
            let completedDateSource = 'Giữ nguyên';
            let exportDateSource = 'Giữ nguyên';
            let isCompletedDateModified = false;
            let isExportDateModified = false;

            if (isHandedOver) {
                const isMissingComp = !currentCompletedDate;
                const isMissingExp = !currentExportDate;

                if (isMissingComp || isMissingExp) {
                    // Try to find a date from another record in the same handover batch (exportBatch)
                    let foundBatchDate: string | null = null;
                    if (r.exportBatch) {
                        const batchMatch = records.find(item => 
                            item.exportBatch === r.exportBatch && 
                            item.id !== r.id && 
                            (item.exportDate || item.completedDate)
                        );
                        if (batchMatch) {
                            foundBatchDate = (batchMatch.exportDate || batchMatch.completedDate)!.split('T')[0];
                        }
                    }

                    // A. Propose completedDate
                    if (isMissingComp) {
                        if (foundBatchDate) {
                            propCompletedDate = foundBatchDate;
                            completedDateSource = `Trích từ đợt giao #${r.exportBatch}`;
                            isCompletedDateModified = true;
                        } else if (currentExportDate) {
                            propCompletedDate = currentExportDate;
                            completedDateSource = 'Đồng bộ từ Ngày xuất/trả';
                            isCompletedDateModified = true;
                        } else if (r.approvalDate) {
                            propCompletedDate = r.approvalDate.split('T')[0];
                            completedDateSource = 'Đồng bộ từ Ngày ký duyệt';
                            isCompletedDateModified = true;
                        } else if (r.completedWorkDate) {
                            propCompletedDate = r.completedWorkDate.split('T')[0];
                            completedDateSource = 'Đồng bộ từ Ngày hoàn thành nội bộ';
                            isCompletedDateModified = true;
                        } else {
                            const todayStr = formatDateKey(new Date());
                            propCompletedDate = todayStr;
                            completedDateSource = 'Mặc định ngày hôm nay';
                            isCompletedDateModified = true;
                        }
                    }

                    // B. Propose exportDate
                    if (isMissingExp) {
                        if (foundBatchDate) {
                            propExportDate = foundBatchDate;
                            exportDateSource = `Trích từ đợt giao #${r.exportBatch}`;
                            isExportDateModified = true;
                        } else if (propCompletedDate) {
                            propExportDate = propCompletedDate;
                            exportDateSource = 'Đồng bộ từ Ngày bàn giao 1 cửa';
                            isExportDateModified = true;
                        } else {
                            const todayStr = formatDateKey(new Date());
                            propExportDate = todayStr;
                            exportDateSource = 'Mặc định ngày hôm nay';
                            isExportDateModified = true;
                        }
                    }
                }
            }

            // Calculate proposed status and dates to clear if premature
            let proposedStatus: RecordStatus | undefined = undefined;
            let datesToClear: string[] | undefined = undefined;
            
            if (isPremature) {
                if (r.status !== RecordStatus.RETURNED) {
                    proposedStatus = r.status;
                    datesToClear = ['resultReturnedDate'];
                } else {
                    const todayStr = new Date().toISOString().split('T')[0];
                    if (r.approvalDate && r.approvalDate.split('T')[0] <= todayStr) {
                        proposedStatus = RecordStatus.SIGNED;
                        datesToClear = ['completedDate', 'exportDate', 'resultReturnedDate'];
                    } else if (r.submissionDate && r.submissionDate.split('T')[0] <= todayStr) {
                        proposedStatus = RecordStatus.PENDING_SIGN;
                        datesToClear = ['approvalDate', 'completedDate', 'exportDate', 'resultReturnedDate'];
                    } else if (r.checkedDate && r.checkedDate.split('T')[0] <= todayStr) {
                        proposedStatus = RecordStatus.CHECKED;
                        datesToClear = ['submissionDate', 'approvalDate', 'completedDate', 'exportDate', 'resultReturnedDate'];
                    } else if (r.pendingCheckDate && r.pendingCheckDate.split('T')[0] <= todayStr) {
                        proposedStatus = RecordStatus.PENDING_CHECK;
                        datesToClear = ['checkedDate', 'submissionDate', 'approvalDate', 'completedDate', 'exportDate', 'resultReturnedDate'];
                    } else if (r.completedWorkDate && r.completedWorkDate.split('T')[0] <= todayStr) {
                        proposedStatus = RecordStatus.COMPLETED_WORK;
                        datesToClear = ['pendingCheckDate', 'checkedDate', 'submissionDate', 'approvalDate', 'completedDate', 'exportDate', 'resultReturnedDate'];
                    } else if (r.assignedDate && r.assignedDate.split('T')[0] <= todayStr) {
                        proposedStatus = RecordStatus.IN_PROGRESS;
                        datesToClear = ['completedWorkDate', 'pendingCheckDate', 'checkedDate', 'submissionDate', 'approvalDate', 'completedDate', 'exportDate', 'resultReturnedDate'];
                    } else {
                        proposedStatus = RecordStatus.RECEIVED;
                        datesToClear = ['assignedDate', 'completedWorkDate', 'pendingCheckDate', 'checkedDate', 'submissionDate', 'approvalDate', 'completedDate', 'exportDate', 'resultReturnedDate'];
                    }
                }
            }

            results.push({
                record: r,
                currentReceivedDate: currentRecDate,
                currentDeadline: currentDeadlineDate,
                currentCompletedDate: currentCompletedDate,
                currentExportDate: currentExportDate,
                proposedReceivedDate: propRecDate,
                proposedDeadline: propDeadlineDate,
                proposedCompletedDate: propCompletedDate,
                proposedExportDate: propExportDate,
                receivedDateSource: recSource,
                deadlineSource: deadlineSrc,
                completedDateSource,
                exportDateSource,
                isReceivedDateModified: isRecMod,
                isDeadlineModified: isDeadlineMod,
                isCompletedDateModified,
                isExportDateModified,
                isPremature,
                proposedStatus,
                datesToClear
            });
        }

        return results;
    }, [records, holidays]);

    // Compute unique procedures dynamically for the selected Specialty Tab (Đo đạc vs Lưu trữ)
    const availableProcedures = useMemo(() => {
        const sourceList = filterType === 'all_records' ? records : scannedResults.map(r => r.record);
        const tabScanned = sourceList.filter(r => {
            const isMeas = isMeasurementType(r.recordType);
            if (specialtyTab === 'dodac') {
                return isMeas;
            } else {
                return !isMeas;
            }
        });
        
        const types = new Set<string>();
        tabScanned.forEach(r => {
            if (r.recordType) {
                types.add(r.recordType);
            }
        });
        return Array.from(types).sort();
    }, [scannedResults, records, specialtyTab, filterType]);

    // Reset procedure and current page when specialty tab changes
    useEffect(() => {
        setSelectedProcedure('all');
        setCurrentPage(1);
    }, [specialtyTab]);

    // Reset page on search/filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterType, selectedProcedure]);

    // 3. Filter scanned results based on specialty tab, specific procedure, search term & missing-type selections
    const filteredResults = useMemo(() => {
        if (filterType === 'all_records') {
            let results = records.map(mapRecordToScanResult);

            // Apply specialty tab filter
            results = results.filter(r => {
                const isMeas = isMeasurementType(r.record.recordType);
                if (specialtyTab === 'dodac') {
                    return isMeas;
                } else {
                    return !isMeas;
                }
            });

            // Apply dynamic specific procedure filter
            if (selectedProcedure !== 'all') {
                results = results.filter(r => r.record.recordType === selectedProcedure);
            }

            // Apply Search Term (Code or Customer Name)
            if (searchTerm.trim()) {
                const s = searchTerm.toLowerCase().trim();
                results = results.filter(r => 
                    (r.record.code || '').toLowerCase().includes(s) || 
                    (r.record.customerName || '').toLowerCase().includes(s)
                );
            }

            return results;
        } else {
            let results = scannedResults;

            // Apply specialty tab filter
            results = results.filter(r => {
                const isMeas = isMeasurementType(r.record.recordType);
                if (specialtyTab === 'dodac') {
                    return isMeas;
                } else {
                    return !isMeas;
                }
            });

            // Apply dynamic specific procedure filter
            if (selectedProcedure !== 'all') {
                results = results.filter(r => r.record.recordType === selectedProcedure);
            }

            // Apply missing type filter
            if (filterType === 'missing_received') {
                results = results.filter(r => !r.currentReceivedDate);
            } else if (filterType === 'missing_deadline') {
                results = results.filter(r => !r.currentDeadline);
            } else if (filterType === 'missing_both') {
                results = results.filter(r => !r.currentReceivedDate && !r.currentDeadline);
            } else if (filterType === 'missing_handover') {
                results = results.filter(r => {
                    const isHandedOver = r.record.status === RecordStatus.HANDOVER || r.record.status === RecordStatus.RETURNED || !!r.record.exportBatch;
                    return isHandedOver && (!r.currentCompletedDate || !r.currentExportDate);
                });
            } else if (filterType === 'premature_handover') {
                results = results.filter(r => r.isPremature);
            }

            // Apply Search Term (Code or Customer Name)
            if (searchTerm.trim()) {
                const s = searchTerm.toLowerCase().trim();
                results = results.filter(r => 
                    (r.record.code || '').toLowerCase().includes(s) || 
                    (r.record.customerName || '').toLowerCase().includes(s)
                );
            }

            return results;
        }
    }, [scannedResults, records, specialtyTab, selectedProcedure, filterType, searchTerm]);

    // 4. Update Selection Set ONLY on structural tab/filter shifts, to prevent input lag when typing
    useEffect(() => {
        const newSelected = new Set<string>();
        if (filterType !== 'all_records') {
            filteredResults.forEach(item => newSelected.add(item.record.id));
        }
        setSelectedRecordIds(newSelected);
        setManualEdits({});
    }, [specialtyTab, selectedProcedure, filterType]);

    // Pagination computations
    const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
    const paginatedResults = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredResults.slice(start, start + itemsPerPage);
    }, [filteredResults, currentPage]);

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const newSelected = new Set<string>();
            filteredResults.forEach(item => newSelected.add(item.record.id));
            setSelectedRecordIds(newSelected);
        } else {
            setSelectedRecordIds(new Set());
        }
    };

    const handleSelectRow = (id: string, checked: boolean) => {
        const next = new Set(selectedRecordIds);
        if (checked) {
            next.add(id);
        } else {
            next.delete(id);
        }
        setSelectedRecordIds(next);
    };

    const handleManualDateChange = (recordId: string, field: 'receivedDate' | 'deadline' | 'completedDate' | 'exportDate', value: string) => {
        setManualEdits(prev => {
            const item = prev[recordId] || {};
            return {
                ...prev,
                [recordId]: {
                    ...item,
                    [field]: value
                }
            };
        });
    };

    // 5. Execute Sync / Repair Operation
    const handleUpdateSelected = async () => {
        if (selectedRecordIds.size === 0) {
            notify('Vui lòng chọn ít nhất một hồ sơ để tiến hành cập nhật.', 'error');
            return;
        }

        if (!onUpdateRecord) {
            notify('Hệ thống cập nhật hồ sơ chưa được sẵn sàng.', 'error');
            return;
        }

        setUpdating(true);
        try {
            let successCount = 0;
            const itemsToUpdate = filteredResults.filter(item => selectedRecordIds.has(item.record.id));

            // Validate non-geographic agreements (Chức năng giải trình phi địa giới đã được gỡ bỏ)

            for (const item of itemsToUpdate) {
                const edits = manualEdits[item.record.id];
                const finalRecDate = edits?.receivedDate !== undefined ? edits.receivedDate : item.proposedReceivedDate;
                const finalDeadlineDate = edits?.deadline !== undefined ? edits.deadline : item.proposedDeadline;
                const finalCompletedDate = edits?.completedDate !== undefined ? edits.completedDate : item.proposedCompletedDate;
                const finalExportDate = edits?.exportDate !== undefined ? edits.exportDate : item.proposedExportDate;

                const updatedPayload: RecordFile = {
                    ...item.record,
                };

                // For premature records, reset status and clear future dates
                if (item.isPremature && item.proposedStatus) {
                    updatedPayload.status = item.proposedStatus;
                    if (item.datesToClear) {
                        item.datesToClear.forEach(field => {
                            if (field === 'completedDate') updatedPayload.completedDate = null;
                            if (field === 'exportDate') updatedPayload.exportDate = null;
                            if (field === 'resultReturnedDate') updatedPayload.resultReturnedDate = null;
                            if (field === 'approvalDate') updatedPayload.approvalDate = null;
                            if (field === 'submissionDate') updatedPayload.submissionDate = null;
                            if (field === 'checkedDate') updatedPayload.checkedDate = null;
                            if (field === 'pendingCheckDate') updatedPayload.pendingCheckDate = null;
                            if (field === 'completedWorkDate') updatedPayload.completedWorkDate = null;
                            if (field === 'assignedDate') updatedPayload.assignedDate = null;
                        });
                    }
                } else {
                    // Apply changes if date was empty and now we have a proposed or modified date
                    if (!item.currentReceivedDate && finalRecDate) {
                        updatedPayload.receivedDate = `${finalRecDate}T07:00:00Z`;
                    }

                    if (!item.currentDeadline && finalDeadlineDate) {
                        updatedPayload.deadline = `${finalDeadlineDate}T17:00:00Z`;
                    }

                    if (!item.currentCompletedDate && finalCompletedDate) {
                        updatedPayload.completedDate = `${finalCompletedDate}T07:00:00Z`;
                    }

                    if (!item.currentExportDate && finalExportDate) {
                        updatedPayload.exportDate = `${finalExportDate}T07:00:00Z`;
                    }
                }

                // Chức năng lưu giải trình phi địa giới đã được gỡ bỏ

                const res = await onUpdateRecord(updatedPayload);
                if (res) {
                    successCount++;
                }
            }

            notify(`Đã cập nhật & sửa đổi thành công ${successCount}/${itemsToUpdate.length} hồ sơ!`, 'success');
            
            if (onRefreshData) {
                onRefreshData();
            }
        } catch (error) {
            notify('Đã xảy ra lỗi khi sửa đổi ngày hồ sơ.', 'error');
            console.error(error);
        } finally {
            setUpdating(false);
        }
    };

    // Calculate quick counts for widgets (for the active specialty tab)
    const counts = useMemo(() => {
        let missingRec = 0;
        let missingDeadline = 0;
        let missingBoth = 0;
        let missingHandover = 0;
        let prematureHandover = 0;

        // Count for current active specialty tab
        const activeTabResults = scannedResults.filter(r => {
            const isMeas = isMeasurementType(r.record.recordType);
            if (specialtyTab === 'dodac') {
                return isMeas;
            } else {
                return !isMeas;
            }
        });

        activeTabResults.forEach(r => {
            const rec = !r.currentReceivedDate;
            const dead = !r.currentDeadline;
            const isHandedOver = (r.record.status === RecordStatus.HANDOVER || r.record.status === RecordStatus.RETURNED || !!r.record.exportBatch) && !!r.record.exportBatch;
            const handover = isHandedOver && (!r.currentCompletedDate || !r.currentExportDate);
            const premature = !!r.isPremature;

            if (rec && dead) {
                missingBoth++;
            } else {
                if (rec) missingRec++;
                if (dead) missingDeadline++;
            }
            if (handover) {
                missingHandover++;
            }
            if (premature) {
                prematureHandover++;
            }
        });

        return {
            missingRec,
            missingDeadline,
            missingBoth,
            missingHandover,
            prematureHandover,
            totalWithIssues: activeTabResults.length
        };
    }, [scannedResults, specialtyTab]);

    return (
        <div id="sua_doi_ngay_tab_root" className="flex flex-col h-full bg-[#f1f5f9] overflow-hidden">
            {/* Specialty Selection Tabs (Đo Đạc & Lưu Trữ) */}
            <div className="bg-white border-b border-slate-200 px-4 py-1 shrink-0 flex items-center justify-between">
                <div className="flex gap-2">
                    <button
                        id="tab_specialty_dodac"
                        onClick={() => setSpecialtyTab('dodac')}
                        className={`px-4 py-2.5 font-bold text-xs rounded-t-lg transition-all border-b-2 flex items-center gap-2 ${
                            specialtyTab === 'dodac'
                            ? 'border-blue-600 text-blue-600 bg-blue-50/40'
                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                    >
                        🗺️ CHUYÊN MÔN ĐO ĐẠC
                    </button>
                    <button
                        id="tab_specialty_luutru"
                        onClick={() => setSpecialtyTab('luutru')}
                        className={`px-4 py-2.5 font-bold text-xs rounded-t-lg transition-all border-b-2 flex items-center gap-2 ${
                            specialtyTab === 'luutru'
                            ? 'border-blue-600 text-blue-600 bg-blue-50/40'
                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                    >
                        📂 CHUYÊN MÔN LƯU TRỮ
                    </button>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                    Hỗ trợ quét khuyết ngày của hồ sơ
                </div>
            </div>

            {/* Quick Stats Panel */}
            <div id="stats_panel" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 p-4 shrink-0 bg-slate-50 border-b border-slate-200">
                <div 
                    id="stat_all"
                    onClick={() => setFilterType('all')}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                        filterType === 'all' 
                        ? 'bg-blue-50 border-blue-200 shadow-sm' 
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                >
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Cần xử lý ({specialtyTab === 'dodac' ? 'Đo đạc' : 'Lưu trữ'})</span>
                    <span className="text-xl font-black text-slate-800">{counts.totalWithIssues}</span>
                    <span className="text-xs text-slate-500 font-medium">Hồ sơ khuyết ngày</span>
                </div>

                <div 
                    id="stat_missing_received"
                    onClick={() => setFilterType('missing_received')}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                        filterType === 'missing_received' 
                        ? 'bg-amber-50 border-amber-200 shadow-sm' 
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                >
                    <span className="text-[10px] uppercase font-bold text-amber-600 tracking-wider">Khuyết Ngày Nhận</span>
                    <span className="text-xl font-black text-amber-700">{counts.missingRec}</span>
                    <span className="text-xs text-slate-500 font-medium">Chưa nhập ngày tiếp nhận</span>
                </div>

                <div 
                    id="stat_missing_deadline"
                    onClick={() => setFilterType('missing_deadline')}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                        filterType === 'missing_deadline' 
                        ? 'bg-rose-50 border-rose-200 shadow-sm' 
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                >
                    <span className="text-[10px] uppercase font-bold text-rose-600 tracking-wider">Khuyết Hạn Trả</span>
                    <span className="text-xl font-black text-rose-700">{counts.missingDeadline}</span>
                    <span className="text-xs text-slate-500 font-medium">Chưa nhập hạn trả quy trình</span>
                </div>

                <div 
                    id="stat_missing_both"
                    onClick={() => setFilterType('missing_both')}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                        filterType === 'missing_both' 
                        ? 'bg-red-50 border-red-200 shadow-sm' 
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                >
                    <span className="text-[10px] uppercase font-bold text-red-600 tracking-wider">Khuyết cả hai ngày</span>
                    <span className="text-xl font-black text-red-700">{counts.missingBoth}</span>
                    <span className="text-xs text-slate-500 font-medium">Khuyết ngày nhận & hẹn trả</span>
                </div>

                <div 
                    id="stat_missing_handover"
                    onClick={() => setFilterType('missing_handover')}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                        filterType === 'missing_handover' 
                        ? 'bg-purple-50 border-purple-200 shadow-sm' 
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                >
                    <span className="text-[10px] uppercase font-bold text-purple-600 tracking-wider">Khuyết Ngày Giao 1C</span>
                    <span className="text-xl font-black text-purple-700">{counts.missingHandover}</span>
                    <span className="text-xs text-slate-500 font-medium">Chưa nhập ngày giao một cửa</span>
                </div>

                <div 
                    id="stat_premature_handover"
                    onClick={() => setFilterType('premature_handover')}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                        filterType === 'premature_handover' 
                        ? 'bg-rose-50 border-rose-200 shadow-sm' 
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                >
                    <span className="text-[10px] uppercase font-bold text-rose-600 tracking-wider">Lỗi Trả KQ 00:00</span>
                    <span className="text-xl font-black text-rose-700">{counts.prematureHandover}</span>
                    <span className="text-xs text-slate-500 font-medium">Đã trả KQ 00:00, thiếu Hoàn thành/đợt</span>
                </div>

                <div 
                    id="stat_all_records"
                    onClick={() => setFilterType('all_records')}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                        filterType === 'all_records' 
                        ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                >
                    <span className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">Sửa Toàn Bộ Quy Trình</span>
                    <span className="text-xl font-black text-indigo-700">🔍</span>
                    <span className="text-xs text-slate-500 font-medium">Tìm & Sửa ngày + trạng thái</span>
                </div>
            </div>

            {/* Instruction Banner */}
            <div id="instruction_banner" className="mx-4 mt-4 p-4 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/50 to-indigo-50/30 flex items-start gap-3">
                <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs text-slate-600 leading-relaxed font-medium">
                    <p className="font-bold text-slate-800 mb-0.5">Quy ước & Chức năng hiệu chỉnh ngày:</p>
                    <ul className="list-disc pl-4 space-y-1 mt-1 text-slate-500">
                        <li><strong>Khắc phục hồ sơ lỗi Trả kết quả lúc 00:00:</strong> Hệ thống tự động quét tìm các hồ sơ đang ở trạng thái "Đã trả kết quả" (RETURNED) có giờ trả kết quả là mốc 00:00 (ví dụ: <code className="bg-rose-50 text-rose-700 px-1 rounded font-bold font-mono">00:00 - DD/MM/YYYY</code>) nhưng khuyết ngày Hoàn thành (completedDate) hoặc Đợt bàn giao (exportBatch). Nhấp vào thẻ lỗi này để xem giải pháp đề xuất, chọn hồ sơ cần khắc phục và bấm nút <strong>"Tiến hành Đồng bộ & Sửa đổi"</strong> để tự động xóa trạng thái Đã trả KQ, khôi phục trạng thái quy trình thực tế trước đó và dọn sạch các mốc ngày trả lỗi này.</li>
                        <li><strong>Hiệu chỉnh quy trình thủ công:</strong> Bấm vào biểu tượng lịch <code className="bg-indigo-50 text-indigo-700 px-1 py-0.2 rounded font-mono text-[10px] font-bold">📅</code> cạnh Mã hồ sơ bất kỳ để sửa trực tiếp tất cả các ngày thuộc 12 bước quy trình và cập nhật lại trạng thái hồ sơ.</li>
                        <li><strong>Ngày nhận đề xuất:</strong> Trích xuất từ <strong>12 ký tự đuôi từ phải sang trái</strong> của Mã hồ sơ (Ưu tiên tìm chuỗi ngày 8 số <code className="bg-slate-100 text-slate-800 px-1 py-0.2 rounded font-mono text-[10px] font-bold">YYYYMMDD</code> hoặc chuỗi ngày 6 số <code className="bg-slate-100 text-slate-800 px-1 py-0.2 rounded font-mono text-[10px] font-bold">YYMMDD / DDMMYY</code>).</li>
                        <li><strong>Hạn trả đề xuất:</strong> Tự động tính toán cộng ngày làm việc theo đúng SLA cấu hình quy trình mặc định (loại trừ Thứ Bảy, Chủ Nhật và các Ngày Lễ) dựa trên ngày nhận đề xuất.</li>
                        <li><strong>Ngày giao 1 cửa đề xuất:</strong> Tự động đồng bộ từ các hồ sơ chung đợt giao một cửa (<code className="bg-slate-100 text-slate-800 px-1 py-0.2 rounded font-mono text-[10px] font-bold">exportBatch</code>) hoặc kế thừa từ các mốc thời gian hoàn thành trước đó (Ngày ký duyệt, Ngày làm xong).</li>
                    </ul>
                </div>
            </div>

            {/* Filters and Actions Bar */}
            <div id="filters_bar" className="p-4 shrink-0 flex flex-wrap items-center justify-between gap-4 z-10">
                <div className="flex items-center gap-3">
                    {/* Search Input */}
                    <div className="relative w-64">
                        <input
                            id="input_search_records"
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm mã hồ sơ, chủ đất..."
                            className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 bg-white placeholder-slate-400"
                        />
                        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    </div>

                    {/* Specific Procedure Dropdown Filter */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-500 font-bold uppercase">Thủ tục:</span>
                        <select
                            id="select_procedure_filter"
                            value={selectedProcedure}
                            onChange={(e) => setSelectedProcedure(e.target.value)}
                            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none bg-white font-semibold text-slate-700 max-w-[280px]"
                        >
                            <option value="all">Tất cả ({availableProcedures.length} thủ tục khuyết ngày)</option>
                            {availableProcedures.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Repair Trigger Button */}
                <button
                    id="btn_execute_sync"
                    onClick={handleUpdateSelected}
                    disabled={updating || selectedRecordIds.size === 0}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:opacity-50 text-white px-5 py-2 rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer shrink-0"
                >
                    {updating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Bắt đầu đồng bộ {selectedRecordIds.size} hồ sơ đã chọn
                </button>
            </div>

            {/* Scanned Table Area */}
            <div id="table_area" className="flex-1 mx-4 mb-4 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="flex justify-center items-center h-full py-16">
                            <Loader2 className="animate-spin text-blue-600" size={36} />
                        </div>
                    ) : paginatedResults.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 py-16">
                            <CheckCircle2 size={44} className="text-emerald-500" />
                            <p className="text-sm font-bold text-slate-600">Dữ liệu hoàn hảo!</p>
                            <p className="text-xs text-slate-400 max-w-xs text-center leading-relaxed">Không có hồ sơ nào bị thiếu Ngày nhận, Hạn trả hoặc Ngày giao 1 cửa thuộc danh mục và thủ tục đã chọn.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse table-fixed min-w-[1400px]">
                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 text-center w-12">
                                        <input
                                            id="check_select_all"
                                            type="checkbox"
                                            checked={selectedRecordIds.size === filteredResults.length && filteredResults.length > 0}
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                            className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer h-3.5 w-3.5"
                                        />
                                    </th>
                                    <th className="px-4 py-3 w-36">Mã hồ sơ</th>
                                    <th className="px-4 py-3 w-44">Chủ hồ sơ</th>
                                    <th className="px-4 py-3 w-40">Trạng thái / Đợt</th>
                                    <th className="px-4 py-3 w-64">Thời hạn xử lý (Nhận ➡️ Hẹn)</th>
                                    <th className="px-4 py-3 w-64">Bàn giao 1 cửa (Hoàn thành ➡️ Ngày xuất)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {paginatedResults.map((item) => {
                                    const isSelected = selectedRecordIds.has(item.record.id);
                                    const edits = manualEdits[item.record.id];
                                    const editedRecDate = edits?.receivedDate !== undefined ? edits.receivedDate : item.proposedReceivedDate;
                                    const editedDeadlineDate = edits?.deadline !== undefined ? edits.deadline : item.proposedDeadline;
                                    const editedCompletedDate = edits?.completedDate !== undefined ? edits.completedDate : item.proposedCompletedDate;
                                    const editedExportDate = edits?.exportDate !== undefined ? edits.exportDate : item.proposedExportDate;

                                    const isHandedOver = (item.record.status === RecordStatus.HANDOVER || item.record.status === RecordStatus.RETURNED || !!item.record.exportBatch) && !!item.record.exportBatch;

                                    return (
                                        <React.Fragment key={item.record.id}>
                                            <tr 
                                                className={`hover:bg-slate-50/80 transition-colors ${
                                                    isSelected ? 'bg-blue-50/20' : ''
                                                } ${expandedRecordId === item.record.id ? 'border-l-4 border-l-indigo-500 bg-indigo-50/20' : ''}`}
                                            >
                                                <td className="px-4 py-3 text-center">
                                                    <input
                                                        id={`check_record_${item.record.id}`}
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={(e) => handleSelectRow(item.record.id, e.target.checked)}
                                                        className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer h-3.5 w-3.5"
                                                    />
                                                </td>
                                                
                                                <td className="px-4 py-3 font-mono font-bold text-slate-700">
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleExpand(item)}
                                                            className={`p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors ${
                                                                expandedRecordId === item.record.id ? 'text-indigo-600 bg-indigo-50' : ''
                                                            }`}
                                                            title="Sửa chi tiết ngày quy trình & trạng thái"
                                                        >
                                                            <Calendar size={14} />
                                                        </button>
                                                        <span className="truncate">{item.record.code || 'N/A'}</span>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3 font-medium text-slate-800">
                                                    <p className="truncate font-semibold max-w-[160px]">{item.record.customerName || 'Chưa rõ'}</p>
                                                    <p className="text-[10px] text-slate-400 font-normal truncate max-w-[160px]">{item.record.phoneNumber}</p>
                                                </td>

                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col gap-1 max-w-[160px]">
                                                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold w-fit ${
                                                            item.record.status === RecordStatus.RETURNED ? 'bg-emerald-100 text-emerald-800' :
                                                            item.record.status === RecordStatus.HANDOVER ? 'bg-blue-100 text-blue-800' :
                                                            'bg-slate-100 text-slate-700'
                                                        }`}>
                                                            {item.record.status}
                                                        </span>
                                                        {item.isPremature && (
                                                            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800 animate-pulse mt-0.5 w-fit">
                                                                ⚠️ Lỗi Trả KQ 00:00
                                                            </span>
                                                        )}
                                                        {item.record.exportBatch && (
                                                            <span className="text-[10px] font-mono font-bold text-indigo-600">
                                                                📦 Đợt giao: #{item.record.exportBatch}
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] text-slate-500 font-medium truncate" title={item.record.recordType || ''}>
                                                            {item.record.recordType}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Received & Deadline Cell */}
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col gap-2">
                                                        {/* receivedDate */}
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] font-bold text-slate-400 w-14">Ngày nhận:</span>
                                                            <span className={`font-mono px-1 py-0.5 rounded text-[10px] shrink-0 ${
                                                                item.currentReceivedDate ? 'text-slate-500 font-normal' : 'text-red-500 bg-red-50 font-bold'
                                                            }`}>
                                                                {item.currentReceivedDate || 'Trống'}
                                                            </span>
                                                            <ArrowRight size={10} className="text-slate-400 shrink-0" />
                                                            <input
                                                                id={`input_rec_date_${item.record.id}`}
                                                                type="date"
                                                                value={editedRecDate}
                                                                onChange={(e) => handleManualDateChange(item.record.id, 'receivedDate', e.target.value)}
                                                                className={`font-mono text-[11px] px-1.5 py-0.5 rounded border w-28 ${
                                                                    item.currentReceivedDate 
                                                                    ? 'border-slate-200 text-slate-600 bg-white' 
                                                                    : 'border-amber-300 text-amber-800 bg-amber-50/50 font-semibold'
                                                                } outline-none focus:border-blue-500`}
                                                            />
                                                        </div>
                                                        {!item.currentReceivedDate && (
                                                            <span className="text-[9px] text-amber-600 font-medium italic pl-14">
                                                                🔍 {item.receivedDateSource}
                                                            </span>
                                                        )}

                                                        {/* deadline */}
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className="text-[10px] font-bold text-slate-400 w-14">Hạn trả:</span>
                                                            <span className={`font-mono px-1 py-0.5 rounded text-[10px] shrink-0 ${
                                                                item.currentDeadline ? 'text-slate-500 font-normal' : 'text-red-500 bg-red-50 font-bold'
                                                            }`}>
                                                                {item.currentDeadline || 'Trống'}
                                                            </span>
                                                            <ArrowRight size={10} className="text-slate-400 shrink-0" />
                                                            <input
                                                                id={`input_deadline_date_${item.record.id}`}
                                                                type="date"
                                                                value={editedDeadlineDate}
                                                                onChange={(e) => handleManualDateChange(item.record.id, 'deadline', e.target.value)}
                                                                className={`font-mono text-[11px] px-1.5 py-0.5 rounded border w-28 ${
                                                                    item.currentDeadline 
                                                                    ? 'border-slate-200 text-slate-600 bg-white' 
                                                                    : 'border-rose-300 text-rose-800 bg-rose-50/50 font-semibold'
                                                                } outline-none focus:border-blue-500`}
                                                            />
                                                        </div>
                                                        {!item.currentDeadline && (
                                                            <span className="text-[9px] text-rose-600 font-medium italic pl-14">
                                                                🔍 {item.deadlineSource}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Handover Dates Cell */}
                                                <td className="px-4 py-3">
                                                    {isHandedOver ? (
                                                        <div className="flex flex-col gap-2">
                                                            {/* completedDate */}
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[10px] font-bold text-slate-400 w-14">Hoàn thành:</span>
                                                                <span className={`font-mono px-1 py-0.5 rounded text-[10px] shrink-0 ${
                                                                    item.currentCompletedDate ? 'text-slate-500 font-normal' : 'text-red-500 bg-red-50 font-bold'
                                                                }`}>
                                                                    {item.currentCompletedDate || 'Trống'}
                                                                </span>
                                                                <ArrowRight size={10} className="text-slate-400 shrink-0" />
                                                                <input
                                                                    id={`input_comp_date_${item.record.id}`}
                                                                    type="date"
                                                                    value={editedCompletedDate}
                                                                    onChange={(e) => handleManualDateChange(item.record.id, 'completedDate', e.target.value)}
                                                                    className={`font-mono text-[11px] px-1.5 py-0.5 rounded border w-28 ${
                                                                        item.currentCompletedDate 
                                                                        ? 'border-slate-200 text-slate-600 bg-white' 
                                                                        : 'border-purple-300 text-purple-800 bg-purple-50/50 font-semibold'
                                                                    } outline-none focus:border-blue-500`}
                                                                />
                                                            </div>
                                                            {!item.currentCompletedDate && (
                                                                <span className="text-[9px] text-purple-600 font-medium italic pl-14">
                                                                    🔍 {item.completedDateSource}
                                                                </span>
                                                            )}

                                                            {/* exportDate */}
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <span className="text-[10px] font-bold text-slate-400 w-14">Ngày xuất:</span>
                                                                <span className={`font-mono px-1 py-0.5 rounded text-[10px] shrink-0 ${
                                                                    item.currentExportDate ? 'text-slate-500 font-normal' : 'text-red-500 bg-red-50 font-bold'
                                                                }`}>
                                                                    {item.currentExportDate || 'Trống'}
                                                                </span>
                                                                <ArrowRight size={10} className="text-slate-400 shrink-0" />
                                                                <input
                                                                    id={`input_exp_date_${item.record.id}`}
                                                                    type="date"
                                                                    value={editedExportDate}
                                                                    onChange={(e) => handleManualDateChange(item.record.id, 'exportDate', e.target.value)}
                                                                    className={`font-mono text-[11px] px-1.5 py-0.5 rounded border w-28 ${
                                                                        item.currentExportDate 
                                                                        ? 'border-slate-200 text-slate-600 bg-white' 
                                                                        : 'border-indigo-300 text-indigo-800 bg-indigo-50/50 font-semibold'
                                                                    } outline-none focus:border-blue-500`}
                                                                />
                                                            </div>
                                                            {!item.currentExportDate && (
                                                                <span className="text-[9px] text-indigo-600 font-medium italic pl-14">
                                                                    🔍 {item.exportDateSource}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 italic text-[11px] font-medium">
                                                            Chưa giao 1 cửa (Không có đợt)
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>

                                            {/* EXPANDED ROW DETAIL TUNING */}
                                            {expandedRecordId === item.record.id && expandedRecordEdits && (
                                                <tr className="bg-indigo-50/20 border-y border-indigo-100">
                                                    <td colSpan={6} className="p-4">
                                                        <div className="bg-white rounded-xl border border-indigo-100 shadow-sm flex flex-col gap-4 p-4">
                                                            {/* Header */}
                                                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                                                        <Calendar size={18} />
                                                                    </span>
                                                                    <div>
                                                                        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                                                                            Cấu hình Trạng thái & Tiến độ chi tiết quy trình
                                                                        </h4>
                                                                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                                                            Mã hồ sơ: <span className="font-mono font-bold text-slate-600 bg-slate-100 px-1 py-0.5 rounded">{item.record.code}</span> - {item.record.customerName}
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={handleAutoClearFutureDates}
                                                                        className="px-2.5 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-[10px] font-bold hover:bg-amber-100 transition-all flex items-center gap-1 cursor-pointer"
                                                                        title="Xóa nhanh mốc thời gian của các bước sau trạng thái hiện tại"
                                                                    >
                                                                        🧹 Dọn ngày thừa phía sau
                                                                    </button>
                                                                    
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleSaveExpandedEdits(item.record)}
                                                                        disabled={updating}
                                                                        className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                                                                    >
                                                                        <Save size={12} /> {updating ? 'Đang lưu...' : 'Lưu hồ sơ này'}
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Body */}
                                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                                {/* Column 1: Status selection */}
                                                                <div className="flex flex-col gap-2.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 justify-between">
                                                                    <div className="flex flex-col gap-1.5">
                                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                                                            Trạng thái quy trình
                                                                        </label>
                                                                        <select
                                                                            value={expandedRecordEdits.status}
                                                                            onChange={(e) => handleExpandedEditChange('status', e.target.value as RecordStatus)}
                                                                            className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 bg-white focus:border-indigo-500 outline-none cursor-pointer"
                                                                        >
                                                                            {Object.values(RecordStatus).map((st) => (
                                                                                <option key={st} value={st}>
                                                                                    {st}
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                    <p className="text-[9px] text-slate-400 leading-relaxed font-medium">
                                                                        * Thay đổi trạng thái hồ sơ về đúng bước thực tế nếu hồ sơ bị gán nhầm sang Đã trả kết quả. Bấm dọn dẹp ngày thừa để tự động dọn mốc ngày không hợp lệ.
                                                                    </p>
                                                                </div>

                                                                {/* Column 2: Stage 1 */}
                                                                <div className="flex flex-col gap-3">
                                                                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider pb-1 border-b border-indigo-100/40">
                                                                        1. Nhận & Giao việc
                                                                    </span>
                                                                    
                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="text-[10px] font-bold text-slate-500">Ngày tiếp nhận:</span>
                                                                        <input
                                                                            type="date"
                                                                            value={expandedRecordEdits.receivedDate}
                                                                            onChange={(e) => handleExpandedEditChange('receivedDate', e.target.value)}
                                                                            className="p-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white outline-none focus:border-indigo-500"
                                                                        />
                                                                    </div>

                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="text-[10px] font-bold text-slate-500">Hạn trả (SLA):</span>
                                                                        <input
                                                                            type="date"
                                                                            value={expandedRecordEdits.deadline}
                                                                            onChange={(e) => handleExpandedEditChange('deadline', e.target.value)}
                                                                            className="p-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white outline-none focus:border-indigo-500"
                                                                        />
                                                                    </div>

                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="text-[10px] font-bold text-slate-500">Ngày giao nhân viên:</span>
                                                                        <input
                                                                            type="date"
                                                                            value={expandedRecordEdits.assignedDate}
                                                                            onChange={(e) => handleExpandedEditChange('assignedDate', e.target.value)}
                                                                            className="p-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white outline-none focus:border-indigo-500"
                                                                        />
                                                                    </div>
                                                                </div>

                                                                {/* Column 3: Stage 2 */}
                                                                <div className="flex flex-col gap-3">
                                                                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider pb-1 border-b border-indigo-100/40">
                                                                        2. Thực hiện & Kiểm tra
                                                                    </span>

                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="text-[10px] font-bold text-slate-500">Ngày làm xong (CV):</span>
                                                                        <input
                                                                            type="date"
                                                                            value={expandedRecordEdits.completedWorkDate}
                                                                            onChange={(e) => handleExpandedEditChange('completedWorkDate', e.target.value)}
                                                                            className="p-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white outline-none focus:border-indigo-500"
                                                                        />
                                                                    </div>

                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="text-[10px] font-bold text-slate-500">Ngày trình kiểm tra:</span>
                                                                        <input
                                                                            type="date"
                                                                            value={expandedRecordEdits.pendingCheckDate}
                                                                            onChange={(e) => handleExpandedEditChange('pendingCheckDate', e.target.value)}
                                                                            className="p-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white outline-none focus:border-indigo-500"
                                                                        />
                                                                    </div>

                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="text-[10px] font-bold text-slate-500">Ngày đã kiểm tra:</span>
                                                                        <input
                                                                            type="date"
                                                                            value={expandedRecordEdits.checkedDate}
                                                                            onChange={(e) => handleExpandedEditChange('checkedDate', e.target.value)}
                                                                            className="p-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white outline-none focus:border-indigo-500"
                                                                        />
                                                                    </div>
                                                                </div>

                                                                {/* Column 4: Stage 3 */}
                                                                <div className="flex flex-col gap-3">
                                                                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider pb-1 border-b border-indigo-100/40">
                                                                        3. Trình ký & Bàn giao
                                                                    </span>

                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <div className="flex flex-col gap-1">
                                                                            <span className="text-[10px] font-bold text-slate-500">Trình ký:</span>
                                                                            <input
                                                                                type="date"
                                                                                value={expandedRecordEdits.submissionDate}
                                                                                onChange={(e) => handleExpandedEditChange('submissionDate', e.target.value)}
                                                                                className="p-1 border border-slate-200 rounded-lg text-[11px] font-mono bg-white outline-none focus:border-indigo-500"
                                                                            />
                                                                        </div>
                                                                        <div className="flex flex-col gap-1">
                                                                            <span className="text-[10px] font-bold text-slate-500">Ký duyệt:</span>
                                                                            <input
                                                                                type="date"
                                                                                value={expandedRecordEdits.approvalDate}
                                                                                onChange={(e) => handleExpandedEditChange('approvalDate', e.target.value)}
                                                                                className="p-1 border border-slate-200 rounded-lg text-[11px] font-mono bg-white outline-none focus:border-indigo-500"
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <div className="flex flex-col gap-1">
                                                                            <span className="text-[10px] font-bold text-slate-500">Giao 1 cửa:</span>
                                                                            <input
                                                                                type="date"
                                                                                value={expandedRecordEdits.completedDate}
                                                                                onChange={(e) => handleExpandedEditChange('completedDate', e.target.value)}
                                                                                className="p-1 border border-slate-200 rounded-lg text-[11px] font-mono bg-white outline-none focus:border-indigo-500"
                                                                            />
                                                                        </div>
                                                                        <div className="flex flex-col gap-1">
                                                                            <span className="text-[10px] font-bold text-slate-500">Xuất báo cáo:</span>
                                                                            <input
                                                                                type="date"
                                                                                value={expandedRecordEdits.exportDate}
                                                                                onChange={(e) => handleExpandedEditChange('exportDate', e.target.value)}
                                                                                className="p-1 border border-slate-200 rounded-lg text-[11px] font-mono bg-white outline-none focus:border-indigo-500"
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="text-[10px] font-bold text-slate-500">Ngày trả kết quả dân:</span>
                                                                        <input
                                                                            type="date"
                                                                            value={expandedRecordEdits.resultReturnedDate}
                                                                            onChange={(e) => handleExpandedEditChange('resultReturnedDate', e.target.value)}
                                                                            className="p-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white outline-none focus:border-indigo-500"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
                
                {/* Pagination / Table Footer */}
                <div id="table_footer" className="p-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0 rounded-b-xl">
                    <div className="text-[11px] text-slate-500 font-medium flex flex-col gap-0.5">
                        <p>Tổng cộng phát hiện <strong className="text-slate-700">{filteredResults.length}</strong> hồ sơ khuyết ngày trong bộ lọc.</p>
                        <p>Đang chọn <strong className="text-blue-600">{selectedRecordIds.size}</strong> hồ sơ để đồng bộ.</p>
                    </div>
                    
                    {/* Pagination controls to avoid rendering-lag */}
                    {totalPages > 1 && (
                        <div className="flex items-center gap-2">
                            <button
                                id="btn_prev_page"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                className="p-1 px-2.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                                <ChevronLeft size={14} /> Trước
                            </button>
                            <span className="text-xs font-bold text-slate-600 px-2">
                                Trang {currentPage} / {totalPages}
                            </span>
                            <button
                                id="btn_next_page"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                className="p-1 px-2.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                                Tiếp <ChevronRight size={14} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SuaDoiNgayTab;

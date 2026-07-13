
import { RecordFile, RecordStatus, Employee, Holiday } from '../types';
import { STATUS_LABELS, REGISTRATION_PROCEDURES } from '../constants';

// --- HÀM TIỆN ÍCH CHO PHÂN HỆ HỒ SƠ ---
export function getSolarDateFromLunar(lunarDay: number, lunarMonth: number, year: number): Date | null {
    if (lunarMonth === 1) { 
        if (year === 2024) return new Date(2024, 1, lunarDay + 9);
        if (year === 2025) return new Date(2025, 0, lunarDay + 28);
        if (year === 2026) return new Date(2026, 1, lunarDay + 16); 
        if (year === 2027) return new Date(2027, 1, lunarDay + 5);
    }
    if (lunarMonth === 3 && lunarDay === 10) { 
        if (year === 2024) return new Date(2024, 3, 18);
        if (year === 2025) return new Date(2025, 3, 7);
        if (year === 2026) return new Date(2026, 3, 26);
        if (year === 2027) return new Date(2027, 3, 16);
    }
    return null;
}

export function formatDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function parseSafeDate(dateStr?: string | null): Date | null {
    if (!dateStr) return null;
    let d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
        return d;
    }
    const cleanStr = dateStr.trim();
    if (cleanStr.match(/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}/)) {
        const parts = cleanStr.split(/[\/-]/);
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const yearPart = parts[2].trim();
        const yearMatch = yearPart.match(/^(\d{4})/);
        if (yearMatch) {
            const year = parseInt(yearMatch[1], 10);
            const dateObj = new Date(year, month - 1, day);
            const timeMatch = yearPart.match(/(\d{1,2}):(\d{1,2})/);
            if (timeMatch) {
                dateObj.setHours(parseInt(timeMatch[1], 10));
                dateObj.setMinutes(parseInt(timeMatch[2], 10));
            }
            if (!isNaN(dateObj.getTime())) {
                return dateObj;
            }
        }
    }
    return null;
}

export function formatDate(dateStr?: string | null, onlyDate?: boolean): string {
    if (!dateStr) return '';
    const date = parseSafeDate(dateStr);
    if (!date) {
        if (dateStr.trim().match(/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}$/)) {
            return dateStr.trim();
        }
        return '';
    }
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    
    if (!onlyDate && (dateStr.includes('T') || dateStr.includes(' '))) {
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${h}:${min} - ${d}/${m}/${y}`;
    }
    return `${d}/${m}/${y}`;
}

export function calculateDeadline(type: string, receivedDateStr: string, holidays: Holiday[] = [], hasTax?: boolean): string {
    if (!receivedDateStr) return '';
    let daysToAdd = 30; 
    const lowerType = (type || '').trim().toLowerCase();

    if (lowerType.startsWith('1.') || isArchiveType(type)) {
        daysToAdd = 10;
    } else if (lowerType.startsWith('2.') || isMeasurementType(type)) {
        if (lowerType.includes('cmđ') || lowerType.includes('cmd')) {
            daysToAdd = 2;
        } else if (lowerType.includes('trích đo') || lowerType.includes('cắm mốc') || lowerType.includes('tách')) {
            daysToAdd = 30;
        } else {
            daysToAdd = 10;
        }
    } else if (lowerType.startsWith('3.') || isRegType(type)) {
        if (lowerType.includes('3.1') || lowerType.includes('thừa kế') ||
            lowerType.includes('3.2') || lowerType.includes('tặng cho') ||
            lowerType.includes('3.3') || lowerType.includes('chuyển nhượng') ||
            lowerType.includes('3.4') || lowerType.includes('thỏa thuận') || lowerType.includes('vbtt')) {
            // Thừa kế (3.1), Tặng cho (3.2), Chuyển nhượng (3.3), Thỏa thuận (3.4)
            // 8 ngày (không thuế) | 13 ngày (có thuế). Mặc định là có thuế (13 ngày)
            daysToAdd = 13;
        } else if (lowerType.includes('3.6') || lowerType.includes('cấp đổi')) {
            // Cấp đổi (3.6): 10 ngày (không thuế) | 15 ngày (có thuế)
            daysToAdd = hasTax ? 15 : 10;
        } else {
            daysToAdd = 30;
        }
    } else if (lowerType.includes('cmđ') || lowerType.includes('cmd')) {
        daysToAdd = 2;
    }
    
    // Note: The user requested that the receipt's appointment date (expected) should NOT include the financial obligation payment time.
    // So even if hasTax is true, we do not add the 10 tax days for the initial appointment deadline on receipt.
    const hoursToAdd = daysToAdd * 8;
    const finalDate = addWorkingTime(receivedDateStr, `${hoursToAdd} giờ`, holidays);
    return formatDateKey(finalDate);
}

export function addWorkingTime(startDate: Date | string, durationStr: string, holidays: Holiday[] = [], stepLabel: string = ''): Date {
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const lowerLabel = (stepLabel || '').toLowerCase();
    const duration = durationStr.toLowerCase();
    
    // Check if the step is calendar days (niêm yết / xã niêm yết / công văn)
    const isCalDays = lowerLabel.includes("niêm yết") || lowerLabel.includes("công văn") || lowerLabel.includes("ngày nghỉ") || lowerLabel.includes("ko ke ngay nghi");

    if (isCalDays) {
        const days = parseInt(duration) || 0;
        const res = new Date(start);
        res.setDate(res.getDate() + days);
        return res;
    }

    const holidaySet = new Set<string>();
    const startYear = start.getFullYear();
    [startYear, startYear + 1, startYear + 2].forEach(year => {
        (holidays || []).forEach(h => {
            if (h.isLunar) {
                const solar = getSolarDateFromLunar(h.day, h.month, year);
                if (solar) holidaySet.add(formatDateKey(solar));
            } else {
                const solar = new Date(year, h.month - 1, h.day);
                holidaySet.add(formatDateKey(solar));
            }
        });
    });

    let currentDate = new Date(start);

    if (duration.includes('ngày')) {
        const daysToAdd = parseInt(duration) || 0;
        let countedDays = 0;
        while (countedDays < daysToAdd) {
            currentDate.setDate(currentDate.getDate() + 1);
            const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
            const dateString = formatDateKey(currentDate);
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isHoliday = holidaySet.has(dateString);
            if (!isWeekend && !isHoliday) {
                countedDays++;
            }
        }
    } else if (duration.includes('giờ')) {
        const hoursToAdd = parseInt(duration) || 0;
        if (hoursToAdd >= 8) {
            const daysToAdd = Math.floor(hoursToAdd / 8);
            let countedDays = 0;
            while (countedDays < daysToAdd) {
                currentDate.setDate(currentDate.getDate() + 1);
                const dayOfWeek = currentDate.getDay();
                const dateString = formatDateKey(currentDate);
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const isHoliday = holidaySet.has(dateString);
                if (!isWeekend && !isHoliday) {
                    countedDays++;
                }
            }
            const remainingHours = hoursToAdd % 8;
            if (remainingHours > 0) {
                currentDate.setHours(currentDate.getHours() + remainingHours);
            }
        } else {
            let hoursRemaining = hoursToAdd;
            while (hoursRemaining > 0) {
                currentDate.setHours(currentDate.getHours() + 1);
                const dayOfWeek = currentDate.getDay();
                const dateString = formatDateKey(currentDate);
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const isHoliday = holidaySet.has(dateString);
                if (isWeekend || isHoliday) {
                    currentDate.setDate(currentDate.getDate() + 1);
                    currentDate.setHours(8, 0, 0, 0);
                } else {
                    hoursRemaining--;
                }
            }
        }
    }

    return currentDate;
}

export function getStatusLabel(status: RecordStatus, recordType?: string | null, record?: RecordFile): string {
    if (record && isRegType(record.recordType || recordType)) {
        const terminalStatuses = [RecordStatus.RETURNED, RecordStatus.WITHDRAWN, RecordStatus.REJECTED];
        if (!terminalStatuses.includes(status)) {
            try {
                const helper = getGcnWorkflowStepsHelper(record, []);
                if (helper && helper.steps) {
                    const currentStep = helper.steps.find(s => s.status === 'current');
                    if (currentStep) {
                        return currentStep.label;
                    }
                }
            } catch (e) {}
        }
    }
    return STATUS_LABELS[status] || status;
}

export function isMeasurementType(recordType: string | null | undefined): boolean {
    if (!recordType) return false;
    const t = recordType.trim().toLowerCase();
    if (t.startsWith('1.')) return false;
    if (t.startsWith('2.')) return true;
    if (t.startsWith('3.')) return false;
    return t.includes('đo đạc') || 
           t.includes('trích đo') || 
           t.includes('cắm mốc') || 
           t.includes('trích lục') || 
           t.includes('số thửa');
}

export function isArchiveType(recordType: string | null | undefined): boolean {
    if (!recordType) return false;
    const t = recordType.trim().toLowerCase();
    if (t.startsWith('1.')) return true;
    if (t.startsWith('2.')) return false;
    if (t.startsWith('3.')) return false;
    return t.includes('lưu trữ') || 
           t.includes('sao lục') || 
           t.includes('công văn') || 
           t.includes('cung cấp dữ liệu') || 
           t.includes('cung cấp tài liệu') || 
           t.includes('cung cấp thông tin');
}

// --- HÀM TIỆN ÍCH XỬ LÝ CHUỖI TIẾNG VIỆT ---
export function removeVietnameseTones(str: string): string {
    if (!str) return '';
    str = str.toLowerCase();
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); 
    str = str.replace(/\u02C6|\u0306|\u031B/g, ""); 
    str = str.replace(/ + /g, " ");
    str = str.trim();
    return str;
}

export function isDefaultTaxProcedure(type: string | null | undefined): boolean {
    if (!type) return false;
    const t = removeVietnameseTones(type).toLowerCase();
    return ['thua ke', 'tang cho', 'chuyen nhuong', 'thoa thuan', 'chuyen muc dich', 'tach thua', 'hop thua', 'tach - hop'].some(keyword => t.includes(keyword));
}

export function isRegType(type: string | null | undefined): boolean {
    if (!type) return false;
    const t = type.trim().toLowerCase();
    if (t.startsWith('1.')) return false;
    if (t.startsWith('2.')) return false;
    if (t.startsWith('3.')) return true;
    const REG_PROCEDURES = [
        "đăng ký", "cấp giấy", "cấp đổi", "cấp lại", "giao đất", "thu hồi",
        "chuyển mục đích", "gia hạn", "thừa kế", "tặng cho", "chuyển nhượng", "thế chấp", "xóa thế chấp"
    ];
    return t === 'đăng ký' || t === 'cấp giấy' || t === 'cấp đổi' || t === 'cấp lại' || REG_PROCEDURES.some(p => t.includes(p));
}

export interface GcnStepConfig {
    label: string;
    duration: string;
    overallStatus: RecordStatus;
    deadlineDate?: Date | null;
    isOverdue?: boolean;
    isUrgent?: boolean;
    status?: 'completed' | 'current' | 'upcoming';
}

export function isStepHiddenForWorkflow(stepLabel: string, workflowType: string): boolean {
    const label = stepLabel.toLowerCase();
    
    // For the new Cấp lại workflows, we do NOT hide any steps!
    if (['quy_trinh_4', 'quy_trinh_5', 'quy_trinh_6', 'quy_trinh_7'].includes(workflowType)) {
        return false;
    }

    const isTaxWorkflow = ['quy_trinh_1', 'quy_trinh_2', 'quy_trinh_6', 'quy_trinh_7'].includes(workflowType);

    if (label.includes("dnlis")) {
        return workflowType !== 'quy_trinh_1';
    }
    if (label.includes("phiếu chuyển")) {
        return !isTaxWorkflow;
    }
    if (label.includes("trình ký thuế") || label.includes("tbt")) {
        return !isTaxWorkflow;
    }
    return false;
}

export interface GcnWorkflow {
    id: string;
    title: string;
    steps: {
        label: string;
        duration: string;
        overallStatus: RecordStatus;
    }[];
}

export function getGcnWorkflowsList(): GcnWorkflow[] {
    const defaults: GcnWorkflow[] = [
        {
            id: 'quy_trinh_1',
            title: 'Quy trình 1: DNLIS',
            steps: [
                { label: "Tiếp nhận", duration: "4 giờ", overallStatus: RecordStatus.RECEIVED },
                { label: "DNLIS", duration: "8 giờ", overallStatus: RecordStatus.IN_PROGRESS },
                { label: "Phiếu chuyển Thuế", duration: "16 giờ", overallStatus: RecordStatus.IN_PROGRESS },
                { label: "TBT", duration: "0 giờ", overallStatus: RecordStatus.TBT },
                { label: "In GCN", duration: "5 ngày", overallStatus: RecordStatus.IN_PROGRESS },
                { label: "Thẩm tra", duration: "8 giờ", overallStatus: RecordStatus.PENDING_CHECK },
                { label: "Trình ký", duration: "4 giờ", overallStatus: RecordStatus.PENDING_SIGN },
                { label: "Vô số GCN", duration: "4 giờ", overallStatus: RecordStatus.SIGNED },
                { label: "Đã giao 1 cửa", duration: "4 giờ", overallStatus: RecordStatus.HANDOVER },
                { label: "Đã trả kết quả", duration: "0 giờ", overallStatus: RecordStatus.RETURNED }
            ]
        },
        {
            id: 'quy_trinh_2',
            title: 'Quy trình 2: Phiếu Chuyển Thuế',
            steps: [
                { label: "Tiếp nhận", duration: "4 giờ", overallStatus: RecordStatus.RECEIVED },
                { label: "DNLIS", duration: "0 giờ", overallStatus: RecordStatus.IN_PROGRESS },
                { label: "Phiếu chuyển Thuế", duration: "24 giờ", overallStatus: RecordStatus.IN_PROGRESS },
                { label: "TBT", duration: "0 giờ", overallStatus: RecordStatus.TBT },
                { label: "In GCN", duration: "5 ngày", overallStatus: RecordStatus.IN_PROGRESS },
                { label: "Thẩm tra", duration: "8 giờ", overallStatus: RecordStatus.PENDING_CHECK },
                { label: "Trình ký", duration: "4 giờ", overallStatus: RecordStatus.PENDING_SIGN },
                { label: "Vô số GCN", duration: "4 giờ", overallStatus: RecordStatus.SIGNED },
                { label: "Đã giao 1 cửa", duration: "4 giờ", overallStatus: RecordStatus.HANDOVER },
                { label: "Đã trả kết quả", duration: "0 giờ", overallStatus: RecordStatus.RETURNED }
            ]
        },
        {
            id: 'quy_trinh_3',
            title: 'Quy trình 3: In GCN',
            steps: [
                { label: "Tiếp nhận", duration: "4 giờ", overallStatus: RecordStatus.RECEIVED },
                { label: "In GCN", duration: "5 ngày", overallStatus: RecordStatus.IN_PROGRESS },
                { label: "Thẩm tra", duration: "8 giờ", overallStatus: RecordStatus.PENDING_CHECK },
                { label: "Trình ký", duration: "4 giờ", overallStatus: RecordStatus.PENDING_SIGN },
                { label: "Vô số GCN", duration: "4 giờ", overallStatus: RecordStatus.SIGNED },
                { label: "Đã giao 1 cửa", duration: "4 giờ", overallStatus: RecordStatus.HANDOVER },
                { label: "Đã trả kết quả", duration: "0 giờ", overallStatus: RecordStatus.RETURNED }
            ]
        },
        {
            id: 'quy_trinh_4',
            title: 'Quy trình 4: Cấp lại không thuế (Có đối chiếu SMK)',
            steps: [
                { label: "Tiếp nhận", duration: "4 giờ", overallStatus: RecordStatus.RECEIVED },
                { label: "BB Mộc Kê", duration: "1 ngày", overallStatus: RecordStatus.IN_PROGRESS },
                { label: "BB Thế chấp", duration: "1 ngày", overallStatus: RecordStatus.IN_PROGRESS },
                { label: "Niêm yết", duration: "22 ngày", overallStatus: RecordStatus.IN_PROGRESS },
                { label: "In GCN", duration: "3 ngày", overallStatus: RecordStatus.IN_PROGRESS },
                { label: "Thẩm tra", duration: "2 ngày", overallStatus: RecordStatus.PENDING_CHECK },
                { label: "Trình ký", duration: "1 ngày", overallStatus: RecordStatus.PENDING_SIGN },
                { label: "Vô số GCN", duration: "1 ngày", overallStatus: RecordStatus.SIGNED },
                { label: "Đã giao 1 cửa", duration: "1 ngày", overallStatus: RecordStatus.HANDOVER },
                { label: "Đã trả kết quả", duration: "0 giờ", overallStatus: RecordStatus.RETURNED }
            ]
        },
        {
            id: 'quy_trinh_5',
            title: 'Quy trình 5: Cấp lại không thuế (Đã đối chiếu SMK)',
            steps: [
                { label: "Tiếp nhận", duration: "4 giờ", overallStatus: RecordStatus.RECEIVED },
                { label: "BB Thế chấp", duration: "1 ngày", overallStatus: RecordStatus.IN_PROGRESS },
                { label: "Niêm yết", duration: "22 ngày", overallStatus: RecordStatus.IN_PROGRESS },
                { label: "In GCN", duration: "3 ngày", overallStatus: RecordStatus.IN_PROGRESS },
                { label: "Thẩm tra", duration: "2 ngày", overallStatus: RecordStatus.PENDING_CHECK },
                { label: "Trình ký", duration: "1 ngày", overallStatus: RecordStatus.PENDING_SIGN },
                { label: "Vô số GCN", duration: "1 ngày", overallStatus: RecordStatus.SIGNED },
                { label: "Đã giao 1 cửa", duration: "1 ngày", overallStatus: RecordStatus.HANDOVER },
                { label: "Đã trả kết quả", duration: "0 giờ", overallStatus: RecordStatus.RETURNED }
            ]
        },
        {
            id: 'quy_trinh_6',
            title: 'Quy trình 6: Cấp lại có thuế (Có đối chiếu SMK)',
            steps: [
                { label: "Tiếp nhận", duration: "4 giờ", overallStatus: RecordStatus.RECEIVED },
                { label: "BB Mộc Kê", duration: "1 ngày", overallStatus: RecordStatus.IN_PROGRESS },
                { label: "BB Thế chấp", duration: "1 ngày", overallStatus: RecordStatus.IN_PROGRESS },
                { label: "Niêm yết", duration: "22 ngày", overallStatus: RecordStatus.IN_PROGRESS },
                { label: "Phiếu chuyển Thuế", duration: "2 ngày", overallStatus: RecordStatus.IN_PROGRESS },
                { label: "TBT", duration: "---", overallStatus: RecordStatus.TBT },
                { label: "In GCN", duration: "3 ngày", overallStatus: RecordStatus.IN_PROGRESS },
                { label: "Thẩm tra", duration: "2 ngày", overallStatus: RecordStatus.PENDING_CHECK },
                { label: "Trình ký", duration: "1 ngày", overallStatus: RecordStatus.PENDING_SIGN },
                { label: "Vô số GCN", duration: "1 ngày", overallStatus: RecordStatus.SIGNED },
                { label: "Đã giao 1 cửa", duration: "1 ngày", overallStatus: RecordStatus.HANDOVER },
                { label: "Đã trả kết quả", duration: "0 giờ", overallStatus: RecordStatus.RETURNED }
            ]
        },
        {
            id: 'quy_trinh_7',
            title: 'Quy trình 7: Cấp lại có thuế (Đã đối chiếu SMK)',
            steps: [
                { label: "Tiếp nhận", duration: "4 giờ", overallStatus: RecordStatus.RECEIVED },
                { label: "BB Thế chấp", duration: "1 ngày", overallStatus: RecordStatus.IN_PROGRESS },
                { label: "Niêm yết", duration: "22 ngày", overallStatus: RecordStatus.IN_PROGRESS },
                { label: "Phiếu chuyển Thuế", duration: "2 ngày", overallStatus: RecordStatus.IN_PROGRESS },
                { label: "TBT", duration: "---", overallStatus: RecordStatus.TBT },
                { label: "In GCN", duration: "3 ngày", overallStatus: RecordStatus.IN_PROGRESS },
                { label: "Thẩm tra", duration: "2 ngày", overallStatus: RecordStatus.PENDING_CHECK },
                { label: "Trình ký", duration: "1 ngày", overallStatus: RecordStatus.PENDING_SIGN },
                { label: "Vô số GCN", duration: "1 ngày", overallStatus: RecordStatus.SIGNED },
                { label: "Đã giao 1 cửa", duration: "1 ngày", overallStatus: RecordStatus.HANDOVER },
                { label: "Đã trả kết quả", duration: "0 giờ", overallStatus: RecordStatus.RETURNED }
            ]
        }
    ];

    try {
        const savedCustom = localStorage.getItem('gcn_custom_workflows');
        if (savedCustom) {
            const parsed = JSON.parse(savedCustom);
            if (Array.isArray(parsed)) {
                return [...defaults, ...parsed];
            }
        }
    } catch (e) {
        // ignore
    }
    return defaults;
}

export function getGcnWorkflowStepsHelper(record: RecordFile, holidays: Holiday[] = []): {
    type: string;
    title: string;
    steps: GcnStepConfig[];
    currentStepIndex: number;
} {
    const isPreJuly2025 = (() => {
        const dateStr = record.issueDate || record.receivedDate || record.assignedDate;
        if (!dateStr) return true;
        const date = new Date(dateStr);
        const targetDate = new Date('2025-07-01');
        return date < targetDate;
    })();

    let workflowType = record.gcnWorkflowType;
    if (!workflowType) {
        const rType = (record.recordType || '').toLowerCase();
        if (rType.includes('cấp lại') || rType.includes('3.7')) {
            if (record.hasTax) {
                workflowType = record.hasCheckedSMK ? 'quy_trinh_7' : 'quy_trinh_6';
            } else {
                workflowType = record.hasCheckedSMK ? 'quy_trinh_5' : 'quy_trinh_4';
            }
        } else if (!record.hasTax && !isDefaultTaxProcedure(record.recordType)) {
            workflowType = 'quy_trinh_3';
        } else if (isPreJuly2025 || rType.includes('tách - hợp') || rType.includes('tách thửa') || rType.includes('hợp thửa') || rType.includes('3.8')) {
            workflowType = 'quy_trinh_1';
        } else {
            workflowType = 'quy_trinh_2';
        }
    }

    let stepConfigs: GcnStepConfig[] = [];
    let title = '';

    const allWorkflows = getGcnWorkflowsList();
    const matchedWf = allWorkflows.find(w => w.id === workflowType);
    if (matchedWf) {
        title = matchedWf.title;
        stepConfigs = matchedWf.steps.map(s => ({
            label: s.label,
            duration: s.duration,
            overallStatus: s.overallStatus
        }));
    } else {
        // Fallback to the first workflow if not found
        const firstWf = allWorkflows[0];
        title = firstWf.title;
        stepConfigs = firstWf.steps.map(s => ({
            label: s.label,
            duration: s.duration,
            overallStatus: s.overallStatus
        }));
    }

    // Load SLA configuration from local storage, fallback to the default durations specified in stepConfigs
    let customSlaConfig: Record<string, Record<string, string>> = {};
    try {
        const savedSla = localStorage.getItem('sla_config_gcn');
        if (savedSla) {
            customSlaConfig = JSON.parse(savedSla);
        }
    } catch (e) {
        // Silence storage warning for SSR or test environments
    }

    stepConfigs = stepConfigs.map(s => {
        const isHidden = isStepHiddenForWorkflow(s.label, workflowType);
        if (isHidden) {
            return {
                ...s,
                duration: "0 giờ"
            };
        }
        
        const customDuration = customSlaConfig[workflowType]?.[s.label];
        const finalDuration = customDuration !== undefined ? customDuration : s.duration;
        return {
            ...s,
            duration: finalDuration
        };
    });

    // Determine current step index
    let currentStepIndex = record.currentStepIndex;
    
    const isStepIndexMatchingStatus = (index: number | undefined | null, status: RecordStatus, steps: GcnStepConfig[]): boolean => {
        if (index === undefined || index === null) return false;
        const step = steps[index];
        if (!step) return false;
        
        if (step.overallStatus === status) return true;
        if (status === RecordStatus.RECEIVED && step.label.toLowerCase().includes("tiếp nhận")) return true;
        if (status === RecordStatus.IN_PROGRESS && step.overallStatus === RecordStatus.IN_PROGRESS) return true;
        if (status === RecordStatus.COMPLETED_WORK && step.label.toLowerCase().includes("trình ký thuế")) return true;
        if (status === RecordStatus.CHECKED && step.label.toLowerCase().includes("thẩm tra")) return true;
        return false;
    };

    if (currentStepIndex === undefined || currentStepIndex === null || currentStepIndex >= stepConfigs.length || !isStepIndexMatchingStatus(currentStepIndex, record.status, stepConfigs)) {
        currentStepIndex = null;
        if (record.status === RecordStatus.RECEIVED) {
            currentStepIndex = 0;
        } else if (record.status === RecordStatus.RETURNED) {
            currentStepIndex = stepConfigs.length - 1;
        } else {
            let targetLabel = "";
            const status = record.status;
            
            if (status === RecordStatus.TBT) {
                targetLabel = "TBT";
            } else if (status === RecordStatus.PENDING_CHECK) {
                targetLabel = "Thẩm tra";
            } else if (status === RecordStatus.CHECKED) {
                targetLabel = "Thẩm tra";
            } else if (status === RecordStatus.PENDING_SIGN) {
                targetLabel = "Trình ký";
            } else if (status === RecordStatus.SIGNED) {
                targetLabel = "Vô số";
            } else if (status === RecordStatus.HANDOVER) {
                targetLabel = "cửa";
            } else if (status === RecordStatus.IN_PROGRESS) {
                const firstProgressIdx = stepConfigs.findIndex(s => s.overallStatus === RecordStatus.IN_PROGRESS);
                currentStepIndex = firstProgressIdx !== -1 ? firstProgressIdx : 0;
            } else if (status === RecordStatus.COMPLETED_WORK) {
                const compIdx = stepConfigs.findIndex(s => s.overallStatus === RecordStatus.COMPLETED_WORK);
                if (compIdx !== -1) {
                    currentStepIndex = compIdx;
                } else {
                    const trinhKyIdx = stepConfigs.findIndex(s => s.label.includes("Trình ký Thuế"));
                    currentStepIndex = trinhKyIdx !== -1 ? trinhKyIdx : 0;
                }
            }

            if (currentStepIndex === undefined || currentStepIndex === null) {
                const foundIdx = stepConfigs.findIndex(s => s.label.toLowerCase().includes(targetLabel.toLowerCase()) || targetLabel.toLowerCase().includes(s.label.toLowerCase()));
                currentStepIndex = foundIdx !== -1 ? foundIdx : 0;
            }
        }
    }

    const baseDateStr = record.assignedTo ? (record.assignedDate || record.receivedDate) : null;
    let currentAnchor = baseDateStr ? new Date(baseDateStr) : null;

    const tbtStepIdx = stepConfigs.findIndex(s => s.label.includes("TBT"));

    const steps = stepConfigs.map((step, idx) => {
        const durationStr = (step.duration || '').toLowerCase();
        let deadlineDate: Date | null = null;

        if (!currentAnchor) {
            deadlineDate = null;
        } else if (tbtStepIdx !== -1 && idx > tbtStepIdx) {
            if (!record.taxPaymentDate) {
                deadlineDate = null;
            } else {
                if (idx === tbtStepIdx + 1) {
                    currentAnchor = new Date(record.taxPaymentDate);
                }
                if (durationStr && !durationStr.includes('0') && !durationStr.includes('---')) {
                    const deadlineDateVal = addWorkingTime(currentAnchor, durationStr, holidays, step.label);
                    deadlineDate = deadlineDateVal;
                    currentAnchor = deadlineDateVal;
                }
            }
        } else {
            if (durationStr && !durationStr.includes('0') && !durationStr.includes('---')) {
                const deadlineDateVal = addWorkingTime(currentAnchor, durationStr, holidays, step.label);
                deadlineDate = deadlineDateVal;
                currentAnchor = deadlineDateVal;
            }
        }

        const isFullyCompleted = [RecordStatus.HANDOVER, RecordStatus.RETURNED].includes(record.status);
        let status: 'completed' | 'current' | 'upcoming' = 'upcoming';
        if (isFullyCompleted) {
            status = 'completed';
        } else if (idx < currentStepIndex!) {
            status = 'completed';
        } else if (idx === currentStepIndex) {
            status = 'current';
        }

        const today = new Date();
        const isOverdue = !!(record.assignedTo && deadlineDate && today > deadlineDate && status === 'current');
        
        const diffMs = deadlineDate ? deadlineDate.getTime() - today.getTime() : 0;
        const isUrgent = !!(record.assignedTo && deadlineDate && !isOverdue && status === 'current' && diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000);

        return {
            ...step,
            status,
            deadlineDate,
            isOverdue,
            isUrgent
        };
    });

    return {
        type: workflowType,
        title,
        steps,
        currentStepIndex: currentStepIndex ?? 0
    };
}

export function recordStepAssigneeHistory(record: RecordFile, holidays: Holiday[] = []): RecordFile {
    if (!record) return record;
    const cloned = { ...record };
    if (!cloned.stepAssignees) {
        cloned.stepAssignees = {};
    } else {
        cloned.stepAssignees = { ...cloned.stepAssignees };
    }
    if (!cloned.stepDates) {
        cloned.stepDates = {};
    } else {
        cloned.stepDates = { ...cloned.stepDates };
    }

    if (isRegType(cloned.recordType)) {
        const helper = getGcnWorkflowStepsHelper(cloned, holidays);
        const currentStepIdx = helper.currentStepIndex;
        const currentStep = helper.steps[currentStepIdx];
        if (currentStep) {
            const label = currentStep.label.toLowerCase().trim();
            
            // Record current step completion/assignment date if not already recorded
            if (!cloned.stepDates[label]) {
                cloned.stepDates[label] = new Date().toISOString();
            }

            if (label.includes("thẩm tra")) {
                if (cloned.checkedBy) {
                    cloned.stepAssignees[label] = cloned.checkedBy;
                }
            } else if (label.includes("trình ký") || label.includes("ký duyệt")) {
                if (cloned.submittedTo) {
                    cloned.stepAssignees[label] = cloned.submittedTo;
                }
            } else if (label.includes("nhận hồ sơ") || label.includes("tiếp nhận")) {
                if (cloned.receivedBy) {
                    cloned.stepAssignees[label] = cloned.receivedBy;
                }
            } else {
                if (cloned.assignedTo) {
                    cloned.stepAssignees[label] = cloned.assignedTo;
                }
            }
        }

        // Synchronize and back-fill dates for safety and backwards compatibility
        if (cloned.receivedDate && !cloned.stepDates["tiếp nhận"]) cloned.stepDates["tiếp nhận"] = cloned.receivedDate;
        if (cloned.assignedDate && !cloned.stepDates["giao nhân viên"]) cloned.stepDates["giao nhân viên"] = cloned.assignedDate;
        if (cloned.completedWorkDate && !cloned.stepDates["đã thực hiện"]) cloned.stepDates["đã thực hiện"] = cloned.completedWorkDate;
        if (cloned.pendingCheckDate && !cloned.stepDates["trình kiểm tra"]) cloned.stepDates["trình kiểm tra"] = cloned.pendingCheckDate;
        if (cloned.checkedDate && !cloned.stepDates["đã kiểm tra"]) cloned.stepDates["đã kiểm tra"] = cloned.checkedDate;
        if (cloned.submissionDate && !cloned.stepDates["trình ký"]) cloned.stepDates["trình ký"] = cloned.submissionDate;
        if (cloned.approvalDate && !cloned.stepDates["vô số gcn"]) cloned.stepDates["vô số gcn"] = cloned.approvalDate;
        if (cloned.completedDate && !cloned.stepDates["đã giao 1 cửa"]) cloned.stepDates["đã giao 1 cửa"] = cloned.completedDate;
        if (cloned.resultReturnedDate && !cloned.stepDates["đã trả kết quả"]) cloned.stepDates["đã trả kết quả"] = cloned.resultReturnedDate;

        // Synchronize and back-fill assignees for safety and backwards compatibility
        if (cloned.submittedTo) {
            if (!cloned.stepAssignees["trình ký"]) cloned.stepAssignees["trình ký"] = cloned.submittedTo;
            if (!cloned.stepAssignees["ký duyệt"]) cloned.stepAssignees["ký duyệt"] = cloned.submittedTo;
        }
        if (cloned.checkedBy) {
            if (!cloned.stepAssignees["thẩm tra"]) cloned.stepAssignees["thẩm tra"] = cloned.checkedBy;
            if (!cloned.stepAssignees["kiểm tra"]) cloned.stepAssignees["kiểm tra"] = cloned.checkedBy;
            if (!cloned.stepAssignees["trình kiểm tra"]) cloned.stepAssignees["trình kiểm tra"] = cloned.checkedBy;
            if (!cloned.stepAssignees["đã kiểm tra"]) cloned.stepAssignees["đã kiểm tra"] = cloned.checkedBy;
        }
        if (cloned.receivedBy) {
            if (!cloned.stepAssignees["tiếp nhận"]) cloned.stepAssignees["tiếp nhận"] = cloned.receivedBy;
            if (!cloned.stepAssignees["nhận hồ sơ"]) cloned.stepAssignees["nhận hồ sơ"] = cloned.receivedBy;
        }
        if (cloned.assignedTo) {
            const assigneeSteps = ["giao nhân viên", "dnlis", "đã thực hiện", "in gcn", "vô số gcn"];
            assigneeSteps.forEach(s => {
                if (!cloned.stepAssignees![s]) {
                    cloned.stepAssignees![s] = cloned.assignedTo!;
                }
            });
        }
    }
    return cloned;
}

// Hàm chuyển đổi Title Case (Nguyễn Văn A)
export function toTitleCase(str: string | null | undefined): string {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// --- CONFIRM ACTION WRAPPER ---
let globalConfirmCallback: null | ((message: string, title: string) => Promise<boolean>) = null;

export const setGlobalConfirmCallback = (cb: (message: string, title: string) => Promise<boolean>) => {
    globalConfirmCallback = cb;
};

// Sử dụng Native Dialog của Electron nếu có, hoặc Global Modal, hoặc fallback dùng window.confirm
export const confirmAction = async (message: string, title: string = 'Xác nhận'): Promise<boolean> => {
    if ((window as any).electronAPI && (window as any).electronAPI.showConfirmDialog) {
        // Chờ kết quả từ Main Process (không block renderer)
        return await (window as any).electronAPI.showConfirmDialog(message, title);
    }
    
    if (globalConfirmCallback) {
        return await globalConfirmCallback(message, title);
    }
    
    try {
        // Fallback cho trình duyệt web (có thể lỗi nếu sandboxed)
        return window.confirm(message);
    } catch {
        // Nếu không cho confirm (Iframe sandbox preview) -> Auto true
        return true; 
    }
};

// --- ĐỊNH NGHĨA CÁC CỘT HIỂN THỊ ---
// Updated: Căn giữa tiêu đề và điều chỉnh độ rộng theo yêu cầu
// Updated: Gộp cột Đợt vào cột Hoàn thành
export const COLUMN_DEFS = [
  { key: 'code', label: 'Mã Hồ Sơ', sortKey: 'code', className: 'w-44 text-center' },
  { key: 'customer', label: 'Thông tin chủ sử dụng', sortKey: 'customerName', className: 'w-64 text-center' }, 
  { key: 'type', label: 'Loại Hồ Sơ', sortKey: 'recordType', className: 'w-28 text-center' },
  { key: 'deadline', label: 'Thời hạn xử lý', sortKey: 'deadline', className: 'w-48 text-center' },
  { key: 'ward', label: 'Xã Phường', sortKey: 'ward', className: 'w-32 text-center' },
  { key: 'mapSheet', label: 'Tờ', sortKey: 'mapSheet', className: 'w-16 text-center' }, 
  { key: 'landPlot', label: 'Thửa', sortKey: 'landPlot', className: 'w-16 text-center' }, 
  { key: 'assigned', label: 'Giao nhân viên', sortKey: 'assignedDate', className: 'w-48 text-center' },
  { key: 'completed', label: 'Hoàn thành / Đợt', sortKey: 'completedDate', className: 'w-32 text-center' },
  { key: 'tech', label: 'TĐ / TL', sortKey: 'measurementNumber', className: 'w-20 text-center' },
  { key: 'receipt', label: 'Biên Lai', sortKey: 'receiptNumber', className: 'w-20 text-center' },
  { key: 'status', label: 'Trạng Thái', sortKey: 'status', className: 'w-32 text-center' },
];

export const DEFAULT_VISIBLE_COLUMNS = {
    code: true, 
    customer: true, 
    deadline: true,
    ward: true, 
    mapSheet: true, 
    landPlot: true, 
    assigned: true, 
    completed: true, // Mặc định hiện cột gộp này
    type: true, 
    tech: false, 
    receipt: true, 
    status: true
};

// --- CÁC HÀM CHECK LOGIC ---
export const isRecordOverdue = (record: RecordFile): boolean => {
  // 1. Kiểm tra trạng thái "Đã xong"
  const completedStatuses = [
      RecordStatus.HANDOVER,
      RecordStatus.RETURNED,
      RecordStatus.WITHDRAWN
  ];

  if (completedStatuses.includes(record.status)) return false;
  
  // 2. [QUAN TRỌNG] Kiểm tra dữ liệu thực tế (Fix lỗi trạng thái chưa cập nhật)
  // Nếu đã có ngày xuất (đã giao 1 cửa) hoặc đã có ngày trả kết quả -> Coi như đã xong -> Không quá hạn
  if (record.exportDate || record.exportBatch || record.resultReturnedDate) {
      return false;
  }
  
  if (!record.deadline) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = parseSafeDate(record.deadline);
  if (!deadline) return false;
  deadline.setHours(0, 0, 0, 0);
  return deadline < today;
};

export const isRecordApproaching = (record: RecordFile): boolean => {
  const completedStatuses = [
      RecordStatus.HANDOVER,
      RecordStatus.RETURNED,
      RecordStatus.WITHDRAWN
  ];

  if (completedStatuses.includes(record.status)) return false;
  
  // Kiểm tra dữ liệu thực tế: Nếu đã xong thì không báo sắp đến hạn
  if (record.exportDate || record.exportBatch || record.resultReturnedDate) {
      return false;
  }

  if (isRecordOverdue(record)) return false;
  
  if (!record.deadline) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = parseSafeDate(record.deadline);
  if (!deadline) return false;
  deadline.setHours(0, 0, 0, 0);
  const diffTime = deadline.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 3;
};

export interface EmployeeGroup {
  label: string;
  key: string;
  employees: Employee[];
}

export function groupEmployeesByDepartment(employees: Employee[]): EmployeeGroup[] {
  const categories = [
    { label: 'Ban Giám đốc', key: 'giamdoc', keywords: ['giam doc', 'ban giam doc', 'lanh dao'] },
    { label: 'Tổ Đo đạc', key: 'dodac', keywords: ['do dac', 'ky thuat', 'dia chinh', 'noi nghiep', 'ngoai nghiep', 'do hinh'] },
    { label: 'Tổ Cấp giấy', key: 'capgiay', keywords: ['cap giay', 'dang ky', 'bien dong', 'cap qsd', 'tham dinh'] },
    { label: 'Tổ Lưu trữ', key: 'luutru', keywords: ['luu tru', 'sao luc', 'thong tin'] },
    { label: 'Tổ Hành chính', key: 'hanhchinh', keywords: ['hanh chinh', 'van thu', 'tong hop', 'ke toan', 'ke hanh', 'bao ve', 'tap vu', 'tiep nhan', 'mot cua'] },
  ];

  const groups: Record<string, Employee[]> = {
    giamdoc: [],
    dodac: [],
    capgiay: [],
    luutru: [],
    hanhchinh: [],
    other: []
  };

  employees.forEach(emp => {
    const d = removeVietnameseTones(emp.department || '').toLowerCase();
    let matched = false;
    for (const cat of categories) {
      if (cat.keywords.some(k => d.includes(k))) {
        groups[cat.key].push(emp);
        matched = true;
        break;
      }
    }
    if (!matched) {
      groups.other.push(emp);
    }
  });

  const result: EmployeeGroup[] = [
    { label: 'Ban Giám đốc', key: 'giamdoc', employees: groups.giamdoc },
    { label: 'Tổ Đo đạc', key: 'dodac', employees: groups.dodac },
    { label: 'Tổ Cấp giấy', key: 'capgiay', employees: groups.capgiay },
    { label: 'Tổ Lưu trữ', key: 'luutru', employees: groups.luutru },
    { label: 'Tổ Hành chính', key: 'hanhchinh', employees: groups.hanhchinh },
  ];

  if (groups.other.length > 0) {
    result.push({ label: 'Bộ phận khác', key: 'other', employees: groups.other });
  }

  return result.filter(g => g.employees.length > 0);
}

export function fillTimelineDatesForReturn(record: RecordFile, nowStr: string): Partial<RecordFile> {
    const isSpecialType = !!(record.recordType && (
        record.recordType.includes('Cung cấp') || 
        record.recordType.includes('Sao lục') || 
        record.recordType.includes('Công văn')
    ));
    
    // Khởi tạo các mốc thời gian theo thứ tự luồng
    const steps = [
        { key: 'receivedDate', val: record.receivedDate },
        { key: 'assignedDate', val: record.assignedDate },
        { key: 'completedWorkDate', val: record.completedWorkDate }
    ];

    if (!isSpecialType) {
        steps.push(
            { key: 'pendingCheckDate', val: record.pendingCheckDate },
            { key: 'checkedDate', val: record.checkedDate }
        );
    }

    steps.push(
        { key: 'submissionDate', val: record.submissionDate },
        { key: 'approvalDate', val: record.approvalDate },
        { key: 'completedDate', val: record.completedDate || nowStr }
    );

    // Bước 1: Chuẩn hóa nhận
    const nowMs = new Date(nowStr).getTime();
    if (!steps[0].val) {
        // Nếu không có ngày nhận, giả định nhận trước thời điểm hiện hành 2 ngày
        steps[0].val = new Date(nowMs - 2 * 24 * 60 * 60 * 1000).toISOString();
    }
    steps[steps.length - 1].val = nowStr;

    // Bước 2: Điền các giá trị trung gian bằng nội suy tuyến tính (Linear Interpolation)
    const knownIndices: number[] = [];
    steps.forEach((step, idx) => {
        if (step.val) knownIndices.push(idx);
    });

    for (let i = 0; i < knownIndices.length - 1; i++) {
        const startIdx = knownIndices[i];
        const endIdx = knownIndices[i + 1];
        const gap = endIdx - startIdx;
        
        if (gap > 1) {
            const startTime = new Date(steps[startIdx].val!).getTime();
            const endTime = new Date(steps[endIdx].val!).getTime();
            
            let adjustedEndTime = endTime;
            if (endTime <= startTime) {
                adjustedEndTime = startTime + gap * 15 * 60 * 1000;
                steps[endIdx].val = new Date(adjustedEndTime).toISOString();
            }

            const stepMs = (adjustedEndTime - startTime) / gap;
            for (let j = 1; j < gap; j++) {
                const targetIdx = startIdx + j;
                const targetMs = startTime + stepMs * j;
                steps[targetIdx].val = new Date(targetMs).toISOString();
            }
        }
    }

    // Trả về object các mốc thời gian cập nhật
    const updates: any = {};
    steps.forEach(step => {
        updates[step.key] = step.val;
    });

    return updates;
}

export function findArchiveStaffForWard(wardName: string | null | undefined, employees: Employee[]): Employee | null {
  // Lọc nhân viên Tổ Lưu trữ
  const archiveStaff = employees.filter(emp => {
    const d = removeVietnameseTones(emp.department || '').toLowerCase();
    return d.includes('luu tru') || d.includes('archive');
  });

  if (archiveStaff.length === 0) return null;

  if (!wardName) {
    // Nếu không có địa bàn (ví dụ: Công văn), giao cho nhân viên Tổ Lưu trữ có managedWards rỗng (chuyên trách chung)
    const generalStaff = archiveStaff.find(emp => !emp.managedWards || emp.managedWards.length === 0);
    return generalStaff || archiveStaff[0] || null;
  }
  
  const normWard = removeVietnameseTones(wardName).toLowerCase().trim();
  
  // Tìm nhân viên phụ trách địa bàn này
  const matched = archiveStaff.find(emp => 
    emp.managedWards && emp.managedWards.some(w => 
      removeVietnameseTones(w).toLowerCase().trim() === normWard
    )
  );
  
  // Nếu không tìm thấy ai cụ thể cho địa bàn này, giao cho nhân viên phụ trách chung hoặc nhân viên đầu tiên
  return matched || archiveStaff.find(emp => !emp.managedWards || emp.managedWards.length === 0) || archiveStaff[0] || null;
}

export function getDisplayNotes(notes: string | null | undefined): string {
  if (!notes) return '';
  const trimmed = notes.trim();
  if (!trimmed) return '';

  const lines = trimmed.split('\n');
  const resultLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    if (trimmedLine.startsWith('{') && trimmedLine.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmedLine);
        if (parsed.generalNotes && parsed.generalNotes.trim()) {
          resultLines.push(parsed.generalNotes.trim());
        }
      } catch (e) {
        resultLines.push(line);
      }
    } else {
      resultLines.push(line);
    }
  }

  return resultLines.join('\n');
}

export function updateNotesWithDisplayText(originalNotes: string | null | undefined, newDisplayText: string): string {
  if (!originalNotes) return newDisplayText;
  const trimmed = originalNotes.trim();
  if (!trimmed) return newDisplayText;

  const lines = trimmed.split('\n');
  const resultLines: string[] = [];
  let updatedJson = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    if (trimmedLine.startsWith('{') && trimmedLine.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmedLine);
        parsed.generalNotes = newDisplayText;
        resultLines.push(JSON.stringify(parsed));
        updatedJson = true;
      } catch (e) {
        resultLines.push(line);
      }
    } else {
      resultLines.push(line);
    }
  }

  if (!updatedJson) {
    return newDisplayText;
  }

  return resultLines.join('\n');
}

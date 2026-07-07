
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

export function getStatusLabel(status: RecordStatus, recordType?: string | null): string {
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
    
    // Hide "Thẩm tra" step entirely for "cấp giấy" workflows as per user's request:
    // "bỏ phần này trong trình kiểm tra ở cả đo dạc và cấp giấy"
    if (label.includes("thẩm tra")) {
        return true;
    }
    
    // For the new Cấp lại workflows, we do NOT hide any steps!
    if (['quy_trinh_4a', 'quy_trinh_4b', 'quy_trinh_5a', 'quy_trinh_5b'].includes(workflowType)) {
        return false;
    }

    const isTaxWorkflow = ['quy_trinh_1', 'quy_trinh_2', 'quy_trinh_5a', 'quy_trinh_5b'].includes(workflowType);

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

export function getGcnWorkflowStepsHelper(record: RecordFile, holidays: Holiday[] = []): {
    type: string;
    title: string;
    steps: GcnStepConfig[];
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
                workflowType = record.hasCheckedSMK ? 'quy_trinh_5b' : 'quy_trinh_5a';
            } else {
                workflowType = record.hasCheckedSMK ? 'quy_trinh_4b' : 'quy_trinh_4a';
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

    if (workflowType === 'quy_trinh_1') {
        title = 'Quy trình 1: DNLIS';
        stepConfigs = [
            { label: "DNLIS", duration: "8 giờ", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Phiếu chuyển Thuế", duration: "16 giờ", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Trình ký Thuế", duration: "0 giờ", overallStatus: RecordStatus.PENDING_SIGN },
            { label: "TBT", duration: "0 giờ", overallStatus: RecordStatus.TBT },
            { label: "In GCN", duration: "5 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Thẩm tra", duration: "8 giờ", overallStatus: RecordStatus.PENDING_CHECK },
            { label: "Trình Ký GCN", duration: "4 giờ", overallStatus: RecordStatus.PENDING_SIGN },
            { label: "Vô số GCN", duration: "4 giờ", overallStatus: RecordStatus.SIGNED },
            { label: "Giao 1 cửa", duration: "4 giờ", overallStatus: RecordStatus.HANDOVER }
        ];
    } else if (workflowType === 'quy_trinh_2') {
        title = 'Quy trình 2: Phiếu Chuyển Thuế';
        stepConfigs = [
            { label: "DNLIS", duration: "0 giờ", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Phiếu chuyển Thuế", duration: "24 giờ", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Trình ký Thuế", duration: "0 giờ", overallStatus: RecordStatus.PENDING_SIGN },
            { label: "TBT", duration: "0 giờ", overallStatus: RecordStatus.TBT },
            { label: "In GCN", duration: "5 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Thẩm tra", duration: "8 giờ", overallStatus: RecordStatus.PENDING_CHECK },
            { label: "Trình Ký GCN", duration: "4 giờ", overallStatus: RecordStatus.PENDING_SIGN },
            { label: "Vô số GCN", duration: "4 giờ", overallStatus: RecordStatus.SIGNED },
            { label: "Giao 1 cửa", duration: "4 giờ", overallStatus: RecordStatus.HANDOVER }
        ];
    } else if (workflowType === 'quy_trinh_3') {
        title = 'Quy trình 3: In GCN';
        stepConfigs = [
            { label: "DNLIS", duration: "8 giờ", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "In GCN", duration: "5 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Thẩm tra", duration: "8 giờ", overallStatus: RecordStatus.PENDING_CHECK },
            { label: "Trình Ký GCN", duration: "4 giờ", overallStatus: RecordStatus.PENDING_SIGN },
            { label: "Vô số GCN", duration: "4 giờ", overallStatus: RecordStatus.SIGNED },
            { label: "Giao 1 cửa", duration: "4 giờ", overallStatus: RecordStatus.HANDOVER }
        ];
    } else if (workflowType === 'quy_trinh_4a') {
        title = 'Quy trình 4A: Cấp lại không thuế (Có đối chiếu SMK)';
        stepConfigs = [
            { label: "Đối chiếu Sổ mục kê, hồ sơ lưu, GCN, CSDL đất đai", duration: "1 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Kiểm tra tình trạng thế chấp/ngăn chặn", duration: "1 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Lập biên bản xác minh đủ điều kiện cấp lại", duration: "1 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Chuyển UBND xã niêm yết/đăng tin", duration: "1 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Chờ niêm yết 15 ngày + tối đa 05 ngày nhận biên bản kết thúc", duration: "20 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Tiếp nhận kết quả niêm yết", duration: "1 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Hủy GCN cũ, cập nhật DNLIS/CSDL, in GCN", duration: "3 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Thẩm tra", duration: "2 ngày", overallStatus: RecordStatus.PENDING_CHECK },
            { label: "Trình ký", duration: "1 ngày", overallStatus: RecordStatus.PENDING_SIGN },
            { label: "Vô số - Đóng dấu", duration: "1 ngày", overallStatus: RecordStatus.SIGNED },
            { label: "Chuyển Một cửa", duration: "1 ngày", overallStatus: RecordStatus.HANDOVER },
            { label: "Đã trả kết quả", duration: "0 giờ", overallStatus: RecordStatus.RETURNED }
        ];
    } else if (workflowType === 'quy_trinh_4b') {
        title = 'Quy trình 4B: Cấp lại không thuế (Đã đối chiếu SMK)';
        stepConfigs = [
            { label: "Kiểm tra tình trạng thế chấp/ngăn chặn", duration: "1 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Lập biên bản xác minh đủ điều kiện cấp lại", duration: "1 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Chuyển UBND xã niêm yết/đăng tin", duration: "1 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Chờ niêm yết 15 ngày + tối đa 05 ngày nhận biên bản kết thúc", duration: "20 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Tiếp nhận kết quả niêm yết", duration: "1 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Hủy GCN cũ, cập nhật DNLIS/CSDL, in GCN", duration: "3 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Thẩm tra", duration: "2 ngày", overallStatus: RecordStatus.PENDING_CHECK },
            { label: "Trình ký", duration: "1 ngày", overallStatus: RecordStatus.PENDING_SIGN },
            { label: "Vô số - Đóng dấu", duration: "1 ngày", overallStatus: RecordStatus.SIGNED },
            { label: "Chuyển Một cửa", duration: "1 ngày", overallStatus: RecordStatus.HANDOVER },
            { label: "Đã trả kết quả", duration: "0 giờ", overallStatus: RecordStatus.RETURNED }
        ];
    } else if (workflowType === 'quy_trinh_5a') {
        title = 'Quy trình 5A: Cấp lại có thuế (Có đối chiếu SMK)';
        stepConfigs = [
            { label: "Đối chiếu Sổ mục kê, hồ sơ lưu, GCN, CSDL đất đai", duration: "1 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Kiểm tra tình trạng thế chấp/ngăn chặn", duration: "1 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Lập biên bản xác minh đủ điều kiện cấp lại", duration: "1 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Chuyển UBND xã niêm yết/đăng tin", duration: "1 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Chờ niêm yết 15 ngày + tối đa 05 ngày nhận biên bản kết thúc", duration: "20 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Tiếp nhận kết quả niêm yết", duration: "1 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Lập Phiếu chuyển thông tin nghĩa vụ tài chính", duration: "2 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Chờ Thông báo thuế (TBT)", duration: "---", overallStatus: RecordStatus.TBT },
            { label: "Hủy GCN cũ, cập nhật DNLIS/CSDL, in GCN", duration: "3 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Thẩm tra", duration: "2 ngày", overallStatus: RecordStatus.PENDING_CHECK },
            { label: "Trình ký - Vô số - Đóng dấu", duration: "1 ngày", overallStatus: RecordStatus.PENDING_SIGN },
            { label: "Đã trả kết quả", duration: "0 giờ", overallStatus: RecordStatus.RETURNED }
        ];
    } else {
        title = 'Quy trình 5B: Cấp lại có thuế (Đã đối chiếu SMK)';
        stepConfigs = [
            { label: "Kiểm tra tình trạng thế chấp/ngăn chặn", duration: "1 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Lập biên bản xác minh đủ điều kiện cấp lại", duration: "1 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Chuyển UBND xã niêm yết/đăng tin", duration: "1 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Chờ niêm yết 15 ngày + tối đa 05 ngày nhận biên bản kết thúc", duration: "20 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Tiếp nhận kết quả niêm yết", duration: "1 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Lập Phiếu chuyển thông tin nghĩa vụ tài chính", duration: "2 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Chờ Thông báo thuế (TBT)", duration: "---", overallStatus: RecordStatus.TBT },
            { label: "Hủy GCN cũ, cập nhật DNLIS/CSDL, in GCN", duration: "3 ngày", overallStatus: RecordStatus.IN_PROGRESS },
            { label: "Thẩm tra", duration: "2 ngày", overallStatus: RecordStatus.PENDING_CHECK },
            { label: "Trình ký - Vô số - Đóng dấu", duration: "1 ngày", overallStatus: RecordStatus.PENDING_SIGN },
            { label: "Đã trả kết quả", duration: "0 giờ", overallStatus: RecordStatus.RETURNED }
        ];
    }

    // Proportional scaling of GCN workflow step durations to synchronize with the total received days of the procedure
    let totalProcedureDays = 30;
    const rTypeLower = (record.recordType || '').trim().toLowerCase();
    if (rTypeLower.startsWith('1.') || isArchiveType(record.recordType)) {
        totalProcedureDays = 10;
    } else if (rTypeLower.startsWith('2.') || isMeasurementType(record.recordType)) {
        if (rTypeLower.includes('cmđ') || rTypeLower.includes('cmd')) {
            totalProcedureDays = 2;
        } else if (rTypeLower.includes('trích đo') || rTypeLower.includes('cắm mốc') || rTypeLower.includes('tách')) {
            totalProcedureDays = 30;
        } else {
            totalProcedureDays = 10;
        }
    } else if (rTypeLower.startsWith('3.') || isRegType(record.recordType)) {
        if (rTypeLower.includes('3.1') || rTypeLower.includes('thừa kế') ||
            rTypeLower.includes('3.2') || rTypeLower.includes('tặng cho') ||
            rTypeLower.includes('3.3') || rTypeLower.includes('chuyển nhượng') ||
            rTypeLower.includes('3.4') || rTypeLower.includes('thỏa thuận') || rTypeLower.includes('vbtt')) {
            // Thừa kế (3.1), Tặng cho (3.2), Chuyển nhượng (3.3), Thỏa thuận (3.4)
            // 8 ngày (không thuế) | 13 ngày (có thuế). Mặc định là có thuế (13 ngày)
            totalProcedureDays = 13;
        } else if (rTypeLower.includes('3.6') || rTypeLower.includes('cấp đổi')) {
            // Cấp đổi (3.6): 10 ngày (không thuế) | 15 ngày (có thuế)
            totalProcedureDays = record.hasTax ? 15 : 10;
        } else if (rTypeLower.includes('thế chấp')) {
            totalProcedureDays = 3;
        } else {
            totalProcedureDays = 30;
        }
    } else if (rTypeLower.includes('cmđ') || rTypeLower.includes('cmd')) {
        totalProcedureDays = 2;
    }

    const getDefaultWeight = (label: string): number => {
        const l = label.toLowerCase();
        if (l.includes("tiếp nhận")) return 0;
        if (l.includes("ranh") || l.includes("dnlis")) return 1;
        if (l.includes("phiếu chuyển thuế") || l.includes("phiếu chuyển")) return 2;
        if (l.includes("trình ký thuế")) return 0;
        if (l.includes("tbt")) return 0;
        if (l.includes("in gcn") || l.includes("in giấy")) return 5;
        if (l.includes("thẩm tra")) return 1;
        if (l.includes("trình ký - vô số") || (l.includes("trình ký") && l.includes("vô số"))) return 1.5;
        if (l.includes("trình ký gcn") || l.includes("trình ký giấy") || l.includes("trình ký")) return 0.5;
        if (l.includes("vô số")) return 0.5;
        if (l.includes("giao 1 cửa") || l.includes("giao một cửa") || l.includes("trả kết quả") || l.includes("một cửa")) return 0;
        if (l.includes("mộc kê")) return 1;
        if (l.includes("thế chấp")) return 1;
        if (l.includes("đối chiếu")) return 1;
        if (l.includes("biên bản") || l.includes("xác minh")) return 1;
        return 0;
    };

    const hasHalfDayFraction = totalProcedureDays % 1 !== 0;
    const hasTiepNhan = stepConfigs.some(s => s.label.toLowerCase().includes("tiếp nhận"));
    const hasGiaoMộtCửa = stepConfigs.some(s => s.label.toLowerCase().includes("giao 1 cửa") || s.label.toLowerCase().includes("giao một cửa") || s.label.toLowerCase().includes("trả kết quả") || s.label.toLowerCase().includes("một cửa"));
    
    let daysToDistribute = totalProcedureDays;
    if (hasTiepNhan) daysToDistribute -= 0.5;
    if (hasGiaoMộtCửa) daysToDistribute -= 0.5;

    const stepsWithWeights = stepConfigs.map(s => {
        const isFixedCal = s.label.toLowerCase().includes("chờ niêm yết") || s.label.toLowerCase().includes("công văn") || s.label.toLowerCase().includes("tbt");
        const isHidden = isStepHiddenForWorkflow(s.label, workflowType);
        return {
            ...s,
            weight: (isFixedCal || isHidden) ? 0 : getDefaultWeight(s.label),
            isFixedCal,
            isHidden
        };
    });

    const totalWeightSum = stepsWithWeights.reduce((sum, s) => sum + s.weight, 0);

    if (totalWeightSum > 0) {
        stepConfigs = stepsWithWeights.map(s => {
            if (s.isFixedCal) {
                return { label: s.label, duration: s.duration, overallStatus: s.overallStatus };
            }
            if (s.isHidden) {
                return { label: s.label, duration: "0 giờ", overallStatus: s.overallStatus };
            }
            const lLower = s.label.toLowerCase();
            if (lLower.includes("tiếp nhận")) {
                return { label: s.label, duration: "4 giờ", overallStatus: s.overallStatus };
            }
            if (lLower.includes("giao 1 cửa") || lLower.includes("giao một cửa") || lLower.includes("trả kết quả")) {
                return { label: s.label, duration: "4 giờ", overallStatus: s.overallStatus };
            }
            if (s.weight === 0) {
                return { label: s.label, duration: "0 giờ", overallStatus: s.overallStatus };
            }
            const stepHours = Math.max(1, Math.round((s.weight / totalWeightSum) * daysToDistribute * 8));
            return { label: s.label, duration: `${stepHours} giờ`, overallStatus: s.overallStatus };
        });

        // Apply half-day correction if procedure has .5 fraction
        if (hasHalfDayFraction) {
            let maxHours = 0;
            let longestStepIdx = -1;
            stepConfigs.forEach((s, idx) => {
                const lLower = s.label.toLowerCase();
                if (!lLower.includes("tiếp nhận") && !lLower.includes("giao 1 cửa") && !lLower.includes("giao một cửa") && !lLower.includes("trả kết quả") && !s.label.toLowerCase().includes("niêm yết") && !s.label.toLowerCase().includes("công văn")) {
                    if (s.duration.includes("giờ")) {
                        const h = parseInt(s.duration) || 0;
                        if (h > maxHours) {
                            maxHours = h;
                            longestStepIdx = idx;
                        }
                    }
                }
            });

            if (longestStepIdx !== -1 && maxHours >= 4) {
                stepConfigs[longestStepIdx].duration = `${maxHours - 4} giờ`;
                const tiepNhanIdx = stepConfigs.findIndex(s => s.label.toLowerCase().includes("tiếp nhận"));
                if (tiepNhanIdx !== -1) {
                    stepConfigs[tiepNhanIdx].duration = "8 giờ";
                }
            }
        }
    }

    // Determine current step index
    let currentStepIndex = record.currentStepIndex;
    
    const isStepIndexMatchingStatus = (index: number | undefined | null, status: RecordStatus, steps: GcnStepConfig[]): boolean => {
        if (index === undefined || index === null) return false;
        const step = steps[index];
        if (!step) return false;
        
        // Custom matching for quy_trinh_5a & 5b combined step "Trình ký - Vô số - Đóng dấu"
        if (['quy_trinh_5a', 'quy_trinh_5b'].includes(workflowType)) {
            if (step.label.includes("Trình ký - Vô số") && [RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER].includes(status)) {
                return true;
            }
        }
        
        if (step.overallStatus === status) return true;
        if (status === RecordStatus.RECEIVED && step.label.toLowerCase().includes("tiếp nhận")) return true;
        if (status === RecordStatus.IN_PROGRESS && step.overallStatus === RecordStatus.IN_PROGRESS) return true;
        if (status === RecordStatus.COMPLETED_WORK && step.label.toLowerCase().includes("trình ký thuế")) return true;
        if (status === RecordStatus.CHECKED && step.label.toLowerCase().includes("thẩm tra")) return true;
        return false;
    };

    if (currentStepIndex === undefined || currentStepIndex === null || currentStepIndex >= stepConfigs.length || !isStepIndexMatchingStatus(currentStepIndex, record.status, stepConfigs)) {
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
                if (['quy_trinh_5a', 'quy_trinh_5b'].includes(workflowType)) {
                    targetLabel = "Trình ký - Vô số";
                } else if (['quy_trinh_4a', 'quy_trinh_4b'].includes(workflowType)) {
                    targetLabel = "Trình ký";
                } else {
                    targetLabel = "Trình Ký GCN";
                }
            } else if (status === RecordStatus.SIGNED) {
                if (['quy_trinh_5a', 'quy_trinh_5b'].includes(workflowType)) {
                    targetLabel = "Trình ký - Vô số";
                } else if (['quy_trinh_4a', 'quy_trinh_4b'].includes(workflowType)) {
                    targetLabel = "Vô số";
                } else {
                    targetLabel = "Vô số GCN";
                }
            } else if (status === RecordStatus.HANDOVER) {
                if (['quy_trinh_5a', 'quy_trinh_5b'].includes(workflowType)) {
                    targetLabel = "Trình ký - Vô số";
                } else {
                    targetLabel = "cửa";
                }
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
        steps
    };
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
  const deadline = new Date(record.deadline);
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
  const deadline = new Date(record.deadline);
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
  if (!wardName) return null;
  
  const normWard = removeVietnameseTones(wardName).toLowerCase().trim();
  
  // Lọc nhân viên Tổ Lưu trữ
  const archiveStaff = employees.filter(emp => {
    const d = removeVietnameseTones(emp.department || '').toLowerCase();
    return d.includes('luu tru') || d.includes('archive');
  });
  
  // Tìm nhân viên phụ trách địa bàn này
  const matched = archiveStaff.find(emp => 
    emp.managedWards && emp.managedWards.some(w => 
      removeVietnameseTones(w).toLowerCase().trim() === normWard
    )
  );
  
  return matched || null;
}

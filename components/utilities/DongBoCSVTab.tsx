import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
    Upload, Database, CheckCircle2, AlertCircle, Loader2, 
    RefreshCw, FileSpreadsheet, Play, ArrowRight, Info, Check, 
    X, AlertTriangle, ChevronRight, HelpCircle, Search, Filter
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { NotifyFunction, RecordFile } from '../../types';
import { fetchRecords, updateRecordsBatchById } from '../../services/apiRecords';
import { fetchArchiveRecords, ArchiveRecord, upsertArchiveRecordsBatch } from '../../services/apiArchive';
import { removeVietnameseTones } from '../../utils/appHelpers';

interface Props {
    notify: NotifyFunction;
    onRefreshData?: () => void;
}

interface ColumnMapping {
    systemField: string;
    systemLabel: string;
    csvField: string; // The header name from CSV/Excel
    required: boolean;
    description: string;
}

const CHUNK_SIZE = 25;

const DongBoCSVTab: React.FC<Props> = ({ notify, onRefreshData }) => {
    // 1. Core States
    const [targetType, setTargetType] = useState<'measurement' | 'archive'>('measurement');
    const [archiveType, setArchiveType] = useState<'saoluc' | 'vaoso' | 'congvan'>('saoluc');
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [fileName, setFileName] = useState('');
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [mappings, setMappings] = useState<Record<string, string>>({});
    const [allowInsert, setAllowInsert] = useState<boolean>(false);
    
    // System lists to match existing records
    const [existingRecords, setExistingRecords] = useState<RecordFile[]>([]);
    const [existingArchive, setExistingArchive] = useState<ArchiveRecord[]>([]);

    // Progress bar states
    const [progress, setProgress] = useState({ processed: 0, total: 0, currentBatch: 0, totalBatches: 0 });

    // Sync report state
    const [syncReport, setSyncReport] = useState<{
        isOpen: boolean;
        target: string;
        totalRecords: number;
        updatedCount: number;
        insertedCount: number;
        failedCount: number;
        details: { code: string; status: 'CẬP NHẬT' | 'THÊM MỚI' | 'LỖI'; message?: string }[];
    } | null>(null);
    const [reportFilter, setReportFilter] = useState<'ALL' | 'CẬP NHẬT' | 'THÊM MỚI' | 'LỖI'>('ALL');

    // Confirmation Modal states
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmInput, setConfirmInput] = useState('');

    // Preview and comparison states
    const [previewTab, setPreviewTab] = useState<'list' | 'comparison'>('comparison');
    const [previewFilter, setPreviewFilter] = useState<'all' | 'updates' | 'inserts' | 'unchanged'>('all');
    const [previewSearch, setPreviewSearch] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Dynamic list of system fields depending on chosen targetType
    const systemFields = useMemo<ColumnMapping[]>(() => {
        if (targetType === 'measurement') {
            return [
                { systemField: 'code', systemLabel: 'Mã hồ sơ', required: true, csvField: '', description: 'Mã số hồ sơ duy nhất để tìm kiếm và khớp dữ liệu' },
                { systemField: 'customerName', systemLabel: 'Chủ sử dụng', required: false, csvField: '', description: 'Họ tên chủ sử dụng đất' },
                { systemField: 'phoneNumber', systemLabel: 'Số điện thoại', required: false, csvField: '', description: 'Số điện thoại liên hệ' },
                { systemField: 'cccd', systemLabel: 'CCCD/CMND', required: false, csvField: '', description: 'Căn cước công dân của chủ đất' },
                { systemField: 'customerAddress', systemLabel: 'Địa chỉ chủ đất', required: false, csvField: '', description: 'Địa chỉ liên hệ của chủ sử dụng' },
                { systemField: 'ward', systemLabel: 'Xã/Phường', required: false, csvField: '', description: 'Địa danh hành chính (Phường/Xã)' },
                { systemField: 'landPlot', systemLabel: 'Thửa đất số', required: false, csvField: '', description: 'Số hiệu thửa đất' },
                { systemField: 'mapSheet', systemLabel: 'Tờ bản đồ số', required: false, csvField: '', description: 'Số hiệu tờ bản đồ' },
                { systemField: 'area', systemLabel: 'Diện tích (m²)', required: false, csvField: '', description: 'Diện tích thửa đất' },
                { systemField: 'address', systemLabel: 'Địa chỉ thửa đất', required: false, csvField: '', description: 'Vị trí/Địa chỉ của thửa đất' },
                { systemField: 'group', systemLabel: 'Tổ / Nhóm', required: false, csvField: '', description: 'Tổ/Nhóm làm việc phụ trách' },
                { systemField: 'content', systemLabel: 'Nội dung', required: false, csvField: '', description: 'Nội dung công việc hoặc trích yếu' },
                { systemField: 'recordType', systemLabel: 'Loại hồ sơ', required: false, csvField: '', description: 'Phân loại hồ sơ (Đo đạc, Cấp đổi, v.v.)' },
                { systemField: 'receivedDate', systemLabel: 'Ngày tiếp nhận', required: false, csvField: '', description: 'Ngày nhận hồ sơ (YYYY-MM-DD)' },
                { systemField: 'deadline', systemLabel: 'Hạn trả kết quả', required: false, csvField: '', description: 'Hạn xử lý hồ sơ (YYYY-MM-DD)' },
                { systemField: 'assignedDate', systemLabel: 'Ngày giao việc', required: false, csvField: '', description: 'Ngày bàn giao cho nhân viên (YYYY-MM-DD)' },
                { systemField: 'submissionDate', systemLabel: 'Ngày trình ký', required: false, csvField: '', description: 'Ngày trình ký duyệt (YYYY-MM-DD)' },
                { systemField: 'approvalDate', systemLabel: 'Ngày ký duyệt', required: false, csvField: '', description: 'Ngày lãnh đạo ký duyệt (YYYY-MM-DD)' },
                { systemField: 'completedDate', systemLabel: 'Ngày hoàn thành', required: false, csvField: '', description: 'Ngày hoàn thành nội bộ (YYYY-MM-DD)' },
                { systemField: 'status', systemLabel: 'Trạng thái', required: false, csvField: '', description: 'Trạng thái xử lý (RECEIVED, IN_PROGRESS, v.v.)' },
                { systemField: 'notes', systemLabel: 'Ghi chú', required: false, csvField: '', description: 'Thông tin ghi chú thêm' },
                { systemField: 'privateNotes', systemLabel: 'Ghi chú nội bộ', required: false, csvField: '', description: 'Ghi chú nội bộ bộ phận' },
                { systemField: 'personalNotes', systemLabel: 'Ghi chú cá nhân', required: false, csvField: '', description: 'Ghi chú riêng của chuyên viên' },
                { systemField: 'issueNumber', systemLabel: 'Số phát hành GCN', required: false, csvField: '', description: 'Số sê-ri phôi GCN được cấp' },
                { systemField: 'entryNumber', systemLabel: 'Số vào sổ GCN', required: false, csvField: '', description: 'Số vào sổ cấp GCN' },
                { systemField: 'issueDate', systemLabel: 'Ngày cấp GCN', required: false, csvField: '', description: 'Ngày ký cấp GCN (YYYY-MM-DD)' },
                { systemField: 'residentialArea', systemLabel: 'Đất ở (m²)', required: false, csvField: '', description: 'Diện tích đất ở' },
                { systemField: 'clnArea', systemLabel: 'Đất CLN (m²)', required: false, csvField: '', description: 'Diện tích đất trồng cây lâu năm' },
                { systemField: 'bhkArea', systemLabel: 'Đất BHK (m²)', required: false, csvField: '', description: 'Diện tích đất bằng trồng cây hàng năm khác' },
                { systemField: 'lucArea', systemLabel: 'Đất LUC (m²)', required: false, csvField: '', description: 'Diện tích đất trồng lúa' },
                { systemField: 'otherLandArea', systemLabel: 'Đất khác (m²)', required: false, csvField: '', description: 'Diện tích loại đất phụ khác' },
                { systemField: 'price', systemLabel: 'Đơn giá / Chi phí', required: false, csvField: '', description: 'Đơn giá thực hiện hồ sơ' },
                { systemField: 'advancePayment', systemLabel: 'Tạm ứng', required: false, csvField: '', description: 'Số tiền tạm ứng trước' },
                { systemField: 'measurementNumber', systemLabel: 'Số đo đạc / Bản vẽ', required: false, csvField: '', description: 'Số hiệu bản vẽ kỹ thuật' },
                { systemField: 'excerptNumber', systemLabel: 'Số trích lục', required: false, csvField: '', description: 'Số cấp trích lục bản đồ' },
                { systemField: 'receiptNumber', systemLabel: 'Số biên lai', required: false, csvField: '', description: 'Số hiệu biên lai đóng lệ phí' },
                { systemField: 'paymentAmount', systemLabel: 'Thực thu lệ phí', required: false, csvField: '', description: 'Số tiền thực thu lệ phí đóng' },
                { systemField: 'receiverName', systemLabel: 'Họ tên người lấy kết quả', required: false, csvField: '', description: 'Họ tên người trực tiếp ký nhận kết quả' },
                { systemField: 'resultReturnedDate', systemLabel: 'Ngày trả kết quả dân', required: false, csvField: '', description: 'Ngày bàn giao kết quả cho dân (YYYY-MM-DD)' },
            ];
        } else {
            if (archiveType === 'saoluc') {
                return [
                    { systemField: 'so_hieu', systemLabel: 'Số hiệu / Số hồ sơ', required: true, csvField: '', description: 'Số hiệu hồ sơ duy nhất để tìm kiếm và khớp dữ liệu' },
                    { systemField: 'noi_nhan_gui', systemLabel: 'Tên chủ sử dụng', required: false, csvField: '', description: 'Họ tên chủ sử dụng đất' },
                    { systemField: 'trich_yeu', systemLabel: 'Nội dung yêu cầu / Trích yếu', required: false, csvField: '', description: 'Nội dung tóm tắt yêu cầu cung cấp dữ liệu' },
                    { systemField: 'ngay_thang', systemLabel: 'Ngày nhận', required: false, csvField: '', description: 'Ngày nhận hồ sơ (YYYY-MM-DD)' },
                    // data subfields
                    { systemField: 'xa_phuong', systemLabel: 'Xã/Phường', required: false, csvField: '', description: 'Xã/Phường nơi có thửa đất' },
                    { systemField: 'to_ban_do', systemLabel: 'Tờ bản đồ', required: false, csvField: '', description: 'Số tờ bản đồ' },
                    { systemField: 'thua_dat', systemLabel: 'Thửa đất', required: false, csvField: '', description: 'Số thửa đất' },
                    { systemField: 'hen_tra', systemLabel: 'Hẹn trả kết quả', required: false, csvField: '', description: 'Ngày hẹn trả kết quả (YYYY-MM-DD)' },
                    { systemField: 'ngay_hoan_thanh', systemLabel: 'Ngày hoàn thành chuyên môn', required: false, csvField: '', description: 'Ngày hoàn thành nội bộ (YYYY-MM-DD)' },
                    { systemField: 'danh_sach', systemLabel: 'Đợt/Danh sách bàn giao', required: false, csvField: '', description: 'Đợt hoặc danh sách bàn giao' },
                    { systemField: 'receipt_number', systemLabel: 'Số biên lai', required: false, csvField: '', description: 'Số hiệu biên lai lệ phí' },
                    { systemField: 'payment_status', systemLabel: 'Trạng thái thu lệ phí', required: false, csvField: '', description: 'Chưa thu hoặc Đã thu' },
                    { systemField: 'payment_amount', systemLabel: 'Thực thu lệ phí', required: false, csvField: '', description: 'Số tiền lệ phí thực tế đã thu' },
                    { systemField: 'result_returned_date', systemLabel: 'Ngày trả kết quả', required: false, csvField: '', description: 'Ngày bàn giao kết quả cho người dân (YYYY-MM-DD)' }
                ];
            } else if (archiveType === 'congvan') {
                return [
                    { systemField: 'so_hieu', systemLabel: 'Số hiệu công văn / Mã hồ sơ', required: true, csvField: '', description: 'Số hiệu công văn/văn bản hoặc mã hồ sơ' },
                    { systemField: 'noi_nhan_gui', systemLabel: 'Nơi nhận/gửi', required: false, csvField: '', description: 'Nơi gửi đến hoặc nơi nhận đi' },
                    { systemField: 'trich_yeu', systemLabel: 'Trích yếu / Nội dung', required: false, csvField: '', description: 'Nội dung trích yếu của công văn' },
                    { systemField: 'ngay_thang', systemLabel: 'Ngày tháng văn bản', required: false, csvField: '', description: 'Ngày ban hành hoặc ngày nhận văn bản (YYYY-MM-DD)' },
                    // data subfields
                    { systemField: 'xa_phuong', systemLabel: 'Xã/Phường', required: false, csvField: '', description: 'Xã/Phường liên quan đến công văn' },
                    { systemField: 'to_ban_do', systemLabel: 'Tờ bản đồ', required: false, csvField: '', description: 'Số tờ bản đồ liên quan' },
                    { systemField: 'thua_dat', systemLabel: 'Thửa đất', required: false, csvField: '', description: 'Số thửa đất liên quan' },
                    { systemField: 'hen_tra', systemLabel: 'Hẹn trả kết quả', required: false, csvField: '', description: 'Ngày hạn giải quyết công văn (YYYY-MM-DD)' },
                    { systemField: 'ngay_hoan_thanh', systemLabel: 'Ngày hoàn thành chuyên môn', required: false, csvField: '', description: 'Ngày xử lý xong (YYYY-MM-DD)' },
                    { systemField: 'danh_sach', systemLabel: 'Đợt/Danh sách bàn giao', required: false, csvField: '', description: 'Danh sách giao nhận công văn' },
                    { systemField: 'result_returned_date', systemLabel: 'Ngày trả kết quả', required: false, csvField: '', description: 'Ngày trả kết quả công văn (YYYY-MM-DD)' },
                    { systemField: 'assigned_to', systemLabel: 'Người thực hiện (ID/Tên)', required: false, csvField: '', description: 'ID hoặc tên nhân viên được phân công giải quyết' }
                ];
            } else {
                return [
                    { systemField: 'so_hieu', systemLabel: 'Mã hồ sơ', required: true, csvField: '', description: 'Mã số hồ sơ duy nhất' },
                    { systemField: 'noi_nhan_gui', systemLabel: 'Chủ sử dụng', required: false, csvField: '', description: 'Tên chủ sử dụng đất' },
                    { systemField: 'trich_yeu', systemLabel: 'Trích yếu', required: false, csvField: '', description: 'Nội dung trích yếu' },
                    { systemField: 'ngay_thang', systemLabel: 'Ngày nhận', required: false, csvField: '', description: 'Ngày tiếp nhận hồ sơ (YYYY-MM-DD)' },
                    // data subfields
                    { systemField: 'loai_gcn', systemLabel: 'Loại GCN', required: false, csvField: '', description: 'Loại giấy chứng nhận được cấp' },
                    { systemField: 'so_vao_so', systemLabel: 'Số vào sổ', required: false, csvField: '', description: 'Số hiệu vào sổ cấp GCN' },
                    { systemField: 'so_phat_hanh', systemLabel: 'Số phát hành', required: false, csvField: '', description: 'Số hiệu phôi GCN phát hành' },
                    { systemField: 'ngay_ky_gcn', systemLabel: 'Ngày ký GCN', required: false, csvField: '', description: 'Ngày ký cấp GCN (YYYY-MM-DD)' },
                    { systemField: 'ngay_ky_phieu_tk', systemLabel: 'Chuyển Scan/1 Cửa', required: false, csvField: '', description: 'Ngày bàn giao scan lưu trữ hoặc chuyển 1 cửa (YYYY-MM-DD)' },
                    { systemField: 'ghi_chu', systemLabel: 'Ghi chú', required: false, csvField: '', description: 'Thông tin ghi chú' }
                ];
            }
        }
    }, [targetType, archiveType]);

    // Load existing database records for matching & reporting
    const loadDatabaseState = async () => {
        setLoading(true);
        try {
            if (targetType === 'measurement') {
                const recs = await fetchRecords();
                setExistingRecords(recs);
            } else {
                const recs = await fetchArchiveRecords(archiveType);
                setExistingArchive(recs);
            }
        } catch (error) {
            console.error(error);
            notify('Không thể tải dữ liệu hiện tại để đối chiếu khớp mã.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDatabaseState();
        // Reset file parsing when changing targets
        setFileName('');
        setCsvHeaders([]);
        setParsedData([]);
        setMappings({});
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [targetType, archiveType]);

    // Smart auto-mapping logic
    const handleAutoMap = (headers: string[]) => {
        const newMappings: Record<string, string> = {};
        
        headers.forEach(header => {
            const cleanHeader = removeVietnameseTones(header.toLowerCase().trim()).replace(/[^a-z0-9]/g, '');
            
            if (targetType === 'measurement') {
                if (/^(mahosonosohoso|mahoso|sohoso|code|shs|masohoso)$/.test(cleanHeader)) {
                    newMappings['code'] = header;
                } else if (/^(chusudung|tenkhachhang|chuho|fullname|customername|hotenchusudung|hoten|tenchu|chu)$/.test(cleanHeader)) {
                    newMappings['customerName'] = header;
                } else if (/^(sodienthoai|sdt|phone|phonenumber|dienthoai|lh|lienhe)$/.test(cleanHeader)) {
                    newMappings['phoneNumber'] = header;
                } else if (/^(cccd|cmnd|socccd|socmnd)$/.test(cleanHeader)) {
                    newMappings['cccd'] = header;
                } else if (/^(diachichudat|diachikhachhang|customeraddress|diachilh)$/.test(cleanHeader)) {
                    newMappings['customerAddress'] = header;
                } else if (/^(xaphuong|ward|phuongxa|phuong|xa)$/.test(cleanHeader)) {
                    newMappings['ward'] = header;
                } else if (/^(thuadatso|thuadat|thuanumber|sothua|thua|plot)$/.test(cleanHeader)) {
                    newMappings['landPlot'] = header;
                } else if (/^(tobandoso|tobando|tobando|soto|tobando|sheet)$/.test(cleanHeader)) {
                    newMappings['mapSheet'] = header;
                } else if (/^(dientich|area|dientichm2|dt|dtich)$/.test(cleanHeader)) {
                    newMappings['area'] = header;
                } else if (/^(diachithuadat|diachithua|address|vitri|vitrithuadat)$/.test(cleanHeader)) {
                    newMappings['address'] = header;
                } else if (/^(tonhom|group|to|nhom|to_nhom)$/.test(cleanHeader)) {
                    newMappings['group'] = header;
                } else if (/^(noidung|content|trichyeu|congviec)$/.test(cleanHeader)) {
                    newMappings['content'] = header;
                } else if (/^(loaihoso|recordtype|loaihinh|loai_hs)$/.test(cleanHeader)) {
                    newMappings['recordType'] = header;
                } else if (/^(ngaynhan|receiveddate|ngaytiepnhan|ngay_nhan|received)$/.test(cleanHeader)) {
                    newMappings['receivedDate'] = header;
                } else if (/^(deadline|hangiaiquyet|hantrahoso|han_tra|han_gq)$/.test(cleanHeader)) {
                    newMappings['deadline'] = header;
                } else if (/^(ngaygiao|assigneddate|ngayphancong|ngay_giao)$/.test(cleanHeader)) {
                    newMappings['assignedDate'] = header;
                } else if (/^(ngaytrinh|submissiondate|ngaytrinhky|ngay_trinh)$/.test(cleanHeader)) {
                    newMappings['submissionDate'] = header;
                } else if (/^(ngayduyet|approvaldate|ngaykyduyet|ngay_ky|ngay_duyet)$/.test(cleanHeader)) {
                    newMappings['approvalDate'] = header;
                } else if (/^(ngayhoanthanh|completeddate|ngay_hoanthanh|ngay_ht)$/.test(cleanHeader)) {
                    newMappings['completedDate'] = header;
                } else if (/^(trangthai|status|tthai|trang_thai)$/.test(cleanHeader)) {
                    newMappings['status'] = header;
                } else if (/^(ghichunoibo|privatenotes|ghi_chu_noi_bo)$/.test(cleanHeader)) {
                    newMappings['privateNotes'] = header;
                } else if (/^(ghichucanhan|personalnotes|ghi_chu_ca_nhan)$/.test(cleanHeader)) {
                    newMappings['personalNotes'] = header;
                } else if (/^(sophathanh|issuenumber|so_phat_hanh|so_gcn)$/.test(cleanHeader)) {
                    newMappings['issueNumber'] = header;
                } else if (/^(sovaoso|entrynumber|so_vao_so|so_so)$/.test(cleanHeader)) {
                    newMappings['entryNumber'] = header;
                } else if (/^(ngaycap|issuedate|ngay_cap|ngay_cap_gcn)$/.test(cleanHeader)) {
                    newMappings['issueDate'] = header;
                } else if (/^(datothocu|residentialarea|dat_o|tho_cu|dato)$/.test(cleanHeader)) {
                    newMappings['residentialArea'] = header;
                } else if (/^(clnarea|dtcln|cln|dat_cln|caylaunam)$/.test(cleanHeader)) {
                    newMappings['clnArea'] = header;
                } else if (/^(bhkarea|dtbhk|bhk|dat_bhk|cayhangnam)$/.test(cleanHeader)) {
                    newMappings['bhkArea'] = header;
                } else if (/^(lucarea|dtluc|luc|dat_luc|datlua)$/.test(cleanHeader)) {
                    newMappings['lucArea'] = header;
                } else if (/^(otherlandarea|datkhac|dt_khac)$/.test(cleanHeader)) {
                    newMappings['otherLandArea'] = header;
                } else if (/^(dongia|chiphi|price|sotien|giatien)$/.test(cleanHeader)) {
                    newMappings['price'] = header;
                } else if (/^(tamung|advance|advancepayment|daung)$/.test(cleanHeader)) {
                    newMappings['advancePayment'] = header;
                } else if (/^(sododac|measurementnumber|so_ban_ve|so_do_dac)$/.test(cleanHeader)) {
                    newMappings['measurementNumber'] = header;
                } else if (/^(sotrichluc|excerptnumber|so_trich_luc)$/.test(cleanHeader)) {
                    newMappings['excerptNumber'] = header;
                } else if (/^(sobienlai|receiptnumber|so_bien_lai|so_hoa_don)$/.test(cleanHeader)) {
                    newMappings['receiptNumber'] = header;
                } else if (/^(paymentamount|sotienthuthucte|so_tien_thu|thucthu|tien_thu)$/.test(cleanHeader)) {
                    newMappings['paymentAmount'] = header;
                } else if (/^(receivername|nguoinhanketqua|nguoi_nhan_kq|nguoilay)$/.test(cleanHeader)) {
                    newMappings['receiverName'] = header;
                } else if (/^(resultreturneddate|ngaytraketqua|ngay_tra_gcn|ngay_tra_kq)$/.test(cleanHeader)) {
                    newMappings['resultReturnedDate'] = header;
                } else if (/^(ghichu|notes|note|ykien)$/.test(cleanHeader)) {
                    newMappings['notes'] = header;
                }
            } else {
                // Archive fields
                if (/^(sohieu|sohosolưu|sohieuhoso|filenumber|sohieu)$/.test(cleanHeader)) {
                    newMappings['so_hieu'] = header;
                } else if (/^(noinhangui|chusudung|nguoinhan|nguoigui|fullname|customername|noigui|noinhan)$/.test(cleanHeader)) {
                    newMappings['noi_nhan_gui'] = header;
                } else if (/^(trichyeu|noidung|trichyeuhoso|summary|content)$/.test(cleanHeader)) {
                    newMappings['trich_yeu'] = header;
                } else if (/^(ngaythang|ngaythangvanban|ngayky|ngaynhan|ngay|date)$/.test(cleanHeader)) {
                    newMappings['ngay_thang'] = header;
                } else if (/^(xaphuong|ward|phuongxa|xa|phuong)$/.test(cleanHeader)) {
                    newMappings['xa_phuong'] = header;
                } else if (/^(tobando|soto|tobandoso|sheet)$/.test(cleanHeader)) {
                    newMappings['to_ban_do'] = header;
                } else if (/^(thuadat|sothua|thuadatso|thua|plot)$/.test(cleanHeader)) {
                    newMappings['thua_dat'] = header;
                } else if (/^(dientich|area|dt|dientichm2)$/.test(cleanHeader)) {
                    newMappings['dien_tich'] = header;
                } else if (/^(hentra|deadline|hanxuly|ngayhentra)$/.test(cleanHeader)) {
                    newMappings['hen_tra'] = header;
                } else if (/^(ghichu|notes|note|ghi_chu)$/.test(cleanHeader)) {
                    newMappings['ghi_chu'] = header;
                }
            }
        });

        setMappings(newMappings);
        notify(`Đã tự động nhận diện và khớp ${Object.keys(newMappings).length} trường dữ liệu!`, 'success');
    };

    // File selection handler
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setLoading(true);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary', cellDates: true, cellNF: false, cellText: false });
                const firstSheetName = wb.SheetNames[0];
                const worksheet = wb.Sheets[firstSheetName];
                
                // Read as array of arrays or array of JSON objects
                const rawJson = XLSX.utils.sheet_to_json<any>(worksheet, { defval: '' });
                
                if (rawJson.length === 0) {
                    notify('File trống hoặc không chứa dữ liệu hợp lệ.', 'error');
                    setLoading(false);
                    return;
                }

                // Gather CSV headers (all unique keys from the parsed objects)
                const headersSet = new Set<string>();
                rawJson.forEach(row => {
                    Object.keys(row).forEach(k => {
                        if (k.trim() !== '') {
                            headersSet.add(k);
                        }
                    });
                });
                
                const headers = Array.from(headersSet);
                setCsvHeaders(headers);
                setParsedData(rawJson);
                
                // Do smart auto-mapping
                handleAutoMap(headers);
                notify(`Đã tải thành công file với ${rawJson.length} dòng dữ liệu.`, 'success');
            } catch (err) {
                console.error(evt, err);
                notify('Lỗi đọc file CSV/Excel. Vui lòng kiểm tra định dạng.', 'error');
            } finally {
                setLoading(false);
            }
        };

        reader.readAsBinaryString(file);
    };

    const handleMappingChange = (systemField: string, csvField: string) => {
        setMappings(prev => {
            const next = { ...prev };
            if (csvField === '') {
                delete next[systemField];
            } else {
                next[systemField] = csvField;
            }
            return next;
        });
    };



    // Format dates parsed by Excel/XLSX dynamically
    const formatValueToDate = (val: any): string => {
        if (!val) return '';
        if (val instanceof Date) {
            return val.toISOString().split('T')[0];
        }
        const str = String(val).trim();
        // Try parsing DD/MM/YYYY
        const dmyPattern = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
        const match = str.match(dmyPattern);
        if (match) {
            return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
        }
        return str;
    };

    // Compares uploaded row with existing DB records and gets differences
    const getRecordChanges = (row: any) => {
        const keyField = targetType === 'measurement' ? 'code' : 'so_hieu';
        const keyMap = mappings[keyField];
        if (!keyMap) return { isMatched: false, matchedItem: null, diffs: [], status: 'UNMAPPED' as const };

        const keyVal = String(row[keyMap] || '').trim();
        if (!keyVal) return { isMatched: false, matchedItem: null, diffs: [], status: 'EMPTY_KEY' as const };

        let matchedItem: any = null;
        if (targetType === 'measurement') {
            matchedItem = existingRecords.find(r => r.code?.toLowerCase() === keyVal.toLowerCase());
        } else {
            if (archiveType === 'saoluc') {
                matchedItem = existingRecords.find(r => 
                    r.code?.toLowerCase() === keyVal.toLowerCase() && 
                    (r.recordType?.startsWith('1.1') || r.recordType?.toLowerCase().includes('cung cấp dữ liệu') || r.recordType?.toLowerCase().includes('cung cấp tài liệu') || r.recordType?.toLowerCase().includes('sao lục') || r.recordType === 'Cung cấp tài liệu đất đai')
                );
            } else if (archiveType === 'congvan') {
                matchedItem = existingRecords.find(r => 
                    r.code?.toLowerCase() === keyVal.toLowerCase() && 
                    (r.recordType?.startsWith('1.2') || r.recordType?.toLowerCase().includes('công văn'))
                );
            } else {
                matchedItem = existingArchive.find(r => r.so_hieu?.toLowerCase() === keyVal.toLowerCase() && r.type === archiveType);
            }
        }

        if (!matchedItem) {
            return { isMatched: false, matchedItem: null, diffs: [], status: 'INSERT' as const };
        }

        const diffs: { fieldLabel: string; oldValue: string; newValue: string }[] = [];

        systemFields.forEach(f => {
            const csvCol = mappings[f.systemField];
            if (!csvCol) return;

            let csvVal = row[csvCol];
            let dbVal: any = null;

            if (targetType === 'measurement') {
                dbVal = matchedItem[f.systemField];
            } else {
                if (archiveType === 'saoluc' || archiveType === 'congvan') {
                    if (f.systemField === 'so_hieu') dbVal = matchedItem.code;
                    else if (f.systemField === 'noi_nhan_gui') dbVal = matchedItem.customerName;
                    else if (f.systemField === 'trich_yeu') dbVal = matchedItem.content;
                    else if (f.systemField === 'ngay_thang') dbVal = matchedItem.receivedDate;
                    else if (f.systemField === 'xa_phuong') dbVal = matchedItem.ward;
                    else if (f.systemField === 'to_ban_do') dbVal = matchedItem.mapSheet;
                    else if (f.systemField === 'thua_dat') dbVal = matchedItem.landPlot;
                    else if (f.systemField === 'hen_tra') dbVal = matchedItem.deadline;
                    else if (f.systemField === 'ngay_hoan_thanh') dbVal = matchedItem.completedWorkDate;
                    else if (f.systemField === 'danh_sach') dbVal = matchedItem.exportBatch;
                    else if (f.systemField === 'receipt_number') dbVal = matchedItem.receiptNumber;
                    else if (f.systemField === 'payment_amount') dbVal = matchedItem.paymentAmount;
                    else if (f.systemField === 'result_returned_date') dbVal = matchedItem.resultReturnedDate;
                    else if (f.systemField === 'assigned_to') dbVal = matchedItem.assignedTo;
                } else {
                    if (['so_hieu', 'noi_nhan_gui', 'trich_yeu', 'ngay_thang'].includes(f.systemField)) {
                        dbVal = matchedItem[f.systemField];
                    } else {
                        dbVal = matchedItem.data?.[f.systemField];
                    }
                }
            }

            let formattedCsvVal = '';
            if (['area', 'residentialArea', 'clnArea', 'bhkArea', 'lucArea', 'otherLandArea', 'price', 'advancePayment', 'paymentAmount', 'payment_amount'].includes(f.systemField)) {
                const parsedNum = parseFloat(String(csvVal).replace(/[^0-9.-]/g, ''));
                const numVal = isNaN(parsedNum) ? null : parsedNum;
                formattedCsvVal = numVal !== null ? String(numVal) : '';
            } else if (['receivedDate', 'deadline', 'assignedDate', 'submissionDate', 'approvalDate', 'completedDate', 'issueDate', 'resultReturnedDate', 'ngay_thang', 'hen_tra', 'ngay_hoan_thanh', 'result_returned_date', 'ngay_ky_gcn', 'ngay_ky_phieu_tk'].includes(f.systemField)) {
                formattedCsvVal = formatValueToDate(csvVal);
            } else {
                formattedCsvVal = String(csvVal || '').trim();
            }

            const formattedDbVal = dbVal !== null && dbVal !== undefined ? String(dbVal).trim() : '';

            if (formattedCsvVal !== formattedDbVal) {
                diffs.push({
                    fieldLabel: f.systemLabel,
                    oldValue: formattedDbVal || '(Trống)',
                    newValue: formattedCsvVal || '(Trống)'
                });
            }
        });

        return {
            isMatched: true,
            matchedItem,
            diffs,
            status: diffs.length > 0 ? ('UPDATE' as const) : ('UNCHANGED' as const)
        };
    };

    // Memoized computation of all preview items and match analysis
    const previewItems = useMemo(() => {
        if (parsedData.length === 0) return [];
        
        return parsedData.map((row, index) => {
            const changeInfo = getRecordChanges(row);
            const keyField = targetType === 'measurement' ? 'code' : 'so_hieu';
            const keyVal = String(row[mappings[keyField]] || '').trim();
            
            let displayName = '';
            if (targetType === 'measurement') {
                const nameCol = mappings['customerName'];
                displayName = nameCol ? String(row[nameCol] || '').trim() : '';
                if (!displayName && changeInfo.matchedItem) {
                    displayName = changeInfo.matchedItem.customerName || '';
                }
            } else {
                const nameCol = mappings['noi_nhan_gui'];
                displayName = nameCol ? String(row[nameCol] || '').trim() : '';
                if (!displayName && changeInfo.matchedItem) {
                    displayName = changeInfo.matchedItem.noi_nhan_gui || changeInfo.matchedItem.customerName || '';
                }
            }

            return {
                index,
                row,
                keyVal,
                displayName,
                ...changeInfo
            };
        });
    }, [parsedData, mappings, existingRecords, existingArchive, targetType, archiveType, systemFields]);

    // Computes matching status statistics
    const syncStats = useMemo(() => {
        if (parsedData.length === 0) return { matched: 0, unmatched: 0, total: 0, unmappedKey: true };

        const keyField = targetType === 'measurement' ? 'code' : 'so_hieu';
        const keyMap = mappings[keyField];

        if (!keyMap) {
            return { matched: 0, unmatched: 0, total: parsedData.length, unmappedKey: true };
        }

        let matched = 0;
        let unmatched = 0;

        previewItems.forEach(item => {
            if (item.isMatched) {
                matched++;
            } else {
                unmatched++;
            }
        });

        return {
            matched,
            unmatched,
            total: parsedData.length,
            unmappedKey: false
        };
    }, [parsedData, mappings, previewItems, targetType]);

    // Fast filtered list based on search and selected filter tabs
    const filteredPreviewItems = useMemo(() => {
        let items = previewItems;

        // 1. Search filter
        if (previewSearch.trim()) {
            const query = previewSearch.toLowerCase().trim();
            items = items.filter(item => 
                item.keyVal.toLowerCase().includes(query) || 
                item.displayName.toLowerCase().includes(query)
            );
        }

        // 2. Status filter
        if (previewFilter === 'updates') {
            items = items.filter(item => item.status === 'UPDATE');
        } else if (previewFilter === 'inserts') {
            items = items.filter(item => item.status === 'INSERT');
        } else if (previewFilter === 'unchanged') {
            items = items.filter(item => item.status === 'UNCHANGED');
        }

        return items;
    }, [previewItems, previewSearch, previewFilter]);

    // Pre-validation before trigger
    const handlePreTriggerSync = () => {
        const keyField = targetType === 'measurement' ? 'code' : 'so_hieu';
        if (!mappings[keyField]) {
            notify(`Bạn phải chọn trường cột chứa khóa chính "${targetType === 'measurement' ? 'Mã hồ sơ' : 'Số hiệu / Số hồ sơ'}" để đối chiếu.`, 'error');
            return;
        }

        if (syncStats.matched === 0 && !allowInsert) {
            notify('Không tìm thấy bản ghi nào trùng khớp mã và bạn đang tắt tùy chọn "Thêm mới bản ghi không khớp mã". Không có gì để đồng bộ!', 'info');
            return;
        }

        // Open confirm Modal
        setIsConfirmOpen(true);
        setConfirmInput('');
    };

    // Actual Synchronization Executor with smooth chunk batching and reporting
    const executeSync = async () => {
        setIsConfirmOpen(false);
        setSyncing(true);
        setSyncReport(null);

        const keyField = targetType === 'measurement' ? 'code' : 'so_hieu';
        const keyMap = mappings[keyField];

        // Prepare the arrays
        const recordsToUpdate: Partial<RecordFile>[] = [];
        const recordsToInsert: RecordFile[] = [];
        const archiveBatch: Partial<ArchiveRecord>[] = [];

        const isArchiveLandRecord = targetType === 'archive' && (archiveType === 'saoluc' || archiveType === 'congvan');

        // Parse and classify the records first
        if (targetType === 'measurement' || isArchiveLandRecord) {
            parsedData.forEach(row => {
                const codeVal = String(row[keyMap] || '').trim();
                if (!codeVal) return;

                let matchedRecord: any = null;
                if (targetType === 'measurement') {
                    matchedRecord = existingRecords.find(r => r.code?.toLowerCase() === codeVal.toLowerCase());
                } else if (archiveType === 'saoluc') {
                    matchedRecord = existingRecords.find(r => 
                        r.code?.toLowerCase() === codeVal.toLowerCase() && 
                        (r.recordType?.startsWith('1.1') || r.recordType?.toLowerCase().includes('cung cấp dữ liệu') || r.recordType?.toLowerCase().includes('cung cấp tài liệu') || r.recordType?.toLowerCase().includes('sao lục') || r.recordType === 'Cung cấp tài liệu đất đai')
                    );
                } else if (archiveType === 'congvan') {
                    matchedRecord = existingRecords.find(r => 
                        r.code?.toLowerCase() === codeVal.toLowerCase() && 
                        (r.recordType?.startsWith('1.2') || r.recordType?.toLowerCase().includes('công văn'))
                    );
                }

                const recordData: any = {};
                systemFields.forEach(f => {
                    const csvCol = mappings[f.systemField];
                    if (csvCol && row[csvCol] !== undefined) {
                        let cellVal = row[csvCol];
                        let targetDbField = f.systemField;
                        if (isArchiveLandRecord) {
                            if (f.systemField === 'so_hieu') targetDbField = 'code';
                            else if (f.systemField === 'noi_nhan_gui') targetDbField = 'customerName';
                            else if (f.systemField === 'trich_yeu') targetDbField = 'content';
                            else if (f.systemField === 'ngay_thang') targetDbField = 'receivedDate';
                            else if (f.systemField === 'xa_phuong') targetDbField = 'ward';
                            else if (f.systemField === 'to_ban_do') targetDbField = 'mapSheet';
                            else if (f.systemField === 'thua_dat') targetDbField = 'landPlot';
                            else if (f.systemField === 'hen_tra') targetDbField = 'deadline';
                            else if (f.systemField === 'ngay_hoan_thanh') targetDbField = 'completedWorkDate';
                            else if (f.systemField === 'danh_sach') targetDbField = 'exportBatch';
                            else if (f.systemField === 'receipt_number') targetDbField = 'receiptNumber';
                            else if (f.systemField === 'payment_amount') targetDbField = 'paymentAmount';
                            else if (f.systemField === 'result_returned_date') targetDbField = 'resultReturnedDate';
                            else if (f.systemField === 'assigned_to') targetDbField = 'assignedTo';
                        }

                        if (['area', 'residentialArea', 'clnArea', 'bhkArea', 'lucArea', 'otherLandArea', 'price', 'advancePayment', 'paymentAmount', 'payment_amount'].includes(f.systemField)) {
                            const parsedNum = parseFloat(String(cellVal).replace(/[^0-9.-]/g, ''));
                            recordData[targetDbField] = isNaN(parsedNum) ? null : parsedNum;
                        } else if (['receivedDate', 'deadline', 'assignedDate', 'submissionDate', 'approvalDate', 'completedDate', 'issueDate', 'resultReturnedDate', 'ngay_thang', 'hen_tra', 'ngay_hoan_thanh', 'result_returned_date', 'ngay_ky_gcn', 'ngay_ky_phieu_tk'].includes(f.systemField)) {
                            recordData[targetDbField] = formatValueToDate(cellVal);
                        } else {
                            recordData[targetDbField] = String(cellVal).trim();
                        }
                    }
                });

                if (matchedRecord) {
                    recordsToUpdate.push({
                        id: matchedRecord.id,
                        code: codeVal,
                        customerName: matchedRecord.customerName || 'Chưa rõ',
                        ...recordData
                    });
                } else if (allowInsert) {
                    const defaultRecordType = archiveType === 'saoluc' ? '1.1 Cung cấp dữ liệu đất đai' : '1.2 Công văn';
                    const dummyInsert: any = {
                        customerName: recordData.customerName || 'Nhập từ CSV',
                        phoneNumber: '',
                        cccd: '',
                        customerAddress: '',
                        ward: recordData.ward || '',
                        landPlot: recordData.landPlot || '',
                        mapSheet: recordData.mapSheet || '',
                        address: '',
                        content: recordData.content || '',
                        notes: '',
                        status: 'RECEIVED',
                        receivedDate: recordData.receivedDate || new Date().toISOString().split('T')[0],
                        recordType: targetType === 'measurement' ? 'Đo đạc bản đồ' : defaultRecordType,
                        ...recordData,
                        code: codeVal,
                    };
                    recordsToInsert.push(dummyInsert);
                }
            });
        } else {
            parsedData.forEach(row => {
                const soHieuVal = String(row[keyMap] || '').trim();
                if (!soHieuVal) return;

                const matchedArchive = existingArchive.find(r => r.so_hieu?.toLowerCase() === soHieuVal.toLowerCase() && r.type === archiveType);

                const extData: any = matchedArchive ? { ...(matchedArchive.data || {}) } : {};
                const rootFields: any = {};

                systemFields.forEach(f => {
                    const csvCol = mappings[f.systemField];
                    if (csvCol && row[csvCol] !== undefined) {
                        let cellVal = row[csvCol];
                        if (['ngay_thang', 'hen_tra', 'ngay_hoan_thanh', 'result_returned_date', 'ngay_ky_gcn', 'ngay_ky_phieu_tk'].includes(f.systemField)) {
                            cellVal = formatValueToDate(cellVal);
                        } else {
                            cellVal = String(cellVal).trim();
                        }

                        if (['so_hieu', 'noi_nhan_gui', 'trich_yeu', 'ngay_thang'].includes(f.systemField)) {
                            rootFields[f.systemField] = cellVal;
                        } else {
                            extData[f.systemField] = cellVal;
                        }
                    }
                });

                if (matchedArchive) {
                    archiveBatch.push({
                        id: matchedArchive.id,
                        type: archiveType,
                        status: matchedArchive.status,
                        so_hieu: rootFields.so_hieu || matchedArchive.so_hieu,
                        noi_nhan_gui: rootFields.noi_nhan_gui || matchedArchive.noi_nhan_gui,
                        trich_yeu: rootFields.trich_yeu || matchedArchive.trich_yeu,
                        ngay_thang: rootFields.ngay_thang || matchedArchive.ngay_thang,
                        data: extData
                    });
                } else if (allowInsert) {
                    archiveBatch.push({
                        type: archiveType,
                        status: 'draft',
                        so_hieu: soHieuVal,
                        noi_nhan_gui: rootFields.noi_nhan_gui || 'Nhập từ CSV',
                        trich_yeu: rootFields.trich_yeu || '',
                        ngay_thang: rootFields.ngay_thang || new Date().toISOString().split('T')[0],
                        data: {
                            ...extData,
                            createdFromSync: true
                        }
                    });
                }
            });
        }

        // Chunking Batch configurations
        let updatedCount = 0;
        let insertedCount = 0;
        let failedCount = 0;
        const detailsList: { code: string; status: 'CẬP NHẬT' | 'THÊM MỚI' | 'LỖI'; message?: string }[] = [];

        try {
            if (targetType === 'measurement' || isArchiveLandRecord) {
                const totalOps = recordsToUpdate.length + recordsToInsert.length;
                const totalBatches = Math.ceil(recordsToUpdate.length / CHUNK_SIZE) + Math.ceil(recordsToInsert.length / CHUNK_SIZE);
                let currentProcessed = 0;
                let currentBatch = 0;

                setProgress({ processed: 0, total: totalOps, currentBatch: 0, totalBatches });

                // 1. Process updates in chunks
                for (let i = 0; i < recordsToUpdate.length; i += CHUNK_SIZE) {
                    currentBatch++;
                    const chunk = recordsToUpdate.slice(i, i + CHUNK_SIZE);
                    
                    setProgress({
                        processed: currentProcessed,
                        total: totalOps,
                        currentBatch,
                        totalBatches
                    });

                    const res = await updateRecordsBatchById(chunk);
                    if (res.success) {
                        updatedCount += res.count;
                        chunk.forEach(item => {
                            detailsList.push({
                                code: item.code || 'N/A',
                                status: 'CẬP NHẬT',
                                message: `Đồng bộ thành công! Chủ sử dụng: ${item.customerName || 'N/A'}`
                            });
                        });
                    } else {
                        failedCount += chunk.length;
                        chunk.forEach(item => {
                            detailsList.push({
                                code: item.code || 'N/A',
                                status: 'LỖI',
                                message: `Đồng bộ thất bại: Không thể cập nhật thông tin chủ sử dụng ${item.customerName || ''}`
                            });
                        });
                    }

                    currentProcessed += chunk.length;
                    setProgress({
                        processed: currentProcessed,
                        total: totalOps,
                        currentBatch,
                        totalBatches
                    });

                    // Add a tiny delay to ensure smooth transition and render progress on UI
                    await new Promise(resolve => setTimeout(resolve, 200));
                }

                // 2. Process inserts in chunks
                for (let i = 0; i < recordsToInsert.length; i += CHUNK_SIZE) {
                    currentBatch++;
                    const chunk = recordsToInsert.slice(i, i + CHUNK_SIZE);

                    setProgress({
                        processed: currentProcessed,
                        total: totalOps,
                        currentBatch,
                        totalBatches
                    });

                    const payloadWithIds = chunk.map(item => ({
                        ...item,
                        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9)
                    }));

                    const res = await updateRecordsBatchById(payloadWithIds);
                    if (res.success) {
                        insertedCount += res.count;
                        chunk.forEach(item => {
                            detailsList.push({
                                code: item.code || 'N/A',
                                status: 'THÊM MỚI',
                                message: `Thêm mới thành công! Chủ đất: ${item.customerName || 'Nhập từ CSV'}`
                            });
                        });
                    } else {
                        failedCount += chunk.length;
                        chunk.forEach(item => {
                            detailsList.push({
                                code: item.code || 'N/A',
                                status: 'LỖI',
                                message: `Đồng bộ thất bại: Không thể thêm mới hồ sơ này`
                            });
                        });
                    }

                    currentProcessed += chunk.length;
                    setProgress({
                        processed: currentProcessed,
                        total: totalOps,
                        currentBatch,
                        totalBatches
                    });

                    await new Promise(resolve => setTimeout(resolve, 200));
                }

            } else {
                // Process archive records in chunks
                const totalOps = archiveBatch.length;
                const totalBatches = Math.ceil(totalOps / CHUNK_SIZE);
                let currentProcessed = 0;
                let currentBatch = 0;

                setProgress({ processed: 0, total: totalOps, currentBatch: 0, totalBatches });

                for (let i = 0; i < totalOps; i += CHUNK_SIZE) {
                    currentBatch++;
                    const chunk = archiveBatch.slice(i, i + CHUNK_SIZE);

                    setProgress({
                        processed: currentProcessed,
                        total: totalOps,
                        currentBatch,
                        totalBatches
                    });

                    const res = await upsertArchiveRecordsBatch(chunk);
                    if (res.success) {
                        chunk.forEach(item => {
                            if (item.id) {
                                updatedCount++;
                                detailsList.push({
                                    code: item.so_hieu || 'N/A',
                                    status: 'CẬP NHẬT',
                                    message: `Đồng bộ thành công! Hồ sơ: ${item.noi_nhan_gui || 'N/A'}`
                                });
                            } else {
                                insertedCount++;
                                detailsList.push({
                                    code: item.so_hieu || 'N/A',
                                    status: 'THÊM MỚI',
                                    message: `Đồng bộ thêm mới thành công! Gửi/Nhận: ${item.noi_nhan_gui || 'N/A'}`
                                });
                            }
                        });
                    } else {
                        failedCount += chunk.length;
                        chunk.forEach(item => {
                            detailsList.push({
                                code: item.so_hieu || 'N/A',
                                status: 'LỖI',
                                message: `Đồng bộ thất bại: Lỗi dữ liệu lưu trữ`
                            });
                        });
                    }

                    currentProcessed += chunk.length;
                    setProgress({
                        processed: currentProcessed,
                        total: totalOps,
                        currentBatch,
                        totalBatches
                    });

                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }

            // Fire Success Notice
            notify(`Đồng bộ hoàn tất! Thành công: ${updatedCount + insertedCount}, Thất bại: ${failedCount}`, failedCount > 0 ? 'error' : 'success');

            // Open beautiful Synchronization Report screen
            setSyncReport({
                isOpen: true,
                target: targetType === 'measurement' ? 'Hồ sơ Đo đạc' : `Hồ sơ Lưu trữ (${archiveType.toUpperCase()})`,
                totalRecords: updatedCount + insertedCount + failedCount,
                updatedCount,
                insertedCount,
                failedCount,
                details: detailsList
            });

            // Reload database state
            loadDatabaseState();
            if (onRefreshData) onRefreshData();

            // Clear active csv files
            setFileName('');
            setCsvHeaders([]);
            setParsedData([]);
            setMappings({});
            if (fileInputRef.current) fileInputRef.current.value = '';

        } catch (err) {
            console.error(err);
            notify('Lỗi không xác định trong quá trình đồng bộ.', 'error');
        } finally {
            setSyncing(false);
        }
    };

    // Calculate which system fields are successfully mapped
    const mappedFieldsCount = Object.keys(mappings).length;

    return (
        <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-slate-50">
            {/* Header / Intro */}
            <div className="mb-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <div className="bg-rose-50 p-2.5 rounded-lg text-rose-600">
                        <Database size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Đồng bộ dữ liệu từ File CSV / Excel</h2>
                        <p className="text-sm text-slate-500">
                            Cập nhật hàng loạt hoặc thêm mới thông tin hồ sơ đo đạc và lưu trữ dựa trên việc khớp mã hồ sơ từ tệp tin dữ liệu.
                        </p>
                    </div>
                </div>
            </div>

            {/* Config & File Upload Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* 1. Target config */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-rose-500 rounded-full"></span>
                        1. Cấu hình đích đồng bộ
                    </h3>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Phân loại hồ sơ cần đồng bộ
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setTargetType('measurement')}
                                className={`p-3 rounded-lg border-2 text-sm font-bold transition-all text-center flex flex-col items-center gap-2 ${targetType === 'measurement' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                            >
                                <FileSpreadsheet size={20} />
                                Hồ sơ Đo đạc
                            </button>
                            <button
                                type="button"
                                onClick={() => setTargetType('archive')}
                                className={`p-3 rounded-lg border-2 text-sm font-bold transition-all text-center flex flex-col items-center gap-2 ${targetType === 'archive' ? 'border-orange-600 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                            >
                                <Database size={20} />
                                Hồ sơ Lưu trữ
                            </button>
                        </div>
                    </div>

                    {targetType === 'archive' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                Phân hệ Lưu trữ
                            </label>
                            <select
                                value={archiveType}
                                onChange={(e) => setArchiveType(e.target.value as any)}
                                className="w-full rounded-lg border-slate-200 text-sm focus:ring-rose-500 focus:border-rose-500 font-medium"
                            >
                                <option value="saoluc">1.1 Cung cấp dữ liệu đất đai</option>
                                <option value="congvan">1.2 Công văn</option>
                                <option value="vaoso">1.3 Đăng ký vào sổ địa chính</option>
                            </select>
                        </div>
                    )}

                    <div className="pt-2 border-t border-slate-100">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={allowInsert}
                                onChange={(e) => setAllowInsert(e.target.checked)}
                                className="rounded text-rose-600 focus:ring-rose-500 border-slate-300 w-4 h-4"
                            />
                            <div className="text-sm">
                                <span className="font-bold text-slate-700 block">Thêm mới bản ghi không khớp</span>
                                <span className="text-xs text-slate-400">Nếu mã hồ sơ trong file chưa tồn tại trên hệ thống, hệ thống sẽ tự động thêm mới.</span>
                            </div>
                        </label>
                    </div>
                </div>

                {/* 2. File uploader */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-rose-500 rounded-full"></span>
                        2. Chọn tệp dữ liệu CSV/Excel
                    </h3>

                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 min-h-[120px] border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-4 hover:border-rose-500 hover:bg-slate-50 transition-colors cursor-pointer text-center group"
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".csv, .xls, .xlsx"
                            className="hidden"
                        />
                        <Upload size={32} className="text-slate-400 group-hover:text-rose-500 transition-colors mb-2" />
                        {fileName ? (
                            <div>
                                <span className="text-sm font-bold text-rose-600 block truncate max-w-[240px]">{fileName}</span>
                                <span className="text-xs text-slate-400">Nhấp để thay đổi tệp tin</span>
                            </div>
                        ) : (
                            <div>
                                <span className="text-sm font-bold text-slate-600 block">Kéo thả hoặc duyệt tệp tin</span>
                                <span className="text-xs text-slate-400">Hỗ trợ định dạng .csv, .xls, .xlsx</span>
                            </div>
                        )}
                    </div>

                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 flex gap-2">
                        <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                        <span className="text-xs text-amber-800 leading-normal">
                            Đảm bảo file dữ liệu của bạn có dòng đầu tiên chứa tiêu đề các cột (headers).
                        </span>
                    </div>
                </div>

                {/* 3. Sync Dashboard stats */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-4">
                            <span className="w-1.5 h-4 bg-rose-500 rounded-full"></span>
                            3. Kết quả đối chiếu & Báo cáo
                        </h3>

                        {parsedData.length > 0 ? (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded-lg border border-slate-100">
                                    <span className="text-slate-500 font-medium">Tổng dòng trong tệp:</span>
                                    <span className="font-bold text-slate-800 text-base">{syncStats.total}</span>
                                </div>

                                <div className="flex justify-between items-center text-sm p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                                    <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                                        <CheckCircle2 size={16} /> Khớp mã (Sẽ Cập nhật):
                                    </span>
                                    <span className="font-bold text-emerald-800 text-base">{syncStats.matched}</span>
                                </div>

                                <div className="flex justify-between items-center text-sm p-2 bg-blue-50 rounded-lg border border-blue-100">
                                    <span className="text-blue-700 font-medium flex items-center gap-1.5">
                                        <Database size={16} /> Không khớp mã:
                                    </span>
                                    <span className="font-bold text-blue-800 text-base">
                                        {syncStats.unmatched} <span className="text-xs text-slate-500 font-normal">({allowInsert ? 'Sẽ Thêm mới' : 'Sẽ Bỏ qua'})</span>
                                    </span>
                                </div>

                                <div className="flex justify-between items-center text-sm p-2 bg-rose-50 rounded-lg border border-rose-100">
                                    <span className="text-rose-700 font-medium flex items-center gap-1.5">
                                        Số trường dữ liệu ánh xạ:
                                    </span>
                                    <span className="font-bold text-rose-800 text-base">{mappedFieldsCount} / {systemFields.length}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-slate-400">
                                <HelpCircle size={32} className="mx-auto mb-2 text-slate-300" />
                                <span className="text-sm">Vui lòng tải tệp để phân tích báo cáo số liệu</span>
                            </div>
                        )}
                    </div>

                    {parsedData.length > 0 && (
                        <div className="mt-4">
                            <button
                                type="button"
                                disabled={syncStats.unmappedKey || syncing}
                                onClick={handlePreTriggerSync}
                                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                            >
                                {syncing ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Đang đồng bộ...
                                    </>
                                ) : (
                                    <>
                                        <Play size={18} />
                                        Tiến hành Đồng bộ Dữ liệu
                                    </>
                                )}
                            </button>
                            {syncStats.unmappedKey && (
                                <p className="text-center text-xs text-red-500 mt-1.5 font-medium">
                                    * Phải cấu hình cột khóa chính ({targetType === 'measurement' ? 'Mã hồ sơ' : 'Số hiệu'}) để đồng bộ
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Mappings Configurations & Previews */}
            {parsedData.length > 0 && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                    {/* Columns Mapping Panel */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <span className="w-1.5 h-4 bg-rose-500 rounded-full"></span>
                                Cấu hình Ánh xạ các Trường dữ liệu
                            </h3>
                            <button
                                type="button"
                                onClick={() => handleAutoMap(csvHeaders)}
                                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 transition-colors border border-slate-200"
                            >
                                <RefreshCw size={12} />
                                Khớp tự động lại
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 text-slate-500">
                                        <th className="pb-2 font-semibold">Trường hệ thống</th>
                                        <th className="pb-2 font-semibold">Cột trong File CSV của bạn</th>
                                        <th className="pb-2 font-semibold text-right">Mô tả</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {systemFields.map((field) => {
                                        const mapped = mappings[field.systemField] || '';
                                        return (
                                            <tr key={field.systemField} className="hover:bg-slate-50">
                                                <td className="py-2.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-medium text-slate-700">{field.systemLabel}</span>
                                                        {field.required && (
                                                            <span className="text-red-500 font-bold" title="Trường bắt buộc đối chiếu">*</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-2.5">
                                                    <select
                                                        value={mapped}
                                                        onChange={(e) => handleMappingChange(field.systemField, e.target.value)}
                                                        className={`w-full max-w-[200px] text-xs font-semibold rounded-lg py-1.5 px-2 focus:ring-rose-500 focus:border-rose-500 ${mapped ? 'bg-rose-50 border-rose-300 text-rose-800' : 'bg-white border-slate-200 text-slate-400'}`}
                                                    >
                                                        <option value="">-- Bỏ qua không đồng bộ --</option>
                                                        {csvHeaders.map(h => (
                                                            <option key={h} value={h}>{h}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="py-2.5 text-right text-xs text-slate-400 max-w-[240px] truncate" title={field.description}>
                                                    {field.description}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Interactive Preview & Live Cross-Comparison Board */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[560px]">
                        {/* Tab Switcher and Title */}
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 flex-wrap gap-2 shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-4 bg-rose-500 rounded-full"></span>
                                <h3 className="font-bold text-slate-700">Xem trước & Đối chiếu dữ liệu</h3>
                            </div>
                            
                            <div className="bg-slate-100 p-0.5 rounded-lg flex border border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setPreviewTab('comparison')}
                                    className={`px-3.5 py-1 text-xs font-bold rounded-md transition-all ${previewTab === 'comparison' ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    Bảng đối chiếu (So sánh)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPreviewTab('list')}
                                    className={`px-3.5 py-1 text-xs font-bold rounded-md transition-all ${previewTab === 'list' ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    Dữ liệu tệp thô
                                </button>
                            </div>
                        </div>

                        {previewTab === 'comparison' ? (
                            <>
                                {/* Comparison Controls: Search and State Filters */}
                                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mb-4 shrink-0">
                                    {/* Search Box */}
                                    <div className="relative flex-1 max-w-sm">
                                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                                            <Search size={14} />
                                        </span>
                                        <input
                                            type="text"
                                            placeholder="Tìm theo Mã HS, Số hiệu hoặc tên chủ..."
                                            value={previewSearch}
                                            onChange={(e) => setPreviewSearch(e.target.value)}
                                            className="w-full pl-8.5 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100 focus:bg-white text-xs border border-slate-200 rounded-lg focus:ring-rose-500 focus:border-rose-500 font-medium"
                                        />
                                        {previewSearch && (
                                            <button 
                                                onClick={() => setPreviewSearch('')}
                                                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Filter Chips */}
                                    <div className="flex flex-wrap gap-1 items-center text-[11px]">
                                        <button
                                            type="button"
                                            onClick={() => setPreviewFilter('all')}
                                            className={`px-2.5 py-1 rounded-md font-bold transition-all ${previewFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                        >
                                            Tất cả ({previewItems.length})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPreviewFilter('updates')}
                                            className={`px-2.5 py-1 rounded-md font-bold border transition-all ${previewFilter === 'updates' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'}`}
                                        >
                                            Cần cập nhật ({previewItems.filter(i => i.status === 'UPDATE').length})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPreviewFilter('inserts')}
                                            className={`px-2.5 py-1 rounded-md font-bold border transition-all ${previewFilter === 'inserts' ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100'}`}
                                        >
                                            Thêm mới ({previewItems.filter(i => i.status === 'INSERT').length})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPreviewFilter('unchanged')}
                                            className={`px-2.5 py-1 rounded-md font-bold border transition-all ${previewFilter === 'unchanged' ? 'bg-slate-600 text-white border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}`}
                                        >
                                            Trùng khớp ({previewItems.filter(i => i.status === 'UNCHANGED').length})
                                        </button>
                                    </div>
                                </div>

                                {/* Comparison Scroll List */}
                                <div className="flex-1 overflow-y-auto space-y-3 pr-1 bg-slate-50 p-3 rounded-xl border border-slate-150">
                                    {filteredPreviewItems.slice(0, 100).map((item) => (
                                        <div 
                                            key={item.index}
                                            className={`p-3 bg-white rounded-lg border shadow-xs hover:shadow-sm transition-all ${
                                                item.status === 'UPDATE' ? 'border-l-4 border-l-emerald-500 border-slate-200' :
                                                item.status === 'INSERT' ? 'border-l-4 border-l-blue-500 border-slate-200' :
                                                'border-l-4 border-l-slate-400 border-slate-200'
                                            }`}
                                        >
                                            {/* Item Header */}
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-mono font-black text-xs text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                                                            {targetType === 'measurement' ? 'Mã: ' : 'Số hiệu: '}{item.keyVal}
                                                        </span>
                                                        <span className="text-[11px] text-slate-400 font-medium">#Dòng {item.index + 1}</span>
                                                    </div>
                                                    {item.displayName && (
                                                        <h4 className="text-xs font-bold text-slate-700 mt-1">
                                                            Chủ sở hữu: <span className="text-slate-900">{item.displayName}</span>
                                                        </h4>
                                                    )}
                                                </div>

                                                {/* Badge */}
                                                <div>
                                                    {item.status === 'UPDATE' && (
                                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black text-[10px] uppercase">
                                                            CẬP NHẬT ({item.diffs.length})
                                                        </span>
                                                    )}
                                                    {item.status === 'INSERT' && (
                                                        <span className={`px-2 py-0.5 rounded font-black text-[10px] uppercase ${allowInsert ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                                                            {allowInsert ? 'THÊM MỚI' : 'BỎ QUA (Tắt Thêm mới)'}
                                                        </span>
                                                    )}
                                                    {item.status === 'UNCHANGED' && (
                                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-black text-[10px] uppercase">
                                                            TRÙNG KHỚP
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Item Body - Changes list or properties */}
                                            {item.status === 'UPDATE' && (
                                                <div className="text-[11px] bg-slate-50 rounded-lg p-2.5 border border-slate-150 divide-y divide-slate-100">
                                                    <p className="text-[10px] font-bold text-slate-450 uppercase tracking-wide pb-1.5">Trường thông tin sẽ thay đổi:</p>
                                                    {item.diffs.map((diff, dIdx) => (
                                                        <div key={dIdx} className="py-1 flex items-center justify-between gap-2">
                                                            <span className="font-bold text-slate-500 shrink-0">{diff.fieldLabel}</span>
                                                            <div className="flex items-center gap-1.5 overflow-hidden text-right">
                                                                <span className="text-slate-400 line-through truncate max-w-[120px]" title={diff.oldValue}>{diff.oldValue}</span>
                                                                <ArrowRight size={10} className="text-slate-400 shrink-0" />
                                                                <span className="text-emerald-700 font-bold bg-emerald-50 px-1 py-0.2 rounded truncate max-w-[140px]" title={diff.newValue}>{diff.newValue}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {item.status === 'INSERT' && (
                                                <div className="text-[10px] bg-slate-50/50 rounded-lg p-2 border border-slate-100">
                                                    <p className="font-bold text-slate-400 uppercase tracking-wide mb-1">Dữ liệu hồ sơ mới:</p>
                                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-600">
                                                        {systemFields.filter(f => mappings[f.systemField] && item.row[mappings[f.systemField]]).slice(0, 4).map(f => (
                                                            <div key={f.systemField} className="truncate">
                                                                <span className="font-bold text-slate-400">{f.systemLabel}:</span> {String(item.row[mappings[f.systemField]])}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {item.status === 'UNCHANGED' && (
                                                <p className="text-[11px] text-slate-500 italic mt-1 flex items-center gap-1">
                                                    <CheckCircle2 size={12} className="text-emerald-500" />
                                                    Dữ liệu trong File hoàn toàn khớp với hệ thống hiện tại. Không cần thay đổi.
                                                </p>
                                            )}
                                        </div>
                                    ))}

                                    {filteredPreviewItems.length === 0 && (
                                        <div className="text-center py-16 text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl">
                                            <Info className="mx-auto mb-2 text-slate-300" size={32} />
                                            Không tìm thấy bản ghi nào khớp tiêu chí lọc & tìm kiếm.
                                        </div>
                                    )}
                                </div>

                                {filteredPreviewItems.length > 100 && (
                                    <p className="text-slate-400 text-[10px] mt-2 text-center italic shrink-0">
                                        * Đang hiển thị giới hạn 100 dòng đầu tiên khớp bộ lọc
                                    </p>
                                )}
                            </>
                        ) : (
                            <>
                                {/* Raw file tabular view */}
                                <div className="flex-1 overflow-auto border border-slate-150 rounded-lg">
                                    <table className="w-full text-left text-xs divide-y divide-slate-150">
                                        <thead className="bg-slate-50 text-slate-500 uppercase sticky top-0 font-bold border-b border-slate-150">
                                            <tr>
                                                <th className="p-2.5">Trạng thái</th>
                                                {systemFields.filter(f => mappings[f.systemField]).map(f => (
                                                    <th key={f.systemField} className="p-2.5">
                                                        {f.systemLabel}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {parsedData.slice(0, 100).map((row, idx) => {
                                                const keyField = targetType === 'measurement' ? 'code' : 'so_hieu';
                                                const keyVal = String(row[mappings[keyField]] || '').trim();
                                                
                                                let isMatched = false;
                                                if (targetType === 'measurement') {
                                                    isMatched = existingRecords.some(r => r.code?.toLowerCase() === keyVal.toLowerCase());
                                                } else {
                                                    isMatched = existingArchive.some(r => r.so_hieu?.toLowerCase() === keyVal.toLowerCase() && r.type === archiveType);
                                                }

                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50">
                                                        <td className="p-2 font-medium">
                                                            {isMatched ? (
                                                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">CẬP NHẬT</span>
                                                            ) : (
                                                                <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${allowInsert ? 'bg-blue-100 text-blue-800' : 'bg-slate-150 text-slate-400'}`}>
                                                                    {allowInsert ? 'THÊM MỚI' : 'BỎ QUA'}
                                                                </span>
                                                            )}
                                                        </td>
                                                        {systemFields.filter(f => mappings[f.systemField]).map(f => {
                                                            const cellVal = row[mappings[f.systemField]];
                                                            let displayVal = String(cellVal || '');
                                                            if (f.systemField === 'ngay_thang' || f.systemField === 'hen_tra') {
                                                                displayVal = formatValueToDate(cellVal);
                                                            }
                                                            return (
                                                                <td key={f.systemField} className="p-2 text-slate-600 max-w-[150px] truncate" title={displayVal}>
                                                                    {displayVal}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {parsedData.length > 100 && (
                                    <p className="text-slate-400 text-[10px] mt-2 text-center italic shrink-0">
                                        * Đang hiển thị giới hạn 100 dòng đầu tiên của dữ liệu tệp thô
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Confirmation Dialog Modal */}
            {isConfirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden animate-scale-up">
                        {/* Header banner */}
                        <div className="bg-rose-600 p-5 text-white">
                            <div className="flex items-center gap-3">
                                <AlertTriangle size={32} className="shrink-0 animate-bounce" />
                                <div>
                                    <h4 className="text-lg font-bold">Xác nhận Đồng bộ dữ liệu</h4>
                                    <p className="text-xs text-rose-100 leading-normal">Hành động này sẽ sửa đổi vĩnh viễn thông tin trong Cơ sở dữ liệu!</p>
                                </div>
                            </div>
                        </div>

                        {/* Stats Report inside Modal */}
                        <div className="p-5 space-y-4">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <h5 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-3">Báo cáo Tổng hợp đồng bộ</h5>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="bg-white p-2.5 rounded border border-slate-100">
                                        <span className="text-xs text-slate-400 block mb-0.5">Tổng số bản ghi:</span>
                                        <span className="font-bold text-slate-800">{syncStats.total}</span>
                                    </div>
                                    <div className="bg-white p-2.5 rounded border border-slate-100">
                                        <span className="text-xs text-slate-400 block mb-0.5">Mục tiêu đích:</span>
                                        <span className="font-bold text-slate-800 truncate block">
                                            {targetType === 'measurement' ? 'Hồ sơ Đo đạc' : `Lưu trữ (${archiveType.toUpperCase()})`}
                                        </span>
                                    </div>
                                    <div className="bg-emerald-50 p-2.5 rounded border border-emerald-100">
                                        <span className="text-xs text-emerald-600 block mb-0.5">Sẽ CẬP NHẬT:</span>
                                        <span className="font-bold text-emerald-800">{syncStats.matched}</span>
                                    </div>
                                    <div className="bg-blue-50 p-2.5 rounded border border-blue-100">
                                        <span className="text-xs text-blue-600 block mb-0.5">Sẽ THÊM MỚI:</span>
                                        <span className="font-bold text-blue-800">{allowInsert ? syncStats.unmatched : 0}</span>
                                    </div>
                                </div>
                            </div>

                            {/* List of Fields to Synchronize */}
                            <div>
                                <h5 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-2">Các trường dữ liệu được đồng bộ:</h5>
                                <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto p-1 bg-slate-100 rounded">
                                    {systemFields.filter(f => mappings[f.systemField]).map(f => (
                                        <span key={f.systemField} className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-50 text-rose-700 text-xs rounded-full font-bold border border-rose-100">
                                            <Check size={10} /> {f.systemLabel}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100">
                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                                    Nhập chữ <strong className="text-rose-600">DONG BO</strong> để xác nhận:
                                </label>
                                <input
                                    type="text"
                                    value={confirmInput}
                                    onChange={(e) => setConfirmInput(e.target.value)}
                                    placeholder="DONG BO"
                                    className="w-full uppercase font-bold text-center tracking-widest text-slate-800 rounded-lg border-slate-300 focus:ring-rose-500 focus:border-rose-500"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => setIsConfirmOpen(false)}
                                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-600 font-bold rounded-lg border border-slate-200 transition-colors text-sm"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                disabled={confirmInput !== 'DONG BO'}
                                onClick={executeSync}
                                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow transition-colors text-sm"
                            >
                                Xác nhận Đồng bộ
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Syncing Progress Overlay Modal */}
            {syncing && (() => {
                const percent = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
                        <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full border border-slate-100 flex flex-col items-center text-center space-y-4 animate-scale-up">
                            <div className="p-3 bg-rose-50 text-rose-600 rounded-full">
                                <RefreshCw size={36} className="animate-spin" />
                            </div>
                            <div>
                                <h4 className="text-lg font-bold text-slate-800">Đang tiến hành đồng bộ...</h4>
                                <p className="text-xs text-slate-500 mt-1">Hệ thống đang lưu trữ và đối chiếu các gói dữ liệu</p>
                            </div>

                            {/* Progress Bar Container */}
                            <div className="w-full space-y-2">
                                <div className="flex justify-between text-xs font-bold text-slate-600">
                                    <span>Đã xử lý: {progress.processed}/{progress.total} bản ghi</span>
                                    <span>{percent}%</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden border border-slate-200">
                                    <div 
                                        className="bg-gradient-to-r from-rose-500 to-rose-600 h-full rounded-full transition-all duration-300 ease-out"
                                        style={{ width: `${percent}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between text-[11px] text-slate-450 font-medium">
                                    <span>Lô dữ liệu: {progress.currentBatch}/{progress.totalBatches} batch</span>
                                    <span>Kích thước lô: {CHUNK_SIZE} bản ghi</span>
                                </div>
                            </div>

                            {/* Current Status Message */}
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 w-full text-left flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span className="text-xs font-semibold text-slate-600 truncate">
                                    Đang đồng bộ bảng {targetType === 'measurement' ? 'Hồ sơ Đo đạc' : 'Hồ sơ Lưu trữ'}...
                                </span>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Detailed Synchronization Report Modal */}
            {syncReport && syncReport.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-100 overflow-hidden flex flex-col max-h-[85vh] animate-scale-up">
                        {/* Header */}
                        <div className="bg-slate-900 p-5 text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-500 text-white rounded-lg">
                                    <CheckCircle2 size={24} />
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold">Báo cáo Kết quả Đồng bộ Dữ liệu</h4>
                                    <p className="text-xs text-slate-400">Đích đồng bộ: <span className="text-emerald-400 font-bold">{syncReport.target}</span></p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setSyncReport(prev => prev ? { ...prev, isOpen: false } : null)}
                                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Report Stats Grid */}
                        <div className="p-5 bg-slate-50 border-b border-slate-100 shrink-0">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs text-center">
                                    <span className="text-xs text-slate-400 block font-medium mb-1">Tổng xử lý</span>
                                    <span className="text-2xl font-black text-slate-800">{syncReport.totalRecords}</span>
                                </div>
                                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 shadow-xs text-center">
                                    <span className="text-xs text-emerald-600 block font-medium mb-1">Đã cập nhật</span>
                                    <span className="text-2xl font-black text-emerald-700">{syncReport.updatedCount}</span>
                                </div>
                                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 shadow-xs text-center">
                                    <span className="text-xs text-blue-600 block font-medium mb-1">Thêm mới</span>
                                    <span className="text-2xl font-black text-blue-700">{syncReport.insertedCount}</span>
                                </div>
                                <div className="bg-rose-50 p-3 rounded-lg border border-rose-200 shadow-xs text-center">
                                    <span className="text-xs text-rose-600 block font-medium mb-1 font-bold">Thất bại</span>
                                    <span className={`text-2xl font-black ${syncReport.failedCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                        {syncReport.failedCount}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Filter tabs */}
                        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                            <div className="flex gap-1.5">
                                <button
                                    onClick={() => setReportFilter('ALL')}
                                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${reportFilter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                >
                                    Tất cả ({syncReport.totalRecords})
                                </button>
                                <button
                                    onClick={() => setReportFilter('CẬP NHẬT')}
                                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${reportFilter === 'CẬP NHẬT' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                >
                                    Cập nhật ({syncReport.updatedCount})
                                </button>
                                <button
                                    onClick={() => setReportFilter('THÊM MỚI')}
                                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${reportFilter === 'THÊM MỚI' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                >
                                    Thêm mới ({syncReport.insertedCount})
                                </button>
                                <button
                                    onClick={() => setReportFilter('LỖI')}
                                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${reportFilter === 'LỖI' ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                >
                                    Thất bại ({syncReport.failedCount})
                                </button>
                            </div>
                        </div>

                        {/* Details log list */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-2 bg-slate-50">
                            {syncReport.details
                                .filter(item => reportFilter === 'ALL' || item.status === reportFilter)
                                .map((item, index) => (
                                    <div 
                                        key={index} 
                                        className={`p-3 rounded-lg border bg-white flex items-center justify-between text-xs transition-all hover:shadow-xs ${
                                            item.status === 'CẬP NHẬT' ? 'border-l-4 border-l-emerald-500 border-slate-200' :
                                            item.status === 'THÊM MỚI' ? 'border-l-4 border-l-blue-500 border-slate-200' :
                                            'border-l-4 border-l-rose-500 border-slate-200'
                                        }`}
                                    >
                                        <div className="flex flex-col gap-0.5 max-w-[80%]">
                                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                                Mã: {item.code}
                                            </span>
                                            <span className="text-slate-500 truncate" title={item.message}>{item.message}</span>
                                        </div>
                                        <div>
                                            <span className={`px-2 py-0.5 rounded font-black text-[10px] ${
                                                item.status === 'CẬP NHẬT' ? 'bg-emerald-100 text-emerald-800' :
                                                item.status === 'THÊM MỚI' ? 'bg-blue-100 text-blue-800' :
                                                'bg-rose-100 text-rose-800'
                                            }`}>
                                                {item.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}

                            {syncReport.details.filter(item => reportFilter === 'ALL' || item.status === reportFilter).length === 0 && (
                                <div className="text-center py-12 text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl">
                                    <Info className="mx-auto mb-2 text-slate-300" size={32} />
                                    Không tìm thấy dòng đồng bộ nào khớp với tiêu chí lọc.
                                </div>
                            )}
                        </div>

                        {/* Footer actions */}
                        <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-end shrink-0">
                            <button
                                type="button"
                                onClick={() => setSyncReport(prev => prev ? { ...prev, isOpen: false } : null)}
                                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg shadow-sm transition-colors text-sm"
                            >
                                Đóng báo cáo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DongBoCSVTab;

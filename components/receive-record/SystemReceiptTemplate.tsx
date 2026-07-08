import React, { useRef } from 'react';
import Barcode from 'react-barcode';
import { RecordFile, Employee } from '../../types';
import { getNormalizedWard, REGISTRATION_PROCEDURES } from '../../constants';
import { Printer, FileSignature } from 'lucide-react';

interface SystemReceiptTemplateProps {
    data: Partial<RecordFile>;
    receivingWard: string;
    onClose: () => void;
    currentUser?: any;
    employees?: Employee[];
    onCreateContract?: (record: RecordFile) => void;
}

const SystemReceiptTemplate: React.FC<SystemReceiptTemplateProps> = ({ data, receivingWard, onClose, currentUser, employees, onCreateContract }) => {
    const receiptRef = useRef<HTMLDivElement>(null);
    const controlSlipRef = useRef<HTMLDivElement>(null);

    const printHtml = (htmlContent: string, title: string) => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                <head>
                    <title>${title}</title>
                    <style>
                        @page { 
                            size: A4; 
                            margin: 15mm; 
                        }
                        html, body {
                            margin: 0;
                            padding: 0;
                            width: 100%;
                            height: 100%;
                            background: #fff;
                        }
                        body { 
                            font-family: 'Times New Roman', Times, serif; 
                            font-size: 14px;
                            line-height: 1.3;
                            color: #000;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        .flex { display: flex !important; }
                        .flex-col { flex-direction: column !important; }
                        .justify-between { justify-content: space-between !important; }
                        .items-center { align-items: center !important; }
                        .items-end { align-items: flex-end !important; }
                        .text-center { text-align: center !important; }
                        .font-bold { font-weight: bold !important; }
                        .italic { font-style: italic !important; }
                        .underline { text-decoration: underline !important; }
                        .uppercase { text-transform: uppercase !important; }
                        
                        /* Width Utilities */
                        .w-full { width: 100% !important; }
                        .w-1\\/2 { width: 50% !important; }
                        .w-12 { width: 48px !important; }
                        .w-20 { width: 80px !important; }
                        .w-24 { width: 96px !important; }
                        
                        /* Spacing Utilities */
                        .space-y-\\[6px\\] > :not([hidden]) ~ :not([hidden]) {
                            margin-top: 6px !important;
                        }
                        .space-y-1 > :not([hidden]) ~ :not([hidden]) {
                            margin-top: 4px !important;
                        }
                        .space-y-2 > :not([hidden]) ~ :not([hidden]) {
                            margin-top: 8px !important;
                        }
                        
                        /* Margins */
                        .mb-1 { margin-bottom: 4px !important; }
                        .mb-2 { margin-bottom: 8px !important; }
                        .mb-4 { margin-bottom: 16px !important; }
                        .mb-6 { margin-bottom: 24px !important; }
                        .mt-1 { margin-top: 4px !important; }
                        .mt-2 { margin-top: 8px !important; }
                        .mt-3 { margin-top: 12px !important; }
                        .mt-4 { margin-top: 16px !important; }
                        .mt-6 { margin-top: 24px !important; }
                        .mt-8 { margin-top: 32px !important; }
                        .mt-12 { margin-top: 48px !important; }
                        .my-6 { margin-top: 24px !important; margin-bottom: 24px !important; }
                        .my-8 { margin-top: 32px !important; margin-bottom: 32px !important; }
                        
                        /* Paddings */
                        .pt-4 { padding-top: 16px !important; }
                        .p-1 { padding: 4px !important; }
                        
                        /* Borders */
                        .border { border: 1px solid #000 !important; }
                        .border-black { border-color: #000 !important; }
                        .border-t { border-top: 1px solid #000 !important; }
                        .border-gray-400 { border-color: #000 !important; }
                        .border-collapse { border-collapse: collapse !important; }
                        
                        table { 
                            width: 100% !important; 
                            border-collapse: collapse !important; 
                            margin-top: 8px !important; 
                            margin-bottom: 8px !important; 
                        }
                        th, td { 
                            border: 1px solid #000 !important; 
                            padding: 4px 8px !important; 
                            text-align: left !important; 
                            font-size: 14px !important;
                        }
                        th { 
                            text-align: center !important; 
                            font-weight: bold !important; 
                            background-color: #f2f2f2 !important; 
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        .text-xs { font-size: 11px !important; }
                        .text-sm { font-size: 12px !important; }
                        .text-base { font-size: 14px !important; }
                        .text-lg { font-size: 16px !important; }
                        .text-xl { font-size: 18px !important; }
                        .text-\\[14px\\] { font-size: 14px !important; }
                        .text-\\[15px\\] { font-size: 15px !important; }
                        .text-\\[16px\\] { font-size: 16px !important; }
                        .text-\\[18px\\] { font-size: 18px !important; }
                        
                        .tracking-wide { letter-spacing: 0.05em !important; }
                        .text-gray-500 { color: #666 !important; }
                        .print-page-break { page-break-before: always !important; break-before: page !important; }
                        .avoid-break { page-break-inside: avoid !important; break-inside: avoid !important; }
                        
                        /* Custom styling for control table and nested tables to avoid border doubling and bad padding */
                        .control-table {
                            width: 100% !important;
                            border-collapse: collapse !important;
                        }
                        .control-table > thead > tr > th {
                            border: 1px solid #000 !important;
                            padding: 8px 4px !important;
                        }
                        .control-table > tbody > tr > td {
                            border: 1px solid #000 !important;
                            padding: 0 !important;
                        }
                        .nested-table {
                            width: 100% !important;
                            height: 100% !important;
                            border-collapse: collapse !important;
                            margin: 0 !important;
                            border: none !important;
                        }
                        .nested-table td {
                            border: none !important;
                            padding: 4px 8px !important;
                        }
                        .nested-table td.border-b {
                            border-bottom: 1px solid #000 !important;
                        }
                        .nested-table td.border-r {
                            border-right: 1px solid #000 !important;
                        }
                    </style>
                </head>
                <body>
                    ${htmlContent}
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 1500);
        }
    };

    const handlePrintAll = () => {
        if (!receiptRef.current || !controlSlipRef.current) return;
        const receiptHtml = receiptRef.current.innerHTML;
        const controlSlipHtml = controlSlipRef.current.innerHTML;
        
        // Print 2 copies of the Receipt and 1 copy of the Control Slip
        const printContent = receiptHtml + 
            '<div style="page-break-before: always; margin-top: 20px;" class="print-page-break"></div>' + 
            receiptHtml + 
            '<div style="page-break-before: always; margin-top: 20px;" class="print-page-break"></div>' + 
            controlSlipHtml;
            
        printHtml(printContent, 'In Tất Cả');
    };

    const handlePrintReceipt = () => {
        if (!receiptRef.current) return;
        // Print exactly 1 single copy of the receipt as requested
        printHtml(receiptRef.current.innerHTML, 'In Biên Nhận');
    };

    const handlePrintControlSlip = () => {
        if (!controlSlipRef.current) return;
        printHtml(controlSlipRef.current.innerHTML, 'In Phiếu Kiểm Soát');
    };

    const now = new Date();
    
    const safeParseDate = (dateVal: any, fallback: Date = new Date()) => {
        if (!dateVal) return fallback;
        const d = new Date(dateVal);
        return isNaN(d.getTime()) ? fallback : d;
    };

    const rDate = safeParseDate(data.receivedDate, now);
    const dDate = safeParseDate(data.deadline, now);

    const getReceiverName = () => {
        if (data.receivedBy && employees) {
            const emp = employees.find(e => e.id === data.receivedBy);
            if (emp) return emp.name;
        }
        if (currentUser) {
            return currentUser.name;
        }
        return '';
    };

    const receiverName = getReceiverName();

    const parsedOtherDocs = (() => {
        let docs: Array<{ name: string; type: 'Bản chính' | 'Bản sao' }> = [];
        
        // 1. Phân tích từ chuỗi otherDocs
        if (typeof data.otherDocs === 'string' && data.otherDocs.trim() !== '') {
            data.otherDocs.split(';').map(item => item.trim()).filter(Boolean).forEach(item => {
                const parts = item.split('|');
                if (parts[0] && parts[0].trim() !== '') {
                    docs.push({
                        name: parts[0].trim(),
                        type: (parts[1] && parts[1].trim() === 'Bản sao' ? 'Bản sao' : 'Bản chính') as 'Bản chính' | 'Bản sao'
                    });
                }
            });
        }
        
        // 2. Nếu trống, cố gắng phân tích từ cấu trúc JSON trong trường notes (otherDocRows)
        if (docs.length === 0 && typeof data.notes === 'string' && data.notes.trim() !== '') {
            try {
                const parsed = JSON.parse(data.notes);
                if (parsed && Array.isArray(parsed.otherDocRows)) {
                    parsed.otherDocRows.forEach((r: any) => {
                        if (r && r.name && r.name.trim() !== '') {
                            docs.push({
                                name: r.name.trim(),
                                type: (r.type === 'Bản sao' ? 'Bản sao' : 'Bản chính') as 'Bản chính' | 'Bản sao'
                            });
                        }
                    });
                }
            } catch (e) {
                // Bỏ qua lỗi parse JSON nếu có
            }
        }
        
        return docs;
    })();

    const isMeas = (() => {
        const type = (data.recordType || '').toLowerCase();
        return type.startsWith('2.') || type.includes('đo đạc') || type.includes('trích lục') || type.includes('cắm mốc') || type.includes('tách thửa');
    })();

    const getProcessDays = (type: string, hasTax: boolean): number => {
        const t = (type || '').trim().toLowerCase();
        
        if (t.includes('trích lục')) return 10;
        if (t.includes('trích đo chỉnh lý')) return 15;
        if (t.includes('trích đo') || t.includes('đo đạc') || t.includes('cắm mốc') || t.includes('tách thửa')) return 30;
        
        const isReg = t.startsWith('3.') || t === 'đăng ký' || t === 'cấp giấy' || t === 'cấp đổi' || t === 'cấp lại' || REGISTRATION_PROCEDURES.some(p => t.includes(p.toLowerCase()));
        if (isReg) {
            if (t.includes('3.1') || t.includes('thừa kế') ||
                t.includes('3.2') || t.includes('tặng cho') ||
                t.includes('3.3') || t.includes('chuyển nhượng') ||
                t.includes('3.4') || t.includes('thỏa thuận') || t.includes('vbtt')) {
                return hasTax ? 13 : 8;
            } else if (t.includes('3.6') || t.includes('cấp đổi')) {
                return hasTax ? 15 : 10;
            }
            return hasTax ? 40 : 30;
        }
        
        return 30; // fallback
    };

    const getRegulatoryText = (recordType: string, hasTax: boolean): string => {
        const days = getProcessDays(recordType, hasTax);
        const t = recordType.toLowerCase();
        
        const isMeasVal = t.startsWith('2.') || t.includes('đo đạc') || t.includes('trích lục') || t.includes('cắm mốc') || t.includes('tách thửa');
        const isRegVal = t.startsWith('3.') || t === 'đăng ký' || t === 'cấp giấy' || t === 'cấp đổi' || t === 'cấp lại' || REGISTRATION_PROCEDURES.some(p => t.includes(p.toLowerCase()));

        if (isMeasVal) {
            return `${days} ngày - Không tính thời gian ký giáp ranh và niêm yết công khai tại nơi có đất`;
        } else if (isRegVal) {
            return `${days} ngày - Không tính thời gian thực hiện nghĩa vụ tài chính`;
        }
        return `${days} ngày`;
    };

    const printDocs = (() => {
        const docs: Array<{ name: string; type: 'Bản chính' | 'Bản sao' }> = [];
        
        // 1. Giấy ủy quyền (nếu có)
        if (data.authDocType) {
            const parts = data.authDocType.split('|');
            if (parts[0]) {
                docs.push({
                    name: parts[0],
                    type: (parts[1] || 'Bản chính') as 'Bản chính' | 'Bản sao'
                });
            }
        }

        // 2. Các giấy tờ kèm theo (lấy chính xác từ danh sách người dùng đã chọn/chỉnh sửa hoặc lưu trữ)
        docs.push(...parsedOtherDocs);

        return docs;
    })();

    // Set time to current time for exact receipt time
    if (!isNaN(rDate.getTime())) {
        rDate.setHours(now.getHours(), now.getMinutes());
    }
    if (!isNaN(dDate.getTime())) {
        dDate.setHours(now.getHours(), now.getMinutes());
    }

    const formatDateTime = (d: Date) => {
        if (!d || isNaN(d.getTime())) {
            return '..... giờ ..... phút, ngày ..... tháng ..... năm .........';
        }
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        return `${hours} giờ ${minutes} phút, ngày ${day} tháng ${month} năm ${year}`;
    };

    const formatDateOnly = (d: Date) => {
        if (!d || isNaN(d.getTime())) {
            return 'ngày ..... tháng ..... năm .........';
        }
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        return `ngày ${day} tháng ${month} năm ${year}`;
    };

    const actualReceivingWard = (() => {
        // Tìm nhân viên tiếp nhận hồ sơ (data.receivedBy)
        if (data.receivedBy && employees) {
            const emp = employees.find(e => e.id === data.receivedBy);
            if (emp && emp.managedWards && emp.managedWards.length > 0) {
                return emp.managedWards[0];
            }
        }
        // Dự phòng cho nhân viên hiện tại đăng nhập
        if (currentUser && employees) {
            const emp = employees.find(e => e.id === currentUser.employeeId);
            if (emp && emp.managedWards && emp.managedWards.length > 0) {
                return emp.managedWards[0];
            }
        }
        // Dự phòng từ prop receivingWard
        return receivingWard || 'Tân Khai';
    })();

    const getWardPrefix = (ward: string) => {
        const norm = getNormalizedWard(ward).toLowerCase();
        if (norm === 'tân khai' || norm === 'tk') {
            return 'phường';
        }
        return 'xã';
    };

    const wardName = getNormalizedWard(data.ward || '');

    const formatDateVietnamese = (d: Date) => {
        if (!d || isNaN(d.getTime())) {
            return 'Ngày ..... tháng ..... năm .........';
        }
        const day = d.getDate();
        const month = d.getMonth() + 1;
        const year = d.getFullYear();
        return `Ngày ${day} tháng ${month} năm ${year}`;
    };

    const renderControlSlipRows = () => {
        const rows = [];
        
        // Hàng 1: Thừa hưởng thông tin từ phiếu tiếp nhận (rDate và receiverName)
        rows.push(
            <tr key={0} className="avoid-break" style={{ height: '150px' }}>
                {/* Cột 1: TÊN CƠ QUAN (Chứa nhãn 1.Giao và 2.Nhận) */}
                <td style={{ width: '15%', border: '1px solid black', padding: 0, height: '150px' }}>
                    <table className="nested-table" style={{ width: '100%', borderCollapse: 'collapse', height: '150px', margin: 0 }}>
                        <tbody>
                            <tr style={{ height: '30px' }}>
                                <td className="border-b" style={{ padding: '1px 6px', textAlign: 'left', fontSize: '13px', fontWeight: 'normal', height: '30px' }}>
                                    1.Giao
                                </td>
                            </tr>
                            <tr style={{ height: '120px' }}>
                                <td style={{ padding: '2px 6px', textAlign: 'left', verticalAlign: 'top', fontSize: '13px', fontWeight: 'normal', height: '120px' }}>
                                    2.Nhận
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </td>
                
                {/* Cột 2: THỜI GIAN GIAO, NHẬN HỒ SƠ */}
                <td style={{ width: '55%', border: '1px solid black', padding: 0, height: '150px' }}>
                    <table className="nested-table" style={{ width: '100%', borderCollapse: 'collapse', height: '150px', margin: 0 }}>
                        <tbody>
                            <tr style={{ height: '30px' }}>
                                <td className="border-b" colSpan={2} style={{ padding: '1px 6px', textAlign: 'left', whiteSpace: 'nowrap', fontSize: '13px', height: '30px' }}>
                                    {formatDateTime(rDate)}
                                </td>
                            </tr>
                            <tr style={{ height: '120px' }}>
                                <td className="border-r" style={{ width: '50%', padding: '2px 6px', textAlign: 'center', verticalAlign: 'top', fontSize: '12px', height: '120px' }}>
                                    <div style={{ fontWeight: 'bold', marginTop: '2px' }}>Người giao</div>
                                    <div style={{ marginTop: '80px', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px' }}>{receiverName || ''}</div>
                                </td>
                                <td style={{ width: '50%', padding: '2px 6px', textAlign: 'center', verticalAlign: 'top', fontSize: '12px', height: '120px' }}>
                                    <div style={{ fontWeight: 'bold', marginTop: '2px' }}>Người nhận</div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </td>
                
                {/* Cột 3: KẾT QUẢ */}
                <td style={{ width: '15%', border: '1px solid black', height: '150px' }}></td>
                
                {/* Cột 4: Ghi chú */}
                <td style={{ width: '15%', border: '1px solid black', height: '150px' }}></td>
            </tr>
        );
        
        // Hàng 2 đến 6: Trống hoàn toàn
        for (let i = 1; i < 5; i++) {
            rows.push(
                <tr key={i} className="avoid-break" style={{ height: '150px' }}>
                    {/* Cột 1: TÊN CƠ QUAN */}
                    <td style={{ width: '15%', border: '1px solid black', padding: 0, height: '150px' }}>
                        <table className="nested-table" style={{ width: '100%', borderCollapse: 'collapse', height: '150px', margin: 0 }}>
                            <tbody>
                                <tr style={{ height: '30px' }}>
                                    <td className="border-b" style={{ padding: '1px 6px', textAlign: 'left', fontSize: '13px', fontWeight: 'normal', height: '30px' }}>
                                        1.Giao
                                    </td>
                                </tr>
                                <tr style={{ height: '120px' }}>
                                    <td style={{ padding: '2px 6px', textAlign: 'left', verticalAlign: 'top', fontSize: '13px', fontWeight: 'normal', height: '120px' }}>
                                        2.Nhận
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </td>
                    
                    {/* Cột 2: THỜI GIAN GIAO, NHẬN HỒ SƠ */}
                    <td style={{ width: '55%', border: '1px solid black', padding: 0, height: '150px' }}>
                        <table className="nested-table" style={{ width: '100%', borderCollapse: 'collapse', height: '150px', margin: 0 }}>
                            <tbody>
                                <tr style={{ height: '30px' }}>
                                    <td className="border-b" colSpan={2} style={{ padding: '1px 6px', textAlign: 'left', whiteSpace: 'nowrap', fontSize: '13px', color: '#333', height: '30px' }}>
                                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; giờ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; phút, ngày &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; tháng &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; năm .........
                                    </td>
                                </tr>
                                <tr style={{ height: '120px' }}>
                                    <td className="border-r" style={{ width: '50%', padding: '2px 6px', textAlign: 'center', verticalAlign: 'top', fontSize: '12px', height: '120px' }}>
                                        <div style={{ fontWeight: 'bold', marginTop: '2px' }}>Người giao</div>
                                    </td>
                                    <td style={{ width: '50%', padding: '2px 6px', textAlign: 'center', verticalAlign: 'top', fontSize: '12px', height: '120px' }}>
                                        <div style={{ fontWeight: 'bold', marginTop: '2px' }}>Người nhận</div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </td>
                    
                    {/* Cột 3: KẾT QUẢ */}
                    <td style={{ width: '15%', border: '1px solid black', height: '150px' }}></td>
                    
                    {/* Cột 4: Ghi chú */}
                    <td style={{ width: '15%', border: '1px solid black', height: '150px' }}></td>
                </tr>
            );
        }
        
        return rows;
    };

    const rTypeStr = (data.recordType || '').toLowerCase();
    
    // Chỉ hiển thị nút lập hợp đồng cho 2 trường hợp:
    // 1. Trích đo cắm mốc (hoặc chứa 'cắm mốc' / '2.4')
    // 2. Trích đo (hoặc chứa '2.3' / 'trích đo' nhưng loại trừ 'tách', 'hợp', 'lục')
    const isTrichDoCamMoc = rTypeStr.includes('cắm mốc') || rTypeStr.includes('2.4');
    const isTrichDo = (rTypeStr.includes('trích đo') || rTypeStr.includes('2.3')) && 
                      !rTypeStr.includes('tách') && 
                      !rTypeStr.includes('hợp') && 
                      !rTypeStr.includes('lục');

    const showContractButton = onCreateContract && (isTrichDoCamMoc || isTrichDo);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <style dangerouslySetInnerHTML={{ __html: `
                .control-table {
                    width: 100% !important;
                    border-collapse: collapse !important;
                }
                .control-table th, .control-table td {
                    padding: 0 !important;
                }
                .control-table th {
                    padding: 8px 4px !important;
                }
                .nested-table {
                    width: 100% !important;
                    height: 100% !important;
                    border-collapse: collapse !important;
                    margin: 0 !important;
                    border: none !important;
                }
                .nested-table td {
                    border: none !important;
                    padding: 4px 8px !important;
                }
                .nested-table td.border-b {
                    border-bottom: 1px solid #000 !important;
                }
                .nested-table td.border-r {
                    border-right: 1px solid #000 !important;
                }
            ` }} />
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold">In Biên Nhận & Phiếu Kiểm Soát</h2>
                    <div className="flex space-x-2">
                        {showContractButton && (
                            <button onClick={() => { onCreateContract(data as RecordFile); onClose(); }} className="flex items-center px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 font-bold">
                                <FileSignature className="w-4 h-4 mr-2" /> Hợp Đồng
                            </button>
                        )}
                        <button onClick={handlePrintReceipt} className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                            <Printer className="w-4 h-4 mr-2" /> In Biên Nhận
                        </button>
                        <button onClick={handlePrintControlSlip} className="flex items-center px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
                            <Printer className="w-4 h-4 mr-2" /> In Phiếu Quy Trình
                        </button>
                        <button onClick={handlePrintAll} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            <Printer className="w-4 h-4 mr-2" /> In Tất Cả
                        </button>
                        <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">
                            Đóng
                        </button>
                    </div>
                </div>
                
                <div className="p-8 overflow-auto flex-1 bg-gray-50 flex flex-col items-center">
                    <div className="space-y-8 w-full flex flex-col items-center">
                        <div ref={receiptRef} className="bg-white shadow-lg border border-gray-200 text-black relative" style={{ width: '210mm', minHeight: '297mm', padding: '15mm', boxSizing: 'border-box', fontFamily: "'Times New Roman', Times, serif", fontSize: '14px', lineHeight: '1.3' }}>
                            
                            {/* Header */}
                        <div className="flex justify-between mb-4">
                            <div className="text-center" style={{ width: '45%' }}>
                                <div className="font-bold text-[15px]">SỞ NÔNG NGHIỆP VÀ MÔI TRƯỜNG</div>
                                <div className="font-bold text-[16px]">BỘ PHẬN TIẾP NHẬN VÀ TRẢ KẾT QUẢ</div>
                                
                                {data.code && (
                                    <div className="mt-2 text-center" style={{ display: 'block' }}>
                                        <div className="font-bold text-[15px]" style={{ display: 'block', whiteSpace: 'nowrap' }}>{data.code}</div>
                                        <div style={{ transform: 'scale(0.8)', transformOrigin: 'top center', marginTop: '-4px', display: 'inline-block' }}>
                                            <Barcode value={data.code} height={30} displayValue={false} margin={0} width={1.5} />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="text-center" style={{ width: '50%' }}>
                                <div className="font-bold text-[15px]">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                                <div className="font-bold underline mb-2">Độc lập - Tự do - Hạnh phúc</div>
                                <div className="italic mt-4">{getNormalizedWard(actualReceivingWard)}, {formatDateOnly(new Date())}</div>
                            </div>
                        </div>

                        {/* Title */}
                        <div className="text-center mt-6 mb-4">
                            <div className="font-bold text-[18px]">GIẤY TIẾP NHẬN HỒ SƠ VÀ HẸN TRẢ KẾT QUẢ</div>
                        </div>

                        {/* Content */}
                        <div className="space-y-[6px]">
                            <div>Bộ phận tiếp nhận và trả kết quả: <span className="font-bold">Sở Nông nghiệp và Môi trường</span></div>
                            <div>Tiếp nhận hồ sơ của: <span className="font-bold">{data.customerName}</span></div>
                            <div>CCCD/MST: <span className="font-bold">{data.cccd || ''}</span></div>
                            <div>Số điện thoại: {data.phoneNumber}</div>
                            <div className="flex">
                                <div style={{ marginRight: '2cm' }}>Tờ: {data.mapSheet}</div>
                                <div>Thửa: {data.landPlot}</div>
                            </div>
                            <div>Địa chỉ thửa đất: <span className="font-bold uppercase">{getWardPrefix(data.ward || '').toUpperCase()} {getNormalizedWard(data.ward || '').toUpperCase()}</span></div>
                            <div>Thủ tục hành chính cần giải quyết: <span className="font-bold">{data.recordType}</span></div>
                            
                            <div>1. Thành phần hồ sơ, yêu cầu và số lượng mỗi loại giấy tờ gồm:</div>
                            <table className="w-full border-collapse border border-black mt-1 mb-2">
                                <thead>
                                    <tr>
                                        <th className="border border-black p-1 text-center w-12">STT</th>
                                        <th className="border border-black p-1 text-center">Tên giấy tờ</th>
                                        <th className="border border-black p-1 text-center w-24">Loại giấy tờ</th>
                                        <th className="border border-black p-1 text-center w-20">Số lượng</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {printDocs.map((doc, idx) => (
                                        <tr key={idx}>
                                            <td className="border border-black p-1 text-center">{idx + 1}</td>
                                            <td className="border border-black p-1">{doc.name}</td>
                                            <td className="border border-black p-1 text-center">{doc.type}</td>
                                            <td className="border border-black p-1 text-center">1</td>
                                        </tr>
                                    ))}
                                    {printDocs.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="border border-black p-2 text-center italic text-gray-500">Không có thành phần hồ sơ nộp kèm</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            <div>2. Số lượng hồ sơ: 01 (bộ)</div>
                            <div>3. Thời gian giải quyết hồ sơ theo quy định là: <span className="font-bold">{getRegulatoryText(data.recordType || '', !!data.hasTax)}</span></div>
                            <div>4. Thời gian nhận hồ sơ: <span className="font-bold">{formatDateTime(rDate)}</span></div>
                            <div>5. Thời gian trả kết quả giải quyết hồ sơ: <span className="font-bold">{formatDateTime(dDate)}</span></div>
                            <div>6. Đăng ký trả kết quả tại: Trung tâm phục vụ hành chính công {getWardPrefix(actualReceivingWard)} {getNormalizedWard(actualReceivingWard)}</div>
                            <div>7. Phí, lệ phí (nếu có): <span className="font-bold">Chưa thanh toán</span></div>
                        </div>

                        {/* Signatures */}
                        <div className="flex justify-between mt-8 text-center">
                            <div className="w-1/2">
                                <div className="font-bold">NGƯỜI NỘP HỒ SƠ</div>
                                <div className="italic">(Ký và ghi rõ họ tên)</div>
                                <div style={{ height: '80px' }}></div>
                                <div className="font-bold uppercase text-[14px]">
                                    
                                </div>
                            </div>
                            <div className="w-1/2">
                                <div className="font-bold">NGƯỜI TIẾP NHẬN HỒ SƠ</div>
                                <div className="italic">(Ký và ghi rõ họ tên)</div>
                                <div style={{ height: '80px' }}></div>
                                <div className="font-bold uppercase text-[14px]">
                                    {receiverName || ''}
                                </div>
                            </div>
                        </div>

                        {/* Spacer for signatures to ensure it shows in print */}
                        <div style={{ height: '40px' }}></div>

                        {/* Footer */}
                        <div className="pt-4 border-t border-gray-400">
                            <div><span className="font-bold">Chú ý:</span> Công dân đến nhận kết quả mang theo phiếu hẹn, CMTND/CCCD, lệ phí và giấy ủy quyền</div>
                            <div className="mt-1">(Trong trường hợp không phải chính chủ đến nhận)</div>
                            
                            <div className="flex justify-between items-end mt-4">
                                <div className="text-gray-500 text-sm">Phiên bản mẫu phiếu: TNTKQ-V5.1</div>
                                <div className="font-bold">TỔNG ĐÀI 0271.3636.836</div>
                            </div>
                        </div>

                    </div>

                    <div style={{ pageBreakBefore: 'always', marginTop: '20px' }} className="print-page-break"></div>
                    
                    <div ref={controlSlipRef} className="bg-white shadow-lg border border-gray-200 text-black mt-8" style={{ width: '210mm', minHeight: '297mm', padding: '15mm', boxSizing: 'border-box', fontFamily: "'Times New Roman', Times, serif", fontSize: '14px', lineHeight: '1.3' }}>
                        {/* Control Slip Header */}
                        <div className="flex justify-between mb-2">
                            <div className="text-center" style={{ width: '45%' }}>
                                <div className="font-bold text-[14px]">VĂN PHÒNG ĐKĐĐ TP ĐỒNG NAI</div>
                                <div className="font-bold text-[15px]">CHI NHÁNH HỚN QUẢN</div>
                            </div>
                            <div className="text-center" style={{ width: '50%' }}>
                                <div className="font-bold text-[14px]">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                                <div className="font-bold underline mb-1 text-[15px]">Độc lập - Tự do - Hạnh phúc</div>
                            </div>
                        </div>

                        {/* Control Slip Title */}
                        <div className="text-center mt-3 mb-4">
                            <div className="font-bold text-[18px] uppercase tracking-wide">PHIẾU KIỂM SOÁT QUÁ TRÌNH GIẢI QUYẾT HỒ SƠ</div>
                            <div className="font-bold mt-1 text-[14px]">Mã hồ sơ:&nbsp;&nbsp;&nbsp;&nbsp;{data.code || data.id || ''}</div>
                        </div>

                        {/* Control Slip Table */}
                        <table className="control-table w-full border-collapse border border-black mt-4">
                            <thead>
                                <tr>
                                    <th style={{ width: '15%', border: '1px solid black', padding: '8px 4px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}>TÊN CƠ QUAN</th>
                                    <th style={{ width: '55%', border: '1px solid black', padding: '8px 4px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}>THỜI GIAN GIAO, NHẬN HỒ SƠ</th>
                                    <th style={{ width: '15%', border: '1px solid black', padding: '8px 4px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}>KẾT QUẢ</th>
                                    <th style={{ width: '15%', border: '1px solid black', padding: '8px 4px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}>Ghi chú</th>
                                </tr>
                            </thead>
                            <tbody>
                                {renderControlSlipRows()}
                            </tbody>
                        </table>
                    </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemReceiptTemplate;

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
                        @page { margin: 15mm; }
                        body { 
                            font-family: 'Times New Roman', Times, serif; 
                            font-size: 14px;
                            line-height: 1.3;
                            color: #000;
                            -webkit-print-color-adjust: exact;
                        }
                        .flex { display: flex; }
                        .flex-col { flex-direction: column; }
                        .justify-between { justify-content: space-between; }
                        .items-center { align-items: center; }
                        .items-end { align-items: flex-end; }
                        .text-center { text-align: center; }
                        .font-bold { font-weight: bold; }
                        .italic { font-style: italic; }
                        .underline { text-decoration: underline; }
                        .uppercase { text-transform: uppercase; }
                        .mb-1 { margin-bottom: 4px; }
                        .mb-2 { margin-bottom: 8px; }
                        .mb-4 { margin-bottom: 16px; }
                        .mt-4 { margin-top: 16px; }
                        .mt-8 { margin-top: 32px; }
                        .text-lg { font-size: 16px; }
                        .text-xl { font-size: 18px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 8px; }
                        th, td { border: 1px solid #000; padding: 4px 8px; text-align: left; }
                        th { text-align: center; font-weight: bold; }
                        .text-gray { color: #666; }
                        .footer-line { border-top: 1px solid #000; margin-top: 40px; padding-top: 10px; }
                        .print-page-break { page-break-before: always; }
                        .avoid-break { page-break-inside: avoid; }
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

    const parsedOtherDocs = data.otherDocs
        ? data.otherDocs.split(';').map(item => item.trim()).filter(Boolean).map(item => {
            const parts = item.split('|');
            return { name: parts[0], type: (parts[1] || 'Bản chính') as 'Bản chính' | 'Bản sao' };
        })
        : [];

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

        // 2. Các giấy tờ khác (nếu đã lưu trong cơ sở dữ liệu)
        if (parsedOtherDocs && parsedOtherDocs.length > 0) {
            docs.push(...parsedOtherDocs);
        } else if (isMeas) {
            // Mặc định cho 2.x nếu trống
            docs.push(
                { name: 'Phiếu yêu cầu lập hợp đồng đo đạc dịch vụ', type: 'Bản chính' },
                { name: 'Trích lục', type: 'Bản chính' },
                { name: 'Cung cấp thông tin thửa đất', type: 'Bản chính' },
                { name: 'Giấy chứng nhận đã cấp bản phô tô', type: 'Bản sao' }
            );
        }

        // 3. For 3.x (cấp giấy) except "cấp lại", ensure "Giấy chứng nhận đã cấp bản chính" exists
        const rType = (data.recordType || '').toLowerCase();
        const isReg = rType.startsWith('3.') || rType === 'đăng ký' || rType === 'cấp giấy' || rType === 'cấp đổi' || rType === 'cấp lại' || REGISTRATION_PROCEDURES.some(p => rType.includes(p.toLowerCase()));
        
        if (isReg) {
            const isCappingLai = rType.includes('3.7') || rType.includes('cấp lại') || rType.includes('bị mất') || rType.includes('mất gcn');
            if (!isCappingLai) {
                if (!docs.some(d => d.name === 'Giấy chứng nhận đã cấp bản chính')) {
                    docs.push({ name: 'Giấy chứng nhận đã cấp bản chính', type: 'Bản chính' });
                }
            }
            
            // Add "Đơn đăng ký biến động đất đai" if NOT a "gia hạn" procedure
            const isGiaHan = rType.includes('3.9') || rType.includes('gia hạn');
            if (!isGiaHan) {
                if (!docs.some(d => d.name === 'Đơn đăng ký biến động đất đai' || d.name === 'Đơn đăng ký biến động')) {
                    docs.push({ name: 'Đơn đăng ký biến động đất đai', type: 'Bản chính' });
                }
            }

            if (data.hasTax) {
                if (!docs.some(d => d.name === 'Tờ khai thuế')) {
                    docs.push({ name: 'Tờ khai thuế', type: 'Bản chính' });
                }
            }
        }

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

    const emptyRows = Array(4).fill(0).map((_, i) => (
        <tr key={i} className="avoid-break" style={{ height: '80px' }}>
            <td style={{ width: '12%', border: '1px solid black' }}></td>
            <td style={{ width: '58%', border: '1px solid black', padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', height: '80px', margin: 0 }}>
                    <tbody>
                        <tr style={{ height: '25px' }}>
                            <td colSpan={2} style={{ borderBottom: '1px solid black', padding: '1px 6px', textAlign: 'left', whiteSpace: 'nowrap', fontSize: '13px' }}>
                                1.Giao &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ..... giờ ..... phút, ngày ..... tháng ..... năm .........
                            </td>
                        </tr>
                        <tr style={{ height: '55px' }}>
                            <td style={{ width: '50%', borderRight: '1px solid black', padding: '2px 6px', textAlign: 'center', verticalAlign: 'top', fontSize: '12px', position: 'relative' }}>
                                <div style={{ position: 'absolute', left: '6px', top: '2px', fontWeight: 'bold', fontSize: '13px' }}>2.Nhận</div>
                                <div style={{ fontWeight: 'bold', marginTop: '6px' }}>Người giao</div>
                            </td>
                            <td style={{ width: '50%', padding: '2px 6px', textAlign: 'center', verticalAlign: 'top', fontSize: '12px' }}>
                                <div style={{ fontWeight: 'bold', marginTop: '6px' }}>Người nhận</div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </td>
            <td style={{ width: '15%', border: '1px solid black' }}></td>
            <td style={{ width: '15%', border: '1px solid black' }}></td>
        </tr>
    ));

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
                
                <div className="p-8 overflow-y-auto flex-1 bg-gray-50">
                    <div>
                        <div ref={receiptRef} className="bg-white p-10 shadow-sm border border-gray-200 mx-auto text-black relative" style={{ maxWidth: '210mm', minHeight: '297mm', fontFamily: "'Times New Roman', Times, serif", fontSize: '14px', lineHeight: '1.3' }}>
                            
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
                                <div className="italic mt-4">{getNormalizedWard(receivingWard)}, {formatDateOnly(new Date())}</div>
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
                            <div>Địa chỉ thửa đất: <span className="font-bold uppercase">XÃ {getNormalizedWard(data.ward || '').toUpperCase()}</span></div>
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
                            <div>6. Đăng ký trả kết quả tại: Trung tâm phục vụ hành chính công xã {getNormalizedWard(receivingWard)}</div>
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
                    
                    <div ref={controlSlipRef} className="bg-white p-8 shadow-sm border border-gray-200 mx-auto text-black mt-8" style={{ maxWidth: '210mm', minHeight: '270mm', fontFamily: "'Times New Roman', Times, serif", fontSize: '14px', lineHeight: '1.3' }}>
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

                        {/* Details Block */}
                        <div style={{ marginLeft: '10%', marginBottom: '15px', fontSize: '14px', lineHeight: '1.5' }}>
                            <div className="flex">
                                <div style={{ width: '160px' }}>Kèm theo hồ sơ của:</div>
                                <div className="font-bold uppercase">{data.customerName || ''}</div>
                            </div>
                            <div className="flex">
                                <div style={{ width: '160px' }}>Số điện thoại:</div>
                                <div className="font-bold">{data.phoneNumber || ''}</div>
                            </div>
                            <div className="flex">
                                <div style={{ width: '160px' }}>Loại thủ tục:</div>
                                <div className="font-bold uppercase">{data.recordType || ''}</div>
                            </div>
                            <div className="flex">
                                <div style={{ width: '160px' }}>Ngày nhận:</div>
                                <div className="font-bold">{formatDateVietnamese(rDate)}</div>
                            </div>
                        </div>

                        {/* Control Slip Table */}
                        <table className="w-full border-collapse border border-black mt-4">
                            <thead>
                                <tr>
                                    <th style={{ width: '12%', border: '1px solid black', padding: '8px 4px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}>TÊN CƠ<br/>QUAN</th>
                                    <th style={{ width: '58%', border: '1px solid black', padding: '8px 4px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}>THỜI GIAN GIAO, NHẬN HỒ SƠ</th>
                                    <th style={{ width: '15%', border: '1px solid black', padding: '8px 4px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}>KẾT QUẢ</th>
                                    <th style={{ width: '15%', border: '1px solid black', padding: '8px 4px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}>Ghi chú</th>
                                </tr>
                            </thead>
                            <tbody>
                                {emptyRows}
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

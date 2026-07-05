
import { GoogleGenAI } from "@google/genai";
import { RecordFile, RecordStatus } from "../types";
import { STATUS_LABELS, getNormalizedWard, getShortRecordType } from "../constants";

interface OverdueRecord {
  date: string;
  code: string;
}

const GEMINI_KEY_STORAGE = 'USER_GEMINI_API_KEY';

export const saveGeminiKey = (key: string) => {
    if (!key) return;
    localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
};

export const getGeminiKey = () => {
    return localStorage.getItem(GEMINI_KEY_STORAGE) || 'AIzaSyCBBIFaokTfe0KLsVMY2VDEEgqRX8B_yvM';
};

const getAiClient = (): GoogleGenAI | null => {
  // Ưu tiên lấy key người dùng nhập trong cài đặt, sau đó mới đến biến môi trường, cuối cùng là key mặc định
  const apiKey = localStorage.getItem(GEMINI_KEY_STORAGE) || process.env.API_KEY || 'AIzaSyCBBIFaokTfe0KLsVMY2VDEEgqRX8B_yvM';
  
  if (!apiKey) {
    console.warn("API Key not found in localStorage or environment variables.");
    return null;
  }
  return new GoogleGenAI({ apiKey: apiKey });
};

export const testApiConnection = async (): Promise<boolean> => {
  try {
    const ai = getAiClient();
    if (!ai) return false;
    await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'Ping',
    });
    return true;
  } catch (error) {
    console.error("AI Connection Test Failed:", error);
    return false;
  }
};

export const generateReport = async (
  records: RecordFile[], 
  timeLabel: string, 
  scope: 'general' | 'personal' = 'general', 
  userName?: string,
  customTitle?: string,
  employees: any[] = []
): Promise<string> => {
  try {
    const ai = getAiClient();
    if (!ai) return "<div class='text-red-600 p-4 border border-red-200 bg-red-50 rounded'>Chưa cấu hình API Key. Vui lòng bấm vào nút 'Cấu hình AI' để nhập Key.</div>";

    const total = records.length;
    let completedCount = 0;
    let processingCount = 0;
    
    // Tách biến trễ hạn
    let overduePendingCount = 0;   // Trễ hạn chưa xong
    let overdueCompletedCount = 0; // Trễ hạn đã xong (làm xong trễ ngày hẹn)
    
    let pendingSignCount = 0;
    let withdrawnCount = 0;
    
    const employeeStats: Record<string, { total: number, done: number, pending: number }> = {};
    const typeStats: Record<string, number> = {};
    
    // Thống kê chi tiết loại hồ sơ theo từng nhân viên
    const employeeTypeStats: Record<string, Record<string, number>> = {};

    const today = new Date();
    today.setHours(0,0,0,0);

    const getEmployeeName = (assignedToId: string | null | undefined): string => {
        if (!assignedToId) return 'Chưa phân công';
        const emp = employees.find(e => e.id === assignedToId);
        return emp ? emp.name : 'Cán bộ khác';
    };

    records.forEach(r => {
        const isCompleted = r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || r.status === RecordStatus.REJECTED;
        
        if (isCompleted) completedCount++;
        else if (r.status === RecordStatus.PENDING_SIGN) pendingSignCount++;
        else if (r.status === RecordStatus.WITHDRAWN) withdrawnCount++;
        else processingCount++;
        
        // Logic tính trễ hạn mới
        if (r.deadline) {
            const deadlineDate = new Date(r.deadline);
            deadlineDate.setHours(0,0,0,0);

            if (isCompleted) {
                // Nếu đã xong, so sánh ngày hoàn thành với ngày hẹn
                if (r.completedDate) {
                    const finishedDate = new Date(r.completedDate);
                    finishedDate.setHours(0,0,0,0);
                    if (finishedDate > deadlineDate) {
                        overdueCompletedCount++;
                    }
                }
            } else if (r.status !== RecordStatus.WITHDRAWN && r.status !== RecordStatus.REJECTED) {
                // Nếu chưa xong, chưa rút, và chưa trả, so sánh hôm nay với ngày hẹn
                if (today > deadlineDate) {
                    overduePendingCount++;
                }
            }
        }

        const typeName = getShortRecordType(r.recordType) || 'Khác';
        typeStats[typeName] = (typeStats[typeName] || 0) + 1;

        // Group by Employee Name instead of Ward
        const empName = getEmployeeName(r.assignedTo);
        
        // Thống kê tổng quan cán bộ
        if (!employeeStats[empName]) {
            employeeStats[empName] = { total: 0, done: 0, pending: 0 };
        }
        employeeStats[empName].total++;
        if (isCompleted) employeeStats[empName].done++;
        else employeeStats[empName].pending++;

        // Thống kê chi tiết loại hồ sơ theo cán bộ
        if (!employeeTypeStats[empName]) {
            employeeTypeStats[empName] = {};
        }
        employeeTypeStats[empName][typeName] = (employeeTypeStats[empName][typeName] || 0) + 1;
    });

    const reportData = {
        time: timeLabel,
        author: userName,
        summary: { 
            total, 
            done: completedCount, 
            processing: processingCount, 
            pendingSign: pendingSignCount, 
            overduePending: overduePendingCount,     // Trễ chưa xong
            overdueCompleted: overdueCompletedCount, // Trễ đã xong
            withdrawn: withdrawnCount 
        },
        types: typeStats,
        employees: employeeStats,
        employeeTypeDetails: employeeTypeStats // Truyền dữ liệu nhân viên vào prompt
    };

    const title = customTitle || "BÁO CÁO KẾT QUẢ CÔNG TÁC ĐO ĐẠC VÀ CẤP GIẤY CN";

    const prompt = `
      Bạn là thư ký chuyên nghiệp. Hãy tạo một BÁO CÁO CÔNG VIỆC CÔ ĐỌNG nằm gọn trong 01 TRANG A4 (khổ đứng).
      
      DỮ LIỆU JSON: ${JSON.stringify(reportData)}

      YÊU CẦU TRÌNH BÀY (HTML thuần, CSS Tailwind, Font Serif):
      1. QUỐC HIỆU, TIÊU NGỮ:
         - Căn giữa: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM" (In đậm)
         - Căn giữa: "Độc lập - Tự do - Hạnh phúc" (In đậm, có gạch chân)
      2. TIÊU ĐỀ: "${title}" (In đậm, trung tâm, size lớn, màu xanh đậm hoặc đen).
      3. THỜI GIAN: ${timeLabel} (Căn giữa, in nghiêng).
      4. BẢNG TỔNG HỢP: Tạo 1 bảng nhỏ hiển thị các chỉ số:
         - Tổng HS
         - Đã xong
         - Đang xử lý
         - Trễ hạn (Chưa xong): ${overduePendingCount}
         - Trễ hạn (Đã xong): ${overdueCompletedCount}
      
      5. THỐNG KÊ THEO CÁN BỘ XỬ LÝ (Tóm tắt): Tạo 1 bảng HTML (Border đen mỏng 1px) các cột: STT, Cán bộ xử lý, Tổng số hồ sơ được giao, Đã xong, Đang xử lý, Tỷ lệ hoàn thành %.

      6. CHI TIẾT LOẠI HỒ SƠ THEO TỪNG CÁN BỘ (Quan trọng): 
         - Tạo một bảng HTML riêng biệt.
         - Cột 1: Cán bộ xử lý (Tên nhân viên).
         - Cột 2: Chi tiết số lượng từng loại hồ sơ đang phụ trách (Ví dụ: Trích lục: 5, Đo đạc: 2, Cấp GCN: 1...). Hãy liệt kê rõ ràng trong ô.
         - Dữ liệu lấy từ 'employeeTypeDetails'.

      7. NHẬN XÉT (Tối đa 3 câu): Nhận xét ngắn gọn về tiến độ, khối lượng công việc và hiệu suất làm việc của các cán bộ. Nhắc nhở cụ thể những cán bộ còn tồn đọng hồ sơ trễ hạn.
      8. CHỮ KÝ: 
         - Tạo một bảng 2 cột không viền (border="0").
         - Cột trái: "NGƯỜI LẬP BIỂU" (In đậm), dòng dưới "(Ký, họ tên)" (In nghiêng).
         - Cột phải: "THỦ TRƯỞNG ĐƠN VỊ" (In đậm), dòng dưới "(Ký, họ tên, đóng dấu)" (In nghiêng).

      LƯU Ý QUAN TRỌNG: 
      - Không sử dụng các thẻ <html> <body>. 
      - Sử dụng font-family: "Times New Roman", Serif.
      - Đảm bảo toàn bộ nội dung không quá dài để tránh bị nhảy sang trang 2.
      - Sử dụng bảng (table) thay vì thẻ div cho các danh sách để trông giống văn bản hành chính chuyên nghiệp.
      - Các bảng nên có width="100%" và border-collapse: collapse.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { temperature: 0.2 } // Giảm sáng tạo để AI bám sát định dạng
    });

    return response.text || "Lỗi tạo nội dung.";
  } catch (error) {
    return "<div class='p-4 bg-red-50 text-red-700'>Lỗi kết nối AI hoặc quota đã hết. Vui lòng kiểm tra lại API Key.</div>";
  }
};

// --- HÀM MỚI: ĐÁNH GIÁ NHÂN VIÊN ---
export const generateEmployeeEvaluation = async (
    employeeName: string,
    stats: any,
    badRecords: any[], // Danh sách các hồ sơ trễ hạn lâu
    timeLabel: string
): Promise<string> => {
    try {
        const ai = getAiClient();
        if (!ai) return "<div class='text-red-600'>Chưa cấu hình API Key.</div>";

        const prompt = `
            Bạn là một quản lý nhân sự công tâm và chuyên nghiệp. Hãy viết một đoạn nhận xét, đánh giá hiệu quả công việc cho nhân viên dựa trên số liệu sau.

            THÔNG TIN NHÂN VIÊN:
            - Họ tên: ${employeeName}
            - Giai đoạn: ${timeLabel}

            SỐ LIỆU THỐNG KÊ:
            - Tổng hồ sơ được giao: ${stats.total}
            - Hoàn thành đúng hạn: ${stats.onTime}
            - Sắp tới hạn (Cần lưu ý): ${stats.approaching}
            - Trễ hạn (Chưa xong): ${stats.overdue}
            - Tỷ lệ hoàn thành đúng hạn: ${stats.onTimeRate}%

            DANH SÁCH HỒ SƠ TRỄ HẠN QUÁ LÂU (>7 ngày):
            ${JSON.stringify(badRecords)}

            YÊU CẦU ĐẦU RA (HTML):
            Viết một báo cáo ngắn (khoảng 200-300 chữ) bằng thẻ HTML (không dùng thẻ html, body, head), style chuyên nghiệp, font Times New Roman gồm các phần:
            1. **Đánh giá chung**: Nhận xét về khối lượng công việc và mức độ hoàn thành. Dùng giọng văn khích lệ nếu tốt, nghiêm khắc nhắc nhở nếu tệ.
            2. **Phân tích tồn tại**: Nếu có hồ sơ trễ hạn, hãy chỉ ra cụ thể mã hồ sơ nào trễ lâu nhất và cần ưu tiên xử lý. Nếu không có trễ hạn, hãy khen ngợi.
            3. **Đề xuất/Kiến nghị**: Đưa ra lời khuyên cụ thể để nhân viên cải thiện hoặc duy trì phong độ.

            Lưu ý: 
            - Nếu tỷ lệ đúng hạn > 90%: Đánh giá Tốt/Xuất sắc.
            - Nếu tỷ lệ đúng hạn 70-90%: Đánh giá Khá/Đạt.
            - Nếu tỷ lệ đúng hạn < 70%: Cần chấn chỉnh.
            - Tô đậm các con số quan trọng.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { temperature: 0.4 }
        });

        return response.text || "Không thể tạo đánh giá.";
    } catch (error) {
        return "<div class='text-red-600'>Lỗi khi gọi AI. Vui lòng kiểm tra kết nối.</div>";
    }
};


// Định nghĩa trạng thái của hồ sơ theo quy trình
export enum RecordStatus {
  RECEIVED = 'RECEIVED',         // Tiếp nhận
  ASSIGNED = 'ASSIGNED',         // Giao nhân viên
  IN_PROGRESS = 'IN_PROGRESS',   // Đang thực hiện
  COMPLETED_WORK = 'COMPLETED_WORK', // Đã thực hiện (Mới: Nhân viên làm xong, chưa trình)
  PENDING_CHECK = 'PENDING_CHECK', // Chờ kiểm tra
  CHECKED = 'CHECKED',           // Đã kiểm tra
  PENDING_SIGN = 'PENDING_SIGN', // Chờ ký duyệt (Đã trình)
  SIGNED = 'SIGNED',             // Đã ký (Lập danh sách ký)
  HANDOVER = 'HANDOVER',         // Giao 1 cửa (Hoàn thành nội bộ)
  RETURNED = 'RETURNED',         // Đã trả kết quả (Hoàn thành trả dân)
  WITHDRAWN = 'WITHDRAWN',       // CSD rút hồ sơ (Kết thúc)
  REJECTED = 'REJECTED',          // Hồ sơ trả (Trả về OneDoor)
  TBT = 'TBT',                    // Đã có thuế (Thông báo thuế)
  PENDING_SUPPLEMENT = 'PENDING_SUPPLEMENT' // Chờ bổ sung (Người dân)
}

export enum UserRole {
  ADMIN = 'ADMIN',
  SUBADMIN = 'SUBADMIN', // Phó quản trị (Quyền như Admin trừ quản lý User)
  TEAM_LEADER = 'TEAM_LEADER', // Nhóm trưởng (Quyền quản lý tác vụ, xem báo cáo, trích lục)
  EMPLOYEE = 'EMPLOYEE',
  ONEDOOR = 'ONEDOOR'    // Bộ phận một cửa (Chỉ tiếp nhận và xem)
}

export type RolePermissions = Record<string, string[]>;
export type DepartmentPermissions = Record<string, string[]>;

export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  [UserRole.ADMIN]: ['*'],
  [UserRole.SUBADMIN]: ['VIEW_RECORDS', 'ADD_RECORDS', 'EDIT_RECORDS', 'DELETE_RECORDS', 'ASSIGN_RECORDS', 'CHECK_RECORDS', 'SIGN_RECORDS', 'HANDOVER_RECORDS', 'RETURN_RECORDS', 'EXPORT_RECORDS', 'VIEW_CONTRACTS', 'ADD_CONTRACTS', 'EDIT_CONTRACTS', 'DELETE_CONTRACTS', 'EXPORT_CONTRACTS', 'VIEW_EXCERPTS', 'MANAGE_EXCERPTS', 'VIEW_ARCHIVE', 'MANAGE_ARCHIVE', 'VIEW_REPORTS', 'MANAGE_EMPLOYEES', 'VIEW_CHAT', 'VIEW_SCHEDULE', 'MANAGE_SCHEDULE', 'VIEW_PERSONAL_PROFILE'],
  [UserRole.TEAM_LEADER]: ['VIEW_RECORDS', 'EDIT_RECORDS', 'ASSIGN_RECORDS', 'CHECK_RECORDS', 'EXPORT_RECORDS', 'VIEW_CONTRACTS', 'VIEW_EXCERPTS', 'MANAGE_EXCERPTS', 'VIEW_ARCHIVE', 'VIEW_REPORTS', 'VIEW_CHAT', 'VIEW_SCHEDULE', 'VIEW_PERSONAL_PROFILE'],
  [UserRole.ONEDOOR]: ['VIEW_RECORDS', 'ADD_RECORDS', 'HANDOVER_RECORDS', 'RETURN_RECORDS', 'EXPORT_RECORDS', 'VIEW_CONTRACTS', 'ADD_CONTRACTS', 'VIEW_EXCERPTS', 'VIEW_ARCHIVE', 'VIEW_CHAT', 'VIEW_SCHEDULE'],
  [UserRole.EMPLOYEE]: ['VIEW_RECORDS', 'EDIT_RECORDS', 'VIEW_CONTRACTS', 'VIEW_EXCERPTS', 'VIEW_ARCHIVE', 'VIEW_CHAT', 'VIEW_SCHEDULE', 'VIEW_PERSONAL_PROFILE']
};

export const AVAILABLE_PERMISSIONS = [
  // Nhóm Hồ Sơ
  { id: 'VIEW_RECORDS', label: 'Xem hồ sơ' },
  { id: 'ADD_RECORDS', label: 'Thêm hồ sơ mới' },
  { id: 'EDIT_RECORDS', label: 'Sửa hồ sơ' },
  { id: 'DELETE_RECORDS', label: 'Xóa hồ sơ' },
  { id: 'RESTORE_RECORDS', label: 'Khôi phục hồ sơ đã xóa' },
  { id: 'ASSIGN_RECORDS', label: 'Phân công / Giao việc hồ sơ' },
  { id: 'WITHDRAW_RECORDS', label: 'Rút / Thu hồi hồ sơ đã giao' },
  { id: 'IMPORT_RECORDS', label: 'Nhập hồ sơ từ file Excel' },
  { id: 'EXPORT_RECORDS', label: 'Xuất danh sách hồ sơ (Excel)' },

  // Nhóm Nghiệp Vụ - Đo Đạc & Kỹ Thuật
  { id: 'SURVEY_RECORDS', label: 'Đo đạc / Khảo sát hiện trường' },
  { id: 'DRAW_RECORDS', label: 'Vẽ bản đồ / Bản vẽ kỹ thuật' },
  { id: 'CHECK_RECORDS', label: 'Kiểm tra hồ sơ kỹ thuật' },
  { id: 'SIGN_RECORDS', label: 'Ký duyệt hồ sơ bản vẽ kỹ thuật' },
  { id: 'UPDATE_WARD_MANAGEMENT', label: 'Cập nhật địa bàn phụ trách của cán bộ' },

  // Nhóm Bàn Giao & Trả Kết Quả
  { id: 'HANDOVER_RECORDS', label: 'Bàn giao hồ sơ hoàn thành' },
  { id: 'RETURN_RECORDS', label: 'Trả kết quả hồ sơ cho người dân' },
  { id: 'PRINT_HANDOVER_REPORTS', label: 'In biểu mẫu / Phiếu giao nhận hồ sơ' },

  // Nhóm Hợp Đồng
  { id: 'VIEW_CONTRACTS', label: 'Xem danh sách hợp đồng' },
  { id: 'ADD_CONTRACTS', label: 'Tạo mới hợp đồng dịch vụ' },
  { id: 'EDIT_CONTRACTS', label: 'Chỉnh sửa thông tin hợp đồng' },
  { id: 'SIGN_CONTRACTS', label: 'Ký duyệt hợp đồng dịch vụ' },
  { id: 'DELETE_CONTRACTS', label: 'Xóa hợp đồng khỏi hệ thống' },
  { id: 'EXPORT_CONTRACTS', label: 'Xuất danh sách hợp đồng (Excel)' },

  // Nhóm Trích Lục
  { id: 'VIEW_EXCERPTS', label: 'Xem cơ sở dữ liệu trích lục' },
  { id: 'MANAGE_EXCERPTS', label: 'Tạo và quản lý phiếu cấp trích lục' },
  { id: 'APPROVE_EXCERPTS', label: 'Ký duyệt cấp trích lục bản đồ' },

  // Nhóm Kho Lưu Trữ
  { id: 'VIEW_ARCHIVE', label: 'Xem kho hồ sơ số hóa lưu trữ' },
  { id: 'MANAGE_ARCHIVE', label: 'Biên mục và quản lý lưu trữ số' },

  // Nhóm Báo Cáo & Số Liệu
  { id: 'VIEW_REPORTS', label: 'Xem báo cáo tiến độ tổng quát' },
  { id: 'TRACK_KPI', label: 'Theo dõi chỉ số KPI hiệu suất phòng/tổ' },
  { id: 'EXPORT_REPORTS', label: 'Xuất biểu đồ/báo cáo định kỳ' },

  // Nhóm Giao Tiếp & Công Việc
  { id: 'VIEW_CHAT', label: 'Sử dụng khung chat nội bộ' },
  { id: 'MANAGE_CHAT', label: 'Quản lý, tạo mới nhóm chat chung' },
  { id: 'VIEW_SCHEDULE', label: 'Xem lịch công tác tuần/tháng' },
  { id: 'MANAGE_SCHEDULE', label: 'Tạo/Chỉnh sửa lịch công tác cơ quan' },

  // Nhóm Cài Đặt & Quản Trị Hệ Thống
  { id: 'VIEW_PERSONAL_PROFILE', label: 'Xem thông tin hồ sơ cá nhân' },
  { id: 'MANAGE_USERS', label: 'Quản lý tài khoản người dùng đăng nhập' },
  { id: 'MANAGE_EMPLOYEES', label: 'Quản lý thông tin & danh sách nhân viên' },
  { id: 'SYSTEM_SETTINGS', label: 'Cài đặt các tham số hệ thống' },
  { id: 'EDIT_SYSTEM_HOLIDAYS', label: 'Cấu hình lịch nghỉ lễ của năm' },
  { id: 'VIEW_AUDIT_LOGS', label: 'Tra cứu nhật ký hoạt động hệ thống' },
  { id: 'DELETE_SYSTEM_DATA', label: 'Xóa sạch dữ liệu (Reset hệ thống)' }
];

export interface User {
  username: string;
  password?: string;
  name: string;
  role: UserRole;
  employeeId?: string;
}

export interface Employee {
  id: string;
  name: string;
  department: string;
  position?: string; // MỚI: Tách riêng chức vụ
  managedWards: string[];
}

export interface RecordFile {
  id: string;
  code: string;           
  customerName: string;   
  phoneNumber?: string | null;   
  cccd?: string | null;          
  customerAddress?: string | null;
  
  ward?: string | null;          
  landPlot?: string | null;      
  mapSheet?: string | null;      
  area?: number | null;          
  address?: string | null;       
  group?: string | null;         
  
  issueNumber?: string | null;   // Số phát hành
  entryNumber?: string | null;   // Số vào sổ
  issueDate?: string | null;     // Ngày cấp
  residentialArea?: number | null; // Đất ở

  content?: string | null;        
  recordType?: string | null;    
  
  receivedDate?: string | null;   
  receivedBy?: string | null; // Người nhận hồ sơ (ID của user)
  deadline?: string | null;       
  assignedDate?: string | null;  
  
  submissionDate?: string | null; // Ngày trình ký
  submittedTo?: string | null;    // Người được trình ký (ID của giám đốc)
  pendingCheckDate?: string | null; // Ngày trình kiểm tra
  checkedBy?: string | null;      // Người kiểm tra (ID của tổ trưởng/tổ phó)
  checkedDate?: string | null;    // Ngày đã kiểm tra
  completedWorkDate?: string | null; // Ngày đã thực hiện
  approvalDate?: string | null;   // Ngày ký duyệt
  completedDate?: string | null; 
  
  status: RecordStatus;   
  hasDefect?: boolean;             // Đánh dấu hồ sơ có sai sót cần trả
  defectReason?: string | null;    // Lý do trả hồ sơ do phát hiện sai sót
  defectDate?: string | null;      // Ngày đánh dấu sai sót / trả hồ sơ
  rejectDate?: string | null;      // Ngày giờ trả hồ sơ (REJECTED)
  rejectReason?: string | null;    // Lý do trả hồ sơ (REJECTED)
  supplementReason?: string | null; // Lý do yêu cầu bổ sung
  supplementLegalBasis?: string | null; // Căn cứ pháp lý yêu cầu bổ sung
  supplementDate?: string | null;   // Ngày yêu cầu bổ sung
  isDeptSynced?: boolean; // Đồng bộ chuyển về phòng chuyên môn
  assignedTo?: string | null;    
  notes?: string | null;         
  privateNotes?: string | null;  
  personalNotes?: string | null; // Ghi chú cá nhân của nhân viên
  
  authorizedBy?: string | null;  
  authDocType?: string | null;   
  otherDocs?: string | null;     

  exportBatch?: number | null;   
  exportDate?: string | null;    
  archiveBatch?: number | null;
  archiveDate?: string | null;
  isArchived?: boolean | null;
  handoverWard?: string | null; // Nơi giao trả kết quả (nếu khác địa chỉ thửa đất)
  
  measurementNumber?: string | null; 
  excerptNumber?: string | null;
  
  // Tính năng nhắc nhở
  reminderDate?: string | null;      // Thời gian đặt lịch nhắc
  lastRemindedAt?: string | null;    // Thời gian đã thông báo lần cuối

  // Tính năng trả kết quả
  receiptNumber?: string | null;     // Số biên lai
  receiptType?: 'receipt' | 'invoice' | null; // Loại số: Biên Lai hoặc Hóa Đơn
  paymentAmount?: number | null;     // Số tiền thu được thực tế
  receiverName?: string | null;      // Người nhận kết quả (Mới)
  resultReturnedDate?: string | null; // Ngày trả kết quả cho dân
  receiptPhoto?: string | null;      // Bản chụp biên lai/hoá đơn (Hình ảnh/Base64)

  // Tính năng Chỉnh lý bản đồ (Mới)
  needsMapCorrection?: boolean; // True nếu cần lập danh sách chỉnh lý

  // Tính năng Hồ sơ Cấp giấy có thuế
  hasTax?: boolean;             // Hồ sơ có thuế
  transferToDNLis?: boolean;    // Chuyển qua DNLis
  hasCheckedSMK?: boolean;      // Đã đối chiếu sổ mục kê

  // Các trường mới cho Luồng Quy Trình Cấp Giấy (Chi nhánh Hớn Quản)
  gcnWorkflowType?: string | null;             // 'quy_trinh_1' | 'quy_trinh_2' | 'quy_trinh_3' | 'quy_trinh_4' | 'quy_trinh_5' | 'quy_trinh_6' | 'quy_trinh_7'
  hasConcurrentTransfer?: boolean | null;       // Có chuyển nhượng đồng thời? (Có/Không)
  preSupplementStatus?: RecordStatus | null;     // Lưu trạng thái trước khi bị trả chờ bổ sung
  preSupplementStepIndex?: number | null;       // Lưu bước chi tiết trước khi bị trả
  currentStepIndex?: number | null;             // Bước hiện tại trong quy trình chi tiết (0-indexed)
  taxPaymentDate?: string | null;               // Ngày người dân đóng thuế

  // Giá trực tiếp cho hồ sơ
  price?: number | null;
  advancePayment?: number | null;

  // Lịch sử người thực hiện từng bước của quy trình
  stepAssignees?: Record<string, string> | null;

  // Diện tích đất chi tiết đóng vai trò phụ
  clnArea?: number | null;
  bhkArea?: number | null;
  lucArea?: number | null;
  otherLandArea?: number | null;
}

// Interface cho Item tách thửa
export interface SplitItem {
  serviceName: string; // Loại sản phẩm (VD: Tách thửa < 100m2)
  quantity: number;
  price: number;
  area?: number; // Diện tích thửa mới tách
  landPlot?: string;
  mapSheet?: string;
}

// Interface riêng cho Hợp Đồng (Lưu table khác)
export interface Contract {
  id: string;
  code: string;           
  recordCode?: string | null;
  customerName: string;
  phoneNumber?: string | null;
  customerAddress?: string | null;
  ward?: string | null;
  address?: string | null;
  landPlot?: string | null;
  mapSheet?: string | null;
  area?: number | null;
  
  // Phân loại logic
  contractType: 'Đo đạc' | 'Tách thửa' | 'Cắm mốc' | 'Trích lục'; // Đã bổ sung Trích lục
  serviceType: string;    // Tên dịch vụ chi tiết (VD: Đo đạc tòa án)
  areaType: string;       // Khu vực (Đất đô thị / Nông thôn)

  // Số lượng đặc thù
  plotCount?: number | null;     // Số thửa (cho Đo đạc)
  markerCount?: number | null;   // Số mốc (cho Cắm mốc)
  splitItems?: SplitItem[]; // Danh sách tách thửa (lưu JSON)

  // Tài chính
  quantity: number;       // Số lượng chung (để tính tiền cơ bản)
  unitPrice: number;      
  vatRate: number;        // % Thuế
  vatAmount: number;      // Tiền thuế
  totalAmount: number;    
  deposit: number;        
  content?: string | null;       
  
  createdDate: string;    
  status: 'PENDING' | 'COMPLETED';

  // Thanh lý
  liquidationArea?: number | null; // Diện tích thanh lý thực tế
  liquidationAmount?: number | null; // MỚI: Giá trị thanh lý thực tế (tiền)
  
  // Phụ lục
  hasAnnex?: boolean;
  annexDate?: string;
}

// Interface cho Bảng giá (Cập nhật theo hình ảnh)
export interface PriceItem {
  id: string;
  serviceGroup?: string;  // Loại HS (VD: Đo đạc tòa án)
  areaType?: string;      // Khu vực (Đất đô thị/nông thôn)
  serviceName: string;    // Tên sản phẩm
  minArea: number;        // DTMin
  maxArea: number;        // DTMax
  unit: string;           // Đơn vị
  price: number;          // Giá sản phẩm
  vatRate: number;        // VAT
  vatIsPercent: boolean;  // VAT_IS_PERCENT
}

export interface ReportData {
  total: number;
  completed: number;
  processing: number;
  overdue: number;
  weeklySummary: string;
}

// Interface cho Nhóm Chat
export interface ChatGroup {
  id: string;
  name: string;
  type: 'CUSTOM' | 'SYSTEM'; // SYSTEM là nhóm mặc định nếu cần
  created_by?: string;
  created_at?: string;
  members?: string[];
}

// Interface cho Tin nhắn Chat
export interface Message {
  id: string;
  group_id?: string; // ID nhóm chat, nếu null hoặc 'GENERAL' là nhóm chung
  sender_username: string;
  sender_name: string;
  content: string;
  file_url?: string;
  file_name?: string;
  file_type?: string; // 'image' | 'document' | 'other'
  created_at: string;
  
  // Tính năng mới
  reply_to_id?: string | null;       // ID tin nhắn gốc
  reply_to_content?: string | null; // Nội dung tin nhắn gốc (snapshot)
  reply_to_sender?: string | null;  // Người gửi tin nhắn gốc
  reactions?: Record<string, string>; // { "username": "❤️", "username2": "👍" }
}

// Interface cho Ngày nghỉ lễ
export interface Holiday {
  id: string;
  name: string;       // Tên ngày lễ (VD: Tết Nguyên Đán)
  day: number;        // Ngày
  month: number;      // Tháng
  isLunar: boolean;   // true = Âm lịch, false = Dương lịch
}

// Interface cho Lịch công tác
export interface WorkSchedule {
  id: string;
  date: string;       // Ngày công tác (YYYY-MM-DD)
  executors: string;  // Người thực hiện (Lưu dạng chuỗi text: "Nguyễn Văn A, Trần B")
  content: string;    // Văn bản / Nội dung công tác
  partner: string;    // Cơ quan phối hợp
  created_at: string; // Ngày tạo
  created_by: string; // Người tạo
}

// Interface Notification (Chuyển từ UtilitiesView sang đây để tránh Circular Dependency)
export type NotifyType = 'success' | 'error' | 'info';
export type NotifyFunction = (message: string, type?: NotifyType) => void;

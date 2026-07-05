import { RecordStatus, Employee, RecordFile, User, UserRole, Contract } from './types';

// CẤU HÌNH KẾT NỐI
export const API_BASE_URL = 'https://dajjhubrhybodggbqapt.supabase.co'; 

// PHIÊN BẢN HIỆN TẠI CỦA ỨNG DỤNG
export const APP_VERSION = '2.1.0';

export const STATUS_LABELS: Record<RecordStatus, string> = {
  [RecordStatus.RECEIVED]: 'Chưa giao',
  [RecordStatus.ASSIGNED]: 'Đã giao việc',
  [RecordStatus.IN_PROGRESS]: 'Đang thực hiện',
  [RecordStatus.COMPLETED_WORK]: 'Đã thực hiện', 
  [RecordStatus.PENDING_CHECK]: 'Chờ kiểm tra',
  [RecordStatus.CHECKED]: 'Đã kiểm tra',
  [RecordStatus.PENDING_SIGN]: 'Chờ ký duyệt',
  [RecordStatus.SIGNED]: 'Đã ký duyệt',
  [RecordStatus.HANDOVER]: 'Đã giao 1 cửa',
  [RecordStatus.RETURNED]: 'Đã trả kết quả',
  [RecordStatus.WITHDRAWN]: 'CSD rút hồ sơ',
  [RecordStatus.REJECTED]: 'Hồ sơ trả',
  [RecordStatus.TBT]: 'Thông báo thuế (TBT)',
  [RecordStatus.PENDING_SUPPLEMENT]: 'Chờ bổ sung (Người dân)',
};

export const STATUS_COLORS: Record<RecordStatus, string> = {
  [RecordStatus.RECEIVED]: 'bg-gray-100 text-gray-800',
  [RecordStatus.ASSIGNED]: 'bg-blue-100 text-blue-800',
  [RecordStatus.IN_PROGRESS]: 'bg-yellow-100 text-yellow-800',
  [RecordStatus.COMPLETED_WORK]: 'bg-cyan-100 text-cyan-800',
  [RecordStatus.PENDING_CHECK]: 'bg-orange-100 text-orange-800',
  [RecordStatus.CHECKED]: 'bg-teal-100 text-teal-800',
  [RecordStatus.PENDING_SIGN]: 'bg-purple-100 text-purple-800',
  [RecordStatus.SIGNED]: 'bg-indigo-100 text-indigo-800',
  [RecordStatus.HANDOVER]: 'bg-green-100 text-green-800',
  [RecordStatus.RETURNED]: 'bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold',
  [RecordStatus.WITHDRAWN]: 'bg-slate-600 text-white',
  [RecordStatus.REJECTED]: 'bg-red-100 text-red-800',
  [RecordStatus.TBT]: 'bg-amber-100 text-amber-800 border border-amber-300 font-bold',
  [RecordStatus.PENDING_SUPPLEMENT]: 'bg-orange-100 text-orange-800 border border-orange-200 font-bold',
};

export const GROUPS = ['Tân Khai', 'Tân Quan', 'Minh Đức', 'Tân Hưng'];

export const DEFAULT_WARDS = [
  'Tân Khai',
  'Tân Quan',
  'Minh Đức',
  'Tân Hưng'
];

export const WARDS = DEFAULT_WARDS;

// --- PHÂN CHIA LOẠI HỒ SƠ THEO TAB ---

// 1. Tab Lưu trữ: Chỉ có đầu 1.x
export const ARCHIVE_TYPES = [
  '1.2 Công văn'
];

// 2. Tab Đo đạc: Bao gồm toàn bộ từ 2.1 đến 2.6
export const RECORD_TYPES = [
  '2.1 Trích lục',
  '2.2 Trích lục Quy hoạch',
  '2.3 Trích đo',
  '2.4 Trích đo Cắm mốc',
  '2.5 Trích đo Tách - Hợp thửa',
  '2.6 Cung cấp số thửa'
];

// 3. Tab Đăng ký: Toàn bộ đầu 3.x
export const REGISTRATION_PROCEDURES = [
  '3.1 Thừa kế',
  '3.2 Tặng cho',
  '3.3 Chuyển nhượng',
  '3.4 Thỏa thuận',
  '3.5 Chuyển mục đích không xin phép',
  '3.6 Cấp đổi',
  '3.7 Cấp lại',
  '3.8 Tách - hợp thửa',
  '3.9 Gia hạn',
];

// Tổng hợp để dùng cho các bộ lọc chung (không được xóa)
export const ALL_RECORD_TYPES = [
  ...ARCHIVE_TYPES,
  ...RECORD_TYPES,
  ...REGISTRATION_PROCEDURES
];

// --- HÀM CHUẨN HÓA VÀ RÚT GỌN ---

export const getNormalizedWard = (ward: string | null | undefined): string => {
  if (!ward) return '';
  let w = ward.trim();
  w = w.replace(/^(xã|phường|thị trấn|tt\.|p\.|x\.)\s+/yi, '');
  const lower = w.toLowerCase();
  if (lower === 'tk' || lower === 'tân khai') return 'Tân Khai';
  if (lower === 'md' || lower === 'minh đức') return 'Minh Đức';
  if (lower === 'th' || lower === 'tân hưng') return 'Tân Hưng';
  if (lower === 'tq' || lower === 'tân quan') return 'Tân Quan';
  return w.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export const getShortRecordType = (type: string | null | undefined): string => {
  if (!type) return '---';
  const t = type.toLowerCase();
  
  // Kiểm tra cụm từ dài/đặc biệt trước
  if (t.includes('cung cấp dữ liệu đất đai')) return '1.1 CC DL ĐĐ';
  if (t.includes('1.2 công văn') || t.includes('công văn')) return '1.2 CV';
  if (t.includes('trích lục quy hoạch')) return '2.2 TLQH';
  if (t.includes('trích lục')) return '2.1 TL';
  if (t.includes('trích đo cắm mốc')) return '2.4 CMốc';
  if (t.includes('trích đo tách - hợp thửa')) return '2.5 TT-TH';
  if (t.includes('trích đo')) return '2.3 TĐ';
  if (t.includes('cung cấp số thửa')) return '2.6 CC Số Thửa';
  if (t.includes('chuyển mục đích không xin phép')) return '3.5 CMĐ-KXP';
  if (t.includes('thừa kế')) return '3.1 TK';
  if (t.includes('tặng cho')) return '3.2 TC';
  if (t.includes('chuyển nhượng')) return '3.3 CN';
  if (t.includes('thỏa thuận')) return '3.4 VBTT';
  if (t.includes('cấp đổi')) return '3.6 Cấp Đổi';
  if (t.includes('cấp lại')) return '3.7 Cấp Lại';
  if (t.includes('tách - hợp') || t.includes('tách thửa') || t.includes('hợp thửa')) return '3.8 T-HT';
  if (t.includes('gia hạn')) return '3.9 GH';
 
  return type; 
};

// --- DỮ LIỆU MẪU (MOCK DATA) ---

export const MOCK_EMPLOYEES: Employee[] = [
  { id: 'emp1', name: 'Nguyễn Văn A', department: 'Tổ Đo dạc', position: 'Tổ Trưởng', managedWards: ['Tân Quan'] },
  { id: 'emp2', name: 'Trần Thị B', department: 'Tổ Cấp giấy', position: 'Tổ Trưởng', managedWards: ['Minh Đức', 'Tân Khai'] },
  { id: 'emp3', name: 'Lê Văn C', department: 'Ban Lãnh đạo', position: 'Phó Giám Đốc', managedWards: [] },
  { id: 'emp4', name: 'Phạm Thị D', department: 'Tổ Thông tin lưu trữ', position: 'Tổ trưởng', managedWards: [] },
  { id: 'emp5', name: 'Hoàng Văn E', department: 'Tổ Thông tin lưu trữ', position: 'Chuyên viên', managedWards: [] }
];

export const MOCK_USERS: User[] = [
  { username: 'admin', password: '123', name: 'Administrator', role: UserRole.ADMIN },
  { username: 'manager', password: '123', name: 'Phó Giám Đốc', role: UserRole.SUBADMIN, employeeId: 'emp3' },
  { username: 'nv_a', password: '123', name: 'Nguyễn Văn A', role: UserRole.EMPLOYEE, employeeId: 'emp1' },
  { username: 'nv_b', password: '123', name: 'Trần Thị B', role: UserRole.EMPLOYEE, employeeId: 'emp2' }
];

const getRelativeDate = (daysOffset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
};

export const MOCK_RECORDS: RecordFile[] = [
  {
    id: '1',
    code: 'HS-2024-001',
    customerName: 'DỮ LIỆU MẪU (OFFLINE)',
    phoneNumber: '0909123456',
    recordType: '2.1 Trích lục',
    content: 'Dữ liệu mẫu ngoại tuyến',
    receivedDate: getRelativeDate(0), 
    deadline: getRelativeDate(5),      
    status: RecordStatus.RECEIVED,
    group: 'Tân Quan',
    ward: 'Tân Quan'
  }
];

export const MOCK_CONTRACTS: Contract[] = [
  {
    id: 'c1',
    code: 'HĐ-2024-001',
    customerName: 'Nguyễn Văn A (Mẫu)',
    phoneNumber: '0909123456',
    ward: 'Tân Quan',
    contractType: 'Đo đạc',
    serviceType: 'Đo đạc diện tích dưới 500m2',
    areaType: 'Đất đô thị',
    quantity: 1,
    unitPrice: 1200000,
    vatRate: 8,
    vatAmount: 96000,
    totalAmount: 1296000,
    deposit: 0,
    createdDate: getRelativeDate(-1),
    status: 'PENDING'
  }
];
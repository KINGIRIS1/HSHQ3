import React, { useState, useEffect, useMemo } from "react";
import { User, RecordFile, RecordStatus, Employee } from "../../types";
import {
  ArchiveRecord,
  fetchArchiveRecords,
  saveArchiveRecord,
  deleteArchiveRecord,
  updateArchiveRecordsBatch,
  importArchiveRecords,
} from "../../services/apiArchive";
import { useArchiveRealtime } from "../../hooks/useArchiveRealtime";
import {
  fetchEmployees,
  saveEmployeeApi,
  fetchUsers,
  saveUserApi,
} from "../../services/apiPeople";
import {
  Search,
  Plus,
  ListChecks,
  FileCheck,
  Send,
  Trash2,
  Edit,
  Save,
  X,
  RotateCcw,
  MapPin,
  Calendar,
  User as UserIcon,
  Users,
  CheckCircle2,
  LayoutGrid,
  PenTool,
  CheckCircle,
  Eye,
  FileSpreadsheet,
  FileDown,
  Printer,
  History,
  CheckSquare,
} from "lucide-react";
import { confirmAction, toTitleCase, findArchiveStaffForWard } from "../../utils/appHelpers";
import AssignModal from "../AssignModal";
import ArchiveDetailModal from "./ArchiveDetailModal";
import HandoverListModal from "./HandoverListModal";
import ReturnResultModal from "../ReturnResultModal";
import ExportHandoverModal from "./ExportHandoverModal";
import { STATUS_LABELS, STATUS_COLORS } from "../../constants";
import * as XLSX from "xlsx-js-style";

interface SaoLucViewProps {
  currentUser: User;
  wards?: string[];
}

// Định nghĩa form state riêng để dễ quản lý các trường trong JSON data
interface SaoLucFormData {
  id?: string;
  so_hieu: string; // Mã hồ sơ
  chu_su_dung: string; // Chủ sử dụng (Map vào noi_nhan_gui)
  xa_phuong: string; // Xã phường (Lưu trong data)
  to_ban_do: string; // Tờ (Lưu trong data)
  thua_dat: string; // Thửa (Lưu trong data)
  ngay_nhan: string; // Ngày nhận (Map vào ngay_thang)
  hen_tra: string; // Hẹn trả (Lưu trong data)
  noi_dung: string; // Nội dung yêu cầu (Map vào trich_yeu)
  status:
    | "draft"
    | "assigned"
    | "executed"
    | "pending_check"
    | "checked"
    | "pending_sign"
    | "signed"
    | "completed"
    | "rejected";
  ngay_hoan_thanh?: string;
  danh_sach?: string;
  receipt_number?: string;
  payment_status?: "Chưa thu" | "Đã thu";
  payment_amount?: number | null;
  result_returned_date?: string;
}

const SaoLucView: React.FC<SaoLucViewProps> = ({
  currentUser,
  wards = ["Tân Quan", "Tân Khai", "Minh Đức", "Tân Hưng"],
}) => {
  const [subTab, setSubTab] = useState<
    "all" | "draft" | "assigned" | "executed" | "sign" | "signed" | "result"
  >("all");
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterWard, setFilterWard] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("");

  // Detail Modal State
  const [detailRecord, setDetailRecord] = useState<ArchiveRecord | null>(null);

  // Assign Modal State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Handover Modal State
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [pendingCompletionRecord, setPendingCompletionRecord] =
    useState<ArchiveRecord | null>(null);

  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [handoverTab, setHandoverTab] = useState<"today" | "history" | "returned">("history");

  // Return Result Modal State
  const [returnRecord, setReturnRecord] = useState<ArchiveRecord | null>(null);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState<SaoLucFormData>({
    so_hieu: "",
    chu_su_dung: "",
    xa_phuong: "Tân Khai",
    to_ban_do: "",
    thua_dat: "",
    ngay_nhan: new Date().toISOString(),
    hen_tra: "",
    noi_dung: "",
    status: "draft",
    ngay_hoan_thanh: "",
    danh_sach: "",
    receipt_number: "",
    payment_status: "Chưa thu",
    payment_amount: null,
    result_returned_date: "",
  });

  const [editingId, setEditingId] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useArchiveRealtime("saoluc", setRecords);

  useEffect(() => {
    loadData();
    loadEmployees();
  }, []);

  const loadData = async () => {
    const data = await fetchArchiveRecords("saoluc");
    setRecords(data);
  };

  const loadEmployees = async () => {
    const data = await fetchEmployees();
    setEmployees(data);
  };

  const isAllowedToModify = useMemo(() => {
    const roleUpper = (currentUser.role || "").toUpperCase();
    if (roleUpper === "ADMIN") return true;
    if (roleUpper === "SUBADMIN") {
      const emp = employees.find((e) => e.id === currentUser.employeeId);
      if (!emp) return false;
      const dept = (emp.department || "").toLowerCase();
      
      const removeAccents = (s: string) => {
        return s
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d")
          .replace(/Đ/g, "D");
      };
      const cleanDept = removeAccents(dept);
      
      // SaoLucView is for "Lưu trữ", "Văn phòng", or "Hành chính"
      return cleanDept.includes("luu tru") || cleanDept.includes("van phong") || cleanDept.includes("hanh chinh");
    }
    return true; 
  }, [currentUser, employees]);

  const filteredRecords = useMemo(() => {
    let list = records;

    // Filter by Tab
    if (subTab === "draft") list = list.filter((r) => r.status === "draft");
    if (subTab === "assigned")
      list = list.filter((r) => r.status === "assigned");
    if (subTab === "executed")
      list = list.filter((r) => r.status === "executed");
    if (subTab === "sign")
      list = list.filter((r) => r.status === "pending_sign");
    if (subTab === "signed") list = list.filter((r) => r.status === "signed");
    if (subTab === "result") {
      if (handoverTab === "today") {
        list = list.filter((r) => r.status === "signed");
      } else if (handoverTab === "history") {
        list = list.filter((r) => r.status === "completed");
      } else if (handoverTab === "returned") {
        list = list.filter(
          (r) =>
            r.status === "completed" &&
            (r.data?.payment_status === "Đã thu" || r.data?.result_returned_date)
        );
      }
    }
    // 'all' shows everything

    // Filter by Date
    if (fromDate) list = list.filter((r) => r.ngay_thang >= fromDate);
    if (toDate) list = list.filter((r) => r.ngay_thang <= toDate);

    // Filter by Ward
    if (filterWard) list = list.filter((r) => r.data?.xa_phuong === filterWard);

    // Filter by Employee
    if (filterEmployee)
      list = list.filter((r) => r.data?.assigned_to === filterEmployee);

    // Filter by Search
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      list = list.filter(
        (r) =>
          (r.so_hieu || "").toLowerCase().includes(lower) ||
          (r.noi_nhan_gui || "").toLowerCase().includes(lower) || // Chủ sử dụng
          (r.trich_yeu || "").toLowerCase().includes(lower),
      );
    }

    // EXCLUDE records belonging to BAN GIAM DOC, TO TRUONG, TO PHO if currentUser is SUBADMIN
    const isSubAdminUser =
      (currentUser.role as string) === "SUBADMIN" ||
      (currentUser.role as string) === "subadmin";

    if (isSubAdminUser) {
      const isDirectorOrLeader = (employeeId: string | null | undefined) => {
        if (!employeeId) return false;
        const emp = employees.find((e) => e.id === employeeId);
        if (emp) {
          const dept = (emp.department || "").toLowerCase();
          const pos = (emp.position || "").toLowerCase();

          const removeAccents = (s: string) => {
            return s
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/đ/g, "d")
              .replace(/Đ/g, "D");
          };
          const cleanDept = removeAccents(dept);
          const cleanPos = removeAccents(pos);

          const isDirDeptClean =
            cleanDept.includes("ban giam doc") ||
            cleanDept.includes("giam doc") ||
            cleanDept.includes("ban lanh dao");
          const isDirPosClean =
            cleanPos.includes("giam doc") ||
            cleanPos.includes("lanh dao") ||
            cleanPos.includes("pho giam doc");
          const isLeaderPosClean =
            cleanPos.includes("to truong") ||
            cleanPos.includes("to pho") ||
            cleanPos.includes("truong phong") ||
            cleanPos.includes("pho phong") ||
            cleanPos.includes("truong nhom") ||
            cleanPos.includes("nhom truong");

          if (isDirDeptClean || isDirPosClean || isLeaderPosClean) return true;
        }
        return false;
      };

      list = list.filter(
        (r) =>
          !isDirectorOrLeader(r.data?.assigned_to) &&
          !isDirectorOrLeader(r.data?.checked_by) &&
          !isDirectorOrLeader(r.data?.submitted_to)
      );
    }

    return list;
  }, [
    records,
    subTab,
    searchTerm,
    fromDate,
    toDate,
    filterWard,
    filterEmployee,
    employees,
    currentUser,
  ]);

  // Reset selection and page when tab/filters change
  useEffect(() => {
    setSelectedIds(new Set());
    setCurrentPage(1);
  }, [subTab, handoverTab, searchTerm, fromDate, toDate, filterWard, filterEmployee]);

  const handleAssign = () => {
    if (selectedIds.size === 0) return;
    setShowAssignModal(true);
  };

  const handleConfirmAssign = async (employeeId: string, workflowType?: string | null) => {
    const historyEntry = {
      action: "Giao việc",
      status: "assigned",
      timestamp: new Date().toISOString(),
      user: currentUser.name,
      note: `Giao cho nhân viên: ${getEmployeeName(employeeId)}`,
    };

    const updates = {
      status: "assigned" as any,
      data: {
        assigned_to: employeeId,
        assigned_date: new Date().toISOString(),
        history: [historyEntry], // Will be appended by updateArchiveRecordsBatch
      },
    };

    await updateArchiveRecordsBatch(Array.from(selectedIds), updates);
    setShowAssignModal(false);
    setSelectedIds(new Set());
    loadData();
  };

  const handleAutoAssign = async () => {
    if (selectedIds.size === 0) return;
    const listToAssign = Array.from(selectedIds).map(id => records.find(r => r.id === id)).filter(Boolean) as ArchiveRecord[];
    if (listToAssign.length === 0) return;

    let assignedCount = 0;
    const updatesList: { id: string; updates: any }[] = [];

    for (const record of listToAssign) {
      const ward = record.data?.xa_phuong;
      if (ward) {
        const matchedEmployee = findArchiveStaffForWard(ward, employees);
        if (matchedEmployee) {
          const historyEntry = {
            action: "Giao việc tự động (Địa chỉ thửa đất)",
            status: "assigned" as const,
            timestamp: new Date().toISOString(),
            user: currentUser.name,
            note: `Tự động phân công cho nhân viên: ${matchedEmployee.name} (Địa bàn: ${ward})`,
          };
          
          const updates = {
            status: "assigned" as const,
            data: {
              ...record.data,
              assigned_to: matchedEmployee.id,
              assigned_date: new Date().toISOString(),
              history: [...(Array.isArray(record.data?.history) ? record.data.history : []), historyEntry],
            }
          };
          updatesList.push({ id: record.id, updates });
          assignedCount++;
        }
      }
    }

    if (updatesList.length > 0) {
      for (const item of updatesList) {
        await updateArchiveRecordsBatch([item.id], item.updates);
      }
      setSelectedIds(new Set());
      loadData();
      alert(`Đã giao tự động thành công ${assignedCount}/${listToAssign.length} hồ sơ dựa trên địa bàn phụ trách!`);
    } else {
      alert("Không tìm thấy nhân viên Tổ Lưu trữ nào phụ trách các địa bàn xã/phường của các hồ sơ này.");
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredRecords.map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  // Helper để lấy tên nhân viên từ ID
  const getEmployeeName = (id?: string) => {
    if (!id) return "-";
    const emp = employees.find((e) => e.id === id);
    return emp ? emp.name : id;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.so_hieu || !formData.chu_su_dung) {
      alert("Vui lòng nhập Mã hồ sơ và Chủ sử dụng.");
      return;
    }

    // Map form data về cấu trúc ArchiveRecord
    let finalStatus = formData.status;
    let assignedTo = undefined;
    let assignedDate = undefined;
    const historyEntries: any[] = [];

    if (!editingId && formData.status === "draft" && formData.xa_phuong) {
      const matchedEmployee = findArchiveStaffForWard(formData.xa_phuong, employees);
      if (matchedEmployee) {
        finalStatus = "assigned";
        assignedTo = matchedEmployee.id;
        assignedDate = new Date().toISOString();
        historyEntries.push({
          action: "Giao việc tự động (Địa chỉ thửa đất)",
          status: "assigned",
          timestamp: new Date().toISOString(),
          user: "Hệ thống",
          note: `Đã tự động giao cho ${matchedEmployee.name} phụ trách địa bàn ${formData.xa_phuong}`,
        });
      }
    }

    const recordToSave: Partial<ArchiveRecord> = {
      id: editingId || undefined,
      type: "saoluc",
      status: finalStatus,
      so_hieu: formData.so_hieu, // Mã hồ sơ
      noi_nhan_gui: formData.chu_su_dung, // Chủ sử dụng
      ngay_thang: formData.ngay_nhan, // Ngày nhận
      trich_yeu: formData.noi_dung, // Nội dung
      data: {
        // Các trường mở rộng
        xa_phuong: formData.xa_phuong,
        to_ban_do: formData.to_ban_do,
        thua_dat: formData.thua_dat,
        hen_tra: formData.hen_tra,
        ngay_hoan_thanh: formData.ngay_hoan_thanh,
        danh_sach: formData.danh_sach,
        receipt_number: formData.receipt_number,
        payment_status: formData.payment_status,
        payment_amount: formData.payment_amount || null,
        result_returned_date: formData.result_returned_date,
        ...(assignedTo ? { assigned_to: assignedTo, assigned_date: assignedDate, history: historyEntries } : {}),
      },
      created_by: currentUser.username,
    };

    const success = await saveArchiveRecord(recordToSave);

    if (success) {
      await loadData();
      setIsFormOpen(false);
      setEditingId(null);
      resetForm();
    } else {
      alert("Lỗi khi lưu.");
    }
  };

  const resetForm = () => {
    setFormData({
      so_hieu: "",
      chu_su_dung: "",
      xa_phuong: "Tân Khai",
      to_ban_do: "",
      thua_dat: "",
      ngay_nhan: new Date().toISOString(),
      hen_tra: "",
      noi_dung: "",
      status: "draft",
      ngay_hoan_thanh: "",
      danh_sach: "",
      receipt_number: "",
      payment_status: "Chưa thu",
      payment_amount: null,
      result_returned_date: "",
    });
  };

  const handleStatusChange = async (
    record: ArchiveRecord,
    newStatus: ArchiveRecord["status"],
  ) => {
    // If completing, show modal to select list
    if (newStatus === "completed") {
      setPendingCompletionRecord(record);
      setShowHandoverModal(true);
      return;
    }

    let confirmMsg = "";
    let actionName = "";
    switch (newStatus) {
      case "draft":
        confirmMsg = "Thu hồi hồ sơ về trạng thái Nháp?";
        actionName = "Thu hồi";
        break;
      case "executed":
        confirmMsg = "Xác nhận đã thực hiện xong?";
        actionName = "Thực hiện xong";
        break;
      case "pending_sign":
        confirmMsg = "Trình ký hồ sơ này?";
        actionName = "Trình ký";
        break;
      case "signed":
        confirmMsg = "Xác nhận đã ký duyệt?";
        actionName = "Ký duyệt";
        break;
      default:
        confirmMsg = "Chuyển trạng thái?";
        actionName = "Chuyển trạng thái";
    }

    if (await confirmAction(confirmMsg)) {
      const historyEntry = {
        action: actionName,
        status: newStatus,
        timestamp: new Date().toISOString(),
        user: currentUser.name,
      };

      const oldHistory = Array.isArray(record.data?.history)
        ? record.data.history
        : [];
      const newHistory = [...oldHistory, historyEntry];

      await saveArchiveRecord({
        ...record,
        status: newStatus,
        data: { ...record.data, history: newHistory },
      });
      loadData();
    }
  };

  const handleBatchStatusChange = async (
    newStatus: ArchiveRecord["status"],
  ) => {
    if (selectedIds.size === 0) return;

    let confirmMsg = "";
    let actionName = "";
    switch (newStatus) {
      case "executed":
        confirmMsg = `Xác nhận đã thực hiện xong ${selectedIds.size} hồ sơ?`;
        actionName = "Đã thực hiện";
        break;
      case "pending_sign":
        confirmMsg = `Trình ký ${selectedIds.size} hồ sơ?`;
        actionName = "Trình ký";
        break;
      case "signed":
        confirmMsg = `Xác nhận đã ký duyệt ${selectedIds.size} hồ sơ?`;
        actionName = "Ký duyệt";
        break;
      default:
        return;
    }

    if (await confirmAction(confirmMsg)) {
      const historyEntry = {
        action: actionName,
        status: newStatus,
        timestamp: new Date().toISOString(),
        user: currentUser.name,
      };

      const updates = {
        status: newStatus as any,
        data: {
          history: [historyEntry],
        },
      };

      await updateArchiveRecordsBatch(Array.from(selectedIds), updates);
      setSelectedIds(new Set());
      loadData();
    }
  };

  const handleConfirmHandover = async (
    listName: string,
    handoverDate: string,
    receiptNumber: string,
    paymentStatus: "Chưa thu" | "Đã thu",
    resultReturnedDate: string,
    isNonGeographic?: boolean,
    handoverWard?: string,
    receiptType?: "receipt" | "invoice",
    paymentAmount?: number | null,
  ) => {
    const typeText = receiptType === "receipt" ? "Số biên lai" : "Số hóa đơn";
    const amountText = paymentAmount ? `${paymentAmount.toLocaleString("vi-VN")} VNĐ` : "N/A";
    
    if (pendingCompletionRecord) {
      const historyEntry = {
        action: "Đã giao 1 cửa",
        status: "completed",
        timestamp: new Date().toISOString(),
        user: currentUser.name,
        note: `Đã chuyển vào danh sách: ${listName}. ${typeText}: ${receiptNumber || "N/A"}. Thu tiền: ${paymentStatus}. Số tiền: ${amountText}. Ngày trả thực tế: ${resultReturnedDate ? resultReturnedDate.split("-").reverse().join("/") : "N/A"}${isNonGeographic && handoverWard ? ` (Phi địa giới: ${handoverWard})` : ""}`,
      };

      const oldHistory = Array.isArray(pendingCompletionRecord.data?.history)
        ? pendingCompletionRecord.data.history
        : [];
      const newHistory = [...oldHistory, historyEntry];

      const updateData: any = {
        ...pendingCompletionRecord.data,
        history: newHistory,
        ngay_hoan_thanh: handoverDate,
        danh_sach: listName,
        receipt_number: receiptNumber,
        receipt_type: receiptType || "receipt",
        payment_amount: paymentAmount || null,
        payment_status: paymentStatus,
        result_returned_date: resultReturnedDate,
        is_non_geographic: isNonGeographic || false,
        handover_ward: handoverWard || "",
      };

      await saveArchiveRecord({
        ...pendingCompletionRecord,
        status: "completed",
        data: updateData,
      });

      setPendingCompletionRecord(null);
      loadData();
    } else if (selectedIds.size > 0 && subTab === "signed") {
      const historyEntry = {
        action: "Đã giao 1 cửa",
        status: "completed",
        timestamp: new Date().toISOString(),
        user: currentUser.name,
        note: `Đã chuyển vào danh sách: ${listName}. ${typeText}: ${receiptNumber || "N/A"}. Thu tiền: ${paymentStatus}. Số tiền: ${amountText}. Ngày trả thực tế: ${resultReturnedDate ? resultReturnedDate.split("-").reverse().join("/") : "N/A"}${isNonGeographic && handoverWard ? ` (Phi địa giới: ${handoverWard})` : ""}`,
      };

      const updates = {
        status: "completed" as any,
        data: {
          ngay_hoan_thanh: handoverDate,
          danh_sach: listName,
          receipt_number: receiptNumber,
          receipt_type: receiptType || "receipt",
          payment_amount: paymentAmount || null,
          payment_status: paymentStatus,
          result_returned_date: resultReturnedDate,
          is_non_geographic: isNonGeographic || false,
          handover_ward: handoverWard || "",
          history: [historyEntry],
        },
      };

      await updateArchiveRecordsBatch(Array.from(selectedIds), updates);
      setSelectedIds(new Set());
      loadData();
    }
  };

  const handleConfirmReturnResult = async (
    receiptNumber: string,
    receiverName: string,
    receiptType: 'receipt' | 'invoice',
    paymentAmount: number | null
  ) => {
    if (!returnRecord) return;
    const nowStr = new Date().toISOString().split("T")[0];

    const typeText = receiptType === "invoice" ? "hóa đơn" : "biên lai";
    const amountText = paymentAmount ? `${paymentAmount.toLocaleString("vi-VN")} VNĐ` : "N/A";

    const historyEntry = {
      action: "Trả kết quả",
      status: "completed" as const,
      timestamp: new Date().toISOString(),
      user: currentUser.name,
      note: `Đã trả kết quả cho ${receiverName}. Số ${typeText}: ${receiptNumber || "N/A"}. Tiền thực tế: ${amountText}.`,
    };

    const oldHistory = Array.isArray(returnRecord.data?.history)
      ? returnRecord.data.history
      : [];
    const newHistory = [...oldHistory, historyEntry];

    const success = await saveArchiveRecord({
      ...returnRecord,
      data: {
        ...returnRecord.data,
        result_returned_date: nowStr,
        receiver_name: receiverName,
        receipt_number: receiptNumber,
        receipt_type: receiptType,
        payment_amount: paymentAmount,
        payment_status: "Đã thu",
        history: newHistory,
      },
    });

    if (success) {
      setReturnRecord(null);
      setIsReturnModalOpen(false);
      loadData();
    } else {
      alert("Lỗi khi ghi nhận trả kết quả.");
    }
  };

  const handlePrintRecord = (record: ArchiveRecord) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const typeLabel = record.type === "saoluc" ? "SAO LỤC, TRÍCH LỤC" : "CÔNG VĂN";
    
    const history = record.data?.history || [];
    const historyRows = history
      .map(
        (h: any, idx: number) => `
        <tr>
          <td>${idx + 1}</td>
          <td><b>${h.action || h.status}</b></td>
          <td>${new Date(h.timestamp).toLocaleString("vi-VN")}</td>
          <td>${h.user || "Hệ thống"}</td>
          <td>${h.note || "---"}</td>
        </tr>
      `
      )
      .join("");

    const wardDetail = record.type === "saoluc"
      ? `<p><b>Vị trí đất:</b> Xã/Phường: ${record.data?.xa_phuong || "-"}, Tờ: ${record.data?.to_ban_do || "-"}, Thửa: ${record.data?.thua_dat || "-"}</p>`
      : "";

    const nonGeographicDetail = record.data?.is_non_geographic && record.data?.handover_ward
      ? `<p style="color: #6b21a8;"><b>Địa bàn giao phi địa giới:</b> ${record.data.handover_ward}</p>`
      : "";

    const resultReturnedDetail = record.status === "completed"
      ? `
        <div style="margin-top: 15px; padding: 10px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px;">
          <p style="margin: 3px 0;"><b>Hóa đơn/Biên lai:</b> ${record.data?.receipt_number || "---"}</p>
          <p style="margin: 3px 0;"><b>Hẹn trả kết quả:</b> ${record.data?.hen_tra ? record.data.hen_tra.split("-").reverse().join("/") : "---"}</p>
          <p style="margin: 3px 0;"><b>Đợt giao 1 cửa:</b> ${record.data?.danh_sach || "---"}</p>
          <p style="margin: 3px 0;"><b>Trạng thái thu tiền:</b> ${record.data?.payment_status || "Chưa thu"}</p>
          <p style="margin: 3px 0;"><b>Ngày trả kết quả thực tế:</b> ${record.data?.result_returned_date ? record.data.result_returned_date.split("-").reverse().join("/") : "---"}</p>
        </div>
      `
      : "";

    printWindow.document.write(`
      <html>
        <head>
          <title>In Phiếu Bộ Hồ Sơ ${record.so_hieu}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
            body { font-family: 'Roboto', sans-serif; padding: 40px; color: #333; line-height: 1.5; }
            .header-table { width: 100%; border: none; margin-bottom: 20px; }
            .header-table td { border: none; padding: 0; }
            .title { text-align: center; font-size: 20px; font-weight: bold; margin-top: 30px; margin-bottom: 5px; text-transform: uppercase; }
            .subtitle { text-align: center; font-size: 14px; margin-bottom: 30px; }
            .section-title { font-size: 14px; font-weight: bold; text-transform: uppercase; border-left: 4px solid #1d4ed8; padding-left: 8px; margin-top: 25px; margin-bottom: 12px; color: #1e3a8a; }
            .info-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
            .info-box p { margin: 6px 0; font-size: 14px; }
            table.data-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            table.data-table th, table.data-table td { border: 1px solid #cbd5e1; padding: 10px; font-size: 13px; text-align: left; }
            table.data-table th { background-color: #f1f5f9; font-weight: bold; }
            .sign-section { margin-top: 40px; width: 100%; border: none; }
            .sign-section td { border: none; text-align: center; font-size: 14px; width: 50%; }
            .sign-space { height: 80px; }
            @media print { body { padding: 10px; } }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td style="text-align: left; font-weight: bold; font-size: 13px; width: 50%;">VĂN PHÒNG ĐĂNG KÝ ĐẤT ĐAI</td>
              <td style="text-align: center; font-weight: bold; font-size: 12px; width: 50%;">
                CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br>
                <span style="font-weight: normal; text-decoration: underline;">Độc lập - Tự do - Hạnh phúc</span>
              </td>
            </tr>
          </table>
          <div class="title">PHIẾU THEO DÕI TIẾN TRÌNH HỒ SƠ</div>
          <div class="subtitle">Số hiệu: ${record.so_hieu} | Loại: ${typeLabel}</div>
          <div class="section-title">Thông tin chung</div>
          <div class="info-box">
            <p><b>Số hiệu hồ sơ:</b> <span style="font-weight: bold; color: #1d4ed8;">${record.so_hieu}</span></p>
            <p><b>Nơi nhận / Gửi:</b> ${record.noi_nhan_gui || "Chủ sử dụng"}</p>
            <p><b>Ngày ghi nhận hồ sơ:</b> ${record.ngay_thang ? record.ngay_thang.split("-").reverse().join("/") : ""}</p>
            <p><b>Hạn trả dự kiến:</b> ${record.data?.hen_tra ? record.data.hen_tra.split("-").reverse().join("/") : ""}</p>
            <p><b>Trạng thái hiện tại:</b> <span style="font-weight: bold; color: #047857;">${record.status}</span></p>
            ${wardDetail}
            ${nonGeographicDetail}
            ${resultReturnedDetail}
          </div>
          <div class="section-title">Nội dung chi tiết/Trích yếu</div>
          <div class="info-box" style="font-style: italic;">
            ${record.trich_yeu || "Không có trích yếu nội dung."}
          </div>
          <div class="section-title">Lịch sử quá trình xử lý</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 5%;">STT</th>
                <th style="width: 25%;">Thao tác</th>
                <th style="width: 25%;">Mốc thời gian</th>
                <th style="width: 20%;">Người thực hiện</th>
                <th style="width: 25%;">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              ${historyRows || '<tr><td colspan="5" style="text-align: center;">Chưa ghi nhận lịch sử xử lý</td></tr>'}
            </tbody>
          </table>
          <table class="sign-section">
            <tr>
              <td>
                <b>NGƯỜI XỬ LÝ HỒ SƠ</b><br>
                <div class="sign-space"></div>
                <b>${record.data?.assigned_to ? getEmployeeName(record.data.assigned_to) : "Chưa giao"}</b>
              </td>
              <td>
                <b>NGƯỜI GIAO/TRA CỨU VÀ IN</b><br>
                <div class="sign-space"></div>
                <b>${currentUser?.name || "Hệ thống"}</b>
              </td>
            </tr>
          </table>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => { window.close(); }, 1000);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDelete = async (id: string) => {
    if (await confirmAction("Xóa hồ sơ sao lục này?")) {
      await deleteArchiveRecord(id);
      loadData();
    }
  };

  const handleEdit = (r: ArchiveRecord) => {
    setEditingId(r.id);
    // Map từ DB về Form
    setFormData({
      id: r.id,
      so_hieu: r.so_hieu,
      chu_su_dung: r.noi_nhan_gui,
      ngay_nhan: r.ngay_thang,
      noi_dung: r.trich_yeu,
      status: r.status,
      xa_phuong: r.data?.xa_phuong || "Tân Khai",
      to_ban_do: r.data?.to_ban_do || "",
      thua_dat: r.data?.thua_dat || "",
      hen_tra: r.data?.hen_tra || "",
      ngay_hoan_thanh: r.data?.ngay_hoan_thanh || "",
      danh_sach: r.data?.danh_sach || "",
      receipt_number: r.data?.receipt_number || "",
      payment_status: r.data?.payment_status || "Chưa thu",
      payment_amount: r.data?.payment_amount !== undefined ? r.data?.payment_amount : null,
      result_returned_date: r.data?.result_returned_date || "",
    });
    setIsFormOpen(true);
  };

  const handleAddNew = () => {
    setIsFormOpen(true);
    setEditingId(null);
    resetForm();
  };

  const formatDate = (d: string) => {
    if (!d) return "";
    if (d.includes("/")) return d.split("T")[0];
    try {
      const datePart = d.split("T")[0];
      const parts = datePart.split("-");
      if (parts.length === 3) {
        return `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`;
      }
      return d;
    } catch (e) {
      return d;
    }
  };

  const mapStatusToEnum = (s: string): RecordStatus => {
    switch (s) {
      case "draft":
        return RecordStatus.RECEIVED;
      case "assigned":
        return RecordStatus.ASSIGNED;
      case "executed":
        return RecordStatus.COMPLETED_WORK;
      case "pending_sign":
        return RecordStatus.PENDING_SIGN;
      case "signed":
        return RecordStatus.SIGNED;
      case "completed":
        return RecordStatus.RETURNED;
      default:
        return RecordStatus.RECEIVED;
    }
  };

  const isManager =
    ((currentUser.role as string) === "ADMIN" ||
    (currentUser.role as string) === "SUBADMIN" ||
    (currentUser.role as string) === "TEAM_LEADER" ||
    (currentUser.role as string) === "admin" ||
    (currentUser.role as string) === "subadmin") &&
    isAllowedToModify;

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const ab = evt.target?.result;
      const wb = XLSX.read(ab, { type: "array" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // Skip header row
      const rows = data.slice(1);
      const newRecords: Partial<ArchiveRecord>[] = [];

      // Get users to link
      const users = await fetchUsers();

      // Helper to get or create employee
      const getOrCreateEmployee = async (name: string): Promise<string> => {
        if (!name) return "";
        const cleanName = toTitleCase(name.trim());
        let emp = employees.find(
          (e) => e.name.toLowerCase() === cleanName.toLowerCase(),
        );

        if (!emp) {
          // Create new employee
          const newEmp: Employee = {
            id: crypto.randomUUID(),
            name: cleanName,
            department: "Bộ phận một cửa",
            managedWards: [],
          };
          await saveEmployeeApi(newEmp, false);
          // Update local state to avoid duplicates in same loop
          employees.push(newEmp);
          emp = newEmp;
        }

        // Link to User if exists and not linked
        const user = users.find(
          (u) => u.name.toLowerCase() === cleanName.toLowerCase(),
        );
        if (user && !user.employeeId) {
          user.employeeId = emp.id;
          await saveUserApi(user, true);
        }

        return emp.id;
      };

      for (const row of rows as any[]) {
        // Map columns:
        // 0: MÃ HS, 1: CHỦ SỬ DỤNG, 2: NGÀY NHẬN, 3: HẸN TRẢ, 4: XÃ PHƯỜNG
        // 5: NGƯỜI THỰC HIỆN, 6: THỬA, 7: TỜ, 8: NGÀY HOÀN THÀNH, 9: DANH SÁCH

        const so_hieu = row[0]?.toString() || "";
        if (!so_hieu) continue;

        // Find employee ID by name if provided
        let assigned_to = "";
        const employeeName = row[5]?.toString();
        if (employeeName) {
          assigned_to = await getOrCreateEmployee(employeeName);
        }

        // Parse dates (assuming DD/MM/YYYY or Excel serial date)
        const parseExcelDate = (val: any) => {
          if (!val) return "";

          let date: Date | null = null;

          if (typeof val === "number") {
            // Excel serial date
            date = new Date(Math.round((val - 25569) * 86400 * 1000));
          } else if (typeof val === "string") {
            const cleanVal = val.trim();
            // Check for DD/MM/YYYY
            if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleanVal)) {
              const [d, m, y] = cleanVal.split("/");
              date = new Date(Number(y), Number(m) - 1, Number(d));
            }
            // Check for DD-MM-YYYY
            else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(cleanVal)) {
              const [d, m, y] = cleanVal.split("-");
              date = new Date(Number(y), Number(m) - 1, Number(d));
            }
            // Check for YYYY-MM-DD
            else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(cleanVal)) {
              date = new Date(cleanVal);
            }
          }

          if (date && !isNaN(date.getTime())) {
            const y = date.getFullYear();
            // Validate year range to prevent typos like 20245
            if (y >= 1900 && y <= 2100) {
              // Adjust for timezone offset to ensure correct date string
              const offset = date.getTimezoneOffset() * 60000;
              const localDate = new Date(date.getTime() - offset);
              return localDate.toISOString().split("T")[0];
            }
          }
          return "";
        };

        const ngay_hoan_thanh = parseExcelDate(row[8]);
        const danh_sach = row[9]?.toString() || "";
        const xa_phuong = row[4]?.toString() || "";

        let status: ArchiveRecord["status"] = "draft";
        let history: any[] = [];
        let final_assigned_to = assigned_to;

        // Determine status based on data
        if (ngay_hoan_thanh && danh_sach) {
          status = "completed";
          history.push({
            action: "Hoàn thành (Import)",
            status: "completed",
            timestamp: new Date().toISOString(),
            user: currentUser.name,
            note: `Đã chuyển vào danh sách: ${danh_sach}`,
          });
        } else if (final_assigned_to) {
          status = "assigned";
          history.push({
            action: "Giao việc (Import)",
            status: "assigned",
            timestamp: new Date().toISOString(),
            user: currentUser.name,
          });
        } else if (xa_phuong) {
          const matchedEmployee = findArchiveStaffForWard(xa_phuong, employees);
          if (matchedEmployee) {
            status = "assigned";
            final_assigned_to = matchedEmployee.id;
            history.push({
              action: "Giao việc tự động (Địa chỉ thửa đất)",
              status: "assigned",
              timestamp: new Date().toISOString(),
              user: "Hệ thống",
              note: `Đã tự động giao cho ${matchedEmployee.name} phụ trách địa bàn ${xa_phuong}`,
            });
          }
        }

        newRecords.push({
          type: "saoluc",
          status: status,
          so_hieu: so_hieu,
          noi_nhan_gui: toTitleCase(row[1]?.toString() || ""),
          ngay_thang: parseExcelDate(row[2]),
          trich_yeu: "", // Default empty
          data: {
            hen_tra: parseExcelDate(row[3]),
            xa_phuong: xa_phuong,
            assigned_to: final_assigned_to,
            thua_dat: row[6]?.toString() || "",
            to_ban_do: row[7]?.toString() || "",
            ngay_hoan_thanh: ngay_hoan_thanh,
            danh_sach: danh_sach,
            loai_ho_so: "Trích lục bản đồ địa chính", // Default
            history: history,
          },
          created_by: currentUser.username,
          created_at: new Date().toISOString(),
        });
      }

      if (newRecords.length > 0) {
        // Use importArchiveRecords service (need to ensure it's imported)
        // Assuming importArchiveRecords is available in apiArchive
        // If not, we might need to loop saveArchiveRecord or update apiArchive
        // Based on previous context, importArchiveRecords exists.
        const success = await importArchiveRecords(newRecords); // Ensure this is imported
        if (success) {
          alert(`Đã import thành công ${newRecords.length} hồ sơ.`);
          loadData();
        } else {
          alert("Có lỗi xảy ra khi import.");
        }
      } else {
        alert("Không tìm thấy dữ liệu hợp lệ trong file.");
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input
    e.target.value = "";
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* SUB-HEADER TABS */}
      <div className="flex border-b border-gray-200 bg-gray-50 px-4 overflow-x-auto shrink-0">
        <button
          onClick={() => setSubTab("all")}
          className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${subTab === "all" ? "border-blue-600 text-blue-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          <LayoutGrid size={16} /> Tất cả hồ sơ
        </button>
        <button
          onClick={() => setSubTab("draft")}
          className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${subTab === "draft" ? "border-blue-600 text-blue-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          <ListChecks size={16} /> Chưa giao
        </button>
        <button
          onClick={() => setSubTab("assigned")}
          className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${subTab === "assigned" ? "border-blue-600 text-blue-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          <Users size={16} /> Đang thực hiện
        </button>
        <button
          onClick={() => setSubTab("executed")}
          className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${subTab === "executed" ? "border-blue-600 text-blue-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          <CheckCircle2 size={16} /> Đã thực hiện
        </button>
        <button
          onClick={() => setSubTab("sign")}
          className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${subTab === "sign" ? "border-purple-600 text-purple-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          <Send size={16} /> Trình ký
        </button>
        <button
          onClick={() => setSubTab("signed")}
          className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${subTab === "signed" ? "border-teal-600 text-teal-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          <PenTool size={16} /> Ký duyệt
        </button>
        <button
          onClick={() => setSubTab("result")}
          className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${subTab === "result" ? "border-green-600 text-green-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          <FileCheck size={16} /> Giao 1 cửa
        </button>
      </div>

      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          {subTab === "result" ? (
            <div className="flex items-center gap-3">
              <div className="bg-orange-50 text-orange-600 p-2 rounded-xl border border-orange-100 shadow-sm">
                <FileSpreadsheet size={22} className="text-orange-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 leading-tight">Lịch sử giao sao lục</h2>
                <p className="text-xs text-gray-500 font-medium">Quản lý và luân chuyển hồ sơ sao lục trích lục lưu trữ</p>
              </div>
            </div>
          ) : (
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              {subTab === "all" && "Tất cả hồ sơ sao lục"}
              {subTab === "draft" && "Hồ sơ chưa giao"}
              {subTab === "assigned" && "Hồ sơ đang thực hiện"}
              {subTab === "executed" && "Hồ sơ đã thực hiện"}
              {subTab === "sign" && "Danh sách Trình ký"}
              {subTab === "signed" && "Danh sách Ký duyệt"}
            </h2>
          )}
          <div className="relative flex-1 sm:w-64 max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={subTab === "result" ? "Tìm kiếm sao lục..." : "Tìm Mã HS, Chủ sử dụng..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap gap-3 items-center bg-gray-50 p-2 rounded-lg border border-gray-100 relative">
          <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-md border border-gray-200 shadow-sm">
            <Calendar size={16} className="text-gray-500" />
            <input
              type="date"
              className="text-sm outline-none bg-transparent text-gray-700 w-28"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              placeholder="Từ ngày"
            />
            <span className="text-gray-400">-</span>
            <input
              type="date"
              className="text-sm outline-none bg-transparent text-gray-700 w-28"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              placeholder="Đến ngày"
            />
            {(fromDate || toDate) && (
              <button
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                }}
                className="text-gray-400 hover:text-red-500"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-md border border-gray-200 shadow-sm">
            <MapPin size={16} className="text-gray-500" />
            <select
              className="text-sm outline-none bg-transparent text-gray-700 font-medium cursor-pointer border-none focus:ring-0 min-w-[120px]"
              value={filterWard}
              onChange={(e) => setFilterWard(e.target.value)}
            >
              <option value="">Tất cả Xã/Phường</option>
              {wards.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-md border border-gray-200 shadow-sm">
            <Users size={16} className="text-gray-500" />
            <select
              className="text-sm outline-none bg-transparent text-gray-700 font-medium cursor-pointer border-none focus:ring-0 min-w-[120px]"
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
            >
              <option value="">Tất cả Nhân viên</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          {subTab === "result" && (
            <div className="flex bg-white rounded-md border border-gray-200 p-1 shadow-sm ml-auto">
              <button
                onClick={() => setHandoverTab("today")}
                className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold transition-all ${handoverTab === "today" ? "bg-orange-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}
              >
                <ListChecks size={14} /> Chờ giao
              </button>
              <button
                onClick={() => setHandoverTab("history")}
                className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold transition-all ${handoverTab === "history" ? "bg-orange-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}
              >
                <History size={14} /> Lịch sử
              </button>
              <button
                onClick={() => setHandoverTab("returned")}
                className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold transition-all ${handoverTab === "returned" ? "bg-orange-600 text-white shadow-sm font-bold shadow-orange-100 border border-orange-200" : "text-gray-600 hover:bg-gray-100"}`}
              >
                <FileCheck size={14} /> Đã trả KQ
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-2">
          {subTab === "assigned" && isManager && selectedIds.size > 0 && (
            <button
              onClick={() => handleBatchStatusChange("executed")}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-bold shadow-md transition-all animate-pulse"
            >
              <CheckCircle2 size={18} /> Đã thực hiện ({selectedIds.size})
            </button>
          )}
          {subTab === "executed" && isManager && selectedIds.size > 0 && (
            <button
              onClick={() => handleBatchStatusChange("pending_sign")}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-bold shadow-md transition-all animate-pulse"
            >
              <Send size={18} /> Trình ký ({selectedIds.size})
            </button>
          )}
          {subTab === "sign" && isManager && selectedIds.size > 0 && (
            <button
              onClick={() => handleBatchStatusChange("signed")}
              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 font-bold shadow-md transition-all animate-pulse"
            >
              <PenTool size={18} /> Ký duyệt ({selectedIds.size})
            </button>
          )}
          {((subTab === "signed" && isManager && selectedIds.size > 0) || (subTab === "result" && handoverTab === "today" && isManager && selectedIds.size > 0)) && (
            <button
              onClick={() => setShowHandoverModal(true)}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-bold shadow-md transition-all animate-pulse"
            >
              <FileCheck size={18} /> Đã giao 1 cửa ({selectedIds.size})
            </button>
          )}
          {(subTab === "draft" || subTab === "all") && isManager && (
            <>
              {selectedIds.size > 0 && (
                <>
                  <button
                    onClick={handleAssign}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-bold shadow-md transition-all"
                    title="Giao việc thủ công"
                  >
                    <Users size={18} /> Giao việc ({selectedIds.size})
                  </button>
                  <button
                    onClick={handleAutoAssign}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-indigo-700 font-bold shadow-md transition-all animate-pulse"
                    title="Tự động phân công theo địa bàn"
                  >
                    <MapPin size={18} /> Giao tự động ({selectedIds.size})
                  </button>
                </>
              )}
              <label className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-bold shadow-md transition-all cursor-pointer">
                <FileSpreadsheet size={18} /> Import Excel
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx, .xls"
                  onChange={handleImportExcel}
                />
              </label>
              <button
                onClick={handleAddNew}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-bold shadow-md transition-all"
              >
                <Plus size={18} /> Thêm mới
              </button>
            </>
          )}
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium shadow-sm transition-all"
          >
            <FileDown size={18} /> Xuất Bàn Giao
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-auto p-4 flex gap-6 bg-white relative">
        {/* Detail Modal */}
        <ArchiveDetailModal
          isOpen={!!detailRecord}
          onClose={() => setDetailRecord(null)}
          record={detailRecord}
          getEmployeeName={getEmployeeName}
          currentUser={currentUser}
        />

        {/* Handover List Modal */}
        <HandoverListModal
          isOpen={showHandoverModal}
          onClose={() => {
            setShowHandoverModal(false);
            setPendingCompletionRecord(null);
          }}
          onConfirm={handleConfirmHandover}
          type="saoluc"
          wards={wards}
        />

        {/* Return Result Modal */}
        <ReturnResultModal
          isOpen={isReturnModalOpen}
          onClose={() => {
            setIsReturnModalOpen(false);
            setReturnRecord(null);
          }}
          record={
            returnRecord
              ? ({
                  id: returnRecord.id,
                  code: returnRecord.so_hieu,
                  customerName: returnRecord.noi_nhan_gui || "",
                  receiptNumber: returnRecord.data?.receipt_number || "",
                  receiptType: returnRecord.data?.receipt_type || "receipt",
                  paymentAmount: returnRecord.data?.payment_amount || null,
                } as any)
              : null
          }
          onConfirm={handleConfirmReturnResult}
        />

        {/* Export Handover Modal */}
        <ExportHandoverModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          records={records}
          type="saoluc"
          wards={wards}
        />

        {/* Assign Modal */}
        <AssignModal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          onConfirm={handleConfirmAssign}
          employees={employees}
          selectedRecords={records
            .filter((r) => selectedIds.has(r.id))
            .map(
              (r) =>
                ({
                  id: r.id,
                  code: r.so_hieu,
                  customerName: r.noi_nhan_gui,
                  ward: r.data?.xa_phuong,
                  status: RecordStatus.RECEIVED,
                }) as RecordFile,
            )}
          currentUser={currentUser}
          filterDepartment="Lưu trữ"
        />

        {isFormOpen && (
          <div className="w-[350px] shrink-0 bg-white border border-gray-200 p-5 rounded-xl h-full flex flex-col shadow-sm animate-fade-in-up">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="font-bold text-gray-800 text-lg">
                {editingId ? "Cập nhật Sao Lục" : "Thêm mới Sao Lục"}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-gray-400 hover:text-red-500"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSave}
              className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar"
            >
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">
                  Mã hồ sơ <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-700"
                  value={formData.so_hieu}
                  onChange={(e) =>
                    setFormData({ ...formData, so_hieu: e.target.value })
                  }
                  placeholder="Số HS..."
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block flex items-center gap-1">
                  <UserIcon size={12} /> Chủ sử dụng{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.chu_su_dung}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      chu_su_dung: toTitleCase(e.target.value),
                    })
                  }
                  placeholder="Nguyễn Văn A..."
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block flex items-center gap-1">
                  <MapPin size={12} /> Vị trí đất
                </label>
                <div className="space-y-3">
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none"
                    value={formData.xa_phuong}
                    onChange={(e) =>
                      setFormData({ ...formData, xa_phuong: e.target.value })
                    }
                  >
                    {wards.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <div>
                      <input
                        className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm text-center outline-none"
                        value={formData.to_ban_do}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            to_ban_do: e.target.value,
                          })
                        }
                        placeholder="Tờ"
                      />
                    </div>
                    <div>
                      <input
                        className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm text-center outline-none"
                        value={formData.thua_dat}
                        onChange={(e) =>
                          setFormData({ ...formData, thua_dat: e.target.value })
                        }
                        placeholder="Thửa"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">
                    Ngày nhận
                  </label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none"
                    value={formData.ngay_nhan}
                    onChange={(e) =>
                      setFormData({ ...formData, ngay_nhan: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-purple-600 uppercase mb-1 block">
                    Hẹn trả
                  </label>
                  <input
                    type="date"
                    className="w-full border border-purple-200 bg-purple-50 rounded-lg px-3 py-2 text-sm outline-none text-purple-700 font-medium"
                    value={formData.hen_tra}
                    onChange={(e) =>
                      setFormData({ ...formData, hen_tra: e.target.value })
                    }
                  />
                </div>
              </div>

              {formData.status === "completed" && (
                <div className="space-y-3 bg-green-50 p-3 rounded-lg border border-green-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-green-700 uppercase mb-1 block">
                        Ngày giao
                      </label>
                      <input
                        type="date"
                        className="w-full border border-green-300 bg-white rounded-lg px-3 py-2 text-sm outline-none"
                        value={formData.ngay_hoan_thanh || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            ngay_hoan_thanh: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-green-700 uppercase mb-1 block">
                        Đợt giao
                      </label>
                      <input
                        type="text"
                        className="w-full border border-green-300 bg-white rounded-lg px-3 py-2 text-sm outline-none"
                        value={formData.danh_sach || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            danh_sach: e.target.value,
                          })
                        }
                        placeholder="VD: Đợt 1"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-green-700 uppercase mb-1 block">
                        Số biên lai/hoá đơn
                      </label>
                      <input
                        type="text"
                        className="w-full border border-green-300 bg-white rounded-lg px-3 py-2 text-sm outline-none font-mono"
                        value={formData.receipt_number || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData({
                            ...formData,
                            receipt_number: val,
                            payment_status: val.trim() ? "Đã thu" : formData.payment_status,
                          });
                        }}
                        placeholder="Số biên lai..."
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-green-700 uppercase mb-1 block">
                        Số tiền thu được (VNĐ)
                      </label>
                      <input
                        type="text"
                        className="w-full border border-green-300 bg-white rounded-lg px-3 py-2 text-sm font-mono font-bold outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                        value={formData.payment_amount !== null && formData.payment_amount !== undefined ? String(formData.payment_amount) : ""}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, "");
                          const amount = val ? parseInt(val, 10) : null;
                          setFormData({
                            ...formData,
                            payment_amount: amount,
                            payment_status: amount !== null && amount > 0 ? "Đã thu" : "Chưa thu",
                          });
                        }}
                        placeholder="Nhập số tiền..."
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-green-700 uppercase mb-1 block">
                      Ngày trả kết quả thực tế
                    </label>
                    <input
                      type="date"
                      className="w-full border border-green-300 bg-white rounded-lg px-3 py-2 text-sm outline-none"
                      value={formData.result_returned_date || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          result_returned_date: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">
                  Nội dung yêu cầu
                </label>
                <textarea
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  value={formData.noi_dung}
                  onChange={(e) =>
                    setFormData({ ...formData, noi_dung: e.target.value })
                  }
                  placeholder="Nhập nội dung..."
                />
              </div>

              <div className="pt-2 flex gap-2 justify-end border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 flex items-center gap-1 shadow-sm"
                >
                  <Save size={16} /> Lưu
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="flex-1 overflow-hidden bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-100 text-xs font-bold text-gray-600 uppercase sticky top-0 shadow-sm z-10">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={
                        filteredRecords.length > 0 &&
                        selectedIds.size === filteredRecords.length
                      }
                      disabled={!isAllowedToModify}
                    />
                  </th>
                  <th className="p-3 w-10 text-center">#</th>
                  <th className="p-3 w-32 text-center">Mã HS</th>
                  <th className="p-3 w-48 text-center">Chủ sử dụng</th>
                  <th className="p-3 w-32 text-center">Xã/Phường</th>
                  <th className="p-3 w-20 text-center">Tờ / Thửa</th>
                  <th className="p-3 w-24 text-center">Ngày nhận</th>
                  {subTab === "all" && (
                    <th className="p-3 w-32 text-center">Trạng thái</th>
                  )}
                  {subTab === "result" && (
                    <>
                      <th className="p-3 w-36 text-center text-blue-800 bg-blue-50/50">Biên Lai/Hóa Đơn</th>
                      <th className="p-3 w-32 text-center text-emerald-850 bg-emerald-50/30">Số tiền thực tế</th>
                      <th className="p-3 w-40 text-center text-green-800 bg-green-50/30">Trạng thái</th>
                    </>
                  )}
                  {subTab !== "draft" && (
                    <th className="p-3 w-48 text-center">Người thực hiện</th>
                  )}
                  <th className="p-3 w-24 text-center">Hẹn trả</th>
                  {subTab === "all" && (
                    <th className="p-3 w-32 text-center">Ngày giao</th>
                  )}
                  {subTab === "result" && (
                    <th className="p-3 w-32 text-center">Đợt bàn giao</th>
                  )}
                  <th className="p-3 w-64 text-center">Nội dung</th>
                  <th className="p-3 w-28 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-gray-100">
                {paginatedRecords.length > 0 ? (
                  paginatedRecords.map((r, idx) => (
                    <tr
                      key={r.id}
                      className={`hover:bg-blue-50/50 group ${selectedIds.has(r.id) ? "bg-blue-50" : ""}`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.id)}
                          onChange={() => handleSelectRow(r.id)}
                          disabled={!isAllowedToModify}
                        />
                      </td>
                      <td className="p-3 text-center text-gray-500">
                        {(currentPage - 1) * itemsPerPage + idx + 1}
                      </td>
                      <td
                        className="p-3 font-bold text-blue-600 cursor-pointer hover:underline text-center"
                        onClick={() => setDetailRecord(r)}
                      >
                        {r.so_hieu}
                      </td>
                      <td className="p-3 font-medium text-gray-800 text-center">
                        {toTitleCase(r.noi_nhan_gui)}
                      </td>
                      <td className="p-3 text-gray-600">
                        <div>{r.data?.xa_phuong}</div>
                        {r.data?.is_non_geographic && r.data?.handover_ward && (
                          <div className="text-[10px] text-purple-700 font-bold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 mt-1 inline-block whitespace-nowrap">
                            Giao phi địa giới: {r.data.handover_ward}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono text-xs">
                        {r.data?.to_ban_do || "-"} / {r.data?.thua_dat || "-"}
                      </td>
                       <td className="p-3 text-gray-600">
                        {formatDate(r.ngay_thang)}
                      </td>
                      {subTab === "all" && (
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${STATUS_COLORS[mapStatusToEnum(r.status)]}`}
                          >
                            {STATUS_LABELS[mapStatusToEnum(r.status)]}
                          </span>
                        </td>
                      )}
                      {subTab === "result" && (
                        <>
                          <td className="p-3 text-center font-medium">
                            {r.data?.receipt_number ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.data?.receipt_type === "invoice" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-emerald-50 text-emerald-705 border border-emerald-200"}`}>
                                  {r.data?.receipt_type === "invoice" ? "Hóa Đơn" : "Biên Lai"}
                                </span>
                                <span className="font-mono text-xs font-bold text-gray-700">{r.data.receipt_number}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic text-xs">---</span>
                            )}
                          </td>
                          <td className="p-3 text-center font-mono text-xs font-bold">
                            {r.data?.payment_amount != null ? (
                              <span className="text-emerald-700">
                                {Number(r.data.payment_amount).toLocaleString("vi-VN")} đ
                              </span>
                            ) : (
                              <span className="text-gray-400 italic">---</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex flex-col items-center gap-1.5">
                              {r.status === "signed" ? (
                                <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold border border-amber-200 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                                  Chờ giao 1 cửa
                                </span>
                              ) : r.data?.result_returned_date || r.data?.payment_status === "Đã thu" ? (
                                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold border border-emerald-200 flex items-center gap-1">
                                  ● Đã trả kết quả
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold border border-green-200 flex items-center gap-1">
                                  ● Đã giao 1 cửa
                                </span>
                              )}
                              
                              {r.data?.is_non_geographic && r.data?.handover_ward && (
                                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded border border-purple-200">
                                  📍 Phi địa giới: {r.data.handover_ward}
                                </div>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                      {subTab !== "draft" && (
                        <td className="p-3 text-indigo-600 font-medium">
                          {r.data?.assigned_to ? (
                            <div className="flex items-center gap-1">
                              <UserIcon size={14} />{" "}
                              {getEmployeeName(r.data?.assigned_to)}
                            </div>
                          ) : null}
                        </td>
                      )}
                      <td className="p-3 text-purple-600 font-medium">
                        {formatDate(r.data?.hen_tra)}
                      </td>
                      {subTab === "all" && (
                        <td className="p-3 text-center">
                          {r.data?.danh_sach && (
                            <div className="text-xs font-bold text-gray-700">
                              {r.data.danh_sach}
                            </div>
                          )}
                          <div className="text-gray-600 font-medium">
                            {formatDate(r.data?.ngay_hoan_thanh)}
                          </div>
                        </td>
                      )}
                      {subTab === "result" && (
                        <td className="p-3 text-center">
                          {r.data?.danh_sach && (
                            <div className="text-xs font-bold text-gray-700">
                              {r.data.danh_sach}
                            </div>
                          )}
                          <div className="text-gray-650 text-xs mt-0.5">
                            {formatDate(r.data?.ngay_hoan_thanh)}
                          </div>
                        </td>
                      )}
                      <td className="p-3 text-gray-500 italic truncate max-w-xs">
                        {r.trich_yeu}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setDetailRecord(r)}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                            title="Xem chi tiết"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => handlePrintRecord(r)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="Xem và In phiếu"
                          >
                            <Printer size={14} />
                          </button>
                          {r.status === "draft" && isManager && (
                            <button
                              onClick={() => {
                                setSelectedIds(new Set([r.id]));
                                setShowAssignModal(true);
                              }}
                              className="p-1.5 text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100"
                              title="Giao việc"
                            >
                              <Users size={14} />
                            </button>
                          )}

                          {r.status === "assigned" && isManager && (
                            <>
                              <button
                                onClick={() => handleStatusChange(r, "draft")}
                                className="p-1.5 text-orange-600 bg-orange-50 rounded hover:bg-orange-100"
                                title="Thu hồi"
                              >
                                <RotateCcw size={14} />
                              </button>
                              <button
                                onClick={() =>
                                  handleStatusChange(r, "executed")
                                }
                                className="p-1.5 text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
                                title="Đã thực hiện"
                              >
                                <CheckCircle size={14} />
                              </button>
                            </>
                          )}

                          {r.status === "executed" && isManager && (
                            <>
                              <button
                                onClick={() =>
                                  handleStatusChange(r, "assigned")
                                }
                                className="p-1.5 text-orange-600 bg-orange-50 rounded hover:bg-orange-100"
                                title="Quay lại"
                              >
                                <RotateCcw size={14} />
                              </button>
                              <button
                                onClick={() =>
                                  handleStatusChange(r, "pending_sign")
                                }
                                className="p-1.5 text-purple-600 bg-purple-50 rounded hover:bg-purple-100"
                                title="Trình ký"
                              >
                                <Send size={14} />
                              </button>
                            </>
                          )}

                          {r.status === "pending_sign" && isManager && (
                            <>
                              <button
                                onClick={() =>
                                  handleStatusChange(r, "executed")
                                }
                                className="p-1.5 text-orange-600 bg-orange-50 rounded hover:bg-orange-100"
                                title="Trả lại"
                              >
                                <RotateCcw size={14} />
                              </button>
                              <button
                                onClick={() => handleStatusChange(r, "signed")}
                                className="p-1.5 text-teal-600 bg-teal-50 rounded hover:bg-teal-100"
                                title="Ký duyệt"
                              >
                                <PenTool size={14} />
                              </button>
                            </>
                          )}

                          {r.status === "signed" && isManager && (
                            <>
                              <button
                                onClick={() =>
                                  handleStatusChange(r, "pending_sign")
                                }
                                className="p-1.5 text-orange-600 bg-orange-50 rounded hover:bg-orange-100"
                                title="Trả lại"
                              >
                                <RotateCcw size={14} />
                              </button>
                              <button
                                onClick={() =>
                                  handleStatusChange(r, "completed")
                                }
                                className="p-1.5 text-green-600 bg-green-50 rounded hover:bg-green-100"
                                title="Đã giao 1 cửa"
                              >
                                <FileCheck size={14} />
                              </button>
                            </>
                          )}

                          {r.status === "completed" && isManager && !r.data?.result_returned_date && (
                            <button
                              onClick={() => {
                                setReturnRecord(r);
                                setIsReturnModalOpen(true);
                              }}
                              className="p-1.5 text-emerald-600 bg-emerald-50 rounded hover:bg-emerald-100"
                              title="Trả kết quả"
                            >
                              <FileCheck size={14} />
                            </button>
                          )}

                          {isManager && (
                            <>
                              <button
                                onClick={() => handleEdit(r)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                title="Sửa"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(r.id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                title="Xóa"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={subTab !== "draft" ? 12 : 11}
                      className="p-8 text-center text-gray-400 italic"
                    >
                      Không có dữ liệu
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-gray-200 flex items-center justify-between bg-gray-50 shrink-0">
              <span className="text-xs text-gray-500 font-medium">
                Hiển thị {(currentPage - 1) * itemsPerPage + 1} -{" "}
                {Math.min(currentPage * itemsPerPage, filteredRecords.length)} /{" "}
                {filteredRecords.length} hồ sơ
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 rounded border border-gray-300 bg-white text-xs disabled:opacity-50 hover:bg-gray-100"
                >
                  Trước
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p = i + 1;
                  if (totalPages > 5) {
                    if (currentPage > 3) p = currentPage - 2 + i;
                    if (p > totalPages) p = totalPages - (4 - i);
                    // Adjust if p < 1
                    if (p < 1) p = i + 1;
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`px-2 py-1 rounded border text-xs font-medium min-w-[24px] ${currentPage === p ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 bg-white hover:bg-gray-100 text-gray-600"}`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 rounded border border-gray-300 bg-white text-xs disabled:opacity-50 hover:bg-gray-100"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SaoLucView;

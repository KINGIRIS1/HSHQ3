import React, { useState, useEffect } from "react";
import { X, ListPlus, List, MapPin } from "lucide-react";
import { fetchListsByDate } from "../../services/apiArchive";

interface HandoverListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    listName: string,
    handoverDate: string,
    receiptNumber: string,
    paymentStatus: "Chưa thu" | "Đã thu",
    resultReturnedDate: string,
    isNonGeographic: boolean,
    handoverWard: string,
    receiptType: "receipt" | "invoice",
    paymentAmount: number | null,
  ) => void;
  type: "saoluc" | "congvan";
  wards?: string[];
}

const HandoverListModal: React.FC<HandoverListModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  type,
  wards = ["Tân Quan", "Tân Khai", "Minh Đức", "Tân Hưng"],
}) => {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [existingLists, setExistingLists] = useState<string[]>([]);
  const [newListName, setNewListName] = useState("");
  const [selectedList, setSelectedList] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [receiptNumber, setReceiptNumber] = useState("");
  const [receiptType, setReceiptType] = useState<"receipt" | "invoice">("receipt");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"Chưa thu" | "Đã thu">(
    "Chưa thu",
  );
  const [resultReturnedDate, setResultReturnedDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  // Giao phi địa giới state
  const [isNonGeographic, setIsNonGeographic] = useState(false);
  const [selectedHandoverWard, setSelectedHandoverWard] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadLists(selectedDate);
      setReceiptNumber("");
      setReceiptType("receipt");
      setPaymentAmount("");
      setPaymentStatus("Chưa thu");
      setResultReturnedDate(new Date().toISOString().split("T")[0]);
      setIsNonGeographic(false);
      setSelectedHandoverWard("");
    }
  }, [isOpen, selectedDate]);

  const loadLists = async (date: string) => {
    const lists = await fetchListsByDate(type, date);
    setExistingLists(lists);

    // Auto-generate next list name
    let maxBatch = 0;
    lists.forEach((l) => {
      const match = l.match(/Đợt (\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxBatch) maxBatch = num;
      }
    });
    setNewListName(`Đợt ${maxBatch + 1}`);

    // Default selection logic
    if (lists.length > 0) {
      setSelectedList(lists[lists.length - 1]); // Default to latest existing
      setMode("existing"); // Default to existing if available
    } else {
      setMode("new");
    }
  };

  const handleConfirm = () => {
    if (mode === "new") {
      if (!newListName.trim()) {
        alert("Vui lòng nhập tên danh sách mới");
        return;
      }
    } else {
      if (!selectedList) {
        alert("Vui lòng chọn danh sách");
        return;
      }
    }

    if (isNonGeographic && !selectedHandoverWard) {
      alert("Vui lòng chọn địa bàn bàn giao phi địa giới");
      return;
    }

    onConfirm(
      mode === "new" ? newListName.trim() : selectedList,
      selectedDate,
      receiptNumber,
      paymentStatus,
      resultReturnedDate,
      isNonGeographic,
      isNonGeographic ? selectedHandoverWard : "",
      receiptType,
      paymentAmount ? parseInt(paymentAmount, 10) : null,
    );
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl w-[450px] overflow-hidden animate-scale-in">
        <div className="bg-blue-600 p-4 flex justify-between items-center text-white">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <ListPlus size={20} /> Tạo danh sách bàn giao
          </h3>
          <button
            onClick={onClose}
            className="hover:bg-blue-700 p-1 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 mb-2">
            Hồ sơ đã hoàn thành. Vui lòng chọn ngày và danh sách bàn giao.
          </p>

          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-1 font-sans">
              Ngày giao
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="flex gap-4 mb-4">
            <label
              className={`flex-1 border rounded-lg p-3 cursor-pointer transition-all ${mode === "new" ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "border-gray-200 hover:bg-gray-50"}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="radio"
                  name="listMode"
                  checked={mode === "new"}
                  onChange={() => setMode("new")}
                  className="accent-blue-600"
                />
                <span className="font-bold text-gray-800 text-sm">Tạo mới</span>
              </div>
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                disabled={mode !== "new"}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white disabled:bg-gray-100"
                placeholder="Ví dụ: Đợt 1"
              />
            </label>

            <label
              className={`flex-1 border rounded-lg p-3 cursor-pointer transition-all ${mode === "existing" ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "border-gray-200 hover:bg-gray-50"}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="radio"
                  name="listMode"
                  checked={mode === "existing"}
                  onChange={() => setMode("existing")}
                  className="accent-blue-600"
                  disabled={existingLists.length === 0}
                />
                <span
                  className={`font-bold text-sm ${existingLists.length === 0 ? "text-gray-400" : "text-gray-800"}`}
                >
                  Chọn cũ
                </span>
              </div>
              <select
                value={selectedList}
                onChange={(e) => setSelectedList(e.target.value)}
                disabled={mode !== "existing" || existingLists.length === 0}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white disabled:bg-gray-100 outline-none"
              >
                {existingLists.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-4">
            <h4 className="text-sm font-bold text-gray-800 flex items-center gap-1">
              <span className="w-1.5 h-3 bg-blue-600 rounded"></span>
              Thông tin thanh toán & trả kết quả cho dân
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-gray-700">
                    Số {receiptType === "receipt" ? "biên lai" : "hoá đơn"}
                  </label>
                  <div className="flex bg-gray-100 rounded p-0.5 border border-gray-200 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setReceiptType("receipt")}
                      className={`px-1 py-0.5 font-bold rounded transition-all ${receiptType === "receipt" ? "bg-white text-blue-700 shadow-xs" : "text-gray-500"}`}
                    >
                      BL
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceiptType("invoice")}
                      className={`px-1 py-0.5 font-bold rounded transition-all ${receiptType === "invoice" ? "bg-white text-blue-700 shadow-xs" : "text-gray-500"}`}
                    >
                      HĐ
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={receiptNumber}
                  onChange={(e) => {
                    const val = e.target.value;
                    setReceiptNumber(val);
                    if (val.trim()) {
                      setPaymentStatus("Đã thu");
                    }
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  placeholder={receiptType === "receipt" ? "Nhập số biên lai..." : "Nhập số hóa đơn..."}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1" style={{ marginTop: "18px" }}>
                  Thu tiền
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) =>
                    setPaymentStatus(e.target.value as "Chưa thu" | "Đã thu")
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 bg-white outline-none"
                >
                  <option value="Chưa thu">Chưa thu tiền</option>
                  <option value="Đã thu">Đã thu tiền</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                💰 Số tiền thu thực tế (VNĐ)
              </label>
              <input
                type="text"
                value={paymentAmount}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setPaymentAmount(val);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                placeholder="Nhập số tiền..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Ngày trả kết quả thực tế
              </label>
              <input
                type="date"
                value={resultReturnedDate}
                onChange={(e) => setResultReturnedDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Giao phi địa giới */}
            <div className="border-t pt-3 mt-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-purple-600 focus:ring-purple-500 rounded"
                  checked={isNonGeographic}
                  onChange={(e) => setIsNonGeographic(e.target.checked)}
                />
                <span className="text-xs font-bold text-purple-700 flex items-center gap-1">
                  <MapPin size={12} /> Giao phi địa giới (Giao khác địa bàn)
                </span>
              </label>

              {isNonGeographic && (
                <div className="mt-2 pl-6">
                  <label className="block text-[10px] text-gray-500 mb-1">
                    Chọn địa bàn bàn giao kết quả:
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-purple-500 outline-none bg-white font-medium"
                    value={selectedHandoverWard}
                    onChange={(e) => setSelectedHandoverWard(e.target.value)}
                  >
                    <option value="">-- Chọn xã/phường --</option>
                    {wards.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
            >
              Hủy
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 shadow-sm flex items-center gap-2"
            >
              <List size={16} /> Xác nhận
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HandoverListModal;

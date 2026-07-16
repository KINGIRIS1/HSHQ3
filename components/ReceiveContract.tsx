
import React, { useState, useEffect } from 'react';
import { RecordFile, Contract, PriceItem, SplitItem, User, Employee } from '../types';
import { fetchPriceList, deleteContractApi, updateContractApi, createContractApi, fetchContracts } from '../services/api';
import { FileSignature, LayoutList, Settings, Settings2, FileCheck, FileText, ClipboardList, BookOpen, WifiOff, HelpCircle } from 'lucide-react';
import PriceConfigModal from './PriceConfigModal';
import { generateDocxBlobAsync, hasTemplate, STORAGE_KEYS } from '../services/docxService';
import TemplateConfigModal from './TemplateConfigModal';
import DocxPreviewModal from './DocxPreviewModal';
import { confirmAction, removeVietnameseTones } from '../utils/appHelpers';
import saveAs from 'file-saver'; // Import saveAs
import { ContractNumberingBookModal } from './ContractNumberingBookModal';
import { getContractNumberingConfig, saveContractNumberingConfig, peekNextContractCode } from '../utils/contractNumbering';
import { saveToCache, CACHE_KEYS } from '../services/apiCore';
import { addToOfflineQueue } from '../utils/offlineSync';

// Child Components
import ContractForm from './receive-contract/ContractForm';
import ContractList from './receive-contract/ContractList';
import SystemAnnexTemplate from './receive-record/SystemAnnexTemplate';

interface ReceiveContractProps {
  onSave: (record: RecordFile) => Promise<RecordFile | null>; 
  wards: string[];
  currentUser: User;
  employees: Employee[];
  records: RecordFile[]; 
  // New props for handling external liquidation request
  recordToLiquidate: RecordFile | null;
  onClearRecordToLiquidate: () => void;
  recordToContract: RecordFile | null;
  onClearRecordToContract: () => void;
}

// --- HÀM ĐỌC SỐ TIỀN ---
const docSo3ChuSo = (baso: number): string => {
    const docSo = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
    let tram = Math.floor(baso / 100);
    let chuc = Math.floor((baso % 100) / 10);
    let donvi = baso % 10;
    let ketQua = "";
    if (tram === 0 && chuc === 0 && donvi === 0) return "";
    if (tram !== 0) { ketQua += docSo[tram] + " trăm "; if ((chuc === 0) && (donvi !== 0)) ketQua += "linh "; }
    if ((chuc !== 0) && (chuc !== 1)) { ketQua += docSo[chuc] + " mươi"; if ((chuc === 0) && (donvi !== 0)) ketQua = ketQua + " linh "; }
    if (chuc === 1) ketQua += "mười";
    switch (donvi) {
        case 1: if ((chuc !== 0) && (chuc !== 1)) ketQua += " mốt"; else ketQua += " một"; break;
        case 5: if (chuc === 0) ketQua += " năm"; else ketQua += " lăm"; break;
        default: if (donvi !== 0) ketQua += " " + docSo[donvi]; break;
    }
    return ketQua;
}
const docTienBangChu = (soTien: number): string => {
    if (soTien === 0) return "Không đồng";
    const tien = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
    let lan = 0; let i = 0; let so = soTien; let ketQua = ""; let viTri: number[] = [];
    if (so < 0) return "Số tiền âm";
    while (so > 0) { viTri[lan] = so % 1000; so = Math.floor(so / 1000); lan++; }
    for (i = lan - 1; i >= 0; i--) { let tmp = docSo3ChuSo(viTri[i]); if (tmp !== "") { ketQua += tmp; ketQua += " " + tien[i] + " "; } }
    ketQua = ketQua.replace(/\s+/g, ' ').trim();
    ketQua = ketQua.charAt(0).toUpperCase() + ketQua.slice(1);
    return ketQua + " đồng";
}

function _nd(s: string): string {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

const ReceiveContract: React.FC<ReceiveContractProps> = ({ wards, currentUser, employees, records, recordToLiquidate, onClearRecordToLiquidate, recordToContract, onClearRecordToContract }) => {
  // Thay đổi: activeModule giờ bao gồm cả 'list', 'liquidation_list' và 'annex_list'
  const [activeModule, setActiveModule] = useState<'contract' | 'liquidation' | 'list' | 'liquidation_list' | 'annex_list'>('list'); 
  const [priceList, setPriceList] = useState<PriceItem[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]); // Move contracts state up to handle logic

  // Phụ lục States
  const [isAnnexModalOpen, setIsAnnexModalOpen] = useState(false);
  const [annexTargetRecord, setAnnexTargetRecord] = useState<RecordFile | null>(null);
  const [annexTargetContract, setAnnexTargetContract] = useState<Contract | null>(null);

  const handleDraftAnnex = (contract: Contract) => {
      const matchingRecord = records.find(r => r.code === contract.recordCode || r.code === contract.code);
      if (matchingRecord) {
          setAnnexTargetRecord(matchingRecord);
      } else {
          const virtualRecord: Partial<RecordFile> = {
              id: contract.id,
              code: contract.recordCode || contract.code,
              customerName: contract.customerName,
              phoneNumber: contract.phoneNumber,
              address: contract.address || contract.customerAddress,
              ward: contract.ward,
              landPlot: contract.landPlot,
              mapSheet: contract.mapSheet,
              area: contract.area
          };
          setAnnexTargetRecord(virtualRecord as RecordFile);
      }
      setAnnexTargetContract(contract);
      setIsAnnexModalOpen(true);
  };

  const handleSaveAnnexStatus = async () => {
      if (!annexTargetContract) return;
      const updatedContract: Contract = {
          ...annexTargetContract,
          hasAnnex: true,
          annexDate: new Date().toISOString()
      };
      const success = await handleSaveContract(updatedContract, true);
      if (success) {
          loadContracts();
      }
  };

  const handleCancelAnnex = async (contract: Contract) => {
      const updatedContract: Contract = {
          ...contract,
          hasAnnex: false,
          annexDate: undefined
      };
      const success = await handleSaveContract(updatedContract, true);
      if (success) {
          loadContracts();
      }
  };
  
  // Modal States
  const [isPriceConfigOpen, setIsPriceConfigOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isNumberingModalOpen, setIsNumberingModalOpen] = useState(false);
  
  // Không dùng Modal Preview nữa, nhưng vẫn giữ state để tránh lỗi biên dịch nếu cần
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [editingContract, setEditingContract] = useState<Contract | undefined>(undefined);
  const [nextCodeProposal, setNextCodeProposal] = useState<string>('');

  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isNetworkGuideOpen, setIsNetworkGuideOpen] = useState<boolean>(false);

  useEffect(() => {
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
      };
  }, []);

  useEffect(() => { 
      loadPrices(); 
      loadContracts();
      loadNextCodeProposal();
  }, []);

  const loadPrices = async () => { const prices = await fetchPriceList(); setPriceList(prices); };
  const loadContracts = async () => { const data = await fetchContracts(); setContracts(data); };
  const loadNextCodeProposal = async () => {
      const cfg = await getContractNumberingConfig();
      const { code } = peekNextContractCode(cfg);
      setNextCodeProposal(code);
  };

  // --- LOGIC XỬ LÝ KHI CÓ YÊU CẦU LẬP HỢP ĐỒNG TỪ BÊN NGOÀI ---
  useEffect(() => {
      if (recordToContract && contracts.length > 0) {
          const normalize = (s: string) => String(s || '').trim().toLowerCase();
          const recCode = normalize(recordToContract.code);
          
          const existingContract = contracts.find(c => {
              const cRecordCode = normalize(c.recordCode || '');
              const cCode = normalize(c.code || '');
              return (cRecordCode === recCode || cCode === recCode);
          });

          if (existingContract) {
              setEditingContract({
                  ...existingContract,
                  status: 'PENDING'
              });
          } else {
              let areaType = '';
              const w = (recordToContract.ward || '').toLowerCase();
              if (w.includes('phường') || w.includes('tt.') || w.includes('thị trấn') || w.includes('minh hưng') || w.includes('chơn thành')) {
                  areaType = 'Đất đô thị';
              } else {
                  areaType = 'Đất nông thôn';
              }

              const recType = (recordToContract.recordType || '').toLowerCase();
              let serviceType = '';
              let contractType: 'Đo đạc' | 'Tách thửa' | 'Cắm mốc' | 'Trích lục' = 'Đo đạc';

              if (recType.includes('trích lục')) {
                  contractType = 'Trích lục';
                  const match = priceList.find(p => p.serviceName.toLowerCase().includes('trích lục'));
                  serviceType = match ? match.serviceName : 'Trích lục bản đồ địa chính';
              } else if (recType.includes('cắm mốc')) {
                  contractType = 'Cắm mốc';
                  const match = priceList.find(p => p.serviceName.toLowerCase().includes('cắm mốc'));
                  serviceType = match ? match.serviceName : 'Cắm mốc ranh giới';
              } else if (recType.includes('tách thửa') || recType.includes('tách - hợp thửa')) {
                  contractType = 'Tách thửa';
                  serviceType = 'Đo đạc tách thửa';
              } else {
                  const area = recordToContract.area || 0;
                  const match = priceList.find(p => 
                      p.serviceName.toLowerCase().includes('đo đạc') && 
                      area >= p.minArea && area < p.maxArea
                  );
                  serviceType = match ? match.serviceName : 'Đo đạc hiện trạng';
              }

              const newContract: Contract = {
                  id: Math.random().toString(36).substr(2, 9),
                  code: generateContractCode(),
                  recordCode: recordToContract.code,
                  customerName: recordToContract.customerName,
                  phoneNumber: recordToContract.phoneNumber,
                  address: recordToContract.address,
                  ward: recordToContract.ward,
                  landPlot: recordToContract.landPlot,
                  mapSheet: recordToContract.mapSheet,
                  area: recordToContract.area || 0,
                  
                  contractType: contractType,
                  serviceType: serviceType, 
                  areaType: areaType,       
                  
                  plotCount: 1,
                  markerCount: 1,
                  quantity: 1, 
                  unitPrice: 0, 
                  vatRate: 8, 
                  vatAmount: 0, 
                  totalAmount: 0, 
                  deposit: 0,
                  createdDate: new Date().toISOString(),
                  status: 'PENDING'
              };
              setEditingContract(newContract);
          }
          
          setActiveModule('contract');
          onClearRecordToContract();
      }
  }, [recordToContract, contracts, priceList]);

  // --- LOGIC XỬ LÝ KHI CÓ YÊU CẦU THANH LÝ TỪ BÊN NGOÀI ---
  useEffect(() => {
      // Quan trọng: Chỉ chạy logic khi recordToLiquidate có giá trị VÀ danh sách contracts ĐÃ ĐƯỢC TẢI
      if (recordToLiquidate && contracts.length > 0) {
          
          const normalize = (s: string) => String(s || '').trim().toLowerCase();
          const recCode = normalize(recordToLiquidate.code);
          
          // 1. Tìm xem hồ sơ này đã có hợp đồng chưa (Ưu tiên c.recordCode, dự phòng c.code)
          const existingContract = contracts.find(c => {
              const cRecordCode = normalize(c.recordCode || '');
              const cCode = normalize(c.code || '');
              return (cRecordCode === recCode || cCode === recCode);
          });

          if (existingContract) {
              // NẾU CÓ HỢP ĐỒNG: Load toàn bộ dữ liệu hợp đồng đó (bao gồm splitItems, serviceType...)
              setEditingContract({
                  ...existingContract,
                  // Cập nhật lại diện tích thanh lý mới nhất từ hồ sơ (diện tích thực tế sau khi đo)
                  // Ưu tiên: recordToLiquidate.area > liquidationArea cũ > area hợp đồng
                  liquidationArea: recordToLiquidate.area || existingContract.liquidationArea || existingContract.area,
                  // Đảm bảo trạng thái hiển thị đúng để form hiển thị nút
                  status: 'PENDING'
              });
          } else {
              // NẾU CHƯA CÓ HỢP ĐỒNG: Tạo Contract ảo từ Record (AUTO MAP THÔNG MINH)
              
              // 1. Detect Area Type (Khu vực)
              let areaType = '';
              const w = (recordToLiquidate.ward || '').toLowerCase();
              if (w.includes('phường') || w.includes('tt.') || w.includes('thị trấn') || w.includes('minh hưng') || w.includes('chơn thành')) {
                  areaType = 'Đất đô thị';
              } else {
                  areaType = 'Đất nông thôn';
              }

              // 2. Detect Contract & Service Type (Loại dịch vụ)
              const recType = (recordToLiquidate.recordType || '').toLowerCase();
              let serviceType = '';
              let contractType: 'Đo đạc' | 'Tách thửa' | 'Cắm mốc' | 'Trích lục' = 'Đo đạc';

              if (recType.includes('trích lục')) {
                  contractType = 'Trích lục';
                  // Cố gắng map chính xác tên dịch vụ trong bảng giá
                  const match = priceList.find(p => p.serviceName.toLowerCase().includes('trích lục'));
                  serviceType = match ? match.serviceName : 'Trích lục bản đồ địa chính';
              } else if (recType.includes('cắm mốc')) {
                  contractType = 'Cắm mốc';
                  const match = priceList.find(p => p.serviceName.toLowerCase().includes('cắm mốc'));
                  serviceType = match ? match.serviceName : 'Cắm mốc ranh giới';
              } else if (recType.includes('tách thửa')) {
                  contractType = 'Tách thửa';
                  serviceType = 'Đo đạc tách thửa';
              } else if (recType.includes('đo đạc')) {
                  // Map theo diện tích
                  const area = recordToLiquidate.area || 0;
                  const match = priceList.find(p => 
                      p.serviceName.toLowerCase().includes('đo đạc') && 
                      area >= p.minArea && area < p.maxArea
                  );
                  serviceType = match ? match.serviceName : 'Đo đạc hiện trạng';
              }

              const newContract: Contract = {
                  id: Math.random().toString(36).substr(2, 9),
                  code: generateContractCode(),
                  recordCode: recordToLiquidate.code,
                  customerName: recordToLiquidate.customerName,
                  phoneNumber: recordToLiquidate.phoneNumber,
                  address: recordToLiquidate.address,
                  ward: recordToLiquidate.ward,
                  landPlot: recordToLiquidate.landPlot,
                  mapSheet: recordToLiquidate.mapSheet,
                  area: recordToLiquidate.area || 0,
                  
                  // Các trường quan trọng cần điền tự động
                  contractType: contractType,
                  serviceType: serviceType, 
                  areaType: areaType,       
                  
                  plotCount: 1,
                  markerCount: 1,
                  quantity: 1, 
                  unitPrice: 0, // Form sẽ tự tính lại dựa trên serviceType
                  vatRate: 8, 
                  vatAmount: 0, 
                  totalAmount: 0, 
                  deposit: 0,
                  createdDate: new Date().toISOString(),
                  status: 'PENDING',
                  liquidationArea: recordToLiquidate.area || 0
              };
              setEditingContract(newContract);
          }
          
          setActiveModule('liquidation');
          onClearRecordToLiquidate(); // Reset flag
      }
  }, [recordToLiquidate, contracts, priceList]);

  const generateContractCode = () => {
    return nextCodeProposal || `HĐ-${new Date().getFullYear()}-TEMP`;
  };

  const handleEdit = (c: Contract) => { 
      setEditingContract(c); 
      setActiveModule('contract'); // Chuyển sang tab Lập HĐ để sửa
  };

  // Logic mới: Tạo thanh lý từ Hợp đồng có sẵn (trong danh sách HĐ)
  const handleCreateLiquidation = (c: Contract) => {
      setEditingContract(c); // Đưa dữ liệu hợp đồng vào form
      setActiveModule('liquidation'); // Chuyển sang tab Thanh lý
  };

  const handleDelete = async (id: string) => { 
      if(await confirmAction("Bạn có chắc chắn muốn xóa hợp đồng này không?")) {
          const target = contracts.find(c => c.id === id);
          const success = await deleteContractApi(id);
          if (success) {
              loadContracts(); // Reload list
              loadNextCodeProposal(); // Refresh sequential counter
          } else {
              const updated = contracts.filter(c => c.id !== id);
              setContracts(updated);
              saveToCache(CACHE_KEYS.CONTRACTS, updated);
              addToOfflineQueue('delete_contract', { id }, `Xóa hợp đồng: ${target?.code || id}`);
              loadNextCodeProposal();
          }
      } 
  }; 

  const handleSaveContract = async (contract: Contract, isUpdate: boolean): Promise<boolean> => {
      let success = false;
      if (isUpdate) {
          success = await updateContractApi(contract);
          if (success) {
              loadContracts(); // Reload list
          } else {
              const updated = contracts.map(c => c.id === contract.id ? contract : c);
              setContracts(updated);
              saveToCache(CACHE_KEYS.CONTRACTS, updated);
              addToOfflineQueue('update_contract', contract, `Cập nhật hợp đồng ngoại tuyến: ${contract.code || contract.customerName}`);
              success = true;
          }
      } else {
          // If the user is saving a new contract:
          // Check if they used the automatically proposed format, or let them override it.
          // Allocate officially from logbook!
          let finalCode = contract.code;
          const config = await getContractNumberingConfig();
          const { code, nextNum, nextYear } = peekNextContractCode(config);
          
          if (!contract.code || contract.code === nextCodeProposal || contract.code.includes('-TEMP') || contract.code.trim() === '') {
              finalCode = code;
              config.currentNumber = nextNum;
              config.year = nextYear;
              await saveContractNumberingConfig(config);
          }
          
          const contractWithFinalCode = { ...contract, code: finalCode };
          success = await createContractApi(contractWithFinalCode);
          if (success) {
              loadNextCodeProposal();
              loadContracts(); // Reload list
          } else {
              const offlineContract = {
                  ...contractWithFinalCode,
                  id: contractWithFinalCode.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11))
              };
              const updated = [offlineContract, ...contracts];
              setContracts(updated);
              saveToCache(CACHE_KEYS.CONTRACTS, updated);
              addToOfflineQueue('create_contract', offlineContract, `Tạo hợp đồng ngoại tuyến: ${offlineContract.code} (${offlineContract.customerName})`);
              loadNextCodeProposal();
              success = true;
          }
      }
      return success;
  };

  const handleQuickAllocate = async (skeletonContract: Contract): Promise<boolean> => {
      const success = await createContractApi(skeletonContract);
      if (success) {
          loadContracts();
          loadNextCodeProposal();
      } else {
          const offlineContract = {
              ...skeletonContract,
              id: skeletonContract.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11))
          };
          const updated = [offlineContract, ...contracts];
          setContracts(updated);
          saveToCache(CACHE_KEYS.CONTRACTS, updated);
          addToOfflineQueue('create_contract', offlineContract, `Cấp số nhanh hợp đồng ngoại tuyến: ${offlineContract.code}`);
          loadNextCodeProposal();
      }
      return true;
  };

  // --- LOGIC IN ẤN (TẢI VỀ & MỞ) ---
  const handlePreviewDocx = async (dataToPrint: Partial<Contract> | undefined, printType: 'contract' | 'liquidation') => {
      if (!dataToPrint || !dataToPrint.customerName) { alert("Vui lòng nhập Tên khách hàng để in."); return; }
      
      let templateKey = '', typeName = '';
      const isCamMoc = dataToPrint.contractType === 'Cắm mốc';
      const isTrichLuc = dataToPrint.contractType === 'Trích lục';
      
      if (printType === 'liquidation') {
          if (isTrichLuc) {
              templateKey = STORAGE_KEYS.CONTRACT_TEMPLATE_LIQ_TRICHLUC;
              typeName = "Thanh lý Hợp đồng Trích lục";
          } else {
              templateKey = isCamMoc ? STORAGE_KEYS.CONTRACT_TEMPLATE_LIQ_CAMMOC : STORAGE_KEYS.CONTRACT_TEMPLATE_LIQ_DODAC;
              typeName = isCamMoc ? "Thanh lý Hợp đồng Cắm mốc" : "Thanh lý Hợp đồng Đo đạc";
          }
      } else {
          // Hợp đồng
          templateKey = isCamMoc ? STORAGE_KEYS.CONTRACT_TEMPLATE_CAMMOC : STORAGE_KEYS.CONTRACT_TEMPLATE_DODAC;
          typeName = isCamMoc ? "Hợp đồng Cắm mốc" : "Hợp đồng Đo đạc";
          
          if (isTrichLuc) typeName = "Hợp đồng Trích lục";
      }
      
      if (!hasTemplate(templateKey)) { 
          if(await confirmAction(`Chưa có mẫu "${typeName}". Bạn có muốn cấu hình ngay không?`)) setIsTemplateModalOpen(true); 
          return; 
      }
      
      setIsProcessing(true);
      
      // XỬ LÝ NGÀY THÁNG
      const currentFormDate = dataToPrint.createdDate ? new Date(dataToPrint.createdDate) : new Date();
      let originalContractDate = currentFormDate; 
      
      if (printType === 'liquidation') {
          // Nếu đang in thanh lý, tìm ngày hợp đồng gốc
          const originalContract = contracts.find(c => c.code === dataToPrint.code);
          if (originalContract && originalContract.createdDate) {
              originalContractDate = new Date(originalContract.createdDate);
          }
      }

      const fmt = (d: Date) => ({
          day: d.getDate().toString().padStart(2, '0'),
          month: (d.getMonth() + 1).toString().padStart(2, '0'),
          year: d.getFullYear(),
          full: d.toLocaleDateString('vi-VN')
      });

      const dateHD = fmt(originalContractDate);
      const dateTL = fmt(currentFormDate); 

      // --- MAPPING DATA ---
      const amountToPrint = printType === 'liquidation' ? (dataToPrint.liquidationAmount || 0) : (dataToPrint.totalAmount || 0);
      
      const moneyText = docTienBangChu(amountToPrint);
      const val = (v: any) => (v === undefined || v === null) ? "" : String(v);
      const money = (v: any) => (v === undefined || v === null) ? "0" : Number(v).toLocaleString('vi-VN');
      
      const rawWard = val(dataToPrint.ward);
      const normWard = _nd(rawWard);
      
      let unitPrefix = 'Xã/Phường';
      if (normWard.includes('nha bich')) unitPrefix = 'Xã';
      else if (normWard.includes('minh hung') || normWard.includes('chon thanh') || normWard.includes('hung long') || normWard.includes('thanh tam')) unitPrefix = 'Phường';

      let signerName = 'PHẠM VĂN NAM'; 
      let signerPosition = 'PHÓ GIÁM ĐỐC';
      
      if (normWard.includes('nha bich')) {
          signerName = 'LƯƠNG NGỌC DINH';
          signerPosition = 'GIÁM ĐỐC';
      } else if (normWard.includes('minh hung')) {
          signerName = 'TRỊNH QUANG HƯNG';
          signerPosition = 'PHÓ GIÁM ĐỐC';
      }

      let sdtLienHe = ""; 
      if (normWard.includes("minh hung")) {
          sdtLienHe = "Nhân viên phụ trách Nguyễn Thìn Trung: 0886 385 757";
      } else if (normWard.includes("nha bich")) {
          sdtLienHe = "Nhân viên phụ trách Lê Văn Hạnh: 0919 334 344";
      } else if (normWard.includes("chon thanh")) {
          sdtLienHe = "Nhân viên phụ trách Phạm Hoài Sơn: 0972 219 691";
      }

      const detailAddress = val(dataToPrint.address);
      const fullLandAddress = detailAddress ? `${detailAddress}, ${unitPrefix} ${rawWard}` : `${unitPrefix} ${rawWard}`;
      const qty = dataToPrint.contractType === 'Cắm mốc' ? (dataToPrint.markerCount || 0) : (dataToPrint.plotCount || 0);
      
      let preTaxAmount = 0;
      const vatRate = dataToPrint.vatRate || 0;
      
      if (printType === 'liquidation') {
          preTaxAmount = Math.round(amountToPrint / (1 + vatRate/100));
      } else {
          preTaxAmount = (dataToPrint.unitPrice || 0) * qty;
      }

      const vatAmount = amountToPrint - preTaxAmount;
      const thueLabel = vatRate > 0 ? `Thuế GTGT (${vatRate}%)` : 'Thuế GTGT';

      const dsArray = (dataToPrint.splitItems || []).map((item, index) => ({
          STT: index + 1,
          TEN: item.serviceName,
          SL: item.quantity,
          GIA: money(item.price),
          THANH_TIEN: money(item.price * item.quantity),
          NOI_DUNG: item.serviceName,
          QTY: item.quantity,
          PRICE: money(item.price),
          TOTAL: money(item.price * item.quantity),
          DT_THUA: item.area ? val(item.area) : "",
          AREA: item.area ? val(item.area) : "",
          THUA: item.landPlot ? val(item.landPlot) : "",
          SO_THUA: item.landPlot ? val(item.landPlot) : "",
          TO: item.mapSheet ? val(item.mapSheet) : "",
          SO_TO: item.mapSheet ? val(item.mapSheet) : ""
      }));

      // FIX LOGIC: Nếu không có dòng chi tiết (Đo đạc thường), thì tạo 1 dòng mặc định
      // Ở đây map DT_THUA và AREA bằng diện tích tổng của hợp đồng
      const finalDS = dsArray.length > 0 ? dsArray : [{
          STT: 1,
          TEN: val(dataToPrint.serviceType || dataToPrint.contractType),
          SL: qty,
          GIA: money(dataToPrint.unitPrice),
          THANH_TIEN: money(preTaxAmount),
          NOI_DUNG: val(dataToPrint.serviceType || dataToPrint.contractType),
          QTY: qty,
          PRICE: money(dataToPrint.unitPrice),
          TOTAL: money(preTaxAmount),
          DT_THUA: val(dataToPrint.area), // Lấy tổng diện tích
          AREA: val(dataToPrint.area)     // Lấy tổng diện tích
      }];

      const printData = {
          code: val(dataToPrint.code),
          customerName: val(dataToPrint.customerName),
          landPlot: val(dataToPrint.landPlot),
          mapSheet: val(dataToPrint.mapSheet),
          address: val(dataToPrint.address),
          DIA_CHI_CHI_TIET: val(dataToPrint.address),
          MA_HS: val(dataToPrint.code),
          SO_HD: val(dataToPrint.code),
          
          NGAY: dateTL.day,
          THANG: dateTL.month,
          NAM: dateTL.year,
          NGAY_KY: dateTL.full,

          NGAY_HD: dateHD.day,
          THANG_HD: dateHD.month,
          NAM_HD: dateHD.year,
          NGAY_KY_HD: dateHD.full,

          NGAY_TL: dateTL.day,
          THANG_TL: dateTL.month,
          NAM_TL: dateTL.year,
          NGAY_KY_TL: dateTL.full,

          NGUOI_LAP: val(currentUser.name),
          BEN_A: val(dataToPrint.customerName).toUpperCase(),
          TEN: val(dataToPrint.customerName).toUpperCase(),
          KHACH_HANG: val(dataToPrint.customerName).toUpperCase(),
          DIA_CHI_A: val(dataToPrint.address || dataToPrint.ward),
          DIACHI: val(dataToPrint.address || dataToPrint.ward),
          SDT: val(dataToPrint.phoneNumber),
          SDT_A: val(dataToPrint.phoneNumber),
          BEN_B: "CN VPĐKĐĐ HUYỆN HỚN QUẢN",
          DAI_DIEN_B: signerName,
          CHUC_VU_B: signerPosition,
          NGUOI_KY: signerName,
          CHUCVU_KY: signerPosition,
          SDTLH: sdtLienHe, 
          THUA: val(dataToPrint.landPlot),
          SO_THUA: val(dataToPrint.landPlot),
          TO: val(dataToPrint.mapSheet),
          SO_TO: val(dataToPrint.mapSheet),
          DT: val(dataToPrint.area),
          DIEN_TICH: val(dataToPrint.area),
          DIEN_TICH_TL: val(dataToPrint.liquidationArea || dataToPrint.area),
          DT_TL: val(dataToPrint.liquidationArea || dataToPrint.area),
          DIACHIDAT: fullLandAddress,
          DIA_CHI_THUA_DAT: fullLandAddress,
          XA_PHUONG: unitPrefix,
          TEN_XA: rawWard,
          XA: rawWard,
          KHUVUC: val(dataToPrint.areaType),
          TINH: "Bình Phước",
          HUYEN: "huyện Hớn Quản",
          LOAIHS: val(dataToPrint.contractType),
          LOAIDV: val(dataToPrint.serviceType || dataToPrint.contractType),
          NOI_DUNG_CV: val(dataToPrint.serviceType || dataToPrint.contractType),
          GHICHU: val(dataToPrint.content),
          SOLUONG: qty,
          SO_LUONG: qty,
          SOTHUA_SOMOC_LABEL: dataToPrint.contractType === 'Cắm mốc' ? 'Số mốc' : 'Số thửa',
          SOTHUA_SOMOC_VALUE: val(qty),
          DONGIA: money(dataToPrint.unitPrice),
          DON_GIA: money(dataToPrint.unitPrice),
          DONGIA_TEXT: money(dataToPrint.unitPrice),
          THANHTIEN: money(preTaxAmount),
          THANH_TIEN: money(preTaxAmount),
          THANHTIEN_TEXT: money(preTaxAmount),
          VAT: val(dataToPrint.vatRate),
          THUE_VAT: val(dataToPrint.vatRate),
          TIEN_THUE: money(vatAmount),
          VAT_AMOUNT: money(vatAmount),
          THUE_LABEL: thueLabel,
          TONGTIEN: money(amountToPrint),
          TONG_TIEN: money(amountToPrint),
          TONGTIEN_TEXT: money(amountToPrint),
          BANG_CHU: moneyText,
          TONGTIEN_CHU: moneyText,
          SO_TIEN_BANG_CHU: moneyText,
          DS: finalDS,
          SPLIT_ITEMS: finalDS
      };

      const blob = await generateDocxBlobAsync(templateKey, printData);
      
      if (blob) { 
          const fileName = `${typeName.replace(/\s/g, '_')}_${dataToPrint.code}.docx`;
          
          setPreviewBlob(blob);
          setPreviewFileName(fileName);
          setIsPreviewOpen(true);
      }
      
      setIsProcessing(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-full animate-fade-in-up overflow-hidden">
      
      {/* HEADER WITH TABS */}
      <div className="p-0 border-b border-gray-100 flex flex-col bg-purple-50/50 shrink-0 z-10 relative">
        <div className="flex justify-between items-center p-4">
            <div><h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><FileSignature className="text-purple-600" /> Quản Lý Hợp Đồng</h2></div>
            
            <div className="flex gap-2 items-center flex-wrap">
                <button onClick={() => setIsNumberingModalOpen(true)} className="px-3 py-1.5 bg-purple-600 border border-purple-500 text-white hover:bg-purple-700 hover:border-purple-600 rounded-lg transition-all shadow-md flex items-center gap-1.5 font-bold text-xs" title="Sổ Lấy Số & Số Hợp Đồng Tự Động">
                    <BookOpen size={14} />
                    <span>Sổ Lấy Số (Tiếp: {nextCodeProposal})</span>
                </button>
                <button onClick={() => setIsPriceConfigOpen(true)} className="p-2 bg-white border border-gray-200 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shadow-sm" title="Cấu hình Bảng giá Dịch vụ">
                    <Settings2 size={20} />
                </button>
                <button onClick={() => setIsTemplateModalOpen(true)} className="p-2 bg-white border border-gray-200 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors shadow-sm" title="Cấu hình Mẫu in Hợp đồng">
                    <Settings size={20} />
                </button>
            </div>
        </div>

        {!isOnline && (
            <div className="mx-4 mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-900 animate-pulse text-xs shrink-0">
                <WifiOff size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <div>
                    <span className="font-bold block text-sm">Cảnh báo: Đang Mất Kết Nối Internet!</span>
                    <p className="mt-0.5">Vui lòng **KHÔNG TẢI LẠI TRANG (F5)** để tránh mất dữ liệu nháp đang nhập dở. Giữ nguyên màn hình, khi có internet ổn định, dữ liệu chuyển tiếp/lưu hợp đồng sẽ tiếp tục được đồng bộ hóa thành công.</p>
                </div>
            </div>
        )}

        {/* MAIN TABS */}
        <div className="flex px-4 gap-2 overflow-x-auto">
            <button 
                onClick={() => { setActiveModule('contract'); setEditingContract(undefined); }}
                className={`px-6 py-2.5 rounded-t-lg font-bold text-sm transition-all border-t border-l border-r whitespace-nowrap ${activeModule === 'contract' ? 'bg-white text-purple-700 border-gray-200 relative top-[1px]' : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'}`}
            >
                <FileText size={16} className="inline mr-2" /> Lập Hợp Đồng
            </button>
            <button 
                onClick={() => { setActiveModule('liquidation'); setEditingContract(undefined); }}
                className={`px-6 py-2.5 rounded-t-lg font-bold text-sm transition-all border-t border-l border-r whitespace-nowrap ${activeModule === 'liquidation' ? 'bg-white text-green-700 border-gray-200 relative top-[1px]' : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'}`}
            >
                <FileCheck size={16} className="inline mr-2" /> Thanh Lý Hợp Đồng
            </button>
            <button 
                onClick={() => { setActiveModule('list'); }}
                className={`px-6 py-2.5 rounded-t-lg font-bold text-sm transition-all border-t border-l border-r whitespace-nowrap ${activeModule === 'list' ? 'bg-white text-blue-700 border-gray-200 relative top-[1px]' : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'}`}
            >
                <LayoutList size={16} className="inline mr-2" /> Danh sách Hợp đồng
            </button>
            <button 
                onClick={() => { setActiveModule('liquidation_list'); }}
                className={`px-6 py-2.5 rounded-t-lg font-bold text-sm transition-all border-t border-l border-r whitespace-nowrap ${activeModule === 'liquidation_list' ? 'bg-white text-orange-700 border-gray-200 relative top-[1px]' : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'}`}
            >
                <ClipboardList size={16} className="inline mr-2" /> Danh sách Thanh lý
            </button>
            <button 
                onClick={() => { setActiveModule('annex_list'); }}
                className={`px-6 py-2.5 rounded-t-lg font-bold text-sm transition-all border-t border-l border-r whitespace-nowrap ${activeModule === 'annex_list' ? 'bg-white text-pink-700 border-gray-200 relative top-[1px]' : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'}`}
            >
                <ClipboardList size={16} className="inline mr-2" /> Danh sách Phụ lục
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            {activeModule === 'contract' && (
                <ContractForm 
                    initialData={editingContract}
                    onSave={handleSaveContract}
                    onPrint={handlePreviewDocx}
                    priceList={priceList}
                    wards={wards}
                    records={records}
                    generateCode={generateContractCode}
                    mode='contract'
                />
            )}

            {activeModule === 'liquidation' && (
                <ContractForm 
                    initialData={editingContract}
                    onSave={handleSaveContract}
                    onPrint={handlePreviewDocx}
                    priceList={priceList}
                    wards={wards}
                    records={records}
                    generateCode={generateContractCode}
                    mode='liquidation'
                />
            )}

            {activeModule === 'list' && (
                <ContractList 
                    onEdit={handleEdit} // Chỉnh sửa hợp đồng
                    onDelete={handleDelete}
                    onPrint={handlePreviewDocx} 
                    onCreateLiquidation={handleCreateLiquidation} // Nút tạo thanh lý từ danh sách
                    viewMode='contract'
                    currentUser={currentUser}
                    employees={employees}
                    onDraftAnnex={handleDraftAnnex}
                    onCancelAnnex={handleCancelAnnex}
                />
            )}

            {activeModule === 'liquidation_list' && (
                <ContractList 
                    onEdit={handleCreateLiquidation} // Edit thanh lý thì mở form thanh lý
                    onDelete={handleDelete}
                    onPrint={handlePreviewDocx} 
                    onCreateLiquidation={handleCreateLiquidation}
                    viewMode='liquidation'
                    currentUser={currentUser}
                    employees={employees}
                />
            )}

            {activeModule === 'annex_list' && (
                <ContractList 
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onPrint={handlePreviewDocx} 
                    onCreateLiquidation={handleCreateLiquidation}
                    viewMode='annex'
                    currentUser={currentUser}
                    employees={employees}
                    onDraftAnnex={handleDraftAnnex}
                    onCancelAnnex={handleCancelAnnex}
                />
            )}
        </div>
      </div>

      {/* Modals */}
      <PriceConfigModal 
          isOpen={isPriceConfigOpen} 
          onClose={() => setIsPriceConfigOpen(false)} 
          currentPriceList={priceList} 
          onUpdate={loadPrices} 
      />
      <TemplateConfigModal 
          isOpen={isTemplateModalOpen} 
          onClose={() => setIsTemplateModalOpen(false)} 
          type="contract" 
      />
      <DocxPreviewModal 
          isOpen={isPreviewOpen} 
          onClose={() => setIsPreviewOpen(false)} 
          docxBlob={previewBlob} 
          fileName={previewFileName} 
      />
      <ContractNumberingBookModal
          isOpen={isNumberingModalOpen}
          onClose={() => setIsNumberingModalOpen(false)}
          contracts={contracts}
          onConfigChange={loadNextCodeProposal}
          onQuickAllocate={handleQuickAllocate}
      />

      {isAnnexModalOpen && annexTargetRecord && (
          <SystemAnnexTemplate 
              data={annexTargetRecord}
              employees={employees}
              onClose={() => {
                  setIsAnnexModalOpen(false);
                  setAnnexTargetRecord(null);
                  setAnnexTargetContract(null);
              }}
              onSaveAnnex={handleSaveAnnexStatus}
          />
      )}
    </div>
  );
};

export default ReceiveContract;

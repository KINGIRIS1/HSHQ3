
import React, { useState, useEffect, useRef } from 'react';
import { Contract, PriceItem, SplitItem, RecordFile } from '../../types';
import { Save, Calculator, Search, Plus, Trash2, Printer, FileCheck, CheckCircle, AlertCircle, X, RotateCcw, MapPin, Ruler, Grid, Banknote, User, FileText, Calendar, Wand2, ChevronDown, ChevronUp, Copy, ExternalLink } from 'lucide-react';

interface ContractFormProps {
  initialData?: Contract;
  onSave: (contract: Contract, isUpdate: boolean) => Promise<boolean>;
  onPrint: (data: Partial<Contract>, type: 'contract' | 'liquidation') => void;
  priceList: PriceItem[];
  wards: string[];
  records: RecordFile[];
  generateCode: () => string;
  mode: 'contract' | 'liquidation'; // New prop
}

function _nd(s: string | undefined | null): string {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

const parseServiceNameWithPlot = (fullName: string) => {
    const match = fullName.match(/^(.*?)\s*\(Thửa\s*([^,]+),\s*Tờ\s*([^)]+)\)$/i);
    if (match) {
        return {
            cleanName: match[1].trim(),
            landPlot: match[2].trim(),
            mapSheet: match[3].trim()
        };
    }
    return {
        cleanName: fullName,
        landPlot: '',
        mapSheet: ''
    };
};

const ContractForm: React.FC<ContractFormProps> = ({ initialData, onSave, onPrint, priceList, wards, records, generateCode, mode }) => {
  const [activeTab, setActiveTab] = useState<'dd' | 'tt' | 'cm' | 'tl'>('dd');
  const [pricingMethod, setPricingMethod] = useState<'single' | 'multi'>('single');
  const [tachThuaItems, setTachThuaItems] = useState<SplitItem[]>([]);
  const [searchCode, setSearchCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Helper tự động gợi ý loại dịch vụ phù hợp dựa trên diện tích nhập vào
  const autoSelectService = (area: number, currentAreaType: string) => {
      const currentTabServices = availableServices;
      const matchedRow = priceList.find(row => 
          currentTabServices.includes(row.serviceName) &&
          (!row.areaType || !currentAreaType || _nd(row.areaType) === _nd(currentAreaType)) &&
          area >= row.minArea && area < row.maxArea
      );
      return matchedRow ? matchedRow.serviceName : '';
  };

  const dateVal = (v: any) => { if (!v) return ''; const str = String(v); return str.includes('T') ? str.split('T')[0] : str; };

  // States for Quick Import (Tách thửa)
  const [splitImportText, setSplitImportText] = useState('');
  const [isImportExpanded, setIsImportExpanded] = useState(false);

  const d = new Date();
  const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const [formData, setFormData] = useState<Partial<Contract>>({
    code: '', customerName: '', phoneNumber: '', address: '', ward: '', landPlot: '', mapSheet: '', area: 0,
    contractType: 'Đo đạc', serviceType: '', areaType: '', plotCount: 1, markerCount: 1, quantity: 1, 
    unitPrice: 0, vatRate: 8, vatAmount: 0, totalAmount: 0, deposit: 0, content: '',
    createdDate: todayStr, status: 'PENDING',
    liquidationArea: 0, liquidationAmount: 0 // Init
  });

  useEffect(() => {
      if (initialData) {
          // Update Form Data
          setFormData(prev => ({
              ...initialData,
              // Logic fallback: Nếu vào chế độ Thanh lý và chưa có dữ liệu thanh lý, lấy dữ liệu hợp đồng
              liquidationArea: (mode === 'liquidation' && !initialData.liquidationArea) ? initialData.area : initialData.liquidationArea,
              liquidationAmount: (mode === 'liquidation' && !initialData.liquidationAmount) ? initialData.totalAmount : initialData.liquidationAmount
          }));
          
          // Update Split Items (Chi tiết tính phí/Tách thửa)
          if (initialData.splitItems && initialData.splitItems.length > 0) {
              const mappedItems = initialData.splitItems.map(item => {
                  const parsed = parseServiceNameWithPlot(item.serviceName);
                  return {
                      ...item,
                      serviceName: parsed.cleanName,
                      landPlot: item.landPlot || parsed.landPlot,
                      mapSheet: item.mapSheet || parsed.mapSheet
                  };
              });
              setTachThuaItems(mappedItems);
              setPricingMethod('multi');
          } else {
              setTachThuaItems([]);
              setPricingMethod('single');
          }

          // Update Active Tab based on Contract Type
          if (initialData.contractType === 'Tách thửa') setActiveTab('tt');
          else if (initialData.contractType === 'Cắm mốc') setActiveTab('cm');
          else if (initialData.contractType === 'Trích lục') setActiveTab('tl');
          else setActiveTab('dd');
          
          setNotification(null);
      } else {
          setFormData(prev => ({ ...prev, code: generateCode() }));
          setTachThuaItems([]);
          setPricingMethod(activeTab === 'tt' ? 'multi' : 'single');
      }
  }, [initialData, mode]); 

  // Scroll to notification
  useEffect(() => {
      if (notification && topRef.current) {
          topRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (notification.type === 'success') {
              const timer = setTimeout(() => setNotification(null), 5000);
              return () => clearTimeout(timer);
          }
      }
  }, [notification]);

  // Tab change logic
  useEffect(() => {
      const typeMap: Record<string, any> = { 'dd': 'Đo đạc', 'tt': 'Tách thửa', 'cm': 'Cắm mốc', 'tl': 'Trích lục' };
      setFormData(prev => ({ ...prev, contractType: typeMap[activeTab] }));
      if (activeTab === 'tt') {
          setPricingMethod('multi');
          if (tachThuaItems.length === 0) {
              setTachThuaItems([{ serviceName: '', quantity: 1, price: 0, area: undefined }]);
          }
      } else {
          // Keep current pricing method or reset if no items
          if (tachThuaItems.length === 0 || activeTab === 'cm') {
              setPricingMethod('single');
          }
      }
  }, [activeTab]);

  // Init Liquidation Data if missing (Fallback logic)
  useEffect(() => {
      if (mode === 'liquidation') {
          // Khi vào mode liquidation, nếu chưa có diện tích thanh lý thì lấy diện tích hợp đồng
          setFormData(prev => ({ 
              ...prev, 
              liquidationArea: prev.liquidationArea || prev.area
          }));
      }
  }, [mode]);

  // Helper tìm giá động theo AreaType hiện tại
  const getDynamicPrice = (serviceName: string) => {
      const currentAreaType = formData.areaType;
      const matchedRow = priceList.find(row => 
          _nd(row.serviceName) === _nd(serviceName) && 
          (!row.areaType || !currentAreaType || _nd(row.areaType) === _nd(currentAreaType))
      );
      
      if (matchedRow && matchedRow.price > 0) return matchedRow.price;
      if (_nd(serviceName).includes('trich luc')) return 49225;

      return 0;
  };

  // Logic nhập nhanh từ văn bản (Đo đạc / Tách thửa / ...)
  const handleParseSplitImport = () => {
      if (!splitImportText.trim()) return;

      const lines = splitImportText.split(/\n|;/).filter(line => line.trim() !== '');
      const newItems: SplitItem[] = [];
      const currentAreaType = formData.areaType;

      const validPriceItems = priceList.filter(p => {
          const n = p.serviceName;
          let matchesTab = false;
          if (activeTab === 'tt') matchesTab = _nd(n).includes('tach thua');
          else if (activeTab === 'cm') matchesTab = _nd(n).includes('cam moc');
          else if (activeTab === 'tl') matchesTab = _nd(n).includes('trich luc');
          else matchesTab = !_nd(n).includes('tach thua') && !_nd(n).includes('cam moc') && !_nd(n).includes('trich luc');
          
          const isMatchArea = !p.areaType || !currentAreaType || _nd(p.areaType) === _nd(currentAreaType);
          return matchesTab && isMatchArea;
      });

      lines.forEach(line => {
          const areaMatch = line.match(/(?:diện tích|dt)[:\s]*([\d,.]+)/i);
          if (areaMatch) {
              let areaStr = areaMatch[1];
              if (areaStr.includes('.') && areaStr.includes(',')) areaStr = areaStr.replace(/\./g, '').replace(',', '.');
              else if (areaStr.includes(',')) areaStr = areaStr.replace(',', '.');
              
              const area = parseFloat(areaStr);

              if (!isNaN(area)) {
                  let bestService = validPriceItems.find(p => area >= p.minArea && area < p.maxArea);
                  let serviceName = bestService ? bestService.serviceName : (availableServices[0] || '');
                  let price = bestService ? bestService.price : getDynamicPrice(serviceName);

                  // Extract plot (thửa) and sheet (tờ) if present
                  let landPlot = '';
                  let mapSheet = '';

                  const plotMatch = line.match(/(?:thửa đất|thửa|thua|t)[:\s]*([0-9a-zA-Z\-_/]+)/i);
                  if (plotMatch) {
                      landPlot = plotMatch[1];
                  } else {
                      const fallbackPlotMatch = line.match(/(?:thứ|thu)\s*(?:nhất|hai|ba|tư|năm|sáu|bảy|tám|chín|mười)?\s*([0-9a-zA-Z\-_/]+)/i)
                        || line.match(/(\d+(?:-\d+)?)/);
                      if (fallbackPlotMatch) {
                          landPlot = fallbackPlotMatch[1];
                      }
                  }

                  const sheetMatch = line.match(/(?:tờ bản đồ|tờ|to|bản đồ|bd)[:\s]*([0-9a-zA-Z\-_/]+)/i);
                  if (sheetMatch) {
                      mapSheet = sheetMatch[1];
                  }

                  newItems.push({
                      serviceName: serviceName,
                      quantity: 1,
                      price: price,
                      area: area,
                      landPlot: landPlot.trim(),
                      mapSheet: mapSheet.trim()
                  });
              }
          }
      });

      if (newItems.length > 0) {
          setTachThuaItems(newItems);
          setNotification({ type: 'success', message: `Đã nhập tự động ${newItems.length} thửa đất.` });
          setIsImportExpanded(false); 
      } else {
          setNotification({ type: 'error', message: 'Không tìm thấy thông tin diện tích hợp lệ trong văn bản.' });
      }
  };

  // Price Calculation Logic
  useEffect(() => {
      // 1. Tự động xác định Khu vực
      let currentAreaType = formData.areaType;
      if (!currentAreaType && formData.ward) {
          const wardName = (formData.ward || '').toLowerCase();
          const normalizedWard = _nd(formData.ward);
          if (
              wardName.includes('phường') || 
              wardName.includes('tt.') || 
              wardName.includes('thị trấn') || 
              wardName.includes('minh hưng') || 
              wardName.includes('chơn thành') ||
              normalizedWard.includes('tan khai')
          ) {
              currentAreaType = 'Đất đô thị';
          } else {
              currentAreaType = 'Đất nông thôn';
          }
      }

      let calculatedTotal = 0;
      let calculatedUnitPrice = 0;
      let calculatedVatAmount = 0;
      const vatRate = 8; // Mặc định

      // 2. Logic NHIỀU THỬA CHI TIẾT (Cho tất cả các tab) HOẶC Tách thửa
      if (activeTab === 'tt' || pricingMethod === 'multi') {
          let totalBase = 0;
          tachThuaItems.forEach(item => {
              const price = getDynamicPrice(item.serviceName);
              totalBase += (price * item.quantity);
          });
          
          calculatedVatAmount = Math.round(totalBase * (vatRate / 100));
          calculatedTotal = totalBase + calculatedVatAmount;

          const updates: any = {
              unitPrice: 0, 
              vatRate, 
              vatAmount: calculatedVatAmount, 
              areaType: currentAreaType,
          };

          // Tự động cộng tổng diện tích và đồng bộ lên form
          const totalArea = tachThuaItems.reduce((sum, item) => sum + (item.area || 0), 0);
          const plots = tachThuaItems.map(item => item.landPlot).filter(p => p && p.trim() !== '');
          const sheets = tachThuaItems.map(item => item.mapSheet).filter(s => s && s.trim() !== '');
          
          if (totalArea > 0) updates.area = totalArea;
          if (plots.length > 0) updates.landPlot = Array.from(new Set(plots)).join(', ');
          if (sheets.length > 0) updates.mapSheet = Array.from(new Set(sheets)).join(', ');
          
          if (activeTab === 'dd') updates.plotCount = tachThuaItems.length;
          else if (activeTab === 'cm') updates.markerCount = tachThuaItems.length;
          else if (activeTab === 'tl') updates.quantity = tachThuaItems.length;

          if (mode === 'liquidation') {
              updates.liquidationAmount = calculatedTotal;
              if (totalArea > 0) updates.liquidationArea = totalArea;
          } else {
              updates.totalAmount = calculatedTotal;
          }

          setFormData(prev => ({ ...prev, ...updates }));
          return;
      }

      // 3. Logic Trích Lục đơn lẻ
      if (activeTab === 'tl') {
          calculatedUnitPrice = 49225;
          const qty = formData.quantity || 1;
          const baseAmount = calculatedUnitPrice * qty;
          calculatedVatAmount = Math.round(baseAmount * (vatRate / 100));
          calculatedTotal = baseAmount + calculatedVatAmount;
          
          const updates: any = {
              serviceType: 'Trích lục bản đồ địa chính',
              unitPrice: calculatedUnitPrice,
              vatRate: vatRate,
              vatAmount: calculatedVatAmount,
              areaType: currentAreaType,
          };

          if (mode === 'liquidation') {
              updates.liquidationAmount = calculatedTotal;
          } else {
              updates.totalAmount = calculatedTotal;
          }
          
          setFormData(prev => ({...prev, ...updates}));
          return;
      }

      // 4. Logic Đo đạc & Cắm mốc đơn lẻ
      if (!formData.serviceType) return;
      calculatedUnitPrice = getDynamicPrice(formData.serviceType);
      
      const matchedItem = priceList.find(p => _nd(p.serviceName) === _nd(formData.serviceType));
      const vatIsPercent = matchedItem ? matchedItem.vatIsPercent : true;

      const qty = activeTab === 'cm' ? (formData.markerCount || 1) : (formData.plotCount || 1);
      const baseAmount = calculatedUnitPrice * qty;
      
      if (vatIsPercent) {
          calculatedVatAmount = Math.round(baseAmount * (vatRate / 100));
      } else {
          calculatedVatAmount = vatRate * qty;
      }
      
      calculatedTotal = baseAmount + calculatedVatAmount;

      const updates: any = {
          unitPrice: calculatedUnitPrice, 
          vatRate: vatRate, 
          vatAmount: calculatedVatAmount, 
          areaType: currentAreaType,
      };

      if (mode === 'liquidation') {
          updates.liquidationAmount = calculatedTotal;
      } else {
          updates.totalAmount = calculatedTotal;
      }

      setFormData(prev => ({ ...prev, ...updates }));
      
  }, [formData.area, formData.serviceType, formData.ward, formData.areaType, formData.plotCount, formData.markerCount, formData.quantity, tachThuaItems, activeTab, priceList, mode, pricingMethod]);

  const handleSearchRecord = () => {
      const found = records.find(r => r.code.toLowerCase() === searchCode.toLowerCase());
      if (found) {
          let suggestedService = '';
          const recType = (found.recordType || '').toLowerCase();
          
          if (recType.includes('trích lục')) {
              setActiveTab('tl');
              suggestedService = 'Trích lục bản đồ địa chính';
          } else if (recType.includes('cắm mốc')) {
              setActiveTab('cm');
          } else if (recType.includes('tách thửa')) {
              setActiveTab('tt');
          } else {
              setActiveTab('dd');
          }

          setFormData(prev => ({ 
              ...prev, 
              recordCode: found.code,
              customerName: found.customerName, 
              phoneNumber: found.phoneNumber, 
              ward: found.ward, 
              address: found.address || '', 
              landPlot: found.landPlot, 
              mapSheet: found.mapSheet, 
              area: found.area || 0,
              serviceType: suggestedService || prev.serviceType
          }));
          setNotification({ type: 'success', message: `Đã tải thông tin từ hồ sơ: ${found.code}` });
      } else {
          setNotification({ type: 'error', message: 'Không tìm thấy mã hồ sơ này.' });
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setNotification(null);

      if (!formData.code || !formData.customerName) { 
          setNotification({ type: 'error', message: "Vui lòng điền đầy đủ Mã hợp đồng và Tên khách hàng." }); 
          return; 
      }
      setLoading(true);
      
      const finalSplitItems = (activeTab === 'tt' || pricingMethod === 'multi') ? tachThuaItems.map(item => {
          const cleanName = item.serviceName;
          const richName = (item.landPlot || item.mapSheet)
              ? `${cleanName} (Thửa ${item.landPlot || '-'}, Tờ ${item.mapSheet || '-'})`
              : cleanName;
          return {
              ...item,
              serviceName: richName,
              price: getDynamicPrice(cleanName)
          };
      }) : [];

      // Logic quan trọng:
      // Nếu mode = liquidation, ta lưu liquidationAmount (giá trị đã tính toán trên form)
      // Nếu mode = contract, ta lưu totalAmount (giá trị đã tính toán trên form)
      // Các trường khác giữ nguyên
      
      const contractData = { 
          ...formData, 
          splitItems: finalSplitItems, 
          serviceType: activeTab === 'tt' ? 'Đo đạc tách thửa' : formData.serviceType,
      } as Contract;
      
      // Đảm bảo không bị null
      if (!contractData.id) contractData.id = Math.random().toString(36).substr(2, 9);
      
      const success = await onSave(contractData, !!initialData);
      setLoading(false);

      if (success) {
          const msg = initialData ? 'Cập nhật thành công!' : 'Đã tạo mới thành công!';
          setNotification({ type: 'success', message: msg });
          
          // Tự động in sau khi lưu thành công
          handlePrintClick(mode);

          if (!initialData) handleReset(true); 
      } else {
          setNotification({ type: 'error', message: 'Lỗi khi lưu. Vui lòng thử lại.' });
      }
  };

  const handleReset = (keepNotification = false) => {
      const d = new Date();
      const todayStrLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      setFormData({
        code: generateCode(), customerName: '', phoneNumber: '', address: '', ward: '', landPlot: '', mapSheet: '', area: 0,
        contractType: activeTab === 'tt' ? 'Tách thửa' : activeTab === 'cm' ? 'Cắm mốc' : activeTab === 'tl' ? 'Trích lục' : 'Đo đạc', 
        serviceType: '', areaType: '', plotCount: 1, markerCount: 1, quantity: 1, 
        unitPrice: 0, vatRate: 8, vatAmount: 0, totalAmount: 0, deposit: 0, content: '',
        createdDate: todayStrLocal, status: 'PENDING',
        liquidationArea: 0, liquidationAmount: 0
      });
      setTachThuaItems([]);
      setPricingMethod(activeTab === 'tt' ? 'multi' : 'single');
      setSplitImportText('');
      setSearchCode('');
      if (!keepNotification) setNotification(null);
  };

  const handlePrintClick = (type: 'contract' | 'liquidation') => {
      const finalSplitItems = (activeTab === 'tt' || pricingMethod === 'multi') ? tachThuaItems.map(item => {
          const cleanName = item.serviceName;
          const richName = (item.landPlot || item.mapSheet)
              ? `${cleanName} (Thửa ${item.landPlot || '-'}, Tờ ${item.mapSheet || '-'})`
              : cleanName;
          return {
              ...item,
              serviceName: richName,
              price: getDynamicPrice(cleanName)
          };
      }) : [];

      const currentData = { 
          ...formData, 
          splitItems: finalSplitItems, 
          serviceType: activeTab === 'tt' ? 'Đo đạc tách thửa' : formData.serviceType 
      };
      // Khi in thanh lý, truyền đúng giá trị thanh lý để in ra form
      if (type === 'liquidation') {
          // Lưu ý: liquidationAmount đã được tính toán trong useEffect
      }
      onPrint(currentData, type);
  };

  const detectWardFromAddress = (address: string): { ward: string; areaType: string } | null => {
      const normalized = _nd(address);
      if (normalized.includes('tan khai')) {
          return { ward: 'Tân Khai', areaType: 'Đất đô thị' };
      }
      if (normalized.includes('tan quan')) {
          return { ward: 'Tân Quan', areaType: 'Đất nông thôn' };
      }
      if (normalized.includes('minh duc')) {
          return { ward: 'Minh Đức', areaType: 'Đất nông thôn' };
      }
      if (normalized.includes('tan hung')) {
          return { ward: 'Tân Hưng', areaType: 'Đất nông thôn' };
      }
      return null;
  };

  const handleChange = (k: keyof Contract, v: any) => {
      setFormData(p => {
          const updated = { ...p, [k]: v };
          if (k === 'address' && v) {
              const detection = detectWardFromAddress(v);
              if (detection) {
                  updated.ward = detection.ward;
                  updated.areaType = detection.areaType;
              }
          } else if (k === 'ward') {
              const normalizedWard = _nd(v);
              if (normalizedWard.includes('tan khai')) {
                  updated.areaType = 'Đất đô thị';
              } else if (normalizedWard) {
                  updated.areaType = 'Đất nông thôn';
              }
          }
          return updated;
      });
  };
  
  const groupedServices = (() => {
      let filteredItems = priceList.filter(p => {
          const n = p.serviceName;
          if (activeTab === 'tt') return _nd(n).includes('tach thua');
          if (activeTab === 'cm') return _nd(n).includes('cam moc');
          if (activeTab === 'tl') return _nd(n).includes('trich luc');
          return !_nd(n).includes('tach thua') && !_nd(n).includes('cam moc') && !_nd(n).includes('trich luc');
      });

      const uniqueServices: PriceItem[] = [];
      const seen = new Set<string>();
      filteredItems.forEach(p => {
          if (!seen.has(p.serviceName)) {
              seen.add(p.serviceName);
              uniqueServices.push(p);
          }
      });

      const groups: Record<string, PriceItem[]> = {};
      uniqueServices.forEach(p => {
          const groupName = p.serviceGroup || 'Dịch vụ đo đạc khác';
          if (!groups[groupName]) {
              groups[groupName] = [];
          }
          groups[groupName].push(p);
      });

      Object.keys(groups).forEach(g => {
          groups[g].sort((a, b) => (a.minArea || 0) - (b.minArea || 0));
      });

      const getGroupPriority = (g: string) => {
          const normalized = _nd(g);
          if (normalized.includes('chinh ly')) return 1;
          if (normalized.includes('toa an') || normalized.includes('phuc vu toa an')) return 2;
          if (normalized.includes('cam moc')) return 3;
          if (normalized.includes('trich luc')) return 4;
          if (normalized.includes('tach thua')) return 5;
          return 99;
      };

      const sortedGroupNames = Object.keys(groups).sort((a, b) => {
          const prioA = getGroupPriority(a);
          const prioB = getGroupPriority(b);
          if (prioA !== prioB) return prioA - prioB;
          return a.localeCompare(b, 'vi');
      });

      return {
          names: sortedGroupNames,
          groups: groups
      };
  })();

  const availableServices = (() => {
      const flatList: string[] = [];
      groupedServices.names.forEach(groupName => {
          groupedServices.groups[groupName].forEach(p => {
              flatList.push(p.serviceName);
          });
      });
      return flatList;
  })();

  // Auto select service when there is only 1 available service for the current tab (e.g. Cắm mốc)
  useEffect(() => {
      if (activeTab === 'cm' && availableServices.length === 1) {
          setFormData(prev => {
              if (prev.serviceType !== availableServices[0]) {
                  return { ...prev, serviceType: availableServices[0] };
              }
              return prev;
          });
      }
  }, [activeTab, availableServices]);

  const inputClass = "w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all font-medium bg-white hover:border-purple-300";
  const labelClass = "block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1";

  // Check if we are in liquidation mode to show extra fields
  const isLiquidationMode = mode === 'liquidation';

  // Biến hiển thị tổng tiền (Tùy theo mode mà hiển thị totalAmount hay liquidationAmount)
  const displayTotalAmount = isLiquidationMode ? (formData.liquidationAmount || 0) : (formData.totalAmount || 0);

  return (
    <form onSubmit={handleSubmit} className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in relative pb-10">
        <div ref={topRef} className="absolute -top-20" />
        
        {/* NOTIFICATION */}
        <div className="lg:col-span-12">
            {notification && (
                <div className={`p-4 rounded-xl border shadow-lg flex items-start gap-3 transition-all duration-300 animate-fade-in-up mb-4 ${notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    {notification.type === 'success' ? <CheckCircle className="shrink-0 mt-0.5" size={20} /> : <AlertCircle className="shrink-0 mt-0.5" size={20} />}
                    <div className="flex-1">
                        <h4 className="font-bold text-sm uppercase">{notification.type === 'success' ? 'Thành công' : 'Thông báo'}</h4>
                        <p className="text-sm">{notification.message}</p>
                    </div>
                    <button type="button" onClick={() => setNotification(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                </div>
            )}
        </div>

        {/* CỘT TRÁI: NHẬP NHANH TỪ HỒ SƠ */}
        <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 uppercase mb-5 border-b pb-3 flex items-center gap-2">
                    <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><Search size={16} /></span> 
                    Tải từ Hồ Sơ (Auto Fill)
                </h3>
                
                <div className="flex gap-2 mb-6">
                    <div className="relative flex-1">
                        <input type="text" placeholder="Nhập mã hồ sơ..." className={`${inputClass} pl-9`} value={searchCode} onChange={(e) => setSearchCode(e.target.value)} />
                        <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                    </div>
                    <button type="button" onClick={handleSearchRecord} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 shadow-sm transition-all active:scale-95">Tải</button>
                </div>

                <div className="space-y-4">
                    <div><label className={labelClass}>Khách hàng</label><input className={inputClass} value={formData.customerName ?? ''} onChange={e => handleChange('customerName', e.target.value)} /></div>
                    <div>
                        <label className={labelClass}>Xã phường</label>
                        <select className={inputClass} value={formData.ward ?? ''} onChange={e => handleChange('ward', e.target.value)}>
                            <option value="">-- Chọn Xã/Phường --</option>
                            {wards.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                    </div>
                    <div><label className={labelClass}>Địa chỉ đất</label><input className={inputClass} value={formData.address ?? ''} onChange={e => handleChange('address', e.target.value)} /></div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className={labelClass}>Tờ bản đồ</label><input className={`${inputClass} text-center`} value={formData.mapSheet ?? ''} onChange={e => handleChange('mapSheet', e.target.value)} /></div>
                        <div><label className={labelClass}>Thửa đất</label><input className={`${inputClass} text-center`} value={formData.landPlot ?? ''} onChange={e => handleChange('landPlot', e.target.value)} /></div>
                    </div>
                    <div>
                        <label className={labelClass}>Diện tích Hợp Đồng (m2)</label>
                        <input type="number" className={`${inputClass} font-bold text-blue-600`} value={formData.area ?? 0} onChange={e => handleChange('area', parseFloat(e.target.value))} />
                    </div>
                    
                    {/* LIQUIDATION AREA FIELD - ONLY IN LIQUIDATION MODE */}
                    {isLiquidationMode && (
                        <div className="bg-green-50 p-3 rounded-lg border border-green-200 mt-2 animate-fade-in">
                            <label className={`${labelClass} text-green-700`}>Diện tích Thanh Lý (Thực tế)</label>
                            <div className="flex gap-2 items-center">
                                <input 
                                    type="number" 
                                    className={`${inputClass} font-bold text-green-700 border-green-300 focus:border-green-500`} 
                                    value={formData.liquidationArea ?? 0}
                                    onChange={e => handleChange('liquidationArea', parseFloat(e.target.value))} 
                                />
                                <span className="text-xs font-bold text-green-600">m²</span>
                            </div>
                            <p className="text-[10px] text-green-600 mt-1 italic">* Hệ thống sẽ tự động tính lại giá trị thanh lý dựa trên diện tích này.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* CỘT PHẢI: CHI TIẾT HỢP ĐỒNG */}
        <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* TABS HEADER */}
                <div className="flex border-b border-slate-200 bg-slate-50/50 p-1.5 gap-1.5 overflow-x-auto">
                    {(() => {
                        const visibleTabs = ['dd', 'cm'];
                        if (activeTab === 'tt') visibleTabs.push('tt');
                        if (activeTab === 'tl') visibleTabs.push('tl');
                        return visibleTabs;
                    })().map(t => (
                        <button key={t} type="button" onClick={() => setActiveTab(t as any)} className={`flex-1 py-3 px-4 text-sm font-bold text-center rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === t ? 'bg-white text-purple-700 shadow-md ring-1 ring-purple-100' : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'}`}>
                            {t === 'dd' ? <><Ruler size={16} /> Đo đạc</> : 
                             t === 'tt' ? <><Grid size={16} /> Tách thửa</> : 
                             t === 'cm' ? <><MapPin size={16} /> Cắm mốc</> :
                             <><Copy size={16} /> Trích lục</>}
                        </button>
                    ))}
                </div>

                <div className="p-6 space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div>
                            <label className={labelClass}>Mã Hợp Đồng</label>
                            <div className="relative">
                                <FileText size={16} className="absolute left-3 top-3 text-slate-400" />
                                <input type="text" readOnly className={`${inputClass} bg-white pl-9 font-mono font-bold text-purple-700`} value={formData.code ?? ''} />
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>Mã Hồ Sơ liên kết</label>
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                                <input type="text" className={`${inputClass} pl-9 font-mono font-bold text-blue-700`} value={formData.recordCode ?? ''} onChange={e => handleChange('recordCode', e.target.value)} placeholder="Nhập mã hồ sơ để liên kết" />
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>Ngày lập</label>
                            <div className="relative">
                                <Calendar size={16} className="absolute left-3 top-3 text-slate-400" />
                                <input type="date" className={`${inputClass} pl-9`} value={dateVal(formData.createdDate)} onChange={e => handleChange('createdDate', e.target.value)} />
                            </div>
                        </div>
                    </div>
                    {/* Pricing Box */}
                    <div className={`bg-gradient-to-br p-6 rounded-2xl border shadow-inner ${isLiquidationMode ? 'from-orange-50 to-amber-50 border-orange-100' : 'from-purple-50 to-indigo-50 border-purple-100'}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-purple-100">
                            <h4 className={`font-bold flex items-center gap-2 text-lg ${isLiquidationMode ? 'text-orange-800' : 'text-purple-800'}`}>
                                <div className={`p-1.5 rounded-lg shadow-sm ${isLiquidationMode ? 'bg-orange-100 text-orange-600' : 'bg-white text-purple-600'}`}><Banknote size={20} /></div> 
                                {isLiquidationMode ? 'Quyết toán Thanh Lý' : 'Tính chi phí Hợp Đồng'}
                            </h4>
                            {activeTab !== 'tt' && activeTab !== 'cm' && (
                                <div className="flex bg-purple-100/50 p-1 rounded-xl border border-purple-200 shrink-0 self-start sm:self-auto">
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            setPricingMethod('single');
                                            setTachThuaItems([]);
                                        }} 
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${pricingMethod === 'single' ? 'bg-purple-600 text-white shadow-sm' : 'text-purple-700 hover:bg-purple-100'}`}
                                    >
                                        Một thửa đơn lẻ
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            setPricingMethod('multi');
                                            if (tachThuaItems.length === 0) {
                                                setTachThuaItems([{ serviceName: formData.serviceType || '', quantity: 1, price: 0, area: formData.area || undefined, landPlot: formData.landPlot || '', mapSheet: formData.mapSheet || '' }]);
                                            }
                                        }} 
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${pricingMethod === 'multi' ? 'bg-purple-600 text-white shadow-sm' : 'text-purple-700 hover:bg-purple-100'}`}
                                    >
                                        Nhiều thửa chi tiết
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        {pricingMethod === 'single' && (activeTab === 'dd' || activeTab === 'cm' || activeTab === 'tl') && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                {activeTab !== 'tl' && (
                                    <>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-purple-800/70 mb-1 uppercase">Khu vực</label>
                                            <select className={`${inputClass} border-purple-200 bg-white/80`} value={formData.areaType ?? ''} onChange={(e) => handleChange('areaType', e.target.value)}>
                                                <option value="">-- Tự động theo xã --</option>
                                                <option value="Đất nông thôn">Đất nông thôn (Xã)</option>
                                                <option value="Đất đô thị">Đất đô thị (Phường/TT)</option>
                                            </select>
                                        </div>
                                        {!(activeTab === 'cm' && availableServices.length <= 1) ? (
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-bold text-purple-800/70 mb-1 uppercase">Loại dịch vụ</label>
                                                <select className={`${inputClass} border-purple-200 bg-white/80`} value={formData.serviceType ?? ''} onChange={(e) => handleChange('serviceType', e.target.value)}>
                                                    <option value="">-- Chọn dịch vụ --</option>
                                                    {groupedServices.names.map(groupName => (
                                                        <optgroup key={groupName} label={groupName}>
                                                            {groupedServices.groups[groupName].map(item => (
                                                                <option key={item.serviceName} value={item.serviceName}>
                                                                    {item.serviceName}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    ))}
                                                </select>
                                            </div>
                                        ) : (
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-bold text-purple-800/70 mb-1 uppercase">Loại dịch vụ</label>
                                                <div className="w-full border border-purple-200 bg-purple-50 rounded-lg px-3 py-2.5 text-sm font-bold text-purple-800">
                                                    {formData.serviceType || availableServices[0] || 'Cắm mốc ranh giới'}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                                
                                {activeTab === 'tl' && (
                                    <div className="md:col-span-2">
                                        <div className="bg-white/80 p-3 rounded-lg border border-purple-200 text-sm text-purple-800 flex items-center gap-2">
                                            <AlertCircle size={16} />
                                            <span>Loại hình: <strong>Trích lục bản đồ địa chính</strong> (Đơn giá cố định: 49.225đ)</span>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-purple-800/70 mb-1 uppercase">
                                        {activeTab === 'dd' ? 'Số thửa' : activeTab === 'cm' ? 'Số mốc' : 'Số lượng'}
                                    </label>
                                    <input 
                                        type="number" 
                                        className={`${inputClass} border-purple-200 bg-white/80`} 
                                        value={activeTab === 'cm' ? (formData.markerCount ?? 1) : activeTab === 'tl' ? (formData.quantity ?? 1) : (formData.plotCount ?? 1)} 
                                        onChange={e => handleChange(activeTab === 'cm' ? 'markerCount' : activeTab === 'tl' ? 'quantity' : 'plotCount', parseInt(e.target.value))} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-purple-800/70 mb-1 uppercase">Đơn giá</label>
                                    <input type="number" readOnly className={`${inputClass} border-purple-200 bg-purple-100/50 text-right font-mono text-purple-700`} value={formData.unitPrice ?? 0} />
                                </div>
                            </div>
                        )}

                        {pricingMethod === 'multi' && (
                            <div className="space-y-4 mb-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-purple-800/70 mb-1 uppercase">Khu vực</label>
                                        <select className={`${inputClass} border-purple-200 bg-white/80`} value={formData.areaType ?? ''} onChange={(e) => handleChange('areaType', e.target.value)}>
                                            <option value="">-- Tự động theo xã --</option>
                                            <option value="Đất nông thôn">Đất nông thôn (Xã)</option>
                                            <option value="Đất đô thị">Đất đô thị (Phường/TT)</option>
                                        </select>
                                    </div>
                                </div>
                                
                                {/* QUICK IMPORT SECTION (NEW) */}
                                {(activeTab === 'tt' || activeTab === 'dd') && (
                                    <div className="bg-white rounded-xl border border-purple-200 p-4 shadow-sm mb-3">
                                        <div 
                                            className="flex justify-between items-center cursor-pointer mb-2 select-none"
                                            onClick={() => setIsImportExpanded(!isImportExpanded)}
                                        >
                                            <label className="flex items-center gap-2 text-xs font-bold text-purple-700 uppercase cursor-pointer">
                                                <Wand2 size={16} /> Nhập nhanh từ nội dung chi tiết
                                            </label>
                                            {isImportExpanded ? <ChevronUp size={16} className="text-purple-400" /> : <ChevronDown size={16} className="text-purple-400" />}
                                        </div>
                                        
                                        {isImportExpanded && (
                                            <div className="space-y-2 animate-fade-in">
                                                <textarea 
                                                    className="w-full border border-purple-200 rounded-lg p-2 text-sm text-slate-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 min-h-[80px]"
                                                    placeholder={`Ví dụ:\n- Thửa đất thứ nhất 1618-1: diện tích: 279,8 m²...\n- Thửa đất thứ hai 1618-2: diện tích: 150,5 m²...`}
                                                    value={splitImportText}
                                                    onChange={(e) => setSplitImportText(e.target.value)}
                                                />
                                                <div className="flex justify-end">
                                                    <button 
                                                        type="button"
                                                        onClick={handleParseSplitImport}
                                                        disabled={!splitImportText.trim()}
                                                        className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors"
                                                    >
                                                        Phân tích & Nhập tự động
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-slate-500 italic mt-1">
                                                    * Hệ thống sẽ tự động tìm diện tích (ví dụ "diện tích: 279,8") và chọn loại sản phẩm tương ứng trong bảng giá.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="bg-white rounded-xl border border-purple-200 overflow-hidden shadow-sm overflow-x-auto">
                                    <table className="w-full text-sm min-w-[700px]">
                                        <thead className="bg-purple-100 text-purple-800 text-xs uppercase font-bold">
                                            <tr>
                                                <th className="p-3 w-16 text-center">Tờ</th>
                                                <th className="p-3 w-20 text-center">Thửa</th>
                                                <th className="p-3 w-24 text-center">Diện tích (m2)</th>
                                                <th className="p-3 text-left">Hạng mục dịch vụ</th>
                                                <th className="p-3 w-16 text-center">SL</th>
                                                <th className="p-3 w-28 text-right">Đơn giá</th>
                                                <th className="p-3 w-32 text-right">Thành tiền</th>
                                                <th className="p-3 w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tachThuaItems.map((item, idx) => {
                                                const currentPrice = getDynamicPrice(item.serviceName) || 0;
                                                const lineTotal = currentPrice * (item.quantity || 0);
                                                return (
                                                    <tr key={idx} className="border-t border-purple-50 hover:bg-purple-50/30">
                                                        <td className="p-2">
                                                            <input 
                                                                type="text" 
                                                                className="w-full border border-purple-100 rounded-lg px-2 py-1.5 text-center text-sm outline-none bg-purple-50/30 focus:border-purple-300 font-mono" 
                                                                value={item.mapSheet ?? ''} 
                                                                onChange={(e) => { 
                                                                    const newItems = [...tachThuaItems]; 
                                                                    newItems[idx].mapSheet = e.target.value; 
                                                                    setTachThuaItems(newItems); 
                                                                }} 
                                                                placeholder="Tờ"
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <input 
                                                                type="text" 
                                                                className="w-full border border-purple-100 rounded-lg px-2 py-1.5 text-center text-sm outline-none bg-purple-50/30 focus:border-purple-300 font-mono font-bold text-slate-700" 
                                                                value={item.landPlot ?? ''} 
                                                                onChange={(e) => { 
                                                                    const newItems = [...tachThuaItems]; 
                                                                    newItems[idx].landPlot = e.target.value; 
                                                                    setTachThuaItems(newItems); 
                                                                }} 
                                                                placeholder="Thửa"
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <input 
                                                                type="number" 
                                                                className="w-full border border-purple-100 rounded-lg px-2 py-1.5 text-center text-sm outline-none bg-white font-bold text-blue-600 focus:border-purple-300" 
                                                                value={item.area ?? ''} 
                                                                onChange={(e) => { 
                                                                    const newItems = [...tachThuaItems]; 
                                                                    const areaVal = e.target.value ? parseFloat(e.target.value) : undefined;
                                                                    newItems[idx].area = areaVal; 
                                                                    
                                                                    // Tự động tìm dịch vụ phù hợp khi người dùng nhập diện tích
                                                                    if (areaVal && areaVal > 0) {
                                                                        const suggestedService = autoSelectService(areaVal, formData.areaType || '');
                                                                        if (suggestedService) {
                                                                            newItems[idx].serviceName = suggestedService;
                                                                            newItems[idx].price = getDynamicPrice(suggestedService);
                                                                        }
                                                                    }
                                                                    setTachThuaItems(newItems); 
                                                                }} 
                                                                placeholder="DT"
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <select 
                                                                className="w-full border border-purple-100 rounded-lg px-2 py-1.5 text-sm outline-none bg-purple-50/30 focus:border-purple-300" 
                                                                value={item.serviceName} 
                                                                onChange={(e) => { 
                                                                    const newItems = [...tachThuaItems]; 
                                                                    newItems[idx].serviceName = e.target.value; 
                                                                    newItems[idx].price = getDynamicPrice(e.target.value);
                                                                    setTachThuaItems(newItems); 
                                                                }}
                                                            >
                                                                <option value="">-- Chọn dịch vụ --</option>
                                                                {groupedServices.names.map(groupName => (
                                                                     <optgroup key={groupName} label={groupName}>
                                                                         {groupedServices.groups[groupName].map(p => (
                                                                             <option key={p.serviceName} value={p.serviceName}>
                                                                                 {p.serviceName}
                                                                             </option>
                                                                         ))}
                                                                     </optgroup>
                                                                 ))}
                                                            </select>
                                                        </td>
                                                        <td className="p-2">
                                                            <input 
                                                                type="number" 
                                                                className="w-full border border-purple-100 rounded-lg px-2 py-1.5 text-center text-sm outline-none bg-purple-50/30 focus:border-purple-300" 
                                                                value={item.quantity} 
                                                                onChange={(e) => { 
                                                                    const newItems = [...tachThuaItems]; 
                                                                    newItems[idx].quantity = parseInt(e.target.value) || 0; 
                                                                    setTachThuaItems(newItems); 
                                                                }} 
                                                            />
                                                        </td>
                                                        <td className="p-2 text-right text-gray-600 font-mono text-xs">
                                                            {currentPrice.toLocaleString('vi-VN')}
                                                        </td>
                                                        <td className="p-2 text-right text-purple-700 font-mono font-bold text-xs">
                                                            {lineTotal.toLocaleString('vi-VN')}
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            <button 
                                                                type="button" 
                                                                onClick={() => setTachThuaItems(prev => prev.filter((_, i) => i !== idx))} 
                                                                className="text-red-400 hover:text-red-600 bg-red-50 p-1.5 rounded-md hover:bg-red-100 transition-colors"
                                                            >
                                                                <Trash2 size={14}/>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    <button 
                                        type="button" 
                                        onClick={() => setTachThuaItems(prev => [...prev, { serviceName: '', quantity: 1, price: 0, area: undefined, landPlot: '', mapSheet: '' }])} 
                                        className="w-full py-2.5 bg-purple-50 text-purple-600 text-xs font-bold hover:bg-purple-100 border-t border-purple-100 flex items-center justify-center gap-1 transition-colors"
                                    >
                                        <Plus size={14}/> Thêm thửa đất mới
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col md:flex-row justify-end gap-6 pt-4 border-t border-purple-200 mt-2">
                            <div className="text-right">
                                <span className="text-xs text-purple-600 uppercase font-bold block mb-1">Thuế VAT ({formData.vatRate}%)</span>
                                <span className="font-medium text-slate-700 bg-white/50 px-2 py-1 rounded border border-purple-100">{(formData.vatAmount ?? 0).toLocaleString('vi-VN')}</span>
                            </div>
                            <div className="text-right">
                                <span className={`text-xs uppercase font-bold block mb-1 ${isLiquidationMode ? 'text-orange-600' : 'text-purple-600'}`}>
                                    {isLiquidationMode ? 'GIÁ TRỊ THANH LÝ' : 'TỔNG GIÁ TRỊ HĐ'}
                                </span>
                                <span className={`text-2xl font-black px-3 py-1 rounded-lg shadow-sm border ${isLiquidationMode ? 'text-orange-700 border-orange-100 bg-orange-100/50' : 'text-purple-700 border-purple-100 bg-white'}`}>
                                    {displayTotalAmount.toLocaleString('vi-VN')} <span className="text-sm font-medium text-slate-500">VNĐ</span>
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <label className={labelClass}>Ghi chú hợp đồng</label>
                        <textarea rows={3} className={`${inputClass} resize-none`} value={formData.content ?? ''} onChange={e => handleChange('content', e.target.value)} placeholder="Nội dung chi tiết..." />
                    </div>

                    {/* ACTION BUTTONS */}
                    <div className="grid grid-cols-1 gap-3 pt-2">
                        <div className="flex gap-2">
                            <button type="submit" disabled={loading} className={`flex-1 text-white py-3 rounded-xl font-bold text-lg shadow-lg transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2 ${isLiquidationMode ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-500/30' : 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/30'}`}>
                                <Save size={20} /> {loading ? 'Đang xử lý...' : (initialData ? (isLiquidationMode ? 'CẬP NHẬT VÀ IN THANH LÝ' : 'CẬP NHẬT VÀ IN HỢP ĐỒNG') : (isLiquidationMode ? 'LƯU VÀ IN THANH LÝ' : 'LƯU VÀ IN HỢP ĐỒNG'))}
                            </button>
                            <button type="button" onClick={() => handleReset(false)} className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors shadow-sm font-bold border border-slate-200" title="Làm mới form">
                                {initialData ? <X size={20} className="text-red-500" /> : <RotateCcw size={20} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </form>
  );
};

export default ContractForm;

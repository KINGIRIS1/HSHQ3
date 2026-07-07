import React from 'react';
import { RecordFile, Employee, User, RecordStatus, Holiday } from '../types';
import RecordModal from './RecordModal';
import ImportModal from './ImportModal';
import AssignModal from './AssignModal';
import { DetailModal } from './DetailModal';
import { MobileDetailModal } from './mobile/MobileDetailModal';
import { useIsMobile } from '../hooks/useIsMobile';
import DeleteConfirmModal from './DeleteConfirmModal';
import ExportModal from './ExportModal';
import AddToBatchModal from './AddToBatchModal';
import ExcelPreviewModal from './ExcelPreviewModal';
import BulkUpdateModal from './BulkUpdateModal';
import ReturnResultModal from './ReturnResultModal';
import * as XLSX from 'xlsx-js-style';

interface AppModalsProps {
    // States
    isModalOpen: boolean;
    isImportModalOpen: boolean;
    isSettingsOpen: boolean; // Kept for prop compatibility but unused
    isAssignModalOpen: boolean;
    isDeleteModalOpen: boolean;
    isExportModalOpen: boolean;
    isAddToBatchModalOpen: boolean;
    isExcelPreviewOpen: boolean;
    isBulkUpdateModalOpen: boolean;
    isReturnModalOpen: boolean;
    
    // Data States
    editingRecord: RecordFile | null;
    viewingRecord: RecordFile | null;
    deletingRecord: RecordFile | null;
    returnRecord: RecordFile | null;
    assignTargetRecords: RecordFile[];
    exportModalType: 'handover' | 'check_list' | 'returned';
    
    // Preview Data
    previewWorkbook: XLSX.WorkBook | null;
    previewExcelName: string;

    // Setters
    setIsModalOpen: (v: boolean) => void;
    setIsImportModalOpen: (v: boolean) => void;
    setIsSettingsOpen: (v: boolean) => void;
    setIsAssignModalOpen: (v: boolean) => void;
    setIsDeleteModalOpen: (v: boolean) => void;
    setIsExportModalOpen: (v: boolean) => void;
    setIsAddToBatchModalOpen: (v: boolean) => void;
    setIsExcelPreviewOpen: (v: boolean) => void;
    setIsBulkUpdateModalOpen: (v: boolean) => void;
    setIsReturnModalOpen: (v: boolean) => void;
    
    setEditingRecord: (r: RecordFile | null) => void;
    setViewingRecord: (r: RecordFile | null) => void;
    setDeletingRecord: (r: RecordFile | null) => void;
    setReturnRecord: (r: RecordFile | null) => void;

    // Handlers
    handleAddOrUpdate: (data: any) => Promise<RecordFile | null>;
    handleImportRecords: (data: RecordFile[], mode: 'create' | 'update') => Promise<boolean>;
    handleSaveEmployee: (emp: Employee) => void;
    handleDeleteEmployee: (id: string) => void;
    handleDeleteAllData: () => void;
    onRefreshData?: () => void; // New callback
    confirmAssign: (empId: string, workflowType?: string | null) => void;
    handleDeleteRecord: () => void;
    confirmDelete: (r: RecordFile) => void;
    handleExcelPreview: (wb: XLSX.WorkBook, name: string) => void;
    executeBatchExport: (batch: number, date: string) => void;
    onCreateLiquidation: (record: RecordFile) => void;
    onDraftMinutes?: (record: RecordFile) => void;
    handleBulkUpdate: (field: keyof RecordFile, value: any) => Promise<void>;
    confirmReturnResult: (receiptNumber: string, receiverName: string, receiptType: 'receipt' | 'invoice', paymentAmount: number | null) => void;

    // Shared Data
    employees: Employee[];
    users: User[];
    currentUser: User;
    wards: string[];
    filteredRecords: RecordFile[];
    records: RecordFile[];
    selectedCount: number;
    canPerformAction: boolean;
    selectedRecordsForBulk: RecordFile[];
    currentView: string;
    holidays: Holiday[];
}

const AppModals: React.FC<AppModalsProps> = (props) => {
    // Xác định danh sách hồ sơ cần chốt để truyền vào modal (cho tính năng cảnh báo)
    const targetRecordsForBatch = props.selectedRecordsForBulk.length > 0 ? props.selectedRecordsForBulk : props.filteredRecords;
    const isMobile = useIsMobile();

    const currentViewingRecord = React.useMemo(() => {
        if (!props.viewingRecord) return null;
        return props.records.find(r => r.id === props.viewingRecord!.id) || props.viewingRecord;
    }, [props.viewingRecord, props.records]);

    return (
        <>
            <RecordModal 
                isOpen={props.isModalOpen}
                onClose={() => { props.setIsModalOpen(false); props.setEditingRecord(null); }}
                onSubmit={props.handleAddOrUpdate}
                initialData={props.editingRecord}
                employees={props.employees}
                currentUser={props.currentUser}
                wards={props.wards}
                currentView={props.currentView}
                holidays={props.holidays}
                records={props.records}
            />
            
            <ImportModal 
                isOpen={props.isImportModalOpen} 
                onClose={() => props.setIsImportModalOpen(false)} 
                onImport={props.handleImportRecords} 
                employees={props.employees} 
                currentView={props.currentView}
            />
            
            <AssignModal 
                isOpen={props.isAssignModalOpen} 
                onClose={() => props.setIsAssignModalOpen(false)} 
                onConfirm={props.confirmAssign} 
                employees={props.employees} 
                selectedRecords={props.assignTargetRecords} 
                currentUser={props.currentUser}
                filterDepartment={(() => {
                    const view = props.currentView;
                    if (['archive_records', 'archive_assign_tasks', 'archive_completed_list', 'archive_pending_check_list', 'archive_check_list', 'archive_handover_list', 'archive_director_completed'].includes(view)) {
                        return 'Lưu trữ';
                    }
                    if (['all_records', 'assign_tasks', 'completed_list', 'pending_check_list', 'check_list', 'handover_list', 'director_completed'].includes(view)) {
                        return 'Đo đạc';
                    }
                    if (['registration_records', 'registration_assign_tasks', 'registration_completed_list', 'registration_pending_check_list', 'registration_check_list', 'registration_handover_list', 'registration_director_completed', 'registration_vao_so'].includes(view)) {
                        return 'Cấp giấy';
                    }
                    if (['congvan_records', 'congvan_assign_tasks', 'congvan_completed_list', 'congvan_check_list', 'congvan_handover_list', 'congvan_director_completed'].includes(view)) {
                        return 'Công văn';
                    }
                    return undefined;
                })()}
            />
            
            {isMobile ? (
                <MobileDetailModal 
                    isOpen={!!props.viewingRecord} 
                    onClose={() => props.setViewingRecord(null)} 
                    record={currentViewingRecord} 
                    employees={props.employees} 
                    users={props.users}
                    currentUser={props.currentUser} 
                    holidays={props.holidays}
                    onEdit={props.canPerformAction ? (r) => { props.setEditingRecord(r); props.setIsModalOpen(true); } : undefined}
                    onDelete={props.canPerformAction ? props.confirmDelete : undefined}
                    onCreateLiquidation={props.onCreateLiquidation}
                    onDraftMinutes={props.onDraftMinutes}
                    onRefreshData={props.onRefreshData}
                />
            ) : (
                <DetailModal 
                    isOpen={!!props.viewingRecord} 
                    onClose={() => props.setViewingRecord(null)} 
                    record={currentViewingRecord} 
                    employees={props.employees} 
                    users={props.users}
                    currentUser={props.currentUser} 
                    holidays={props.holidays}
                    onEdit={props.canPerformAction ? (r) => { props.setEditingRecord(r); props.setIsModalOpen(true); } : undefined}
                    onDelete={props.canPerformAction ? props.confirmDelete : undefined}
                    onCreateLiquidation={props.onCreateLiquidation}
                    onDraftMinutes={props.onDraftMinutes}
                    onRefreshData={props.onRefreshData}
                />
            )}
            
            <DeleteConfirmModal 
                isOpen={props.isDeleteModalOpen} 
                onClose={() => props.setIsDeleteModalOpen(false)} 
                onConfirm={props.handleDeleteRecord} 
                message={`Bạn có chắc chắn muốn xóa hồ sơ ${props.deletingRecord?.code}?`} 
            />
            
            <ExportModal 
                isOpen={props.isExportModalOpen} 
                onClose={() => props.setIsExportModalOpen(false)} 
                records={props.records} 
                wards={props.wards} 
                type={props.exportModalType}
                onPreview={props.handleExcelPreview}
                employees={props.employees}
                currentView={props.currentView}
            />
            
            <AddToBatchModal
                isOpen={props.isAddToBatchModalOpen}
                onClose={() => props.setIsAddToBatchModalOpen(false)}
                onConfirm={props.executeBatchExport}
                records={props.records}
                selectedCount={props.selectedCount}
                targetRecords={targetRecordsForBatch} 
                wards={props.wards}
                currentView={props.currentView}
            />

            <ExcelPreviewModal 
                isOpen={props.isExcelPreviewOpen} 
                onClose={() => props.setIsExcelPreviewOpen(false)} 
                workbook={props.previewWorkbook} 
                fileName={props.previewExcelName} 
            />

            <BulkUpdateModal 
                isOpen={props.isBulkUpdateModalOpen}
                onClose={() => props.setIsBulkUpdateModalOpen(false)}
                selectedRecords={props.selectedRecordsForBulk}
                employees={props.employees}
                wards={props.wards}
                onConfirm={props.handleBulkUpdate}
                currentView={props.currentView}
            />

            <ReturnResultModal
                isOpen={props.isReturnModalOpen}
                onClose={() => { props.setIsReturnModalOpen(false); props.setReturnRecord(null); }}
                record={props.returnRecord}
                onConfirm={props.confirmReturnResult}
            />
        </>
    );
};

export default AppModals;
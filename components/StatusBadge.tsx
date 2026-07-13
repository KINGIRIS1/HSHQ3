import React from 'react';
import { RecordStatus, RecordFile, Employee } from '../types';
import { STATUS_COLORS } from '../constants';
import { getStatusLabel, getGcnWorkflowStepsHelper, isRegType, isMeasurementType, isArchiveType } from '../utils/appHelpers';

interface StatusBadgeProps {
  status: RecordStatus;
  recordType?: string | null;
  record?: RecordFile;
  employees?: Employee[];
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, recordType, record, employees }) => {
  let labelText = getStatusLabel(status, recordType, record);
  
  if (record && employees) {
    const isReg = isRegType(record.recordType || recordType);
    
    if (isReg) {
      const terminalStatuses = [RecordStatus.RETURNED, RecordStatus.WITHDRAWN, RecordStatus.REJECTED];
      if (!terminalStatuses.includes(status)) {
        try {
          const helper = getGcnWorkflowStepsHelper(record, []);
          if (helper && helper.steps) {
            const currentStep = helper.steps.find(s => s.status === 'current');
            if (currentStep) {
              labelText = currentStep.label;
            }
          }
        } catch (e) {
          console.error("Error formatting step badge:", e);
        }
      }
    }
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-sm leading-tight text-center ${STATUS_COLORS[status]}`}>
      {labelText}
    </span>
  );
};

export default StatusBadge;

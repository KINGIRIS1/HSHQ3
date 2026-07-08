
import React from 'react';
import { RecordStatus, RecordFile } from '../types';
import { STATUS_COLORS } from '../constants';
import { getStatusLabel } from '../utils/appHelpers';

interface StatusBadgeProps {
  status: RecordStatus;
  recordType?: string | null;
  record?: RecordFile;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, recordType, record }) => {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
      {getStatusLabel(status, recordType, record)}
    </span>
  );
};

export default StatusBadge;

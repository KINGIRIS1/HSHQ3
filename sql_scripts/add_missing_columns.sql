ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "customerAddress" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "issueNumber" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "entryNumber" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "issueDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "residentialArea" numeric;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "needsMapCorrection" boolean;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "receiptNumber" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "resultReturnedDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "receiverName" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "reminderDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "lastRemindedAt" timestamp;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "measurementNumber" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "excerptNumber" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "exportBatch" numeric;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "exportDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "authorizedBy" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "authDocType" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "otherDocs" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "privateNotes" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "personalNotes" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "hasDefect" boolean DEFAULT false;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "defectReason" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "defectDate" timestamp;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "receiptPhoto" text;

-- 1. Thêm cột trạng thái đồng bộ Một cửa về phòng chuyên môn
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "isDeptSynced" boolean DEFAULT false;

-- 2. Thêm các cột bổ sung hữu ích khác để tối ưu tính năng biên lai và từ chối hồ sơ
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "receiptType" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "paymentAmount" numeric;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "rejectReason" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "rejectDate" timestamp;

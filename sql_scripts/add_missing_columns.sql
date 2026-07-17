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

-- 3. Thêm cột updated_at để phục vụ tải tăng dần (Incremental Fetch)
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now());

-- Tạo trigger tự động cập nhật updated_at cho land_records
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_land_records_updated_at ON land_records;
CREATE TRIGGER update_land_records_updated_at
    BEFORE UPDATE ON land_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


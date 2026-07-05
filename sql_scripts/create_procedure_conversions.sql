-- Bảng lưu trữ cấu hình ánh xạ đồng bộ thủ tục cũ và mới (Luật Đất đai 2013 sang Luật Đất đai 2024)
CREATE TABLE IF NOT EXISTS public.procedure_conversions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    thu_tuc_cu TEXT NOT NULL UNIQUE,
    thu_tuc_moi TEXT NOT NULL
);

-- Thêm index để tăng tốc độ truy vấn đối chiếu
CREATE INDEX IF NOT EXISTS idx_procedure_conversions_thu_tuc_cu ON public.procedure_conversions(thu_tuc_cu);

-- Kích hoạt mã bảo mật RLS (Row Level Security)
ALTER TABLE public.procedure_conversions ENABLE ROW LEVEL SECURITY;

-- Tạo chính sách an toàn cho phép tất cả thao tác
CREATE POLICY "Cho phép tất cả thao tác trên procedure_conversions" 
ON public.procedure_conversions 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- คอลัมน์สำหรับผู้ขาย (รันใน Supabase SQL Editor หลังมีตาราง profiles)
-- bank_name / bank_account_number ใช้เก็บข้อมูลรับเงินเมื่อสมัครเป็นผู้ขาย

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS seller_registered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seller_contact_note TEXT;

COMMENT ON COLUMN public.profiles.bank_name IS 'ชื่อธนาคารสำหรับโอนเงิน (ผู้ขาย)';
COMMENT ON COLUMN public.profiles.bank_account_number IS 'เลขบัญชีธนาคาร (ผู้ขาย)';
COMMENT ON COLUMN public.profiles.seller_registered_at IS 'เวลาที่ยืนยันสมัครเป็นผู้ขาย';
COMMENT ON COLUMN public.profiles.seller_contact_note IS 'ช่องทางติดต่อที่ผู้ขายแนบไว้';

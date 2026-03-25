-- อัปเดต trigger ให้ role ตอนสมัครใหม่เป็น 'user' เสมอ (ไม่อ่านจาก metadata)
-- รันครั้งเดียวถ้าโปรเจกต์ยังใช้ฟังก์ชันเดิมที่อนุญาต role จาก raw_user_meta_data

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

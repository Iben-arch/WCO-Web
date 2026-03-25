/** ผู้ที่สามารถสร้างโพสต์ / ใช้ปุ่มขายการ์ด (ทำเครื่องหมายขายแล้ว ฯลฯ) */
export function canSellCards(role: string | undefined | null): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return r === 'seller' || r === 'admin';
}

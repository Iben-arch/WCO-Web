import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { CartItem } from '../types';
import { ordersAPI } from '../api/api';
import { toast } from 'react-toastify';

/* ───── tiny inline Modal (no bootstrap) ───── */
const Modal: React.FC<{ show: boolean; onHide: () => void; children: React.ReactNode }> = ({ show, onHide, children }) => {
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onHide}
    >
      <div
        className="bg-base-100 rounded-2xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

const Cart: React.FC = () => {
  const { cartItems, loading, removeFromCart, clearCart, formatPrice, fetchCartItems } = useCart();
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [removingItem, setRemovingItem]       = useState<string | null>(null);
  const [showClearModal, setShowClearModal]   = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutAddress, setCheckoutAddress] = useState('');
  const [checkoutPhone, setCheckoutPhone]     = useState('');
  const [clearingCart, setClearingCart]       = useState(false);
  const [checkingOut, setCheckingOut]         = useState(false);
  const [selectedItems, setSelectedItems]     = useState<Set<string>>(new Set());

  const normalCartItems = cartItems;

  const getItemKey = (item: CartItem) => item.id || `${item.postId}_${item.cardId || ''}`;

  const getItemUnitPrice = (item: CartItem): number => {
    if (item.unitPrice != null && item.unitPrice > 0) return item.unitPrice;
    if (item.cardId && item.post.individualCards?.length) {
      const card = item.post.individualCards.find((c: { id?: string }) => c.id === item.cardId);
      if (card && typeof (card as { price?: number }).price === 'number') return (card as { price: number }).price;
    }
    return item.post.individualPrice ?? item.post.price ?? item.post.currentBid ?? 0;
  };

  useEffect(() => {
    if (currentUser) fetchCartItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  useEffect(() => {
    if (normalCartItems.length > 0) {
      setSelectedItems(new Set(normalCartItems.map(getItemKey)));
    }
  }, [normalCartItems]);

  const handleRemoveItem = async (item: CartItem) => {
    const key = getItemKey(item);
    setRemovingItem(key);
    try {
      const result = await removeFromCart(item.id || item.postId, item.cardId);
      result.success ? toast.success(result.message) : toast.error(result.message);
    } catch {
      toast.error('เกิดข้อผิดพลาดในการลบรายการ');
    } finally {
      setRemovingItem(null);
    }
  };

  const handleClearCart = async () => {
    setClearingCart(true);
    try {
      const result = await clearCart();
      if (result.success) { toast.success(result.message); setShowClearModal(false); }
      else toast.error(result.message);
    } catch {
      toast.error('เกิดข้อผิดพลาดในการล้างตะกร้า');
    } finally {
      setClearingCart(false);
    }
  };

  const handleToggleItem = (key: string) => {
    const next = new Set(selectedItems);
    next.has(key) ? next.delete(key) : next.add(key);
    setSelectedItems(next);
  };

  const handleSelectAll = () => {
    setSelectedItems(
      selectedItems.size === normalCartItems.length
        ? new Set()
        : new Set(normalCartItems.map(getItemKey))
    );
  };

  const getSelectedTotal = () =>
    normalCartItems
      .filter(item => selectedItems.has(getItemKey(item)))
      .reduce((sum, item) => sum + getItemUnitPrice(item) * (item.quantity ?? 1), 0);

  const openCheckoutModal = () => {
    setCheckoutAddress(userProfile?.address ?? (userProfile as any)?.address ?? '');
    setCheckoutPhone(userProfile?.phone ?? (userProfile as any)?.phone ?? '');
    setShowCheckoutModal(true);
  };

  const handleCheckout = () => {
    if (!currentUser) { navigate('/login'); return; }
    const selected = normalCartItems.filter(item => selectedItems.has(getItemKey(item)));
    if (selected.length === 0) { toast.warning('กรุณาเลือกสินค้าที่ต้องการซื้อ'); return; }
    const ids = selected.map(i => i.id).filter((id): id is string => !!id);
    if (ids.length === 0) { toast.error('ไม่พบรหัสรายการตะกร้า กรุณารีเฟรชหน้า'); return; }
    openCheckoutModal();
  };

  const handleConfirmCheckout = async () => {
    if (!currentUser) { navigate('/login'); return; }
    const address = checkoutAddress?.trim();
    const phone   = checkoutPhone?.trim();
    if (!address) { toast.warning('กรุณากรอกที่อยู่จัดส่ง'); return; }
    if (!phone)   { toast.warning('กรุณากรอกเบอร์โทร'); return; }

    const selected = normalCartItems.filter(item => selectedItems.has(getItemKey(item)));
    if (selected.length === 0) { toast.warning('กรุณาเลือกสินค้าที่ต้องการซื้อ'); return; }
    const cartItemIds = selected
      .map(item => (item as any).id ?? item.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    if (cartItemIds.length === 0) { toast.error('ไม่พบรหัสรายการตะกร้า กรุณารีเฟรชหน้า'); return; }

    setCheckingOut(true);
    try {
      const result = await ordersAPI.checkout({ cartItemIds, shippingAddress: address, shippingPhone: phone });
      if (result.success) {
        toast.success(result.message || 'สั่งซื้อสำเร็จ');
        setShowCheckoutModal(false);
        setCheckoutAddress('');
        setCheckoutPhone('');
        await fetchCartItems();
        navigate('/profile', { state: { tab: 'orders' } });
      } else {
        toast.error(result.error || 'เกิดข้อผิดพลาดในการสั่งซื้อ');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการสั่งซื้อ');
    } finally {
      setCheckingOut(false);
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 bg-base-200/40">
        <span className="loading loading-spinner loading-lg text-primary" />
        <p className="text-sm text-base-content/50">กำลังโหลดตะกร้า...</p>
      </div>
    );
  }

  /* ── Empty cart ── */
  if (normalCartItems.length === 0) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-base-200/40 p-4">
        <div className="bg-base-100 rounded-2xl border border-base-300 shadow-sm p-10 text-center max-w-sm w-full">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary/60">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
          </div>
          <h3 className="font-bold text-lg text-base-content mb-2">ตะกร้าของคุณว่างอยู่</h3>
          <p className="text-sm text-base-content/50 mb-6 leading-relaxed">
            ยังไม่มีสินค้าในตะกร้า<br />ไปเลือกสินค้าที่ต้องการกันเถอะ!
          </p>
          <Link to="/" className="btn btn-primary w-full">ไปเลือกสินค้า</Link>
        </div>
      </div>
    );
  }

  const allSelected  = selectedItems.size === normalCartItems.length;
  const someSelected = selectedItems.size > 0;

  /* ── Main cart ── */
  return (
    <div className="min-h-screen bg-base-200/40 pb-12">
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-base-content flex items-center gap-2">
                ตะกร้าของฉัน
                <span className="badge badge-primary badge-sm">{normalCartItems.length} รายการ</span>
              </h1>
              <p className="text-xs text-base-content/50 mt-0.5">เลือกรายการแล้วดำเนินการซื้อ</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">

          {/* ── Left: Cart items ── */}
          <div className="bg-base-100 rounded-2xl border border-base-300 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-base-300 flex items-center justify-between bg-base-100">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary checkbox-sm"
                  checked={allSelected && normalCartItems.length > 0}
                  onChange={handleSelectAll}
                />
                <span className="text-sm font-medium text-base-content">
                  เลือกทั้งหมด
                </span>
              </label>
              <span className="text-xs text-base-content/40">{normalCartItems.length} รายการ</span>
            </div>

            {/* Item list */}
            <div className="divide-y divide-base-300">
              {normalCartItems.map((item: CartItem) => {
                const itemKey = getItemKey(item);
                const isSelected = selectedItems.has(itemKey);
                const isRemoving = removingItem === itemKey;
                const displayImage = item.cardId && item.post.individualCards
                  ? item.post.individualCards.find(c => c.id === item.cardId)?.imageUrl
                  : item.post.images?.[0];
                const unitPrice = getItemUnitPrice(item);
                const qty = item.quantity ?? 1;

                return (
                  <div
                    key={itemKey}
                    className={`flex items-center gap-3 px-5 py-4 transition-colors duration-150 ${isSelected ? 'bg-primary/[0.03]' : 'bg-base-100'} hover:bg-base-50`}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary checkbox-sm shrink-0"
                      checked={isSelected}
                      onChange={() => handleToggleItem(itemKey)}
                    />

                    {/* Image */}
                    <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden border border-base-300 bg-base-200">
                      {displayImage ? (
                        <img src={displayImage} alt={item.post.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-base-content/20">
                            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/post/${item.postId}`}
                        className="font-semibold text-sm text-base-content hover:text-primary transition-colors line-clamp-2 block mb-1.5"
                      >
                        {item.post.title}
                      </Link>
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="badge badge-ghost badge-sm">{item.post.category}</span>
                        {item.post.status === 'sold' && (
                          <span className="badge badge-error badge-sm">ขายแล้ว</span>
                        )}
                      </div>
                      <p className="text-xs text-base-content/40">
                        ผู้ขาย:{' '}
                        <Link to={`/seller/${item.post.sellerId}`} className="text-primary hover:underline">
                          {item.post.sellerName}
                        </Link>
                      </p>
                    </div>

                    {/* Price + remove */}
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <p className="font-bold text-primary text-base">
                        {formatPrice(unitPrice * qty)}
                      </p>
                      {qty > 1 && (
                        <p className="text-xs text-base-content/40">{formatPrice(unitPrice)} × {qty}</p>
                      )}
                      <button
                        className="btn btn-ghost btn-xs text-error hover:bg-error/10"
                        onClick={() => handleRemoveItem(item)}
                        disabled={isRemoving}
                        title="ลบออกจากตะกร้า"
                      >
                        {isRemoving ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Right: Summary ── */}
          <div className="lg:sticky lg:top-4 space-y-3">
            <div className="bg-base-100 rounded-2xl border border-base-300 shadow-sm overflow-hidden">
              {/* Summary header */}
              <div className="px-5 py-4 border-b border-base-300 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                <h3 className="font-semibold text-base-content">สรุปตะกร้า</h3>
              </div>

              <div className="p-5 space-y-3">
                {/* Stats */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-base-content/60">รายการที่เลือก</span>
                  <span className="font-medium text-base-content">
                    {selectedItems.size} / {normalCartItems.length}
                  </span>
                </div>
                <div className="divider my-0" />
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-base-content">ยอดรวม</span>
                  <span className="text-xl font-bold text-primary">{formatPrice(getSelectedTotal())}</span>
                </div>

                {/* CTA */}
                <button
                  className="btn btn-primary w-full mt-2 gap-2"
                  onClick={handleCheckout}
                  disabled={!someSelected || checkingOut}
                >
                  {checkingOut ? (
                    <><span className="loading loading-spinner loading-sm" />กำลังดำเนินการ...</>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                      </svg>
                      ดำเนินการซื้อ ({selectedItems.size})
                    </>
                  )}
                </button>

                <button
                  className="btn btn-ghost btn-sm w-full text-error hover:bg-error/10 gap-1.5"
                  onClick={() => setShowClearModal(true)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                  </svg>
                  ล้างตะกร้าทั้งหมด
                </button>
              </div>
            </div>

            {/* Info note */}
            <div className="flex gap-2.5 p-3.5 rounded-xl bg-info/10 border border-info/20 text-info">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-xs leading-relaxed">
                กด "ดำเนินการซื้อ" เพื่อยืนยันคำสั่งซื้อ สถานะจะเป็น <strong>รอจัดส่ง</strong> หลังจากผู้ขายยืนยันและแนบใบเสร็จ
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Checkout Modal ── */}
      <Modal show={showCheckoutModal} onHide={() => !checkingOut && setShowCheckoutModal(false)}>
        <div className="px-6 py-4 border-b border-base-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
            <h3 className="font-bold text-base-content">ยืนยันการสั่งซื้อ</h3>
          </div>
          {!checkingOut && (
            <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowCheckoutModal(false)}>✕</button>
          )}
        </div>

        <div className="p-6 space-y-4">
          <div className="form-control">
            <label className="label pb-1">
              <span className="label-text font-medium">ที่อยู่จัดส่ง</span>
              <span className="label-text-alt text-base-content/40">ดึงจากโปรไฟล์อัตโนมัติ</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full resize-none"
              rows={3}
              placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
              value={checkoutAddress}
              onChange={(e) => setCheckoutAddress(e.target.value)}
              disabled={checkingOut}
            />
          </div>

          <div className="form-control">
            <label className="label pb-1">
              <span className="label-text font-medium">เบอร์โทรศัพท์</span>
            </label>
            <input
              type="tel"
              className="input input-bordered w-full"
              placeholder="เช่น 08x-xxx-xxxx"
              value={checkoutPhone}
              onChange={(e) => setCheckoutPhone(e.target.value)}
              disabled={checkingOut}
            />
          </div>

          {/* Total preview */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/15">
            <span className="text-sm text-base-content/70">ยอดสั่งซื้อ ({selectedItems.size} รายการ)</span>
            <span className="font-bold text-primary">{formatPrice(getSelectedTotal())}</span>
          </div>

          <div className="flex gap-2 items-start p-3 rounded-xl bg-warning/10 border border-warning/20 text-warning-content">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5 text-warning">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p className="text-xs text-warning">การชำระเงินเป็นแบบ mock — ไม่มีการหักเงินจริง</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-base-300 flex gap-2 justify-end">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowCheckoutModal(false)} disabled={checkingOut}>
            ยกเลิก
          </button>
          <button
            className="btn btn-primary btn-sm gap-2"
            onClick={handleConfirmCheckout}
            disabled={!checkoutAddress?.trim() || !checkoutPhone?.trim() || checkingOut}
          >
            {checkingOut ? (
              <><span className="loading loading-spinner loading-xs" />กำลังดำเนินการ...</>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                ยืนยันสั่งซื้อ
              </>
            )}
          </button>
        </div>
      </Modal>

      {/* ── Clear cart Modal ── */}
      <Modal show={showClearModal} onHide={() => setShowClearModal(false)}>
        <div className="px-6 py-4 border-b border-base-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-error">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
            <h3 className="font-bold text-base-content">ล้างตะกร้า</h3>
          </div>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowClearModal(false)}>✕</button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-base-content/80">คุณต้องการล้างตะกร้าทั้งหมดหรือไม่?</p>
          <div className="flex gap-2 items-start p-3 rounded-xl bg-error/10 border border-error/20">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5 text-error">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p className="text-xs text-error">การดำเนินการนี้ไม่สามารถย้อนกลับได้ รายการทั้งหมดจะถูกลบออก</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-base-300 flex gap-2 justify-end">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowClearModal(false)} disabled={clearingCart}>
            ยกเลิก
          </button>
          <button className="btn btn-error btn-sm gap-2" onClick={handleClearCart} disabled={clearingCart}>
            {clearingCart ? (
              <><span className="loading loading-spinner loading-xs" />กำลังล้าง...</>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                </svg>
                ยืนยันการล้าง
              </>
            )}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default Cart;

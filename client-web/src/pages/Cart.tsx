import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Alert, Spinner, Badge, Modal, Form } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { CartItem } from '../types';
import { ordersAPI } from '../api/api';
import { toast } from 'react-toastify';
import { PrimaryActionButton, SecondaryActionButton } from '../components/common/ButtonComponents';
import '../styles/cart.css';

const Cart: React.FC = () => {
  const { cartItems, loading, error, removeFromCart, clearCart, getTotalPrice, formatPrice, fetchCartItems } = useCart();
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [removingItem, setRemovingItem] = useState<string | null>(null);
  const [showClearModal, setShowClearModal] = useState<boolean>(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [checkoutAddress, setCheckoutAddress] = useState<string>('');
  const [checkoutPhone, setCheckoutPhone] = useState<string>('');
  const [clearingCart, setClearingCart] = useState<boolean>(false);
  const [checkingOut, setCheckingOut] = useState<boolean>(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // รวมทั้ง sale และ auction ที่ชนะแล้ว
  const normalCartItems = cartItems;

  const getItemKey = (item: CartItem): string => item.id || `${item.postId}_${item.cardId || ''}`;

  /** ราคาต่อหน่วย: ถ้ามี cardId ใช้ราคาจาก individualCards[].price ก่อน (ให้ตรงกับที่กดในโพสต์) */
  const getItemUnitPrice = (item: CartItem): number => {
    if (item.unitPrice != null && item.unitPrice > 0) return item.unitPrice;
    if (item.cardId && item.post.individualCards?.length) {
      const card = item.post.individualCards.find((c: { id?: string }) => c.id === item.cardId);
      if (card && typeof (card as { price?: number }).price === 'number') return (card as { price: number }).price;
    }
    return item.post.individualPrice ?? item.post.price ?? item.post.currentBid ?? 0;
  };

  // Refresh cart items when component mounts
  useEffect(() => {
    if (currentUser) {
      fetchCartItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Select all items by default when cart items change
  useEffect(() => {
    if (normalCartItems.length > 0) {
      setSelectedItems(new Set(normalCartItems.map(getItemKey)));
    }
  }, [normalCartItems]);

  const handleRemoveItem = async (item: CartItem): Promise<void> => {
    const itemKey = getItemKey(item);
    setRemovingItem(itemKey);
    try {
      const result = await removeFromCart(item.id || item.postId, item.cardId);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการลบรายการ');
    } finally {
      setRemovingItem(null);
    }
  };

  const handleClearCart = async (): Promise<void> => {
    setClearingCart(true);
    try {
      const result = await clearCart();
      if (result.success) {
        toast.success(result.message);
        setShowClearModal(false);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการล้างตะกร้า');
    } finally {
      setClearingCart(false);
    }
  };

  const handleToggleItem = (postId: string): void => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(postId)) {
      newSelected.delete(postId);
    } else {
      newSelected.add(postId);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = (): void => {
    if (selectedItems.size === normalCartItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(normalCartItems.map(getItemKey)));
    }
  };

  const getSelectedTotal = (): number => {
    return normalCartItems
      .filter(item => selectedItems.has(getItemKey(item)))
      .reduce((total, item) => {
        const price = getItemUnitPrice(item);
        const qty = item.quantity ?? 1;
        return total + price * qty;
      }, 0);
  };

  const openCheckoutModal = (): void => {
    setCheckoutAddress(userProfile?.address ?? (userProfile as any)?.address ?? '');
    setCheckoutPhone(userProfile?.phone ?? (userProfile as any)?.phone ?? '');
    setShowCheckoutModal(true);
  };

  const handleConfirmCheckout = async (): Promise<void> => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    const address = checkoutAddress?.trim();
    if (!address) {
      toast.warning('กรุณากรอกที่อยู่จัดส่ง หรือเพิ่มที่อยู่ในโปรไฟล์');
      return;
    }
    const phone = checkoutPhone?.trim();
    if (!phone) {
      toast.warning('กรุณากรอกเบอร์โทร หรือเพิ่มเบอร์โทรในโปรไฟล์');
      return;
    }

    const selected = normalCartItems.filter(item => selectedItems.has(getItemKey(item)));
    if (selected.length === 0) {
      toast.warning('กรุณาเลือกสินค้าที่ต้องการซื้อ');
      return;
    }
    const cartItemIds = selected
      .map(item => (item as any).id ?? (item as any).Id ?? item.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    if (cartItemIds.length === 0) {
      toast.error('ไม่พบรหัสรายการตะกร้า กรุณารีเฟรชหน้า');
      return;
    }

    setCheckingOut(true);
    try {
      const result = await ordersAPI.checkout({ cartItemIds, shippingAddress: address, shippingPhone: phone });
      if (result.success) {
        toast.success(result.message || 'สั่งซื้อสำเร็จ สถานะ: รอจัดส่ง');
        setShowCheckoutModal(false);
        setCheckoutAddress('');
        setCheckoutPhone('');
        await fetchCartItems();
        navigate('/profile', { state: { tab: 'orders' } });
      } else {
        toast.error(result.error || 'เกิดข้อผิดพลาดในการสั่งซื้อ');
      }
    } catch (e) {
      toast.error('เกิดข้อผิดพลาดในการสั่งซื้อ');
    } finally {
      setCheckingOut(false);
    }
  };

  const handleCheckout = (): void => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    const selected = normalCartItems.filter(item => selectedItems.has(getItemKey(item)));
    if (selected.length === 0) {
      toast.warning('กรุณาเลือกสินค้าที่ต้องการซื้อ');
      return;
    }
    const cartItemIds = selected.map(item => item.id).filter((id): id is string => !!id);
    if (cartItemIds.length === 0) {
      toast.error('ไม่พบรหัสรายการตะกร้า กรุณารีเฟรชหน้า');
      return;
    }
    openCheckoutModal();
  };

  if (loading) {
    return (
      <div className="cart-loading">
        <Container className="py-5">
          <div className="d-flex justify-content-center">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
          </div>
        </Container>
      </div>
    );
  }

  // Don't show error state - show empty cart instead for better UX
  // if (error) {
  //   return (
  //     <Container className="py-5">
  //       <Alert variant="danger">
  //         <h4>เกิดข้อผิดพลาด</h4>
  //         <p>{error}</p>
  //         <Button variant="primary" onClick={() => window.location.reload()}>
  //           รีเฟรชหน้า
  //         </Button>
  //       </Alert>
  //     </Container>
  //   );
  // }

  return (
    <div className="cart-container">
      <Container className="cart-container-inner py-5">
        <Row className="mb-4">
          <Col>
            <header className="cart-page-header">
              <div className="cart-page-header-inner">
                <h1 className="cart-page-title">
                  ตะกร้าของฉัน
                  {normalCartItems.length > 0 && (
                    <Badge bg="primary" className="cart-page-badge ms-2">
                      {normalCartItems.length} รายการ
                    </Badge>
                  )}
                </h1>
                <p className="cart-page-subtitle">รายการสินค้าที่คุณต้องการซื้อ — เลือกรายการแล้วดำเนินการซื้อ</p>
              </div>
            </header>
          </Col>
        </Row>

        {loading ? (
          <div className="cart-loading">
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
              <Spinner animation="border" role="status">
                <span className="visually-hidden">กำลังโหลด...</span>
              </Spinner>
            </div>
          </div>
        ) : normalCartItems.length === 0 ? (
          <div className="cart-empty-state">
            <Card className="cart-empty-card">
              <Card.Body>
                <div className="cart-empty-icon" aria-hidden>
                  <i className="fas fa-shopping-cart" />
                </div>
                <h3 className="cart-empty-title">ไม่มีสินค้าในตะกร้า</h3>
                <p className="cart-empty-description">
                  ยังไม่มีสินค้าในตะกร้า<br />
                  ไปเลือกสินค้าที่ต้องการซื้อกันเถอะ!
                </p>
                <PrimaryActionButton as={Link as any} to="/" icon={<i className="fas fa-store" />}>
                  ไปเลือกสินค้า
                </PrimaryActionButton>
              </Card.Body>
            </Card>
          </div>
        ) : (
          <>
            {/* Cart Items */}
            <Row>
              <Col lg={8}>
                <Card className="cart-items-card mb-4">
                  <Card.Header className="cart-items-header">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="d-flex align-items-center">
                        <Form.Check
                          type="checkbox"
                          checked={normalCartItems.length > 0 && selectedItems.size === normalCartItems.length}
                          onChange={handleSelectAll}
                          className="me-3"
                          label="เลือกทั้งหมด"
                        />
                      </div>
                      <span className="cart-items-count">
                        {normalCartItems.length} รายการ
                      </span>
                    </div>
                  </Card.Header>
                  <Card.Body className="p-0">
                    <div className="cart-items-list">
                      {normalCartItems.map((item: CartItem) => {
                        const itemKey = getItemKey(item);
                        const displayImage = item.cardId && item.post.individualCards
                          ? item.post.individualCards.find(c => c.id === item.cardId)?.imageUrl
                          : item.post.images?.[0];
                        return (
                        <div key={itemKey} className="cart-item-row">
                          <div className="cart-item-checkbox">
                            <Form.Check
                              type="checkbox"
                              checked={selectedItems.has(itemKey)}
                              onChange={() => handleToggleItem(itemKey)}
                            />
                          </div>
                          <div className="cart-item-image-wrapper">
                            {displayImage ? (
                              <img
                                src={displayImage}
                                alt={item.post.title}
                                className="cart-item-image"
                              />
                            ) : item.post.images && item.post.images.length > 0 ? (
                              <img
                                src={item.post.images[0]}
                                alt={item.post.title}
                                className="cart-item-image"
                              />
                            ) : (
                              <div className="cart-item-image-placeholder">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                  <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="2 2"/>
                                  <circle cx="8.5" cy="8.5" r="1.5"/>
                                  <path d="M21 15l-5-5L5 21"/>
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="cart-item-info">
                            <h6 className="cart-item-name">
                              <Link to={`/post/${item.postId}`} className="text-decoration-none">
                                {item.post.title}
                              </Link>
                            </h6>
                            <div className="cart-item-meta-info">
                              <Badge className="me-2" bg="secondary">
                                {item.post.category}
                              </Badge>
                              <span className="cart-item-seller-info">
                                ผู้ขาย: <Link to={`/seller/${item.post.sellerId}`} className="seller-link">{item.post.sellerName}</Link>
                              </span>
                            </div>
                            {item.post.status === 'sold' && (
                              <Badge bg="danger" className="mt-2"><i className="fas fa-check-circle me-1" aria-hidden />ขายแล้ว</Badge>
                            )}
                          </div>
                          <div className="cart-item-price-section">
                            <div className="cart-item-price-value">
                              {formatPrice(getItemUnitPrice(item) * (item.quantity ?? 1))}
                              {item.quantity && item.quantity > 1 && (
                                <small className="text-muted ms-1">x{item.quantity}</small>
                              )}
                            </div>
                            <Button
                              variant="link"
                              className="cart-item-remove-btn"
                              onClick={() => handleRemoveItem(item)}
                              disabled={removingItem === itemKey}
                            >
                              {removingItem === itemKey ? (
                                <Spinner size="sm" as="span" />
                              ) : (
                                <i className="fas fa-trash-alt" aria-hidden />
                              )}
                            </Button>
                          </div>
                        </div>
                      );})}
                    </div>
                  </Card.Body>
                </Card>
              </Col>

              {/* Cart Summary */}
              <Col lg={4}>
                <Card className="cart-summary-card">
                  <Card.Header className="cart-summary-header">
                    <h5 className="mb-0"><i className="fas fa-receipt me-2" aria-hidden />สรุปตะกร้า</h5>
                  </Card.Header>
                  <Card.Body>
                    <div className="cart-summary-details">
                      <div className="summary-item">
                        <span>จำนวนรายการ:</span>
                        <span>{selectedItems.size} / {normalCartItems.length} รายการ</span>
                      </div>
                      <div className="summary-item summary-total">
                        <span>ยอดรวม:</span>
                        <span className="total-price-amount">
                          {formatPrice(getSelectedTotal())}
                        </span>
                      </div>
                    </div>
                    
                    <div className="cart-summary-actions">
                      <PrimaryActionButton
                        className="w-100 mb-2"
                        onClick={handleCheckout}
                        disabled={selectedItems.size === 0 || checkingOut}
                        icon={checkingOut ? null : <i className="fas fa-credit-card" />}
                      >
                        {checkingOut ? (
                          <>
                            <Spinner size="sm" className="me-2" as="span" />
                            กำลังดำเนินการ...
                          </>
                        ) : (
                          `ดำเนินการซื้อ (${selectedItems.size})`
                        )}
                      </PrimaryActionButton>
                      <SecondaryActionButton
                        className="w-100"
                        onClick={() => setShowClearModal(true)}
                        icon={<i className="fas fa-broom" />}
                      >
                        ล้างตะกร้าทั้งหมด
                      </SecondaryActionButton>
                    </div>

                    <div className="cart-summary-note">
                      <Alert variant="info" className="cart-summary-info mb-0">
                        <small>
                          <i className="fas fa-lightbulb me-2" aria-hidden />
                          กด &quot;ดำเนินการซื้อ&quot; เพื่อยืนยันคำสั่งซื้อ สถานะจะเป็น <strong>รอจัดส่ง</strong>
                          หลังจากผู้ขายยืนยันการส่งและแนบใบเสร็จ ดูได้ที่ <strong>รายการคำสั่งซื้อ</strong> ในโปรไฟล์
                        </small>
                      </Alert>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Container>

      <Modal show={showCheckoutModal} onHide={() => !checkingOut && setShowCheckoutModal(false)} centered className="cart-modal">
        <Modal.Header closeButton className="cart-modal-header">
          <Modal.Title><i className="fas fa-truck me-2" aria-hidden />ยืนยันการสั่งซื้อ</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small mb-2">ที่อยู่จัดส่ง (ดึงจากโปรไฟล์ หรือกรอกด้านล่าง)</p>
          <Form.Group className="mb-3">
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="กรอกที่อยู่จัดส่ง เช่น บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
              value={checkoutAddress}
              onChange={(e) => setCheckoutAddress(e.target.value)}
              disabled={checkingOut}
              className="form-control-sakura"
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="text-muted small">เบอร์โทร</Form.Label>
            <Form.Control
              type="tel"
              placeholder="เช่น 08x-xxx-xxxx"
              value={checkoutPhone}
              onChange={(e) => setCheckoutPhone(e.target.value)}
              disabled={checkingOut}
              className="form-control-sakura"
            />
          </Form.Group>
          <Alert variant="warning" className="cart-modal-warning mb-0">
            <small>
              <i className="fas fa-info-circle me-2" aria-hidden />
              <strong>การชำระเงินเป็นแบบ mock</strong> — ไม่มีการหักเงินจริง กดยืนยันเพื่อสร้างคำสั่งซื้อ
            </small>
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <SecondaryActionButton onClick={() => setShowCheckoutModal(false)} disabled={checkingOut} icon={<i className="fas fa-times" />}>
            ยกเลิก
          </SecondaryActionButton>
          <PrimaryActionButton
            onClick={handleConfirmCheckout}
            disabled={!checkoutAddress?.trim() || !checkoutPhone?.trim() || checkingOut}
            icon={checkingOut ? null : <i className="fas fa-check" />}
          >
            {checkingOut ? (
              <>
                <Spinner size="sm" className="me-2" as="span" />
                กำลังดำเนินการ...
              </>
            ) : (
              'ยืนยันสั่งซื้อ'
            )}
          </PrimaryActionButton>
        </Modal.Footer>
      </Modal>

      <Modal show={showClearModal} onHide={() => setShowClearModal(false)} centered className="cart-modal">
        <Modal.Header closeButton className="cart-modal-header cart-modal-header--danger">
          <Modal.Title><i className="fas fa-trash-alt me-2" aria-hidden />ยืนยันการล้างตะกร้า</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">คุณต้องการล้างตะกร้าทั้งหมดหรือไม่?</p>
          <Alert variant="warning" className="cart-modal-warning mt-3 mb-0">
            <i className="fas fa-exclamation-triangle me-2" aria-hidden />
            การดำเนินการนี้ไม่สามารถย้อนกลับได้
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <SecondaryActionButton onClick={() => setShowClearModal(false)} icon={<i className="fas fa-times" />}>
            ยกเลิก
          </SecondaryActionButton>
          <Button
            variant="danger"
            onClick={handleClearCart}
            disabled={clearingCart}
            className="btn-tcg-danger"
          >
            {clearingCart ? (
              <>
                <Spinner size="sm" className="me-2" as="span" />
                กำลังล้าง...
              </>
            ) : (
              <>
                <i className="fas fa-broom me-2" aria-hidden />
                ยืนยันการล้าง
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Cart;


import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Alert, Spinner, Badge, Modal, Form } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { CartItem } from '../types';
import { toast } from 'react-toastify';
import '../styles/cart.css';

const Cart: React.FC = () => {
  const { cartItems, loading, error, removeFromCart, clearCart, getTotalPrice, formatPrice, fetchCartItems } = useCart();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [removingItem, setRemovingItem] = useState<string | null>(null);
  const [showClearModal, setShowClearModal] = useState<boolean>(false);
  const [clearingCart, setClearingCart] = useState<boolean>(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Filter only normal sale items (not auction)
  const normalCartItems = cartItems.filter(item => item.post.postType === 'sale');

  const getItemKey = (item: CartItem): string => item.id || `${item.postId}_${item.cardId || ''}`;

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
    if (selectedItems.size === cartItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(cartItems.map(item => item.postId)));
    }
  };

  const getSelectedTotal = (): number => {
    return normalCartItems
      .filter(item => selectedItems.has(getItemKey(item)))
      .reduce((total, item) => {
        const price = item.post.individualPrice || item.post.price || 0;
        const qty = item.quantity ?? 1;
        return total + price * qty;
      }, 0);
  };

  const handleCheckout = (): void => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    if (selectedItems.size === 0) {
      toast.warning('กรุณาเลือกสินค้าที่ต้องการซื้อ');
      return;
    }

    // Navigate to checkout or show contact info
    toast.info('กรุณาติดต่อผู้ขายแต่ละรายเพื่อดำเนินการซื้อขาย');
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
      <Container className="py-4">
        {/* Header */}
        <Row className="mb-4">
          <Col>
            <div className="cart-header">
              <h1 className="cart-title">
                🛒 ตะกร้าของฉัน
                {normalCartItems.length > 0 && (
                  <Badge bg="primary" className="ms-2">
                    {normalCartItems.length} รายการ
                  </Badge>
                )}
              </h1>
              <p className="cart-subtitle">
                รายการสินค้าที่คุณต้องการซื้อ
              </p>
            </div>
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
                <div className="cart-empty-icon">
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <path d="M16 10a4 4 0 0 1-8 0"></path>
                  </svg>
                </div>
                <h3 className="cart-empty-title">ไม่มีสินค้า</h3>
                <p className="cart-empty-description">
                  ยังไม่มีสินค้าในตะกร้า<br />
                  ไปเลือกสินค้าที่ต้องการซื้อกันเถอะ!
                </p>
                <Button 
                  as={Link as any} 
                  to="/" 
                  className="btn-tcg-primary"
                >
                  🏠 ไปเลือกสินค้า
                </Button>
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
                              <Badge bg="danger" className="mt-2">✅ ขายแล้ว</Badge>
                            )}
                          </div>
                          <div className="cart-item-price-section">
                            <div className="cart-item-price-value">
                              {formatPrice((item.post.individualPrice || item.post.price || 0) * (item.quantity ?? 1))}
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
                                <Spinner size="sm" />
                              ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
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
                    <h5 className="mb-0">สรุปตะกร้า</h5>
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
                      <Button
                        className="btn-tcg-primary w-100 mb-2"
                        onClick={handleCheckout}
                        disabled={selectedItems.size === 0}
                      >
                        ดำเนินการซื้อ ({selectedItems.size})
                      </Button>
                      <Button
                        variant="outline-secondary"
                        className="w-100"
                        onClick={() => setShowClearModal(true)}
                      >
                        ล้างตะกร้าทั้งหมด
                      </Button>
                    </div>

                    <div className="cart-summary-note">
                      <Alert variant="info" className="mb-0">
                        <small>
                          💡 <strong>หมายเหตุ:</strong> ระบบนี้เป็นเพียงการเก็บรายการที่สนใจ 
                          กรุณาติดต่อผู้ขายแต่ละรายเพื่อดำเนินการซื้อขายจริง
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

      {/* Clear Cart Confirmation Modal */}
      <Modal show={showClearModal} onHide={() => setShowClearModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>🗑️ ยืนยันการล้างตะกร้า</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>คุณต้องการล้างตะกร้าทั้งหมดหรือไม่?</p>
          <Alert variant="warning">
            ⚠️ การดำเนินการนี้ไม่สามารถย้อนกลับได้
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowClearModal(false)}>
            ยกเลิก
          </Button>
          <Button 
            variant="danger" 
            onClick={handleClearCart}
            disabled={clearingCart}
          >
            {clearingCart ? (
              <>
                <Spinner size="sm" className="me-2" />
                กำลังล้าง...
              </>
            ) : (
              'ยืนยันการล้าง'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Cart;


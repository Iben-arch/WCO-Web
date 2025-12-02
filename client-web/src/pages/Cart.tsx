import React, { useState } from 'react';
import { Container, Row, Col, Card, Button, Alert, Spinner, Badge, Modal } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { CartItem } from '../types';
import { toast } from 'react-toastify';
import '../styles/cart.css';

const Cart: React.FC = () => {
  const { cartItems, loading, error, removeFromCart, clearCart, getTotalPrice, formatPrice } = useCart();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [removingItem, setRemovingItem] = useState<string | null>(null);
  const [showClearModal, setShowClearModal] = useState<boolean>(false);
  const [clearingCart, setClearingCart] = useState<boolean>(false);

  const handleRemoveItem = async (postId: string): Promise<void> => {
    setRemovingItem(postId);
    try {
      const result = await removeFromCart(postId);
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

  const handleCheckout = (): void => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    if (cartItems.length === 0) {
      toast.warning('ตะกร้าว่างเปล่า');
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

  if (error) {
    return (
      <Container className="py-5">
        <Alert variant="danger">
          <h4>เกิดข้อผิดพลาด</h4>
          <p>{error}</p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            รีเฟรชหน้า
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <div className="cart-container">
      <Container className="py-4">
        {/* Header */}
        <Row className="mb-4">
          <Col>
            <div className="cart-header">
              <h1 className="cart-title">
                🛒 ตะกร้าของฉัน
                {cartItems.length > 0 && (
                  <Badge bg="primary" className="ms-2">
                    {cartItems.length} รายการ
                  </Badge>
                )}
              </h1>
              <p className="cart-subtitle">
                รายการการ์ดที่คุณสนใจ
              </p>
            </div>
          </Col>
        </Row>

        {cartItems.length === 0 ? (
          <div className="empty-cart" style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '60vh'
          }}>
            <Card className="text-center py-5" style={{
              border: 'none',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-lg)',
              background: 'var(--bg-card)',
              maxWidth: '500px',
              width: '100%',
              animation: 'fadeInUp 0.6s ease-out'
            }}>
              <Card.Body style={{ padding: '3rem 2rem' }}>
                <div className="empty-cart-icon" style={{
                  fontSize: '5rem',
                  marginBottom: '1.5rem',
                  animation: 'float 3s ease-in-out infinite'
                }}>🛒</div>
                <h3 className="empty-cart-title" style={{
                  fontSize: '1.75rem',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  marginBottom: '1rem'
                }}>ตะกร้าว่างเปล่า</h3>
                <p className="empty-cart-description" style={{
                  fontSize: '1rem',
                  color: 'var(--text-muted)',
                  marginBottom: '2rem',
                  lineHeight: '1.6'
                }}>
                  ยังไม่มีรายการในตะกร้า ไปเลือกการ์ดที่ชอบกันเถอะ!
                </p>
                <Button as={Link as any} to="/" className="btn-tcg-primary btn-tcg-lg" style={{
                  padding: '0.75rem 2rem',
                  fontSize: '1rem',
                  borderRadius: 'var(--radius-md)'
                }}>
                  🏠 ไปเลือกการ์ด
                </Button>
              </Card.Body>
            </Card>
          </div>
        ) : (
          <>
            {/* Cart Items */}
            <Row>
              <Col lg={8}>
                <div className="cart-items">
                  {cartItems.map((item: CartItem) => (
                    <Card key={item.postId} className="cart-item-card mb-3" style={{
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-lg)',
                      boxShadow: 'var(--shadow-md)',
                      transition: 'all var(--transition-base)',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                    }}>
                      <Card.Body style={{ padding: '1.5rem' }}>
                        <Row className="align-items-center">
                          <Col md={3}>
                            <div className="cart-item-image">
                              {item.post.images && item.post.images.length > 0 ? (
                                <img
                                  src={item.post.images[0]}
                                  alt={item.post.title}
                                  className="img-fluid rounded"
                                />
                              ) : (
                                <div className="no-image-placeholder">
                                  <div className="no-image-icon">🃏</div>
                                </div>
                              )}
                            </div>
                          </Col>
                          <Col md={6}>
                            <div className="cart-item-details">
                              <h5 className="cart-item-title">
                                <Link to={`/post/${item.postId}`} className="text-decoration-none">
                                  {item.post.title}
                                </Link>
                              </h5>
                              <div className="cart-item-meta">
                                <Badge className="me-2" bg="secondary">
                                  {item.post.category}
                                </Badge>
                                <Badge className="me-2" bg={
                                  item.post.postType === 'auction' ? 'warning' :
                                  item.post.postType === 'buying' ? 'info' : 'success'
                                }>
                                  {item.post.postType === 'auction' ? '🔨 ประมูล' :
                                   item.post.postType === 'buying' ? '🛒 รับซื้อ' : '💰 ขาย'}
                                </Badge>
                                {item.post.status === 'sold' && (
                                  <Badge bg="danger">✅ ขายแล้ว</Badge>
                                )}
                              </div>
                              <div className="cart-item-seller">
                                <span className="seller-label">ผู้ขาย:</span>
                                <Link 
                                  to={`/seller/${item.post.sellerId}`}
                                  className="seller-link"
                                >
                                  {item.post.sellerName}
                                </Link>
                              </div>
                            </div>
                          </Col>
                          <Col md={3}>
                            <div className="cart-item-actions">
                              <div className="cart-item-price">
                                {formatPrice(item.post.price || item.post.startingBid || item.post.maxPrice || 0)}
                              </div>
                              <div className="cart-item-buttons">
                                <Button
                                  as={Link as any}
                                  to={`/post/${item.postId}`}
                                  className="btn-tcg-outline btn-tcg-sm me-2"
                                >
                                  👁️ ดูรายละเอียด
                                </Button>
                                <Button
                                  className="btn-tcg-outline btn-tcg-sm"
                                  onClick={() => handleRemoveItem(item.postId)}
                                  disabled={removingItem === item.postId}
                                >
                                  {removingItem === item.postId ? (
                                    <Spinner size="sm" />
                                  ) : (
                                    '🗑️ ลบ'
                                  )}
                                </Button>
                              </div>
                            </div>
                          </Col>
                        </Row>
                      </Card.Body>
                    </Card>
                  ))}
                </div>
              </Col>

              {/* Cart Summary */}
              <Col lg={4}>
                <Card className="cart-summary-card" style={{
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-lg)',
                  position: 'sticky',
                  top: '2rem'
                }}>
                  <Card.Header style={{
                    background: 'linear-gradient(135deg, var(--muted-olive) 0%, var(--faded-copper) 100%)',
                    color: 'var(--text-light)',
                    border: 'none',
                    borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                    padding: '1.25rem 1.5rem'
                  }}>
                    <h5 className="mb-0" style={{ fontWeight: '600', fontSize: '1.25rem' }}>📋 สรุปตะกร้า</h5>
                  </Card.Header>
                  <Card.Body style={{ padding: '1.5rem' }}>
                    <div className="cart-summary">
                      <div className="summary-row">
                        <span>จำนวนรายการ:</span>
                        <span>{cartItems.length} รายการ</span>
                      </div>
                      <div className="summary-row total-row">
                        <span>ยอดรวม:</span>
                        <span className="total-price">
                          {formatPrice(getTotalPrice())}
                        </span>
                      </div>
                    </div>
                    
                    <div className="cart-actions mt-4">
                      <Button
                        className="btn-tcg-primary btn-tcg-lg w-100 mb-3"
                        onClick={handleCheckout}
                      >
                        💳 ดำเนินการซื้อ
                      </Button>
                      <Button
                        className="btn-tcg-outline btn-tcg-sm w-100"
                        onClick={() => setShowClearModal(true)}
                      >
                        🗑️ ล้างตะกร้าทั้งหมด
                      </Button>
                    </div>

                    <div className="cart-note mt-3">
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


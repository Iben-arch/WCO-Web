import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Modal, Spinner, Form } from 'react-bootstrap';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { Post, IndividualCardItem, CardForCart } from '../../types';
import { toast } from 'react-toastify';
import '../../styles/individual-card.css';

interface IndividualCardProps {
  card: IndividualCardItem;
  post: Post;
  onAddToCart: (cardForCart: CardForCart) => Promise<void>;
  onRemoveFromCart?: (postId: string, cardId: string) => void;
  isInCart?: boolean;
  isAddingToCart?: boolean;
  readOnly?: boolean;
  /** โหมดประมูลแยกใบ */
  isAuctionCard?: boolean;
  cardCurrentBid?: number;
  cardWinnerId?: string;
  onPlaceBid?: () => void;
  placingBid?: boolean;
}

const IndividualCard: React.FC<IndividualCardProps> = ({ 
  card, 
  post, 
  onAddToCart, 
  onRemoveFromCart, 
  isInCart = false,
  isAddingToCart = false,
  readOnly = false,
  isAuctionCard = false,
  cardCurrentBid,
  cardWinnerId,
  onPlaceBid,
  placingBid = false
}) => {
  const { currentUser } = useAuth();
  const { getQuantityInCart } = useCart();
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [selectedQty, setSelectedQty] = useState<number>(1);

  const cardQty = typeof card.quantity === 'number' ? card.quantity : 1;
  const inCartQty = getQuantityInCart(post.id, card.id);
  const remaining = Math.max(0, cardQty - inCartQty);
  const isOutOfStock = remaining <= 0;
  const unitPrice = typeof card.price === 'number' ? card.price : (post.individualPrice || post.price || 0);
  const totalPrice = unitPrice * selectedQty;

  useEffect(() => {
    const max = Math.max(1, remaining);
    setSelectedQty(prev => (prev > max ? max : prev < 1 ? 1 : prev));
  }, [remaining]);

  useEffect(() => {
    if (!showImageModal) return;

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowImageModal(false);
      }
    };

    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [showImageModal]);

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB'
    }).format(price);
  };

  const handleAddToCart = async (): Promise<void> => {
    if (!currentUser) {
      setShowLoginModal(true);
      return;
    }

    if (currentUser.id === post.sellerId) {
      toast.error('ไม่สามารถเพิ่มโพสต์ของตัวเองในตะกร้าได้');
      return;
    }

    if (post.status === 'sold') {
      toast.error('โพสต์นี้ถูกขายแล้ว');
      return;
    }

    if (post.status !== 'active') {
      toast.error('โพสต์นี้ไม่พร้อมใช้งาน');
      return;
    }

    if (isOutOfStock) {
      toast.error('การ์ดใบนี้หมดแล้ว');
      return;
    }

    try {
      const qty = Math.min(Math.max(1, selectedQty), remaining);
      const cardForCart: CardForCart = {
        id: `${post.id}_${card.id}`,
        postId: post.id,
        cardId: card.id,
        cardImage: card.imageUrl,
        cardTitle: post.title || 'การ์ดเกม',
        price: unitPrice,
        sellerId: post.sellerId,
        sellerName: post.sellerName,
        category: post.category,
        isIndividualCard: true,
        originalPost: post,
        quantityToAdd: qty
      };

      await onAddToCart(cardForCart);
    } catch (error) {
      console.error('Error adding card to cart:', error);
      toast.error('เกิดข้อผิดพลาดในการเพิ่มในตะกร้า');
    }
  };

  const handleRemoveFromCart = (): void => {
    if (onRemoveFromCart) {
      onRemoveFromCart(post.id, card.id);
    }
  };

  const handleImageClick = (): void => {
    setShowImageModal(true);
  };

  const handleImageLoad = (): void => {
    setImageLoading(false);
  };

  const handleImageError = (): void => {
    setImageLoading(false);
    toast.error('ไม่สามารถโหลดภาพการ์ดได้');
  };

  return (
    <>
      <Card className="individual-card">
        <div
          className="card-image-container"
          role="button"
          tabIndex={0}
          onClick={handleImageClick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleImageClick(); } }}
          aria-label="ดูภาพขยาย"
        >
          {imageLoading && (
            <div className="image-loading">
              <Spinner animation="border" size="sm" />
              <span>กำลังโหลด...</span>
            </div>
          )}
          <img
            src={card.imageUrl}
            alt={`การ์ด ${card.id}`}
            className="card-image"
            onLoad={handleImageLoad}
            onError={handleImageError}
            onLoadStart={() => setImageLoading(true)}
          />
          <div className="card-overlay">
            <div className="card-overlay-content">
              <i className="fas fa-search-plus"></i>
              <span>ดูภาพใหญ่</span>
            </div>
          </div>
        </div>

        <Card.Body className="card-body">
          <div className="card-header">
            <h6 className="card-title">
              {post.title || 'การ์ดเกม'}
            </h6>
            <Badge className="card-category-badge">
              {post.category || 'อื่นๆ'}
            </Badge>
          </div>

          <div className="card-price-section">
            <div className="price-label">{isAuctionCard ? 'ราคาปัจจุบัน' : readOnly ? 'ราคาอ้างอิงต่อใบ' : 'ราคาต่อใบ'}</div>
            <div className="price-value">
              {formatPrice(isAuctionCard && cardCurrentBid != null && cardCurrentBid > 0
                ? cardCurrentBid
                : (typeof card.price === 'number' ? card.price : (post.individualPrice || post.price || 0)))}
            </div>
            <div className="card-quantity-info">
              {isAuctionCard && cardWinnerId && currentUser?.id === cardWinnerId ? (
                <span className="text-success small fw-bold">คุณชนะ</span>
              ) : isOutOfStock ? (
                <span className="text-danger small fw-bold">หมดแล้ว</span>
              ) : (
                <span className="text-muted small">{isAuctionCard ? 'เริ่มต้น' : 'เหลือ'} {isAuctionCard ? formatPrice(typeof card.price === 'number' ? card.price : 0) : `${remaining} ใบ`}</span>
              )}
            </div>
          </div>

          {!readOnly && !isAuctionCard && post.status === 'active' && !isOutOfStock && remaining > 0 && (
          <div className="card-quantity-selector mb-2">
            <div className="d-flex align-items-center justify-content-between small text-muted mb-1">
              <span>จำนวนใบ</span>
              <span className="fw-semibold text-dark">รวม {formatPrice(totalPrice)}</span>
            </div>
            <div className="d-flex align-items-center gap-1">
              <Button
                variant="outline-secondary"
                size="sm"
                className="p-1"
                style={{ minWidth: '32px' }}
                onClick={() => setSelectedQty(q => Math.max(1, q - 1))}
                disabled={selectedQty <= 1}
              >
                −
              </Button>
              <Form.Control
                type="number"
                min={1}
                max={remaining}
                value={selectedQty}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (e.target.value === '') return;
                  if (!Number.isNaN(v)) setSelectedQty(Math.min(remaining, Math.max(1, v)));
                }}
                className="text-center py-1"
                style={{ width: '56px' }}
              />
              <Button
                variant="outline-secondary"
                size="sm"
                className="p-1"
                style={{ minWidth: '32px' }}
                onClick={() => setSelectedQty(q => Math.min(remaining, q + 1))}
                disabled={selectedQty >= remaining}
              >
                +
              </Button>
            </div>
          </div>
          )}

          {isAuctionCard && cardWinnerId && currentUser?.id === cardWinnerId && (
          <div className="card-actions">
            <Link to="/cart" className="btn btn-success btn-sm w-100 text-decoration-none text-white text-center d-inline-flex align-items-center justify-content-center gap-1">
              <i className="fas fa-shopping-cart" aria-hidden></i>
              ไปตะกร้าเพื่อชำระเงิน
            </Link>
          </div>
          )}
          {isAuctionCard && onPlaceBid && !cardWinnerId && (
          <div className="card-actions">
            <Button variant="primary" size="sm" className="btn-tcg-primary w-100" onClick={() => onPlaceBid?.()} disabled={placingBid}>
              {placingBid ? <><Spinner size="sm" className="me-2" />กำลังประมูล...</> : <><i className="fas fa-gavel me-1" aria-hidden></i>ประมูล</>}
            </Button>
          </div>
          )}
          {!isAuctionCard && (
          <div className="card-actions">
            {isInCart ? (
              <Button variant="outline-danger" size="sm" className="w-100" onClick={handleRemoveFromCart}>
                <i className="fas fa-trash-alt me-1" aria-hidden></i> ลบออกจากตะกร้า
              </Button>
            ) : (
                !readOnly ? (
                  <Button
                    variant={currentUser ? 'primary' : 'secondary'}
                    size="sm"
                    className={`w-100 ${currentUser ? 'btn-tcg-primary' : ''}`}
                    onClick={handleAddToCart}
                    disabled={!currentUser || isAddingToCart || post.status !== 'active' || isOutOfStock}
                  >
                    {isAddingToCart ? (
                      <>
                        <Spinner size="sm" className="me-2" />
                        กำลังเพิ่ม...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-cart-plus me-1" aria-hidden></i>เพิ่มในตะกร้า
                      </>
                    )}
                  </Button>
                ) : null
            )}
          </div>
          )}

          {post.status === 'sold' && (
            <div className="sold-overlay">
              <Badge bg="danger" className="sold-badge">
                ขายแล้ว
              </Badge>
            </div>
          )}
          {!isAuctionCard && post.status !== 'active' && post.status !== 'sold' && (
            <div className="sold-overlay">
              <Badge bg="secondary" className="sold-badge">
                {post.status === 'pending'
                  ? 'รอตรวจสอบ'
                  : post.status === 'inactive'
                    ? 'ปิดการขาย'
                    : post.status === 'rejected'
                      ? 'ถูกปฏิเสธ'
                      : 'ไม่พร้อมใช้งาน'}
              </Badge>
            </div>
          )}
          {post.status === 'active' && isOutOfStock && (
            <div className="sold-overlay">
              <Badge bg="secondary" className="sold-badge">
                หมดแล้ว
              </Badge>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Image Lightbox */}
      {showImageModal && createPortal(
        <div
          className="individual-image-lightbox-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="ภาพการ์ดขยาย"
          onClick={() => setShowImageModal(false)}
        >
          <button
            type="button"
            className="individual-image-lightbox-close"
            onClick={() => setShowImageModal(false)}
            aria-label="ปิด"
          >
            ✕
          </button>
          <div
            className="individual-image-lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={card.imageUrl}
              alt={`การ์ด ${card.id}`}
              className="modal-card-image"
            />
            <div className="card-info mt-3">
              <div className="info-item">
                <strong>ราคา:</strong> {formatPrice(typeof card.price === 'number' ? card.price : (post.individualPrice || post.price || 0))}
              </div>
              <div className="info-item">
                <strong>เหลือ:</strong> {remaining} ใบ
              </div>
              <div className="info-item">
                <strong>หมวดหมู่:</strong> {post.category || 'อื่นๆ'}
              </div>
              <div className="info-item">
                <strong>ผู้ขาย:</strong> {post.sellerName}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <Modal
        show={showLoginModal}
        onHide={() => setShowLoginModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>กรุณาเข้าสู่ระบบ</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          กรุณาเข้าสู่ระบบก่อนเพิ่มสินค้าในตะกร้า
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowLoginModal(false)}>
            ปิด
          </Button>
          <Button
            variant="primary"
            className="btn-tcg-primary"
            onClick={() => {
              setShowLoginModal(false);
              window.location.href = '/login';
            }}
          >
            ไปที่หน้าเข้าสู่ระบบ
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default IndividualCard;


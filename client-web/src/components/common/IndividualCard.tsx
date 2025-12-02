import React, { useState } from 'react';
import { Card, Button, Badge, Modal, Spinner } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { Post, IndividualCardItem, CardForCart } from '../types';
import { toast } from 'react-toastify';
import '../../styles/individual-card.css';

interface IndividualCardProps {
  card: IndividualCardItem;
  post: Post;
  onAddToCart: (cardForCart: CardForCart) => Promise<void>;
  onRemoveFromCart?: (cardId: string) => void;
  isInCart?: boolean;
  isAddingToCart?: boolean;
}

const IndividualCard: React.FC<IndividualCardProps> = ({ 
  card, 
  post, 
  onAddToCart, 
  onRemoveFromCart, 
  isInCart = false,
  isAddingToCart = false 
}) => {
  const { currentUser } = useAuth();
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [imageLoading, setImageLoading] = useState<boolean>(false);

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB'
    }).format(price);
  };

  const handleAddToCart = async (): Promise<void> => {
    if (!currentUser) {
      toast.error('กรุณาเข้าสู่ระบบก่อนเพิ่มในตะกร้า');
      return;
    }

    if (currentUser.uid === post.sellerId) {
      toast.error('ไม่สามารถเพิ่มโพสต์ของตัวเองในตะกร้าได้');
      return;
    }

    if (post.status === 'sold') {
      toast.error('โพสต์นี้ถูกขายแล้ว');
      return;
    }

    try {
      // สร้าง card object สำหรับ cart
      const cardForCart: CardForCart = {
        id: `${post.id}_${card.id}`,
        postId: post.id,
        cardId: card.id,
        cardImage: card.imageUrl,
        cardTitle: post.title || 'การ์ดเกม',
        price: post.individualPrice || post.price || 0,
        sellerId: post.sellerId,
        sellerName: post.sellerName,
        category: post.category,
        isIndividualCard: true,
        originalPost: post
      };

      await onAddToCart(cardForCart);
    } catch (error) {
      console.error('Error adding card to cart:', error);
      toast.error('เกิดข้อผิดพลาดในการเพิ่มในตะกร้า');
    }
  };

  const handleRemoveFromCart = (): void => {
    if (onRemoveFromCart) {
      onRemoveFromCart(`${post.id}_${card.id}`);
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
        <div className="card-image-container" onClick={handleImageClick}>
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
            <div className="price-label">ราคาต่อใบ</div>
            <div className="price-value">
              {formatPrice(post.individualPrice || post.price || 0)}
            </div>
          </div>

          <div className="card-actions">
            {isInCart ? (
              <Button
                variant="outline-danger"
                size="sm"
                className="w-100"
                onClick={handleRemoveFromCart}
              >
                <i className="fas fa-trash-alt me-1"></i>
                ลบออกจากตะกร้า
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                className="w-100"
                onClick={handleAddToCart}
                disabled={isAddingToCart || post.status === 'sold'}
              >
                {isAddingToCart ? (
                  <>
                    <Spinner size="sm" className="me-2" />
                    กำลังเพิ่ม...
                  </>
                ) : (
                  <>
                    <i className="fas fa-cart-plus me-1"></i>
                    เพิ่มในตะกร้า
                  </>
                )}
              </Button>
            )}
          </div>

          {post.status === 'sold' && (
            <div className="sold-overlay">
              <Badge bg="danger" className="sold-badge">
                ขายแล้ว
              </Badge>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Image Modal */}
      <Modal 
        show={showImageModal} 
        onHide={() => setShowImageModal(false)}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="fas fa-image me-2"></i>
            {post.title || 'การ์ดเกม'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          <img
            src={card.imageUrl}
            alt={`การ์ด ${card.id}`}
            className="modal-card-image"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        </Modal.Body>
        <Modal.Footer>
          <div className="card-info">
            <div className="info-item">
              <strong>ราคา:</strong> {formatPrice(post.individualPrice || post.price || 0)}
            </div>
            <div className="info-item">
              <strong>หมวดหมู่:</strong> {post.category || 'อื่นๆ'}
            </div>
            <div className="info-item">
              <strong>ผู้ขาย:</strong> {post.sellerName}
            </div>
          </div>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default IndividualCard;


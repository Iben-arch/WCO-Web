import React, { useState, useEffect } from 'react';
import { Container, Alert, Spinner, Button } from 'react-bootstrap';
import IndividualCard from './IndividualCard';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { Post, IndividualCardItem, CardForCart } from '../../types';
import axios from '../../utils/axiosInterceptor';
import { toast } from 'react-toastify';

interface IndividualCardsGridProps {
  post: Post;
  onCardProcessed?: (cards: IndividualCardItem[]) => void;
}

const IndividualCardsGrid: React.FC<IndividualCardsGridProps> = ({ post, onCardProcessed }) => {
  const { currentUser } = useAuth();
  const { addToCart, removeFromCart, isInCart } = useCart();
  const [cards, setCards] = useState<IndividualCardItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (post && post.individualCards && post.individualCards.length > 0) {
      // Convert Post.individualCards format to IndividualCardItem[]
      const convertedCards: IndividualCardItem[] = post.individualCards.map(card => ({
        id: card.id || '',
        imageUrl: card.imageUrl,
        quantity: card.quantity,
        price: card.price
      }));
      setCards(convertedCards);
    }
  }, [post]);

  const processPostImages = async (): Promise<void> => {
    if (!post || !post.images || post.images.length === 0) {
      toast.error('ไม่พบภาพในโพสต์นี้');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const response = await axios.post('/api/card-detection/process-post', {
        postId: post.id,
        imageUrls: post.images
      });

      if (response.data.success) {
        const processedCards: IndividualCardItem[] = response.data.cards;
        setCards(processedCards);
        
        // อัปเดต post ใน parent component
        if (onCardProcessed) {
          onCardProcessed(processedCards);
        }

        toast.success(`ประมวลผลเสร็จสิ้น พบการ์ด ${processedCards.length} ใบ`);
      } else {
        const errorMsg = response.data.error || 'เกิดข้อผิดพลาดในการประมวลผล';
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (error: any) {
      console.error('Error processing post images:', error);
      const errorMessage = error.response?.data?.error || 'เกิดข้อผิดพลาดในการประมวลผลภาพ';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const handleAddToCart = async (cardForCart: CardForCart): Promise<void> => {
    try {
      const result = await addToCart(cardForCart.originalPost);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error adding card to cart:', error);
      toast.error('เกิดข้อผิดพลาดในการเพิ่มในตะกร้า');
    }
  };

  const handleRemoveFromCart = (cardId: string): void => {
    try {
      removeFromCart(cardId);
      toast.success('ลบออกจากตะกร้าแล้ว');
    } catch (error) {
      console.error('Error removing card from cart:', error);
      toast.error('เกิดข้อผิดพลาดในการลบออกจากตะกร้า');
    }
  };

  if (!post) {
    return null;
  }

  // ตรวจสอบว่าเป็น individual sale หรือไม่
  if (post.postType !== 'sale' || post.saleType !== 'individual') {
    return null;
  }

  return (
    <Container className="individual-cards-section">
      <div className="section-header">
        <h5 className="section-title">
          <i className="fas fa-layer-group me-2"></i>
          การ์ดแต่ละใบ
        </h5>
        <p className="section-description">
          เลือกการ์ดที่ต้องการซื้อได้จากรายการด้านล่าง
        </p>
      </div>

      {cards.length === 0 && !processing && !loading && (
        <div className="no-cards-container">
          <Alert variant="info" className="no-cards-alert">
            <div className="no-cards-content">
              <i className="fas fa-images no-cards-icon"></i>
              <h6>ยังไม่มีการ์ดแต่ละใบ</h6>
              <p>กดปุ่มด้านล่างเพื่อประมวลผลภาพและแยกการ์ดแต่ละใบ</p>
              <Button
                variant="primary"
                onClick={processPostImages}
                disabled={processing}
                className="process-button"
              >
                {processing ? (
                  <>
                    <Spinner size="sm" className="me-2" />
                    กำลังประมวลผล...
                  </>
                ) : (
                  <>
                    <i className="fas fa-magic me-2"></i>
                    ประมวลผลการ์ดอัตโนมัติ
                  </>
                )}
              </Button>
            </div>
          </Alert>
        </div>
      )}

      {processing && (
        <div className="processing-container">
          <div className="processing-content">
            <Spinner animation="border" variant="primary" />
            <h6 className="mt-3">กำลังประมวลผลภาพ...</h6>
            <p className="text-muted">
              ระบบกำลังใช้ AI ในการแยกการ์ดแต่ละใบจากภาพ
            </p>
          </div>
        </div>
      )}

      {error && (
        <Alert variant="danger" className="error-alert">
          <i className="fas fa-exclamation-triangle me-2"></i>
          {error}
          <div className="mt-2">
            <Button
              variant="outline-danger"
              size="sm"
              onClick={processPostImages}
              disabled={processing}
            >
              ลองใหม่
            </Button>
          </div>
        </Alert>
      )}

      {cards.length > 0 && (
        <>
          <div className="cards-info">
            <div className="cards-count">
              <i className="fas fa-layer-group me-1"></i>
              พบการ์ด {cards.length} ใบ
            </div>
            <div className="cards-actions">
              <Button
                variant="outline-primary"
                size="sm"
                onClick={processPostImages}
                disabled={processing}
              >
                <i className="fas fa-sync-alt me-1"></i>
                ประมวลผลใหม่
              </Button>
            </div>
          </div>

          <div className="individual-cards-grid">
            {cards.map((card) => (
              <IndividualCard
                key={card.id}
                card={card}
                post={post}
                onAddToCart={handleAddToCart}
                onRemoveFromCart={handleRemoveFromCart}
                isInCart={isInCart(`${post.id}_${card.id}`)}
                isAddingToCart={loading}
              />
            ))}
          </div>
        </>
      )}
    </Container>
  );
};

export default IndividualCardsGrid;


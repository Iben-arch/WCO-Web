import React, { useState, useEffect } from 'react';
import { Container, Alert, Spinner, Button } from 'react-bootstrap';
import IndividualCard from './IndividualCard';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { Post, IndividualCardItem, CardForCart } from '../../types';
import axios from '../../utils/axiosInterceptor';
import { auctionAPI } from '../../api/api';
import { toast } from 'react-toastify';

interface IndividualCardsGridProps {
  post: Post;
  onCardProcessed?: (cards: IndividualCardItem[]) => void;
  readOnly?: boolean;
  isAuctionIndividual?: boolean;
  onOpenBidModal?: (cardId: string, minBid: number) => void;
  placingBid?: boolean;
}

const IndividualCardsGrid: React.FC<IndividualCardsGridProps> = ({ post, onCardProcessed, readOnly = false, isAuctionIndividual = false, onOpenBidModal, placingBid = false }) => {
  const { currentUser } = useAuth();
  const { addToCart, removeFromCart, isInCart } = useCart();
  const [cards, setCards] = useState<IndividualCardItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cardBids, setCardBids] = useState<Record<string, number>>({});
  const [cardWinners, setCardWinners] = useState<Record<string, string>>({});

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

  useEffect(() => {
    if (!isAuctionIndividual || !post?.id || cards.length === 0) return;
    const load = async () => {
      try {
        const [bids, winners] = await Promise.all([
          auctionAPI.getBids(post.id),
          auctionAPI.getCardWinners(post.id)
        ]);
        const bidsByCard: Record<string, number> = {};
        (bids || []).forEach((b: { cardId?: string; bidAmount: number }) => {
          if (b.cardId) {
            const cur = bidsByCard[b.cardId] ?? 0;
            if (b.bidAmount > cur) bidsByCard[b.cardId] = b.bidAmount;
          }
        });
        const winnersByCard: Record<string, string> = {};
        (winners || []).forEach((w: { cardId: string; winnerId: string }) => {
          winnersByCard[w.cardId] = w.winnerId;
        });
        setCardBids(bidsByCard);
        setCardWinners(winnersByCard);
      } catch {
        setCardBids({});
        setCardWinners({});
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [isAuctionIndividual, post?.id, cards.length]);

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
      const card = cardForCart.originalPost?.individualCards?.find(c => c.id === cardForCart.cardId);
      const quantity = cardForCart.quantityToAdd ?? card?.quantity ?? 1;
      const result = await addToCart(cardForCart.originalPost, cardForCart.cardId, quantity);
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

  const handleRemoveFromCart = (postId: string, cardId: string): void => {
    try {
      removeFromCart(postId, cardId);
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
          {isAuctionIndividual ? 'ประมูลแต่ละใบ เมื่อชนะใบนั้นจะเข้าตะกร้า' : readOnly ? 'การ์ดที่รวมอยู่ในรายการประมูล' : 'เลือกการ์ดที่ต้องการซื้อได้จากรายการด้านล่าง'}
        </p>
      </div>

      {cards.length === 0 && !processing && !loading && !readOnly && (
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
            {!readOnly && !isAuctionIndividual && (
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
            )}
          </div>

          <div className="individual-cards-grid">
            {cards.map((card) => (
              <IndividualCard
                key={card.id}
                card={card}
                post={post}
                onAddToCart={handleAddToCart}
                onRemoveFromCart={handleRemoveFromCart}
                isInCart={isInCart(post.id, card.id)}
                isAddingToCart={loading}
                readOnly={readOnly && !isAuctionIndividual}
                isAuctionCard={isAuctionIndividual}
                cardCurrentBid={cardBids[card.id]}
                cardWinnerId={cardWinners[card.id]}
                onPlaceBid={onOpenBidModal ? () => {
                  const min = (cardBids[card.id] ?? 0) || (typeof card.price === 'number' ? card.price : 0);
                  onOpenBidModal(card.id, min);
                } : undefined}
                placingBid={placingBid}
              />
            ))}
          </div>
        </>
      )}
    </Container>
  );
};

export default IndividualCardsGrid;


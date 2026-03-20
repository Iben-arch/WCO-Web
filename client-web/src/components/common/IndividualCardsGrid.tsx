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

  // แสดงได้ทั้ง sale+individual และ auction+individual
  if (post.saleType !== 'individual') return null;
  if (post.postType !== 'sale' && post.postType !== 'auction') return null;

  return (
    <Container className="individual-cards-section">
      <header className="individual-cards-section-header">
        <h2 className="individual-cards-section-title">
          การ์ดแต่ละใบ
        </h2>
        <p className="individual-cards-section-desc">
          {isAuctionIndividual ? 'ประมูลแต่ละใบ เมื่อชนะใบนั้นจะเข้าตะกร้า' : readOnly ? 'การ์ดที่รวมอยู่ในรายการประมูล' : 'เลือกการ์ดที่ต้องการซื้อได้จากรายการด้านล่าง'}
        </p>
      </header>

      {cards.length === 0 && !processing && !loading && !readOnly && (
        <div className="individual-cards-empty">
          <div className="individual-cards-empty-card">
            <div className="individual-cards-empty-icon-wrap">
              <i className="fas fa-images individual-cards-empty-icon" aria-hidden />
            </div>
            <h3 className="individual-cards-empty-title">ยังไม่มีการ์ดแต่ละใบ</h3>
            <p className="individual-cards-empty-desc">กดปุ่มด้านล่างเพื่อประมวลผลภาพและแยกการ์ดแต่ละใบ</p>
            <Button
              variant="primary"
              onClick={processPostImages}
              disabled={processing}
              className="individual-cards-empty-btn"
            >
              {processing ? (
                <>
                  <Spinner as="span" animation="border" size="sm" className="me-2" />
                  กำลังประมวลผล...
                </>
              ) : (
                <>
                  <i className="fas fa-magic me-2" aria-hidden />
                  ประมวลผลการ์ดอัตโนมัติ
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {processing && (
        <div className="individual-cards-processing">
          <div className="individual-cards-processing-card">
            <div className="individual-cards-processing-spinner-wrap">
              <Spinner animation="border" variant="primary" className="individual-cards-processing-spinner" />
            </div>
            <h3 className="individual-cards-processing-title">กำลังประมวลผลภาพ...</h3>
            <p className="individual-cards-processing-desc">ระบบกำลังใช้ AI ในการแยกการ์ดแต่ละใบจากภาพ</p>
          </div>
        </div>
      )}

      {error && (
        <div className="individual-cards-error">
          <div className="individual-cards-error-card">
            <span className="individual-cards-error-icon" aria-hidden>
              <i className="fas fa-exclamation-triangle" />
            </span>
            <p className="individual-cards-error-text">{error}</p>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={processPostImages}
              disabled={processing}
              className="individual-cards-error-retry"
            >
              ลองใหม่
            </Button>
          </div>
        </div>
      )}

      {cards.length > 0 && (
        <div className="individual-cards-grid-wrap">
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
        </div>
      )}
    </Container>
  );
};

export default IndividualCardsGrid;


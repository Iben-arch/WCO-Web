import React, { useState, useEffect } from 'react';
import IndividualCard from './IndividualCard';
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
  const { addToCart, removeFromCart, isInCart } = useCart();
  const [cards, setCards] = useState<IndividualCardItem[]>([]);
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
    <section className="card bg-base-100 border border-base-300 shadow-sm mt-4">
      <header className="card-body pb-4 border-b border-base-300">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xl font-bold m-0">การ์ดแต่ละใบ</h2>
          <div className="badge badge-primary badge-outline">
            {cards.length} ใบ
          </div>
        </div>
        <p className="text-sm text-base-content/70 mt-2 mb-0">
          {isAuctionIndividual ? 'ประมูลแต่ละใบ เมื่อชนะใบนั้นจะเข้าตะกร้า' : readOnly ? 'การ์ดที่รวมอยู่ในรายการประมูล' : 'เลือกการ์ดที่ต้องการซื้อได้จากรายการด้านล่าง'}
        </p>
      </header>

      {cards.length === 0 && !processing && !readOnly && (
        <div className="card-body">
          <div className="rounded-2xl border border-dashed border-base-300 bg-base-200/60 p-8 text-center">
            <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <i className="fas fa-images text-xl" aria-hidden />
            </div>
            <h3 className="text-lg font-semibold">ยังไม่มีการ์ดแต่ละใบ</h3>
            <p className="text-sm text-base-content/70 mb-4">กดปุ่มด้านล่างเพื่อประมวลผลภาพและแยกการ์ดแต่ละใบ</p>
            <button
              className="btn btn-primary"
              onClick={processPostImages}
              disabled={processing}
            >
              {processing ? (
                <>
                  <span className="loading loading-spinner loading-sm me-2" />
                  กำลังประมวลผล...
                </>
              ) : (
                <>
                  <i className="fas fa-magic me-2" aria-hidden />
                  ประมวลผลการ์ดอัตโนมัติ
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {processing && (
        <div className="card-body">
          <div className="rounded-xl border border-base-300 bg-base-200 p-6 text-center">
            <div className="mb-3">
              <span className="loading loading-spinner loading-lg text-primary" />
            </div>
            <h3 className="text-lg font-semibold">กำลังประมวลผลภาพ...</h3>
            <p className="text-sm text-base-content/70">ระบบกำลังใช้ AI ในการแยกการ์ดแต่ละใบจากภาพ</p>
          </div>
        </div>
      )}

      {error && (
        <div className="card-body pt-0">
          <div className="alert alert-error">
            <span className="text-lg" aria-hidden>
              <i className="fas fa-exclamation-triangle" />
            </span>
            <div className="flex-1">
              <p className="font-medium">{error}</p>
            </div>
            <button
              className="btn btn-sm btn-outline btn-error"
              onClick={processPostImages}
              disabled={processing}
            >
              ลองใหม่
            </button>
          </div>
        </div>
      )}

      {cards.length > 0 && (
        <div className="card-body pt-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {cards.map((card) => (
              <IndividualCard
                key={card.id}
                card={card}
                post={post}
                onAddToCart={handleAddToCart}
                onRemoveFromCart={handleRemoveFromCart}
                isInCart={isInCart(post.id, card.id)}
                isAddingToCart={false}
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
    </section>
  );
};

export default IndividualCardsGrid;


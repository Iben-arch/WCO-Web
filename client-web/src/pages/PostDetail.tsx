import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Alert, Spinner, Badge, Modal, Form } from 'react-bootstrap';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import IndividualCardsGrid from '../components/common/IndividualCardsGrid';
import { postsAPI, authAPI, auctionAPI, chatAPI } from '../api/api';
import { toast } from 'react-toastify';
import '../styles/auction-bids.css';
import { Post, Message, AuctionBid, DetectedCard, FirestoreTimestamp, IndividualCardItem } from '../types';

const PostDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const { addToCart, isInCart } = useCart();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [sendingMessage, setSendingMessage] = useState<boolean>(false);
  const [liked, setLiked] = useState<boolean>(false);
  const [likingPost, setLikingPost] = useState<boolean>(false);
  const [markingSold, setMarkingSold] = useState<boolean>(false);
  const [addingToCart, setAddingToCart] = useState<boolean>(false);
  const [showSoldModal, setShowSoldModal] = useState<boolean>(false);
  const [showBidModal, setShowBidModal] = useState<boolean>(false);
  const [bidAmount, setBidAmount] = useState<string>('');
  const [placingBid, setPlacingBid] = useState<boolean>(false);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [auctionBids, setAuctionBids] = useState<AuctionBid[]>([]);
  const [loadingBids, setLoadingBids] = useState<boolean>(false);
  const [showBidsTable, setShowBidsTable] = useState<boolean>(false);
  const [individualCards, setIndividualCards] = useState<DetectedCard[]>([]);
  const [showImageLightbox, setShowImageLightbox] = useState<boolean>(false);
  const [reAuctioning, setReAuctioning] = useState<boolean>(false);
  const [bidCardId, setBidCardId] = useState<string | undefined>(undefined);
  const [bidMinAmount, setBidMinAmount] = useState<number>(0);

  useEffect(() => {
    fetchPost();
  }, [id, currentUser]);

  useEffect(() => {
    if (post?.postType === 'auction') {
      fetchAuctionBids();
      // Poll for new bids every 5 seconds
      const interval = setInterval(() => {
        fetchAuctionBids();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [post, id]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowImageLightbox(false);
    };
    if (showImageLightbox) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [showImageLightbox]);


  const fetchPost = async (): Promise<void> => {
    try {
      setLoading(true);
      const postData = await postsAPI.getPost(id!);
      setPost(postData);
      
      // Load individual cards if available
      if (postData.individualCards && Array.isArray(postData.individualCards)) {
        setIndividualCards(postData.individualCards as DetectedCard[]);
      }
      
      // Check if user has liked this post
      if (currentUser) {
        try {
          const likeStatus = await authAPI.checkLike(id!);
          setLiked(likeStatus.liked);
        } catch (error) {
          console.error('Error checking like status:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching post:', error);
      setError('ไม่พบการ์ดที่ต้องการ');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (): Promise<void> => {
    try {
      const messages = await chatAPI.getMessages(id!);
      setMessages(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchAuctionBids = async (): Promise<void> => {
    if (post?.postType !== 'auction') return;
    
    try {
      setLoadingBids(true);
      const bids = await auctionAPI.getBids(id!);
      setAuctionBids(bids);
    } catch (error) {
      console.error('Error fetching auction bids:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูลผู้ประมูล');
    } finally {
      setLoadingBids(false);
    }
  };

  const handleStartChat = (): void => {
    toast.info('ระบบแชทถูกปิดใช้งานแล้ว');
  };

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    if (!newMessage.trim()) return;

    try {
      setSendingMessage(true);
      await chatAPI.sendMessage(id!, newMessage);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('เกิดข้อผิดพลาดในการส่งข้อความ');
    } finally {
      setSendingMessage(false);
    }
  };

  const formatPrice = (price: number | undefined): string => {
    if (!price) return '0 ฿';
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB'
    }).format(price);
  };

  const convertToDate = (dateInput: Date | string | FirestoreTimestamp | undefined): Date => {
    if (!dateInput) return new Date();
    if (typeof dateInput === 'object' && 'seconds' in dateInput) {
      return new Date(dateInput.seconds * 1000);
    }
    return new Date(dateInput);
  };

  const formatDate = (dateString: Date | string | FirestoreTimestamp | undefined): string => {
    if (!dateString) return '-';
    const date = convertToDate(dateString);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleLikePost = async (): Promise<void> => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    setLikingPost(true);
    try {
      const result = await authAPI.toggleLike(id!);
      const newLikedStatus = result.liked;
      setLiked(newLikedStatus);
      
      if (newLikedStatus) {
        toast.success('เพิ่มในรายการโปรดแล้ว ❤️');
      } else {
        toast.success('ลบออกจากรายการโปรดแล้ว');
      }
    } catch (error) {
      console.error('Error updating favorites:', error);
      toast.error('เกิดข้อผิดพลาดในการอัปเดตรายการโปรด');
    } finally {
      setLikingPost(false);
    }
  };

  const handleAddToCart = async (): Promise<void> => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    if (!post || currentUser.id === post.sellerId) {
      toast.error('ไม่สามารถเพิ่มโพสต์ของตัวเองในตะกร้าได้');
      return;
    }

    if (post.status === 'sold') {
      toast.error('โพสต์นี้ถูกขายแล้ว');
      return;
    }

    setAddingToCart(true);
    try {
      const result = await addToCart(post);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเพิ่มตะกร้า');
    } finally {
      setAddingToCart(false);
    }
  };


  const handleMarkAsSold = async (): Promise<void> => {
    setMarkingSold(true);
    try {
      await postsAPI.markAsSold(id!);
      setPost(prev => ({ ...prev, status: 'sold' }));
      setShowSoldModal(false);
      toast.success('ทำเครื่องหมายโพสต์เป็นขายแล้วแล้ว ✅');
    } catch (error) {
      console.error('Error marking post as sold:', error);
      toast.error('เกิดข้อผิดพลาดในการอัปเดตสถานะโพสต์');
    } finally {
      setMarkingSold(false);
    }
  };

  const nextImage = (): void => {
    if (post.images && post.images.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % post.images.length);
    }
  };

  const prevImage = (): void => {
    if (post.images && post.images.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + post.images.length) % post.images.length);
    }
  };

  const handlePlaceBid = async (): Promise<void> => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    if (!post || currentUser.id === post.sellerId) {
      toast.error('ไม่สามารถประมูลโพสต์ของตัวเองได้');
      return;
    }

    const bidValue = parseFloat(bidAmount);
    if (!bidValue || bidValue <= 0) {
      toast.error('กรุณากรอกจำนวนเงินประมูลที่ถูกต้อง');
      return;
    }

    const minBid = bidCardId ? bidMinAmount : (post.currentBid || post.startingBid || 0);
    if (bidValue <= minBid) {
      toast.error(`จำนวนเงินประมูลต้องมากกว่า ${formatPrice(minBid)}`);
      return;
    }

    // Check if auction has ended
    const auctionEndDate = convertToDate(post.auctionEndDate);
    if (auctionEndDate <= new Date()) {
      toast.error('การประมูลสิ้นสุดแล้ว');
      return;
    }

    setPlacingBid(true);
    try {
      const res = await auctionAPI.placeBid(id!, bidValue, bidCardId);
      
      setPost(prev => ({
        ...prev,
        currentBid: res?.currentBid ?? (bidCardId ? prev?.currentBid : bidValue),
        bidCount: res?.bidCount ?? (prev.bidCount || 0) + 1,
        highestBidder: bidCardId ? prev?.highestBidder : currentUser.id,
        ...(res?.auctionEndDate && { auctionEndDate: res.auctionEndDate })
      }));
      
      setShowBidModal(false);
      setBidAmount('');
      setBidCardId(undefined);
      toast.success(res?.message || `ประมูลสำเร็จ! จำนวนเงิน ${formatPrice(bidValue)}`);
      
      fetchAuctionBids();
    } catch (error) {
      console.error('Error placing bid:', error);
      if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error('เกิดข้อผิดพลาดในการประมูล');
      }
    } finally {
      setPlacingBid(false);
    }
  };

  const handleBuyNow = async (): Promise<void> => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    if (!post || currentUser.id === post.sellerId) {
      toast.error('ไม่สามารถซื้อโพสต์ของตัวเองได้');
      return;
    }

    // Check if auction has ended
    const auctionEndDate = convertToDate(post.auctionEndDate);
    if (auctionEndDate <= new Date()) {
      toast.error('การประมูลสิ้นสุดแล้ว');
      return;
    }

    try {
      // TODO: Implement buyNow API endpoint in backend
      // await auctionAPI.buyNow(id!);
      toast.info('ฟีเจอร์ซื้อเลยกำลังพัฒนา');
    } catch (error) {
      console.error('Error buying now:', error);
      if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error('เกิดข้อผิดพลาดในการซื้อ');
      }
    }
  };

  const handleReAuction = async (): Promise<void> => {
    if (!post || !currentUser || post.sellerId !== currentUser.id) return;
    setReAuctioning(true);
    try {
      const newEnd = new Date();
      newEnd.setDate(newEnd.getDate() + 7);
      await auctionAPI.reAuction(post.id, newEnd.toISOString());
      toast.success('เปิดประมูลใหม่แล้ว');
      const updated = await postsAPI.getPost(post.id);
      setPost(updated);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'เกิดข้อผิดพลาด';
      toast.error(msg);
    } finally {
      setReAuctioning(false);
    }
  };

  const handleCardProcessed = (cards: IndividualCardItem[]): void => {
    // Convert IndividualCardItem to DetectedCard for state
    const detectedCards: DetectedCard[] = cards.map(card => ({
      id: card.id || '',
      imageUrl: card.imageUrl,
      quantity: card.quantity,
      price: card.price
    }));
    setIndividualCards(detectedCards);
    // อัปเดต post state ด้วย
    setPost(prev => ({
      ...prev,
      individualCards: cards.map(card => ({
        id: card.id || '',
        imageUrl: card.imageUrl,
        quantity: card.quantity,
        price: card.price
      }))
    }));
  };

  if (loading) {
    return (
      <div className="post-detail-loading">
        <div className="loading-container">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3 text-muted">กำลังโหลดรายละเอียดโพสต์...</p>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="post-detail-error">
        <Container>
          <div className="error-container">
            <Alert variant="danger" className="error-alert">
              <div className="error-icon">❌</div>
              <h4>ไม่พบโพสต์ที่ต้องการ</h4>
              <p>{error || 'โพสต์นี้อาจถูกลบหรือไม่พบในระบบ'}</p>
            </Alert>
            <div className="error-actions">
              <Button as={Link as any} to="/" variant="primary" size="lg">
                🏠 กลับหน้าแรก
              </Button>
              <Button variant="outline-secondary" size="lg" onClick={() => window.history.back()}>
                ← กลับ
              </Button>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  const isOwner = currentUser && currentUser.id === post.sellerId;
  const isSold = post.status === 'sold';
  const isAuctionReleased = post.postType === 'auction' && post.auctionStatus === 'auction_released';
  const isWonPendingPayment = post.postType === 'auction' && post.auctionStatus === 'won_pending_payment';
  const isAuctionWinner = currentUser && post.winnerId === currentUser.id;
  const canBidAuction =
    post.postType === 'auction' &&
    post.auctionStatus !== 'won_pending_payment' &&
    post.auctionStatus !== 'sold' &&
    post.auctionStatus !== 'auction_released' &&
    convertToDate(post.auctionEndDate) > new Date();

  return (
    <div className="post-detail-container mercari-style">
      <Container fluid className="px-0">
        {/* Top bar - Mercari style */}
        <div className="mercari-top">
          <Container>
            <div className="mercari-breadcrumb">
              <Link to="/">หน้าแรก</Link>
              <span className="sep">›</span>
              <span className="current" title={post.title}>{post.title}</span>
            </div>
          </Container>
        </div>

        <Container className="mercari-main">
          <Row>
            {/* Left - Image gallery + Item name + Description (Mercari layout) */}
            <Col lg={7} className="mercari-left">
              {/* Image Gallery */}
              {post.images && post.images.length > 0 && (
                <div className="mercari-gallery">
                  <div
                    className="mercari-main-image-wrap mercari-main-image-clickable"
                    role="button"
                    tabIndex={0}
                    onClick={() => setShowImageLightbox(true)}
                    onKeyDown={(e) => e.key === 'Enter' && setShowImageLightbox(true)}
                    aria-label="คลิกเพื่อดูภาพขยาย"
                  >
                    <img
                      src={post.images[currentImageIndex]}
                      alt={`${post.title} ${currentImageIndex + 1}`}
                    />
                    <span className="mercari-zoom-hint">🔍 คลิกดูภาพขยาย</span>
                    {post.images.length > 1 && (
                      <>
                        <button type="button" className="image-nav-btn prev-btn" onClick={(e) => { e.stopPropagation(); prevImage(); }} aria-label="รูปก่อนหน้า">‹</button>
                        <button type="button" className="image-nav-btn next-btn" onClick={(e) => { e.stopPropagation(); nextImage(); }} aria-label="รูปถัดไป">›</button>
                      </>
                    )}
                  </div>
                  {post.images.length > 1 && (
                    <div className="mercari-thumbs">
                      {post.images.map((image, index) => (
                        <button
                          key={index}
                          type="button"
                          className={`thumb ${index === currentImageIndex ? 'active' : ''}`}
                          onClick={() => setCurrentImageIndex(index)}
                        >
                          <img src={image} alt="" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <h1 className="mercari-item-name">{post.title}</h1>
              <div className="mercari-meta">
                {isSold ? (
                  <Badge bg="secondary">ขายแล้ว</Badge>
                ) : post.postType === 'auction' ? (
                  <Badge bg="info">ประมูล</Badge>
                ) : post.saleType === 'deck' ? (
                  <Badge bg="primary">📦 ขายเด็ค</Badge>
                ) : post.saleType === 'individual' ? (
                  <Badge bg="success">🃏 ขายแยกใบ</Badge>
                ) : (
                  <Badge bg="success">ขาย</Badge>
                )}
                <Badge bg="light" text="dark">{post.category}</Badge>
                <span>โพสต์เมื่อ {formatDate(post.createdAt)}</span>
              </div>

              <div className="mercari-description-block">
                <h6>รายละเอียดสินค้า</h6>
                <div className="content">
                  {post.description ? post.description : 'ไม่มีรายละเอียดเพิ่มเติม'}
                </div>
                {post.condition && (
                  <p className="mt-2 mb-0">
                    <strong>สภาพ:</strong> <Badge bg="light" text="dark">{post.condition}</Badge>
                  </p>
                )}
              </div>

              {/* Auction Bids - show on left below description */}
              {post.postType === 'auction' && post.bidCount > 0 && (
                <div className="mercari-description-block">
                  <h6>รายการผู้ประมูล</h6>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => setShowBidsTable(!showBidsTable)}
                    className="mb-2"
                  >
                    {showBidsTable ? 'ซ่อนรายการ' : 'ดูรายการผู้ประมูล'}
                  </Button>
                  {showBidsTable && (
                    <div className="bids-table-container mt-2">
                      {loadingBids ? (
                        <div className="text-center py-3">
                          <Spinner size="sm" className="me-2" />
                          กำลังโหลด...
                        </div>
                      ) : auctionBids.length > 0 ? (
                        <div className="bids-list">
                          {auctionBids.map((bid, index) => (
                            <div key={bid.id} className={`bid-item ${index === 0 ? 'highest-bid' : ''}`}>
                              <div className="bid-rank">
                                <span className="rank-number">#{index + 1}</span>
                              </div>
                              <div className="bid-details">
                                <div className="bidder-name">
                                  {bid.bidderName}
                                  {index === 0 && <span className="highest-badge">👑</span>}
                                </div>
                                <div className="bid-amount">{formatPrice(bid.bidAmount)}</div>
                                <div className="bid-time">{formatDate(bid.createdAt)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-2 text-muted small">ยังไม่มีผู้ประมูล</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Individual Cards Grid - แสดงสำหรับขายแยกใบและประมูลแยกใบ */}
              {((post.postType === 'sale' || post.postType === 'auction') && post.saleType === 'individual') && (
                <IndividualCardsGrid 
                  post={post} 
                  onCardProcessed={handleCardProcessed}
                  readOnly={false}
                  isAuctionIndividual={post.postType === 'auction'}
                  onOpenBidModal={(cardId, minBid) => { setBidCardId(cardId); setBidMinAmount(minBid); setShowBidModal(true); }}
                  placingBid={placingBid}
                />
              )}
            </Col>

            {/* Right - Sticky: Price + Actions + Seller (Mercari style) */}
            <Col lg={5} className="mercari-right">
              <div className="mercari-aside-card">
                <div className="mercari-price-block">
                  <div className="mercari-price-label">
                    {post.postType === 'auction'
                      ? (post.saleType === 'deck' ? 'ราคาปัจจุบัน (เด็ค)' : post.saleType === 'individual' ? 'ราคาปัจจุบัน (ต่อใบ)' : 'ราคาปัจจุบัน')
                      : post.postType === 'sale' && post.saleType === 'deck'
                        ? 'ราคาเด็ค'
                        : post.postType === 'sale' && post.saleType === 'individual'
                          ? 'ราคาต่อใบ'
                          : 'ราคา'}
                  </div>
                  <div className="mercari-price-value">
                    <span className="currency">฿</span>
                    {post.postType === 'auction'
                      ? (post.currentBid ?? post.startingBid ?? 0).toLocaleString('th-TH')
                      : (post.postType === 'sale' && post.saleType === 'individual' ? (post.individualPrice ?? post.price ?? 0) : (post.price ?? 0)).toLocaleString('th-TH')}
                  </div>
                  {(post.postType === 'sale' && post.saleType === 'deck' && post.cardCount) && (
                    <div className="mercari-extra-info">เด็ค {post.cardCount} ใบ</div>
                  )}
                  {(post.postType === 'sale' && post.saleType === 'individual' && post.availableQuantity) && (
                    <div className="mercari-extra-info">เหลือ {post.availableQuantity} ใบ</div>
                  )}
                  {post.postType === 'auction' && post.bidCount > 0 && (
                    <div className="mercari-extra-info">จาก {post.bidCount} ครั้งที่ประมูล</div>
                  )}
                </div>

                {/* Auction info in sidebar */}
                {post.postType === 'auction' && (
                  <div className="mercari-auction-info">
                    {isWonPendingPayment ? (
                      <>
                        <Badge bg="warning" className="me-2">รอการชำระเงิน</Badge>
                        {post.paymentDeadline && (
                          <div className="end-time">ชำระภายใน: {formatDate(post.paymentDeadline)}</div>
                        )}
                        {isAuctionWinner && (
                          <Badge bg="success" className="mt-2">คุณเป็นผู้ชนะ — กรุณาชำระในตะกร้า</Badge>
                        )}
                      </>
                    ) : isAuctionReleased ? (
                      <Badge bg="secondary">รายการหลุด — เจ้าของสามารถเปิดประมูลใหม่</Badge>
                    ) : post.auctionEndDate && (
                      <>
                        {convertToDate(post.auctionEndDate) > new Date() ? (
                          <Badge bg="success" className="me-2">กำลังประมูล</Badge>
                        ) : (
                          <Badge bg="danger">สิ้นสุดแล้ว</Badge>
                        )}
                        <div className="end-time">สิ้นสุด: {formatDate(post.auctionEndDate)}</div>
                        {post.startingBid != null && (
                          <div>ราคาเริ่มต้น: {formatPrice(post.startingBid)}</div>
                        )}
                        {post.buyNowPrice != null && (
                          <div>ซื้อเลย: {formatPrice(post.buyNowPrice)}</div>
                        )}
                        {post.highestBidder === currentUser?.id && (
                          <Badge bg="warning" className="mt-2">คุณเป็นผู้ประมูลสูงสุด</Badge>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="mercari-actions-block">
                  {!currentUser ? (
                    <Alert variant="info" className="mb-0 small">
                      <Link to="/login">เข้าสู่ระบบ</Link> เพื่อซื้อหรือติดต่อผู้ขาย
                    </Alert>
                  ) : isOwner ? (
                    <>
                      {isAuctionReleased && (
                        <button
                          type="button"
                          className="btn-mercari-primary"
                          onClick={handleReAuction}
                          disabled={reAuctioning}
                        >
                          {reAuctioning ? 'กำลังเปิด...' : 'ประมูลใหม่'}
                        </button>
                      )}
                      {!isSold && !isAuctionReleased && (
                        <button
                          type="button"
                          className="btn-mercari-primary"
                          onClick={() => setShowSoldModal(true)}
                        >
                          {post.postType === 'auction' ? 'จบการประมูล' : 'ขายแล้ว'}
                        </button>
                      )}
                      <Link to="/my-posts" className="btn-mercari-outline" style={{ textAlign: 'center', textDecoration: 'none' }}>
                        จัดการโพสต์
                      </Link>
                      {isSold && (
                        <div className="small text-success text-center py-2">โพสต์นี้ถูกขายแล้ว</div>
                      )}
                    </>
                  ) : (
                    <>
                      {!isSold ? (
                        <>
                          <button
                            type="button"
                            className="btn-mercari-primary"
                            onClick={handleStartChat}
                          >
                            ติดต่อผู้ขาย
                          </button>
                          <button
                            type="button"
                            className="btn-mercari-outline"
                            onClick={handleLikePost}
                            disabled={likingPost}
                          >
                            {likingPost ? <Spinner size="sm" className="me-2" /> : null}
                            {liked ? '❤️ อยู่ในรายการโปรด' : 'เพิ่มรายการโปรด'}
                          </button>
                          {post.postType !== 'auction' && (
                          <button
                            type="button"
                            className="btn-mercari-outline"
                            onClick={handleAddToCart}
                            disabled={addingToCart || isInCart(post.id)}
                          >
                            {addingToCart ? <Spinner size="sm" className="me-2" /> : null}
                            {isInCart(post.id) ? 'อยู่ในตะกร้าแล้ว' : 'เพิ่มในตะกร้า'}
                          </button>
                          )}
                          {post.postType === 'auction' && (
                            <>
                              {isWonPendingPayment && isAuctionWinner && (
                                <Link
                                  to="/cart"
                                  className="btn-mercari-primary"
                                  style={{ textDecoration: 'none', textAlign: 'center' }}
                                >
                                  ไปตะกร้าเพื่อชำระเงิน
                                </Link>
                              )}
                              {canBidAuction && post.saleType !== 'individual' && (
                                <>
                                  <button
                                    type="button"
                                    className="btn-mercari-primary"
                                    onClick={() => { setBidCardId(undefined); setBidMinAmount(post?.currentBid ?? post?.startingBid ?? 0); setShowBidModal(true); }}
                                  >
                                    ประมูล
                                  </button>
                                  {post.buyNowPrice && (
                                    <button
                                      type="button"
                                      className="btn-mercari-primary"
                                      onClick={handleBuyNow}
                                    >
                                      ซื้อเลย {formatPrice(post.buyNowPrice)}
                                    </button>
                                  )}
                                </>
                              )}
                              {isWonPendingPayment && !isAuctionWinner && (
                                <span className="text-muted small">มีผู้ชนะแล้ว รอการชำระเงิน</span>
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <Alert variant="warning" className="mb-0 small">โพสต์นี้ถูกขายแล้ว</Alert>
                      )}
                      {isSold && (
                        <Link to="/" className="btn-mercari-primary" style={{ textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                          ดูโพสต์อื่น
                        </Link>
                      )}
                    </>
                  )}
                </div>

                <div className="mercari-seller-block">
                  <div className="mercari-seller-avatar">👤</div>
                  <div className="mercari-seller-info">
                    <div className="mercari-seller-name">{post.sellerName}</div>
                    <button
                      type="button"
                      className="btn btn-link p-0 mercari-seller-link"
                      onClick={() => navigate(`/seller/${post.sellerId}`)}
                    >
                      ดูประวัติผู้ขาย
                    </button>
                  </div>
                </div>
              </div>
            </Col>
          </Row>
        </Container>

        {/* Image Lightbox - ดูภาพขยาย */}
        {showImageLightbox && post?.images && post.images.length > 0 && (
          <div
            className="image-lightbox-overlay"
            onClick={() => setShowImageLightbox(false)}
            role="dialog"
            aria-modal="true"
            aria-label="ภาพขยาย"
          >
            <button
              type="button"
              className="image-lightbox-close"
              onClick={() => setShowImageLightbox(false)}
              aria-label="ปิด"
            >
              ✕
            </button>
            <div
              className="image-lightbox-content"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={post.images[currentImageIndex]}
                alt={`${post.title} ${currentImageIndex + 1}`}
              />
              {post.images.length > 1 && (
                <>
                  <button
                    type="button"
                    className="image-lightbox-nav prev"
                    onClick={(e) => { e.stopPropagation(); prevImage(); }}
                    aria-label="รูปก่อนหน้า"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="image-lightbox-nav next"
                    onClick={(e) => { e.stopPropagation(); nextImage(); }}
                    aria-label="รูปถัดไป"
                  >
                    ›
                  </button>
                  <span className="image-lightbox-counter">
                    {currentImageIndex + 1} / {post.images.length}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Chat Modal */}
        {showChat && (
          <div className="chat-modal-overlay">
            <div className="chat-modal">
              <div className="chat-header">
                <h6>💬 แชทกับ {post.sellerName}</h6>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => {
                    setShowChat(false);
                    // Chat is now handled by Facebook Messenger
                  }}
                >
                  ✕
                </Button>
              </div>
              <div className="chat-body">
                {messages.length === 0 ? (
                  <div className="no-messages">
                    <p>เริ่มต้นการสนทนา</p>
                  </div>
                ) : (
                  <div className="messages-container">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`message ${message.senderId === currentUser.id ? 'own' : 'other'}`}
                      >
                        <div className="message-content">
                          <div className="message-text">{message.message}</div>
                          <div className="message-time">
                            {formatDate(message.timestamp)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="chat-footer">
                <form onSubmit={handleSendMessage}>
                  <div className="message-input-group">
                    <input
                      type="text"
                      className="message-input"
                      placeholder="พิมพ์ข้อความ..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      disabled={sendingMessage}
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={sendingMessage || !newMessage.trim()}
                    >
                      ส่ง
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Sold Confirmation Modal */}
        <Modal show={showSoldModal} onHide={() => setShowSoldModal(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title>✅ ยืนยันการขาย</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>คุณต้องการทำเครื่องหมายโพสต์ "<strong>{post.title}</strong>" เป็นขายแล้วหรือไม่?</p>
            <Alert variant="warning">
              ⚠️ การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </Alert>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowSoldModal(false)}>
              ยกเลิก
            </Button>
            <Button 
              variant="success" 
              onClick={handleMarkAsSold}
              disabled={markingSold}
            >
              {markingSold ? (
                <>
                  <Spinner size="sm" className="me-2" />
                  กำลังดำเนินการ...
                </>
              ) : (
                'ยืนยันการขาย'
              )}
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Bid Modal */}
        <Modal show={showBidModal} onHide={() => { setShowBidModal(false); setBidCardId(undefined); setBidAmount(''); }} centered>
          <Modal.Header closeButton>
            <Modal.Title>🔨 ประมูล - {post?.title}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="bid-info mb-4">
              <h6>📊 ข้อมูลการประมูล</h6>
              <div className="bid-details">
                <div className="bid-detail-item">
                  <span className="label">🎯 ราคาเริ่มต้น:</span>
                  <span className="value">{formatPrice(bidCardId ? bidMinAmount || 0 : (post?.startingBid ?? 0))}</span>
                </div>
                {(bidCardId ? bidMinAmount > 0 : (post?.currentBid ?? 0) > (post?.startingBid ?? 0)) && (
                  <div className="bid-detail-item">
                    <span className="label">💰 ขั้นต่ำที่ต้องประมูล:</span>
                    <span className="value current-bid">{formatPrice((bidCardId ? bidMinAmount : (post?.currentBid ?? 0)) + 1)}</span>
                  </div>
                )}
                <div className="bid-detail-item">
                  <span className="label">⏰ สิ้นสุดประมูล:</span>
                  <span className="value">{formatDate(post?.auctionEndDate)}</span>
                </div>
                {post?.bidCount > 0 && (
                  <div className="bid-detail-item">
                    <span className="label">📊 จำนวนครั้งที่ประมูล:</span>
                    <span className="value">{post.bidCount} ครั้ง</span>
                  </div>
                )}
                {post?.buyNowPrice && (
                  <div className="bid-detail-item buy-now">
                    <span className="label">🛒 ราคาซื้อเลย:</span>
                    <span className="value">{formatPrice(post.buyNowPrice)}</span>
                  </div>
                )}
              </div>
            </div>
            
            <Form.Group className="mb-3">
              <Form.Label>จำนวนเงินประมูล (บาท) *</Form.Label>
              <Form.Control
                type="number"
                placeholder={`ขั้นต่ำ ${formatPrice((post?.currentBid || post?.startingBid) + 1)}`}
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                min={(post?.currentBid || post?.startingBid) + 1}
                step="1"
                className="bid-input"
              />
              <Form.Text className="text-muted">
                จำนวนเงินประมูลต้องมากกว่า {formatPrice(bidCardId ? bidMinAmount : (post?.currentBid || post?.startingBid || 0))}
              </Form.Text>
            </Form.Group>
            
            <Alert variant="warning">
              ⚠️ <strong>ข้อควรระวัง:</strong> หลังจากประมูลแล้ว คุณจะไม่สามารถแก้ไขหรือยกเลิกการประมูลได้
            </Alert>
            
            <Alert variant="info">
              💡 <strong>คำแนะนำ:</strong> ตรวจสอบราคาและเวลาสิ้นสุดการประมูลให้ดีก่อนประมูล
            </Alert>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowBidModal(false)}>
              ยกเลิก
            </Button>
            <Button 
              className="btn-tcg-primary btn-tcg-lg"
              onClick={handlePlaceBid}
              disabled={placingBid || !bidAmount}
            >
              {placingBid ? (
                <>
                  <Spinner size="sm" className="me-2" />
                  กำลังประมูล...
                </>
              ) : (
                '🔨 ยืนยันการประมูล'
              )}
            </Button>
          </Modal.Footer>
        </Modal>

      </Container>
    </div>
  );
};

export default PostDetail;

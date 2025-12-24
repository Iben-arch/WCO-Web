import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Alert, Spinner, Badge, Modal, Form } from 'react-bootstrap';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import IndividualCardsGrid from '../components/common/IndividualCardsGrid';
import axios from '../utils/axiosInterceptor';
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


  const fetchPost = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/posts/${id}`);
      setPost(response.data);
      
      // Load individual cards if available
      if (response.data.individualCards) {
        setIndividualCards(response.data.individualCards);
      }
      
      // Check if user has liked this post
      if (currentUser) {
        try {
          const likeResponse = await axios.get(`/api/auth/check-like/${id}`);
          setLiked(likeResponse.data.liked);
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
      const response = await axios.get(`/api/chat/${id}`);
      setMessages(response.data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchAuctionBids = async (): Promise<void> => {
    if (post?.postType !== 'auction') return;
    
    try {
      setLoadingBids(true);
      const response = await axios.get(`/api/posts/${id}/bids`);
      setAuctionBids(response.data.bids);
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
      await axios.post(`/api/chat/${id}`, { message: newMessage });
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
      const response = await axios.post(`/api/auth/like-post/${id}`);
      const { liked: newLikedStatus } = response.data;
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

    if (!post || currentUser.uid === post.sellerId) {
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
      const response = await axios.put(`/api/posts/${id}/mark-sold`);
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

    if (!post || currentUser.uid === post.sellerId) {
      toast.error('ไม่สามารถประมูลโพสต์ของตัวเองได้');
      return;
    }

    const bidValue = parseFloat(bidAmount);
    if (!bidValue || bidValue <= 0) {
      toast.error('กรุณากรอกจำนวนเงินประมูลที่ถูกต้อง');
      return;
    }

    if (bidValue <= (post.currentBid || post.startingBid)) {
      toast.error(`จำนวนเงินประมูลต้องมากกว่า ${formatPrice(post.currentBid || post.startingBid)}`);
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
      const response = await axios.post(`/api/posts/${id}/bid`, {
        bidAmount: bidValue
      });
      
      // Update post data
      setPost(prev => ({
        ...prev,
        currentBid: bidValue,
        bidCount: (prev.bidCount || 0) + 1,
        highestBidder: currentUser.uid
      }));
      
      setShowBidModal(false);
      setBidAmount('');
      toast.success(`ประมูลสำเร็จ! จำนวนเงิน ${formatPrice(bidValue)}`);
      
      // Refresh auction bids after successful bid
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

    if (!post || currentUser.uid === post.sellerId) {
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
      const response = await axios.post(`/api/posts/${id}/buy-now`);
      toast.success('ซื้อเลยสำเร็จ! กรุณาติดต่อผู้ขายเพื่อดำเนินการต่อ');
      // Navigate to chat or show success message
    } catch (error) {
      console.error('Error buying now:', error);
      if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error('เกิดข้อผิดพลาดในการซื้อ');
      }
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

  const isOwner = currentUser && currentUser.uid === post.sellerId;
  const isSold = post.status === 'sold';

  return (
    <div className="post-detail-container">
      <Container fluid className="px-0">
        {/* Hero Section */}
        <div className="post-hero">
          <Container>
            <div className="post-breadcrumb">
              <Link to="/" className="breadcrumb-link">🏠 หน้าแรก</Link>
              <span className="breadcrumb-separator">›</span>
              <span className="breadcrumb-current">{post.title}</span>
            </div>
          </Container>
        </div>

        <Container className="py-4">
          <Row>
            {/* Left Column - Images and Details */}
            <Col lg={8}>
              {/* Image Gallery */}
              {post.images && post.images.length > 0 && (
                <Card className="post-image-card mb-4">
                  <div className="image-gallery-container">
                    <div className="main-image-container">
                      <img
                        src={post.images[currentImageIndex]}
                        alt={`${post.title} ${currentImageIndex + 1}`}
                        className="main-image"
                      />
                      {post.images.length > 1 && (
                        <>
                          <button 
                            className="image-nav-btn prev-btn"
                            onClick={prevImage}
                          >
                            ‹
                          </button>
                          <button 
                            className="image-nav-btn next-btn"
                            onClick={nextImage}
                          >
                            ›
                          </button>
                        </>
                      )}
                      <div className="image-counter">
                        {currentImageIndex + 1} / {post.images.length}
                      </div>
                    </div>
                    
                    {post.images.length > 1 && (
                      <div className="thumbnail-container">
                        {post.images.map((image, index) => (
                          <img
                            key={index}
                            src={image}
                            alt={`${post.title} ${index + 1}`}
                            className={`thumbnail ${index === currentImageIndex ? 'active' : ''}`}
                            onClick={() => setCurrentImageIndex(index)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Post Details */}
              <Card className="post-details-card mb-4">
                <Card.Body>
                  <div className="post-header">
                    <div className="post-title-section">
                      <h1 className="post-title">{post.title}</h1>
                      <div className="post-meta">
                        <div className="post-badges">
                          {isSold ? (
                            <Badge className="status-badge sold-badge">✅ ขายแล้ว</Badge>
                          ) : post.postType === 'auction' ? (
                            <Badge className="status-badge auction-badge">🔨 ประมูล</Badge>
                          ) : (
                            <Badge className="status-badge sale-badge">💰 ขาย</Badge>
                          )}
                          <Badge className="category-badge">{post.category}</Badge>
                        </div>
                        <div className="post-date">
                          📅 โพสต์เมื่อ {formatDate(post.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="post-description">
                    <h5>📝 รายละเอียด</h5>
                    <div className="description-content">
                      {post.description ? (
                        <p>{post.description}</p>
                      ) : (
                        <p className="text-muted">ไม่มีรายละเอียดเพิ่มเติม</p>
                      )}
                    </div>
                  </div>

                  {post.condition && (
                    <div className="post-condition">
                      <h6>🏷️ สภาพสินค้า</h6>
                      <Badge className="condition-badge">{post.condition}</Badge>
                    </div>
                  )}
                </Card.Body>
              </Card>

              {/* Individual Cards Grid - Only show for individual sale posts */}
              {post.postType === 'sale' && post.saleType === 'individual' && (
                <IndividualCardsGrid 
                  post={post} 
                  onCardProcessed={handleCardProcessed}
                />
              )}
            </Col>

            {/* Right Column - Price and Actions */}
            <Col lg={4}>
              {/* Price Card */}
              <Card className="price-card mb-4">
                <Card.Body>
                  <div className="price-section">
                    {post.postType === 'auction' ? (
                      <div className="auction-price-display">
                        <div className="price-label">
                          {post.saleType === 'deck' ? 'ราคาปัจจุบันเด็ค' : post.saleType === 'individual' ? 'ราคาปัจจุบันต่อใบ' : 'ราคาปัจจุบัน'}
                        </div>
                        <div className="price-value auction-price-value">
                          {formatPrice(post.currentBid || post.startingBid)}
                        </div>
                        {post.saleType === 'deck' && post.cardCount && (
                          <div className="auction-deck-details">
                            <small className="text-muted">
                              เด็ค {post.cardCount} ใบ
                            </small>
                          </div>
                        )}
                        {post.saleType === 'individual' && post.availableQuantity && (
                          <div className="auction-quantity-details">
                            <small className="text-muted">
                              เหลือ {post.availableQuantity} ใบ
                            </small>
                          </div>
                        )}
                        {post.bidCount > 0 && (
                          <div className="bid-info">
                            <small className="text-muted">
                              จาก {post.bidCount} ครั้งที่ประมูล
                            </small>
                          </div>
                        )}
                      </div>
                    ) : post.postType === 'sale' && post.saleType === 'deck' ? (
                      <div className="deck-price-display">
                        <div className="price-label">ราคาเด็ค</div>
                        <div className="price-value deck-price-value">
                          {formatPrice(post.price)}
                        </div>
                        <div className="deck-details">
                          <div className="deck-breakdown">
                            <small className="text-muted">
                              {post.cardCount} ใบ
                            </small>
                          </div>
                        </div>
                      </div>
                    ) : post.postType === 'sale' && post.saleType === 'individual' ? (
                      <div className="individual-price-display">
                        <div className="price-label">ราคาต่อใบ</div>
                        <div className="price-value individual-price-value">
                          {formatPrice(post.individualPrice || post.price)}
                        </div>
                        {post.availableQuantity && (
                          <div className="quantity-info">
                            <small className="text-muted">
                              เหลือ {post.availableQuantity} ใบ
                            </small>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="price-label">ราคา</div>
                        <div className="price-value">{formatPrice(post.price)}</div>
                      </>
                    )}
                  </div>
                  
                  {post.postType === 'auction' && post.auctionEndDate && (
                    <div className="auction-info">
                      <div className="auction-status">
                        {post.auctionEndDate && convertToDate(post.auctionEndDate) > new Date() ? (
                          <Badge bg="success" className="mb-2">🟢 กำลังประมูล</Badge>
                        ) : (
                          <Badge bg="danger" className="mb-2">🔴 สิ้นสุดแล้ว</Badge>
                        )}
                      </div>
                      <div className="auction-end">
                        ⏰ สิ้นสุดประมูล: {formatDate(post.auctionEndDate)}
                      </div>
                      {post.startingBid && (
                        <div className="starting-bid">
                          🎯 ราคาเริ่มต้น: {formatPrice(post.startingBid)}
                        </div>
                      )}
                      {post.currentBid && post.currentBid > post.startingBid && (
                        <div className="current-bid">
                          💰 ราคาปัจจุบัน: {formatPrice(post.currentBid)}
                        </div>
                      )}
                      {post.bidCount > 0 && (
                        <div className="bid-count">
                          📊 จำนวนครั้งที่ประมูล: {post.bidCount} ครั้ง
                        </div>
                      )}
                      {post.buyNowPrice && (
                        <div className="buy-now-price">
                          🛒 ราคาซื้อเลย: {formatPrice(post.buyNowPrice)}
                        </div>
                      )}
                      {post.highestBidder && post.highestBidder === currentUser?.uid && (
                        <div className="highest-bidder-notice">
                          <Badge bg="warning">👑 คุณเป็นผู้ประมูลสูงสุด</Badge>
                        </div>
                      )}
                      
                      {/* Auction Bids Section */}
                      {post.bidCount > 0 && (
                        <div className="auction-bids-section mt-3">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => setShowBidsTable(!showBidsTable)}
                            className="w-100"
                          >
                            {showBidsTable ? '🔼 ซ่อนรายการผู้ประมูล' : '📋 ดูรายการผู้ประมูล'}
                          </Button>
                          
                          {showBidsTable && (
                            <div className="bids-table-container mt-3">
                              {loadingBids ? (
                                <div className="text-center py-3">
                                  <Spinner size="sm" className="me-2" />
                                  กำลังโหลดข้อมูลผู้ประมูล...
                                </div>
                              ) : auctionBids.length > 0 ? (
                                <div className="bids-table">
                                  <div className="bids-header">
                                    <h6 className="mb-3">📊 รายการผู้ประมูล</h6>
                                  </div>
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
                                          <div className="bid-amount">
                                            {formatPrice(bid.bidAmount)}
                                          </div>
                                          <div className="bid-time">
                                            {formatDate(bid.createdAt)}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-3 text-muted">
                                  ยังไม่มีผู้ประมูล
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </Card.Body>
              </Card>

              {/* Seller Info */}
              <Card className="seller-card mb-4">
                <Card.Body>
                  <div className="seller-info">
                    <h6>👤 ข้อมูลผู้ขาย</h6>
                    <div className="seller-details">
                      <div className="seller-name">{post.sellerName}</div>
                      <Badge className="seller-status">✅ ผู้ขายที่เชื่อถือได้</Badge>
                      <Button
                        className="btn-tcg-outline btn-tcg-sm mt-2 w-100"
                        onClick={() => navigate(`/seller/${post.sellerId}`)}
                      >
                        👤 ดูประวัติผู้ขาย
                      </Button>
                    </div>
                  </div>
                </Card.Body>
              </Card>

              {/* Action Buttons */}
              <Card className="action-card">
                <Card.Body>
                  {!currentUser ? (
                    <div className="guest-actions">
                      <Alert variant="info" className="login-prompt">
                        <Link to="/login">🔐 เข้าสู่ระบบ</Link> เพื่อเริ่มการสนทนาและซื้อขาย
                      </Alert>
                    </div>
                  ) : isOwner ? (
                    <div className="owner-actions">
                          {!isSold ? (
                            <div className="owner-buttons">
                              {post.postType === 'auction' ? (
                                <>
                                  <Button
                                    className="btn-tcg-primary btn-tcg-lg w-100 mb-3"
                                    onClick={() => setShowSoldModal(true)}
                                  >
                                    ✅ จบการประมูล
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  className="btn-tcg-primary btn-tcg-lg w-100 mb-3"
                                  onClick={() => setShowSoldModal(true)}
                                >
                                  ✅ ขายแล้ว
                                </Button>
                              )}
                              <Button
                                as={Link as any}
                                to="/my-posts"
                                className="btn-tcg-outline btn-tcg-lg w-100"
                              >
                                ⚙️ จัดการโพสต์
                              </Button>
                            </div>
                          ) : (
                            <div className="sold-status">
                              <Alert variant="success" className="text-center">
                                <h6>✅ โพสต์นี้ถูกขายแล้ว</h6>
                                <p className="mb-0">ขอบคุณที่ใช้บริการของเรา</p>
                              </Alert>
                              <Button
                                as={Link as any}
                                to="/my-posts"
                                className="btn-tcg-outline btn-tcg-lg w-100 mt-3"
                              >
                                ⚙️ จัดการโพสต์อื่น
                              </Button>
                            </div>
                          )}
                    </div>
                  ) : (
                    <div className="buyer-actions">
                      {!isSold ? (
                        <div className="buyer-buttons">
                          <Button
                            className="btn-tcg-primary btn-tcg-lg w-100 mb-3"
                            onClick={handleStartChat}
                          >
                            💬 เริ่มแชท
                          </Button>
                          <Button
                            className="btn-tcg-outline btn-tcg-lg w-100 mb-3"
                            onClick={handleLikePost}
                            disabled={likingPost}
                          >
                            {likingPost ? (
                              <Spinner size="sm" className="me-2" />
                            ) : liked ? (
                              '❤️ อยู่ในรายการโปรด'
                            ) : (
                              '🤍 เพิ่มรายการโปรด'
                            )}
                          </Button>
                          <Button
                            className="btn-tcg-outline btn-tcg-lg w-100 mb-3"
                            onClick={handleAddToCart}
                            disabled={addingToCart || isInCart(post.id)}
                          >
                            {addingToCart ? (
                              <>
                                <Spinner size="sm" className="me-2" />
                                กำลังเพิ่ม...
                              </>
                            ) : isInCart(post.id) ? (
                              '🛒 อยู่ในตะกร้าแล้ว'
                            ) : (
                              '🛒 เพิ่มในตะกร้า'
                            )}
                          </Button>
                          {post.postType === 'auction' && (
                            <div className="auction-actions">
                              <Button
                                className="btn-tcg-primary btn-tcg-lg w-100 mb-3"
                                onClick={() => setShowBidModal(true)}
                              >
                                🔨 ประมูล
                              </Button>
                              {post.buyNowPrice && (
                                <Button
                                  className="btn-tcg-primary btn-tcg-lg w-100 mb-3"
                                  onClick={handleBuyNow}
                                >
                                  💳 ซื้อเลย {formatPrice(post.buyNowPrice)}
                                </Button>
                              )}
                              <Button
                                className="btn-tcg-outline btn-tcg-lg w-100"
                                onClick={handleStartChat}
                              >
                                💬 ติดต่อผู้ขาย
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="sold-notice">
                          <Alert variant="warning" className="text-center">
                            <h6>⚠️ โพสต์นี้ถูกขายแล้ว</h6>
                            <p className="mb-0">ดูโพสต์อื่นที่คล้ายกันได้ที่หน้าหลัก</p>
                          </Alert>
                          <Button
                            as={Link as any}
                            to="/"
                            className="btn-tcg-primary btn-tcg-lg w-100"
                          >
                            🏠 ดูโพสต์อื่น
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>

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
                        className={`message ${message.senderId === currentUser.uid ? 'own' : 'other'}`}
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
        <Modal show={showBidModal} onHide={() => setShowBidModal(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title>🔨 ประมูล - {post?.title}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="bid-info mb-4">
              <h6>📊 ข้อมูลการประมูล</h6>
              <div className="bid-details">
                <div className="bid-detail-item">
                  <span className="label">🎯 ราคาเริ่มต้น:</span>
                  <span className="value">{formatPrice(post?.startingBid)}</span>
                </div>
                {post?.currentBid && post.currentBid > post.startingBid && (
                  <div className="bid-detail-item">
                    <span className="label">💰 ราคาปัจจุบัน:</span>
                    <span className="value current-bid">{formatPrice(post.currentBid)}</span>
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
                จำนวนเงินประมูลต้องมากกว่า {formatPrice(post?.currentBid || post?.startingBid)}
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

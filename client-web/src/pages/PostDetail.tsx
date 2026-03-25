import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Alert, Spinner, Badge, Modal, Form } from 'react-bootstrap';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import IndividualCardsGrid from '../components/common/IndividualCardsGrid';
import { postsAPI, authAPI, auctionAPI, chatAPI } from '../api/api';
import axios from '../utils/axiosInterceptor';
import { toast } from 'react-toastify';
import '../styles/auction-bids.css';
import { Post, Message, AuctionBid, DetectedCard, FirestoreTimestamp, IndividualCardItem } from '../types';
import { recordCategoryInterest } from '../utils/categoryInterest';
import { supabase } from '../config/supabase';
import { canSellCards } from '../utils/roles';

const PostDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, userProfile, profile } = useAuth();
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

  const [similarPosts, setSimilarPosts] = useState<Post[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState<boolean>(false);
  const [showResubmitModal, setShowResubmitModal] = useState<boolean>(false);
  const [resubmitLoading, setResubmitLoading] = useState<boolean>(false);
  const [resubmitForm, setResubmitForm] = useState<{
    title: string;
    description: string;
    category: string;
    price: string;
  }>({ title: '', description: '', category: '', price: '' });

  const [resubmitImages, setResubmitImages] = useState<File[]>([]);
  const [resubmitImagePreviews, setResubmitImagePreviews] = useState<string[]>([]);

  const [resubmitIndividualCards, setResubmitIndividualCards] = useState<DetectedCard[]>([]);
  const [resubmitCardsLoading, setResubmitCardsLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchPost();
  }, [id, currentUser]);

  useEffect(() => {
    if (post?.id) {
      setLoadingSimilar(true);
      postsAPI.getSimilarPosts(post.id, 8)
        .then((posts) => setSimilarPosts(posts ?? []))
        .catch(() => setSimilarPosts([]))
        .finally(() => setLoadingSimilar(false));
    }
  }, [post?.id]);

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

      // เก็บความสนใจหมวดหมู่ เมื่อผู้ใช้เข้าดูรายละเอียด
      if (postData?.category) {
        recordCategoryInterest(postData.category, currentUser?.id);
      }
      
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

    if (post.status !== 'active') {
      toast.error('โพสต์นี้ไม่พร้อมใช้งาน');
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

  const openResubmitModal = (): void => {
    if (!post) return;
    // reset resubmit image state
    resubmitImagePreviews.forEach((u) => URL.revokeObjectURL(u));
    setResubmitImages([]);
    setResubmitImagePreviews([]);
    setResubmitIndividualCards([]);
    setResubmitCardsLoading(false);
    const initialPrice =
      post.postType === 'sale'
        ? post.saleType === 'individual'
          ? post.individualPrice ?? post.price ?? 0
          : post.price ?? 0
        : '';

    setResubmitForm({
      title: post.title ?? '',
      description: post.description ?? '',
      category: post.category ?? '',
      price: typeof initialPrice === 'number' ? String(initialPrice) : ''
    });

    // For saleType=individual: allow editing price/quantity per card
    if (post.postType === 'sale' && post.saleType === 'individual' && post.individualCards?.length) {
      setResubmitIndividualCards(
        post.individualCards.map((c, idx) => ({
          id: c.id ?? `card-${idx}`,
          imageUrl: c.imageUrl,
          quantity: typeof c.quantity === 'number' ? c.quantity : Number(c.quantity) || 1,
          price: typeof c.price === 'number' ? c.price : Number(c.price) || ''
        }))
      );
    }
    setShowResubmitModal(true);
  };

  const handleResubmitForApproval = async (): Promise<void> => {
    if (!post) return;
    setResubmitLoading(true);
    try {
      const payload: any = {
        title: resubmitForm.title,
        description: resubmitForm.description,
        category: resubmitForm.category
      };

      if (resubmitImages.length > 0) {
        if (!currentUser) {
          toast.error('กรุณาเข้าสู่ระบบก่อน');
          return;
        }

        const uploadedStoragePaths: string[] = [];
        const uploadedImageUrls: string[] = [];
        try {
          for (let i = 0; i < resubmitImages.length; i++) {
            const file = resubmitImages[i];
            if (!file.type.startsWith('image/')) {
              toast.error('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
              return;
            }

            const fileExt = file.name.split('.').pop() || 'jpg';
            const fileName = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).substring(7)}-${i}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
              .from('posts')
              .upload(fileName, file, { cacheControl: '3600', upsert: false });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(fileName);
            uploadedStoragePaths.push(fileName);
            uploadedImageUrls.push(publicUrl);
          }

          payload.imageUrls = uploadedImageUrls;
          payload.imageStoragePaths = uploadedStoragePaths;
        } catch (uploadErr: any) {
          // rollback uploads if we failed mid-way
          if (uploadedStoragePaths.length > 0) {
            try {
              await supabase.storage.from('posts').remove(uploadedStoragePaths);
            } catch {
              // ignore rollback error
            }
          }
          throw uploadErr;
        }
      }

      if (post.postType === 'sale') {
        if (post.saleType === 'individual') {
          if (resubmitIndividualCards.length === 0) {
            toast.error('กรุณามีรายการการ์ดแยกใบเพื่อยื่นขออนุมัติใหม่');
            return;
          }

          const cardsPayload = resubmitIndividualCards.map((c) => {
            const priceNum = parseFloat(String(c.price));
            const qtyNum = parseInt(String(c.quantity), 10);
            return { id: c.id ?? '', imageUrl: c.imageUrl, price: priceNum, quantity: qtyNum };
          });

          const invalid = cardsPayload.some((c) => !Number.isFinite(c.price) || c.price <= 0 || !Number.isFinite(c.quantity) || c.quantity <= 0 || !c.imageUrl);
          if (invalid) {
            toast.error('กรุณากรอกราคา/จำนวนต่อใบให้ถูกต้อง (ราคา > 0, จำนวน >= 1)');
            return;
          }

          const minPrice = Math.min(...cardsPayload.map((c) => c.price));
          payload.individualCards = cardsPayload;
          // fallback: ใช้ min เพื่อให้ระบบแสดงราคาอ้างอิงได้
          payload.price = minPrice;
        } else {
          const priceNum = parseFloat(resubmitForm.price);
          if (!Number.isFinite(priceNum) || priceNum < 0) {
            toast.error('กรุณากรอกราคาที่ถูกต้อง');
            return;
          }
          payload.price = priceNum;
        }
      }

      await postsAPI.updatePost(post.id, payload);
      const updated = await postsAPI.resubmitPost(post.id);
      setPost(updated);
      // clear selected images after success
      resubmitImagePreviews.forEach((u) => URL.revokeObjectURL(u));
      setResubmitImages([]);
      setResubmitImagePreviews([]);
      setShowResubmitModal(false);
      toast.success('ยื่นขออนุมัติใหม่สำเร็จแล้ว');
    } catch (error) {
      console.error('Error resubmitting post:', error);
      toast.error('เกิดข้อผิดพลาดในการยื่นขออนุมัติใหม่');
    } finally {
      setResubmitLoading(false);
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

    if (post.status !== 'active') {
      toast.error('โพสต์นี้ไม่พร้อมสำหรับการประมูล');
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

    if (post.status !== 'active') {
      toast.error('โพสต์นี้ไม่พร้อมใช้งาน');
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
  const isOwnerSeller =
    isOwner && canSellCards(userProfile?.role ?? profile?.role);
  const isSold = post.status === 'sold';
  const isPostActive = post.status === 'active';
  const isRejected = post.status === 'rejected';
  const isAuction = post.postType === 'auction';
  const isAuctionReleased = isAuction && post.auctionStatus === 'auction_released';
  const isWonPendingPayment = isAuction && post.auctionStatus === 'won_pending_payment';
  const isAuctionActive = isAuction && post.auctionStatus === 'active';
  const auctionEndDate = convertToDate(post.auctionEndDate);
  const isAuctionEnded = isAuction && auctionEndDate <= new Date();
  const isAuctionWinner = currentUser && post.winnerId === currentUser.id;
  const canBidAuction =
    isAuction &&
    isPostActive &&
    isAuctionActive &&
    auctionEndDate > new Date();

  const canOwnerMarkSoldSale = post.postType === 'sale' && isPostActive && !isSold;
  const canOwnerCloseAuction = post.postType === 'auction' && isAuctionActive && isAuctionEnded && isPostActive && !isSold;

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
                ) : isWonPendingPayment ? (
                  <Badge bg="warning">รอการชำระเงิน</Badge>
                ) : post.status === 'pending' ? (
                  <Badge bg="warning">รอตรวจสอบ</Badge>
                ) : post.status === 'inactive' ? (
                  <Badge bg="secondary">ปิดการขาย</Badge>
                ) : post.status === 'rejected' ? (
                  <Badge bg="danger">ถูกปฏิเสธ</Badge>
                ) : (
                  <Badge bg="success">กำลังขาย</Badge>
                )}

                {post.postType === 'auction' ? (
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
                  readOnly={!isPostActive}
                  isAuctionIndividual={post.postType === 'auction'}
                  onOpenBidModal={post.postType === 'auction' && canBidAuction ? (cardId, minBid) => {
                    setBidCardId(cardId);
                    setBidMinAmount(minBid);
                    setShowBidModal(true);
                  } : undefined}
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
                      {isOwnerSeller && isAuctionReleased && (
                        <button
                          type="button"
                          className="btn-mercari-primary"
                          onClick={handleReAuction}
                          disabled={reAuctioning}
                        >
                          {reAuctioning ? 'กำลังเปิด...' : 'ประมูลใหม่'}
                        </button>
                      )}
                      {isOwnerSeller && isRejected && (
                        <button
                          type="button"
                          className="btn-mercari-primary"
                          onClick={openResubmitModal}
                          disabled={resubmitLoading}
                        >
                          {resubmitLoading ? (
                            <>
                              <Spinner size="sm" className="me-2" />
                              กำลังยื่น...
                            </>
                          ) : (
                            'ยื่นขออนุมัติใหม่'
                          )}
                        </button>
                      )}
                      {isOwnerSeller && canOwnerCloseAuction && (
                        <button
                          type="button"
                          className="btn-mercari-primary"
                          onClick={() => setShowSoldModal(true)}
                        >
                          จบการประมูล
                        </button>
                      )}
                      {isOwnerSeller && canOwnerMarkSoldSale && (
                        <button
                          type="button"
                          className="btn-mercari-primary"
                          onClick={() => setShowSoldModal(true)}
                        >
                          ขายแล้ว
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
                          {isPostActive && (
                            <button
                              type="button"
                              className="btn-mercari-outline"
                              onClick={handleLikePost}
                              disabled={likingPost}
                            >
                              {likingPost ? <Spinner size="sm" className="me-2" /> : null}
                              {liked ? '❤️ อยู่ในรายการโปรด' : 'เพิ่มรายการโปรด'}
                            </button>
                          )}

                          {post.postType === 'sale' && post.saleType !== 'individual' && isPostActive && (
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

                          {post.postType === 'sale' && post.saleType === 'individual' && isPostActive && (
                            <span className="text-muted small">เลือกการ์ดจากรายการด้านล่างเพื่อเพิ่มในตะกร้า</span>
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
                              {isAuctionReleased && (
                                <span className="text-muted small">
                                  รายการหลุด — เจ้าของสามารถเปิดประมูลใหม่ได้
                                </span>
                              )}
                              {isAuctionActive && isAuctionEnded && !isWonPendingPayment && (
                                <span className="text-muted small">การประมูลสิ้นสุดแล้ว</span>
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
                              {canBidAuction && post.saleType === 'individual' && (
                                <span className="text-muted small">ประมูลแต่ละใบจากรายการการ์ดด้านล่าง</span>
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

          {/* AI Similar Cards Recommendation */}
          {(loadingSimilar || similarPosts.length > 0) && (
            <div className="similar-cards-section mt-5 pt-4 border-top">
              <h5 className="similar-cards-title mb-3">
                <span className="similar-cards-icon">✨</span> การ์ดคล้ายกัน
              </h5>
              {loadingSimilar ? (
                <div className="d-flex justify-content-center py-4">
                  <Spinner animation="border" size="sm" variant="secondary" />
                  <span className="ms-2 text-muted">กำลังโหลดการ์ดคล้ายกัน...</span>
                </div>
              ) : (
                <div className="similar-cards-scroll">
                  {similarPosts.map((p) => (
                    <Link
                      key={p.id}
                      to={`/post/${p.id}`}
                      className="similar-card-item"
                    >
                      <div className="similar-card-image">
                        {p.images?.[0] ? (
                          <img src={p.images[0]} alt={p.title} />
                        ) : (
                          <div className="no-image">🃏</div>
                        )}
                        <div className="similar-card-badge">
                          {p.status === 'sold' ? 'ขายแล้ว' : p.postType === 'auction' ? 'ประมูล' : 'ขาย'}
                        </div>
                      </div>
                      <div className="similar-card-body">
                        <div className="similar-card-title" title={p.title}>
                          {p.title?.length > 30 ? `${p.title.substring(0, 30)}...` : p.title}
                        </div>
                        <div className="similar-card-price">
                          {p.postType === 'auction'
                            ? `฿${(p.currentBid ?? p.startingBid ?? 0).toLocaleString('th-TH')}`
                            : `฿${(p.individualPrice ?? p.price ?? 0).toLocaleString('th-TH')}`}
                        </div>
                        <div className="similar-card-category">{p.category}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
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

        {/* Resubmit Approval Modal */}
        <Modal
          show={showResubmitModal}
          onHide={() => {
            // revoke object urls to avoid memory leak
            resubmitImagePreviews.forEach((u) => URL.revokeObjectURL(u));
            setResubmitImages([]);
            setResubmitImagePreviews([]);
            setShowResubmitModal(false);
          }}
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title>📝 แก้ไข & ยื่นขออนุมัติใหม่</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Alert variant="warning">
              โพสต์นี้ถูกปฏิเสธแล้ว คุณสามารถแก้ไขรายละเอียดและยื่นขออนุมัติใหม่ได้
            </Alert>

            <Form.Group className="mb-3">
              <Form.Label>ชื่อโพสต์</Form.Label>
              <Form.Control
                type="text"
                value={resubmitForm.title}
                onChange={(e) => setResubmitForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>คำอธิบาย</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={resubmitForm.description}
                onChange={(e) => setResubmitForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>หมวดหมู่</Form.Label>
              <Form.Control
                type="text"
                value={resubmitForm.category}
                onChange={(e) => setResubmitForm((prev) => ({ ...prev, category: e.target.value }))}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>รูปภาพใหม่ (ไม่เลือก = ใช้รูปเดิม)</Form.Label>
              <Form.Control
                type="file"
                multiple
                accept="image/*"
                disabled={resubmitLoading}
                onChange={(e) => {
                  const target = e.target as HTMLInputElement;
                  const files = Array.from(target.files ?? []);
                  // clean previous previews
                  resubmitImagePreviews.forEach((u) => URL.revokeObjectURL(u));
                  const sliced = files.slice(0, 5);
                  setResubmitImages(sliced);
                  setResubmitImagePreviews(sliced.map((f) => URL.createObjectURL(f)));
                }}
              />
              <Form.Text className="text-muted">
                เลือกได้สูงสุด 5 รูป
              </Form.Text>

              {resubmitImagePreviews.length > 0 ? (
                <div className="d-flex flex-wrap gap-2 mt-2">
                  {resubmitImagePreviews.map((url, idx) => (
                    <img
                      key={`${url}-${idx}`}
                      src={url}
                      alt={`รูปใหม่ ${idx + 1}`}
                      style={{
                        width: 72,
                        height: 96,
                        objectFit: 'cover',
                        borderRadius: 8,
                        border: '1px solid var(--gray-300)'
                      }}
                    />
                  ))}
                </div>
              ) : (
                post?.images?.length > 0 && (
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    {post.images.slice(0, 5).map((url, idx) => (
                      <img
                        key={`${url}-${idx}`}
                        src={url}
                        alt={`รูปเดิม ${idx + 1}`}
                        style={{
                          width: 72,
                          height: 96,
                          objectFit: 'cover',
                          borderRadius: 8,
                          border: '1px solid var(--gray-300)',
                          opacity: 0.75
                        }}
                      />
                    ))}
                  </div>
                )
              )}
            </Form.Group>

            {post?.postType === 'sale' && post.saleType === 'deck' && (
              <Form.Group className="mb-1">
                <Form.Label>ราคา</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  step="0.01"
                  value={resubmitForm.price}
                  onChange={(e) => setResubmitForm((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="กรอกตัวเลข"
                />
              </Form.Group>
            )}

            {post?.postType === 'sale' && post.saleType === 'individual' && (
              <div className="mt-3">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                  <div>
                    <strong>ราคา/จำนวนต่อใบ</strong>
                    <div className="small text-muted">แก้ได้ตามการขายแยกใบ</div>
                  </div>
                  {resubmitImages.length > 0 && (
                    <Button
                      variant="outline-primary"
                      size="sm"
                      disabled={resubmitCardsLoading}
                      onClick={async () => {
                        if (resubmitImages.length === 0) return;
                        // detect cards from selected images
                        setResubmitCardsLoading(true);
                        try {
                          const allCards: DetectedCard[] = [];
                          // Optional type hint based on category to improve detection accuracy
                          const categories: Record<string, string> = {
                            'Yu-Gi-Oh!': 'yugioh',
                            'Pokemon Card Game': 'pokemon',
                            'Cardfight!! Vanguard': 'vanguard',
                            'Battle Spirits': 'battlespirits',
                            'Digimon Card Game': 'digimon',
                            'One Piece Card Game': 'onepiece',
                            'Shadowverse Evolve': 'shadowverse',
                            'Weiß Schwarz': 'weiss schwarz',
                            'Rebirth for you': 'rebirthforyou',
                            'hololive card game': 'hololive',
                            'union arena': 'unionarena',
                            'wixross': 'wixross',
                            'gundam card game': 'gundam',
                          };
                          const typeHint = categories[post.category] || '';

                          for (let i = 0; i < resubmitImages.length; i++) {
                            const fd = new FormData();
                            fd.append('image', resubmitImages[i]);
                            if (typeHint) fd.append('cardType', typeHint);
                            const resp = await axios.post('/api/card-detection/detect', fd, {
                              headers: { 'Content-Type': 'multipart/form-data' }
                            });

                            if (resp.data?.success && Array.isArray(resp.data.cards)) {
                              resp.data.cards.forEach((c: any, cardIdx: number) => {
                                if (!c?.imageUrl) return;
                                const fallbackId = `ai-${i}-${cardIdx}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                                allCards.push({
                                  id: String(c?.id || fallbackId),
                                  imageUrl: String(c.imageUrl),
                                  quantity: 1,
                                  price: ''
                                });
                              });
                            }
                          }

                          if (allCards.length === 0) {
                            toast.info('ไม่พบการ์ดจากรูปที่เลือก คุณสามารถแก้ราคา/จำนวนจากการ์ดเดิมได้');
                          } else {
                            setResubmitIndividualCards(allCards);
                            toast.success(`แยกการ์ดใหม่สำเร็จ พบ ${allCards.length} ใบ`);
                          }
                        } catch (err: any) {
                          console.error('Detect cards error:', err);
                          toast.error(err?.response?.data?.error || 'เกิดข้อผิดพลาดในการแยกการ์ด');
                        } finally {
                          setResubmitCardsLoading(false);
                        }
                      }}
                    >
                      {resubmitCardsLoading ? (
                        <>
                          <Spinner size="sm" className="me-2" />
                          กำลังแยก...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-magic me-2" aria-hidden />
                          แยกการ์ดใหม่
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {resubmitImages.length > 0 && (
                  <div className="small text-muted mb-2">
                    หากเลือก “รูปใหม่” แล้วต้องการให้รายการการ์ดตรงกับรูป ให้กด “แยกการ์ดใหม่”
                  </div>
                )}

                {resubmitIndividualCards.length === 0 ? (
                  <Alert variant="warning" className="py-2">
                    ยังไม่มีข้อมูลการ์ดแยกใบสำหรับแก้ไข
                  </Alert>
                ) : (
                  <div className="resubmit-cards-editor">
                    {resubmitIndividualCards.map((c, idx) => (
                      <div key={`${c.id}-${idx}`} className="d-flex align-items-start gap-2 mb-3">
                        <img
                          src={c.imageUrl}
                          alt={`card-${idx + 1}`}
                          style={{ width: 64, height: 88, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--gray-300)' }}
                        />
                        <div className="flex-grow-1">
                          <div className="small text-muted mb-1">#{idx + 1}</div>
                          <div className="d-flex gap-2 flex-wrap">
                            <div style={{ minWidth: 120 }}>
                              <div className="small text-muted">จำนวน</div>
                              <Form.Control
                                type="number"
                                min={1}
                                step={1}
                                value={String(c.quantity)}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setResubmitIndividualCards((prev) =>
                                    prev.map((x, xIdx) =>
                                      xIdx === idx ? { ...x, quantity: val } : x
                                    )
                                  );
                                }}
                              />
                            </div>
                            <div style={{ minWidth: 160 }}>
                              <div className="small text-muted">ราคา/ใบ (บาท)</div>
                              <Form.Control
                                type="number"
                                min={0}
                                step={0.01}
                                value={String(c.price)}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setResubmitIndividualCards((prev) =>
                                    prev.map((x, xIdx) =>
                                      xIdx === idx ? { ...x, price: val } : x
                                    )
                                  );
                                }}
                              />
                            </div>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => {
                                setResubmitIndividualCards((prev) =>
                                  prev.filter((_, xIdx) => xIdx !== idx)
                                );
                              }}
                            >
                              ลบ
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {post?.postType !== 'sale' && (
              <Alert variant="info" className="mt-3 mb-0">
                ตอนนี้หน้าฟอร์มนี้รองรับการแก้ไขเฉพาะชื่อ/คำอธิบาย/หมวดหมู่ (การแก้ราคาการประมูลยังไม่รวมในรอบนี้)
              </Alert>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => {
                resubmitImagePreviews.forEach((u) => URL.revokeObjectURL(u));
                setResubmitImages([]);
                setResubmitImagePreviews([]);
                setShowResubmitModal(false);
              }}
              disabled={resubmitLoading}
            >
              ยกเลิก
            </Button>
            <Button
              variant="primary"
              onClick={handleResubmitForApproval}
              disabled={resubmitLoading}
            >
              {resubmitLoading ? (
                <>
                  <Spinner size="sm" className="me-2" />
                  กำลังยื่น...
                </>
              ) : (
                'ยื่นขออนุมัติใหม่'
              )}
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Sold Confirmation Modal */}
        <Modal show={showSoldModal} onHide={() => setShowSoldModal(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title>
              {post.postType === 'auction' ? '✅ ยืนยันการจบการประมูล' : '✅ ยืนยันการขาย'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>
              {post.postType === 'auction'
                ? `คุณต้องการจบการประมูลของโพสต์ "${post.title}" หรือไม่?`
                : `คุณต้องการทำเครื่องหมายโพสต์ "${post.title}" เป็นขายแล้วหรือไม่?`}
            </p>
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

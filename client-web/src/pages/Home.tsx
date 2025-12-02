import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { Container, Row, Col, Card, Form, Button, Spinner, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useOffer } from '../contexts/OfferContext';
import { 
  TCGButton, 
  SearchButton, 
  CategoryButton, 
  ActionButtonGroup,
  PrimaryActionButton,
  SecondaryActionButton,
  QuickActionButtons,
  ButtonWithBadge
} from '../components/common/ButtonComponents';
import { Post, OfferData, SortBy, Category, FirestoreTimestamp } from '../types';

const categories: Category[] = [
  'Pokemon',
  'Yu-Gi-Oh!',
  'Magic: The Gathering',
  'Dragon Ball Super',
  'Card Fight!! Vanguard',
  'One Piece',
  'Naruto',
  'Digimon',
  'อื่นๆ'
];

const Home: React.FC = () => {
  const { currentUser } = useAuth();
  const { addToCart, isInCart } = useCart();
  const { createOffer } = useOffer();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [likingPost, setLikingPost] = useState<string | null>(null);
  const [markingSold, setMarkingSold] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [showOfferModal, setShowOfferModal] = useState<boolean>(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [offerData, setOfferData] = useState<OfferData>({
    cardTitle: '',
    cardDescription: '',
    cardImages: [],
    cardCondition: 'ดี',
    offerPrice: '',
    message: ''
  });
  const [uploadingImages, setUploadingImages] = useState<boolean>(false);

  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, category, searchTerm, sortBy]);

  // Check liked status for posts
  useEffect(() => {
    if (posts.length > 0) {
      checkLikedStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts]);

  const fetchPosts = async (): Promise<void> => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '12'
      });
      
      if (category) params.append('category', category);
      if (searchTerm) params.append('search', searchTerm);

      const response = await axios.get(`/api/posts?${params}`);
      let fetched: Post[] = response.data.posts || [];

      // Client-side sort for better UX
      fetched = [...fetched].sort((a, b) => {
        if (sortBy === 'priceAsc') {
          const pa = (a.postType === 'sale' ? (a.saleType === 'individual' ? (a.individualPrice || a.price || 0) : (a.price || 0)) : (a.currentBid || a.startingBid || a.price || 0));
          const pb = (b.postType === 'sale' ? (b.saleType === 'individual' ? (b.individualPrice || b.price || 0) : (b.price || 0)) : (b.currentBid || b.startingBid || b.price || 0));
          return pa - pb;
        }
        if (sortBy === 'priceDesc') {
          const pa = (a.postType === 'sale' ? (a.saleType === 'individual' ? (a.individualPrice || a.price || 0) : (a.price || 0)) : (a.currentBid || a.startingBid || a.price || 0));
          const pb = (b.postType === 'sale' ? (b.saleType === 'individual' ? (b.individualPrice || b.price || 0) : (b.price || 0)) : (b.currentBid || b.startingBid || b.price || 0));
          return pb - pa;
        }
        // newest
        const convertToDate = (dateInput: Date | string | FirestoreTimestamp): Date => {
          if (typeof dateInput === 'object' && 'seconds' in dateInput) {
            return new Date(dateInput.seconds * 1000);
          }
          return new Date(dateInput);
        };
        const da = convertToDate(a.createdAt);
        const db = convertToDate(b.createdAt);
        return db.getTime() - da.getTime();
      });

      setPosts(fetched);
    } catch (error) {
      console.error('Error fetching posts:', error);
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const checkLikedStatus = async (): Promise<void> => {
    try {
      const likedSet = new Set<string>();
      for (const post of posts) {
        try {
          const response = await axios.get(`/api/auth/check-like/${post.id}`);
          if (response.data.liked) {
            likedSet.add(post.id);
          }
        } catch (error) {
          console.error(`Error checking like status for post ${post.id}:`, error);
        }
      }
      setLikedPosts(likedSet);
    } catch (error) {
      console.error('Error checking liked status:', error);
    }
  };

  const handleSearch = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setCurrentPage(1);
    fetchPosts();
  };

  const handleCategoryChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    setCategory(e.target.value);
    setCurrentPage(1);
  };

  const handleCategoryToggle = (cat: string): void => {
    const newSelected = new Set(selectedCategories);
    if (newSelected.has(cat)) {
      newSelected.delete(cat);
    } else {
      newSelected.add(cat);
    }
    setSelectedCategories(newSelected);
    setCategory(newSelected.size > 0 ? Array.from(newSelected)[0] : '');
    setCurrentPage(1);
  };

  const handleQuickView = (postId: string): void => {
    // Quick view functionality - could open a modal or navigate to post
    window.open(`/post/${postId}`, '_blank');
  };

  const handleAddToCart = async (post: Post): Promise<void> => {
    if (!currentUser) {
      toast.error('กรุณาเข้าสู่ระบบก่อน');
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

    setAddingToCart(post.id);
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
      setAddingToCart(null);
    }
  };

  const handleMakeOffer = (post: Post): void => {
    if (!currentUser) {
      toast.error('กรุณาเข้าสู่ระบบก่อน');
      return;
    }

    if (currentUser.uid === post.sellerId) {
      toast.error('ไม่สามารถเสนอสินค้าให้โพสต์ของตัวเองได้');
      return;
    }

    if (post.status === 'sold') {
      toast.error('โพสต์นี้ถูกขายแล้ว');
      return;
    }

    setSelectedPost(post);
    setOfferData({
      cardTitle: '',
      cardDescription: '',
      cardImages: [],
      cardCondition: 'ดี',
      offerPrice: '',
      message: ''
    });
    setShowOfferModal(true);
  };

  const handleImageUpload = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return;

    setUploadingImages(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('images', file);
      });

      const response = await axios.post('/api/upload/offer-images', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const newImages: string[] = response.data.imageUrls || [];
      setOfferData(prev => ({
        ...prev,
        cardImages: [...prev.cardImages, ...newImages]
      }));

      toast.success(`อัปโหลดรูปภาพสำเร็จ ${newImages.length} รูป`);
    } catch (error) {
      console.error('Error uploading images:', error);
      toast.error('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ');
    } finally {
      setUploadingImages(false);
    }
  };

  const handleRemoveImage = (index: number): void => {
    setOfferData(prev => ({
      ...prev,
      cardImages: prev.cardImages.filter((_, i) => i !== index)
    }));
  };

  const handleSubmitOffer = async (): Promise<void> => {
    if (!selectedPost) return;

    if (!offerData.cardTitle.trim()) {
      toast.error('กรุณากรอกชื่อการ์ด');
      return;
    }

    if (!offerData.offerPrice || parseFloat(offerData.offerPrice) <= 0) {
      toast.error('กรุณากรอกราคาที่เสนอ');
      return;
    }

    if (selectedPost.maxPrice && parseFloat(offerData.offerPrice) > selectedPost.maxPrice) {
      toast.error(`ราคาที่เสนอต้องไม่เกิน ${formatPrice(selectedPost.maxPrice)}`);
      return;
    }

    try {
      const result = await createOffer(selectedPost.id, offerData);
      if (result.success) {
        toast.success(result.message);
        setShowOfferModal(false);
        setSelectedPost(null);
        setOfferData({
          cardTitle: '',
          cardDescription: '',
          cardImages: [],
          cardCondition: 'ดี',
          offerPrice: '',
          message: ''
        });
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการส่งข้อเสนอ');
    }
  };

  const handleAddToWishlist = async (post: Post): Promise<void> => {
    if (!post || !post.id) return;
    
    setLikingPost(post.id);
    try {
      const response = await axios.post(`/api/auth/like-post/${post.id}`);
      const { liked } = response.data;
      
      // Update liked posts state
      setLikedPosts(prev => {
        const newSet = new Set(prev);
        if (liked) {
          newSet.add(post.id);
          toast.success('เพิ่มในรายการโปรดแล้ว ❤️');
        } else {
          newSet.delete(post.id);
          toast.success('ลบออกจากรายการโปรดแล้ว');
        }
        return newSet;
      });
    } catch (error) {
      console.error('Error updating favorites:', error);
      toast.error('เกิดข้อผิดพลาดในการอัปเดตรายการโปรด');
    } finally {
      setLikingPost(null);
    }
  };

  const handleMarkAsSold = async (post: Post): Promise<void> => {
    if (!post || !post.id) return;
    
    setMarkingSold(post.id);
    try {
      await axios.put(`/api/posts/${post.id}/mark-sold`);
      
      // Update posts state
      setPosts(prev => prev.map(p => 
        p.id === post.id 
          ? { ...p, status: 'sold' }
          : p
      ));
      
      toast.success('ทำเครื่องหมายโพสต์เป็นขายแล้วแล้ว ✅');
    } catch (error) {
      console.error('Error marking post as sold:', error);
      toast.error('เกิดข้อผิดพลาดในการอัปเดตสถานะโพสต์');
    } finally {
      setMarkingSold(null);
    }
  };

  const handleQuickBuy = (post: Post): void => {
    // Quick buy functionality
    console.log('Quick buy:', post);
    // You can implement actual quick buy functionality here
  };

  const formatPrice = (price: number | undefined): string => {
    if (!price) return '0 บาท';
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB'
    }).format(price);
  };

  const formatDate = (dateString: Date | string | FirestoreTimestamp | undefined): string => {
    if (!dateString) return '-';
    try {
      // Handle Firestore timestamp objects
      let date: Date;
      if (typeof dateString === 'object' && 'seconds' in dateString) {
        date = new Date(dateString.seconds * 1000);
      } else {
        date = new Date(dateString);
      }
      return date.toLocaleDateString('th-TH');
    } catch (error) {
      console.error('Date formatting error:', error);
      return '-';
    }
  };

  if (loading && posts.length === 0) {
    return (
      <Container className="py-5">
        <div className="d-flex justify-content-center">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      </Container>
    );
  }

  return (
    <div className="marketplace-container">
      {/* Hero Banner Section */}
      <div className="hero-banner-section">
        <Container>
          <div className="hero-banner-content">
            <h1 className="hero-banner-title">
              เรามุ่งมั่นที่จะผลักดันวงการการ์ดเกมประเทศไทย<br />
              ให้เติบโตและพัฒนาไปข้างหน้าอย่างก้าวกระโดด
            </h1>
            <p className="hero-banner-subtitle">WCO Thailand - ตลาดการ์ดเกมที่ใหญ่ที่สุดในประเทศไทย</p>
          </div>
        </Container>
      </div>

      <Container className="py-4">
        <Row>
          {/* Sidebar - Categories */}
          <Col lg={3} md={4} className="d-none d-md-block">
            <div className="category-sidebar">
              <div className="sidebar-header">
                <h3>หมวดหมู่ทั้งหมด</h3>
              </div>
              <div className="sidebar-categories">
                {/* Display first 4 categories as buttons */}
                {categories.slice(0, 4).map(cat => (
                  <button
                    key={cat}
                    className={`sidebar-category-item ${category === cat ? 'active' : ''}`}
                    onClick={() => {
                      setCategory(cat === category ? '' : cat);
                      setCurrentPage(1);
                    }}
                  >
                    <span className="category-icon">🃏</span>
                    <span className="category-name">{cat}</span>
                    {category === cat && <span className="category-check">✓</span>}
                  </button>
                ))}
                
                {/* Dropdown for remaining categories */}
                {categories.length > 4 && (
                  <div className="category-dropdown-wrapper">
                    <Form.Select
                      className="category-dropdown"
                      value={categories.slice(4).includes(category as Category) ? category : ''}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                        const selectedCat = e.target.value;
                        setCategory(selectedCat || '');
                        setCurrentPage(1);
                      }}
                    >
                      <option value="">เลือกหมวดหมู่อื่นๆ...</option>
                      {categories.slice(4).map(cat => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </Form.Select>
                  </div>
                )}
              </div>
              
              {/* Quick Links */}
              <div className="sidebar-section">
                <h4>เกี่ยวกับ</h4>
                <ul className="sidebar-links">
                  <li><Link to="/">หน้าแรก</Link></li>
                  <li><Link to="/create-post">สมัครเป็นผู้ขาย</Link></li>
                  {currentUser && (
                    <>
                      <li><Link to="/my-posts">โพสต์ของฉัน</Link></li>
                      <li><Link to="/profile">โปรไฟล์</Link></li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </Col>

          {/* Main Content Area */}
          <Col lg={9} md={8}>
            {/* Search Bar */}
            <div className="main-search-section">
              <Form onSubmit={handleSearch}>
                <Row className="g-2">
                  <Col md={6}>
                    <Form.Control
                      type="text"
                      placeholder="ค้นหาการ์ดที่ต้องการ..."
                      value={searchTerm}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                      className="main-search-input"
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Select 
                      value={sortBy} 
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => setSortBy(e.target.value as SortBy)}
                      className="main-sort-select"
                    >
                      <option value="newest">ใหม่ล่าสุด</option>
                      <option value="priceAsc">ราคาต่ำ → สูง</option>
                      <option value="priceDesc">ราคาสูง → ต่ำ</option>
                    </Form.Select>
                  </Col>
                  <Col md={3}>
                    <button type="submit" className="main-search-btn" disabled={loading}>
                      {loading ? (
                        <span className="search-spinner"></span>
                      ) : (
                        '🔍 ค้นหา'
                      )}
                    </button>
                  </Col>
                </Row>
              </Form>

              {/* Mobile Category Filter */}
              <div className="mobile-category-filter d-md-none mt-3">
                <div className="mobile-category-scroll">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      className={`mobile-category-pill ${category === cat ? 'active' : ''}`}
                      onClick={() => {
                        setCategory(cat === category ? '' : cat);
                        setCurrentPage(1);
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {posts.length === 0 && !loading ? (
        <div className="empty-state">
          <div className="empty-state-content">
            <div className="empty-state-icon">🔍</div>
            <h3 className="empty-state-title">ไม่พบการ์ดที่ค้นหา</h3>
            <p className="empty-state-description">
              ลองเปลี่ยนคำค้นหาหรือหมวดหมู่ หรือดูการ์ดใหม่ๆ ที่เพิ่งเข้ามา
            </p>
            <button 
              className="btn-refresh"
              onClick={() => {
                setSearchTerm('');
                setCategory('');
                setSelectedCategories(new Set());
                fetchPosts();
              }}
            >
              🔄 รีเฟรช
            </button>
          </div>
        </div>
      ) : (
        <div className="product-grid-section">
          <div className="product-grid-header mb-3">
            <h3 className="product-grid-title">สินค้าทั้งหมด</h3>
            <span className="product-count">({posts.length} รายการ)</span>
          </div>
          <Row className="g-3">
          {posts.map((post) => (
              <Col key={post.id} lg={3} md={4} sm={6} xs={12}>
                <div className="card-wrapper">
                  <Card className="h-100 modern-card">
                    <div className="card-image-container">
                  {post.images && post.images.length > 0 ? (
                    <Card.Img
                      variant="top"
                      src={post.images[0]}
                          className="card-image"
                    />
                  ) : (
                        <div className="no-image-placeholder">
                          <div className="no-image-icon">🃏</div>
                          <span>ไม่มีรูปภาพ</span>
                    </div>
                  )}
                  
                      {/* Card Overlay with Actions */}
                  <div className="card-overlay">
                        <div className="overlay-actions">
                          <button 
                            className="action-btn primary-action"
                            onClick={() => handleQuickView(post.id)}
                          >
                            👁️ ดูรายละเอียด
                          </button>
                          <div className="secondary-actions">
                            <button 
                              className="action-btn secondary-action"
                              onClick={() => handleAddToWishlist(post)}
                              title="เพิ่มในรายการที่ชอบ"
                            >
                              ❤️
                            </button>
                            {post.postType === 'buying' ? (
                              <button 
                                className="action-btn secondary-action"
                                onClick={() => handleMakeOffer(post)}
                                title="เสนอสินค้า"
                                disabled={currentUser?.uid === post.sellerId || post.status === 'sold'}
                              >
                                💰
                              </button>
                            ) : (
                              <button 
                                className="action-btn secondary-action"
                                onClick={() => handleAddToCart(post)}
                                title="เพิ่มในตะกร้า"
                                disabled={addingToCart === post.id || currentUser?.uid === post.sellerId || post.status === 'sold'}
                              >
                                {addingToCart === post.id ? '⏳' : '🛒'}
                              </button>
                            )}
                            <button 
                              className="action-btn secondary-action"
                              onClick={() => {
                                if (navigator.share) {
                                  navigator.share({ title: post.title, url: window.location.href });
                                }
                              }}
                              title="แชร์"
                            >
                              📤
                            </button>
                          </div>
                  </div>
                </div>
                
                      {/* Post Type Badge */}
                      <div className="post-type-badge">
                        {post.status === 'sold' ? (
                          <span className="badge sold-badge">✅ ขายแล้ว</span>
                        ) : post.postType === 'auction' ? (
                          <span className="badge auction-badge">🔨 ประมูล</span>
                        ) : post.postType === 'buying' ? (
                          <span className="badge buying-badge">🛒 รับซื้อ</span>
                        ) : (
                          <span className="badge sale-badge">💰 ขาย</span>
                        )}
                      </div>
                    </div>
                    
                    <Card.Body className="card-content">
                      <div className="card-header">
                        <Card.Title className="card-title">{post.title}</Card.Title>
                        <div className="category-tag">
                          {post.category}
                        </div>
                      </div>
                      
                      <Card.Text className="card-description">
                        {post.description.length > 100 
                          ? `${post.description.substring(0, 100)}...` 
                          : post.description
                        }
                      </Card.Text>
                      
                      <div className="card-footer">
                        <div className="price-section">
                          <div className="price-main">
                            {post.postType === 'auction' 
                              ? (
                                <div className="auction-price">
                                  <span className="price-label">
                                    {post.saleType === 'deck' ? 'เริ่มต้นเด็ค' : post.saleType === 'individual' ? 'เริ่มต้นต่อใบ' : 'เริ่มต้น'}
                                  </span>
                                  <span className="price-value">
                                    {formatPrice(post.startingBid || post.currentBid)}
                                  </span>
                                  {post.saleType === 'deck' && post.cardCount && (
                                    <div className="auction-deck-info">
                                      <small className="deck-info">
                                        {post.cardCount} ใบ
                                      </small>
                                    </div>
                                  )}
                                  {post.saleType === 'individual' && post.availableQuantity && (
                                    <div className="auction-quantity-info">
                                      <small className="quantity-text">
                                        เหลือ {post.availableQuantity} ใบ
                                      </small>
                                    </div>
                                  )}
                                </div>
                              )
                              : post.postType === 'buying' ? (
                                <div className="buying-price">
                                  <span className="price-label">ราคาสูงสุด</span>
                                  <span className="price-value buying-price-value">
                                    {formatPrice(post.maxPrice)}
                                  </span>
                                </div>
                              ) : post.postType === 'sale' && post.saleType === 'deck' ? (
                                <div className="deck-price">
                                  <span className="price-label">ราคาเด็ค</span>
                                  <span className="price-value deck-price-value">
                                    {formatPrice(post.price)}
                                  </span>
                                  <div className="deck-details">
                                    <small className="deck-info">
                                      {post.cardCount} ใบ
                                    </small>
                                  </div>
                                </div>
                              ) : post.postType === 'sale' && post.saleType === 'individual' ? (
                                <div className="individual-price">
                                  <span className="price-label">ราคาต่อใบ</span>
                                  <span className="price-value individual-price-value">
                                    {formatPrice(post.individualPrice || post.price)}
                                  </span>
                                  {post.availableQuantity && (
                                    <div className="quantity-info">
                                      <small className="quantity-text">
                                        เหลือ {post.availableQuantity} ใบ
                                      </small>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="price-value sale-price">
                                  {formatPrice(post.price)}
                                </span>
                              )
                            }
                    </div>
                    
                          {post.postType === 'auction' && post.buyNowPrice && (
                            <div className="buy-now-price">
                              💎 ซื้อทันที: {formatPrice(post.buyNowPrice)}
                            </div>
                          )}
                        </div>
                        
                        <div className="card-meta">
                          <div className="seller-info">
                            <span className="seller-label">ผู้ขาย:</span>
                            <span className="seller-name">{post.sellerName}</span>
                          </div>
                          <div className="date-info">
                            {formatDate(post.createdAt)}
                          </div>
                        </div>
                        
                        {post.postType === 'auction' && (
                          <div className="auction-details">
                            <div className="auction-time">
                              ⏰ สิ้นสุด: {formatDate(post.auctionEndDate)}
                            </div>
                            {post.bidCount && post.bidCount > 0 && (
                              <div className="bid-count">
                                🔢 {post.bidCount} ครั้ง
                          </div>
                        )}
                      </div>
                    )}
                    
                        <div className="card-actions">
                          <button 
                            className="btn-view-details"
                            onClick={() => window.open(`/post/${post.id}`, '_blank')}
                          >
                            ดูรายละเอียด
                          </button>
                          {currentUser && currentUser.uid === post.sellerId ? (
                            // Show "Mark as Sold" button for own posts
                            <button 
                              className={`btn-mark-sold ${post.status === 'sold' ? 'sold' : ''}`}
                              onClick={() => handleMarkAsSold(post)}
                              disabled={markingSold === post.id || post.status === 'sold'}
                            >
                              {markingSold === post.id ? (
                                <span className="loading-sold">⏳</span>
                              ) : post.status === 'sold' ? (
                                '✅ ขายแล้ว'
                              ) : (
                                '💰 ขายแล้ว'
                              )}
                            </button>
                          ) : (
                            // Show action buttons for other posts
                            <div className="buyer-actions">
                              {post.postType === 'buying' ? (
                                <button 
                                  className="btn-make-offer"
                                  onClick={() => handleMakeOffer(post)}
                                  disabled={post.status === 'sold'}
                                >
                                  💰 เสนอสินค้า
                                </button>
                              ) : (
                                <button 
                                  className={`btn-add-cart ${isInCart(post.id) ? 'in-cart' : ''}`}
                                  onClick={() => handleAddToCart(post)}
                                  disabled={addingToCart === post.id || post.status === 'sold'}
                                >
                                  {addingToCart === post.id ? (
                                    <span className="loading-cart">⏳</span>
                                  ) : isInCart(post.id) ? (
                                    '🛒 อยู่ในตะกร้า'
                                  ) : (
                                    '🛒 เพิ่มตะกร้า'
                                  )}
                                </button>
                              )}
                              <button 
                                className={`btn-add-favorites ${likedPosts.has(post.id) ? 'liked' : ''}`}
                                onClick={() => handleAddToWishlist(post)}
                                disabled={likingPost === post.id}
                              >
                                {likingPost === post.id ? (
                                  <span className="loading-heart">💓</span>
                                ) : likedPosts.has(post.id) ? (
                                  '❤️ อยู่ในรายการโปรด'
                                ) : (
                                  '🤍 เพิ่มรายการโปรด'
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                  </div>
                </Card.Body>
              </Card>
                </div>
            </Col>
          ))}
        </Row>
        </div>
      )}

      {loading && posts.length > 0 && (
        <div className="loading-more">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <span>กำลังโหลด...</span>
          </div>
        </div>
      )}
          </Col>
        </Row>
      </Container>

      {/* Offer Modal */}
      {showOfferModal && selectedPost && (
        <div className="modal-overlay">
          <div className="offer-modal">
            <div className="modal-header">
              <h5>💰 เสนอสินค้าให้ {selectedPost.title}</h5>
              <button 
                className="close-btn"
                onClick={() => setShowOfferModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="offer-form">
                <div className="form-group">
                  <label>ชื่อการ์ดที่เสนอ *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={offerData.cardTitle}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setOfferData({...offerData, cardTitle: e.target.value})}
                    placeholder="เช่น Charizard, Blue-Eyes White Dragon..."
                  />
                </div>
                
                <div className="form-group">
                  <label>รายละเอียดการ์ด</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={offerData.cardDescription}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setOfferData({...offerData, cardDescription: e.target.value})}
                    placeholder="อธิบายสภาพและรายละเอียดการ์ด..."
                  />
                </div>
                
                <div className="form-group">
                  <label>รูปภาพการ์ด (สูงสุด 5 รูป)</label>
                  <div className="image-upload-section">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleImageUpload(e.target.files)}
                      className="image-upload-input"
                      id="offer-image-upload"
                      disabled={uploadingImages || offerData.cardImages.length >= 5}
                    />
                    <label 
                      htmlFor="offer-image-upload" 
                      className={`image-upload-label ${uploadingImages ? 'uploading' : ''}`}
                    >
                      {uploadingImages ? (
                        <>
                          <Spinner size="sm" className="me-2" />
                          กำลังอัปโหลด...
                        </>
                      ) : (
                        '📷 เพิ่มรูปภาพ'
                      )}
                    </label>
                    {offerData.cardImages.length > 0 && (
                      <div className="uploaded-images">
                        {offerData.cardImages.map((image, index) => (
                          <div key={index} className="uploaded-image-item">
                            <img src={image} alt={`Card ${index + 1}`} />
                            <button
                              type="button"
                              className="remove-image-btn"
                              onClick={() => handleRemoveImage(index)}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <small className="text-muted">
                      รูปภาพจะช่วยให้ผู้ขายเห็นสภาพการ์ดได้ชัดเจนขึ้น
                    </small>
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>สภาพการ์ด</label>
                    <select
                      className="form-control"
                      value={offerData.cardCondition}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => setOfferData({...offerData, cardCondition: e.target.value})}
                    >
                      <option value="ดีมาก">ดีมาก</option>
                      <option value="ดี">ดี</option>
                      <option value="ปานกลาง">ปานกลาง</option>
                      <option value="พอใช้">พอใช้</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>ราคาที่เสนอ (บาท) *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={offerData.offerPrice}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setOfferData({...offerData, offerPrice: e.target.value})}
                      placeholder={selectedPost.maxPrice ? `สูงสุด ${formatPrice(selectedPost.maxPrice)}` : ''}
                      max={selectedPost.maxPrice || undefined}
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>ข้อความเพิ่มเติม</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={offerData.message}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setOfferData({...offerData, message: e.target.value})}
                    placeholder="ข้อความถึงผู้ขาย..."
                  />
                </div>
                
                <div className="offer-info">
                  <p><strong>ข้อมูลโพสต์:</strong></p>
                  <p>• ราคาสูงสุด: {formatPrice(selectedPost.maxPrice)}</p>
                  <p>• หมวดหมู่: {selectedPost.category}</p>
                  <p>• ผู้ขาย: {selectedPost.sellerName}</p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowOfferModal(false)}
              >
                ยกเลิก
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleSubmitOffer}
              >
                ส่งข้อเสนอ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;

import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { Container, Row, Col, Card, Form, Button, Spinner, Alert, Modal } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { postsAPI, authAPI } from '../api/api';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
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
import { Post, SortBy, Category, FirestoreTimestamp } from '../types';

const categories: Category[] = [
  'Yu-Gi-Oh!',
  'Pokemon Card Game',
  'Cardfight!! Vanguard',
  'Battle Spirits',
  'Digimon Card Game',
  'One Piece Card Game',
  'Shadowverse Evolve',
  'Weiß Schwarz',
  'Rebirth for you',
  'hololive card game',
  'union arena',
  'wixross',
  'gundam card game',
  'อื่นๆ'
];

const Home: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { addToCart, isInCart } = useCart();
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
  const [showImageSearchModal, setShowImageSearchModal] = useState<boolean>(false);
  const [selectedSearchImages, setSelectedSearchImages] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

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
      setError(null);
      
      // ใช้ timeout ป้องกัน loading ค้างตลอด (เช่น API ช้าหรือไม่ตอบ)
      const FETCH_TIMEOUT_MS = 12000;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), FETCH_TIMEOUT_MS)
      );
      
      const fetchPromise = postsAPI.getPosts({
        category: category || undefined,
        search: searchTerm || undefined,
        sortBy: sortBy || 'newest',
        page: currentPage,
        limit: 12
      });

      const fetched = await Promise.race([fetchPromise, timeoutPromise]);

      setPosts(fetched);
    } catch (error) {
      console.error('Error fetching posts:', error);
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองรีเฟรชอีกครั้ง');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const checkLikedStatus = async (): Promise<void> => {
    try {
      if (posts.length === 0) return;
      // ใช้ batch API แทน N+1 - 1 request แทน N requests
      const { likedPostIds } = await authAPI.checkLikes(posts.map(p => p.id));
      setLikedPosts(new Set(likedPostIds));
    } catch (error) {
      console.error('Error checking liked status:', error);
    }
  };

  const handleSearch = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setCurrentPage(1);
    fetchPosts();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setCurrentPage(1);
      fetchPosts();
    }
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


  // Image Search Modal Handlers
  const handleImageSearchFileSelect = (e: ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      // Clean up old URLs
      imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
      // Create new URLs
      const newUrls = files.map(file => URL.createObjectURL(file));
      setImagePreviewUrls(newUrls);
      setSelectedSearchImages(files);
    }
    // Reset input to allow selecting the same file again
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      // Clean up old URLs
      imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
      // Create new URLs
      const newUrls = files.map(file => URL.createObjectURL(file));
      setImagePreviewUrls(newUrls);
      setSelectedSearchImages(files);
    }
  };

  const handleImageSearch = (): void => {
    if (selectedSearchImages.length === 0) {
      toast.error('กรุณาเลือกรูปภาพ');
      return;
    }
    // TODO: Implement image search functionality
    toast.info('กำลังค้นหาด้วยรูปภาพ...');
    // Clean up URLs
    imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
    setShowImageSearchModal(false);
    setSelectedSearchImages([]);
    setImagePreviewUrls([]);
  };

  // Cleanup URLs when modal closes
  const handleCloseImageSearchModal = (): void => {
    imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
    setShowImageSearchModal(false);
    setSelectedSearchImages([]);
    setImagePreviewUrls([]);
    setIsDragging(false);
  };


  const handleAddToWishlist = async (post: Post): Promise<void> => {
    if (!post || !post.id) return;
    
    setLikingPost(post.id);
    try {
      const result = await authAPI.toggleLike(post.id);
      const liked = result.liked;
      
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
      await postsAPI.markAsSold(post.id);
      
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
              <div className="sidebar-categories scrollable-categories">
                {/* Display all categories as scrollable buttons */}
                {categories.map(cat => (
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
                    {category === cat ? (
                      <span className="category-check">✓</span>
                    ) : (
                      <span className="sidebar-category-arrow" aria-hidden>›</span>
                    )}
                  </button>
                ))}
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
                  <Col md={9}>
                    <div className="search-input-wrapper">
                      <Form.Control
                        type="text"
                        placeholder="คุณกำลังมองหาอะไรอยู่?"
                        value={searchTerm}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="main-search-input"
                      />
                      <button 
                        type="button" 
                        className="search-visual-icon"
                        title="ค้นหาด้วยรูปภาพ"
                        onClick={() => setShowImageSearchModal(true)}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                          <circle cx="12" cy="13" r="4"></circle>
                        </svg>
                      </button>
                      <button 
                        type="submit" 
                        className="search-icon-btn"
                        title="ค้นหา"
                      >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                          <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
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
              <Col key={post.id} lg={4} md={4} sm={6} xs={12}>
                <div className="card-wrapper">
                  <Card className={`h-100 modern-card ${post.status === 'sold' ? 'sold-card' : ''}`}>
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
                      {/* Post Type Badge */}
                      <div className="post-type-badge">
                        {post.status === 'sold' ? (
                          <span className="badge sold-badge">✅ ขายแล้ว</span>
                        ) : post.postType === 'auction' ? (
                          <span className="badge auction-badge">🔨 ประมูล</span>
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
                            onClick={() => navigate(`/post/${post.id}`)}
                          >
                            ดูรายละเอียด
                          </button>
                          {currentUser && currentUser.id === post.sellerId ? (
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

      {/* Image Search Modal */}
      {showImageSearchModal && (
        <div className="modal-overlay" onClick={handleCloseImageSearchModal}>
          <div className="image-search-modal" onClick={(e) => e.stopPropagation()}>
            <div className="image-search-header">
              <h4>Search for similar products by image</h4>
              <button 
                className="close-btn"
                onClick={handleCloseImageSearchModal}
              >
                ✕
              </button>
            </div>
            <div className="image-search-body">
              <div 
                className={`image-drop-zone ${isDragging ? 'dragging' : ''} ${selectedSearchImages.length > 0 ? 'has-images' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {selectedSearchImages.length === 0 ? (
                  <>
                    <p className="drop-zone-text">Drag photos to add</p>
                    <p className="drop-zone-or">-Or-</p>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageSearchFileSelect}
                      className="image-upload-input-hidden"
                      id="image-search-upload"
                    />
                    <label htmlFor="image-search-upload" className="image-search-upload-btn">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                        <circle cx="12" cy="13" r="4"></circle>
                      </svg>
                      Select image(s)
                    </label>
                  </>
                ) : (
                  <div className="selected-images-preview">
                    {imagePreviewUrls.map((url, index) => (
                      <div key={index} className="preview-image-item">
                        <img src={url} alt={`Preview ${index + 1}`} />
                        <button
                          type="button"
                          className="remove-preview-btn"
                          onClick={() => {
                            // Revoke the URL for the removed image
                            URL.revokeObjectURL(imagePreviewUrls[index]);
                            setImagePreviewUrls(prev => prev.filter((_, i) => i !== index));
                            setSelectedSearchImages(prev => prev.filter((_, i) => i !== index));
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <label htmlFor="image-search-upload" className="add-more-images-btn">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </label>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageSearchFileSelect}
                      className="image-upload-input-hidden"
                      id="image-search-upload"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="image-search-footer">
              <button 
                className="btn btn-secondary"
                onClick={handleCloseImageSearchModal}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleImageSearch}
                disabled={selectedSearchImages.length === 0}
              >
                Search
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal show={showLoginModal} onHide={() => setShowLoginModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>กรุณาเข้าสู่ระบบ</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          กรุณาเข้าสู่ระบบก่อนทำรายการนี้
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowLoginModal(false)}>
            ปิด
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setShowLoginModal(false);
              window.location.href = '/login';
            }}
          >
            ไปที่หน้าเข้าสู่ระบบ
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Home;

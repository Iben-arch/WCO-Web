import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Alert, Spinner, Badge } from 'react-bootstrap';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../styles/seller-profile.css';
import { Seller, Post, FirestoreTimestamp } from '../types';

const SellerProfile: React.FC = () => {
  const { sellerId } = useParams<{ sellerId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [sellerPosts, setSellerPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSellerData();
  }, [sellerId]);

  const fetchSellerData = async (): Promise<void> => {
    try {
      setLoading(true);
      const [sellerResponse, postsResponse] = await Promise.all([
        axios.get(`/api/auth/seller/${sellerId}`),
        axios.get(`/api/posts/seller/${sellerId}`)
      ]);
      
      setSeller(sellerResponse.data);
      setSellerPosts(postsResponse.data.posts || []);
    } catch (error) {
      console.error('Error fetching seller data:', error);
      setError('ไม่พบข้อมูลผู้ขาย');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number | undefined): string => {
    // Handle invalid or missing price
    if (!price || isNaN(price) || price === null || price === undefined) {
      return 'ราคาไม่ระบุ';
    }
    
    const numPrice = parseFloat(price.toString());
    if (isNaN(numPrice) || numPrice <= 0) {
      return 'ราคาไม่ระบุ';
    }
    
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB'
    }).format(numPrice);
  };

  const formatDate = (dateString: Date | FirestoreTimestamp | string | undefined): string => {
    if (!dateString) {
      return 'วันที่ไม่ระบุ';
    }
    
    try {
      let date: Date;
      
      // Handle Firestore timestamp format
      if (typeof dateString === 'object' && 'seconds' in dateString) {
        date = new Date(dateString.seconds * 1000);
      } else {
        date = new Date(dateString);
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'วันที่ไม่ระบุ';
      }
      
      return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'วันที่ไม่ระบุ';
    }
  };

  const handleStartChat = (): void => {
    toast.info('ระบบแชทถูกปิดใช้งานแล้ว');
  };

  if (loading) {
    return (
      <div className="seller-profile-loading">
        <div className="loading-container">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3 text-muted">กำลังโหลดข้อมูลผู้ขาย...</p>
        </div>
      </div>
    );
  }

  if (error || !seller) {
    return (
      <div className="seller-profile-error">
        <Container>
          <div className="error-container">
            <Alert variant="danger" className="error-alert">
              <div className="error-icon">❌</div>
              <h4>ไม่พบข้อมูลผู้ขาย</h4>
              <p>{error || 'ผู้ขายนี้อาจถูกลบหรือไม่พบในระบบ'}</p>
            </Alert>
            <div className="error-actions">
              <Button as={Link as any} to="/" className="btn-tcg-primary btn-tcg-lg">
                🏠 กลับหน้าแรก
              </Button>
              <Button className="btn-tcg-outline btn-tcg-lg" onClick={() => window.history.back()}>
                ← กลับ
              </Button>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="seller-profile-container">
      <Container fluid className="px-0">
        {/* Hero Section */}
        <div className="seller-hero">
          <Container>
            <div className="seller-breadcrumb">
              <Link to="/" className="breadcrumb-link">🏠 หน้าแรก</Link>
              <span className="breadcrumb-separator">›</span>
              <span className="breadcrumb-current">ประวัติผู้ขาย</span>
            </div>
          </Container>
        </div>

        <Container className="py-4">
          <Row>
            {/* Left Column - Seller Info */}
            <Col lg={4}>
              {/* Seller Profile Card */}
              <Card className="seller-profile-card mb-4">
                <Card.Body className="text-center">
                  <div className="seller-avatar-container mb-3">
                    <img
                      src={seller.profileImage || '/default-avatar.png'}
                      alt={seller.displayName}
                      className="seller-avatar"
                    />
                  </div>
                  <h4 className="seller-name mb-2">{seller.displayName}</h4>
                  <Badge className="seller-status-badge mb-3">✅ ผู้ขายที่เชื่อถือได้</Badge>
                  
                  <div className="seller-stats mb-3">
                    <div className="stat-item">
                      <div className="stat-number">{sellerPosts.length}</div>
                      <div className="stat-label">โพสต์ทั้งหมด</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-number">{sellerPosts.filter(post => post.status === 'active').length}</div>
                      <div className="stat-label">กำลังขาย</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-number">{sellerPosts.filter(post => post.status === 'sold').length}</div>
                      <div className="stat-label">ขายแล้ว</div>
                    </div>
                  </div>

                  {currentUser && currentUser.uid !== sellerId && (
                    <Button
                      className="btn-tcg-primary btn-tcg-lg w-100 mb-3"
                      onClick={handleStartChat}
                    >
                      💬 เริ่มแชท
                    </Button>
                  )}

                  <div className="seller-join-date">
                    <small className="text-muted">
                      เป็นสมาชิกเมื่อ {formatDate(seller.createdAt)}
                    </small>
                  </div>
                </Card.Body>
              </Card>

              {/* Seller Contact Info */}
              {seller.phone && (
                <Card className="seller-contact-card mb-4">
                  <Card.Body>
                    <h6>📞 ข้อมูลติดต่อ</h6>
                    <div className="contact-info">
                      <div className="contact-item">
                        <span className="contact-label">โทรศัพท์:</span>
                        <span className="contact-value">{seller.phone}</span>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              )}
            </Col>

            {/* Right Column - Seller Posts */}
            <Col lg={8}>
              <Card className="seller-posts-card">
                <Card.Header>
                  <h5 className="mb-0">🛍️ สินค้าของผู้ขาย</h5>
                </Card.Header>
                <Card.Body>
                  {sellerPosts.length === 0 ? (
                    <div className="text-center py-4">
                      <h5>ยังไม่มีโพสต์</h5>
                      <p className="text-muted">ผู้ขายยังไม่ได้โพสต์สินค้าใดๆ</p>
                    </div>
                  ) : (
                    <Row>
                      {sellerPosts.map((post) => (
                        <Col key={post.id} md={6} lg={4} className="mb-4">
                          <Card 
                            className="trading-card"
                            style={{ cursor: 'pointer' }}
                            onClick={() => navigate(`/post/${post.id}`)}
                          >
                            <div style={{ height: '200px', overflow: 'hidden' }}>
                              {post.images && post.images.length > 0 ? (
                                <Card.Img
                                  variant="top"
                                  src={post.images[0]}
                                  style={{ height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                <div className="card-image-placeholder d-flex flex-column align-items-center justify-content-center" style={{ height: '100%' }}>
                                  <div className="placeholder-icon">
                                    🃏
                                  </div>
                                  <div className="placeholder-text">
                                    การ์ดเกม
                                  </div>
                                  <div className="placeholder-subtext">
                                    ไม่มีรูปภาพ
                                  </div>
                                </div>
                              )}
                            </div>
                            <Card.Body>
                              <Card.Title className="h6">{post.title}</Card.Title>
                              <div className="card-price-section mb-3">
                                <div className="price-display">
                                  {post.postType === 'auction' 
                                    ? `🎯 เริ่มต้น ${formatPrice(post.startingBid)}`
                                    : `💰 ${formatPrice(post.price)}`
                                  }
                                </div>
                                <div className="category-display">
                                  <span className="category-badge">{post.category}</span>
                                </div>
                              </div>
                              
                              <div className="card-meta-section">
                                <div className="status-display mb-2">
                                  <span className={`status-badge ${post.status === 'active' ? 'status-active' : 'status-inactive'}`}>
                                    {post.status === 'active' ? '🟢 เปิดขาย' : '🔴 ปิดขาย'}
                                  </span>
                                </div>
                                <div className="date-display">
                                  <small className="text-muted">
                                    📅 {formatDate(post.createdAt)}
                                  </small>
                                </div>
                              </div>
                            </Card.Body>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </Container>
    </div>
  );
};

export default SellerProfile;


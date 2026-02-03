import React, { useState, useEffect } from 'react';
import { Container, Button, Alert, Spinner } from 'react-bootstrap';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from '../utils/axiosInterceptor';
import { toast } from 'react-toastify';
import '../styles/seller-profile.css';
import { Seller, Post, FirestoreTimestamp } from '../types';

type PostFilter = 'all' | 'active' | 'sold';

const SellerProfile: React.FC = () => {
  const { sellerId } = useParams<{ sellerId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [sellerPosts, setSellerPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [postFilter, setPostFilter] = useState<PostFilter>('all');

  useEffect(() => {
    if (sellerId) {
      fetchSellerData();
    } else {
      setError('ไม่พบรหัสผู้ขาย');
      setLoading(false);
    }
  }, [sellerId]);

  const fetchSellerData = async (): Promise<void> => {
    if (!sellerId) return;
    try {
      setLoading(true);
      setError(null);
      const [sellerResponse, postsResponse] = await Promise.all([
        axios.get(`/api/auth/seller/${sellerId}`),
        axios.get(`/api/posts/seller/${sellerId}`)
      ]);

      setSeller(sellerResponse.data);
      setSellerPosts(postsResponse.data.posts || []);
    } catch (err: unknown) {
      console.error('Error fetching seller data:', err);
      const errMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(errMsg || 'ไม่พบข้อมูลผู้ขาย');
    } finally {
      setLoading(false);
    }
  };

  const filteredPosts = sellerPosts.filter((post) => {
    if (postFilter === 'all') return true;
    if (postFilter === 'active') return post.status === 'active';
    if (postFilter === 'sold') return post.status === 'sold';
    return true;
  });

  const formatPrice = (price: number | undefined): string => {
    if (!price || isNaN(price) || price === null || price === undefined) {
      return 'ราคาไม่ระบุ';
    }
    const numPrice = parseFloat(price.toString());
    if (isNaN(numPrice) || numPrice <= 0) return 'ราคาไม่ระบุ';
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB'
    }).format(numPrice);
  };

  const formatDate = (dateString: Date | FirestoreTimestamp | string | undefined): string => {
    if (!dateString) return 'วันที่ไม่ระบุ';
    try {
      let date: Date;
      if (typeof dateString === 'object' && 'seconds' in dateString) {
        date = new Date(dateString.seconds * 1000);
      } else {
        date = new Date(dateString);
      }
      if (isNaN(date.getTime())) return 'วันที่ไม่ระบุ';
      return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'วันที่ไม่ระบุ';
    }
  };

  const handleStartChat = (): void => {
    toast.info('ระบบแชทถูกปิดใช้งานแล้ว');
  };

  if (loading) {
    return (
      <div className="seller-profile-loading">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3 text-muted" style={{ fontSize: '0.875rem' }}>กำลังโหลดข้อมูลผู้ขาย...</p>
      </div>
    );
  }

  if (error || !seller) {
    return (
      <div className="seller-profile-error">
        <Container>
          <div className="text-center py-5">
            <Alert variant="light" className="d-inline-block px-4 py-4 rounded-3" style={{ border: '1px solid var(--gray-200)', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
              <div className="mb-3" style={{ fontSize: '2.5rem' }}>👤</div>
              <h5 className="mb-2">ไม่พบข้อมูลผู้ขาย</h5>
              <p className="text-muted mb-3" style={{ fontSize: '0.875rem' }}>{error || 'ผู้ขายนี้อาจถูกลบหรือไม่พบในระบบ'}</p>
              <div className="d-flex gap-2 justify-content-center flex-wrap">
                <Button as={Link as any} to="/" variant="primary" size="sm">🏠 กลับหน้าแรก</Button>
                <Button variant="outline-secondary" size="sm" onClick={() => window.history.back()}>← กลับ</Button>
              </div>
            </Alert>
          </div>
        </Container>
      </div>
    );
  }

  const activeCount = sellerPosts.filter((p) => p.status === 'active').length;
  const soldCount = sellerPosts.filter((p) => p.status === 'sold').length;

  return (
    <div className="seller-profile-container">
      {/* Mercari-style: Simple white header with seller info */}
      <div className="seller-mercari-header">
        <Container>
          <div className="seller-mercari-breadcrumb">
            <Link to="/">หน้าแรก</Link>
            <span className="mx-1">›</span>
            <span>ประวัติผู้ขาย</span>
          </div>
          <div className="seller-mercari-info">
            <div className="seller-mercari-avatar-wrap">
              {seller.profileImage ? (
                <img
                  src={seller.profileImage}
                  alt={seller.displayName}
                  className="seller-mercari-avatar"
                />
              ) : (
                <div className="seller-mercari-avatar-placeholder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5z" />
                    <path d="M20.59 22c0-4.87-3.86-9-8.59-9S3.41 17.13 3.41 22" />
                  </svg>
                </div>
              )}
            </div>
            <div className="seller-mercari-details">
              <h2 className="seller-mercari-name">{seller.displayName}</h2>
              <p className="seller-mercari-meta">เป็นสมาชิกเมื่อ {formatDate(seller.createdAt)}</p>
              <div className="seller-mercari-stats">
                <span className="seller-mercari-stat"><strong>{sellerPosts.length}</strong> โพสต์</span>
                <span className="seller-mercari-stat"><strong>{activeCount}</strong> กำลังขาย</span>
                <span className="seller-mercari-stat"><strong>{soldCount}</strong> ขายแล้ว</span>
              </div>
              {seller.phone && (
                <div className="seller-mercari-contact">
                  <span className="seller-mercari-contact-label">📞 โทร:</span>
                  <span className="seller-mercari-contact-value">{seller.phone}</span>
                </div>
              )}
              {currentUser && String(currentUser.id) !== String(sellerId) && (
                <button type="button" className="seller-mercari-chat-btn" onClick={handleStartChat}>
                  💬 เริ่มแชท
                </button>
              )}
            </div>
          </div>
        </Container>
      </div>

      {/* Page title - "Items listed by [name]" */}
      <div className="seller-mercari-title">
        <Container>
          <h1>สินค้าที่ {seller.displayName} ขาย</h1>
        </Container>
      </div>

      {/* Filter tabs */}
      {sellerPosts.length > 0 && (
        <div className="seller-mercari-tabs">
          <Container>
            <div className="d-flex gap-2 flex-wrap">
              <button
                type="button"
                className={`seller-mercari-tab ${postFilter === 'all' ? 'active' : ''}`}
                onClick={() => setPostFilter('all')}
              >
                ทั้งหมด ({sellerPosts.length})
              </button>
              <button
                type="button"
                className={`seller-mercari-tab ${postFilter === 'active' ? 'active' : ''}`}
                onClick={() => setPostFilter('active')}
              >
                กำลังขาย ({activeCount})
              </button>
              <button
                type="button"
                className={`seller-mercari-tab ${postFilter === 'sold' ? 'active' : ''}`}
                onClick={() => setPostFilter('sold')}
              >
                ขายแล้ว ({soldCount})
              </button>
            </div>
          </Container>
        </div>
      )}

      {/* Product grid */}
      <div className="seller-mercari-content">
        <Container>
          {filteredPosts.length === 0 ? (
            <div className="seller-mercari-empty">
              <div className="seller-mercari-empty-icon">🛍️</div>
              <h3>{sellerPosts.length === 0 ? 'ยังไม่มีโพสต์' : 'ไม่พบรายการที่ตรงกับตัวกรอง'}</h3>
              <p>{sellerPosts.length === 0 ? 'ผู้ขายยังไม่ได้โพสต์สินค้าใดๆ' : 'ลองเลือกตัวกรองอื่น'}</p>
            </div>
          ) : (
            <div className="seller-mercari-grid">
              {filteredPosts.map((post) => (
                <div
                  key={post.id}
                  className="seller-mercari-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/post/${post.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/post/${post.id}`)}
                >
                  <div className="seller-mercari-card-image">
                    {post.images && post.images.length > 0 ? (
                      <img src={post.images[0]} alt={post.title} />
                    ) : (
                      <div className="seller-mercari-card-image-placeholder">🃏</div>
                    )}
                  </div>
                  <div className="seller-mercari-card-body">
                    <div className="seller-mercari-card-price">
                      {post.postType === 'auction'
                        ? formatPrice(post.startingBid)
                        : formatPrice(post.price)}
                      {post.postType === 'auction' && (
                        <span className="seller-mercari-status active">ประมูล</span>
                      )}
                      {post.status === 'sold' && (
                        <span className="seller-mercari-status sold">ขายแล้ว</span>
                      )}
                    </div>
                    <p className="seller-mercari-card-title">{post.title}</p>
                    <div className="seller-mercari-card-meta">
                      {post.category} · {formatDate(post.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Container>
      </div>
    </div>
  );
};

export default SellerProfile;

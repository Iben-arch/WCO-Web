import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Card, Form, Modal, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import ProfileSidebar from '../components/layout/ProfileSidebar';
import { 
  PrimaryActionButton,
  SecondaryActionButton 
} from '../components/common/ButtonComponents';
import { Post, FirestoreTimestamp } from '../types';

interface ProfileFormData {
  displayName: string;
  phone: string;
  address: string;
  profileImage: string;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface LikedPost extends Post {
  likedAt?: Date | FirestoreTimestamp | string;
}

type ActiveTab = 'personal-info' | 'security' | 'my-posts' | 'liked' | 'auctions' | 'watchlist' | 'orders';

const Profile: React.FC = () => {
  const { userProfile, updateProfile, currentUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ActiveTab>('personal-info');
  const [formData, setFormData] = useState<ProfileFormData>({
    displayName: '',
    phone: '',
    address: '',
    profileImage: ''
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [likedItems, setLikedItems] = useState<LikedPost[]>([]);
  const [auctions, setAuctions] = useState<Post[]>([]);
  const [watchlist, setWatchlist] = useState<Post[]>([]);
  const [orders, setOrders] = useState<Post[]>([]);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [editingField, setEditingField] = useState<keyof ProfileFormData | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const fetchAllData = useCallback(async (): Promise<void> => {
    await Promise.all([
      fetchLikedItems(),
      fetchAuctions(),
      fetchWatchlist(),
      fetchOrders(),
      fetchMyPosts()
    ]);
  }, []);

  useEffect(() => {
    if (userProfile) {
      setFormData({
        displayName: userProfile.displayName || '',
        phone: userProfile.phone || '',
        address: userProfile.address || '',
        profileImage: userProfile.profileImage || ''
      });
    }
    fetchAllData();
  }, [userProfile, fetchAllData]);

  // Refresh liked items when switching to liked tab
  useEffect(() => {
    if (activeTab === 'liked') {
      fetchLikedItems();
    }
  }, [activeTab]);

  const fetchLikedItems = async (): Promise<void> => {
    try {
      const response = await axios.get('/api/auth/liked-items');
      setLikedItems(response.data);
    } catch (error: any) {
      console.error('Error fetching liked items:', error);
      // If user is not authenticated, set empty array
      if (error.response?.status === 401) {
        setLikedItems([]);
      }
    }
  };

  const fetchAuctions = async (): Promise<void> => {
    try {
      const response = await axios.get('/api/auth/my-auctions');
      setAuctions(response.data);
    } catch (error) {
      console.error('Error fetching auctions:', error);
    }
  };

  const fetchWatchlist = async (): Promise<void> => {
    try {
      const response = await axios.get('/api/auth/watchlist');
      setWatchlist(response.data);
    } catch (error) {
      console.error('Error fetching watchlist:', error);
    }
  };

  const fetchOrders = async (): Promise<void> => {
    try {
      const response = await axios.get('/api/auth/orders');
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const fetchMyPosts = async (): Promise<void> => {
    try {
      const response = await axios.get('/api/posts/my-posts');
      setMyPosts(response.data.posts);
    } catch (error) {
      console.error('Error fetching my posts:', error);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value
    });
  };

  const handleFieldSave = async (field: keyof ProfileFormData, value: string): Promise<void> => {
    try {
      setLoading(true);
      await updateProfile({ [field]: value });
      setEditingField(null);
      toast.success('อัปเดตข้อมูลสำเร็จ');
    } catch (error) {
      console.error('Error updating field:', error);
      toast.error('เกิดข้อผิดพลาดในการอัปเดตข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('รหัสผ่านใหม่ไม่ตรงกัน');
      return;
    }

    try {
      setLoading(true);
      await axios.put('/api/auth/update-password', passwordData);
      setShowPasswordModal(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('อัปเดตรหัสผ่านสำเร็จ');
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error('เกิดข้อผิดพลาดในการอัปเดตรหัสผ่าน');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('ขนาดไฟล์ต้องไม่เกิน 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    try {
      setLoading(true);
      setUploadProgress(0);
      
      const formData = new FormData();
      formData.append('profileImage', file);

      const response = await axios.post('/api/auth/upload-profile-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          setUploadProgress(percentCompleted);
        }
      });

      await updateProfile({ profileImage: response.data.imageUrl });
      setPreviewImage(null); // Clear preview after successful upload
      setUploadProgress(0);
      
      // Show success message with database confirmation
      if (response.data.savedToDatabase) {
        toast.success('อัปโหลดรูปโปรไฟล์และบันทึกลงฐานข้อมูลสำเร็จ');
      } else {
        toast.success('อัปโหลดรูปโปรไฟล์สำเร็จ');
      }
    } catch (error: any) {
      console.error('Error uploading profile image:', error);
      setPreviewImage(null);
      setUploadProgress(0);
      
      if (error.response?.data?.error) {
        toast.error(`เกิดข้อผิดพลาด: ${error.response.data.error}`);
      } else if (error.code === 'ECONNREFUSED') {
        toast.error('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
      } else if (error.code === 'NETWORK_ERROR') {
        toast.error('เกิดปัญหากับเครือข่าย');
      } else {
        toast.error('เกิดข้อผิดพลาดในการอัปโหลดรูป: ' + (error.message || 'ไม่ทราบสาเหตุ'));
      }
    } finally {
      setLoading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const formatPrice = (price: number | undefined): string => {
    if (!price) return '0 ฿';
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB'
    }).format(price);
  };

  const formatDate = (dateString: Date | string | FirestoreTimestamp | undefined): string => {
    if (!dateString) return 'วันที่ไม่ระบุ';
    
    let date: Date;
    if (typeof dateString === 'object' && 'seconds' in dateString) {
      date = new Date(dateString.seconds * 1000);
    } else {
      date = new Date(dateString);
    }
    
    return date.toLocaleDateString('th-TH');
  };

  const renderContent = (): JSX.Element => {
    switch (activeTab) {
      case 'personal-info':
        return renderPersonalInfo();
      case 'security':
        return renderSecurityInfo();
      case 'my-posts':
        return renderMyPosts();
      case 'liked':
        return renderLikedItems();
      case 'auctions':
        return renderAuctions();
      case 'watchlist':
        return renderWatchlist();
      case 'orders':
        return renderOrders();
      default:
        return renderPersonalInfo();
    }
  };

  const renderPersonalInfo = (): JSX.Element => {
    // Get the best available display name
    const getDisplayName = (): string => {
      if (formData.displayName) return formData.displayName;
      if (userProfile?.displayName) return userProfile.displayName;
      if (currentUser?.displayName) return currentUser.displayName;
      if (currentUser?.email) return currentUser.email.split('@')[0];
      return 'ผู้ใช้';
    };

    return (
      <>
        {/* Profile Header */}
        <div className="profile-header mb-4">
          <div className="d-flex align-items-center">
            <div className="profile-image-container me-3">
              <img
                src={previewImage || formData.profileImage || userProfile?.profileImage || '/default-avatar.png'}
                alt="Profile"
                className="profile-image"
              />
              {loading && (
                <div className="upload-overlay">
                  <div className="upload-progress">
                    <div className="spinner-border text-light mb-2" role="status">
                      <span className="visually-hidden">กำลังอัปโหลด...</span>
                    </div>
                    <div className="progress" style={{ width: '100px' }}>
                      <div 
                        className="progress-bar" 
                        role="progressbar" 
                        style={{ width: `${uploadProgress}%` }}
                        aria-valuenow={uploadProgress} 
                        aria-valuemin={0} 
                        aria-valuemax={100}
                      >
                        {uploadProgress}%
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex-grow-1">
              <h4 className="profile-name mb-1">
                {getDisplayName()}
              </h4>
              <p className="text-muted mb-0">
                เป็นสมาชิกเมื่อ {formatDate(userProfile?.createdAt)}
              </p>
            </div>
            <div className="upload-section">
              <input
                type="file"
                accept="image/*"
                onChange={handleProfileImageUpload}
                className="d-none"
                id="profile-image-upload"
                disabled={loading}
              />
              <label htmlFor="profile-image-upload" className={`upload-btn ${loading ? 'disabled' : ''}`}>
                {loading ? 'กำลังอัปโหลด...' : 'อัปโหลดรูปโปรไฟล์'}
              </label>
              <small className="d-block text-muted mt-1">
                รองรับไฟล์ JPG, PNG ขนาดไม่เกิน 5MB
              </small>
            </div>
          </div>
        </div>

      {/* Personal Information Section */}
      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">ข้อมูลส่วนตัว</h5>
        </Card.Header>
        <Card.Body>
          <div className="profile-field mb-3">
            <label className="profile-field-label">ชื่อ - นามสกุล</label>
            <div className="profile-field-input-group">
              <input
                type="text"
                className="profile-field-input"
                value={formData.displayName}
                onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                onBlur={() => handleFieldSave('displayName', formData.displayName)}
                disabled={editingField !== 'displayName'}
              />
              <button
                className="profile-field-edit-btn"
                onClick={() => setEditingField('displayName')}
              >
                ✏️
              </button>
            </div>
          </div>

          <div className="profile-field mb-3">
            <label className="profile-field-label">หมายเลขโทรศัพท์มือถือ</label>
            <div className="profile-field-input-group">
              <input
                type="tel"
                className="profile-field-input"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                onBlur={() => handleFieldSave('phone', formData.phone)}
                placeholder="หมายเลขโทรศัพท์มือถือ"
                disabled={editingField !== 'phone'}
              />
              <button
                className="profile-field-edit-btn"
                onClick={() => setEditingField('phone')}
              >
                ✏️
              </button>
            </div>
          </div>

          <div className="profile-field mb-3">
            <label className="profile-field-label">อีเมล</label>
            <div className="profile-field-input-group">
              <input
                type="email"
                className="profile-field-input"
                value={currentUser?.email || ''}
                disabled
              />
            </div>
          </div>
        </Card.Body>
      </Card>
      </>
    );
  };

  const renderSecurityInfo = (): JSX.Element => (
    <Card>
      <Card.Header>
        <h5 className="mb-0">ข้อมูลความปลอดภัย</h5>
      </Card.Header>
      <Card.Body>
        <div className="profile-field mb-3">
          <label className="profile-field-label">รหัสผ่าน</label>
          <div className="profile-field-input-group">
            <input
              type="password"
              className="profile-field-input"
              value="••••••"
              disabled
            />
            <button
              className="profile-field-edit-btn"
              onClick={() => setShowPasswordModal(true)}
            >
              ✏️
            </button>
          </div>
        </div>
      </Card.Body>
    </Card>
  );

  const renderLikedItems = (): JSX.Element => (
    <Card>
      <Card.Header>
        <h5 className="mb-0">รายการที่ถูกใจ</h5>
      </Card.Header>
      <Card.Body>
        {likedItems.length === 0 ? (
          <div className="text-center py-4">
            <h5>ยังไม่มีรายการที่ถูกใจ</h5>
            <p className="text-muted">เริ่มต้นกดถูกใจการ์ดที่คุณสนใจ</p>
          </div>
        ) : (
          <Row>
            {likedItems.map((item) => (
              <Col key={item.id} md={6} lg={4} className="mb-4">
                <Card 
                  className="trading-card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/post/${item.id}`)}
                >
                  <div style={{ height: '200px', overflow: 'hidden' }}>
                    {item.images && item.images.length > 0 ? (
                      <Card.Img
                        variant="top"
                        src={item.images[0]}
                        style={{ height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div className="d-flex align-items-center justify-content-center bg-light" style={{ height: '100%' }}>
                        <span className="text-muted">ไม่มีรูปภาพ</span>
                      </div>
                    )}
                  </div>
                  <Card.Body>
                    <Card.Title className="h6">{item.title}</Card.Title>
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="price-highlight">
                        {item.postType === 'auction' 
                          ? `เริ่มต้น ${formatPrice(item.startingBid || item.currentBid)}`
                          : formatPrice(item.price)
                        }
                      </span>
                      <span className="category-badge">{item.category}</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center mt-2">
                      <small className="text-muted">
                        ถูกใจเมื่อ {formatDate(item.likedAt)}
                      </small>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card.Body>
    </Card>
  );

  const renderAuctions = (): JSX.Element => (
    <Card>
      <Card.Header>
        <h5 className="mb-0">การประมูลของฉัน</h5>
      </Card.Header>
      <Card.Body>
        {auctions.length === 0 ? (
          <div className="text-center py-4">
            <h5>ยังไม่มีการประมูล</h5>
            <p className="text-muted">เริ่มต้นสร้างการประมูลการ์ดของคุณ</p>
          </div>
        ) : (
          <div className="text-center py-4">
            <h5>ฟีเจอร์การประมูล</h5>
            <p className="text-muted">จะเปิดใช้งานเร็วๆ นี้</p>
          </div>
        )}
      </Card.Body>
    </Card>
  );

  const renderWatchlist = (): JSX.Element => (
    <Card>
      <Card.Header>
        <h5 className="mb-0">รายการตั้งรับ</h5>
      </Card.Header>
      <Card.Body>
        {watchlist.length === 0 ? (
          <div className="text-center py-4">
            <h5>ยังไม่มีรายการตั้งรับ</h5>
            <p className="text-muted">เพิ่มการ์ดที่คุณสนใจลงในรายการตั้งรับ</p>
          </div>
        ) : (
          <div className="text-center py-4">
            <h5>ฟีเจอร์รายการตั้งรับ</h5>
            <p className="text-muted">จะเปิดใช้งานเร็วๆ นี้</p>
          </div>
        )}
      </Card.Body>
    </Card>
  );

  const renderOrders = (): JSX.Element => (
    <Card>
      <Card.Header>
        <h5 className="mb-0">รายการคำสั่งซื้อ</h5>
      </Card.Header>
      <Card.Body>
        {orders.length === 0 ? (
          <div className="text-center py-4">
            <h5>ยังไม่มีคำสั่งซื้อ</h5>
            <p className="text-muted">เริ่มต้นซื้อการ์ดที่คุณต้องการ</p>
          </div>
        ) : (
          <div className="text-center py-4">
            <h5>ฟีเจอร์คำสั่งซื้อ</h5>
            <p className="text-muted">จะเปิดใช้งานเร็วๆ นี้</p>
          </div>
        )}
      </Card.Body>
    </Card>
  );

  const renderMyPosts = (): JSX.Element => (
    <Card>
      <Card.Header>
        <h5 className="mb-0">รายการของฉัน</h5>
      </Card.Header>
      <Card.Body>
        {myPosts.length === 0 ? (
          <div className="text-center py-4">
            <h5>ยังไม่มีโพสต์</h5>
            <p className="text-muted">เริ่มต้นสร้างโพสต์การ์ดของคุณ</p>
          </div>
        ) : (
          <Row>
            {myPosts.map((post) => (
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
                      <div className="d-flex align-items-center justify-content-center bg-light" style={{ height: '100%' }}>
                        <span className="text-muted">ไม่มีรูปภาพ</span>
                      </div>
                    )}
                  </div>
                  <Card.Body>
                    <Card.Title className="h6">{post.title}</Card.Title>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="price-highlight">
                        {post.postType === 'auction' 
                          ? `เริ่มต้น ${formatPrice(post.startingBid)}` 
                          : formatPrice(post.price)
                        }
                      </span>
                      <span className="category-badge">{post.category}</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center">
                      <small className="text-muted">
                        สถานะ: <span className={`badge ${post.status === 'active' ? 'bg-success' : 'bg-secondary'}`}>
                          {post.status === 'active' ? 'เปิดขาย' : 'ปิดขาย'}
                        </span>
                      </small>
                      <small className="text-muted">
                        {formatDate(post.createdAt)}
                      </small>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card.Body>
    </Card>
  );

  return (
    <div className="profile-page-wrapper">
      <div className="profile-container">
        <Row className="g-0 h-100">
          {/* Sidebar */}
          <Col xs={12} md={4} lg={3} className="sidebar-column">
            <ProfileSidebar activeTab={activeTab} onTabChange={(tabId: string) => setActiveTab(tabId as ActiveTab)} />
          </Col>
          
          {/* Main Content */}
          <Col xs={12} md={8} lg={9} className="main-content-column">
            <div className="main-content">
              {renderContent()}
            </div>
          </Col>
        </Row>
      </div>

      {/* Password Update Modal */}
      <Modal show={showPasswordModal} onHide={() => setShowPasswordModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>เปลี่ยนรหัสผ่าน</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handlePasswordUpdate}>
            <Form.Group className="mb-3">
              <Form.Label>รหัสผ่านปัจจุบัน</Form.Label>
              <Form.Control
                type="password"
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                required
                className="form-control-sakura"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>รหัสผ่านใหม่</Form.Label>
              <Form.Control
                type="password"
                name="newPassword"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                required
                className="form-control-sakura"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>ยืนยันรหัสผ่านใหม่</Form.Label>
              <Form.Control
                type="password"
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                required
                className="form-control-sakura"
              />
            </Form.Group>
            <div className="d-flex gap-2">
              <Button type="submit" className="btn-tcg-primary" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    กำลังอัปเดต...
                  </>
                ) : (
                  'อัปเดตรหัสผ่าน'
                )}
              </Button>
              <Button className="btn-tcg-outline" onClick={() => setShowPasswordModal(false)}>
                ยกเลิก
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Profile;


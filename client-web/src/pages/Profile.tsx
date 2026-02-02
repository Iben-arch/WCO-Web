import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Card, Form, Modal, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import axios from '../utils/axiosInterceptor';
import { toast } from 'react-toastify';
import ProfileSidebar from '../components/layout/ProfileSidebar';
import { 
  PrimaryActionButton,
  SecondaryActionButton 
} from '../components/common/ButtonComponents';
import { Post, FirestoreTimestamp } from '../types';

interface ProfileFormData {
  displayName: string; // ชื่อที่ใช้แสดง
  phone: string; // เบอร์โทรศัพท์
  address: string; // ที่อยู่
  photoURL: string; // รูปโปรไฟล์
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
    photoURL: ''
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [likedItems, setLikedItems] = useState<LikedPost[]>([]);
  const [auctions, setAuctions] = useState<Post[]>([]);
  const [watchlist, setWatchlist] = useState<Post[]>([]);
  const [orders, setOrders] = useState<Post[]>([]);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [originalFormData, setOriginalFormData] = useState<ProfileFormData>({
    displayName: '',
    phone: '',
    address: '',
    photoURL: ''
  });
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
      const newFormData = {
        displayName: userProfile.displayName || '',
        phone: userProfile.phone || '',
        address: userProfile.address || '',
        photoURL: userProfile.photoURL || ''
      };
      setFormData(newFormData);
      // ถ้าไม่ได้อยู่ในโหมดแก้ไข ให้อัปเดต originalFormData ด้วย
      if (!isEditMode) {
        setOriginalFormData(newFormData);
      }
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
    } catch (error: any) {
      console.error('Error fetching auctions:', error);
      // If user is not authenticated or API error, set empty array
      if (error.response?.status === 401) {
        setAuctions([]);
      }
    }
  };

  const fetchWatchlist = async (): Promise<void> => {
    try {
      const response = await axios.get('/api/auth/watchlist');
      setWatchlist(response.data);
    } catch (error: any) {
      console.error('Error fetching watchlist:', error);
      // If user is not authenticated or API error, set empty array
      if (error.response?.status === 401) {
        setWatchlist([]);
      }
    }
  };

  const fetchOrders = async (): Promise<void> => {
    try {
      const response = await axios.get('/api/auth/orders');
      setOrders(response.data);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      // If user is not authenticated or API error, set empty array
      if (error.response?.status === 401) {
        setOrders([]);
      }
    }
  };

  const fetchMyPosts = async (): Promise<void> => {
    try {
      const response = await axios.get('/api/posts/my-posts');
      setMyPosts(response.data.posts);
    } catch (error: any) {
      console.error('Error fetching my posts:', error);
      // If user is not authenticated or API error, set empty array
      if (error.response?.status === 401) {
        setMyPosts([]);
      }
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value
    });
  };

  const handleEditModeToggle = (): void => {
    if (!isEditMode) {
      // เข้าสู่โหมดแก้ไข - เก็บข้อมูลเดิมไว้
      setOriginalFormData({ ...formData });
      setIsEditMode(true);
    } else {
      // ยกเลิกการแก้ไข - คืนค่าข้อมูลเดิม
      setFormData({ ...originalFormData });
      setIsEditMode(false);
    }
  };

  const handleSaveAll = async (): Promise<void> => {
    try {
      setLoading(true);
      
      // สร้าง object สำหรับอัปเดตเฉพาะฟิลด์ที่เปลี่ยนแปลง
      const updateData: any = {};
      
      // ตรวจสอบและเพิ่มฟิลด์ที่เปลี่ยนแปลง
      if (formData.displayName !== originalFormData.displayName) {
        updateData.displayName = formData.displayName;
      }
      if (formData.phone !== originalFormData.phone) {
        updateData.phone = formData.phone;
      }
      if (formData.address !== originalFormData.address) {
        updateData.address = formData.address;
      }
      if (formData.photoURL !== originalFormData.photoURL) {
        updateData.profileImage = formData.photoURL;
      }

      // ถ้ามีการเปลี่ยนแปลง ให้อัปเดต
      if (Object.keys(updateData).length > 0) {
        await updateProfile(updateData);
        setOriginalFormData({ ...formData });
        toast.success('บันทึกข้อมูลโปรไฟล์สำเร็จ');
      } else {
        toast.info('ไม่มีการเปลี่ยนแปลงข้อมูล');
      }
      
      setIsEditMode(false);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      
      // Handle 401 Unauthorized - token หมดอายุหรือไม่ถูกต้อง
      if (error.response?.status === 401) {
        toast.error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
        // Redirect to login after a short delay
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        const errorMessage = error.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
        toast.error(errorMessage);
      }
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
      
      // ตรวจสอบว่าผู้ใช้เข้าสู่ระบบแล้วหรือไม่
      if (!currentUser) {
        toast.error('กรุณาเข้าสู่ระบบก่อนอัปโหลดรูปโปรไฟล์');
        setLoading(false);
        return;
      }

      // สร้างชื่อไฟล์: userId/timestamp-filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // ลบรูปเก่าถ้ามี (ถ้ามี avatar_url เก่าใน Supabase Storage)
      if (userProfile?.avatar_url) {
        try {
          // แยก path จาก URL
          const oldUrl = userProfile.avatar_url;
          const urlParts = oldUrl.split('/storage/v1/object/public/avatars/');
          if (urlParts.length > 1) {
            const oldPath = urlParts[1];
            await supabase.storage
              .from('avatars')
              .remove([oldPath]);
          }
        } catch (deleteError) {
          // ไม่ต้องแสดง error ถ้าลบรูปเก่าไม่สำเร็จ (อาจจะไม่มีรูปเก่า)
          console.warn('Could not delete old avatar:', deleteError);
        }
      }

      // อัปโหลดรูปไปยัง Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      // จำลอง progress (Supabase Storage ไม่มี progress callback)
      // ใช้ setTimeout เพื่อแสดง progress animation
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 50));
        setUploadProgress(i);
      }

      // ดึง public URL ของรูปที่อัปโหลด
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // อัปเดต avatar_url ในตาราง profiles
      await updateProfile({ avatar_url: publicUrl });
      
      setPreviewImage(null); // Clear preview after successful upload
      setUploadProgress(0);
      toast.success('อัปโหลดรูปโปรไฟล์และบันทึกลงฐานข้อมูลสำเร็จ');
    } catch (error: any) {
      console.error('Error uploading profile image:', error);
      setPreviewImage(null);
      setUploadProgress(0);
      
      // Handle different error types
      if (error.message?.includes('JWT')) {
        toast.error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else if (error.message?.includes('Bucket not found')) {
        toast.error('ไม่พบ Storage bucket กรุณาติดต่อผู้ดูแลระบบ');
      } else if (error.message?.includes('new row violates row-level security')) {
        toast.error('ไม่มีสิทธิ์อัปโหลดรูป กรุณาตรวจสอบการตั้งค่า Storage policies');
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
      if (currentUser?.email) return currentUser.email.split('@')[0];
      return 'ผู้ใช้';
    };

    return (
      <>
        {/* Profile Header */}
        <div className="profile-header mb-4">
          <div className="d-flex align-items-center flex-wrap">
            <label 
              htmlFor="profile-image-upload" 
              className="profile-image-container me-4"
              style={{ cursor: 'pointer' }}
              title="คลิกเพื่ออัปโหลดรูปโปรไฟล์"
            >
              {previewImage || formData.photoURL || userProfile?.photoURL ? (
                <>
                  <img
                    src={previewImage || formData.photoURL || userProfile?.photoURL}
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
                </>
              ) : (
                <div className="profile-image-placeholder">
                  <div className="profile-placeholder-content">
                    <div className="profile-placeholder-icon">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M20.59 22C20.59 18.13 16.74 15 12 15C7.26 15 3.41 18.13 3.41 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div className="profile-placeholder-text">Profile</div>
                  </div>
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
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleProfileImageUpload}
                className="d-none"
                id="profile-image-upload"
                disabled={loading}
              />
            </label>
            <div className="flex-grow-1">
              <h4 className="profile-name mb-2">
                {getDisplayName()}
              </h4>
              <p className="text-muted mb-3" style={{ fontSize: '0.9375rem' }}>
                <span style={{ marginRight: '0.5rem' }}>📅</span>
                เป็นสมาชิกเมื่อ {formatDate(userProfile?.createdAt)}
              </p>
              <div className="upload-section">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfileImageUpload}
                  className="d-none"
                  id="profile-image-upload-btn"
                  disabled={loading}
                />
                <label htmlFor="profile-image-upload-btn" className={`upload-btn ${loading ? 'disabled' : ''}`}>
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" />
                      กำลังอัปโหลด...
                    </>
                  ) : (
                    <>
                      📤 อัปโหลดรูปโปรไฟล์
                    </>
                  )}
                </label>
                <small className="d-block text-muted mt-2" style={{ fontSize: '0.8125rem' }}>
                  รองรับไฟล์ JPG, PNG ขนาดไม่เกิน 5MB
                </small>
              </div>
            </div>
          </div>
        </div>

      {/* Personal Information Section */}
      <Card className={`mb-4 profile-info-card ${isEditMode ? 'profile-edit-mode' : ''}`}>
        <Card.Header className={`profile-card-header ${isEditMode ? 'edit-mode-active' : ''}`}>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
            <div className="d-flex align-items-center gap-2">
              <div className="profile-section-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <h5 className="mb-0 profile-section-title">ข้อมูลส่วนตัว</h5>
                {isEditMode && (
                  <small className="text-primary d-block mt-1" style={{ fontSize: '0.75rem', fontWeight: 500 }}>
                    <span className="edit-mode-badge">โหมดแก้ไข</span>
                  </small>
                )}
              </div>
            </div>
            {!isEditMode ? (
              <button
                className="btn btn-edit-profile"
                onClick={handleEditModeToggle}
                disabled={loading}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '0.5rem' }}>
                  <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M18.5 2.5C18.8978 2.10218 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10218 21.5 2.5C21.8978 2.89782 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10218 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                แก้ไขโปรไฟล์
              </button>
            ) : (
              <div className="d-flex gap-2">
                <button
                  className="btn btn-cancel-edit"
                  onClick={handleEditModeToggle}
                  disabled={loading}
                >
                  ยกเลิก
                </button>
                <button
                  className="btn btn-save-profile"
                  onClick={handleSaveAll}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" />
                      กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '0.5rem' }}>
                        <path d="M19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16L21 8V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M17 21V13H7V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M7 3V8H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      บันทึก
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </Card.Header>
        <Card.Body className="profile-card-body">
          <div className="profile-field">
            <label className="profile-field-label">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}>
                <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              ชื่อที่ใช้แสดง
            </label>
            <div className="profile-field-input-group">
              <input
                type="text"
                className="profile-field-input"
                value={formData.displayName}
                onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                placeholder="กรอกชื่อ - นามสกุล"
                disabled={!isEditMode}
                readOnly={!isEditMode}
              />
            </div>
          </div>

          <div className="profile-field">
            <label className="profile-field-label">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}>
                <path d="M22 16.92V19.92C22 20.52 21.52 21 20.92 21C9.4 21 0 11.6 0 0.08C0 -0.52 0.48 -1 1.08 -1H4.08C4.68 -1 5.16 -0.52 5.16 0.08C5.16 1.08 5.24 2.08 5.4 3.04C5.52 3.36 5.44 3.72 5.2 3.96L3.24 5.92C4.56 8.76 7.24 11.44 10.08 12.76L12.04 10.8C12.28 10.56 12.64 10.48 12.96 10.6C13.92 10.76 14.92 10.84 15.92 10.84C16.52 10.84 17 11.32 17 11.92V14.92C17 15.52 16.52 16 15.92 16Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              หมายเลขโทรศัพท์มือถือ
            </label>
            <div className="profile-field-input-group">
              <input
                type="tel"
                className="profile-field-input"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="กรอกหมายเลขโทรศัพท์มือถือ"
                disabled={!isEditMode}
                readOnly={!isEditMode}
              />
            </div>
          </div>

          <div className="profile-field">
            <label className="profile-field-label">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}>
                <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22 6L12 13L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              อีเมล
            </label>
            <div className="profile-field-input-group profile-field-disabled">
              <input
                type="email"
                className="profile-field-input"
                value={currentUser?.email || ''}
                disabled
                placeholder="อีเมล"
              />
              <span className="profile-field-lock-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 11H5C3.89543 11 3 11.8954 3 13V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V13C21 11.8954 20.1046 11 19 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </div>
            <small className="profile-field-hint">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '0.25rem', verticalAlign: 'middle' }}>
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 16V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 8H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              อีเมลไม่สามารถแก้ไขได้
            </small>
          </div>

          <div className="profile-field">
            <label className="profile-field-label">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}>
                <path d="M21 10C21 17 12 23 12 23C12 23 3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.364 3.63604C20.0518 5.32387 21 7.61305 21 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              ที่อยู่
            </label>
            <div className="profile-field-input-group">
              <textarea
                className="profile-field-input"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                placeholder="กรอกที่อยู่"
                disabled={!isEditMode}
                readOnly={!isEditMode}
                rows={4}
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
        <h5 className="mb-0">🔒 ข้อมูลความปลอดภัย</h5>
      </Card.Header>
      <Card.Body>
        <div className="profile-field">
          <label className="profile-field-label">รหัสผ่าน</label>
          <div className="profile-field-input-group">
            <input
              type="password"
              className="profile-field-input"
              value="••••••••••"
              disabled
              placeholder="รหัสผ่าน"
            />
            <button
              className="profile-field-edit-btn"
              onClick={() => setShowPasswordModal(true)}
              title="เปลี่ยนรหัสผ่าน"
            >
              🔑
            </button>
          </div>
          <small className="text-muted" style={{ fontSize: '0.8125rem', marginTop: '0.5rem', display: 'block' }}>
            คลิกปุ่ม 🔑 เพื่อเปลี่ยนรหัสผ่าน
          </small>
        </div>
      </Card.Body>
    </Card>
  );

  const renderLikedItems = (): JSX.Element => (
      <Card>
        <Card.Header>
          <h5 className="mb-0">❤️ รายการที่ถูกใจ</h5>
        </Card.Header>
      <Card.Body>
        {likedItems.length === 0 ? (
          <div className="profile-empty-state">
            <div className="profile-empty-state-icon">❤️</div>
            <h5 className="profile-empty-state-title">ยังไม่มีรายการที่ถูกใจ</h5>
            <p className="profile-empty-state-description">เริ่มต้นกดถูกใจการ์ดที่คุณสนใจ</p>
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
          <h5 className="mb-0">🔨 การประมูลของฉัน</h5>
        </Card.Header>
      <Card.Body>
        {auctions.length === 0 ? (
          <div className="profile-empty-state">
            <div className="profile-empty-state-icon">🔨</div>
            <h5 className="profile-empty-state-title">ยังไม่มีการประมูล</h5>
            <p className="profile-empty-state-description">เริ่มต้นสร้างการประมูลการ์ดของคุณ</p>
          </div>
        ) : (
          <div className="profile-empty-state">
            <div className="profile-empty-state-icon">⏳</div>
            <h5 className="profile-empty-state-title">ฟีเจอร์การประมูล</h5>
            <p className="profile-empty-state-description">จะเปิดใช้งานเร็วๆ นี้</p>
          </div>
        )}
      </Card.Body>
    </Card>
  );

  const renderWatchlist = (): JSX.Element => (
      <Card>
        <Card.Header>
          <h5 className="mb-0">👀 รายการตั้งรับ</h5>
        </Card.Header>
      <Card.Body>
        {watchlist.length === 0 ? (
          <div className="profile-empty-state">
            <div className="profile-empty-state-icon">👀</div>
            <h5 className="profile-empty-state-title">ยังไม่มีรายการตั้งรับ</h5>
            <p className="profile-empty-state-description">เพิ่มการ์ดที่คุณสนใจลงในรายการตั้งรับ</p>
          </div>
        ) : (
          <div className="profile-empty-state">
            <div className="profile-empty-state-icon">⏳</div>
            <h5 className="profile-empty-state-title">ฟีเจอร์รายการตั้งรับ</h5>
            <p className="profile-empty-state-description">จะเปิดใช้งานเร็วๆ นี้</p>
          </div>
        )}
      </Card.Body>
    </Card>
  );

  const renderOrders = (): JSX.Element => (
      <Card>
        <Card.Header>
          <h5 className="mb-0">📋 รายการคำสั่งซื้อ</h5>
        </Card.Header>
      <Card.Body>
        {orders.length === 0 ? (
          <div className="profile-empty-state">
            <div className="profile-empty-state-icon">📋</div>
            <h5 className="profile-empty-state-title">ยังไม่มีคำสั่งซื้อ</h5>
            <p className="profile-empty-state-description">เริ่มต้นซื้อการ์ดที่คุณต้องการ</p>
          </div>
        ) : (
          <div className="profile-empty-state">
            <div className="profile-empty-state-icon">⏳</div>
            <h5 className="profile-empty-state-title">ฟีเจอร์คำสั่งซื้อ</h5>
            <p className="profile-empty-state-description">จะเปิดใช้งานเร็วๆ นี้</p>
          </div>
        )}
      </Card.Body>
    </Card>
  );

  const renderMyPosts = (): JSX.Element => (
      <Card>
        <Card.Header>
          <h5 className="mb-0">📝 รายการของฉัน</h5>
        </Card.Header>
      <Card.Body>
        {myPosts.length === 0 ? (
          <div className="profile-empty-state">
            <div className="profile-empty-state-icon">📝</div>
            <h5 className="profile-empty-state-title">ยังไม่มีโพสต์</h5>
            <p className="profile-empty-state-description">เริ่มต้นสร้างโพสต์การ์ดของคุณ</p>
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


import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import axios from '../utils/axiosInterceptor';
import { ordersAPI } from '../api/api';
import { toast } from 'react-toastify';
import ProfileSidebar from '../components/layout/ProfileSidebar';
import SellerApplicationModal from '../components/seller/SellerApplicationModal';
import { canSellCards } from '../utils/roles';
import { Post, FirestoreTimestamp, OrderDto, OrderItemDto } from '../types';

interface ProfileFormData {
  displayName: string; // ชื่อที่ใช้แสดง
  phone: string; // เบอร์โทรศัพท์
  address: string; // ที่อยู่
  photoURL: string; // รูปโปรไฟล์
  sellerContactNote: string; // ช่องทางติดต่อผู้ขาย
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

interface ProfileProps {
  initialTab?: ActiveTab;
}

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

const Badge: React.FC<{ bg?: string; className?: string; children: React.ReactNode }> = ({ bg, className, children }) => {
  const b = bg === 'success' ? 'badge-success' : bg === 'warning' ? 'badge-warning' : bg === 'danger' ? 'badge-error' : bg === 'info' ? 'badge-info' : bg === 'secondary' ? 'badge-neutral' : '';
  return <span className={cx('badge badge-sm', b, className)}>{children}</span>;
};
const Spinner: React.FC<{ size?: string; className?: string }> = ({ size, className }) => <span className={cx('loading loading-spinner', size === 'sm' ? 'loading-sm' : 'loading-md', className)} />;

type ModalType = React.FC<any> & { Header: React.FC<any>; Title: React.FC<any>; Body: React.FC<any>; Footer: React.FC<any> };
const Modal = (({ show, onHide, children }: any) => {
  if (!show) return null;
  const withClose = React.Children.map(children, (child) =>
    React.isValidElement(child) ? React.cloneElement(child as React.ReactElement<any>, { __onHide: onHide }) : child
  );
  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onHide}>
      <div className="bg-base-100 rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>{withClose}</div>
    </div>
  );
}) as ModalType;
const ModalHeader: React.FC<any> = ({ children, closeButton, __onHide }) => (
  <div className="px-6 py-4 border-b border-base-300 flex items-center justify-between">
    <div className="font-bold text-lg">{children}</div>
    {closeButton ? <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={__onHide}>✕</button> : null}
  </div>
);
const ModalTitle: React.FC<any> = ({ children }) => <>{children}</>;
const ModalBody: React.FC<any> = ({ children }) => <div className="px-6 py-4">{children}</div>;
const ModalFooter: React.FC<any> = ({ children }) => <div className="px-6 py-4 border-t border-base-300 flex justify-end gap-2">{children}</div>;
Object.assign(Modal, { Header: ModalHeader, Title: ModalTitle, Body: ModalBody, Footer: ModalFooter });

const Profile: React.FC<ProfileProps> = ({ initialTab = 'personal-info' }) => {
  const { userProfile, profile, updateProfile, currentUser, refreshProfileFromApi } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // เปิดแท็บจาก state (เช่น หลัง checkout จากตะกร้า)
  useEffect(() => {
    const stateTab = (location.state as { tab?: string })?.tab;
    if (stateTab && (stateTab === 'orders' || stateTab === 'my-posts' || stateTab === 'liked' || stateTab === 'personal-info' || stateTab === 'security' || stateTab === 'auctions' || stateTab === 'watchlist')) {
      setActiveTab(stateTab as ActiveTab);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  // ยิง GET /api/auth/profile เมื่อเข้าหน้าโปรไฟล์
  useEffect(() => {
    if (currentUser && refreshProfileFromApi) {
      refreshProfileFromApi();
    }
  }, [currentUser?.id, refreshProfileFromApi]);

  const [formData, setFormData] = useState<ProfileFormData>({
    displayName: '',
    phone: '',
    address: '',
    photoURL: '',
    sellerContactNote: ''
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [likedItems, setLikedItems] = useState<LikedPost[]>([]);
  const [auctions, setAuctions] = useState<Post[]>([]);
  const [watchlist, setWatchlist] = useState<Post[]>([]);
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [sellerOrders, setSellerOrders] = useState<OrderDto[]>([]);
  const [ordersLoading, setOrdersLoading] = useState<boolean>(false);
  const [sellerOrdersLoading, setSellerOrdersLoading] = useState<boolean>(false);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [originalFormData, setOriginalFormData] = useState<ProfileFormData>({
    displayName: '',
    phone: '',
    address: '',
    photoURL: '',
    sellerContactNote: ''
  });
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState<boolean>(false);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [confirmShipmentOrderId, setConfirmShipmentOrderId] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [confirmShipmentLoading, setConfirmShipmentLoading] = useState<boolean>(false);
  const [confirmReceivedOrderId, setConfirmReceivedOrderId] = useState<string | null>(null);
  const [confirmReceivedLoading, setConfirmReceivedLoading] = useState<boolean>(false);
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [showSellerApplicationModal, setShowSellerApplicationModal] = useState<boolean>(false);

  useEffect(() => {
    const st = location.state as { openSellerApplication?: boolean } | null | undefined;
    if (st?.openSellerApplication) {
      setShowSellerApplicationModal(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  // Lazy load: โหลดข้อมูลเฉพาะเมื่อเปลี่ยนแท็บ (แทนการโหลดทั้งหมดพร้อมกัน)
  useEffect(() => {
    if (userProfile) {
      const newFormData = {
        displayName: userProfile.displayName || '',
        phone: userProfile.phone || '',
        address: userProfile.address || '',
        photoURL: userProfile.photoURL || '',
        sellerContactNote: (profile?.seller_contact_note as string) || (userProfile.seller_contact_note as string) || ''
      };
      setFormData(newFormData);
      if (!isEditMode) {
        setOriginalFormData(newFormData);
      }
    }
  }, [userProfile, profile, isEditMode]);

  // โหลดข้อมูลเฉพาะแท็บที่เลือก (lazy load)
  useEffect(() => {
    if (!userProfile) return;
    switch (activeTab) {
      case 'liked':
        fetchLikedItems();
        break;
      case 'auctions':
        fetchAuctions();
        break;
      case 'watchlist':
        fetchWatchlist();
        break;
      case 'orders':
        fetchOrders();
        fetchSellerOrders();
        break;
      case 'my-posts':
        fetchMyPosts();
        break;
      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile, activeTab]);

  const fetchLikedItems = async (): Promise<void> => {
    try {
      const response = await axios.get('/api/auth/liked-items');
      setLikedItems(Array.isArray(response.data) ? response.data : []);
    } catch (error: any) {
      console.error('Error fetching liked items:', error);
      setLikedItems([]);
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
    setOrdersLoading(true);
    try {
      const data = await ordersAPI.getMyOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (error: any) {
      if (error.response?.status === 401) setOrders([]);
      else console.error('Error fetching orders:', error);
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchSellerOrders = async (): Promise<void> => {
    setSellerOrdersLoading(true);
    try {
      const data = await ordersAPI.getSellerOrders();
      setSellerOrders(Array.isArray(data) ? data : []);
    } catch (error: any) {
      if (error.response?.status === 401) setSellerOrders([]);
      else console.error('Error fetching seller orders:', error);
      setSellerOrders([]);
    } finally {
      setSellerOrdersLoading(false);
    }
  };

  const fetchMyPosts = async (): Promise<void> => {
    try {
      const response = await axios.get('/api/posts/my-posts');
      setMyPosts(response.data.posts ?? response.data ?? []);
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
      if (formData.sellerContactNote !== originalFormData.sellerContactNote) {
        updateData.seller_contact_note = formData.sellerContactNote;
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
    const getDisplayName = (): string => {
      if (formData.displayName) return formData.displayName;
      if (userProfile?.displayName) return userProfile.displayName;
      if (currentUser?.email) return currentUser.email.split('@')[0];
      return 'ผู้ใช้';
    };

    const isSeller = canSellCards(profile?.role ?? userProfile?.role);
    const avatarSrc = previewImage || formData.photoURL || userProfile?.photoURL;

    return (
      <div className="space-y-4">
        {/* Profile Hero Card */}
        <div className="rounded-2xl bg-base-100 border border-base-300 shadow-sm overflow-hidden">
          {/* Banner */}
          <div className="h-24 bg-gradient-to-r from-primary/20 via-secondary/20 to-accent/20" />

          <div className="px-6 pb-6">
            {/* Avatar + Info Row */}
            <div className="flex flex-wrap items-end gap-4 -mt-10 mb-2">
              {/* Avatar */}
              <div className="shrink-0 flex flex-col items-center gap-2">
                <label
                  htmlFor="profile-image-upload"
                  className="relative cursor-pointer group"
                  title="คลิกเพื่ออัปโหลดรูปโปรไฟล์"
                >
                  <div className="w-20 h-20 rounded-2xl border-4 border-base-100 shadow-md overflow-hidden bg-base-200 flex items-center justify-center">
                    {avatarSrc ? (
                      <img src={avatarSrc} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="text-base-content/40" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                      </svg>
                    )}
                    {loading && (
                      <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                        <Spinner size="sm" className="text-white" />
                      </div>
                    )}
                  </div>
                  {/* Camera overlay on hover */}
                  <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                    </svg>
                  </div>
                  <input type="file" accept="image/*" onChange={handleProfileImageUpload} className="hidden" id="profile-image-upload" disabled={loading} />
                </label>

                {/* Upload button below avatar */}
                <label htmlFor="profile-image-upload" className={cx('btn btn-xs btn-outline gap-1.5', loading ? 'btn-disabled' : '')}>
                  {loading ? (
                    <><Spinner size="sm" /> กำลังอัปโหลด...</>
                  ) : (
                    <>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      อัปโหลดรูป
                    </>
                  )}
                </label>
                <p className="text-[10px] text-base-content/35 leading-tight text-center">JPG, PNG · ไม่เกิน 5MB</p>
              </div>

              <div className="flex-1 min-w-0 pb-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h2 className="text-xl font-bold text-base-content truncate">{getDisplayName()}</h2>
                  {isSeller && (
                    <span className="badge badge-primary badge-sm font-medium">ผู้ขาย</span>
                  )}
                </div>
                {userProfile?.createdAt && (
                  <div className="flex items-center gap-1.5 text-xs text-base-content/45">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <span>เป็นสมาชิกเมื่อ {formatDate(userProfile.createdAt)}</span>
                  </div>
                )}
              </div>
            </div>

            {loading && uploadProgress > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-base-content/50">กำลังอัปโหลด...</span>
                  <span className="text-xs text-primary font-medium">{uploadProgress}%</span>
                </div>
                <progress className="progress progress-primary w-full h-1.5" value={uploadProgress} max="100" />
              </div>
            )}
          </div>
        </div>

        {/* Personal Information Card */}
        <div className={cx('rounded-2xl bg-base-100 border shadow-sm overflow-hidden', isEditMode ? 'border-primary/40' : 'border-base-300')}>
          <div className="px-6 py-4 border-b border-base-300 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-base-content">ข้อมูลส่วนตัว</h3>
                {isEditMode && <p className="text-xs text-primary mt-0.5">โหมดแก้ไข</p>}
              </div>
            </div>

            <div className="flex gap-2">
              {!isEditMode ? (
                <button className="btn btn-primary btn-sm gap-2" onClick={handleEditModeToggle} disabled={loading}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  แก้ไขโปรไฟล์
                </button>
              ) : (
                <>
                  <button className="btn btn-ghost btn-sm" onClick={handleEditModeToggle} disabled={loading}>ยกเลิก</button>
                  <button className="btn btn-primary btn-sm gap-2" onClick={handleSaveAll} disabled={loading}>
                    {loading ? (
                      <><Spinner size="sm" /> กำลังบันทึก...</>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                        </svg>
                        บันทึก
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Display Name */}
            <div className="form-control">
              <label className="label pb-1">
                <span className="label-text font-medium flex items-center gap-2">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-base-content/60">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  ชื่อที่ใช้แสดง
                </span>
              </label>
              <input
                type="text"
                className={cx('input input-bordered w-full', !isEditMode && 'bg-base-200/50 cursor-default')}
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="กรอกชื่อ - นามสกุล"
                disabled={!isEditMode}
                readOnly={!isEditMode}
              />
            </div>

            {/* Phone */}
            <div className="form-control">
              <label className="label pb-1">
                <span className="label-text font-medium flex items-center gap-2">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-base-content/60">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.92 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  หมายเลขโทรศัพท์
                </span>
              </label>
              <input
                type="tel"
                className={cx('input input-bordered w-full', !isEditMode && 'bg-base-200/50 cursor-default')}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="กรอกหมายเลขโทรศัพท์"
                disabled={!isEditMode}
                readOnly={!isEditMode}
              />
            </div>

            {/* Email (read-only) */}
            <div className="form-control">
              <label className="label pb-1">
                <span className="label-text font-medium flex items-center gap-2">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-base-content/60">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                  </svg>
                  อีเมล
                </span>
                <span className="label-text-alt flex items-center gap-1 text-base-content/40">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  ไม่สามารถแก้ไขได้
                </span>
              </label>
              <input
                type="email"
                className="input input-bordered w-full bg-base-200/50 cursor-default"
                value={currentUser?.email || ''}
                disabled
              />
            </div>

            {/* Address */}
            <div className="form-control">
              <label className="label pb-1">
                <span className="label-text font-medium flex items-center gap-2">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-base-content/60">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  ที่อยู่
                </span>
              </label>
              <textarea
                className={cx('textarea textarea-bordered w-full resize-none', !isEditMode && 'bg-base-200/50 cursor-default')}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="กรอกที่อยู่"
                disabled={!isEditMode}
                readOnly={!isEditMode}
                rows={3}
              />
            </div>

            {/* Seller contact note */}
            {isSeller && (
              <div className="form-control">
                <label className="label pb-1">
                  <span className="label-text font-medium flex items-center gap-2">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-base-content/60">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    ช่องทางติดต่อผู้ขาย
                  </span>
                  <span className="label-text-alt text-base-content/40">แสดงบนหน้าโพสต์</span>
                </label>
                <textarea
                  className={cx('textarea textarea-bordered w-full resize-none', !isEditMode && 'bg-base-200/50 cursor-default')}
                  value={formData.sellerContactNote}
                  onChange={(e) => setFormData({ ...formData, sellerContactNote: e.target.value })}
                  placeholder="เช่น Line: @xxxx, Facebook: ..., เบอร์ติดต่อ..."
                  disabled={!isEditMode}
                  readOnly={!isEditMode}
                  rows={3}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSecurityInfo = (): JSX.Element => (
    <div className="rounded-2xl bg-base-100 border border-base-300 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-base-300 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center text-warning">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <h3 className="font-semibold text-base-content">ข้อมูลความปลอดภัย</h3>
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between p-4 rounded-xl bg-base-200/50 border border-base-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-base-100 flex items-center justify-center shadow-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-base-content/60">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div>
              <p className="font-medium text-sm text-base-content">รหัสผ่าน</p>
              <p className="text-xs text-base-content/50 mt-0.5 tracking-widest">••••••••••</p>
            </div>
          </div>
          <button className="btn btn-sm btn-outline gap-2" onClick={() => setShowPasswordModal(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            เปลี่ยนรหัสผ่าน
          </button>
        </div>
      </div>
    </div>
  );

  const renderLikedItems = (): JSX.Element => (
    <div className="rounded-2xl bg-base-100 border border-base-300 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-base-300 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-error/10 flex items-center justify-center text-error">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-base-content">รายการที่ถูกใจ</h3>
          {likedItems.length > 0 && <p className="text-xs text-base-content/50">{likedItems.length} รายการ</p>}
        </div>
      </div>

      <div className="p-6">
        {likedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="text-5xl">❤️</div>
            <h4 className="font-semibold text-base-content/70">ยังไม่มีรายการที่ถูกใจ</h4>
            <p className="text-sm text-base-content/40">เริ่มต้นกดถูกใจการ์ดที่คุณสนใจ</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {likedItems.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-base-300 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer bg-base-100"
                onClick={() => navigate(`/post/${item.id}`)}
              >
                <div className="h-44 overflow-hidden bg-base-200">
                  {item.images && item.images.length > 0 ? (
                    <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-base-content/30 text-sm">ไม่มีรูปภาพ</div>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-semibold text-sm text-base-content line-clamp-1 mb-2">{item.title}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-primary font-bold text-sm">
                      {item.postType === 'auction' ? `เริ่มต้น ${formatPrice(item.startingBid || item.currentBid)}` : formatPrice(item.price)}
                    </span>
                    <span className="badge badge-ghost badge-sm">{item.category}</span>
                  </div>
                  <p className="text-xs text-base-content/40 mt-2">ถูกใจเมื่อ {formatDate(item.likedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderAuctions = (): JSX.Element => (
    <div className="rounded-2xl bg-base-100 border border-base-300 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-base-300 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 12l-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9"/>
            <path d="M17.64 15L22 10.64"/><path d="M20.91 11.7l-1.25-1.25L22 8l-1-1-1.45 2.25L17.3 7.91l-1.25 1.25"/>
            <path d="M15 12l-3-3"/>
          </svg>
        </div>
        <h3 className="font-semibold text-base-content">การประมูลของฉัน</h3>
      </div>
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="text-5xl">{auctions.length === 0 ? '🔨' : '⏳'}</div>
          <h4 className="font-semibold text-base-content/70">{auctions.length === 0 ? 'ยังไม่มีการประมูล' : 'ฟีเจอร์การประมูล'}</h4>
          <p className="text-sm text-base-content/40">{auctions.length === 0 ? 'เริ่มต้นสร้างการประมูลการ์ดของคุณ' : 'จะเปิดใช้งานเร็วๆ นี้'}</p>
        </div>
      </div>
    </div>
  );

  const renderWatchlist = (): JSX.Element => (
    <div className="rounded-2xl bg-base-100 border border-base-300 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-base-300 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-info/10 flex items-center justify-center text-info">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
        </div>
        <h3 className="font-semibold text-base-content">รายการตั้งรับ</h3>
      </div>
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="text-5xl">{watchlist.length === 0 ? '👀' : '⏳'}</div>
          <h4 className="font-semibold text-base-content/70">{watchlist.length === 0 ? 'ยังไม่มีรายการตั้งรับ' : 'ฟีเจอร์รายการตั้งรับ'}</h4>
          <p className="text-sm text-base-content/40">{watchlist.length === 0 ? 'เพิ่มการ์ดที่คุณสนใจลงในรายการตั้งรับ' : 'จะเปิดใช้งานเร็วๆ นี้'}</p>
        </div>
      </div>
    </div>
  );

  const renderOrders = (): JSX.Element => {
    const formatOrderDate = (d: string | null | undefined): string => {
      if (!d) return '-';
      try {
        return new Date(d).toLocaleDateString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
      } catch {
        return String(d);
      }
    };

    const getOrderItemDisplay = (it: OrderItemDto) => {
      const post = it.post as any;
      const isIndividualCard = !!it.cardId && post?.individualCards?.length;
      const card = isIndividualCard
        ? (post?.individualCards as Array<{ id?: string; imageUrl?: string; price?: number }>)?.find((c) => c.id === it.cardId)
        : null;
      const cardImage: string | null = card?.imageUrl ?? null;
      const postImages: string[] = Array.isArray(post?.images) ? post.images : [];
      const postImage: string | null = postImages[0] ?? null;
      const displayImage = cardImage || postImage;
      const title: string = post?.title || post?.Title || null;
      const isDeleted = !post;
      return { title, displayImage, isIndividualCard, isDeleted };
    };

    const renderOrderItemRow = (it: OrderItemDto, idx: number, showPrice: boolean) => {
      const { title, displayImage, isIndividualCard, isDeleted } = getOrderItemDisplay(it);
      return (
        <li key={it.id || idx}
          className="flex items-center gap-3 p-2.5 rounded-xl bg-base-200/40 hover:bg-base-200/70 transition-colors cursor-pointer"
          onClick={() => it.postId && navigate(`/posts/${it.postId}`)}
        >
          {/* Thumbnail */}
          <div className="w-12 h-14 rounded-lg overflow-hidden bg-base-300 shrink-0 flex items-center justify-center">
            {displayImage ? (
              <img src={displayImage} alt={title || ''} className="w-full h-full object-cover" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-base-content/30">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {isDeleted ? (
              <p className="text-sm text-base-content/40 italic">สินค้าที่ถูกลบออกจากระบบ</p>
            ) : title ? (
              <p className="text-sm font-medium text-base-content leading-snug line-clamp-2">{title}</p>
            ) : (
              <p className="text-sm text-base-content/50">รายการสินค้า</p>
            )}
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {isIndividualCard && <Badge bg="secondary">แยกใบ</Badge>}
              <span className="text-xs text-base-content/50">×{it.quantity}</span>
            </div>
          </div>

          {/* Price */}
          {showPrice && (
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-base-content">{formatPrice(Number(it.unitPrice))}</p>
              {it.quantity > 1 && (
                <p className="text-xs text-base-content/40">{formatPrice(Number(it.unitPrice))} / ชิ้น</p>
              )}
            </div>
          )}
        </li>
      );
    };

    const statusBadge = (status: string) => {
      if (status === 'sold') return <span className="badge badge-success badge-sm">ขายแล้ว</span>;
      if (status === 'shipped') return <span className="badge badge-info badge-sm">จัดส่งแล้ว</span>;
      return <span className="badge badge-warning badge-sm">รอจัดส่ง</span>;
    };

    return (
      <div className="space-y-4">
        {/* Buyer Orders */}
        <div className="rounded-2xl bg-base-100 border border-base-300 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-base-300 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center text-success">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-base-content">รายการที่ซื้อ</h3>
              {orders.length > 0 && <p className="text-xs text-base-content/50">{orders.length} คำสั่งซื้อ</p>}
            </div>
          </div>

          <div className="p-6">
            {ordersLoading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="text-5xl">📋</div>
                <h4 className="font-semibold text-base-content/70">ยังไม่มีคำสั่งซื้อ</h4>
                <p className="text-sm text-base-content/40">เมื่อคุณสั่งซื้อจากตะกร้า คำสั่งซื้อจะแสดงที่นี่</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <div key={order.id} className="rounded-xl border border-base-300 overflow-hidden">
                    <div className="px-4 py-3 bg-base-200/50 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {statusBadge(order.status)}
                        <span className="text-xs text-base-content/50">ผู้ขาย: {order.sellerName || '-'}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm text-base-content">{formatPrice(Number(order.totalAmount))}</p>
                        <p className="text-xs text-base-content/40">{formatOrderDate(order.createdAt)}</p>
                      </div>
                    </div>
                    <div className="px-4 py-3">
                      <ul className="space-y-1.5 mb-3">
                        {order.items?.map((it, idx) => renderOrderItemRow(it, idx, true))}
                      </ul>
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-base-300">
                        {order.status === 'shipped' && (
                          <button
                            className="btn btn-success btn-sm gap-1"
                            disabled={confirmReceivedLoading}
                            onClick={() => setConfirmReceivedOrderId(order.id)}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            ได้รับของแล้ว
                          </button>
                        )}
                        {(order.status === 'shipped' || order.status === 'sold') && order.receiptUrl && (
                          <button className="btn btn-outline btn-sm gap-1" onClick={() => window.open(order.receiptUrl!, '_blank')}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                            </svg>
                            ดูใบเสร็จ
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Seller Orders */}
        <div className="rounded-2xl bg-base-100 border border-base-300 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-base-300 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-base-content">รายการที่ต้องจัดส่ง</h3>
              {sellerOrders.length > 0 && <p className="text-xs text-base-content/50">{sellerOrders.length} คำสั่ง</p>}
            </div>
          </div>

          <div className="p-6">
            {sellerOrdersLoading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : sellerOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="text-5xl">📤</div>
                <h4 className="font-semibold text-base-content/70">ไม่มีคำสั่งที่ต้องจัดส่ง</h4>
                <p className="text-sm text-base-content/40">เมื่อมีลูกค้าสั่งซื้อสินค้าของคุณ จะแสดงที่นี่</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sellerOrders.map((order) => (
                  <div key={order.id} className="rounded-xl border border-base-300 overflow-hidden">
                    <div className="px-4 py-3 bg-base-200/50 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {statusBadge(order.status)}
                        <span className="text-xs text-base-content/50">{formatOrderDate(order.createdAt)}</span>
                      </div>
                      <p className="font-bold text-sm text-base-content">{formatPrice(Number(order.totalAmount))}</p>
                    </div>
                    <div className="px-4 py-3 space-y-2">
                      {order.buyerName != null && (
                        <p className="text-sm"><span className="font-medium text-base-content/70">ผู้ซื้อ:</span> {order.buyerName || '-'}</p>
                      )}
                      {order.shippingAddress && (
                        <p className="text-sm text-base-content/60">
                          <span className="font-medium text-base-content/70">ที่อยู่จัดส่ง:</span><br />
                          <span style={{ whiteSpace: 'pre-wrap' }}>{order.shippingAddress}</span>
                        </p>
                      )}
                      {order.shippingPhone && (
                        <p className="text-sm text-base-content/60"><span className="font-medium text-base-content/70">เบอร์โทร:</span> {order.shippingPhone}</p>
                      )}
                      <ul className="space-y-1.5 pt-1 border-t border-base-300">
                        {order.items?.map((it, idx) => renderOrderItemRow(it, idx, false))}
                      </ul>
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-base-300">
                        {order.status === 'pending_shipment' && (
                          <button
                            className="btn btn-primary btn-sm gap-1"
                            onClick={() => { setConfirmShipmentOrderId(order.id); setReceiptFile(null); setShowReceiptModal(true); }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            ยืนยันการส่ง (แนบใบเสร็จ)
                          </button>
                        )}
                        {(order.status === 'shipped' || order.status === 'sold') && order.receiptUrl && (
                          <button className="btn btn-outline btn-sm gap-1" onClick={() => window.open(order.receiptUrl!, '_blank')}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                            </svg>
                            ดูใบเสร็จ
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Receipt Upload Modal */}
        <Modal show={showReceiptModal} onHide={() => { setShowReceiptModal(false); setConfirmShipmentOrderId(null); setReceiptFile(null); }}>
          <Modal.Header closeButton>
            <Modal.Title>ยืนยันการส่ง — แนบใบเสร็จ</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="form-control">
              <label className="label"><span className="label-text font-medium">เลือกรูปใบเสร็จ</span></label>
              <input
                type="file"
                accept="image/*"
                className="file-input file-input-bordered w-full"
                onChange={(e) => setReceiptFile((e.target as HTMLInputElement).files?.[0] || null)}
              />
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowReceiptModal(false); setConfirmShipmentOrderId(null); setReceiptFile(null); }}>
              ยกเลิก
            </button>
            <button
              className="btn btn-primary btn-sm gap-2"
              disabled={!receiptFile || !confirmShipmentOrderId || confirmShipmentLoading}
              onClick={async () => {
                if (!receiptFile || !confirmShipmentOrderId || !currentUser) return;
                setConfirmShipmentLoading(true);
                try {
                  const ext = receiptFile.name.split('.').pop() || 'jpg';
                  const fileName = `${currentUser.id}/receipts/${confirmShipmentOrderId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                  const { error } = await supabase.storage.from('posts').upload(fileName, receiptFile, { cacheControl: '3600', upsert: false });
                  if (error) throw error;
                  const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(fileName);
                  const result = await ordersAPI.confirmShipment(confirmShipmentOrderId, publicUrl);
                  if (result.success) {
                    toast.success(result.message);
                    setShowReceiptModal(false);
                    setConfirmShipmentOrderId(null);
                    setReceiptFile(null);
                    fetchSellerOrders();
                    fetchOrders();
                  } else {
                    toast.error(result.error);
                  }
                } catch (e: any) {
                  toast.error(e.message || 'อัปโหลดใบเสร็จไม่สำเร็จ');
                } finally {
                  setConfirmShipmentLoading(false);
                }
              }}
            >
              {confirmShipmentLoading ? (<><Spinner size="sm" /> กำลังอัปโหลด...</>) : 'ยืนยันการส่ง'}
            </button>
          </Modal.Footer>
        </Modal>

        {/* Confirm Received Modal */}
        <Modal show={!!confirmReceivedOrderId} onHide={() => { if (!confirmReceivedLoading) setConfirmReceivedOrderId(null); }}>
          <Modal.Header closeButton>
            <Modal.Title>ยืนยันการรับสินค้า</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p className="text-base-content/80">คุณได้รับสินค้าเรียบร้อยแล้วใช่หรือไม่?</p>
            <div className="flex gap-2 items-start p-3 mt-3 rounded-xl bg-warning/10 border border-warning/20">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5 text-warning">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <p className="text-xs text-warning">เมื่อกดยืนยันแล้ว จะไม่สามารถย้อนกลับได้ กรุณาตรวจสอบสินค้าให้เรียบร้อยก่อนกดยืนยัน</p>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmReceivedOrderId(null)} disabled={confirmReceivedLoading}>
              ยกเลิก
            </button>
            <button
              className="btn btn-success btn-sm gap-2"
              disabled={confirmReceivedLoading}
              onClick={async () => {
                if (!confirmReceivedOrderId) return;
                setConfirmReceivedLoading(true);
                try {
                  const result = await ordersAPI.confirmReceived(confirmReceivedOrderId);
                  if (result.success) {
                    toast.success(result.message);
                    setConfirmReceivedOrderId(null);
                    fetchOrders();
                  } else {
                    toast.error(result.error);
                  }
                } catch {
                  toast.error('เกิดข้อผิดพลาดในการยืนยัน');
                } finally {
                  setConfirmReceivedLoading(false);
                }
              }}
            >
              {confirmReceivedLoading ? (<><Spinner size="sm" /> กำลังดำเนินการ...</>) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  ยืนยันรับสินค้า
                </>
              )}
            </button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  };

  const renderMyPosts = (): JSX.Element => {
    const getPostStatusBadge = (post: Post) => {
      if (post.status === 'active') return <span className="badge badge-success badge-sm">เปิดขาย</span>;
      if (post.status === 'pending') {
        const label = post.postType === 'auction' && post.auctionStatus === 'won_pending_payment' ? 'รอการชำระเงิน' : 'รออนุมัติ';
        return <span className="badge badge-warning badge-sm">{label}</span>;
      }
      if (post.status === 'sold') return <span className="badge badge-info badge-sm">ขายแล้ว</span>;
      if (post.status === 'rejected') return <span className="badge badge-error badge-sm">ถูกปฏิเสธ</span>;
      if (post.status === 'inactive') return <span className="badge badge-neutral badge-sm">ปิดการขาย</span>;
      return <span className="badge badge-ghost badge-sm">ไม่ทราบสถานะ</span>;
    };

    return (
      <div className="rounded-2xl bg-base-100 border border-base-300 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-base-300 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-base-content">รายการของฉัน</h3>
              {myPosts.length > 0 && <p className="text-xs text-base-content/50">{myPosts.length} โพสต์</p>}
            </div>
          </div>
          <button className="btn btn-primary btn-sm gap-2" onClick={() => navigate('/create-post')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            สร้างโพส
          </button>
        </div>

        <div className="p-6">
          {myPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="text-5xl">📝</div>
              <h4 className="font-semibold text-base-content/70">ยังไม่มีโพสต์</h4>
              <p className="text-sm text-base-content/40 mb-2">เริ่มต้นสร้างโพสต์การ์ดของคุณ</p>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/create-post')}>+ สร้างโพสแรก</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myPosts.map((post) => (
                <div
                  key={post.id}
                  className="rounded-xl border border-base-300 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer bg-base-100"
                  onClick={() => navigate(`/post/${post.id}`)}
                >
                  <div className="h-44 overflow-hidden bg-base-200">
                    {post.images && post.images.length > 0 ? (
                      <img src={post.images[0]} alt={post.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-base-content/30 text-sm">ไม่มีรูปภาพ</div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-sm text-base-content line-clamp-1 mb-2">{post.title}</p>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-primary font-bold text-sm">
                        {post.postType === 'auction' ? `เริ่มต้น ${formatPrice(post.startingBid)}` : formatPrice(post.price)}
                      </span>
                      <span className="badge badge-ghost badge-sm">{post.category}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      {getPostStatusBadge(post)}
                      <p className="text-xs text-base-content/40">{formatDate(post.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const EyeIcon = ({ open }: { open: boolean }) => open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );

  return (
    <div className="min-h-screen bg-base-200/40">
      <div className="max-w-7xl mx-auto px-3 md:px-6 py-6">
        <div className="grid grid-cols-12 gap-4 md:gap-6">
          {/* Sidebar */}
          <div className="col-span-12 md:col-span-4 lg:col-span-3">
            <div className="sticky top-4">
              <ProfileSidebar activeTab={activeTab} onTabChange={(tabId: string) => setActiveTab(tabId as ActiveTab)} />
            </div>
          </div>

          {/* Main Content */}
          <div className="col-span-12 md:col-span-8 lg:col-span-9">
            <div className="space-y-4">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>

      {/* Password Update Modal */}
      <Modal show={showPasswordModal} onHide={() => setShowPasswordModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>เปลี่ยนรหัสผ่าน</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            {[
              { label: 'รหัสผ่านปัจจุบัน', name: 'currentPassword' as const, show: showCurrentPassword, toggle: () => setShowCurrentPassword(p => !p) },
              { label: 'รหัสผ่านใหม่', name: 'newPassword' as const, show: showNewPassword, toggle: () => setShowNewPassword(p => !p) },
              { label: 'ยืนยันรหัสผ่านใหม่', name: 'confirmPassword' as const, show: showConfirmNewPassword, toggle: () => setShowConfirmNewPassword(p => !p) },
            ].map(({ label, name, show, toggle }) => (
              <div key={name} className="form-control">
                <label className="label pb-1"><span className="label-text font-medium">{label}</span></label>
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    name={name}
                    value={passwordData[name]}
                    onChange={handlePasswordChange}
                    required
                    className="input input-bordered w-full pr-12"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content transition-colors"
                    onClick={toggle}
                  >
                    <EyeIcon open={show} />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button type="submit" className="btn btn-primary btn-sm flex-1 gap-2" disabled={loading}>
                {loading ? <><Spinner size="sm" /> กำลังอัปเดต...</> : 'อัปเดตรหัสผ่าน'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPasswordModal(false)}>ยกเลิก</button>
            </div>
          </form>
        </Modal.Body>
      </Modal>

      <SellerApplicationModal
        show={showSellerApplicationModal}
        onHide={() => setShowSellerApplicationModal(false)}
      />
    </div>
  );
};

export default Profile;


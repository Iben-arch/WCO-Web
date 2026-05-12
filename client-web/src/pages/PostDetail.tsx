import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import IndividualCardsGrid from '../components/common/IndividualCardsGrid';
import AdminRejectModal from '../components/common/AdminRejectModal';
import { postsAPI, authAPI, auctionAPI, chatAPI, adminAPI } from '../api/api';
import axios from '../utils/axiosInterceptor';
import { toast } from 'react-toastify';
import '../styles/auction-bids.css';
import '../styles/admin-dashboard.css';
import { Post, Message, AuctionBid, DetectedCard, FirestoreTimestamp, IndividualCardItem, AiScreeningResult, AiSourceWarningLevel, AiManipulationWarningLevel, AiGeneratedWarningLevel } from '../types';
import { recordCategoryInterest } from '../utils/categoryInterest';
import { supabase } from '../config/supabase';
import { canSellCards } from '../utils/roles';

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

const Container: React.FC<{ children: React.ReactNode; fluid?: boolean; className?: string }> = ({ children, fluid, className }) => (
  <div className={cx(fluid ? 'w-full' : 'container', className)}>{children}</div>
);

const Row: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cx('grid grid-cols-12 gap-4', className)}>{children}</div>
);

const Col: React.FC<{ children: React.ReactNode; className?: string; lg?: number; md?: number; sm?: number; xs?: number }> = ({ children, className, lg, md, sm, xs }) => {
  const mapLg: Record<number, string> = { 1: 'lg:col-span-1', 2: 'lg:col-span-2', 3: 'lg:col-span-3', 4: 'lg:col-span-4', 5: 'lg:col-span-5', 6: 'lg:col-span-6', 7: 'lg:col-span-7', 8: 'lg:col-span-8', 9: 'lg:col-span-9', 10: 'lg:col-span-10', 11: 'lg:col-span-11', 12: 'lg:col-span-12' };
  const mapMd: Record<number, string> = { 1: 'md:col-span-1', 2: 'md:col-span-2', 3: 'md:col-span-3', 4: 'md:col-span-4', 5: 'md:col-span-5', 6: 'md:col-span-6', 7: 'md:col-span-7', 8: 'md:col-span-8', 9: 'md:col-span-9', 10: 'md:col-span-10', 11: 'md:col-span-11', 12: 'md:col-span-12' };
  const mapSm: Record<number, string> = { 1: 'sm:col-span-1', 2: 'sm:col-span-2', 3: 'sm:col-span-3', 4: 'sm:col-span-4', 5: 'sm:col-span-5', 6: 'sm:col-span-6', 7: 'sm:col-span-7', 8: 'sm:col-span-8', 9: 'sm:col-span-9', 10: 'sm:col-span-10', 11: 'sm:col-span-11', 12: 'sm:col-span-12' };
  const mapXs: Record<number, string> = { 1: 'col-span-1', 2: 'col-span-2', 3: 'col-span-3', 4: 'col-span-4', 5: 'col-span-5', 6: 'col-span-6', 7: 'col-span-7', 8: 'col-span-8', 9: 'col-span-9', 10: 'col-span-10', 11: 'col-span-11', 12: 'col-span-12' };
  const widthClass = (lg && mapLg[lg]) || (md && mapMd[md]) || (sm && mapSm[sm]) || (xs && mapXs[xs]) || 'col-span-12';
  return <div className={cx('col-span-12', widthClass, className)}>{children}</div>;
};

const Button: React.FC<any> = ({ as, to, variant, size, className, children, ...props }) => {
  const base = cx(
    'btn',
    size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '',
    variant === 'primary' ? 'btn-primary' : '',
    variant === 'secondary' ? 'btn-secondary' : '',
    variant === 'success' ? 'btn-success' : '',
    variant === 'danger' ? 'btn-error' : '',
    variant === 'warning' ? 'btn-warning' : '',
    variant === 'info' ? 'btn-info' : '',
    variant === 'outline-secondary' ? 'btn-outline' : '',
    variant === 'outline-primary' ? 'btn-outline btn-primary' : '',
    variant === 'outline-danger' ? 'btn-outline btn-error' : '',
    variant === 'link' ? 'btn-link' : '',
    className
  );
  if (as) {
    const AsComp = as;
    return <AsComp to={to} className={base} {...props}>{children}</AsComp>;
  }
  return <button className={base} {...props}>{children}</button>;
};

const Alert: React.FC<any> = ({ variant, className, children, ...props }) => {
  let icon = null;
  if (variant === 'danger') {
    icon = <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
  } else if (variant === 'warning') {
    icon = <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
  } else if (variant === 'success') {
    icon = <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
  } else if (variant === 'info') {
    icon = <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
  }

  return (
    <div className={cx('alert', variant === 'danger' ? 'alert-error' : '', variant === 'warning' ? 'alert-warning' : '', variant === 'info' ? 'alert-info' : '', variant === 'success' ? 'alert-success' : '', className)} {...props}>
      {icon}
      <div className="w-full">{children}</div>
    </div>
  );
};

const Spinner: React.FC<any> = ({ className }) => <span className={cx('loading loading-spinner loading-sm', className)} />;
const Badge: React.FC<any> = ({ bg, text, className, children }) => {
  const bgClass = bg === 'danger' || bg === 'error' ? 'badge-error' :
                  bg === 'warning' ? 'badge-warning' :
                  bg === 'success' ? 'badge-success' :
                  bg === 'info' ? 'badge-info' :
                  bg === 'primary' ? 'badge-primary' :
                  bg === 'secondary' ? 'badge-secondary' :
                  bg === 'light' ? 'bg-base-200 text-base-content border border-base-300' : '';
  const textClass = text === 'dark' ? 'text-base-content' : '';
  return <span className={cx('badge', bgClass, textClass, className)}>{children}</span>;
};

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
  const [sourceScreening, setSourceScreening] = useState<AiScreeningResult | null>(null);
  const [manipulationScreening, setManipulationScreening] = useState<AiScreeningResult | null>(null);
  const [aiScreening, setAiScreening] = useState<AiScreeningResult | null>(null);
  const [sourceAnalyzing, setSourceAnalyzing] = useState<boolean>(false);
  const [manipulationAnalyzing, setManipulationAnalyzing] = useState<boolean>(false);
  const [aiAnalyzing, setAiAnalyzing] = useState<boolean>(false);
  const manipApiCacheRef = useRef<AiScreeningResult | null>(null);
  const [sellerContactNote, setSellerContactNote] = useState<string>('');

  const [similarPosts, setSimilarPosts] = useState<Post[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState<boolean>(false);
  const [showResubmitModal, setShowResubmitModal] = useState<boolean>(false);
  const [resubmitLoading, setResubmitLoading] = useState<boolean>(false);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [rejecting, setRejecting] = useState<boolean>(false);
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
      postsAPI.getRelatedPostsForDetail(post.id, 8)
        .then((posts) => setSimilarPosts(posts ?? []))
        .catch(() => setSimilarPosts([]))
        .finally(() => setLoadingSimilar(false));
    }
  }, [post?.id]);

  useEffect(() => {
    const fetchSellerContactNote = async () => {
      if (!post?.sellerId) {
        setSellerContactNote('');
        return;
      }
      try {
        const response = await axios.get(`/api/auth/seller/${post.sellerId}`);
        const note = response?.data?.sellerContactNote;
        setSellerContactNote(typeof note === 'string' ? note.trim() : '');
      } catch (err) {
        console.error('Error fetching seller contact note:', err);
        setSellerContactNote('');
      }
    };

    fetchSellerContactNote();
  }, [post?.sellerId]);

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
      const result = await auctionAPI.buyNow(id!);
      if (result.success) {
        toast.success(result.message || 'ซื้อเลยสำเร็จ! กรุณาชำระเงินในตะกร้า');
        fetchPost();
      } else {
        toast.error(result.error || 'ไม่สามารถซื้อเลยได้');
      }
    } catch (error: any) {
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

  const handleApprovePost = async (): Promise<void> => {
    if (!post?.id) return;
    try {
      await adminAPI.approvePost(post.id);
      toast.success('อนุมัติโพสต์ส่งขายสำเร็จ');
      fetchPost();
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการอนุมัติ: ' + (err?.response?.data?.message || err?.message || 'Unknown error'));
    }
  };

  const handleRejectPost = async (): Promise<void> => {
    if (!post?.id) return;
    setRejecting(true);
    try {
      await adminAPI.rejectPost(post.id, rejectReason);
      toast.success('ปฏิเสธโพสต์สำเร็จ');
      setShowRejectModal(false);
      setRejectReason('');
      fetchPost();
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการปฏิเสธ: ' + (err?.response?.data?.message || err?.message || 'Unknown error'));
    } finally {
      setRejecting(false);
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
          <span className="loading loading-spinner post-detail-spinner" role="status" aria-label="กำลังโหลด" />
          <p className="mt-3 text-muted">กำลังโหลดรายละเอียดโพสต์...</p>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="post-detail-error">
        <Container>
          <div className="pd-error-card">
            <div className="pd-error-icon"><i className="fas fa-search" aria-hidden /></div>
            <h4 className="pd-error-title">ไม่พบโพสต์ที่ต้องการ</h4>
            <p className="pd-error-desc">{error || 'โพสต์นี้อาจถูกลบหรือไม่พบในระบบ'}</p>
            <div className="pd-error-actions">
              <Button as={Link as any} to="/" variant="primary">
                <i className="fas fa-home me-2" aria-hidden />กลับหน้าแรก
              </Button>
              <Button variant="outline-secondary" onClick={() => window.history.back()}>
                <i className="fas fa-arrow-left me-2" aria-hidden />กลับ
              </Button>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  const isOwner = currentUser && currentUser.id === post.sellerId;
  const isAdminViewer = !!userProfile?.isAdmin;
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

  const getRiskVariant = (risk: number): 'success' | 'warning' | 'danger' => {
    if (risk >= 65) return 'danger';
    if (risk >= 35) return 'warning';
    return 'success';
  };

  const sourceLevelLabel = (level?: AiSourceWarningLevel): { variant: 'danger' | 'warning' | 'success' | 'secondary'; text: string } => {
    switch (level) {
      case 'danger':
        return { variant: 'danger', text: 'อันตราย — ควรตรวจสอบเพิ่ม' };
      case 'warning':
        return { variant: 'warning', text: 'ระวัง — พิจารณาตรวจสอบเพิ่มเติม' };
      case 'safe':
        return { variant: 'success', text: 'ปลอดภัย — สัญญาณต่ำ' };
      default:
        return { variant: 'secondary', text: 'ไม่สามารถประเมินระดับได้' };
    }
  };

  const manipulationLevelLabel = (level?: AiManipulationWarningLevel | null): { variant: 'danger' | 'warning' | 'success'; text: string } => {
    switch (level) {
      case 'danger':
        return { variant: 'danger', text: 'อันตราย — ควรตรวจสอบเพิ่ม' };
      case 'warning':
        return { variant: 'warning', text: 'ระวัง — พิจารณาตรวจสอบเพิ่มเติม' };
      case 'safe':
        return { variant: 'success', text: 'ปลอดภัย — สัญญาณต่ำ' };
      default:
        return { variant: 'success', text: 'ปลอดภัย' };
    }
  };

  const aiGeneratedLevelLabel = (level?: AiGeneratedWarningLevel | null): { variant: 'danger' | 'warning' | 'success'; text: string } => {
    switch (level) {
      case 'danger':
        return { variant: 'danger', text: 'อันตราย — อาจสร้างจาก AI' };
      case 'warning':
        return { variant: 'warning', text: 'ระวัง — มีสัญญาณ AI บางส่วน' };
      case 'safe':
        return { variant: 'success', text: 'ปลอดภัย — ไม่พบสัญญาณ AI' };
      default:
        return { variant: 'success', text: 'ปลอดภัย' };
    }
  };

  const analyzeSource = async (): Promise<void> => {
    if (!post?.id) return;
    try {
      setSourceAnalyzing(true);
      const data = await adminAPI.getPostSourceScreening(post.id);
      setSourceScreening(data);
    } catch (err) {
      console.error(err);
      toast.error('วิเคราะห์ภาพจากแหล่งอื่นไม่สำเร็จ');
    } finally {
      setSourceAnalyzing(false);
    }
  };

  const fetchManipulationApi = async (): Promise<AiScreeningResult> => {
    if (manipApiCacheRef.current) return manipApiCacheRef.current;
    const data = await adminAPI.getPostManipulationScreening(post!.id);
    manipApiCacheRef.current = data;
    return data;
  };

  const analyzeManipulation = async (): Promise<void> => {
    if (!post?.id) return;
    try {
      setManipulationAnalyzing(true);
      const data = await fetchManipulationApi();
      setManipulationScreening(data);
    } catch (err) {
      console.error(err);
      toast.error('วิเคราะห์ภาพตัดต่อไม่สำเร็จ');
    } finally {
      setManipulationAnalyzing(false);
    }
  };

  const analyzeAi = async (): Promise<void> => {
    if (!post?.id) return;
    try {
      setAiAnalyzing(true);
      // ยิงคนละ endpoint กับ analyzeManipulation — ไม่ share cache
      const data = await adminAPI.getPostAiGeneratedScreening(post.id);
      setAiScreening(data);
    } catch (err) {
      console.error(err);
      toast.error('วิเคราะห์ภาพ AI ไม่สำเร็จ');
    } finally {
      setAiAnalyzing(false);
    }
  };

  const mapSourceUnavailableReason = (reason?: string | null): string => {
    if (!reason) return 'unknown';
    const r = reason.toLowerCase();
    if (r.includes('missing-api-key')) return 'ยังไม่ได้ตั้งค่า API key';
    if (r.includes('http-429')) return 'เกินโควต้า/โดนจำกัดการเรียก';
    if (r.includes('http-401') || r.includes('http-403')) return 'API key ไม่ถูกต้องหรือไม่มีสิทธิ์';
    if (r.includes('http-5')) return 'ผู้ให้บริการภายนอกขัดข้องชั่วคราว';
    if (r.includes('exception')) return 'เชื่อมต่อผู้ให้บริการไม่สำเร็จ';
    if (r.includes('provider-not-supported')) return 'provider ที่ตั้งค่ายังไม่รองรับ';
    return reason;
  };

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
                    <span className="mercari-zoom-hint"><i className="fas fa-search-plus" aria-hidden style={{ marginRight: '0.3rem' }} />คลิกดูภาพขยาย</span>
                    {post.images.length > 1 && (
                      <>
                        <button type="button" className="image-nav-btn prev-btn" onClick={(e) => { e.stopPropagation(); prevImage(); }} aria-label="รูปก่อนหน้า">‹</button>
                        <button type="button" className="image-nav-btn next-btn" onClick={(e) => { e.stopPropagation(); nextImage(); }} aria-label="รูปถัดไป">›</button>
                        <span className="mercari-image-counter">{currentImageIndex + 1} / {post.images.length}</span>
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
                <h6><i className="fas fa-align-left me-2" aria-hidden style={{ opacity: 0.6 }} />รายละเอียดสินค้า</h6>
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
                  <h6><i className="fas fa-gavel me-2" aria-hidden style={{ opacity: 0.6 }} />รายการผู้ประมูล</h6>
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
                  {isAdminViewer && (
                    <div className="pd-admin-tools mb-3">
                      <div className="pd-admin-tools-header-plain">
                        <i className="fas fa-shield-alt" aria-hidden />
                        <span>เครื่องมือแอดมิน (AI)</span>
                      </div>
                      <div className="pd-admin-tools-actions">
                      <div className="pd-admin-tools-actions">
                        {/* Card 1: วิเคราะห์แหล่งที่มา */}
                        <div className={`pd-ai-card${sourceScreening ? ' pd-ai-card--' + ((() => { const lv = sourceLevelLabel(sourceScreening.sourceWarningLevel); const getDomain = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } }; const hasDHashConfirmed = (sourceScreening.dHashConfirmedLinks ?? []).length > 0; const hasMarketplaceHits = (sourceScreening.allExternalMatchLinks ?? []).length > 0; return hasDHashConfirmed ? lv.variant : hasMarketplaceHits ? 'warning' : 'success'; })()) : ''}`}>
                          <button
                            type="button"
                            id="btn-analyze-source"
                            className={`pd-ai-btn pd-ai-btn--source${sourceAnalyzing ? ' pd-ai-btn--loading' : ''}${sourceScreening ? ' pd-ai-btn--done' : ''}`}
                            onClick={analyzeSource}
                            disabled={sourceAnalyzing}
                            aria-busy={sourceAnalyzing}
                            title="ตรวจสอบว่าภาพนี้ถูกนำมาจากเว็บอื่นหรือไม่ โดยใช้ Google Lens + dHash"
                          >
                            <span className="pd-ai-btn-icon">
                              {sourceAnalyzing ? <span className="pd-ai-spinner" /> : sourceScreening ? <i className="fas fa-check-circle" aria-hidden /> : <i className="fas fa-search" aria-hidden />}
                            </span>
                            <span className="pd-ai-btn-label">{sourceAnalyzing ? 'กำลังวิเคราะห์...' : 'วิเคราะห์ภาพจากแหล่งอื่น'}</span>
                          </button>
                          {sourceScreening && (() => {
                            const lv = sourceLevelLabel(sourceScreening.sourceWarningLevel);
                            const getDomain = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };
                            const getUrlScore = (u: string) => { const low = u.toLowerCase(); if (low.includes('/search/') || low.includes('search?')) return -1; if (low.includes('/item/') || low.includes('/itm/') || low.includes('/auction/')) return 1; return 0; };
                            const dHashLinks = [...(sourceScreening.dHashConfirmedLinks ?? [])].sort((a,b) => getUrlScore(b)-getUrlScore(a) || b.length-a.length).filter((l,i,s) => i===s.findIndex(x=>getDomain(x)===getDomain(l)));
                            const hasDHashConfirmed = dHashLinks.length > 0;
                            const allMarketplaceLinks = [...(sourceScreening.allExternalMatchLinks ?? [])].sort((a,b) => getUrlScore(b)-getUrlScore(a) || b.length-a.length).filter((l,i,s) => i===s.findIndex(x=>getDomain(x)===getDomain(l)));
                            const hasMarketplaceHits = allMarketplaceLinks.length > 0;
                            const dHashPct = sourceScreening.maxDHashSimilarityPct;
                            const clipPct = sourceScreening.maxCompositionSimilarityPct;
                            const rv = hasDHashConfirmed ? lv.variant : hasMarketplaceHits ? 'warning' : 'success';
                            return (
                              <div className="pd-ai-card-result">
                                <div className="pd-ai-result-header">
                                  <span className="pd-ai-result-icon">{rv==='danger'?'🚨':rv==='warning'?'⚠️':'✅'}</span>
                                  <span className="pd-ai-result-title">
                                    <span className="pd-ai-result-subtitle">
                                      {sourceScreening.sourceAnalysisAvailable===false ? 'วิเคราะห์ไม่ได้' : hasDHashConfirmed ? 'พบภาพนี้ในเว็บอื่น' : hasMarketplaceHits ? 'พบการ์ดชนิดเดียวกัน แต่ภาพต่างกัน' : 'ไม่พบภาพนี้ในเว็บอื่น'}
                                    </span>
                                  </span>
                                  {/* removed risk badge for source analysis */}
                                </div>
                                {sourceScreening.sourceAnalysisAvailable===false ? (
                                  <p className="pd-ai-result-detail pd-ai-result-detail--error"><i className="fas fa-exclamation-circle me-1" aria-hidden /> {mapSourceUnavailableReason(sourceScreening.sourceUnavailableReason)}</p>
                                ) : (hasDHashConfirmed||hasMarketplaceHits) && (
                                  <details className="pd-ai-result-details">
                                    <summary>ดูรายละเอียด ({hasDHashConfirmed?`${dHashLinks.length} แหล่งที่ยืนยัน`:`${allMarketplaceLinks.length} แหล่งอ้างอิง`})</summary>
                                    <div className="pd-ai-result-detail">
                                      <ul style={{listStyle:'none',padding:0,margin:0}}>
                                        {(hasDHashConfirmed?dHashLinks:allMarketplaceLinks).map((link,i)=>(
                                          <li key={i} className="mb-1"><a href={link} target="_blank" rel="noopener noreferrer" style={{wordBreak:'break-all',fontSize:'0.78rem'}}>🔗 {link}</a>
                                          {hasDHashConfirmed && /mercari|auctions\.yahoo\.co\.jp|magi/i.test(getDomain(link)) && <span className="badge bg-danger ms-1" style={{fontSize:'0.6rem'}}>marketplace</span>}
                                          </li>
                                        ))}
                                      </ul>
                                      <div className="pd-ai-score-row">
                                        {dHashPct!=null && <span>dHash: <strong>{dHashPct.toFixed(0)}%</strong> {dHashPct>=88?'✓':dHashPct>=75?'~':'✗'}</span>}
                                        {clipPct!=null && <span>CLIP: <strong>{clipPct.toFixed(0)}%</strong></span>}
                                      </div>
                                    </div>
                                  </details>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Card 2: ตรวจภาพตัดต่อ */}
                        <div className={`pd-ai-card${manipulationScreening ? ' pd-ai-card--' + manipulationLevelLabel(manipulationScreening.manipulationWarningLevel).variant : ''}`}>
                          <button
                            type="button"
                            id="btn-analyze-manipulation"
                            className={`pd-ai-btn pd-ai-btn--manipulation${manipulationAnalyzing ? ' pd-ai-btn--loading' : ''}${manipulationScreening ? ' pd-ai-btn--done' : ''}`}
                            onClick={analyzeManipulation}
                            disabled={manipulationAnalyzing}
                            aria-busy={manipulationAnalyzing}
                            title="วิเคราะห์ว่าภาพถูกแต่งหรือตัดต่อมาหรือไม่ โดยใช้ ELA / Chroma / FFT"
                          >
                            <span className="pd-ai-btn-icon">
                              {manipulationAnalyzing ? <span className="pd-ai-spinner" /> : manipulationScreening ? <i className="fas fa-check-circle" aria-hidden /> : <i className="fas fa-cut" aria-hidden />}
                            </span>
                            <span className="pd-ai-btn-label">{manipulationAnalyzing ? 'กำลังตรวจสอบ...' : 'ตรวจภาพตัดต่อ'}</span>
                          </button>
                          {manipulationScreening && (() => {
                            const ml = manipulationLevelLabel(manipulationScreening.manipulationWarningLevel);
                            return (
                              <div className="pd-ai-card-result">
                                <div className="pd-ai-result-header">
                                  <span className="pd-ai-result-icon">{ml.variant==='danger'?'🚨':ml.variant==='warning'?'⚠️':'✅'}</span>
                                  <span className="pd-ai-result-title"><span className="pd-ai-result-subtitle">{ml.text}</span></span>
                                  <span className={`pd-ai-risk-badge pd-ai-risk-badge--${getRiskVariant(manipulationScreening.manipulationRiskPct)}`}>{manipulationScreening.manipulationRiskPct.toFixed(0)}%</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Card 3: ตรวจภาพ AI */}
                        <div className={`pd-ai-card${aiScreening ? ' pd-ai-card--' + aiGeneratedLevelLabel(aiScreening.aiGeneratedWarningLevel).variant : ''}`}>
                          <button
                            type="button"
                            id="btn-analyze-ai"
                            className={`pd-ai-btn pd-ai-btn--ai${aiAnalyzing ? ' pd-ai-btn--loading' : ''}${aiScreening ? ' pd-ai-btn--done' : ''}`}
                            onClick={analyzeAi}
                            disabled={aiAnalyzing}
                            aria-busy={aiAnalyzing}
                            title="ตรวจสอบว่าภาพสร้างจาก AI (เช่น Midjourney, DALL-E) หรือไม่"
                          >
                            <span className="pd-ai-btn-icon">
                              {aiAnalyzing ? <span className="pd-ai-spinner" /> : aiScreening ? <i className="fas fa-check-circle" aria-hidden /> : <i className="fas fa-robot" aria-hidden />}
                            </span>
                            <span className="pd-ai-btn-label">{aiAnalyzing ? 'กำลังตรวจสอบ...' : 'ตรวจภาพ AI'}</span>
                          </button>
                          {aiScreening && (() => {
                            const al = aiGeneratedLevelLabel(aiScreening.aiGeneratedWarningLevel);
                            return (
                              <div className="pd-ai-card-result">
                                <div className="pd-ai-result-header">
                                  <span className="pd-ai-result-icon">{al.variant==='danger'?'🚨':al.variant==='warning'?'⚠️':'✅'}</span>
                                  <span className="pd-ai-result-title"><span className="pd-ai-result-subtitle">{al.text}</span></span>
                                  <span className={`pd-ai-risk-badge pd-ai-risk-badge--${getRiskVariant(aiScreening.aiGeneratedRiskPct)}`}>{aiScreening.aiGeneratedRiskPct.toFixed(0)}%</span>
                                </div>
                                <p className="pd-ai-result-detail" style={{fontSize:'0.72rem',color:'#64748b'}}>วิเคราะห์จากความเรียบของภาพ / การขาดสัญญาณ noise</p>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      </div>

                    </div>
                  )}

                  {isAdminViewer && post.status === 'pending' && (
                    <div className="admin-actions-block mb-3 p-3 border rounded shadow-sm" style={{ backgroundColor: '#f8f9fa' }}>
                      <h6 className="text-primary mb-3"><i className="fas fa-shield-alt me-2" aria-hidden="true" />สำหรับผู้ดูแลระบบ</h6>
                      <div className="d-flex" style={{ gap: '10px' }}>
                        <button
                          type="button"
                          className="btn btn-success flex-grow-1"
                          onClick={handleApprovePost}
                        >
                          <i className="fas fa-check me-2" aria-hidden="true" /> อนุมัติโพสต์
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger flex-grow-1"
                          onClick={() => setShowRejectModal(true)}
                        >
                          <i className="fas fa-times me-2" aria-hidden="true" /> ปฏิเสธโพสต์
                        </button>
                      </div>
                    </div>
                  )}

                  {!currentUser ? (
                    <div className="pd-contact-note">
                      <div className="pd-contact-note-header">
                        <i className="fas fa-lock" aria-hidden />
                        ต้องเข้าสู่ระบบ
                      </div>
                      <div className="pd-contact-note-body">
                        <Link to="/login">เข้าสู่ระบบ</Link> เพื่อซื้อและดูช่องทางติดต่อผู้ขาย
                      </div>
                    </div>
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
                          <div className="pd-contact-note">
                            <div className="pd-contact-note-header">
                              <i className="fas fa-comment-dots" aria-hidden />
                              ช่องทางติดต่อผู้ขาย
                            </div>
                            <div className="pd-contact-note-body">
                              {sellerContactNote || <span style={{ opacity: 0.6 }}>ผู้ขายยังไม่ได้แนบช่องทางติดต่อ</span>}
                            </div>
                          </div>
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
                  <div className="mercari-seller-avatar">
                    <i className="fas fa-user" aria-hidden />
                  </div>
                  <div className="mercari-seller-info">
                    <div className="mercari-seller-label">ผู้ขาย</div>
                    <div className="mercari-seller-name">{post.sellerName}</div>
                    <button
                      type="button"
                      className="btn btn-link p-0 mercari-seller-link"
                      onClick={() => navigate(`/seller/${post.sellerId}`)}
                    >
                      <i className="fas fa-store me-1" aria-hidden />ดูร้านค้า
                    </button>
                  </div>
                </div>
              </div>
            </Col>
          </Row>

          {/* Related posts: CLIP similarity + same category (API แยกจากค้นหาด้วยรูป) */}
          {(loadingSimilar || similarPosts.length > 0) && (
            <div className="similar-cards-section mt-5 pt-4 border-top">
              <div className="pd-similar-header mb-3">
                <h5 className="similar-cards-title mb-1">
                  <i className="fas fa-magic similar-cards-icon" aria-hidden /> โพสต์ที่เกี่ยวข้อง
                </h5>
                <p className="text-muted small mb-0">ค้นจากภาพคล้ายและหมวดเดียวกัน</p>
              </div>
              {loadingSimilar ? (
                <div className="d-flex align-items-center py-4" style={{ gap: '0.6rem' }}>
                  <span className="loading loading-spinner loading-sm" style={{ color: 'var(--primary)' }} />
                  <span className="text-muted" style={{ fontSize: '0.875rem' }}>กำลังโหลด...</span>
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
        {showResubmitModal && (
          <div
            className="fixed inset-0 z-[9999] bg-black/55 flex items-center justify-center p-4"
            onClick={() => {
              resubmitImagePreviews.forEach((u) => URL.revokeObjectURL(u));
              setResubmitImages([]);
              setResubmitImagePreviews([]);
              setShowResubmitModal(false);
            }}
          >
            <div className="card bg-white w-full max-w-3xl max-h-[92vh] shadow-2xl border border-slate-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 bg-white border-b border-base-300 flex items-center justify-between sticky top-0 z-10">
                <h3 className="font-bold text-lg m-0">📝 แก้ไข & ยื่นขออนุมัติใหม่</h3>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-circle"
                  onClick={() => {
                    resubmitImagePreviews.forEach((u) => URL.revokeObjectURL(u));
                    setResubmitImages([]);
                    setResubmitImagePreviews([]);
                    setShowResubmitModal(false);
                  }}
                >
                  ✕
                </button>
              </div>
              <div className="px-6 py-4 bg-white overflow-y-auto max-h-[calc(92vh-148px)]">
            <Alert variant="warning" className="mb-4 border border-amber-300 bg-amber-50 text-amber-900">
              <strong className="block mb-1">โพสต์นี้ถูกปฏิเสธแล้ว</strong>
              คุณสามารถแก้ไขรายละเอียดและยื่นขออนุมัติใหม่ได้
            </Alert>

            <div className="mb-3">
              <label className="label-text font-medium">ชื่อโพสต์</label>
              <input
                className="input input-bordered w-full"
                type="text"
                value={resubmitForm.title}
                onChange={(e) => setResubmitForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="mb-3">
              <label className="label-text font-medium">คำอธิบาย</label>
              <textarea
                className="textarea textarea-bordered w-full"
                rows={4}
                value={resubmitForm.description}
                onChange={(e) => setResubmitForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="mb-3">
              <label className="label-text font-medium">หมวดหมู่</label>
              <input
                className="input input-bordered w-full"
                type="text"
                value={resubmitForm.category}
                onChange={(e) => setResubmitForm((prev) => ({ ...prev, category: e.target.value }))}
              />
            </div>

            <div className="mb-3">
              <label className="label-text font-medium">รูปภาพใหม่ (ไม่เลือก = ใช้รูปเดิม)</label>
              <input
                className="file-input file-input-bordered w-full"
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
              <small className="text-base-content/60 block mt-1">
                เลือกได้สูงสุด 5 รูป
              </small>

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
            </div>

            {post?.postType === 'sale' && post.saleType === 'deck' && (
              <div className="mb-1">
                <label className="label-text font-medium">ราคา</label>
                <input
                  className="input input-bordered w-full"
                  type="number"
                  min="0"
                  step="0.01"
                  value={resubmitForm.price}
                  onChange={(e) => setResubmitForm((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="กรอกตัวเลข"
                />
              </div>
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
                              <input
                                className="input input-bordered w-full"
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
                              <input
                                className="input input-bordered w-full"
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
              </div>
              <div className="px-6 py-4 bg-white border-t border-base-300 flex justify-end gap-2 sticky bottom-0 z-10">
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
              </div>
            </div>
          </div>
        )}

        {/* Sold Confirmation Modal */}
        {showSoldModal && (
          <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowSoldModal(false)}>
            <div className="card bg-base-100 w-full max-w-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-base-300 flex items-center justify-between">
                <h3 className="font-bold text-lg m-0">
              {post.postType === 'auction' ? '✅ ยืนยันการจบการประมูล' : '✅ ยืนยันการขาย'}
                </h3>
                <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowSoldModal(false)}>✕</button>
              </div>
              <div className="px-6 py-4">
            <p>
              {post.postType === 'auction'
                ? `คุณต้องการจบการประมูลของโพสต์ "${post.title}" หรือไม่?`
                : `คุณต้องการทำเครื่องหมายโพสต์ "${post.title}" เป็นขายแล้วหรือไม่?`}
            </p>
            <Alert variant="warning">
              ⚠️ การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </Alert>
              </div>
              <div className="px-6 py-4 border-t border-base-300 flex justify-end gap-2">
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
              </div>
            </div>
          </div>
        )}

        {/* Bid Modal */}
        {showBidModal && (
          <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setShowBidModal(false); setBidCardId(undefined); setBidAmount(''); }}>
            <div className="card bg-base-100 w-full max-w-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-base-300 flex items-center justify-between">
                <h3 className="font-bold text-lg m-0">🔨 ประมูล - {post?.title}</h3>
                <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={() => { setShowBidModal(false); setBidCardId(undefined); setBidAmount(''); }}>✕</button>
              </div>
              <div className="px-6 py-4">
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
            
            <div className="mb-3">
              <label className="label-text font-medium">จำนวนเงินประมูล (บาท) *</label>
              <input
                className="input input-bordered w-full bid-input"
                type="number"
                placeholder={`ขั้นต่ำ ${formatPrice((post?.currentBid || post?.startingBid) + 1)}`}
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                min={(post?.currentBid || post?.startingBid) + 1}
                step="1"
              />
              <small className="text-base-content/60">
                จำนวนเงินประมูลต้องมากกว่า {formatPrice(bidCardId ? bidMinAmount : (post?.currentBid || post?.startingBid || 0))}
              </small>
            </div>
            
            <Alert variant="warning">
              ⚠️ <strong>ข้อควรระวัง:</strong> หลังจากประมูลแล้ว คุณจะไม่สามารถแก้ไขหรือยกเลิกการประมูลได้
            </Alert>
            
            <Alert variant="info">
              💡 <strong>คำแนะนำ:</strong> ตรวจสอบราคาและเวลาสิ้นสุดการประมูลให้ดีก่อนประมูล
            </Alert>
              </div>
              <div className="px-6 py-4 border-t border-base-300 flex justify-end gap-2">
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
              </div>
            </div>
          </div>
        )}

        <AdminRejectModal
          show={showRejectModal}
          onHide={() => { setShowRejectModal(false); setRejectReason(''); }}
          reason={rejectReason}
          onReasonChange={setRejectReason}
          onConfirm={handleRejectPost}
          loading={rejecting}
        />

      </Container>
    </div>
  );
};

export default PostDetail;

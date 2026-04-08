import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { postsAPI, authAPI } from '../api/api';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { getCategoryInterestScores, rankPostsByCategoryInterest, recordCategoryInterest } from '../utils/categoryInterest';
import { Post, SortBy, Category, FirestoreTimestamp } from '../types';
import { canSellCards } from '../utils/roles';
import SellerApplicationModal from '../components/seller/SellerApplicationModal';

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
const MOBILE_CATEGORY_LIMIT = 8;

const Home: React.FC = () => {
  const { currentUser, profile, userProfile } = useAuth();
  const navigate = useNavigate();
  const { addToCart, isInCart, cartItems } = useCart();
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
  const [imageSearchMode, setImageSearchMode] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [showSellerApplicationModal, setShowSellerApplicationModal] = useState<boolean>(false);
  const [now, setNow] = useState(() => new Date());

  const sellRole = profile?.role ?? userProfile?.role;
  const userCanSell = canSellCards(sellRole);
  const mobileTopCategories = (() => {
    const categoryInterestScores = getCategoryInterestScores(currentUser?.id);
    const categoriesWithScores = categories
      .map((cat, index) => ({
        cat,
        index,
        score: categoryInterestScores[cat] ?? 0
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.index - b.index;
      })
      .slice(0, MOBILE_CATEGORY_LIMIT)
      .map((item) => item.cat);

    if (categoriesWithScores.length > 0) return categoriesWithScores;
    return categories.slice(0, MOBILE_CATEGORY_LIMIT);
  })();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const getAuctionCountdown = (endDate: Date | string | FirestoreTimestamp | undefined): string => {
    if (!endDate) return '';
    const end = typeof endDate === 'object' && endDate !== null && 'seconds' in endDate
      ? new Date((endDate as { seconds: number }).seconds * 1000)
      : new Date(endDate as string | Date);
    const diff = end.getTime() - now.getTime();
    if (isNaN(diff) || diff <= 0) return 'หมดเวลาแล้ว';
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (d > 0) return `เหลือ ${d} วัน ${h} ชม.`;
    if (h > 0) return `เหลือ ${h} ชม. ${m} นาที`;
    if (m > 0) return `เหลือ ${m} นาที ${s} วินาที`;
    return `เหลือ ${s} วินาที`;
  };

  useEffect(() => {
    if (imageSearchMode) return;
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, category, searchTerm, sortBy, imageSearchMode]);

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
      
      const isPersonalizedHome =
        !category &&
        !searchTerm &&
        currentPage === 1 &&
        sortBy === 'newest';

      // ถ้าเป็นหน้าแรกแบบไม่กรอง: ดึงมามากขึ้นแล้วจัดอันดับตามความสนใจ
      const fetchLimit = isPersonalizedHome ? 36 : 12;

      const fetchPromise = postsAPI.getPosts({
        category: category || undefined,
        search: searchTerm || undefined,
        sortBy: sortBy || 'newest',
        page: currentPage,
        limit: fetchLimit
      });

      const fetched = await Promise.race([fetchPromise, timeoutPromise]);

      if (isPersonalizedHome && Array.isArray(fetched)) {
        const scores = getCategoryInterestScores(currentUser?.id);
        const ranked = rankPostsByCategoryInterest(fetched, scores);
        setPosts(ranked.slice(0, 12));
      } else {
        setPosts(fetched);
      }
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
    setImageSearchMode(false);
    setCurrentPage(1);
    fetchPosts();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setImageSearchMode(false);
      setCurrentPage(1);
      fetchPosts();
    }
  };

  const handleCategoryChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    setImageSearchMode(false);
    setCategory(e.target.value);
    setCurrentPage(1);
  };

  const handleCategoryToggle = (cat: string): void => {
    setImageSearchMode(false);
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
    // ขายแยกใบ ต้องเลือก “การ์ดแต่ละใบ” ก่อน จึงไม่ควรเพิ่มโพสต์ทั้งก้อนเข้าตะกร้า
    if (post.postType === 'sale' && post.saleType === 'individual') {
      navigate(`/post/${post.id}`);
      return;
    }

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

  // เช็คว่า “โพสต์นี้” มีรายการอยู่ในตะกร้าแล้วหรือยัง (ไม่ว่าจะเป็นเด็คหรือแยกใบ)
  const isAnyCartItemForPost = (postId: string): boolean => {
    return cartItems.some((item) => item.postId === postId);
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

    // Enter image-search mode so the normal fetchPosts useEffect won't overwrite results.
    setImageSearchMode(true);
    setLoading(true);
    setError(null);
    setPosts([]);

    const files = [...selectedSearchImages];

    // Reset normal search filters
    setSearchTerm('');
    setCategory('');
    setSelectedCategories(new Set());
    setCurrentPage(1);

    toast.info('กำลังค้นหาด้วยรูปภาพ...');

    // Close modal + cleanup object URLs
    imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
    setShowImageSearchModal(false);
    setSelectedSearchImages([]);
    setImagePreviewUrls([]);
    setIsDragging(false);

    postsAPI.searchPostsByImage(files)
      .then((results) => {
        setPosts(results);
        if (results.length === 0) {
          toast.info('ไม่พบโพสต์ที่คล้ายกัน');
        }
      })
      .catch((err) => {
        console.error('Image search failed:', err);
        toast.error('ค้นหาด้วยรูปภาพไม่สำเร็จ');
        setImageSearchMode(false);
      })
      .finally(() => {
        setLoading(false);
      });
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
      
      // Keep updater pure to avoid duplicate side effects in React StrictMode.
      setLikedPosts(prev => {
        const newSet = new Set(prev);
        if (liked) {
          newSet.add(post.id);
        } else {
          newSet.delete(post.id);
        }
        return newSet;
      });
      if (liked) {
        toast.success('เพิ่มในรายการโปรดแล้ว ❤️');
      } else {
        toast.success('ลบออกจากรายการโปรดแล้ว');
      }
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

  /* ── helpers ── */
  const postTypeBadge = (post: Post) => {
    if (post.status === 'sold')
      return <span className="badge badge-neutral badge-sm font-semibold">ขายแล้ว</span>;
    if (post.postType === 'auction')
      return <span className="badge badge-secondary badge-sm font-semibold">ประมูล</span>;
    if (post.saleType === 'deck')
      return <span className="badge badge-primary badge-sm font-semibold">เด็ค</span>;
    if (post.saleType === 'individual')
      return <span className="badge badge-accent badge-sm font-semibold">แยกใบ</span>;
    return <span className="badge badge-success badge-sm font-semibold">ขาย</span>;
  };

  const priceDisplay = (post: Post) => {
    if (post.postType === 'auction') {
      const label = post.saleType === 'deck' ? 'เริ่มต้นเด็ค' : post.saleType === 'individual' ? 'เริ่มต้น/ใบ' : 'เริ่มต้น';
      return (
        <div>
          <p className="text-xs text-base-content/50 mb-0.5">{label}</p>
          <p className="text-base font-bold text-primary">{formatPrice(post.startingBid || post.currentBid)}</p>
          {post.buyNowPrice && (
            <p className="text-xs text-secondary mt-0.5">💎 ซื้อทันที {formatPrice(post.buyNowPrice)}</p>
          )}
        </div>
      );
    }
    if (post.saleType === 'deck') return (
      <div>
        <p className="text-xs text-base-content/50 mb-0.5">ราคาเด็ค{post.cardCount ? ` (${post.cardCount} ใบ)` : ''}</p>
        <p className="text-base font-bold text-primary">{formatPrice(post.price)}</p>
      </div>
    );
    if (post.saleType === 'individual') return (
      <div>
        <p className="text-xs text-base-content/50 mb-0.5">ราคา/ใบ{post.availableQuantity ? ` · เหลือ ${post.availableQuantity} ใบ` : ''}</p>
        <p className="text-base font-bold text-primary">{formatPrice(post.individualPrice || post.price)}</p>
      </div>
    );
    return <p className="text-base font-bold text-primary">{formatPrice(post.price)}</p>;
  };

  if (loading && posts.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 bg-base-200/40">
        <span className="loading loading-spinner loading-lg text-primary" />
        <p className="text-sm text-base-content/50">กำลังโหลดสินค้า...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200/40">

      {/* ── Hero Banner ── */}
      <section className="bg-gradient-to-br from-primary via-primary/90 to-secondary text-primary-content py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold leading-tight mb-2 drop-shadow">
              เลือกการ์ดที่ชอบ<br className="md:hidden" /> จากคนขายที่เชื่อถือได้
            </h1>
            <p className="text-primary-content/80 text-sm md:text-base">
              WCO Thailand — ตลาดการ์ดเกมที่ใหญ่ที่สุดในไทย
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {userCanSell ? (
              <Link to="/create-post" className="btn btn-sm bg-white/20 hover:bg-white/30 border-white/30 text-white gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                โพสต์ขายการ์ด
              </Link>
            ) : !currentUser ? (
              <button className="btn btn-sm bg-white/20 hover:bg-white/30 border-white/30 text-white" onClick={() => setShowLoginModal(true)}>
                สมัครเป็นผู้ขาย
              </button>
            ) : (
              <button className="btn btn-sm bg-white/20 hover:bg-white/30 border-white/30 text-white" onClick={() => setShowSellerApplicationModal(true)}>
                สมัครเป็นผู้ขาย
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-5">
        <div className="grid grid-cols-12 gap-5">

          {/* ── Sidebar ── */}
          <aside className="hidden md:block col-span-3">
            <div className="bg-base-100 rounded-2xl border border-base-300 shadow-sm overflow-hidden sticky top-4">
              {/* Categories */}
              <div className="px-4 py-3 border-b border-base-300 flex items-center gap-2">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                </svg>
                <h3 className="font-semibold text-sm text-base-content">หมวดหมู่</h3>
              </div>
              <nav className="py-1 max-h-[340px] overflow-y-auto">
                <button
                  className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${!category ? 'bg-primary/10 text-primary font-semibold' : 'text-base-content/70 hover:bg-base-200'}`}
                  onClick={() => { setImageSearchMode(false); setCategory(''); setCurrentPage(1); }}
                >
                  <span className="text-base">🃏</span>
                  ทั้งหมด
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${category === cat ? 'bg-primary/10 text-primary font-semibold' : 'text-base-content/70 hover:bg-base-200'}`}
                    onClick={() => {
                      recordCategoryInterest(cat, currentUser?.id);
                      setImageSearchMode(false);
                      setCategory(cat === category ? '' : cat);
                      setCurrentPage(1);
                    }}
                  >
                    <span className="text-base shrink-0">🃏</span>
                    <span className="truncate flex-1">{cat}</span>
                    {category === cat && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                ))}
              </nav>

              {/* Quick links */}
              <div className="border-t border-base-300 px-4 py-3">
                <p className="text-xs text-base-content/40 font-medium mb-2 uppercase tracking-wide">ลิงก์ด่วน</p>
                <ul className="space-y-1">
                  <li>
                    <NavLink to="/" end className={({ isActive }) => `flex items-center gap-1.5 text-sm py-1 transition-colors ${isActive ? 'text-primary font-medium' : 'text-base-content/60 hover:text-primary'}`}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                      </svg>
                      หน้าแรก
                    </NavLink>
                  </li>
                  {currentUser && (
                    <>
                      <li>
                        <Link to="/profile" className="flex items-center gap-1.5 text-sm py-1 text-base-content/60 hover:text-primary transition-colors">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                          </svg>
                          โปรไฟล์
                        </Link>
                      </li>
                      <li>
                        <Link to="/my-posts" className="flex items-center gap-1.5 text-sm py-1 text-base-content/60 hover:text-primary transition-colors">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          </svg>
                          โพสต์ของฉัน
                        </Link>
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </aside>

          {/* ── Main Content ── */}
          <div className="col-span-12 md:col-span-9">

            {/* Search bar */}
            <div className="mb-4">
              <form onSubmit={handleSearch}>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="ค้นหาการ์ด เด็ค หรือหมวดหมู่..."
                      value={searchTerm}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="input input-bordered w-full pr-24 rounded-xl bg-base-100"
                    />
                    {/* Image search button */}
                    <button
                      type="button"
                      title="ค้นหาด้วยรูปภาพ (AI)"
                      className="absolute right-10 top-1/2 -translate-y-1/2 p-1 rounded-lg text-base-content/35 hover:text-primary transition-colors cursor-pointer"
                      onClick={() => setShowImageSearchModal(true)}
                    >
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                    </button>
                    <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-base-content/35 hover:text-primary transition-colors cursor-pointer">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                    </button>
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => { setImageSearchMode(false); setSortBy(e.target.value as SortBy); }}
                    className="select select-bordered rounded-xl bg-base-100 text-sm min-w-[130px]"
                  >
                    <option value="newest">ใหม่ล่าสุด</option>
                    <option value="priceAsc">ราคาต่ำ → สูง</option>
                    <option value="priceDesc">ราคาสูง → ต่ำ</option>
                  </select>
                </div>
              </form>

              {/* Mobile category pills */}
              <div className="md:hidden mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                <button
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${!category ? 'bg-primary text-primary-content border-primary' : 'bg-base-100 border-base-300 text-base-content/70 hover:border-primary/50'}`}
                  onClick={() => { setImageSearchMode(false); setCategory(''); setCurrentPage(1); }}
                >
                  ทั้งหมด
                </button>
                {mobileTopCategories.map(cat => (
                  <button
                    key={cat}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${category === cat ? 'bg-primary text-primary-content border-primary' : 'bg-base-100 border-base-300 text-base-content/70 hover:border-primary/50'}`}
                    onClick={() => {
                      recordCategoryInterest(cat, currentUser?.id);
                      setImageSearchMode(false);
                      setCategory(cat === category ? '' : cat);
                      setCurrentPage(1);
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Image search mode banner */}
            {imageSearchMode && (
              <div className="flex items-center gap-3 p-3 mb-4 rounded-xl bg-secondary/10 border border-secondary/20 text-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-secondary shrink-0">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <span className="text-base-content/70">แสดงผลการค้นหาด้วยรูปภาพ</span>
                <button
                  className="ml-auto btn btn-ghost btn-xs"
                  onClick={() => { setImageSearchMode(false); setSearchTerm(''); setCategory(''); fetchPosts(); }}
                >
                  ล้างผล
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="alert alert-error mb-4 rounded-xl text-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            {/* Section header */}
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-semibold text-base-content text-sm">
                {category ? `หมวด: ${category}` : imageSearchMode ? 'ผลค้นหาด้วยรูปภาพ' : 'สินค้าทั้งหมด'}
              </h2>
              {posts.length > 0 && (
                <span className="text-xs text-base-content/40">· {posts.length} รายการ</span>
              )}
              {loading && posts.length > 0 && (
                <span className="loading loading-spinner loading-xs text-primary ml-2" />
              )}
            </div>

            {/* ── Empty state ── */}
            {posts.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-dashed border-base-300 bg-base-100">
                <div className="text-5xl mb-4 opacity-40">🔍</div>
                <h3 className="font-semibold text-base-content/60 mb-1">ไม่พบการ์ดที่ค้นหา</h3>
                <p className="text-sm text-base-content/40 mb-4">ลองเปลี่ยนคำค้นหาหรือหมวดหมู่</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => { setImageSearchMode(false); setSearchTerm(''); setCategory(''); setSelectedCategories(new Set()); fetchPosts(); }}
                >
                  ดูสินค้าทั้งหมด
                </button>
              </div>
            ) : (
              /* ── Product Grid ── */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {posts.map((post) => {
                  const isSold = post.status === 'sold';
                  const isOwner = currentUser && currentUser.id === post.sellerId;
                  const inCart = post.postType === 'sale' && post.saleType === 'individual'
                    ? isAnyCartItemForPost(post.id)
                    : isInCart(post.id);
                  const isLiked = likedPosts.has(post.id);

                  return (
                    <article
                      key={post.id}
                      className={`bg-base-100 rounded-2xl border overflow-hidden flex flex-col transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group ${isSold ? 'border-base-300 opacity-80' : 'border-base-300'}`}
                    >
                      {/* Image */}
                      <div
                        className="relative aspect-[4/3] overflow-hidden bg-base-200 cursor-pointer"
                        onClick={() => { recordCategoryInterest(post.category, currentUser?.id); navigate(`/post/${post.id}`); }}
                      >
                        {post.images && post.images.length > 0 ? (
                          <img
                            src={post.images[0]}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-base-content/20">
                            <span className="text-4xl">🃏</span>
                            <span className="text-xs">ไม่มีรูปภาพ</span>
                          </div>
                        )}
                        {/* Badge overlay */}
                        <div className="absolute top-2 left-2">
                          {postTypeBadge(post)}
                        </div>
                        {/* Sold full overlay */}
                        {isSold && (
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <span className="badge badge-neutral font-bold text-sm px-3 py-2">ขายแล้ว</span>
                          </div>
                        )}
                        {/* Like button */}
                        {!isOwner && currentUser && (
                          <button
                            className={`absolute top-2 right-2 btn btn-xs btn-circle shadow ${isLiked ? 'bg-error text-error-content border-error' : 'bg-base-100/80 backdrop-blur-sm border-base-300 text-base-content/60 hover:bg-error/10 hover:text-error hover:border-error/30'}`}
                            onClick={(e) => { e.stopPropagation(); handleAddToWishlist(post); }}
                            disabled={likingPost === post.id}
                            title={isLiked ? 'เอาออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'}
                          >
                            {likingPost === post.id ? (
                              <span className="loading loading-spinner loading-xs" />
                            ) : (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                              </svg>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Body */}
                      <div className="flex flex-col flex-1 p-3">
                        <p className="text-xs text-base-content/40 mb-1 truncate">{post.category}</p>
                        <h3
                          className="font-semibold text-sm text-base-content line-clamp-2 mb-2 cursor-pointer hover:text-primary transition-colors leading-snug"
                          onClick={() => { recordCategoryInterest(post.category, currentUser?.id); navigate(`/post/${post.id}`); }}
                        >
                          {post.title}
                        </h3>

                        {/* Price */}
                        <div className="mb-2">{priceDisplay(post)}</div>

                        {/* Auction countdown */}
                        {post.postType === 'auction' && !isSold && (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-warning/10 border border-warning/20 mb-2">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning shrink-0">
                              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                            </svg>
                            <span className="text-xs text-warning font-medium">{getAuctionCountdown(post.auctionEndDate) || formatDate(post.auctionEndDate)}</span>
                            {post.bidCount && post.bidCount > 0 && (
                              <span className="text-xs text-base-content/40 ml-auto">{post.bidCount} ครั้ง</span>
                            )}
                          </div>
                        )}

                        {/* Seller + date */}
                        <div className="flex items-center justify-between mt-auto pt-2 border-t border-base-300/60">
                          <Link
                            to={`/seller/${post.sellerId}`}
                            className="text-xs text-base-content/50 hover:text-primary transition-colors truncate"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {post.sellerName}
                          </Link>
                          <span className="text-xs text-base-content/40 shrink-0 ml-2">{formatDate(post.createdAt)}</span>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1.5 mt-2.5">
                          <button
                            className="btn btn-primary btn-sm flex-1 text-xs"
                            onClick={() => { recordCategoryInterest(post.category, currentUser?.id); navigate(`/post/${post.id}`); }}
                          >
                            ดูรายละเอียด
                          </button>

                          {isOwner ? (
                            userCanSell && (
                              <button
                                className={`btn btn-sm text-xs ${isSold ? 'btn-ghost btn-disabled' : 'btn-outline btn-success'}`}
                                onClick={() => handleMarkAsSold(post)}
                                disabled={markingSold === post.id || isSold}
                                title="ทำเครื่องหมายขายแล้ว"
                              >
                                {markingSold === post.id ? (
                                  <span className="loading loading-spinner loading-xs" />
                                ) : isSold ? (
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                ) : (
                                  '💰'
                                )}
                              </button>
                            )
                          ) : (
                            !isSold && (
                              <button
                                className={`btn btn-sm text-xs ${inCart ? 'btn-success' : 'btn-outline'}`}
                                onClick={() => handleAddToCart(post)}
                                disabled={addingToCart === post.id}
                                title={inCart ? 'อยู่ในตะกร้าแล้ว' : 'เพิ่มลงตะกร้า'}
                              >
                                {addingToCart === post.id ? (
                                  <span className="loading loading-spinner loading-xs" />
                                ) : (
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    {inCart
                                      ? <><polyline points="20 6 9 17 4 12"/></>
                                      : <><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></>
                                    }
                                  </svg>
                                )}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Image Search Modal ── */}
      {showImageSearchModal && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={handleCloseImageSearchModal}>
          <div className="bg-base-100 rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-base-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <h3 className="font-bold text-base-content">ค้นหาด้วยรูปภาพ (AI)</h3>
              </div>
              <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={handleCloseImageSearchModal}>✕</button>
            </div>

            <div className="p-6">
              <div
                className={`border-2 border-dashed rounded-xl transition-colors cursor-pointer min-h-[160px] flex flex-col items-center justify-center gap-3 ${isDragging ? 'border-primary bg-primary/5' : 'border-base-300 hover:border-primary/50'}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {selectedSearchImages.length === 0 ? (
                  <>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-base-content/20">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <p className="text-sm text-base-content/50 text-center">ลากรูปมาวางที่นี่<br />หรือ</p>
                    <input type="file" multiple accept="image/*" onChange={handleImageSearchFileSelect} className="hidden" id="image-search-upload" />
                    <label htmlFor="image-search-upload" className="btn btn-outline btn-sm gap-2 cursor-pointer">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                      เลือกรูปภาพ
                    </label>
                  </>
                ) : (
                  <div className="w-full p-3">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {imagePreviewUrls.map((url, index) => (
                        <div key={index} className="relative w-20 h-20 rounded-xl overflow-hidden border border-base-300">
                          <img src={url} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            className="absolute top-1 right-1 btn btn-circle btn-xs bg-black/50 border-none text-white hover:bg-black/70"
                            onClick={() => {
                              URL.revokeObjectURL(imagePreviewUrls[index]);
                              setImagePreviewUrls(prev => prev.filter((_, i) => i !== index));
                              setSelectedSearchImages(prev => prev.filter((_, i) => i !== index));
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <label htmlFor="image-search-upload" className="w-20 h-20 rounded-xl border-2 border-dashed border-base-300 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-base-content/30">
                          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                      </label>
                      <input type="file" multiple accept="image/*" onChange={handleImageSearchFileSelect} className="hidden" id="image-search-upload" />
                    </div>
                    <p className="text-xs text-base-content/40">{selectedSearchImages.length} รูปที่เลือก</p>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-2 justify-end">
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleCloseImageSearchModal}>ยกเลิก</button>
              <button
                type="button"
                className="btn btn-primary btn-sm gap-2"
                onClick={handleImageSearch}
                disabled={selectedSearchImages.length === 0}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                ค้นหาด้วย AI
              </button>
            </div>
          </div>
        </div>
      )}

      <SellerApplicationModal show={showSellerApplicationModal} onHide={() => setShowSellerApplicationModal(false)} />

      {/* ── Login Modal ── */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowLoginModal(false)}>
          <div className="bg-base-100 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
              </svg>
            </div>
            <h3 className="font-bold text-lg text-base-content mb-1">กรุณาเข้าสู่ระบบ</h3>
            <p className="text-sm text-base-content/50 mb-5">กรุณาเข้าสู่ระบบก่อนทำรายการนี้</p>
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost btn-sm flex-1" onClick={() => setShowLoginModal(false)}>ปิด</button>
              <button
                type="button"
                className="btn btn-primary btn-sm flex-1"
                onClick={() => { setShowLoginModal(false); window.location.href = '/login'; }}
              >
                เข้าสู่ระบบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;

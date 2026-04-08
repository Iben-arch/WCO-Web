import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from '../utils/axiosInterceptor';
import { Seller, Post, FirestoreTimestamp } from '../types';

type PostFilter = 'all' | 'active' | 'sold';

const SellerProfile: React.FC = () => {
  const { sellerId } = useParams<{ sellerId: string }>();
  const navigate = useNavigate();
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
    if (!price || isNaN(price)) return 'ราคาไม่ระบุ';
    const numPrice = parseFloat(price.toString());
    if (isNaN(numPrice) || numPrice <= 0) return 'ราคาไม่ระบุ';
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(numPrice);
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
      return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return 'วันที่ไม่ระบุ';
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 bg-base-200/40">
        <span className="loading loading-spinner loading-lg text-primary" />
        <p className="text-base-content/50 text-sm">กำลังโหลดข้อมูลผู้ขาย...</p>
      </div>
    );
  }

  if (error || !seller) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-base-200/40 p-4">
        <div className="card bg-base-100 border border-base-300 shadow-md w-full max-w-sm text-center p-8">
          <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-error">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              <line x1="18" y1="6" x2="6" y2="18"/>
            </svg>
          </div>
          <h3 className="font-bold text-lg text-base-content mb-2">ไม่พบข้อมูลผู้ขาย</h3>
          <p className="text-sm text-base-content/50 mb-6">{error || 'ผู้ขายนี้อาจถูกลบหรือไม่พบในระบบ'}</p>
          <div className="flex gap-2 justify-center">
            <Link to="/" className="btn btn-primary btn-sm">กลับหน้าแรก</Link>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.history.back()}>ย้อนกลับ</button>
          </div>
        </div>
      </div>
    );
  }

  const activeCount = sellerPosts.filter((p) => p.status === 'active').length;
  const soldCount = sellerPosts.filter((p) => p.status === 'sold').length;

  const tabs: { key: PostFilter; label: string; count: number }[] = [
    { key: 'all', label: 'ทั้งหมด', count: sellerPosts.length },
    { key: 'active', label: 'กำลังขาย', count: activeCount },
    { key: 'sold', label: 'ขายแล้ว', count: soldCount },
  ];

  return (
    <div className="min-h-screen bg-base-200/40 pb-10">
      {/* Hero Header */}
      <div className="bg-base-100 border-b border-base-300 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 pt-4 pb-0">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-base-content/40 mb-4">
            <Link to="/" className="hover:text-primary transition-colors">หน้าแรก</Link>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            <span className="text-base-content/60">ประวัติผู้ขาย</span>
          </nav>

          {/* Seller Info */}
          <div className="flex flex-wrap items-start gap-5 pb-6">
            {/* Avatar */}
            <div className="shrink-0">
              {seller.profileImage ? (
                <img
                  src={seller.profileImage}
                  alt={seller.displayName}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-base-300 shadow-md"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border-2 border-base-300 shadow-md">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary/60">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
              )}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-base-content">{seller.displayName}</h1>
                <span className="badge badge-primary badge-sm">ผู้ขาย</span>
              </div>
              <p className="text-xs text-base-content/40 mb-3 flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                เป็นสมาชิกเมื่อ {formatDate(seller.createdAt)}
              </p>

              {/* Stats */}
              <div className="flex flex-wrap gap-3 mb-3">
                {[
                  { label: 'โพสต์ทั้งหมด', value: sellerPosts.length, color: 'text-primary' },
                  { label: 'กำลังขาย', value: activeCount, color: 'text-success' },
                  { label: 'ขายแล้ว', value: soldCount, color: 'text-base-content/50' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex flex-col items-center px-4 py-2 rounded-xl bg-base-200/70 min-w-[72px]">
                    <span className={`text-lg font-bold ${color}`}>{value}</span>
                    <span className="text-xs text-base-content/50 mt-0.5">{label}</span>
                  </div>
                ))}
              </div>

              {/* Contact note */}
              {seller.sellerContactNote && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-primary/5 border border-primary/15 max-w-lg">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary mt-0.5 shrink-0">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <div>
                    <p className="text-xs text-base-content/50 font-medium mb-0.5">ช่องทางติดต่อ</p>
                    <p className="text-sm text-base-content font-medium">{seller.sellerContactNote}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          {sellerPosts.length > 0 && (
            <div className="flex gap-1 -mb-px" role="tablist">
              {tabs.map(({ key, label, count }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={postFilter === key}
                  className={[
                    'px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-150 flex items-center gap-1.5 rounded-t-lg',
                    postFilter === key
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-transparent text-base-content/50 hover:text-base-content hover:bg-base-200/60',
                  ].join(' ')}
                  onClick={() => setPostFilter(key)}
                >
                  {label}
                  <span className={[
                    'badge badge-sm',
                    postFilter === key ? 'badge-primary' : 'badge-ghost',
                  ].join(' ')}>
                    {count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Product Grid */}
      <div className="max-w-6xl mx-auto px-4 pt-6">
        {/* Section title */}
        <div className="flex items-center gap-2 mb-4">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <h2 className="font-semibold text-base-content text-sm">
            สินค้าที่ {seller.displayName} ขาย
          </h2>
          {filteredPosts.length > 0 && (
            <span className="text-xs text-base-content/40">· {filteredPosts.length} รายการ</span>
          )}
        </div>

        {filteredPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-dashed border-base-300 bg-base-100">
            <div className="text-5xl mb-4 opacity-40">🛍️</div>
            <h3 className="font-semibold text-base-content/60 mb-1">
              {sellerPosts.length === 0 ? 'ยังไม่มีโพสต์' : 'ไม่พบรายการที่ตรงกับตัวกรอง'}
            </h3>
            <p className="text-sm text-base-content/40">
              {sellerPosts.length === 0 ? 'ผู้ขายยังไม่ได้โพสต์สินค้าใดๆ' : 'ลองเลือกตัวกรองอื่น'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                role="button"
                tabIndex={0}
                className="rounded-xl border border-base-300 bg-base-100 overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group"
                onClick={() => navigate(`/post/${post.id}`)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/post/${post.id}`)}
              >
                {/* Image */}
                <div className="aspect-square overflow-hidden bg-base-200 relative">
                  {post.images && post.images.length > 0 ? (
                    <img
                      src={post.images[0]}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-base-200 to-base-300">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-base-content/20">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                      </svg>
                    </div>
                  )}
                  {/* Status overlay badge */}
                  {post.status === 'sold' && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="badge badge-neutral badge-sm font-semibold">ขายแล้ว</span>
                    </div>
                  )}
                  {post.postType === 'auction' && post.status !== 'sold' && (
                    <div className="absolute top-1.5 left-1.5">
                      <span className="badge badge-secondary badge-sm font-semibold">ประมูล</span>
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="p-2.5">
                  <p className="text-primary font-bold text-sm mb-1 truncate">
                    {post.postType === 'auction' ? formatPrice(post.startingBid) : formatPrice(post.price)}
                  </p>
                  <p className="text-xs text-base-content/80 leading-snug line-clamp-2 mb-1.5">{post.title}</p>
                  <p className="text-xs text-base-content/40">{post.category} · {formatDate(post.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerProfile;

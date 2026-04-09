import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { canSellCards } from '../../utils/roles';
import { useCart } from '../../contexts/CartContext';
import { notificationsAPI, WCO_NOTIFICATIONS_CHANGED } from '../../api/api';

const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

const CartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);

const Navbar: React.FC = () => {
  const { currentUser, userProfile, logout } = useAuth();
  const navSellRole = (userProfile as any)?.role;
  const { getCartCount } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!currentUser) { setUnreadCount(0); return; }
    const fetchUnread = async () => {
      try {
        const list = await notificationsAPI.getMyNotifications();
        setUnreadCount((list ?? []).filter((n: any) => !n.readAt).length);
      } catch { setUnreadCount(0); }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    const onChanged = () => void fetchUnread();
    const onVisible = () => { if (document.visibilityState === 'visible') void fetchUnread(); };
    window.addEventListener(WCO_NOTIFICATIONS_CHANGED, onChanged);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener(WCO_NOTIFICATIONS_CHANGED, onChanged);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [currentUser]);

  const handleLogout = async () => {
    try { await logout(); navigate('/'); setProfileOpen(false); }
    catch (e) { console.error('Logout error:', e); }
  };

  const displayName = userProfile?.displayName || 'ผู้ใช้';
  const profileImage = userProfile?.profileImage || (userProfile as any)?.photoURL;
  const initials = displayName.trim().charAt(0).toUpperCase();
  const cartCount = getCartCount();

  const desktopLinks = [
    { to: '/', label: 'หน้าแรก' },
    ...(currentUser && canSellCards(navSellRole) ? [{ to: '/create-post', label: 'ขายการ์ด' }] : []),
    ...(userProfile?.isAdmin ? [{ to: '/admin', label: 'แอดมิน' }] : []),
  ];

  return (
    <>
      <header className={`navbar sticky top-0 z-[1000] px-4 md:px-6 border-b border-base-300 bg-base-100/95 backdrop-blur ${scrolled ? 'shadow-md' : ''}`}>
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-x-2 gap-y-1.5">
          <Link to="/" className="btn btn-ghost shrink-0 normal-case text-lg font-extrabold text-primary no-underline">
            <span className="text-2xl leading-none">🎴</span>
            <span>WCO Thailand</span>
          </Link>

          <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5 sm:gap-1">
            {desktopLinks.map((item) => (
              <Link key={item.to} to={item.to} className="btn btn-ghost btn-sm no-underline shrink-0">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            {currentUser && (
              <>
                <Link to="/notifications" className="btn btn-ghost btn-circle relative" aria-label="การแจ้งเตือน">
                  <BellIcon />
                  {unreadCount > 0 && (
                    <span className="badge badge-error badge-xs absolute top-0 right-0 text-[10px]">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>

                <Link to="/cart" className="btn btn-ghost btn-circle relative" aria-label="ตะกร้า">
                  <CartIcon />
                  {cartCount > 0 && (
                    <span className="badge badge-primary badge-xs absolute top-0 right-0 text-[10px]">
                      {cartCount}
                    </span>
                  )}
                </Link>
              </>
            )}

            {currentUser ? (
              <div ref={profileRef} className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="btn btn-outline rounded-full pl-1 pr-3 min-h-0 h-10"
                >
                  <div className={`avatar${profileImage ? '' : ' placeholder'}`}>
                    <div className="w-8 rounded-full bg-primary text-primary-content">
                    {profileImage ? (
                        <img src={profileImage} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-xs font-bold">{initials}</span>
                    )}
                    </div>
                  </div>
                  <span className="max-w-[120px] truncate text-sm font-semibold hidden sm:inline">
                    {displayName}
                  </span>
                </button>

                {profileOpen && (
                  <div className="absolute top-[calc(100%+8px)] right-0 z-50 w-56 rounded-2xl border border-base-300 bg-base-100 p-2 shadow-2xl">
                    <div className="px-3 py-2 border-b border-base-300 mb-1">
                      <div className="text-xs text-base-content/50 mb-0.5">ล็อกอินเป็น</div>
                      <div className="text-sm font-bold">{displayName}</div>
                    </div>
                    {[
                      { to: '/profile', label: '👤 โปรไฟล์' },
                      { to: '/my-posts', label: '📝 โพสต์ของฉัน' },
                      { to: '/notifications', label: `🔔 การแจ้งเตือน${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
                      { to: '/cart', label: `🛒 ตะกร้า${cartCount > 0 ? ` (${cartCount})` : ''}` },
                      ...(userProfile?.isAdmin ? [{ to: '/admin', label: '⚙️ แอดมิน' }] : []),
                    ].map(item => (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setProfileOpen(false)}
                        className="block rounded-lg px-3 py-2 text-sm no-underline hover:bg-base-200"
                      >
                        {item.label}
                      </Link>
                    ))}
                    <div className="h-px bg-base-300 my-1" />
                    <button
                      onClick={handleLogout}
                      className="w-full text-left rounded-lg px-3 py-2 text-sm text-error hover:bg-error/10"
                    >
                      🚪 ออกจากระบบ
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="btn btn-primary btn-sm no-underline"
              >
                เข้าสู่ระบบ
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
};

export default Navbar;

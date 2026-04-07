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
  const [mobileOpen, setMobileOpen] = useState(false);
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
    try { await logout(); navigate('/'); setMobileOpen(false); setProfileOpen(false); }
    catch (e) { console.error('Logout error:', e); }
  };

  const displayName = userProfile?.displayName || 'ผู้ใช้';
  const profileImage = userProfile?.profileImage || (userProfile as any)?.photoURL;
  const initials = displayName.trim().charAt(0).toUpperCase();
  const cartCount = getCartCount();

  const navStyle: React.CSSProperties = {
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    background: scrolled ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: scrolled ? '1px solid #e2e8f0' : '1px solid #f1f5f9',
    boxShadow: scrolled ? '0 4px 20px -4px rgba(0, 119, 182, 0.12)' : 'none',
    transition: 'all 0.3s ease',
  };

  const iconBtnStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '2.25rem',
    height: '2.25rem',
    borderRadius: '0.625rem',
    border: 'none',
    background: 'transparent',
    color: '#475569',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
    textDecoration: 'none',
  };

  const navLinkStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.375rem 0.875rem',
    borderRadius: '0.625rem',
    fontSize: '0.9rem',
    fontWeight: 500,
    color: '#475569',
    textDecoration: 'none',
    transition: 'background 0.15s, color 0.15s',
    whiteSpace: 'nowrap',
  };

  const badgeStyle: React.CSSProperties = {
    position: 'absolute',
    top: '-3px',
    right: '-3px',
    minWidth: '18px',
    height: '18px',
    borderRadius: '9px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 700,
    color: 'white',
    padding: '0 4px',
    lineHeight: 1,
  };

  return (
    <>
      <header style={navStyle}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', height: '64px', gap: '0.5rem' }}>

          {/* Brand */}
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, marginRight: '1rem' }}>
            <span style={{ fontSize: '1.75rem', lineHeight: 1 }}>🎴</span>
            <span style={{ fontWeight: 800, fontSize: '1.125rem', color: '#0077B6', letterSpacing: '-0.02em' }}>
              WCO Thailand
            </span>
          </Link>

          {/* Desktop nav links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1 }} className="d-none d-lg-flex">
            <Link to="/" style={navLinkStyle}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#f0f9ff'; (e.currentTarget as HTMLAnchorElement).style.color = '#0077B6'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = '#475569'; }}>
              หน้าแรก
            </Link>
            {currentUser && canSellCards(navSellRole) && (
              <Link to="/create-post" style={navLinkStyle}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#f0f9ff'; (e.currentTarget as HTMLAnchorElement).style.color = '#0077B6'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = '#475569'; }}>
                ขายการ์ด
              </Link>
            )}
            {userProfile?.isAdmin && (
              <Link to="/admin" style={navLinkStyle}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#f0f9ff'; (e.currentTarget as HTMLAnchorElement).style.color = '#0077B6'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = '#475569'; }}>
                แอดมิน
              </Link>
            )}
          </nav>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginLeft: 'auto' }}>
            {currentUser && (
              <>
                {/* Notifications */}
                <Link to="/notifications" style={{ ...iconBtnStyle, color: '#475569' } as React.CSSProperties}
                  aria-label="การแจ้งเตือน"
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#f0f9ff'; (e.currentTarget as HTMLAnchorElement).style.color = '#0077B6'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = '#475569'; }}>
                  <BellIcon />
                  {unreadCount > 0 && (
                    <span style={{ ...badgeStyle, background: '#ef4444' }}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>

                {/* Cart */}
                <Link to="/cart" style={{ ...iconBtnStyle, color: '#475569' } as React.CSSProperties}
                  aria-label="ตะกร้า"
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#f0f9ff'; (e.currentTarget as HTMLAnchorElement).style.color = '#0077B6'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = '#475569'; }}>
                  <CartIcon />
                  {cartCount > 0 && (
                    <span style={{ ...badgeStyle, background: '#0077B6' }}>
                      {cartCount}
                    </span>
                  )}
                </Link>
              </>
            )}

            {/* Profile or Login */}
            {currentUser ? (
              <div ref={profileRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: '2px solid #e2e8f0', borderRadius: '2rem', padding: '0.25rem 0.75rem 0.25rem 0.25rem', cursor: 'pointer', transition: 'border-color 0.2s', outline: 'none' }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.borderColor = '#0077B6'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0'}
                >
                  <div style={{ width: '1.875rem', height: '1.875rem', borderRadius: '50%', overflow: 'hidden', background: '#0077B6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {profileImage ? (
                      <img src={profileImage} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ color: 'white', fontSize: '0.8125rem', fontWeight: 700 }}>{initials}</span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayName}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: 'transform 0.2s', transform: profileOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* Dropdown */}
                {profileOpen && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: 'white', borderRadius: '1rem', boxShadow: '0 20px 40px -8px rgba(0,0,0,0.15)', border: '1px solid #f1f5f9', minWidth: '220px', padding: '0.5rem', zIndex: 100 }}>
                    <div style={{ padding: '0.5rem 0.75rem 0.75rem', borderBottom: '1px solid #f1f5f9', marginBottom: '0.25rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.1rem' }}>ล็อกอินเป็น</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>{displayName}</div>
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
                        style={{ display: 'block', padding: '0.5rem 0.75rem', borderRadius: '0.625rem', fontSize: '0.875rem', color: '#374151', textDecoration: 'none', transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = '#f8fafc'}
                        onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'}
                      >
                        {item.label}
                      </Link>
                    ))}
                    <div style={{ height: '1px', background: '#f1f5f9', margin: '0.25rem 0' }} />
                    <button
                      onClick={handleLogout}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', borderRadius: '0.625rem', fontSize: '0.875rem', color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2'}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                    >
                      🚪 ออกจากระบบ
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                style={{ display: 'inline-flex', alignItems: 'center', padding: '0.5rem 1.25rem', background: 'linear-gradient(135deg, #0077B6 0%, #005A8E 100%)', color: 'white', borderRadius: '0.75rem', fontWeight: 700, fontSize: '0.875rem', textDecoration: 'none', transition: 'opacity 0.2s', letterSpacing: '0.01em' }}
                onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.opacity = '0.9'}
                onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.opacity = '1'}
              >
                เข้าสู่ระบบ
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              className="d-lg-none"
              onClick={() => setMobileOpen(!mobileOpen)}
              style={{ ...iconBtnStyle, marginLeft: '0.25rem' }}
              aria-label="เมนู"
            >
              {mobileOpen ? (
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 998, backdropFilter: 'blur(2px)' }}
            onClick={() => setMobileOpen(false)}
          />
          <div style={{ position: 'fixed', top: '64px', left: 0, right: 0, zIndex: 999, background: 'white', borderBottom: '1px solid #f1f5f9', boxShadow: '0 8px 24px -4px rgba(0,0,0,0.1)', padding: '0.75rem' }}>
            {[
              { to: '/', label: '🏠 หน้าแรก' },
              ...(currentUser && canSellCards(navSellRole) ? [{ to: '/create-post', label: '💰 ขายการ์ด' }] : []),
              ...(userProfile?.isAdmin ? [{ to: '/admin', label: '⚙️ แอดมิน' }] : []),
              ...(currentUser ? [
                { to: '/profile', label: '👤 โปรไฟล์' },
                { to: '/my-posts', label: '📝 โพสต์ของฉัน' },
                { to: '/notifications', label: `🔔 การแจ้งเตือน${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
                { to: '/cart', label: `🛒 ตะกร้า${cartCount > 0 ? ` (${cartCount})` : ''}` },
              ] : []),
            ].map(item => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                style={{ display: 'block', padding: '0.625rem 0.875rem', borderRadius: '0.625rem', fontSize: '0.9375rem', color: '#374151', textDecoration: 'none', fontWeight: 500 }}
              >
                {item.label}
              </Link>
            ))}
            {currentUser ? (
              <>
                <div style={{ height: '1px', background: '#f1f5f9', margin: '0.5rem 0' }} />
                <button
                  onClick={handleLogout}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.625rem 0.875rem', borderRadius: '0.625rem', fontSize: '0.9375rem', color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 500 }}
                >
                  🚪 ออกจากระบบ
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                style={{ display: 'block', margin: '0.5rem 0 0', padding: '0.75rem', background: 'linear-gradient(135deg, #0077B6 0%, #005A8E 100%)', color: 'white', borderRadius: '0.75rem', textAlign: 'center', fontWeight: 700, textDecoration: 'none' }}
              >
                เข้าสู่ระบบ
              </Link>
            )}
          </div>
        </>
      )}
    </>
  );
};

export default Navbar;

import React from 'react';
import { Nav } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface MenuItem {
  id: string;
  label: string;
  icon: string; // Icon name: 'user', 'edit', 'lock', 'heart', 'hammer', 'eye', 'clipboard', 'logout'
  hasDropdown?: boolean;
  children?: Array<{
    id: string;
    label: string;
    icon: string;
  }>;
}

interface ProfileSidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const ProfileSidebar: React.FC<ProfileSidebarProps> = ({ activeTab, onTabChange }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  // Icon components
  const UserIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  );

  const EditIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
  );

  const LockIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
  );

  const HeartIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
    </svg>
  );

  const HammerIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 12l-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9"></path>
      <path d="M17.64 15L22 10.64"></path>
      <path d="M20.91 11.7l-1.25-1.25L22 8l-1-1-1.45 2.25L17.3 7.91l-1.25 1.25"></path>
      <path d="M15 12l-3-3"></path>
    </svg>
  );

  const EyeIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  );

  const ClipboardIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
    </svg>
  );

  const LogoutIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
      <polyline points="16 17 21 12 16 7"></polyline>
      <line x1="21" y1="12" x2="9" y2="12"></line>
    </svg>
  );

  const menuItems: MenuItem[] = [
    {
      id: 'profile',
      label: 'บัญชีของฉัน',
      icon: 'user',
      hasDropdown: true,
      children: [
        { id: 'personal-info', label: 'ข้อมูลส่วนตัว', icon: 'edit' },
        { id: 'security', label: 'ข้อมูลความปลอดภัย', icon: 'lock' }
      ]
    },
    {
      id: 'my-posts',
      label: 'รายการของฉัน',
      icon: 'edit'
    },
    {
      id: 'liked',
      label: 'รายการที่ถูกใจ',
      icon: 'heart'
    },
    {
      id: 'auctions',
      label: 'การประมูลของฉัน',
      icon: 'hammer'
    },
    {
      id: 'orders',
      label: 'รายการคำสั่งซื้อ',
      icon: 'clipboard'
    }
  ];

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'user':
        return <UserIcon />;
      case 'edit':
        return <EditIcon />;
      case 'lock':
        return <LockIcon />;
      case 'heart':
        return <HeartIcon />;
      case 'hammer':
        return <HammerIcon />;
      case 'eye':
        return <EyeIcon />;
      case 'clipboard':
        return <ClipboardIcon />;
      case 'logout':
        return <LogoutIcon />;
      default:
        return null;
    }
  };

  const handleItemClick = (itemId: string): void => {
    onTabChange(itemId);
  };

  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="profile-sidebar">
      <div className="sidebar-header">
        <div className="d-flex align-items-center justify-content-between">
          <span className="sidebar-title">บัญชีของฉัน</span>
          <span className="dropdown-arrow">▼</span>
        </div>
      </div>
      
      <Nav className="flex-column sidebar-nav">
        {menuItems.map((item) => (
          <React.Fragment key={item.id}>
            <Nav.Item>
              <Nav.Link
                className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => handleItemClick(item.id)}
              >
                <span className="item-icon">{renderIcon(item.icon)}</span>
                <span className="item-label">{item.label}</span>
                {item.hasDropdown && <span className="dropdown-arrow">▼</span>}
              </Nav.Link>
            </Nav.Item>
            
            {/* Submenu items */}
            {item.children && (
              <div className="submenu">
                {item.children.map((child) => (
                  <Nav.Item key={child.id}>
                    <Nav.Link
                      className={`sidebar-item submenu-item ${activeTab === child.id ? 'active' : ''}`}
                      onClick={() => handleItemClick(child.id)}
                    >
                      <span className="item-icon">{renderIcon(child.icon)}</span>
                      <span className="item-label">{child.label}</span>
                    </Nav.Link>
                  </Nav.Item>
                ))}
              </div>
            )}
          </React.Fragment>
        ))}
        
        {/* Logout Button */}
        <Nav.Item className="mt-auto">
          <Nav.Link
            className="sidebar-item logout-item"
            onClick={handleLogout}
          >
            <span className="item-icon">{renderIcon('logout')}</span>
            <span className="item-label">ออกจากระบบ</span>
          </Nav.Link>
        </Nav.Item>
      </Nav>
    </div>
  );
};

export default ProfileSidebar;


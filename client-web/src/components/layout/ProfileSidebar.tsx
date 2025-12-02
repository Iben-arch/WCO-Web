import React from 'react';
import { Nav } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
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

  const menuItems: MenuItem[] = [
    {
      id: 'profile',
      label: 'บัญชีของฉัน',
      icon: '👤',
      hasDropdown: true,
      children: [
        { id: 'personal-info', label: 'ข้อมูลส่วนตัว', icon: '📝' },
        { id: 'security', label: 'ข้อมูลความปลอดภัย', icon: '🔒' }
      ]
    },
    {
      id: 'my-posts',
      label: 'รายการของฉัน',
      icon: '📝'
    },
    {
      id: 'liked',
      label: 'รายการที่ถูกใจ',
      icon: '❤️'
    },
    {
      id: 'auctions',
      label: 'การประมูลของฉัน',
      icon: '🔨'
    },
    {
      id: 'watchlist',
      label: 'รายการตั้งรับ',
      icon: '👀'
    },
    {
      id: 'orders',
      label: 'รายการคำสั่งซื้อ',
      icon: '📋'
    }
  ];

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
                <span className="item-icon">{item.icon}</span>
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
                      <span className="item-icon">{child.icon}</span>
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
            <span className="item-icon">🚪</span>
            <span className="item-label">ออกจากระบบ</span>
          </Nav.Link>
        </Nav.Item>
      </Nav>
    </div>
  );
};

export default ProfileSidebar;


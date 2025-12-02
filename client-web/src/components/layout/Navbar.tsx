import React, { useState, useEffect } from 'react';
import { Navbar as BootstrapNavbar, Nav, Container, Dropdown } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { TCGButton } from '../common/ButtonComponents';
import ProfileButton from '../common/ProfileButton';

const Navbar: React.FC = () => {
  const { currentUser, userProfile, logout } = useAuth();
  const { getCartCount } = useCart();
  const [expanded, setExpanded] = useState<boolean>(false);
  const [scrolled, setScrolled] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = (): void => {
      const isScrolled = window.scrollY > 20;
      setScrolled(isScrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
      navigate('/');
      setExpanded(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <BootstrapNavbar className={`navbar-sakura ${scrolled ? 'scrolled' : ''}`} expand="lg" expanded={expanded}>
      <div className="navbar-pattern-overlay"></div>
      <Container className="navbar-container-wide">
        <BootstrapNavbar.Brand as={Link} to="/" className="navbar-brand-decorated">
          <span className="brand-icon">🎴</span>
          <span className="brand-text">WCO Thailand</span>
        </BootstrapNavbar.Brand>
        
        <BootstrapNavbar.Toggle 
          aria-controls="basic-navbar-nav" 
          onClick={() => setExpanded(!expanded)}
        />
        
        <BootstrapNavbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/" onClick={() => setExpanded(false)}>
              หน้าแรก
            </Nav.Link>
            {currentUser && (
              <>
                <Nav.Link as={Link} to="/create-post" onClick={() => setExpanded(false)}>
                  ขายการ์ด
                </Nav.Link>
                <Nav.Link as={Link} to="/my-posts" onClick={() => setExpanded(false)}>
                  รับซื้อการ์ด
                </Nav.Link>
                <Nav.Link as={Link} to="/cart" onClick={() => setExpanded(false)}>
                  🛒 ตะกร้า {getCartCount() > 0 && `(${getCartCount()})`}
                </Nav.Link>
                <Nav.Link as={Link} to="/offers" onClick={() => setExpanded(false)}>
                  💰 ข้อเสนอ
                </Nav.Link>
              </>
            )}
            {userProfile?.isAdmin && (
              <Nav.Link as={Link} to="/admin" onClick={() => setExpanded(false)}>
                แอดมิน
              </Nav.Link>
            )}
          </Nav>
          
          <Nav>
            {currentUser ? (
              <Dropdown align="end">
                <Dropdown.Toggle as={ProfileButton} />
                <Dropdown.Menu className="dropdown-sakura">
                  <Dropdown.Item as={Link} to="/profile" onClick={() => setExpanded(false)}>
                    👤 โปรไฟล์
                  </Dropdown.Item>
                  <Dropdown.Item as={Link} to="/my-posts" onClick={() => setExpanded(false)}>
                    📝 โพสต์ของฉัน
                  </Dropdown.Item>
                  <Dropdown.Item as={Link} to="/cart" onClick={() => setExpanded(false)}>
                    🛒 ตะกร้า {getCartCount() > 0 && `(${getCartCount()})`}
                  </Dropdown.Item>
                  <Dropdown.Item as={Link} to="/offers" onClick={() => setExpanded(false)}>
                    💰 ข้อเสนอ
                  </Dropdown.Item>
                  {userProfile?.isAdmin && (
                    <Dropdown.Item as={Link} to="/admin" onClick={() => setExpanded(false)}>
                      ⚙️ แอดมิน
                    </Dropdown.Item>
                  )}
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={handleLogout} className="text-danger">
                    🚪 ออกจากระบบ
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            ) : (
              <TCGButton 
                as={Link} 
                to="/login" 
                onClick={() => setExpanded(false)}
                variant="primary"
                size="sm"
                className="navbar-login-btn"
              >
                เข้าสู่ระบบ
              </TCGButton>
            )}
          </Nav>
        </BootstrapNavbar.Collapse>
      </Container>
    </BootstrapNavbar>
  );
};

export default Navbar;


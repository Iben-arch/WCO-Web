import React, { useState, FormEvent, ChangeEvent } from 'react';
import { Container, Row, Col, Form, Button, Alert } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await login(email, password);
      navigate('/');
    } catch (error: any) {
      console.error('Login error:', error);
      
      if (error.message) {
        setError(error.message);
      } else {
        setError('เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container" style={{
      background: 'linear-gradient(135deg, var(--light-cyan) 0%, var(--frosted-blue-light) 50%, var(--sky-aqua) 100%)',
      minHeight: '100vh',
      padding: '2rem 0'
    }}>
      <Container>
        <Row className="justify-content-center align-items-center min-vh-100 py-5">
          <Col md={8} lg={6} xl={5}>
            {/* Logo/Brand Section */}
            <div className="auth-logo-section text-center mb-5" style={{
              animation: 'fadeInDown 0.6s ease-out'
            }}>
              <Link to="/" className="auth-logo-link" style={{ textDecoration: 'none' }}>
                <h1 className="auth-brand-title" style={{
                  fontSize: '2.5rem',
                  fontWeight: '700',
                  color: 'var(--deep-twilight)',
                  marginBottom: '1rem',
                  textShadow: '0 2px 4px rgba(3, 4, 94, 0.1)'
                }}>🎴 WCO Thailand</h1>
                <p className="auth-brand-tagline" style={{
                  fontSize: '1rem',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.6',
                  maxWidth: '500px',
                  margin: '0 auto'
                }}>
                  เรามุ่งมั่นที่จะผลักดันวงการการ์ดเกมประเทศไทยให้เติบโตและพัฒนาไปข้างหน้าอย่างก้าวกระโดด
                </p>
              </Link>
            </div>

            {/* Auth Card */}
            <div className="auth-form-card" style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-xl)',
              padding: '2.5rem',
              border: '1px solid var(--border-light)',
              animation: 'fadeInUp 0.6s ease-out'
            }}>
              <div className="auth-form-header">
                <h2 className="auth-form-title">เข้าสู่ระบบ</h2>
                <p className="auth-form-subtitle">เข้าสู่ระบบเพื่อซื้อขายการ์ดเกม</p>
              </div>

              {error && (
                <Alert variant="danger" className="auth-alert">
                  <div className="alert-icon">⚠️</div>
                  <div className="alert-message">{error}</div>
                </Alert>
              )}

              <Form onSubmit={handleSubmit} className="auth-form">
                <div className="form-group-modern">
                  <label htmlFor="email" className="form-label-modern">
                    อีเมล
                  </label>
                  <div className={`input-wrapper ${focusedField === 'email' || email ? 'focused' : ''}`}>
                    <span className="input-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="L22 6L12 13L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <Form.Control
                      id="email"
                      type="email"
                      className="form-input-modern"
                      placeholder="กรอกอีเมลของคุณ"
                      value={email}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="form-group-modern">
                  <label htmlFor="password" className="form-label-modern">
                    รหัสผ่าน
                  </label>
                  <div className={`input-wrapper ${focusedField === 'password' || password ? 'focused' : ''}`}>
                    <span className="input-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <Form.Control
                      id="password"
                      type="password"
                      className="form-input-modern"
                      placeholder="กรอกรหัสผ่านของคุณ"
                      value={password}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="auth-submit-btn btn-tcg-primary btn-tcg-lg w-100"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      กำลังเข้าสู่ระบบ...
                    </>
                  ) : (
                    <span className="btn-text">เข้าสู่ระบบ</span>
                  )}
                </Button>
              </Form>

              <div className="auth-footer">
                <p className="auth-footer-text">
                  <Link to="/forgot-password" className="auth-footer-link">
                    ลืมรหัสผ่าน?
                  </Link>
                </p>
              </div>

              <div className="auth-divider">
                <span>หรือ</span>
              </div>

              <div className="auth-footer">
                <p className="auth-footer-text">
                  ยังไม่มีบัญชี?{' '}
                  <Link to="/register" className="auth-footer-link">
                    สมัครสมาชิก
                  </Link>
                </p>
              </div>
            </div>

            {/* Additional Links */}
            <div className="auth-bottom-links text-center mt-4">
              <Link to="/" className="back-home-link">
                ← กลับไปหน้าแรก
              </Link>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default Login;

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
  const [showPassword, setShowPassword] = useState<boolean>(false);
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
    <div className="auth-page-container">
      <Container>
        <Row className="justify-content-center align-items-center min-vh-100 py-5">
          <Col md={8} lg={6} xl={5}>
            {/* Logo/Brand Section */}
            <div className="auth-logo-section text-center mb-5">
              <Link to="/" className="auth-logo-link">
                <h1 className="auth-brand-title">🎴 WCO Thailand</h1>
                <p className="auth-brand-tagline">
                  เรามุ่งมั่นที่จะผลักดันวงการการ์ดเกมประเทศไทยให้เติบโตและพัฒนาไปข้างหน้าอย่างก้าวกระโดด
                </p>
              </Link>
            </div>

            {/* Auth Card */}
            <div className="auth-form-card">
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
                  <div className={`input-wrapper input-wrapper--with-toggle ${focusedField === 'password' || password ? 'focused' : ''}`}>
                    <span className="input-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <Form.Control
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      className="form-input-modern"
                      placeholder="กรอกรหัสผ่านของคุณ"
                      value={password}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                      aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    >
                      {showPassword ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
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

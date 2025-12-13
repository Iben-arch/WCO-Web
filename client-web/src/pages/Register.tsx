import React, { useState, FormEvent, ChangeEvent } from 'react';
import { Container, Row, Col, Form, Button, Alert } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface RegisterFormData {
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const Register: React.FC = () => {
  const [formData, setFormData] = useState<RegisterFormData>({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    if (!formData.displayName || !formData.email || !formData.password) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('รหัสผ่านไม่ตรงกัน');
      return;
    }

    if (formData.password.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await register(formData.email, formData.password, formData.displayName);
      navigate('/');
    } catch (error: any) {
      console.error('Register error:', error);
      
      // Handle different types of errors from server API
      if (error.response?.data?.error) {
        // Server API error
        setError(error.response.data.error);
      } else if (error.code === 'auth/email-already-in-use' || error.message?.includes('อีเมลนี้ถูกใช้งานแล้ว')) {
        setError('อีเมลนี้ถูกใช้งานแล้ว');
      } else if (error.code === 'auth/weak-password' || error.message?.includes('รหัสผ่านไม่แข็งแรงพอ')) {
        setError('รหัสผ่านไม่แข็งแรงพอ');
      } else if (error.message) {
        setError(error.message);
      } else {
        setError('เกิดข้อผิดพลาดในการสมัครสมาชิก กรุณาลองใหม่อีกครั้ง');
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
                <h2 className="auth-form-title">สมัครสมาชิก</h2>
                <p className="auth-form-subtitle">สร้างบัญชีเพื่อซื้อขายการ์ดเกม</p>
              </div>

              {error && (
                <Alert variant="danger" className="auth-alert">
                  <div className="alert-icon">⚠️</div>
                  <div className="alert-message">{error}</div>
                </Alert>
              )}

              <Form onSubmit={handleSubmit} className="auth-form">
                <div className="form-group-modern">
                  <label htmlFor="displayName" className="form-label-modern">
                    ชื่อแสดง
                  </label>
                  <div className={`input-wrapper ${focusedField === 'displayName' || formData.displayName ? 'focused' : ''}`}>
                    <span className="input-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <Form.Control
                      id="displayName"
                      type="text"
                      name="displayName"
                      className="form-input-modern"
                      placeholder="กรอกชื่อแสดงของคุณ"
                      value={formData.displayName}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('displayName')}
                      onBlur={() => setFocusedField(null)}
                      required
                      autoComplete="name"
                    />
                  </div>
                </div>

                <div className="form-group-modern">
                  <label htmlFor="email" className="form-label-modern">
                    อีเมล
                  </label>
                  <div className={`input-wrapper ${focusedField === 'email' || formData.email ? 'focused' : ''}`}>
                    <span className="input-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="L22 6L12 13L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <Form.Control
                      id="email"
                      type="email"
                      name="email"
                      className="form-input-modern"
                      placeholder="กรอกอีเมลของคุณ"
                      value={formData.email}
                      onChange={handleChange}
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
                  <div className={`input-wrapper ${focusedField === 'password' || formData.password ? 'focused' : ''}`}>
                    <span className="input-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <Form.Control
                      id="password"
                      type="password"
                      name="password"
                      className="form-input-modern"
                      placeholder="กรอกรหัสผ่าน (อย่างน้อย 6 ตัวอักษร)"
                      value={formData.password}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  <small className="form-help-text">
                    รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร
                  </small>
                </div>

                <div className="form-group-modern">
                  <label htmlFor="confirmPassword" className="form-label-modern">
                    ยืนยันรหัสผ่าน
                  </label>
                  <div className={`input-wrapper ${focusedField === 'confirmPassword' || formData.confirmPassword ? 'focused' : ''}`}>
                    <span className="input-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 11L12 14L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M21 12V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <Form.Control
                      id="confirmPassword"
                      type="password"
                      name="confirmPassword"
                      className="form-input-modern"
                      placeholder="ยืนยันรหัสผ่านของคุณ"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('confirmPassword')}
                      onBlur={() => setFocusedField(null)}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div className="form-terms">
                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="agreeTerms"
                      required
                    />
                    <label className="form-check-label" htmlFor="agreeTerms">
                      ฉันยอมรับ{' '}
                      <Link to="#" className="terms-link">ข้อตกลงและเงื่อนไข</Link>
                      {' '}และ{' '}
                      <Link to="#" className="terms-link">นโยบายความเป็นส่วนตัว</Link>
                    </label>
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
                      กำลังสมัครสมาชิก...
                    </>
                  ) : (
                    <>
                      <span className="btn-icon-dollar">$</span>
                      <span className="btn-text">สมัครสมาชิก</span>
                    </>
                  )}
                </Button>
              </Form>

              <div className="auth-divider">
                <span>หรือ</span>
              </div>

              <div className="auth-footer">
                <p className="auth-footer-text">
                  มีบัญชีแล้ว?{' '}
                  <Link to="/login" className="auth-footer-link">
                    เข้าสู่ระบบ
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

export default Register;


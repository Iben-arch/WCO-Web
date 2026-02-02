import React, { useState, FormEvent, ChangeEvent } from 'react';
import { Container, Row, Col, Form, Button, Alert } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    if (!email) {
      setError('กรุณากรอกอีเมล');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('รูปแบบอีเมลไม่ถูกต้อง');
      return;
    }

    try {
      setError('');
      setLoading(true);
      
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        throw resetError;
      }

      setSuccess(true);
    } catch (error: any) {
      console.error('Forgot password error:', error);
      
      if (error.message) {
        setError(error.message);
      } else {
        setError('เกิดข้อผิดพลาดในการส่งอีเมลรีเซ็ตรหัสผ่าน กรุณาลองใหม่อีกครั้ง');
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
                <h2 className="auth-form-title">ลืมรหัสผ่าน</h2>
                <p className="auth-form-subtitle">กรุณากรอกอีเมลเพื่อรับลิงก์รีเซ็ตรหัสผ่าน</p>
              </div>

              {error && (
                <Alert variant="danger" className="auth-alert">
                  <div className="alert-icon">⚠️</div>
                  <div className="alert-message">{error}</div>
                </Alert>
              )}

              {success ? (
                <Alert variant="success" className="auth-alert">
                  <div className="alert-icon">✅</div>
                  <div className="alert-message">
                    <strong>ส่งอีเมลสำเร็จ!</strong><br />
                    กรุณาตรวจสอบอีเมลของคุณเพื่อรีเซ็ตรหัสผ่าน
                    <br />
                    <small>หากไม่พบอีเมล กรุณาตรวจสอบในโฟลเดอร์ Spam</small>
                  </div>
                </Alert>
              ) : (
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
                        disabled={loading}
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
                        กำลังส่งอีเมล...
                      </>
                    ) : (
                      <>
                        <span className="btn-icon-dollar">📧</span>
                        <span className="btn-text">ส่งลิงก์รีเซ็ตรหัสผ่าน</span>
                      </>
                    )}
                  </Button>
                </Form>
              )}

              <div className="auth-divider">
                <span>หรือ</span>
              </div>

              <div className="auth-footer">
                <p className="auth-footer-text">
                  จำรหัสผ่านได้แล้ว?{' '}
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

export default ForgotPassword;




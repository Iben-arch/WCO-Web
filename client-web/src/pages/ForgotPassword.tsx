import React, { useState, FormEvent, ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../config/supabase';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

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
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-5">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex flex-col items-center gap-2 no-underline">
            <span className="text-6xl leading-none">🎴</span>
            <h1 className="m-0 text-3xl font-extrabold text-primary">WCO Thailand</h1>
            <p className="m-0 text-sm text-base-content/60 max-w-xs">
              เรามุ่งมั่นที่จะผลักดันวงการการ์ดเกมประเทศไทย
            </p>
          </Link>
        </div>

        <div className="card bg-base-100 border border-base-300 shadow-xl">
          <div className="card-body p-8">
            <h2 className="text-center text-2xl font-bold mb-1">ลืมรหัสผ่าน</h2>
            <p className="text-center text-sm text-base-content/60 mb-6">กรุณากรอกอีเมลเพื่อรับลิงก์รีเซ็ตรหัสผ่าน</p>

              {error && (
              <div className="alert alert-error mb-4">
                  <div className="alert-icon">⚠️</div>
                  <div className="alert-message">{error}</div>
              </div>
              )}

              {success ? (
              <div className="alert alert-success mb-4">
                  <div className="alert-icon">✅</div>
                  <div className="alert-message">
                    <strong>ส่งอีเมลสำเร็จ!</strong><br />
                    กรุณาตรวจสอบอีเมลของคุณเพื่อรีเซ็ตรหัสผ่าน
                    <br />
                    <small>หากไม่พบอีเมล กรุณาตรวจสอบในโฟลเดอร์ Spam</small>
                  </div>
              </div>
              ) : (
              <form onSubmit={handleSubmit}>
                <div className="form-control mb-5">
                  <label htmlFor="email" className="label pb-2">
                    <span className="label-text font-semibold">อีเมล</span>
                  </label>
                  <div className={`relative ${focusedField === 'email' || email ? 'focused' : ''}`}>
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="L22 6L12 13L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    <input
                        id="email"
                        type="email"
                        className="input input-bordered w-full pl-11"
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

                <button
                    type="submit"
                  className="btn btn-primary w-full h-12"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                      <span className="loading loading-spinner loading-sm me-2" />
                        กำลังส่งอีเมล...
                      </>
                    ) : (
                      <>
                        <span className="btn-icon-dollar">📧</span>
                        <span className="btn-text">ส่งลิงก์รีเซ็ตรหัสผ่าน</span>
                      </>
                    )}
                </button>
              </form>
              )}

            <div className="divider my-6">หรือ</div>

            <div className="text-center">
              <p className="text-sm text-base-content/70">
                  จำรหัสผ่านได้แล้ว?{' '}
                <Link to="/login" className="link link-primary font-bold no-underline">
                    เข้าสู่ระบบ
                  </Link>
                </p>
            </div>
          </div>
        </div>
        <div className="text-center mt-6">
          <Link to="/" className="link link-hover text-base-content/60 no-underline">
                ← กลับไปหน้าแรก
              </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;




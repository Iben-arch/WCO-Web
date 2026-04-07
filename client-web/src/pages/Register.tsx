import React, { useState, FormEvent, ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: '3rem',
  paddingLeft: '2.75rem',
  paddingRight: '1rem',
  fontSize: '0.875rem',
  border: '1.5px solid #e2e8f0',
  borderRadius: '0.75rem',
  outline: 'none',
  backgroundColor: 'white',
  color: '#1e293b',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  boxShadow: 'none',
};

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const EmailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const CheckLockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11L12 14L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

interface FieldProps {
  label: string;
  hint?: string;
  icon: React.ReactNode;
  type: string;
  name: string;
  value: string;
  placeholder: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  showToggle?: boolean;
  show?: boolean;
  onToggle?: () => void;
  autoComplete?: string;
  minLength?: number;
  pattern?: string;
}

const Field: React.FC<FieldProps> = ({ label, hint, icon, type, name, value, placeholder, onChange, showToggle, show, onToggle, autoComplete, minLength, pattern }) => {
  const focusBorder = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = '#0077B6';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 119, 182, 0.12)';
  };
  const blurBorder = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = '#e2e8f0';
    e.currentTarget.style.boxShadow = 'none';
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: '0.4rem' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', pointerEvents: 'none' }}>
          {icon}
        </span>
        <input
          type={showToggle ? (show ? 'text' : 'password') : type}
          name={name}
          style={{ ...inputStyle, paddingRight: showToggle ? '3rem' : '1rem' }}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onFocus={focusBorder}
          onBlur={blurBorder}
          required
          autoComplete={autoComplete}
          minLength={minLength}
          pattern={pattern}
        />
        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#94a3b8', display: 'flex' }}
            aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
          >
            {show ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {hint && (
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>{hint}</p>
      )}
    </div>
  );
};

const Register: React.FC = () => {
  const [formData, setFormData] = useState<RegisterFormData>({ username: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!formData.username || !formData.email || !formData.password) { setError('กรุณากรอกข้อมูลให้ครบถ้วน'); return; }
    if (formData.username.length < 3) { setError('ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) { setError('ชื่อผู้ใช้สามารถใช้ได้เฉพาะตัวอักษร ตัวเลข และ _ เท่านั้น'); return; }
    if (formData.password !== formData.confirmPassword) { setError('รหัสผ่านไม่ตรงกัน'); return; }
    if (formData.password.length < 6) { setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return; }
    try {
      setError('');
      setLoading(true);
      await register(formData.email, formData.password, formData.username);
      setShowSuccessModal(true);
    } catch (err: any) {
      console.error('Register error:', err);
      setError(err.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem', background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 45%, #ecfeff 100%)' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '3.5rem', lineHeight: 1 }}>🎴</span>
            <h1 style={{ margin: 0, fontSize: '1.625rem', fontWeight: 800, color: '#0077B6', letterSpacing: '-0.025em' }}>
              WCO Thailand
            </h1>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#94a3b8', maxWidth: '280px', lineHeight: 1.5 }}>
              เรามุ่งมั่นที่จะผลักดันวงการการ์ดเกมประเทศไทย
            </p>
          </Link>
        </div>

        {/* Card */}
        <div style={{ background: 'white', borderRadius: '1.5rem', padding: '2.5rem', boxShadow: '0 20px 60px -10px rgba(0, 119, 182, 0.15), 0 8px 24px -4px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
          <h2 style={{ textAlign: 'center', fontWeight: 700, fontSize: '1.25rem', color: '#0f172a', margin: '0 0 0.25rem' }}>
            สมัครสมาชิก
          </h2>
          <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
            สร้างบัญชีเพื่อซื้อขายการ์ดเกม
          </p>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '0.75rem', padding: '0.75rem 1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <span>⚠️</span><span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <Field label="ชื่อผู้ใช้" icon={<UserIcon />} type="text" name="username" value={formData.username} placeholder="ชื่อผู้ใช้ (อย่างน้อย 3 ตัวอักษร)" onChange={handleChange} hint="ใช้ได้เฉพาะตัวอักษร ตัวเลข และ _" autoComplete="username" minLength={3} pattern="[a-zA-Z0-9_]+" />
            <Field label="อีเมล" icon={<EmailIcon />} type="email" name="email" value={formData.email} placeholder="กรอกอีเมลของคุณ" onChange={handleChange} autoComplete="email" />
            <Field label="รหัสผ่าน" icon={<LockIcon />} type="password" name="password" value={formData.password} placeholder="รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)" onChange={handleChange} showToggle show={showPassword} onToggle={() => setShowPassword(!showPassword)} autoComplete="new-password" hint="อย่างน้อย 6 ตัวอักษร" />
            <Field label="ยืนยันรหัสผ่าน" icon={<CheckLockIcon />} type="password" name="confirmPassword" value={formData.confirmPassword} placeholder="ยืนยันรหัสผ่านอีกครั้ง" onChange={handleChange} showToggle show={showConfirmPassword} onToggle={() => setShowConfirmPassword(!showConfirmPassword)} autoComplete="new-password" />

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', height: '3rem', background: loading ? '#93c5fd' : 'linear-gradient(135deg, #0077B6 0%, #005A8E 100%)', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 700, fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem', transition: 'opacity 0.2s' }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.opacity = '0.92'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
            >
              {loading ? (
                <>
                  <span style={{ width: '1rem', height: '1rem', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  กำลังสมัครสมาชิก...
                </>
              ) : 'สมัครสมาชิก'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.5rem 0' }}>
            <div style={{ flex: 1, height: '1px', background: '#f1f5f9' }} />
            <span style={{ fontSize: '0.8125rem', color: '#cbd5e1', fontWeight: 500 }}>หรือ</span>
            <div style={{ flex: 1, height: '1px', background: '#f1f5f9' }} />
          </div>

          <p style={{ textAlign: 'center', fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
            มีบัญชีแล้ว?{' '}
            <Link to="/login" style={{ color: '#0077B6', fontWeight: 700, textDecoration: 'none' }}>
              เข้าสู่ระบบ
            </Link>
          </p>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to="/" style={{ fontSize: '0.875rem', color: '#94a3b8', textDecoration: 'none' }}>
            ← กลับไปหน้าแรก
          </Link>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', borderRadius: '1.5rem', padding: '2.5rem', maxWidth: '380px', width: '100%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', animation: 'fadeInUp 0.25s ease-out' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem', lineHeight: 1 }}>✅</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem' }}>
              สมัครสมาชิกสำเร็จ!
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#64748b', margin: '0 0 1.75rem', lineHeight: 1.6 }}>
              ยินดีต้อนรับสู่ <strong style={{ color: '#0077B6' }}>WCO Thailand</strong>
              <br />คุณเข้าสู่ระบบแล้ว สามารถเริ่มใช้งานได้เลย
            </p>
            <button
              onClick={() => { setShowSuccessModal(false); navigate('/'); }}
              style={{ background: 'linear-gradient(135deg, #0077B6 0%, #005A8E 100%)', color: 'white', border: 'none', borderRadius: '0.75rem', padding: '0.75rem 2.5rem', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}
            >
              เริ่มใช้งาน →
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default Register;

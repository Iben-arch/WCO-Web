import React, { useState, FormEvent, ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}


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
  return (
    <div className="form-control mb-4">
      <label className="label pb-2">
        <span className="label-text font-semibold">{label}</span>
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none">
          {icon}
        </span>
        <input
          type={showToggle ? (show ? 'text' : 'password') : type}
          name={name}
          className={`input input-bordered w-full pl-11 ${showToggle ? 'pr-11' : ''}`}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required
          autoComplete={autoComplete}
          minLength={minLength}
          pattern={pattern}
        />
        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="btn btn-ghost btn-xs absolute right-2 top-1/2 -translate-y-1/2"
            aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
          >
            {show ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {hint && (
        <p className="m-0 mt-1 text-xs text-base-content/50">{hint}</p>
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
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-5">
      <div className="w-full max-w-md">

        {/* Brand */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex flex-col items-center gap-2 no-underline">
            <span className="text-6xl leading-none">🎴</span>
            <h1 className="m-0 text-3xl font-extrabold text-primary">WCO Thailand</h1>
            <p className="m-0 text-sm text-base-content/60 max-w-xs">
              เรามุ่งมั่นที่จะผลักดันวงการการ์ดเกมประเทศไทย
            </p>
          </Link>
        </div>

        {/* Card */}
        <div className="card bg-base-100 border border-base-300 shadow-xl">
          <div className="card-body p-8">
            <h2 className="text-center text-2xl font-bold mb-1">สมัครสมาชิก</h2>
            <p className="text-center text-sm text-base-content/60 mb-6">สร้างบัญชีเพื่อซื้อขายการ์ดเกม</p>

          {error && (
            <div className="alert alert-error mb-5">
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
              className="btn btn-primary w-full h-12 mt-2"
            >
              {loading ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  กำลังสมัครสมาชิก...
                </>
              ) : 'สมัครสมาชิก'}
            </button>
          </form>

          <div className="divider my-6">หรือ</div>

          <p className="text-center text-sm text-base-content/70 m-0">
            มีบัญชีแล้ว?{' '}
            <Link to="/login" className="link link-primary font-bold no-underline">
              เข้าสู่ระบบ
            </Link>
          </p>
          </div>
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="link link-hover text-base-content/60 no-underline">
            ← กลับไปหน้าแรก
          </Link>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card bg-base-100 shadow-2xl max-w-sm w-full text-center animate-[fadeInUp_0.25s_ease-out]">
            <div className="card-body p-8">
              <div className="text-6xl mb-2">✅</div>
              <h3 className="text-2xl font-bold mb-2">
              สมัครสมาชิกสำเร็จ!
              </h3>
              <p className="text-sm text-base-content/70 mb-6 leading-relaxed">
                ยินดีต้อนรับสู่ <strong className="text-primary">WCO Thailand</strong>
                <br />คุณเข้าสู่ระบบแล้ว สามารถเริ่มใช้งานได้เลย
              </p>
              <button
                onClick={() => { setShowSuccessModal(false); navigate('/'); }}
                className="btn btn-primary"
              >
                เริ่มใช้งาน →
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default Register;

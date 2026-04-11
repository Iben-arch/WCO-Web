import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  adminOnly?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, adminOnly = false }) => {
  const { currentUser, userProfile, profile, loading, profileReady } = useAuth();

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '50vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  // Only redirect if we're sure there's no user (after loading is complete)
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // รอโหลด profile ก่อนตัดสิทธิ์ admin — ไม่งั้นแอดมินถูกส่งกลับหน้าแรกชั่วคราวขณะ userProfile ยังเป็น null
  if (adminOnly && !profileReady) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '50vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  // Check admin access (ใช้ทั้ง profile / userProfile หลังโหลดเสร็จ)
  const role = profile?.role ?? userProfile?.role;
  const isAdmin = role === 'admin' || userProfile?.isAdmin === true;
  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;


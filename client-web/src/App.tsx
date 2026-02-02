import React, { Component, ReactNode, ErrorInfo } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'bootstrap/dist/css/bootstrap.min.css';

import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import Navbar from './components/layout/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Profile from './pages/Profile';
import PostDetail from './pages/PostDetail';
import CreatePost from './pages/CreatePost';
import CardBuying from './pages/MyPosts';
import AdminDashboard from './pages/AdminDashboard';
import SellerProfile from './pages/SellerProfile';
import Cart from './pages/Cart';
import ProtectedRoute from './components/layout/ProtectedRoute';

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="container py-5">
          <div className="alert alert-danger">
            <h4>เกิดข้อผิดพลาด</h4>
            <p>กรุณารีเฟรชหน้าเว็บหรือติดต่อผู้ดูแลระบบ</p>
            <button 
              className="btn btn-primary" 
              onClick={() => window.location.reload()}
            >
              รีเฟรชหน้า
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CartProvider>
              <Router>
                <div className="App">
                  <Navbar />
                  <main className="container-fluid px-0">
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/register" element={<Register />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                      <Route path="/profile" element={
                        <ProtectedRoute>
                          <Profile />
                        </ProtectedRoute>
                      } />
                      <Route path="/buy-request" element={
                        <ProtectedRoute>
                          <CardBuying />
                        </ProtectedRoute>
                      } />
                      <Route path="/post/:id" element={<PostDetail />} />
                      <Route path="/seller/:sellerId" element={<SellerProfile />} />
                      <Route path="/create-post" element={
                        <ProtectedRoute>
                          <CreatePost />
                        </ProtectedRoute>
                      } />
                      <Route path="/my-posts" element={
                        <ProtectedRoute>
                          <Profile initialTab="my-posts" />
                        </ProtectedRoute>
                      } />
                      <Route path="/admin" element={
                        <ProtectedRoute adminOnly>
                          <AdminDashboard />
                        </ProtectedRoute>
                      } />
                      <Route path="/cart" element={
                        <ProtectedRoute>
                          <Cart />
                        </ProtectedRoute>
                      } />
                    </Routes>
                  </main>
                  <ToastContainer
                    position="top-right"
                    autoClose={3000}
                    hideProgressBar={false}
                    newestOnTop={false}
                    closeOnClick
                    rtl={false}
                    pauseOnFocusLoss
                    draggable
                    pauseOnHover
                  />
                </div>
              </Router>
        </CartProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;


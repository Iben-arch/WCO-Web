import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from '../utils/axiosInterceptor';
import { setAuthContext } from '../utils/axiosInterceptor';
import { User, UserProfile, AuthContextType } from '../types';
import { authAPI } from '../api/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const login = async (email: string, password: string): Promise<User> => {
    try {
      // ใช้ backend API สำหรับ login
      const response = await authAPI.login(email, password);
      
      // Store token and user info in localStorage
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('refreshToken', response.refreshToken);
      localStorage.setItem('userId', response.userId);
      localStorage.setItem('userEmail', response.email);
      
      // Set axios default header
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.token}`;
      
      // Create a user object
      const user: User = {
        uid: response.userId,
        email: response.email,
        displayName: undefined
      };
      
      // Update current user state
      setCurrentUser(user);
      
      // ดึงข้อมูล user profile จาก Supabase ผ่าน backend API
      try {
        await fetchUserProfile(user);
      } catch (profileError: any) {
        console.warn('Could not fetch user profile from Supabase:', profileError);
        // ถ้าไม่มี profile ใน Supabase อาจเป็น user เก่าที่ยังไม่มี profile
        // ไม่ throw error เพื่อให้ login ผ่านได้
      }
      
      return user;
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Handle API errors
      let errorMessage = 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      const authError = new Error(errorMessage);
      throw authError;
    }
  };

  const register = async (email: string, password: string, displayName: string, profileImage?: string): Promise<User> => {
    try {
      // ใช้ backend API สำหรับ register
      const response = await authAPI.register(email, password, displayName);
      
      // Store token and user info in localStorage
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('refreshToken', response.refreshToken);
      localStorage.setItem('userId', response.userId);
      localStorage.setItem('userEmail', response.email);
      
      // Set axios default header
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.token}`;
      
      // Create a user object
      const user: User = {
        uid: response.userId,
        email: response.email,
        displayName: displayName
      };
      
      // Update current user state
      setCurrentUser(user);
      
      // สร้าง profile ใน Supabase ผ่าน backend API
      // กำหนด accountName - ใช้ displayName ถ้ามี หรือใช้ email แทน
      const accountName = displayName || email.split('@')[0];
      
      try {
        // เรียก API เพื่อสร้าง profile ใน Supabase
        const profileData: any = {
          accountName: accountName,
          displayName: displayName || accountName,
          email: response.email || email,
        };
        
        // ถ้ามี profileImage ให้ส่งไปด้วย
        if (profileImage) {
          profileData.profileImage = profileImage;
        }
        
        // สร้าง profile ใน Supabase (backend จะสร้าง createdAt, updatedAt, registrationDate, isActive, uid ให้อัตโนมัติ)
        await authAPI.updateProfile(profileData);
        
        // Fetch profile ที่สร้างเสร็จแล้ว
        const createdProfile = await authAPI.getProfile();
        setUserProfile(createdProfile);
      } catch (profileError: any) {
        console.warn('Could not create user profile in Supabase:', profileError);
        // ถ้าไม่สามารถสร้าง profile ได้ ให้ตั้งค่า profile ชั่วคราว
        // Profile อาจถูกสร้างในภายหลังเมื่อ user login หรือแก้ไข profile
        setUserProfile({
          displayName: displayName,
          accountName: accountName,
          email: response.email || '',
          photoURL: profileImage,
          isAdmin: false
        });
      }
      
      return user;
    } catch (error: any) {
      console.error('Register error:', error);
      
      // Handle API errors
      let errorMessage = 'เกิดข้อผิดพลาดในการสมัครสมาชิก';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      const authError = new Error(errorMessage);
      throw authError;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      // Clear all stored data
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userId');
      localStorage.removeItem('userEmail');
      delete axios.defaults.headers.common['Authorization'];
      setCurrentUser(null);
      setUserProfile(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const updateProfile = async (profileData: any): Promise<any> => {
    try {
      const response = await authAPI.updateProfile(profileData);
      setUserProfile(response.user);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const fetchUserProfile = async (user: User): Promise<void> => {
    try {
      const profile = await authAPI.getProfile();
      if (profile) {
        setUserProfile(profile);
      } else {
        console.warn('Profile not found in Supabase for user:', user.uid);
        setUserProfile(null);
      }
    } catch (error: any) {
      // ถ้า profile ไม่มีใน Supabase (404) ก็ไม่ใช่ error ร้ายแรง
      if (error.response?.status === 404) {
        console.warn('Profile not found in Supabase for user:', user.uid);
        setUserProfile(null);
        return;
      }
      
      console.error('Error fetching user profile:', error);
      // Only log error if it's not a network error (server might be down)
      if (error.response) {
        console.error('Server returned error:', error.response.status, error.response.data);
      } else if (error.request) {
        console.warn('No response from server - server might be down');
      }
      setUserProfile(null);
      // ไม่ throw error เพื่อให้ login ผ่านได้แม้จะดึง profile ไม่ได้
    }
  };

  const refreshToken = async (): Promise<string | null> => {
    try {
      const storedRefreshToken = localStorage.getItem('refreshToken');
      if (!storedRefreshToken || !currentUser) {
        console.warn('No refresh token or user available for token refresh');
        await logout();
        return null;
      }

      // ใช้ backend API เพื่อ refresh token
      const response = await authAPI.refreshToken(storedRefreshToken);
      
      // Update token in localStorage
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('refreshToken', response.refreshToken);
      localStorage.setItem('userId', response.userId);
      localStorage.setItem('userEmail', response.email);
      
      // Update axios default header with new token
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.token}`;
      
      console.log('Token refreshed successfully');
      return response.token;
    } catch (error: any) {
      console.error('Token refresh error:', error);
      // If refresh fails, logout the user
      await logout();
      throw error;
    }
  };

  useEffect(() => {
    // Check if user is already logged in (has token in localStorage)
    const checkAuthState = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const userId = localStorage.getItem('userId');
        const userEmail = localStorage.getItem('userEmail');

        if (token && userId) {
          // Set axios header
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // Create user object
          const user: User = {
            uid: userId,
            email: userEmail || undefined,
            displayName: undefined
          };
          
          setCurrentUser(user);
          
          // ดึงข้อมูล user profile จาก Supabase ผ่าน backend API
          try {
            await fetchUserProfile(user);
          } catch (profileError: any) {
            console.warn('Could not fetch user profile on mount:', profileError);
            // ถ้าไม่มี profile ใน Supabase อาจเป็น user เก่าที่ยังไม่มี profile
          }
        } else {
          // No token found, user is not logged in
          setCurrentUser(null);
          setUserProfile(null);
        }
      } catch (error: any) {
        console.error('Error checking auth state:', error);
        // If there's an error, clear everything
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('userEmail');
        delete axios.defaults.headers.common['Authorization'];
        setCurrentUser(null);
        setUserProfile(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuthState();
  }, []);

  const value: AuthContextType = {
    currentUser,
    userProfile,
    login,
    register,
    logout,
    updateProfile,
    refreshToken,
    loading
  };

  // Set auth context for axios interceptor
  useEffect(() => {
    setAuthContext(value);
  }, [value]);

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

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
      // Call server API for login
      const response = await authAPI.login(email, password);
      
      // Store token and user info in localStorage
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('userId', response.userId);
      localStorage.setItem('userEmail', response.email);
      if (response.refreshToken) {
        localStorage.setItem('refreshToken', response.refreshToken);
      }
      
      // Set axios default header
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.token}`;
      
      // Create a minimal user object for compatibility
      // Note: This is a simplified user object since we're not using Firebase SDK directly
      const user: any = {
        uid: response.userId,
        email: response.email,
        getIdToken: async () => response.token
      };
      
      // Update current user state
      setCurrentUser(user);
      
      // Fetch user profile
      try {
        await fetchUserProfile(user);
      } catch (profileError) {
        console.warn('Could not fetch user profile:', profileError);
      }
      
      return user;
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Handle server errors
      if (error.response?.data?.error) {
        const serverError = new Error(error.response.data.error);
        (serverError as any).code = error.response.data.error;
        throw serverError;
      }
      
      throw error;
    }
  };

  const register = async (email: string, password: string, displayName: string): Promise<User> => {
    try {
      // Call server API for registration
      const response = await authAPI.register(email, password, displayName);
      
      // Store token and user info in localStorage
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('userId', response.userId);
      localStorage.setItem('userEmail', response.email);
      if (response.refreshToken) {
        localStorage.setItem('refreshToken', response.refreshToken);
      }
      
      // Set axios default header
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.token}`;
      
      // Create a minimal user object for compatibility
      const user: any = {
        uid: response.userId,
        email: response.email,
        displayName: displayName,
        getIdToken: async () => response.token
      };
      
      // Update current user state
      setCurrentUser(user);
      
      // Fetch user profile (should be created by server)
      try {
        await fetchUserProfile(user);
      } catch (profileError) {
        console.warn('Could not fetch user profile:', profileError);
      }
      
      return user;
    } catch (error: any) {
      console.error('Register error:', error);
      
      // Handle server errors
      if (error.response?.data?.error) {
        const serverError = new Error(error.response.data.error);
        (serverError as any).code = error.response.data.error;
        throw serverError;
      }
      
      throw error;
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
      setUserProfile(profile);
    } catch (error: any) {
      console.error('Error fetching user profile:', error);
      // Only log error if it's not a network error (server might be down)
      if (error.response) {
        console.error('Server returned error:', error.response.status, error.response.data);
      } else if (error.request) {
        console.warn('No response from server - server might be down');
      }
      setUserProfile(null);
    }
  };

  const refreshToken = async (): Promise<string | null> => {
    try {
      // For now, we'll use the stored token
      // In the future, we can implement token refresh using refreshToken
      const token = localStorage.getItem('authToken');
      if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        return token;
      }
      return null;
    } catch (error) {
      console.error('Token refresh error:', error);
      // If refresh fails, logout the user
      await logout();
      throw error;
    }
  };

  useEffect(() => {
    // Check if user is already logged in (has token)
    const token = localStorage.getItem('authToken');
    
    if (token) {
      // Set axios header
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Try to fetch user profile to verify token is still valid
      // Create a minimal user object for compatibility
      const userId = localStorage.getItem('userId');
      const email = localStorage.getItem('userEmail');
      
      if (userId && email) {
        const user: any = {
          uid: userId,
          email: email,
          getIdToken: async () => token
        };
        setCurrentUser(user);
        
        // Fetch user profile
        fetchUserProfile(user).catch(error => {
          console.warn('Could not fetch user profile on mount:', error);
          // If profile fetch fails, token might be invalid
          if (error.response?.status === 401) {
            // Token is invalid, clear everything
            localStorage.removeItem('authToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('userId');
            localStorage.removeItem('userEmail');
            delete axios.defaults.headers.common['Authorization'];
            setCurrentUser(null);
            setUserProfile(null);
          }
        });
      }
    }
    
    setLoading(false);
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


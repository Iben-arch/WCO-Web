import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { auth } from '../config/firebase';
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
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const login = async (email: string, password: string): Promise<FirebaseUser> => {
    try {
      if (!auth) {
        throw new Error('Firebase authentication is not configured. Please check your Firebase setup.');
      }
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const token = await userCredential.user.getIdToken();
      
      // Store token in localStorage
      localStorage.setItem('authToken', token);
      
      // Set axios default header
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      return userCredential.user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (email: string, password: string, displayName: string): Promise<FirebaseUser> => {
    try {
      if (!auth) {
        throw new Error('Firebase authentication is not configured. Please check your Firebase setup.');
      }
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const token = await userCredential.user.getIdToken();
      
      // Store token in localStorage
      localStorage.setItem('authToken', token);
      
      // Set axios default header
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Create user profile (optional - only if server is available)
      try {
        await authAPI.createProfile({
          displayName,
          email: userCredential.user.email || undefined
        });
      } catch (profileError) {
        console.warn('Could not create user profile on server:', profileError);
        // Continue with registration even if profile creation fails
      }
      
      return userCredential.user;
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      if (auth) {
        await signOut(auth);
      }
      localStorage.removeItem('authToken');
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

  const fetchUserProfile = async (user: FirebaseUser): Promise<void> => {
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
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken(true); // Force refresh
        localStorage.setItem('authToken', token);
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
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          setCurrentUser(user);
          
          // Get stored token
          const token = localStorage.getItem('authToken');
          if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            await fetchUserProfile(user);
          }
        } else {
          setCurrentUser(null);
          setUserProfile(null);
          localStorage.removeItem('authToken');
          delete axios.defaults.headers.common['Authorization'];
        }
      } catch (error) {
        console.error('Auth state change error:', error);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    currentUser: currentUser as User | null,
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


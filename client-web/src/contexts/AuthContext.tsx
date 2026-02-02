import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserProfile, Profile, AuthContextType } from '../types';
import { supabase } from '../config/supabase';
import { clearSessionCache } from '../utils/axiosInterceptor';

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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch profile from profiles table
  const fetchProfile = async (userId: string): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Profile not found - this is okay for new users
          console.warn('Profile not found for user:', userId);
          setProfile(null);
          setUserProfile(null);
          return;
        }
        throw error;
      }

      if (data) {
      setProfile(data);
      // Also update userProfile for backward compatibility
      setUserProfile({
        id: data.id,
        username: data.username,
        displayName: data.username, // Map username to displayName for backward compatibility
        avatar_url: data.avatar_url,
        photoURL: data.avatar_url, // Map avatar_url to photoURL for backward compatibility
        role: data.role,
        isAdmin: data.role === 'admin',
        phone: data.phone || undefined,
        address: data.address || undefined,
        email: currentUser?.email || undefined
      });
      }
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      setProfile(null);
      setUserProfile(null);
    }
  };

  const login = async (email: string, password: string): Promise<User> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        let errorMessage = 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ';
        } else {
          errorMessage = error.message;
        }
        throw new Error(errorMessage);
      }

      if (!data.user) {
        throw new Error('ไม่พบข้อมูลผู้ใช้');
      }

      setCurrentUser(data.user);
      
      // โหลด profile ในพื้นหลัง ไม่บล็อกการ navigate (แก้ปัญหา loading ค้าง)
      fetchProfile(data.user.id).catch((err) => console.error('Profile fetch after login:', err));

      return data.user;
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (email: string, password: string, username: string): Promise<User> => {
    try {
      // Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username
          }
        }
      });

      if (error) {
        let errorMessage = 'เกิดข้อผิดพลาดในการสมัครสมาชิก';
        if (error.message.includes('User already registered')) {
          errorMessage = 'อีเมลนี้ถูกใช้งานแล้ว';
        } else if (error.message.includes('Password')) {
          errorMessage = 'รหัสผ่านไม่ตรงตามข้อกำหนด';
        } else {
          errorMessage = error.message;
        }
        throw new Error(errorMessage);
      }

      if (!data.user) {
        throw new Error('ไม่สามารถสร้างบัญชีได้');
      }

      // Create profile row
      try {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            username: username,
            role: 'user'
          });

        if (profileError) {
          // If profile creation fails, log but don't fail registration
          // The trigger should handle this, but we try manually as backup
          console.warn('Could not create profile automatically:', profileError);
        }
      } catch (profileError: any) {
        console.warn('Profile creation error (non-critical):', profileError);
      }

      setCurrentUser(data.user);
      
      // โหลด profile ในพื้นหลัง ไม่บล็อกการ navigate
      fetchProfile(data.user.id).catch((err) => console.error('Profile fetch after register:', err));

      return data.user;
    } catch (error: any) {
      console.error('Register error:', error);
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      clearSessionCache();
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      
      setCurrentUser(null);
      setUserProfile(null);
      setProfile(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const updateProfile = async (profileData: any): Promise<Profile> => {
    try {
      if (!currentUser) {
        throw new Error('ต้องเข้าสู่ระบบก่อน');
      }

      // Map old field names to new schema for backward compatibility
      const updateData: Partial<Profile> = {
        updated_at: new Date().toISOString()
      };

      if (profileData.username !== undefined) {
        updateData.username = profileData.username;
      }
      if (profileData.avatar_url !== undefined) {
        updateData.avatar_url = profileData.avatar_url;
      }
      // Map photoURL to avatar_url for backward compatibility
      if (profileData.photoURL !== undefined) {
        updateData.avatar_url = profileData.photoURL;
      }
      if (profileData.profileImage !== undefined) {
        updateData.avatar_url = profileData.profileImage;
      }
      if (profileData.phone !== undefined) {
        updateData.phone = profileData.phone;
      }
      if (profileData.address !== undefined) {
        updateData.address = profileData.address;
      }
      // Map displayName to username for backward compatibility
      if (profileData.displayName !== undefined && !profileData.username) {
        updateData.username = profileData.displayName;
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', currentUser.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error('ไม่พบข้อมูลโปรไฟล์');
      }

      setProfile(data);
      setUserProfile({
        id: data.id,
        username: data.username,
        displayName: data.username, // Map username to displayName for backward compatibility
        avatar_url: data.avatar_url,
        photoURL: data.avatar_url, // Map avatar_url to photoURL for backward compatibility
        role: data.role,
        isAdmin: data.role === 'admin',
        phone: data.phone || undefined,
        address: data.address || undefined,
        email: currentUser.email || undefined
      });

      return data;
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  };

  // Check auth state on mount and listen for changes
  useEffect(() => {
    let mounted = true;

    // Timeout fallback - prevent blank screen if Supabase is slow/unreachable (5 วินาที)
    const timeoutId = setTimeout(() => {
      if (mounted) {
        console.warn('Auth session check timed out - showing app anyway');
        setLoading(false);
      }
    }, 5000);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) return;
      clearTimeout(timeoutId);
      
      if (error) {
        console.error('Error getting session:', error);
        setCurrentUser(null);
        setUserProfile(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (session?.user) {
        setCurrentUser(session.user);
        fetchProfile(session.user.id).catch((err) => {
          console.error('Error fetching profile on mount:', err);
          // Don't clear user if profile fetch fails - user is still authenticated
        });
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setProfile(null);
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        clearTimeout(timeoutId);

        // Handle token refresh
        if (event === 'TOKEN_REFRESHED' && session?.user) {
          setCurrentUser(session.user);
          return;
        }

        if (session?.user) {
          setCurrentUser(session.user);
          await fetchProfile(session.user.id).catch((err) => {
            console.error('Error fetching profile on auth change:', err);
            // Don't clear user if profile fetch fails
          });
        } else {
          // Only clear user on explicit sign out or session expiration
          if (event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
            setCurrentUser(null);
            setUserProfile(null);
            setProfile(null);
          }
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextType = {
    currentUser,
    userProfile,
    profile,
    login,
    register,
    logout,
    updateProfile,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

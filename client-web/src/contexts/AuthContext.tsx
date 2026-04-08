import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserProfile, Profile, AuthContextType } from '../types';
import { supabase } from '../config/supabase';
import { clearSessionCache } from '../utils/axiosInterceptor';
import { authAPI } from '../api/api';
import { canSellCards } from '../utils/roles';

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
          // โปรไฟล์ใหม่รองรับสถานะแบนจากคอลัมน์ is_banned
          isBanned: (data as any).is_banned === true,
          phone: data.phone || undefined,
          address: data.address || undefined,
          seller_contact_note: (data as any).seller_contact_note || undefined,
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
      // ยิงผ่าน API แทนที่จะเรียก Supabase โดยตรง — server ทำ ban-check และส่ง session กลับ
      let sessionData: Awaited<ReturnType<typeof authAPI.login>>;
      try {
        sessionData = await authAPI.login(email, password);
      } catch (apiErr: any) {
        const serverMsg =
          apiErr?.response?.data?.error ||
          apiErr?.response?.data?.message ||
          apiErr?.message ||
          'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
        throw new Error(serverMsg);
      }

      // ตั้ง Supabase session จาก tokens ที่ได้จาก server
      const { data, error } = await supabase.auth.setSession({
        access_token: sessionData.access_token,
        refresh_token: sessionData.refresh_token,
      });

      if (error) throw new Error(error.message);
      if (!data.user) throw new Error('ไม่พบข้อมูลผู้ใช้');

      setCurrentUser(data.user);
      fetchProfile(data.user.id).catch((err) => console.error('Profile fetch after login:', err));

      return data.user;
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const loginWithGoogle = async (): Promise<void> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw new Error(error.message);
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

  const applyAsSeller = async (payload: {
    agreedToTerms: boolean;
    bankName: string;
    bankAccountNumber: string;
  }): Promise<void> => {
    if (!currentUser) {
      throw new Error('ต้องเข้าสู่ระบบก่อน');
    }
    await authAPI.applyAsSeller(payload);
    await fetchProfile(currentUser.id);
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
      if (profileData.bank_name !== undefined) {
        (updateData as any).bank_name = profileData.bank_name;
      }
      if (profileData.bank_account_number !== undefined) {
        (updateData as any).bank_account_number = profileData.bank_account_number;
      }
      if (profileData.seller_contact_note !== undefined) {
        (updateData as any).seller_contact_note = profileData.seller_contact_note;
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
        seller_contact_note: (data as any).seller_contact_note || undefined,
        email: currentUser.email || undefined
      });

      return data;
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  };

  // ดึงโปรไฟล์จาก Backend API (GET /api/auth/profile) — ใช้เมื่อเข้าหน้าโปรไฟล์
  const refreshProfileFromApi = async (): Promise<void> => {
    if (!currentUser) return;
    try {
      const user = await authAPI.getProfile() as Record<string, unknown>;
      const mapped: UserProfile = {
        id: (user.id as string) ?? (user.uid as string) ?? currentUser.id,
        username: (user.username as string) ?? (user.displayName as string) ?? (user.accountname as string),
        displayName: (user.displayName as string) ?? (user.accountname as string) ?? (user.username as string),
        avatar_url: (user.photoURL as string) ?? (user.avatar_url as string),
        photoURL: (user.photoURL as string) ?? (user.avatar_url as string),
        role: user.role as string,
        isAdmin: (user.role as string) === 'admin',
        phone: user.phone as string | undefined,
        address: user.address as string | undefined,
        email: (user.email as string) ?? currentUser.email ?? undefined
      };
      setUserProfile((prev) => (prev ? { ...prev, ...mapped } : mapped));
    } catch (err) {
      // Backend อาจยังไม่มี users table หรือ API 404 — ใช้โปรไฟล์จาก Supabase ต่อ
      console.warn('Could not refresh profile from API (using Supabase profile):', err);
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
      (event, session) => {
        if (!mounted) return;
        clearTimeout(timeoutId);

        // Handle token refresh
        if (event === 'TOKEN_REFRESHED' && session?.user) {
          setCurrentUser(session.user);
          setLoading(false);
          return;
        }

        if (session?.user) {
          setCurrentUser(session.user);
          // โหลด profile ในพื้นหลัง ไม่บล็อก setLoading (แก้ปัญหา loading ค้างหลังสมัครสมาชิก)
          fetchProfile(session.user.id).catch((err) => {
            console.error('Error fetching profile on auth change:', err);
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
    loginWithGoogle,
    register,
    logout,
    updateProfile,
    applyAsSeller,
    refreshProfileFromApi,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

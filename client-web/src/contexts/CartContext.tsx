import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { Post, CartItem, CartContextType } from '../types';
import { cartAPI } from '../api/api';

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const { currentUser } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load cart items when user logs in
  useEffect(() => {
    if (currentUser) {
      fetchCartItems();
    } else {
      setCartItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const fetchCartItems = async (): Promise<void> => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      setError(null);
      const items = await cartAPI.getCartItems();
      setCartItems(items);
    } catch (error: any) {
      console.error('Error fetching cart items:', error);
      // Only set error if it's not a network error (server might be down)
      if (error.response) {
        setError('เกิดข้อผิดพลาดในการโหลดตะกร้า');
      }
      // On network errors, just set empty cart
      setCartItems([]);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (post: Post): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) {
      throw new Error('กรุณาเข้าสู่ระบบก่อน');
    }

    try {
      const result = await cartAPI.addToCart(post.id);
      if (result.success) {
        // Refresh cart items
        await fetchCartItems();
      }
      return result;
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      return { success: false, message: 'เกิดข้อผิดพลาดในการเพิ่มตะกร้า' };
    }
  };

  const removeFromCart = async (postId: string): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'กรุณาเข้าสู่ระบบ' };

    try {
      const result = await cartAPI.removeFromCart(postId);
      if (result.success) {
        // Refresh cart items
        await fetchCartItems();
      }
      return result;
    } catch (error: any) {
      console.error('Error removing from cart:', error);
      return { success: false, message: 'เกิดข้อผิดพลาดในการลบจากตะกร้า' };
    }
  };

  const clearCart = async (): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'กรุณาเข้าสู่ระบบ' };

    try {
      const result = await cartAPI.clearCart();
      if (result.success) {
        setCartItems([]);
      }
      return result;
    } catch (error: any) {
      console.error('Error clearing cart:', error);
      return { success: false, message: 'เกิดข้อผิดพลาดในการล้างตะกร้า' };
    }
  };

  const isInCart = (postId: string): boolean => {
    return cartItems.some(item => item.postId === postId);
  };

  const getCartCount = (): number => {
    return cartItems.length;
  };

  const getTotalPrice = (): number => {
    return cartItems.reduce((total, item) => {
      const price = item.post.price || item.post.startingBid || item.post.maxPrice || 0;
      return total + price;
    }, 0);
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB'
    }).format(price);
  };

  const value: CartContextType = {
    cartItems,
    loading,
    error,
    addToCart,
    removeFromCart,
    clearCart,
    isInCart,
    getCartCount,
    getTotalPrice,
    formatPrice,
    fetchCartItems
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};


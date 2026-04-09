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
      // Ensure items is an array
      setCartItems(Array.isArray(items) ? items : []);
    } catch (error: any) {
      console.error('Error fetching cart items:', error);
      // For all errors, just set empty cart instead of showing error
      // This provides better UX - empty cart is better than error message
      setCartItems([]);
      setError(null); // Clear error to show empty state instead
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (post: Post, cardId?: string, quantity?: number): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) {
      throw new Error('กรุณาเข้าสู่ระบบก่อน');
    }

    try {
      const result = await cartAPI.addToCart(post.id, cardId, quantity);
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

  const removeFromCart = async (itemId: string, cardId?: string): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'กรุณาเข้าสู่ระบบ' };

    try {
      const result = await cartAPI.removeFromCart(itemId, cardId);
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
        await fetchCartItems();
      }
      return result;
    } catch (error: any) {
      console.error('Error clearing cart:', error);
      return { success: false, message: 'เกิดข้อผิดพลาดในการล้างตะกร้า' };
    }
  };

  const isInCart = (postId: string, cardId?: string): boolean => {
    if (cardId) {
      return cartItems.some(item => item.postId === postId && item.cardId === cardId);
    }
    return cartItems.some(item => item.postId === postId && !item.cardId);
  };

  /** จำนวนชิ้นของโพสต์/การ์ดนี้ที่อยู่ในตะกร้าของผู้ใช้ (ใช้แสดง "เหลือ N ใบ") */
  const getQuantityInCart = (postId: string, cardId?: string): number => {
    return cartItems
      .filter(item => item.postId === postId && (cardId ? item.cardId === cardId : !item.cardId))
      .reduce((sum, item) => sum + (item.quantity ?? 1), 0);
  };

  const getCartCount = (): number => {
    return cartItems.length;
  };

  /** ราคาต่อหน่วย: ถ้ามี cardId ใช้ราคาจาก individualCards[].price ก่อน (ให้ตรงกับที่กดในโพสต์) */
  const getItemUnitPrice = (item: CartItem): number => {
    if (item.unitPrice != null && item.unitPrice > 0) return item.unitPrice;
    if (item.cardId && item.post.individualCards?.length) {
      const card = item.post.individualCards.find((c: { id?: string }) => c.id === item.cardId);
      if (card && typeof (card as { price?: number }).price === 'number') return (card as { price: number }).price;
    }
    return item.post.individualPrice ?? item.post.price ?? item.post.currentBid ?? item.post.startingBid ?? item.post.maxPrice ?? 0;
  };

  const getTotalPrice = (): number => {
    return cartItems.reduce((total, item) => {
      const price = getItemUnitPrice(item);
      const qty = item.quantity ?? 1;
      return total + price * qty;
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
    getQuantityInCart,
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


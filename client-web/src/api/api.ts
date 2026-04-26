/**
 * API Service - Centralized API calls to backend server
 * All API requests should go through this service
 */

import axios from '../utils/axiosInterceptor';
import { Post, UserProfile, CartItem, AuctionBid, AiScreeningResult } from '../types';

// Get API base URL
const getApiBaseUrl = (): string => {
  const apiUrl = process.env.REACT_APP_SERVER_URL || process.env.REACT_APP_API_URL;
  
  if (process.env.NODE_ENV === 'production' && apiUrl) {
    return apiUrl;
  }
  // Development: Use empty string to let React proxy handle routing
  return '';
};

// Configure axios base URL
const apiBaseUrl = getApiBaseUrl();
if (apiBaseUrl) {
  axios.defaults.baseURL = apiBaseUrl;
} else {
  axios.defaults.baseURL = '';
}

// ==================== AUTH API ====================
export const authAPI = {
  // Login — server ยิง Supabase Auth แล้วส่ง session กลับ
  login: async (email: string, password: string): Promise<{
    success: boolean;
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    user?: any;
  }> => {
    try {
      const response = await axios.post('/api/auth/login', { email, password });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  // Register
  register: async (email: string, password: string, displayName?: string): Promise<{ userId: string; email: string; user: any }> => {
    try {
      const payload: any = {
        email,
        password
      };
      
      if (displayName) {
        payload.displayName = displayName;
      }
      
      const response = await axios.post('/api/auth/register', payload);
      return response.data;
    } catch (error: any) {
      console.error('Register error:', error);
      if (error.response?.data) {
        console.error('Error response:', error.response.data);
      }
      throw error;
    }
  },

  // Create/Update user profile
  createProfile: async (profileData: { displayName: string; email?: string }): Promise<any> => {
    try {
      const response = await axios.post('/api/auth/profile', profileData);
      return response.data;
    } catch (error: any) {
      console.warn('Could not create user profile on server:', error);
      throw error;
    }
  },

  // Get user profile
  getProfile: async (): Promise<UserProfile> => {
    try {
      const response = await axios.get('/api/auth/profile');
      return response.data.user;
    } catch (error: any) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  },

  // Update user profile
  updateProfile: async (profileData: any): Promise<any> => {
    try {
      const response = await axios.post('/api/auth/profile', profileData);
      return response.data;
    } catch (error: any) {
      console.error('Error updating profile:', error);
      throw error;
    }
  },

  /** สมัครเป็นผู้ขาย (ข้อตกลง + ธนาคาร/เลขบัญชี) — อัปเดต role ที่เซิร์ฟเวอร์ */
  applyAsSeller: async (payload: {
    agreedToTerms: boolean;
    bankName: string;
    bankAccountNumber: string;
  }): Promise<{ success: boolean; message?: string }> => {
    const response = await axios.post('/api/auth/apply-seller', {
      agreedToTerms: payload.agreedToTerms,
      bankName: payload.bankName,
      bankAccountNumber: payload.bankAccountNumber
    });
    return response.data;
  },

  // Check if user liked a post (สำหรับ PostDetail - single)
  checkLike: async (postId: string): Promise<{ liked: boolean }> => {
    try {
      const response = await axios.get(`/api/auth/check-like/${postId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error checking like status:', error);
      return { liked: false };
    }
  },

  // Check liked status สำหรับหลาย posts พร้อมกัน (batch - แก้ N+1 สำหรับหน้า Home)
  checkLikes: async (postIds: string[]): Promise<{ likedPostIds: string[] }> => {
    try {
      if (postIds.length === 0) return { likedPostIds: [] };
      const response = await axios.get(`/api/auth/check-likes`, {
        params: { postIds: postIds.join(',') }
      });
      return response.data;
    } catch (error: any) {
      console.error('Error checking likes batch:', error);
      return { likedPostIds: [] };
    }
  },

  // Toggle like on a post
  toggleLike: async (postId: string): Promise<any> => {
    try {
      const response = await axios.post(`/api/auth/like/${postId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error toggling like:', error);
      throw error;
    }
  },

  // Refresh token
  // REMOVED: refreshToken - Token system is no longer used
};

// ==================== POSTS API ====================
export const postsAPI = {
  // Get all posts with filters, pagination, and sorting
  getPosts: async (params?: {
    category?: string;
    search?: string;
    sortBy?: string;
    postType?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<Post[]> => {
    try {
      const response = await axios.get('/api/posts', { params });
      // Backend returns { posts: [...], pagination: {...} }
      return response.data.posts || response.data || [];
    } catch (error: any) {
      console.error('Error fetching posts:', error);
      // Return empty array if server is not available or timeout (ป้องกัน loading ค้าง)
      const isNetworkError = error.code === 'ECONNREFUSED' || 
        error.code === 'ECONNABORTED' ||
        error.message?.includes('Network Error') ||
        error.message?.includes('timeout');
      if (isNetworkError) {
        console.warn('Server not available or timeout, returning empty posts array');
        return [];
      }
      throw error;
    }
  },

  // Get single post by ID
  getPost: async (postId: string): Promise<Post> => {
    try {
      const response = await axios.get(`/api/posts/${postId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching post:', error);
      throw error;
    }
  },

  // Create new post (postData includes imageUrls, imageStoragePaths from Supabase Storage upload)
  createPost: async (postData: Record<string, unknown>): Promise<Post> => {
    try {
      const response = await axios.post('/api/posts', postData, {
        headers: { 'Content-Type': 'application/json' },
      });
      return response.data;
    } catch (error: any) {
      console.error('Error creating post:', error);
      throw error;
    }
  },

  // Update post
  updatePost: async (postId: string, postData: any): Promise<Post> => {
    try {
      const response = await axios.put(`/api/posts/${postId}`, postData);
      return response.data;
    } catch (error: any) {
      console.error('Error updating post:', error);
      throw error;
    }
  },

  // Delete post
  deletePost: async (postId: string): Promise<void> => {
    try {
      await axios.delete(`/api/posts/${postId}`);
    } catch (error: any) {
      console.error('Error deleting post:', error);
      throw error;
    }
  },

  // Get user's posts
  getMyPosts: async (): Promise<Post[]> => {
    try {
      const response = await axios.get('/api/posts/my-posts');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching my posts:', error);
      if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
        return [];
      }
      throw error;
    }
  },

  // Mark post as sold
  markAsSold: async (postId: string): Promise<void> => {
    try {
      await axios.post(`/api/posts/${postId}/sold`);
    } catch (error: any) {
      console.error('Error marking post as sold:', error);
      throw error;
    }
  },

  // Resubmit a rejected post back to pending
  resubmitPost: async (postId: string): Promise<Post> => {
    try {
      const response = await axios.put(`/api/posts/${postId}/resubmit`);
      return response.data?.data ?? response.data;
    } catch (error: any) {
      console.error('Error resubmitting post:', error);
      throw error;
    }
  },

  /** โพสที่เกี่ยวข้องในหน้าโพสดีเทล (CLIP + หมวดเดียวกัน) — แยกจากค้นหาด้วยรูป (searchPostsByImage) */
  getRelatedPostsForDetail: async (postId: string, limit?: number): Promise<Post[]> => {
    try {
      const params = limit != null ? { limit } : {};
      const response = await axios.get(`/api/posts/${postId}/related`, { params });
      return response.data?.posts ?? [];
    } catch (error: any) {
      console.error('Error fetching related posts:', error);
      return [];
    }
  },

  // "Lens-like" search: upload one or more images, server will return similar posts.
  searchPostsByImage: async (
    images: File[],
    params?: { maxResults?: number; maxCandidates?: number }
  ): Promise<Post[]> => {
    try {
      const formData = new FormData();
      images.forEach((file) => formData.append('images', file));

      if (params?.maxResults != null) {
        formData.append('maxResults', String(params.maxResults));
      }
      if (params?.maxCandidates != null) {
        formData.append('maxCandidates', String(params.maxCandidates));
      }

      const response = await axios.post('/api/card-detection/search', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      return response.data?.posts ?? [];
    } catch (error: any) {
      console.error('Error searching posts by image:', error);
      return [];
    }
  },
};

// ==================== AUCTION API ====================
export const auctionAPI = {
  // Place a bid (cardId สำหรับประมูลแยกใบ)
  placeBid: async (postId: string, bidAmount: number, cardId?: string): Promise<any> => {
    try {
      const response = await axios.post(`/api/auction/${postId}/bid`, { bidAmount, cardId });
      return response.data;
    } catch (error: any) {
      console.error('Error placing bid:', error);
      throw error;
    }
  },

  // Get auction bids (cardId optional สำหรับประมูลแยกใบ)
  getBids: async (postId: string, cardId?: string): Promise<AuctionBid[]> => {
    try {
      const url = cardId ? `/api/auction/${postId}/bids?cardId=${encodeURIComponent(cardId)}` : `/api/auction/${postId}/bids`;
      const response = await axios.get(url);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching bids:', error);
      if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
        return [];
      }
      throw error;
    }
  },

  getCardWinners: async (postId: string): Promise<Array<{ cardId: string; winnerId: string; bidAmount: number; paymentDeadline: string }>> => {
    const response = await axios.get(`/api/auction/${postId}/card-winners`);
    return response.data;
  },
  reAuction: async (postId: string, newEndDate?: string): Promise<any> => {
    const response = await axios.post(`/api/auction/${postId}/re-auction`, {
      newEndDate: newEndDate ? new Date(newEndDate).toISOString() : undefined
    });
    return response.data;
  },

  buyNow: async (postId: string): Promise<any> => {
    const response = await axios.post(`/api/auction/${postId}/buy-now`);
    return response.data;
  },
};

// ==================== CART API ====================
export const cartAPI = {
  // Get cart items
  getCartItems: async (): Promise<CartItem[]> => {
    try {
      const response = await axios.get('/api/cart');
      // Ensure response.data is an array
      if (Array.isArray(response.data)) {
        return response.data;
      }
      // If response.data is an object with items array
      if (response.data && Array.isArray(response.data.items)) {
        return response.data.items;
      }
      // If response.data is an object with data array
      if (response.data && Array.isArray(response.data.data)) {
        return response.data.data;
      }
      // Default to empty array if structure is unexpected
      return [];
    } catch (error: any) {
      console.error('Error fetching cart items:', error);
      // For all errors (network or API errors), return empty array
      // This allows the UI to show empty cart state instead of error
      return [];
    }
  },

  // Add item to cart (cardId optional for individual card)
  addToCart: async (postId: string, cardId?: string, quantity?: number): Promise<{ success: boolean; message: string }> => {
    try {
      const payload: { postId: string; cardId?: string; quantity?: number } = { postId };
      if (cardId) payload.cardId = cardId;
      if (quantity) payload.quantity = quantity;
      const response = await axios.post('/api/cart', payload);
      return { success: true, message: response.data.message || 'เพิ่มลงตะกร้าเรียบร้อย' };
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      const message = error.response?.data?.message || 'ไม่สามารถเพิ่มลงตะกร้าได้';
      return { success: false, message };
    }
  },

  // Remove item from cart (id = cart item id or postId, cardId optional for individual card)
  removeFromCart: async (id: string, cardId?: string): Promise<{ success: boolean; message: string }> => {
    try {
      const url = cardId ? `/api/cart/${id}?cardId=${encodeURIComponent(cardId)}` : `/api/cart/${id}`;
      const response = await axios.delete(url);
      return { success: true, message: response.data?.message || 'ลบออกจากตะกร้าเรียบร้อย' };
    } catch (error: any) {
      console.error('Error removing from cart:', error);
      const message = error.response?.data?.message || 'ไม่สามารถลบออกจากตะกร้าได้';
      return { success: false, message };
    }
  },

  // Clear cart
  clearCart: async (): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await axios.delete('/api/cart');
      return { success: true, message: response.data?.message || 'ล้างตะกร้าเรียบร้อย' };
    } catch (error: any) {
      console.error('Error clearing cart:', error);
      const message = error.response?.data?.message || 'ไม่สามารถล้างตะกร้าได้';
      return { success: false, message };
    }
  },
};

// ==================== ORDERS API ====================
export const ordersAPI = {
  checkout: async (payload: { cartItemIds: string[]; shippingAddress?: string; shippingPhone?: string }): Promise<{ success: boolean; message?: string; orderIds?: string[]; error?: string }> => {
    try {
      const response = await axios.post('/api/orders/checkout', {
        cartItemIds: payload.cartItemIds ?? [],
        shippingAddress: payload.shippingAddress?.trim() || undefined,
        shippingPhone: payload.shippingPhone?.trim() || undefined
      });
      return { success: true, message: response.data.message, orderIds: response.data.orderIds };
    } catch (error: any) {
      const err = error.response?.data;
      return { success: false, error: err?.error || err?.message || 'เกิดข้อผิดพลาดในการสั่งซื้อ' };
    }
  },

  getMyOrders: async (): Promise<any[]> => {
    try {
      const response = await axios.get('/api/orders/my-orders');
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      if (error.response?.status === 401) return [];
      console.error('Error fetching my orders:', error);
      return [];
    }
  },

  getSellerOrders: async (): Promise<any[]> => {
    try {
      const response = await axios.get('/api/orders/seller-orders');
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      if (error.response?.status === 401) return [];
      console.error('Error fetching seller orders:', error);
      return [];
    }
  },

  confirmShipment: async (orderId: string, receiptUrl: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      await axios.post(`/api/orders/${orderId}/confirm-shipment`, { receiptUrl });
      return { success: true, message: 'ยืนยันการส่งแล้ว' };
    } catch (error: any) {
      const err = error.response?.data;
      return { success: false, error: err?.error || err?.message || 'เกิดข้อผิดพลาด' };
    }
  },

  confirmReceived: async (orderId: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      await axios.post(`/api/orders/${orderId}/confirm-received`);
      return { success: true, message: 'ยืนยันได้รับของแล้ว' };
    } catch (error: any) {
      const err = error.response?.data;
      return { success: false, error: err?.error || err?.message || 'เกิดข้อผิดพลาด' };
    }
  },
};
export const sellerAPI = {
  // Get seller profile
  getSellerProfile: async (sellerId: string): Promise<any> => {
    try {
      const response = await axios.get(`/api/seller/${sellerId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching seller profile:', error);
      throw error;
    }
  },

  // Get seller's posts
  getSellerPosts: async (sellerId: string): Promise<Post[]> => {
    try {
      const response = await axios.get(`/api/seller/${sellerId}/posts`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching seller posts:', error);
      if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
        return [];
      }
      throw error;
    }
  },
};

// ==================== ADMIN API ====================
export const adminAPI = {
  // Get admin stats
  getStats: async (): Promise<any> => {
    try {
      const response = await axios.get('/api/admin/stats');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching admin stats:', error);
      throw error;
    }
  },

  // Get all posts for admin
  getAllPosts: async (): Promise<Post[]> => {
    try {
      const response = await axios.get('/api/admin/posts');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching all posts:', error);
      if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
        return [];
      }
      throw error;
    }
  },

  // Approve post
  approvePost: async (postId: string): Promise<void> => {
    try {
      await axios.put(`/api/admin/posts/${postId}/status`, { status: 'active' });
    } catch (error: any) {
      console.error('Error approving post:', error);
      throw error;
    }
  },

  // Reject post
  rejectPost: async (postId: string, reason?: string): Promise<void> => {
    try {
      await axios.put(`/api/admin/posts/${postId}/status`, { status: 'rejected', reason });
    } catch (error: any) {
      console.error('Error rejecting post:', error);
      throw error;
    }
  },

  /** ตรวจสอบ AI ทุก mode รวม (ใช้ใน Admin approval flow) */
  getPostAiScreening: async (postId: string, forceRefresh = false): Promise<AiScreeningResult> => {
    const response = await axios.get(`/api/admin/posts/${postId}/ai-screening`, {
      params: { forceRefresh },
      timeout: 120000, // 120 วินาที — AI screening ต้องดาวน์โหลดรูป + OpenCV + Sightengine API
    });
    return response.data?.data;
  },

  /** ตรวจสอบแหล่งที่มาของรูป (Reverse Image Search) */
  getPostSourceScreening: async (postId: string, forceRefresh = true): Promise<AiScreeningResult> => {
    const response = await axios.get(`/api/admin/posts/${postId}/ai-screening`, {
      params: { mode: 'source', forceRefresh },
      timeout: 120000, // 120 วินาที — Reverse image search + dHash + CLIP ใช้เวลานาน
    });
    return response.data?.data;
  },

  /** ตรวจภาพตัดต่อ/ปลอมแปลง — endpoint แยกเฉพาะ ไม่ share cache กับ AI-generated */
  getPostManipulationScreening: async (postId: string, forceRefresh = false): Promise<AiScreeningResult> => {
    const response = await axios.get(`/api/admin/posts/${postId}/ai-screening/manipulation`, {
      params: { forceRefresh },
      timeout: 120000, // 120 วินาที — OpenCV multi-signal analysis ใช้เวลา
    });
    return response.data?.data;
  },

  /** ตรวจภาพสร้างจาก AI — endpoint แยกเฉพาะ ไม่ share cache กับ manipulation */
  getPostAiGeneratedScreening: async (postId: string, forceRefresh = false): Promise<AiScreeningResult> => {
    const response = await axios.get(`/api/admin/posts/${postId}/ai-screening/generated`, {
      params: { forceRefresh },
      timeout: 120000, // 120 วินาที — Sightengine API + OpenCV ใช้เวลา
    });
    return response.data?.data;
  },
};

// ==================== NOTIFICATIONS API ====================
export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string | null;
  postId: string | null;
  readAt: string | null;
  createdAt: string;
}

/** แจ้งให้ Navbar (และส่วนอื่น) รีเฟรชจำนวนยังไม่อ่าน */
export const WCO_NOTIFICATIONS_CHANGED = 'wco-notifications-changed';

export function emitNotificationsChanged(): void {
  window.dispatchEvent(new Event(WCO_NOTIFICATIONS_CHANGED));
}

export const notificationsAPI = {
  getMyNotifications: async (): Promise<NotificationItem[]> => {
    try {
      const response = await axios.get<{ success: boolean; notifications: NotificationItem[] }>('/api/notifications');
      if (response.data?.success && Array.isArray(response.data.notifications)) {
        return response.data.notifications;
      }
      return [];
    } catch (error: any) {
      if (error.response?.status === 401) return [];
      console.error('Error fetching notifications:', error);
      return [];
    }
  },

  markAsRead: async (id: string): Promise<boolean> => {
    try {
      await axios.patch(`/api/notifications/${id}/read`);
      return true;
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  },
};

// ==================== CHAT API ====================
export const chatAPI = {
  // Get messages for a post
  getMessages: async (postId: string): Promise<any[]> => {
    try {
      const response = await axios.get(`/api/chat/${postId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
        return [];
      }
      throw error;
    }
  },

  // Send message
  sendMessage: async (postId: string, message: string): Promise<any> => {
    try {
      const response = await axios.post(`/api/chat/${postId}`, { message });
      return response.data;
    } catch (error: any) {
      console.error('Error sending message:', error);
      throw error;
    }
  },
};

// Export all APIs
export default {
  auth: authAPI,
  posts: postsAPI,
  auction: auctionAPI,
  cart: cartAPI,
  orders: ordersAPI,
  seller: sellerAPI,
  admin: adminAPI,
  notifications: notificationsAPI,
  chat: chatAPI,
};


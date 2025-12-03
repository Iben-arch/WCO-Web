/**
 * API Service - Centralized API calls to backend server
 * All API requests should go through this service
 */

import axios from '../utils/axiosInterceptor';
import { Post, UserProfile, CartItem, AuctionBid } from '../types';

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

  // Check if user liked a post
  checkLike: async (postId: string): Promise<{ liked: boolean }> => {
    try {
      const response = await axios.get(`/api/auth/check-like/${postId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error checking like status:', error);
      return { liked: false };
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
};

// ==================== POSTS API ====================
export const postsAPI = {
  // Get all posts with filters
  getPosts: async (params?: {
    category?: string;
    search?: string;
    sortBy?: string;
    postType?: string;
    status?: string;
  }): Promise<Post[]> => {
    try {
      const response = await axios.get('/api/posts', { params });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching posts:', error);
      // Return empty array if server is not available (for frontend-only mode)
      if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
        console.warn('Server not available, returning empty posts array');
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

  // Create new post
  createPost: async (postData: FormData): Promise<Post> => {
    try {
      const response = await axios.post('/api/posts', postData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
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
};

// ==================== AUCTION API ====================
export const auctionAPI = {
  // Place a bid
  placeBid: async (postId: string, bidAmount: number): Promise<any> => {
    try {
      const response = await axios.post(`/api/auction/${postId}/bid`, { bidAmount });
      return response.data;
    } catch (error: any) {
      console.error('Error placing bid:', error);
      throw error;
    }
  },

  // Get auction bids
  getBids: async (postId: string): Promise<AuctionBid[]> => {
    try {
      const response = await axios.get(`/api/auction/${postId}/bids`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching bids:', error);
      if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
        return [];
      }
      throw error;
    }
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

  // Add item to cart
  addToCart: async (postId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await axios.post('/api/cart', { postId });
      return { success: true, message: response.data.message || 'เพิ่มลงตะกร้าเรียบร้อย' };
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      const message = error.response?.data?.message || 'ไม่สามารถเพิ่มลงตะกร้าได้';
      return { success: false, message };
    }
  },

  // Remove item from cart
  removeFromCart: async (postId: string): Promise<{ success: boolean; message: string }> => {
    try {
      await axios.delete(`/api/cart/${postId}`);
      return { success: true, message: 'ลบออกจากตะกร้าเรียบร้อย' };
    } catch (error: any) {
      console.error('Error removing from cart:', error);
      return { success: false, message: 'ไม่สามารถลบออกจากตะกร้าได้' };
    }
  },

  // Clear cart
  clearCart: async (): Promise<{ success: boolean; message: string }> => {
    try {
      await axios.delete('/api/cart');
      return { success: true, message: 'ล้างตะกร้าเรียบร้อย' };
    } catch (error: any) {
      console.error('Error clearing cart:', error);
      return { success: false, message: 'ไม่สามารถล้างตะกร้าได้' };
    }
  },
};


// ==================== SELLER API ====================
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
      await axios.post(`/api/admin/posts/${postId}/approve`);
    } catch (error: any) {
      console.error('Error approving post:', error);
      throw error;
    }
  },

  // Reject post
  rejectPost: async (postId: string, reason?: string): Promise<void> => {
    try {
      await axios.post(`/api/admin/posts/${postId}/reject`, { reason });
    } catch (error: any) {
      console.error('Error rejecting post:', error);
      throw error;
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
  seller: sellerAPI,
  admin: adminAPI,
  chat: chatAPI,
};


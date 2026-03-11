// Supabase User Types
import type { User as SupabaseUser } from '@supabase/supabase-js';

// User type matching Supabase User
export type User = SupabaseUser;

// Profile type matching profiles table schema
export interface Profile {
  id: string;
  username: string;
  avatar_url?: string | null;
  role: string;
  phone?: string | null;
  address?: string | null;
  created_at: string;
  updated_at?: string;
}

// Extended UserProfile for backward compatibility
export interface UserProfile {
  id?: string;
  username?: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
  avatar_url?: string;
  isAdmin?: boolean;
  role?: string;
  [key: string]: any;
}

// Post Types
export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds?: number;
}

export type PostType = 'sale' | 'auction';
export type SaleType = 'deck' | 'individual';
export type PostStatus = 'active' | 'sold' | 'inactive' | 'pending' | 'rejected';

export interface Post {
  id: string;
  title: string;
  description: string;
  category: string;
  images: string[];
  sellerId: string;
  sellerName: string;
  status: PostStatus;
  postType: PostType;
  saleType?: SaleType;
  price?: number;
  individualPrice?: number;
  startingBid?: number;
  currentBid?: number;
  buyNowPrice?: number;
  maxPrice?: number;
  cardCount?: number;
  availableQuantity?: number;
  deckDescription?: string;
  auctionEndDate?: Date | FirestoreTimestamp | string;
  createdAt: Date | FirestoreTimestamp | string;
  updatedAt?: Date | FirestoreTimestamp | string;
  bidCount?: number;
  individualCards?: Array<{
    id?: string;
    imageUrl: string;
    quantity: number;
    price: number;
  }>;
  condition?: string;
  highestBidder?: string;
  game?: string;
}

// Sort Types
export type SortBy = 'newest' | 'priceAsc' | 'priceDesc';

// Category Types
export type Category =
  | 'Yu-Gi-Oh!'
  | 'Pokemon Card Game'
  | 'Cardfight!! Vanguard'
  | 'Battle Spirits'
  | 'Digimon Card Game'
  | 'One Piece Card Game'
  | 'Shadowverse Evolve'
  | 'Weiß Schwarz'
  | 'Rebirth for you'
  | 'hololive card game'
  | 'union arena'
  | 'wixross'
  | 'gundam card game'
  | 'อื่นๆ';

// Cart Types
export interface CartItem {
  id?: string; // Cart item id (for remove)
  postId: string;
  post: Post;
  cardId?: string; // Optional - for individual card
  quantity?: number;
  addedAt?: Date | FirestoreTimestamp | string;
}

// Context Types
export interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  profile: Profile | null;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, username: string) => Promise<User>;
  logout: () => Promise<void>;
  updateProfile: (profileData: any) => Promise<Profile>;
  refreshProfileFromApi: () => Promise<void>;
  loading: boolean;
}

export interface CartContextType {
  cartItems: CartItem[];
  loading: boolean;
  error: string | null;
  addToCart: (post: Post, cardId?: string, quantity?: number) => Promise<{ success: boolean; message: string }>;
  removeFromCart: (itemId: string, cardId?: string) => Promise<{ success: boolean; message: string }>;
  clearCart: () => Promise<{ success: boolean; message: string }>;
  isInCart: (postId: string, cardId?: string) => boolean;
  getQuantityInCart: (postId: string, cardId?: string) => number;
  getCartCount: () => number;
  getTotalPrice: () => number;
  formatPrice: (price: number) => string;
  fetchCartItems: () => Promise<void>;
}


// SocketContext removed - now using Facebook Messenger

// Form Types
export interface CreatePostFormData {
  title: string;
  description: string;
  price: string;
  category: string;
  images: File[];
  postType: PostType;
  saleType?: SaleType;
  auctionEndDate: string;
  startingBid: string;
  buyNowPrice: string;
  cardCount: string;
  deckDescription: string;
  individualPrice: string;
  availableQuantity: string;
  condition?: string;
  game?: string;
}

export interface DetectedCard {
  id: string;
  imageUrl: string;
  quantity: string | number;
  price: string | number;
  name?: string;
  [key: string]: any;
}

// Individual Card Types
export interface IndividualCardItem {
  id?: string;
  imageUrl: string;
  quantity: number;
  price: number;
}

export interface CardForCart {
  id: string;
  postId: string;
  cardId: string;
  cardImage: string;
  cardTitle: string;
  price: number;
  sellerId: string;
  sellerName: string;
  category: string;
  isIndividualCard: boolean;
  originalPost: Post;
  /** จำนวนที่จะใส่ตะกร้า (ไม่เกินจำนวนคงเหลือ) */
  quantityToAdd?: number;
}


// Seller Types
export interface Seller {
  id: string;
  displayName: string;
  email?: string;
  profileImage?: string;
  phone?: string;
  createdAt?: Date | FirestoreTimestamp | string;
  [key: string]: any;
}

// Admin Types
export interface AdminStats {
  totalPosts: number;
  activePosts: number;
  totalUsers: number;
  recentPosts: number;
}

// Auction Bid Types
export interface AuctionBid {
  id: string;
  postId: string;
  bidderId: string;
  bidderName: string;
  bidAmount: number;
  createdAt: Date | FirestoreTimestamp | string;
}

// Chat Message Types
export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: Date | FirestoreTimestamp | string;
}

// Order Types (คำสั่งซื้อ / รอจัดส่ง / ขายแล้ว)
export interface OrderItemDto {
  id?: string;
  postId?: string;
  cardId?: string | null;
  quantity: number;
  unitPrice: number;
  post?: Post | null;
}

export interface OrderDto {
  id: string;
  buyerId?: string | null;
  sellerId?: string | null;
  sellerName?: string | null;
  status: 'pending_shipment' | 'sold';
  receiptUrl?: string | null;
  totalAmount: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  items: OrderItemDto[];
}


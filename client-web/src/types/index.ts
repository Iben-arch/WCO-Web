// User Types
export interface User {
  uid: string;
  email: string | null;
  displayName?: string;
  name?: string;
}

export interface UserProfile {
  displayName?: string;
  email?: string;
  photoURL?: string;
  isAdmin?: boolean;
  [key: string]: any;
}

// Post Types
export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds?: number;
}

export type PostType = 'sale' | 'auction' | 'buying';
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
  cloudinaryPublicIds?: string[];
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

// Offer Types
export interface OfferData {
  cardTitle: string;
  cardDescription: string;
  cardImages: string[];
  cardCondition: string;
  offerPrice: string;
  message: string;
}

// Sort Types
export type SortBy = 'newest' | 'priceAsc' | 'priceDesc';

// Category Types
export type Category = 
  | 'Pokemon'
  | 'Yu-Gi-Oh!'
  | 'Magic: The Gathering'
  | 'Dragon Ball Super'
  | 'Card Fight!! Vanguard'
  | 'One Piece'
  | 'Naruto'
  | 'Digimon'
  | 'อื่นๆ';

// Cart Types
export interface CartItem {
  postId: string;
  post: Post;
  addedAt?: Date | FirestoreTimestamp | string;
}

// Offer Types (extended)
export interface Offer {
  id: string;
  postId: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  cardTitle: string;
  cardDescription?: string;
  cardImages?: string[];
  cardCondition: string;
  offerPrice: number;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  createdAt: Date | FirestoreTimestamp | string;
  updatedAt?: Date | FirestoreTimestamp | string;
}

// Context Types
export interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  login: (email: string, password: string) => Promise<any>;
  register: (email: string, password: string, displayName: string) => Promise<any>;
  logout: () => Promise<void>;
  updateProfile: (profileData: any) => Promise<any>;
  refreshToken: () => Promise<string | null>;
  loading: boolean;
}

export interface CartContextType {
  cartItems: CartItem[];
  loading: boolean;
  error: string | null;
  addToCart: (post: Post) => Promise<{ success: boolean; message: string }>;
  removeFromCart: (postId: string) => Promise<{ success: boolean; message: string }>;
  clearCart: () => Promise<{ success: boolean; message: string }>;
  isInCart: (postId: string) => boolean;
  getCartCount: () => number;
  getTotalPrice: () => number;
  formatPrice: (price: number) => string;
  fetchCartItems: () => Promise<void>;
}

export interface OfferContextType {
  offers: Offer[];
  myOffers: Offer[];
  loading: boolean;
  error: string | null;
  createOffer: (postId: string, offerData: OfferData) => Promise<{ success: boolean; message: string; offer?: Offer }>;
  updateOfferStatus: (offerId: string, status: Offer['status']) => Promise<{ success: boolean; message: string }>;
  deleteOffer: (offerId: string) => Promise<{ success: boolean; message: string }>;
  fetchOffersForPost: (postId: string) => Promise<Offer[]>;
  fetchMyOffers: () => Promise<void>;
  getOffersForMyPosts: () => Promise<Offer[]>;
  formatPrice: (price: number) => string;
  formatDate: (dateString: Date | string | any) => string;
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
}

// Extended Offer interface for Offers page
export interface ExtendedOffer extends Offer {
  postTitle?: string;
  offererName?: string;
  postOwnerName?: string;
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


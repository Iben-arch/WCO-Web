import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { Offer, OfferData, OfferContextType, FirestoreTimestamp } from '../types';
import { offersAPI } from '../api/api';

const OfferContext = createContext<OfferContextType | undefined>(undefined);

export const useOffer = (): OfferContextType => {
  const context = useContext(OfferContext);
  if (!context) {
    throw new Error('useOffer must be used within an OfferProvider');
  }
  return context;
};

interface OfferProviderProps {
  children: ReactNode;
}

export const OfferProvider: React.FC<OfferProviderProps> = ({ children }) => {
  const { currentUser } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [myOffers, setMyOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load offers when user logs in
  useEffect(() => {
    if (currentUser) {
      fetchMyOffers();
    } else {
      setOffers([]);
      setMyOffers([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const fetchMyOffers = async (): Promise<void> => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      setError(null);
      const offers = await offersAPI.getMyOffers();
      setMyOffers(offers);
    } catch (error: any) {
      console.error('Error fetching my offers:', error);
      // Only set error if it's not a network error (server might be down)
      if (error.response) {
        setError('เกิดข้อผิดพลาดในการโหลดข้อเสนอ');
      }
      // On network errors, just set empty offers
      setMyOffers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchOffersForPost = async (postId: string): Promise<Offer[]> => {
    try {
      const offers = await offersAPI.getOffersForPost(postId);
      setOffers(offers);
      return offers;
    } catch (error) {
      console.error('Error fetching offers for post:', error);
      setError('เกิดข้อผิดพลาดในการโหลดข้อเสนอ');
      return [];
    }
  };

  const createOffer = async (postId: string, offerData: OfferData): Promise<{ success: boolean; message: string; offer?: Offer }> => {
    if (!currentUser) {
      throw new Error('กรุณาเข้าสู่ระบบก่อน');
    }

    try {
      const result = await offersAPI.createOffer(postId, offerData);
      if (result.success && result.offer) {
        // Update my offers
        setMyOffers(prev => [result.offer!, ...prev]);
      }
      return result;
    } catch (error: any) {
      console.error('Error creating offer:', error);
      return { success: false, message: 'เกิดข้อผิดพลาดในการส่งข้อเสนอ' };
    }
  };

  const updateOfferStatus = async (offerId: string, status: Offer['status']): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'กรุณาเข้าสู่ระบบ' };

    try {
      const result = await offersAPI.updateOfferStatus(offerId, status);
      
      if (result.success) {
        // Update offers state
        setOffers(prev => prev.map(offer => 
          offer.id === offerId 
            ? { ...offer, status }
            : offer
        ));
        
        setMyOffers(prev => prev.map(offer => 
          offer.id === offerId 
            ? { ...offer, status }
            : offer
        ));
      }

      return result;
    } catch (error: any) {
      console.error('Error updating offer status:', error);
      return { success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตสถานะ' };
    }
  };

  const deleteOffer = async (offerId: string): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'กรุณาเข้าสู่ระบบ' };

    try {
      const result = await offersAPI.deleteOffer(offerId);
      
      if (result.success) {
        // Remove from states
        setOffers(prev => prev.filter(offer => offer.id !== offerId));
        setMyOffers(prev => prev.filter(offer => offer.id !== offerId));
      }

      return result;
    } catch (error: any) {
      console.error('Error deleting offer:', error);
      return { success: false, message: 'เกิดข้อผิดพลาดในการลบข้อเสนอ' };
    }
  };

  const getOffersForMyPosts = async (): Promise<Offer[]> => {
    if (!currentUser) return [];

    try {
      return await offersAPI.getOffersForMyPosts();
    } catch (error) {
      console.error('Error fetching offers for my posts:', error);
      return [];
    }
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB'
    }).format(price);
  };

  const formatDate = (dateString: Date | string | FirestoreTimestamp): string => {
    if (!dateString) return '-';
    try {
      let date: Date;
      if (typeof dateString === 'object' && 'seconds' in dateString) {
        date = new Date(dateString.seconds * 1000);
      } else {
        date = new Date(dateString);
      }
      return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Date formatting error:', error);
      return '-';
    }
  };

  const value: OfferContextType = {
    offers,
    myOffers,
    loading,
    error,
    createOffer,
    updateOfferStatus,
    deleteOffer,
    fetchOffersForPost,
    fetchMyOffers,
    getOffersForMyPosts,
    formatPrice,
    formatDate
  };

  return (
    <OfferContext.Provider value={value}>
      {children}
    </OfferContext.Provider>
  );
};


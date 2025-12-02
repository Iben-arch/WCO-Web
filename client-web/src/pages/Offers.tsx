import React, { useState, useEffect, ReactNode } from 'react';
import { Container, Row, Col, Card, Button, Alert, Spinner, Badge, Modal, Tab, Tabs } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useOffer } from '../contexts/OfferContext';
import { useAuth } from '../contexts/AuthContext';
import { Offer, ExtendedOffer } from '../types';
import { toast } from 'react-toastify';

const Offers: React.FC = () => {
  const { 
    offers, 
    myOffers, 
    loading, 
    error, 
    updateOfferStatus, 
    deleteOffer, 
    fetchMyOffers, 
    getOffersForMyPosts,
    formatPrice,
    formatDate
  } = useOffer();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('received');
  const [receivedOffers, setReceivedOffers] = useState<ExtendedOffer[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [deletingOffer, setDeletingOffer] = useState<string | null>(null);
  const [showOfferModal, setShowOfferModal] = useState<boolean>(false);
  const [selectedOffer, setSelectedOffer] = useState<ExtendedOffer | null>(null);

  useEffect(() => {
    if (currentUser) {
      loadOffers();
    }
  }, [currentUser]);

  const loadOffers = async (): Promise<void> => {
    try {
      const received = await getOffersForMyPosts();
      setReceivedOffers(received);
      await fetchMyOffers();
    } catch (error) {
      console.error('Error loading offers:', error);
    }
  };

  const handleUpdateStatus = async (offerId: string, status: Offer['status']): Promise<void> => {
    setUpdatingStatus(offerId);
    try {
      const result = await updateOfferStatus(offerId, status);
      if (result.success) {
        toast.success(result.message);
        loadOffers();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการอัปเดตสถานะ');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleDeleteOffer = async (offerId: string): Promise<void> => {
    setDeletingOffer(offerId);
    try {
      const result = await deleteOffer(offerId);
      if (result.success) {
        toast.success(result.message);
        loadOffers();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการลบข้อเสนอ');
    } finally {
      setDeletingOffer(null);
    }
  };

  const handleViewOffer = (offer: ExtendedOffer): void => {
    setSelectedOffer(offer);
    setShowOfferModal(true);
  };

  const getStatusBadge = (status: Offer['status']): ReactNode => {
    switch (status) {
      case 'pending':
        return <Badge bg="warning">รอดำเนินการ</Badge>;
      case 'accepted':
        return <Badge bg="success">ยอมรับแล้ว</Badge>;
      case 'rejected':
        return <Badge bg="danger">ปฏิเสธแล้ว</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };

  if (loading && receivedOffers.length === 0 && myOffers.length === 0) {
    return (
      <div className="offers-loading">
        <Container className="py-5">
          <div className="d-flex justify-content-center">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="offers-container">
      <Container className="py-4">
        {/* Header */}
        <Row className="mb-5">
          <Col>
            <div className="offers-header" style={{
              textAlign: 'center',
              padding: '2rem 0',
              background: 'linear-gradient(135deg, var(--muted-olive) 0%, var(--faded-copper) 100%)',
              borderRadius: 'var(--radius-xl)',
              color: 'var(--text-light)',
              marginBottom: '2rem',
              boxShadow: 'var(--shadow-lg)'
            }}>
              <h1 className="offers-title" style={{
                fontSize: '2.5rem',
                fontWeight: '700',
                marginBottom: '0.5rem',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}>
                💰 ข้อเสนอสินค้า
              </h1>
              <p className="offers-subtitle" style={{
                fontSize: '1.1rem',
                opacity: 0.95,
                margin: 0
              }}>
                จัดการข้อเสนอสินค้าที่ได้รับและส่งออกไป
              </p>
            </div>
          </Col>
        </Row>

        {/* Tabs */}
        <Tabs
          activeKey={activeTab}
          onSelect={(k: string | null) => k && setActiveTab(k)}
          className="mb-4"
        >
          <Tab eventKey="received" title={`📥 ข้อเสนอที่ได้รับ (${receivedOffers.length})`}>
            <div className="offers-content">
              {receivedOffers.length === 0 ? (
                <Card className="text-center py-5" style={{
                  border: 'none',
                  borderRadius: 'var(--radius-xl)',
                  boxShadow: 'var(--shadow-lg)',
                  background: 'var(--bg-card)',
                  animation: 'fadeInUp 0.6s ease-out'
                }}>
                  <Card.Body style={{ padding: '3rem 2rem' }}>
                    <div className="empty-offers-icon" style={{
                      fontSize: '5rem',
                      marginBottom: '1.5rem',
                      animation: 'float 3s ease-in-out infinite'
                    }}>📭</div>
                    <h3 className="empty-offers-title" style={{
                      fontSize: '1.75rem',
                      fontWeight: '600',
                      color: 'var(--text-primary)',
                      marginBottom: '1rem'
                    }}>ไม่มีข้อเสนอที่ได้รับ</h3>
                    <p className="empty-offers-description" style={{
                      fontSize: '1rem',
                      color: 'var(--text-muted)',
                      marginBottom: '2rem',
                      lineHeight: '1.6'
                    }}>
                      ยังไม่มีใครเสนอสินค้าให้โพสต์รับซื้อของคุณ
                    </p>
                    <Button as={Link as any} to="/create-post" className="btn-tcg-primary btn-tcg-lg">
                      📝 สร้างโพสต์รับซื้อ
                    </Button>
                  </Card.Body>
                </Card>
              ) : (
                <Row>
                  {receivedOffers.map((offer: ExtendedOffer) => (
                    <Col key={offer.id} lg={6} className="mb-4">
                      <Card className="offer-card h-100" style={{
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-lg)',
                        boxShadow: 'var(--shadow-md)',
                        transition: 'all var(--transition-base)',
                        overflow: 'hidden'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-hover)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                      }}>
                        <Card.Body style={{ padding: '1.5rem' }}>
                          <div className="offer-header">
                            <div className="offer-title">
                              <h5>{offer.cardTitle}</h5>
                              <div className="offer-meta">
                                {getStatusBadge(offer.status)}
                                <span className="offer-date">
                                  {formatDate(offer.createdAt)}
                                </span>
                              </div>
                            </div>
                            <div className="offer-price">
                              {formatPrice(offer.offerPrice)}
                            </div>
                          </div>
                          
                          <div className="offer-details">
                            <p><strong>โพสต์:</strong> {offer.postTitle || 'N/A'}</p>
                            <p><strong>ผู้เสนอ:</strong> {offer.offererName || offer.buyerName}</p>
                            <p><strong>สภาพ:</strong> {offer.cardCondition}</p>
                            {offer.cardDescription && (
                              <p><strong>รายละเอียด:</strong> {offer.cardDescription}</p>
                            )}
                            {offer.cardImages && offer.cardImages.length > 0 && (
                              <div className="offer-images">
                                <p><strong>รูปภาพ:</strong></p>
                                <div className="offer-images-grid">
                                  {offer.cardImages.slice(0, 3).map((image: string, index: number) => (
                                    <img 
                                      key={index} 
                                      src={image} 
                                      alt={`Card ${index + 1}`}
                                      className="offer-image-thumbnail"
                                    />
                                  ))}
                                  {offer.cardImages.length > 3 && (
                                    <div className="more-images">
                                      +{offer.cardImages.length - 3}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {offer.message && (
                              <p><strong>ข้อความ:</strong> {offer.message}</p>
                            )}
                          </div>
                          
                          <div className="offer-actions">
                            <Button
                              className="btn-tcg-outline btn-tcg-sm me-2"
                              onClick={() => handleViewOffer(offer)}
                            >
                              👁️ ดูรายละเอียด
                            </Button>
                            
                            {offer.status === 'pending' && (
                              <>
                                <Button
                                  className="btn-tcg-primary btn-tcg-sm me-2"
                                  onClick={() => handleUpdateStatus(offer.id, 'accepted')}
                                  disabled={updatingStatus === offer.id}
                                >
                                  {updatingStatus === offer.id ? (
                                    <Spinner size="sm" />
                                  ) : (
                                    '✅ ยอมรับ'
                                  )}
                                </Button>
                                <Button
                                  className="btn-tcg-outline btn-tcg-sm"
                                  onClick={() => handleUpdateStatus(offer.id, 'rejected')}
                                  disabled={updatingStatus === offer.id}
                                >
                                  {updatingStatus === offer.id ? (
                                    <Spinner size="sm" />
                                  ) : (
                                    '❌ ปฏิเสธ'
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}
            </div>
          </Tab>
          
          <Tab eventKey="sent" title={`📤 ข้อเสนอที่ส่ง (${myOffers.length})`}>
            <div className="offers-content">
              {myOffers.length === 0 ? (
                <Card className="text-center py-5" style={{
                  border: 'none',
                  borderRadius: 'var(--radius-xl)',
                  boxShadow: 'var(--shadow-lg)',
                  background: 'var(--bg-card)',
                  animation: 'fadeInUp 0.6s ease-out'
                }}>
                  <Card.Body style={{ padding: '3rem 2rem' }}>
                    <div className="empty-offers-icon" style={{
                      fontSize: '5rem',
                      marginBottom: '1.5rem',
                      animation: 'float 3s ease-in-out infinite'
                    }}>📤</div>
                    <h3 className="empty-offers-title" style={{
                      fontSize: '1.75rem',
                      fontWeight: '600',
                      color: 'var(--text-primary)',
                      marginBottom: '1rem'
                    }}>ยังไม่มีการส่งข้อเสนอ</h3>
                    <p className="empty-offers-description" style={{
                      fontSize: '1rem',
                      color: 'var(--text-muted)',
                      marginBottom: '2rem',
                      lineHeight: '1.6'
                    }}>
                      ไปดูโพสต์รับซื้อและเสนอสินค้าของคุณกันเถอะ!
                    </p>
                    <Button as={Link as any} to="/" className="btn-tcg-primary btn-tcg-lg">
                      🏠 ดูโพสต์รับซื้อ
                    </Button>
                  </Card.Body>
                </Card>
              ) : (
                <Row>
                  {myOffers.map((offer: Offer) => (
                    <Col key={offer.id} lg={6} className="mb-4">
                      <Card className="offer-card h-100" style={{
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-lg)',
                        boxShadow: 'var(--shadow-md)',
                        transition: 'all var(--transition-base)',
                        overflow: 'hidden'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-hover)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                      }}>
                        <Card.Body style={{ padding: '1.5rem' }}>
                          <div className="offer-header">
                            <div className="offer-title">
                              <h5>{offer.cardTitle}</h5>
                              <div className="offer-meta">
                                {getStatusBadge(offer.status)}
                                <span className="offer-date">
                                  {formatDate(offer.createdAt)}
                                </span>
                              </div>
                            </div>
                            <div className="offer-price">
                              {formatPrice(offer.offerPrice)}
                            </div>
                          </div>
                          
                          <div className="offer-details">
                            <p><strong>สภาพ:</strong> {offer.cardCondition}</p>
                            {offer.cardDescription && (
                              <p><strong>รายละเอียด:</strong> {offer.cardDescription}</p>
                            )}
                            {offer.cardImages && offer.cardImages.length > 0 && (
                              <div className="offer-images">
                                <p><strong>รูปภาพ:</strong></p>
                                <div className="offer-images-grid">
                                  {offer.cardImages.slice(0, 3).map((image: string, index: number) => (
                                    <img 
                                      key={index} 
                                      src={image} 
                                      alt={`Card ${index + 1}`}
                                      className="offer-image-thumbnail"
                                    />
                                  ))}
                                  {offer.cardImages.length > 3 && (
                                    <div className="more-images">
                                      +{offer.cardImages.length - 3}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {offer.message && (
                              <p><strong>ข้อความ:</strong> {offer.message}</p>
                            )}
                          </div>
                          
                          <div className="offer-actions">
                            <Button
                              className="btn-tcg-outline btn-tcg-sm me-2"
                              onClick={() => handleViewOffer(offer as ExtendedOffer)}
                            >
                              👁️ ดูรายละเอียด
                            </Button>
                            
                            {offer.status === 'pending' && (
                              <Button
                                className="btn-tcg-outline btn-tcg-sm"
                                onClick={() => handleDeleteOffer(offer.id)}
                                disabled={deletingOffer === offer.id}
                              >
                                {deletingOffer === offer.id ? (
                                  <Spinner size="sm" />
                                ) : (
                                  '🗑️ ลบ'
                                )}
                              </Button>
                            )}
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}
            </div>
          </Tab>
        </Tabs>
      </Container>

      {/* Offer Detail Modal */}
      <Modal show={showOfferModal} onHide={() => setShowOfferModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>💰 รายละเอียดข้อเสนอ</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedOffer && (
            <div className="offer-detail">
              <div className="offer-detail-header">
                <h4>{selectedOffer.cardTitle}</h4>
                <div className="offer-detail-price">
                  {formatPrice(selectedOffer.offerPrice)}
                </div>
              </div>
              
              <div className="offer-detail-info">
                <Row>
                  <Col md={6}>
                    <p><strong>โพสต์:</strong> {selectedOffer.postTitle || 'N/A'}</p>
                    <p><strong>ผู้เสนอ:</strong> {selectedOffer.offererName || selectedOffer.buyerName}</p>
                    <p><strong>ผู้ขาย:</strong> {selectedOffer.postOwnerName || 'N/A'}</p>
                  </Col>
                  <Col md={6}>
                    <p><strong>สภาพ:</strong> {selectedOffer.cardCondition}</p>
                    <p><strong>สถานะ:</strong> {getStatusBadge(selectedOffer.status)}</p>
                    <p><strong>วันที่:</strong> {formatDate(selectedOffer.createdAt)}</p>
                  </Col>
                </Row>
                
                {selectedOffer.cardDescription && (
                  <div className="offer-detail-description">
                    <h6>รายละเอียดการ์ด:</h6>
                    <p>{selectedOffer.cardDescription}</p>
                  </div>
                )}
                
                {selectedOffer.cardImages && selectedOffer.cardImages.length > 0 && (
                  <div className="offer-detail-images">
                    <h6>รูปภาพการ์ด:</h6>
                    <div className="offer-detail-images-grid">
                      {selectedOffer.cardImages.map((image: string, index: number) => (
                        <img 
                          key={index} 
                          src={image} 
                          alt={`Card ${index + 1}`}
                          className="offer-detail-image"
                        />
                      ))}
                    </div>
                  </div>
                )}
                
                {selectedOffer.message && (
                  <div className="offer-detail-message">
                    <h6>ข้อความ:</h6>
                    <p>{selectedOffer.message}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowOfferModal(false)}>
            ปิด
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Offers;


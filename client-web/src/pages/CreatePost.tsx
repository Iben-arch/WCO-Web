import React, { useState, FormEvent, ChangeEvent } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, ProgressBar, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import { 
  TCGButton, 
  PrimaryActionButton,
  SecondaryActionButton
} from '../components/common/ButtonComponents';
import { Category, PostType, SaleType, CreatePostFormData, DetectedCard } from '../types';
import '../styles/individual-card.css';

const categories: Category[] = [
  'Pokemon',
  'Yu-Gi-Oh!',
  'Magic: The Gathering',
  'Dragon Ball Super',
  'Card Fight!! Vanguard',
  'One Piece',
  'Naruto',
  'Digimon',
  'อื่นๆ'
];

const CreatePost: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState<CreatePostFormData>({
    title: '',
    description: '',
    price: '',
    category: '',
    images: [],
    postType: 'sale',
    saleType: 'individual',
    auctionEndDate: '',
    startingBid: '',
    buyNowPrice: '',
    cardCount: '',
    deckDescription: '',
    individualPrice: '',
    availableQuantity: ''
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [processingCards, setProcessingCards] = useState<boolean>(false);
  const [detectedCards, setDetectedCards] = useState<DetectedCard[]>([]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>): void => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const imageFiles = files.slice(0, 5) as File[];
    
    setFormData({
      ...formData,
      images: imageFiles
    });
    
    // Reset detected cards when new images are selected
    setDetectedCards([]);
  };

  const normalizeCardType = (category: string): string => {
    const map: { [key: string]: string } = {
      'Pokemon': 'pokemon',
      'Magic: The Gathering': 'mtg',
      'Yu-Gi-Oh!': 'yugioh',
      'Card Fight!! Vanguard': 'vanguard',
      'One Piece': 'onepiece',
      'Digimon': 'digimon'
    };
    return map[category] || '';
  };

  const processImagesForCards = async (): Promise<void> => {
    if (!formData.images || formData.images.length === 0) {
      toast.error('กรุณาเลือกภาพก่อนประมวลผล');
      return;
    }

    setProcessingCards(true);
    setError('');

    try {
      const allCards: DetectedCard[] = [];
      const typeHint = normalizeCardType(formData.category);

      for (let i = 0; i < formData.images.length; i++) {
        const fd = new FormData();
        fd.append('image', formData.images[i]);
        if (typeHint) fd.append('cardType', typeHint);

        const resp = await axios.post('/api/card-detection/detect', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (resp.data?.success && Array.isArray(resp.data.cards)) {
          resp.data.cards.forEach((c: any) => allCards.push({ ...c, quantity: 1, price: '' }));
        }
      }

      if (allCards.length === 0) {
        setError('ไม่พบการ์ดจากภาพที่อัปโหลด');
        toast.error('ไม่พบการ์ดจากภาพที่อัปโหลด');
      } else {
        setDetectedCards(allCards);
        toast.success(`พบการ์ด ${allCards.length} ใบ`);
      }
    } catch (error: any) {
      console.error('Error processing images:', error);
      const errorMessage = error.response?.data?.error || 'เกิดข้อผิดพลาดในการประมวลผลภาพ';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setProcessingCards(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    // Validate images are required
    if (!formData.images || formData.images.length === 0) {
      setError('กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป');
      toast.error('กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป');
      return;
    }

    // Validate price based on post type and sale type
    if (formData.postType === 'sale') {
      if (formData.saleType === 'deck') {
        if (!formData.cardCount || parseInt(formData.cardCount) <= 0) {
          setError('จำนวนการ์ดในเด็คต้องมากกว่า 0');
          toast.error('จำนวนการ์ดในเด็คต้องมากกว่า 0');
          return;
        }
        if (!formData.price || parseFloat(formData.price) <= 0) {
          setError('ราคาเด็คต้องมากกว่า 0');
          toast.error('ราคาเด็คต้องมากกว่า 0');
          return;
        }
      } else if (formData.saleType === 'individual') {
        if (detectedCards.length > 0) {
          // validate per-card
          for (const card of detectedCards) {
            if (!card.price || parseFloat(String(card.price)) <= 0) {
              setError('กรุณากรอกราคาต่อใบให้ครบทุกภาพ');
              toast.error('กรุณากรอกราคาต่อใบให้ครบทุกภาพ');
              return;
            }
            if (!card.quantity || parseInt(String(card.quantity)) <= 0) {
              setError('กรุณากรอกจำนวนต่อใบให้ครบทุกภาพ');
              toast.error('กรุณากรอกจำนวนต่อใบให้ครบทุกภาพ');
              return;
            }
          }
        } else {
          // fallback to simple fields if not using per-card
          if (!formData.individualPrice || parseFloat(formData.individualPrice) <= 0) {
            setError('ราคาต่อใบต้องมากกว่า 0');
            toast.error('ราคาต่อใบต้องมากกว่า 0');
            return;
          }
          if (!formData.availableQuantity || parseInt(formData.availableQuantity) <= 0) {
            setError('จำนวนที่ขายได้ต้องมากกว่า 0');
            toast.error('จำนวนที่ขายได้ต้องมากกว่า 0');
            return;
          }
        }
      }
    } else if (formData.postType === 'auction') {
      if (!formData.startingBid || parseFloat(formData.startingBid) <= 0) {
        setError('ราคาเริ่มต้นต้องมากกว่า 0');
        toast.error('ราคาเริ่มต้นต้องมากกว่า 0');
        return;
      }
      if (!formData.auctionEndDate) {
        setError('กรุณาเลือกวันสิ้นสุดการประมูล');
        toast.error('กรุณาเลือกวันสิ้นสุดการประมูล');
        return;
      }
      // Validate auction end date is in the future
      if (new Date(formData.auctionEndDate) <= new Date()) {
        setError('วันสิ้นสุดการประมูลต้องเป็นอนาคต');
        toast.error('วันสิ้นสุดการประมูลต้องเป็นอนาคต');
        return;
      }
      
      // Validate auction-specific fields based on sale type
      if (formData.saleType === 'deck') {
        if (!formData.cardCount || parseInt(formData.cardCount) <= 0) {
          setError('จำนวนการ์ดในเด็คต้องมากกว่า 0');
          toast.error('จำนวนการ์ดในเด็คต้องมากกว่า 0');
          return;
        }
      } else if (formData.saleType === 'individual') {
        if (!formData.availableQuantity || parseInt(formData.availableQuantity) <= 0) {
          setError('จำนวนที่ประมูลได้ต้องมากกว่า 0');
          toast.error('จำนวนที่ประมูลได้ต้องมากกว่า 0');
          return;
        }
      }
    }

    // Optional validation for card details (only if provided)
    if (formData.title && formData.title.length > 0 && formData.title.length < 3) {
      setError('ชื่อการ์ดต้องมีอย่างน้อย 3 ตัวอักษร');
      toast.error('ชื่อการ์ดต้องมีอย่างน้อย 3 ตัวอักษร');
      return;
    }

    if (formData.description && formData.description.length > 0 && formData.description.length < 10) {
      setError('รายละเอียดต้องมีอย่างน้อย 10 ตัวอักษร');
      toast.error('รายละเอียดต้องมีอย่างน้อย 10 ตัวอักษร');
      return;
    }

    try {
      setError('');
      setLoading(true);
      setUploadProgress(0);

      const submitData = new FormData();
      submitData.append('title', formData.title);
      submitData.append('description', formData.description);
      submitData.append('category', formData.category);
      if (formData.condition) submitData.append('condition', formData.condition);
      if (formData.game) submitData.append('game', formData.game);
      submitData.append('postType', formData.postType);
      
      // Add sale type and related fields
      if (formData.postType === 'sale') {
        if (formData.saleType) submitData.append('saleType', formData.saleType);
        
        if (formData.saleType === 'deck') {
          submitData.append('cardCount', formData.cardCount);
          submitData.append('deckDescription', formData.deckDescription || '');
          submitData.append('price', formData.price);
        } else if (formData.saleType === 'individual') {
          if (detectedCards.length > 0) {
            const payload = detectedCards.map(c => ({
              id: c.id,
              imageUrl: c.imageUrl,
              price: parseFloat(String(c.price)),
              quantity: parseInt(String(c.quantity))
            }));
            submitData.append('individualCards', JSON.stringify(payload));
            // derive headline price as min
            const minPrice = Math.min(...payload.map(p => p.price));
            const totalQty = payload.reduce((s, p) => s + (p.quantity || 0), 0);
            submitData.append('price', String(minPrice));
            submitData.append('availableQuantity', String(totalQty));
          } else {
            submitData.append('individualPrice', formData.individualPrice);
            submitData.append('availableQuantity', formData.availableQuantity);
            submitData.append('price', formData.individualPrice);
          }
        }
      } else if (formData.postType === 'auction') {
        if (formData.saleType) submitData.append('saleType', formData.saleType);
        submitData.append('startingBid', formData.startingBid);
        submitData.append('auctionEndDate', formData.auctionEndDate);
        
        if (formData.saleType === 'deck') {
          submitData.append('cardCount', formData.cardCount);
        } else if (formData.saleType === 'individual') {
          submitData.append('availableQuantity', formData.availableQuantity);
        }
        
        if (formData.buyNowPrice) {
          submitData.append('buyNowPrice', formData.buyNowPrice);
        }
      }

      formData.images.forEach((image) => {
        submitData.append('images', image);
      });

      const response = await axios.post('/api/posts', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(progress);
          }
        },
      });

      const successMessage = formData.postType === 'auction' 
        ? 'สร้างการประมูลสำเร็จ! 🔨' 
        : 'สร้างโพสต์ขายสำเร็จ! 🛒';
      toast.success(successMessage);
      navigate(`/post/${response.data.id}`);
    } catch (error: any) {
      console.error('Error creating post:', error);
      const errorMessage = error.response?.data?.error || 'เกิดข้อผิดพลาดในการสร้างโพสต์';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Container className="py-5 create-post-container">
      <Row className="justify-content-center">
        <Col lg={10} xl={9}>
          <div className="create-post-wrapper">
            <Card className="sakura-card create-post-card" style={{
              border: 'none',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
              background: 'var(--bg-primary)'
            }}>
              <Card.Header className="create-post-header" style={{
                background: 'linear-gradient(135deg, var(--deep-twilight) 0%, var(--french-blue) 25%, var(--bright-teal-blue) 50%, var(--turquoise-surf) 75%, var(--sky-aqua) 100%)',
                color: 'var(--text-light)',
                border: 'none',
                padding: '2rem 2.5rem',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'radial-gradient(circle at 20% 50%, rgba(255, 255, 255, 0.15) 0%, transparent 50%)',
                  pointerEvents: 'none'
                }}></div>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <h2 className="mb-2" style={{
                    fontSize: '2rem',
                    fontWeight: '700',
                    textShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                    margin: 0
                  }}>
                    {formData.postType === 'auction' ? '🔨 ประมูลการ์ดเกม' : '🃏 ขายการ์ดเกม'}
                  </h2>
                  <p className="mb-0" style={{
                    fontSize: '1rem',
                    opacity: 0.95,
                    fontWeight: '400'
                  }}>
                    {formData.postType === 'auction' 
                      ? 'สร้างการประมูลการ์ดเกมของคุณ' 
                      : 'สร้างโพสต์ขายการ์ดเกมของคุณ'}
                  </p>
                </div>
              </Card.Header>
              <Card.Body style={{ padding: '2.5rem' }}>
                {error && (
                  <Alert variant="danger" className="alert-sakura-danger mb-4" style={{
                    borderRadius: 'var(--radius-lg)',
                    border: 'none',
                    padding: '1rem 1.25rem',
                    background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                    color: '#991b1b',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    <strong>⚠️ เกิดข้อผิดพลาด:</strong> {error}
                  </Alert>
                )}

                <Form onSubmit={handleSubmit} className="create-post-form">
                  {/* Section 1: Post Type Selection */}
                  <div className="form-section mb-4">
                    <div className="section-header mb-3">
                      <h5 className="section-title">
                        <span className="section-icon">📋</span>
                        ประเภทโพสต์
                        <span className="required-badge">*</span>
                      </h5>
                      <p className="section-description">เลือกประเภทการโพสต์ที่คุณต้องการ</p>
                    </div>
                    <div className="radio-group-modern">
                      <Form.Check
                        type="radio"
                        id="postType-sale"
                        name="postType"
                        value="sale"
                        checked={formData.postType === 'sale'}
                        onChange={handleChange}
                        label={
                          <div className="radio-label-content">
                            <span className="radio-icon">🛒</span>
                            <div>
                              <div className="radio-title">ขายการ์ด</div>
                              <div className="radio-subtitle">Card Sale</div>
                            </div>
                          </div>
                        }
                        className="radio-option-modern"
                      />
                      <Form.Check
                        type="radio"
                        id="postType-auction"
                        name="postType"
                        value="auction"
                        checked={formData.postType === 'auction'}
                        onChange={handleChange}
                        label={
                          <div className="radio-label-content">
                            <span className="radio-icon">🔨</span>
                            <div>
                              <div className="radio-title">ประมูลการ์ด</div>
                              <div className="radio-subtitle">Auction</div>
                            </div>
                          </div>
                        }
                        className="radio-option-modern"
                      />
                    </div>
                  </div>

                  {/* Section 2: Sale Type Selection */}
                  {(formData.postType === 'sale' || formData.postType === 'auction') && (
                    <div className="form-section mb-4">
                      <div className="section-header mb-3">
                        <h5 className="section-title">
                          <span className="section-icon">🎯</span>
                          ประเภทการขาย
                          <span className="required-badge">*</span>
                        </h5>
                        <p className="section-description">เลือกว่าต้องการขายเป็นเด็คหรือแยกใบ</p>
                      </div>
                      <div className="radio-group-modern">
                        <Form.Check
                          type="radio"
                          id="saleType-deck"
                          name="saleType"
                          value="deck"
                          checked={formData.saleType === 'deck'}
                          onChange={handleChange}
                          label={
                            <div className="radio-label-content">
                              <span className="radio-icon">🃏</span>
                              <div>
                                <div className="radio-title">
                                  {formData.postType === 'auction' ? 'ประมูลเป็นเด็ค' : 'ขายเป็นเด็ค'}
                                </div>
                                <div className="radio-subtitle">
                                  {formData.postType === 'auction' ? 'Deck Auction' : 'Deck Sale'}
                                </div>
                              </div>
                            </div>
                          }
                          className="radio-option-modern"
                        />
                        <Form.Check
                          type="radio"
                          id="saleType-individual"
                          name="saleType"
                          value="individual"
                          checked={formData.saleType === 'individual'}
                          onChange={handleChange}
                          label={
                            <div className="radio-label-content">
                              <span className="radio-icon">🃏</span>
                              <div>
                                <div className="radio-title">
                                  {formData.postType === 'auction' ? 'ประมูลแยกใบ' : 'ขายแยกใบ'}
                                </div>
                                <div className="radio-subtitle">
                                  {formData.postType === 'auction' ? 'Individual Auction' : 'Individual Cards'}
                                </div>
                              </div>
                            </div>
                          }
                          className="radio-option-modern"
                        />
                      </div>
                    </div>
                  )}

                  {/* Section 3: Basic Information */}
                  <div className="form-section mb-4">
                    <div className="section-header mb-3">
                      <h5 className="section-title">
                        <span className="section-icon">📝</span>
                        ข้อมูลพื้นฐาน
                      </h5>
                      <p className="section-description">กรอกข้อมูลพื้นฐานของการ์ด</p>
                    </div>
                    <Row>
                      <Col md={8}>
                        <Form.Group className="mb-3 form-group-sakura">
                          <Form.Label className="form-label-sakura">
                            🃏 ชื่อการ์ด
                            <span className="optional-badge">(ไม่บังคับ)</span>
                          </Form.Label>
                          <Form.Control
                            type="text"
                            name="title"
                            placeholder="เช่น Pikachu VMAX, Blue-Eyes White Dragon..."
                            value={formData.title}
                            onChange={handleChange}
                            className="form-control-sakura"
                          />
                          <Form.Text className="form-help-text">
                            กรอกชื่อการ์ดเฉพาะ (ถ้าต้องการระบุ)
                          </Form.Text>
                        </Form.Group>
                      </Col>
                      <Col md={4}>
                        {formData.postType === 'sale' ? (
                          formData.saleType === 'deck' ? (
                            <Form.Group className="mb-3 form-group-sakura">
                              <Form.Label className="form-label-sakura">
                                💰 ราคาเด็ค (บาท)
                                <span className="required-badge">*</span>
                              </Form.Label>
                              <div className="input-with-icon">
                                <span className="input-icon-left">฿</span>
                                <Form.Control
                                  type="number"
                                  name="price"
                                  placeholder="0.00"
                                  value={formData.price}
                                  onChange={handleChange}
                                  className="form-control-sakura"
                                  min="0"
                                  step="0.01"
                                  required
                                />
                              </div>
                              <Form.Text className="form-help-text">
                                ราคาสำหรับทั้งเด็ค
                              </Form.Text>
                            </Form.Group>
                          ) : (
                            <Form.Group className="mb-3 form-group-sakura">
                              <Form.Label className="form-label-sakura">
                                💰 ราคาต่อใบ (บาท)
                                <span className="required-badge">*</span>
                              </Form.Label>
                              <div className="input-with-icon">
                                <span className="input-icon-left">฿</span>
                                <Form.Control
                                  type="number"
                                  name="individualPrice"
                                  placeholder="0.00"
                                  value={formData.individualPrice}
                                  onChange={handleChange}
                                  className="form-control-sakura"
                                  min="0"
                                  step="0.01"
                                  required
                                />
                              </div>
                            </Form.Group>
                          )
                        ) : formData.postType === 'auction' ? (
                          formData.saleType === 'deck' ? (
                            <Form.Group className="mb-3 form-group-sakura">
                              <Form.Label className="form-label-sakura">
                                🚀 ราคาเริ่มต้นเด็ค (บาท)
                                <span className="required-badge">*</span>
                              </Form.Label>
                              <div className="input-with-icon">
                                <span className="input-icon-left">฿</span>
                                <Form.Control
                                  type="number"
                                  name="startingBid"
                                  placeholder="0.00"
                                  value={formData.startingBid}
                                  onChange={handleChange}
                                  className="form-control-sakura"
                                  min="0"
                                  step="0.01"
                                  required
                                />
                              </div>
                              <Form.Text className="form-help-text">
                                ราคาเริ่มต้นสำหรับทั้งเด็ค
                              </Form.Text>
                            </Form.Group>
                          ) : (
                            <Form.Group className="mb-3 form-group-sakura">
                              <Form.Label className="form-label-sakura">
                                🚀 ราคาเริ่มต้นต่อใบ (บาท)
                                <span className="required-badge">*</span>
                              </Form.Label>
                              <div className="input-with-icon">
                                <span className="input-icon-left">฿</span>
                                <Form.Control
                                  type="number"
                                  name="startingBid"
                                  placeholder="0.00"
                                  value={formData.startingBid}
                                  onChange={handleChange}
                                  className="form-control-sakura"
                                  min="0"
                                  step="0.01"
                                  required
                                />
                              </div>
                              <Form.Text className="form-help-text">
                                ราคาเริ่มต้นต่อการ์ด 1 ใบ
                              </Form.Text>
                            </Form.Group>
                          )
                        ) : null}
                      </Col>
                    </Row>
                  </div>

                  {/* Section 4: Deck-specific fields */}
                  {((formData.postType === 'sale' && formData.saleType === 'deck') || (formData.postType === 'auction' && formData.saleType === 'deck')) && (
                    <div className="form-section mb-4">
                      <div className="section-header mb-3">
                        <h5 className="section-title">
                          <span className="section-icon">🃏</span>
                          ข้อมูลเด็ค
                        </h5>
                        <p className="section-description">กรอกข้อมูลเกี่ยวกับเด็คการ์ด</p>
                      </div>
                      <Row>
                        <Col md={6}>
                          <Form.Group className="mb-3 form-group-sakura">
                            <Form.Label className="form-label-sakura">
                              🔢 จำนวนการ์ดในเด็ค
                              <span className="required-badge">*</span>
                            </Form.Label>
                            <Form.Control
                              type="number"
                              name="cardCount"
                              placeholder="เช่น 60"
                              value={formData.cardCount}
                              onChange={handleChange}
                              className="form-control-sakura"
                              min="1"
                              required
                            />
                            <Form.Text className="form-help-text">
                              จำนวนการ์ดทั้งหมดในเด็ค
                            </Form.Text>
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group className="mb-3 form-group-sakura">
                            <Form.Label className="form-label-sakura">
                              📝 รายละเอียดเด็ค
                              <span className="optional-badge">(ไม่บังคับ)</span>
                            </Form.Label>
                            <Form.Control
                              type="text"
                              name="deckDescription"
                              placeholder="เช่น Blue-Eyes Deck, Dragon Deck..."
                              value={formData.deckDescription || ''}
                              onChange={handleChange}
                              className="form-control-sakura"
                            />
                            <Form.Text className="form-help-text">
                              อธิบายประเภทเด็ค (ไม่บังคับ)
                            </Form.Text>
                          </Form.Group>
                        </Col>
                      </Row>
                    </div>
                  )}

                  {/* Section 5: Individual card-specific fields */}
                  {((formData.postType === 'sale' && formData.saleType === 'individual') || (formData.postType === 'auction' && formData.saleType === 'individual')) && (
                    <div className="form-section mb-4">
                      <div className="section-header mb-3">
                        <h5 className="section-title">
                          <span className="section-icon">🃏</span>
                          ข้อมูลการ์ดแยกใบ
                        </h5>
                        <p className="section-description">กรอกข้อมูลเกี่ยวกับการ์ดแยกใบ</p>
                      </div>
                      <Row>
                        <Col md={6}>
                          <Form.Group className="mb-3 form-group-sakura">
                            <Form.Label className="form-label-sakura">
                              📦 จำนวนที่ขายได้
                              <span className="required-badge">*</span>
                            </Form.Label>
                            <Form.Control
                              type="number"
                              name="availableQuantity"
                              placeholder="เช่น 10"
                              value={formData.availableQuantity}
                              onChange={handleChange}
                              className="form-control-sakura"
                              min="1"
                              required
                            />
                            <Form.Text className="form-help-text">
                              จำนวนการ์ดที่พร้อมขาย
                            </Form.Text>
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group className="mb-3 form-group-sakura">
                            <Form.Label className="form-label-sakura">
                              📂 หมวดหมู่
                              <span className="optional-badge">(ไม่บังคับ)</span>
                            </Form.Label>
                            <Form.Select
                              name="category"
                              value={formData.category}
                              onChange={handleChange}
                              className="form-control-sakura"
                            >
                              <option value="">เลือกหมวดหมู่ (ถ้าต้องการ)</option>
                              {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </Form.Select>
                            <Form.Text className="form-help-text">
                              เลือกประเภทการ์ดเกม
                            </Form.Text>
                          </Form.Group>
                        </Col>
                      </Row>
                    </div>
                  )}

                  {/* Category field for deck sales and auctions */}
                  {(formData.postType === 'auction' || (formData.postType === 'sale' && formData.saleType === 'deck')) && (
                    <div className="form-section mb-4">
                      <Row>
                        <Col md={6}>
                          <Form.Group className="mb-3 form-group-sakura">
                            <Form.Label className="form-label-sakura">
                              📂 หมวดหมู่
                              <span className="optional-badge">(ไม่บังคับ)</span>
                            </Form.Label>
                            <Form.Select
                              name="category"
                              value={formData.category}
                              onChange={handleChange}
                              className="form-control-sakura"
                            >
                              <option value="">เลือกหมวดหมู่ (ถ้าต้องการ)</option>
                              {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </Form.Select>
                            <Form.Text className="form-help-text">
                              เลือกประเภทการ์ดเกม
                            </Form.Text>
                          </Form.Group>
                        </Col>
                      </Row>
                    </div>
                  )}

                  {/* Section 6: Auction-specific fields */}
                  {formData.postType === 'auction' && (
                    <div className="form-section mb-4">
                      <div className="section-header mb-3">
                        <h5 className="section-title">
                          <span className="section-icon">🔨</span>
                          ข้อมูลการประมูล
                        </h5>
                        <p className="section-description">กรอกข้อมูลเกี่ยวกับการประมูล</p>
                      </div>
                      <Row>
                        <Col md={6}>
                          <Form.Group className="mb-3 form-group-sakura">
                            <Form.Label className="form-label-sakura">
                              ⏰ วันสิ้นสุดการประมูล
                              <span className="required-badge">*</span>
                            </Form.Label>
                            <Form.Control
                              type="datetime-local"
                              name="auctionEndDate"
                              value={formData.auctionEndDate}
                              onChange={handleChange}
                              className="form-control-sakura"
                              min={new Date().toISOString().slice(0, 16)}
                              required
                            />
                            <Form.Text className="form-help-text">
                              เลือกวันและเวลาที่การประมูลจะสิ้นสุด
                            </Form.Text>
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group className="mb-3 form-group-sakura">
                            <Form.Label className="form-label-sakura">
                              💎 ราคาซื้อทันที (บาท)
                              <span className="optional-badge">(ไม่บังคับ)</span>
                            </Form.Label>
                            <div className="input-with-icon">
                              <span className="input-icon-left">฿</span>
                              <Form.Control
                                type="number"
                                name="buyNowPrice"
                                placeholder="0.00"
                                value={formData.buyNowPrice}
                                onChange={handleChange}
                                className="form-control-sakura"
                                min="0"
                                step="0.01"
                              />
                            </div>
                            <Form.Text className="form-help-text">
                              ราคาที่ผู้ซื้อสามารถซื้อได้ทันทีโดยไม่ต้องรอการประมูล
                            </Form.Text>
                          </Form.Group>
                        </Col>
                      </Row>
                    </div>
                  )}

                  {/* Section 7: Description */}
                  <div className="form-section mb-4">
                    <div className="section-header mb-3">
                      <h5 className="section-title">
                        <span className="section-icon">📝</span>
                        รายละเอียดเพิ่มเติม
                        <span className="optional-badge">(ไม่บังคับ)</span>
                      </h5>
                      <p className="section-description">อธิบายรายละเอียดเพิ่มเติมเกี่ยวกับการ์ด</p>
                    </div>
                    <Form.Group className="mb-3 form-group-sakura">
                      <Form.Control
                        as="textarea"
                        rows={5}
                        name="description"
                        placeholder="เช่น สภาพการ์ด, เงื่อนไขการขาย, ข้อมูลเพิ่มเติม..."
                        value={formData.description}
                        onChange={handleChange}
                        className="form-control-sakura"
                        style={{ resize: 'vertical' }}
                      />
                      <Form.Text className="form-help-text">
                        อธิบายรายละเอียดเพิ่มเติม เช่น สภาพการ์ด, เงื่อนไขการขาย, ข้อมูลเพิ่มเติม
                      </Form.Text>
                    </Form.Group>
                  </div>

                  {/* Section 8: Images */}
                  <div className="form-section mb-4">
                    <div className="section-header mb-3">
                      <h5 className="section-title">
                        <span className="section-icon">📷</span>
                        รูปภาพการ์ด
                        <span className="required-badge">*</span>
                      </h5>
                      <p className="section-description">อัปโหลดรูปภาพการ์ดของคุณ (อย่างน้อย 1 รูป)</p>
                    </div>
                    <Form.Group className="mb-3 form-group-sakura">
                      <div className="file-upload-wrapper">
                        <Form.Control
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleImageChange}
                          className="form-control-sakura file-input-modern"
                          id="image-upload"
                        />
                        <label htmlFor="image-upload" className="file-upload-label">
                          <div className="file-upload-content">
                            <span className="file-upload-icon">📤</span>
                            <div>
                              <div className="file-upload-text">
                                คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
                              </div>
                              <div className="file-upload-hint">
                                รองรับ JPG, PNG, GIF (สูงสุด 5 ไฟล์, ไม่เกิน 10MB ต่อไฟล์)
                              </div>
                            </div>
                          </div>
                        </label>
                      </div>
                      {formData.images.length > 0 && (
                        <div className="file-selected-info mt-3">
                          <div className="file-count-badge">
                            <span className="file-count-icon">✅</span>
                            <span>เลือกแล้ว {formData.images.length} ไฟล์</span>
                          </div>
                          <div className="file-list mt-2">
                            {Array.from(formData.images).map((file, index) => (
                              <div key={index} className="file-item">
                                <span className="file-item-icon">🖼️</span>
                                <span className="file-item-name">{file.name}</span>
                                <span className="file-item-size">
                                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Form.Group>
                  
                    {/* Card Detection Section - Only show for individual sale */}
                    {formData.postType === 'sale' && formData.saleType === 'individual' && formData.images.length > 0 && (
                      <div className="card-detection-section mt-4">
                        <div className="detection-header">
                          <div>
                            <h6 className="detection-title">
                              <span className="detection-icon">✨</span>
                              การแยกการ์ดอัตโนมัติ
                            </h6>
                            <p className="detection-description">
                              ใช้ AI ในการแยกการ์ดแต่ละใบจากภาพอัตโนมัติ
                            </p>
                          </div>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={processImagesForCards}
                            disabled={processingCards}
                            className="detection-button"
                          >
                            {processingCards ? (
                              <>
                                <Spinner size="sm" className="me-2" />
                                กำลังประมวลผล...
                              </>
                            ) : (
                              <>
                                <span className="me-2">🔍</span>
                                แยกการ์ดอัตโนมัติ
                              </>
                            )}
                          </Button>
                        </div>
                        
                        {detectedCards.length > 0 && (
                          <div className="detected-cards-preview mt-4">
                            <div className="detected-cards-header">
                              <div className="success-badge">
                                <span className="success-icon">✅</span>
                                <span>พบการ์ด {detectedCards.length} ใบ</span>
                              </div>
                              <p className="detected-cards-hint">
                                กรุณากรอกราคาและจำนวนต่อใบให้ครบทุกการ์ด
                              </p>
                            </div>
                            <div className="cards-preview-grid">
                              {detectedCards.map((card, index) => (
                                <div key={card.id} className="card-preview-item">
                                  <div className="card-preview-image-wrapper">
                                    <img
                                      src={card.imageUrl}
                                      alt={`การ์ด ${index + 1}`}
                                      className="card-preview-image"
                                    />
                                    <div className="card-preview-number">#{index + 1}</div>
                                  </div>
                                  <div className="card-preview-form">
                                    <Form.Group className="mb-2">
                                      <Form.Label className="card-form-label">จำนวน</Form.Label>
                                      <Form.Control
                                        type="number"
                                        placeholder="1"
                                        min="1"
                                        value={card.quantity}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                          const val = e.target.value;
                                          setDetectedCards(prev => prev.map(c => c.id === card.id ? { ...c, quantity: val } : c));
                                        }}
                                        className="form-control-sakura"
                                      />
                                    </Form.Group>
                                    <Form.Group>
                                      <Form.Label className="card-form-label">ราคา (บาท)</Form.Label>
                                      <div className="input-with-icon">
                                        <span className="input-icon-left">฿</span>
                                        <Form.Control
                                          type="number"
                                          placeholder="0.00"
                                          min="0"
                                          step="0.01"
                                          value={card.price}
                                          onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                            const val = e.target.value;
                                            setDetectedCards(prev => prev.map(c => c.id === card.id ? { ...c, price: val } : c));
                                          }}
                                          className="form-control-sakura"
                                        />
                                      </div>
                                    </Form.Group>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Upload Progress */}
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="upload-progress-section mb-4">
                      <div className="progress-label mb-2">
                        <span>📤 กำลังอัปโหลด...</span>
                        <span className="progress-percentage">{uploadProgress}%</span>
                      </div>
                      <ProgressBar 
                        now={uploadProgress} 
                        label={`${uploadProgress}%`}
                        className="upload-progress-bar"
                        style={{
                          height: '10px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: 'var(--gray-200)'
                        }}
                      />
                    </div>
                  )}

                  {/* Submit Buttons */}
                  <div className="form-actions">
                    <PrimaryActionButton
                      type="submit"
                      disabled={loading}
                      className="submit-button"
                    >
                      {loading ? (
                        <>
                          <Spinner size="sm" className="me-2" />
                          {formData.postType === 'auction' ? 'กำลังสร้างการประมูล...' : 'กำลังสร้างโพสต์...'}
                        </>
                      ) : (
                        <>
                          <span className="me-2">
                            {formData.postType === 'auction' ? '🔨' : '✅'}
                          </span>
                          {formData.postType === 'auction' ? 'สร้างการประมูล' : 'สร้างโพสต์'}
                        </>
                      )}
                    </PrimaryActionButton>
                    <SecondaryActionButton
                      type="button"
                      onClick={() => navigate('/')}
                      className="cancel-button"
                    >
                      ยกเลิก
                    </SecondaryActionButton>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default CreatePost;


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
    <Container className="py-4">
      <Row className="justify-content-center">
        <Col lg={8}>
          <Card className="sakura-card" style={{
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-xl)',
            overflow: 'hidden'
          }}>
            <Card.Header style={{
              background: 'linear-gradient(135deg, var(--muted-olive) 0%, var(--faded-copper) 100%)',
              color: 'var(--text-light)',
              border: 'none',
              padding: '1.5rem 2rem'
            }}>
              <h3 className="mb-0" style={{
                fontSize: '1.75rem',
                fontWeight: '700',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}>
                {formData.postType === 'auction' ? '🔨 ประมูลการ์ดเกม' : '🃏 ขายการ์ดเกม'}
              </h3>
            </Card.Header>
            <Card.Body style={{ padding: '2rem' }}>
              {error && (
                <Alert variant="danger" className="alert-sakura-danger">
                  {error}
                </Alert>
              )}

              <Form onSubmit={handleSubmit}>
                {/* Post Type Selection */}
                <Row className="mb-3">
                  <Col>
                    <Form.Group className="mb-3 form-group-sakura">
                      <Form.Label className="form-label-sakura">📋 ประเภทโพสต์ *</Form.Label>
                      <div className="d-flex gap-3">
                        <Form.Check
                          type="radio"
                          id="postType-sale"
                          name="postType"
                          value="sale"
                          checked={formData.postType === 'sale'}
                          onChange={handleChange}
                          label="🛒 ขายการ์ด (Card Sale)"
                          className="form-check-sakura"
                        />
                        <Form.Check
                          type="radio"
                          id="postType-auction"
                          name="postType"
                          value="auction"
                          checked={formData.postType === 'auction'}
                          onChange={handleChange}
                          label="🔨 ประมูลการ์ด (Auction)"
                          className="form-check-sakura"
                        />
                      </div>
                    </Form.Group>
                  </Col>
                </Row>

                {/* Sale Type Selection - Show for both sale and auction posts */}
                {(formData.postType === 'sale' || formData.postType === 'auction') && (
                  <Row className="mb-3">
                    <Col>
                      <Form.Group className="mb-3 form-group-sakura">
                        <Form.Label className="form-label-sakura">🎯 ประเภทการขาย *</Form.Label>
                        <div className="d-flex gap-3">
                          <Form.Check
                            type="radio"
                            id="saleType-deck"
                            name="saleType"
                            value="deck"
                            checked={formData.saleType === 'deck'}
                            onChange={handleChange}
                            label={formData.postType === 'auction' ? "🃏 ประมูลเป็นเด็ค (Deck Auction)" : "🃏 ขายเป็นเด็ค (Deck Sale)"}
                            className="form-check-sakura"
                          />
                          <Form.Check
                            type="radio"
                            id="saleType-individual"
                            name="saleType"
                            value="individual"
                            checked={formData.saleType === 'individual'}
                            onChange={handleChange}
                            label={formData.postType === 'auction' ? "🃏 ประมูลแยกใบ (Individual Auction)" : "🃏 ขายแยกใบ (Individual Cards)"}
                            className="form-check-sakura"
                          />
                        </div>
                      </Form.Group>
                    </Col>
                  </Row>
                )}

                <Row>
                  <Col md={8}>
                    <Form.Group className="mb-3 form-group-sakura">
                      <Form.Label className="form-label-sakura">🃏 ชื่อการ์ด (ไม่บังคับ)</Form.Label>
                      <Form.Control
                        type="text"
                        name="title"
                        placeholder="กรอกชื่อการ์ด (ถ้าต้องการ)"
                        value={formData.title}
                        onChange={handleChange}
                        className="form-control-sakura"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    {formData.postType === 'sale' ? (
                      // Sale type specific price fields
                      formData.saleType === 'deck' ? (
                        <Form.Group className="mb-3 form-group-sakura">
                          <Form.Label className="form-label-sakura">💰 ราคาเด็ค (บาท) *</Form.Label>
                          <Form.Control
                            type="number"
                            name="price"
                            placeholder="0"
                            value={formData.price}
                            onChange={handleChange}
                            className="form-control-sakura"
                            min="0"
                            step="0.01"
                            required
                          />
                          <Form.Text className="text-muted">
                            ราคาสำหรับทั้งเด็ค
                          </Form.Text>
                        </Form.Group>
                      ) : (
                        <Form.Group className="mb-3 form-group-sakura">
                          <Form.Label className="form-label-sakura">💰 ราคาต่อใบ (บาท) *</Form.Label>
                          <Form.Control
                            type="number"
                            name="individualPrice"
                            placeholder="0"
                            value={formData.individualPrice}
                            onChange={handleChange}
                            className="form-control-sakura"
                            min="0"
                            step="0.01"
                            required
                          />
                        </Form.Group>
                      )
                    ) : formData.postType === 'auction' ? (
                      // Auction type specific price fields
                      formData.saleType === 'deck' ? (
                        <Form.Group className="mb-3 form-group-sakura">
                          <Form.Label className="form-label-sakura">🚀 ราคาเริ่มต้นเด็ค (บาท) *</Form.Label>
                          <Form.Control
                            type="number"
                            name="startingBid"
                            placeholder="0"
                            value={formData.startingBid}
                            onChange={handleChange}
                            className="form-control-sakura"
                            min="0"
                            step="0.01"
                            required
                          />
                          <Form.Text className="text-muted">
                            ราคาเริ่มต้นสำหรับทั้งเด็ค
                          </Form.Text>
                        </Form.Group>
                      ) : (
                        <Form.Group className="mb-3 form-group-sakura">
                          <Form.Label className="form-label-sakura">🚀 ราคาเริ่มต้นต่อใบ (บาท) *</Form.Label>
                          <Form.Control
                            type="number"
                            name="startingBid"
                            placeholder="0"
                            value={formData.startingBid}
                            onChange={handleChange}
                            className="form-control-sakura"
                            min="0"
                            step="0.01"
                            required
                          />
                          <Form.Text className="text-muted">
                            ราคาเริ่มต้นต่อการ์ด 1 ใบ
                          </Form.Text>
                        </Form.Group>
                      )
                    ) : null}
                  </Col>
                </Row>

                {/* Deck-specific fields */}
                {((formData.postType === 'sale' && formData.saleType === 'deck') || (formData.postType === 'auction' && formData.saleType === 'deck')) && (
                  <Row className="mb-3">
                    <Col md={6}>
                      <Form.Group className="mb-3 form-group-sakura">
                        <Form.Label className="form-label-sakura">🔢 จำนวนการ์ดในเด็ค *</Form.Label>
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
                        <Form.Text className="text-muted">
                          จำนวนการ์ดทั้งหมดในเด็ค
                        </Form.Text>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3 form-group-sakura">
                        <Form.Label className="form-label-sakura">📝 รายละเอียดเด็ค</Form.Label>
                        <Form.Control
                          type="text"
                          name="deckDescription"
                          placeholder="เช่น Blue-Eyes Deck, Dragon Deck..."
                          value={formData.deckDescription || ''}
                          onChange={handleChange}
                          className="form-control-sakura"
                        />
                        <Form.Text className="text-muted">
                          อธิบายประเภทเด็ค (ไม่บังคับ)
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>
                )}

                {/* Individual card-specific fields */}
                {((formData.postType === 'sale' && formData.saleType === 'individual') || (formData.postType === 'auction' && formData.saleType === 'individual')) && (
                  <Row className="mb-3">
                    <Col md={6}>
                      <Form.Group className="mb-3 form-group-sakura">
                        <Form.Label className="form-label-sakura">📦 จำนวนที่ขายได้ *</Form.Label>
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
                        <Form.Text className="text-muted">
                          จำนวนการ์ดที่พร้อมขาย
                        </Form.Text>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3 form-group-sakura">
                        <Form.Label className="form-label-sakura">📂 หมวดหมู่ (ไม่บังคับ)</Form.Label>
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
                      </Form.Group>
                    </Col>
                  </Row>
                )}

                {/* Category field for deck sales and auctions */}
                {(formData.postType === 'auction' || (formData.postType === 'sale' && formData.saleType === 'deck')) && (
                  <Row className="mb-3">
                    <Col md={6}>
                      <Form.Group className="mb-3 form-group-sakura">
                        <Form.Label className="form-label-sakura">📂 หมวดหมู่ (ไม่บังคับ)</Form.Label>
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
                      </Form.Group>
                    </Col>
                  </Row>
                )}

                {/* Auction-specific fields */}
                {formData.postType === 'auction' && (
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3 form-group-sakura">
                        <Form.Label className="form-label-sakura">⏰ วันสิ้นสุดการประมูล *</Form.Label>
                        <Form.Control
                          type="datetime-local"
                          name="auctionEndDate"
                          value={formData.auctionEndDate}
                          onChange={handleChange}
                          className="form-control-sakura"
                          min={new Date().toISOString().slice(0, 16)}
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3 form-group-sakura">
                        <Form.Label className="form-label-sakura">💎 ราคาซื้อทันที (บาท)</Form.Label>
                        <Form.Control
                          type="number"
                          name="buyNowPrice"
                          placeholder="ไม่บังคับ"
                          value={formData.buyNowPrice}
                          onChange={handleChange}
                          className="form-control-sakura"
                          min="0"
                          step="0.01"
                        />
                        <Form.Text className="text-muted">
                          ราคาที่ผู้ซื้อสามารถซื้อได้ทันทีโดยไม่ต้องรอการประมูล
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>
                )}

                <Form.Group className="mb-3 form-group-sakura">
                  <Form.Label className="form-label-sakura">📝 รายละเอียด (ไม่บังคับ)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    name="description"
                    placeholder="อธิบายรายละเอียดการ์ด (ถ้าต้องการ)..."
                    value={formData.description}
                    onChange={handleChange}
                    className="form-control-sakura"
                  />
                </Form.Group>

                <Form.Group className="mb-3 form-group-sakura">
                  <Form.Label className="form-label-sakura">📷 รูปภาพการ์ด *</Form.Label>
                  <Form.Control
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageChange}
                    className="form-control-sakura"
                  />
                  <Form.Text className="text-muted">
                    รองรับไฟล์ JPG, PNG, GIF ขนาดไม่เกิน 10MB ต่อไฟล์ (บังคับอย่างน้อย 1 รูป)
                  </Form.Text>
                  {formData.images.length > 0 && (
                    <div className="mt-2">
                      <small className="text-success">
                        ✅ เลือกแล้ว {formData.images.length} ไฟล์
                      </small>
                    </div>
                  )}
                  
                  {/* Card Detection Section - Only show for individual sale */}
                  {formData.postType === 'sale' && formData.saleType === 'individual' && formData.images.length > 0 && (
                    <div className="card-detection-section mt-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <h6 className="mb-0">
                          <i className="fas fa-magic me-2"></i>
                          การแยกการ์ดอัตโนมัติ
                        </h6>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={processImagesForCards}
                          disabled={processingCards}
                        >
                          {processingCards ? (
                            <>
                              <Spinner size="sm" className="me-2" />
                              กำลังประมวลผล...
                            </>
                          ) : (
                            <>
                              <i className="fas fa-cogs me-2"></i>
                              แยกการ์ดอัตโนมัติ
                            </>
                          )}
                        </Button>
                      </div>
                      <Form.Text className="text-muted">
                        ใช้ AI ในการแยกการ์ดแต่ละใบจากภาพอัตโนมัติ
                      </Form.Text>
                      
                      {detectedCards.length > 0 && (
                        <div className="detected-cards-preview mt-3">
                          <h6 className="text-success">
                            <i className="fas fa-check-circle me-2"></i>
                            พบการ์ด {detectedCards.length} ใบ - กรอกราคาและจำนวนต่อใบ
                          </h6>
                          <div className="cards-preview-grid">
                            {detectedCards.map((card, index) => (
                              <div key={card.id} className="card-preview-item">
                                <img
                                  src={card.imageUrl}
                                  alt={`การ์ด ${index + 1}`}
                                  className="card-preview-image"
                                />
                                <div className="card-preview-info">
                                  <small className="text-muted">การ์ด #{index + 1}</small>
                                </div>
                                <div className="mt-2">
                                  <Form.Control
                                    type="number"
                                    placeholder="จำนวน"
                                    min="1"
                                    value={card.quantity}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                      const val = e.target.value;
                                      setDetectedCards(prev => prev.map(c => c.id === card.id ? { ...c, quantity: val } : c));
                                    }}
                                    className="form-control-sakura mb-2"
                                  />
                                  <Form.Control
                                    type="number"
                                    placeholder="ราคา (บาท)"
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
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Form.Group>

                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="mb-3">
                    <ProgressBar now={uploadProgress} label={`${uploadProgress}%`} />
                  </div>
                )}

                <div className="d-flex gap-2">
                  <Button
                    type="submit"
                    className="btn-tcg-primary btn-tcg-lg"
                    disabled={loading}
                  >
                    {loading 
                      ? (formData.postType === 'auction' ? 'กำลังสร้างการประมูล...' : 'กำลังสร้างโพสต์...')
                      : (formData.postType === 'auction' ? 'สร้างการประมูล' : 'สร้างโพสต์')
                    }
                  </Button>
                  <Button
                    type="button"
                    className="btn-tcg-outline btn-tcg-lg"
                    onClick={() => navigate('/')}
                  >
                    ยกเลิก
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default CreatePost;


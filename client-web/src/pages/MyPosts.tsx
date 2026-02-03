import React, { useState, FormEvent, ChangeEvent } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, ProgressBar } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from '../utils/axiosInterceptor';
import { toast } from 'react-toastify';
import { Category } from '../types';

interface BuyingFormData {
  title: string;
  description: string;
  maxPrice: string;
  category: string;
  images: File[];
}

const categories: Category[] = [
  'Yu-Gi-Oh!',
  'Pokemon Card Game',
  'Cardfight!! Vanguard',
  'Battle Spirits',
  'Digimon Card Game',
  'One Piece Card Game',
  'Shadowverse Evolve',
  'Weiß Schwarz',
  'Rebirth for you',
  'hololive card game',
  'union arena',
  'wixross',
  'gundam card game',
  'อื่นๆ'
];

const CardBuying: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState<BuyingFormData>({
    title: '',
    description: '',
    maxPrice: '',
    category: '',
    images: []
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);

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
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.title || !formData.description || !formData.maxPrice || !formData.category) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    // Validate max price
    if (parseFloat(formData.maxPrice) <= 0) {
      setError('ราคาสูงสุดต้องมากกว่า 0');
      toast.error('ราคาสูงสุดต้องมากกว่า 0');
      return;
    }

    // Validate title length
    if (formData.title.length < 3) {
      setError('ชื่อการ์ดต้องมีอย่างน้อย 3 ตัวอักษร');
      toast.error('ชื่อการ์ดต้องมีอย่างน้อย 3 ตัวอักษร');
      return;
    }

    // Validate description length
    if (formData.description.length < 10) {
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
      submitData.append('maxPrice', formData.maxPrice);
      submitData.append('category', formData.category);
      submitData.append('postType', 'buying');

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

      toast.success('สร้างโพสต์หาซื้อสำเร็จ! 🎉');
      navigate(`/post/${response.data.id}`);
    } catch (error: any) {
      console.error('Error creating buying post:', error);
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
          <Card className="sakura-card">
            <Card.Header>
              <h3 className="mb-0">🛒 หาซื้อการ์ดเกม</h3>
            </Card.Header>
            <Card.Body>
              {error && (
                <Alert variant="danger" className="alert-sakura-danger">
                  {error}
                </Alert>
              )}

              <Form onSubmit={handleSubmit}>
                <Row>
                  <Col md={8}>
                    <Form.Group className="mb-3 form-group-sakura">
                      <Form.Label className="form-label-sakura">ชื่อการ์ดที่ต้องการ *</Form.Label>
                      <Form.Control
                        type="text"
                        name="title"
                        placeholder="กรอกชื่อการ์ดที่ต้องการ"
                        value={formData.title}
                        onChange={handleChange}
                        className="form-control-sakura"
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3 form-group-sakura">
                      <Form.Label className="form-label-sakura">ราคาสูงสุด (บาท) *</Form.Label>
                      <Form.Control
                        type="number"
                        name="maxPrice"
                        placeholder="0"
                        value={formData.maxPrice}
                        onChange={handleChange}
                        className="form-control-sakura"
                        min="0"
                        step="0.01"
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3 form-group-sakura">
                      <Form.Label className="form-label-sakura">หมวดหมู่ *</Form.Label>
                      <Form.Select
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        className="form-control-sakura"
                        required
                      >
                        <option value="">เลือกหมวดหมู่</option>
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3 form-group-sakura">
                  <Form.Label className="form-label-sakura">รายละเอียดที่ต้องการ *</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    name="description"
                    placeholder="อธิบายรายละเอียดการ์ดที่ต้องการ เช่น จำนวน, สภาพ, เงื่อนไขการซื้อ..."
                    value={formData.description}
                    onChange={handleChange}
                    className="form-control-sakura"
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3 form-group-sakura">
                  <Form.Label className="form-label-sakura">รูปภาพตัวอย่าง (สูงสุด 5 รูป)</Form.Label>
                  <Form.Control
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageChange}
                    className="form-control-sakura"
                  />
                  <Form.Text className="text-muted">
                    รองรับไฟล์ JPG, PNG, GIF ขนาดไม่เกิน 10MB ต่อไฟล์
                  </Form.Text>
                  {formData.images.length > 0 && (
                    <div className="mt-2">
                      <small className="text-muted">
                        เลือกแล้ว {formData.images.length} ไฟล์
                      </small>
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
                    variant="primary"
                    disabled={loading}
                    className="btn-sakura"
                  >
                    {loading ? 'กำลังสร้างโพสต์...' : 'สร้างโพสต์หาซื้อ'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline-secondary"
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

export default CardBuying;


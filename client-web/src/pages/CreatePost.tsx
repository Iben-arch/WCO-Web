import React, { useState, FormEvent, ChangeEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { useAuth } from '../contexts/AuthContext';
import { canSellCards } from '../utils/roles';
import axios from '../utils/axiosInterceptor';
import { supabase } from '../config/supabase';
import { toast } from 'react-toastify';
import { 
  PrimaryActionButton,
  SecondaryActionButton
} from '../components/common/ButtonComponents';
import { Category, PostType, SaleType, CreatePostFormData, DetectedCard } from '../types';
import '../styles/individual-card.css';

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

const Container: React.FC<any> = ({ className, children }) => <div className={cx('container', className)}>{children}</div>;
const Row: React.FC<any> = ({ className, children }) => <div className={cx('grid grid-cols-12 gap-4', className)}>{children}</div>;
const Col: React.FC<any> = ({ className, children, xs, md, lg, xl }) => {
  const xsMap: Record<number, string> = { 1:'col-span-1',2:'col-span-2',3:'col-span-3',4:'col-span-4',5:'col-span-5',6:'col-span-6',7:'col-span-7',8:'col-span-8',9:'col-span-9',10:'col-span-10',11:'col-span-11',12:'col-span-12' };
  const mdMap: Record<number, string> = { 1:'md:col-span-1',2:'md:col-span-2',3:'md:col-span-3',4:'md:col-span-4',5:'md:col-span-5',6:'md:col-span-6',7:'md:col-span-7',8:'md:col-span-8',9:'md:col-span-9',10:'md:col-span-10',11:'md:col-span-11',12:'md:col-span-12' };
  const lgMap: Record<number, string> = { 1:'lg:col-span-1',2:'lg:col-span-2',3:'lg:col-span-3',4:'lg:col-span-4',5:'lg:col-span-5',6:'lg:col-span-6',7:'lg:col-span-7',8:'lg:col-span-8',9:'lg:col-span-9',10:'lg:col-span-10',11:'lg:col-span-11',12:'lg:col-span-12' };
  const xlMap: Record<number, string> = { 1:'xl:col-span-1',2:'xl:col-span-2',3:'xl:col-span-3',4:'xl:col-span-4',5:'xl:col-span-5',6:'xl:col-span-6',7:'xl:col-span-7',8:'xl:col-span-8',9:'xl:col-span-9',10:'xl:col-span-10',11:'xl:col-span-11',12:'xl:col-span-12' };
  return <div className={cx(xs ? xsMap[xs] : 'col-span-12', md ? mdMap[md] : '', lg ? lgMap[lg] : '', xl ? xlMap[xl] : '', className)}>{children}</div>;
};

const CardRoot: React.FC<any> = ({ className, children, style }) => <div className={cx('card bg-base-100 border border-base-300 shadow-sm', className)} style={style}>{children}</div>;
const CardHeader: React.FC<any> = ({ className, children }) => <div className={cx('px-6 py-4 border-b border-base-300', className)}>{children}</div>;
const CardBody: React.FC<any> = ({ className, children }) => <div className={cx('card-body', className)}>{children}</div>;
const CardImg: React.FC<any> = ({ className, ...props }) => <img className={cx('w-full', className)} {...props} alt={props.alt || ''} />;
const Card = Object.assign(CardRoot, { Header: CardHeader, Body: CardBody, Img: CardImg });

const Button: React.FC<any> = ({ variant, size, className, children, ...props }) => {
  const v = variant === 'primary' ? 'btn-primary'
    : variant === 'secondary' ? 'btn-secondary'
    : variant === 'outline-secondary' ? 'btn-outline'
    : variant === 'outline-primary' ? 'btn-outline btn-primary'
    : variant === 'danger' ? 'btn-error'
    : '';
  const s = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';
  return <button className={cx('btn', v, s, className)} {...props}>{children}</button>;
};
const Alert: React.FC<any> = ({ variant, className, children, ...props }) => (
  <div className={cx('alert', variant === 'danger' ? 'alert-error' : '', variant === 'warning' ? 'alert-warning' : '', variant === 'info' ? 'alert-info' : '', className)} {...props}>
    <span>{children}</span>
  </div>
);
const Spinner: React.FC<any> = ({ size, className, as }) => {
  if (as === 'span') return <span className={cx('loading loading-spinner', size === 'sm' ? 'loading-sm' : '', className)} />;
  return <span className={cx('loading loading-spinner', size === 'sm' ? 'loading-sm' : '', className)} />;
};
const ProgressBar: React.FC<any> = ({ now = 0, label, className }) => (
  <progress className={cx('progress progress-primary w-full', className)} value={now} max={100} aria-label={label || 'progress'} />
);

type FormType = React.FC<any> & { Group: React.FC<any>; Label: React.FC<any>; Control: React.FC<any>; Select: React.FC<any>; Check: React.FC<any>; Text: React.FC<any> };
const FormRoot: React.FC<any> = ({ className, children, ...props }) => <form className={className} {...props}>{children}</form>;
const FormGroup: React.FC<any> = ({ className, children }) => <div className={className}>{children}</div>;
const FormLabel: React.FC<any> = ({ className, children }) => <label className={cx('label-text font-medium', className)}>{children}</label>;
const FormControl: React.FC<any> = ({ className, as, type, ...props }) => {
  if (as === 'textarea') return <textarea className={cx('textarea textarea-bordered w-full', className)} {...props} />;
  if (type === 'file') return <input type="file" className={cx('file-input file-input-bordered w-full', className)} {...props} />;
  return <input type={type} className={cx('input input-bordered w-full', className)} {...props} />;
};
const FormSelect: React.FC<any> = ({ className, children, ...props }) => <select className={cx('select select-bordered w-full', className)} {...props}>{children}</select>;
const FormCheck: React.FC<any> = ({ id, type = 'radio', label, name, checked, onChange, className }) => (
  <label htmlFor={id} className={cx('label cursor-pointer justify-start gap-3', className)}>
    <input id={id} type={type} name={name} checked={checked} onChange={onChange} className={cx(type === 'radio' ? 'radio radio-primary' : 'checkbox checkbox-primary')} />
    <span className="label-text">{label}</span>
  </label>
);
const FormText: React.FC<any> = ({ className, children }) => <small className={cx('text-base-content/60', className)}>{children}</small>;
const Form = Object.assign(FormRoot, { Group: FormGroup, Label: FormLabel, Control: FormControl, Select: FormSelect, Check: FormCheck, Text: FormText }) as FormType;

type ModalType = React.FC<any> & { Header: React.FC<any>; Title: React.FC<any>; Body: React.FC<any> };
const Modal = (({ show, onHide, children }) => {
  if (!show) return null;
  const withClose = React.Children.map(children, (child) =>
    React.isValidElement(child) ? React.cloneElement(child as React.ReactElement<any>, { __onHide: onHide }) : child
  );
  return (
    <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onHide}>
      <div className="card bg-base-100 w-full max-w-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>{withClose}</div>
    </div>
  );
}) as ModalType;
const ModalHeader: React.FC<any> = ({ children, closeButton, __onHide }) => (
  <div className="px-6 py-4 border-b border-base-300 flex items-center justify-between">
    <div className="font-bold text-lg">{children}</div>
    {closeButton ? <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={__onHide}>✕</button> : null}
  </div>
);
const ModalTitle: React.FC<any> = ({ children }) => <>{children}</>;
const ModalBody: React.FC<any> = ({ children, className }) => <div className={cx('px-6 py-4', className)}>{children}</div>;
Object.assign(Modal, { Header: ModalHeader, Title: ModalTitle, Body: ModalBody });

const ImagePreviewThumbnail: React.FC<{ file: File; index: number; onClick: () => void; onRemove?: () => void }> = ({ file, index, onClick, onRemove }) => {
  const [url, setUrl] = useState<string>(() => URL.createObjectURL(file));
  React.useEffect(() => {
    const newUrl = URL.createObjectURL(file);
    setUrl((prev) => {
      URL.revokeObjectURL(prev);
      return newUrl;
    });
    return () => URL.revokeObjectURL(newUrl);
  }, [file]);
  return (
    <div className="position-relative image-preview-thumbnail-wrapper" style={{ cursor: 'pointer', flex: '0 0 auto' }}>
      <div onClick={onClick}>
        <img
          src={url}
          alt={`รูป ${index + 1}`}
          className="rounded"
          style={{
            width: '120px',
            height: '168px',
            objectFit: 'cover',
            border: '2px solid var(--gray-300)',
            transition: 'border-color 0.2s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--gray-300)'; }}
        />
        <div
          className="position-absolute bottom-0 start-0 end-0 text-center py-1 rounded-bottom"
          style={{ background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.75rem' }}
        >
          #{index + 1} · {(file.size / 1024).toFixed(0)} KB
        </div>
      </div>
      {onRemove && (
        <button
          type="button"
          className="image-preview-remove-btn"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label="ลบรูป"
        >
          ×
        </button>
      )}
    </div>
  );
};

/** Create an Image from URL for canvas crop */
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });

/** Get cropped image as base64 data URL from image source and pixel area */
async function getCroppedImg(imageSrc: string, pixelArea: Area): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');
  canvas.width = pixelArea.width;
  canvas.height = pixelArea.height;
  ctx.drawImage(
    image,
    pixelArea.x,
    pixelArea.y,
    pixelArea.width,
    pixelArea.height,
    0,
    0,
    pixelArea.width,
    pixelArea.height
  );
  return canvas.toDataURL('image/jpeg', 0.9);
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

const STEPS = [
  { id: 1, label: 'ประเภท' },
  { id: 2, label: 'รูปภาพ' },
  { id: 3, label: 'ข้อมูล' },
  { id: 4, label: 'สรุป' }
];

const CreatePost: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, profile, userProfile, loading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState<number>(1);
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
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [cropImageIndex, setCropImageIndex] = useState<number>(0);
  const [cropAreaPixels, setCropAreaPixels] = useState<Area | null>(null);
  const [cropZoom, setCropZoom] = useState<number>(1);
  const [cropPosition, setCropPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [addingCrop, setAddingCrop] = useState<boolean>(false);
  const [cropImageObjectUrl, setCropImageObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      navigate('/login', { replace: true });
      return;
    }
    if (!profile && !userProfile) return;
    const r = profile?.role ?? userProfile?.role;
    if (!canSellCards(r)) {
      toast.warning('กรุณาสมัครเป็นผู้ขายจากหน้าแรกก่อนสร้างโพสต์');
      navigate('/', { replace: true });
    }
  }, [authLoading, currentUser, profile, userProfile, navigate]);

  useEffect(() => {
    if (previewImageIndex !== null && formData.images[previewImageIndex]) {
      const url = URL.createObjectURL(formData.images[previewImageIndex]);
      setPreviewImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewImageUrl(null);
  }, [previewImageIndex, formData.images]);

  useEffect(() => {
    if (formData.images.length > 0 && cropImageIndex >= 0 && cropImageIndex < formData.images.length) {
      const url = URL.createObjectURL(formData.images[cropImageIndex]);
      setCropImageObjectUrl(url);
      setCropPosition({ x: 0, y: 0 });
      setCropZoom(1);
      setCropAreaPixels(null);
      return () => URL.revokeObjectURL(url);
    }
    setCropImageObjectUrl(null);
    setCropAreaPixels(null);
  }, [cropImageIndex, formData.images]);

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
    setDetectedCards([]);
  };

  const handleRemoveImage = (index: number): void => {
    const newImages = formData.images.filter((_, i) => i !== index);
    setFormData({ ...formData, images: newImages });
    setDetectedCards([]);
    if (previewImageIndex === index) {
      setPreviewImageIndex(null);
    } else if (previewImageIndex !== null && previewImageIndex > index) {
      setPreviewImageIndex(previewImageIndex - 1);
    }
  };

  const handleAddCroppedCard = async (): Promise<void> => {
    if (!cropAreaPixels || formData.images.length === 0) {
      toast.error('กรุณาลากเลือกพื้นที่การ์ดก่อนกดเพิ่มการ์ด');
      return;
    }
    const file = formData.images[cropImageIndex];
    if (!file) return;
    const imageSrc = URL.createObjectURL(file);
    setAddingCrop(true);
    try {
      const base64 = await getCroppedImg(imageSrc, cropAreaPixels);
      URL.revokeObjectURL(imageSrc);
      const newCard: DetectedCard = {
        id: `crop-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        imageUrl: base64,
        quantity: 1,
        price: ''
      };
      setDetectedCards(prev => [...prev, newCard]);
      toast.success('เพิ่มการ์ดแล้ว กรอกราคาด้านล่าง');
    } catch (err) {
      URL.revokeObjectURL(imageSrc);
      console.error(err);
      toast.error('เกิดข้อผิดพลาดในการครอป');
    } finally {
      setAddingCrop(false);
    }
  };

  const handleRemoveDetectedCard = (cardId: string): void => {
    setDetectedCards(prev => prev.filter(c => c.id !== cardId));
  };

  const canProceedFromStep1 = (): boolean => true;
  const canProceedFromStep2 = (): boolean => formData.images.length > 0;

  /** ขั้นตอนกรอกข้อมูล: บังคับชื่อการ์ด + หมวดหมู่ (ประเภทการ์ด) */
  const hasRequiredCardBasics = (): boolean => {
    const titleTrim = formData.title?.trim() ?? '';
    const hasTitle = titleTrim.length >= 3;
    const hasCategory = Boolean(formData.category?.trim());
    return hasTitle && hasCategory;
  };

  const canProceedFromStep3 = (): boolean => {
    if (!hasRequiredCardBasics()) return false;

    if (formData.postType === 'sale') {
      if (formData.saleType === 'deck') {
        return !!(
          formData.cardCount &&
          parseInt(formData.cardCount) > 0 &&
          formData.price &&
          parseFloat(formData.price) > 0
        );
      }

      if (formData.saleType === 'individual') {
        return (
          detectedCards.length > 0 &&
          detectedCards.every(
            (c) =>
              c.price &&
              parseFloat(String(c.price)) > 0 &&
              c.quantity &&
              parseInt(String(c.quantity)) > 0
          )
        );
      }
    }
    if (formData.postType === 'auction') {
      if (formData.saleType === 'individual') {
        return !!(
          formData.startingBid && parseFloat(formData.startingBid) > 0 &&
          formData.auctionEndDate && new Date(formData.auctionEndDate) > new Date() &&
          detectedCards.length > 0 &&
          detectedCards.every(
            (c) =>
              c.price &&
              parseFloat(String(c.price)) > 0 &&
              c.quantity &&
              parseInt(String(c.quantity)) > 0
          )
        );
      }
      return !!(formData.startingBid && parseFloat(formData.startingBid) > 0 && formData.auctionEndDate && new Date(formData.auctionEndDate) > new Date());
    }
    return false;
  };

  const goNextStep = (): void => {
    if (currentStep < 4) setCurrentStep(s => s + 1);
  };
  const goPrevStep = (): void => {
    if (currentStep > 1) setCurrentStep(s => s - 1);
  };

  const normalizeCardType = (category: string): string => {
    const map: { [key: string]: string } = {
      'Yu-Gi-Oh!': 'yugioh',
      'Pokemon Card Game': 'pokemon',
      'Cardfight!! Vanguard': 'vanguard',
      'Battle Spirits': 'battlespirits',
      'Digimon Card Game': 'digimon',
      'One Piece Card Game': 'onepiece',
      'Shadowverse Evolve': 'shadowverse',
      'Weiß Schwarz': 'weiss schwarz',
      'Rebirth for you': 'rebirthforyou',
      'hololive card game': 'hololive',
      'union arena': 'unionarena',
      'wixross': 'wixross',
      'gundam card game': 'gundam'
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
          resp.data.cards.forEach((c: any, cardIdx: number) => {
            // Backend may return only { imageUrl } without an id; ensure each card has a unique id
            if (!c?.imageUrl) return;
            const fallbackId = `ai-${i}-${cardIdx}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            allCards.push({
              ...c,
              id: String(c?.id || fallbackId),
              imageUrl: String(c.imageUrl),
              quantity: 1,
              price: ''
            });
          });
        }
      }

      if (allCards.length === 0) {
        toast.info('AI ยังไม่พบการ์ดในภาพ — สามารถใช้การครอปกำหนดพื้นที่การ์ดเองได้ด้านล่าง');
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

    const titleTrim = formData.title?.trim() ?? '';
    if (titleTrim.length < 3) {
      setError('กรุณากรอกชื่อการ์ดอย่างน้อย 3 ตัวอักษร');
      toast.error('กรุณากรอกชื่อการ์ดอย่างน้อย 3 ตัวอักษร');
      return;
    }
    if (!formData.category?.trim()) {
      setError('กรุณาเลือกประเภทการ์ด (หมวดหมู่)');
      toast.error('กรุณาเลือกประเภทการ์ด (หมวดหมู่)');
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
        if (detectedCards.length === 0) {
          setError('กรุณาเพิ่มการ์ดแยกใบอย่างน้อย 1 ใบ และกรอกราคา/จำนวนให้ครบทุกใบ');
          toast.error('กรุณาเพิ่มการ์ดแยกใบอย่างน้อย 1 ใบ และกรอกราคา/จำนวนให้ครบทุกใบ');
          return;
        }

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

    if (formData.description && formData.description.length > 0 && formData.description.length < 10) {
      setError('รายละเอียดต้องมีอย่างน้อย 10 ตัวอักษร');
      toast.error('รายละเอียดต้องมีอย่างน้อย 10 ตัวอักษร');
      return;
    }

    if (!currentUser) {
      setError('กรุณาเข้าสู่ระบบก่อนสร้างโพสต์');
      toast.error('กรุณาเข้าสู่ระบบก่อนสร้างโพสต์');
      return;
    }

    const imageStoragePaths: string[] = [];
    try {
      setError('');
      setLoading(true);
      setUploadProgress(0);

      // 1. อัปโหลดรูปไปยัง Supabase Storage
      const imageUrls: string[] = [];

      for (let i = 0; i < formData.images.length; i++) {
        const file = formData.images[i];
        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(fileName, file, { cacheControl: '3600', upsert: false });

        if (uploadError) {
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(fileName);
        imageUrls.push(publicUrl);
        imageStoragePaths.push(fileName);

        // จำลอง progress (imageStoragePaths ใช้สำหรับ rollback ถ้าสร้างโพสต์ไม่สำเร็จ)
        setUploadProgress(Math.round(((i + 1) / formData.images.length) * 100));
      }

      // 2. อัปโหลด individualCards imageUrl ถ้าเป็น base64
      let individualCardsPayload: Array<{ id: string; imageUrl: string; price: number; quantity: number }> | null = null;
      if (detectedCards.length > 0) {
        individualCardsPayload = detectedCards
          .map((c) => {
            const price = Math.max(0, Number(parseFloat(String(c.price))) || 0);
            const quantity = Math.max(1, parseInt(String(c.quantity), 10) || 1);
            return {
              id: c.id,
              imageUrl: c.imageUrl,
              price: Number.isFinite(price) ? price : 0,
              quantity: Number.isInteger(quantity) && quantity >= 1 ? quantity : 1
            };
          })
          .filter((c) => c.price > 0);
        if (individualCardsPayload.length === 0) individualCardsPayload = null;
      }

      if (individualCardsPayload && individualCardsPayload.some(c => String(c.imageUrl).startsWith('data:'))) {
        const uploaded = await Promise.all(
          individualCardsPayload.map(async (c, idx) => {
            const imgUrl = String(c.imageUrl);
            if (!imgUrl.startsWith('data:')) return c;
            try {
              const res = await fetch(imgUrl);
              const blob = await res.blob();
              const ext = blob.type.split('/')[1] || 'jpg';
              const fileName = `${currentUser.id}/cards/${Date.now()}-${idx}-${Math.random().toString(36).substring(7)}.${ext}`;
              const file = new File([blob], `card-${idx}.${ext}`, { type: blob.type });
              const { error } = await supabase.storage.from('posts').upload(fileName, file, { cacheControl: '3600', upsert: false });
              if (error) return c;
              imageStoragePaths.push(fileName);
              const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(fileName);
              return { ...c, imageUrl: publicUrl };
            } catch {
              return c;
            }
          })
        );
        individualCardsPayload = uploaded;
      }

      // 3. สร้าง JSON payload
      const payload: Record<string, unknown> = {
        title: titleTrim,
        description: formData.description || '',
        category: formData.category.trim(),
        imageUrls,
        imageStoragePaths,
        postType: formData.postType
      };

      if (formData.condition) payload.condition = formData.condition;
      if (formData.game) payload.game = formData.game;

      if (formData.postType === 'sale') {
        if (formData.saleType) payload.saleType = formData.saleType;
        if (formData.saleType === 'deck') {
          payload.cardCount = formData.cardCount;
          payload.deckDescription = formData.deckDescription || '';
          payload.price = formData.price;
        } else if (formData.saleType === 'individual') {
          if (individualCardsPayload && individualCardsPayload.length > 0) {
            payload.individualCards = individualCardsPayload;
            payload.price = String(Math.min(...individualCardsPayload.map((p) => p.price)));
            payload.availableQuantity = String(
              individualCardsPayload.reduce((s, p) => s + (p.quantity || 0), 0)
            );
          }
        }
      } else if (formData.postType === 'auction') {
        if (formData.saleType) payload.saleType = formData.saleType;
        payload.startingBid = formData.startingBid;
        payload.auctionEndDate = formData.auctionEndDate;
        if (formData.saleType === 'deck') payload.cardCount = formData.cardCount;
        if (formData.saleType === 'individual') {
          payload.availableQuantity = formData.availableQuantity;
          if (individualCardsPayload && individualCardsPayload.length > 0) {
            payload.individualCards = individualCardsPayload;
            payload.price = String(Math.min(...individualCardsPayload.map((p) => p.price)));
            payload.availableQuantity = String(
              individualCardsPayload.reduce((s, p) => s + (p.quantity || 0), 0)
            );
          }
        }
        if (formData.buyNowPrice) payload.buyNowPrice = formData.buyNowPrice;
      }

      const response = await axios.post('/api/posts', payload, {
        headers: { 'Content-Type': 'application/json' }
      });

      const successMessage = formData.postType === 'auction'
        ? 'สร้างการประมูลสำเร็จ! โพสต์อยู่ในสถานะรออนุมัติ เมื่อแอดมินอนุมัติแล้วจะแสดงในหน้ารายการ 🔨'
        : 'สร้างโพสต์ขายสำเร็จ! โพสต์อยู่ในสถานะรออนุมัติ เมื่อแอดมินอนุมัติแล้วจะแสดงในหน้ารายการ 🛒';
      toast.success(successMessage);
      navigate(`/post/${response.data.id}`);
    } catch (error: any) {
      console.error('Error creating post:', error);
      const res = error.response?.data;
      const errorMessage = res?.error || res?.message || res?.title || res?.detail || (res?.errors ? JSON.stringify(res.errors) : null) || 'เกิดข้อผิดพลาดในการสร้างโพสต์';
      setError(errorMessage);
      toast.error(errorMessage);

      // ลบรูปที่อัปโหลดแล้วออกจาก Storage เพราะโพสต์สร้างไม่สำเร็จ
      if (imageStoragePaths.length > 0) {
        try {
          await supabase.storage.from('posts').remove(imageStoragePaths);
        } catch (deleteErr) {
          console.warn('Could not delete uploaded images after post failure:', deleteErr);
        }
      }
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  /* ── helpers ── */
  const stepMeta = [
    { icon: 'fa-layer-group', desc: 'เลือกวิธีลงขาย' },
    { icon: 'fa-images',      desc: 'เพิ่มรูปการ์ด' },
    { icon: 'fa-pen-nib',     desc: 'กรอกรายละเอียด' },
    { icon: 'fa-check-circle',desc: 'ยืนยันและส่ง' }
  ];

  const SectionDivider = () => (
    <div style={{ height: 1, background: 'linear-gradient(90deg, #e2e8f0, transparent)', margin: '28px 0' }} />
  );

  const SectionLabel: React.FC<{ icon: string; text: string; optional?: boolean; required?: boolean }> = ({ icon, text, optional, required }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#ccfbf1,#cffafe)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className={`fas ${icon}`} style={{ fontSize: 12, color: '#0d9488' }} />
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{text}</span>
      {required && <span style={{ fontSize: 12, color: '#ef4444', marginLeft: 2 }}>*</span>}
      {optional && <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(ไม่บังคับ)</span>}
    </div>
  );

  const OptionTile: React.FC<{
    selected: boolean; onClick: () => void; icon: string;
    title: string; subtitle: string; desc: string; color: string;
  }> = ({ selected, onClick, icon, title, subtitle, desc, color }) => (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer', borderRadius: 16, padding: '20px 20px',
        border: `2px solid ${selected ? color : '#e5e7eb'}`,
        background: selected ? `${color}0d` : 'white',
        transition: 'all 0.2s',
        boxShadow: selected ? `0 0 0 4px ${color}22` : '0 1px 3px rgba(0,0,0,0.06)',
        display: 'flex', flexDirection: 'column', gap: 0
      }}
    >
      <div style={{ width: 48, height: 48, borderRadius: 13, background: selected ? color : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, transition: 'background 0.2s' }}>
        <i className={`fas ${icon}`} style={{ fontSize: 20, color: selected ? 'white' : '#94a3b8', transition: 'color 0.2s' }} />
      </div>
      <div style={{ fontWeight: 700, fontSize: 16, color: selected ? color : '#1e293b', marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>{subtitle}</div>
      <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>{desc}</div>
      {selected && (
        <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 18, height: 18, borderRadius: '50%', background: color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fas fa-check" style={{ fontSize: 9, color: 'white' }} />
          </span>
          <span style={{ fontSize: 12, color: color, fontWeight: 600 }}>เลือกแล้ว</span>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(145deg,#f0fdfa 0%,#e0f2fe 55%,#f0f9ff 100%)', paddingTop: 32, paddingBottom: 48 }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 16px' }}>

        {/* Error */}
        {error && (
          <Alert variant="danger" className="mb-5 rounded-xl" role="alert">
            <strong>เกิดข้อผิดพลาด:</strong> {error}
          </Alert>
        )}

        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

          {/* ═══════════ LEFT SIDEBAR ═══════════ */}
          <div style={{ width: 256, flexShrink: 0, position: 'sticky', top: 24 }} className="hidden lg:block">
            <div style={{ background: 'linear-gradient(165deg,#0f766e 0%,#0e7490 70%,#0c4a6e 100%)', borderRadius: 24, padding: '28px 22px', color: 'white', boxShadow: '0 24px 64px rgba(14,116,144,0.32)', overflow: 'hidden', position: 'relative' }}>
              {/* Decorative blobs */}
              <div style={{ position: 'absolute', top: -48, right: -48, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
              <div style={{ position: 'absolute', bottom: -24, left: -24, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

              {/* Header */}
              <div style={{ marginBottom: 28, position: 'relative' }}>
                <div style={{ width: 52, height: 52, borderRadius: 15, background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <i className={`fas ${formData.postType === 'auction' ? 'fa-gavel' : 'fa-store'} text-white`} style={{ fontSize: 22 }} />
                </div>
                <div style={{ fontWeight: 800, fontSize: 18, color: 'white', lineHeight: 1.2 }}>
                  {formData.postType === 'auction' ? 'ประมูลการ์ดเกม' : 'ขายการ์ดเกม'}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>สร้างโพสต์ใหม่</div>
              </div>

              {/* Vertical Steps */}
              <div>
                {STEPS.map((step, idx) => {
                  const isDone = currentStep > step.id;
                  const isCurrent = currentStep === step.id;
                  return (
                    <div key={step.id}>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 11, cursor: isDone ? 'pointer' : 'default', background: isCurrent ? 'rgba(255,255,255,0.17)' : 'transparent', transition: 'background 0.2s' }}
                        onClick={() => isDone && setCurrentStep(step.id)}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDone ? '#4ade80' : isCurrent ? 'white' : 'rgba(255,255,255,0.14)', color: isDone ? 'white' : isCurrent ? '#0f766e' : 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: 14, boxShadow: isCurrent ? '0 0 0 4px rgba(255,255,255,0.18)' : 'none', transition: 'all 0.3s' }}>
                          {isDone ? <i className="fas fa-check" style={{ fontSize: 12 }} /> : step.id}
                        </div>
                        <div>
                          <div style={{ fontWeight: isCurrent ? 600 : 400, fontSize: 13, color: isCurrent ? 'white' : isDone ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)', transition: 'all 0.3s' }}>{step.label}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{stepMeta[idx].desc}</div>
                        </div>
                      </div>
                      {idx < STEPS.length - 1 && (
                        <div style={{ width: 2, height: 14, marginLeft: 28, background: currentStep > step.id ? 'rgba(74,222,128,0.55)' : 'rgba(255,255,255,0.14)', borderRadius: 1, transition: 'background 0.3s' }} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Progress bar */}
              <div style={{ marginTop: 26, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.13)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 7 }}>
                  <span>ความคืบหน้า</span>
                  <span>{Math.round(((currentStep - 1) / (STEPS.length - 1)) * 100)}%</span>
                </div>
                <div style={{ height: 5, background: 'rgba(255,255,255,0.14)', borderRadius: 3 }}>
                  <div style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg,#4ade80,#86efac)', width: `${Math.round(((currentStep - 1) / (STEPS.length - 1)) * 100)}%`, transition: 'width 0.45s ease' }} />
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════ RIGHT CONTENT ═══════════ */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Mobile horizontal stepper */}
            <div className="lg:hidden" style={{ background: 'white', borderRadius: 16, padding: '14px 20px', marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {STEPS.map((step, idx) => {
                  const isDone = currentStep > step.id;
                  const isCurrent = currentStep === step.id;
                  return (
                    <React.Fragment key={step.id}>
                      <div style={{ textAlign: 'center', cursor: isDone ? 'pointer' : 'default' }} onClick={() => isDone && setCurrentStep(step.id)}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', margin: '0 auto 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDone ? '#4ade80' : isCurrent ? '#0d9488' : '#e5e7eb', color: isDone || isCurrent ? 'white' : '#9ca3af', fontWeight: 700, fontSize: 12 }}>
                          {isDone ? <i className="fas fa-check" style={{ fontSize: 10 }} /> : step.id}
                        </div>
                        <div style={{ fontSize: 10, color: isCurrent ? '#0d9488' : '#9ca3af', fontWeight: isCurrent ? 600 : 400 }}>{step.label}</div>
                      </div>
                      {idx < STEPS.length - 1 && (
                        <div style={{ flex: 1, height: 2, background: currentStep > step.id ? '#4ade80' : '#e5e7eb', margin: '0 5px', marginBottom: 18 }} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Content panel */}
            <div style={{ background: 'white', borderRadius: 22, boxShadow: '0 4px 28px rgba(0,0,0,0.07)', overflow: 'hidden' }}>

              {/* Step Header Strip */}
              <div style={{ background: 'linear-gradient(120deg,#f0fdfa 0%,#e0f2fe 100%)', padding: '22px 32px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 50, height: 50, borderRadius: 14, background: 'linear-gradient(135deg,#0d9488,#0891b2)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(13,148,136,0.3)', flexShrink: 0 }}>
                  <i className={`fas ${stepMeta[currentStep - 1].icon} text-white`} style={{ fontSize: 18 }} />
                </div>
                <div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: '#1e293b', lineHeight: 1.2 }}>
                    {currentStep === 1 ? 'เลือกประเภทโพสต์' : currentStep === 2 ? 'อัปโหลดรูปภาพการ์ด' : currentStep === 3 ? 'กรอกข้อมูลการ์ด' : 'ตรวจสอบและยืนยัน'}
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>ขั้นตอนที่ {currentStep} จาก {STEPS.length} — {stepMeta[currentStep - 1].desc}</div>
                </div>
              </div>

              {/* Form Body */}
              <div style={{ padding: '32px' }}>
                <Form onSubmit={handleSubmit}>

                  {/* ════ STEP 1: Post Type ════ */}
                  {currentStep === 1 && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
                        <OptionTile
                          selected={formData.postType === 'sale'}
                          onClick={() => setFormData(f => ({ ...f, postType: 'sale' }))}
                          icon="fa-tags" title="ขายการ์ด" subtitle="Card Sale"
                          desc="ตั้งราคาขายแบบตายตัว ผู้ซื้อสามารถซื้อได้ทันที"
                          color="#0d9488"
                        />
                        <OptionTile
                          selected={formData.postType === 'auction'}
                          onClick={() => setFormData(f => ({ ...f, postType: 'auction' }))}
                          icon="fa-gavel" title="ประมูลการ์ด" subtitle="Auction"
                          desc="ให้ผู้ซื้อแข่งราคาเสนอ ได้ราคาสูงสุดจากตลาด"
                          color="#0891b2"
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <SecondaryActionButton type="button" onClick={() => navigate('/')} icon={<i className="fas fa-times" />}>ยกเลิก</SecondaryActionButton>
                        <PrimaryActionButton type="button" fullWidth={false} onClick={goNextStep} icon={<i className="fas fa-arrow-right" />}>ถัดไป: อัปโหลดรูป</PrimaryActionButton>
                      </div>
                    </div>
                  )}

                  {/* ════ STEP 2: Images ════ */}
                  {currentStep === 2 && (
                    <div>
                      <input type="file" multiple accept="image/*" onChange={handleImageChange} id="image-upload" style={{ display: 'none' }} />
                      <label htmlFor="image-upload" style={{ display: 'block', cursor: 'pointer', marginBottom: 20 }}>
                        <div
                          style={{ border: '2px dashed #cbd5e1', borderRadius: 18, padding: '44px 28px', textAlign: 'center', background: '#f8fafc', transition: 'all 0.2s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#0d9488'; (e.currentTarget as HTMLDivElement).style.background = '#f0fdfa'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#cbd5e1'; (e.currentTarget as HTMLDivElement).style.background = '#f8fafc'; }}
                        >
                          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#ccfbf1,#cffafe)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <i className="fas fa-cloud-upload-alt" style={{ fontSize: 28, color: '#0d9488' }} />
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>คลิกเพื่อเลือกรูปภาพ หรือลากมาวางที่นี่</div>
                          <div style={{ fontSize: 13, color: '#94a3b8' }}>รองรับ JPG, PNG, GIF · สูงสุด 5 ไฟล์ · ไม่เกิน 10MB ต่อไฟล์</div>
                        </div>
                      </label>

                      {formData.images.length > 0 && (
                        <div style={{ marginBottom: 24 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '8px 14px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
                            <i className="fas fa-check-circle" style={{ color: '#16a34a', fontSize: 13 }} />
                            <span style={{ fontSize: 13, color: '#15803d', fontWeight: 500 }}>เลือกแล้ว {formData.images.length} ไฟล์ — คลิกรูปเพื่อดูตัวอย่าง · กด × เพื่อลบ</span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                            {Array.from(formData.images).map((file, index) => (
                              <ImagePreviewThumbnail key={index} file={file} index={index} onClick={() => setPreviewImageIndex(index)} onRemove={() => handleRemoveImage(index)} />
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <SecondaryActionButton type="button" onClick={goPrevStep} icon={<i className="fas fa-arrow-left" />}>ย้อนกลับ</SecondaryActionButton>
                        <PrimaryActionButton type="button" fullWidth={false} onClick={goNextStep} disabled={!canProceedFromStep2()} icon={<i className="fas fa-arrow-right" />}>ถัดไป: กรอกข้อมูล</PrimaryActionButton>
                      </div>
                    </div>
                  )}

                  {/* ════ STEP 3: Form Data ════ */}
                  {currentStep === 3 && (
                    <div>
                      {/* Sale Type Picker */}
                      <SectionLabel icon="fa-list-ul" text="ประเภทการขาย" required />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
                        {([
                          { value: 'deck', icon: 'fa-layer-group', title: formData.postType === 'auction' ? 'ประมูลเป็นเด็ค' : 'ขายเป็นเด็ค', subtitle: formData.postType === 'auction' ? 'Deck Auction' : 'Deck Sale', desc: 'รวมการ์ดทั้งเด็คเป็นชุดเดียว' },
                          { value: 'individual', icon: 'fa-clone', title: formData.postType === 'auction' ? 'ประมูลแยกใบ' : 'ขายแยกใบ', subtitle: formData.postType === 'auction' ? 'Individual Auction' : 'Individual Cards', desc: 'ระบุราคาและจำนวนต่อใบ' }
                        ] as const).map(opt => (
                          <OptionTile
                            key={opt.value}
                            selected={formData.saleType === opt.value}
                            onClick={() => setFormData(f => ({ ...f, saleType: opt.value }))}
                            icon={opt.icon} title={opt.title} subtitle={opt.subtitle} desc={opt.desc}
                            color="#0d9488"
                          />
                        ))}
                      </div>

                      <SectionDivider />

                      {/* Basic Info */}
                      <SectionLabel icon="fa-pen" text="ข้อมูลพื้นฐาน" />
                      <Row>
                        <Col md={formData.postType === 'sale' && formData.saleType === 'individual' ? 12 : 7}>
                          <Form.Group className="mb-4 form-group-sakura">
                            <Form.Label className="form-label-sakura">ชื่อการ์ด <span style={{ color: '#ef4444' }}>*</span></Form.Label>
                            <Form.Control
                              type="text"
                              name="title"
                              placeholder="เช่น Pikachu VMAX, Blue-Eyes White Dragon..."
                              value={formData.title}
                              onChange={handleChange}
                              className="form-control-sakura"
                              required
                              minLength={3}
                              autoComplete="off"
                            />
                            <Form.Text className="form-help-text">อย่างน้อย 3 ตัวอักษร</Form.Text>
                          </Form.Group>
                        </Col>
                        <Col md={5}>
                          {formData.postType === 'sale' && formData.saleType === 'deck' && (
                            <Form.Group className="mb-4 form-group-sakura">
                              <Form.Label className="form-label-sakura">ราคาเด็ค (บาท) <span style={{ color: '#ef4444' }}>*</span></Form.Label>
                              <div className="input-with-icon"><span className="input-icon-left">฿</span>
                                <Form.Control type="number" name="price" placeholder="0.00" value={formData.price} onChange={handleChange} className="form-control-sakura" min="0" step="0.01" required />
                              </div>
                            </Form.Group>
                          )}
                          {formData.postType === 'auction' && (
                            <Form.Group className="mb-4 form-group-sakura">
                              <Form.Label className="form-label-sakura">ราคาเริ่มต้น (บาท) <span style={{ color: '#ef4444' }}>*</span></Form.Label>
                              <div className="input-with-icon"><span className="input-icon-left">฿</span>
                                <Form.Control type="number" name="startingBid" placeholder="0.00" value={formData.startingBid} onChange={handleChange} className="form-control-sakura" min="0" step="0.01" required />
                              </div>
                            </Form.Group>
                          )}
                        </Col>
                      </Row>

                      {/* Deck fields */}
                      {formData.saleType === 'deck' && (
                        <>
                          <SectionDivider />
                          <SectionLabel icon="fa-layer-group" text="ข้อมูลเด็ค" />
                          <Row>
                            <Col md={6}>
                              <Form.Group className="mb-4 form-group-sakura">
                                <Form.Label className="form-label-sakura">จำนวนการ์ดในเด็ค <span style={{ color: '#ef4444' }}>*</span></Form.Label>
                                <Form.Control type="number" name="cardCount" placeholder="เช่น 60" value={formData.cardCount} onChange={handleChange} className="form-control-sakura" min="1" required />
                              </Form.Group>
                            </Col>
                            <Col md={6}>
                              <Form.Group className="mb-4 form-group-sakura">
                                <Form.Label className="form-label-sakura">รายละเอียดเด็ค <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>(ไม่บังคับ)</span></Form.Label>
                                <Form.Control type="text" name="deckDescription" placeholder="เช่น Blue-Eyes Deck, Dragon Deck..." value={formData.deckDescription || ''} onChange={handleChange} className="form-control-sakura" />
                              </Form.Group>
                            </Col>
                          </Row>
                        </>
                      )}

                      {/* Individual card fields */}
                      {formData.saleType === 'individual' && (
                        <>
                          <SectionDivider />
                          <SectionLabel icon="fa-clone" text="การ์ดแยกใบ" />
                          {formData.images.length > 0 && (
                            <>
                              {/* AI detection */}
                              <div style={{ background: 'linear-gradient(135deg,#eff6ff,#f0f9ff)', borderRadius: 14, padding: '16px 20px', marginBottom: 12, border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1e40af', marginBottom: 3 }}><i className="fas fa-magic me-2" />การแยกการ์ดอัตโนมัติ (AI)</div>
                                  <div style={{ fontSize: 12, color: '#3b82f6' }}>ใช้ AI แยกการ์ดแต่ละใบจากภาพ หรือครอปกำหนดพื้นที่เอง</div>
                                  {detectedCards.length > 0 && <div style={{ marginTop: 5, fontSize: 12, color: '#16a34a', fontWeight: 600 }}><i className="fas fa-check-circle me-1" />พบการ์ดแล้ว {detectedCards.length} ใบ</div>}
                                </div>
                                <Button variant="outline-primary" size="sm" onClick={processImagesForCards} disabled={processingCards} className="btn-tcg-outline" style={{ flexShrink: 0 }}>
                                  {processingCards ? <><Spinner size="sm" className="me-2" as="span" />กำลังประมวลผล...</> : <><i className="fas fa-magic me-2" />แยกการ์ดอัตโนมัติ</>}
                                </Button>
                              </div>

                              {/* Crop tool */}
                              <div style={{ background: '#fafafa', borderRadius: 14, padding: '18px 20px', marginBottom: 16, border: '1px solid #e5e7eb' }}>
                                <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <i className="fas fa-crop-alt" style={{ color: '#0d9488' }} />ครอปการ์ดจากรูปเพิ่มเอง
                                </div>
                                <div style={{ marginBottom: 12 }}>
                                  <Form.Label className="form-label-sakura">เลือกรูปที่จะครอป</Form.Label>
                                  <Form.Select value={cropImageIndex} onChange={(e) => setCropImageIndex(Number(e.target.value))} className="form-control-sakura">
                                    {formData.images.map((_, i) => <option key={i} value={i}>รูปที่ {i + 1}</option>)}
                                  </Form.Select>
                                </div>
                                {cropImageObjectUrl && (
                                  <div style={{ position: 'relative', height: 360, background: '#000', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
                                    <Cropper image={cropImageObjectUrl} crop={cropPosition} zoom={cropZoom} onCropChange={setCropPosition} onZoomChange={setCropZoom} onCropComplete={(_a, p) => setCropAreaPixels(p)} aspect={2.5 / 3.5} objectFit="contain" />
                                  </div>
                                )}
                                <Button type="button" variant="outline-primary" className="btn-tcg-outline" onClick={handleAddCroppedCard} disabled={addingCrop || !cropAreaPixels}>
                                  {addingCrop ? <><Spinner size="sm" className="me-2" as="span" />กำลังเพิ่ม...</> : <><i className="fas fa-plus-circle me-2" />เพิ่มการ์ดจากพื้นที่ที่เลือก</>}
                                </Button>
                              </div>
                            </>
                          )}
                          {!(formData.postType === 'sale' && formData.saleType === 'individual') && (
                            <Form.Group className="mb-4 form-group-sakura">
                              <Form.Label className="form-label-sakura">จำนวนที่ขายได้ <span style={{ color: '#ef4444' }}>*</span></Form.Label>
                              <Form.Control type="number" name="availableQuantity" placeholder="เช่น 10" value={formData.availableQuantity} onChange={handleChange} className="form-control-sakura" min="1" required />
                            </Form.Group>
                          )}
                        </>
                      )}

                      {/* Category / ประเภทการ์ด */}
                      <SectionDivider />
                      <SectionLabel icon="fa-tag" text="ประเภทการ์ด (หมวดหมู่)" required />
                      <Form.Select name="category" value={formData.category} onChange={handleChange} className="form-control-sakura" style={{ marginBottom: 28 }} required>
                        <option value="" disabled>— เลือกประเภทการ์ด —</option>
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </Form.Select>

                      {/* Auction fields */}
                      {formData.postType === 'auction' && (
                        <>
                          <SectionDivider />
                          <SectionLabel icon="fa-gavel" text="ข้อมูลการประมูล" />
                          <Row>
                            <Col md={6}>
                              <Form.Group className="mb-4 form-group-sakura">
                                <Form.Label className="form-label-sakura">วันสิ้นสุดการประมูล <span style={{ color: '#ef4444' }}>*</span></Form.Label>
                                <Form.Control type="datetime-local" name="auctionEndDate" value={formData.auctionEndDate} onChange={handleChange} className="form-control-sakura" min={new Date().toISOString().slice(0, 16)} required />
                              </Form.Group>
                            </Col>
                            <Col md={6}>
                              <Form.Group className="mb-4 form-group-sakura">
                                <Form.Label className="form-label-sakura">ราคาซื้อทันที (บาท) <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>(ไม่บังคับ)</span></Form.Label>
                                <div className="input-with-icon"><span className="input-icon-left">฿</span>
                                  <Form.Control type="number" name="buyNowPrice" placeholder="0.00" value={formData.buyNowPrice} onChange={handleChange} className="form-control-sakura" min="0" step="0.01" />
                                </div>
                              </Form.Group>
                            </Col>
                          </Row>
                        </>
                      )}

                      {/* Description */}
                      <SectionDivider />
                      <SectionLabel icon="fa-align-left" text="รายละเอียดเพิ่มเติม" optional />
                      <Form.Group className="mb-4 form-group-sakura">
                        <Form.Control as="textarea" rows={4} name="description" placeholder="เช่น สภาพการ์ด, เงื่อนไขการขาย, ข้อมูลเพิ่มเติม..." value={formData.description} onChange={handleChange} className="form-control-sakura" style={{ resize: 'vertical' }} />
                      </Form.Group>

                      {/* Detected cards list */}
                      {detectedCards.length > 0 && (
                        <>
                          <SectionDivider />
                          <SectionLabel icon="fa-th" text={`การ์ดที่พบ ${detectedCards.length} ใบ — กรอกราคาและจำนวนต่อใบ`} />
                          <div className="cards-preview-grid">
                            {detectedCards.map((card, index) => (
                              <div key={card.id} className="card-preview-item">
                                <div className="card-preview-image-wrapper">
                                  <img src={card.imageUrl} alt={`การ์ด ${index + 1}`} className="card-preview-image" />
                                  <div className="card-preview-number">#{index + 1}</div>
                                  <button type="button" className="card-preview-remove-btn" onClick={() => handleRemoveDetectedCard(card.id)} aria-label="ลบการ์ด">×</button>
                                </div>
                                <div className="card-preview-form">
                                  <div className="card-preview-fields">
                                    <Form.Group className="mb-0 card-preview-field">
                                      <Form.Label className="card-form-label">จำนวน</Form.Label>
                                      <Form.Control type="number" placeholder="1" min="1" value={card.quantity} onChange={(e: ChangeEvent<HTMLInputElement>) => setDetectedCards(prev => prev.map(c => c.id === card.id ? { ...c, quantity: e.target.value } : c))} className="form-control-sakura" />
                                    </Form.Group>
                                    <Form.Group className="mb-0 card-preview-field">
                                      <Form.Label className="card-form-label">ราคา (บาท)</Form.Label>
                                      <Form.Control type="number" placeholder="0.00" min="0" step="0.01" value={card.price} onChange={(e: ChangeEvent<HTMLInputElement>) => setDetectedCards(prev => prev.map(c => c.id === card.id ? { ...c, price: e.target.value } : c))} className="form-control-sakura" />
                                    </Form.Group>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 32 }}>
                        <SecondaryActionButton type="button" onClick={goPrevStep} icon={<i className="fas fa-arrow-left" />}>ย้อนกลับ</SecondaryActionButton>
                        <PrimaryActionButton type="button" fullWidth={false} onClick={goNextStep} disabled={!canProceedFromStep3()} icon={<i className="fas fa-arrow-right" />}>ถัดไป: สรุป</PrimaryActionButton>
                      </div>
                    </div>
                  )}

                  {/* ════ STEP 4: Summary ════ */}
                  {currentStep === 4 && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 24 }}>
                        {[
                          { label: 'ประเภท', value: `${formData.postType === 'auction' ? 'ประมูล' : 'ขาย'} · ${formData.saleType === 'deck' ? 'เด็ค' : 'แยกใบ'}`, icon: 'fa-layer-group' },
                          { label: 'รูปภาพ', value: `${formData.images.length} ไฟล์`, icon: 'fa-images' },
                          { label: 'ชื่อการ์ด', value: formData.title || '—', icon: 'fa-signature' },
                          { label: 'หมวดหมู่', value: formData.category || '—', icon: 'fa-tag' },
                          ...(formData.postType === 'sale' && formData.saleType === 'deck' ? [{ label: 'ราคาเด็ค', value: `${formData.price} บาท · ${formData.cardCount} ใบ`, icon: 'fa-baht-sign' }] : []),
                          ...(formData.postType === 'auction' ? [{ label: 'ราคาเริ่มต้น', value: `${formData.startingBid} บาท`, icon: 'fa-gavel' }, { label: 'สิ้นสุดการประมูล', value: formData.auctionEndDate ? new Date(formData.auctionEndDate).toLocaleString('th-TH') : '—', icon: 'fa-clock' }] : []),
                          ...(detectedCards.length > 0 ? [{ label: 'การ์ดแยกใบ', value: `${detectedCards.length} ใบ`, icon: 'fa-clone' }] : []),
                        ].map(item => (
                          <div key={item.label} style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e5e7eb', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#ccfbf1,#cffafe)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <i className={`fas ${item.icon}`} style={{ fontSize: 12, color: '#0d9488' }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
                              <div style={{ fontSize: 14, color: '#1e293b', fontWeight: 600, marginTop: 2 }}>{item.value}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Preview thumbnails */}
                      {formData.images.length > 0 && (
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                          {Array.from(formData.images).slice(0, 5).map((file, i) => (
                            <ImagePreviewThumbnail key={i} file={file} index={i} onClick={() => setPreviewImageIndex(i)} />
                          ))}
                        </div>
                      )}

                      {/* Upload progress */}
                      {uploadProgress > 0 && uploadProgress < 100 && (
                        <div style={{ marginBottom: 16, padding: '14px 18px', background: '#f0fdfa', borderRadius: 12, border: '1px solid #99f6e4' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#0f766e', fontWeight: 600, marginBottom: 8 }}>
                            <span><i className="fas fa-spinner fa-spin me-2" />กำลังอัปโหลด...</span><span>{uploadProgress}%</span>
                          </div>
                          <ProgressBar now={uploadProgress} label={`${uploadProgress}%`} />
                        </div>
                      )}

                      {/* Pending notice */}
                      <div style={{ padding: '14px 18px', background: '#fffbeb', borderRadius: 12, border: '1px solid #fde68a', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <i className="fas fa-info-circle" style={{ color: '#d97706', fontSize: 15 }} />
                        <span style={{ fontSize: 13, color: '#92400e' }}>โพสต์จะอยู่ในสถานะ <strong>รออนุมัติ</strong> ก่อนแสดงในหน้ารายการ</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <SecondaryActionButton type="button" onClick={goPrevStep} icon={<i className="fas fa-arrow-left" />}>ย้อนกลับ</SecondaryActionButton>
                        <PrimaryActionButton type="submit" fullWidth={false} disabled={loading} icon={loading ? null : <i className="fas fa-paper-plane" />}>
                          {loading ? <><Spinner size="sm" className="me-2" as="span" />{formData.postType === 'auction' ? 'กำลังสร้างการประมูล...' : 'กำลังสร้างโพสต์...'}</> : (formData.postType === 'auction' ? 'สร้างการประมูล' : 'สร้างโพสต์')}
                        </PrimaryActionButton>
                      </div>
                    </div>
                  )}

                </Form>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      <Modal show={previewImageIndex !== null} onHide={() => setPreviewImageIndex(null)} centered size="lg" aria-label="ดูรูปตัวอย่าง">
        <Modal.Header closeButton>
          <Modal.Title><i className="fas fa-image me-2" aria-hidden />รูปที่ {previewImageIndex !== null ? previewImageIndex + 1 : ''}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center p-0 bg-base-200/50">
          {previewImageUrl && (
            <img src={previewImageUrl} alt={`รูปที่ ${previewImageIndex !== null ? previewImageIndex + 1 : ''}`} className="img-fluid" style={{ maxHeight: '70vh', objectFit: 'contain' }} />
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default CreatePost;


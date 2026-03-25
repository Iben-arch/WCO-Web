import React, { useState, FormEvent, ChangeEvent } from 'react';
import { Modal, Form, Button, Alert } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';

const SELLER_TERMS = [
  'คุณรับผิดชอบต่อความถูกต้องของสินค้าและรายละเอียดที่โพสต์',
  'คุณยอมรับว่าการชำระเงินและการส่งมอบเป็นไปตามนโยบายของแพลตฟอร์ม',
  'ข้อมูลบัญชีธนาคารใช้เพื่อรับเงินจากการขายเท่านั้น และคุณยืนยันว่าเป็นบัญชีของคุณเอง'
];

const BANK_OPTIONS = [
  'ธนาคารกรุงเทพ',
  'ธนาคารกสิกรไทย',
  'ธนาคารกรุงไทย',
  'ธนาคารทหารไทย',
  'ธนาคารไทยพาณิชย์',
  'ธนาคารกรุงศรีอยุธยา',
  'ธนาคารเกียรตินาคิน',
  'ธนาคารซีไอเอ็มบีไทย',
  'ธนาคารทิสโก้',
  'ธนาคารธนชาต',
  'ธนาคารยูโอบี',
  'ธนาคารสแตนดาร์ดชาร์เตอร์ด (ไทย)',
  'ธนาคารไทยเครดิตเพื่อรายย่อย',
  'ธนาคารแลนด์ แอนด์ เฮาส์',
  'ธนาคารไอซีบีซี (ไทย)',
  'ธนาคารพัฒนาวิสาหกิจขนาดกลางและขนาดย่อมแห่งประเทศไทย',
  'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร',
  'ธนาคารเพื่อการส่งออกและนำเข้าแห่งประเทศไทย',
  'ธนาคารออมสิน',
  'ธนาคารอาคารสงเคราะห์',
  'ธนาคารอิสลามแห่งประเทศไทย',
  'ธนาคารแห่งประเทศจีน',
  'ธนาคารซูมิโตโม มิตซุย ทรัสต์ (ไทย)',
  'ธนาคารฮ่องกงและเซี้ยงไฮ้แบงกิ้งคอร์ปอเรชั่น จำกัด'
];

interface SellerApplicationModalProps {
  show: boolean;
  onHide: () => void;
  onSuccess?: () => void;
}

const SellerApplicationModal: React.FC<SellerApplicationModalProps> = ({ show, onHide, onSuccess }) => {
  const { applyAsSeller, currentUser } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = (): void => {
    setAgreed(false);
    setBankName('');
    setBankAccountNumber('');
    setError(null);
    setSubmitting(false);
  };

  const handleClose = (): void => {
    reset();
    onHide();
  };

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    if (!currentUser) {
      toast.error('กรุณาเข้าสู่ระบบก่อน');
      return;
    }
    if (!agreed) {
      setError('กรุณายืนยันข้อตกลงการเป็นผู้ขาย');
      return;
    }
    const bn = bankName.trim();
    const acc = bankAccountNumber.trim().replace(/\s+/g, '');
    if (bn.length < 2) {
      setError('กรุณาระบุชื่อธนาคาร');
      return;
    }
    // เลขบัญชีธนาคารต้องเป็นตัวเลขล้วน และความยาวอยู่ระหว่าง 8-12 หลัก
    if (!/^\d{8,12}$/.test(acc)) {
      setError('กรุณากรอกเลขบัญชีธนาคารเป็นตัวเลข 8 ถึง 12 หลัก');
      return;
    }
    setSubmitting(true);
    try {
      await applyAsSeller({
        agreedToTerms: true,
        bankName: bn,
        bankAccountNumber: acc
      });
      toast.success('สมัครเป็นผู้ขายสำเร็จ คุณสามารถขายการ์ดได้แล้ว');
      reset();
      onSuccess?.();
      onHide();
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        'ไม่สามารถสมัครเป็นผู้ขายได้';
      setError(typeof msg === 'string' ? msg : 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={handleClose} centered size="lg" backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>สมัครเป็นผู้ขาย</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <p className="text-muted small mb-3">
            กรุณาอ่านข้อตกลงและกรอกข้อมูลบัญชีรับเงินเพื่อเปิดสิทธิ์ขายการ์ดบนแพลตฟอร์ม
          </p>
          <div className="border rounded p-3 mb-3 bg-light">
            <h6 className="mb-2">ข้อตกลงการเป็นผู้ขาย</h6>
            <ul className="small mb-0 ps-3">
              {SELLER_TERMS.map((t) => (
                <li key={t} className="mb-1">
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <Form.Check
            type="checkbox"
            id="seller-agree-terms"
            className="mb-3"
            checked={agreed}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setAgreed(e.target.checked)}
            label="ข้ายืนยันว่าได้อ่านและยอมรับข้อตกลงการเป็นผู้ขายทั้งหมด"
          />
          <Form.Group className="mb-3">
            <Form.Label>ชื่อธนาคาร</Form.Label>
            <Form.Select value={bankName} onChange={(e) => setBankName(e.target.value)} autoComplete="off">
              <option value="">เลือกธนาคาร</option>
              {BANK_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-0">
            <Form.Label>เลขบัญชีธนาคาร</Form.Label>
            <Form.Control
              value={bankAccountNumber}
              onChange={(e) =>
                setBankAccountNumber(
                  e.target.value
                    .replace(/[^\d]/g, '')
                    .slice(0, 12) // ห้ามกรอกเกิน 12 หลัก
                )
              }
              placeholder="เลขบัญชีสำหรับรับเงิน"
              autoComplete="off"
              inputMode="numeric"
              pattern="^[0-9]{8,12}$"
            />
          </Form.Group>
          {error && (
            <Alert variant="danger" className="mt-3 mb-0" role="alert">
              {error}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" type="button" onClick={handleClose} disabled={submitting}>
            ยกเลิก
          </Button>
          <Button variant="primary" type="submit" className="btn-tcg-primary" disabled={submitting}>
            {submitting ? 'กำลังส่ง...' : 'ยืนยันสมัครเป็นผู้ขาย'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default SellerApplicationModal;

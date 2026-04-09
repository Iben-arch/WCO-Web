import React, { useState, FormEvent } from 'react';
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
    if (submitting) return;
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

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={handleClose}>
      <div className="bg-base-100 rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-base-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
            </div>
            <h3 className="font-bold text-lg text-base-content">สมัครเป็นผู้ขาย</h3>
          </div>
          {!submitting && (
            <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={handleClose}>✕</button>
          )}
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4 max-h-[65vh] overflow-y-auto">
            <p className="text-sm text-base-content/60">
              กรุณาอ่านข้อตกลงและกรอกข้อมูลบัญชีรับเงินเพื่อเปิดสิทธิ์ขายการ์ดบนแพลตฟอร์ม
            </p>

            {/* Terms */}
            <div className="rounded-xl border border-base-300 bg-base-200/50 p-4">
              <h4 className="font-semibold text-sm text-base-content mb-2">ข้อตกลงการเป็นผู้ขาย</h4>
              <ul className="space-y-1.5">
                {SELLER_TERMS.map((t) => (
                  <li key={t} className="flex items-start gap-2 text-sm text-base-content/70">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5 text-primary">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            {/* Agreement checkbox */}
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-base-300 hover:bg-base-200/50 transition-colors">
              <input
                type="checkbox"
                className="checkbox checkbox-primary checkbox-sm"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <span className="text-sm text-base-content">ข้าพเจ้ายืนยันว่าได้อ่านและยอมรับข้อตกลงการเป็นผู้ขายทั้งหมด</span>
            </label>

            {/* Bank name */}
            <div className="form-control">
              <label className="label pb-1">
                <span className="label-text font-medium">ชื่อธนาคาร</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              >
                <option value="">เลือกธนาคาร</option>
                {BANK_OPTIONS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Bank account number */}
            <div className="form-control">
              <label className="label pb-1">
                <span className="label-text font-medium">เลขบัญชีธนาคาร</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                value={bankAccountNumber}
                onChange={(e) =>
                  setBankAccountNumber(
                    e.target.value
                      .replace(/[^\d]/g, '')
                      .slice(0, 12)
                  )
                }
                placeholder="เลขบัญชีสำหรับรับเงิน (8-12 หลัก)"
                inputMode="numeric"
                autoComplete="off"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex gap-2 items-start p-3 rounded-xl bg-error/10 border border-error/20">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5 text-error">
                  <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <p className="text-sm text-error">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-base-300 flex justify-end gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleClose} disabled={submitting}>
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary btn-sm gap-2" disabled={submitting}>
              {submitting ? (
                <><span className="loading loading-spinner loading-sm" /> กำลังส่ง...</>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  ยืนยันสมัครเป็นผู้ขาย
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SellerApplicationModal;

import React from 'react';
import '../../styles/admin-dashboard.css';

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

/** Shared AdminRejectModal — identical rendering to AdminDashboard's rejection modal */
interface AdminRejectModalProps {
  show: boolean;
  onHide: () => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
  loading?: boolean;
}

// Exact copy of AdminDashboard's Modal primitives (lines 87–107)
type ModalType = React.FC<any> & {
  Header: React.FC<any>;
  Title: React.FC<any>;
  Body: React.FC<any>;
  Footer: React.FC<any>;
};

const Modal = (({ show, onHide, children, className }: any) => {
  if (!show) return null;
  const withClose = React.Children.map(children, (child: any) =>
    React.isValidElement(child)
      ? React.cloneElement(child as React.ReactElement<any>, { __onHide: onHide })
      : child
  );
  return (
    <div
      className={cx('fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4', className)}
      onClick={onHide}
    >
      <div className="card bg-white w-full max-w-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {withClose}
      </div>
    </div>
  );
}) as ModalType;

// NOTE: className prop is intentionally NOT forwarded — matches AdminDashboard ModalHeader exactly
const ModalHeader: React.FC<any> = ({ children, closeButton, __onHide }) => (
  <div className="px-6 py-4 bg-white border-b border-base-300 flex items-center justify-between">
    <div className="font-bold text-lg">{children}</div>
    {closeButton ? (
      <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={__onHide}>
        ✕
      </button>
    ) : null}
  </div>
);

const ModalTitle: React.FC<any> = ({ children }) => <>{children}</>;
const ModalBody: React.FC<any> = ({ children }) => <div className="px-6 py-4 bg-white">{children}</div>;
const ModalFooter: React.FC<any> = ({ children }) => (
  <div className="px-6 py-4 bg-white border-t border-base-300 flex justify-end gap-2">
    {children}
  </div>
);
Object.assign(Modal, { Header: ModalHeader, Title: ModalTitle, Body: ModalBody, Footer: ModalFooter });

const AdminRejectModal: React.FC<AdminRejectModalProps> = ({
  show,
  onHide,
  reason,
  onReasonChange,
  onConfirm,
  loading = false,
}) => {
  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      className="admin-modal admin-modal--danger"
    >
      <Modal.Header closeButton className="admin-modal-header--danger">
        <Modal.Title>
          <i className="fas fa-ban me-2" aria-hidden />
          ยืนยันการปฏิเสธ
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {/* Warning banner — same as AdminDashboard modalAction==='rejected' */}
        <div className="admin-modal-warning-banner admin-modal-warning-banner--reject">
          <i className="fas fa-ban admin-modal-warning-icon" aria-hidden />
          <div>
            <div className="admin-modal-warning-title">การปฏิเสธจะแจ้งเตือนผู้ขาย</div>
            <div className="admin-modal-warning-sub">คุณแน่ใจหรือไม่ที่จะปฏิเสธโพสต์นี้?</div>
          </div>
        </div>

        {/* Reason textarea — same as AdminDashboard */}
        <div className="admin-modal-reason-group">
          <label className="admin-modal-reason-label">
            <i className="fas fa-comment-alt me-2" aria-hidden />
            เหตุผล <span className="admin-modal-reason-optional">(ไม่บังคับ)</span>
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="ระบุเหตุผลเพื่อแจ้งให้ผู้ขายทราบ..."
            className="admin-modal-reason-textarea"
          />
        </div>
      </Modal.Body>

      <Modal.Footer>
        {/* Buttons — exact same classes as AdminDashboard modal footer */}
        <button type="button" className="admin-modal-btn-cancel" onClick={onHide}>
          <i className="fas fa-arrow-left me-2" aria-hidden />
          ยกเลิก
        </button>
        <button
          type="button"
          className="admin-modal-btn-confirm admin-modal-btn-confirm--danger"
          onClick={onConfirm}
          disabled={loading}
        >
          <i className="fas fa-ban me-2" aria-hidden />
          {loading ? 'กำลังดำเนินการ...' : 'ปฏิเสธโพสต์'}
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default AdminRejectModal;

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from '../utils/axiosInterceptor';
import { toast } from 'react-toastify';
import { PrimaryActionButton, SecondaryActionButton } from '../components/common/ButtonComponents';
import { AdminStats, Post, PostStatus, UserProfile } from '../types';
import '../styles/admin-dashboard.css';

interface AdminUser extends UserProfile {
  id: string;
  displayName: string;
  email: string;
  createdAt?: Date | string;
  isAdmin?: boolean;
  isBanned?: boolean;
  banReason?: string | null;
}

interface AdminPost extends Post {
  // AdminPost uses the same PostStatus type which now includes 'pending' and 'rejected'
}

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

const Container: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cx('container', className)}>{children}</div>
);
const Row: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cx('grid grid-cols-12 gap-4', className)}>{children}</div>
);
const Col: React.FC<{ children: React.ReactNode; className?: string; md?: number; lg?: number }> = ({ children, className, md, lg }) => {
  const lgMap: Record<number, string> = { 1: 'lg:col-span-1', 2: 'lg:col-span-2', 3: 'lg:col-span-3', 4: 'lg:col-span-4', 5: 'lg:col-span-5', 6: 'lg:col-span-6', 7: 'lg:col-span-7', 8: 'lg:col-span-8', 9: 'lg:col-span-9', 10: 'lg:col-span-10', 11: 'lg:col-span-11', 12: 'lg:col-span-12' };
  const mdMap: Record<number, string> = { 1: 'md:col-span-1', 2: 'md:col-span-2', 3: 'md:col-span-3', 4: 'md:col-span-4', 5: 'md:col-span-5', 6: 'md:col-span-6', 7: 'md:col-span-7', 8: 'md:col-span-8', 9: 'md:col-span-9', 10: 'md:col-span-10', 11: 'md:col-span-11', 12: 'md:col-span-12' };
  return <div className={cx('col-span-12', md ? mdMap[md] : '', lg ? lgMap[lg] : '', className)}>{children}</div>;
};

const CardRoot: React.FC<any> = ({ className, children }) => <div className={cx('card bg-base-100 border border-base-300 shadow-sm', className)}>{children}</div>;
const CardBody: React.FC<any> = ({ className, children }) => <div className={cx('card-body', className)}>{children}</div>;
const CardHeader: React.FC<any> = ({ className, children }) => <div className={cx('px-6 py-4 border-b border-base-300 font-semibold', className)}>{children}</div>;
const Card = Object.assign(CardRoot, { Body: CardBody, Header: CardHeader });

const Table: React.FC<any> = ({ className, children }) => (
  <div className="overflow-x-auto"><table className={cx('table table-zebra', className)}>{children}</table></div>
);

const Button: React.FC<any> = ({ variant, size, className, children, ...props }) => {
  const v = variant === 'primary' ? 'btn-primary'
    : variant === 'secondary' ? 'btn-secondary'
    : variant === 'success' ? 'btn-success'
    : variant === 'warning' ? 'btn-warning'
    : variant === 'danger' ? 'btn-error'
    : variant === 'outline-primary' ? 'btn-outline btn-primary'
    : variant === 'outline-secondary' ? 'btn-outline'
    : variant === 'outline-danger' ? 'btn-outline btn-error'
    : '';
  const s = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';
  return <button className={cx('btn', v, s, className)} {...props}>{children}</button>;
};

const Badge: React.FC<any> = ({ bg, className, children }) => {
  const b = bg === 'success' ? 'badge-success'
    : bg === 'warning' ? 'badge-warning'
    : bg === 'danger' ? 'badge-error'
    : bg === 'secondary' ? 'badge-neutral'
    : bg === 'info' ? 'badge-info'
    : bg === 'dark' ? 'badge-neutral'
    : '';
  return <span className={cx('badge', b, className)}>{children}</span>;
};

const FormGroup: React.FC<any> = ({ children, className }) => <div className={className}>{children}</div>;
const FormLabel: React.FC<any> = ({ children }) => <label className="label-text font-medium">{children}</label>;
const FormControl: React.FC<any> = ({ as, className, ...props }) => {
  if (as === 'textarea') return <textarea className={cx('textarea textarea-bordered w-full', className)} {...props} />;
  return <input className={cx('input input-bordered w-full', className)} {...props} />;
};
const FormSelect: React.FC<any> = ({ className, ...props }) => <select className={cx('select select-bordered', className)} {...props} />;
const Form = { Group: FormGroup, Label: FormLabel, Control: FormControl, Select: FormSelect };

type ModalType = React.FC<any> & {
  Header: React.FC<any>;
  Title: React.FC<any>;
  Body: React.FC<any>;
  Footer: React.FC<any>;
};
const Modal = (({ show, onHide, children, className }) => {
  if (!show) return null;
  const withClose = React.Children.map(children, (child) =>
    React.isValidElement(child) ? React.cloneElement(child as React.ReactElement<any>, { __onHide: onHide }) : child
  );
  return (
    <div className={cx('fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4', className)} onClick={onHide}>
      <div className="card bg-white w-full max-w-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>{withClose}</div>
    </div>
  );
}) as ModalType;
const ModalHeader: React.FC<any> = ({ children, closeButton, __onHide }) => (
  <div className="px-6 py-4 bg-white border-b border-base-300 flex items-center justify-between">
    <div className="font-bold text-lg">{children}</div>
    {closeButton ? <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={__onHide}>✕</button> : null}
  </div>
);
const ModalTitle: React.FC<any> = ({ children }) => <>{children}</>;
const ModalBody: React.FC<any> = ({ children }) => <div className="px-6 py-4 bg-white">{children}</div>;
const ModalFooter: React.FC<any> = ({ children }) => <div className="px-6 py-4 bg-white border-t border-base-300 flex justify-end gap-2">{children}</div>;
Object.assign(Modal, { Header: ModalHeader, Title: ModalTitle, Body: ModalBody, Footer: ModalFooter });

const AdminDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [pendingPosts, setPendingPosts] = useState<AdminPost[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'posts' | 'pending' | 'users'>('dashboard');

  // Posts filters (จัดการโพสต์)
  const [postsStatusFilter, setPostsStatusFilter] = useState<'all' | 'pending' | 'active' | 'rejected'>('all');
  const [postsSearchInput, setPostsSearchInput] = useState<string>('');
  const [postsSearch, setPostsSearch] = useState<string>('');
  const [postsPagination, setPostsPagination] = useState<{ page: number; limit: number; total: number; totalPages: number }>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  // Pending queue filters (รออนุมัติ)
  const [pendingSearchInput, setPendingSearchInput] = useState<string>('');
  const [pendingSearch, setPendingSearch] = useState<string>('');
  const [pendingPagination, setPendingPagination] = useState<{ page: number; limit: number; total: number; totalPages: number }>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);

  // Users filters (จัดการผู้ใช้)
  const [usersSearchInput, setUsersSearchInput] = useState<string>('');
  const [usersSearch, setUsersSearch] = useState<string>('');
  const [usersPagination, setUsersPagination] = useState<{ page: number; limit: number; total: number; totalPages: number }>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectedPost, setSelectedPost] = useState<AdminPost | null>(null);
  const [bulkPostIds, setBulkPostIds] = useState<string[]>([]);
  const [modalAction, setModalAction] = useState<'delete' | 'active' | 'rejected' | 'bulkRejected' | ''>('');
  const [reason, setReason] = useState<string>('');

  useEffect(() => {
    if (!userProfile?.isAdmin) return;

    const fetchForTab = async (): Promise<void> => {
      try {
        setLoading(true);
        if (activeTab === 'dashboard') {
          const statsResponse = await axios.get('/api/admin/stats');
          setStats(statsResponse.data);
          return;
        }

        if (activeTab === 'posts') {
          const params = {
            status: postsStatusFilter === 'all' ? undefined : postsStatusFilter,
            search: postsSearch || undefined,
            sortBy: 'newest',
            page: postsPagination.page,
            limit: postsPagination.limit
          };
          const postsResponse = await axios.get('/api/admin/posts', { params });
          setPosts(Array.isArray(postsResponse.data?.posts) ? postsResponse.data.posts : []);
          const p = postsResponse.data?.pagination;
          if (p) setPostsPagination((prev) => ({ ...prev, ...p }));
          return;
        }

        if (activeTab === 'pending') {
          const params = {
            status: 'pending',
            search: pendingSearch || undefined,
            sortBy: 'newest',
            page: pendingPagination.page,
            limit: pendingPagination.limit
          };
          const pendingResponse = await axios.get('/api/admin/posts', { params });
          setPendingPosts(Array.isArray(pendingResponse.data?.posts) ? pendingResponse.data.posts : []);
          const p = pendingResponse.data?.pagination;
          if (p) setPendingPagination((prev) => ({ ...prev, ...p }));
          setSelectedPendingIds([]);
          return;
        }

        if (activeTab === 'users') {
          const params = {
            search: usersSearch || undefined,
            page: usersPagination.page,
            limit: usersPagination.limit
          };
          const usersResponse = await axios.get('/api/admin/users', { params });
          setUsers(Array.isArray(usersResponse.data?.users) ? usersResponse.data.users : []);
          const p = usersResponse.data?.pagination;
          if (p) setUsersPagination((prev) => ({ ...prev, ...p }));
          return;
        }
      } catch (error) {
        console.error('Error fetching admin tab data:', error);
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    };

    fetchForTab();
  }, [
    userProfile?.isAdmin,
    activeTab,
    postsStatusFilter,
    postsSearch,
    postsPagination.page,
    postsPagination.limit,
    pendingSearch,
    pendingPagination.page,
    pendingPagination.limit,
    usersSearch,
    usersPagination.page,
    usersPagination.limit
  ]);

  const handlePostAction = (post: AdminPost, action: 'delete' | 'active' | 'rejected'): void => {
    setSelectedPost(post);
    setModalAction(action);
    setShowModal(true);
  };

  const handleActionConfirm = async (): Promise<void> => {
    if (modalAction === 'bulkRejected' && bulkPostIds.length === 0) return;
    if (modalAction !== 'bulkRejected' && !selectedPost) return;

    try {
      if (modalAction === 'bulkRejected') {
        await axios.post('/api/admin/posts/bulk-status', {
          postIds: bulkPostIds,
          status: 'rejected',
          reason
        });
        toast.success('ปฏิเสธโพสต์ (หลายรายการ) สำเร็จ');

        const removed = new Set(bulkPostIds);
        setPendingPosts(prev => prev.filter(post => !removed.has(post.id)));
        setPendingPagination(prev => ({
          ...prev,
          total: Math.max(0, prev.total - bulkPostIds.length)
        }));

        setShowModal(false);
        setSelectedPost(null);
        setBulkPostIds([]);
        setSelectedPendingIds([]);
        setReason('');
        setModalAction('');
        return;
      }

      if (modalAction === 'delete') {
        await axios.delete(`/api/admin/posts/${selectedPost.id}`, {
          data: { reason }
        });
        setPosts(posts.filter(post => post.id !== selectedPost.id));
        setPostsPagination(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }));
        toast.success('ลบโพสต์สำเร็จ');
      } else if (modalAction === 'active' || modalAction === 'rejected') {
        await axios.put(`/api/admin/posts/${selectedPost.id}/status`, {
          status: modalAction,
          reason
        });

        if (activeTab === 'pending') {
          setPendingPosts(pendingPosts.filter(post => post.id !== selectedPost.id));
          setPendingPagination(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }));
          setSelectedPendingIds((prev) => prev.filter(id => id !== selectedPost.id));
        } else {
          const newStatus = modalAction as PostStatus;
          const matchesFilter = postsStatusFilter === 'all' ? true : newStatus === postsStatusFilter;
          if (!matchesFilter) {
            setPosts(prev => prev.filter(post => post.id !== selectedPost.id));
            setPostsPagination(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }));
          } else {
            setPosts(prev => prev.map(post =>
              post.id === selectedPost.id
                ? { ...post, status: newStatus }
                : post
            ));
          }
        }
        toast.success(`โพสต์${modalAction === 'active' ? 'อนุมัติ' : 'ปฏิเสธ'}สำเร็จ`);
      }
      
      setShowModal(false);
      setSelectedPost(null);
      setReason('');
      setBulkPostIds([]);
      setModalAction('');
    } catch (error) {
      console.error('Error performing action:', error);
      toast.error('เกิดข้อผิดพลาดในการดำเนินการ');
    }
  };

  const formatPrice = (price: number | undefined): string => {
    if (!price) return '0 ฿';
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB'
    }).format(price);
  };

  const formatDate = (dateString: Date | string | undefined): string => {
    if (!dateString) return 'วันที่ไม่ระบุ';
    return new Date(dateString).toLocaleDateString('th-TH');
  };


  const getStatusBadge = (status: string): JSX.Element => {
    switch (status) {
      case 'active':
        return <Badge bg="success">เปิดขาย</Badge>;
      case 'pending':
        return <Badge bg="warning">รออนุมัติ</Badge>;
      case 'rejected':
        return <Badge bg="danger">ถูกปฏิเสธ</Badge>;
      default:
        return <Badge bg="secondary">ไม่ทราบ</Badge>;
    }
  };

  const getDescriptionSnippet = (description?: string | null): string => {
    const d = (description ?? '').replace(/\s+/g, ' ').trim();
    if (!d) return '—';
    return d.length > 120 ? d.slice(0, 120) + '...' : d;
  };

  const normalizeImages = (images?: unknown): string[] => {
    if (!Array.isArray(images)) return [];
    return images.map((x) => (typeof x === 'string' ? x : (x ? String(x) : ''))).filter(Boolean);
  };

  const getSaleTypeLabel = (saleType?: string | null): string | null => {
    if (!saleType) return null;
    const v = saleType.toLowerCase();
    if (v === 'deck') return 'ขายเด็ค';
    if (v === 'individual') return 'ขายแยกใบ';
    return saleType;
  };

  const getPostTypeBadge = (postType?: string | null, saleType?: string | null): JSX.Element | null => {
    if (!postType) return null;
    const t = postType.toLowerCase();
    if (t === 'sale') {
      const label = getSaleTypeLabel(saleType) ?? 'sale';
      return <Badge bg="info" className="ms-1">{label}</Badge>;
    }
    if (t === 'auction') {
      return <Badge bg="dark" className="ms-1">ประมูล</Badge>;
    }
    return null;
  };

  const bulkSamplePost: AdminPost | null = bulkPostIds.length
    ? pendingPosts.find((p) => p.id === bulkPostIds[0]) ?? null
    : null;

  const previewPostForModal: AdminPost | null =
    modalAction === 'bulkRejected' ? bulkSamplePost : selectedPost;

  if (!userProfile?.isAdmin) {
    return (
      <div className="admin-dashboard-page">
        <Container className="py-5">
          <div className="admin-denied-card">
            <div className="admin-denied-icon" aria-hidden><i className="fas fa-shield-alt" /></div>
            <h5 className="mb-2">ไม่มีสิทธิ์เข้าถึง</h5>
            <p className="text-muted mb-0">คุณไม่มีสิทธิ์เข้าถึงหน้านี้ กรุณาติดต่อผู้ดูแลระบบ</p>
          </div>
        </Container>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="admin-dashboard-page">
        <div className="admin-loading-wrap" aria-live="polite" aria-busy="true">
          <span className="loading loading-spinner loading-lg admin-loading-spinner" role="status" aria-label="กำลังโหลด" />
          <p className="admin-loading-text">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-page">
      <Container>
        <header className="admin-dashboard-header">
          <div className="admin-dashboard-header-inner">
            <h2>
              <span className="admin-dashboard-header-icon"><i className="fas fa-shield-alt" aria-hidden /></span>
              แดชบอร์ดแอดมิน
            </h2>
            <p className="admin-dashboard-header-desc">จัดการระบบ โพสต์ และผู้ใช้งาน</p>
          </div>
        </header>

        <nav className="admin-dashboard-tabs" role="tablist" aria-label="เมนูแดชบอร์ด">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'dashboard'}
            className={`admin-dashboard-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <i className="fas fa-chart-pie" aria-hidden />สถิติ
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'posts'}
            className={`admin-dashboard-tab ${activeTab === 'posts' ? 'active' : ''}`}
            onClick={() => setActiveTab('posts')}
          >
            <i className="fas fa-newspaper" aria-hidden />จัดการโพสต์
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'pending'}
            className={`admin-dashboard-tab ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            <i className="fas fa-clock" aria-hidden />รออนุมัติ
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'users'}
            className={`admin-dashboard-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <i className="fas fa-users" aria-hidden />จัดการผู้ใช้
          </button>
        </nav>

        {activeTab === 'dashboard' && stats && (
          <Row className="mb-4">
            <Col md={6} lg={3} className="mb-4">
              <Card className="admin-stat-card admin-stat-card--posts">
                <Card.Body>
                  <div className="admin-stat-icon admin-stat-icon--posts">
                    <i className="fas fa-newspaper" aria-hidden />
                  </div>
                  <h3 className="admin-stat-value admin-stat-value--posts">{stats.totalPosts}</h3>
                  <p className="admin-stat-label">โพสต์ทั้งหมด</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={3} className="mb-4">
              <Card className="admin-stat-card admin-stat-card--active">
                <Card.Body>
                  <div className="admin-stat-icon admin-stat-icon--active">
                    <i className="fas fa-check-circle" aria-hidden />
                  </div>
                  <h3 className="admin-stat-value admin-stat-value--active">{stats.activePosts}</h3>
                  <p className="admin-stat-label">โพสต์ที่เผยแพร่</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={3} className="mb-4">
              <Card className="admin-stat-card admin-stat-card--pending">
                <Card.Body>
                  <div className="admin-stat-icon admin-stat-icon--pending">
                    <i className="fas fa-clock" aria-hidden />
                  </div>
                  <h3 className="admin-stat-value admin-stat-value--recent">{stats.pendingPosts ?? 0}</h3>
                  <p className="admin-stat-label">โพสต์รออนุมัติ</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={3} className="mb-4">
              <Card className="admin-stat-card admin-stat-card--users">
                <Card.Body>
                  <div className="admin-stat-icon admin-stat-icon--users">
                    <i className="fas fa-users" aria-hidden />
                  </div>
                  <h3 className="admin-stat-value admin-stat-value--users">{stats.totalUsers}</h3>
                  <p className="admin-stat-label">ผู้ใช้ทั้งหมด</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={3} className="mb-4">
              <Card className="admin-stat-card admin-stat-card--active">
                <Card.Body>
                  <div className="admin-stat-icon admin-stat-icon--active">
                    <i className="fas fa-user-check" aria-hidden />
                  </div>
                  <h3 className="admin-stat-value admin-stat-value--active">{stats.activeUsers ?? 0}</h3>
                  <p className="admin-stat-label">ผู้ใช้ที่ไม่ถูกแบน</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={3} className="mb-4">
              <Card className="admin-stat-card admin-stat-card--recent">
                <Card.Body>
                  <div className="admin-stat-icon admin-stat-icon--recent">
                    <i className="fas fa-bolt" aria-hidden />
                  </div>
                  <h3 className="admin-stat-value admin-stat-value--recent">{stats.recentPosts}</h3>
                  <p className="admin-stat-label">โพสต์ใหม่ (7 วัน)</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={3} className="mb-4">
              <Card className="admin-stat-card admin-stat-card--coverage">
                <Card.Body>
                  <div className="admin-stat-icon admin-stat-icon--coverage">
                    <i className="fas fa-brain" aria-hidden />
                  </div>
                  <h3 className="admin-stat-value admin-stat-value--recent">
                    {stats.embeddingCoverage?.activeEmbeddingCoveragePct?.toFixed(0) ?? '0'}%
                  </h3>
                  <p className="admin-stat-label">
                    AI Embeddings: {stats.embeddingCoverage?.activePostsWithEmbeddings ?? 0}/{stats.activePosts}
                  </p>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}

        {activeTab === 'posts' && (
          <Card className="admin-section-card mb-4">
            <Card.Header className="admin-section-header">
              <i className="fas fa-newspaper" aria-hidden />จัดการโพสต์
            </Card.Header>
            <Card.Body className="admin-section-body">
              <div className="admin-filter-row d-flex flex-wrap gap-2 align-items-center mb-3">
                <Form.Select
                  value={postsStatusFilter}
                  onChange={(e) => {
                    const v = e.target.value as 'all' | 'pending' | 'active' | 'rejected';
                    setPostsStatusFilter(v);
                    setPostsPagination(prev => ({ ...prev, page: 1 }));
                  }}
                >
                  <option value="all">ทั้งหมด</option>
                  <option value="pending">pending</option>
                  <option value="active">active</option>
                  <option value="rejected">rejected</option>
                </Form.Select>

                <Form.Control
                  style={{ maxWidth: 340 }}
                  value={postsSearchInput}
                  onChange={(e) => setPostsSearchInput(e.target.value)}
                  placeholder="ค้นหาชื่อโพสต์/ผู้ขาย"
                />

                <PrimaryActionButton
                  onClick={() => {
                    setPostsSearch(postsSearchInput);
                    setPostsPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  icon={<i className="fas fa-search" aria-hidden />}
                >
                  ค้นหา
                </PrimaryActionButton>

                <SecondaryActionButton
                  onClick={() => {
                    setPostsStatusFilter('all');
                    setPostsSearchInput('');
                    setPostsSearch('');
                    setPostsPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  icon={<i className="fas fa-undo" aria-hidden />}
                >
                  รีเซ็ต
                </SecondaryActionButton>

                <div className="ms-auto">
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={async () => {
                      try {
                        const resp = await axios.get('/api/admin/export/rejected-posts', { responseType: 'blob' });
                        const blob = new Blob([resp.data], { type: 'text/csv;charset=utf-8' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'rejected-posts.csv';
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        window.URL.revokeObjectURL(url);
                        toast.success('Export CSV โพสต์ที่ถูกปฏิเสธสำเร็จ');
                      } catch (e) {
                        console.error(e);
                        toast.error('Export CSV โพสต์ที่ถูกปฏิเสธไม่สำเร็จ');
                      }
                    }}
                  >
                    <i className="fas fa-file-csv me-1" aria-hidden />Export CSV โพสต์ที่ถูกปฏิเสธ
                  </Button>
                </div>
              </div>
              <Table responsive>
              <thead>
                <tr>
                  <th>การ์ด</th>
                  <th>ผู้ขาย</th>
                  <th>ราคา</th>
                  <th>สถานะ</th>
                  <th>วันที่</th>
                  <th>การดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id}>
                    <td>
                      <div className="admin-post-cell">
                        <div className="admin-post-thumbs">
                          {normalizeImages(post.images).slice(0, 2).map((img, idx) => (
                            <img key={`${post.id}-thumb-${idx}`} src={img} alt="" className="admin-post-thumb" />
                          ))}
                        </div>
                        <div className="admin-post-text">
                          <Link
                            to={`/post/${post.id}`}
                            className="text-decoration-none fw-bold"
                            style={{ color: 'var(--bright-teal-blue)' }}
                          >
                            {post.title}
                          </Link>
                          <div className="admin-post-meta">
                            <small className="text-muted">{post.category}</small>
                            <span className="admin-post-type-row">
                              {getPostTypeBadge(post.postType, post.saleType ?? null)}
                            </span>
                          </div>
                          <div className="admin-post-desc-snippet">{getDescriptionSnippet(post.description)}</div>
                        </div>
                      </div>
                    </td>
                    <td>{post.sellerName}</td>
                    <td>{formatPrice(post.price)}</td>
                    <td>{getStatusBadge(post.status)}</td>
                    <td>{formatDate(post.createdAt as string)}</td>
                    <td>
                      <div className="d-flex flex-wrap gap-1 align-items-center">
                        <Link
                          to={`/post/${post.id}`}
                          className="btn btn-sm btn-outline-primary btn-tcg-outline btn-tcg-sm"
                        >
                          <i className="fas fa-external-link-alt me-1" aria-hidden />ดู
                        </Link>
                        <Button
                          size="sm"
                          variant="success"
                          className="btn-tcg-sm"
                          onClick={() => handlePostAction(post, 'active')}
                        >
                          <i className="fas fa-check me-1" aria-hidden />อนุมัติ
                        </Button>
                        <Button
                          size="sm"
                          variant="warning"
                          className="btn-tcg-sm"
                          onClick={() => handlePostAction(post, 'rejected')}
                        >
                          <i className="fas fa-times me-1" aria-hidden />ปฏิเสธ
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-danger"
                          className="btn-tcg-sm"
                          onClick={() => handlePostAction(post, 'delete')}
                        >
                          <i className="fas fa-trash-alt me-1" aria-hidden />ลบ
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>

              <div className="admin-pagination-row d-flex justify-content-between align-items-center mt-3">
                <Button
                  size="sm"
                  variant="outline-primary"
                  disabled={postsPagination.page <= 1}
                  onClick={() => setPostsPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                >
                  <i className="fas fa-chevron-left me-2" aria-hidden />ก่อนหน้า
                </Button>

                <span className="admin-pagination-info">
                  หน้า <strong>{postsPagination.totalPages === 0 ? 0 : postsPagination.page}</strong> / <strong>{postsPagination.totalPages}</strong>
                  <span className="admin-pagination-total"> ({postsPagination.total} รายการ)</span>
                </span>

                <Button
                  size="sm"
                  variant="outline-primary"
                  disabled={postsPagination.totalPages === 0 || postsPagination.page >= postsPagination.totalPages}
                  onClick={() => setPostsPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                >
                  ถัดไป<i className="fas fa-chevron-right ms-2" aria-hidden />
                </Button>
              </div>
          </Card.Body>
        </Card>
      )}

        {activeTab === 'pending' && (
          <Card className="admin-section-card mb-4">
            <Card.Header className="admin-section-header">
              <i className="fas fa-clock" aria-hidden />รออนุมัติ (pending queue)
            </Card.Header>
            <Card.Body className="admin-section-body">
              <div className="admin-filter-row d-flex flex-wrap gap-2 align-items-center mb-3">
                <Form.Control
                  style={{ maxWidth: 340 }}
                  value={pendingSearchInput}
                  onChange={(e) => setPendingSearchInput(e.target.value)}
                  placeholder="ค้นหาชื่อโพสต์/ผู้ขาย"
                />

                <PrimaryActionButton
                  onClick={() => {
                    setPendingSearch(pendingSearchInput);
                    setPendingPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  icon={<i className="fas fa-search" aria-hidden />}
                >
                  ค้นหา
                </PrimaryActionButton>

                <SecondaryActionButton
                  onClick={() => {
                    setPendingSearchInput('');
                    setPendingSearch('');
                    setPendingPagination(prev => ({ ...prev, page: 1 }));
                    setSelectedPendingIds([]);
                  }}
                  icon={<i className="fas fa-undo" aria-hidden />}
                >
                  รีเซ็ต
                </SecondaryActionButton>
              </div>

              <div className="admin-bulk-row d-flex flex-wrap gap-2 align-items-center mb-3">
                <span className="admin-bulk-counter">
                  <i className="fas fa-check-square" aria-hidden style={{ marginRight: '0.4rem' }} />
                  เลือกแล้ว <strong style={{ marginLeft: '0.25rem', marginRight: '0.25rem' }}>{selectedPendingIds.length}</strong> โพสต์
                </span>
                <div className="ms-auto d-flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="success"
                    className="btn-admin-big-action"
                    disabled={selectedPendingIds.length === 0}
                    onClick={async () => {
                      try {
                        await axios.post('/api/admin/posts/bulk-status', {
                          postIds: selectedPendingIds,
                          status: 'active'
                        });
                        toast.success('อนุมัติหลายรายการสำเร็จ');
                        const removed = new Set(selectedPendingIds);
                        setPendingPosts(prev => prev.filter(p => !removed.has(p.id)));
                        setPendingPagination(prev => ({
                          ...prev,
                          total: Math.max(0, prev.total - selectedPendingIds.length)
                        }));
                        setSelectedPendingIds([]);
                      } catch (e) {
                        console.error(e);
                        toast.error('เกิดข้อผิดพลาดในการอนุมัติหลายรายการ');
                      }
                    }}
                  >
                    <i className="fas fa-check me-1" aria-hidden />อนุมัติที่เลือก
                  </Button>

                  <Button
                    size="sm"
                    variant="warning"
                    className="btn-admin-big-action"
                    disabled={selectedPendingIds.length === 0}
                    onClick={() => {
                      setBulkPostIds(selectedPendingIds);
                      setSelectedPost(null);
                      setModalAction('bulkRejected');
                      setReason('');
                      setShowModal(true);
                    }}
                  >
                    <i className="fas fa-times me-1" aria-hidden />ปฏิเสธที่เลือก
                  </Button>
                </div>
              </div>

              <Table responsive>
                <thead>
                  <tr>
                    <th>เลือก</th>
                    <th>การ์ด</th>
                    <th>ผู้ขาย</th>
                    <th>ราคา</th>
                    <th>วันที่</th>
                    <th>ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingPosts.map((post) => {
                    const checked = selectedPendingIds.includes(post.id);
                    return (
                      <tr key={post.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedPendingIds(prev => {
                                if (prev.includes(post.id)) {
                                  return prev.filter(id => id !== post.id);
                                }
                                return [...prev, post.id];
                              });
                            }}
                          />
                        </td>
                        <td>
                          <div className="admin-post-cell">
                            <div className="admin-post-thumbs">
                              {normalizeImages(post.images).slice(0, 2).map((img, idx) => (
                                <img key={`${post.id}-thumb-${idx}`} src={img} alt="" className="admin-post-thumb" />
                              ))}
                            </div>
                            <div className="admin-post-text">
                              <Link
                                to={`/post/${post.id}`}
                                className="text-decoration-none fw-bold"
                                style={{ color: 'var(--bright-teal-blue)' }}
                              >
                                {post.title}
                              </Link>
                              <div className="admin-post-meta">
                                <small className="text-muted">{post.category}</small>
                                <span className="admin-post-type-row">
                                  {getPostTypeBadge(post.postType, post.saleType ?? null)}
                                </span>
                              </div>
                              <div className="admin-post-desc-snippet">{getDescriptionSnippet(post.description)}</div>
                            </div>
                          </div>
                        </td>
                        <td>{post.sellerName}</td>
                        <td>{formatPrice(post.price)}</td>
                        <td>{formatDate(post.createdAt as string)}</td>
                        <td>
                          <div className="d-flex flex-wrap gap-2">
                            <Link
                              to={`/post/${post.id}`}
                              className="btn btn-sm btn-outline-primary btn-tcg-outline btn-tcg-sm"
                            >
                              <i className="fas fa-external-link-alt me-1" aria-hidden />ดู
                            </Link>
                            <Button
                              size="sm"
                              variant="success"
                              className="btn-admin-big-action"
                              onClick={() => handlePostAction(post, 'active')}
                            >
                              <i className="fas fa-check me-1" aria-hidden />อนุมัติ
                            </Button>
                            <Button
                              size="sm"
                              variant="warning"
                              className="btn-admin-big-action"
                              onClick={() => handlePostAction(post, 'rejected')}
                            >
                              <i className="fas fa-times me-1" aria-hidden />ปฏิเสธ
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>

              <div className="admin-pagination-row d-flex justify-content-between align-items-center mt-3">
                <Button
                  size="sm"
                  variant="outline-primary"
                  disabled={pendingPagination.page <= 1}
                  onClick={() => setPendingPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                >
                  <i className="fas fa-chevron-left me-2" aria-hidden />ก่อนหน้า
                </Button>

                <span className="admin-pagination-info">
                  หน้า <strong>{pendingPagination.totalPages === 0 ? 0 : pendingPagination.page}</strong> / <strong>{pendingPagination.totalPages}</strong>
                  <span className="admin-pagination-total"> ({pendingPagination.total} รายการ)</span>
                </span>

                <Button
                  size="sm"
                  variant="outline-primary"
                  disabled={pendingPagination.totalPages === 0 || pendingPagination.page >= pendingPagination.totalPages}
                  onClick={() => setPendingPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                >
                  ถัดไป<i className="fas fa-chevron-right ms-2" aria-hidden />
                </Button>
              </div>
            </Card.Body>
          </Card>
        )}

        {activeTab === 'users' && (
          <Card className="admin-section-card mb-4">
            <Card.Header className="admin-section-header">
              <i className="fas fa-users" aria-hidden />จัดการผู้ใช้
            </Card.Header>
            <Card.Body className="admin-section-body">
              <div className="admin-filter-row d-flex flex-wrap gap-2 align-items-center mb-3">
                <Form.Control
                  style={{ maxWidth: 340 }}
                  value={usersSearchInput}
                  onChange={(e) => setUsersSearchInput(e.target.value)}
                  placeholder="ค้นหาชื่อผู้ใช้"
                />

                <PrimaryActionButton
                  onClick={() => {
                    setUsersSearch(usersSearchInput);
                    setUsersPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  icon={<i className="fas fa-search" aria-hidden />}
                >
                  ค้นหา
                </PrimaryActionButton>

                <SecondaryActionButton
                  onClick={() => {
                    setUsersSearchInput('');
                    setUsersSearch('');
                    setUsersPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  icon={<i className="fas fa-undo" aria-hidden />}
                >
                  รีเซ็ต
                </SecondaryActionButton>

                <div className="ms-auto">
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={async () => {
                      try {
                        const resp = await axios.get('/api/admin/export/banned-users', { responseType: 'blob' });
                        const blob = new Blob([resp.data], { type: 'text/csv;charset=utf-8' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'banned-users.csv';
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        window.URL.revokeObjectURL(url);
                        toast.success('Export CSV สำเร็จ');
                      } catch (e) {
                        console.error(e);
                        toast.error('Export CSV ไม่สำเร็จ');
                      }
                    }}
                  >
                    <i className="fas fa-file-csv me-1" aria-hidden />Export CSV ถูกแบน
                  </Button>
                </div>
              </div>
              <Table responsive>
              <thead>
                <tr>
                  <th>ชื่อ</th>
                  <th>อีเมล</th>
                  <th>สถานะ</th>
                  <th>วันที่สมัคร</th>
                  <th>การดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.displayName ?? user.username ?? '—'}</td>
                    <td>{user.email ?? '—'}</td>
                    <td>
                      {user.isBanned ? (
                        <Badge bg="dark">ถูกแบน</Badge>
                      ) : (user.isAdmin || (user.role ?? '').toLowerCase() === 'admin') ? (
                        <Badge bg="danger">แอดมิน</Badge>
                      ) : (user.role ?? '').toLowerCase() === 'seller' ? (
                        <Badge bg="info">ผู้ขาย</Badge>
                      ) : (
                        <Badge bg="secondary">ผู้ใช้</Badge>
                      )}
                    </td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>
                      <div className="d-flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className={user.isAdmin ? 'btn-tcg-outline btn-tcg-sm' : 'btn-tcg-primary btn-tcg-sm'}
                          onClick={async () => {
                            try {
                              await axios.put(`/api/admin/users/${user.id}/admin`, {
                                isAdmin: !user.isAdmin
                              });
                              setUsers(users.map(u => 
                                u.id === user.id ? { ...u, isAdmin: !u.isAdmin } : u
                              ));
                              toast.success('อัปเดตสิทธิ์แอดมินสำเร็จ');
                            } catch (error) {
                              toast.error('เกิดข้อผิดพลาดในการอัปเดตสิทธิ์แอดมิน');
                            }
                          }}
                        >
                          {user.isAdmin ? 'ลบสิทธิ์แอดมิน' : 'ให้สิทธิ์แอดมิน'}
                        </Button>
                        <Button
                          size="sm"
                          variant={user.isBanned ? 'outline-secondary' : 'outline-danger'}
                          className="btn-tcg-sm"
                          onClick={async () => {
                            try {
                              const isBanned = !user.isBanned;
                              await axios.put(`/api/admin/users/${user.id}/ban`, {
                                isBanned,
                                reason: isBanned ? 'แบนจากแดชบอร์ดแอดมิน' : undefined
                              });
                              setUsers(users.map(u =>
                                u.id === user.id ? { ...u, isBanned } : u
                              ));
                              toast.success(isBanned ? 'แบนผู้ใช้สำเร็จ' : 'ยกเลิกการแบนสำเร็จ');
                            } catch (err: any) {
                              const message = err?.response?.data?.error || 'เกิดข้อผิดพลาดในการอัปเดตสถานะแบน';
                              toast.error(message);
                            }
                          }}
                        >
                          {user.isBanned ? 'ยกเลิกแบน' : 'แบนผู้ใช้'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <div className="admin-pagination-row d-flex justify-content-between align-items-center mt-3">
              <Button
                size="sm"
                variant="outline-primary"
                disabled={usersPagination.page <= 1}
                onClick={() => setUsersPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              >
                <i className="fas fa-chevron-left me-2" aria-hidden />ก่อนหน้า
              </Button>

              <span className="admin-pagination-info">
                หน้า <strong>{usersPagination.totalPages === 0 ? 0 : usersPagination.page}</strong> / <strong>{usersPagination.totalPages}</strong>
                <span className="admin-pagination-total"> ({usersPagination.total} รายการ)</span>
              </span>

              <Button
                size="sm"
                variant="outline-primary"
                disabled={usersPagination.totalPages === 0 || usersPagination.page >= usersPagination.totalPages}
                onClick={() => setUsersPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              >
                ถัดไป<i className="fas fa-chevron-right ms-2" aria-hidden />
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}

        <Modal
          show={showModal}
          onHide={() => setShowModal(false)}
          centered
          className={`admin-modal admin-modal--${modalAction === 'active' ? 'approve' : 'danger'}`}
          dialogClassName="admin-modal-dialog"
          contentClassName="admin-modal-content"
          backdropClassName="admin-modal-backdrop"
          style={{ backgroundColor: '#ffffff', opacity: 1 }}
        >
          <Modal.Header closeButton className={`admin-modal-header--${modalAction === 'active' ? 'approve' : 'danger'}`}>
            <Modal.Title>
              {modalAction === 'delete' && <i className="fas fa-trash-alt me-2" aria-hidden />}
              {modalAction === 'active' && <i className="fas fa-check-circle me-2" aria-hidden />}
              {modalAction === 'rejected' && <i className="fas fa-ban me-2" aria-hidden />}
              {modalAction === 'bulkRejected' && <i className="fas fa-layer-group me-2" aria-hidden />}
              {modalAction === 'delete'
                ? 'ยืนยันการลบ'
                : modalAction === 'active'
                  ? 'ยืนยันการอนุมัติ'
                  : modalAction === 'bulkRejected'
                    ? 'ยืนยันการปฏิเสธหลายโพสต์'
                    : 'ยืนยันการปฏิเสธ'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {(modalAction === 'rejected' || modalAction === 'bulkRejected' || modalAction === 'delete') && (
              <div className={`admin-modal-warning-banner admin-modal-warning-banner--${modalAction === 'delete' ? 'delete' : 'reject'}`}>
                <i className={`fas ${modalAction === 'delete' ? 'fa-exclamation-triangle' : 'fa-ban'} admin-modal-warning-icon`} aria-hidden />
                <div>
                  <div className="admin-modal-warning-title">
                    {modalAction === 'delete' ? 'การลบไม่สามารถย้อนกลับได้' : 'การปฏิเสธจะแจ้งเตือนผู้ขาย'}
                  </div>
                  <div className="admin-modal-warning-sub">
                    {modalAction === 'delete'
                      ? 'คุณแน่ใจหรือไม่ที่จะลบโพสต์นี้ถาวร?'
                      : modalAction === 'bulkRejected'
                        ? `กำลังปฏิเสธโพสต์จำนวน ${bulkPostIds.length} รายการ`
                        : 'คุณแน่ใจหรือไม่ที่จะปฏิเสธโพสต์นี้?'}
                  </div>
                </div>
              </div>
            )}
            {modalAction === 'active' && (
              <div className="admin-modal-warning-banner admin-modal-warning-banner--approve">
                <i className="fas fa-check-circle admin-modal-warning-icon" aria-hidden />
                <div>
                  <div className="admin-modal-warning-title">อนุมัติโพสต์</div>
                  <div className="admin-modal-warning-sub">โพสต์จะแสดงต่อสาธารณะและผู้ขายจะได้รับแจ้งเตือน</div>
                </div>
              </div>
            )}
            {modalAction === 'bulkRejected' && (
              <div className="admin-modal-preview">
                <div className="admin-modal-preview-count">
                  <strong>จำนวนโพสต์:</strong> {bulkPostIds.length}
                </div>
                {previewPostForModal && (
                  <div className="admin-modal-preview-card">
                    <div className="admin-modal-preview-images">
                      {normalizeImages(previewPostForModal.images).slice(0, 3).map((img, idx) => (
                        <img key={`${previewPostForModal.id}-modal-thumb-${idx}`} src={img} alt="" className="admin-modal-thumb" />
                      ))}
                    </div>
                    <div className="admin-modal-preview-head">
                      <div className="admin-modal-preview-title">
                        {previewPostForModal.title}
                        {getPostTypeBadge(previewPostForModal.postType, previewPostForModal.saleType ?? null)}
                      </div>
                      <div className="text-muted small">ผู้ขาย: {previewPostForModal.sellerName}</div>
                    </div>
                    <div className="admin-modal-preview-desc">{previewPostForModal.description}</div>
                    <div className="admin-modal-metrics">
                      <div><span className="admin-modal-metric-label">ราคา</span><span>{formatPrice(previewPostForModal.price)}</span></div>
                      {previewPostForModal.cardCount != null && (
                        <div><span className="admin-modal-metric-label">จำนวนการ์ด</span><span>{previewPostForModal.cardCount}</span></div>
                      )}
                      {previewPostForModal.availableQuantity != null && (
                        <div><span className="admin-modal-metric-label">จำนวนที่มี</span><span>{previewPostForModal.availableQuantity}</span></div>
                      )}
                      {previewPostForModal.postType === 'auction' && previewPostForModal.auctionEndDate && (
                        <div><span className="admin-modal-metric-label">สิ้นสุดประมูล</span><span>{formatDate(previewPostForModal.auctionEndDate as any)}</span></div>
                      )}
                      {previewPostForModal.postType === 'auction' && previewPostForModal.auctionStatus && (
                        <div><span className="admin-modal-metric-label">สถานะประมูล</span><span>{previewPostForModal.auctionStatus}</span></div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {modalAction !== 'bulkRejected' && selectedPost && (
              <div className="admin-modal-preview">
                <div className="admin-modal-preview-card">
                  <div className="admin-modal-preview-images">
                    {normalizeImages(selectedPost.images).slice(0, 3).map((img, idx) => (
                      <img key={`${selectedPost.id}-modal-thumb-${idx}`} src={img} alt="" className="admin-modal-thumb" />
                    ))}
                  </div>
                  <div className="admin-modal-preview-head">
                    <div className="admin-modal-preview-title">
                      {selectedPost.title}
                      {getPostTypeBadge(selectedPost.postType, selectedPost.saleType ?? null)}
                      {getStatusBadge(selectedPost.status)}
                    </div>
                    <div className="text-muted small">ผู้ขาย: {selectedPost.sellerName}</div>
                  </div>
                  <div className="admin-modal-preview-desc">{selectedPost.description}</div>
                  <div className="admin-modal-metrics">
                    <div><span className="admin-modal-metric-label">ราคา</span><span>{formatPrice(selectedPost.price)}</span></div>
                    {selectedPost.cardCount != null && (
                      <div><span className="admin-modal-metric-label">จำนวนการ์ด</span><span>{selectedPost.cardCount}</span></div>
                    )}
                    {selectedPost.availableQuantity != null && (
                      <div><span className="admin-modal-metric-label">จำนวนที่มี</span><span>{selectedPost.availableQuantity}</span></div>
                    )}
                    {selectedPost.postType === 'auction' && selectedPost.auctionEndDate && (
                      <div><span className="admin-modal-metric-label">สิ้นสุดประมูล</span><span>{formatDate(selectedPost.auctionEndDate as any)}</span></div>
                    )}
                    {selectedPost.postType === 'auction' && selectedPost.auctionStatus && (
                      <div><span className="admin-modal-metric-label">สถานะประมูล</span><span>{selectedPost.auctionStatus}</span></div>
                    )}
                    {selectedPost.postType === 'auction' && selectedPost.startingBid != null && (
                      <div><span className="admin-modal-metric-label">ตั้งต้น</span><span>{formatPrice(selectedPost.startingBid as any)}</span></div>
                    )}
                    {selectedPost.postType === 'auction' && selectedPost.currentBid != null && (
                      <div><span className="admin-modal-metric-label">ยอดปัจจุบัน</span><span>{formatPrice(selectedPost.currentBid as any)}</span></div>
                    )}
                    {selectedPost.postType === 'sale' && selectedPost.saleType && selectedPost.individualPrice != null && (
                      <div><span className="admin-modal-metric-label">ราคา/ใบ</span><span>{formatPrice(selectedPost.individualPrice as any)}</span></div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="admin-modal-reason-group">
              <label className="admin-modal-reason-label">
                <i className="fas fa-comment-alt me-2" aria-hidden />
                เหตุผล <span className="admin-modal-reason-optional">(ไม่บังคับ)</span>
              </label>
              <Form.Control
                as="textarea"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="ระบุเหตุผลเพื่อแจ้งให้ผู้ขายทราบ..."
                className="admin-modal-reason-textarea"
              />
            </div>
          </Modal.Body>
          <Modal.Footer className="admin-modal-footer-actions">
            <button type="button" className="admin-modal-btn-cancel" onClick={() => setShowModal(false)}>
              <i className="fas fa-arrow-left me-2" aria-hidden />
              ยกเลิก
            </button>
            <button
              type="button"
              className={`admin-modal-btn-confirm admin-modal-btn-confirm--${modalAction === 'active' ? 'approve' : 'danger'}`}
              onClick={handleActionConfirm}
            >
              {modalAction === 'delete' && <i className="fas fa-trash-alt me-2" aria-hidden />}
              {modalAction === 'active' && <i className="fas fa-check me-2" aria-hidden />}
              {(modalAction === 'rejected' || modalAction === 'bulkRejected') && <i className="fas fa-ban me-2" aria-hidden />}
              {modalAction === 'delete'
                ? 'ลบโพสต์'
                : modalAction === 'active'
                  ? 'อนุมัติโพสต์'
                  : modalAction === 'bulkRejected'
                    ? `ปฏิเสธ ${bulkPostIds.length} รายการ`
                    : 'ปฏิเสธโพสต์'}
            </button>
          </Modal.Footer>
        </Modal>
      </Container>
    </div>
  );
};

export default AdminDashboard;


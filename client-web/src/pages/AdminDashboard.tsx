import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col, Card, Table, Button, Badge, Modal, Form } from 'react-bootstrap';
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

const AdminDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'posts' | 'users'>('dashboard');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectedPost, setSelectedPost] = useState<AdminPost | null>(null);
  const [modalAction, setModalAction] = useState<'delete' | 'active' | 'rejected' | ''>('');
  const [reason, setReason] = useState<string>('');

  useEffect(() => {
    if (userProfile?.isAdmin) {
      fetchDashboardData();
    }
  }, [userProfile]);

  const fetchDashboardData = async (): Promise<void> => {
    try {
      setLoading(true);
      const [statsResponse, postsResponse, usersResponse] = await Promise.all([
        axios.get('/api/admin/stats'),
        axios.get('/api/admin/posts'),
        axios.get('/api/admin/users')
      ]);

      setStats(statsResponse.data);
      setPosts(Array.isArray(postsResponse.data?.posts) ? postsResponse.data.posts : []);
      setUsers(Array.isArray(usersResponse.data?.users) ? usersResponse.data.users : []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handlePostAction = (post: AdminPost, action: 'delete' | 'active' | 'rejected'): void => {
    setSelectedPost(post);
    setModalAction(action);
    setShowModal(true);
  };

  const handleActionConfirm = async (): Promise<void> => {
    if (!selectedPost) return;

    try {
      if (modalAction === 'delete') {
        await axios.delete(`/api/admin/posts/${selectedPost.id}`, {
          data: { reason }
        });
        setPosts(posts.filter(post => post.id !== selectedPost.id));
        toast.success('ลบโพสต์สำเร็จ');
      } else if (modalAction === 'active' || modalAction === 'rejected') {
        await axios.put(`/api/admin/posts/${selectedPost.id}/status`, {
          status: modalAction,
          reason
        });
        setPosts(posts.map(post => 
          post.id === selectedPost.id 
            ? { ...post, status: modalAction as PostStatus }
            : post
        ));
        toast.success(`โพสต์${modalAction === 'active' ? 'อนุมัติ' : 'ปฏิเสธ'}สำเร็จ`);
      }
      
      setShowModal(false);
      setSelectedPost(null);
      setReason('');
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

  if (!userProfile?.isAdmin) {
    return (
      <div className="admin-dashboard-page">
        <Container className="py-5">
          <div className="admin-denied-card">
            <div className="admin-denied-icon" aria-hidden><i className="fas fa-lock" /></div>
            <h5 className="mb-2">ไม่มีสิทธิ์เข้าถึง</h5>
            <p className="text-muted mb-0">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
          </div>
        </Container>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="admin-dashboard-page">
        <div className="admin-loading-wrap" aria-live="polite" aria-busy="true">
          <div className="spinner-border admin-loading-spinner" role="status">
            <span className="visually-hidden">กำลังโหลด...</span>
          </div>
          <p className="admin-loading-text">กำลังโหลดแดชบอร์ด...</p>
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
              แดชบอร์ดแอดมิน
            </h2>
            <p className="admin-dashboard-header-desc">จัดการระบบและผู้ใช้งาน</p>
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
              <Card className="admin-stat-card text-center">
                <Card.Body>
                  <h3 className="admin-stat-value admin-stat-value--posts">{stats.totalPosts}</h3>
                  <p className="admin-stat-label">โพสต์ทั้งหมด</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={3} className="mb-4">
              <Card className="admin-stat-card text-center">
                <Card.Body>
                  <h3 className="admin-stat-value admin-stat-value--active">{stats.activePosts}</h3>
                  <p className="admin-stat-label">โพสต์ที่เผยแพร่</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={3} className="mb-4">
              <Card className="admin-stat-card text-center">
                <Card.Body>
                  <h3 className="admin-stat-value admin-stat-value--users">{stats.totalUsers}</h3>
                  <p className="admin-stat-label">ผู้ใช้ทั้งหมด</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={3} className="mb-4">
              <Card className="admin-stat-card text-center">
                <Card.Body>
                  <h3 className="admin-stat-value admin-stat-value--recent">{stats.recentPosts}</h3>
                  <p className="admin-stat-label">โพสต์ใหม่ (7 วัน)</p>
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
                      <div>
                        <Link
                          to={`/post/${post.id}`}
                          className="text-decoration-none fw-bold"
                          style={{ color: 'var(--bright-teal-blue)' }}
                        >
                          {post.title}
                        </Link>
                        <br />
                        <small className="text-muted">{post.category}</small>
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
          </Card.Body>
        </Card>
      )}

        {activeTab === 'users' && (
          <Card className="admin-section-card mb-4">
            <Card.Header className="admin-section-header">
              <i className="fas fa-users" aria-hidden />จัดการผู้ใช้
            </Card.Header>
            <Card.Body className="admin-section-body">
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
                      ) : user.isAdmin ? (
                        <Badge bg="danger">แอดมิน</Badge>
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
          </Card.Body>
        </Card>
      )}

        <Modal show={showModal} onHide={() => setShowModal(false)} centered className="admin-modal">
          <Modal.Header closeButton>
            <Modal.Title>
              {modalAction === 'delete' && <i className="fas fa-trash-alt me-2" aria-hidden />}
              {modalAction === 'active' && <i className="fas fa-check-circle me-2" aria-hidden />}
              {modalAction === 'rejected' && <i className="fas fa-times-circle me-2" aria-hidden />}
              {modalAction === 'delete' ? 'ยืนยันการลบ' : modalAction === 'active' ? 'ยืนยันการอนุมัติ' : 'ยืนยันการปฏิเสธ'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>
              {modalAction === 'delete' ? 'คุณแน่ใจหรือไม่ที่จะลบโพสต์นี้?' :
               modalAction === 'active' ? 'คุณแน่ใจหรือไม่ที่จะอนุมัติโพสต์นี้?' :
               'คุณแน่ใจหรือไม่ที่จะปฏิเสธโพสต์นี้?'}
            </p>
            {selectedPost && (
              <div className="mb-3 p-3 rounded" style={{ background: 'var(--gray-100)' }}>
                <strong>การ์ด:</strong> {selectedPost.title}
                <br />
                <strong>ผู้ขาย:</strong> {selectedPost.sellerName}
              </div>
            )}
            <Form.Group>
              <Form.Label>เหตุผล (ไม่บังคับ)</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="ระบุเหตุผล..."
                className="form-control-sakura"
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <SecondaryActionButton onClick={() => setShowModal(false)} icon={<i className="fas fa-times" />}>
              ยกเลิก
            </SecondaryActionButton>
            <Button
              className={modalAction === 'active' ? 'btn-tcg-primary' : 'btn-tcg-outline'}
              variant={modalAction === 'delete' ? 'danger' : undefined}
              onClick={handleActionConfirm}
            >
              {modalAction === 'delete' && <i className="fas fa-trash-alt me-1" aria-hidden />}
              {modalAction === 'active' && <i className="fas fa-check me-1" aria-hidden />}
              {modalAction === 'rejected' && <i className="fas fa-times me-1" aria-hidden />}
              {modalAction === 'delete' ? 'ลบ' : modalAction === 'active' ? 'อนุมัติ' : 'ปฏิเสธ'}
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </div>
  );
};

export default AdminDashboard;


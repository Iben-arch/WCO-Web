import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col, Card, Table, Button, Badge, Modal, Form, Alert } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import axios from '../utils/axiosInterceptor';
import { toast } from 'react-toastify';
import { AdminStats, Post, PostStatus, UserProfile } from '../types';

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
      <Container className="py-5">
        <Alert variant="danger">
          <Alert.Heading>ไม่มีสิทธิ์เข้าถึง</Alert.Heading>
          <p>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container className="py-5">
        <div className="d-flex justify-content-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <Row className="mb-5">
        <Col>
          <div style={{
            background: 'linear-gradient(135deg, var(--deep-twilight) 0%, var(--french-blue) 25%, var(--bright-teal-blue) 50%, var(--turquoise-surf) 75%, var(--sky-aqua) 100%)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            color: 'var(--text-light)',
            boxShadow: 'var(--shadow-lg)',
            marginBottom: '2rem'
          }}>
            <h2 style={{
              fontSize: '2.5rem',
              fontWeight: '700',
              margin: 0,
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }}>🛠️ แดชบอร์ดแอดมิน</h2>
            <p style={{
              fontSize: '1.1rem',
              opacity: 0.95,
              margin: '0.5rem 0 0 0'
            }}>จัดการระบบและผู้ใช้งาน</p>
          </div>
        </Col>
      </Row>

      {/* Navigation Tabs */}
      <Row className="mb-4">
        <Col>
          <div className="btn-group" role="group">
            <Button
              className={activeTab === 'dashboard' ? 'btn-tcg-primary' : 'btn-tcg-outline'}
              onClick={() => setActiveTab('dashboard')}
            >
              สถิติ
            </Button>
            <Button
              className={activeTab === 'posts' ? 'btn-tcg-primary' : 'btn-tcg-outline'}
              onClick={() => setActiveTab('posts')}
            >
              จัดการโพสต์
            </Button>
            <Button
              className={activeTab === 'users' ? 'btn-tcg-primary' : 'btn-tcg-outline'}
              onClick={() => setActiveTab('users')}
            >
              จัดการผู้ใช้
            </Button>
          </div>
        </Col>
      </Row>

      {/* Dashboard Stats */}
      {activeTab === 'dashboard' && stats && (
        <Row className="mb-4">
          <Col md={3} className="mb-4">
            <Card className="text-center" style={{
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-md)',
              transition: 'all var(--transition-base)',
              height: '100%'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = 'var(--shadow-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}>
              <Card.Body style={{ padding: '2rem 1rem' }}>
                <h3 style={{
                  fontSize: '2.5rem',
                  fontWeight: '700',
                  color: 'var(--bright-teal-blue)',
                  marginBottom: '0.5rem'
                }}>{stats.totalPosts}</h3>
                <p className="mb-0" style={{
                  color: 'var(--text-secondary)',
                  fontSize: '1rem',
                  fontWeight: '500'
                }}>โพสต์ทั้งหมด</p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3} className="mb-4">
            <Card className="text-center" style={{
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-md)',
              transition: 'all var(--transition-base)',
              height: '100%'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = 'var(--shadow-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}>
              <Card.Body style={{ padding: '2rem 1rem' }}>
                <h3 style={{
                  fontSize: '2.5rem',
                  fontWeight: '700',
                  color: 'var(--success)',
                  marginBottom: '0.5rem'
                }}>{stats.activePosts}</h3>
                <p className="mb-0" style={{
                  color: 'var(--text-secondary)',
                  fontSize: '1rem',
                  fontWeight: '500'
                }}>โพสต์ที่เผยแพร่</p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3} className="mb-4">
            <Card className="text-center" style={{
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-md)',
              transition: 'all var(--transition-base)',
              height: '100%'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = 'var(--shadow-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}>
              <Card.Body style={{ padding: '2rem 1rem' }}>
                <h3 style={{
                  fontSize: '2.5rem',
                  fontWeight: '700',
                  color: 'var(--info)',
                  marginBottom: '0.5rem'
                }}>{stats.totalUsers}</h3>
                <p className="mb-0" style={{
                  color: 'var(--text-secondary)',
                  fontSize: '1rem',
                  fontWeight: '500'
                }}>ผู้ใช้ทั้งหมด</p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3} className="mb-4">
            <Card className="text-center" style={{
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-md)',
              transition: 'all var(--transition-base)',
              height: '100%'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = 'var(--shadow-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}>
              <Card.Body style={{ padding: '2rem 1rem' }}>
                <h3 style={{
                  fontSize: '2.5rem',
                  fontWeight: '700',
                  color: 'var(--warning)',
                  marginBottom: '0.5rem'
                }}>{stats.recentPosts}</h3>
                <p className="mb-0" style={{
                  color: 'var(--text-secondary)',
                  fontSize: '1rem',
                  fontWeight: '500'
                }}>โพสต์ใหม่ (7 วัน)</p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Posts Management */}
      {activeTab === 'posts' && (
        <Card style={{
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)'
        }}>
          <Card.Header style={{
            background: 'linear-gradient(135deg, var(--deep-twilight) 0%, var(--french-blue) 25%, var(--bright-teal-blue) 50%, var(--turquoise-surf) 75%, var(--sky-aqua) 100%)',
            color: 'var(--text-light)',
            border: 'none',
            borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
            padding: '1.25rem 1.5rem'
          }}>
            <h5 className="mb-0" style={{ fontWeight: '600', fontSize: '1.25rem' }}>จัดการโพสต์</h5>
          </Card.Header>
          <Card.Body style={{ padding: '1.5rem' }}>
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
                          className="btn btn-sm btn-outline-primary btn-tcg-sm"
                        >
                          ดูรายละเอียด
                        </Link>
                        <Button
                          size="sm"
                          variant="success"
                          className="btn-tcg-sm"
                          onClick={() => handlePostAction(post, 'active')}
                        >
                          อนุมัติ
                        </Button>
                        <Button
                          size="sm"
                          variant="warning"
                          className="btn-tcg-sm"
                          onClick={() => handlePostAction(post, 'rejected')}
                        >
                          ปฏิเสธ
                        </Button>
                        <Button
                          size="sm"
                          className="btn-tcg-outline btn-tcg-sm"
                          onClick={() => handlePostAction(post, 'delete')}
                        >
                          ลบ
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

      {/* Users Management */}
      {activeTab === 'users' && (
        <Card style={{
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)'
        }}>
          <Card.Header style={{
            background: 'linear-gradient(135deg, var(--deep-twilight) 0%, var(--french-blue) 25%, var(--bright-teal-blue) 50%, var(--turquoise-surf) 75%, var(--sky-aqua) 100%)',
            color: 'var(--text-light)',
            border: 'none',
            borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
            padding: '1.25rem 1.5rem'
          }}>
            <h5 className="mb-0" style={{ fontWeight: '600', fontSize: '1.25rem' }}>จัดการผู้ใช้</h5>
          </Card.Header>
          <Card.Body style={{ padding: '1.5rem' }}>
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

      {/* Action Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            {modalAction === 'delete' ? 'ยืนยันการลบ' : 
             modalAction === 'active' ? 'ยืนยันการอนุมัติ' : 'ยืนยันการปฏิเสธ'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            {modalAction === 'delete' ? 'คุณแน่ใจหรือไม่ที่จะลบโพสต์นี้?' :
             modalAction === 'active' ? 'คุณแน่ใจหรือไม่ที่จะอนุมัติโพสต์นี้?' :
             'คุณแน่ใจหรือไม่ที่จะปฏิเสธโพสต์นี้?'}
          </p>
          {selectedPost && (
            <div className="mb-3">
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
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            ยกเลิก
          </Button>
          <Button
            className={modalAction === 'delete' ? 'btn-tcg-outline' : 
                    modalAction === 'active' ? 'btn-tcg-primary' : 'btn-tcg-outline'}
            onClick={handleActionConfirm}
          >
            {modalAction === 'delete' ? 'ลบ' :
             modalAction === 'active' ? 'อนุมัติ' : 'ปฏิเสธ'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default AdminDashboard;


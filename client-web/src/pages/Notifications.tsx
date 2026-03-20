import React, { useState, useEffect } from 'react';
import { Container, Card, Spinner, Badge, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { notificationsAPI, NotificationItem, emitNotificationsChanged } from '../api/api';

const Notifications: React.FC = () => {
  const { currentUser } = useAuth();
  const [list, setList] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!currentUser) return;
    const load = async (): Promise<void> => {
      setLoading(true);
      try {
        const data = await notificationsAPI.getMyNotifications();
        setList(data ?? []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser]);

  const handleMarkAsRead = async (item: NotificationItem): Promise<void> => {
    if (item.readAt) return;
    const ok = await notificationsAPI.markAsRead(item.id);
    if (ok) {
      setList(prev => prev.map(n => n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n));
      emitNotificationsChanged();
    }
  };

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return '—';
    }
  };

  if (!currentUser) {
    return (
      <Container className="py-5">
        <p className="text-muted">กรุณาเข้าสู่ระบบเพื่อดูการแจ้งเตือน</p>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <h2 className="mb-4">
        <i className="fas fa-bell me-2" aria-hidden />
        การแจ้งเตือน
      </h2>
      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
        </div>
      ) : list.length === 0 ? (
        <Card className="shadow-sm">
          <Card.Body className="text-center text-muted py-5">
            <i className="fas fa-bell-slash fa-3x mb-3" aria-hidden />
            <p className="mb-0">ยังไม่มีการแจ้งเตือน</p>
          </Card.Body>
        </Card>
      ) : (
        <div className="d-flex flex-column gap-3">
          {list.map((item) => (
            <Card
              key={item.id}
              className={`shadow-sm ${item.readAt ? '' : 'border-primary notification-card-unread'}`}
              style={item.readAt ? {} : { borderWidth: 1 }}
              role={item.readAt ? undefined : 'button'}
              tabIndex={item.readAt ? undefined : 0}
              onClick={() => {
                if (!item.readAt) void handleMarkAsRead(item);
              }}
              onKeyDown={(e) => {
                if (item.readAt) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void handleMarkAsRead(item);
                }
              }}
            >
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <h6 className="mb-1">
                        {item.type === 'post_rejected' && (
                          <i className="fas fa-times-circle text-danger me-1" aria-hidden />
                        )}
                        {item.title}
                      </h6>
                      {!item.readAt && (
                        <Badge bg="primary">ใหม่</Badge>
                      )}
                    </div>
                    <p className="text-muted small mb-1">{formatDate(item.createdAt)}</p>
                    {item.message && <p className="mb-0">{item.message}</p>}
                    {item.postId && (
                      <Link
                        to={`/post/${item.postId}`}
                        className="btn btn-outline-primary btn-sm mt-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!item.readAt) void handleMarkAsRead(item);
                        }}
                      >
                        ดูโพสต์
                      </Link>
                    )}
                  </div>
                  {!item.readAt && (
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleMarkAsRead(item);
                      }}
                    >
                      ทำเครื่องหมายว่าอ่านแล้ว
                    </Button>
                  )}
                </div>
              </Card.Body>
            </Card>
          ))}
        </div>
      )}
    </Container>
  );
};

export default Notifications;

import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const ProfileButton: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const handleClick = (): void => {
    navigate('/profile');
  };

  const profileImage = userProfile?.profileImage || userProfile?.photoURL;
  const displayName = userProfile?.displayName || 'ผู้ใช้';
  const initials = displayName.trim().charAt(0).toUpperCase();

  return (
    <button
      type="button"
      className="profile-button-navbar"
      onClick={handleClick}
      title="ไปที่โปรไฟล์"
      aria-label={`โปรไฟล์ของ ${displayName}`}
    >
      <div className="profile-button-content">
        <div className="profile-button-avatar">
          {profileImage ? (
            <img
              src={profileImage}
              alt={displayName}
              className="profile-button-image"
            />
          ) : (
            <div className="profile-button-placeholder" aria-hidden>
              <div className="profile-button-placeholder-icon">
                {initials}
              </div>
            </div>
          )}
        </div>
        <div className="profile-button-text">
          {displayName}
        </div>
      </div>
    </button>
  );
};

export default ProfileButton;


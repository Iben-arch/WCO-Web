import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const ProfileButton: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const handleClick = (): void => {
    navigate('/profile');
  };

  return (
    <button 
      className="profile-button-navbar"
      onClick={handleClick}
      title="ไปที่โปรไฟล์"
    >
      <div className="profile-button-content">
        <div className="profile-button-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20.59 22C20.59 18.13 16.74 15 12 15C7.26 15 3.41 18.13 3.41 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="profile-button-text">
          {userProfile?.displayName || currentUser?.displayName || 'ผู้ใช้'}
        </div>
      </div>
    </button>
  );
};

export default ProfileButton;


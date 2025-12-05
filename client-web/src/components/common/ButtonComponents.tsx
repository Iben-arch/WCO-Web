import React, { ReactNode } from 'react';
import { Button as BootstrapButton } from 'react-bootstrap';

// TCG Thailand Inspired Button Components

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';
type IconPosition = 'left' | 'right';
type BadgeVariant = 'danger' | 'warning' | 'info' | 'success' | 'primary' | 'secondary';

interface TCGButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode | null;
  iconPosition?: IconPosition;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
  [key: string]: any;
}

export const TCGButton: React.FC<TCGButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  icon = null, 
  iconPosition = 'left',
  loading = false,
  disabled = false,
  className = '',
  onClick,
  type = 'button',
  fullWidth = false,
  ...props 
}) => {
  const baseClasses = 'btn-tcg';
  const variantClasses: { [key: string]: string } = {
    primary: 'btn-tcg-primary',
    secondary: 'btn-tcg-secondary',
    success: 'btn-tcg-success',
    danger: 'btn-tcg-danger',
    warning: 'btn-tcg-warning',
    info: 'btn-tcg-info',
    outline: 'btn-tcg-outline',
    ghost: 'btn-tcg-ghost'
  };
  
  const sizeClasses: { [key: string]: string } = {
    sm: 'btn-tcg-sm',
    md: 'btn-tcg-md',
    lg: 'btn-tcg-lg',
    xl: 'btn-tcg-xl'
  };

  const buttonClasses = [
    baseClasses,
    variantClasses[variant] || variantClasses.primary,
    sizeClasses[size] || sizeClasses.md,
    fullWidth ? 'btn-tcg-full-width' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <BootstrapButton
      className={buttonClasses}
      disabled={disabled || loading}
      onClick={onClick}
      type={type}
      {...props}
    >
      {loading && (
        <span className="btn-tcg-spinner me-2">
          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        </span>
      )}
      {!loading && icon && iconPosition === 'left' && (
        <span className="btn-tcg-icon me-2">{icon}</span>
      )}
      <span className="btn-tcg-text">{children}</span>
      {!loading && icon && iconPosition === 'right' && (
        <span className="btn-tcg-icon ms-2">{icon}</span>
      )}
    </BootstrapButton>
  );
};

interface PrimaryActionButtonProps {
  children: ReactNode;
  icon?: ReactNode;
  [key: string]: any;
}

// Primary Action Button (Add to Cart, Buy Now, etc.)
export const PrimaryActionButton: React.FC<PrimaryActionButtonProps> = ({ children, icon = '🛒', ...props }) => (
  <TCGButton 
    variant="primary" 
    size="lg" 
    icon={icon}
    fullWidth
    {...props}
  >
    {children}
  </TCGButton>
);

interface SecondaryActionButtonProps {
  children: ReactNode;
  icon?: ReactNode;
  [key: string]: any;
}

// Secondary Action Button (Add to Wishlist, Compare, etc.)
export const SecondaryActionButton: React.FC<SecondaryActionButtonProps> = ({ children, icon = '❤️', ...props }) => (
  <TCGButton 
    variant="outline" 
    size="md" 
    icon={icon}
    {...props}
  >
    {children}
  </TCGButton>
);

interface CategoryButtonProps {
  children: ReactNode;
  active?: boolean;
  onClick?: (category: string) => void;
  category?: string;
  [key: string]: any;
}

// Category Filter Button
export const CategoryButton: React.FC<CategoryButtonProps> = ({ 
  children, 
  active = false, 
  onClick,
  category = '',
  ...props 
}) => (
  <TCGButton
    variant={active ? 'primary' : 'ghost'}
    size="sm"
    className={`category-filter-btn ${active ? 'active' : ''}`}
    onClick={() => onClick && onClick(category)}
    {...props}
  >
    {children}
  </TCGButton>
);

interface SearchButtonProps {
  loading?: boolean;
  [key: string]: any;
}

// Search Button
export const SearchButton: React.FC<SearchButtonProps> = ({ loading = false, ...props }) => (
  <TCGButton
    variant="primary"
    size="md"
    icon="🔍"
    loading={loading}
    {...props}
  >
    ค้นหา
  </TCGButton>
);

interface ActionButtonGroupProps {
  onViewDetails?: () => void;
  onAddToCart?: () => void;
  onAddToWishlist?: () => void;
  loading?: boolean;
  disabled?: boolean;
}

// Action Button Group (for product cards)
export const ActionButtonGroup: React.FC<ActionButtonGroupProps> = ({ 
  onViewDetails, 
  onAddToCart, 
  onAddToWishlist,
  loading = false,
  disabled = false 
}) => (
  <div className="action-button-group">
    <div className="primary-actions">
      <PrimaryActionButton 
        onClick={onAddToCart}
        loading={loading}
        disabled={disabled}
      >
        เพิ่มลงตะกร้า
      </PrimaryActionButton>
    </div>
    <div className="secondary-actions">
      <SecondaryActionButton 
        onClick={onViewDetails}
        disabled={disabled}
      >
        ดูรายละเอียด
      </SecondaryActionButton>
      <SecondaryActionButton 
        onClick={onAddToWishlist}
        disabled={disabled}
        icon="❤️"
      >
        รายการโปรด
      </SecondaryActionButton>
    </div>
  </div>
);

interface FloatingActionButtonProps {
  children: ReactNode;
  icon?: ReactNode;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  onClick?: () => void;
  [key: string]: any;
}

// Floating Action Button (for mobile)
export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ 
  children, 
  icon, 
  position = 'bottom-right',
  onClick,
  ...props 
}) => (
  <TCGButton
    variant="primary"
    size="xl"
    icon={icon}
    className={`fab fab-${position}`}
    onClick={onClick}
    {...props}
  >
    {children}
  </TCGButton>
);

interface QuickActionButtonsProps {
  onQuickBuy?: () => void;
  onQuickView?: () => void;
  onShare?: () => void;
  disabled?: boolean;
}

// Quick Action Buttons (for product quick actions)
export const QuickActionButtons: React.FC<QuickActionButtonsProps> = ({ 
  onQuickBuy, 
  onQuickView, 
  onShare,
  disabled = false 
}) => (
  <div className="quick-action-buttons">
    <TCGButton
      variant="primary"
      size="sm"
      icon="⚡"
      onClick={onQuickBuy}
      disabled={disabled}
    >
      ซื้อด่วน
    </TCGButton>
    <TCGButton
      variant="outline"
      size="sm"
      icon="👁️"
      onClick={onQuickView}
      disabled={disabled}
    >
      ดูด่วน
    </TCGButton>
    <TCGButton
      variant="ghost"
      size="sm"
      icon="📤"
      onClick={onShare}
      disabled={disabled}
    >
      แชร์
    </TCGButton>
  </div>
);

interface ButtonWithBadgeProps {
  children: ReactNode;
  badge?: ReactNode | null;
  badgeVariant?: BadgeVariant;
  [key: string]: any;
}

// Button with Badge (for notifications, counts, etc.)
export const ButtonWithBadge: React.FC<ButtonWithBadgeProps> = ({ 
  children, 
  badge = null, 
  badgeVariant = 'danger',
  ...props 
}) => (
  <div className="btn-with-badge">
    <TCGButton {...props}>
      {children}
    </TCGButton>
    {badge && (
      <span className={`badge badge-${badgeVariant} btn-badge`}>
        {badge}
      </span>
    )}
  </div>
);

export default TCGButton;


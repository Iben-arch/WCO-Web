import React, { ReactNode } from 'react';
import { Button as BootstrapButton } from 'react-bootstrap';
import '../../styles/button-components.css';

// TCG Thailand — Button set (design tokens from index.css)

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

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'btn-tcg-primary',
  secondary: 'btn-tcg-secondary',
  success: 'btn-tcg-success',
  danger: 'btn-tcg-danger',
  warning: 'btn-tcg-warning',
  info: 'btn-tcg-info',
  outline: 'btn-tcg-outline',
  ghost: 'btn-tcg-ghost'
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'btn-tcg-sm',
  md: 'btn-tcg-md',
  lg: 'btn-tcg-lg',
  xl: 'btn-tcg-xl'
};

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
  const buttonClasses = [
    'btn-tcg',
    VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.primary,
    SIZE_CLASSES[size] ?? SIZE_CLASSES.md,
    fullWidth ? 'btn-tcg-full-width' : '',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <BootstrapButton
      className={buttonClasses}
      disabled={disabled || loading}
      onClick={onClick}
      type={type}
      aria-busy={loading}
      {...props}
    >
      {loading && (
        <span className="btn-tcg-spinner me-2" aria-hidden>
          <span className="spinner-border spinner-border-sm" role="status" aria-label="กำลังโหลด" />
        </span>
      )}
      {!loading && icon && iconPosition === 'left' && (
        <span className="btn-tcg-icon me-2" aria-hidden>{icon}</span>
      )}
      <span className="btn-tcg-text">{children}</span>
      {!loading && icon && iconPosition === 'right' && (
        <span className="btn-tcg-icon ms-2" aria-hidden>{icon}</span>
      )}
    </BootstrapButton>
  );
};

interface PrimaryActionButtonProps {
  children: ReactNode;
  icon?: ReactNode;
  [key: string]: any;
}

const defaultPrimaryIcon = <i className="fas fa-cart-plus" />;

export const PrimaryActionButton: React.FC<PrimaryActionButtonProps> = ({
  children,
  icon = defaultPrimaryIcon,
  ...props
}) => (
  <TCGButton variant="primary" size="lg" icon={icon} fullWidth {...props}>
    {children}
  </TCGButton>
);

interface SecondaryActionButtonProps {
  children: ReactNode;
  icon?: ReactNode;
  [key: string]: any;
}

const defaultSecondaryIcon = <i className="fas fa-heart" />;

export const SecondaryActionButton: React.FC<SecondaryActionButtonProps> = ({
  children,
  icon = defaultSecondaryIcon,
  ...props
}) => (
  <TCGButton variant="outline" size="md" icon={icon} {...props}>
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
    className={`tcg-category-btn ${active ? 'tcg-category-btn--active' : ''}`}
    onClick={() => onClick?.(category)}
    aria-pressed={active}
    {...props}
  >
    {children}
  </TCGButton>
);

interface SearchButtonProps {
  loading?: boolean;
  [key: string]: any;
}

const searchIcon = <i className="fas fa-search" />;

export const SearchButton: React.FC<SearchButtonProps> = ({ loading = false, ...props }) => (
  <TCGButton variant="primary" size="md" icon={searchIcon} loading={loading} {...props}>
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

export const ActionButtonGroup: React.FC<ActionButtonGroupProps> = ({
  onViewDetails,
  onAddToCart,
  onAddToWishlist,
  loading = false,
  disabled = false
}) => (
  <div className="tcg-action-group">
    <div className="tcg-action-group__primary">
      <PrimaryActionButton onClick={onAddToCart} loading={loading} disabled={disabled}>
        เพิ่มลงตะกร้า
      </PrimaryActionButton>
    </div>
    <div className="tcg-action-group__secondary">
      <SecondaryActionButton onClick={onViewDetails} disabled={disabled} icon={<i className="fas fa-eye" />}>
        ดูรายละเอียด
      </SecondaryActionButton>
      <SecondaryActionButton onClick={onAddToWishlist} disabled={disabled}>
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
    className={`tcg-fab tcg-fab--${position}`}
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

export const QuickActionButtons: React.FC<QuickActionButtonsProps> = ({
  onQuickBuy,
  onQuickView,
  onShare,
  disabled = false
}) => (
  <div className="tcg-quick-actions">
    <TCGButton
      variant="primary"
      size="sm"
      icon={<i className="fas fa-bolt" />}
      onClick={onQuickBuy}
      disabled={disabled}
    >
      ซื้อด่วน
    </TCGButton>
    <TCGButton
      variant="outline"
      size="sm"
      icon={<i className="fas fa-eye" />}
      onClick={onQuickView}
      disabled={disabled}
    >
      ดูด่วน
    </TCGButton>
    <TCGButton
      variant="ghost"
      size="sm"
      icon={<i className="fas fa-share-alt" />}
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

export const ButtonWithBadge: React.FC<ButtonWithBadgeProps> = ({
  children,
  badge = null,
  badgeVariant = 'danger',
  ...props
}) => (
  <div className="tcg-btn-badge-wrap">
    <TCGButton {...props}>{children}</TCGButton>
    {badge != null && (
      <span className={`tcg-btn-badge tcg-btn-badge--${badgeVariant}`} aria-hidden>
        {badge}
      </span>
    )}
  </div>
);

export default TCGButton;


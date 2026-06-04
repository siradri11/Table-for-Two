import './Button.css'

export function Button({
  children,
  variant = 'primary',
  type = 'button',
  className = '',
  fullWidth,
  disabled,
  ...props
}) {
  return (
    <button
      type={type}
      className={`btn btn--${variant} ${fullWidth ? 'btn--full' : ''} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}

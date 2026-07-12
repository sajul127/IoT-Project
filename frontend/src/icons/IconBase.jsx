export function IconBase({ children, className = '' }) {
  return (
    <svg
      className={`block h-6 w-6 fill-current text-current ${className}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

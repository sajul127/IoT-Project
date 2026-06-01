export function IconBase({ children, className = '' }) {
  return (
    <svg className={`icon ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  )
}

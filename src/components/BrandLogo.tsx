export function BrandLogo({ className = '', eager = false }: { className?: string; eager?: boolean }) {
  return <img className={`official-logo ${className}`} src="/assets/logo-casa-apero.jpg" alt="Officieel logo Casa Apero" width={1254} height={1254} loading={eager ? 'eager' : 'lazy'} decoding="async" />;
}

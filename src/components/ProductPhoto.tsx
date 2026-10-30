import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { ProductImage } from '../data/catalogue';

export function ProductPhoto({ photo, eager = false, sizes }: { photo: ProductImage; eager?: boolean; sizes?: string }) {
  const [failed, setFailed] = useState(false);
  const responsive=/^\/assets\/products\/[-a-z0-9]+\.webp$/.test(photo.src);
  return <div className={`product-photo crop-${photo.crop ?? 'none'}${!photo.isPlaceholder ? ' product-photo-official' : ''}`}>
    {failed ? <span className="image-fallback"><ImageOff aria-hidden="true" />Productfoto niet beschikbaar</span> :
      <img src={photo.src} srcSet={responsive ? `${photo.src.replace('.webp','-480.webp')} 480w, ${photo.src} 960w` : undefined} sizes={responsive ? sizes ?? (eager ? '(min-width: 768px) 50vw, 100vw' : '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw') : undefined} alt={photo.alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} />}
    {photo.isPlaceholder && <span className="photo-label">Tijdelijk sfeerbeeld · productfoto volgt</span>}
  </div>;
}

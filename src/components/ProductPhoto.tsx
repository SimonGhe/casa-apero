import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { ProductImage } from '../data/catalogue';

export function ProductPhoto({ photo, eager = false }: { photo: ProductImage; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <div className={`product-photo crop-${photo.crop ?? 'none'}`}>
    {failed ? <span className="image-fallback"><ImageOff aria-hidden="true" />Productfoto volgt</span> :
      <img src={photo.src} alt={photo.alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} />}
    {photo.isPlaceholder && <span className="photo-label">Tijdelijk sfeerbeeld · productfoto volgt</span>}
  </div>;
}

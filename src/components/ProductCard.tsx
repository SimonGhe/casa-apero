import {useCatalogue} from '../context/CatalogueContext';
import { ArrowUpRight, Pause } from 'lucide-react';
import { Link } from 'react-router-dom';
import { money } from '../data/catalogue';
import type { Product } from '../data/catalogue';
import { ProductPhoto } from './ProductPhoto';

export function ProductCard({ product }: { product: Product }) {
  const {shopSettings}=useCatalogue();
  const paused = product.ordersPaused || shopSettings.ordersPaused;
  return <article className="product-card">
    <Link className="product-image-link" to={`/product/${product.slug}`} aria-label={`Bekijk ${product.name}`}>
      <ProductPhoto photo={product.images[0]} />
      <span className={`product-badge ${paused ? 'paused' : ''}`}>
        {paused && <Pause size={12} aria-hidden="true" />}{paused ? 'Tijdelijk gepauzeerd' : 'Op bestelling'}
      </span>
      <span className="product-open"><ArrowUpRight size={20} aria-hidden="true" /></span>
    </Link>
    <div className="product-meta"><span>{product.typeLabel}</span></div>
    <div className="product-title-row">
      <h3><Link to={`/product/${product.slug}`}>{product.name}</Link></h3>
      <span className="product-price">{money(Math.min(...product.variants.map((v) => v.priceCents)))}</span>
    </div>
    <p className="product-description">{product.description}</p>
  </article>;
}

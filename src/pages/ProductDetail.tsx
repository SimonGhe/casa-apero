import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock3, Hand, Pause, ShoppingBag } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { leadTime, money, products, shopSettings } from '../data/catalogue';
import { ProductPhoto } from '../components/ProductPhoto';
import { ProductCard } from '../components/ProductCard';
import { QuantityInput } from '../components/QuantityInput';
import { useCart } from '../context/CartContext';
import { MAX_QUANTITY } from '../lib/cart';
import { NotFound } from './StaticPages';

export function ProductDetail() {
  const { slug } = useParams();
  const product = products.find((entry) => entry.slug === slug);
  return product ? <ProductView key={product.id} product={product} /> : <NotFound />;
}

function ProductView({ product }: { product: (typeof products)[number] }) {
  const cart = useCart();
  const [variantId, setVariantId] = useState(product.variants[0].id);
  const [count, setCount] = useState(1);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [added, setAdded] = useState(false);
  const variant = product.variants.find((entry) => entry.id === variantId)!;
  const paused = product.ordersPaused || shopSettings.ordersPaused;
  const existingCount = cart.lines.find((line) => line.productId === product.id && line.variantId === variantId)?.quantity ?? 0;
  const atLimit = existingCount >= MAX_QUANTITY;
  const addingCount = Math.min(count, MAX_QUANTITY - existingCount);
  const hasPlaceholderImages = product.images.some((image) => image.isPlaceholder);

  useEffect(() => {
    if (!added) return;
    const timeout = window.setTimeout(() => setAdded(false), 6000);
    return () => window.clearTimeout(timeout);
  }, [added]);

  return <div className="content-width page-space">
    <Link className="back-link" to="/collectie"><ArrowLeft size={16} aria-hidden="true" />Terug naar de collectie</Link>
    <div className="product-detail">
      <div className="product-gallery">
        <ProductPhoto key={photoIndex} photo={product.images[photoIndex]} eager />
        <div className="gallery-thumbnails" role="group" aria-label="Productbeelden">{product.images.map((photo, index) => <button type="button" key={index} aria-label={`Bekijk ${photo.isPlaceholder ? 'sfeerbeeld' : 'productfoto'} ${index + 1}`} aria-pressed={photoIndex === index} onClick={() => setPhotoIndex(index)}><ProductPhoto photo={photo} /></button>)}{hasPlaceholderImages && <p>Illustratieve uitsneden van het bestaande sfeerbeeld.<br />Echte productfoto's volgen nog.</p>}</div>
      </div>
      <div className="product-detail-copy">
        <p className="eyebrow">{product.typeLabel}</p><h1 className="detail-title">{product.name}</h1>
        <p className="detail-price">{money(variant.priceCents)}</p>
        <p>{product.description}</p>
        {product.variants.length > 1 && <fieldset className="variant-options"><legend>Uitvoering <span>— {variant.label}</span></legend><div className="flex flex-wrap gap-3">{product.variants.map((entry) => <label key={entry.id} className="variant-choice"><input type="radio" name={`variant-${product.id}`} value={entry.id} checked={variantId === entry.id} onChange={() => { setVariantId(entry.id); setAdded(false); }} /><span className="colour-swatch" style={{ backgroundColor: entry.colour }} aria-hidden="true">{variantId === entry.id && <Check size={17} />}</span><span>{entry.label}</span></label>)}</div></fieldset>}
        <div className="production-note"><Clock3 size={18} aria-hidden="true" /><span>{leadTime(product.estimatedProductionDays)}</span></div>
        <p className="production-estimate">Handgemaakt na bestelling. De productietijd is een schatting; je voorkeursdatum wordt afzonderlijk bevestigd.</p>
        {paused && <p className="pause-notice"><Pause size={17} aria-hidden="true" />{shopSettings.ordersPaused ? shopSettings.pauseMessage : 'Bestellen van dit product is tijdelijk gepauzeerd.'}</p>}
        <div className="add-to-cart-row"><QuantityInput value={count} onChange={(value) => { setCount(value); setAdded(false); }} label="Aantal kommetjes" disabled={paused || atLimit} /><button type="button" className="button button-primary" disabled={paused || atLimit} onClick={() => { cart.add(product.id, variantId, addingCount); setAdded(true); }}><ShoppingBag size={18} aria-hidden="true" />{paused ? 'Tijdelijk gepauzeerd' : atLimit ? 'Maximum bereikt' : 'In winkelmand'}</button></div>
        <div className="cart-feedback" role="status" aria-live="polite">{added && <p><Check size={17} aria-hidden="true" />{addingCount} toegevoegd. <Link to="/winkelmand">Bekijk winkelmand <ArrowRight size={14} aria-hidden="true" /></Link></p>}{!added && (atLimit || existingCount + count > MAX_QUANTITY) && <p>Maximaal {MAX_QUANTITY} per uitvoering in je winkelmand{atLimit ? '.' : `; er kunnen nog ${addingCount} bij.`}</p>}</div>
        <ul className="product-assurances"><li><Hand size={17} aria-hidden="true" />Handgemaakt op bestelling</li><li><Check size={17} aria-hidden="true" />Afhaling of levering in onderling overleg</li><li><Check size={17} aria-hidden="true" />Betaling bij afhaling of levering</li></ul>
        <details className="product-disclosure"><summary>Foto's en praktische afspraken</summary>{hasPlaceholderImages && <p>De getoonde sfeerbeelden zijn tijdelijk, geen foto's van dit product. De echte productfoto's volgen.</p>}<p>Afhaling in de omgeving van Julius en Maurits Sabbestraat in Brugge en eventuele lokale levering spreken we samen af. De voorkeursdatum is een aanvraag, geen gegarandeerde afspraak. Er worden in deze voorvertoning nog geen bestellingen verstuurd.</p></details>
      </div>
    </div>
    <section className="related-products"><div className="section-heading"><p className="eyebrow">Een tafel vol mogelijkheden</p><h2>Ontdek ook</h2></div><div className="product-grid">{products.filter((entry) => entry.id !== product.id).slice(0, 3).map((entry) => <ProductCard product={entry} key={entry.id} />)}</div></section>
  </div>;
}

import {useCatalogue} from '../context/CatalogueContext';
import { ArrowLeft, ArrowRight, Info, ShoppingBag, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { money } from '../data/catalogue';
import { ProductPhoto } from '../components/ProductPhoto';
import { QuantityInput } from '../components/QuantityInput';

export function Cart() {
  const {shopSettings}=useCatalogue();
  const { lines, count, totalCents, update,hasUnavailableItems,removeUnavailable } = useCart();
  const paused = hasUnavailableItems||shopSettings.ordersPaused || lines.some((line) => line.product.ordersPaused);
  return <div className="content-width page-space">
    <Link className="back-link" to="/collectie"><ArrowLeft size={16} aria-hidden="true" />Verder kijken</Link>
    <div className="section-heading"><p className="eyebrow">Jouw selectie</p><h1 className="page-title">Winkelmand <span className="heading-count">{count}</span></h1></div>
    {hasUnavailableItems&&<div className="notice" role="alert"><p>Een product in je selectie is niet meer beschikbaar. Controleer je selectie voor je verdergaat.</p><button type="button" onClick={removeUnavailable}>Niet-beschikbare producten verwijderen</button></div>}
    {!lines.length ? <div className="empty-state"><ShoppingBag size={42} strokeWidth={1.2} aria-hidden="true" /><h2>Er is nog ruimte voor een kommetje.</h2><p>Ontdek de collectie en stel jouw aperomoment samen.</p><Link className="button button-primary" to="/collectie">Naar de collectie <ArrowRight size={18} aria-hidden="true" /></Link></div> : <div className="cart-layout">
      <div className="cart-lines">
        {lines.map((line) => <article className="cart-item" key={`${line.productId}/${line.variantId}`}>
          <Link className="cart-item-image" to={`/product/${line.product.slug}`} aria-label={`Bekijk ${line.product.name}`}><ProductPhoto photo={line.product.images[0]} /></Link>
          <div className="cart-item-info"><span className="eyebrow">Handgemaakt op bestelling</span><h2><Link to={`/product/${line.product.slug}`}>{line.product.name}</Link></h2>{line.product.variants.length > 1 && <p>{line.variant.label}</p>}<p className="muted">{money(line.variant.priceCents)} per stuk</p>{line.product.ordersPaused && <p className="error-text">Bestellen tijdelijk gepauzeerd</p>}<div className="cart-item-controls"><QuantityInput value={line.quantity} onChange={(value) => update(line.productId, line.variantId, value)} label={`Aantal ${line.product.name}`} /><button className="icon-button remove-button" type="button" title="Verwijderen" aria-label={`Verwijder ${line.product.name}`} onClick={() => update(line.productId, line.variantId, 0)}><Trash2 size={18} aria-hidden="true" /></button></div></div>
          <strong className="cart-line-total">{money(line.totalCents)}</strong>
        </article>)}
        <p className="cart-storage-note">Je selectie blijft vier uur na de laatste wijziging op dit apparaat bewaard. Je hebt nog geen bestelling geplaatst. <Link to="/cookies">Meer over browseropslag</Link>.</p>
      </div>
      <aside className="order-summary" aria-label="Overzicht winkelmand"><h2>Jouw overzicht</h2><div className="summary-row"><span>{count} {count === 1 ? 'artikel' : 'artikelen'}</span><span>{money(totalCents)}</span></div><div className="summary-row"><span>Afhaling / levering</span><span>In overleg</span></div><div className="summary-row summary-total"><span>Totaal producten</span><strong data-testid="cart-total">{money(totalCents)}</strong></div><p className="summary-note">Dit is het totaal van je producten. Eventuele kosten voor lokale levering worden vooraf afgesproken en zijn hier niet inbegrepen.</p>
        {paused ? <p className="pause-notice">Er staat een gepauzeerd product in je selectie of de webshop neemt tijdelijk geen bestellingen aan.</p> : <Link className="button button-primary w-full" to="/bestellen">Naar bestellen <ArrowRight size={18} aria-hidden="true" /></Link>}
        <div className="checkout-info"><Info size={17} aria-hidden="true" /><p>Testversie: via de openbare website kun je nog niet bestellen. Je betaalt later bij afhaling of levering.</p></div>
        <p className="summary-note">Lees de <Link to="/algemene-voorwaarden">algemene voorwaarden</Link> en de <Link to="/herroepingsrecht">informatie over herroeping</Link>. De definitieve afspraken zijn nog in voorbereiding.</p>
      </aside>
    </div>}
  </div>;
}

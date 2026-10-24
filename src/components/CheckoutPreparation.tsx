import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { money } from '../data/catalogue';
import { business } from '../data/business';
import { checkoutStatus } from '../data/legal';

export function CheckoutPreparation() {
  const { lines, totalCents } = useCart();
  return <section className="checkout-preparation" aria-label="Bestelinformatie" data-checkout-status={checkoutStatus}>
    <h2>Voor je later bestelt</h2>
    {lines.length > 0 && <><ul className="checkout-lines">{lines.map((line) => <li key={line.variantId}><span>{line.product.name} · {line.quantity} × {money(line.variant.priceCents)}</span><strong>{money(line.totalCents)}</strong></li>)}</ul><p><strong>Totaal producten: {money(totalCents)}</strong></p></>}
    <p>Het definitieve totaal inclusief eventuele leveringskosten staat nog niet vast. Je gaat nu geen betalingsverplichting aan.</p>
    <p>Productie: {business.productionTime} Afhaling in Brugge op afspraak. Lokale levering en kosten worden vooraf afgesproken. {business.payment}</p>
    <p>Voor standaardproducten geldt bij verkoop op afstand in beginsel 14 dagen herroepingsrecht vanaf de dag na ontvangst. Handgemaakt op bestelling sluit dit recht niet uit. Lees de <Link to="/algemene-voorwaarden">algemene voorwaarden</Link>, <Link to="/herroepingsrecht">retour- en herroepingsinformatie</Link> en <Link to="/privacy">privacyverklaring</Link>.</p>
    <label className="checkout-acknowledgement"><input type="checkbox" disabled /> Ik heb de algemene voorwaarden en de informatie over herroeping gelezen. (Nog niet actief.)</label>
    <button className="button button-primary" type="button" disabled>Bestellen nog niet beschikbaar</button>
    <p className="summary-note">Er wordt geen aanvraag of bestelling verstuurd. De bevestigingsprocedure en essentiële afspraken moeten eerst worden goedgekeurd.</p>
  </section>;
}

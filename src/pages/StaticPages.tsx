import { ArrowRight, ArrowLeft, Clock3, Hand, MessageCircle, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { money } from '../data/catalogue';
import { useCart } from '../context/CartContext';
import { business } from '../data/business';
import { SocialLinks } from '../components/SocialLinks';

export function Ordering() {
  const { count, totalCents } = useCart();
  return <div className="content-width page-space">
    <p className="eyebrow">Gemaakt op bestelling</p><h1 className="page-title">Jouw volgende aperomoment.</h1>
    <p className="page-intro">Een kom kiezen is het begin. De rest spreken we samen af.</p>
    <div className="ordering-layout">
      <div className="prose">
        <h2>Zo werkt bestellen</h2>
        <ol className="ordering-steps">
          <li><strong>Kies jouw potjes en schalen</strong><p>Stel je winkelmand samen met Olive, Dune Mini, Dune Grand of Aperitivo en kies je aantallen.</p></li>
          <li><strong>Geef je voorkeur door</strong><p>Bij de opening kun je zonder account bestellen. Je geeft je naam en e-mailadres door, eventueel je telefoonnummer en je voorkeur voor afhaling of levering.</p></li>
          <li><strong>Wij maken je bestelling</strong><p>Alles is handgemaakt op bestelling. {business.productionTime}</p></li>
          <li><strong>We bevestigen de afspraak</strong><p>Afhaling gebeurt op afspraak in de omgeving van {business.pickupArea}. Je kunt een voorkeursdatum vragen, maar die is pas afgesproken nadat ons team de datum heeft bevestigd.</p><p>{business.delivery}</p></li>
          <li><strong>Betaal bij afhaling of levering</strong><p>{business.payment} De beschikbare elektronische methode spreken we vooraf af. Er is geen online betaling.</p></li>
        </ol>
        <div className="notice"><strong>De webshop is nog in voorbereiding.</strong><p>De producten en prijzen zijn bevestigd. Je kunt je winkelmand samenstellen, maar het bestelformulier is nog niet actief. Er worden geen bestellingen of contactgegevens verstuurd en er worden geen automatische bevestigingsmails verzonden.</p></div>
      </div>
      <aside className="order-summary"><ShoppingBag size={24} aria-hidden="true" /><h2>{count ? 'Jouw selectie staat klaar' : 'Een kommetje kiezen?'}</h2><p>{count ? `${count} artikelen in je winkelmand.` : 'Bekijk onze collectie potjes en aperoschalen.'}</p>{count > 0 && <div className="summary-row summary-total"><span>Totaal producten</span><strong>{money(totalCents)}</strong></div>}<p className="summary-note">Eventuele leveringskosten zijn niet inbegrepen en worden in overleg bevestigd.</p><Link className="button button-primary w-full" to={count ? '/winkelmand' : '/collectie'}>{count ? 'Bekijk je winkelmand' : 'Ontdek de collectie'}<ArrowRight size={18} aria-hidden="true" /></Link><p className="summary-note">Bestelformulier nog niet beschikbaar. Er is nog niets besteld of betaald.</p></aside>
    </div>
  </div>;
}

export function Story() {
  return <><div className="content-width page-space story-page">
    <p className="eyebrow">Ons verhaal</p><h1 className="page-title">Samen maken.<br />Samen genieten.</h1>
    <p className="page-intro">Acht studenten. Een passie voor keramiek en gezellig tafelen.</p>
    <div className="story-text-grid about-text"><h2>Wie zijn we?</h2><div className="prose">{business.about.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<p>Onze mini-onderneming loopt tijdens het schooljaar. We maken onze potjes en schalen op bestelling, met een geschatte productietijd van ongeveer 2 weken.</p><Link className="text-link" to="/collectie">Ontdek de collectie <ArrowRight size={17} aria-hidden="true" /></Link><SocialLinks /></div></div>
    <figure className="story-wide-photo"><img src="/assets/market-stand.png" alt="Het bestaande Casa Apero sfeerbeeld met keramiek, hout en een warme aperotafel." /><figcaption>Ons oorspronkelijke sfeerbeeld. Eigen foto's van Olive, Dune Mini, Dune Grand en Aperitivo volgen later.</figcaption></figure>
  </div><div className="values-strip"><div className="content-width"><span><Hand size={18} aria-hidden="true" />Handgemaakte keramiek</span><span><Clock3 size={18} aria-hidden="true" />Ongeveer 2 weken productietijd (schatting)</span><span><MessageCircle size={18} aria-hidden="true" />Persoonlijk afgesproken</span></div></div></>;
}

export function Contact() {
  return <div className="content-width page-space narrow-page">
    <p className="eyebrow">Even afspreken</p><h1 className="page-title">Contact</h1>
    <div className="prose">
      <p className="page-intro">Volg Casa Apero op Instagram en TikTok voor onze keramiek en de momenten achter de schermen.</p>
      <SocialLinks />
      <h2>E-mail</h2>
      {business.publicContactEmail ? <p><a className="text-link" href={`mailto:${business.publicContactEmail}`}>{business.publicContactEmail}</a></p> : <p>Ons openbare e-mailadres wordt nog bevestigd.</p>}
      <h2>Afhalen in Brugge</h2><p>Afhaling in de omgeving van {business.pickupArea}. De exacte locatie en datum spreken we met je af. Een gevraagde voorkeursdatum moet eerst door ons team bevestigd worden.</p>
      <h2>Lokale levering</h2><p>{business.delivery}</p>
      <h2>Productie & betaling</h2><p>{business.productionTime} {business.payment}</p>
      <Link className="text-link" to="/bestellen">Lees hoe bestellen zal werken <ArrowRight size={17} aria-hidden="true" /></Link>
    </div>
  </div>;
}

export function Privacy() {
  return <div className="content-width page-space narrow-page"><p className="eyebrow">Zorg voor jouw gegevens</p><h1 className="page-title">Privacy</h1><div className="prose"><p className="notice">Voorlopige informatie voor de lokale ontwerpversie. De definitieve privacyinformatie moet nog worden bevestigd door de school.</p><h2>In deze voorvertoning</h2><p>Er is geen actief bestelformulier. We slaan alleen productkeuzes en aantallen in de winkelmand op in deze browser, zodat je selectie tijdens het bekijken behouden blijft. Er worden hierbij geen naam, e-mailadres of telefoonnummer opgeslagen.</p><p>Verwijder de producten uit je winkelmand of wis de websitegegevens in je browser om de bewaarde selectie te verwijderen. Deze versie gebruikt geen analysetrackers.</p><h2>Voor de opening</h2><p>Het team en de school moeten de verantwoordelijke contactpersoon, de bewaartermijnen, de definitieve doeleinden en de procedure voor inzage en verwijdering aanvullen. De webshop neemt tot die tijd geen echte bestellingen aan.</p><Link className="text-link" to="/contact">Contactinformatie <ArrowRight size={17} aria-hidden="true" /></Link></div></div>;
}

export function NotFound() {
  return <div className="content-width page-space empty-state"><p className="eyebrow">404</p><h1 className="page-title">Even de weg kwijt?</h1><p>Deze pagina of dit product bestaat niet.</p><Link className="button button-primary" to="/collectie"><ArrowLeft size={18} aria-hidden="true" />Naar de collectie</Link></div>;
}

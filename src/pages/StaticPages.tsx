import { ArrowRight, ArrowLeft, Clock3, Hand, MessageCircle, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { money } from '../data/catalogue';
import { useCart } from '../context/CartContext';
import { business } from '../data/business';
import { TeamPhoto } from '../components/TeamPhoto';
import { SocialLinks } from '../components/SocialLinks';
import { CheckoutPreparation } from '../components/CheckoutPreparation';
import { LocalRequestLink } from '../components/LocalRequestLink';

export function Ordering() {
  const { count, totalCents } = useCart();
  return <div className="content-width page-space">
    <p className="eyebrow">Gemaakt op bestelling</p><h1 className="page-title">Jouw volgende aperomoment.</h1>
    <p className="page-intro">Een kom kiezen is het begin. De rest spreken we samen af.</p>
    <div className="ordering-layout">
      <div className="prose">
        <h2>Zo werkt bestellen</h2>
        <ol className="ordering-steps">
          <li><strong>Kies jouw potjes en schalen</strong><p>Kies uit de actuele collectie en pas de aantallen aan in je winkelmand.</p></li>
          <li><strong>Geef je voorkeur door</strong><p>Bij de opening kun je zonder account bestellen. Je geeft je naam en e-mailadres door, eventueel je telefoonnummer en je voorkeur voor afhaling of levering.</p></li>
          <li><strong>We spreken eerst alles af</strong><p>Ons team bevestigt beschikbaarheid, alle kosten, afhaling of levering en de planning. Je gaat pas akkoord nadat je het volledige aanbod hebt ontvangen. Daarna ontvang je de afspraken en voorwaarden in een vorm die je kunt bewaren.</p><p>Afhaling gebeurt op afspraak in de omgeving van {business.pickupArea}. Een voorkeursdatum is nog geen bevestigde afspraak. {business.delivery}</p></li>
          <li><strong>Daarna maken we je bestelling</strong><p>We starten pas na de bevestigingsstap. Alles is handgemaakt op bestelling. {business.productionTime}</p></li>
          <li><strong>Betaal bij afhaling of levering</strong><p>{business.payment} De beschikbare elektronische methode spreken we vooraf af. Er is geen online betaling.</p></li>
        </ol>
        <div className="notice"><strong>De webshop is nog in voorbereiding.</strong><p>De producten en prijzen zijn bevestigd. Je kunt je winkelmand samenstellen, maar het bestelformulier is nog niet actief. Er worden geen bestellingen of contactgegevens verstuurd en er worden geen automatische bevestigingsmails verzonden.</p></div>
        <CheckoutPreparation />
        <LocalRequestLink />
          {import.meta.env.MODE==='test-checkout'&&<div className="notice"><strong>TESTVERSIE — GEEN ECHTE BESTELLING</strong><p>Alleen goedgekeurde testers kunnen fictieve aanvragen registreren. Gebruik geen echte klantgegevens. Er volgt geen e-mail, betaling of productie.</p><a className="button button-primary" href="/test-bestellen">Aanmelden als tester</a></div>}
      </div>
      <aside className="order-summary"><ShoppingBag size={24} aria-hidden="true" /><h2>{count ? 'Jouw selectie staat klaar' : 'Een kommetje kiezen?'}</h2><p>{count ? `${count} artikelen in je winkelmand.` : 'Bekijk onze collectie potjes en aperoschalen.'}</p>{count > 0 && <div className="summary-row summary-total"><span>Totaal producten</span><strong>{money(totalCents)}</strong></div>}<p className="summary-note">Eventuele leveringskosten zijn niet inbegrepen en worden in overleg bevestigd.</p><Link className="button button-primary w-full" to={count ? '/winkelmand' : '/collectie'}>{count ? 'Bekijk je winkelmand' : 'Ontdek de collectie'}<ArrowRight size={18} aria-hidden="true" /></Link><p className="summary-note">Bestelformulier nog niet beschikbaar. Er is nog niets besteld of betaald.</p></aside>
    </div>
  </div>;
}

export function Story() {
  return <><div className="content-width page-space story-page">
    <p className="eyebrow">Ons verhaal</p><h1 className="page-title">Samen maken.<br />Samen genieten.</h1>
    <p className="page-intro">Acht studenten. Een passie voor keramiek en gezellig tafelen.</p>
    <div className="story-text-grid about-text"><div><h2>Wie zijn we?</h2><TeamPhoto /></div><div className="prose">{business.about.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<p>Onze mini-onderneming loopt tijdens het schooljaar. We maken onze potjes en schalen op bestelling, met een geschatte productietijd van ongeveer 2 weken.</p><Link className="text-link" to="/collectie">Ontdek de collectie <ArrowRight size={17} aria-hidden="true" /></Link><SocialLinks /></div></div>
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

export function NotFound() {
  return <div className="content-width page-space empty-state"><p className="eyebrow">404</p><h1 className="page-title">Even de weg kwijt?</h1><p>Deze pagina of dit product bestaat niet.</p><Link className="button button-primary" to="/collectie"><ArrowLeft size={18} aria-hidden="true" />Naar de collectie</Link></div>;
}

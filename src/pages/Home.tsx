import { ArrowRight, Check, Hand, Leaf, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import {useCatalogue} from '../context/CatalogueContext';
import { ProductCard } from '../components/ProductCard';
import { SocialLinks } from '../components/SocialLinks';
import { business } from '../data/business';
import { TeamPhoto } from '../components/TeamPhoto';

export function Home() {
  const {products}=useCatalogue();
  return <>
    <section className="hero">
      <img className="hero-photo" src="/assets/market-stand.png" alt="Het oorspronkelijke Casa Apero sfeerbeeld: een warme aperotafel met keramische schalen." fetchPriority="high" />
      <div className="hero-shade" />
      <div className="hero-content content-width">
        <p className="eyebrow light">Keramiek voor momenten samen</p>
        <h1>Casa Apero</h1>
        <p className="hero-tagline">Alles voor jouw aperomoment.</p>
        <p className="hero-description">Handgemaakte kommetjes. Een tafel vol gezelligheid.<br className="desktop-break" /> Een klein moment om samen van te genieten.</p>
        <Link className="button button-light" to="/collectie">Ontdek de collectie <ArrowRight size={18} aria-hidden="true" /></Link>
      </div>
      <span className="hero-caption">Oorspronkelijk sfeerbeeld · geen productfoto</span>
      <div className="hero-bottom"><span>Belgische Vlajo mini-onderneming</span><span>Gemaakt op bestelling</span></div>
    </section>
    <div className="values-strip"><div className="content-width"><span><Hand size={18} aria-hidden="true" />Met de hand gemaakt</span><span><Leaf size={18} aria-hidden="true" />Een eigen karakter</span><span><MessageCircle size={18} aria-hidden="true" />Alleen afhalen op afspraak</span></div></div>

    <section className="section content-width">
      <div className="section-heading flex flex-wrap items-end justify-between gap-5">
        <div><p className="eyebrow">Voor op jouw tafel</p><h2>Een kom vol karakter.</h2></div>
        <Link className="text-link" to="/collectie">Bekijk de hele collectie <ArrowRight size={17} aria-hidden="true" /></Link>
      </div>
      <p className="collection-note">Onze handgemaakte collectie, gemaakt op bestelling. De getoonde sfeerbeelden zijn tijdelijk; eigen productfoto's volgen nog.</p>
      <div className="product-grid">{products.slice(0, 3).map((product) => <ProductCard key={product.id} product={product} />)}</div>
    </section>

    <section className="story-band">
      <div className="content-width story-layout">
        <div className="story-logo-area team-story-visual"><TeamPhoto /></div>
        <div className="story-copy"><p className="eyebrow">Wie zijn we?</p><h2>Van onze handen,<br />naar jouw tafel.</h2>{business.about.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<Link className="text-link" to="/ons-verhaal">Maak kennis met Casa Apero <ArrowRight size={17} aria-hidden="true" /></Link><SocialLinks /></div>
      </div>
    </section>

    <section className="section content-width" id="zo-werkt-het">
      <div className="section-heading"><p className="eyebrow">Van keuze tot aperomoment</p><h2>Met aandacht, op bestelling.</h2></div>
      <div className="steps-grid">
        <div><span className="step-number">01</span><h3>Kies jouw kommetjes</h3><p>Ontdek onze collectie en stel jouw selectie samen.</p></div>
        <div><span className="step-number">02</span><h3>Eerst aanvragen & afspreken</h3><p>Verstuur je bestelaanvraag. Ons team bekijkt je selectie en spreekt de afhaling met je af. Pas na persoonlijke bevestiging start de productie van ongeveer 2 weken.</p></div>
        <div><span className="step-number">03</span><h3>Ophalen & genieten</h3><p>{business.payment}</p></div>
      </div>
      <div className="conditions-line"><Check size={18} aria-hidden="true" /><p>Alleen afhaling op afspraak. Je bestelaanvraag wordt persoonlijk bevestigd; daarna ongeveer twee weken productie.</p><Link className="text-link" to="/bestellen">Alle afspraken <ArrowRight size={16} aria-hidden="true" /></Link></div>
    </section>
  </>;
}

import {useCatalogue} from '../context/CatalogueContext';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Menu, ShoppingBag, X } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';

import { business } from '../data/business';
import { BrandLogo } from './BrandLogo';
import { SocialLinks } from './SocialLinks';
import { LegalNavigation } from '../pages/Legal';
import {orderingMessages} from '../lib/orderingStatus';

export function Layout() {
  const {orderingState,error:catalogueError}=useCatalogue();
  const { count, storageWarning } = useCart();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const previousPath = useRef(location.pathname);

  useEffect(() => {
    setMenuOpen(false);
    if (previousPath.current !== location.pathname) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      document.getElementById('main-content')?.focus({ preventScroll: true });
      previousPath.current = location.pathname;
    }
  }, [location.pathname]);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menuOpen) { setMenuOpen(false); menuButton.current?.focus(); }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [menuOpen]);

  return <>
    <a className="skip-link" href="#main-content">Naar de inhoud</a>
    <div className="preview-banner" aria-live="polite">{orderingState==='test'&&import.meta.env.MODE==='test-checkout'?'TESTVERSIE — GEEN ECHTE BESTELLING · Alleen fictieve testerregistraties':orderingMessages[orderingState]}</div>
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" to="/" aria-label="Casa Apero, naar de homepage"><BrandLogo className="header-logo" eager /><span className="brand-wordmark">Casa Apero<small>Handgemaakt. Samen genoten.</small></span></Link>
        <nav className="desktop-nav" aria-label="Hoofdnavigatie">
          <NavLink to="/collectie">De collectie</NavLink>
          <NavLink to="/ons-verhaal">Ons verhaal</NavLink>
          <NavLink to="/bestellen">Zo bestel je</NavLink>
        </nav>
        <div className="header-actions">
          <Link className="cart-link" to="/winkelmand" aria-label={`Winkelmand, ${count} artikelen`}><ShoppingBag size={21} aria-hidden="true" /><span className="cart-label">Winkelmand</span><span className="cart-count" aria-hidden="true">{count}</span></Link>
          <button ref={menuButton} className="icon-button menu-button" type="button" title={menuOpen ? 'Menu sluiten' : 'Menu openen'} aria-label={menuOpen ? 'Menu sluiten' : 'Menu openen'} aria-expanded={menuOpen} aria-controls="mobile-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button>
        </div>
      </div>
      {menuOpen && <nav id="mobile-nav" className="mobile-nav" aria-label="Mobiele navigatie"><NavLink to="/collectie">De collectie</NavLink><NavLink to="/ons-verhaal">Ons verhaal</NavLink><NavLink to="/bestellen">Zo bestel je</NavLink><NavLink to="/contact">Contact</NavLink></nav>}
    </header>
    {catalogueError&&<div className="pause-banner" role="alert">{catalogueError}</div>}
    {storageWarning && <div className="storage-banner" role="status">Je browser kan de winkelmand niet bewaren. Houd dit tabblad open om je selectie te behouden.</div>}
    <main id="main-content" tabIndex={-1}><Outlet /></main>
    <footer className="site-footer">
      <div className="footer-main content-width">
        <div className="footer-brand"><Link className="footer-brand-link" to="/" aria-label="Casa Apero, naar de homepage"><BrandLogo className="footer-logo" /><span>Casa Apero</span></Link><p>Alles voor jouw aperomoment.</p><span>Een Vlajo mini-onderneming van 8 studenten.</span><SocialLinks /></div>
        <div><h2>Ontdek</h2><Link to="/collectie">De collectie</Link><Link to="/ons-verhaal">Ons verhaal</Link><Link to="/bestellen">Bestellen & afspreken <ArrowUpRight size={14} aria-hidden="true" /></Link></div>
        <div><h2>Goed om te weten</h2><Link to="/contact">Contact</Link><Link to="/privacy">Privacy</Link>{business.publicContactEmail && <a href={`mailto:${business.publicContactEmail}`}>{business.publicContactEmail}</a>}<p>Alleen afhaling op afspraak.<br />Ongeveer 2 weken productie na bevestiging (schatting).<br />Betalen bij afhaling.</p></div>
      </div>
      <div className="content-width"><LegalNavigation /></div>
      <div className="footer-bottom content-width"><span>Casa Apero</span><span>{import.meta.env.MODE==='shop'?'Handgemaakte keramiek':import.meta.env.MODE === 'staging' ? 'Testversie' : 'Lokale voorvertoning'} · productfoto's volgen</span><span>Met zorg gemaakt.</span></div>
    </footer>
  </>;
}

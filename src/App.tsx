import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Catalogue } from './pages/Catalogue';
import { ProductDetail } from './pages/ProductDetail';
import { Cart } from './pages/Cart';
import { Contact, NotFound, Ordering, Story } from './pages/StaticPages';
import { Cookies, LegalNotice, Privacy, Terms, Withdrawal } from './pages/Legal';
import { legalPages } from './data/legal';
import {useCatalogue} from './context/CatalogueContext';
const LocalCheckout = import.meta.env.MODE === 'staging' ? null : lazy(() => import('./pages/LocalCheckout').then((module) => ({ default: module.LocalCheckout })));
const RequestConfirmation = import.meta.env.MODE === 'staging' ? null : lazy(() => import('./pages/LocalCheckout').then((module) => ({ default: module.RequestConfirmation })));
const testCheckout=import.meta.env.MODE==='test-checkout';
const publicShop=import.meta.env.MODE==='shop';

export function App() {
  const {products}=useCatalogue();
  const { pathname } = useLocation();
  useEffect(() => {
    const title = ({ '/': 'Handgemaakt voor jouw aperomoment', '/collectie': 'De collectie', '/winkelmand': 'Winkelmand', '/bestellen': 'Bestellen & afspreken', '/ons-verhaal': 'Ons verhaal', '/contact': 'Contact', '/privacy': 'Privacy' } as Record<string, string>)[pathname]
      ?? ({ '/bestellen/lokaal': 'Vrijblijvende testaanvraag', '/bestellen/ontvangen': 'Ontvangstbewijs' } as Record<string, string>)[pathname]
      ?? legalPages.find((page) => page.path === pathname)?.title
      ?? products.find((product) => pathname === `/product/${product.slug}`)?.name ?? 'Pagina niet gevonden';
    document.title = `${legalPages.find((page) => page.path === pathname)?.title ?? title} | Casa Apero`;
  }, [pathname,products]);
  return <Routes><Route element={<Layout />}>
    <Route index element={<Home />} />
    <Route path="collectie" element={<Catalogue />} />
    <Route path="product/:slug" element={<ProductDetail />} />
    <Route path="winkelmand" element={<Cart />} />
    <Route path="bestellen" element={publicShop&&LocalCheckout?<Suspense fallback={<p>Even laden…</p>}><LocalCheckout publicCheckout /></Suspense>:<Ordering />} />
    {LocalCheckout && !testCheckout && !publicShop && <Route path="bestellen/lokaal" element={<Suspense fallback={<p>Even laden…</p>}><LocalCheckout /></Suspense>} />}
    {RequestConfirmation && !testCheckout && <Route path="bestellen/ontvangen" element={<Suspense fallback={<p>Even laden…</p>}><RequestConfirmation publicCheckout={publicShop} /></Suspense>} />}
    {LocalCheckout && testCheckout && <Route path="test-bestellen" element={<Suspense fallback={<p>Even laden…</p>}><LocalCheckout authenticatedTest /></Suspense>} />}
    {RequestConfirmation && testCheckout && <Route path="test-bestellen/ontvangen" element={<Suspense fallback={<p>Even laden…</p>}><RequestConfirmation authenticatedTest /></Suspense>} />}
    <Route path="ons-verhaal" element={<Story />} />
    <Route path="contact" element={<Contact />} />
    <Route path="privacy" element={<Privacy />} />
    <Route path="algemene-voorwaarden" element={<Terms />} />
    <Route path="wettelijke-vermeldingen" element={<LegalNotice />} />
    <Route path="herroepingsrecht" element={<Withdrawal />} />
    <Route path="cookies" element={<Cookies />} />
    <Route path="*" element={<NotFound />} />
  </Route></Routes>;
}

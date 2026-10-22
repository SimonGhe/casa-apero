import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Catalogue } from './pages/Catalogue';
import { ProductDetail } from './pages/ProductDetail';
import { Cart } from './pages/Cart';
import { Contact, NotFound, Ordering, Privacy, Story } from './pages/StaticPages';
import { products } from './data/catalogue';

export function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    const title = ({ '/': 'Handgemaakt voor jouw aperomoment', '/collectie': 'De collectie', '/winkelmand': 'Winkelmand', '/bestellen': 'Bestellen & afspreken', '/ons-verhaal': 'Ons verhaal', '/contact': 'Contact', '/privacy': 'Privacy' } as Record<string, string>)[pathname]
      ?? products.find((product) => pathname === `/product/${product.slug}`)?.name ?? 'Pagina niet gevonden';
    document.title = `${title} | Casa Apero`;
  }, [pathname]);
  return <Routes><Route element={<Layout />}>
    <Route index element={<Home />} />
    <Route path="collectie" element={<Catalogue />} />
    <Route path="product/:slug" element={<ProductDetail />} />
    <Route path="winkelmand" element={<Cart />} />
    <Route path="bestellen" element={<Ordering />} />
    <Route path="ons-verhaal" element={<Story />} />
    <Route path="contact" element={<Contact />} />
    <Route path="privacy" element={<Privacy />} />
    <Route path="*" element={<NotFound />} />
  </Route></Routes>;
}

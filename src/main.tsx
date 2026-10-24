import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { CartProvider } from './context/CartContext';
import {CatalogueProvider} from './context/CatalogueContext';
import '../styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><BrowserRouter><CatalogueProvider><CartProvider><App /></CartProvider></CatalogueProvider></BrowserRouter></StrictMode>,
);

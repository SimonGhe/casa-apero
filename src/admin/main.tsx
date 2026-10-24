import React from 'react';
import ReactDOM from 'react-dom/client';
import { Dashboard } from './Dashboard';
import '../../styles.css';
import './admin.css';

document.title='Studentenbeheer | Casa Apero';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Dashboard /></React.StrictMode>);

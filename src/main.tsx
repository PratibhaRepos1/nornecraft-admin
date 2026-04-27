import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import AddProduct from './pages/AddProduct';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AddProduct />
  </StrictMode>,
);

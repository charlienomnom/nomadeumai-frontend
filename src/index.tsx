'use client';

import React from 'react';
import { createRoot } from 'react-dom/client';

import './styles.css'; // adjust if your CSS file is named differently

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

const root = createRoot(container);

root.render(
  <React.StrictMode>
    {/* No <App /> needed — Next.js handles it via app/ directory */}
  </React.StrictMode>
);
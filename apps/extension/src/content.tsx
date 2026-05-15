import React from 'react';
import { createRoot } from 'react-dom/client';
import { ReoBubble } from './ReoBubble';
import './style.css';

const container = document.createElement('div');
container.id = 'reo-root';
document.body.appendChild(container);

const root = createRoot(container);
root.render(<ReoBubble />);

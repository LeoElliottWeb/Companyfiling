import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ClientApp from './ClientApp.jsx';

const path = window.location.pathname.toLowerCase();
const isClientPortal = path.startsWith('/client');

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        {isClientPortal ? <ClientApp /> : <App />}
    </React.StrictMode>
);
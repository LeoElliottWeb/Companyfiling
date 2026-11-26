import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dns from 'node:dns';

// Force Node.js to use Cloudflare's DNS to bypass local network issues
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['1.1.1.1', '8.8.8.8']);

export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api/supabase': {
                target: 'https://xpltoolhjzsunvsqqkro.supabase.co',
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/api\/supabase/, ''),
            },
            '/api/ch': {
                target: 'https://api.company-information.service.gov.uk',
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/api\/ch/, ''),
            }
        }
    }
});
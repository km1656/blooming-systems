// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.bloomingsys.com',

  security: {
    checkOrigin: true,
    csp: {
      directives: [
        "default-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-src https://challenges.cloudflare.com",
        "img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com",
        "connect-src 'self' https://challenges.cloudflare.com https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com",
        "object-src 'none'",
      ],
      scriptDirective: {
        resources: [
          "'self'",
          'https://challenges.cloudflare.com',
          'https://www.googletagmanager.com',
        ],
      },
      styleDirective: {
        resources: ["'self'", 'https://challenges.cloudflare.com'],
      },
    },
  },

  integrations: [
    react(),
    sitemap(),
  ],

  vite: {
    plugins: [tailwindcss()]
  }
});

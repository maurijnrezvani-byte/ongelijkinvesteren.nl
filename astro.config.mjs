// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  site: 'https://ongelijkinvesteren.nl',
  // Alle adressen eindigen op een schuine streep: /aanbod/, /over/ enz.
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [
    // Het dashboard is geen Astro-pagina maar een los bestand in public/dashboard/ (gemaakt door
    // "Ongelijk Investeren Dashboard/bouw/4_naar_site.py"); daarom staat het hier apart in de sitemap.
    sitemap({
      namespaces: { news: false, xhtml: false, image: false, video: false },
      customPages: ['https://ongelijkinvesteren.nl/dashboard/'],
    }),
  ],
});

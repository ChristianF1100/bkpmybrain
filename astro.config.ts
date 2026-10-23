import { defineConfig } from 'astro/config';
import type { AstroIntegration } from 'astro';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveSite } from './config/resolve-site.ts';
import rehypeBasePath from './src/lib/rehype-base.ts';
import { generate } from './scripts/build-data.ts';

const siteConfig = JSON.parse(readFileSync(new URL('./config/site.json', import.meta.url), 'utf8'));
// site/base: dominio personalizzato, sottopercorso GitHub Pages (/nome-repo) o sito utente, tutto dedotto da config/site.json
// e da GITHUB_REPOSITORY (impostata automaticamente da GitHub Actions). Vedi config/resolve-site.ts.
const { site, base } = resolveSite(process.env, siteConfig);

/** In sviluppo rigenera grafo e indice di ricerca quando cambiano content/, config/ o data/. */
function sinapsiData(): AstroIntegration {
  return {
    name: 'sinapsi-data',
    hooks: {
      // Garantisce che grafo e indice di ricerca esistano e siano aggiornati anche con `astro dev` / `astro build` lanciati a mano.
      // Contenuti non validi = errore e build interrotta (gli errori sono stampati da generate()).
      'astro:config:setup': () => {
        const out = generate({ quiet: true });
        if (out.errors.length && process.argv.includes('build')) throw new Error('Contenuti non validi: correggi gli errori elencati sopra.');
      },
      'astro:server:setup': ({ server }) => {
        server.watcher.add(['content', 'config', 'data'].map((d) => fileURLToPath(new URL(`./${d}/`, import.meta.url)))); // fileURLToPath: percorsi corretti anche su Windows
        let timer: ReturnType<typeof setTimeout> | undefined;
        const onChange = (file: string) => {
          if (!/[\\/](content|config|data)[\\/]/.test(file)) return;
          clearTimeout(timer);
          timer = setTimeout(() => { generate({ quiet: true }); }, 200);
        };
        for (const ev of ['add', 'change', 'unlink'] as const) server.watcher.on(ev, onChange);
      },
    },
  };
}

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',            // /contenuti/nome/ → file reale nome/index.html: nessun 404 al refresh
  build: { format: 'directory' },
  devToolbar: { enabled: false },
  integrations: [react(), mdx(), sitemap(), sinapsiData()],
  markdown: {
    rehypePlugins: [[rehypeBasePath, { base }]],
    shikiConfig: { theme: 'github-dark-dimmed' },
  },
  vite: { build: { chunkSizeWarningLimit: 1200 } },
});

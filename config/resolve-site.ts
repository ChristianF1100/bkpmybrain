/**
 * Calcola `site` e `base` di Astro.
 * Priorità: variabili d'ambiente SINAPSI_SITE/SINAPSI_BASE → dominio personalizzato
 * → siteUrl/basePath espliciti → inferenza da GITHUB_REPOSITORY → localhost.
 *  - https://utente.github.io/repo/  →  base "/repo"
 *  - repository "utente.github.io" o dominio personalizzato →  base "/"
 */
export interface SiteConfig { customDomain?: string; siteUrl?: string; basePath?: string }
export interface ResolvedSite { site: string; base: string }

export function normalizeBase(b: string | undefined): string {
  const t = (b ?? '').trim().replace(/^\/+|\/+$/g, '');
  return t ? `/${t}` : '/';
}

export function resolveSite(env: Record<string, string | undefined>, cfg: SiteConfig): ResolvedSite {
  if (env.SINAPSI_SITE) return { site: env.SINAPSI_SITE.replace(/\/+$/, ''), base: normalizeBase(env.SINAPSI_BASE) };
  const domain = cfg.customDomain?.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (domain) return { site: `https://${domain}`, base: '/' };
  if (cfg.siteUrl?.trim()) return { site: cfg.siteUrl.trim().replace(/\/+$/, ''), base: normalizeBase(cfg.basePath) };
  const repo = env.GITHUB_REPOSITORY;
  if (repo && repo.includes('/')) {
    const [owner, name] = repo.split('/');
    const isUserSite = name.toLowerCase() === `${owner.toLowerCase()}.github.io`;
    return { site: `https://${owner.toLowerCase()}.github.io`, base: isUserSite ? '/' : `/${name}` };
  }
  return { site: 'http://localhost:4321', base: '/' };
}

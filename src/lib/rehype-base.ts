/**
 * Plugin rehype: antepone la `base` ai percorsi assoluti nei contenuti Markdown/MDX
 * (`![](/media/x.jpg)`, `[](/contenuti/y/)`), così funzionano anche sotto /nome-repo.
 */
import { joinBase } from './url.ts';

const ATTRS: Record<string, string[]> = { img: ['src'], a: ['href'], source: ['src'], video: ['src', 'poster'], audio: ['src'] };

interface HastNode { type: string; tagName?: string; properties?: Record<string, unknown>; children?: HastNode[] }

export default function rehypeBasePath(options: { base?: string } = {}) {
  const base = options.base ?? '/';
  return (tree: HastNode) => {
    const walk = (node: HastNode) => {
      if (node.type === 'element' && node.tagName && node.properties) {
        for (const attr of ATTRS[node.tagName] ?? []) {
          const v = node.properties[attr];
          if (typeof v === 'string' && v.startsWith('/') && !v.startsWith('//')) node.properties[attr] = joinBase(base, v);
        }
      }
      node.children?.forEach(walk);
    };
    walk(tree);
  };
}

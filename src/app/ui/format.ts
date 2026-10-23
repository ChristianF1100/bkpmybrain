import { TYPE_LABELS } from '../../core/types.ts';
import type { ContentType } from '../../core/types.ts';

export const typeLabel = (t: ContentType | 'topic'): string => (t === 'topic' ? 'Argomento' : TYPE_LABELS[t]);

/** Le date dei contenuti sono a mezzogiorno UTC: si formattano in UTC per evitare slittamenti di giorno. */
export function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

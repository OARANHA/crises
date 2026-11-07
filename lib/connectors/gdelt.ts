import { booleanQuery, type Connector, type RawMention } from './types';
import { fetchJson, truncate } from './util';

// GDELT usa nomi di lingua per esteso; mappa dei più comuni verso ISO 639-1.
const LANG_MAP: Record<string, string> = {
  italian: 'it', english: 'en', spanish: 'es', french: 'fr', german: 'de',
  portuguese: 'pt', dutch: 'nl', polish: 'pl', russian: 'ru', arabic: 'ar',
  chinese: 'zh', japanese: 'ja', korean: 'ko', turkish: 'tr', romanian: 'ro',
  hungarian: 'hu', czech: 'cs', greek: 'el', swedish: 'sv', danish: 'da',
  finnish: 'fi', norwegian: 'no', ukrainian: 'uk', hebrew: 'he', hindi: 'hi',
  indonesian: 'id', vietnamese: 'vi', thai: 'th', slovak: 'sk', bulgarian: 'bg',
  croatian: 'hr', serbian: 'sr', catalan: 'ca', slovenian: 'sl',
};

// GDELT filtra per paese con codici FIPS, che differiscono dall'ISO per alcuni stati.
const FIPS: Record<string, string> = {
  IT: 'IT', US: 'US', GB: 'UK', FR: 'FR', DE: 'GM', ES: 'SP', BR: 'BR',
  MX: 'MX', CA: 'CA', AU: 'AS', IN: 'IN', NL: 'NL', PL: 'PL', JP: 'JA',
};

type GdeltArticle = {
  url: string; title: string; seendate: string; domain: string;
  language: string; sourcecountry: string;
};

function parseSeenDate(s: string): Date {
  // Formato: 20260701T063000Z
  const m = s?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return new Date();
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
}

export const gdelt: Connector = {
  id: 'gdelt',
  label: 'GDELT (worldwide news)',
  tier: 'free',
  enabled: () => true,
  async fetchMentions(q) {
    let query = booleanQuery({ ...q, anyTerms: q.anyTerms.slice(0, 6) });
    if (!query) return [];
    const countries = q.countries.map((c) => FIPS[c]).filter(Boolean);
    if (countries.length === 1) query += ` sourcecountry:${countries[0]}`;
    else if (countries.length > 1) query += ` (${countries.map((c) => `sourcecountry:${c}`).join(' OR ')})`;
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&format=json&maxrecords=75&sort=datedesc&timespan=3d`;
    // O endpoint DOC pode responder HTTP 429 ou texto em vez de JSON.
    // Limitar a uma repetição (>= 6 s) evita manter a coleta bloqueada por ~90 s.
    const waits = [0, 6000];
    let data: { articles?: GdeltArticle[] } | null = null;
    for (let attempt = 0; attempt < waits.length; attempt++) {
      if (waits[attempt]) await new Promise((resolve) => setTimeout(resolve, waits[attempt]));
      try {
        data = await fetchJson<{ articles?: GdeltArticle[] }>(url);
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const throttled = /HTTP 429\b/i.test(message);
        const nonJson = /non JSON/i.test(message);
        const temporary = /HTTP 50[0234]\b/i.test(message);
        if (!(throttled || nonJson || temporary) || attempt === waits.length - 1) {
          if (throttled) throw new Error('HTTP 429 do GDELT: limite temporario de requisicoes; tente depois.');
          if (nonJson) throw new Error('GDELT retornou resposta nao JSON; consulta nao validada.');
          throw error;
        }
      }
    }
    return (data?.articles ?? []).map((a) => ({
      source: 'gdelt',
      externalId: a.url,
      url: a.url,
      title: truncate(a.title ?? '', 300),
      content: truncate(a.title ?? '', 300),
      // GDELT dice da che paese viene la testata: è l'unica fonte che lo
      // dichiara, e finora lo stavamo buttando via.
      country: a.sourcecountry,
      author: a.domain,
      community: a.domain,
      publishedAt: parseSeenDate(a.seendate),
      // Lingue non mappate: lasciamo vuoto, ci penserà l'analisi Claude
      language: LANG_MAP[a.language?.toLowerCase()],
    } satisfies RawMention)).filter((m) => m.title);
  },
};

const BASE = 'https://laws.e-gov.go.jp/api/2';

/** Minimal 1-req/sec throttle. */
let lastFetchAt = 0;
const MIN_GAP_MS = 1100;
async function throttledFetch(url: string, init?: RequestInit): Promise<Response> {
  const now = Date.now();
  const wait = Math.max(0, lastFetchAt + MIN_GAP_MS - now);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastFetchAt = Date.now();
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`e-Gov ${res.status} ${res.statusText} for ${url}`);
  }
  return res;
}

/* ---------------- /laws (list / title search) ---------------- */

export interface EgovLawListItem {
  law_info: {
    law_type: string;
    law_id: string;            // e.g. 129AC0000000089
    law_num: string;
    promulgation_date: string;
  };
  revision_info: {
    law_revision_id: string;   // e.g. 129AC0000000089_20260401_506AC0000000033
    law_type: string;
    law_title: string;
    law_title_kana: string | null;
    category: string | null;
    amendment_promulgate_date: string | null;
    amendment_enforcement_date: string | null;
    current_revision_status: string;
  };
  current_revision_info?: unknown;
}

export interface EgovLawList {
  total_count: number;
  count: number;
  next_offset: number;
  laws: EgovLawListItem[];
}

export async function searchLaws(params: {
  law_title?: string;
  law_num?: string;
  category?: string;
  offset?: number;
  limit?: number;
}): Promise<EgovLawList> {
  const qs = new URLSearchParams({ response_format: 'json' });
  if (params.law_title) qs.set('law_title', params.law_title);
  if (params.law_num) qs.set('law_num', params.law_num);
  if (params.category) qs.set('category', params.category);
  qs.set('offset', String(params.offset ?? 0));
  qs.set('limit', String(params.limit ?? 30));
  const res = await throttledFetch(`${BASE}/laws?${qs.toString()}`);
  return (await res.json()) as EgovLawList;
}

/**
 * Enumerate all e-Gov revisions for a given law (matched by law_num).
 *
 * e-Gov `/laws?law_num=<num>` returns one row per `(law_id, law_revision_id)`
 * pair, so for amended laws this yields multiple rows differing only by
 * `revision_info.law_revision_id` / `amendment_enforcement_date`.
 *
 * If `lawNumOrId` looks like a law_id (alphanumeric prefix) we fall back
 * to a single-row response using `searchLaws({ law_title: '' })` indirectly
 * — that branch is rarely useful since callers can already pass a law_num.
 */
export async function searchLawRevisions(
  lawNumOrId: string,
): Promise<EgovLawList> {
  // Heuristic: real law_num always starts with a kanji era (明治 / 大正 / 昭和 / 平成 / 令和).
  const looksLikeLawNum = /^[明大昭平令]/.test(lawNumOrId);
  if (looksLikeLawNum) {
    return searchLaws({ law_num: lawNumOrId, limit: 100 });
  }
  // Otherwise treat as a law_id and just return a one-row stub by hitting
  // /law_data and shaping the metadata. The caller can still download via
  // fetchLawXml(lawNumOrId).
  const xml = await fetchLawXml(lawNumOrId);
  // crude extraction: <Law LawType="..." Year="..."> and <LawTitle>
  const num = /<LawNum[^>]*>([^<]+)<\/LawNum>/.exec(xml)?.[1] ?? '';
  const title = /<LawTitle[^>]*>([^<]+)<\/LawTitle>/.exec(xml)?.[1] ?? '';
  return {
    total_count: 1,
    count: 1,
    next_offset: 0,
    laws: [
      {
        law_info: {
          law_type: '',
          law_id: lawNumOrId,
          law_num: num,
          promulgation_date: '',
        },
        revision_info: {
          law_revision_id: lawNumOrId,
          law_type: '',
          law_title: title,
          law_title_kana: null,
          category: null,
          amendment_promulgate_date: null,
          amendment_enforcement_date: null,
          current_revision_status: '',
        },
      },
    ],
  };
}

/* ---------------- /law_data/{id_or_num} ---------------- */

/**
 * Fetches law XML. The id can be either the 15-char law_id (e.g. 129AC0000000089)
 * or the longer revision id (e.g. 129AC0000000089_20260401_506AC0000000033).
 * Returns the raw XML string.
 */
export async function fetchLawXml(idOrRevId: string): Promise<string> {
  const url = `${BASE}/law_data/${encodeURIComponent(idOrRevId)}?response_format=xml`;
  const res = await throttledFetch(url);
  return res.text();
}

/* ---------------- /keyword ---------------- */

export interface EgovKeywordHit {
  law_id: string;
  law_revision_id?: string;
  law_title: string;
  sentence_text?: string;
  article_num?: string;
}

export async function keywordSearch(q: string, limit = 30): Promise<EgovKeywordHit[]> {
  const qs = new URLSearchParams({
    response_format: 'json',
    keyword: q,
    limit: String(limit),
  });
  const res = await throttledFetch(`${BASE}/keyword?${qs.toString()}`);
  const data = (await res.json()) as { hits?: EgovKeywordHit[]; results?: EgovKeywordHit[] };
  return data.hits ?? data.results ?? [];
}

const API = 'https://en.wikipedia.org/w/api.php';
const HEADERS = { 'User-Agent': 'VeriMind/1.0 (trust-aware agent research demo)' };
export const WIKIPEDIA_RELIABILITY = 0.8;

async function getJson(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', utf8: '1', origin: '*', ...params })}`;
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}`);
  return res.json();
}

/**
 * Search Wikipedia and return the intro extract of the top results.
 * Returns [] on network failure so a flaky source lowers confidence instead of crashing the agent.
 */
export async function searchWikipedia(q, limit = 2) {
  try {
    const search = await getJson({ action: 'query', list: 'search', srsearch: q, srlimit: String(limit) });
    const hits = search?.query?.search || [];
    if (!hits.length) return [];
    const pages = await getJson({
      action: 'query',
      prop: 'extracts',
      exintro: '1',
      explaintext: '1',
      exchars: '1200',
      pageids: hits.map((h) => h.pageid).join('|'),
    });
    return Object.values(pages?.query?.pages || {})
      .filter((p) => p.extract)
      .map((p) => ({
        title: p.title,
        url: `https://en.wikipedia.org/?curid=${p.pageid}`,
        snippet: p.extract,
        source: 'wikipedia',
        reliability: WIKIPEDIA_RELIABILITY,
      }));
  } catch (err) {
    console.warn('[wikipedia] lookup failed:', err.message);
    return [];
  }
}

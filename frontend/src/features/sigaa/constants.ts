/**
 * SIGAA opens an activity through a JSF postback, so the listing URL never
 * changes and the POST cannot be replayed from outside the session. The detail
 * page itself publishes this permalink, which answers a plain GET with a cold
 * session. Built here rather than scraped because SIGAA serves it over http.
 */
const SIGAA_DETAIL_BASE_URL =
  "https://sigaa.sig.ufal.br/sigaa/link/public/extensao/visualizacaoAcaoExtensao";

/**
 * The scraper falls back to a sha256 of the title when the row carries no
 * numeric id (SigaaScraperService.ts), and that hash would build a dead link.
 */
export function sigaaDetailUrl(sigaaId: string): string | null {
  return /^\d+$/.test(sigaaId) ? `${SIGAA_DETAIL_BASE_URL}/${sigaaId}` : null;
}

/**
 * Ordering is part of the API contract (orderBy/order are validated server
 * side), unlike type and department, which are data and must come from
 * GET /sigaa-activities/filters.
 */
export const SIGAA_ORDER_OPTIONS = [
  {
    value: "recent",
    label: "Visto pela última vez",
    orderBy: "lastSeenAt",
    order: "desc",
  },
  { value: "title-asc", label: "Título (A-Z)", orderBy: "title", order: "asc" },
  {
    value: "title-desc",
    label: "Título (Z-A)",
    orderBy: "title",
    order: "desc",
  },
] as const;

export const DEFAULT_SIGAA_ORDER = SIGAA_ORDER_OPTIONS[0].value;

export const SIGAA_PAGE_SIZE = 10;

export const ALL_OPTION = "all";

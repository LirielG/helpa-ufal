import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router";

/**
 * What counts as "another page" for scrolling. Feed filters and pagination
 * live in the query and keep the scroll; the lists of /my-activities also
 * live in the query, but each one is its own page in the sidebar.
 */
function pageKey(pathname: string, search: string) {
  if (pathname !== "/my-activities") return pathname;
  return `${pathname}?${new URLSearchParams(search).get("filter") ?? ""}`;
}

/**
 * BrowserRouter has no <ScrollRestoration>, so without this a new page opens
 * at the scroll height the previous one was left at.
 */
export function ScrollToTop() {
  const { pathname, search } = useLocation();
  const navigationType = useNavigationType();
  const key = pageKey(pathname, search);
  const previousKey = useRef(key);

  useLayoutEffect(() => {
    if (previousKey.current === key) return;
    previousKey.current = key;

    // Back and Forward keep whatever position the browser restores.
    if (navigationType === "POP") return;

    window.scrollTo(0, 0);
  }, [key, navigationType]);

  return null;
}

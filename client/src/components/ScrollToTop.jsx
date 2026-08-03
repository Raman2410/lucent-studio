import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * ScrollToTop — React Router (unlike a traditional multi-page site)
 * does NOT reset scroll position on navigation by default, since it's
 * just swapping components in place. Without this, clicking a link
 * while scrolled halfway down a page lands you halfway down the next
 * page too. Mounted once near the top of the router so it runs on
 * every path change.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  // useLayoutEffect (not useEffect) runs synchronously after the DOM
  // updates but BEFORE the browser paints. Using useEffect here caused
  // the new page to render at the old scroll position first, then jump
  // to the top a frame later — visible as the page "sliding up" from
  // wherever the previous page had scrolled to.
  useLayoutEffect(() => {
    // plain window.scrollTo(x, y) is always an instant jump — no
    // "behavior" option needed (and "instant" isn't even a standard
    // value, some browsers silently ignore it and fall through to a
    // smooth/deferred scroll, which is what caused the "new page
    // slides up from the bottom" symptom).
    window.scrollTo(0, 0);
    // fallback for older iOS Safari, which sometimes ignores
    // window.scrollTo when the scrolling element is <body>/<html>
    // instead of the window itself
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);

  return null;
}

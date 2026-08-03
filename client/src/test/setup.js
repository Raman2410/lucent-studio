import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement matchMedia — ThemeContext (and any prefers-color-scheme
// check) needs a stub or it throws on mount.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// jsdom doesn't implement scrollTo — used by route-change scroll-to-top logic.
window.scrollTo = window.scrollTo || (() => {});

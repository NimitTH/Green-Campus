export type ThemeChoice = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "theme";

export function parseThemeChoice(value: string | null): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}

// The single icon button flips whichever theme is on screen (system is only the starting point).
export function nextThemeChoice(showingDark: boolean): "light" | "dark" {
  return showingDark ? "light" : "dark";
}

export function readThemeChoice(storage: Pick<Storage, "getItem"> | undefined): ThemeChoice {
  try {
    return parseThemeChoice(storage ? storage.getItem(THEME_STORAGE_KEY) : null);
  } catch {
    return "system";
  }
}

// Sets or clears <html data-theme>, then persists. Storage can throw (Safari private mode, blocked site data):
// the attribute is applied first and storage errors are swallowed, so the choice still works for this page view.
export function applyThemeChoice(
  choice: ThemeChoice,
  root: Pick<Element, "setAttribute" | "removeAttribute">,
  storage: Pick<Storage, "setItem" | "removeItem"> | undefined,
): void {
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
  try {
    if (choice === "system") storage?.removeItem(THEME_STORAGE_KEY);
    else storage?.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // ignore
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event("themechange"));
}

// Runs synchronously in <head> before first paint (docs: preventing-flash-before-hydration.md, Themes).
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

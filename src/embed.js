/**
 * Embed entry: parse query params, then boot the shared atlas UI.
 * @see documentation/EMBED.md
 */

function readEmbedSearchParams() {
  const params = new URLSearchParams(location.search);
  const ui = params.get("ui") || "default";
  const parentOrigin = params.get("parentOrigin") || undefined;
  const modes = params.get("modes");
  return {
    embed: true,
    ui,
    uiMinimal: ui === "minimal",
    scene: params.get("scene") || undefined,
    part: params.get("part") || undefined,
    theme: params.get("theme") || undefined,
    locale: params.get("locale") || undefined,
    parentOrigin,
    modes: modes ? modes.split(",").map((m) => m.trim()).filter(Boolean) : null,
    analytics: params.get("analytics") !== "1",
  };
}

globalThis.__OMF_EMBED__ = readEmbedSearchParams();

if (globalThis.__OMF_EMBED__.theme === "dark" || globalThis.__OMF_EMBED__.theme === "light") {
  document.documentElement.dataset.theme = globalThis.__OMF_EMBED__.theme;
}

document.documentElement.classList.add("embed-document");

await import("./main.js");

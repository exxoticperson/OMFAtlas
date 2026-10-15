/** Progressive disclosure: one primary panel (layers or details), scene stays primary. */
export function initShellNav({ compact = true } = {}) {
  if (compact) document.body.classList.add("shell-compact");

  const sidebar = () => document.querySelector(".studio .sidebar");
  const layersBtn = () => document.querySelector("#mobile-library");
  const detailsBtn = () => document.querySelector("#toggle-details");

  const syncDetailsInert = (open) => {
    const inspector = document.querySelector("#inspector");
    if (!inspector) return;
    if (open) inspector.removeAttribute("inert");
    else inspector.setAttribute("inert", "");
  };

  const closeLayers = () => {
    const el = sidebar();
    if (el) {
      el.classList.remove("shell-open", "expanded");
    }
    layersBtn()?.setAttribute("aria-expanded", "false");
    if (document.body.dataset.shellPanel === "layers") {
      delete document.body.dataset.shellPanel;
    }
  };

  const openLayers = () => {
    document.body.classList.remove("details-open");
    syncDetailsInert(false);
    detailsBtn()?.setAttribute("aria-expanded", "false");
    sidebar()?.classList.add("shell-open");
    layersBtn()?.setAttribute("aria-expanded", "true");
    document.body.dataset.shellPanel = "layers";
  };

  const closeDetails = () => {
    document.body.classList.remove("details-open");
    syncDetailsInert(false);
    detailsBtn()?.setAttribute("aria-expanded", "false");
    if (document.body.dataset.shellPanel === "details") {
      delete document.body.dataset.shellPanel;
    }
  };

  const openDetails = () => {
    closeLayers();
    document.body.classList.add("details-open");
    syncDetailsInert(true);
    detailsBtn()?.setAttribute("aria-expanded", "true");
    document.body.dataset.shellPanel = "details";
  };

  const toggleLayers = () => {
    const el = sidebar();
    if (el?.classList.contains("shell-open")) closeLayers();
    else openLayers();
  };

  return {
    openLayers,
    closeLayers,
    openDetails,
    closeDetails,
    toggleLayers,
    collapseLibrary: () => closeLayers(),
  };
}

function touchLayout() {
  return matchMedia("(max-width: 860px)").matches;
}

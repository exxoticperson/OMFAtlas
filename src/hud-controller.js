/**
 * Senior Designer HUD Controller for OMFAtlas 2.0.
 * Orchestrates the floating glass HUD, Command Search (Cmd+K), Contextual Inspector,
 * X-Ray sliders, and Studio turntable mode.
 */

import { getToothData, getStructureData, TOOTH_CLINICAL_GRAPH, CLINICAL_LA_PROTOCOLS } from "./anatomy-graph.js";
import { createSearchIndex, queryIndex } from "./command-search.js";

export function initModernHUD({ host, atlas, state, viewerApi, onSelectPart, onSetTab, onExplode }) {
  let searchIndex = [];
  let isTurntableActive = false;
  let isCleanModeActive = false;

  // Build the HUD DOM
  const hudContainer = document.createElement("div");
  hudContainer.id = "omf-modern-hud";
  hudContainer.innerHTML = `
    <!-- Top HUD -->
    <header id="omf-top-hud">
      <div class="hud-island hud-interactive">
        <div class="hud-brand">
          <span class="hud-status-led" title="Engine Active"></span>
          <span>OMF ATLAS</span>
          <span class="hud-badge-version">2.0</span>
        </div>
      </div>

      <div class="hud-interactive">
        <button type="button" class="hud-search-trigger" id="hud-cmd-trigger" aria-label="Search Anatomy (Cmd+K)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <span>Search anatomy or FDI #...</span>
          <span class="hud-kbd-badge">⌘K</span>
        </button>
      </div>

      <div class="hud-island hud-interactive">
        <button type="button" class="hud-icon-btn" id="hud-btn-theme" title="Toggle Light / Dark Mode">
          <svg id="hud-theme-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
        </button>
        <button type="button" class="hud-icon-btn" id="hud-btn-layers" title="Toggle Anatomy Layers">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
        </button>
        <button type="button" class="hud-icon-btn" id="hud-btn-turntable" title="Toggle 360° Studio Turntable">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
        </button>
        <button type="button" class="hud-icon-btn" id="hud-btn-clean" title="Toggle Studio Recording Mode (Hide UI)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
        <button type="button" class="hud-icon-btn" id="hud-btn-snapshot" title="Export 4K Clean Snapshot">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- Turntable Recording Indicator Banner -->
    <div id="omf-studio-banner">
      <span class="studio-rec-dot"></span>
      <span>STUDIO TURNTABLE · 360° REVOLUTION</span>
    </div>

    <!-- Floating Dissect / Separate Control Island -->
    <div id="omf-dissect-control" class="hud-interactive" aria-label="Dissection and Separation Control">
      <div class="dissect-header">
        <div class="dissect-title-wrap">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
          <span class="dissect-title">DISSECT &amp; SEPARATE</span>
        </div>
        <span class="dissect-badge" id="dissect-val-badge">0% · Assembled</span>
      </div>
      <div class="dissect-slider-row">
        <span class="dissect-endpoint">Assembled</span>
        <input type="range" id="dissect-range" min="0" max="100" value="0" class="dissect-slider" aria-label="Dissect and separate structures">
        <span class="dissect-endpoint">Inventory</span>
        <button type="button" class="dissect-reset-btn" id="dissect-btn-reset" title="Reassemble all structures to anatomical position">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          <span>Reset</span>
        </button>
      </div>
    </div>

    <!-- Floating Bottom Dock -->
    <nav id="omf-bottom-dock" aria-label="Main Navigation Dock">
      <button type="button" class="hud-dock-item active" data-dock="anatomy">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/></svg>
        <span>Anatomy</span>
      </button>
      <button type="button" class="hud-dock-item" data-dock="intraoral">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M7 11v6a5 5 0 0 0 10 0v-6"/><path d="M4 11h16"/></svg>
        <span>Intra-Oral</span>
      </button>
      <button type="button" class="hud-dock-item" data-dock="xray">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M2 12h20M12 2v20M5 5l14 14M19 5L5 19"/></svg>
        <span>Endo & X-Ray</span>
      </button>
      <button type="button" class="hud-dock-item" data-dock="simulator">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m18 2 4 4-12 12H6v-4L18 2z"/><line x1="14" y1="6" x2="18" y2="10"/></svg>
        <span>LA Simulator</span>
      </button>
    </nav>

    <!-- X-Ray & Glass Controls Float -->
    <div id="omf-glass-controls">
      <div class="glass-control-row">
        <div class="glass-control-header">
          <span>Enamel Translucency</span>
          <span id="label-enamel-opacity">100%</span>
        </div>
        <input type="range" class="glass-slider" id="slider-enamel-opacity" min="15" max="100" value="100">
      </div>
      <div class="glass-control-row">
        <div class="glass-control-header">
          <span>Bone Cortical Opacity</span>
          <span id="label-bone-opacity">100%</span>
        </div>
        <input type="range" class="glass-slider" id="slider-bone-opacity" min="10" max="100" value="100">
      </div>
    </div>

    <!-- Contextual Inspector (Right) -->
    <aside id="omf-inspector-card" aria-label="Selected Structure Details">
      <div class="inspector-header">
        <div>
          <span class="inspector-fdi-badge" id="insp-fdi">#--</span>
          <div class="inspector-title" id="insp-title">Structure</div>
          <div class="inspector-subtitle" id="insp-sub">Category</div>
        </div>
        <button type="button" class="hud-icon-btn" id="insp-close" aria-label="Close Inspector">✕</button>
      </div>

      <div class="inspector-section" id="insp-clinical-section">
        <div class="inspector-label">Internal Anatomy & Canals</div>
        <div class="inspector-value" id="insp-canals">--</div>
      </div>

      <div class="inspector-section">
        <div class="inspector-label">Sensory Innervation</div>
        <div class="inspector-value" id="insp-nerve">--</div>
      </div>

      <div class="inspector-section" id="insp-safety-section">
        <div class="inspector-label">Canal Proximity / Safety</div>
        <div class="inspector-value" id="insp-safety">--</div>
      </div>

      <div class="inspector-actions">
        <button type="button" class="inspector-chip primary" id="insp-btn-trace">Trace Nerve Path</button>
        <button type="button" class="inspector-chip" id="insp-btn-solo">Solo View</button>
      </div>
    </aside>

    <!-- Dedicated LA Simulator Floating Suite -->
    <aside id="omf-la-simulator-card" aria-label="Local Anesthesia 3D Simulator">
      <div class="la-card-header">
        <div>
          <span class="la-card-badge">CLINICAL LA SIMULATOR</span>
          <div class="la-card-title" id="la-block-title">Inferior Alveolar Nerve Block (IANB)</div>
          <div class="la-card-sub" id="la-block-sub">Halsted / Spix Mandibular Block</div>
        </div>
        <button type="button" class="hud-icon-btn" id="la-close-btn" aria-label="Close Simulator">✕</button>
      </div>

      <!-- Protocol Selection Pills -->
      <div class="la-pills-row">
        <button type="button" class="la-pill-btn active" data-protocol="ianb">IANB</button>
        <button type="button" class="la-pill-btn" data-protocol="mental">Mental</button>
        <button type="button" class="la-pill-btn" data-protocol="psa">PSA</button>
        <button type="button" class="la-pill-btn" data-protocol="infraorbital">Infraorbital</button>
        <button type="button" class="la-pill-btn" data-protocol="greater_palatine">Palatine</button>
      </div>

      <div class="la-specs-grid">
        <div class="la-spec-item">
          <div class="la-spec-label">Target Landmark & Depth</div>
          <div class="la-spec-val" id="la-spec-landmark">Pterygomandibular space (20-25 mm)</div>
        </div>
        <div class="la-spec-item">
          <div class="la-spec-label">Needle Gauge & Length</div>
          <div class="la-spec-val" id="la-spec-gauge">25G / 27G Long (32mm)</div>
        </div>
        <div class="la-spec-item">
          <div class="la-spec-label">Anesthetized Field</div>
          <div class="la-spec-val" id="la-spec-field">Lower quadrant pulpal & lingual tissues</div>
        </div>
        <div class="la-spec-item">
          <div class="la-spec-label">Complication Avoidance</div>
          <div class="la-spec-val highlight" id="la-spec-pearl">Bone contact mandatory to avoid parotid gland penetration</div>
        </div>
      </div>

      <div class="la-actions-row">
        <button type="button" class="la-action-btn primary" id="la-btn-pulse">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <span>Pulse Nerve Deposition</span>
        </button>
        <button type="button" class="la-action-btn" id="la-btn-clear">Clear Block</button>
      </div>
    </aside>

    <!-- Command Spotlight Modal (Cmd+K) -->
    <div id="omf-spotlight-overlay" role="dialog" aria-modal="true" aria-label="Anatomy Spotlight Search">
      <div class="spotlight-card">
        <div class="spotlight-input-wrap">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" class="spotlight-input" id="spotlight-search-input" placeholder="Type tooth # (e.g. 36), nerve (e.g. IAN), or landmark..." autocomplete="off" spellcheck="false">
          <span class="hud-kbd-badge">ESC</span>
        </div>
        <div class="spotlight-results" id="spotlight-results-list"></div>
      </div>
    </div>
  `;

  document.body.appendChild(hudContainer);

  // Initialize Search Index
  searchIndex = createSearchIndex(atlas);

  // Wire Spotlight Modal
  const overlay = document.querySelector("#omf-spotlight-overlay");
  const searchInput = document.querySelector("#spotlight-search-input");
  const resultsList = document.querySelector("#spotlight-results-list");
  const cmdTrigger = document.querySelector("#hud-cmd-trigger");

  function openSpotlight() {
    overlay.classList.add("open");
    searchInput.value = "";
    renderResults(queryIndex(searchIndex, "36")); // default preview
    setTimeout(() => searchInput.focus(), 50);
  }

  function closeSpotlight() {
    overlay.classList.remove("open");
    searchInput.blur();
  }

  cmdTrigger.addEventListener("click", openSpotlight);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeSpotlight();
  });

  // Global Keyboard Shortcuts
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (overlay.classList.contains("open")) closeSpotlight();
      else openSpotlight();
    } else if (e.key === "Escape") {
      if (overlay.classList.contains("open")) {
        closeSpotlight();
      } else if (inspectorCard.classList.contains("visible")) {
        inspectorCard.classList.remove("visible");
        if (onSelectPart) onSelectPart(null);
      }
      if (isCleanModeActive) toggleCleanMode();
    } else if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
      e.preventDefault();
      openSpotlight();
    }
  });

  function renderResults(items) {
    if (!items.length) {
      resultsList.innerHTML = `<div style="padding: 24px; text-align: center; color: #64748b; font-size: 13px;">No matching anatomy or teeth found. Try searching by FDI number (#36) or nerve name.</div>`;
      return;
    }

    resultsList.innerHTML = items
      .map(
        (item, index) => `
      <div class="spotlight-result-item ${index === 0 ? "selected" : ""}" data-item-id="${item.id}" data-item-fdi="${item.fdi || ""}" data-protocol-id="${item.action?.protocol?.id || ""}">
        <div class="spotlight-result-main">
          <div class="spotlight-result-title">${item.title}</div>
          <div class="spotlight-result-sub">${item.subtitle}</div>
        </div>
        <span class="spotlight-result-badge">${item.badge}</span>
      </div>
    `
      )
      .join("");

    resultsList.querySelectorAll(".spotlight-result-item").forEach((el) => {
      el.addEventListener("click", () => {
        const protoId = el.dataset.protocolId;
        const partId = el.dataset.itemId;
        const fdi = el.dataset.itemFdi;
        closeSpotlight();
        if (protoId) {
          const proto = CLINICAL_LA_PROTOCOLS[protoId];
          if (proto) {
            updateInspectorForProtocol(proto);
            if (viewerApi?.showLASimulator) viewerApi.showLASimulator(proto.id);
          }
        } else if (partId) {
          onSelectPart(partId);
          updateInspector(partId, fdi);
        }
      });
    });
  }

  searchInput.addEventListener("input", (e) => {
    const q = e.target.value;
    renderResults(queryIndex(searchIndex, q));
  });

  // Wire Bottom Dock Modes
  const dockItems = document.querySelectorAll(".hud-dock-item");
  const glassControls = document.querySelector("#omf-glass-controls");

  dockItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      dockItems.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const mode = btn.dataset.dock;

      if (mode === "anatomy") {
        glassControls.classList.remove("visible");
        toggleLASimulator(false);
        // Restore standard opacity
        if (viewerApi?.setGroupOpacity) {
          viewerApi.setGroupOpacity("teeth", 1.0);
          viewerApi.setGroupOpacity("bones", 1.0);
        }
        enamelSlider.value = "100";
        boneSlider.value = "100";
        enamelLabel.textContent = "100%";
        boneLabel.textContent = "100%";
        onSetTab("anatomy");
      } else if (mode === "intraoral") {
        glassControls.classList.remove("visible");
        toggleLASimulator(false);
        onSetTab("intraoral");
      } else if (mode === "xray") {
        glassControls.classList.add("visible");
        toggleLASimulator(false);
        onSetTab("anatomy");
        // Activate authentic CBCT / Panoramic X-Ray translucent diagnostic preset
        if (viewerApi?.setGroupOpacity) {
          viewerApi.setGroupOpacity("teeth", 0.42);
          viewerApi.setGroupOpacity("bones", 0.35);
        }
        enamelSlider.value = "42";
        boneSlider.value = "35";
        enamelLabel.textContent = "42%";
        boneLabel.textContent = "35%";
        // Pulse internal alveolar canal innervation
        if (viewerApi?.pulseInnervation) {
          viewerApi.pulseInnervation("IAN");
        }
      } else if (mode === "simulator") {
        glassControls.classList.remove("visible");
        toggleLASimulator(true);
      }
    });
  });

  // Wire Glass Sliders
  const enamelSlider = document.querySelector("#slider-enamel-opacity");
  const boneSlider = document.querySelector("#slider-bone-opacity");
  const enamelLabel = document.querySelector("#label-enamel-opacity");
  const boneLabel = document.querySelector("#label-bone-opacity");

  enamelSlider.addEventListener("input", (e) => {
    const val = parseInt(e.target.value, 10);
    enamelLabel.textContent = `${val}%`;
    if (viewerApi?.setGroupOpacity) {
      viewerApi.setGroupOpacity("teeth", val / 100);
    }
  });

  boneSlider.addEventListener("input", (e) => {
    const val = parseInt(e.target.value, 10);
    boneLabel.textContent = `${val}%`;
    if (viewerApi?.setGroupOpacity) {
      viewerApi.setGroupOpacity("bones", val / 100);
    }
  });

  // Theme Switcher Logic (Light / Dark)
  const themeBtn = document.querySelector("#hud-btn-theme");
  const themeIcon = document.querySelector("#hud-theme-icon");

  function syncThemeIcon() {
    const isDark = document.documentElement.dataset.theme !== "light";
    if (themeIcon) {
      themeIcon.innerHTML = isDark
        ? '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>'
        : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
    }
  }
  syncThemeIcon();

  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const isDark = document.documentElement.dataset.theme !== "light";
      const nextTheme = isDark ? "light" : "dark";
      document.documentElement.dataset.theme = nextTheme;
      try { localStorage.setItem("omf-theme", nextTheme); } catch {}
      syncThemeIcon();
    });
  }

  // Dissect / Separation Slider Logic
  const dissectRange = document.querySelector("#dissect-range");
  const dissectBadge = document.querySelector("#dissect-val-badge");
  const dissectReset = document.querySelector("#dissect-btn-reset");

  function updateDissectUI(val) {
    if (dissectRange) dissectRange.value = String(val);
    if (dissectBadge) {
      if (val === 0) dissectBadge.textContent = "0% · Assembled";
      else if (val < 50) dissectBadge.textContent = `${val}% · Separating`;
      else if (val < 90) dissectBadge.textContent = `${val}% · Dissected Stage`;
      else dissectBadge.textContent = `${val}% · Parts Inventory`;
    }
  }

  if (dissectRange) {
    dissectRange.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      updateDissectUI(val);
      if (onExplode) onExplode(val);
    });
  }

  if (dissectReset) {
    dissectReset.addEventListener("click", () => {
      updateDissectUI(0);
      if (onExplode) onExplode(0);
      if (viewerApi?.view) viewerApi.view("oblique", true);
    });
  }

  // Layers Drawer Toggle
  const layersBtn = document.querySelector("#hud-btn-layers");
  const sidebarPanel = document.querySelector(".sidebar.panel");
  if (layersBtn && sidebarPanel) {
    layersBtn.addEventListener("click", () => {
      sidebarPanel.classList.toggle("open");
      layersBtn.classList.toggle("active", sidebarPanel.classList.contains("open"));
    });
  }

  // Turntable Mode
  const turntableBtn = document.querySelector("#hud-btn-turntable");
  const studioBanner = document.querySelector("#omf-studio-banner");

  function toggleTurntable() {
    isTurntableActive = !isTurntableActive;
    turntableBtn.classList.toggle("active", isTurntableActive);
    studioBanner.classList.toggle("visible", isTurntableActive);
    if (viewerApi?.setTurntable) {
      viewerApi.setTurntable(isTurntableActive);
    }
  }
  turntableBtn.addEventListener("click", toggleTurntable);

  // Clean Recording Mode
  const cleanBtn = document.querySelector("#hud-btn-clean");
  function toggleCleanMode() {
    isCleanModeActive = !isCleanModeActive;
    cleanBtn.classList.toggle("active", isCleanModeActive);
    document.body.classList.toggle("hud-clean", isCleanModeActive);
  }
  cleanBtn.addEventListener("click", toggleCleanMode);

  // 4K Snapshot
  const snapshotBtn = document.querySelector("#hud-btn-snapshot");
  snapshotBtn.addEventListener("click", () => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `OMFAtlas-Snapshot-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  });

  // Inspector Card Logic
  const inspectorCard = document.querySelector("#omf-inspector-card");
  const inspFdi = document.querySelector("#insp-fdi");
  const inspTitle = document.querySelector("#insp-title");
  const inspSub = document.querySelector("#insp-sub");
  const inspCanals = document.querySelector("#insp-canals");
  const inspNerve = document.querySelector("#insp-nerve");
  const inspSafety = document.querySelector("#insp-safety");
  const inspSafetySection = document.querySelector("#insp-safety-section");
  const inspClose = document.querySelector("#insp-close");
  const inspBtnSolo = document.querySelector("#insp-btn-solo");
  const inspBtnTrace = document.querySelector("#insp-btn-trace");

  let activePartId = null;
  let activeToothFdi = null;

  function updateInspectorForProtocol(proto) {
    inspFdi.textContent = "LA BLOCK";
    inspTitle.textContent = proto.name;
    inspSub.textContent = proto.subtitle;
    inspCanals.textContent = `Target: ${proto.targetLandmark}`;
    inspNerve.textContent = `Anesthetized: ${proto.anesthetizedNerves.join(", ")} (${proto.anesthetizedTeeth})`;
    inspSafetySection.style.display = "block";
    inspSafety.textContent = `Needle: ${proto.needleGauge} · ${proto.needleAngle}. Depth: ${proto.penetrationDepth}. ${proto.clinicalPearls}`;
    inspBtnTrace.style.display = "block";
    inspBtnTrace.textContent = "Pulse Anesthetic";
    inspBtnSolo.textContent = "Clear Needle";
    inspectorCard.classList.add("visible");
  }

  function updateInspector(partId, fdi = null) {
    if (!partId) {
      inspectorCard.classList.remove("visible");
      activePartId = null;
      activeToothFdi = null;
      isPartSoloed = false;
      inspBtnSolo.textContent = "Solo View";
      inspBtnSolo.classList.remove("primary");
      return;
    }
    activePartId = partId;
    activeToothFdi = fdi;
    isPartSoloed = false;
    inspBtnSolo.textContent = "Solo View";
    inspBtnSolo.classList.remove("primary");

    // Check tooth clinical graph
    let toothInfo = null;
    if (fdi) {
      toothInfo = getToothData(fdi);
      activeToothFdi = fdi;
    } else {
      // Find by partId or FDI in name
      for (const t of Object.values(TOOTH_CLINICAL_GRAPH)) {
        if (t.bp3dId === partId || partId.includes(String(t.fdi))) {
          toothInfo = t;
          activeToothFdi = t.fdi;
          break;
        }
      }
    }

    if (toothInfo) {
      inspFdi.textContent = `#${toothInfo.fdi}`;
      inspTitle.textContent = toothInfo.shortName;
      inspSub.textContent = `Universal #${toothInfo.universal} · Quadrant ${toothInfo.quadrant}`;
      inspCanals.textContent = toothInfo.canals;
      inspNerve.textContent = toothInfo.nerve;
      if (toothInfo.safetyMargin) {
        inspSafetySection.style.display = "block";
        inspSafety.textContent = toothInfo.safetyMargin;
      } else {
        inspSafetySection.style.display = "none";
      }
      inspBtnTrace.style.display = "block";
    } else {
      const structInfo = getStructureData(partId);
      const part = atlas?.parts ? atlas.parts.find((p) => p.id === partId) : null;

      if (structInfo) {
        const cat = structInfo.category.toLowerCase();
        inspFdi.textContent = cat.includes("ganglion")
          ? "GANGLION"
          : cat.includes("sinus")
          ? "SINUS"
          : cat.includes("nerve")
          ? "NERVE"
          : "OMF";
        inspTitle.textContent = part?.name || structInfo.name;
        inspSub.textContent = structInfo.rootDivision || structInfo.category;
        inspCanals.textContent = structInfo.distribution || structInfo.drainage || part?.note || "";
        inspNerve.textContent = structInfo.roots || structInfo.innervation || structInfo.relations || "";
        if (structInfo.clinicalPearl) {
          inspSafetySection.style.display = "block";
          inspSafety.textContent =
            structInfo.clinicalPearl + (structInfo.laRelevance ? " " + structInfo.laRelevance : "");
        } else {
          inspSafetySection.style.display = "none";
        }
        inspBtnTrace.style.display = "none";
      } else if (part) {
        inspFdi.textContent = (part.group || "PART").toUpperCase();
        inspTitle.textContent = part.name;
        inspSub.textContent = part.schematic ? "OMF Teaching Geometry" : "BodyParts3D Segmentation";
        inspCanals.textContent = part.note || "Standard anatomical feature";
        inspNerve.textContent = `System: ${part.system || part.group || "Anatomical"}`;
        inspSafetySection.style.display = "none";
        inspBtnTrace.style.display = "none";
      } else {
        inspFdi.textContent = "PART";
        inspTitle.textContent = partId;
        inspSub.textContent = "Anatomical Structure";
        inspCanals.textContent = "Clinical morphology mapped in OMF Graph";
        inspNerve.textContent = "Cranial / Maxillofacial innervation branch";
        inspSafetySection.style.display = "none";
        inspBtnTrace.style.display = "none";
      }
    }

    inspectorCard.classList.add("visible");
  }

  inspClose.addEventListener("click", () => {
    inspectorCard.classList.remove("visible");
    if (onSelectPart) onSelectPart(null);
  });

  let isPartSoloed = false;
  inspBtnSolo.addEventListener("click", () => {
    if (activePartId && viewerApi?.soloPart) {
      isPartSoloed = !isPartSoloed;
      viewerApi.soloPart(activePartId, { ghostContext: true });
      inspBtnSolo.textContent = isPartSoloed ? "Exit Solo" : "Solo View";
      inspBtnSolo.classList.toggle("primary", isPartSoloed);
    }
  });

  inspBtnTrace.addEventListener("click", () => {
    if (viewerApi?.pulseInnervation) {
      const nerveTarget = activeToothFdi ? String(activeToothFdi) : activePartId || "IAN";
      viewerApi.pulseInnervation(nerveTarget);
      const originalText = inspBtnTrace.textContent;
      inspBtnTrace.textContent = "⚡ Pulsing Conduction...";
      setTimeout(() => {
        inspBtnTrace.textContent = originalText;
      }, 2500);
    }
  });

  // Dedicated Local Anesthesia Simulator Suite
  const laCard = document.querySelector("#omf-la-simulator-card");
  const laBlockTitle = document.querySelector("#la-block-title");
  const laBlockSub = document.querySelector("#la-block-sub");
  const laSpecLandmark = document.querySelector("#la-spec-landmark");
  const laSpecGauge = document.querySelector("#la-spec-gauge");
  const laSpecField = document.querySelector("#la-spec-field");
  const laSpecPearl = document.querySelector("#la-spec-pearl");
  const laCloseBtn = document.querySelector("#la-close-btn");
  const laBtnPulse = document.querySelector("#la-btn-pulse");
  const laBtnClear = document.querySelector("#la-btn-clear");
  const laPills = document.querySelectorAll(".la-pill-btn");

  let currentProtocolId = "ianb";

  function updateLASimulatorData(protoId) {
    currentProtocolId = protoId;
    const proto = CLINICAL_LA_PROTOCOLS[protoId] || CLINICAL_LA_PROTOCOLS.ianb;
    laBlockTitle.textContent = proto.name;
    laBlockSub.textContent = proto.subtitle;
    laSpecLandmark.textContent = `${proto.targetLandmark} (${proto.penetrationDepth})`;
    laSpecGauge.textContent = proto.needleGauge;
    laSpecField.textContent = `${proto.anesthetizedTeeth} | ${proto.softTissue}`;
    laSpecPearl.textContent = proto.clinicalPearls;

    laPills.forEach((p) => {
      p.classList.toggle("active", p.dataset.protocol === protoId);
    });

    if (viewerApi?.showLASimulator) {
      viewerApi.showLASimulator(protoId);
    }
  }

  function toggleLASimulator(open = true) {
    if (open) {
      laCard.classList.add("visible");
      inspectorCard.classList.remove("visible");
      updateLASimulatorData(currentProtocolId);
    } else {
      laCard.classList.remove("visible");
      if (viewerApi?.showLASimulator) {
        viewerApi.showLASimulator(null);
      }
      dockItems.forEach((b) => b.classList.remove("active"));
      const anatomyDock = document.querySelector('.hud-dock-item[data-dock="anatomy"]');
      if (anatomyDock) anatomyDock.classList.add("active");
    }
  }

  laPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      updateLASimulatorData(pill.dataset.protocol);
    });
  });

  laCloseBtn.addEventListener("click", () => toggleLASimulator(false));
  laBtnClear.addEventListener("click", () => toggleLASimulator(false));

  laBtnPulse.addEventListener("click", () => {
    if (viewerApi?.pulseInnervation) {
      viewerApi.pulseInnervation(currentProtocolId);
      const originalText = laBtnPulse.innerHTML;
      laBtnPulse.innerHTML = "<span>⚡ Pulsing Na+ Conduction...</span>";
      setTimeout(() => {
        laBtnPulse.innerHTML = originalText;
      }, 2500);
    }
  });

  // Auto-dim HUD during orbit interaction
  let dimTimeout = null;
  host.addEventListener("pointerdown", () => {
    document.body.classList.add("hud-dimmed");
    clearTimeout(dimTimeout);
  });
  window.addEventListener("pointerup", () => {
    dimTimeout = setTimeout(() => {
      document.body.classList.remove("hud-dimmed");
    }, 300);
  });

  return {
    updateInspector,
    openSpotlight,
    closeSpotlight,
    toggleTurntable,
    toggleCleanMode,
  };
}

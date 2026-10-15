/** Tap-friendly layer toggles (replaces checkbox rows). */

export const LAYER_SHORT = {
  bones: "Bone",
  neck: "Neck",
  teeth: "Teeth",
  gingiva: "Gums",
  muscles: "Muscle",
  arteries: "Artery",
  veins: "Vein",
  nerves: "Nerve",
  brain: "Brain",
  eyes: "Face & eye",
  glands: "Gland",
  airway: "Airway",
  soft: "Soft tissue",
  skin: "Skin",
};

/**
 * @param {object} opts
 * @param {typeof import("./content.js").groups} opts.groups
 * @param {object} opts.state
 * @param {object} opts.atlas
 * @param {(key: string) => number} opts.groupOpacity
 * @param {(p: object) => boolean} opts.isSchematic
 * @param {Set<string>} opts.MASTICATORY
 */
export function buildLayerChipsHtml({
  groups,
  state,
  atlas,
  groupOpacity,
  isSchematic,
  MASTICATORY,
}) {
  const layerKeys = Object.keys(groups).filter((key) =>
    atlas.parts.some((p) => p.group === key),
  );

  const meta = `
    <button type="button" class="layer-chip layer-chip-meta ${state.schematic ? "is-on" : ""}" data-toggle-schematic aria-pressed="${state.schematic}" title="Schematic nerves, vessels, glands">
      <span class="chip-dot schematic-dot"></span><span class="chip-label">Schematic</span>
    </button>
    <button type="button" class="layer-chip layer-chip-meta ${state.masticatory !== false ? "is-on" : ""}" data-toggle-masticatory aria-pressed="${state.masticatory !== false}" title="Muscles of mastication">
      <span class="chip-dot" style="background:${groups.muscles.color}"></span><span class="chip-label">Chew</span>
    </button>`;

  const chips = layerKeys
    .map((key) => {
      const g = groups[key];
      const on = state.layers.has(key);
      const label = LAYER_SHORT[key] || g.name.split(/[&/]/)[0].trim();
      return `<button type="button" class="layer-chip ${on ? "is-on" : ""}" data-layer-toggle="${key}" aria-pressed="${on}" style="--chip-color:${g.color}" title="${g.name} — tap toggle, Shift+tap solo">
        <span class="chip-dot" aria-hidden="true"></span><span class="chip-label">${label}</span>
      </button>`;
    })
    .join("");

  const fadeRows = layerKeys
    .filter((key) => state.layers.has(key))
    .map((key) => {
      const g = groups[key];
      const val = Math.round(groupOpacity(key) * 100);
      return `<label class="chip-fade-row"><span>${LAYER_SHORT[key] || g.name}</span><input type="range" min="15" max="100" value="${val}" data-opacity="${key}" aria-label="${g.name} opacity"></label>`;
    })
    .join("");

  const nerveNote =
    state.schematic && !state.layers.has("nerves")
      ? `<p class="fine-print chip-nerve-note">Turn on the <strong>Nerve</strong> chip to see OMF schematic nerves (IAN, lingual, facial branches, etc.). Source meshes are mostly orbital unless you search by name.</p>`
      : state.layers.has("nerves") && state.schematic
        ? `<p class="fine-print chip-nerve-note">Yellow tubes = schematic OMF nerves fitted to this skull. Orbital nerves come from BodyParts3D.</p>`
        : state.layers.has("nerves") && !state.schematic
          ? `<p class="fine-print chip-nerve-note">Schematic is off — only source (mostly orbital) nerves are drawn. Turn <strong>Schematic</strong> on for IAN, V2/V3 branches, and facial nerve.</p>`
          : "";
  return `<div class="layer-chip-grid" role="group" aria-label="Anatomy layers">${meta}${chips}</div>
    ${nerveNote}
    <p class="chip-hint">Tap to toggle · <kbd>Shift</kbd>+tap solo layer · <kbd>Alt</kbd>+click a structure to solo its layer</p>
    <details class="layer-fades-panel" ${fadeRows ? "" : "hidden"}><summary>Opacity</summary>${fadeRows || "<p class=\"fine-print\">Turn on a layer to fade it.</p>"}</details>`;
}

/** @param {ParentNode} root */
export function bindLayerChips(root, { state, updateScene, renderBrowser }) {
  root.querySelectorAll("[data-layer-toggle]").forEach((btn) => {
    btn.onclick = (e) => {
      const key = btn.dataset.layerToggle;
      state.isolated = false;
      state.toothDetail = false;
      if (e.shiftKey) {
        state.layers = new Set([key]);
      } else if (state.layers.has(key)) {
        state.layers.delete(key);
      } else {
        state.layers.add(key);
      }
      updateScene();
      renderBrowser();
    };
  });
  root.querySelector("[data-toggle-schematic]")?.addEventListener("click", () => {
    state.schematic = !state.schematic;
    updateScene();
    renderBrowser();
  });
  root.querySelector("[data-toggle-masticatory]")?.addEventListener("click", () => {
    state.masticatory = state.masticatory === false;
    updateScene();
    renderBrowser();
  });
  root.querySelectorAll("[data-opacity]").forEach((slider) => {
    slider.oninput = () => {
      const value = Number(slider.value) / 100;
      if (value >= 1) state.opacity.delete(slider.dataset.opacity);
      else state.opacity.set(slider.dataset.opacity, value);
      updateScene();
    };
  });
}

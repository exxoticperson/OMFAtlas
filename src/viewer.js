import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { MASTICATORY, groups, toothNumber } from "./content.js";
import {
  applyFinishToMaterial,
  materialEmissive,
  materialEmissiveIntensity,
  partColor,
  surfaceKind,
  SURFACE_FINISH_V2,
  toneMappingExposureFor,
} from "./realism-v2.js";
import {
  INTRAORAL_PRESETS,
  intraoralHighResEligible,
  intraoralStatusMessage,
  intraoralVisible,
  isIntraoralEligible,
  oralLookKey,
  setOralStudioLighting,
  SHIPPED_HR_PART_IDS,
  syncOralLook,
} from "./intraoral.js";
import { performanceTier, pixelRatioCap, preferLiteMaterial } from "./perf.js";
import { createExplosionLayout, explodedOffset, explosionControls, explosionStage, smoothstep } from "./explosion-layout.js";
import { createSchematicParts, deriveLandmarks } from "./schematic-anatomy.js";
import {
  buffersForArch,
  buffersForTooth,
  buffersForView,
  createModelGroup,
  createPublishedDentitionModel,
  createPublishedToothModel,
  groupsInView,
  publishedToothPlan,
} from "./dental-models.js";
import {
  createToothModel,
  createDentitionModel,
  setToothSection,
} from "./dental-geometry.js";

export async function createViewer(host, atlas, handlers) {
  const {
    onSelect,
    onReady,
    onDetail,
    onToothSelect,
    onExitDetail,
    onExplode = () => {},
    onPartsChanged = () => {},
    onHover = () => {},
    onProgress = () => {},
    onOrient = () => {},
    onModelsReady = () => {},
  } = handlers;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.001, 10);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  // Sharpness is bought with pixels, so the ratio is capped three ways: by a
  // ceiling for the device class, by the display's own ratio, and by a pixel
  // budget so a 4K window does not quadruple the fill cost for a head that is
  // a few hundred meshes. Phones and short windows get a lower ceiling, as in
  // the reference.
  const PERF_TIER = performanceTier();
  const MAX_PIXELS = PERF_TIER === "low" ? 6e6 : PERF_TIER === "medium" ? 7.5e6 : 9e6;
  const pixelRatioFor = (width, height) => {
    const compact = innerWidth < 768 || innerHeight < 600;
    const cap = pixelRatioCap(PERF_TIER);
    const budget = Math.sqrt(MAX_PIXELS / Math.max(1, width * height));
    return Math.max(
      1,
      Math.min(devicePixelRatio || 1, compact ? Math.min(1.5, cap) : cap, budget),
    );
  };
  renderer.setPixelRatio(pixelRatioFor(host.clientWidth, host.clientHeight));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // ACES keeps the pale bone and enamel from clipping under the key light and
  // rolls the highlights off the way a photograph does.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.localClippingEnabled = true;
  host.append(renderer.domElement);
  renderer.domElement.setAttribute(
    "aria-label",
    "Interactive 3D anatomy. Drag to rotate, scroll to zoom. Use the structure list and view buttons for keyboard access.",
  );
  const controls = new OrbitControls(camera, renderer.domElement);
  // Damped orbit, as in the reference: a drag keeps a little momentum and
  // settles, which reads as weight. The frame loop below drives the damping.
  controls.enableDamping = true;
  controls.dampingFactor = 0.092;
  const defaultDamping = 0.092;
  const intraoralDamping = 0.108;
  controls.zoomToCursor = true;
  controls.minDistance = 0.008;
  controls.maxDistance = 1.2;
  // Light is a room plus three lamps. The room (an image-based environment)
  // gives every surface something to reflect, so ridges and foramina read as
  // form instead of as flat colour; the lamps add a warm key from the upper
  // left, a cool rim from behind and a soft sky/ground fill. None of it casts
  // shadows, which would cost frames for little information on a small model.
  const environment = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environmentTarget = environment.fromScene(room, 0.04);
  scene.environment = environmentTarget.texture;
  room.dispose();
  environment.dispose();
  // A three point rig in a camera-relative frame would shift as the reader
  // orbits; these are fixed in the scene, so the head keeps one consistent
  // lit side, which is what lets a reader read relief while turning it.
  const ambient = new THREE.HemisphereLight(0xf2f4fa, 0x7a756f, 0.52);
  scene.add(ambient);
  const light = new THREE.DirectionalLight(0xfff0dc, 2.35);
  light.position.set(-1.4, 2.2, 2.6);
  scene.add(light);
  const fill = new THREE.DirectionalLight(0xd8e4f8, 0.85);
  fill.position.set(2.2, 0.6, 1.4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xc8d8f0, 1.65);
  rim.position.set(0.8, 1.6, -3);
  scene.add(rim);
  const oralPoint = new THREE.PointLight(0xfff6ea, 0, 0.22);
  oralPoint.position.set(0.02, 1.548, 0.06);
  oralPoint.visible = false;
  scene.add(oralPoint);
  const lightRig = { ambient, key: light, fill, rim, oralPoint };
  // What each kind of tissue looks like under the same light. Bone is dry and
  // diffuse; enamel is hard with a thin glaze; soft tissue is damp, a low
  // broad clearcoat with a velvet sheen at grazing angles; vessels and nerves
  // are small, tight and glossy; the eye is a wet lens. Nothing is metallic.
  const finishFor = (part) =>
    SURFACE_FINISH_V2[surfaceKind(part)] ?? SURFACE_FINISH_V2.tissue;
  const BASE_BUFFER = "/models/omf.bin";
  async function loadBuffer(url, report) {
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(
        `The anatomy geometry could not be loaded: ${url} (HTTP ${response.status}).`,
      );
    const total = Number(response.headers.get("content-length")) || 0;
    // Without a length header, or without a readable stream, fall back to the
    // whole buffer at once rather than reporting a progress bar that lies.
    if (!report || !total || !response.body) return response.arrayBuffer();
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      report(Math.min(99, Math.round((received / total) * 100)));
    }
    const buffer = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }
    report(100);
    return buffer.buffer;
  }
  // Only the base assembly is awaited. The registered facial muscles are
  // another 15.6 MB and the first frame does not need them, so they arrive
  // afterwards and their meshes join the scene when they do.
  const buffers = new Map([[BASE_BUFFER, await loadBuffer(BASE_BUFFER, onProgress)]]);
  function geometryFrom(part, buffer) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array(buffer, part.positions, part.vertexCount * 3),
        3,
      ),
    );
    geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(
        new Int16Array(buffer, part.normals, part.vertexCount * 3),
        3,
        true,
      ),
    );
    geometry.setIndex(
      new THREE.BufferAttribute(
        new Uint32Array(buffer, part.indices, part.indexCount),
        1,
      ),
    );
    geometry.computeBoundingBox();
    return geometry;
  }
  const meshes = [];
  let cachedPresentation = null;
  function addMesh(part, geometry) {
    const finish = finishFor(part);
    const lite = preferLiteMaterial(part);
    const MaterialCtor = lite ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial;
    const materialOptions = {
      color: partColor(part, groups, { presentation: "clinical" }),
      metalness: 0,
      side: THREE.DoubleSide,
      emissive: "#000000",
      emissiveIntensity: 0,
      roughness: part.schematic ? 0.65 : (finish.roughness ?? 0.55),
      envMapIntensity: part.schematic ? 0.55 : (finish.envMapIntensity ?? 0.75),
    };
    if (!lite) {
      if (finish.clearcoat !== undefined) materialOptions.clearcoat = finish.clearcoat;
      if (finish.clearcoatRoughness !== undefined) materialOptions.clearcoatRoughness = finish.clearcoatRoughness;
      if (finish.sheen !== undefined) materialOptions.sheen = finish.sheen;
      if (finish.sheenRoughness !== undefined) materialOptions.sheenRoughness = finish.sheenRoughness;
      if (finish.transmission !== undefined) materialOptions.transmission = finish.transmission;
      if (finish.thickness !== undefined) materialOptions.thickness = finish.thickness;
    }
    const material = new MaterialCtor(materialOptions);
    if (!lite || part.schematic) {
      applyFinishToMaterial(material, part, {
        schematic: !!part.schematic,
        presentation: "clinical",
      });
    } else {
      material.roughness = finish.roughness ?? 0.55;
      material.envMapIntensity = (finish.envMapIntensity ?? 0.8) * 0.85;
    }
    const isSinusPart = part.schematic && /sinus|antrum|cavity/i.test(part.name);
    if (isSinusPart) {
      material.transparent = true;
      material.opacity = 0.38;
      material.depthWrite = false;
      material.side = THREE.DoubleSide;
      if ("transmission" in material) material.transmission = 0.72;
      material.roughness = 0.28;
    }
    if (part.schematic) geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.part = part;
    scene.add(mesh);
    meshes.push(mesh);
    return mesh;
  }
  for (const part of atlas.parts)
    if ((part.bufferUrl || BASE_BUFFER) === BASE_BUFFER)
      addMesh(part, geometryFrom(part, buffers.get(BASE_BUFFER)));

  // The source dataset stops short of most oral and maxillofacial
  // neurovascular anatomy, so those structures are built from this assembly's
  // own landmarks. See src/schematic-anatomy.js for what that means.
  const baseVertices = (part) => {
    const values = new Float32Array(
      buffers.get(BASE_BUFFER),
      part.positions,
      part.vertexCount * 3,
    );
    const out = [];
    for (let i = 0; i < values.length; i += 3)
      out.push([values[i], values[i + 1], values[i + 2]]);
    return out;
  };
  const landmarks = deriveLandmarks(atlas.parts, baseVertices);
  for (const built of createSchematicParts(atlas.parts, baseVertices)) {
    const { geometry, ...part } = built;
    atlas.parts.push(part);
    addMesh(part, geometry);
  }
  const labelTexture = (text) => {
    const scale = 3;
    const pad = 9 * scale;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const font = `${12 * scale}px "Inter", system-ui, sans-serif`;
    context.font = font;
    canvas.width = Math.ceil(context.measureText(text).width) + pad * 2;
    canvas.height = 24 * scale + pad;
    const draw = canvas.getContext("2d");
    draw.font = font;
    draw.fillStyle = "rgba(255,255,255,0.94)";
    draw.strokeStyle = "rgba(23,36,47,0.22)";
    draw.lineWidth = scale;
    const radius = 7 * scale;
    const w = canvas.width - scale,
      h = canvas.height - scale;
    draw.beginPath();
    draw.roundRect(scale / 2, scale / 2, w, h, radius);
    draw.fill();
    draw.stroke();
    draw.fillStyle = "#17242f";
    draw.textBaseline = "middle";
    draw.fillText(text, pad, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    return { texture, ratio: canvas.width / canvas.height };
  };

  // The published sets are in separate files, so a reader who only opens one
  // of them only downloads one of them. The manifest says which file every
  // part is in; nothing here fetches a file a view does not need.
  let dentalModels = null;
  let manifestPending = null;
  const bufferPending = new Map();

  async function loadManifest() {
    if (dentalModels) return dentalModels.manifest;
    if (!manifestPending)
      // A rejected promise left in the cache is a failure nothing can retry.
      manifestPending = fetch("/models/dental/manifest.json")
        .then((r) => {
          if (!r.ok) throw new Error(`dental manifest ${r.status}`);
          return r.json();
        })
        .catch((error) => {
          manifestPending = null;
          manifestFailed = true;
          throw error;
        });
    const manifest = await manifestPending;
    if (!dentalModels) dentalModels = { manifest, buffers: {} };
    return manifest;
  }

  /** The manifest, plus whichever buffers the caller asks for. `pick` is given
   *  the manifest, because which file a view needs is written in the manifest
   *  and the caller does not have it until this has fetched it. */
  async function loadDentalModels(pick) {
    const manifest = await loadManifest();
    const wanted = pick
      ? pick(manifest)
      : Object.keys(manifest.buffers || { dental: 1 });
    await Promise.all(
      wanted.map((name) => {
        if (dentalModels.buffers[name]) return null;
        if (!bufferPending.has(name)) {
          const file = manifest.buffers?.[name]?.file;
          if (!file) throw new Error(`no dental buffer named ${name}`);
          const expected = manifest.buffers[name].bytes;
          bufferPending.set(
            name,
            loadBuffer(`/models/dental/${file}`)
              .then((buffer) => {
                // A short read is a broken file, not a smaller model. Cached,
                // it makes every geometry built from it throw, including the
                // one the failure handler builds while reporting the failure,
                // and that second throw escapes as an unhandled rejection.
                if (buffer.byteLength !== expected)
                  throw new Error(
                    `${file} is ${buffer.byteLength} bytes, expected ${expected}`,
                  );
                dentalModels.buffers[name] = buffer;
                return buffer;
              })
              .catch((error) => {
                bufferPending.delete(name);
                failedBuffers.add(name);
                throw error;
              }),
          );
        }
        return bufferPending.get(name);
      }),
    );
    return dentalModels;
  }

  /** Is there a complete published model for this tooth?
   *
   *  Asking the manifest whether it lists the tooth is not enough. A plan
   *  needs the tooth and its companion tissue, and the ToothFairy importer
   *  will publish a tooth whose pulp was too thin for the scan to hold. When
   *  that happens this used to decide a published model was on the way, ask
   *  for the zero files such a plan needs, succeed at loading nothing, and
   *  start over: an unbounded rebuild loop with no download to show for it. */
  const publishedFor = (fdi, source) =>
    dentalModels
      ? !!publishedToothPlan(dentalModels.manifest, fdi, source)
      : false;

  // A file that failed is remembered as that file. One unreachable dataset
  // used to switch off automatic loading for all of them, so a reader who
  // could not get the scan could not fall back to the model either.
  const failedBuffers = new Set();
  let manifestFailed = false;
  const canLoad = (names) =>
    !manifestFailed &&
    names.length > 0 &&
    !names.some((name) => failedBuffers.has(name));
  const haveBuffers = (names) =>
    !!dentalModels && names.every((name) => dentalModels.buffers[name]);
  const publishedArchExists = (source) =>
    !dentalModels || buffersForArch(dentalModels.manifest, source).length > 0;

  // One plane, reused by every published cutaway.
  // A longitudinal cut across the tooth. World X is mesiodistal once the
  // model has been stood up, which is the section a tooth is usually drawn in.
  const sectionPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);

  // Where the cut goes. Longitudinal A and B are the two vertical planes of
  // the model's own frame and Crossing is the horizontal one; none of them is
  // a fixed buccolingual or mesiodistal direction, because the datasets do not
  // record which of their axes is which. Tilt and rotation turn the plane away
  // from those starting positions, and the position slider slides it across
  // whatever the model measures along that normal.
  const CUT_AXES = {
    a: [1, 0, 0],
    b: [0, 0, 1],
    crossing: [0, 1, 0],
  };
  function setSectionPlane(model, state) {
    const normal = new THREE.Vector3().fromArray(
      CUT_AXES[state.cutAxis] || CUT_AXES.a,
    );
    normal.applyAxisAngle(
      new THREE.Vector3(0, 0, 1),
      THREE.MathUtils.degToRad(state.cutTilt || 0),
    );
    normal.applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      THREE.MathUtils.degToRad(state.cutRotate || 0),
    );
    normal.normalize();
    if (state.cutFlip) normal.negate();
    const box = new THREE.Box3().setFromObject(model);
    const centre = box.getCenter(new THREE.Vector3());
    const half = box.getSize(new THREE.Vector3()).length() / 2 || 0.01;
    const middle = centre.dot(normal);
    const offset = middle + (((state.cutPosition ?? 50) / 100) * 2 - 1) * half;
    sectionPlane.set(normal, -offset);
  }

  // How solid each tissue of an opened tooth is before the reader changes it.
  const CUTAWAY_FADE = { tooth: 0.58, pdl: 0.26, bone: 0.2, pulp: 1 };

  const pin = new THREE.Group();
  pin.visible = false;
  const beadMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.0016, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0x3566d6, toneMapped: false }),
  );
  const haloMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.0031, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0x5b86ee, transparent: true, opacity: 0.32, toneMapped: false }),
  );
  const pinLabel = new THREE.Sprite(
    new THREE.SpriteMaterial({ transparent: true, depthTest: false, toneMapped: false }),
  );
  pinLabel.position.set(0, 0.0072, 0);
  pin.add(beadMesh, haloMesh, pinLabel);
  scene.add(pin);
  let pinnedLandmark = null;
  let activePulse = null;

  const laSimulatorGroup = new THREE.Group();
  laSimulatorGroup.visible = false;
  const needleShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0003, 0.0003, 0.035, 12),
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.9,
      roughness: 0.2,
    }),
  );
  const needleHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0016, 0.0012, 0.008, 12),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.1,
      roughness: 0.4,
    }),
  );
  needleHub.position.set(0, -0.02, 0);
  const diffusionField = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 24, 18),
    new THREE.MeshBasicMaterial({
      color: 0x00c8ff,
      transparent: true,
      opacity: 0.35,
      toneMapped: false,
      depthWrite: false,
    }),
  );
  diffusionField.position.set(0, 0.018, 0);
  laSimulatorGroup.add(needleShaft, needleHub, diffusionField);
  scene.add(laSimulatorGroup);

  function sizePin() {
    if (!pin.visible) return;
    const distance = camera.position.distanceTo(pin.position);
    const perPixel =
      (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance) /
      Math.max(1, renderer.domElement.clientHeight);
    const labelHeight = perPixel * 21;
    pinLabel.scale.set(labelHeight * (pinLabel.userData.ratio || 4), labelHeight, 1);
    pinLabel.position.set(0, labelHeight * 1.5, 0);
    const bead = perPixel * 3.4;
    beadMesh.scale.setScalar(bead / 0.0016);
    haloMesh.scale.setScalar(bead / 0.0016);
  }

  function showLandmark(id) {
    const found = landmarks.find((l) => l.id === id) || null;
    pinnedLandmark = found;
    pin.visible = Boolean(found);
    if (!found) return;
    pin.position.fromArray(found.position);
    const { texture, ratio } = labelTexture(found.name);
    pinLabel.material.map?.dispose();
    pinLabel.material.map = texture;
    pinLabel.material.needsUpdate = true;
    pinLabel.userData.ratio = ratio;
  }

  // Look at the jaws, not the middle of the cranium. This is a dental atlas,
  // and it also lifts the mandible clear of the dock along the bottom edge.
  const target = new THREE.Vector3(0, 1.543, 0.005);
  let currentState;
  let dentalModel = null,
    dentalKey = "",
    sectionKey = "",
    detailPending = false;
  let highResolution = new Map();
  const loadingDetail = new Set();
  let intraoralHrPass = false;
  let lastAppTab = "";
  let cachedOralLookKey = "";
  /** @type {{ fromPos: THREE.Vector3, fromTarget: THREE.Vector3, fromUp: THREE.Vector3, toPos: THREE.Vector3, toTarget: THREE.Vector3, toUp: THREE.Vector3, t: number } | null} */
  let oralCameraTween = null;
  function resolutionStatus(text) {
    host.dataset.resolution = text;
    const label = document.querySelector("#resolution-status");
    if (label) label.textContent = text;
  }
  async function upgradeSelected() {
    if (
      !currentState ||
      currentState.toothDetail ||
      currentState.arches ||
      currentState.age !== "adult"
    )
      return;
    const id = currentState.selected,
      mesh = meshes.find((m) => m.userData.part.id === id),
      part = highResolution.get(id);
    if (!mesh) return;
    if (mesh.userData.highResolution) {
      resolutionStatus(
        `Original detail · ${(mesh.geometry.index.count / 3).toLocaleString()} triangles`,
      );
      return;
    }
    if (!part) {
      resolutionStatus("Optimized assembly detail");
      return;
    }
    if (loadingDetail.has(id)) return;
    loadingDetail.add(id);
    resolutionStatus("Loading original surface detail…");
    try {
      const response = await fetch(part.url);
      if (!response.ok) throw new Error("Mesh download failed");
      const detailBuffer = await response.arrayBuffer();
      const geometry = geometryFrom(part, detailBuffer);
      mesh.geometry.dispose();
      mesh.geometry = geometry;
      layoutKey = "";
      mesh.userData.highResolution = true;
      if (currentState.selected === id)
        resolutionStatus(
          `Original detail · ${(part.indexCount / 3).toLocaleString()} triangles`,
        );
      applyExplosion();
    } catch {
      if (currentState.selected === id)
        resolutionStatus(
          "Original detail unavailable; optimized mesh retained",
        );
    } finally {
      loadingDetail.delete(id);
    }
  }
  async function upgradeIntraoralHighRes() {
    if (intraoralHrPass || highResolution.size === 0) return;
    intraoralHrPass = true;
    const candidates = meshes.filter(
      (m) =>
        intraoralHighResEligible(m.userData.part) &&
        SHIPPED_HR_PART_IDS.has(m.userData.part.id) &&
        highResolution.has(m.userData.part.id) &&
        !m.userData.highResolution,
    );
    if (!candidates.length) {
      if (currentState?.tab === "intraoral" && !dentalModel?.userData.publishedArch)
        resolutionStatus(intraoralStatusMessage({ cbctReady: false }));
      return;
    }
    resolutionStatus("Loading intra-oral surface detail…");
    let done = 0;
    for (const mesh of candidates) {
      const part = highResolution.get(mesh.userData.part.id);
      try {
        const response = await fetch(part.url);
        if (!response.ok) continue;
        const detailBuffer = await response.arrayBuffer();
        const geometry = geometryFrom(part, detailBuffer);
        mesh.geometry.dispose();
        mesh.geometry = geometry;
        mesh.userData.highResolution = true;
        done++;
      } catch {
        /* retain optimized mesh */
      }
    }
    if (currentState?.tab === "intraoral" && !dentalModel?.userData.publishedArch)
      resolutionStatus(intraoralStatusMessage({ cbctReady: false }));
    cachedOralLookKey = "";
    layoutKey = "";
    applyExplosion();
    render();
  }
  function viewIntraoral(preset = "occlusal") {
    const cfg = INTRAORAL_PRESETS[preset] ?? INTRAORAL_PRESETS.occlusal;
    currentDirection = preset;
    const center = new THREE.Vector3(0, 1.542, 0.038);
    const box = new THREE.Box3();
    if (dentalModel?.visible) box.expandByObject(dentalModel);
    else meshes.filter((m) => m.visible).forEach((m) => box.expandByObject(m));
    if (!box.isEmpty()) center.copy(box.getCenter(new THREE.Vector3()));
    const size = box.isEmpty() ? 0.14 : box.getSize(new THREE.Vector3()).length();
    const compact = (host.clientWidth || 1) < 768;
    if (compact && !box.isEmpty()) center.y -= size * 0.1;
    const scale = (cfg.distanceScale ?? 1) * (compact ? 1.08 : 1);
    const distance = Math.max(
      0.045,
      (size * 0.55 * scale) / Math.max(0.62, Math.min(camera.aspect, 1)),
    );
    const toUp = new THREE.Vector3(0, preset === "occlusal" ? 0 : 1, preset === "occlusal" ? -1 : 0);
    const offset = new THREE.Vector3(...cfg.vector).normalize().multiplyScalar(distance);
    const toPos = center.clone().add(offset);
    const toTarget = center.clone();
    controls.maxDistance = Math.max(0.35, distance * 3);
    camera.far = 2;
    renderer.toneMappingExposure = toneMappingExposureFor("clinical");
    oralCameraTween = {
      fromPos: camera.position.clone(),
      fromTarget: controls.target.clone(),
      fromUp: camera.up.clone(),
      toPos,
      toTarget,
      toUp,
      t: 0,
    };
    framing = true;
    renderBudget = 8;
  }
  fetch("/models/high-resolution/atlas.json")
    .then((r) => {
      if (!r.ok) throw new Error("No original detail catalogue");
      return r.json();
    })
    .then((data) => {
      highResolution = new Map(data.parts.map((p) => [p.id, p]));
      upgradeSelected();
    })
    .catch(() => resolutionStatus("Optimized assembly detail"));
  function disposeModel(model) {
    model.traverse((m) => {
      if (m.isMesh) {
        m.geometry.dispose();
        m.material.dispose();
      }
    });
    scene.remove(model);
  }
  /** The modeled tooth in one jaw whose centre is closest to the orbit target. */
  function nearestTooth(upper) {
    let best = null;
    let bestDistance = Infinity;
    const centre = new THREE.Vector3();
    for (const mesh of meshes) {
      const fdi = toothNumber(mesh.userData.part.name);
      if (!fdi || fdi < 30 !== upper) continue;
      mesh.geometry.boundingBox.getCenter(centre);
      const distance = centre.distanceTo(controls.target);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = fdi;
      }
    }
    return best;
  }
  let previousDistance = null,
    detailExitDistance = Infinity,
    framing = false;
  // `explosion` is where the slider (or the wheel) says the parts are going;
  // `shown` is where they are right now. The frame loop eases one toward the
  // other, so a slider jump or a wheel flick glides rather than teleports, and
  // the camera follows `shown`, never the target.
  let explosion = 0, shown = 0, appliedExplosion = 0, overviewDistance = 0.55, layoutKey = "", layout;
  let settleView = false;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  // A small dot at the centre of every part once the inventory is nearly laid
  // out, so a vessel a few pixels wide still has something to point at.
  const markerPositions = new Float32Array(atlas.parts.length * 3);
  const markerGeometry = new THREE.BufferGeometry();
  markerGeometry.setAttribute("position", new THREE.BufferAttribute(markerPositions, 3));
  markerGeometry.setDrawRange(0, 0);
  const markerMaterial = new THREE.PointsMaterial({
    color: 0x3566d6,
    size: 4,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.7,
    depthTest: false,
    toneMapped: false,
  });
  markerMaterial.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <clipping_planes_fragment>",
      "#include <clipping_planes_fragment>\n if (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;",
    );
  };
  const markers = new THREE.Points(markerGeometry, markerMaterial);
  markers.frustumCulled = false;
  markers.renderOrder = 10;
  markers.visible = false;
  scene.add(markers);
  let applyingZoom = false;
  // Set when the slider moves the parts, cleared the moment the reader grabs the
  // camera. While it is set the frame loop keeps the exploded parts framed;
  // once it is cleared the camera belongs to the reader and nothing refits it.
  let followExplosion = false;
  const canExplode = () => currentState && !dentalModel && !currentState.isolated && currentState.mode === "3d";
  function setExplosion(value) {
    onExplode(THREE.MathUtils.clamp(value, 0, 100));
  }
  function applyExplosion() {
    // Nothing is exploding while a tooth or an isolated part is on show, so
    // there is nothing to ease; the next time it matters it starts from the
    // slider's own value.
    if (!canExplode() || reducedMotion.matches) shown = explosion;
    const visible = meshes.filter((mesh) => mesh.visible);
    const key = visible.map((mesh) => mesh.userData.part.id).join(",") + camera.aspect;
    const changed = key !== layoutKey || appliedExplosion !== shown;
    if (!layout || key !== layoutKey) {
      layout = createExplosionLayout(visible.map((mesh) => ({
        id: mesh.userData.part.id,
        group: mesh.userData.part.group,
        bounds: [mesh.geometry.boundingBox.min.toArray(), mesh.geometry.boundingBox.max.toArray()],
      })), camera.aspect);
      layoutKey = key;
    }
    const amount = canExplode() ? shown / 100 : 0;
    appliedExplosion = shown;
    const center = new THREE.Vector3();
    let dots = 0;
    for (const mesh of meshes) {
      mesh.geometry.boundingBox.getCenter(center);
      const [x, y, z] = explodedOffset({
        part: mesh.userData.part,
        center,
        pivot: target,
        cell: layout.cells.get(mesh.userData.part.id),
        amount,
      });
      mesh.position.set(x, y, z);
      if (mesh.visible && amount > 0.75) {
        markerPositions.set([center.x + x, center.y + y, center.z + z], dots * 3);
        dots++;
      }
    }
    markerGeometry.setDrawRange(0, dots);
    markerGeometry.attributes.position.needsUpdate = true;
    markers.visible = dots > 0;
    applyControlPolicy(amount * 100);
    host.dataset.explode = String(explosion);
    host.dataset.zoomStage = explosionStage(amount * 100);
    // Reframe only while the parts are travelling on the slider's say-so. A
    // reader who has taken the camera keeps it, so separation never costs
    // them their zoom or pan.
    if (amount > 0 && changed && followExplosion) view(amount > 0.45 ? "anterior" : "keep", true);
    else render();
    // Once the parts have arrived the follow is over; a later layer toggle or
    // resize must not pull the camera back to a fit.
    if (shown === explosion) followExplosion = false;
  }
  // The separation slider moves parts; it never moves the controls. Every
  // gesture stays live at every amount. The only thing that changes in the
  // flat inventory is which button drags and which pans.
  function applyControlPolicy(percent) {
    const policy = explosionControls(percent);
    controls.enableRotate = policy.enableRotate;
    controls.enableZoom = policy.enableZoom;
    controls.enablePan = policy.enablePan;
    controls.zoomToCursor = policy.zoomToCursor;
    controls.mouseButtons.LEFT = THREE.MOUSE[policy.left];
    controls.mouseButtons.RIGHT = THREE.MOUSE[policy.right];
    controls.touches.ONE = THREE.TOUCH[policy.touch];
  }
  applyControlPolicy(0);
  controls.addEventListener("start", () => {
    followExplosion = false;
  });
  // The frame loop. It eases the explosion toward its target, at the same rate
  // as the reference (a damped approach, not a fixed-length tween, so a
  // reversal mid-flight turns round smoothly), and steps the orbit damping.
  let turntableActive = false;
  let frame = 0,
    lastFrame = 0,
    renderBudget = 2;
  function tick(now) {
    if (turntableActive) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1.6;
      renderBudget = Math.max(renderBudget, 2);
    } else {
      controls.autoRotate = false;
    }
    frame = requestAnimationFrame(tick);
    const delta = Math.min((now - lastFrame) / 1000 || 0.016, 0.05);
    lastFrame = now;
    if (Math.abs(shown - explosion) > 0.02) {
      shown = THREE.MathUtils.damp(shown, explosion, 5.5, delta);
      if (Math.abs(shown - explosion) < 0.05) shown = explosion;
      applyExplosion();
      renderBudget = 3;
      if (settleView && shown === 0) {
        settleView = false;
        view(currentDirection);
      }
    }
    if (oralCameraTween) {
      oralCameraTween.t = Math.min(1, oralCameraTween.t + delta * 4.5);
      const u = smoothstep(oralCameraTween.t);
      camera.position.lerpVectors(
        oralCameraTween.fromPos,
        oralCameraTween.toPos,
        u,
      );
      controls.target.lerpVectors(
        oralCameraTween.fromTarget,
        oralCameraTween.toTarget,
        u,
      );
      camera.up.lerpVectors(oralCameraTween.fromUp, oralCameraTween.toUp, u).normalize();
      camera.updateProjectionMatrix();
      renderBudget = Math.max(renderBudget, 4);
      if (oralCameraTween.t >= 1) {
        oralCameraTween = null;
        framing = false;
      }
    }
    if (laSimulatorGroup.visible) {
      const pulseT = (now || performance.now()) * 0.005;
      const sVal = 1.0 + 0.16 * Math.sin(pulseT);
      diffusionField.scale.set(sVal, sVal, sVal);
      diffusionField.material.opacity = 0.32 + 0.24 * (Math.sin(pulseT) * 0.5 + 0.5);
      renderBudget = Math.max(renderBudget, 2);
    }
    if (activePulse) {
      const nowTime = now || performance.now();
      const elapsed = nowTime - activePulse.startTime;
      const progress = Math.min(1, elapsed / activePulse.duration);
      const wave = Math.sin(progress * Math.PI);
      for (const m of meshes) {
        if (activePulse.targets.has(m)) {
          m.material.emissive.set(activePulse.color || "#38bdf8");
          m.material.emissiveIntensity = THREE.MathUtils.lerp(0.1, 1.6, wave);
        } else if (activePulse.ghostBackground) {
          m.material.transparent = true;
          m.material.opacity = THREE.MathUtils.lerp(1, 0.22, wave);
        }
      }
      renderBudget = Math.max(renderBudget, 2);
      if (progress >= 1) {
        activePulse = null;
        if (currentState) api.update(currentState);
      }
    }
    controls.update();
    if (renderBudget > 0) {
      render();
      renderBudget--;
    }
  }
  const viewAxis = new THREE.Vector3();
  const axisReport = { left: null, superior: null, anterior: null };
  function reportOrientation() {
    const inverse = camera.quaternion.clone().invert();
    for (const [key, axis] of [
      ["left", [1, 0, 0]],
      ["superior", [0, 1, 0]],
      ["anterior", [0, 0, 1]],
    ])
      axisReport[key] = viewAxis
        .fromArray(axis)
        .applyQuaternion(inverse)
        .toArray();
    onOrient(axisReport);
  }

  function render() {
    sizePin();
    renderer.render(scene, camera);
    reportOrientation();
    const distance = camera.position.distanceTo(controls.target);
    const zoomingIn =
      previousDistance !== null && distance < previousDistance - 0.000001;
    const zoomingOut =
      previousDistance !== null && distance > previousDistance + 0.000001;
    previousDistance = distance;
    host.dataset.cameraDistance = distance.toFixed(4);
    if (
      !framing &&
      !detailPending &&
      currentState?.toothDetail &&
      zoomingOut &&
      distance > detailExitDistance
    ) {
      detailPending = true;
      queueMicrotask(() => {
        onExitDetail();
        detailPending = false;
      });
      return;
    }
    if (
      !framing &&
      zoomingIn &&
      currentState?.autoDetail &&
      !currentState.toothDetail &&
      explosion === 0 &&
      currentState.mode === "3d" &&
      !detailPending
    ) {
      const part = meshes.find(
        (m) => m.userData.part.id === currentState.selected,
      );
      // Zooming into the gums opens the same cutaway as zooming into a tooth,
      // framed on the periodontium instead of the crown. The tooth it opens on
      // is the one nearest whatever the camera is already looking at, so
      // zooming into the front of the mouth gives an incisor.
      const gingivaJaw = part && /^Gingiva of (upper|lower) jaw$/.exec(part.userData.part.name)?.[1];
      const target = dentalModel
        ? dentalModel.children.find((m) => m.userData.fdi === currentState.fdi)
        : part;
      const fdi = dentalModel
        ? currentState.fdi
        : gingivaJaw
          ? nearestTooth(gingivaJaw === "upper")
          : part && toothNumber(part.userData.part.name);
      if (
        fdi &&
        target?.visible &&
        camera.position.distanceTo(
          new THREE.Box3().setFromObject(target).getCenter(new THREE.Vector3()),
        ) < 0.055
      ) {
        detailPending = true;
        queueMicrotask(() => {
          onDetail(fdi, { periodontium: Boolean(gingivaJaw) });
          detailPending = false;
        });
      }
    }
  }
  let currentDirection = "oblique";
  /** The part of the canvas the interface leaves free, in pixels. The values
   *  are the footprints of the tab bar, the dock and the layers panel. */
  function freeBand() {
    const width = host.clientWidth || 1;
    const height = host.clientHeight || 1;
    const compact = width < 768;
    // The notes panel only takes room from the canvas while it is open.
    const notes = host.ownerDocument.body.classList.contains("details-open");
    const edge = compact
      ? { top: 96, bottom: Math.min(340, height * 0.42), left: 12, right: 12 }
      : { top: 88, bottom: 300, left: width > 860 ? 320 : 16, right: notes && width > 860 ? 400 : 24 };
    return {
      ...edge,
      width: Math.max(160, width - edge.left - edge.right),
      height: Math.max(120, height - edge.top - edge.bottom),
    };
  }
  function view(direction = "oblique", fit = false) {
    framing = true;
    // "keep" refits the distance and target and leaves the angle the reader
    // chose where it is.
    const keepAngle = direction === "keep";
    if (keepAngle) direction = currentDirection;
    else currentDirection = direction;
    let center = target.clone(),
      size = 0.3,
      bandShift = null;
    // The tooth model is built with its cervical line at the origin, so
    // framing the periodontium means framing a short band around y = 0.
    if (fit && currentState?.toothDetail && currentState.perioFocus && dentalModel?.visible) {
      controls.target.set(0, 0, 0);
      camera.up.set(0, 1, 0);
      camera.position
        .set(0, 0, 0)
        .add(new THREE.Vector3(0.55, 0.16, 1).normalize().multiplyScalar(0.032));
      camera.far = 1;
      camera.updateProjectionMatrix();
      controls.update();
      detailExitDistance = 0.032 * 1.65;
      render();
      framing = false;
      return;
    }
    if (fit && currentState) {
      const box = new THREE.Box3();
      if (dentalModel?.visible) box.expandByObject(dentalModel);
      else
        meshes.filter((m) => m.visible).forEach((m) => box.expandByObject(m));
      if (!box.isEmpty()) {
        center = box.getCenter(new THREE.Vector3());
        size = box.getSize(new THREE.Vector3()).length();
        // On a phone the controls take the lower part of the window, so a
        // model centred in the viewport sits behind them. Aim lower and it
        // rides in the band that is actually visible.
        if (currentState?.mode === "models" && camera.aspect < 0.9)
          center.y -= size * 0.22;
      }
    }
    // The scene fills the window rather than sitting in a grid cell, so the
    // multiplier is larger than it used to be. Dividing by the aspect pulls
    // the camera back far enough to fit the width, but on a phone in portrait
    // that ratio is about 0.46 and the head ends up tiny in a tall window
    // whose lower quarter is covered by the dock anyway. The divisor has a
    // floor, which leaves wide windows untouched and stops the portrait case
    // from over-compensating.
    let distance = Math.max(
      0.04,
      (size *
        (currentState?.toothDetail
          ? dentalModel?.userData.published
            ? 3.2
            : 1.5
          : 2.2)) /
        Math.max(0.62, Math.min(camera.aspect, 1)),
    );
    if (shown > 0 && canExplode()) {
      const box = new THREE.Box3();
      meshes.filter((mesh) => mesh.visible).forEach((mesh) => box.expandByObject(mesh));
      if (!box.isEmpty()) {
        center = box.getCenter(new THREE.Vector3());
        const extent = box.getSize(new THREE.Vector3());
        // Fit the parts into the part of the window the interface leaves
        // free, not into the whole canvas, then slide the view so they sit in
        // the middle of that band. Without this the top row of the inventory
        // is under the tab bar and the bottom row is under the dock.
        const free = freeBand();
        const height = host.clientHeight || 1;
        const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        distance =
          (Math.max((extent.y * height) / free.height, (extent.x * height) / free.width) / (2 * tanHalf)) * 1.06 +
          extent.z / 2;
        distance = Math.max(distance, overviewDistance);
        // The slide eases in with the separation, so the head does not jump
        // sideways the instant the slider leaves zero.
        const ease = smoothstep(shown / 45);
        bandShift = {
          x: ((free.left - free.right) / 2) * ease,
          y: ((free.bottom - free.top) / 2) * ease,
          perPixel: (2 * distance * tanHalf) / height,
        };
      }
      if (shown > 45) direction = "anterior";
    } else if (!dentalModel && !currentState?.isolated) overviewDistance = distance;
    controls.maxDistance = Math.max(1.2, distance * 2);
    camera.far = Math.max(dentalModel ? 1 : 10, distance * 4);
    camera.updateProjectionMatrix();
    if (currentState?.toothDetail) detailExitDistance = distance * 1.65;
    const vectors = {
      anterior: [0, 0, 1],
      lateral: [1, 0, 0],
      inferior: [0, -1, 0.01],
      oblique: [0.65, 0.12, 1],
    };
    const offset = keepAngle && shown <= 45 && !camera.position.equals(controls.target)
      ? camera.position.clone().sub(controls.target)
      : new THREE.Vector3(...vectors[direction]);
    if (!keepAngle || shown > 45) camera.up.set(0, 1, 0);
    offset.normalize();
    if (bandShift) {
      // Screen right and up for this viewing direction. Moving the target
      // against them moves the parts with them on screen.
      const right = new THREE.Vector3().crossVectors(camera.up, offset).normalize();
      const up = new THREE.Vector3().crossVectors(offset, right);
      center
        .addScaledVector(right, -bandShift.x * bandShift.perPixel)
        .addScaledVector(up, -bandShift.y * bandShift.perPixel);
    }
    controls.target.copy(center);
    camera.position.copy(center).add(offset.multiplyScalar(distance));
    controls.update();
    render();
    framing = false;
  }
  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(pixelRatioFor(width, height));
    renderer.setSize(width, height);
    if (explosion > 0 || shown > 0) applyExplosion();
    else if (dentalModel) view(currentDirection, true);
    else render();
  });
  resize.observe(host);
  controls.addEventListener("change", () => {
    renderBudget = Math.max(renderBudget, PERF_TIER === "low" ? 8 : 14);
  });
  // A tap is a single pointer that went down and came up without travelling
  // and without a second pointer joining it. Tracking only one pointer let the
  // end of a pinch count as a tap and select whatever sat under the finger.
  const taps = new Map();
  let multiTouch = false;
  const tapThreshold = (event) => (event.pointerType === "touch" ? 12 : 5);
  let down = null;
  renderer.domElement.addEventListener("pointerdown", (e) => {
    if (taps.size === 0) multiTouch = false;
    taps.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (taps.size > 1) multiTouch = true;
    down = taps.size === 1 ? { x: e.clientX, y: e.clientY } : null;
  });
  renderer.domElement.addEventListener("pointercancel", (e) => {
    taps.delete(e.pointerId);
    multiTouch = true;
    down = null;
  });
  // Naming the structure under the cursor is the fastest way to read an
  // unfamiliar assembly, so the pointer picks continuously. The pick is
  // throttled to one animation frame and skipped while dragging.
  const pointer = new THREE.Vector2();
  const hoverRay = new THREE.Raycaster();
  let hoverQueued = false;
  let hoverId = null;
  function pickAt(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    hoverRay.setFromCamera(
      pointer.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        (-(clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    return hoverRay.intersectObjects(
      dentalModel?.visible ? [dentalModel] : meshes.filter((m) => m.visible),
      true,
    )[0];
  }
  renderer.domElement.addEventListener("pointermove", (e) => {
    const start = taps.get(e.pointerId);
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > tapThreshold(e))
      multiTouch = true;
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > tapThreshold(e))
      down = null;
    if (e.pointerType === "touch" || hoverQueued) return;
    hoverQueued = true;
    requestAnimationFrame(() => {
      hoverQueued = false;
      const hit = pickAt(e.clientX, e.clientY);
      const data = hit?.object.userData;
      const part = data?.part;
      const id = part ? part.id : data?.tissue ? `tissue:${data.tissue}` : null;
      if (id === hoverId) return;
      hoverId = id;
      onHover(part || null, { x: e.clientX, y: e.clientY });
    });
  });
  renderer.domElement.addEventListener("pointerleave", () => {
    hoverId = null;
    onHover(null);
  });
  renderer.domElement.addEventListener("pointerup", (e) => {
    const start = taps.get(e.pointerId);
    const singleTap = Boolean(start) && taps.size === 1 && !multiTouch;
    taps.delete(e.pointerId);
    if (!singleTap || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > tapThreshold(e))
      return;
    down = null;
    const rect = renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    const hits = ray
      .intersectObjects(
        dentalModel?.visible ? [dentalModel] : meshes.filter((m) => m.visible),
        true,
      )
      .filter((hit) => {
        let m = hit.object;
        while (m) {
          if (!m.visible) return false;
          m = m.parent;
        }
        return true;
      });
    if (!hits.length && explosion > 45 && !dentalModel) {
      const projected = new THREE.Vector3();
      let nearest = e.pointerType === "touch" ? 24 : 16, picked;
      for (const mesh of meshes.filter((mesh) => mesh.visible)) {
        mesh.geometry.boundingBox.getCenter(projected).add(mesh.position).project(camera);
        const distance = Math.hypot((projected.x + 1) * rect.width / 2 - (e.clientX - rect.left), (1 - projected.y) * rect.height / 2 - (e.clientY - rect.top));
        if (projected.z >= -1 && projected.z <= 1 && distance < nearest) { nearest = distance; picked = mesh; }
      }
      if (picked) hits.push({ object: picked });
    }
    if (hits.length) {
      const data = hits[0].object.userData;
      if (data.part) onSelect(data.part.id);
      else if (data.fdi && !currentState.toothDetail) onToothSelect(data.fdi);
    } else if(!currentState.toothDetail) onSelect(null);
  });
  const api = {
    landmarks: () => landmarks.map((l) => ({ ...l })),
    // Entering the dental tab shows an arch, so that file starts arriving
    // before a reader taps anything.
    prefetchModels: (source) =>
      loadDentalModels((m) => buffersForArch(m, source)).catch(() => {}),
    modelManifest: () => dentalModels?.manifest || null,
    publishedFor: (fdi, source) => publishedFor(fdi, source),
    publishedArch: () => dentalModel?.userData.publishedArch || null,
    faceCut() {
      if (!dentalModel || !currentState) return;
      setSectionPlane(dentalModel, currentState);
      const box = new THREE.Box3().setFromObject(dentalModel);
      const centre = box.getCenter(new THREE.Vector3());
      const distance = camera.position.distanceTo(controls.target) || 0.04;
      framing = true;
      controls.target.copy(centre);
      camera.position
        .copy(centre)
        .addScaledVector(sectionPlane.normal, -distance);
      camera.up.set(0, 1, 0);
      if (Math.abs(sectionPlane.normal.y) > 0.9) camera.up.set(0, 0, -1);
      camera.updateProjectionMatrix();
      controls.update();
      render();
      framing = false;
    },
    publishedTooth: () =>
      dentalModel?.userData.published
        ? {
            ...dentalModel.userData.published,
            tissues: dentalModel.userData.tissues,
          }
        : null,
    modelGroups: (viewId) =>
      dentalModels ? groupsInView(dentalModels.manifest, viewId) : [],
    showLandmark(id) {
      showLandmark(id);
      render();
    },
    update(state) {
      const previousExplosion = explosion;
      currentState = state;
      const intraoralTab = state.tab === "intraoral";
      const q = state.qualityMode || "balanced";
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      if (q === "smooth") {
        renderer.setPixelRatio(1);
      } else if (q === "quality") {
        renderer.setPixelRatio(
          Math.min(devicePixelRatio || 1, pixelRatioCap("high")),
        );
      } else {
        renderer.setPixelRatio(pixelRatioFor(w, h));
      }
      explosion = Number.isFinite(state.explode) ? THREE.MathUtils.clamp(state.explode, 0, 100) : 0;
      // The key has to carry which patient the tooth or arch is coming from,
      // or switching between them rebuilds nothing.
      const useCbctIntraoral =
        intraoralTab &&
        state.age === "adult" &&
        state.intraoralModel !== "atlas";
      const key =
        state.mode === "models"
          ? `model-${state.modelView}`
          : useCbctIntraoral
            ? `intraoral-${state.intraoralModel || "openfulljaw"}`
            : state.toothDetail
              ? `tooth-${state.fdi}-${state.toothSource}`
              : state.arches || state.age !== "adult"
                ? `${state.age}-${state.archSource}-${state.toothSource}`
                : "";
      if (key !== dentalKey) {
        detailExitDistance = Infinity;
        if (dentalModel) disposeModel(dentalModel);
        dentalModel = null;
        if (state.mode === "models") {
          // The file may not be here yet; the view rebuilds when it lands.
          const need = dentalModels
            ? buffersForView(dentalModels.manifest, state.modelView)
            : null;
          if (need && haveBuffers(need))
            dentalModel = createModelGroup(
              dentalModels.manifest,
              dentalModels.buffers,
              state.modelView,
            );
          else if (!need || canLoad(need))
            loadDentalModels((m) => buffersForView(m, state.modelView))
              .then(() => {
                dentalKey = "";
                if (currentState) api.update(currentState);
                onModelsReady();
                api.view("oblique", true);
              })
              .catch((error) =>
                onPartsChanged({ failed: 1, message: error.message }),
              );
        } else if (key.startsWith("intraoral-")) {
          const source = key.slice("intraoral-".length);
          const published =
            state.age === "adult"
              ? createPublishedDentitionModel(
                  dentalModels?.manifest,
                  dentalModels?.buffers,
                  source,
                )
              : null;
          const need = dentalModels
            ? buffersForArch(dentalModels.manifest, source)
            : null;
          const awaitingPublished =
            !published &&
            state.age === "adult" &&
            (!dentalModels ||
              (canLoad(need) && publishedArchExists(source)));
          if (published) dentalModel = published;
          else if (awaitingPublished) {
            dentalModel = null;
            resolutionStatus("Loading patient CBCT jaws…");
            loadDentalModels((m) => buffersForArch(m, source))
              .then(() => {
                dentalKey = "";
                if (currentState) api.update(currentState);
                onModelsReady();
                if (currentState?.tab === "intraoral")
                  viewIntraoral(currentState.intraoralPreset || "occlusal");
              })
              .catch((error) => {
                resolutionStatus(intraoralStatusMessage({ cbctReady: false }));
                dentalKey = "";
                if (currentState) api.update(currentState);
              });
          } else {
            dentalModel = null;
            resolutionStatus(intraoralStatusMessage({ cbctReady: false }));
          }
        } else if (key) {
          const published =
            state.age !== "adult"
              ? null
              : state.toothDetail
                ? createPublishedToothModel(
                    dentalModels?.manifest,
                    dentalModels?.buffers,
                    state.fdi,
                    state.toothSource,
                  )
                : state.archSource === "drawn"
                  ? null
                  : createPublishedDentitionModel(
                      dentalModels?.manifest,
                      dentalModels?.buffers,
                      state.toothSource,
                    );
          // A published model may exist and simply not be downloaded yet, so
          // this asks the manifest rather than a list written in this file.
          // It also asks which files that model actually needs: a plan that
          // needs none is a plan that cannot be completed by loading, and
          // retrying it forever is how that used to present itself.
          const need = dentalModels
            ? state.toothDetail
              ? buffersForTooth(
                  dentalModels.manifest,
                  state.fdi,
                  state.toothSource,
                )
              : buffersForArch(dentalModels.manifest, state.toothSource)
            : null;
          const awaitingPublished =
            !published &&
            state.age === "adult" &&
            state.archSource !== "drawn" &&
            (!dentalModels ||
              (canLoad(need) &&
                (state.toothDetail
                  ? publishedFor(state.fdi, state.toothSource)
                  : publishedArchExists(state.toothSource))));
          if (published) dentalModel = published;
          else {
            // Never draw a schematic stand in for a tooth that has a published
            // model on the way. It would be replaced a second later, and until
            // then it says schematic about anatomy that is not.
            dentalModel = awaitingPublished
              ? null
              : state.toothDetail
                ? createToothModel(state.fdi)
                : createDentitionModel(state.age);
            if (awaitingPublished) resolutionStatus("Loading the published model");
            // The published buffer may simply not be here yet. Fetch it and
            // rebuild rather than leaving the drawn tooth in place.
            if (awaitingPublished)
              loadDentalModels((m) =>
                state.toothDetail
                  ? buffersForTooth(m, state.fdi, state.toothSource)
                  : buffersForArch(m, state.toothSource),
              )
                .then(() => {
                  dentalKey = "";
                  if (currentState) api.update(currentState);
                  onModelsReady();
                  api.view("oblique", true);
                })
                .catch((error) => {
                  // A silent failure here leaves a drawn tooth pretending to
                  // be the published one, so it is reported and the drawn
                  // geometry is built deliberately rather than by accident.
                  resolutionStatus(`Published model unavailable: ${error.message}`);
                  dentalKey = "";
                  if (currentState) api.update(currentState);
                });
          }
        }
        dentalKey = key;
        sectionKey = "";
        if (dentalModel) scene.add(dentalModel);
        camera.far = dentalModel ? 1 : 10;
        camera.updateProjectionMatrix();
        // A published model is metres across in its own frame, so it has to be
        // framed once it is actually in the scene rather than before.
        if (
          dentalModel &&
          (state.mode === "models" ||
            dentalModel.userData.published ||
            dentalModel.userData.publishedArch)
        ) {
          if (state.tab === "intraoral")
            requestAnimationFrame(() =>
              viewIntraoral(state.intraoralPreset || "occlusal"),
            );
          else requestAnimationFrame(() => view("oblique", true));
        }
      }
      if (
        dentalModel &&
        state.mode !== "models" &&
        !dentalModel.userData.published &&
        !dentalModel.userData.publishedArch
      )
        resolutionStatus("Schematic teaching geometry");
      else upgradeSelected();
      if (dentalModel && state.mode === "models") {
        resolutionStatus(dentalModel.userData.view.caption);
        for (const mesh of dentalModel.children) {
          const part = mesh.userData.modelPart;
          mesh.visible = !state.hiddenTissues.has(part.group);
          const fade = state.opacity?.get(`model-${part.group}`) ?? 1;
          mesh.material.transparent = fade < 1;
          mesh.material.opacity = fade;
          mesh.material.depthWrite = fade >= 1;
        }
      }
      if (dentalModel?.userData.publishedArch) {
        if (intraoralTab) {
          resolutionStatus(
            intraoralStatusMessage({
              cbctReady: true,
              archSource: dentalModel.userData.publishedArch.id,
            }),
          );
          for (const mesh of dentalModel.children) {
            const tissue = mesh.userData.tissue;
            mesh.visible =
              tissue !== "bone" || state.intraoralShowBone !== false;
          }
        } else {
          resolutionStatus(dentalModel.userData.publishedArch.caption);
          for (const mesh of dentalModel.children) {
            mesh.visible = !state.hiddenTissues.has(mesh.userData.tissue);
            const fade = state.opacity?.get(`model-${mesh.userData.tissue}`) ?? 1;
            mesh.material.transparent = fade < 1;
            mesh.material.opacity = fade;
            mesh.material.depthWrite = fade >= 1;
          }
        }
      }
      if (dentalModel && state.toothDetail && dentalModel.userData.published) {
        const plan = dentalModel.userData.published;
        resolutionStatus(plan.caption);
        setSectionPlane(dentalModel, state);
        renderer.clippingPlanes = state.cutaway ? [sectionPlane] : [];
        for (const mesh of dentalModel.children) {
          const tissue = mesh.userData.tissue;
          mesh.visible = !state.hiddenTissues.has(tissue);
          // The point of opening a tooth is to see inside it, so the shell it
          // is seen through starts part way transparent. Solid enough to read
          // the crown and the roots, clear enough for the canal behind them.
          const fade = state.opacity?.get(`model-${tissue}`) ?? CUTAWAY_FADE[tissue] ?? 1;
          mesh.material.transparent = fade < 1;
          mesh.material.opacity = fade;
          mesh.material.depthWrite = fade >= 1;
          mesh.material.needsUpdate = true;
        }
        render();
      } else if (dentalModel && state.toothDetail) {
        renderer.clippingPlanes = [];
        const nextSection = `${state.cutaway}-${state.sectionDepth}`;
        if (nextSection !== sectionKey) {
          setToothSection(dentalModel, state.cutaway, state.sectionDepth);
          sectionKey = nextSection;
        }
        dentalModel.children.forEach(
          (m) => (m.visible = !state.hiddenTissues.has(m.userData.tissue)),
        );
      }
      if (!dentalModel?.userData.published) renderer.clippingPlanes = [];
      if (state.tab !== lastAppTab) {
        lastAppTab = state.tab;
        cachedOralLookKey = "";
        if (state.tab === "intraoral") {
          setOralStudioLighting(lightRig, true);
          controls.dampingFactor = intraoralDamping;
          intraoralHrPass = false;
          upgradeIntraoralHighRes();
        } else {
          setOralStudioLighting(lightRig, false);
          controls.dampingFactor = defaultDamping;
          oralCameraTween = null;
          cachedPresentation = '';
        }
      }
      if (intraoralTab) {
        const lookKey = oralLookKey(state, dentalKey);
        if (lookKey !== cachedOralLookKey) {
          cachedOralLookKey = lookKey;
          syncOralLook({
            state,
            groups,
            atlasParts: atlas.parts,
            meshes,
            dentalModel,
            lightRig,
          });
        }
      } else if (cachedOralLookKey) {
        cachedOralLookKey = "";
      }
      const presentation = state.presentation || "clinical";
      if (cachedPresentation !== presentation) {
        cachedPresentation = presentation;
        renderer.toneMappingExposure = toneMappingExposureFor(presentation);
        for (const mesh of meshes) {
          const p = mesh.userData.part;
          if (preferLiteMaterial(p) && !p.schematic) continue;
          applyFinishToMaterial(mesh.material, p, {
            schematic: !!p.schematic,
            presentation,
          });
        }
      }
      for (const mesh of meshes) {
        const part = mesh.userData.part;
        const isSelected = part.id === state.selected;
        const isSinus = part.schematic && /sinus|antrum|cavity/i.test(part.name);
        const oralAtlas = intraoralTab && !dentalModel && isIntraoralEligible(part);

        if (state.isolated && state.selected) {
          if (state.ghostContext) {
            mesh.visible = isSelected || state.layers.has(part.group);
            if (!isSelected) {
              mesh.material.transparent = true;
              mesh.material.opacity = 0.12;
              mesh.material.depthWrite = false;
              mesh.material.color.set(partColor(part, groups, { presentation, selected: false }));
              mesh.material.emissive.set("#000000");
              mesh.material.emissiveIntensity = 0;
              continue;
            }
          } else {
            mesh.visible = isSelected;
            if (!isSelected) continue;
          }
        } else {
          mesh.visible =
            !dentalModel &&
            (intraoralTab
              ? intraoralVisible(part, state)
              : !state.hidden?.has(part.id) &&
                (part.schematic ? state.schematic !== false : true) &&
                (state.layers.has(part.group) &&
                  (part.group === "muscles" ? state.masticatory !== false : true)));
        }

        if (!mesh.visible) continue;

        if (!oralAtlas) {
          mesh.material.color.set(
            partColor(part, groups, { presentation, selected: isSelected }),
          );
          mesh.material.emissive.set(
            materialEmissive(part, { presentation, selected: isSelected }),
          );
          mesh.material.emissiveIntensity = materialEmissiveIntensity(part, {
            presentation,
            selected: isSelected,
          });
        }
        if (q === "smooth" && "transmission" in mesh.material && !isSinus) {
          mesh.material.transmission = 0;
          mesh.material.thickness = 0;
        }
        if (!oralAtlas) {
          const fade = state.opacity?.get(part.group) ?? 1;
          if (isSinus) {
            mesh.material.transparent = true;
            mesh.material.opacity = isSelected ? 0.60 : Math.min(fade, 0.38);
            mesh.material.depthWrite = false;
            mesh.material.side = THREE.DoubleSide;
            if ("transmission" in mesh.material) {
              mesh.material.transmission = isSelected ? 0.50 : 0.72;
            }
          } else {
            mesh.material.transparent = fade < 1 && !isSelected;
            mesh.material.opacity = mesh.material.transparent ? fade : 1;
            mesh.material.depthWrite = !mesh.material.transparent;
          }
        }
      }
      if (explosion !== previousExplosion) followExplosion = true;
      applyExplosion();
      // The pin marks a point on the assembled mandible. Separating the
      // assembly or opening a tooth model moves that bone out from under it.
      if (pinnedLandmark && (explosion > 0 || dentalModel)) showLandmark(null);
      // Going back to assembled re-frames the head, but only once the parts
      // have actually arrived home; framing early would fit the exploded box.
      if (previousExplosion > 0 && explosion === 0) {
        if (shown === 0) view(currentDirection);
        else settleView = true;
      }
      renderBudget = Math.max(renderBudget, 2);
      render();
    },
    view,
    viewIntraoral,
    // A zoom is only ever a zoom. It never touches the separation amount, at
    // any distance, in either direction; that belongs to the slider alone.
    zoom(factor) {
      followExplosion = false;
      const selectedTooth =
        !currentState.toothDetail &&
        !dentalModel &&
        meshes.find(
          (m) =>
            m.userData.part.id === currentState.selected &&
            toothNumber(m.userData.part.name) &&
            m.visible,
        );
      if (factor < 1 && selectedTooth) {
        const center = new THREE.Box3()
          .setFromObject(selectedTooth)
          .getCenter(new THREE.Vector3());
        camera.position.lerp(center, 1 - factor);
        controls.target.lerp(center, 1 - factor);
      } else
        camera.position
          .sub(controls.target)
          .multiplyScalar(factor)
          .add(controls.target);
      applyingZoom = true;
      controls.update();
      render();
      applyingZoom = false;
    },
    setTurntable(active) {
      turntableActive = !!active;
      controls.autoRotate = turntableActive;
      if (turntableActive) renderBudget = Math.max(renderBudget, 4);
    },
    setGroupOpacity(group, val) {
      if (!currentState) return;
      if (!currentState.opacity) currentState.opacity = new Map();
      currentState.opacity.set(group, val);
      api.update(currentState);
    },
    soloPart(partId, { ghostContext = true } = {}) {
      if (!currentState) return;
      if (currentState.isolated && currentState.selected === partId) {
        currentState.isolated = false;
      } else {
        currentState.isolated = true;
        currentState.selected = partId;
        currentState.ghostContext = ghostContext;
      }
      api.update(currentState);
    },
    pulseInnervation(nerveKeyOrId) {
      const targets = new Set();
      const needle = String(nerveKeyOrId || "").toLowerCase();
      for (const m of meshes) {
        const p = m.userData.part;
        if (p?.group === "nerves") {
          if (!needle || p.name.toLowerCase().includes(needle) || p.id.toLowerCase().includes(needle)) {
            targets.add(m);
          }
        }
      }
      if (!targets.size) {
        for (const m of meshes) {
          if (m.userData.part?.group === "nerves") targets.add(m);
        }
      }
      activePulse = {
        targets,
        startTime: performance.now(),
        duration: 2500,
        ghostBackground: true,
        color: "#38bdf8",
      };
      renderBudget = Math.max(renderBudget, 6);
    },
    showLASimulator(protocolId) {
      if (!protocolId) {
        laSimulatorGroup.visible = false;
        if (activePulse) activePulse = null;
        if (currentState) api.update(currentState);
        renderBudget = Math.max(renderBudget, 2);
        render();
        return;
      }
      laSimulatorGroup.visible = true;

      // Authentic clinical anatomical landmarks & insertion trajectories
      const PROTOCOLS = {
        ianb: {
          target: [0.030, 1.506, 0.010], // Mandibular sulcus above lingula / foramen
          approach: [-0.022, 1.494, 0.038], // Contralateral premolars
          gaugeColor: 0xf59e0b, // 25G long (amber)
          anesthetized: ["inferior alveolar", "mental", "incisive", "lingual"],
        },
        mental: {
          target: [0.026, 1.488, 0.034], // Mental foramen between premolars 44/45 or 34/35
          approach: [0.034, 1.504, 0.046], // Mucobuccal fold superior-anterior
          gaugeColor: 0x38bdf8, // 27G short (cyan)
          anesthetized: ["mental", "incisive"],
        },
        psa: {
          target: [0.028, 1.545, 0.015], // Infratemporal surface of maxillary tuberosity
          approach: [0.038, 1.528, 0.036], // Mucobuccal fold above 2nd molar, 45° angle
          gaugeColor: 0x38bdf8, // 27G short (cyan)
          anesthetized: ["maxillary nerve"],
        },
        infraorbital: {
          target: [0.025, 1.578, 0.046], // Infraorbital foramen below orbit
          approach: [0.026, 1.536, 0.056], // Mucobuccal fold above 1st premolar
          gaugeColor: 0xf59e0b, // 25G/27G long
          anesthetized: ["infraorbital", "maxillary"],
        },
        greater_palatine: {
          target: [0.014, 1.540, 0.018], // Greater palatine foramen near 2nd molar
          approach: [0.010, 1.530, 0.038], // Palatal vault anterior
          gaugeColor: 0x38bdf8, // 27G short
          anesthetized: ["greater palatine"],
        },
      };

      const cfg = PROTOCOLS[protocolId] || PROTOCOLS.ianb;
      const targetVec = new THREE.Vector3(...cfg.target);
      const appVec = new THREE.Vector3(...cfg.approach);
      const dir = targetVec.clone().sub(appVec).normalize();

      diffusionField.position.copy(targetVec);
      needleHub.material.color.setHex(cfg.gaugeColor);

      // Orient needle shaft (length 0.035, hub back along trajectory)
      needleShaft.position.copy(targetVec).addScaledVector(dir, -0.0175);
      needleShaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

      needleHub.position.copy(targetVec).addScaledVector(dir, -0.035);
      needleHub.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

      // Highlight anesthetized nerve branches
      for (const m of meshes) {
        const pName = (m.userData.part?.name || "").toLowerCase();
        const matches = cfg.anesthetized.some((n) => pName.includes(n));
        if (matches) {
          m.material.emissive.set("#38bdf8");
          m.material.emissiveIntensity = 0.85;
        }
      }

      renderBudget = Math.max(renderBudget, 6);
      render();
    },
    tracePathway(pathwayId) {
      api.pulseInnervation(pathwayId);
    },
    dispose() {
      cancelAnimationFrame(frame);
      renderer.domElement.removeEventListener("wheel", wheel, true);
      resize.disconnect();
      environmentTarget.dispose();
      markerGeometry.dispose();
      markerMaterial.dispose();
      controls.dispose();
      meshes.forEach((m) => {
        m.geometry.dispose();
        m.material.dispose();
      });
      if (dentalModel) disposeModel(dentalModel);
      renderer.dispose();
    },
  };
  function wheel(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientHeight : 1);
    api.zoom(Math.exp(THREE.MathUtils.clamp(pixels, -120, 120) * 0.002), true);
  }
  renderer.domElement.addEventListener("wheel", wheel, { capture: true, passive: false });
  const bootstrapSize = () => {
    const { width, height } = host.getBoundingClientRect();
    const w = width || host.clientWidth || 1;
    const h = height || host.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(pixelRatioFor(w, h));
    renderer.setSize(w, h);
  };
  bootstrapSize();
  view();
  onReady();
  frame = requestAnimationFrame(tick);

  // Registered facial and masticatory muscles, fetched after the first frame.
  // A failure here leaves the rest of the atlas usable, so it reports rather
  // than rejecting the viewer that already exists.
  const deferred = atlas.parts.filter(
    (part) => part.bufferUrl && part.bufferUrl !== BASE_BUFFER,
  );
  if (deferred.length)
    (async () => {
      const urls = [...new Set(deferred.map((part) => part.bufferUrl))];
      try {
        for (const url of urls) buffers.set(url, await loadBuffer(url));
      } catch (error) {
        onPartsChanged({ pending: 0, failed: deferred.length, message: error.message });
        return;
      }
      for (const part of deferred)
        addMesh(part, geometryFrom(part, buffers.get(part.bufferUrl)));
      layoutKey = "";
      if (currentState) api.update(currentState);
      onPartsChanged({ pending: 0, failed: 0 });
    })();

  return api;
}

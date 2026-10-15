/** @typedef {{ scene?: string; partId?: string; theme?: string }} NavigatePayload */

const SOURCE_CHILD = "omf-atlas";
const SOURCE_PARENT = "fakarny";
const PROTOCOL_VERSION = 1;

/**
 * @param {string | undefined} configured
 * @returns {(origin: string) => boolean}
 */
export function createParentOriginGuard(configured) {
  if (configured) {
    return (origin) => origin === configured;
  }
  if (import.meta.env.DEV) {
    return () => true;
  }
  return () => false;
}

/**
 * @param {object} options
 * @param {(origin: string) => boolean} options.isAllowedParentOrigin
 * @param {() => string | undefined} options.getAtlasOrigin
 * @param {() => object} options.getPublicState
 * @param {(payload: NavigatePayload) => void | Promise<void>} options.onNavigate
 * @param {(partId: string) => void | Promise<void>} options.onSelectStructure
 */
export function initEmbedBridge({
  isAllowedParentOrigin,
  getAtlasOrigin,
  getPublicState,
  onNavigate,
  onSelectStructure,
}) {
  const post = (type, payload = {}) => {
    if (window.parent === window) return;
    const targetOrigin =
      typeof globalThis.__OMF_EMBED__?.parentOrigin === "string"
        ? globalThis.__OMF_EMBED__.parentOrigin
        : "*";
    window.parent.postMessage(
      { source: SOURCE_CHILD, v: PROTOCOL_VERSION, type, payload },
      targetOrigin === "*" ? "*" : targetOrigin,
    );
  };

  const postReady = () => {
    post("ready", {
      version: "0.2.0-fakarny",
      ui: globalThis.__OMF_EMBED__?.ui ?? "default",
    });
  };

  const postSelectStructure = (payload) => {
    post("selectStructure", payload);
  };

  const postError = (code, message) => {
    post("error", { code, message });
  };

  window.addEventListener("message", (event) => {
    if (!isAllowedParentOrigin(event.origin)) return;
    const data = event.data;
    if (!data || data.source !== SOURCE_PARENT || data.v !== PROTOCOL_VERSION)
      return;
    if (getAtlasOrigin() && event.origin !== getAtlasOrigin()) {
      // Parent origin is validated above; atlas origin is for parent-side checks only.
    }

    const run = async () => {
      try {
        switch (data.type) {
          case "navigate":
            await onNavigate(data.payload ?? {});
            break;
          case "selectStructure":
            if (data.payload?.partId)
              await onSelectStructure(String(data.payload.partId));
            break;
          case "requestState":
            post("state", getPublicState());
            break;
          default:
            break;
        }
      } catch (error) {
        postError(
          "handler_failed",
          error instanceof Error ? error.message : String(error),
        );
      }
    };
    void run();
  });

  return { postReady, postSelectStructure, postError };
}

export { SOURCE_CHILD, SOURCE_PARENT, PROTOCOL_VERSION };

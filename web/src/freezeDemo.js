export function isFreezeShortcut(event) {
  if (!event || (event.code !== "Space" && event.key !== " ")) return false;
  const target = event.target;
  const tagName = String(target?.tagName ?? "").toUpperCase();
  if (target?.isContentEditable) return false;
  return !["INPUT", "SELECT", "TEXTAREA", "BUTTON", "OPTION"].includes(tagName);
}

export function createAnimationFreezeGate(requestFrame, cancelFrame) {
  let frozen = false;
  let nextToken = 1;
  const active = new Map();

  function requestAnimationFrame(callback) {
    const token = nextToken++;
    const state = { frameId: null, cancelled: false };
    const tick = (timestamp) => {
      if (state.cancelled) return;
      if (frozen) {
        state.frameId = requestFrame(tick);
        return;
      }
      active.delete(token);
      callback(timestamp);
    };
    state.frameId = requestFrame(tick);
    active.set(token, state);
    return token;
  }

  function cancelAnimationFrame(token) {
    const state = active.get(token);
    if (!state) return;
    state.cancelled = true;
    cancelFrame(state.frameId);
    active.delete(token);
  }

  return {
    requestAnimationFrame,
    cancelAnimationFrame,
    setFrozen(value) { frozen = Boolean(value); },
    isFrozen() { return frozen; },
  };
}

export function installSpaceFreezeDemo({ windowObject = window, documentObject = document } = {}) {
  if (windowObject.__parallaxFreezeDemoInstalled) return;
  windowObject.__parallaxFreezeDemoInstalled = true;

  const originalRequestFrame = windowObject.requestAnimationFrame.bind(windowObject);
  const originalCancelFrame = windowObject.cancelAnimationFrame.bind(windowObject);
  const gate = createAnimationFreezeGate(originalRequestFrame, originalCancelFrame);
  windowObject.requestAnimationFrame = gate.requestAnimationFrame;
  windowObject.cancelAnimationFrame = gate.cancelAnimationFrame;

  let held = false;
  let restoreSmoothing = null;
  const indicator = createFreezeIndicator(documentObject);

  function setSmoothingForInstantRecalibration() {
    const input = documentObject.querySelector("#smoothing");
    if (!input || restoreSmoothing) return;
    const previous = input.value;
    const dispatch = () => input.dispatchEvent(new Event("input", { bubbles: true }));
    input.value = "0";
    dispatch();
    restoreSmoothing = () => {
      input.value = previous;
      dispatch();
      restoreSmoothing = null;
    };
    originalRequestFrame(() => originalRequestFrame(() => restoreSmoothing?.()));
  }

  function beginFreeze(event) {
    if (!isFreezeShortcut(event) || event.repeat || held) return;
    event.preventDefault();
    held = true;
    gate.setFrozen(true);
    indicator.hidden = false;
    documentObject.documentElement.dataset.parallaxFrozen = "true";
  }

  function endFreeze(event) {
    if (!held) return;
    if (event && !isFreezeShortcut(event)) return;
    event?.preventDefault?.();
    setSmoothingForInstantRecalibration();
    held = false;
    gate.setFrozen(false);
    indicator.hidden = true;
    delete documentObject.documentElement.dataset.parallaxFrozen;
  }

  windowObject.addEventListener("keydown", beginFreeze, { capture: true });
  windowObject.addEventListener("keyup", endFreeze, { capture: true });
  windowObject.addEventListener("blur", () => endFreeze());
}

function createFreezeIndicator(documentObject) {
  const indicator = documentObject.createElement("div");
  indicator.textContent = "Bild eingefroren · Leertaste loslassen zum Neukalibrieren";
  indicator.hidden = true;
  Object.assign(indicator.style, {
    position: "absolute",
    zIndex: "8",
    left: "50%",
    bottom: "1.25rem",
    transform: "translateX(-50%)",
    padding: "0.65rem 0.9rem",
    border: "1px solid rgba(109, 241, 212, 0.45)",
    borderRadius: "0.7rem",
    background: "rgba(8, 17, 24, 0.88)",
    color: "#dffdf7",
    font: "600 0.82rem/1.2 system-ui, sans-serif",
    boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
    pointerEvents: "none",
    backdropFilter: "blur(10px)",
    whiteSpace: "nowrap",
  });
  documentObject.querySelector("#viewport")?.append(indicator);
  return indicator;
}

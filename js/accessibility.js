import { renderIconLabel } from "./uiIcons.js";

const KEY = "ps_accessibility_v1";

const DEFAULTS = {
  overlay: "default",
  font: "standard",
  spacing: "normal",
  textSize: "normal",
};

function normaliseSettings(raw = {}) {
  return {
    overlay: String(raw.overlay || DEFAULTS.overlay).trim() || DEFAULTS.overlay,
    font: raw.font || (raw.dyslexiaFont ? "dyslexia" : DEFAULTS.font),
    spacing: raw.spacing || (raw.extraSpacing ? "wide" : DEFAULTS.spacing),
    textSize: raw.textSize || (raw.largeText ? "large" : DEFAULTS.textSize),
  };
}

export function getAccessibilitySettings() {
  try {
    return { ...DEFAULTS, ...normaliseSettings(JSON.parse(localStorage.getItem(KEY) || "{}") || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveAccessibilitySettings(next) {
  const merged = { ...getAccessibilitySettings(), ...next };
  localStorage.setItem(KEY, JSON.stringify(merged));
  applyAccessibilitySettings(merged);
  return merged;
}

export function applyAccessibilitySettings(settings = getAccessibilitySettings()) {
  const body = document.body;
  if (!body) return;
  body.classList.remove(
    "acc-overlay-default",
    "acc-overlay-cream",
    "acc-overlay-blue",
    "acc-overlay-green",
    "acc-overlay-yellow",
    "acc-font-standard",
    "acc-font-dyslexia",
    "acc-spacing-normal",
    "acc-spacing-wide",
    "acc-text-normal",
    "acc-text-large",
  );
  body.classList.add(`acc-overlay-${settings.overlay || "default"}`);
  body.classList.add(`acc-font-${settings.font || "standard"}`);
  body.classList.add(`acc-spacing-${settings.spacing || "normal"}`);
  body.classList.add(`acc-text-${settings.textSize || "normal"}`);
}

export function renderAccessibilityControls() {
  const settings = getAccessibilitySettings();
  return `
    <section class="card accessibility-card">
      <h3>${renderIconLabel("eye", "Reading help")}</h3>
      <div class="accessibilityGrid">
        <div class="accessibilityField">
          <label>Overlay</label>
          <select class="input" data-acc-field="overlay">
            <option value="default" ${settings.overlay === "default" ? "selected" : ""}>Default</option>
            <option value="cream" ${settings.overlay === "cream" ? "selected" : ""}>Cream</option>
            <option value="blue" ${settings.overlay === "blue" ? "selected" : ""}>Blue</option>
            <option value="green" ${settings.overlay === "green" ? "selected" : ""}>Green</option>
            <option value="yellow" ${settings.overlay === "yellow" ? "selected" : ""}>Yellow</option>
          </select>
        </div>
        <div class="accessibilityField">
          <label>Font</label>
          <select class="input" data-acc-field="font">
            <option value="standard" ${settings.font === "standard" ? "selected" : ""}>Standard</option>
            <option value="dyslexia" ${settings.font === "dyslexia" ? "selected" : ""}>Dyslexia friendly</option>
          </select>
        </div>
        <div class="accessibilityField">
          <label>Spacing</label>
          <select class="input" data-acc-field="spacing">
            <option value="normal" ${settings.spacing === "normal" ? "selected" : ""}>Normal</option>
            <option value="wide" ${settings.spacing === "wide" ? "selected" : ""}>Wide</option>
          </select>
        </div>
        <div class="accessibilityField">
          <label>Size</label>
          <select class="input" data-acc-field="textSize">
            <option value="normal" ${settings.textSize === "normal" ? "selected" : ""}>Normal</option>
            <option value="large" ${settings.textSize === "large" ? "selected" : ""}>Large</option>
          </select>
        </div>
      </div>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const ICONS = {
  activity: `
    <path d="M4 13h3l2-4 4 8 2-4h5" />
  `,
  arrowRight: `
    <path d="M5 12h14" />
    <path d="m13 7 5 5-5 5" />
  `,
  award: `
    <circle cx="12" cy="8" r="4" />
    <path d="m9.5 12 1 8 1.5-2 1.5 2 1-8" />
  `,
  book: `
    <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4H19v15H7.5A2.5 2.5 0 0 0 5 21z" />
    <path d="M5 6.5V21" />
  `,
  calendar: `
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M8 3.5v3" />
    <path d="M16 3.5v3" />
    <path d="M3.5 9.5h17" />
  `,
  chart: `
    <path d="M4 20V9" />
    <path d="M10 20V4" />
    <path d="M16 20v-7" />
    <path d="M22 20v-11" />
  `,
  checkCircle: `
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.5 12 2.2 2.2 4.8-4.8" />
  `,
  clock: `
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5v5l3 1.8" />
  `,
  eye: `
    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
    <circle cx="12" cy="12" r="2.5" />
  `,
  info: `
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 10.2v5" />
    <circle cx="12" cy="7.4" r="0.95" fill="currentColor" stroke="none" />
  `,
  grid: `
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  `,
  list: `
    <path d="M9 6.5h10" />
    <path d="M9 12h10" />
    <path d="M9 17.5h10" />
    <circle cx="5.5" cy="6.5" r="1" />
    <circle cx="5.5" cy="12" r="1" />
    <circle cx="5.5" cy="17.5" r="1" />
  `,
  pause: `
    <circle cx="12" cy="12" r="8.5" />
    <path d="M10 9v6" />
    <path d="M14 9v6" />
  `,
  repeat: `
    <path d="M17 2.5 21 6l-4 3.5" />
    <path d="M20.5 6H9a4 4 0 0 0-4 4v1" />
    <path d="m7 21.5-4-3.5L7 14.5" />
    <path d="M3.5 18H15a4 4 0 0 0 4-4v-1" />
  `,
  shield: `
    <path d="M12 3.5 19 6v5c0 4.1-2.5 7.1-7 9-4.5-1.9-7-4.9-7-9V6z" />
    <path d="m9.5 11.8 1.7 1.7 3.3-3.3" />
  `,
  spark: `
    <path d="m12 3 1.4 4.2L18 8.6l-4.6 1.4L12 14.5l-1.4-4.5L6 8.6l4.6-1.4z" />
    <path d="m18.5 14.5.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7z" />
    <path d="m5.5 14.5.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6z" />
  `,
  star: `
    <path d="m12 3.5 2.6 5.2 5.8.8-4.2 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.2-4.1 5.8-.8z" />
  `,
  target: `
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
  `,
  trendUp: `
    <path d="M4 16.5 10 10.5l4 4 6-7" />
    <path d="M15 7.5h5v5" />
  `,
  users: `
    <path d="M16.5 19v-1.3a3.2 3.2 0 0 0-3.2-3.2H8.7a3.2 3.2 0 0 0-3.2 3.2V19" />
    <circle cx="11" cy="8" r="3.2" />
    <path d="M18.5 18.5v-.8a2.6 2.6 0 0 0-1.8-2.5" />
    <path d="M16.7 5.6a2.7 2.7 0 0 1 0 4.8" />
  `,
  zap: `
    <path d="M13.5 2.5 6 13h5l-1 8.5L18 11h-5z" />
  `,
};

export function renderIcon(name, { className = "", label = "", hidden = true } = {}) {
  const svg = ICONS[name] || ICONS.spark;
  const classes = ["uiIcon", className].filter(Boolean).join(" ");
  const title = label ? `<title>${escapeHtml(label)}</title>` : "";
  const accessibility = hidden || !label
    ? 'aria-hidden="true"'
    : `role="img" aria-label="${escapeHtml(label)}"`;
  return `
    <svg class="${classes}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" ${accessibility}>
      ${title}
      ${svg}
    </svg>
  `.trim();
}

export function renderIconOnly(name, label, className = "") {
  const classes = ["uiIconOnly", className].filter(Boolean).join(" ");
  return `
    <span class="${classes}" title="${escapeHtml(label)}">
      ${renderIcon(name)}
      <span class="sr-only">${escapeHtml(label)}</span>
    </span>
  `;
}

export function renderIconLabel(name, label, className = "") {
  const classes = ["uiIconLabel", className].filter(Boolean).join(" ");
  return `
    <span class="${classes}">
      ${renderIcon(name)}
      <span>${escapeHtml(label)}</span>
    </span>
  `;
}

export function renderIconValue(name, label, value, className = "") {
  const classes = ["uiMetricInline", className].filter(Boolean).join(" ");
  return `
    <span class="${classes}" title="${escapeHtml(label)}">
      ${renderIcon(name)}
      <strong>${escapeHtml(value)}</strong>
      <span class="sr-only">${escapeHtml(label)}</span>
    </span>
  `;
}

export function renderInfoTip(
  text,
  {
    label = "More info",
    className = "",
    triggerClassName = "",
    bubbleClassName = "",
    align = "center",
    html = "",
    triggerHtml = "",
    showIcon = true,
  } = {}
) {
  if (!text && !html) return "";
  const alignClass = align === "start" ? "uiInfoTip--start" : align === "end" ? "uiInfoTip--end" : "";
  const classes = ["uiInfoTip", alignClass, className].filter(Boolean).join(" ");
  const triggerClasses = ["uiInfoTipTrigger", triggerClassName].filter(Boolean).join(" ");
  const bubbleClasses = ["uiInfoTipBubble", bubbleClassName].filter(Boolean).join(" ");
  const content = html || escapeHtml(String(text ?? "").replaceAll("\r", "")).replaceAll("\n", "<br />");
  const triggerContent = [
    showIcon ? renderIcon("info") : "",
    triggerHtml,
    `<span class="sr-only">${escapeHtml(label)}</span>`,
  ].filter(Boolean).join("");
  return `
    <details class="${classes}">
      <summary class="${triggerClasses}" aria-label="${escapeHtml(label)}">
        ${triggerContent}
      </summary>
      <div class="${bubbleClasses}" role="note">
        ${content}
      </div>
    </details>
  `;
}


import { DEFAULT_GRAPHEME_BANK } from "./config.js";

export function createScrollMode({ item, allowedGraphemes }) {
  const bank = (allowedGraphemes?.length ? allowedGraphemes : DEFAULT_GRAPHEME_BANK).slice();
  const targetSegments = Array.isArray(item?.segments)
    ? item.segments.map((s) => String(s || "").trim()).filter(Boolean)
    : [];

  const values = targetSegments.map(() => "");
  let active = 0;

  function bump(i, dir) {
    const cur = (values[i] || "").trim();
    const idx = bank.indexOf(cur);
    const next = (idx === -1)
      ? (dir > 0 ? 0 : bank.length - 1)
      : (idx + dir + bank.length) % bank.length;
    values[i] = bank[next];
  }

  return {
    bank,
    values,
    targetSegments,
    get active() {
      return active;
    },
    setActive(i) {
      active = Math.max(0, Math.min(values.length - 1, Number(i) || 0));
    },
    bump,
  };
}

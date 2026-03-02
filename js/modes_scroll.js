import { DEFAULT_GRAPHEME_BANK } from "./config.js";

export function createScrollMode({ item, allowedGraphemes }){
  const bank = (allowedGraphemes?.length ? allowedGraphemes : DEFAULT_GRAPHEME_BANK).slice();
  const values = item.segments.map(s => String(s)); // start “filled” (teach). Change to "" for blank.
  let active = Math.floor(values.length / 2);

  function bump(i, dir){
    const cur = (values[i] || "").trim();
    const idx = bank.indexOf(cur);
    const next = (idx === -1)
      ? (dir > 0 ? 0 : bank.length-1)
      : (idx + dir + bank.length) % bank.length;
    values[i] = bank[next];
  }

  return { bank, values, get active(){return active;}, setActive:(i)=>{active=i;}, bump };
}

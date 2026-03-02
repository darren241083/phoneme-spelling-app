const banner = document.getElementById("banner");

export function showBanner(msg){
  if (!banner) return;
  banner.style.display = "block";
  banner.textContent = msg;
}

export function clearBanner(){
  if (!banner) return;
  banner.style.display = "none";
  banner.textContent = "";
}

export function setNotice(el, msg){
  if (!el) return;
  if (!msg){
    el.style.display = "none";
    el.textContent = "";
    return;
  }
  el.style.display = "block";
  el.textContent = msg;
}

export function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

export function randCode(len=4){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i=0;i<len;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

export function randDigits(len=4){
  let out = "";
  for (let i=0;i<len;i++) out += String(Math.floor(Math.random()*10));
  return out;
}

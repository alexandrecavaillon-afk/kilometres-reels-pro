/* ---------- Outils ---------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const nf1 = new Intl.NumberFormat("fr-FR", {minimumFractionDigits:1, maximumFractionDigits:1});
const nf0 = new Intl.NumberFormat("fr-FR");
const km = m => m == null ? "—" : (m < 10000 ? nf1.format(m / 1000) : nf0.format(Math.round(m / 1000))) + " km";
function dur(s){
  if (s == null) return "—";
  let m = Math.round(s / 60);
  if (m < 60) return Math.max(1, m) + " min";
  const h = Math.floor(m / 60); m = m % 60;
  return h + " h " + String(m).padStart(2, "0");
}
const plural = (n, w, ws) => nf0.format(n) + " " + (n > 1 ? (ws || w + "s") : w);
const MAX_DEST = 500;
const PAYS = {BE:"Belgique", LU:"Luxembourg", DE:"Allemagne", CH:"Suisse", IT:"Italie", MC:"Monaco", AD:"Andorre", ES:"Espagne"};

/* ---------- Icônes et couleurs des types ---------- */
const ICONS = {
  ehpad:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M12 17.5s-3.2-1.9-3.2-4a1.7 1.7 0 0 1 3.2-.9 1.7 1.7 0 0 1 3.2.9c0 2.1-3.2 4-3.2 4z"/>',
  usld:'<path d="M3 6v13M3 15h18M21 19v-5a3 3 0 0 0-3-3h-7v4"/><circle cx="7" cy="11.5" r="2"/>',
  residence:'<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M10 21v-4h4v4"/>',
  accueil_jour:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  ssiad:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M12 12v6M9 15h6"/>',
  saad:'<path d="M11 14h2a2 2 0 0 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16"/><path d="M7 20l1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.8-2.8l-4.2 3.9"/><path d="M2 15l6 6"/>',
  chu:'<path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M12 8v6M9 11h6"/><path d="M10 21v-3h4v3"/>',
  ch:'<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M12 8v6M9 11h6M9 21v-3h6v3"/>',
  clinique:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  smr:'<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  psy:'<path d="M12 3a7 7 0 0 0-7 7c0 2 .8 3.6 2 4.8V21h7v-3h2a2 2 0 0 0 2-2v-2.2l2.1-.9-2-3.6A7 7 0 0 0 12 3z"/>',
  had:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M8 15h2l1-2 2 4 1-2h2"/>',
  dialyse:'<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
  cancer:'<path d="M12 3c2 0 3.5 1.5 3.5 3.5 0 2.6-2.2 5.3-3.5 7-1.3-1.7-3.5-4.4-3.5-7C8.5 4.5 10 3 12 3z"/><path d="M10.2 12.8L6 21l2.6-.6L10 22.5l2-4.6M13.8 12.8L18 21l-2.6-.6L14 22.5l-2-4.6"/>',
  centre_sante:'<path d="M6 3v5a4 4 0 0 0 8 0V3"/><path d="M10 12v3a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="11" r="2"/>',
  msp:'<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2A5 5 0 0 1 21 19"/>',
  labo:'<path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7 15h10"/>',
  snp:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
};
const COLORS = {ehpad:"#ff9500", usld:"#ff6b00", residence:"#c69026", accueil_jour:"#ffb300", ssiad:"#e8743b", saad:"#d9822b",
  chu:"#ff3b30", ch:"#e5334b", clinique:"#ff2d55", smr:"#af52de", psy:"#8e5cd9", had:"#d63f7a", dialyse:"#5e5ce6", cancer:"#c9346f",
  centre_sante:"#30b0c7", msp:"#34c759", labo:"#007aff", snp:"#32ade6"};
const FAM_DESC = {pa:"Hébergement, accueil et services à domicile", hop:"Établissements de soins", ville:"Proximité et analyses"};
const svg = id => `<svg class="i" viewBox="0 0 24 24">${ICONS[id] || ICONS.clinique}</svg>`;
const tile = id => `<span class="tile" style="background:${COLORS[id] || "#8e8e93"}">${svg(id)}</span>`;

/* ---------- État ---------- */
let META = null;
const CAT = {};
const DATA = new Map();
const S = {mode:null, start:null, starts:[], cat:null, sort:"km", n:10, nMulti:3, foreign:true,
  results:[], multi:[], open:null, busy:false, abort:false, routeCache:new Map(), pendingRows:null};

/* ---------- Réseau ---------- */
async function fetchJSON(url, tries = 3, opts = {}){
  let lastErr;
  for (let a = 0; a < tries; a++){
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 25000);
      const res = await fetch(url, {signal:ctl.signal, credentials:"omit", ...opts});
      clearTimeout(t);
      if (res.status === 429 || res.status >= 500){ lastErr = new Error("service saturé (" + res.status + ")"); await sleep(1500 * (a + 1)); continue; }
      if (!res.ok && res.status !== 400) throw new Error("erreur " + res.status);
      return await res.json();
    } catch (e){ lastErr = e; if (a < tries - 1) await sleep(1200 * (a + 1)); }
  }
  throw lastErr || new Error("service injoignable");
}

const ROUTERS = ["https://router.project-osrm.org", "https://routing.openstreetmap.de/routed-car"];
let routerIdx = 0, lastOsrm = 0;
async function osrm(path){
  let err;
  for (let k = 0; k < ROUTERS.length; k++){
    const wait = 1100 - (Date.now() - lastOsrm); if (wait > 0) await sleep(wait);
    lastOsrm = Date.now();
    try {
      const r = await fetchJSON(ROUTERS[routerIdx] + path, 2, {cache:"no-store"});
      if (r.code === "Ok") return r;
      err = new Error(r.message || r.code);
      if (r.code === "NoRoute" || r.code === "NoSegment") throw err;
    } catch (e){ err = e; }
    routerIdx = (routerIdx + 1) % ROUTERS.length;
  }
  throw err || new Error("calcul d'itinéraire impossible");
}
const cstr = p => p.lon.toFixed(5) + "," + p.lat.toFixed(5);

/* ---------- Pays des adresses ---------- */
const ISO = "ad ae af ag ai al am ao aq ar as at au aw ax az ba bb bd be bf bg bh bi bj bl bm bn bo bq br bs bt bw by bz ca cc cd cf cg ch ci ck cl cm cn co cr cu cv cw cx cy cz de dj dk dm do dz ec ee eg eh er es et fi fj fk fm fo fr ga gb gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy hk hn hr ht hu id ie il im in io iq ir is it je jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mf mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl no np nr nu nz om pa pe pf pg ph pk pl pm pn pr ps pt pw py qa re ro rs ru rw sa sb sc sd se sg sh si sk sl sm sn so sr ss st sv sx sy sz tc td tf tg th tj tk tl tm tn to tr tt tv tw tz ua ug us uy uz va vc ve vg vi vn vu wf ws xk ye yt za zm zw".split(" ");
const FREQ = ["fr", "be", "ch", "lu", "de", "it", "es", "mc", "ad", "gb", "nl", "pt", "at"];
let RNAMES = null;
try { RNAMES = new Intl.DisplayNames(["fr"], {type:"region"}); } catch (e){ /* ancien navigateur */ }
const countryName = cc => { try { return RNAMES ? RNAMES.of(cc.toUpperCase()) : cc.toUpperCase(); } catch (e){ return cc.toUpperCase(); } };
function loadScope(){
  try { const v = JSON.parse(localStorage.getItem("kr-pays") || "null"); if (v && (v.world || (Array.isArray(v.cc) && v.cc.length))) return {world:!!v.world, cc:(v.cc || []).filter(c => ISO.includes(c))}; } catch (e){ /* stockage indisponible */ }
  return {world:false, cc:["fr"]};
}
let SCOPE = loadScope();
if (!SCOPE.world && !SCOPE.cc.length) SCOPE = {world:false, cc:["fr"]};
const scopeHasFR = () => SCOPE.world || SCOPE.cc.includes("fr");
const onlyFR = () => !SCOPE.world && SCOPE.cc.length === 1 && SCOPE.cc[0] === "fr";
const singleCountry = () => !SCOPE.world && SCOPE.cc.length === 1;
const inScope = cc => SCOPE.world || SCOPE.cc.includes((cc || "").toLowerCase());
const scopeKey = () => SCOPE.world ? "*" : SCOPE.cc.slice().sort().join(",");
function scopeLabel(){
  if (SCOPE.world) return "Tous les pays";
  if (SCOPE.cc.length <= 2) return SCOPE.cc.map(countryName).join(", ");
  return SCOPE.cc.length + " pays";
}

/* ---------- Localisation des adresses ---------- */
const COORD_RE = /^\s*(-?\d{1,2}\.\d+)\s*[,;\s]\s*(-?\d{1,3}\.\d+)\s*$/;
const POSTAL_RE = /^\s*(?=[A-Za-z0-9 -]*\d)[A-Za-z0-9]{2,5}(?:[ -][A-Za-z0-9]{2,4})?\s*$/;
const isPostal = q => POSTAL_RE.test(q) && q.replace(/[^A-Za-z0-9]/g, "").length >= 3 && !/[A-Za-z]{4,}/.test(q);
const withCountry = (label, cc) => singleCountry() || !cc ? label : label + " · " + countryName(cc);
function shortLabel(x){
  const a = x.address || {};
  const city = a.city || a.town || a.village || a.municipality || a.hamlet || a.suburb || "";
  const street = [a.house_number, a.road || a.pedestrian || a.square].filter(Boolean).join(" ");
  const first = x.name && x.name !== city && x.name !== a.road ? x.name : street;
  const lab = [first, [a.postcode, city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || x.display_name;
  return withCountry(lab, a.country_code);
}
let lastNomi = 0;
async function nominatimRaw(params){
  const wait = 1100 - (Date.now() - lastNomi); if (wait > 0) await sleep(wait);
  lastNomi = Date.now();
  const cc = SCOPE.world ? "" : "&countrycodes=" + SCOPE.cc.join(",");
  return await fetchJSON("https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&accept-language=fr" + cc + "&" + params, 2);
}
async function nominatim(q){
  const r = await nominatimRaw("limit=1&q=" + encodeURIComponent(q.slice(0, 200)));
  return r[0] ? {lat:+r[0].lat, lon:+r[0].lon, label:shortLabel(r[0]), cc:(r[0].address || {}).country_code, score:null} : null;
}
/* Code postal seul : une seule proposition par pays, la plus grande ville de ce code. */
const PC_CACHE = new Map();
function postalCandidates(raw){
  const code = raw.trim().toUpperCase().replace(/\s+/g, " ");
  const key = code + "|" + scopeKey();
  if (PC_CACHE.has(key)) return PC_CACHE.get(key);
  const p = (async () => {
    const out = [];
    let ignErr = null;
    if (scopeHasFR() && /^\d{5}$/.test(code)){
      const biggest = async cp => {
        const r = await fetchJSON(`https://data.geopf.fr/geocodage/search?limit=20&index=address&type=municipality&q=${cp}&postcode=${cp}`, 3);
        const fs = (r.features || []).filter(f => f.properties.postcode === cp && !/Arrondissement/.test(f.properties.label))
          .sort((a, b) => (b.properties.population || 0) - (a.properties.population || 0));
        if (fs[0]) return fs[0];
        // Code secondaire d'une grande ville (59800 Lille, 44200 Nantes…) : la commune porte un autre code principal.
        // On prend la ville dominante parmi les rues de ce code, placée au centre de ces rues.
        const r2 = await fetchJSON(`https://data.geopf.fr/geocodage/search?limit=40&index=address&q=${cp}&postcode=${cp}`, 3);
        const st = (r2.features || []).filter(f => f.properties.postcode === cp);
        if (!st.length) return null;
        const by = new Map();
        st.forEach(f => { const k = f.properties.citycode || f.properties.city; if (!by.has(k)) by.set(k, []); by.get(k).push(f); });
        const top = [...by.values()].sort((x, y) => y.length - x.length)[0];
        const med = a => { const v = a.slice().sort((p, q) => p - q); return v[Math.floor(v.length / 2)]; };
        return {geometry:{coordinates:[med(top.map(f => f.geometry.coordinates[0])), med(top.map(f => f.geometry.coordinates[1]))]}, properties:{city:top[0].properties.city, label:top[0].properties.city, postcode:cp}};
      };
      try {
        let f = await biggest(code), approx = "";
        // Code CEDEX : on se rattache à la commune du code « de base » (57403 → 57400, puis 57000)
        if (!f && !code.endsWith("0")){ for (const base of [code.slice(0, 4) + "0", code.slice(0, 3) + "00"]){ f = await biggest(base); if (f){ approx = base; break; } } }
        if (f) out.push({lat:f.geometry.coordinates[1], lon:f.geometry.coordinates[0], label:withCountry(code + " " + (f.properties.city || f.properties.label) + (approx ? " (CEDEX, pris comme " + approx + ")" : ""), "fr"), cc:"fr", commune:true, cedex:!!approx, score:1});
      } catch (e){ ignErr = e; }
    }
    if (!onlyFR() || !out.length){
      try {
        const r = await nominatimRaw("limit=10&postalcode=" + encodeURIComponent(code));
        const seen = new Set(out.map(x => x.cc));
        for (const x of r){
          const a = x.address || {}, cc = a.country_code;
          if (!cc || seen.has(cc) || !inScope(cc)) continue;
          seen.add(cc);
          const city = a.city || a.town || a.village || a.municipality || a.county || a.state || "";
          out.push({lat:+x.lat, lon:+x.lon, label:withCountry((code + " " + city).trim(), cc), cc, commune:true, score:1});
        }
      } catch (e){ /* rien de plus */ }
    }
    if (!out.length && ignErr) throw ignErr; // erreur réseau : on ne garde pas un résultat vide en mémoire
    return out;
  })();
  PC_CACHE.set(key, p);
  p.catch(() => PC_CACHE.delete(key));
  return p;
}
async function geocode(q){
  const m = q.match(COORD_RE);
  if (m) return {lat:+m[1], lon:+m[2], label:m[1] + ", " + m[2], score:1};
  if (isPostal(q)){
    let err = null;
    try { const c = await postalCandidates(q); if (c[0]) return c[0]; } catch (e){ err = e; }
    if (onlyFR() && /^\s*\d{5}\s*$/.test(q)){ if (err) throw err; return null; } // un code postal français introuvable ne doit pas tomber sur n'importe quelle adresse
  }
  let best = null;
  if (scopeHasFR()){
    try {
      const r = await fetchJSON("https://data.geopf.fr/geocodage/search?limit=1&q=" + encodeURIComponent(q.slice(0, 200)), 3);
      const f = r.features && r.features[0];
      if (f) best = {lat:f.geometry.coordinates[1], lon:f.geometry.coordinates[0], label:withCountry(f.properties.label, "fr"), cc:"fr", score:f.properties.score};
    } catch (e){ /* on tente OpenStreetMap */ }
    if (best && best.score >= (onlyFR() ? 0.45 : 0.72)) return best;
  }
  try { const n = await nominatim(q); if (n) return n; } catch (e){ /* on garde le résultat IGN */ }
  return best;
}
async function photon(q){
  const r = await fetchJSON("https://photon.komoot.io/api/?limit=12&lang=fr&q=" + encodeURIComponent(q.slice(0, 200)), 1);
  return (r.features || []).filter(f => inScope(f.properties.countrycode)).map(f => {
    const p = f.properties, cc = (p.countrycode || "").toLowerCase();
    const street = [p.housenumber, p.street].filter(Boolean).join(" ");
    const first = p.name && p.name !== p.city ? p.name : street;
    const lab = [first, [p.postcode, p.city && p.city !== first ? p.city : ""].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    return {lat:f.geometry.coordinates[1], lon:f.geometry.coordinates[0], label:withCountry(lab || p.country || "", cc), cc};
  });
}
async function suggest(q){
  if (isPostal(q)) return await postalCandidates(q);
  const jobs = [];
  if (scopeHasFR()) jobs.push(fetchJSON("https://data.geopf.fr/geocodage/completion/?type=StreetAddress,PositionOfInterest&maximumResponses=6&text=" + encodeURIComponent(q.slice(0, 200)), 1)
    .then(r => (r.results || []).map(x => ({lat:x.y, lon:x.x, cc:"fr", label:withCountry(x.fulltext, "fr"), sub:x.country === "PositionOfInterest" && x.city && !x.fulltext.includes(x.city) ? [x.zipcode, x.city].filter(Boolean).join(" ") : ""}))));
  if (!onlyFR()) jobs.push(photon(q));
  const res = await Promise.allSettled(jobs);
  const fr = res[0] && scopeHasFR() && res[0].status === "fulfilled" ? res[0].value : [];
  const ph = !onlyFR() ? (res[res.length - 1].status === "fulfilled" ? res[res.length - 1].value : []) : [];
  const seen = new Set();
  const out = [...fr.slice(0, onlyFR() ? 6 : 3), ...ph.filter(x => !(fr.length && x.cc === "fr"))].filter(x => { const k = x.label.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  return out.slice(0, 7);
}

/* ---------- Choix des pays ---------- */
let scopeDraft = null;
function updateScopeUI(){
  $$(".scope-txt").forEach(e => { e.textContent = SCOPE.world && e.closest(".scope") ? "tous les pays" : scopeLabel(); });
  $$(".scope-pre").forEach(e => { e.textContent = SCOPE.world ? "Adresses dans" : "Adresses en"; });
}
function openCountrySheet(){
  scopeDraft = {world:SCOPE.world, cc:new Set(SCOPE.cc)};
  $("#cWorld").checked = scopeDraft.world; $("#cFilter").value = "";
  renderCountryList(); openSheet("#countrySheet");
}
function renderCountryList(){
  const f = $("#cFilter").value.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const norm = t => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const row = cc => `<label class="crow"><input type="checkbox" value="${cc}"${scopeDraft.cc.has(cc) ? " checked" : ""}><span>${esc(countryName(cc))}</span></label>`;
  const all = ISO.filter(c => !FREQ.includes(c)).sort((a, b) => countryName(a).localeCompare(countryName(b), "fr"));
  const match = c => !f || norm(countryName(c)).includes(f) || c === f;
  const fq = FREQ.filter(match), rest = all.filter(match);
  $("#cList").innerHTML = (fq.length ? `<h3>Fréquents</h3>${fq.map(row).join("")}` : "") + (rest.length ? `<h3>Tous les pays</h3>${rest.map(row).join("")}` : "") || `<p class="hint">Aucun pays ne correspond.</p>`;
  $("#cList").classList.toggle("dim", scopeDraft.world);
  const n = scopeDraft.cc.size;
  $("#cCount").textContent = scopeDraft.world ? "Recherche dans le monde entier" : n ? `${n} pays sélectionné${n > 1 ? "s" : ""}` : "Choisissez au moins un pays";
  $("#cOk").disabled = !scopeDraft.world && !n;
}
function applyCountrySheet(){
  if (!scopeDraft.world && !scopeDraft.cc.size) return;
  SCOPE = {world:scopeDraft.world, cc:[...scopeDraft.cc]};
  if (!SCOPE.cc.length) SCOPE.cc = ["fr"];
  try { localStorage.setItem("kr-pays", JSON.stringify(SCOPE)); } catch (e){ /* stockage indisponible */ }
  PC_CACHE.clear(); updateScopeUI(); closeSheet("#countrySheet");
}

/* ---------- Barre de recherche avec suggestions ---------- */
const searches = [];
function setupSearch(root, onPick = pickStart, onMsg = homeMsg, allowPaste = true){
  const input = $("input", root), list = $(".sugg", root), go = $(".go", root);
  let items = [], sel = -1, timer = 0, seq = 0;
  const close = () => { list.classList.add("hidden"); input.setAttribute("aria-expanded", "false"); sel = -1; };
  const draw = () => {
    if (!items.length){ close(); return; }
    list.innerHTML = items.map((s, k) => `<li role="option" data-k="${k}" aria-selected="${k === sel}"><svg class="i" viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.2A7 7 0 0 1 12 3a7 7 0 0 1 7 6.8C19 14.8 12 21 12 21z"/><circle cx="12" cy="10" r="2.5"/></svg><span>${esc(s.label)}${s.sub ? `<small>${esc(s.sub)}</small>` : ""}</span></li>`).join("");
    list.classList.remove("hidden"); input.setAttribute("aria-expanded", "true");
  };
  const pick = s => { close(); input.blur(); onPick(s, input); };
  const submit = async () => {
    const q = input.value.trim(); if (!q) { input.focus(); return; }
    if (sel >= 0 && items[sel]) return pick(items[sel]);
    close(); onMsg("");
    input.disabled = true;
    try {
      const g = await geocode(q);
      if (!g) onMsg("Adresse introuvable. Précisez le numéro, la rue et la ville, ou un code postal.");
      else onPick(g, input);
    } catch (e){ onMsg("La recherche d'adresse ne répond pas. Réessayez dans un instant."); }
    finally { input.disabled = false; }
  };
  input.addEventListener("input", () => {
    clearTimeout(timer); sel = -1;
    const q = input.value.trim();
    input.dispatchEvent(new CustomEvent("edited"));
    if (q.length < 3 || COORD_RE.test(q)){ items = []; close(); return; }
    timer = setTimeout(async () => {
      const my = ++seq;
      try { const r = await suggest(q); if (my === seq){ items = r; draw(); } } catch (e){ /* pas de suggestions */ }
    }, isPostal(q) && !onlyFR() ? 550 : 160);
  });
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" && items.length){ e.preventDefault(); sel = (sel + 1) % items.length; draw(); }
    else if (e.key === "ArrowUp" && items.length){ e.preventDefault(); sel = (sel - 1 + items.length) % items.length; draw(); }
    else if (e.key === "Enter"){ e.preventDefault(); submit(); }
    else if (e.key === "Escape") close();
  });
  input.addEventListener("blur", () => setTimeout(close, 150));
  if (allowPaste) input.addEventListener("paste", e => {
    const t = e.clipboardData && e.clipboardData.getData("text/plain");
    if (!t || !(t.includes("\t") || t.trim().split(/\r?\n/).length > 1)) return;
    e.preventDefault();
    openImport();
    try { openMapper([{name:"", rows:csvRows(t.replace(/\r?\n$/, ""))}], "Cellules collées"); }
    catch (err){ showImportMsg("Collage impossible : " + err.message + "."); }
  });
  list.addEventListener("mousedown", e => { const li = e.target.closest("li"); if (li){ e.preventDefault(); pick(items[+li.dataset.k]); } });
  if (go) go.addEventListener("click", submit);
  if (onPick === pickStart) searches.push(input);
}
function setSearchText(t){ searches.forEach(i => { i.value = t; }); }
function homeMsg(t){ const b = $("#homeMsg"); b.textContent = t; b.classList.toggle("hidden", !t); }

/* ---------- Carte ---------- */
let map = null, layerPts, layerRoute;
function ensureMap(){
  if (map) { map.invalidateSize(); return; }
  map = L.map("map", {zoomControl:true, attributionControl:true}).setView([46.6, 2.4], 6);
  map.zoomControl.setPosition("topright");
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom:19, attribution:"© contributeurs OpenStreetMap"}).addTo(map);
  layerPts = L.layerGroup().addTo(map);
  layerRoute = L.layerGroup().addTo(map);
}
function panelPadding(){
  const mobile = window.matchMedia("(max-width:760px)").matches;
  return mobile ? {paddingTopLeft:[30, 30], paddingBottomRight:[30, 30]} : {paddingTopLeft:[460, 40], paddingBottomRight:[60, 40]};
}
const startIcon = () => L.divIcon({className:"", html:'<div class="pin-start"></div>', iconSize:[22, 22], iconAnchor:[11, 11]});
const numIcon = (k, color, sel) => L.divIcon({className:"", html:`<div class="pin-num${sel ? " sel" : ""}" style="background:${color}">${k}</div>`, iconSize:[26, 26], iconAnchor:[13, 13]});

function drawMap(fit = true){
  if (!map) return;
  layerPts.clearLayers();
  const pts = [], color = COLORS[S.cat] || "#0071e3";
  if (S.mode === "verif"){ drawVerifMap(fit); return; }
  if (S.mode === "route" && S.route){
    const {a, b} = S.route;
    L.marker([a.lat, a.lon], {icon:startIcon(), zIndexOffset:1000, title:"Départ"}).bindTooltip("A · " + esc(a.label)).addTo(layerPts);
    L.marker([b.lat, b.lon], {icon:numIcon("B", "#ff3b30", true), zIndexOffset:1000, title:"Arrivée"}).bindTooltip("B · " + esc(b.label)).addTo(layerPts);
    return;
  }
  if (S.mode === "one" && S.start){
    L.marker([S.start.lat, S.start.lon], {icon:startIcon(), zIndexOffset:1000, title:"Départ"}).addTo(layerPts);
    pts.push([S.start.lat, S.start.lon]);
    shown().forEach((d, k) => {
      const m = L.marker([d.lat, d.lon], {icon:numIcon(k + 1, color, S.open === d.key), zIndexOffset:S.open === d.key ? 900 : 0})
        .bindTooltip(`${esc(d.name)} · ${km(d.dist)}, ${dur(d.time)}`).addTo(layerPts);
      m.on("click", () => openItem(d.key, true));
      pts.push([d.lat, d.lon]);
    });
  } else if (S.mode === "multi"){
    S.multi.forEach(g => {
      if (!g.start.lat) return;
      L.marker([g.start.lat, g.start.lon], {icon:startIcon(), title:g.start.name}).bindTooltip(esc(g.start.name)).addTo(layerPts);
      pts.push([g.start.lat, g.start.lon]);
      shownMulti(g).forEach(d => {
        L.marker([d.lat, d.lon], {icon:L.divIcon({className:"", html:`<div class="pin-dot" style="background:${color}"></div>`, iconSize:[12, 12], iconAnchor:[6, 6]})})
          .bindTooltip(`${esc(d.name)} · ${km(d.dist)} depuis ${esc(g.start.name)}`).addTo(layerPts)
          .on("click", () => openItem(d.key, true));
        pts.push([d.lat, d.lon]);
      });
    });
  }
  if (!fit || !pts.length) return;
  if (pts.length > 1) map.fitBounds(pts, {...panelPadding(), maxZoom:14});
  else map.setView(pts[0], 12);
}
function drawRoute(geo){
  layerRoute.clearLayers();
  const ll = geo.coordinates.map(c => [c[1], c[0]]);
  L.polyline(ll, {color:"#ffffff", weight:9, opacity:.9}).addTo(layerRoute);
  const line = L.polyline(ll, {color:"#0071e3", weight:5.5, opacity:1}).addTo(layerRoute);
  map.fitBounds(line.getBounds(), {...panelPadding(), maxZoom:15});
}

/* ---------- Données ---------- */
async function loadMeta(){
  try {
    META = await fetchJSON("data/categories.json", 2, {cache:"no-cache"});
    META.familles.forEach(f => f.cats.forEach(c => { CAT[c.id] = {...c, fam:f.id, famLabel:f.label}; }));
    const tot = META.familles.reduce((a, f) => a + f.cats.reduce((b, c) => b + c.n + c.nEtranger, 0), 0);
    const d = META.majFiness ? new Date(META.majFiness + "T12:00:00").toLocaleDateString("fr-FR", {day:"numeric", month:"long", year:"numeric"}) : "";
    $("#dataInfo").textContent = `${nf0.format(tot)} établissements : fichier FINESS du ministère de la Santé${d ? " (mis à jour le " + d + ")" : ""}, et OpenStreetMap pour ${META.pays.join(", ")}, à moins de ${META.bandeKm} km de la frontière.`;
  } catch (e){
    homeMsg("La base des établissements est en cours de préparation. Réessayez dans quelques minutes.");
  }
}
function loadCat(id){
  if (!DATA.has(id)){
    DATA.set(id, fetchJSON(`data/c/${id}.json`, 3).then(d => d.r.map((r, k) => ({key:id + ":" + k, name:r[0], addr:r[1], city:r[2], lat:r[3], lon:r[4], tel:r[5], id:r[6], cc:r[7], type:r[8]})))
      .catch(e => { DATA.delete(id); throw e; }));
  }
  return DATA.get(id);
}
function crow(a, b){
  const R = 6371000, toR = Math.PI / 180, dLat = (b.lat - a.lat) * toR, dLon = (b.lon - a.lon) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function nearest(p, rows, M){
  const withD = [];
  for (const r of rows){ if (!S.foreign && r.cc) continue; withD.push([crow(p, r), r]); }
  withD.sort((a, b) => a[0] - b[0]);
  return withD.slice(0, M).map(([d, r]) => ({...r, crow:d}));
}
async function roadTo(p, cands){
  if (!cands.length) return [];
  const coords = [p, ...cands].map(cstr).join(";");
  const dst = cands.map((_, k) => k + 1).join(";");
  const r = await osrm(`/table/v1/driving/${coords}?sources=0&destinations=${dst}&annotations=distance,duration`);
  return cands.map((c, k) => ({...c, dist:r.distances[0][k], time:r.durations[0][k]}));
}
const bySort = (a, b) => S.sort === "time" ? a.time - b.time || a.dist - b.dist : a.dist - b.dist || a.time - b.time;

/* ---------- Parcours ---------- */
function pickStart(p){
  S.mode = "one"; S.start = {name:"Départ", ...p}; S.results = []; S.multi = [];
  setSearchText(p.label);
  if (S.cat && !$("#explore").classList.contains("hidden")) runOne();
  else openCatSheet();
}
function startMulti(rows){
  closeSheet("#importSheet");
  S.mode = "multi"; S.pendingRows = rows; S.multi = []; S.results = [];
  setSearchText("");
  openCatSheet();
}

function openCatSheet(){
  if (!META){ homeMsg("La base des établissements n'est pas encore disponible."); return; }
  $("#catWhere").textContent = S.mode === "multi"
    ? `Pour vos ${plural(S.pendingRows ? S.pendingRows.length : S.multi.length, "adresse")} de départ`
    : "Autour de " + (S.start ? S.start.label : "votre adresse");
  $("#families").innerHTML = META.familles.map(f => `<section class="fam"><h3>${esc(f.label)}<small>${esc(FAM_DESC[f.id] || "")}</small></h3><div class="cards">${
    f.cats.map(c => `<button class="card" type="button" data-cat="${c.id}">${tile(c.id)}<b>${esc(c.label)}</b><small>${esc(c.desc)}</small><span class="n">${nf0.format(c.n)} en France${c.nEtranger ? " · " + nf0.format(c.nEtranger) + " à l'étranger" : ""}</span></button>`).join("")
  }</div></section>`).join("");
  openSheet("#catSheet");
}
let lastFocus = null;
function openSheet(id){ lastFocus = document.activeElement; $(id).classList.remove("hidden"); const f = $(id + " .card") || $(id + " .close"); if (f) f.focus({preventScroll:true}); document.body.style.overflow = "hidden"; }
function closeSheet(id){ $(id).classList.add("hidden"); document.body.style.overflow = ""; if (lastFocus && lastFocus.focus) lastFocus.focus(); }

function chooseCat(id){
  S.cat = id; S.open = null;
  closeSheet("#catSheet");
  showExplore();
  if (S.mode === "multi") runMulti(); else runOne();
}
function showExplore(){
  $("#home").classList.add("hidden"); $("#explore").classList.remove("hidden");
  window.scrollTo(0, 0);
  ensureMap();
  renderHead();
}
function goHome(){
  if (S.busy) S.abort = true;
  $("#explore").classList.add("hidden"); $("#home").classList.remove("hidden");
  setSearchText(S.mode === "one" && S.start ? S.start.label : "");
  setHomeMode(S.mode === "route" ? "route" : S.mode === "verif" ? "verif" : "etab");
}

function renderHead(){
  const isRoute = S.mode === "route", isVerif = S.mode === "verif";
  ["#searchPanel", "#etabChips", ".phead .tools"].forEach(s => $(s).classList.toggle("hidden", isRoute || isVerif));
  $("#routePanel").classList.toggle("hidden", !isRoute);
  $("#verifHead").classList.toggle("hidden", !isVerif);
  $("#explore").classList.toggle("verif", isVerif);
  if (isRoute || isVerif) return;
  const c = CAT[S.cat];
  $("#catChip").innerHTML = c ? `${tile(S.cat)}${esc(c.label)}<svg class="i chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>` : "Choisir un type";
  const multi = S.mode === "multi";
  $("#multiChip").classList.toggle("hidden", !multi);
  $("#multiChip").textContent = multi ? plural(S.multi.length || (S.pendingRows || []).length, "départ") : "";
  $("#foreignToggle").classList.toggle("hidden", !c || !c.nEtranger);
  const opts = multi ? [1, 3, 5, 10] : [10, 25, 50];
  const cur = multi ? S.nMulti : S.n;
  $("#nSeg").innerHTML = opts.map(v => `<button type="button" data-v="${v}" aria-pressed="${v === cur}">${v}</button>`).join("");
  $("#nSeg").setAttribute("aria-label", multi ? "Établissements par départ" : "Nombre de résultats");
  $$("#sortSeg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === S.sort)));
}
function setStatus(msg, done, total, warn){
  const b = $("#status");
  if (!msg){ b.classList.add("hidden"); return; }
  b.classList.remove("hidden");
  $("#statusText").innerHTML = warn ? `<span class="warn">${esc(msg)}</span>` : esc(msg);
  const p = $("#prog"); p.classList.toggle("hidden", total == null); p.max = total || 1; p.value = done || 0;
}
function setBusy(b){ S.busy = b; $("#stop").classList.toggle("hidden", !b); $("#export").disabled = b || !(S.mode === "verif" ? V.ready : S.mode === "route" ? S.route : S.mode === "multi" ? S.multi.some(g => g.res.length) : S.results.length); }

async function runOne(){
  if (S.busy){ S.abort = true; while (S.busy) await sleep(50); }
  S.abort = false; S.open = null; S.results = []; layerRoute && layerRoute.clearLayers();
  renderHead(); $("#list").innerHTML = ""; setBusy(true);
  const c = CAT[S.cat];
  try {
    setStatus(`Recherche des ${c.label.toLowerCase()} les plus proches…`, 0, 2);
    const rows = await loadCat(S.cat);
    const cands = nearest(S.start, rows, 99);
    if (!cands.length){ setStatus("Aucun établissement de ce type."); return; }
    setStatus("Calcul des trajets par la route…", 1, 2);
    const res = await roadTo(S.start, cands);
    if (S.abort) return;
    S.results = res.filter(d => d.dist != null).sort(bySort);
    setStatus("");
    if (!S.results.length) setStatus("Aucun trajet par la route trouvé depuis cette adresse.", null, null, true);
    renderList(); drawMap();
  } catch (e){
    setStatus("Le calcul n'a pas abouti : " + e.message + ". Réessayez dans un instant.", null, null, true);
  } finally { setBusy(false); }
}
const shown = () => S.results.slice(0, S.n);
const shownMulti = g => g.res.slice(0, S.nMulti);

async function runMulti(){
  if (S.busy){ S.abort = true; while (S.busy) await sleep(50); }
  S.abort = false; S.open = null; layerRoute && layerRoute.clearLayers();
  renderHead(); $("#list").innerHTML = ""; setBusy(true);
  try {
    const rows = await loadCat(S.cat);
    if (S.pendingRows){
      const list = S.pendingRows.map((r, i) => ({i, name:r.n || r.a, query:r.a, lat:null, lon:null, label:"", err:""}));
      let done = 0, next = 0;
      const worker = async () => {
        while (next < list.length && !S.abort){
          const d = list[next++];
          try { const g = await geocode(d.query); if (g) Object.assign(d, g); else d.err = "adresse introuvable"; }
          catch (e){ d.err = "localisation impossible"; }
          done++; setStatus(`Localisation des adresses : ${done} sur ${list.length}`, done, list.length);
        }
      };
      await Promise.all(Array.from({length:5}, worker));
      if (S.abort){ setStatus("Calcul arrêté."); return; }
      S.multi = list.map(start => ({start, res:[], err:start.err}));
      S.pendingRows = null;
    } else S.multi.forEach(g => { g.res = []; if (g.start.lat) g.err = ""; });
    renderHead();
    const todo = S.multi.filter(g => g.start.lat != null);
    for (let k = 0; k < todo.length; k++){
      if (S.abort){ setStatus(`Calcul arrêté après ${k} départs sur ${todo.length}.`, null, null, true); break; }
      setStatus(`Calcul des trajets : départ ${k + 1} sur ${todo.length}`, k, todo.length);
      const g = todo[k];
      try { g.res = (await roadTo(g.start, nearest(g.start, rows, 30))).filter(d => d.dist != null).sort(bySort); g.res.forEach(d => { d.key += "@" + g.start.i; d.from = g.start; }); if (!g.res.length) g.err = "aucun trajet trouvé"; }
      catch (e){ g.err = "calcul impossible (" + e.message + ")"; }
      if (k % 5 === 0 || k === todo.length - 1){ renderList(); drawMap(k === todo.length - 1); }
    }
    if (!S.abort){
      const bad = S.multi.filter(g => g.err).length;
      setStatus(bad ? `${plural(bad, "départ")} sans résultat : voir en bas de la liste.` : "", null, null, !!bad);
    }
    renderList(); drawMap();
  } catch (e){
    setStatus("Le calcul n'a pas abouti : " + e.message + ".", null, null, true);
  } finally { setBusy(false); }
}

/* ---------- Liste des résultats ---------- */
function itemHTML(d, k){
  const isTime = S.sort === "time";
  const big = isTime ? dur(d.time) : km(d.dist), sm = isTime ? km(d.dist) : dur(d.time);
  const badge = d.cc ? `<span class="badge">${esc(PAYS[d.cc] || d.cc)}</span>` : "";
  const open = S.open === d.key;
  return `<li class="item${open ? " open" : ""}" data-key="${esc(d.key)}"><button type="button" aria-expanded="${open}">
    <span class="rk" style="background:${COLORS[S.cat]}">${k + 1}</span>
    <span class="who"><b>${esc(d.name)}</b><small>${badge}${esc([d.addr, d.city].filter(Boolean).join(", "))}</small></span>
    <span class="fig"><span class="big">${big}</span><span class="sm">${sm}</span></span></button>${open ? `<div class="det" id="det"></div>` : ""}</li>`;
}
function renderList(){
  const L0 = $("#list"), c = CAT[S.cat];
  if (S.mode === "one"){
    const list = shown();
    L0.innerHTML = list.map(itemHTML).join("") || "";
    $("#footInfo").textContent = list.length ? `${list.length} plus proches parmi ${plural(c.n + (S.foreign ? c.nEtranger : 0), "établissement")}` : "";
  } else {
    const ok = S.multi.filter(g => g.res.length), bad = S.multi.filter(g => g.err && !g.res.length);
    L0.innerHTML = ok.map(g => `<li class="group"><h3><span>${esc(g.start.name)}${g.start.name !== g.start.query ? `<small>${esc(g.start.label || g.start.query)}</small>` : ""}</span><span>${esc(S.sort === "time" ? dur(g.res[0].time) : km(g.res[0].dist))}</span></h3><ol class="list">${shownMulti(g).map(itemHTML).join("")}</ol></li>`).join("")
      + (bad.length ? `<li class="group"><h3><span>Sans résultat</span><span>${bad.length}</span></h3><ol class="list">${bad.map(g => `<li class="item"><div class="det" style="padding:8px 12px"><b>${esc(g.start.name)}</b><p>${esc(g.start.query)} · ${esc(g.err)}</p></div></li>`).join("")}</ol></li>` : "");
    $("#footInfo").textContent = ok.length ? `${plural(ok.length, "départ")} · ${S.nMulti} par départ` : "";
  }
  if (!L0.innerHTML && !S.busy && $("#status").classList.contains("hidden")) L0.innerHTML = `<li class="empty">Aucun résultat.</li>`;
  setBusy(S.busy);
  if (S.open) fillDetail();
}
function findItem(key){
  if (S.mode === "one") return S.results.find(d => d.key === key);
  for (const g of S.multi){ const d = g.res.find(x => x.key === key); if (d) return d; }
  return null;
}
function openItem(key, fromMap){
  S.open = S.open === key && !fromMap ? null : key;
  renderList(); drawMap(false);
  if (!S.open){ layerRoute.clearLayers(); return; }
  const li = $(`.item[data-key="${CSS.escape(key)}"]`);
  if (li) li.scrollIntoView({block:"nearest", behavior:"smooth"});
}
async function fillDetail(){
  const d = findItem(S.open), box = $("#det");
  if (!d || !box) return;
  const from = d.from || S.start;
  const f = p => p.lat.toFixed(6) + "," + p.lon.toFixed(6);
  const tel = d.tel ? `<a class="btn sec" href="tel:${esc(d.tel.replace(/[^\d+]/g, ""))}"><svg class="i" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>${esc(d.tel)}</a>` : "";
  box.innerHTML = `<p>${esc(d.type || CAT[S.cat].label)}${d.id && !d.id.startsWith("osm:") ? " · FINESS " + esc(d.id) : ""}${S.mode === "multi" ? "<br>Depuis " + esc(from.name) : ""}</p>
    <div class="btns">
      <a class="btn" href="https://maps.apple.com/?saddr=${f(from)}&daddr=${f(d)}&dirflg=d" target="_blank" rel="noopener noreferrer">Plans</a>
      <a class="btn sec" href="https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${f(from)}&destination=${f(d)}" target="_blank" rel="noopener noreferrer">Google Maps</a>${tel}
    </div><details><summary>Itinéraire détaillé</summary><p class="hint">Chargement…</p></details>`;
  const key = S.open;
  try {
    const ck = from.lat + "," + from.lon + ">" + d.lat + "," + d.lon;
    let r = S.routeCache.get(ck);
    if (!r){ r = (await osrm(`/route/v1/driving/${cstr(from)};${cstr(d)}?overview=full&geometries=geojson&steps=true`)).routes[0]; S.routeCache.set(ck, r); }
    if (S.open !== key) return;
    drawRoute(r.geometry);
    const det = $("#det details"); if (det) det.innerHTML = `<summary>Itinéraire détaillé</summary>${stepsHTML(r.legs[0].steps)}`;
  } catch (e){ const det = $("#det details"); if (det) det.innerHTML = `<summary>Itinéraire détaillé</summary><p class="hint">Itinéraire indisponible pour le moment.</p>`; }
}

/* ---------- Itinéraire détaillé ---------- */
function instruction(s){
  const m = s.maneuver, name = s.name || "";
  const dir = {"left":"à gauche","slight left":"légèrement à gauche","sharp left":"franchement à gauche","right":"à droite","slight right":"légèrement à droite","sharp right":"franchement à droite","straight":"tout droit","uturn":"en demi-tour"}[m.modifier] || "";
  const on = (name ? " sur " + esc(name) : "") + (s.ref ? " (" + esc(s.ref.split(";")[0]) + ")" : "");
  switch (m.type){
    case "depart": return "Partir" + on;
    case "arrive": return "Arrivée à destination";
    case "roundabout": case "rotary": case "roundabout turn":
      return "Au rond-point, prendre la " + (m.exit ? m.exit + (m.exit === 1 ? "re" : "e") + " " : "") + "sortie" + on;
    case "merge": return "Rejoindre" + (on || " la voie");
    case "on ramp": return "Prendre la bretelle" + (dir ? " " + dir : "") + on;
    case "off ramp": return "Prendre la sortie" + (dir ? " " + dir : "") + on;
    case "fork": return "À l'embranchement, rester " + dir + on;
    case "end of road": return "Au bout de la route, tourner " + dir + on;
    case "continue": case "new name": return (m.modifier && m.modifier !== "straight" ? "Continuer " + dir : "Continuer") + on;
    default: return (m.modifier === "straight" ? "Continuer tout droit" : "Tourner " + dir) + on;
  }
}
function stepsHTML(steps){
  return `<ol class="route-steps">${steps.filter(s => s.maneuver.type !== "exit roundabout" && s.maneuver.type !== "exit rotary" && (s.distance > 0 || s.maneuver.type === "arrive"))
    .map(s => `<li><span>${instruction(s)}</span><span class="d">${s.maneuver.type === "arrive" ? "" : km(s.distance)}</span></li>`).join("")}</ol>`;
}

/* ---------- Export Excel (.xlsx créé dans le navigateur) ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8){ let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipStore(files){
  const te = new TextEncoder(), parts = [], central = []; let off = 0;
  for (const f of files){
    const name = te.encode(f.name), data = te.encode(f.data), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), name);
    off += 30 + name.length + data.length;
  }
  const size = central.reduce((a, b) => a + b.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
}
function xlsx(sheetName, rows, widths){
  const x = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  const cell = (v, r, c) => {
    const ref = colLetter(c) + (r + 1), st = r === 0 ? ' s="1"' : "";
    if (typeof v === "number" && isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
    if (v == null || v === "") return "";
    return `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${x(v)}</t></is></c>`;
  };
  const last = colLetter(rows[0].length - 1) + rows.length;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w, k) => `<col min="${k + 1}" max="${k + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${rows.map((row, r) => `<row r="${r + 1}">${row.map((v, c) => cell(v, r, c)).join("")}</row>`).join("")}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`;
  return zipStore([
    {name:"[Content_Types].xml", data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'},
    {name:"_rels/.rels", data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
    {name:"xl/workbook.xml", data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${x(sheetName.slice(0, 31).replace(/[\\/?*[\]:]/g, " "))}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${x(sheetName.slice(0, 31).replace(/[\\/?*[\]:']/g, " "))}'!$A$1:$${colLetter(rows[0].length - 1)}$${rows.length}</definedName></definedNames></workbook>`},
    {name:"xl/_rels/workbook.xml.rels", data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
    {name:"xl/styles.xml", data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>'},
    {name:"xl/worksheets/sheet1.xml", data:sheet}
  ]);
}
function exportXlsx(){
  if (S.mode === "verif"){ exportVerif(); return; }
  if (S.mode === "route"){
    const {a, b, r} = S.route;
    const rows = [["Départ", "Arrivée", "Distance route (km)", "Durée (min)", "Durée", "Latitude départ", "Longitude départ", "Latitude arrivée", "Longitude arrivée"],
      [a.label, b.label, Math.round(r.distance / 100) / 10, Math.round(r.duration / 60), dur(r.duration), a.lat, a.lon, b.lat, b.lon]];
    const url = URL.createObjectURL(xlsx("Trajet", rows, [34, 34, 14, 12, 10, 12, 12, 12, 12]));
    const el = document.createElement("a"); el.href = url; el.download = "trajet.xlsx"; document.body.appendChild(el); el.click(); el.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    return;
  }
  const c = CAT[S.cat];
  const kmN = m => m == null ? "" : Math.round(m / 100) / 10, minN = s => s == null ? "" : Math.round(s / 60);
  const row = (d, k) => [k + 1, d.name, d.type || c.label, d.addr, d.city, d.cc ? PAYS[d.cc] || d.cc : "France", d.tel, kmN(d.dist), minN(d.time), d.id && !d.id.startsWith("osm:") ? d.id : "", d.lat, d.lon];
  const head = ["Rang", "Établissement", "Type", "Adresse", "Ville", "Pays", "Téléphone", "Distance route (km)", "Durée (min)", "N° FINESS", "Latitude", "Longitude"];
  const wid = [7, 42, 30, 36, 28, 12, 16, 12, 11, 12, 11, 11];
  let rows, name;
  if (S.mode === "one"){
    rows = [["Départ", ...head], ...shown().map((d, k) => [S.start.label, ...row(d, k)])];
    name = `${S.cat}-plus-proches.xlsx`;
  } else {
    rows = [["Départ", "Adresse de départ", ...head]];
    S.multi.forEach(g => {
      if (!g.res.length) rows.push([g.start.name, g.start.query, "", "", g.err || "aucun résultat"]);
      else shownMulti(g).forEach((d, k) => rows.push([g.start.name, g.start.query, ...row(d, k)]));
    });
    name = `${S.cat}-par-depart.xlsx`;
  }
  const url = URL.createObjectURL(xlsx(c.label, rows, S.mode === "one" ? [30, ...wid] : [26, 36, ...wid]));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/* ---------- Trajet entre deux adresses ---------- */
const RT = {a:{pt:null, inputs:[]}, b:{pt:null, inputs:[]}};
function routeMsg(t){
  ["#routeMsgHome", "#routeMsgPanel"].forEach(id => { const b = $(id); b.textContent = t; b.classList.toggle("hidden", !t); });
}
function setField(k, p){
  RT[k].pt = p;
  RT[k].inputs.forEach(i => { i.value = p ? p.label : ""; });
}
function fieldText(k){
  const vis = RT[k].inputs.find(i => i.offsetParent !== null) || RT[k].inputs[0];
  return vis.value.trim();
}
function setupRouteField(root, k){
  const input = $("input", root);
  RT[k].inputs.push(input);
  input.addEventListener("edited", () => {
    RT[k].pt = null;
    RT[k].inputs.forEach(i => { if (i !== input) i.value = input.value; });
  });
  setupSearch(root, p => {
    setField(k, p); routeMsg("");
    const other = k === "a" ? "b" : "a";
    if (RT[other].pt || fieldText(other)) runRoute();
    else { const i = RT[other].inputs.find(x => x.offsetParent !== null); if (i) i.focus(); }
  }, routeMsg, false);
}
function swapRoute(){
  const a = RT.a.pt, b = RT.b.pt, ta = fieldText("a"), tb = fieldText("b");
  RT.a.pt = b; RT.b.pt = a;
  RT.a.inputs.forEach(i => { i.value = b ? b.label : tb; });
  RT.b.inputs.forEach(i => { i.value = a ? a.label : ta; });
  if (S.mode === "route" && RT.a.pt && RT.b.pt) runRoute();
}
function setHomeMode(m){
  $$("#modeSeg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.m === m)));
  $("#homeEtab").classList.toggle("hidden", m !== "etab");
  $("#homeRoute").classList.toggle("hidden", m !== "route");
  $("#homeVerif").classList.toggle("hidden", m !== "verif");
  $(".scope").classList.toggle("hidden", false);
  $(".steps3").classList.toggle("hidden", m !== "etab");
}
async function runRoute(){
  if (S.busy){ S.abort = true; while (S.busy) await sleep(50); }
  routeMsg("");
  for (const k of ["a", "b"]){
    if (RT[k].pt) continue;
    const q = fieldText(k);
    if (!q){ routeMsg(k === "a" ? "Indiquez le point de départ." : "Indiquez le point d'arrivée."); const i = RT[k].inputs.find(x => x.offsetParent !== null); if (i) i.focus(); return; }
    try {
      const g = await geocode(q);
      if (!g){ routeMsg(`« ${q} » introuvable. Essayez une adresse complète ou un code postal.`); return; }
      setField(k, g);
    } catch (e){ routeMsg("La recherche d'adresse ne répond pas. Réessayez dans un instant."); return; }
  }
  S.mode = "route"; S.open = null; S.route = null;
  showExplore();
  $("#list").innerHTML = ""; $("#footInfo").textContent = "";
  layerRoute.clearLayers(); layerPts.clearLayers();
  setBusy(true);
  try {
    setStatus("Calcul de l'itinéraire le plus rapide…");
    const r = (await osrm(`/route/v1/driving/${cstr(RT.a.pt)};${cstr(RT.b.pt)}?overview=full&geometries=geojson&steps=true`)).routes[0];
    S.route = {a:RT.a.pt, b:RT.b.pt, r};
    setStatus("");
    renderRoute(); drawMap(false); drawRoute(r.geometry);
  } catch (e){
    setStatus(/NoRoute|NoSegment/.test(e.message) ? "Aucun itinéraire par la route entre ces deux points." : "Le calcul n'a pas abouti : " + e.message + ". Réessayez dans un instant.", null, null, true);
  } finally { setBusy(false); }
}
function altSelect(k, p){
  return "";
  if (!p.alts || p.alts.length < 2) return "";
  return `<select class="alt" style="margin-top:0" data-k="${k}" aria-label="Commune">${p.alts.map((x, i) => `<option value="${i}"${x === p ? " selected" : ""}>${esc(x.label)}</option>`).join("")}</select>`;
}
function renderRoute(){
  const {a, b, r} = S.route;
  const f = p => p.lat.toFixed(6) + "," + p.lon.toFixed(6);
  const note = [a, b].some(p => p.commune) ? "Pour un code postal, le trajet part du centre de la plus grande commune de ce code." : "";
  $("#list").innerHTML = `<li class="rcard">
    <div class="rbig"><div><b>${km(r.distance)}</b><span>par la route</span></div><div><b>${dur(r.duration)}</b><span>de trajet, sans trafic</span></div></div>
    <ol class="ends">
      <li><span class="dot a">A</span><span>${altSelect("a", a) || esc(a.label)}</span></li>
      <li><span class="dot b">B</span><span>${altSelect("b", b) || esc(b.label)}</span></li>
    </ol>
    <p class="hint">Itinéraire le plus rapide en voiture.${note ? " " + note : ""}</p>
    <div class="btns">
      <a class="btn" href="https://maps.apple.com/?saddr=${f(a)}&daddr=${f(b)}&dirflg=d" target="_blank" rel="noopener noreferrer">Plans</a>
      <a class="btn sec" href="https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${f(a)}&destination=${f(b)}" target="_blank" rel="noopener noreferrer">Google Maps</a>
      <button class="btn sec" type="button" id="copyRoute">Copier</button>
    </div>
    <details><summary>Itinéraire détaillé</summary>${stepsHTML(r.legs[0].steps)}</details>
  </li>`;
  $("#footInfo").textContent = "Itinéraire le plus rapide";
  setBusy(false);
}

/* ---------- Import ---------- */
function openImport(){ IMPORT_TARGET = "multi"; showImportMsg(""); openSheet("#importSheet"); }

/* ---------- Événements ---------- */
setupSearch($("#searchHome"));
setupSearch($("#searchPanel"));
$$(".scope-btn").forEach(b => b.addEventListener("click", openCountrySheet));
$("#cWorld").addEventListener("change", e => { scopeDraft.world = e.target.checked; renderCountryList(); });
$("#cFilter").addEventListener("input", renderCountryList);
$("#cList").addEventListener("change", e => { const c = e.target.value; if (e.target.checked) scopeDraft.cc.add(c); else scopeDraft.cc.delete(c); renderCountryList(); });
$("#cOk").addEventListener("click", applyCountrySheet);
updateScopeUI();
setupRouteField($("#rHomeA"), "a"); setupRouteField($("#rHomeB"), "b");
setupRouteField($("#rPanA"), "a"); setupRouteField($("#rPanB"), "b");
$$(".swap").forEach(b => b.addEventListener("click", swapRoute));
$$(".rgo").forEach(b => b.addEventListener("click", runRoute));
$("#modeSeg").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  setHomeMode(b.dataset.m);
  const i = b.dataset.m === "route" ? $("#rHomeA input") : $("#searchHome input");
  i.focus();
});
$("#list").addEventListener("change", e => {
  const s = e.target.closest("select.alt"); if (!s || !S.route) return;
  const k = s.dataset.k, p = S.route[k];
  setField(k, p.alts[+s.value]); runRoute();
});
$("#list").addEventListener("click", e => {
  if (e.target.id !== "copyRoute" || !S.route) return;
  const {a, b, r} = S.route;
  const t = `${a.label} → ${b.label} : ${km(r.distance)}, ${dur(r.duration)} (itinéraire le plus rapide, sans trafic)`;
  navigator.clipboard && navigator.clipboard.writeText(t).then(() => { e.target.textContent = "Copié"; setTimeout(() => { e.target.textContent = "Copier"; }, 1500); }, () => {});
});
$("#brand").addEventListener("click", goHome);
$("#openImport").addEventListener("click", openImport);
$("#openImport2").addEventListener("click", openImport);
$("#catChip").addEventListener("click", openCatSheet);
$("#families").addEventListener("click", e => { const b = e.target.closest(".card"); if (b) chooseCat(b.dataset.cat); });
$$(".backdrop").forEach(b => b.addEventListener("click", e => { if (e.target === b || e.target.closest("[data-close]")) closeSheet("#" + b.id); }));
document.addEventListener("keydown", e => { if (e.key === "Escape") $$(".backdrop:not(.hidden)").forEach(b => closeSheet("#" + b.id)); });
$("#sortSeg").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b || b.dataset.v === S.sort) return;
  S.sort = b.dataset.v; renderHead();
  S.results.sort(bySort); S.multi.forEach(g => g.res.sort(bySort));
  renderList(); drawMap(false);
});
$("#nSeg").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (S.mode === "multi") S.nMulti = +b.dataset.v; else S.n = +b.dataset.v;
  renderHead(); renderList(); drawMap();
});
$("#foreign").addEventListener("change", e => { S.foreign = e.target.checked; S.mode === "multi" ? runMulti() : runOne(); });
$("#list").addEventListener("click", e => { const li = e.target.closest(".item[data-key]"); if (li && e.target.closest("button")) openItem(li.dataset.key); });
$("#stop").addEventListener("click", () => { S.abort = true; });
$("#export").addEventListener("click", exportXlsx);
$("#locate").addEventListener("click", () => {
  if (!navigator.geolocation){ homeMsg("Votre navigateur ne permet pas la localisation."); return; }
  homeMsg("");
  navigator.geolocation.getCurrentPosition(async pos => {
    const p = {lat:pos.coords.latitude, lon:pos.coords.longitude, label:"Ma position"};
    try {
      const r = await fetchJSON(`https://data.geopf.fr/geocodage/reverse?limit=1&lon=${p.lon}&lat=${p.lat}`, 1);
      if (r.features && r.features[0]) p.label = "Ma position · " + r.features[0].properties.label;
    } catch (e){ /* on garde « Ma position » */ }
    pickStart(p);
  }, () => homeMsg("Position indisponible. Autorisez la localisation ou saisissez une adresse."), {enableHighAccuracy:true, timeout:12000});
});
/* Import de fichier : bouton, glisser-déposer sur la page */
$("#file").addEventListener("change", e => { IMPORT_TARGET = "multi"; importFile(e.target.files[0]); e.target.value = ""; });
const dz = $("#dropZone");
["dragenter", "dragover"].forEach(ev => document.addEventListener(ev, e => {
  if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes("Files")) return;
  e.preventDefault();
  const wantVerif = !$("#verifSheet").classList.contains("hidden") || (!$("#homeVerif").classList.contains("hidden") && !$("#home").classList.contains("hidden"));
  if (wantVerif){ if ($("#verifSheet").classList.contains("hidden")) openVerif(); $("#vDropZone").classList.add("over"); return; }
  if ($("#importSheet").classList.contains("hidden")) openImport();
  dz.classList.add("over");
}));
["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, () => dz.classList.remove("over")));
document.addEventListener("drop", e => {
  if (!e.dataTransfer || !e.dataTransfer.files.length) return;
  e.preventDefault(); dz.classList.remove("over"); $("#vDropZone").classList.remove("over");
  IMPORT_TARGET = $("#verifSheet").classList.contains("hidden") ? "multi" : "verif";
  importFile(e.dataTransfer.files[0]);
});
$("#sheetSel").addEventListener("change", () => loadSheet(+$("#sheetSel").value));
$("#hasHeader").addEventListener("change", () => { MP.header = $("#hasHeader").checked; guessColumns(); renderMapper(); });
$("#nameCol").addEventListener("change", () => { MP.name = +$("#nameCol").value; updateMapperPreview(); });
$("#addrCols").addEventListener("change", e => { const k = +e.target.value; if (e.target.checked) MP.addr.add(k); else MP.addr.delete(k); updateMapperPreview(); });
$("#mapPart").addEventListener("change", updateMapperPreview);
$("#mapOk").addEventListener("click", applyMapper);
$("#mapCancel").addEventListener("click", closeMapper);
window.addEventListener("resize", () => map && map.invalidateSize());

if (window.matchMedia("(max-width:760px)").matches) $("#searchHome input").placeholder = "Adresse de départ";
loadMeta();

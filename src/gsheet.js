/* =====================================================================
   Export vers Google Sheets
   Le navigateur crée le fichier directement dans le Drive de la personne
   connectée (autorisation « fichiers créés par cette application »).
   Rien ne passe par un serveur du site. Sans identifiant Google configuré
   (config.json : googleClientId), le site garde l'export Excel.
   ===================================================================== */
const GS = {clientId:"", token:null, exp:0, lib:null, tc:null, next:null, off:false};
const GS_BIG_KM = 20, GS_BIG_MIN = 20, GS_GREEN = "#E2EFDA", GS_ORANGE = "#FCE4D6", GS_HEAD = "#214F44";
const gsOn = () => !!GS.clientId && !GS.off;

async function gsLoadConfig(){
  try {
    const c = await fetchJSON("config.json", 1, {cache:"no-store"});
    if (c && /^[\w.-]+\.apps\.googleusercontent\.com$/.test(c.googleClientId || "")) GS.clientId = c.googleClientId;
  } catch (e){ /* pas de configuration : export Excel */ }
  const b = $("#export");
  if (GS.clientId && b && b.lastChild) b.lastChild.textContent = "Google Sheets";
  const rx = $("#rExcel"); if (rx) rx.textContent = GS.clientId ? "Google Sheets" : "Rapport Excel";
}
function gsLib(){
  if (GS.lib) return GS.lib;
  GS.lib = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client"; s.async = true;
    s.onload = () => {
      try {
        GS.tc = google.accounts.oauth2.initTokenClient({
          client_id:GS.clientId, scope:"https://www.googleapis.com/auth/drive.file",
          callback:r => {
            if (r.error){ GS.next = null; gsFail(new Error(r.error_description || r.error)); return; }
            GS.token = r.access_token; GS.exp = Date.now() + (+r.expires_in || 3600) * 1000;
            const n = GS.next; GS.next = null; if (n) n();
          },
          error_callback:e => { GS.next = null; gsFail(new Error(e && e.type === "popup_closed" ? "fenêtre de connexion Google fermée" : e && e.type === "popup_failed_to_open" ? "le navigateur a bloqué la fenêtre de connexion Google" : "connexion à Google refusée")); }
        });
        res();
      } catch (e){ rej(e); }
    };
    s.onerror = () => { GS.lib = null; rej(new Error("connexion à Google impossible")); };
    document.head.appendChild(s);
  });
  return GS.lib;
}
/* À appeler directement dans le clic : la fenêtre de connexion Google doit s'ouvrir pendant le geste. */
function gsRun(job){
  const go = async () => {
    try { setStatus("Création du Google Sheet…"); gsDone(await job()); }
    catch (e){ gsFail(e); }
  };
  if (GS.token && Date.now() < GS.exp - 60000){ go(); return; }
  if (!GS.tc){
    setStatus("Connexion à Google…");
    gsLib().then(() => setStatus("Connexion à Google prête : cliquez de nouveau sur « Google Sheets ».")).catch(gsFail);
    return;
  }
  GS.next = go;
  GS.tc.requestAccessToken();
}
function gsDone(url){
  setStatus("Google Sheet créé.");
  $("#statusText").innerHTML = `Google Sheet créé dans votre Drive. <a href="${esc(url)}" target="_blank" rel="noopener noreferrer"><b>Ouvrir le Google Sheet</b></a>`;
}
function gsFail(e){
  setStatus("Google Sheets indisponible : " + (e && e.message || e) + ".", null, null, true);
  $("#statusText").insertAdjacentHTML("beforeend", ` <button class="linkbtn" type="button" id="gsXlsx">Télécharger en Excel à la place</button>`);
  const b = $("#gsXlsx"); if (b) b.addEventListener("click", () => { GS.off = true; try { exportXlsx(); } finally { GS.off = false; } });
}

/* ---------- Écriture d'un classeur ---------- */
const gsColor = h => { const n = parseInt(h.slice(1), 16); return {red:(n >> 16 & 255) / 255, green:(n >> 8 & 255) / 255, blue:(n & 255) / 255}; };
function gsCell(c){
  if (c == null || c === "") return {};
  if (typeof c !== "object") c = {v:c};
  const out = {}, f = {};
  if (c.v != null && c.v !== ""){
    if (typeof c.v === "number" && isFinite(c.v)) out.userEnteredValue = {numberValue:c.v};
    else if (typeof c.v === "string" && c.v.startsWith("=")) out.userEnteredValue = {formulaValue:c.v};
    else out.userEnteredValue = {stringValue:String(c.v)};
  }
  if (c.bg) f.backgroundColor = gsColor(c.bg);
  if (c.bold || c.fg || c.size) f.textFormat = {...(c.bold ? {bold:true} : {}), ...(c.fg ? {foregroundColor:gsColor(c.fg)} : {}), ...(c.size ? {fontSize:c.size} : {})};
  if (c.wrap) f.wrapStrategy = "WRAP";
  if (c.fmt) f.numberFormat = {type:"NUMBER", pattern:c.fmt};
  if (Object.keys(f).length) out.userEnteredFormat = f;
  if (c.note) out.note = c.note;
  return out;
}
async function gsCreate(title, tabs){
  const body = {
    properties:{title:title.slice(0, 100), locale:"fr_FR", defaultFormat:{textFormat:{fontFamily:"Arial", fontSize:10}}},
    sheets:tabs.map((t, k) => ({
      properties:{sheetId:k, title:t.title.slice(0, 100), gridProperties:{frozenRowCount:t.frozen || 0}},
      data:[{startRow:0, startColumn:0, rowData:Array.from(t.rows, r => ({values:Array.from(r || [], gsCell)})),
        ...(t.widths ? {columnMetadata:t.widths.map(w => ({pixelSize:Math.round(w)}))} : {})}]
    }))
  };
  const res = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {method:"POST", credentials:"omit", cache:"no-store",
    headers:{"Authorization":"Bearer " + GS.token, "Content-Type":"application/json"}, body:JSON.stringify(body)});
  if (res.status === 401){ GS.token = null; throw new Error("la connexion Google a expiré, cliquez de nouveau"); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.error && j.error.message) || "erreur " + res.status);
  return j.spreadsheetUrl;
}
function gsTable(sheet, rows, widths, file){
  gsRun(() => gsCreate(file.replace(/\.xlsx$/i, ""), [{title:sheet, frozen:1, widths:widths.map(w => w * 7),
    rows:rows.map((r, k) => r.map(v => v === "" || v == null ? null : k === 0 ? {v, bold:true, fg:"#FFFFFF", bg:GS_HEAD, wrap:true} : {v}))}]));
}

/* ---------- Vérification : fichier d'origine, fichier corrigé, réflexion ---------- */
function gsVerifTabs(){
  const src = V.src, num = s => { const t = String(s).trim(); return /^-?\d+([.,]\d+)?$/.test(t) && !/^-?0\d/.test(t) ? +t.replace(",", ".") : null; };
  let raw, cols, map, hr, rowOf;
  if (src){ raw = Array.from(src.raw, r => r ? Array.from(r, v => v ?? "") : []); cols = src.cols; map = src.map; hr = src.rowNum[src.hr]; rowOf = r => r.src != null ? src.rowNum[r.src] : null; }
  else {
    raw = [["Statut", "Établissement", "Localisation établissement", "Médecin", "Localisation médecin", "Distance (km)", "Temps (min)"],
      ...V.rows.map(r => [r.status || "", r.etabName || "", r.etabQ, r.docName || "", r.docQ, r.km ?? "", r.min ?? ""])];
    cols = [0, 1, 2, 3, 4, 5, 6]; map = {status:0, etabName:1, etabLoc:2, docName:3, docLoc:4, km:5, min:6}; hr = 0; rowOf = r => r.i + 1;
  }
  const colOf = role => map[role] >= 0 ? cols[map[role]] : -1;
  const locCols = new Set([colOf("etabLoc"), colOf("docLoc")]);
  const width = raw.reduce((m, r) => Math.max(m, r.length), 0);
  const orig = raw.map((r, ri) => Array.from({length:width}, (_, ci) => {
    const v = r[ci]; if (v === "" || v == null) return null;
    const n = locCols.has(ci) ? null : num(v), c = {v:n != null ? n : String(v)};
    if (ri === hr) Object.assign(c, {bold:true, fg:"#FFFFFF", bg:GS_HEAD, wrap:true});
    return c;
  }));
  const corr = orig.map(r => r.map(c => c ? {...c} : null));
  const cedex = [], big = [], small = [], nv = [];
  const cc = p => { const m = /pris comme (\d{5})/.exec(p && p.label || ""); return m ? m[1] : null; };
  const city = p => p.label.replace(/^\S+ /, "").replace(/ \(CEDEX.*$/, "").replace(/ \d+e Arrondissement$/, "");
  const k1 = x => Math.round(x * 10) / 10;
  for (const r of V.rows){
    const ri = rowOf(r); if (ri == null || !corr[ri]) continue;
    const line = ri + 1;
    for (const [p, role, q, who] of [[r.ePt, "etabLoc", r.etabQ, "Établissement"], [r.dPt, "docLoc", r.docQ, "Médecin"]]){
      const code = cc(p), ci = colOf(role);
      if (p && p.cedex && code && ci >= 0){
        const doubt = !!p.cedexChoix;
        corr[ri][ci] = {v:code, bg:doubt ? GS_ORANGE : GS_GREEN, note:`Code d'origine : ${q}. C'est un code CEDEX (réservé à un gros destinataire), pas un code postal. Remplacé par ${code} ${city(p)}` + (doubt ? ", commune choisie d'après la distance déclarée : à confirmer." : ".")};
        cedex.push([line, who, q, code, city(p) + (doubt ? " (à confirmer)" : "")]);
      }
    }
    const eName = r.etabName || r.etabQ, dName = r.docName || r.docQ;
    if (r.res === "nv"){ nv.push([line, eName, dName, r.why.replace(/ · code CEDEX.*$/, "")]); continue; }
    if (r.newKm == null) continue;
    const dk = r.dKm || 0, dm = r.dMin || 0;
    if (Math.abs(dk) > GS_BIG_KM || Math.abs(dm) > GS_BIG_MIN){
      const ck = colOf("km"), cm = colOf("min");
      if (ck >= 0 && r.km != null) corr[ri][ck] = {v:k1(r.newKm), bg:GS_GREEN, note:`Valeur d'origine : ${nf1.format(r.km)} km. Remplacée par la distance recalculée par la route.`};
      if (cm >= 0 && r.min != null) corr[ri][cm] = {v:Math.round(r.newMin), bg:GS_GREEN, note:`Valeur d'origine : ${r.min} min. Remplacée par le temps moyen par la route (heures creuses ${Math.round(r.tLow)} min, heure de pointe ${Math.round(r.tHigh)} min).`};
      big.push([line, eName, dName, r.km ?? "", k1(r.newKm), r.min ?? "", Math.round(r.tLow), Math.round(r.newMin), Math.round(r.tHigh)]);
    } else if (r.res === "bad") small.push([line, eName, dName, r.km ?? "", k1(r.newKm), r.min ?? "", Math.round(r.tLow), Math.round(r.newMin), Math.round(r.tHigh)]);
  }
  // Réflexion
  const R = [], T = t => R.push([{v:t, bold:true, size:14, fg:"#203A35"}]), S = t => R.push([{v:t, bold:true, fg:"#203A35"}]), P = t => R.push([t]), B = () => R.push([]);
  const H = cells => R.push(cells.map(v => ({v, bold:true, fg:"#FFFFFF", bg:GS_HEAD, wrap:true})));
  const today = new Date().toLocaleDateString("fr-FR", {day:"numeric", month:"long", year:"numeric"});
  const ok = V.rows.filter(r => r.res === "ok").length;
  T("Vérification des kilomètres et des temps de trajet : démarche et corrections");
  P(`Fichier : ${V.file} · ${plural(V.rows.length, "affectation")} · vérifié le ${today} avec Kilomètres réels Pro`); B();
  S("1. Ce qui a été vérifié");
  P("Chaque trajet a été recalculé uniquement par la route, en voiture : itinéraire le plus rapide (données OpenStreetMap), jamais à vol d'oiseau,");
  P("du centre de la commune de l'établissement au centre de la commune du médecin (plus grande commune du code postal).");
  P("Le temps sans trafic est converti en trois temps selon la vitesse moyenne du trajet : heures creuses, moyen, heure de pointe. Le temps déclaré est jugé par rapport à cette plage.");
  P(`Une ligne est en écart quand la distance diffère de plus de ${V.tolPct} % et ${V.tolKm} km, ou quand le temps déclaré sort de la plage de plus de ${V.tolPctMin} % et ${V.tolMin} minutes.`);
  P("Si le fichier contient une colonne à vol d'oiseau, elle est recopiée telle quelle dans les onglets du fichier mais n'est utilisée dans aucun calcul."); B();
  S("2. Résultat");
  H(["Résultat", "Lignes"]);
  [["Conformes", ok], [`Corrigées (plus de ${GS_BIG_KM} km ou ${GS_BIG_MIN} min d'écart)`, big.length], ["Petits écarts, non modifiés", small.length], ["Non vérifiables", nv.length], ["Codes CEDEX remplacés", cedex.length]].forEach(r => R.push(r)); B();
  S("3. Codes qui n'étaient pas des codes postaux (onglet Fichier corrigé, en vert)");
  P("Ces codes sont des codes CEDEX, réservés aux gros destinataires (hôpitaux, EHPAD). Ils ne désignent pas une commune : ils ont été remplacés par le code postal de leur ville.");
  if (cedex.length){ H(["Ligne", "Pour", "Code d'origine", "Code postal retenu", "Ville"]); cedex.forEach(r => R.push(r)); } else P("Aucun.");
  B();
  S(`4. Trajets corrigés : plus de ${GS_BIG_KM} km ou ${GS_BIG_MIN} minutes d'écart`);
  P("Un tel écart ne s'explique pas par le calcul au centre de la commune : la valeur du fichier était fausse. Elle est remplacée par la valeur recalculée, en vert, avec l'ancienne valeur en note.");
  const tab = rows => { H(["Ligne", "Établissement", "Médecin", "Km du fichier", "Km par la route", "Écart km", "Min du fichier", "Min heures creuses", "Min moyen", "Min heure de pointe", "Écart min (hors plage)"]);
    rows.forEach(x => { const n = R.length + 1; R.push([x[0], x[1], x[2], x[3], {v:x[4], fmt:"0.0"}, x[3] === "" ? null : {v:`=E${n}-D${n}`, fmt:"+0.0;-0.0;0"}, x[5], x[6], x[7], x[8],
      x[5] === "" ? null : {v:`=IF(G${n}<H${n},G${n}-H${n},IF(G${n}>J${n},G${n}-J${n},0))`, fmt:"+0;-0;0"}]); }); };
  if (big.length) tab(big); else P("Aucun.");
  B();
  S("5. Petits écarts, laissés tels quels");
  P("Ils viennent surtout du calcul de centre de commune à centre de commune. Les valeurs du fichier, faites avec les adresses exactes, sont sans doute plus justes.");
  P("Un temps déclaré situé entre les heures creuses et l'heure de pointe est considéré comme juste.");
  if (small.length) tab(small); else P("Aucun.");
  B();
  S("6. Lignes non vérifiables");
  if (nv.length){ H(["Ligne", "Établissement", "Médecin", "Raison"]); nv.forEach(r => R.push(r)); } else P("Aucune.");
  B();
  if (V.closer && V.closer.length){
    S("7. Piste d'optimisation : un médecin plus proche existe");
    H(["Ligne", "Établissement", "Médecin actuel", "Temps actuel (min)", "Médecin le plus proche", "Son temps (min)", "Gain (min)"]);
    V.closer.slice().sort((a, b) => (b.curCost - b.bestCost) - (a.curCost - a.bestCost)).forEach(r => {
      const n = R.length + 1, t = (di, ei) => Math.round(V.M.T[di][ei] / 60); // temps moyen
      R.push([rowOf(r) != null ? rowOf(r) + 1 : "", r.etabName || r.etabQ, r.dLabel, t(r.di, r.ei), r.best.label, t(r.best.pi, r.ei), {v:`=D${n}-F${n}`}]);
    });
  }
  const wT = Array.from({length:width}, (_, k) => k === colOf("status") ? 170 : 115);
  return [
    {title:"Fichier d'origine", rows:orig, frozen:hr + 1, widths:wT},
    {title:"Fichier corrigé", rows:corr, frozen:hr + 1, widths:wT},
    {title:"Réflexion", rows:R, widths:[60, 200, 160, 110, 120, 90, 100, 110, 90, 120, 130]}
  ];
}
function gsVerif(){ gsRun(() => gsCreate(V.file.replace(/\.(xlsx|csv|txt)$/i, "") + " - vérification", gsVerifTabs())); }

$("#export").addEventListener("pointerenter", () => { if (gsOn()) gsLib().catch(() => {}); });
$("#export").addEventListener("focus", () => { if (gsOn()) gsLib().catch(() => {}); });
$("#export").addEventListener("touchstart", () => { if (gsOn()) gsLib().catch(() => {}); }, {passive:true});
gsLoadConfig();

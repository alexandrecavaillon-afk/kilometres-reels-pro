/* ---------- Import de fichiers : Excel (.xlsx), CSV, collage depuis Excel ----------
   Tout est lu dans le navigateur, sans bibliothèque externe : rien n'est envoyé. */
async function unzip(buf){
  const dv = new DataView(buf), u8 = new Uint8Array(buf), td = new TextDecoder();
  let eocd = -1;
  for (let p = u8.length - 22; p >= Math.max(0, u8.length - 65557); p--) if (dv.getUint32(p, true) === 0x06054b50){ eocd = p; break; }
  if (eocd < 0) throw new Error("le fichier est endommagé ou n'est pas un classeur Excel");
  const n = dv.getUint16(eocd + 10, true), files = new Map();
  let p = dv.getUint32(eocd + 16, true);
  for (let k = 0; k < n && dv.getUint32(p, true) === 0x02014b50; k++){
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    files.set(td.decode(u8.subarray(p + 46, p + 46 + nl)).toLowerCase(),
      {method:dv.getUint16(p + 10, true), size:dv.getUint32(p + 20, true), off:dv.getUint32(p + 42, true)});
    p += 46 + nl + xl + cl;
  }
  return async name => {
    const f = files.get(name.toLowerCase()); if (!f) return null;
    const start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true);
    const data = u8.subarray(start, start + f.size);
    if (f.method === 0) return td.decode(data);
    if (f.method !== 8) throw new Error("compression du fichier non prise en charge");
    return await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
  };
}

const byTag = (node, tag) => Array.from(node.getElementsByTagNameNS("*", tag));
const unX = s => s.replace(/_x([0-9A-Fa-f]{4})_/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
function colIdx(ref){ let n = 0; for (const ch of ref.toUpperCase()){ const c = ch.charCodeAt(0); if (c < 65 || c > 90) break; n = n * 26 + c - 64; } return n - 1; }
function colLetter(k){ let s = ""; k++; while (k > 0){ const m = (k - 1) % 26; s = String.fromCharCode(65 + m) + s; k = Math.floor((k - 1) / 26); } return s; }

async function readXlsx(buf){
  const get = await unzip(buf);
  const xml = async name => { const t = await get(name); return t == null ? null : new DOMParser().parseFromString(t, "application/xml"); };
  const wb = await xml("xl/workbook.xml");
  if (!wb) throw new Error("ce n'est pas un classeur Excel (.xlsx). Un fichier LibreOffice doit d'abord être enregistré au format .xlsx");
  const rels = await xml("xl/_rels/workbook.xml.rels"), target = {};
  if (rels) byTag(rels, "Relationship").forEach(r => { target[r.getAttribute("Id")] = r.getAttribute("Target"); });
  const ssDoc = await xml("xl/sharedStrings.xml");
  const strings = ssDoc ? byTag(ssDoc, "si").map(si => unX(byTag(si, "t").filter(t => t.parentNode.localName !== "rPh").map(t => t.textContent).join(""))) : [];
  const sheets = [];
  const list = byTag(wb, "sheet");
  for (let k = 0; k < list.length; k++){
    const s = list[k];
    const rid = s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || s.getAttribute("r:id");
    let path = target[rid] ? target[rid].replace(/^\//, "") : "worksheets/sheet" + (k + 1) + ".xml";
    if (!/^xl\//i.test(path)) path = "xl/" + path.replace(/^\.\.\//, "");
    const doc = await xml(path); if (!doc) continue;
    const rows = [];
    byTag(doc, "row").forEach(r => {
      const ri = (parseInt(r.getAttribute("r"), 10) || rows.length + 1) - 1, row = [];
      let ci = 0;
      byTag(r, "c").forEach(c => {
        const ref = c.getAttribute("r"); if (ref) ci = colIdx(ref);
        const t = c.getAttribute("t"), v = byTag(c, "v")[0], vt = v ? v.textContent : "";
        row[ci] = t === "s" ? (strings[+vt] ?? "") : t === "inlineStr" ? unX(byTag(c, "t").map(x => x.textContent).join("")) : t === "b" ? (vt === "1" ? "VRAI" : "FAUX") : vt;
        ci++;
      });
      rows[ri] = row;
    });
    const st = s.getAttribute("state");
    sheets.push({name:s.getAttribute("name") || "Feuille " + (k + 1), hidden:!!st && st !== "visible", rows});
  }
  return sheets;
}

function decodeText(buf){
  const b = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
  if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder("utf-16le").decode(buf).replace(/^﻿/, "");
  if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder("utf-16be").decode(buf).replace(/^﻿/, "");
  let t; try { t = new TextDecoder("utf-8", {fatal:true}).decode(buf); } catch (e){ t = new TextDecoder("windows-1252").decode(buf); }
  return t.replace(/^﻿/, "");
}

function csvRows(text){
  const first = text.split(/\r?\n/, 1)[0] || "", cnt = ch => first.split(ch).length - 1;
  const sep = cnt("\t") > 0 ? "\t" : cnt(";") >= cnt(",") ? ";" : ",";
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++){
    const c = text[i];
    if (q){ if (c === '"'){ if (text[i + 1] === '"'){ cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"' && cur.trim() === ""){ q = true; cur = ""; }
    else if (c === sep){ row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r"){ if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur !== "" || row.length){ row.push(cur); rows.push(row); }
  return rows;
}

/* Nettoie une feuille : cellules en texte, lignes et colonnes vides retirées. */
function cleanSheet(s){
  let rows = [];
  for (const r of s.rows){ if (!r) continue; const a = Array.from(r, v => String(v ?? "").replace(/\s+/g, " ").trim()); if (a.some(Boolean)) rows.push(a); }
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const cols = [...Array(w).keys()].filter(k => rows.some(r => r[k]));
  rows = rows.map(r => cols.map(k => r[k] || ""));
  return {name:s.name, hidden:s.hidden, rows, letters:cols.map(colLetter)};
}

const NAME_RE = /(^nom|name|[ée]tablissement|raison sociale|enseigne|soci[ée]t[ée]|structure|client|libell|d[ée]nomination|^site$|^lieu$)/i;
const ADDR_RE = /(adresse|address|^rue|voie|^n°|^num[ée]ro|^no$|compl[ée]ment|lieu-dit|^cp$|code postal|postal|zip|^ville|commune|city|localit|cedex|^lat|^lon|^lng)/i;
const NOT_ADDR_RE = /(mail|t[ée]l|phone|fax|pays|country|site web|web|url)/i;
const HEAD_RE = new RegExp(NAME_RE.source + "|" + ADDR_RE.source + "|^(id|identifiant|r[ée]f|type|cat[ée]gorie|contact|t[ée]l[ée]phone|e-?mail|pays)$", "i");
const isLat = h => /^(lat|latitude)$/i.test(h), isLon = h => /^(lon|lng|long|longitude)$/i.test(h);

function detectHeader(rows){
  if (rows.length < 2) return false;
  if (rows[0].some(h => h && HEAD_RE.test(h))) return true;
  return !rows[0].some(h => /\d/.test(h)) && rows[1].some(h => /\d/.test(h));
}

let MP = null;
function openMapper(sheets, title){
  sheets = sheets.map(cleanSheet).filter(s => s.rows.length);
  if (!sheets.length) throw new Error("le fichier ne contient aucune donnée");
  const vis = sheets.filter(s => !s.hidden); if (vis.length) sheets = vis;
  MP = {sheets, title, si:0};
  $("#sheetSel").innerHTML = sheets.map((s, k) => `<option value="${k}">${esc(s.name)} (${s.rows.length} ligne${s.rows.length > 1 ? "s" : ""})</option>`).join("");
  $("#sheetRow").classList.toggle("hidden", sheets.length < 2);
  loadSheet(0);
  $("#mapper").classList.remove("hidden");
  $("#mapper").scrollIntoView({block:"nearest", behavior:"smooth"});
}
function closeMapper(){ MP = null; $("#mapper").classList.add("hidden"); }

function loadSheet(si){
  MP.si = si; const s = MP.sheets[si];
  MP.header = detectHeader(s.rows); $("#hasHeader").checked = MP.header;
  guessColumns(); renderMapper();
}

function guessColumns(){
  const s = MP.sheets[MP.si], w = s.letters.length, data = MP.header ? s.rows.slice(1) : s.rows;
  const H = MP.header ? s.rows[0].map(h => h.toLowerCase()) : null;
  let name = -1, addr = [];
  MP.la = H ? H.findIndex(isLat) : -1; MP.lo = H ? H.findIndex(isLon) : -1;
  if (H){
    name = H.findIndex(h => NAME_RE.test(h) && !ADDR_RE.test(h));
    if (MP.la >= 0 && MP.lo >= 0) addr = [MP.la, MP.lo];
    else addr = [...Array(w).keys()].filter(k => k !== name && ADDR_RE.test(H[k]) && !NOT_ADDR_RE.test(H[k]) && !isLat(H[k]) && !isLon(H[k]));
  }
  if (!addr.length){
    const vals = k => data.map(r => r[k]).filter(Boolean);
    const digits = k => { const v = vals(k); return v.length ? v.filter(x => /\d/.test(x)).length / v.length : 0; };
    if (name < 0 && w > 1 && digits(0) < 0.3) name = 0;
    addr = [...Array(w).keys()].filter(k => k !== name && !(H && NOT_ADDR_RE.test(H[k])));
  }
  // Codes postaux lus comme des nombres par Excel (6000 au lieu de 06000)
  s.postal = s.letters.map((_, k) => {
    if (H && /code postal|^cp$|postal|zip/.test(H[k])) return true;
    const v = data.map(r => r[k]).filter(Boolean);
    return v.length > 0 && v.every(x => /^\d{4,5}$/.test(x)) && v.some(x => x.length === 4) && v.some(x => x.length === 5);
  });
  MP.name = name; MP.addr = new Set(addr);
}

function mapperRows(){
  const s = MP.sheets[MP.si], data = MP.header ? s.rows.slice(1) : s.rows;
  let ks = [...MP.addr].sort((a, b) => a - b);
  if (ks.length === 2 && ks.includes(MP.la) && ks.includes(MP.lo)) ks = [MP.la, MP.lo];
  const out = [];
  for (const r of data){
    const a = ks.map(k => s.postal[k] && /^\d{4}$/.test(r[k]) ? "0" + r[k] : r[k]).filter(Boolean).join(" ").replace(/;/g, ",");
    if (!a) continue;
    const n = MP.name >= 0 ? (r[MP.name] || "").replace(/;/g, ",") : "";
    out.push({n: n && n !== a ? n : "", a});
  }
  return out;
}

function renderMapper(){
  const s = MP.sheets[MP.si], head = MP.header ? s.rows[0] : null, ex = s.rows[MP.header ? 1 : 0] || [];
  const lab = k => head && head[k] ? `${s.letters[k]} · ${head[k]}` : `Colonne ${s.letters[k]}` + (ex[k] ? ` (ex. ${ex[k].slice(0, 28)})` : "");
  $("#nameCol").innerHTML = `<option value="-1">Aucune : l'adresse sert de nom</option>` +
    s.letters.map((_, k) => `<option value="${k}"${k === MP.name ? " selected" : ""}>${esc(lab(k))}</option>`).join("");
  $("#addrCols").innerHTML = s.letters.map((_, k) => `<label><input type="checkbox" value="${k}"${MP.addr.has(k) ? " checked" : ""}> ${esc(lab(k))}</label>`).join("");
  updateMapperPreview();
}

function updateMapperPreview(){
  const rows = mapperRows(), N = rows.length, parts = Math.ceil(N / MAX_DEST);
  MP.rows = rows;
  $("#mapTitle").textContent = `${MP.title} : ${N} adresse${N > 1 ? "s" : ""}`;
  $("#mapPrev").innerHTML = rows.slice(0, 4).map(r => `<li>${r.n ? `<b>${esc(r.n)}</b> · ` : ""}${esc(r.a)}</li>`).join("") + (N > 4 ? `<li>et ${N - 4} autre${N - 4 > 1 ? "s" : ""}</li>` : "");
  const sel = $("#mapPart"), prev = sel.value;
  $("#mapPartRow").classList.toggle("hidden", parts < 2);
  if (parts > 1){
    sel.innerHTML = [...Array(parts).keys()].map(p => `<option value="${p}">Adresses ${p * MAX_DEST + 1} à ${Math.min(N, (p + 1) * MAX_DEST)}</option>`).join("");
    if (prev && +prev < parts) sel.value = prev;
  }
  const n = parts > 1 ? Math.min(MAX_DEST, N - (+sel.value || 0) * MAX_DEST) : N;
  $("#mapOk").disabled = !N;
  $("#mapOk").textContent = !N ? "Aucune adresse trouvée" : n > 1 ? `Continuer avec ces ${n} adresses` : "Continuer avec cette adresse";
}

function applyMapper(){
  const p = $("#mapPartRow").classList.contains("hidden") ? 0 : +$("#mapPart").value || 0;
  const rows = MP.rows.slice(p * MAX_DEST, (p + 1) * MAX_DEST);
  closeMapper(); showImportMsg("");
  startMulti(rows);
}

function showImportMsg(msg){ const b = $(IMPORT_TARGET === "verif" ? "#vImportMsg" : "#importMsg"); b.textContent = msg; b.classList.toggle("hidden", !msg); }

async function importFile(f){
  if (!f) return;
  showImportMsg("");
  try {
    const buf = await f.arrayBuffer(), b = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
    if (b[0] === 0x50 && b[1] === 0x4B){
      if (typeof DecompressionStream === "undefined") throw new Error("ce navigateur est trop ancien pour lire les fichiers Excel. Mettez-le à jour, ou enregistrez le fichier au format CSV dans Excel");
      (IMPORT_TARGET === "verif" ? openVerifMapper : openMapper)(await readXlsx(buf), f.name);
    } else if (b[0] === 0xD0 && b[1] === 0xCF){
      throw new Error("ce fichier est au format Excel 97-2003 (.xls). Dans Excel, choisissez Fichier, Enregistrer sous, puis « Classeur Excel (.xlsx) », et importez le nouveau fichier");
    } else (IMPORT_TARGET === "verif" ? openVerifMapper : openMapper)([{name:"", rows:csvRows(decodeText(buf))}], f.name);
  } catch (e){ if (IMPORT_TARGET === "verif") $("#vMapper").classList.add("hidden"); else closeMapper(); showImportMsg("Import impossible : " + e.message + "."); }
}

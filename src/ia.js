
/* =====================================================================
   Assistant IA : Claude, ChatGPT ou Gemini, appelés directement depuis
   le navigateur avec la clé de l'entreprise (gardée dans le coffre).
   ===================================================================== */
const IA_PROV = {
  anthropic:{nom:"Claude (Anthropic)", aide:"https://console.anthropic.com/settings/keys"},
  openai:{nom:"ChatGPT (OpenAI)", aide:"https://platform.openai.com/api-keys"},
  gemini:{nom:"Gemini (Google)", aide:"https://aistudio.google.com/apikey"}
};
const IA = {conv:[], busy:false};
function iaReadForm(){
  if (!C.open) return;
  const p = $("#iaProv"), k = $("#iaKey"), m = $("#iaModel");
  if (p) C.data.ia.fournisseur = p.value;
  if (k) C.data.ia.cle = k.value.trim();
  if (m && m.value) C.data.ia.modele = m.value;
}
async function iaHttp(url, opts){
  let res;
  try { res = await fetch(url, {...opts, credentials:"omit", cache:"no-store", referrerPolicy:"no-referrer"}); }
  catch (e){ throw new Error("le fournisseur ne répond pas (réseau ou blocage du navigateur)"); }
  const t = await res.text(); let j = null; try { j = JSON.parse(t); } catch (e){ /* texte brut */ }
  if (!res.ok){
    const m = j && (j.error && (j.error.message || j.error.type) || j.message);
    throw new Error(res.status === 401 || res.status === 403 ? "clé refusée par le fournisseur" + (m ? " (" + m + ")" : "") : (m || "erreur " + res.status));
  }
  return j;
}
function iaHeaders(prov, key){
  if (prov === "anthropic") return {"x-api-key":key, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true", "content-type":"application/json"};
  if (prov === "openai") return {Authorization:"Bearer " + key, "Content-Type":"application/json"};
  return {"x-goog-api-key":key, "Content-Type":"application/json"};
}
async function iaListModels(prov, key){
  if (prov === "anthropic"){
    const j = await iaHttp("https://api.anthropic.com/v1/models?limit=100", {headers:iaHeaders(prov, key)});
    return (j.data || []).map(m => ({id:m.id, nom:m.display_name || m.id}));
  }
  if (prov === "openai"){
    const j = await iaHttp("https://api.openai.com/v1/models", {headers:iaHeaders(prov, key)});
    return (j.data || []).filter(m => /^(gpt-|o\d|chatgpt-)/.test(m.id) && !/(audio|realtime|tts|transcribe|image|embedding|search|instruct|moderation)/.test(m.id))
      .sort((a, b) => (b.created || 0) - (a.created || 0)).map(m => ({id:m.id, nom:m.id}));
  }
  const j = await iaHttp("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {headers:iaHeaders(prov, key)});
  return (j.models || []).filter(m => /gemini/.test(m.name) && (m.supportedGenerationMethods || []).includes("generateContent") && !/(embedding|image|tts|audio|live)/.test(m.name))
    .map(m => ({id:m.name, nom:m.displayName || m.name})).reverse();
}
async function iaFillModels(force){
  const sel = $("#iaModel"); if (!sel || !C.open) return 0;
  const {fournisseur:prov, cle:key, modele} = C.data.ia;
  if (!key){ if (force) throw new Error("collez d'abord la clé d'accès"); return 0; }
  if (!force && !IA.cache) return 0;
  const list = force || !IA.cache || IA.cache.prov !== prov ? await iaListModels(prov, key) : IA.cache.list;
  IA.cache = {prov, list};
  sel.innerHTML = list.map(m => `<option value="${esc(m.id)}"${m.id === modele ? " selected" : ""}>${esc(m.nom)}</option>`).join("");
  if (!list.find(m => m.id === modele) && list[0]){ C.data.ia.modele = list[0].id; sel.value = list[0].id; saveVault(); }
  return list.length;
}

/* ---------- Contexte transmis à l'IA ---------- */
const IA_SYSTEM = `Tu es un consultant en organisation des déplacements de praticiens (médecins, notamment en téléconsultation et en visites d'établissements de santé et d'EHPAD) pour l'entreprise décrite ci-dessous. Réponds en français, de façon concrète, chiffrée et actionnable.
Appuie-toi d'abord sur les documents de l'entreprise (business plan, bases de clients et de praticiens…) et sur les résultats de l'analyse des trajets, calculés par la route (itinéraire le plus rapide, sans trafic). Cite les praticiens et établissements par leur libellé exact. Sépare clairement ce qui vient des données et ce qui relève de ton hypothèse. N'invente aucun chiffre absent des données.
Structure tes réponses : une synthèse de trois lignes, puis des recommandations numérotées avec leur gain estimé, les risques ou points d'attention, et les prochaines étapes.`;
function iaAnalysisText(){
  if (!V.ready) return "Aucune analyse de trajets n'est ouverte pour le moment.";
  const st = vStats(), m = s => Math.round(s / 60);
  const out = [];
  out.push(`## Analyse du fichier « ${V.file} »`);
  out.push(`${st.n} affectations, ${V.docs.length} praticiens. Trajets conformes : ${st.c.ok}, en écart : ${st.c.bad}, non vérifiables : ${st.c.nv}. Écart médian des km déclarés : ${pct(st.medKm)}, des temps : ${pct(st.medMin)}.`);
  out.push(`Temps de trajet aller total actuel : ${m(V.totCur)} min ; après répartition optimale à charge ${V.capMode === "same" ? "constante" : "plafonnée à " + V.capN} : ${m(V.totOpt)} min (${V.changes.length} réaffectations).`);
  try {
    const res = V.SC || scCompute();
    out.push("### Scénarios chiffrés (par mois)");
    out.push("Scénario | Praticiens | Heures de trajet | Km | Coût total");
    [...res.list, res.fewer].filter(Boolean).forEach(s => out.push(`${s.label} | ${s.prat} | ${Math.round(s.heures)} | ${Math.round(s.km)} | ${Math.round(s.total)} €`));
    out.push(`Paramètres : ${res.sp.visitesMois} visites/mois par établissement, ${res.sp.allerRetour ? "aller-retour" : "aller"}, ${res.sp.coutKm} €/km, ${res.sp.coutHeure} €/h de trajet, coût fixe ${res.sp.coutFixePraticien} €/praticien/mois, au plus ${res.sp.chargeMax} établissements et ${res.sp.tempsMax} min par praticien.`);
    if (res.steps.length){
      out.push(`### Praticiens libérables, dans l'ordre (coût marginal en trajets)`);
      res.steps.forEach((s, k) => out.push(`${k + 1}. ${s.doc.label} (${place(s.doc.pt)}) : +${m(s.dtAller)} min aller au total, ${s.delta >= 0 ? "+" : ""}${Math.round(s.delta)} €/mois ; établissements repris : ${s.moves.map(x => `${x.r.eLabel} → ${x.to.label}`).join(", ")}`));
    }
  } catch (e){ /* scénarios indisponibles */ }
  out.push("### Établissements ayant un praticien plus proche que le leur");
  st.closer.slice(0, 150).forEach(r => out.push(`- ${r.eLabel} (${place(r.ePt)}) : suivi par ${r.dLabel} en ${m(r.curCost)} min ; ${r.best.label} est à ${m(r.bestCost)} min`));
  out.push("### Réaffectations proposées (répartition optimale)");
  V.changes.slice(0, 150).forEach(r => out.push(`- ${r.eLabel} : ${r.dLabel} (${m(r.curCost)} min) → ${r.prop.label} (${m(r.propCost)} min)`));
  out.push("### Praticiens (établissements, total aller en min, trajet le plus long en min)");
  V.docs.slice().sort((a, b) => b.max - a.max).forEach(d => out.push(`- ${d.label} (${place(d.pt)}) : ${d.rows.length} ; ${m(d.tot)} ; ${m(d.max)}`));
  out.push("### Trajets déclarés en écart (déclaré → recalculé)");
  st.bad.slice(0, 80).forEach(r => out.push(`- ${r.eLabel} ← ${r.dLabel} : ${r.km ?? "?"} km / ${r.min ?? "?"} min → ${nf1.format(r.newKm)} km / ${Math.round(r.newMin)} min`));
  return out.join("\n");
}
function iaContext(){
  const d = C.data, p = d.profil;
  const docsTxt = d.docs.filter(x => x.texte);
  let budget = 350000, parts = [];
  parts.push(`# Entreprise\nNom : ${p.entreprise || "non renseigné"}\nSecteur : ${p.secteur || "non renseigné"}\nActivité : ${p.description || "non renseignée"}\nObjectifs et contraintes : ${p.objectifs || "non renseignés"}`);
  const ana = iaAnalysisText(); parts.push("# Résultats de l'analyse\n" + ana); budget -= ana.length;
  const per = docsTxt.length ? Math.max(4000, Math.floor(budget / docsTxt.length)) : 0;
  docsTxt.forEach(x => parts.push(`<document nom="${x.nom}" type="${x.type}">\n${x.texte.length > per ? x.texte.slice(0, per) + "\n[… document tronqué]" : x.texte}\n</document>`));
  return {text:parts.join("\n\n"), pdfs:d.docs.filter(x => x.b64)};
}
async function iaCall(question){
  const {fournisseur:prov, cle:key, modele:model} = C.data.ia;
  if (!key) throw new Error("ajoutez la clé d'accès de votre IA dans votre espace (onglet IA)");
  if (!model) throw new Error("choisissez un modèle dans votre espace (onglet IA)");
  const hist = IA.conv.filter(h => !h.pending);
  const first = hist.length === 0;
  const ctx = first ? iaContext() : null;
  const firstText = ctx ? `${ctx.text}\n\n# Question\n${question}` : question;
  if (prov === "anthropic"){
    const msgs = [];
    hist.forEach((h, k) => { msgs.push({role:"user", content:k === 0 ? h.ctxContent : h.q}); msgs.push({role:"assistant", content:h.a}); });
    const content = first ? [...ctx.pdfs.map(x => ({type:"document", source:{type:"base64", media_type:"application/pdf", data:x.b64}, title:x.nom})), {type:"text", text:firstText}] : question;
    msgs.push({role:"user", content});
    const j = await iaHttp("https://api.anthropic.com/v1/messages", {method:"POST", headers:iaHeaders(prov, key), body:JSON.stringify({model, max_tokens:4096, system:IA_SYSTEM, messages:msgs})});
    return {a:(j.content || []).filter(c => c.type === "text").map(c => c.text).join("\n"), content};
  }
  if (prov === "openai"){
    const input = [];
    hist.forEach((h, k) => { input.push({role:"user", content:k === 0 ? h.ctxContent : h.q}); input.push({role:"assistant", content:h.a}); });
    const content = first ? [...ctx.pdfs.map(x => ({type:"input_file", filename:x.nom, file_data:"data:application/pdf;base64," + x.b64})), {type:"input_text", text:firstText}] : question;
    input.push({role:"user", content});
    const j = await iaHttp("https://api.openai.com/v1/responses", {method:"POST", headers:iaHeaders(prov, key), body:JSON.stringify({model, instructions:IA_SYSTEM, input, max_output_tokens:6000})});
    const a = j.output_text || (j.output || []).flatMap(o => o.content || []).filter(c => c.type === "output_text").map(c => c.text).join("\n");
    return {a, content};
  }
  const contents = [];
  hist.forEach((h, k) => { contents.push({role:"user", parts:k === 0 ? h.ctxContent : [{text:h.q}]}); contents.push({role:"model", parts:[{text:h.a}]}); });
  const parts = first ? [...ctx.pdfs.map(x => ({inline_data:{mime_type:"application/pdf", data:x.b64}})), {text:firstText}] : [{text:question}];
  contents.push({role:"user", parts});
  const j = await iaHttp(`https://generativelanguage.googleapis.com/v1beta/${model}:generateContent`, {method:"POST", headers:iaHeaders(prov, key),
    body:JSON.stringify({systemInstruction:{parts:[{text:IA_SYSTEM}]}, contents, generationConfig:{maxOutputTokens:8192}})});
  const c = j.candidates && j.candidates[0];
  return {a:c && c.content ? (c.content.parts || []).map(p => p.text || "").join("") : "(réponse vide" + (c && c.finishReason ? " : " + c.finishReason : "") + ")", content:parts};
}

/* ---------- Affichage ---------- */
function mdToHtml(md){
  const lines = esc(md || "").split(/\r?\n/), out = [];
  let list = null, table = null;
  const inline = t => t.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<i>$2</i>").replace(/`([^`]+)`/g, "<code>$1</code>");
  const flush = () => { if (list){ out.push(`</${list}>`); list = null; } if (table){ out.push("</tbody></table>"); table = null; } };
  for (const raw of lines){
    const l = raw.trimEnd();
    if (/^\s*\|.*\|\s*$/.test(l)){
      const cells = l.trim().slice(1, -1).split("|").map(c => inline(c.trim()));
      if (cells.every(c => /^:?-{2,}:?$/.test(c))) continue;
      if (!table){ flush(); out.push(`<table><thead><tr>${cells.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>`); table = true; }
      else out.push(`<tr>${cells.map(c => `<td>${c}</td>`).join("")}</tr>`);
      continue;
    }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))){ flush(); out.push(`<h${Math.min(6, m[1].length + 2)}>${inline(m[2])}</h${Math.min(6, m[1].length + 2)}>`); continue; }
    if ((m = l.match(/^\s*[-*•]\s+(.*)$/))){ if (list !== "ul"){ flush(); out.push("<ul>"); list = "ul"; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    if ((m = l.match(/^\s*\d+[.)]\s+(.*)$/))){ if (list !== "ol"){ flush(); out.push("<ol>"); list = "ol"; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    if (!l.trim()){ flush(); continue; }
    flush(); out.push(`<p>${inline(l)}</p>`);
  }
  flush();
  return out.join("");
}
const IA_QUICK = [
  "Selon notre business plan, quelles affectations faut-il changer en priorité ?",
  "Pouvons-nous fonctionner avec moins de praticiens ? Lesquels, et avec quel impact ?",
  "Quels trajets déclarés semblent faux, et pourquoi ?",
  "Rédige une synthèse d'une page pour la direction."
];
function iaRender(){
  const ready = C.open && C.data.ia.cle && C.data.ia.modele;
  $("#iaWho").textContent = C.open ? `${IA_PROV[C.data.ia.fournisseur].nom}${C.data.ia.modele ? " · " + C.data.ia.modele.replace(/^models\//, "") : ""}` : "Espace client fermé";
  const box = $("#iaMsgs");
  if (!ready){
    box.innerHTML = `<div class="iaempty"><p>${C.open ? "Ajoutez la clé d'accès de votre IA (Claude, ChatGPT ou Gemini) et choisissez un modèle dans votre espace." : "L'assistant utilise les documents et la clé d'IA de votre espace client, qui doit être ouvert."}</p><button class="btn" type="button" id="iaGoEsp">${C.open ? "Configurer l'IA" : "Ouvrir mon espace"}</button></div>`;
  } else {
    box.innerHTML = IA.conv.map(h => `<div class="iaq">${esc(h.q)}</div><div class="iaa">${mdToHtml(h.a)}</div>`).join("") + (IA.busy ? `<div class="iaa wait">Réflexion en cours…</div>` : "")
      + (IA.conv.length || IA.busy ? "" : `<div class="iaempty"><p>Posez une question, ou choisissez une suggestion. L'assistant reçoit le profil de l'entreprise, ${plural(C.data.docs.length, "document")} de votre espace${V.ready ? " et les résultats de l'analyse en cours" : ""}.</p></div>`);
    box.scrollTop = box.scrollHeight;
  }
  $("#iaQuick").innerHTML = ready && !IA.conv.length ? IA_QUICK.map(q => `<button class="pill" type="button" data-q="${esc(q)}">${esc(q)}</button>`).join("") : "";
  $("#iaSend").disabled = !ready || IA.busy;
  $("#iaNote").textContent = ready ? `Envoyé directement à ${IA_PROV[C.data.ia.fournisseur].nom} au moment de la question : la question, le profil, les documents de l'espace et le résumé de l'analyse.` : "";
}
function openIA(){ IA.conv = IA.conv || []; iaRender(); openSheet("#iaSheet"); setTimeout(() => { const q = $("#iaQ"); if (q && !q.disabled) q.focus(); }, 50); }
async function iaSend(q){
  q = (q || $("#iaQ").value).trim(); if (!q || IA.busy) return;
  $("#iaQ").value = ""; IA.busy = true;
  IA.conv.push({q, a:"", pending:true}); iaRender();
  try {
    const r = await iaCall(q);
    const h = IA.conv[IA.conv.length - 1];
    Object.assign(h, {a:r.a || "(réponse vide)", pending:false, date:new Date().toISOString(), modele:C.data.ia.modele});
    if (IA.conv.length === 1) h.ctxContent = r.content;
    if (V.ready){ V.iaHist = IA.conv.map(x => ({q:x.q, a:x.a, date:x.date, modele:x.modele})); }
  } catch (e){
    IA.conv.pop();
    IA.busy = false; iaRender();
    $("#iaMsgs").insertAdjacentHTML("beforeend", `<div class="iaa err">L'assistant n'a pas pu répondre : ${esc(e.message)}.</div>`);
    return;
  }
  IA.busy = false; iaRender();
}
$("#iaSheet").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.id === "iaGoEsp"){ closeSheet("#iaSheet"); E.utab = "ia"; openEspace(C.open ? null : "login"); return; }
  if (b.dataset.q){ iaSend(b.dataset.q); return; }
  if (b.id === "iaSend"){ iaSend(); return; }
  if (b.id === "iaNew"){ IA.conv = []; iaRender(); return; }
});
$("#iaQ").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey){ e.preventDefault(); iaSend(); } });
$$(".open-ia").forEach(b => b.addEventListener("click", openIA));

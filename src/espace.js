
/* =====================================================================
   Espace client : interface
   ===================================================================== */
const DOC_TYPES = ["Business plan", "Base clients", "Base praticiens", "Contrats", "Tarifs", "Autre"];
const E = {tab:"login", utab:"profil", recShown:""};
function espaceMsg(t, ok){ const b = $("#espMsg"); if (!b) return; b.textContent = t || ""; b.className = "espmsg" + (ok ? " ok" : "") + (t ? "" : " hidden"); }
function espaceSaved(){ const b = $("#espSaved"); if (b){ b.textContent = "Enregistré " + new Date().toLocaleTimeString("fr-FR", {hour:"2-digit", minute:"2-digit"}); } }
function openEspace(tab){ if (tab) E.tab = tab; espaceUI(); openSheet("#espaceSheet"); }
function espaceUI(){
  const btn = $("#espaceBtn");
  btn.innerHTML = `<svg class="i" viewBox="0 0 24 24">${C.open ? '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>' : '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'}</svg><span>${C.open ? esc(C.data.profil.entreprise || C.ident) : "Espace client"}</span>`;
  btn.classList.toggle("on", C.open);
  $$(".needs-espace").forEach(e => e.classList.toggle("hidden", !C.open));
  const body = $("#espaceBody"); if (!body) return;
  body.innerHTML = C.open ? espaceOpenHTML() : espaceLockedHTML();
  espaceMsg("");
  if (C.open && E.utab === "ia") iaFillModels();
}
const fld = (id, label, type = "text", val = "", extra = "") => `<label class="ef"><span>${label}</span><input id="${id}" type="${type}" value="${esc(val)}" ${extra}></label>`;
function espaceLockedHTML(){
  const tabs = [["login", "Se connecter"], ["create", "Créer mon espace"], ["import", "Importer un coffre"], ["recover", "Clé de secours"]];
  const t = E.tab;
  let form = "";
  if (t === "login") form = `${fld("eId", "Identifiant ou e-mail", "text", "", 'autocomplete="username"')}${fld("ePwd", "Mot de passe", "password", "", 'autocomplete="current-password"')}
    <button class="btn big" id="eLogin" type="button">Ouvrir mon espace</button>`;
  if (t === "create") form = `${fld("eId", "Identifiant ou e-mail", "text", "", 'autocomplete="username"')}${fld("ePwd", "Mot de passe (10 caractères minimum)", "password", "", 'autocomplete="new-password"')}${fld("ePwd2", "Confirmer le mot de passe", "password", "", 'autocomplete="new-password"')}
    <label class="chk2"><input type="checkbox" id="eAck"> Je comprends que personne, pas même l'administrateur du site, ne peut ouvrir mon espace sans mon mot de passe ou ma clé de secours.</label>
    <button class="btn big" id="eCreate" type="button">Créer mon espace</button>`;
  if (t === "import") form = `<label class="drop-zone small"><b>Choisir le fichier .krcoffre</b><input type="file" id="eFile" accept=".krcoffre,application/octet-stream"></label><p class="hint" id="eFileName"></p>
    ${fld("eId", "Identifiant ou e-mail", "text", "", 'autocomplete="username"')}${fld("ePwd", "Mot de passe", "password", "", 'autocomplete="current-password"')}
    <button class="btn big" id="eImport" type="button">Ouvrir ce coffre</button>`;
  if (t === "recover") form = `${fld("eId", "Identifiant ou e-mail", "text", "", 'autocomplete="username"')}${fld("eRec", "Clé de secours", "text", "", 'autocomplete="off" spellcheck="false" placeholder="XXXX-XXXX-…"')}${fld("ePwd", "Nouveau mot de passe", "password", "", 'autocomplete="new-password"')}
    <button class="btn big" id="eRecover" type="button">Rouvrir avec la clé de secours</button>`;
  return `<div class="seg etabs">${tabs.map(([k, l]) => `<button type="button" data-et="${k}" aria-pressed="${k === t}">${l}</button>`).join("")}</div>
    <div class="eform">${form}<p class="espmsg hidden" id="espMsg" role="alert"></p></div>
    <div class="epriv"><b>Confidentialité</b>
      <p>Votre espace est chiffré dans ce navigateur (AES-256) avec une clé tirée de votre mot de passe, qui n'est jamais envoyé ni enregistré. Il reste sur cet appareil${CFG.online ? " et, si vous activez la synchronisation, une copie chiffrée est gardée en ligne, illisible pour le serveur" : ""}. Rafraîchir la page le verrouille. Après 30 minutes sans activité, il se verrouille aussi.</p></div>`;
}
function espaceOpenHTML(){
  const d = C.data, p = d.params, t = E.utab;
  const tabs = [["profil", "Profil"], ["docs", "Documents"], ["ia", "IA"], ["analyses", "Analyses"], ["secu", "Sécurité"]];
  let h = "";
  if (t === "profil") h = `<div class="egrid">
      ${fld("pEnt", "Entreprise", "text", d.profil.entreprise)}${fld("pSect", "Secteur", "text", d.profil.secteur)}
      <label class="ef wide"><span>Description de l'activité</span><textarea id="pDesc" rows="3">${esc(d.profil.description)}</textarea></label>
      <label class="ef wide"><span>Objectifs et contraintes (issus du business plan)</span><textarea id="pObj" rows="4" placeholder="Ex. : réduire les coûts de déplacement de 20 %, pas plus de 3 établissements par praticien, trajet maximal 1 h 30…">${esc(d.profil.objectifs)}</textarea></label>
    </div>
    <h4>Paramètres des scénarios</h4>
    <div class="egrid">
      ${fld("qKm", "Coût par km (€)", "number", p.coutKm, 'step="0.01" min="0"')}${fld("qH", "Coût horaire du praticien en trajet (€)", "number", p.coutHeure, 'step="1" min="0"')}
      ${fld("qVis", "Visites par établissement et par mois", "number", p.visitesMois, 'step="0.5" min="0"')}${fld("qFix", "Coût fixe mensuel par praticien (€)", "number", p.coutFixePraticien, 'step="10" min="0"')}
      ${fld("qCap", "Établissements au plus par praticien", "number", p.chargeMax, 'step="1" min="1"')}${fld("qT", "Trajet maximal accepté (min)", "number", p.tempsMax, 'step="5" min="5"')}
      <label class="chk2"><input type="checkbox" id="qAR"${p.allerRetour ? " checked" : ""}> Compter l'aller et le retour</label>
    </div>`;
  if (t === "docs") h = `<p class="hint" style="margin-top:0">Business plan, base de clients, base de praticiens, contrats… Ils restent chiffrés dans votre espace. L'assistant IA les lit quand vous lui posez une question.</p>
    <label class="drop-zone small" id="eDocDrop"><b>Ajouter des documents</b>PDF, Word, Excel, PowerPoint, CSV, texte · 15 Mo max par fichier<input type="file" id="eDocs" multiple accept=".pdf,.docx,.xlsx,.xlsm,.pptx,.csv,.txt,.md,application/pdf"></label>
    <ul class="dlist">${d.docs.map(x => `<li><span class="dname"><b>${esc(x.nom)}</b><small>${nf0.format(Math.round(x.taille / 1024))} Ko · ${new Date(x.ajoute).toLocaleDateString("fr-FR")}${x.texte ? " · " + nf0.format(x.texte.length) + " caractères lus" : x.b64 ? " · PDF transmis tel quel à l'IA" : ""}</small></span>
      <select data-dtype="${x.id}">${DOC_TYPES.map(k => `<option${k === x.type ? " selected" : ""}>${k}</option>`).join("")}</select>
      <button class="close" type="button" data-ddel="${x.id}" aria-label="Supprimer ${esc(x.nom)}"><svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></li>`).join("") || `<li class="empty">Aucun document pour l'instant.</li>`}</ul>`;
  if (t === "ia") h = `<div class="egrid">
      <label class="ef"><span>Fournisseur</span><select id="iaProv">${Object.entries(IA_PROV).map(([k, v]) => `<option value="${k}"${k === d.ia.fournisseur ? " selected" : ""}>${v.nom}</option>`).join("")}</select></label>
      ${fld("iaKey", "Clé d'accès (API)", "password", d.ia.cle, 'autocomplete="off" spellcheck="false"')}
      <label class="ef wide"><span>Modèle</span><select id="iaModel"><option value="${esc(d.ia.modele)}">${esc(d.ia.modele || "Chargez la liste avec le bouton ci-dessous")}</option></select></label>
    </div>
    <div class="row wrap"><button class="btn" id="iaTest" type="button">Vérifier la clé et charger les modèles</button><button class="btn sec" id="iaOpen" type="button">Ouvrir l'assistant</button><a class="ghost" id="iaHelp" href="${IA_PROV[d.ia.fournisseur].aide}" target="_blank" rel="noopener noreferrer">Où trouver ma clé ?</a></div>
    <div class="epriv"><b>Ce qui est envoyé</b><p>La clé reste chiffrée dans votre espace. Quand vous posez une question, le navigateur envoie directement au fournisseur choisi votre question, le profil, les documents et le résumé de l'analyse. Aucun intermédiaire. Avec une clé API professionnelle, ces fournisseurs indiquent ne pas utiliser les données pour entraîner leurs modèles : vérifiez leurs conditions et celles de votre contrat.</p></div>`;
  if (t === "analyses") h = `<ul class="dlist">${d.analyses.slice().reverse().map(a => `<li><span class="dname"><b>${esc(a.fichier)}</b><small>${new Date(a.date).toLocaleString("fr-FR", {dateStyle:"medium", timeStyle:"short"})} · ${plural(a.rows.length, "affectation")} · ${a.resume ? `${a.resume.ok} conformes, ${a.resume.bad} écarts, ${a.resume.closer} avec un médecin plus proche` : ""}${a.ia && a.ia.length ? " · " + plural(a.ia.length, "réponse") + " de l'IA" : ""}</small></span>
      <button class="btn sec" type="button" data-aopen="${a.id}">Rouvrir</button><button class="close" type="button" data-adel="${a.id}" aria-label="Supprimer l'analyse"><svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></li>`).join("") || `<li class="empty">Aucune analyse enregistrée. Après une vérification, cliquez sur « Enregistrer ».</li>`}</ul>`;
  if (t === "secu"){
    const size = C.env ? (C.env.data.ct.length * 0.75) : 0;
    h = `<ul class="kv"><li><span>Identifiant</span><b>${esc(C.ident)}</b></li><li><span>Créé le</span><b>${new Date(d.cree).toLocaleDateString("fr-FR")}</b></li>
      <li><span>Dernière modification</span><b id="espSaved">${new Date(d.maj).toLocaleString("fr-FR")}</b></li><li><span>Taille chiffrée</span><b>${nf1.format(size / 1048576)} Mo</b></li>
      <li><span>Synchronisation en ligne</span><b>${CFG.online ? (d.synchro ? "activée (copie chiffrée)" : "désactivée") : "non configurée sur ce site"}</b></li></ul>
      <div class="row wrap">
        <button class="btn sec" id="eExport" type="button">Exporter le coffre (fichier chiffré)</button>
        ${CFG.online && !d.synchro ? `<button class="btn sec" id="eSync" type="button">Activer la synchronisation en ligne</button>` : ""}
        <button class="btn sec" id="eLock" type="button">Verrouiller</button>
      </div>
      <h4>Changer le mot de passe</h4>
      <div class="egrid">${fld("eOld", "Mot de passe actuel", "password", "", 'autocomplete="current-password"')}${fld("eNew", "Nouveau mot de passe", "password", "", 'autocomplete="new-password"')}</div>
      <button class="btn sec" id="eChPwd" type="button">Changer</button>
      <h4>Supprimer l'espace</h4>
      <p class="hint">Efface définitivement l'espace de ce navigateur${CFG.online ? " et sa copie en ligne" : ""}. Les fichiers de coffre exportés ne sont pas concernés.</p>
      ${fld("eDelConf", "Tapez SUPPRIMER pour confirmer")}<button class="btn danger" id="eDel" type="button">Supprimer mon espace</button>`;
  }
  return `<div class="ehead"><div><b>${esc(d.profil.entreprise || C.ident)}</b><small>Espace chiffré ouvert</small></div><button class="btn sec" id="eLock2" type="button">Verrouiller</button></div>
    <div class="seg etabs">${tabs.map(([k, l]) => `<button type="button" data-ut="${k}" aria-pressed="${k === t}">${l}</button>`).join("")}</div>
    <div class="ebody">${h}<p class="espmsg hidden" id="espMsg" role="alert"></p></div>`;
}
function showRecovery(code){
  $("#espaceBody").innerHTML = `<div class="recbox"><h3>Votre clé de secours</h3>
    <p>C'est le seul moyen de rouvrir votre espace si vous oubliez votre mot de passe. Elle ne sera plus jamais affichée : notez-la ou imprimez-la, et rangez-la en lieu sûr.</p>
    <code id="recCode">${code}</code>
    <div class="row wrap"><button class="btn sec" id="recCopy" type="button">Copier</button><button class="btn sec" id="recPrint" type="button">Imprimer</button></div>
    <label class="chk2"><input type="checkbox" id="recOk"> J'ai noté ma clé de secours</label>
    <button class="btn big" id="recDone" type="button" disabled>Accéder à mon espace</button></div>`;
}

/* ---------- Lecture des documents dans le navigateur ---------- */
async function readDocText(file){
  const name = file.name.toLowerCase(), buf = await file.arrayBuffer();
  if (/\.(txt|md|csv)$/.test(name)) return {texte:decodeText(buf)};
  if (/\.pdf$/.test(name) || file.type === "application/pdf") return {b64:b64e(new Uint8Array(buf)), mime:"application/pdf"};
  if (/\.(xlsx|xlsm)$/.test(name)){
    const sheets = (await readXlsx(buf)).map(cleanSheet);
    return {texte:sheets.map(s => `# Feuille ${s.name}\n` + s.rows.map(r => r.join("\t")).join("\n")).join("\n\n")};
  }
  if (/\.(docx|pptx)$/.test(name)){
    const get = await unzip(buf), parts = [];
    if (name.endsWith(".docx")){
      const x = await get("word/document.xml");
      if (x){ const doc = new DOMParser().parseFromString(x, "application/xml"); byTag(doc, "p").forEach(p => { const t = byTag(p, "t").map(n => n.textContent).join(""); if (t.trim()) parts.push(t); }); }
    } else {
      for (let k = 1; k < 300; k++){
        const x = await get(`ppt/slides/slide${k}.xml`); if (!x) break;
        const doc = new DOMParser().parseFromString(x, "application/xml");
        parts.push(`# Diapositive ${k}\n` + byTag(doc, "p").map(p => byTag(p, "t").map(n => n.textContent).join("")).filter(t => t.trim()).join("\n"));
      }
    }
    return {texte:parts.join("\n")};
  }
  throw new Error("format non pris en charge : " + file.name);
}
async function addDocs(files){
  for (const f of files){
    if (f.size > 15 * 1048576){ espaceMsg(`${f.name} dépasse 15 Mo.`); continue; }
    try {
      const r = await readDocText(f);
      const type = /business|bp|plan/i.test(f.name) ? "Business plan" : /client|etab|établ/i.test(f.name) ? "Base clients" : /pratic|medec|médec/i.test(f.name) ? "Base praticiens" : /contrat/i.test(f.name) ? "Contrats" : "Autre";
      C.data.docs.push({id:hex(rnd(8)), nom:f.name, type, taille:f.size, ajoute:new Date().toISOString(), ...r, texte:r.texte ? r.texte.slice(0, 600000) : undefined});
    } catch (e){ espaceMsg(e.message); }
  }
  await saveVault(true); espaceUI(); espaceMsg("Documents ajoutés à votre espace.", true);
}

/* ---------- Enregistrer une analyse dans l'espace ---------- */
async function saveAnalysis(){
  if (!C.open){ openEspace("login"); return; }
  if (!V.ready) return;
  const st = vStats();
  const a = {id:V.savedId || hex(rnd(8)), date:new Date().toISOString(), fichier:V.file,
    rows:V.rows.map(r => ({etabQ:r.etabQ, etabName:r.etabName, docQ:r.docQ, docName:r.docName, km:r.km, min:r.min, status:r.status})),
    reglages:{metric:V.metric, capMode:V.capMode, capN:V.capN, tolPct:V.tolPct, tolKm:V.tolKm, tolPctMin:V.tolPctMin, tolMin:V.tolMin, statusCol:V.statusCol},
    resume:{ok:st.c.ok, bad:st.c.bad, nv:st.c.nv, closer:st.closer.length, changes:V.changes.length}, ia:V.iaHist || []};
  const k = C.data.analyses.findIndex(x => x.id === a.id);
  if (k >= 0) C.data.analyses[k] = a; else C.data.analyses.push(a);
  V.savedId = a.id;
  await saveVault(true);
  $("#vSave").textContent = "Enregistré";
  setTimeout(() => { const b = $("#vSave"); if (b) b.textContent = "Enregistrer"; }, 2000);
}
function reopenAnalysis(id){
  const a = C.data.analyses.find(x => x.id === id); if (!a) return;
  closeSheet("#espaceSheet");
  Object.assign(V, a.reglages);
  $("#vMetric").value = V.metric; $("#vCap").value = V.capMode; $("#vCapN").value = V.capN; $("#vCapN").disabled = V.capMode !== "max";
  $("#vTolPct").value = V.tolPct; $("#vTolKm").value = V.tolKm; $("#vTolPctMin").value = V.tolPctMin; $("#vTolMin").value = V.tolMin;
  VM = {title:a.fichier, map:{status:a.reglages.statusCol ? 0 : -1}};
  runVerif(a.rows.map(r => ({...r})), a);
}

/* ---------- Événements ---------- */
$("#espaceBtn").addEventListener("click", () => openEspace());
$("#espaceSheet").addEventListener("click", async e => {
  const b = e.target.closest("button"); if (!b) return;
  const v = id => ($("#" + id) || {}).value || "";
  if (b.dataset.et){ E.tab = b.dataset.et; espaceUI(); return; }
  if (b.dataset.ut){ E.utab = b.dataset.ut; espaceUI(); return; }
  const busy = async (fn) => { b.disabled = true; const t = b.textContent; b.textContent = "Patientez…"; try { await fn(); } catch (err){ espaceMsg(err.message.charAt(0).toUpperCase() + err.message.slice(1) + "."); } finally { if (b.isConnected){ b.disabled = false; b.textContent = t; } } };
  if (b.id === "eLogin") return busy(async () => { if (!v("eId") || !v("ePwd")) throw new Error("indiquez l'identifiant et le mot de passe"); await openVault(v("eId"), v("ePwd")); E.utab = "profil"; espaceUI(); });
  if (b.id === "eCreate") return busy(async () => {
    if (!v("eId").trim()) throw new Error("indiquez un identifiant");
    if (v("ePwd").length < 10) throw new Error("le mot de passe doit faire au moins 10 caractères");
    if (v("ePwd") !== v("ePwd2")) throw new Error("les deux mots de passe sont différents");
    if (!$("#eAck").checked) throw new Error("cochez la case pour confirmer");
    const code = await createVault(v("eId"), v("ePwd")); espaceUI(); showRecovery(code);
  });
  if (b.id === "eImport") return busy(async () => { const f = $("#eFile").files[0]; if (!f) throw new Error("choisissez le fichier du coffre"); await importVaultFile(f, v("eId"), v("ePwd")); espaceUI(); });
  if (b.id === "eRecover") return busy(async () => { if (v("ePwd").length < 10) throw new Error("le nouveau mot de passe doit faire au moins 10 caractères"); await recoverVault(v("eId"), v("eRec"), v("ePwd")); espaceUI(); showRecovery(await rotateRecovery()); });
  if (b.id === "recCopy"){ navigator.clipboard && navigator.clipboard.writeText($("#recCode").textContent); b.textContent = "Copié"; return; }
  if (b.id === "recPrint"){ const w = window.open("", "_blank", "width=600,height=400"); if (w){ w.document.write(`<title>Clé de secours</title><p style="font:16px sans-serif">Clé de secours de l'espace « ${esc(C.ident)} » (Kilomètres réels), créée le ${new Date().toLocaleDateString("fr-FR")} :</p><p style="font:600 22px monospace">${$("#recCode").textContent}</p>`); w.document.close(); w.print(); } return; }
  if (b.id === "recDone"){ espaceUI(); return; }
  if (b.id === "eLock" || b.id === "eLock2"){ lockVault(); E.tab = "login"; espaceUI(); return; }
  if (b.id === "eExport"){ exportVaultFile(); return; }
  if (b.id === "eSync") return busy(async () => { await cloudEnable(); espaceUI(); espaceMsg("Synchronisation activée : une copie chiffrée est gardée en ligne.", true); });
  if (b.id === "eChPwd") return busy(async () => { if (v("eNew").length < 10) throw new Error("le nouveau mot de passe doit faire au moins 10 caractères"); await changePassword(v("eOld"), v("eNew")); espaceUI(); espaceMsg("Mot de passe changé.", true); });
  if (b.id === "eDel") return busy(async () => { if (v("eDelConf") !== "SUPPRIMER") throw new Error("tapez SUPPRIMER en majuscules pour confirmer"); await deleteVault(); E.tab = "login"; espaceUI(); espaceMsg("Espace supprimé.", true); });
  if (b.dataset.ddel){ C.data.docs = C.data.docs.filter(x => x.id !== b.dataset.ddel); await saveVault(true); espaceUI(); return; }
  if (b.dataset.aopen){ reopenAnalysis(b.dataset.aopen); return; }
  if (b.dataset.adel){ C.data.analyses = C.data.analyses.filter(x => x.id !== b.dataset.adel); await saveVault(true); espaceUI(); return; }
  if (b.id === "iaOpen"){ closeSheet("#espaceSheet"); openIA(); return; }
  if (b.id === "iaTest") return busy(async () => { iaReadForm(); await saveVault(true); const n = await iaFillModels(true); espaceMsg(`Clé valide : ${plural(n, "modèle")} disponible${n > 1 ? "s" : ""}.`, true); });
});
$("#espaceSheet").addEventListener("change", async e => {
  const t = e.target;
  if (t.id === "recOk"){ $("#recDone").disabled = !t.checked; return; }
  if (t.id === "eFile"){ $("#eFileName").textContent = t.files[0] ? t.files[0].name : ""; return; }
  if (t.id === "eDocs"){ await addDocs([...t.files]); return; }
  if (t.dataset.dtype){ const d = C.data.docs.find(x => x.id === t.dataset.dtype); if (d){ d.type = t.value; saveVault(); } return; }
  if (t.id === "iaProv"){ iaReadForm(); C.data.ia.modele = ""; saveVault(); espaceUI(); return; }
  if (t.id === "iaModel"){ C.data.ia.modele = t.value; saveVault(); return; }
  if (C.open && E.utab === "profil") espaceReadProfil();
});
$("#espaceSheet").addEventListener("input", e => { if (C.open && E.utab === "profil" && e.target.closest(".ebody")) espaceReadProfil(); if (C.open && e.target.id === "iaKey"){ iaReadForm(); saveVault(); } });
$("#espaceSheet").addEventListener("keydown", e => { if (e.key === "Enter" && e.target.tagName === "INPUT"){ const b = $("#eLogin, #eCreate, #eImport, #eRecover"); if (b){ e.preventDefault(); b.click(); } } });
function espaceReadProfil(){
  const v = id => ($("#" + id) || {}).value, n = (id, d) => { const x = parseFloat(v(id)); return isFinite(x) ? x : d; };
  const d = C.data;
  Object.assign(d.profil, {entreprise:v("pEnt") ?? d.profil.entreprise, secteur:v("pSect") ?? d.profil.secteur, description:v("pDesc") ?? d.profil.description, objectifs:v("pObj") ?? d.profil.objectifs});
  Object.assign(d.params, {coutKm:n("qKm", d.params.coutKm), coutHeure:n("qH", d.params.coutHeure), visitesMois:n("qVis", d.params.visitesMois), coutFixePraticien:n("qFix", d.params.coutFixePraticien),
    chargeMax:Math.max(1, Math.round(n("qCap", d.params.chargeMax))), tempsMax:n("qT", d.params.tempsMax), allerRetour:$("#qAR") ? $("#qAR").checked : d.params.allerRetour});
  saveVault();
  const btn = $("#espaceBtn span"); if (btn) btn.textContent = d.profil.entreprise || C.ident;
}
async function rotateRecovery(){
  const rec = recoveryCode(), rsalt = rnd(16);
  C.env.rsalt = b64e(rsalt);
  C.env.wrapRec = await sealBytes((await pbkdf(cleanRecovery(rec), rsalt, 200000)).slice(0, 32), C.dek);
  await saveVault(true);
  return rec;
}
$("#vSave").addEventListener("click", saveAnalysis);
loadConfig().then(espaceUI);

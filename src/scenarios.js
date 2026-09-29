
/* =====================================================================
   Scénarios chiffrés : coûts mensuels, charge maximale, moins de praticiens
   ===================================================================== */
const SP_DEF = {coutKm:0.6, coutHeure:60, visitesMois:4, allerRetour:true, coutFixePraticien:0, chargeMax:3, tempsMax:90};
function spGet(){ if (C.open) return C.data.params; if (!V.sp) V.sp = {...SP_DEF}; return V.sp; }
const eur = x => isNaN(x) ? "—" : new Intl.NumberFormat("fr-FR", {style:"currency", currency:"EUR", maximumFractionDigits:0}).format(x);
function scFactor(sp){ return sp.visitesMois * (sp.allerRetour ? 2 : 1); }
function scCost(di, ei, sp){ if (di < 0 || ei < 0) return NaN; const t = V.M.T[di][ei], d = V.M.D[di][ei]; if (isNaN(t)) return NaN; return scFactor(sp) * (d / 1000 * sp.coutKm + t / 3600 * sp.coutHeure); }
function scActive(){ return V.rows.filter(r => r.ei >= 0 && r.di >= 0 && !isNaN(V.M.T[r.di][r.ei])); }
function scEval(asg, sp, label, note){
  const f = scFactor(sp); let t = 0, d = 0, c = 0; const used = new Set();
  for (const r of scActive()){ const doc = asg.get(r.i); if (!doc) continue; used.add(doc.id); t += f * V.M.T[doc.pi][r.ei]; d += f * V.M.D[doc.pi][r.ei] / 1000; c += scCost(doc.pi, r.ei, sp); }
  const fixe = used.size * sp.coutFixePraticien;
  return {label, note, asg, prat:used.size, heures:t / 3600, km:d, trajets:c, fixe, total:c + fixe};
}
function scOptimal(caps, sp, tmaxFor){
  const act = scActive(), docs = V.docs.filter(d => d.pi >= 0 && (caps.get(d.id) || 0) > 0);
  const slots = []; docs.forEach(d => { for (let k = 0; k < caps.get(d.id); k++) slots.push(d); });
  if (slots.length < act.length) return null;
  const BIG = 1e9;
  const a = act.map(r => { const row = new Float64Array(slots.length); slots.forEach((d, j) => { const c = scCost(d.pi, r.ei, sp), t = V.M.T[d.pi][r.ei]; row[j] = isNaN(c) || (tmaxFor && t > tmaxFor(r)) ? BIG : c; }); return row; });
  const ans = hungarian(a);
  const asg = new Map();
  for (let k = 0; k < act.length; k++){ if (a[k][ans[k]] >= BIG) return null; asg.set(act[k].i, slots[ans[k]]); }
  return asg;
}
function scCurrent(){ const m = new Map(), byId = new Map(V.docs.map(d => [d.id, d])); scActive().forEach(r => m.set(r.i, byId.get(r.dId))); return m; }

/* Moins de praticiens : on libère un par un le praticien dont le départ coûte le moins,
   tant que ses établissements peuvent être repris sans dépasser la charge ni le trajet maximal. */
function scGreedy(sp, start){
  const K = Math.max(1, Math.round(sp.chargeMax)), Tmax = sp.tempsMax * 60;
  const act = scActive(), asg = new Map(start);
  const load = new Map(); asg.forEach(d => load.set(d.id, (load.get(d.id) || 0) + 1));
  const open = new Set([...asg.values()]);
  const cur = scCurrent();
  const curLimit = new Map(act.map(r => [r.i, Math.max(Tmax, V.M.T[cur.get(r.i).pi][r.ei])]));
  const steps = [];
  for (;;){
    let best = null;
    for (const d of open){
      const mine = act.filter(r => asg.get(r.i) === d).sort((x, y) => scCost(d.pi, y.ei, sp) - scCost(d.pi, x.ei, sp));
      const tmp = new Map(); let delta = 0, dt = 0, ok = true; const moves = [];
      for (const r of mine){
        let bo = null, bc = Infinity;
        for (const o of open){
          if (o === d) continue;
          const l = (load.get(o.id) || 0) + (tmp.get(o.id) || 0); if (l >= K) continue;
          const t = V.M.T[o.pi][r.ei]; if (isNaN(t) || t > curLimit.get(r.i)) continue;
          const c = scCost(o.pi, r.ei, sp); if (c < bc){ bc = c; bo = o; }
        }
        if (!bo){ ok = false; break; }
        tmp.set(bo.id, (tmp.get(bo.id) || 0) + 1);
        delta += bc - scCost(d.pi, r.ei, sp); dt += V.M.T[bo.pi][r.ei] - V.M.T[d.pi][r.ei];
        moves.push({r, to:bo, t:V.M.T[bo.pi][r.ei], from:V.M.T[d.pi][r.ei]});
      }
      if (ok && (!best || delta - sp.coutFixePraticien < best.delta - sp.coutFixePraticien)) best = {d, delta, dt, moves};
    }
    if (!best) break;
    best.moves.forEach(m => { asg.set(m.r.i, m.to); load.set(m.to.id, (load.get(m.to.id) || 0) + 1); });
    load.delete(best.d.id); open.delete(best.d);
    steps.push({doc:best.d, delta:best.delta, dt:best.dt * scFactor(sp), dtAller:best.dt, moves:best.moves, asg:new Map(asg)});
  }
  return steps;
}
function scCompute(){
  const sp = spGet(), K = Math.max(1, Math.round(sp.chargeMax));
  const cur = scCurrent(), res = {sp, list:[]};
  res.list.push(scEval(cur, sp, "Aujourd'hui", "Affectations du fichier"));
  const same = new Map(); cur.forEach(d => same.set(d.id, (same.get(d.id) || 0) + 1));
  const a1 = scOptimal(same, sp); if (a1) res.list.push(scEval(a1, sp, "Meilleure répartition, même charge", "Chaque praticien garde son nombre d'établissements"));
  const capK = new Map(V.docs.filter(d => d.pi >= 0).map(d => [d.id, K]));
  const aK = scOptimal(capK, sp);
  res.aK = aK;
  if (aK) res.list.push(scEval(aK, sp, `Au plus ${K} par praticien`, "Répartition libre, sans dépasser la charge maximale"));
  // Moins de praticiens : départ de la répartition « au plus K » si elle existe, sinon d'aujourd'hui
  const start = aK || cur;
  res.steps = scGreedy(sp, start);
  // Nombre recommandé : libérations « presque sans impact » (≤ 10 min de trajet aller en plus au total),
  // ou rentables si un coût fixe par praticien est renseigné.
  let rec = 0;
  for (const s of res.steps){ if (sp.coutFixePraticien > 0 ? s.delta < sp.coutFixePraticien : s.dtAller <= 600) rec++; else break; }
  res.rec = rec;
  if (V.scK == null || V.scK > res.steps.length) V.scK = rec;
  res.start = start;
  V.SC = res;
  scPick(V.scK);
  return res;
}
function scPick(k){
  const res = V.SC; if (!res) return;
  V.scK = Math.max(0, Math.min(k, res.steps.length));
  const sp = res.sp, K = Math.max(1, Math.round(sp.chargeMax)), Tmax = sp.tempsMax * 60;
  let asg = V.scK ? res.steps[V.scK - 1].asg : res.start;
  // Affinage : meilleure répartition possible entre les praticiens restants
  if (V.scK){
    const open = new Set(asg.values()), cur = scCurrent();
    const caps = new Map(V.docs.filter(d => open.has(d)).map(d => [d.id, K]));
    const pol = scOptimal(caps, sp, r => Math.max(Tmax, V.M.T[cur.get(r.i).pi][r.ei]));
    if (pol && scEval(pol, sp).total < scEval(asg, sp).total) asg = pol;
  }
  res.fewer = scEval(asg, sp, `Moins de praticiens (${V.scK} libéré${V.scK > 1 ? "s" : ""})`, `Au plus ${K} établissements et ${sp.tempsMax} min de trajet par praticien`);
  res.freed = res.steps.slice(0, V.scK);
}
function scRowsHTML(res){
  const base = res.list[0], all = [...res.list, res.fewer].filter(Boolean);
  return `<table class="sctab"><thead><tr><th>Scénario</th><th>Praticiens</th><th>Trajet / mois</th><th>Km / mois</th><th>Coût / mois</th><th>Écart</th></tr></thead><tbody>${all.map((s, k) => {
    const g = s.total - base.total;
    return `<tr${k === 0 ? ' class="base"' : ""}><td><b>${esc(s.label)}</b><small>${esc(s.note || "")}</small></td><td>${s.prat}</td><td>${nf0.format(Math.round(s.heures))} h</td><td>${nf0.format(Math.round(s.km))}</td><td>${eur(s.total)}${s.fixe ? `<small>dont ${eur(s.fixe)} fixes</small>` : ""}</td><td class="${g < -0.5 ? "gain" : g > 0.5 ? "loss" : ""}">${k === 0 ? "—" : (g <= 0 ? "−" : "+") + eur(Math.abs(g))}</td></tr>`; }).join("")}</tbody></table>`;
}
function renderScenarios(recompute = true){
  const res = recompute || !V.SC ? scCompute() : V.SC, sp = res.sp;
  const L0 = $("#list");
  const inp = (k, label, step, min) => `<label>${label}<input type="number" data-sp="${k}" value="${sp[k]}" step="${step}" min="${min}"></label>`;
  const freed = res.freed;
  const steps = res.steps;
  L0.innerHTML = `<li class="vsum">
    <details class="scp"${C.open ? "" : " open"}><summary>Paramètres de coût${C.open ? " (repris de votre espace)" : ""}</summary><div class="vgrid">
      ${inp("coutKm", "Coût par km (€)", "0.01", "0")}${inp("coutHeure", "Coût horaire en trajet (€)", "1", "0")}${inp("visitesMois", "Visites / établissement / mois", "0.5", "0")}
      ${inp("coutFixePraticien", "Coût fixe / praticien / mois (€)", "10", "0")}${inp("chargeMax", "Établissements max / praticien", "1", "1")}${inp("tempsMax", "Trajet max accepté (min)", "5", "5")}
      <label>Aller et retour<input type="checkbox" data-sp="allerRetour"${sp.allerRetour ? " checked" : ""}></label></div>
      ${C.open ? "" : `<p class="hint">Ouvrez votre espace client pour garder ces paramètres.</p>`}</details>
    ${scRowsHTML(res)}
    <h4 style="margin:16px 0 6px">Moins de praticiens</h4>
    ${steps.length ? `<p>Avec au plus <b>${Math.round(sp.chargeMax)} établissements</b> et <b>${sp.tempsMax} min</b> de trajet par praticien, jusqu'à <b>${steps.length} praticiens</b> peuvent être libérés. ${res.rec ? `${sp.coutFixePraticien > 0 ? `Libérer les <b>${res.rec} premiers</b> fait économiser de l'argent : leur coût fixe dépasse le surcoût de trajets qu'entraîne leur départ.` : `Les <b>${res.rec} premiers</b> ne changent presque rien aux trajets (au plus 10 min aller en plus au total pour chacun). Renseignez le coût fixe d'un praticien pour chiffrer l'économie.`}` : "Chaque libération allonge nettement les trajets."}</p>
      <label class="slide">Praticiens libérés : <b id="scKv">${V.scK}</b><input type="range" id="scK" min="0" max="${steps.length}" value="${V.scK}"></label>
      <ol class="mini freed">${freed.map((s, k) => `<li><span class="rk" style="background:${VCOL.nv}">${k + 1}</span><span><b>${esc(s.doc.label)}</b> <small>${esc(place(s.doc.pt))}</small><br>${s.moves.map(m => `${esc(m.r.eLabel)} → ${esc(m.to.label)} (${dur(m.from)} → ${dur(m.t)})`).join("<br>")}</span><span>${s.dtAller >= 0 ? "+" : "−"}${dur(Math.abs(s.dtAller))}<br><small>${s.delta >= 0 ? "+" : "−"}${eur(Math.abs(s.delta))} / mois</small></span></li>`).join("")}</ol>`
    : `<p class="hint">Aucun praticien ne peut être libéré sans dépasser la charge ou le trajet maximal. Augmentez le nombre d'établissements par praticien ou le trajet accepté.</p>`}
    <p class="hint">Coûts estimés : ${nf1.format(sp.visitesMois)} visites par mois, ${sp.allerRetour ? "aller et retour" : "aller seul"}, ${nf1.format(sp.coutKm)} € du km, ${nf0.format(sp.coutHeure)} € de l'heure de trajet${sp.coutFixePraticien ? `, ${eur(sp.coutFixePraticien)} de coût fixe par praticien` : ""}. L'ordre de libération est calculé praticien par praticien, puis la répartition finale est optimisée.</p>
  </li>`;
}
function renderScenariosKeep(recompute){
  const pb = $("#pbody"), top = pb.scrollTop, open = !!($(".scp") && $(".scp").open);
  renderScenarios(recompute);
  pb.scrollTop = top; if ($(".scp")) $(".scp").open = open;
}
$("#list").addEventListener("input", e => {
  if (S.mode !== "verif" || V.tab !== "scen" || e.target.id !== "scK") return;
  $("#scKv").textContent = e.target.value;
});
$("#list").addEventListener("change", e => {
  if (S.mode !== "verif" || V.tab !== "scen") return;
  if (e.target.id === "scK"){ scPick(+e.target.value); renderScenariosKeep(false); drawMap(false); const r = $("#scK"); if (r) r.focus(); return; }
  const k = e.target.dataset && e.target.dataset.sp; if (!k) return;
  const sp = spGet();
  sp[k] = e.target.type === "checkbox" ? e.target.checked : Math.max(0, parseFloat(e.target.value) || 0);
  if (k === "chargeMax") sp[k] = Math.max(1, Math.round(sp[k]));
  if (C.open) saveVault();
  V.scK = null; renderScenariosKeep(true); drawMap(false);
});
function drawScenarioMap(){
  const res = V.SC; if (!res) return false;
  const freedIds = new Set(res.freed.map(s => s.doc.id));
  const asg = res.fewer.asg;
  const line = (a, b, o) => L.polyline([[a.lat, a.lon], [b.lat, b.lon]], {interactive:false, ...o}).addTo(layerPts);
  for (const r of V.rows){ const d = asg.get(r.i); if (!d || !r.ePt) continue; const moved = freedIds.has(r.dId); line(d.pt, r.ePt, {color:moved ? VCOL.prop : "#8e8e93", weight:moved ? 3 : 1.2, opacity:moved ? .95 : .35}); if (moved) line(r.dPt, r.ePt, {color:VCOL.bad, weight:1.5, opacity:.6, dashArray:"4 5"}); }
  for (const r of V.rows){ if (!r.ePt) continue; L.circleMarker([r.ePt.lat, r.ePt.lon], {radius:4.5, color:"#fff", weight:1.5, fillColor:VCOL.etab, fillOpacity:1}).bindTooltip(esc(r.eLabel)).addTo(layerPts); }
  for (const d of V.docs){ if (!d.pt) continue; const fr = freedIds.has(d.id);
    L.circleMarker([d.pt.lat, d.pt.lon], {radius:fr ? 8 : 6, color:fr ? VCOL.bad : "#fff", weight:fr ? 3 : 2, fillColor:fr ? "#8e8e93" : VCOL.doc, fillOpacity:fr ? .6 : 1})
      .bindTooltip(`${esc(d.label)}${fr ? " · libéré dans ce scénario" : ""}`).addTo(layerPts); }
  return true;
}

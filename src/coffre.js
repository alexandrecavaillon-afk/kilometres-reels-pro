
/* =====================================================================
   Coffre chiffré de l'espace client
   - Chiffrement AES-GCM 256 dans le navigateur (WebCrypto).
   - Clé de données aléatoire, protégée par le mot de passe (PBKDF2-SHA256,
     600 000 itérations) et par une clé de secours donnée une seule fois.
   - Stockage : IndexedDB de ce navigateur ; synchronisation en ligne
     facultative (Supabase) où seul le coffre chiffré est envoyé.
   ===================================================================== */
const TXT = new TextEncoder(), UNTXT = new TextDecoder();
const b64e = u8 => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const rnd = n => crypto.getRandomValues(new Uint8Array(n));
const hex = u8 => Array.from(u8, b => b.toString(16).padStart(2, "0")).join("");
async function sha256(t){ return new Uint8Array(await crypto.subtle.digest("SHA-256", TXT.encode(t))); }
const normId = id => id.trim().toLowerCase().normalize("NFC");
async function pbkdf(secret, salt, iter){
  const base = await crypto.subtle.importKey("raw", TXT.encode(secret.normalize("NFC")), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2", salt, iterations:iter, hash:"SHA-256"}, base, 512));
}
const aes = raw => crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
async function sealBytes(keyRaw, bytes){ const iv = rnd(12); return {iv:b64e(iv), ct:b64e(new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM", iv}, await aes(keyRaw), bytes)))}; }
async function openBytes(keyRaw, box){ return new Uint8Array(await crypto.subtle.decrypt({name:"AES-GCM", iv:b64d(box.iv)}, await aes(keyRaw), b64d(box.ct))); }
const ITER = 600000;
const B32 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function recoveryCode(){ const b = rnd(20); let s = ""; for (const x of b) s += B32[x % 32]; return s.match(/.{4}/g).join("-"); }
const cleanRecovery = s => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/* Coffre ouvert en mémoire (disparaît au rafraîchissement) */
const C = {open:false, idHash:"", ident:"", dek:null, env:null, data:null, online:null, saveTimer:0, idleTimer:0};
function blankData(ident){
  const now = new Date().toISOString();
  return {version:1, ident, cree:now, maj:now,
    profil:{entreprise:"", secteur:"", description:"", objectifs:""},
    params:{coutKm:0.6, coutHeure:60, visitesMois:4, allerRetour:true, coutFixePraticien:0, chargeMax:3, tempsMax:90},
    docs:[], analyses:[], ia:{fournisseur:"anthropic", modele:"", cle:""}};
}

/* ---------- Stockage local (IndexedDB) ---------- */
function idb(){
  return new Promise((ok, ko) => {
    let r; try { r = indexedDB.open("kr-coffres", 1); } catch (e){ ko(e); return; }
    r.onupgradeneeded = () => r.result.createObjectStore("coffres", {keyPath:"idHash"});
    r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
  });
}
async function idbGet(k){ const db = await idb(); return new Promise((ok, ko) => { const q = db.transaction("coffres").objectStore("coffres").get(k); q.onsuccess = () => ok(q.result || null); q.onerror = () => ko(q.error); }); }
async function idbPut(v){ const db = await idb(); return new Promise((ok, ko) => { const t = db.transaction("coffres", "readwrite"); t.objectStore("coffres").put(v); t.oncomplete = () => ok(); t.onerror = () => ko(t.error); }); }
async function idbDel(k){ const db = await idb(); return new Promise((ok, ko) => { const t = db.transaction("coffres", "readwrite"); t.objectStore("coffres").delete(k); t.oncomplete = () => ok(); t.onerror = () => ko(t.error); }); }

/* ---------- Création, ouverture, sauvegarde ---------- */
async function derive(ident, password){
  const id = normId(ident);
  const idHash = hex(await sha256("kr-id|" + id));
  const salt = (await sha256("kr-sel|" + id)).slice(0, 16);
  const bits = await pbkdf(password, salt, ITER);
  return {idHash, kek:bits.slice(0, 32), auth:hex(bits.slice(32, 64))};
}
async function createVault(ident, password){
  const d = await derive(ident, password);
  if (await idbGet(d.idHash).catch(() => null)) throw new Error("un espace existe déjà avec cet identifiant sur ce navigateur");
  const dek = rnd(32), rec = recoveryCode(), rsalt = rnd(16);
  const recKek = (await pbkdf(cleanRecovery(rec), rsalt, 200000)).slice(0, 32);
  const data = blankData(ident.trim());
  const env = {v:1, idHash:d.idHash, iter:ITER, wrapPwd:await sealBytes(d.kek, dek), rsalt:b64e(rsalt), wrapRec:await sealBytes(recKek, dek),
    data:await sealBytes(dek, TXT.encode(JSON.stringify(data))), maj:data.maj};
  await idbPut(env);
  Object.assign(C, {open:true, idHash:d.idHash, ident:ident.trim(), dek, env, data, auth:d.auth});
  armIdle();
  return rec;
}
async function unlockWith(env, kekOrNull, dekDirect){
  const dek = dekDirect || await openBytes(kekOrNull, env.wrapPwd);
  const data = JSON.parse(UNTXT.decode(await openBytes(dek, env.data)));
  return {dek, data};
}
async function openVault(ident, password){
  const d = await derive(ident, password);
  let env = await idbGet(d.idHash).catch(() => null);
  if (!env && CFG.online){ env = await cloudPull(ident, d.auth); if (env) await idbPut(env); }
  if (!env) throw new Error("aucun espace avec cet identifiant sur ce navigateur" + (CFG.online ? " ni en ligne" : ". Importez votre fichier de coffre si vous l'avez créé ailleurs"));
  let r;
  try { r = await unlockWith(env, d.kek); } catch (e){ throw new Error("mot de passe incorrect"); }
  Object.assign(C, {open:true, idHash:d.idHash, ident:r.data.ident || ident.trim(), dek:r.dek, env, data:r.data, auth:d.auth});
  if (CFG.online) cloudSync().catch(() => {});
  armIdle();
}
async function recoverVault(ident, rec, newPassword){
  const d = await derive(ident, newPassword);
  const oldHash = hex(await sha256("kr-id|" + normId(ident)));
  const env = await idbGet(oldHash).catch(() => null);
  if (!env) throw new Error("aucun espace avec cet identifiant sur ce navigateur");
  let dek;
  try { dek = await openBytes((await pbkdf(cleanRecovery(rec), b64d(env.rsalt), 200000)).slice(0, 32), env.wrapRec); }
  catch (e){ throw new Error("clé de secours incorrecte"); }
  env.wrapPwd = await sealBytes(d.kek, dek);
  await idbPut(env);
  const r = await unlockWith(env, null, dek);
  Object.assign(C, {open:true, idHash:d.idHash, ident:r.data.ident, dek, env, data:r.data, auth:d.auth});
  armIdle();
}
async function changePassword(oldPwd, newPwd){
  const d0 = await derive(C.ident, oldPwd);
  try { await openBytes(d0.kek, C.env.wrapPwd); } catch (e){ throw new Error("mot de passe actuel incorrect"); }
  const d = await derive(C.ident, newPwd);
  C.env.wrapPwd = await sealBytes(d.kek, C.dek); C.auth = d.auth;
  await saveVault(true);
  if (CFG.online && C.online) await cloudChangePassword(d.auth).catch(() => {});
}
async function saveVault(now){
  if (!C.open) return;
  clearTimeout(C.saveTimer);
  const go = async () => {
    C.data.maj = new Date().toISOString();
    C.env.data = await sealBytes(C.dek, TXT.encode(JSON.stringify(C.data)));
    C.env.maj = C.data.maj;
    await idbPut(C.env);
    if (CFG.online && C.online) cloudPush().catch(e => espaceMsg("Synchronisation impossible : " + e.message));
    espaceSaved();
  };
  if (now) return go();
  C.saveTimer = setTimeout(go, 600);
}
function lockVault(){
  clearTimeout(C.saveTimer); clearTimeout(C.idleTimer);
  Object.assign(C, {open:false, idHash:"", ident:"", dek:null, env:null, data:null, online:null, auth:""});
  espaceUI();
}
async function deleteVault(){
  const h = C.idHash;
  if (CFG.online && C.online) await cloudDelete().catch(() => {});
  await idbDel(h);
  lockVault();
}
function armIdle(){
  const reset = () => { clearTimeout(C.idleTimer); C.idleTimer = setTimeout(() => { if (C.open){ lockVault(); homeMsg("Votre espace a été verrouillé après 30 minutes d'inactivité."); } }, 30 * 60 * 1000); };
  if (!armIdle.bound){ ["pointerdown", "keydown"].forEach(ev => document.addEventListener(ev, () => { if (C.open) reset(); }, {passive:true})); armIdle.bound = true; }
  reset();
}
/* Fichier de coffre (reste chiffré) */
function exportVaultFile(){
  const blob = new Blob([JSON.stringify({type:"kilometres-reels-coffre", ...C.env})], {type:"application/octet-stream"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = "espace-" + new Date().toISOString().slice(0, 10) + ".krcoffre";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
async function importVaultFile(file, ident, password){
  let env;
  try { env = JSON.parse(await file.text()); } catch (e){ throw new Error("ce fichier n'est pas un coffre"); }
  if (env.type !== "kilometres-reels-coffre" || !env.wrapPwd) throw new Error("ce fichier n'est pas un coffre");
  delete env.type;
  const d = await derive(ident, password);
  if (env.idHash !== d.idHash) throw new Error("identifiant différent de celui du coffre");
  let r;
  try { r = await unlockWith(env, d.kek); } catch (e){ throw new Error("mot de passe incorrect"); }
  await idbPut(env);
  Object.assign(C, {open:true, idHash:d.idHash, ident:r.data.ident, dek:r.dek, env, data:r.data, auth:d.auth});
  armIdle();
}

/* ---------- Synchronisation en ligne facultative (Supabase) ----------
   Le serveur ne reçoit que : l'adresse e-mail, un mot de passe dérivé
   (différent du vôtre, qui ne quitte jamais le navigateur) et le coffre chiffré. */
const CFG = {online:false, url:"", key:""};
async function loadConfig(){
  try {
    const c = await fetchJSON("config.json", 1, {cache:"no-store"});
    if (c && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(c.supabaseUrl || "") && c.supabaseAnonKey){ CFG.online = true; CFG.url = c.supabaseUrl; CFG.key = c.supabaseAnonKey; }
  } catch (e){ /* pas de synchronisation en ligne */ }
}
async function sb(path, opts = {}, token){
  const res = await fetch(CFG.url + path, {...opts, credentials:"omit", cache:"no-store",
    headers:{apikey:CFG.key, "Content-Type":"application/json", ...(token ? {Authorization:"Bearer " + token} : {}), ...(opts.headers || {})}});
  const t = await res.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e){ /* texte */ }
  if (!res.ok) throw new Error((j && (j.msg || j.message || j.error_description || j.error)) || "erreur " + res.status);
  return j;
}
const jwtSub = t => { try { return JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub; } catch (e){ return ""; } };
async function cloudLogin(email, auth){
  const r = await sb("/auth/v1/token?grant_type=password", {method:"POST", body:JSON.stringify({email, password:auth})});
  return {token:r.access_token, uid:jwtSub(r.access_token), exp:Date.now() + (r.expires_in || 3600) * 1000 - 60000};
}
async function cloudSignup(email, auth){
  const r = await sb("/auth/v1/signup", {method:"POST", body:JSON.stringify({email, password:auth})});
  if (!r || !r.access_token) return null; // confirmation par e-mail demandée
  return {token:r.access_token, uid:jwtSub(r.access_token), exp:Date.now() + (r.expires_in || 3600) * 1000 - 60000};
}
async function cloudSession(){
  if (C.online && C.online.exp > Date.now()) return C.online;
  C.online = await cloudLogin(C.ident, C.auth);
  return C.online;
}
async function cloudPull(email, auth){
  const s = await cloudLogin(email, auth).catch(() => null);
  if (!s) return null;
  C.online = s;
  const r = await sb("/rest/v1/coffres?select=enveloppe&limit=1", {}, s.token);
  return r && r[0] ? r[0].enveloppe : null;
}
async function cloudPush(){
  const s = await cloudSession();
  await sb("/rest/v1/coffres?on_conflict=user_id", {method:"POST", headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
    body:JSON.stringify({user_id:s.uid, enveloppe:C.env, maj:C.env.maj})}, s.token);
}
async function cloudSync(){
  const s = await cloudSession();
  const r = await sb("/rest/v1/coffres?select=enveloppe&limit=1", {}, s.token);
  const remote = r && r[0] ? r[0].enveloppe : null;
  if (remote && remote.maj > C.env.maj){
    const x = await unlockWith(remote, null, C.dek);
    C.env = remote; C.data = x.data; await idbPut(remote); espaceUI();
  } else await cloudPush();
}
async function cloudEnable(){
  if (!CFG.online) throw new Error("synchronisation non configurée");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(C.ident)) throw new Error("l'identifiant doit être une adresse e-mail pour la synchronisation en ligne");
  let s = await cloudLogin(C.ident, C.auth).catch(() => null);
  if (!s){ s = await cloudSignup(C.ident, C.auth); if (!s) throw new Error("un e-mail de confirmation vient d'être envoyé : confirmez-le puis réactivez la synchronisation"); }
  C.online = s; C.data.synchro = true; await cloudPush(); await saveVault(true);
}
async function cloudChangePassword(auth){ const s = await cloudSession(); await sb("/auth/v1/user", {method:"PUT", body:JSON.stringify({password:auth})}, s.token); }
async function cloudDelete(){ const s = await cloudSession(); await sb("/rest/v1/coffres?user_id=eq." + s.uid, {method:"DELETE"}, s.token); }

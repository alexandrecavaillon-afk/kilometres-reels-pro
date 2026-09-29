#!/usr/bin/env python3
"""Construit la base des établissements du site à partir de deux sources ouvertes.

1. FINESS (ministère de la Santé, data.gouv.fr) pour la France, outre-mer compris.
2. OpenStreetMap (API Overpass) pour les pays frontaliers, à moins de BANDE_KM
   de la frontière française.

Sortie : data/categories.json (la liste des types) et data/c/<type>.json
(un fichier par type, chargé seulement quand on clique sur sa carte).

Usage : python build/construire_base.py [--finess fichier.csv] [--sans-etranger]
"""
import argparse, csv, io, json, math, os, re, sys, time, unicodedata
import urllib.parse, urllib.request
from datetime import date

from pyproj import Transformer
from shapely.geometry import Point, shape
from shapely.ops import transform as shp_transform

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SORTIE = os.path.join(RACINE, "data")
BANDE_KM = 60
UA = "kilometres-reels-pro/1.0 (+https://github.com/alexandrecavaillon-afk/kilometres-reels-pro)"

# ---------------------------------------------------------------------------
# Types d'établissements affichés sur le site. Codes = catégories FINESS.
# osm = équivalents OpenStreetMap pour les pays frontaliers.
# ---------------------------------------------------------------------------
FAMILLES = [
    {"id": "pa", "label": "Personnes âgées", "cats": [
        {"id": "ehpad", "label": "EHPAD", "desc": "Hébergement médicalisé pour personnes âgées dépendantes", "codes": ["500"], "osm": ["retraite"]},
        {"id": "usld", "label": "Soins de longue durée", "desc": "Unités de soins de longue durée (USLD)", "codes": ["362"]},
        {"id": "residence", "label": "Résidences autonomie", "desc": "Résidences autonomie et EHPA non médicalisés", "codes": ["202", "501", "502"]},
        {"id": "accueil_jour", "label": "Accueil de jour", "desc": "Centres de jour pour personnes âgées", "codes": ["207"]},
        {"id": "ssiad", "label": "Soins infirmiers à domicile", "desc": "SSIAD et services autonomie aide et soins", "codes": ["354", "209"]},
        {"id": "saad", "label": "Aide à domicile", "desc": "Services d'aide et d'accompagnement à domicile", "codes": ["460", "640", "208", "450", "368"]},
    ]},
    {"id": "hop", "label": "Hôpitaux et cliniques", "cats": [
        {"id": "chu", "label": "CHU et CHR", "desc": "Centres hospitaliers universitaires et régionaux", "codes": ["101"]},
        {"id": "ch", "label": "Centres hospitaliers", "desc": "Hôpitaux publics, ex-hôpitaux locaux, hôpitaux des armées", "codes": ["355", "106", "114"], "osm": ["hopital"]},
        {"id": "clinique", "label": "Cliniques", "desc": "Établissements de soins de courte durée, médecine et chirurgie", "codes": ["365", "128", "129", "122"], "osm": ["clinique"]},
        {"id": "smr", "label": "Soins de suite et réadaptation", "desc": "Établissements autorisés en SMR (ex-SSR)", "codes": ["109"]},
        {"id": "psy", "label": "Psychiatrie", "desc": "Hôpitaux psychiatriques, CMP, CATTP, postcure", "codes": ["292", "161", "156", "425", "430"]},
        {"id": "had", "label": "Hospitalisation à domicile", "desc": "Structures d'HAD", "codes": ["127"]},
        {"id": "dialyse", "label": "Dialyse", "desc": "Centres de dialyse et unités d'autodialyse", "codes": ["141", "146"]},
        {"id": "cancer", "label": "Centres contre le cancer", "desc": "Centres de lutte contre le cancer (CLCC)", "codes": ["131"]},
    ]},
    {"id": "ville", "label": "Soins de ville", "cats": [
        {"id": "centre_sante", "label": "Centres de santé", "desc": "Centres de santé médicaux, dentaires, infirmiers", "codes": ["124"], "osm": ["centre"]},
        {"id": "msp", "label": "Maisons de santé", "desc": "Maisons de santé pluriprofessionnelles", "codes": ["603"]},
        {"id": "labo", "label": "Laboratoires", "desc": "Laboratoires de biologie médicale", "codes": ["611", "612", "610"], "osm": ["labo"]},
        {"id": "snp", "label": "Soins non programmés", "desc": "Lieux de soins sans rendez-vous", "codes": ["617"]},
    ]},
]
CODE_VERS_CAT = {code: c["id"] for f in FAMILLES for c in f["cats"] for code in c["codes"]}
OSM_VERS_CAT = {o: c["id"] for f in FAMILLES for c in f["cats"] for o in c.get("osm", [])}

PAYS = {  # code ISO : (nom, boîte englobante sud, ouest, nord, est couvrant la bande frontalière)
    "BE": ("Belgique", 49.45, 2.5, 51.4, 6.45),
    "LU": ("Luxembourg", 49.4, 5.7, 50.2, 6.6),
    "DE": ("Allemagne", 47.5, 6.0, 50.0, 9.0),
    "CH": ("Suisse", 45.8, 5.9, 47.9, 8.4),
    "IT": ("Italie", 43.7, 6.6, 46.3, 8.4),
    "MC": ("Monaco", 43.72, 7.4, 43.76, 7.44),
    "AD": ("Andorre", 42.42, 1.4, 42.66, 1.8),
    "ES": ("Espagne", 41.9, -2.5, 43.45, 3.4),
}

# ---------------------------------------------------------------------------
# Mise en forme des textes FINESS (écrits en majuscules)
# ---------------------------------------------------------------------------
SIGLES = set("""EHPAD EHPA USLD SSIAD SAAD SAAS SAA SPASAD SSR SMR HAD CMP CATTP CHU CHR CH CHS CHI CHG CHD CHRU CHT CLCC CCAS CIAS
ADMR ADPEP APF APAJH UGECAM MGEN MSA CPAM CARSAT AP-HP APHP APHM HCL GCS GHT GHU GIP SAS SARL SA SASU SCI SCM SEL SELARL SELAS EURL
UDAF ARS MSP CDS IME ESAT FAM MAS PMI CSAPA CAARUD CRF CRRF USSR UMR IRM PASA UHR UCC UVP ASSAD ACPPA MFR UNA ADAR ASP ASAD
II III IV VI VII VIII IX XI XII XIII XIV XV XVI XVII XVIII XIX XX LNA ADEF AFPA CRP CDPA SSIAD AAPEI UNAPEI APEI""".split())
ACCENTS = {w.split("=")[0]: w.split("=")[1] for w in """HOPITAL=hôpital HOPITAUX=hôpitaux PRIVE=privé PRIVEE=privée PRIVES=privés RESIDENCE=résidence RESIDENCES=résidences
SANTE=santé MEDICAL=médical MEDICALE=médicale MEDICAUX=médicaux MEDICALISE=médicalisé MEDICALISEE=médicalisée MEDICO=médico MEDECINE=médecine
SPECIALISE=spécialisé SPECIALISEE=spécialisée AGEES=âgées AGEE=âgée AGES=âgés AGE=âge ETABLISSEMENT=établissement ETABLISSEMENTS=établissements
GERIATRIQUE=gériatrique GERIATRIE=gériatrie GERONTOLOGIQUE=gérontologique GERONTOLOGIE=gérontologie READAPTATION=réadaptation REEDUCATION=rééducation
MATERNITE=maternité PEDIATRIQUE=pédiatrique PEDIATRIE=pédiatrie PERINATALITE=périnatalité THERAPEUTIQUE=thérapeutique PSYCHOTHERAPIQUE=psychothérapique
DEPARTEMENTAL=départemental DEPARTEMENTALE=départementale SECURITE=sécurité SOCIETE=société MUTUALITE=mutualité FRANCAISE=française FRANCAIS=français
SOLIDARITE=solidarité SEJOUR=séjour ORTHOPEDIQUE=orthopédique ETUDES=études CITE=cité AMITIE=amitié SERENITE=sérénité VALLEE=vallée ETANG=étang
PRE=pré DELEGATION=délégation UNITE=unité UNITES=unités EQUIPE=équipe EQUIPES=équipes GENERAL=général GENERALE=générale PERE=père MERE=mère
RIVIERE=rivière BRUYERES=bruyères LUMIERE=lumière CLAIRIERE=clairière PLEIADES=pléiades ESPERANCE=espérance PRIEURE=prieuré CHATEAU=château
CHENES=chênes ERABLES=érables MELEZES=mélèzes GENETS=genêts ECUREUILS=écureuils REPUBLIQUE=république LIBERATION=libération ECOLE=école
EGLISE=église MARECHAL=maréchal PRESIDENT=président ETATS=états ELYSEES=élysées RESISTANCE=résistance ANDRE=andré RENE=rené LEON=léon
LEOPOLD=léopold EUGENE=eugène GERARD=gérard FREDERIC=frédéric ETIENNE=étienne JEROME=jérôme THEODORE=théodore HELENE=hélène GENEVIEVE=geneviève
DOCTEUR=docteur ELISABETH=élisabeth ZEPHYR=zéphyr ACCUEIL=accueil ALZHEIMER=alzheimer DIALYSE=dialyse REGIONAL=régional REGIONALE=régionale
REGION=région CENTRE=centre INTERCOMMUNAL=intercommunal POLE=pôle PSYCHIATRIQUE=psychiatrique SENIORS=seniors AINES=aînés FEDERATION=fédération
ASSOCIATION=association GESTION=gestion ENERGIE=énergie EPINETTES=épinettes PEPINIERE=pépinière MEDITERRANEE=méditerranée ILE=île ILES=îles
FORET=forêt FONTAINE=fontaine NOEL=noël FETE=fête BEATRICE=béatrice CELESTE=céleste EMERAUDE=émeraude LEGION=légion""".split()}
ARTICLES = {"le", "la", "les", "l"}
APRES_PREP = {"de", "d", "du", "des", "à", "a", "au", "aux", "sur", "sous", "en", "lès", "les", "pour", "par", "dans", "et"}
MINUSCULES = {"de", "du", "des", "la", "le", "les", "et", "en", "sur", "sous", "aux", "au", "à", "a", "l", "d", "par", "pour", "dans", "lès", "les", "ès"}
VOIES = {"R": "rue", "RUE": "rue", "AV": "avenue", "BD": "boulevard", "RTE": "route", "CHE": "chemin", "CHEM": "chemin", "PL": "place",
         "ALL": "allée", "IMP": "impasse", "QU": "quai", "QUAI": "quai", "SQ": "square", "CRS": "cours", "FG": "faubourg", "LD": "lieu-dit",
         "PROM": "promenade", "PRO": "promenade", "RPT": "rond-point", "SEN": "sentier", "PAS": "passage", "CITE": "cité", "RES": "résidence",
         "MTE": "montée", "HAM": "hameau", "VOIE": "voie", "ESP": "esplanade", "PARC": "parc", "PKG": "parking", "TRA": "traverse",
         "CHS": "chaussée", "PONT": "pont", "PT": "pont", "PORT": "port", "DOM": "domaine", "LOT": "lotissement", "CAR": "carrefour",
         "VC": "voie communale", "CD": "chemin départemental", "RD": "route départementale", "RN": "route nationale", "ZA": "ZA", "ZI": "ZI",
         "ZAC": "ZAC", "QUA": "quartier", "QRT": "quartier", "CLOS": "clos", "COR": "corniche", "VLA": "villa", "VLGE": "village",
         "GR": "grande rue", "GRDE": "grande rue", "MAIL": "mail", "ROC": "rocade", "RLE": "ruelle", "TSSE": "terrasse", "ECA": "écart"}


def casse(texte, debut_minuscule=False):
    """Met en casse de titre à la française, en gardant les sigles et en remettant les accents courants."""
    if not texte:
        return ""
    mots = re.split(r"(\s+|-|'|’|/|\(|\))", re.sub(r"\s+", " ", texte.strip()))
    out, premier, prec = [], not debut_minuscule, ("de" if debut_minuscule else "")
    for m in mots:
        if not m or re.fullmatch(r"\s+|-|'|’|/|\(|\)", m):
            out.append(m)
            continue
        base = m.upper()
        if base.count(".") >= 2 and re.fullmatch(r"(?:[A-Z]\.)+[A-Z]?\.?", base):
            out.append(base.replace(".", ""))
        elif base in ("ST", "STE", "STS"):
            out.append({"ST": "Saint", "STE": "Sainte", "STS": "Saints"}[base])
        elif base in SIGLES or (2 <= len(base) <= 4 and not re.search(r"[AEIOUYÉÈÊÀÂÔÎÛ]", base) and base.isalpha()):
            out.append(base)
        elif not premier and m.lower() in ARTICLES and prec not in APRES_PREP:
            out.append(m[:1].upper() + m[1:].lower())
        elif not premier and m.lower() in MINUSCULES:
            out.append("à" if m.lower() == "a" else m.lower())
        elif base in ACCENTS:
            a = ACCENTS[base]
            out.append(a[:1].upper() + a[1:])
        elif re.fullmatch(r"\d+[A-Z]*", base):
            out.append(base)
        else:
            out.append(m[:1].upper() + m[1:].lower())
        premier = False
        prec = m.lower()
    s = "".join(out)
    s = re.sub(r"^([ld])'", lambda x: x.group(1).upper() + "'", s)
    return s


def telephone(t):
    t = re.sub(r"\D", "", t or "")
    return " ".join(t[i:i + 2] for i in range(0, 10, 2)) if len(t) == 10 else t


def adresse_finess(f):
    num, typ, voie, comp, lieu = f[7].strip(), f[8].strip(), f[9].strip(), f[10].strip(), f[11].strip()
    typ_l = VOIES.get(typ.upper(), typ.lower())
    ligne = " ".join(x for x in [num + (comp.lower() if len(comp) <= 3 else ""), typ_l, casse(voie, debut_minuscule=bool(typ_l))] if x)
    if lieu and not re.match(r"^(BP|CS|TSA)\s*\d", lieu, re.I):
        ligne = (ligne + ", " if ligne else "") + casse(lieu)
    acheminement = f[15].strip()
    m = re.match(r"^(\d{5})\s+(.*)$", acheminement)
    dep, com = f[13].strip(), f[12].strip()
    insee = ("97" + com if dep.startswith("9") and not dep.isdigit() else dep + com) if dep and com else ""
    nom_officiel = COMMUNES.get(insee)
    if m:
        ville = m.group(1) + " " + (nom_officiel or casse(re.sub(r"\s+CEDEX.*$", "", m.group(2))))
    else:
        ville = nom_officiel or casse(acheminement)
    return ligne, ville


COMMUNES = {}


def charger_communes():
    """Noms officiels des communes, avec accents (API Découpage administratif)."""
    try:
        for c in json.loads(telecharger("https://geo.api.gouv.fr/communes?fields=nom,code&format=json", tentatives=2, timeout=120)):
            COMMUNES[c["code"]] = c["nom"]
        print(f"{len(COMMUNES)} noms de communes chargés")
    except RuntimeError:
        print("Noms de communes indisponibles : ceux de FINESS seront utilisés", file=sys.stderr)


# ---------------------------------------------------------------------------
# FINESS
# ---------------------------------------------------------------------------
def telecharger(url, dest=None, data=None, tentatives=4, timeout=600):
    for a in range(tentatives):
        try:
            req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                contenu = r.read()
            if dest:
                open(dest, "wb").write(contenu)
            return contenu
        except Exception as e:  # noqa: BLE001
            print(f"  échec {a + 1}/{tentatives} pour {url[:80]} : {e}", file=sys.stderr)
            time.sleep(20 * (a + 1))
    raise RuntimeError("téléchargement impossible : " + url)


def url_finess():
    api = "https://www.data.gouv.fr/api/1/datasets/finess-extraction-du-fichier-des-etablissements/"
    d = json.loads(telecharger(api))
    for r in d["resources"]:
        if "cs1100507" in r["url"] and r["url"].endswith(".csv"):
            return r["url"], r.get("last_modified", "")[:10]
    raise RuntimeError("fichier FINESS géolocalisé introuvable sur data.gouv.fr")


TRANSFO = {}


def vers_wgs84(x, y, source):
    m = re.search(r"EPSG:(\d+)", source)
    if m:
        epsg = int(m.group(1))
    else:
        m = re.search(r"UTM zone (\d+)([NS])", source)
        if not m:
            return None
        epsg = (32600 if m.group(2) == "N" else 32700) + int(m.group(1))
    if epsg not in TRANSFO:
        TRANSFO[epsg] = Transformer.from_crs(epsg, 4326, always_xy=True)
    lon, lat = TRANSFO[epsg].transform(x, y)
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None
    return round(lat, 5), round(lon, 5)


def lire_finess(texte):
    etabs, geo = {}, {}
    for f in csv.reader(io.StringIO(texte), delimiter=";", quoting=csv.QUOTE_NONE):
        if not f:
            continue
        if f[0] == "structureet" and len(f) > 21:
            cat = CODE_VERS_CAT.get(f[18].strip())
            if cat:
                etabs[f[1]] = (cat, f)
        elif f[0] == "geolocalisation" and len(f) > 4:
            try:
                geo[f[1]] = (float(f[2]), float(f[3]), f[4])
            except ValueError:
                pass
    lignes = {}
    sans_coord = 0
    for nofiness, (cat, f) in etabs.items():
        g = geo.get(nofiness)
        pos = vers_wgs84(*g) if g else None
        if not pos:
            sans_coord += 1
            continue
        nom = casse(f[4].strip() or f[3].strip())
        ligne, ville = adresse_finess(f)
        lignes.setdefault(cat, []).append([nom, ligne, ville, pos[0], pos[1], telephone(f[16]), nofiness, "", f[19].strip()])
    print(f"FINESS : {sum(len(v) for v in lignes.values())} établissements retenus, {sans_coord} sans coordonnées ignorés")
    return lignes


# ---------------------------------------------------------------------------
# Pays frontaliers (OpenStreetMap)
# ---------------------------------------------------------------------------
def type_osm(t):
    a, h, s = t.get("amenity", ""), t.get("healthcare", ""), t.get("social_facility", "")
    pour = t.get("social_facility:for", "")
    if a == "hospital" or h == "hospital":
        return "hopital"
    if a == "nursing_home" or h == "nursing_home" or (s in ("nursing_home", "assisted_living") and (not pour or "senior" in pour)):
        return "retraite"
    if h == "laboratory" or a == "laboratory":
        return "labo"
    if a == "clinic" or h == "clinic":
        return "clinique"
    if h == "centre" or a == "health_centre":
        return "centre"
    return None


LIBELLES_OSM = {"hopital": "Hôpital", "retraite": "Maison de retraite", "labo": "Laboratoire", "clinique": "Clinique", "centre": "Centre médical"}


def frontiere_france():
    geo = json.loads(telecharger("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson"))
    fr = next(f for f in geo["features"] if f["properties"]["ADM0_A3"] == "FRA")
    proj = Transformer.from_crs(4326, 3035, always_xy=True).transform
    # On ne garde que la métropole et la Corse pour la distance à la frontière
    formes = [p for p in shape(fr["geometry"]).geoms if p.bounds[0] > -6 and p.bounds[1] > 40]
    from shapely.geometry import MultiPolygon
    return shp_transform(proj, MultiPolygon(formes)), proj


SERVEURS_OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter",
                     "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]


def lire_etranger():
    france, proj = frontiere_france()
    lignes, vus = {}, set()
    for iso, (nom_pays, s, o, n, e) in PAYS.items():
        q = f"""[out:json][timeout:300];
area["ISO3166-1"="{iso}"][admin_level=2]->.a;
(nwr(area.a)["amenity"~"^(hospital|clinic|nursing_home|health_centre)$"]({s},{o},{n},{e});
 nwr(area.a)["healthcare"~"^(hospital|clinic|centre|laboratory|nursing_home)$"]({s},{o},{n},{e});
 nwr(area.a)["social_facility"~"^(nursing_home|assisted_living)$"]({s},{o},{n},{e}););
out center tags;"""
        donnees = None
        for serveur in SERVEURS_OVERPASS * 2:
            try:
                brut = telecharger(serveur, data=urllib.parse.urlencode({"data": q}).encode(), tentatives=1, timeout=400)
                d = json.loads(brut)
            except (RuntimeError, ValueError):
                continue
            remarque = str(d.get("remark", ""))
            if re.search(r"error|timed out|timeout|out of memory", remarque, re.I):
                # Réponse tronquée : Overpass renvoie ce qu'il a trouvé avant l'erreur. On essaie le serveur suivant.
                print(f"  {nom_pays} : réponse incomplète de {serveur} ({remarque[:80]}), serveur suivant", file=sys.stderr)
                continue
            donnees = d
            break
        if donnees is None:
            raise RuntimeError("OpenStreetMap injoignable pour " + nom_pays)
        compte = 0
        for el in donnees.get("elements", []):
            t = el.get("tags", {})
            typ = type_osm(t)
            lat = el.get("lat") or el.get("center", {}).get("lat")
            lon = el.get("lon") or el.get("center", {}).get("lon")
            if not typ or lat is None:
                continue
            if france.distance(Point(proj(lon, lat))) > BANDE_KM * 1000:
                continue
            nom = t.get("name:fr") or t.get("name") or ""
            if not nom:  # bâtiments ou services sans nom : souvent des doublons d'un établissement voisin
                continue
            cle = (nom.lower(), round(lat, 3), round(lon, 3))
            if cle in vus:
                continue
            vus.add(cle)
            rue = " ".join(x for x in [t.get("addr:housenumber", ""), t.get("addr:street", "")] if x) or t.get("addr:place", "")
            ville = " ".join(x for x in [t.get("addr:postcode", ""), t.get("addr:city", "")] if x)
            tel = t.get("phone") or t.get("contact:phone") or ""
            lignes.setdefault(OSM_VERS_CAT[typ], []).append(
                [nom, rue, ville, round(lat, 5), round(lon, 5), tel, f"osm:{el['type'][0]}{el['id']}", iso, LIBELLES_OSM[typ]])
            compte += 1
        print(f"{nom_pays} : {compte} établissements à moins de {BANDE_KM} km de la frontière")
        time.sleep(10)
    return lignes


def ancien_etranger():
    """Reprend les établissements étrangers de la base précédente si OpenStreetMap ne répond pas."""
    lignes = {}
    dossier = os.path.join(SORTIE, "c")
    if not os.path.isdir(dossier):
        return lignes
    for nom in os.listdir(dossier):
        d = json.load(open(os.path.join(dossier, nom), encoding="utf-8"))
        garde = [r for r in d["r"] if r[7]]
        if garde:
            lignes[nom[:-5]] = garde
    return lignes


# ---------------------------------------------------------------------------
def main():
    sys.stdout.reconfigure(line_buffering=True)
    ap = argparse.ArgumentParser()
    ap.add_argument("--finess", help="fichier FINESS déjà téléchargé")
    ap.add_argument("--sans-etranger", action="store_true")
    args = ap.parse_args()

    if args.finess:
        texte, maj = open(args.finess, encoding="utf-8", errors="replace").read(), ""
    else:
        url, maj = url_finess()
        print("Téléchargement de", url)
        texte = telecharger(url).decode("utf-8", errors="replace")
    m = re.match(r"finess;etalab;\d+;(\d{4}-\d{2}-\d{2})", texte)
    if m:
        maj = m.group(1)
    if not args.finess:
        charger_communes()
    france = lire_finess(texte)

    etranger = {}
    if not args.sans_etranger:
        try:
            etranger = lire_etranger()
        except Exception as e:  # noqa: BLE001
            print("Pays frontaliers : échec (" + str(e) + "), reprise de la base précédente", file=sys.stderr)
            etranger = ancien_etranger()

    # Garde-fou par pays : si un pays perd plus de 15 % de ses établissements d'un coup, c'est presque toujours
    # une réponse OpenStreetMap incomplète. On garde alors les établissements de la base précédente pour ce pays.
    if etranger:
        ancien = ancien_etranger()
        par_pays = lambda l: {iso: [(c, r) for c, rows in l.items() for r in rows if r[7] == iso] for iso in PAYS}
        nouv, anc = par_pays(etranger), par_pays(ancien)
        for iso, lignes_anc in anc.items():
            if lignes_anc and len(nouv[iso]) < 0.85 * len(lignes_anc):
                print(f"{PAYS[iso][0]} : {len(nouv[iso])} établissements contre {len(lignes_anc)} dans la base précédente, on garde la base précédente pour ce pays", file=sys.stderr)
                for c in etranger:
                    etranger[c] = [r for r in etranger[c] if r[7] != iso]
                for c, r in lignes_anc:
                    etranger.setdefault(c, []).append(r)

    total = sum(len(v) for v in france.values())
    if total < 20000:
        raise SystemExit(f"Seulement {total} établissements en France : fichier FINESS incomplet, base non remplacée.")

    os.makedirs(os.path.join(SORTIE, "c"), exist_ok=True)
    familles = []
    for fam in FAMILLES:
        cats = []
        for c in fam["cats"]:
            fr, et = france.get(c["id"], []), etranger.get(c["id"], [])
            rows = sorted(fr, key=lambda r: r[0]) + sorted(et, key=lambda r: r[0])
            with open(os.path.join(SORTIE, "c", c["id"] + ".json"), "w", encoding="utf-8") as fh:
                json.dump({"f": ["nom", "adresse", "ville", "lat", "lon", "tel", "id", "pays", "type"], "r": rows},
                          fh, ensure_ascii=False, separators=(",", ":"))
            cats.append({"id": c["id"], "label": c["label"], "desc": c["desc"], "n": len(fr), "nEtranger": len(et)})
        familles.append({"id": fam["id"], "label": fam["label"], "cats": cats})
    meta = {"majFiness": maj, "genere": date.today().isoformat(), "bandeKm": BANDE_KM,
            "pays": [v[0] for v in PAYS.values()], "familles": familles}
    with open(os.path.join(SORTIE, "categories.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=1)
    print(f"Base écrite : {total} en France, {sum(len(v) for v in etranger.values())} dans les pays frontaliers.")


if __name__ == "__main__":
    main()

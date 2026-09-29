# Kilomètres réels Pro

Version avec espace client chiffré, scénarios chiffrés en euros et assistant IA. La version simple reste disponible dans le dépôt « kilometres-reels ».

Trouvez l'établissement de santé ou gériatrique le plus proche d'une adresse, classé par kilomètres et temps de trajet réels par la route.

Site : https://alexandrecavaillon-afk.github.io/kilometres-reels-pro/

## Utilisation

1. Tapez une adresse de départ (des suggestions s'affichent), ou cliquez sur « Ma position ».
2. Choisissez un type d'établissement.
3. Les plus proches s'affichent sur la carte et dans la liste. Cliquez sur l'un d'eux pour voir le trajet, l'ouvrir dans Plans ou Google Maps, ou appeler.

Pour un simple trajet : onglet « Trajet de A à B », saisissez deux adresses ou deux codes postaux. Le site donne les kilomètres et le temps de l'itinéraire le plus rapide, le tracé sur la carte et l'itinéraire détaillé. Pour un code postal seul, le site prend la plus grande commune de ce code et part de son centre.

Pays des adresses : le bouton « Adresses en … » (sous les onglets, et dans le panneau de résultats) permet de chercher les adresses dans un pays, plusieurs, ou le monde entier. La France utilise la Géoplateforme IGN, les autres pays OpenStreetMap (Photon pour les suggestions, Nominatim pour la recherche). Le choix est mémorisé dans votre navigateur.

Pour plusieurs adresses de départ : « Plusieurs départs depuis Excel », puis déposez un fichier .xlsx ou .csv (ou collez des cellules copiées depuis Excel dans la barre de recherche). Indiquez les colonnes du nom et de l'adresse, choisissez le type d'établissement : vous obtenez les 1, 3, 5 ou 10 plus proches de chaque départ, et un fichier Excel filtrable.

## Vérification des affectations

Onglet « Vérification » : importez un fichier avec une ligne par établissement, la localisation de l'établissement (code postal ou adresse) et celle du médecin qui le suit, et si vous les avez, la distance et le temps déclarés, le statut, les noms. Le site :

- recalcule chaque trajet (itinéraire le plus rapide, sans trafic) et classe les lignes en conformes, en écart (au-delà de 15 % ou 5 km, et 20 % ou 8 min, réglables) ou non vérifiables (code postal introuvable, par exemple un CEDEX, ou deux codes de la même ville) ;
- trouve le médecin le plus proche de chaque établissement ;
- propose une répartition qui réduit au minimum le temps (ou la distance) total, en gardant le même nombre d'établissements par médecin, ou au plus N ;
- affiche la carte (médecins en bleu, établissements en rouge) et, pour chaque médecin, ses établissements et les plus proches de lui ;
- affiche un rapport détaillé (bouton « Rapport détaillé »), imprimable ou enregistrable en PDF : points clés, meilleurs parcours possibles, répartition optimale, trajets à corriger, bilan par médecin, détail de chaque ligne, méthode ;
- produit un rapport Excel en cinq onglets : Synthèse, Meilleurs parcours, Vérification, Propositions, Médecins.

Le site ne contient aucune donnée d'affectation : le fichier importé est lu dans le navigateur, n'est envoyé à aucun serveur et disparaît à la fermeture de l'onglet.

Sans colonne de nom, un code postal de médecin correspond à un médecin.

## Espace client

Bouton « Espace client » en haut de la page.

- **Créer mon espace** : un identifiant (une adresse e-mail si vous voulez la synchronisation en ligne) et un mot de passe d'au moins 10 caractères. Une **clé de secours** s'affiche une seule fois : c'est le seul moyen de rouvrir l'espace si le mot de passe est perdu.
- **Contenu** : profil de l'entreprise et objectifs du business plan, paramètres de coûts des scénarios, documents (business plan, bases clients et praticiens, contrats… en PDF, Word, Excel, PowerPoint, CSV ou texte), clé d'IA, analyses enregistrées avec les réponses de l'IA.
- **Chiffrement** : tout est chiffré dans le navigateur (AES-GCM 256 bits). La clé de chiffrement est aléatoire, protégée par le mot de passe (PBKDF2-SHA256, 600 000 itérations) et par la clé de secours. Le mot de passe n'est jamais envoyé ni enregistré.
- **Où est gardé l'espace** : dans le navigateur (IndexedDB), uniquement sous forme chiffrée. Rafraîchir la page le verrouille ; il se verrouille aussi après 30 minutes sans activité. « Exporter le coffre » produit un fichier chiffré (.krcoffre) à réimporter sur un autre appareil.
- **Synchronisation en ligne (facultative)** : si le site est relié à un projet Supabase (voir plus bas), l'espace peut être gardé en ligne pour le retrouver sur n'importe quel appareil. Le serveur ne reçoit que l'adresse e-mail, un mot de passe dérivé (différent du vôtre) et le coffre chiffré : il ne peut pas le lire.

## Scénarios chiffrés (onglet « Scénarios » de la vérification)

À partir du coût par km, du coût horaire d'un praticien en trajet, du nombre de visites par mois, du coût fixe mensuel d'un praticien, de la charge maximale et du trajet maximal accepté :

- Aujourd'hui ;
- meilleure répartition à charge identique ;
- au plus N établissements par praticien ;
- **moins de praticiens** : les praticiens sont libérés un par un, en commençant par celui dont le départ coûte le moins, tant que leurs établissements peuvent être repris sans dépasser la charge ni le trajet maximal. Le curseur choisit combien en libérer ; la répartition finale est ensuite optimisée.

Pour chaque scénario : nombre de praticiens, heures de trajet et km par mois, coût mensuel et écart avec aujourd'hui.

## Assistant IA

Claude (Anthropic), ChatGPT (OpenAI) ou Gemini (Google), au choix, avec la clé API de l'entreprise, saisie dans l'espace (onglet IA). Le navigateur appelle directement le fournisseur, sans intermédiaire. Au moment d'une question, il envoie : la question, le profil de l'entreprise, les documents de l'espace et le résumé de l'analyse (trajets, médecins, propositions, scénarios). Les réponses peuvent être enregistrées avec l'analyse et figurent dans le rapport détaillé.

Avec une clé API professionnelle, ces fournisseurs indiquent ne pas utiliser les données pour entraîner leurs modèles : vérifiez leurs conditions et le contrat de l'entreprise.

## Activer la synchronisation en ligne (Supabase)

1. Créer un projet sur supabase.com, région Europe.
2. Dans « SQL Editor », exécuter :

```sql
create table public.coffres (
  user_id uuid primary key references auth.users on delete cascade default auth.uid(),
  enveloppe jsonb not null,
  maj text
);
alter table public.coffres enable row level security;
create policy "lecture de son coffre" on public.coffres for select using (auth.uid() = user_id);
create policy "création de son coffre" on public.coffres for insert with check (auth.uid() = user_id);
create policy "mise à jour de son coffre" on public.coffres for update using (auth.uid() = user_id);
create policy "suppression de son coffre" on public.coffres for delete using (auth.uid() = user_id);
```

3. Dans « Project Settings », « API », copier l'URL du projet et la clé publique « anon ».
4. Les coller dans `config.json` à la racine du dépôt :

```json
{ "supabaseUrl": "https://xxxxxxxx.supabase.co", "supabaseAnonKey": "eyJ..." }
```

La clé « anon » est publique par conception : ce sont les règles ci-dessus qui empêchent chacun de lire le coffre d'un autre, et les coffres sont de toute façon chiffrés.

## Limites

- Mot de passe et clé de secours perdus : l'espace est irrécupérable. C'est le prix de la confidentialité.
- Documents : 15 Mo par fichier. Les PDF sont transmis tels quels à l'IA ; les autres formats sont lus en texte dans le navigateur.
- Ne pas déposer de données de patients : leur hébergement exigerait un hébergeur certifié HDS.

## Types d'établissements

- Personnes âgées : EHPAD, soins de longue durée (USLD), résidences autonomie et EHPA, accueil de jour, soins infirmiers à domicile (SSIAD, SAAS), aide à domicile.
- Hôpitaux et cliniques : CHU et CHR, centres hospitaliers, cliniques, soins de suite et réadaptation, psychiatrie, hospitalisation à domicile, dialyse, centres de lutte contre le cancer.
- Soins de ville : centres de santé, maisons de santé, laboratoires, soins non programmés.

## D'où viennent les données

- France (outre-mer compris) : fichier FINESS des établissements géolocalisés, publié par le ministère de la Santé sur data.gouv.fr. Les noms de communes viennent de l'API Découpage administratif.
- Pays frontaliers (Belgique, Luxembourg, Allemagne, Suisse, Italie, Monaco, Andorre, Espagne) : OpenStreetMap, pour les établissements situés à moins de 60 km de la frontière. Ces données sont plus inégales que FINESS : adresses parfois incomplètes.

La base se met à jour seule le 3 de chaque mois (onglet Actions du dépôt, « Mettre à jour la base des établissements »). On peut aussi la relancer à la main avec le bouton « Run workflow ».

## Ce qui est envoyé, et à qui

| Donnée | Envoyée à | Pourquoi |
|---|---|---|
| Le texte des adresses saisies | Géoplateforme IGN (data.geopf.fr) pour la France ; OpenStreetMap Photon (photon.komoot.io) et Nominatim pour les autres pays | Trouver leurs coordonnées |
| Les coordonnées GPS | Serveur OSRM public (router.project-osrm.org, ou routing.openstreetmap.de en secours) | Calculer kilomètres et temps de trajet |
| La zone affichée | tile.openstreetmap.org | Afficher le fond de carte |
| Question, profil, documents et résumé de l'analyse | Le fournisseur d'IA choisi, seulement quand vous posez une question | Répondre |
| Coffre chiffré, e-mail, mot de passe dérivé | Supabase, seulement si la synchronisation est activée | Retrouver l'espace sur un autre appareil |

Les fichiers Excel importés sont lus dans le navigateur et ne sont envoyés nulle part. Aucun compte, cookie ni statistique de visite. Les liens Plans et Google Maps ne transmettent des coordonnées qu'au clic.

## Limites

- Les kilomètres sont ceux de l'itinéraire le plus rapide, sans trafic.
- Le site présélectionne les 99 établissements les plus proches à vol d'oiseau, puis les classe par la route : un établissement plus lointain à vol d'oiseau mais plus rapide par la route peut, rarement, être manqué.
- Les serveurs d'itinéraires publics sont gratuits et partagés ; le site espace ses demandes d'une seconde. Un fichier de 200 départs prend environ 4 minutes.

## Organisation du dépôt

- `index.html` : le site, produit par `python build/assembler_page.py` à partir du dossier `src/`.
- `config.json` : réglage facultatif de la synchronisation en ligne (vide par défaut).
- `build/construire_base.py` : construit la base dans `data/` (lancé par GitHub Actions).
- `data/` : la base, un fichier par type d'établissement.

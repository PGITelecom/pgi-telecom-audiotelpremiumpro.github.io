# Audiotel Premium Pro - consolidation logicielle, branche non deployable

Date : 2026-11-15. Statut : **preparation en PR brouillon**.
Aucun raccordement operateur, aucune activation, aucun transfert de fonds, aucune modification Neon, aucune autorisation de deploiement Vercel.

## 1. Modules volumineux : agir sans casser la production

Constat : `backend/src/store-postgres.mjs` (~753 Ko) et `backend/server.mjs` (~244 Ko) sont trop concentres pour une maintenance sereine. Ils sont deja largement couverts par des tests. Une decomposition globale immediate exposerait les parcours clients, reversements et authentifications a un risque disproportionne.

Actions limitees et verifiables :
- Les calculs de scenario Audiotel sont isoles dans `backend/src/audiotel-strategy-finance.mjs`. Ce module pur utilise BigInt pour les seuils et les classements.
- Un garde-fou CI `scripts/check-architecture-budget.mjs` refuse la croissance superieure a 5 % des quatre modules les plus sensibles, jusqu'a leur decomposition sous supervision.
- Pour refactoriser les gros modules : extraire un domaine par PR, conserver les contrats d'API, exiger tests unitaires, integration PostgreSQL locale et non-regression des parcours essentiels. Conserver le schema de base intact tant que l'activation est gelee.

Ce garde-fou ne vaut **pas** decomposition complete. La dette technique est toujours presente.

## 2. Simulations vs fonctions veritablement operationnelles

Le choix du meilleur scenario utilise les millieuros entiers, et non des montants EUR arrondis au centime. Le resultat est recalculable dans le champ `company_result_millieur_exact`. Les comparaisons de seuils sont exactes, y compris aux limites des pourcentages de delegation et de rentabilite.

Les champs de preuves saisis par un administrateur ne sont pas des certificats verifies. Le rapport indique :
- `evidence_is_owner_declared_only=true`
- `launch_readiness_independently_verified=false`
- `release_requires_separate_owner_authorization=true`
- `preview_is_not_a_release_decision=true`
- `activation_approval_status=blocked_pending_external_acceptance_and_explicit_owner_release`

Le cockpit affiche explicitement **SIMULATION NON VALIDEE** avec l'avertissement fiscal. Les sorties ne changent aucun fournisseur ni statut reel. Ces champs sont additifs et ne modifient pas les anciens contrats de reponse API.

## 3. Securite et fiabilite

Le simulateur reste derriere un POST reserve a `admin`, avec verification CSRF et taille de corps limitee. Aucune ecriture en base, aucun appel operateur, aucun mouvement bancaire. Les fonds destines aux editeurs ne deviennent jamais un revenu Audiotel dans les hypotheses.

La CI execute `npm run verify`, qui inclut maintenant le budget d'architecture et les tests de finance / securite `tests/audiotel-strategy-hardening.test.mjs`. Les tests verifient notamment :
- ordre exact de scenarios representes au meme centime;
- seuil de sacrifice de resultat sans arrondi premature;
- impossibilite d'activer un operateur meme si toutes les cases de preuve sont cochees;
- refus de fournisseurs invalides et de transit des fonds editeurs par Audiotel;
- verification des controles administrateur, CSRF et limite de taille du corps.

## 4. Points qui restent a traiter avant exploitation

- Audit externe de securite, exercices de restauration et validation de charge a l'echelle cible.
- Decomposition progressive des deux plus gros monolithes.
- Contrats operateurs, interoperabilite SIP/CDR, portabilite reelle et droit de numérotation.
- Validation juridique du reversement direct, fiscalite personnelle et taux effectif conserve.
- Tests end-to-end sur un environnement de recette autorise, puis decision d'exploitation distincte.

**Interdiction maintenue** : pas de fusion `main`, de redeploiement Vercel, de migration ou d'ecriture Neon sans autorisation explicite du proprietaire.


## 5. Watermarks Remover : controle conservateur dans le pipeline GitHub

L'outil `scripts/scan-source-hygiene.mjs` applique les regles d'inspection Unicode conservatrices documentees dans le plugin prive `Watermarks Remover`. La CI GitHub execute maintenant `npm run check:source-hygiene` a chaque verification de PR :

- fichiers texte suivis par Git : detection des caracteres reellement invisibles U+200B, U+2060, U+FEFF, U+00AD, U+034F, du NUL et des controles bidi suspects dans le code executable ;
- preservation explicite des jonctions Unicode U+200C/U+200D, des espaces insécables et des sequences JavaScript legitimes `\uFEFF` utilisees pour les exportations CSV ;
- inspection en lecture seule des conteneurs EXIF/XMP/C2PA connus des images PNG/JPEG/WebP et du noeud metadata des SVG ;
- detection des fichiers source au mauvais encodage UTF-8, et compte rendu avec nom de fichier, ligne et point de code ;
- tests automatises pour empecher des faux positifs et verifier l'absence de reecriture des fichiers.

Les caracteres suspects ou les fichiers illisibles bloquent la CI. Les conteneurs de metadonnees sont **signales pour revue**, mais pas supprimes automatiquement : ils peuvent contenir de la provenance, des attributions ou des informations techniques legitimes.

Cette implementation n'est pas une execution du service HTTP de watermarks-remover ; elle transpose les controles compatibles dans un script local Node.js sans abonnement supplementaire.

**Limites** : l'absence de ces caracteres ne prouve pas l'absence de filigranes statistiques `textGrain`, `SynthID`, de marques dans les pixels ou d'attestations C2PA liees a des registres distants. La modification de la redaction de textes pour des raisons de qualite editoriale reste distincte de toute certification de suppression d'un filigrane.

Interdit sans accord separe : modification automatique de signatures, titres de propriete, credits, declarations legales, metadata protectrices ou originaux d'images.


## 6. Extraction de domaines et controle de non-regression

Date : 2026-11-15, branche de preparation, sans deploiement.

**Reduction effective de la taille des fichiers les plus volumineux :**

- `backend/src/store-postgres.mjs` : 752 809 octets sur `main`, 709 399 octets sur cette branche, soit **-43 410 octets** environ (-5,8 %). Les huit methodes finance, jackpot, synthese, tableau de bord, qualite reseau et incidents ont ete extraites, sans modification des requetes SQL ni des signatures publiques.
- `backend/server.mjs` : 243 154 octets sur `main`, 237 832 octets sur cette branche, soit **-5 322 octets** environ (-2,2 % par rapport a la production). La generation Prometheus et les histogrammes sont desormais dans `backend/src/http-observability.mjs`.
- Extraction dans `backend/src/store-postgres-financial-insights.mjs`, `backend/src/store-postgres-network-insights.mjs` et `backend/src/http-observability.mjs`.
- Les seuils CI `scripts/check-architecture-budget.mjs` ont ete abaisses : ils surveillent les nouveaux modules et evitent que les monolithes reprennent leur ancien volume sans revue explicite.

**Controle de compatibilite :**
- Wrappers des methodes publiques conserves sur `PostgresStore`, meme nombre de parametres, delegation vers les domaines extraits.
- Assertions de contrat et tests statiques adaptes pour suivre les imports effectifs. Les exigences d'origine, notamment SQL, Business Live, incidents, prometheus et controle d'acces restent verifiees.
- Ajout de tests SQL factices en lecture seule `tests/postgres-analytics-modules.test.mjs` et d'observabilite `tests/http-observability-modules.test.mjs`.
- Aucun nouveau branchement d'operateur, aucune modification de schema, aucun flux financier reel.

**Precision :** le projet complet ne devient pas necessairement plus petit en octets : les fonctions deplacees restent necessaires. Le benefice est une reduction du couplage et de la taille des modules centraux, pas un gain de vitesse ou une superiorite sur les concurrents deja prouvee. Les tests en CI ne remplacent pas un audit de production.

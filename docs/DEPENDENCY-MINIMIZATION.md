# Dépendances minimales : architecture PGI souveraine

## Objectif

PGI Telecom • Audiotel Premium Pro doit réduire les dépendances externes au strict nécessaire.

## Dépendance externe minimale

### 1. Opérateur SVA hôte

Rôle strictement limité à ce que PGI ne peut pas assumer directement dans le modèle actuel :

- ressource de numérotation / exploitation réseau du 089 ;
- accessibilité du 089 depuis les réseaux appelants ;
- interconnexion SVA ;
- portabilité réseau ;
- collecte/reversement de la composante service selon le contrat ;
- obligations opérateur associées à la ressource.

L'opérateur ne doit pas être propriétaire du cœur métier PGI.

Il ne doit pas imposer, lorsque le contrat le permet :

- son SVI ;
- son routage métier ;
- son dashboard ;
- son CRM ;
- son moteur de statistiques ;
- sa logique expert ;
- son stockage comme source de vérité ;
- son moteur de marge ;
- ses exports comme seul accès aux données.

## Composants possédés par PGI

| Fonction | Propriétaire |
|---|---|
| Dashboard | PGI |
| API | PGI |
| PostgreSQL | PGI |
| Valkey | PGI |
| Kamailio/OpenSIPS | PGI |
| FreeSWITCH | PGI |
| SVI | PGI |
| Routage experts | PGI |
| Files d'attente | PGI |
| Présence experts | PGI |
| CDR interne | PGI |
| Modèle client | PGI |
| Moteur financier | PGI |
| Réconciliation | PGI |
| Historique contrats | PGI |
| Exports | PGI |
| Monitoring | PGI |
| Alertes | PGI |
| Audit | PGI |
| Sauvegardes | PGI |
| CI/CD | PGI / GitHub |
| Numéro 089 affecté | utilisateur final, via opérateur |
| Interconnexion SVA | opérateur hôte |
| Collecte réseau / reversement | opérateur hôte |

## Fournisseurs non nécessaires

PGI ne nécessite pas comme dépendance structurelle :

- plateforme Audiotel hébergée tierce ;
- fournisseur de SVI hébergé ;
- fournisseur de dashboard télécom ;
- fournisseur de CRM téléphonique ;
- fournisseur de files d'attente ;
- fournisseur de CDR métier ;
- moteur de réconciliation tiers ;
- Cloudflare ;
- outil de monitoring SaaS obligatoire.

Des services facultatifs pourront être ajoutés uniquement s'ils apportent un gain mesurable et restent remplaçables.

## Règle d'architecture

Aucun composant métier ne doit importer un SDK propre à un opérateur SVA.

La relation opérateur est limitée à :

```
PGI canonical model
       │
       ▼
Carrier Adapter v1
       │
       ├── SIP
       ├── CDR
       └── Settlement
             │
             ▼
       opérateur hôte
```

## Source de vérité

La source de vérité est PGI :

- FreeSWITCH/Kamailio pour les événements téléphoniques internes ;
- PostgreSQL pour le modèle métier ;
- relevé opérateur conservé comme preuve externe ;
- rapprochement entre les deux.

Un dashboard opérateur n'est jamais la source de vérité de PGI.

## Indépendance réseau

Le système doit continuer à fonctionner pour les fonctions non réseau même si l'opérateur hôte est indisponible :

- consultation historique ;
- finance historique ;
- rapports ;
- experts ;
- configuration ;
- audit.

La panne du fournisseur ne doit pas corrompre les données PGI.

## Changement d'opérateur

Le remplacement de l'opérateur doit se limiter à :

1. créer son profil/adaptateur ;
2. renseigner le nouveau contrat ;
3. configurer les connexions SIP/CDR/règlement ;
4. tester ;
5. porter le même 089 ;
6. basculer `sva-primary`.

Aucune refonte applicative.

## PSP / établissement de paiement

Si l'opérateur utilise un établissement de paiement en sous-jacent pour les reversements, PGI ne doit pas en dépendre techniquement dans le cœur.

L'opérateur/adaptateur encapsule cette relation. Si le modèle contractuel impose une relation directe avec un PSP, elle reste une dépendance financière périphérique, jamais une dépendance téléphonique ou applicative.


## Comparateur wholesale et normalisation des relevés

Les routes POST `/api/v1/platform/wholesale/compare` et
`/api/v1/platform/wholesale/normalize-export` sont réservées aux administrateurs authentifiés
avec CSRF. Aucun changement de fournisseur, écriture comptable, paiement, affectation de numéro
ou appel à un opérateur ne peut être déclenché par ces routes.

Le comparateur travaille en micro-euros HT entiers (1 EUR = 1 000 000 micro-EUR).
La marge minimale de contribution est de 70 000 micro-EUR/minute, après coûts variables
et frais fixes amortis sur l'horizon renseigné, avant impôts et autres charges non saisies.
Chaque coût est obligatoire, y compris les frais d'intermédiaire, les frais de sortie
et les compléments au minimum de facturation. Une offre non documentée reste bloquée
même si sa marge estimée est élevée. Les indicateurs de preuve saisis sont déclaratifs,
pas une certification indépendante ni une autorisation de mise en service.

Le normaliseur accepte les lignes JSON déjà extraites des relevés fournisseur, avec
mapping explicite, dates ISO horodatées avec fuseau, montants décimaux textuels et
identifiants d'appel uniques. Il produit un aperçu canonique et une empreinte stable.
Un montant déclaré par un fournisseur n'est jamais assimilé à un encaissement vérifié.
Les champs personnels inutiles ne sont pas retournés. L'importeur CSV/SFTP, le rapprochement
avec les écritures réelles et le raccordement SIP nécessitent les spécifications et les
preuves contractuelles de chaque opérateur.

Ce périmètre ne modifie ni Vercel, ni Neon, ni Stripe, ni les autres prestataires techniques.
Aucune activation commerciale du pôle Distribution n'est effectuée.


### Outils supplémentaires d'indépendance télécom

Le cockpit « Abonnement & opérateur » contient désormais un module d'analyse chargé à la demande : inventaire réel des blocs et contrats enregistrés, routes actives et de secours, agrégats financiers EUR des 30 derniers jours. Les preuves réglementaires et bancaires ne sont pas déduites de simples états enregistrés.

- `GET /api/v1/platform/wholesale/independence` : observation de l'inventaire et des flux enregistrés.
- `POST /api/v1/platform/wholesale/reconcile` : comparaison de deux séries déclaratives.
- `POST /api/v1/platform/wholesale/reconcile-ledger` : comparaison avec les attentes CDR PGI de la base primaire, pour un opérateur existant et une fenêtre UTC complète de 31 jours maximum et 1 000 appels maximum. Au-delà, scinder la fenêtre. Les lignes importées restent non authentifiées et les écarts ne prouvent pas à eux seuls une créance.
- `POST /api/v1/platform/wholesale/voice-cost` : estimation des économies de réception WebRTC, y compris les minutes de repli PSTN, frais fixes et investissement initial.

Le comparateur exige également la catégorie du numéro et le tarif service HT déclaré, soumis aux plafonds configurés du modèle de marge existant. Les coûts, preuves, tarifs et autorisations doivent être confirmés indépendamment. Aucun serveur média ou trunk SIP réel n'est déployé par ces fonctions. Les formulaires avancés utilisent du JSON et ne persistent aucune saisie. Les routes POST sont réservées aux administrateurs avec CSRF. Aucun changement de schéma ni de fournisseur informatique n'est nécessaire.


### Internalisation supplémentaire : fichiers opérateurs et coût des destinations

Les routes administrateur POST `/api/v1/platform/wholesale/normalize-csv`,
`/api/v1/platform/wholesale/reconcile-csv` et
`/api/v1/platform/wholesale/economic-routing` sont protégées par session et CSRF.
Le cockpit accepte un fichier CSV local (180 000 octets maximum, 1 000 lignes de données,
64 colonnes), avec séparateur explicite et correspondance de colonnes.
Les fichiers sont analysés sans SDK propriétaire ni convertisseur externe.
Le rapprochement utilise les attentes de la base PGI et conserve les empreintes du texte
UTF-8 reçu et de l'export canonique. Les montants déclarés et les écarts ne constituent
pas une preuve de règlement. Les dates, unités et conventions opérateur doivent être
confirmées ; aucun CSV ne déclenche un paiement ou une modification du journal.

Le calcul de terminaison utilise des entiers en micro-euros et tient compte du minimum
facturable, de l'incrément de durée et du forfait de connexion. Il s'agit d'une estimation
selon la convention explicitée, et non d'une substitution aux tarifs du contrat.
L'analyse de routage s'appuie sur la simulation PGI existante, pour un tenant et un numéro
déterminés : seules les destinations disponibles, de même priorité et de même
spécificité peuvent être comparées. Les preuves de qualité, coût et accord client
sont déclaratives et exigent validation. Le moteur ne modifie aucun routage réel.

Restent hors périmètre : la mise en service d'un SBC, d'un serveur média/SVI FreeSWITCH,
d'un serveur TURN/WebRTC, les interconnexions, la collecte SVA, la portabilité réseau
et les autorisations de numérotation. Leurs paramètres, certificats, accès opérateurs
et conditions contractuelles réelles restent nécessaires. Conserver Stripe, Neon,
Vercel et les autres fournisseurs informatiques, ainsi que les garde-fous de conformité.

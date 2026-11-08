# Audiotel Premium Pro : évolution technique des demandes SVA et de la portabilité
**Préparation uniquement, 8 novembre 2026.** Priorité métier : conserver le numéro SVA des professionnels rejoignant Audiotel Premium Pro.
**AUCUN déploiement Vercel, AUCUNE modification Neon, aucune fusion GitHub, aucun contact opérateur, aucune ouverture, aucun transfert, aucune communication envoyée, aucun frais.**

## 1. Décision d'architecture : améliorer l'existant, sans doublons

Ne pas toucher au design, aux URL publiques ni aux interfaces actuelles. Conserver les composants :
- Formulaire public `/demande-ouverture/` : sélection d'un premier numéro ou d'une portabilité. Il reste en préouverture.
- Contenus existants `/portabilite-numero-sva/`, `/portabilite-prioritaire/` : pas de nouveau parcours commercial.
- `client.html`, `assets/client-portability-base.js`, `assets/client-portability.js` : formulaire, affichage et annulation des demandes, réservé aux clients autorisés.
- `assets/tenant-portability-admin.js` : cockpit des dossiers clients existants.
- `backend/server.mjs` : endpoints de portabilité authentifiés et protégés par session/CSRF, non modifiés.
- `backend/src/portability-automation.mjs` : API opérateur avec vérifications préalables, suivi, retentatives et reprise.
- `backend/src/outbound-portability-automation.mjs` : opérations de portabilité sortante.
- `backend/src/portability-identity.mjs` : validation locale du RIO et chiffrement au repos.
- `database/migrations/027, 028, 030, 031` : `tenant_portability_requests`, tarifs, RIO et `portability_operator_events` ; **déjà présents**.
- `backend/src/audiotel-platform-order.mjs` et `backend/src/audiotel-platform-intake.mjs` : évaluation et intention de commande authentifiée.
- `database/prelaunch-not-applied/090_audiotel_platform_number_order_preparation.sql` : intentions, preuves et journaux de commande, non installés en production.
- `backend/src/customer-access.mjs` et vues `tenant_scoped_*` : séparation stricte des clients.

**Lacune fonctionnelle préexistante :** le prospect public, qui n'a pas encore d'accès client, ne peut pas être supposé posséder un tenant authentifié et un abonnement valide pour entrer directement dans `tenant_portability_requests`. Créer un tenant/client avant le contrôle KYB est exclu. Il fallait donc une **passerelle d'instruction avant la création de compte**, pas un nouveau moteur de portage.

## 2. Composants ajoutés, uniquement sur la branche isolée

- `backend/src/audiotel-onboarding-preparation.mjs` : politique d'entrée FR, numéro canonique E.164, distinction portabilité / numéro neuf, transitions autorisées, pièces et preuves exigées, projection client sans PII, notifications documentaires inertes, check de bascule non activant.
- `backend/src/audiotel-onboarding-casework.mjs` : opérations transactionnelles réutilisables pour créer un dossier prospect, lui ajouter des références documentaires, faire une revue staff, changer son étape, consulter la file interne. Aucun endpoint HTTP n'appelle encore ces fonctions.
- `database/prelaunch-not-applied/091_audiotel_preclient_number_portability_cases.sql` : dossiers prospects, documents sécurisés par références, journal append-only, outbox non envoyée, intentions d'intégration opérateur non expédiées. Aucun `CREATE TABLE` lancé sur Neon.
- `backend/src/portability-identity.mjs` : extension rétrocompatible de la reconnaissance des préfixes RIO SVA 2026 (`F0` à `ZZ` en plus des dossiers historiques) avec le contrôle de cohérence déjà présent ; validation par l'opérateur toujours indispensable.
- Tests de non-activation, d'idempotence, d'isolation entre unités, de statuts, de documents et de compatibilité RIO ; validation du SQL dans la seule base PostgreSQL **temporaire de GitHub Actions**.

Les dossiers ont le préfixe `APP-CASE-`, distinct des dossiers `direct_sva`. Une référence de contact **opaque** (CRM/coffre-fort) est stockée, jamais l'adresse e-mail ou le numéro personnel en clair dans les événements. Les documents eux-mêmes et le RIO brut doivent rester chez un fournisseur sécurisé ; ne jamais placer ces contenus dans GitHub, HubSpot en champ texte libre, un journal ou un e-mail transactionnel.

## 3. Parcours prioritaire : numéro SVA actuellement exploité ailleurs

### Avant l'ouverture du service

1. Le professionnel consulte la page actuelle de portabilité et utilise le formulaire existant.
2. Le service actuel demeure indisponible pour amélioration ; aucun portage immédiat ni réservation réelle ne doit être promis.
3. À terme, après raccordement d'un fournisseur d'identité/contact fiable, une **passerelle serveur** convertira le lead accepté en dossier `app_prelaunch_service_cases` avec idempotence `(secure_contact_ref,request_key)`.
4. Vérifier la catégorie 081, 082 ou 089 et la normalisation E.164. **Ne pas demander de RIO en public avant d'avoir un chemin sûr et une politique de conservation.**
5. Recueillir une référence de mandat du titulaire, un justificatif d'entreprise, un justificatif de tarif et, via un canal privé chiffré, le RIO correspondant.
6. Revue humaine des preuves et états administratifs ; distinguer preuve fournie, vérifiée et accord opérateur.
7. Une fois les accords télécom disponibles, préparer la demande vers l'opérateur receveur, en conservant l'identité du donneur et les numéros de dossier. La passerelle future réutilisera `tenant_portability_requests` et `portability-automation.mjs`, sans dossier doublon.
8. Préparer le routage sous une configuration **non active**, avec le même E.164, la durée de transition, les scénarios d'échec et les numéros de secours ; vérifier l'isolation du tenant.
9. La portabilité réelle exige confirmation indépendante de l'opérateur, ouverture réseau, vérification de l'acheminement des appels, CDR et tarification.
10. **Le site ne passe jamais automatiquement de `handoff_ready` à `ported` ou `active`.** Les contrôles SQL et le gel des déploiements l'interdisent tant que nous sommes en préparation.

### Gestion des anomalies

| Problème | Comportement prévu |
|---|---|
| Numéro mal formé ou autre pays | Refus de création |
| 0800 ou 0806 demandé dans le produit majoré | Refus comme numéro hors périmètre 081/082/089 |
| Même numéro en portabilité préparatoire ouverte | Contrainte unique en base de préparation |
| Même clé réutilisée avec un autre dossier | Conflit d'idempotence |
| Documents absents | `awaiting_documents`, journal et notification **non envoyée** |
| Mandat non vérifié / fraude | `on_hold` ou `rejected` selon revue |
| Opérateur non raccordé | Préparation sans appel API, jamais `ported` |
| Demande annulée | `cancelled`, aucune coupure de ligne |
| Portage réel ultérieur échoué | Traiter l'incident avec le fournisseur ; ne jamais prétendre qu'un rollback SQL restaure le réseau |
| Dossier clos | Plus de réouverture ni de preuve ajoutée dans le moteur de préparation |

La contrainte unique dans les tables de préparation protège les doublons **dans ce registre**. Lors du futur raccordement, il faudra vérifier également les tables `tenant_portability_requests`, `sva_numbers` et la disponibilité opérateur avant l'insertion ou le portage effectif.

## 4. Parcours secondaire : attribution d'un premier numéro

Même entrée vérifiée, mais **aucun numéro choisi par le prospect** et aucun stock inventé. Étapes de dossier : identité, activité, éligibilité, contrat, ressources Arcep juridiquement exploitables, accusé opérateur, SVI/destination, validation de réseau, revue finale, accès client. Les composants réutilisés à terme seront `app_number_order_intents`, `sva_numbers`, `tenant_number_assignments` et les connexions opérateur. Les réservations réelles doivent être atomiques et expirables, dans les tables d'inventaire et sous droits d'affectation vérifiés.

## 5. Modèle de données et séparation des autorités

| Référentiel | Rôle | Exécution réelle actuellement |
|---|---|---|
| `app_prelaunch_service_cases` (091) | Dossier de prospect sans tenant actif obligatoire | Non installé dans Neon |
| `app_prelaunch_case_documents` (091) | Références sécurisées et revue de pièces | Non installé |
| `app_prelaunch_case_events` (091) | Historique append-only sans identifiants sensibles | Non installé |
| `app_prelaunch_notification_drafts` (091) | Outbox transactionnelle, `send_enabled=false` | Jamais envoyée |
| `app_prelaunch_network_handoff_drafts` (091) | Intention d'API opérateur, `execution_enabled=false` | Jamais expédiée |
| `app_number_order_intents` (090) | Commande client déjà authentifié, dépend d'un tenant | Préparée hors Neon |
| `tenant_portability_requests` (027-031) | Portabilité de client vérifié | Tables et code existants, non raccordés à un opérateur réel |
| `portability_operator_events` (031) | Historique opérateur, secrets nettoyés | Structure existante |
| `sva_numbers`, `tenant_number_assignments` | Numéros effectivement attribués | Aucun numéro réel actuellement |
| `carrier_connections`, `carrier_contracts` | Interfaces et contrats d'interconnexion | Aucun contrat / raccordement réel |

Toutes les nouvelles tables ont l'accès `PUBLIC` révoqué. Aucun accès client direct à ces tables ne doit être accordé ; le futur backend devra utiliser un rôle dédié non `BYPASSRLS`, un contexte tenant transactionnel et des vérifications de propriétaire. Il faut définir la durée légale de conservation par catégorie documentaire et les habilitations exactes avant de stocker des pièces réelles.

## 6. API prévue pour raccordement ultérieur, PAS publiée

Les endpoints existants `POST/GET /api/v1/customer/portability`, `POST /api/v1/customer/portability/:id/cancel`, et la finalisation staff sont **conservés**. Les modules préparés sont des fonctions serveur et **ne sont pas montés sur une nouvelle route publique**.

Contrat de futur adaptateur, derrière authentification, CSRF et vérification des sources :

| Futur usage API | Fonction de préparation réutilisable | Autorité |
|---|---|---|
| Convertir un lead vérifié en dossier | `preparePreclientServiceCase` | Bridge serveur HubSpot/contact authentifié |
| Afficher les demandes avant compte client | `readPreclientStaffQueue` | Staff Audiotel habilité |
| Joindre une référence de pièce | `attachPreclientDocumentReference` | Personnel autorisé uniquement |
| Vérifier/rejeter une pièce | `reviewPreclientDocument` | Personnel + source document vérifiée |
| Faire évoluer le dossier | `advancePreclientServiceCase` | Personnel + preuve serveur |
| Présenter un dossier au bon client | `publicPreparedCaseView` | Session tenant authentifiée après rattachement formel |
| Étudier une bascule | `planPortabilityCutover` | Préparation informative, jamais exécution |
| Déclencher des échanges inter-opérateurs | Moteur existant `portability-automation.mjs` | **Interdit sans contrat, connexion et décision GO** |

L'extension future du cockpit sera un onglet ou panneau de la rubrique existante **Portabilité / Demandes**, et non un nouveau tableau de bord. L'extension future de `client.html` affichera dossier, pièces manquantes et historique à partir des données explicitement autorisées, sans agrégats provenant d'autres unités.

## 7. Notifications et automatisation, en préparation

Les étapes génèrent des **brouillons de notifications** sans destinataire ni envoi. Le futur moteur devra :
1. Enregistrer la transition et son événement dans une seule transaction.
2. Créer la notification outbox une seule fois par `(dossier,événement,référence)`.
3. Vérifier l'identité et les préférences du destinataire via le fournisseur de contact sécurisé.
4. Après levée du gel et autorisation, dispatcher les **notifications transactionnelles** via le domaine Resend Audiotel et enregistrer un identifiant fournisseur.
5. Prévoir les relances pour pièces manquantes uniquement suivant des délais et des règles approuvées, sans harcèlement ni envoi immédiat actuellement.
6. Conserver les réponses prospect dans HubSpot uniquement si un traitement licite et un rapprochement par référence `APP-CASE` sont prévus, sans ajouter un nouveau pipeline par défaut.

La file de tâches existante `work_queue` gère les retentatives, leases, heartbeat et dead-letter pour la portabilité client. La future passerelle devra s'y raccorder, **pas créer une deuxième file**.

## 8. RIO, numérotation et garanties réglementaires

- Décision Arcep 2022-2148 pour les procédures de portabilité SVA : références, mandat, RIO et obligations d'opérateurs. Le RIO ne constitue pas à lui seul la preuve de titularité.
- Annexe du plan de numérotation mise à jour en 2026 : préfixes RIO des numéros spéciaux `F0` à `ZZ`. Le module de normalisation étend sa reconnaissance aux préfixes actuels en préservant le parcours historique pour ne pas rompre les dossiers existants. Le checksum local **ne remplace pas l'authentification de la source ni l'acceptation opérateur**.
- Numéros 08 : interdiction depuis 2018 de nouvelles mises à disposition entre opérateurs. Pour un nouveau numéro distribué en notre nom, vérifier la titularité de ressources attribuées par Arcep et le rôle d'exploitant.
- 1er juillet 2028 : exigence du préfixe de routage propre pour l'exploitant de numéros portés selon les règles mises à jour.
- Règles déontologiques AF2M applicables depuis le 1er septembre 2026.

Sources :
- https://www.arcep.fr/mes-demarches-et-services/acteurs-regules/operateurs-telecoms/fiches-pratiques/operateurs-telecoms-affectation-des-numeros-de-telephone.html
- https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000047521711
- https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000054122970
- https://af2m.org/rd-sva/

## 9. Points impossibles à qualifier de « terminés » sans tiers externes

- Aucun numéro réellement attribué à Audiotel Premium Pro par l'Arcep.
- Pas de contrats opérateurs, de capacité de livraison SIP, de CDR certifiés ni de portage reçu en production.
- Pas de procédure inter-opérateurs signée, de commande physique de numéro, de transition contrôlée entre donneur et receveur, ni de preuve de retour réseau.
- Absence de dispositif opérationnel PSP/bancaire et comptable complet pour reversements.
- Compte Stripe Audiotel, envoi Resend et liaison HubSpot vers les nouveaux dossiers non activés.
- Aucune nouvelle route d'API, aucun écran ou panneau de cockpit publié : il faudra une intégration supervisée après autorisation.
- Les données fictives locales ne démontrent pas la robustesse sur 200 clients simultanés.

## 10. Sécurité du gel et livraison

- Tous les nouveaux fichiers sont sur `prep/chaine-telecom-operateur-20261108`, PR GitHub **brouillon**, non fusionnée.
- SQL 090 puis 091 vérifiables **seulement sur base CI PostgreSQL temporaire**, non installées dans Neon.
- Pas de modification aux fichiers HTML/CSS du site public et du Pôle ; pas d'inscription libre.
- Pas de changement en production Vercel, Neon, Resend, HubSpot ou opérateur.
- La dernière production Vercel reste `5a40538cb25128f15bb06ac9ee993aebbf003292`.
- Levée du gel, signature des contrats et approbation de mise en service nécessitent des ordres distincts et explicites du propriétaire.

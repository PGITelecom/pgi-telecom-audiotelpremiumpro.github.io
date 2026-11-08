# Audiotel Premium Pro | Préparation de l'infrastructure d'opérateur exploitant SVA

Date : 08/11/2026. **AUCUN DÉPLOIEMENT, AUCUN APPEL, AUCUN OPÉRATEUR CONNECTÉ.**
Ces fichiers constituent un dossier technique isolé, **non actif**, qui complète la
logique de routage et d'ingestion FreeSWITCH déjà existante. Ils n'activent rien.

## 1. Architecture cible et responsabilités

L'opérateur exploitant Audiotel Premium Pro est, si Arcep l'autorise,
**attributaire direct** des ressources 081/082/089. Il contracte directement
avec ses professionnels. Une entreprise tierce ne doit pas remplacer cette
relation par un modèle de simple revendeur.

\`\`\`text
Appelant fixe/mobile
  -> opérateur de départ/facturation et opérateur(s) de transit
  -> interconnexion et collecte de gros contractuelles
  -> SBC primaire/secondaire (Kamailio ou équipement équivalent)
     | Contrôle d'IP/certificat/transport, anti-fraude et SIP
     v
  -> FreeSWITCH A/B (média, annonces tarifaires, SVI, files d'attente)
     | DNIS exact + numéro E.164 + identité de trunk vérifiée
     v
  -> backend Audiotel : numéro -> affectation client -> route autorisée
     | refus fermé si client, droit, destination ou capacité absent
     v
  -> PBX/ligne SIP/numéro de destination autorisé du professionnel
     |           |
     |           +---- événements CDR FreeSWITCH, qualité et incidents
     v
  -> CDR du collecteur + CDR FreeSWITCH, rapprochement par identifiants
  -> contrat rémunération et preuves de règlement
     |          |
     |          +---- versement DIRECT aux IBAN professionnels (opérateur/PSP)
     +--------------- rémunération séparée Audiotel Premium Pro
\`\`\`

**Nouveau dans ce sous-dossier** :
- \`network-core.mjs\` : inventaire hors ligne des trunks, nœuds média A/B,
  clients, ressources candidates, destinations SIP/numéros E.164.
  Validation stricte des permissions, contrôle de capacité et des chemins
  secondaires. Décisions de simulation **sans établissement d'appel**.
- \`renderKamailioDispatcherForLab()\` : génère une liste de destinations
  de dispatcher à partir de **seules IP privées RFC1918** et d'une
  topologie explicitement simulée. Ne crée aucune ACL d'opérateur réelle.
- \`cdr-reconciliation.mjs\` : rapproche deux extraits CDR minimisés,
  signale doublons, durées incohérentes, DNIS et tenants différents,
  ainsi que les appels présents d'un seul côté. **Aucun calcul de paiement**.
- Tests : \`tests/audiotel-telecom-network-core.test.mjs\` et
  \`tests/audiotel-telecom-cdr-reconciliation.test.mjs\`.

**Déjà existant et conservé** :
- \`backend/server.mjs\` :
  \`GET /api/v1/internal/routing/next-destination\`,
  \`GET /api/v1/internal/routing/next-destination/text\`,
  \`POST /api/v1/ingest/freeswitch\`, et endpoints de libération.
  Les routes internes utilisent une authentification téléphonique privée.
- \`backend/src/cdr-freeswitch.mjs\` :
  normalisation des horodatages, durées, masquage/empreinte appelant,
  état, codec, RTP et mesures de qualité.
- \`telephony/README.md\` : contrat d'interconnexion technique, DNIS,
  isolation des éditeurs et portabilité.
- \`backend/src/audiotel-telecom-chain-preflight.mjs\` :
  preuves réglementaires, opérateur, réseau, finance et sécurité,
  **jamais une permission de lancer en production**.

## 2. Contrats réseau indispensables et non disponibles actuellement

| Périmètre | Données ou preuves manquantes |
|---|---|
| Arcep | Identité légale admissible, ressources réellement attribuées, CE si requis, décision et séries SVA |
| SIP entrant | Fournisseur de collecte, IP/CIDR ou certificats d'authentification, DNIS et marqueurs de provenance |
| SIP sortant | SBC/terminaisons vers destinataires, destination autorisée, politique de transferts |
| Réseau | 2 machines/instances distinctes, adresses, routage IP, pare-feu, DNS, failover, coût, latence |
| Sécurité | ACL opérateur, TLS/SRTP selon contrats, limitation CPS/concurrence, anti-fraude, sécurité des secrets |
| Réglementaire | Message gratuit d'information tarifaire / obligations SVA applicables, traitement des réclamations |
| Portabilité | Procédure et mandats dédiés SVA, synchronisation des préfixes/référentiels, éligibilité |
| Données | Identifiants CDR opérateurs, preuve d'origine, délai de livraison, correction et fraude |
| Finances | Barèmes de gros, coûts variables, paiement direct aux professionnels, preuve bancaire |
| Résilience | Recettes de coupure de SBC/FS, sondes SIP, journalisation sécurisée, sauvegarde et PRA |

**Interdiction de supposer** des IP opérateur, droits Arcep, identités, clés,
certificats, barèmes ou règles SIP que nous n'avons pas reçus contractuellement.

## 3. Règles de routage et sécurité

- DNIS validé *par le fournisseur d'interconnexion*, format E.164 canonique.
  Les alias opérateur éventuels sont configurés explicitement dans le backend
  existant ; ne jamais deviner un numéro en supprimant un préfixe.
- **Association exacte** entre un numéro SVA, son éditeur et ses destinations.
  Aucune route ne peut se rabattre sur le PBX d'un autre professionnel.
- Aucun numéro non affecté, éditeur suspendu ou non validé, trunk inconnu
  ou destination non autorisée ne peut provoquer une connexion.
- Appliquer une validation d'éligibilité/KYB avant mise en service, et
  limiter le routage aux destinations vérifiées. Éviter les boucles
  vers d'autres numéros premium : risque de fraude et de coûts.
- Gérer les secours de manière déterministe. Si les deux sorties sont
  indisponibles, **refuser l'appel** plutôt que router arbitrairement.
- En production, ne jamais exposer les endpoints internes derrière
  le proxy HTTP public. FreeSWITCH/Kamailio et leurs APIs de gestion
  doivent être séparés par firewall et par réseau.
- Les secrets d'authentification sont injectés hors Git, via un gestionnaire
  de secrets. Le flux de routage JSON/texte du backend ne constitue pas une
  authentification de l'appel d'origine.
- Mettre en place la protection contre la saturation CPS, SIP fuzzing,
  INVITE floods, appels automatisés et trafic à tarification majorée abusif.

## 4. Design du dossier de simulation

Le modèle impose \`environment: isolated_offline_simulation\`. Les états
\`simulated_assigned\`, \`simulated_healthy\`, \`simulated_active\` et
\`simulated_verified\` **ne sont pas des validations réglementaires réelles**.

Les résultats contiennent toujours :
\`operational_call_authorized:false\`,
\`telecom_network_connected:false\`, \`payout_authorized:false\`.

Le module de réconciliation n'enregistre **aucune identité d'appelant**,
aucun IBAN ni montant financier, et retourne \`payments_authorized:false\`.

Pour exécuter les tests **uniquement en CI, dans une copie du dépôt** :
\`\`\`bash
node --test tests/audiotel-telecom-network-core.test.mjs
node --test tests/audiotel-telecom-cdr-reconciliation.test.mjs
\`\`\`

## 5. Passage réel à l'exploitation : validation distincte obligatoire

Le chemin de passage à l'exploitation n'est **pas implémenté/activé** ici.
Avant tout déploiement, il faudra :

1. Décision Arcep confirmée, modèle de personne morale ou EI admissible
   et numéro de téléphone réellement attribué.
2. Contrats de collecte, d'interconnexion, droits des réseaux, SIP/trunks,
   profil de tarification et signaux réglementaires, dont les annonces SVA.
3. Installations et durcissement de Kamailio/SBC et FreeSWITCH sur des
   machines autorisées, distinctes et supervisées, avec TLS/SRTP si requis.
4. Authentification robuste des trunks, ACL réelles, authentification
   du backend interne, journalisation et secret manager.
5. Intégration du backend existant, après test des contextes FreeSWITCH
   et validation de l'isolement réel par tenant sur deux sorties de secours.
6. Contrôle bout-en-bout : appels réels autorisés, CDR, identification
   opérateur, portabilité, expiration et bascule, coûts de fraude.
7. Vérification des contrats de paiement direct aux professionnels,
   rémunération Audiotel séparée, conformité fiscale/comptable.
8. Accord **explicite** du dirigeant pour chacun des déploiements, coûts,
   commandes, engagements et migrations.

**La capacité technique du dépôt ne donne pas un droit d'exploiter les
ressources Arcep ni de capter ou transférer les fonds des professionnels.**

## Sources primaires vérifiées

- Arcep, attribution et affectation des numéros aux clients :
  https://www.arcep.fr/mes-demarches-et-services/acteurs-regules/operateurs-telecoms/fiches-pratiques/operateurs-telecoms-affectation-des-numeros-de-telephone.html
- Arcep, plan de numérotation et obligations SVA :
  https://www.arcep.fr/la-regulation/grands-dossiers-thematiques-transverses/la-numerotation.html
- Kamailio dispatcher, sélection et bascule des nœuds :
  https://www.kamailio.org/docs/modules/stable/modules/dispatcher
- FreeSWITCH, accès XML dynamiques :
  https://developer.signalwire.com/freeswitch/integration/xml-curl/
- FreeSWITCH, contrôle d'accès :
  https://developer.signalwire.com/freeswitch/integration/acls/

**Gel absolu** : pas de production Vercel, pas de migration Neon,
pas d'achat, pas de contact opérateur, pas de création de numéro,
pas de virement ni de signature.

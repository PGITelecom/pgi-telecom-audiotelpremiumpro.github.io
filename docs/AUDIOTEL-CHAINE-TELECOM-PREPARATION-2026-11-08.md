# Audiotel Premium Pro : dossier maître de préparation de la chaîne télécom
Date de référence : 8 novembre 2026. Statut : **PRÉPARATION SUR BRANCHE ISOLÉE**.
Propriétaire de l'offre : Audiotel Premium Pro. Pôle Télécom & Réseau : infrastructure technique cible.

> GEL EXPLICITE : aucun déploiement Vercel, aucune migration ni écriture Neon, aucune fusion vers main, aucune activation commerciale, aucun paiement, aucune commande de numéros, aucun contact/contrat externe envoyé et aucun achat sans nouvelle autorisation de l'exploitant.

## 1. Objectif contractuel non négociable

Audiotel Premium Pro veut conclure **directement** avec chaque éditeur professionnel. Ne pas se présenter comme apporteur d'affaires ni comme revendeur d'un abonnement contractuellement fourni par Remmedia ou un autre opérateur. La société fournissant le service téléphonique doit assumer sa qualité d'opérateur exploitant et, sauf portabilité conforme, obtenir sa propre attribution de ressources 08 par l'Arcep. L'acheminement, la collecte et la plateforme média peuvent être **des prestations de gros sous-traitées**, mais les droits réglementaires, la responsabilité client et la conformité ne sont pas automatiquement transférés au sous-traitant.

La marque commerciale reste « Audiotel Premium Pro ». La structuration applicative `audiotel_platform` et le prototype `direct_sva` du Pôle restent séparés tant qu'une architecture de consolidation validée ne précise pas les droits et les mouvements entre activités.

## 2. Réalité constatée en production le 08/11/2026 (lecture seule)

- Vercel : `READY`, publication `5a40538cb25128f15bb06ac9ee993aebbf003292`; le site de présentation et les interfaces sont en ligne.
- Neon `pgi_telecom` : migration `085_direct_sva_admin_editorial_release`; `commercial_operation_enabled=false`.
- Dans la branche de données `direct_sva` : 0 compte, 0 dossier, 0 numéro inventorié, 0 bloc.
- Dans le référentiel commun : 0 opérateur, 0 interconnexion et 0 contrat opérateur enregistrés.
- Absence de preuve contractuelle de gros, de décisions d'attribution Arcep, de trafic SIP réel et de flux CDR/règlements certifiés.
- Ces constats ne signifient pas que le site ne reçoit aucun prospect, ni que les composants de simulation sont absents.

## 3. Architecture cible : contrôle distinct du transport de voix

```text
Appelant fixe / mobile
    ↓
Opérateurs de boucle locale + transit/collecte SVA (prix et MGIT validés)
    ↓ ouvertures nationales et route de secours
Interconnexion opérateur(s) : SIP/SIP-I selon contrat
    ↓
SBC A (filtrage/ACL, topology hiding, protection fraude) ⇄ SBC B (secours)
    ↓
FreeSWITCH A (SVI, files, ponts) ⇄ FreeSWITCH B (secours)
    ↓                                        ↘
Destinations B2B du tenant exact              CDR technique append-only
    ↓                                             ↓
Session terminée                               Ingestion idempotente
                                                  ↓
                                    CDR opérateur signé / SFTP sécurisé
                                                  ↓
                              Rapprochement des durées et tarifs contractuels
                                                  ↓
                               Relevés opérateur et fonds vérifiés par PSP/banque
                                                  ↓
                               Ledger, fonds bloqués, marge, dette éditeur
                                                  ↓
                                  Reversement autorisé / reçu bancaire
                                                  ↓
                           Reporting cloisonné par client, cockpit interne
```

**Placement** :
- Vercel : site, formulaires, API de contrôle, administration, cockpit, déclenchement d'ordres et affichages, hors chemin média critique.
- Neon PostgreSQL : référentiels, droits et contrats, commandes, états durables, CDR normalisés, rapprochements et piste d'audit, avec rétention justifiée et dimensionnement à confirmer.
- **Hébergement voix distinct 24 h/24** : au minimum SBC + moteur SIP/RTP sur calcul dédié disposant de ports et IP exploitables, réseau stable, support et sauvegardes. **Ne pas acheminer le média RTP ou maintenir les sessions SIP sur les fonctions HTTP Vercel**.
- Le réseau 24 h/24 n'implique pas d'acheter une fibre physique : un ou plusieurs partenaires d'interconnexion IP et une infrastructure serveur dédiée peuvent fournir la connectivité sous réserve de contrat.
- Prévoir deux zones de défaillance indépendantes en cible ; le mono-nœud éventuel d'une future recette technique n'est pas qualifié de haute disponibilité.

## 4. Les douze chaînes de responsabilités à préparer

| N° | Sous-système | Entrées fiables exigées | Sorties attendues | Statut |
|---|---|---|---|---|
| 01 | Identité opérateur | Personne morale, qualification juridique, identifiant CE si requis | Dossier Arcep, responsables désignés | Non vérifié |
| 02 | Numérotation | Décision Arcep, catégorie 081/082/089, blocs, titulaire | Inventaire propriétaire et historique, 80 % d'utilisation avant ouverture de nouveaux sous-blocs selon règles | Sans attribution |
| 03 | Conditions SVA | CGS AF2M, RSVA, tarifs, signalétique et MGIT | Référentiel public, conformité anti-fraude | Non validé |
| 04 | Interconnexion | Convention de gros, IP, capacités, ouverture nationale | SIP accepté depuis plusieurs réseaux, plans de secours | Aucun contrat |
| 05 | SBC / sécurité voix | ACL opérateur, authentification, codecs, TLS si possible, seuils | SIP filtré, limite fraude, résilience | Non déployé |
| 06 | IVR et acheminement | DNIS vérifié, tenant, destinations autorisées, paramétrage MGIT | SVI, routage et renvoi exclusivement vers le bon client | Logiciel préparatoire uniquement |
| 07 | Portabilité | Mandat, référence portage, protocole et accord opérateurs | Portage confirmé, historique immuable et rollback | Non raccordé |
| 08 | CDR | Appel FreeSWITCH et relevé opérateur, ID corrélables | Horodatages UTC, durées distinctes, dédoublonnage et écarts | Modules présents, aucune donnée opérateur réelle |
| 09 | Tarif et rentabilité | Tarif HT, règles de durée, collecteur, éditeur, frais réseau | Marge prouvée en € / minute et par période | Non contractuel |
| 10 | Comptabilité et collecte | Relevés authentifiés, fonds banque, régime de TVA, PSP | Créances, fonds en transit, dette éditeur, rapprochement | Aperçus non activants |
| 11 | Espace client | Authentification, KYB, consentement, droits tenant | Numéros et statistiques autorisés par entité | Interface prête en partie |
| 12 | Exploitation | SLA, supervision SIP/RTP, NOC, incidents, sécurité et PRA | Astreinte, alarmes, restauration et procédure de coupure | Non démontré |

## 5. Orchestration d'une demande de numéro neuf

1. `INTENT_CREATED` : identité du demandeur et catégorie, clé d'idempotence, tenant.
2. `KYB_PENDING` : identité juridique, établissement EEE/AELE pour 08 majorés, service, coordonnées réclamations, usage autorisé.
3. `CONTRACT_PENDING` : contrat Audiotel signé, grille tarifaire acceptée, documents en stockage privé ; jamais de secrets ni copies d'identité dans le Git.
4. `RIGHTS_PENDING` : droits d'utilisation Arcep, catégorie, bloc, identité de l'opérateur exploitant et obligations vérifiés.
5. `NUMBER_HELD` : réservation atomique temporaire seulement sur inventaire juridiquement exploitable, avec expiration, journal et verrou d'unicité.
6. `CARRIER_PENDING` : commande opérateur idempotente / ACK réellement authentifié, preuve d'ouverture sur les réseaux.
7. `MEDIA_PENDING` : configuration SBC, SVI et DNIS, destination vérifiée et interdiction de cross-tenant.
8. `BILLING_PENDING` : droit d'abonnement validé par webhook de paiement authentique, et non par retour navigateur (uniquement lorsque les paiements seront autorisés).
9. `INDEPENDENT_APPROVAL` : double contrôle juridique/réseau/finance signé.
10. `ACTIVE` : émission seulement après accord explicite de lancement et tous les contrôles physiques réels ; activation strictement absente dans la présente branche.

Un échec technique n'entraîne jamais automatiquement un passage à ACTIVE ; délai, duplicata, fraude, annulation et retour arrière doivent conserver une preuve immuable.

## 6. Portabilité et bascule

Pour une portabilité : demande et mandat vérifiés, confirmation du détenteur actuel, identifiants de portage requis, comparaison du palier, date/fenêtre de coupure, routage préchauffé, opérateurs informés, acquittement réel, échantillon d'appels fixes et mobiles, CDR des deux opérateurs, secours prêt. Un simple changement de table locale n'est pas une portabilité.

Les numéros portés doivent anticiper le changement de règles de préfixes de routage du 1er juillet 2028. Ne jamais supposer que les procédures RIO des numéros fixes ou mobiles s'appliquent toutes automatiquement à la catégorie SVA : demander la spécification correspondante au partenaire et aux instances compétentes.

## 7. CDR, réconciliation et anti-fraude

Contrat commun d'événement, sans numéro appelant brut par défaut :
```json
{
  "business_unit": "audiotel_platform",
  "source": "carrier_verified_or_freeswitch",
  "source_event_id": "unique_external_reference",
  "operator_reference": "verified_carrier",
  "sva_number": "+3389XXXXXXX",
  "tenant_reference": "internal_authorized_tenant",
  "started_at": "2026-11-08T00:00:00Z",
  "answered_at": null,
  "ended_at": "2026-11-08T00:01:00Z",
  "conversation_seconds": 0,
  "payout_eligible_seconds": 0,
  "currency": "EUR",
  "operator_statement_reference": null
}
```

Ces valeurs sont un **contrat de structure fictif**, pas un événement réel. Ne jamais faire confiance à la durée facturable calculée uniquement par FreeSWITCH : la durée éligible au reversement dépend du contrat et du CDR opérateur.

Invariants : unicité `(source, operator, call_id)`, ordre chronologique, horodatage UTC, conservation distincte de `total_seconds`, `conversation_seconds`, `billable_seconds` et `payout_eligible_seconds`, corrections en écritures compensatoires, rapprochement des lignes opérateur et du flux bancaire, impossibilité de déplacer un appel d'un tenant vers un autre après import.

Anti-fraude : quotas par numéro/tenant, durée maximum contractuelle, fréquence inhabituelle, destinations premium suspectes, liste d'usages exclus, détection de trafic circulaire, suspension conservatoire avec piste d'audit et intervention humaine.

## 8. Flux financier sans transit bancaire non autorisé

```text
Facture de l'appelant
  → opérateur de départ, facturation/collecte
  → relevé et règlement de gros confirmé
  → reconnaissance de marge selon contrat + normes validées
  → obligation de reversement au client B2B
  → PSP / paiement bancaire autorisé (contrat ou mandat valide)
  → preuve d'ordre + preuve de règlement, sans double paiement
```

**Blocage dur** si absence d'un des éléments suivants : statut principal/mandataire validé, droits d'encaissement tiers, PSP agréé ou agent déclaré selon montage, justificatif KYB, conditions contractuelles, règlement opérateur authentifié, banque réconciliée, comptes et TVA validés, aucune contestation/gel.

Le paiement des abonnements SaaS par Stripe est **juridiquement et techniquement distinct** du reversement des minutes SVA. Ne pas créer automatiquement un transfert Stripe Connect ni déclencher un virement Revolut sans analyse et autorisation.

## 9. Contrôles préalables absolus

Critères GO à prouver par documents authentifiés, tests réseaux de bout en bout et décision humaine :
- Arcep : opérateur et droits d'exploitation du numéro, décision de ressources/portage, conformité éditeur.
- Contractuel : contrat wholesale signé (pas de simple offre de revente), collecte et barèmes HT, responsabilité de l'ouverture sur tous réseaux, NOC/SLA.
- Technique : deux voies de secours, ACL/SIP, MGIT, DTMF, RTP, DNIS préservé, 100 % des tests d'isolation client, appel émis depuis fixe et mobile, anti-fraude.
- Données : CDR FreeSWITCH et opérateur rapprochables, export authentifié, correction/dédoublonnage, conservation conforme, PRA démontré.
- Finance : contrats PSP et banque vérifiés, clauses de responsabilité, montants nets, gestion impayés et chargebacks, preuve de fonds, piste d'audit.
- Commercial : commandes idempotentes, consentements et KYB, parcours de résiliation/portabilité, support, abonnements, tarifs exacts.
- Gouvernance : revue indépendante, validation explicite de l'utilisateur, levée formelle de l'interdiction de déployer.
Même si tous les éléments techniques étaient simulés dans le code, **le GO resterait interdit** tant que les preuves réelles et l'approbation expresse manquent.

## 10. Contrôles de capacité pour l'objectif 200 clients

Dimensionner sur la **simultanéité maximale réelle**, pas sur le seul nombre de clients.
Mesurer : appels/h en heure chargée, appels simultanés, secondes de session, taux de prise, temps de setup SIP, pertes et jitter RTP, pics de requêtes CDR, import du relevé et croissance stockage. Obtenir du prestataire la facturation des canaux simultanés, le plafond de session, le coût de débordement et les mécanismes de montée en charge. Aucun dimensionnement à 200 conversations simultanées n'est actuellement démontré.

## 11. Répartition du travail, sans gaspillage

**Préparable gratuitement en code isolé** : architecture, contrats d'API, modèles de preuve, commandes idempotentes, règles de routage par tenant, modèles CDR, imports, schémas SQL de migration NON APPLIQUÉS, tableau de bord, journal d'audit, dossier de consultation, procédures de secours.

**Dépendances externes nécessaires** : validation de la personne morale et des droits Arcep, AF2M/RSVA, convention opérateur + paramètres IP/SIP, tarification grossiste, PSP/banque, infrastructure voix dédiée, factures et conditions contractuelles, expertise juridique/comptable.

**Politique 1 000 €** : plafond total envisagé, pas un ordre de dépense. Aucun versement, hébergement supplémentaire, abonnement wholesale ni demande payante ne doit être lancé sans devis détaillé et consentement distinct.

## 12. Statut d'exécution et séparation des environnements

- Site actuel : conserver design, logo et navigation ; aucun changement.
- Branche GitHub : matériel préparatoire uniquement, sans merge.
- Neon : migrations existantes inchangées ; aucun `CREATE`, `ALTER`, `INSERT`, `UPDATE`, `DELETE`.
- Vercel : aucune nouvelle release ni changement de projet.
- Télécom, AF2M, Arcep, PSP : aucun nouveau contrat signé ni équipement réellement mis en ligne.
- Le travail peut être poursuivi dans la branche, avec une revue future puis un feu vert explicite de l'utilisateur.

## Sources officielles consultées

- Arcep, affectation des numéros, 23/09/2026 : https://www.arcep.fr/mes-demarches-et-services/acteurs-regules/operateurs-telecoms/fiches-pratiques/operateurs-telecoms-affectation-des-numeros-de-telephone.html
- Arcep, identifiant CE, pas de déclaration préalable : https://extranet.arcep.fr/communications-electroniques/identifiant-ce/demande-identifiant-ce
- Arcep, attribution et taxes : https://www.arcep.fr/la-regulation/grands-dossiers-thematiques-transverses/la-numerotation/taxes-de-numerotation.html
- AF2M, recommandations SVA 2026 : https://af2m.org/rd-sva/
- AF2M, souscription CGS SVA : https://af2m.org/souscrire-aux-cgs-sva/
- Orange Wholesale, interconnexion / collecte SVA : https://wholesale.orange.com/france/fr/nos-solutions/interconnexion/fixe/service-a-valeur-ajoutee/
- ACPR, fonds pour compte de tiers : https://acpr.banque-france.fr/en/node/26817
- ACPR, agents de PSP : https://acpr.banque-france.fr/en/node/34396

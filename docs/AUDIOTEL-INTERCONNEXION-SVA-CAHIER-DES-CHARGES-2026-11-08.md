# Cahier des charges de consultation : interconnexion, collecte et exploitation SVA
Émetteur commercial : **Audiotel Premium Pro**. Date : 08/11/2026.
Statut : **BROUILLON INTERNE NON ENVOYÉ**. Pas de commande ni de dépense.

## 1. Objet précis de la consultation

La société porteuse de la marque Audiotel Premium Pro prépare une activité d'opérateur SVA B2B en France métropolitaine pour des éditeurs professionnels de plusieurs secteurs. Elle veut être **le cocontractant exploitant des numéros qu'elle affecte**, idéalement attributaire de ses blocs 081/082/089 auprès de l'Arcep, avec une plateforme informatique et commerciale qu'elle exploite elle-même. Elle souhaite acheter **des prestations d'interconnexion, de transport, d'ouverture des ressources et de collecte de gros**, non une offre « numéro SVA clé en main » revendue avec le contrat d'un concurrent au client final.

Merci de confirmer par écrit la faisabilité de ce schéma juridique précis. Si votre offre requiert de devenir intermédiaire commercial d'un opérateur attributaire tiers, l'indiquer explicitement : elle ne correspond pas à notre cible.

**Aucune demande de portage ni d'ouverture réseau n'est actuellement passée.**

## 2. Identification du fournisseur et droits de numérotation

Réponses obligatoires :
- Dénomination juridique, SIREN, qualité d'opérateur, coordonnées NOC/administration.
- Catégories 081, 082, 089 acceptées et restrictions d'usage.
- Protocole permettant d'exploiter des numéros officiellement attribués à Audiotel Premium Pro, ou des numéros portés vers elle.
- Rôle exact : transit, opérateur de boucle locale, collecteur de service SVA, livraison d'appel, plate-forme média ou paiement.
- Responsabilité contractuelle pour l'ouverture des numéros et les tarifs sur chaque réseau fixe/mobile, y compris blocage géographique/fraude.
- Prérequis Arcep : CE, décision d'attribution, préfixe de routage, numéros portés, RSVA, AF2M, références de signalétique.
- Devoirs de surveillance et de mise à jour des informations éditeur (nom de service, descriptif, entreprise, coordonnées de réclamations).
- Existence d'une convention d'interconnexion SVA dédiée, distincte d'un simple trunk VoIP.

## 3. Informations tarifaires à fournir, sans omissions

Renvoyer une grille **en EUR HT**, pour chaque tarif applicable, palier, type d'accès fixe/mobile et réseau, contenant :

| Champ | Réponse du fournisseur |
|---|---|
| Catégorie et palier exact, mode à la minute / à l'appel | À compléter |
| Prix maximal facturable à l'appelant et part service | À compléter |
| Montant collecté théorique par minute / appel | À compléter |
| Commission opérateur de départ ou transit | À compléter |
| Frais d'ouverture et de modification de ressources | À compléter |
| Coût par canal SIP et capacité simultanée | À compléter |
| Frais CDR, rapport et API / SFTP | À compléter |
| Frais de portabilité, annulation et intervention | À compléter |
| Abonnement mensuel, engagement minimum, dépôt de garantie | À compléter |
| Taux ou montant de retenue fraude / impayé / chargeback | À compléter |
| Délai de règlement, réserve et ajustements rétroactifs | À compléter |
| Maintenance, astreinte, ouverture sur nouveaux réseaux | À compléter |
| SLA, incidents, résiliation et restitution / portabilité sortante | À compléter |

**Critère de sélection économique** : marge réelle cible >= **0,07 EUR par minute éligible** APRÈS coûts de collecte, transit, média, taxes ou frais variables, fraude/impayés pris en compte et reversement promis à l'éditeur, avant les coûts généraux fixes et impôts. Ne jamais garantir cette marge avant signature des barèmes et vérification des durées réellement rémunérées. Pour les 081 plafonnés à 0,05 EUR HT/minute de service, cet objectif par minute n'est structurellement pas atteignable sur la seule composante SVA ; chiffrer les paliers séparément.

**Formule de calcul à vérifier** :
```
marge_eligible_ht =
  paiement_operateur_effectivement_acquis
  - dette_vers_editeur_contractuelle
  - collecte_et_transit
  - frais_variables_media
  - couts_fonds_de_tiers_et_retenues_non_recouvrables
  - autres_couts_variables_documentes

marge_eur_par_minute_eligible =
  marge_eligible_ht / (secondes_eligibles_confirmees / 60)
```

Ne pas confondre montant facturé à l'appelant, montant encaissé par l'opérateur, reversement annoncé, montant contractuellement dû et virement bancaire effectué. En cas de durée éligible nulle, le ratio ne doit pas être calculé.

## 4. Voix : profil technique à recevoir avant configuration

Fournir une annexe technique signée :
- Origine des appels et moyens d'acheminement : SIP, SIP-I ou conversion éventuelle, réseau destinataire et protocole de signalisation.
- FQDN et adresses IP publiques autorisées : SBC primaire et secondaire côté fournisseur, ports et transports UDP/TCP/TLS, authentification IP / mTLS / digest selon contrat, certificats.
- Plan DNIS au format canonique E.164 ou national, règles de normalisation **contractuelles**, préservation du numéro réellement appelé.
- CLI / P-Asserted-Identity / Privacy, traitement des anonymes, Diversion, History-Info et en-têtes autorisés.
- SDP, codec PCMA/PCMU/Opus si proposé, DTMF RFC4733/SIP INFO, 100rel, PRACK, OPTIONS, Session-Expires, re-INVITE, REFER, early media.
- RTP/SRTP, plages UDP, NAT, adresse SDP externe, flux unidirectionnels, chiffrement si pris en charge.
- Session limit, appels/seconde (CPS), burst, seuil de rejet SIP 486/503, timeouts, ordre des chemins de secours.
- Diffusion du **message gratuit d'information tarifaire (MGIT)** et responsable de sa mise en œuvre ; exclusion de la durée non rémunérée selon barème.
- Disponibilité et limite de durée des appels, durée de mise en relation, file d'attente, transfert vers destination.
- Plans de maintenance, horaires, destination test ou boucle de recette, règles de détection et coupure des appels frauduleux.
- Support technique 24/7, escalade NOC, SLA et credits de service, procédure P1, preuves de tests depuis plusieurs réseaux.

Ne placer **aucun mot de passe, adresse privée, token ou certificat** dans ce cahier des charges public GitHub. Les paramètres sensibles seront fournis via un canal sécurisé après contrat, puis stockés en gestionnaire de secrets.

## 5. Interfaces de commande opérateur (si disponibles)

Demander API authentifiée, webhooks signés, SFTP scellé ou procédure opérationnelle sécurisée avec :
- `reserve_number` / `request_number_assignment` / `cancel_assignment` : référence idempotente client et fenêtre d'expiration.
- `open_network_resources` / `suspend_number` / `close_number` : ACK authentifié, date d'effet et preuve d'ouverture.
- `request_portability` / `portability_status` / `cancel_portability` : éligibilité, mandat, date, acteur source/cible, refus motivé, preuves de coupure.
- `subscribe_cdr` / `fetch_cdr` : reprise au curseur, anti-doublons et corrections.
- `fetch_operator_statement` / `fetch_payment_advice` : numéro de relevé, période, total, retenues, date prévue, date confirmée.
- `network_health` / `open_incident` : état par point d'interconnexion, maintenance et escalade.

Pour chaque API : schéma, contrôle d'authentification et signature, quotas, temps limite, codes d'erreur, répétitions et idempotence, versionnement, procédure de coupure et révocation.

Un HTTP 200 n'est jamais une preuve d'affectation juridique ou d'un vrai appel reçu. Exiger une preuve d'effet opposable et un identifiant indépendant.

## 6. CDR : contrat et rapprochement

Champs minimaux par appel :
```text
operator_id, external_call_id, internal_call_uuid,
called_sva_e164, ingress_network, origin_class,
start_utc, answer_utc, end_utc, cause,
total_seconds, conversation_seconds, billable_seconds,
payout_eligible_seconds, tariff_code, rate_version,
expected_amount_ht, confirmed_amount_ht,
correction_of_call_id, statement_id, file_digest
```

Préciser : fréquence de dépôt, fenêtre de complétude, timezone, durées arrondies, appels non aboutis, appels contestés, débit différé, correction et annulation, réconciliation d'un fichier avec un état bancaire, conservation et traces d'accès. Le numéro de l'appelant n'est pas exigé en clair dans les exports de pilotage standard.

On exige une référence unique et stable par appel, une preuve cryptographique ou canal authentifié du fichier, le contrôle d'intégrité et le retraitement idempotent. Les écarts sont isolés ; aucune variation ne doit être imputée silencieusement au client.

## 7. Portabilité, haute disponibilité, sécurité

- Référentiel de portabilité des numéros SVA propre au fournisseur : procédure précise, rôles, champs obligatoires, mandat, identification du numéro et du palier, fréquence de synchronisation, date effective, mécanisme de rollback.
- Refuser les procédures implicitement copiées d'un numéro mobile sans validation SVA.
- Deux SBC en zones de défaillance distinctes (cible), sauvegarde de configuration, failover, limites d'attaques SIP et appels surtaxés.
- Isolement des tenants, destinations approuvées, protection d'accès aux CDR et secret des communications.
- Fraude : trafic circulaire, multi-appels courts répétés, pics d'appels, chargeback, numéros interdits, droits de suspension d'urgence, responsabilités de compensation.
- Conformité aux recommandations SVA de l'AF2M applicables depuis le 01/09/2026.
- Avis et traitement d'incident / portage, plan de sortie sans captivité des numéros.

## 8. Questions impératives sur les fonds

1. Qui facture l'appelant ? Qui encaisse juridiquement en son nom ?
2. Qui doit les fonds à Audiotel Premium Pro ? À quelle échéance ?
3. Quel contrat autorise le versement à Audiotel Premium Pro au titre des appels de ses éditeurs ?
4. Quel PSP ou mandat d'agent permet ensuite les reversements à nos clients professionnels ?
5. Les montants peuvent-ils être reversés directement par un PSP agréé à l'éditeur en retenant la marge Audiotel, sans faire transiter des fonds tiers sur un compte non autorisé ?
6. Quelles preuves bancaires et quels relevés sont fournis pour justifier les rapprochements et corrections ?
7. Quelles réserves, échéances, seuils, recours, retenues et litiges s'appliquent ?
8. Quelle qualification comptable/TVA de la prestation est proposée ? Une analyse indépendante de notre conseil reste obligatoire.

## 9. Format exigé de réponse

Répondre **en un seul dossier** comprenant :
- Devis signé HT/TTC avec barèmes complets, frais récurrents, frais initiaux, minimum et durée d'engagement.
- Détails du régime juridique des numéros et du reversement.
- Exemple **anonymisé** de CDR et de relevé de règlement.
- Interface SIP et guide d'intégration technique.
- Description des APIs, procédures de portabilité et modalités de support.
- Liste complète des prérequis que doit fournir Audiotel.
- Délais estimés par étape, sans garantie d'ouverture avant approbation réglementaire.
- Accès de recette sans dépense ou engagement, si disponible.

**Critère éliminatoire** : modèle imposant qu'un tiers soit le cocontractant de nos éditeurs pour les numéros neufs ou absence de preuve des droits réglementaires, sauf proposition distincte et expressément présentée comme alternative que nous déciderons éventuellement d'étudier.

## 10. Destinataires de consultation possibles

- Orange Wholesale France : interconnexion et SVA, offre officielle, demander les prérequis d'un opérateur exploitant attributaire.
- Autres opérateurs disposant d'une vraie prestation de gros : ne pas déduire leur compatibilité de leur simple catalogue B2B ou d'un programme de revendeurs. Demander une confirmation documentaire de leur capacité d'interconnexion et de collecte au bénéfice d'un exploitant tiers.
- AF2M : conditions générales SVA, annuaire et déontologie, séparément du fournisseur SIP.
- Arcep : identifiant CE et attribution de ressources, séparément du contrat d'interconnexion.
- PSP/ACPR : montage de paiement tiers et rôle d'agent/principal, séparément de Stripe Billing.

**Aucun envoi effectué**. Le cahier des charges est prêt à servir de base aux négociations lorsque l'exploitant le demandera.

### Références vérifiées
- https://www.arcep.fr/mes-demarches-et-services/acteurs-regules/operateurs-telecoms/fiches-pratiques/operateurs-telecoms-affectation-des-numeros-de-telephone.html
- https://www.arcep.fr/mes-demarches-et-services/consommateurs/fiches-pratiques/les-numeros-08-et-les-numeros-courts.html
- https://wholesale.orange.com/france/fr/nos-solutions/interconnexion/fixe/service-a-valeur-ajoutee/
- https://af2m.org/rd-sva/
- https://af2m.org/souscrire-aux-cgs-sva/
- https://acpr.banque-france.fr/en/node/26817

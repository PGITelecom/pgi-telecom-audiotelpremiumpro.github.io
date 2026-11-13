# Audiotel Premium Pro | Devenir exploitant contractuel SVA sans réseau physique local

**Statut : dossier de préparation, isolé dans une branche GitHub. Aucune fusion, aucun déploiement Vercel et aucune écriture Neon autorisés par ce dossier.**
**Date : 13 novembre 2026.**

## Décision stratégique

Le modèle commercial visé est : **Audiotel Premium Pro conclut directement les contrats télécom/SVA avec ses éditeurs, possède ses nouvelles ressources SVA attribuées par l'Arcep, conserve son CRM, les données et le support, et fait opérer la collecte/SIP et éventuellement la portabilité par un ou plusieurs opérateurs de gros.**

L'Arcep reconnaît la qualité d'opérateur au contractant du client final même lorsque le réseau, le trunk SIP et le portage sont sous-traités. Cette qualité emporte les responsabilités légales correspondantes. Les nouveaux numéros 08 doivent normalement être attribués directement à Audiotel, et non revendus en cascade entre opérateurs. Pour les numéros conservés par portabilité, respecter le cadre spécifique de portage. Le préfixe de routage propre pour numéros portés devient obligatoire le **1er juillet 2028**, y compris avec des équipements techniques délégués.

**Nous ne sommes pas encore opérateur actif** : la base observée le 13 novembre 2026 ne contient ni connexion opérateur validée, ni numéro exploitable, ni CDR réel, ni règlement direct. Une branche GitHub, un serveur Vercel et une base Neon ne créent pas un droit de numérotation ni une interconnexion SIP.

## Avantage économique : comment le calculer sans fausses garanties

Le bénéfice d'un opérateur contractuel ne provient pas automatiquement d'une tarification plus chère. Il vient de la **suppression d'un étage de commission**, de la négociation directe de gros, du contrôle du support et de la facturation séparée des prestations APP, sous déduction des frais fixes et obligations supplémentaires.

Par exemple, dans une **hypothèse purement illustrative** de 150 professionnels, 60 minutes *effectivement facturables* par jour, 22 jours par mois :

- Volume = **198 000 minutes/mois**.
- + **0,03 €/min** de contribution supplémentaire = **5 940 €/mois** avant nouveau surcoût fixe et fiscalité.
- + **0,05 €/min** = **9 900 €/mois** avant nouveau surcoût fixe et fiscalité.
- + **0,10 €/min** = **19 800 €/mois** avant nouveau surcoût fixe et fiscalité.
- Le seuil voulu de **0,07 €/min réellement conservé personnellement** requiert **13 860 €/mois dans la poche** à ce volume, après charges, impôts et cotisations applicables. Il ne suffit pas d'avoir 0,07 €/min de marge de la société.

Les volumes, prix de gros et fiscalités ci-dessus **ne sont pas des données observées**. Un modèle à coûts fixes plus élevés peut être moins rentable qu'un revendeur à faible volume. Une absence de contrat écrit empêche d'affirmer le gain.

### Données nécessaires pour comparaison objective

Par fournisseur et par segment 081/082/089, obtenir dans les mêmes unités et périmètres :
1. La rémunération contractuelle due **à Audiotel** par minute de trafic effectivement éligible, après les retenues opérateur, sans confondre recettes globales de service, commissions de tiers et revenus APP.
2. Les reversements dus aux éditeurs, réglés idéalement **directement par l'opérateur ou prestataire habilité aux IBAN des éditeurs**, et la preuve de chaque virement. Audiotel reçoit **séparément** ses propres commissions.
3. Les frais de mise en service, frais par numéro, portage, rotation, maintenance, SIP/SBC, API, CDR, fraude, impayés, remboursements, pénalités, taxes et minimums contractuels. Exclure les coûts déjà retenus dans les montants nets pour éviter les doubles déductions.
4. Les obligations légales, les coûts fixes (comptabilité, conformité, supervision, support, hébergement, assurance et résilience), la provision pour incidents et le coût de transition.
5. Une simulation validée par spécialiste fiscal en fonction du statut juridique, des charges déductibles et des modalités de rémunération : distinguer résultat société, prélèvements et net personnel.

Le module `backend/src/audiotel-operator-autonomy-economics.mjs` compare deux scénarios à partir de leurs **propres tarifs contractuels**, frais variables, frais fixes, investissement initial, minutes réelles et hypothèse de rétention personnelle. Il calcule le différentiel de résultat et le seuil de rentabilité. Il laisse les estimations **provisoires sans pièces externes** et ne saurait déclencher paiement, portabilité ou ouverture.

Attention : l'ancien garde-fou `backend/src/audiotel-margin-safety.mjs` compare une marge **avant frais fixes et prélèvements** avec un seuil à 0,07 €/min. Ce contrôle ne démontre pas votre objectif **personnel après fiscalité**. Le nouveau module évite de les confondre.

Les plafonds officiels HT de la **composante service par minute** sont notamment : 081 = 0,05 €/min ; 082 = 0,167 €/min ; 089 = 0,667 €/min (des paliers à l'acte existent également). À trafic et déductions comparables, la catégorie 089 offre un espace commercial plus large, mais aucune recette ni marge n'est garantie. Ne pas calculer une marge fictive à partir du tarif public maximum.

## Architecture technique cible : aucun équipement dans les locaux

```
Éditeur du service / client Audiotel
  -> Portail Audiotel, contrat, KYC, service, IBAN approuvé
  -> Registre de numérotation attribuée / portages validés (ARCEP/APNF)
  -> API d'orchestration (intention de commande + idempotence)
  -> Un ou plusieurs opérateurs de gros (collecte, réseau, SIP)
  -> Routage/SBC hébergé en datacenter, secours et monitoring
  -> CDR authentifiés -> inbox durable -> dédoublonnage -> rapprochement
  -> Tableaux client et contrôle des reversements
  -> Opérateur/PSP verse directement aux éditeurs (IBAN)
  -> Commission Audiotel distincte, preuves bancaires, comptabilité
```

Séparer 3 catégories de données : **trafic et routage**, **rémunération Audiotel**, **dette envers les éditeurs et preuves de versement de l'opérateur**. Ne jamais enregistrer la totalité du flux éditeur comme chiffre d'affaires Audiotel sans base comptable juridiquement validée.

### Fonctions existantes dans notre dépôt

- Portail, CRM, gestion clients et commandes préparées.
- Interrupteurs et diagnostics d'activité directe (`direct_sva`), non activés.
- Contrat d'adaptateur d'opérateur dans `backend/carriers/adapter-contract.schema.json`.
- Précontrôle spécifique APP et aperçu CDR dans `backend/src/audiotel-connection-preflight.mjs`.
- Préparation du routage, portabilité, flux CDR, rapprochement, relevés et facturation Stripe.
- Garde-fous comptables et marges **avant impôts** : utiles, mais pas une interconnexion effective.

### Travaux restant à accomplir après attribution, accords et documentation opérateur

- **Juridique** : entité signataire, identifiant CE, dossier d'attribution de blocs adaptés (1 bloc de 1 000 numéros à envisager initialement), conventions SVA et conditions contractuelles. La taxe ARCEP d'un bloc standard de 1 000 numéros est de **20 €/année civile**, hors frais techniques réels.
- **Accès réseau** : une interconnexion SIP contractuelle vérifiée, politique de routage 08, translation de numéro, tests entrants, opérateur de secours, règles de bascule et retours arrière.
- **Portage** : gestion du mandat, séquence et accusés opérateur, références techniques, préfixe propre à anticiper pour 2028, conservation des clients et historiques sans duplication.
- **CDR** : spécifications de fichiers/API, authentification cryptographique, horodatage, déduplication persistante, consentement et durée de rétention, capacité à corriger a posteriori sans altérer la piste d'audit.
- **Finance** : preuve de versement direct opérateur -> éditeur, rémunération séparée Audiotel, rapprochement des flux, frais, retenues, contestations et déclaration correcte des recettes.
- **Protection et conformité** : contrôle d'accès des tenants, revue RLS et droits PostgreSQL, lieu de traitement et transferts RGPD, log des accès, sauvegardes, intégrité de données, AF2M/MGIT, information consommateur, protections anti-fraude.
- **Go-live** : chaque blocage exige une preuve documentaire et une recette externe ; aucun simple HTTP 200 ni statut technique "ready" n'autorise la commercialisation.

## Demande de cotation à envoyer aux grossistes quand autorisée

**Objet : demande d'offre de gros directe SVA 08, interconnexion SIP, portabilité et reversements éditeurs**

Audiotel Premium Pro prépare une activité d'opérateur contractuel SVA, avec conservation intégrale de la relation commerciale, du support et de la facturation de ses clients. La société souhaite un approvisionnement de gros direct, sans intermédiaire de revente supplémentaire.

Merci de préciser dans votre proposition :
- Modalités d'interconnexion directe SIP/SBC cloud, collecte d'appels vers 081/082/089, secours, gestion portabilité et numérotation attribuée ARCEP au contractant.
- Reversement et commissions : détail des taux HT par minute, palier, origine fixe/mobile, frais et minimas éventuels ; possibilité de paiement **direct de chaque éditeur sur son IBAN**, avec commission Audiotel versée séparément.
- Données : flux CDR API/SFTP avec identifiant stable, signature ou authentification, corrections rétroactives, export des paiements et accusés de rapprochement.
- Conditions commerciales : sans engagement, résiliation, absence de frais d'activation ou de rotation par numéro, portage, coûts fixes, minimums de trafic, calendrier de versement.
- Critères de conformité (AF2M/APNF, KYB, identité juridique, PSP) et calendrier de recette, escalade NOC, SLA.

Ne pas envoyer automatiquement. Toute offre doit faire l'objet d'une revue commerciale, juridique et technique avant engagement. Ne jamais dévoiler le plancher interne de marge ni le seuil de revenu personnel pendant la négociation.

## Sources institutionnelles

- ARCEP, affectation des numéros et opérateur contractuel, mise à jour du 23/09/2026 : https://www.arcep.fr/mes-demarches-et-services/acteurs-regules/operateurs-telecoms/fiches-pratiques/operateurs-telecoms-affectation-des-numeros-de-telephone.html
- ARCEP, identifiant CE : https://extranet.arcep.fr/communications-electroniques/identifiant-ce/demande-identifiant-ce
- ARCEP, taxes de numérotation : https://www.arcep.fr/la-regulation/grands-dossiers-thematiques-transverses/la-numerotation/taxes-de-numerotation.html
- ARCEP, plafonds des services SVA : https://www.arcep.fr/la-regulation/grands-dossiers-thematiques-transverses/la-numerotation.html
- ACPR, encaissement pour compte de tiers et services de paiement : https://acpr.banque-france.fr/en/node/26817

**Règle absolue du propriétaire au 13/11/2026 : aucun déploiement Vercel, aucune mutation Neon, aucune fusion sur `main` avant nouvel accord explicite.**

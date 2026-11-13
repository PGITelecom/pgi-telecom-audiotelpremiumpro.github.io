# Audiotel Premium Pro : plateforme « couteau suisse », indépendance et délégation

Date : 13 novembre 2026.
Statut : **préparation sur branche GitHub uniquement**. Ni fusion, ni déploiement Vercel, ni changement de Neon sans nouvel accord explicite du propriétaire.

## Objectif de pilotage

Le propriétaire choisit à tout moment, pour une **simulation contractuelle**, entre :

1. **Marge maximale** : la configuration compatible ayant le résultat d'exploitation mensuel le plus élevé, sans sacrifier de marge pour déléguer.
2. **Équilibre** : maximum de fonctions déléguées sous un plafond de perte de résultat explicite (par exemple 10 %).
3. **Délégation maximale** : les fonctions externes les plus nombreuses, sous un plafond de résultat abandonné choisi (par exemple 30 %).

Les pourcentages sont des **choix personnels** qui n'autorisent aucune dépense, rupture de contrat ou routage. Aucune valeur n'est imposée par un opérateur. Le comparateur accepte plusieurs configurations et les évalue selon des offres de gros **à renseigner**, pas avec des taux inventés.

Le seuil interne prioritaire est **0,07 € par minute réellement conservés personnellement**, après coûts et prélèvements applicables. Lorsque le modèle dispose d'une hypothèse de fiscalité, il rejette toute option dont le net personnel projeté est inférieur à ce plancher. Lorsque la fiscalité manque, le net personnel reste **non vérifié**. La simulation d'un coefficient de conservation n'est pas une déclaration fiscale ni une garantie.

## Quatre modèles d'exploitation, indépendamment des prestataires

Le cœur du projet n'est **pas** uniquement l'optimisation des marges. Le propriétaire doit pouvoir envisager les modèles commerciaux et contractuels suivants, au sein de **la même plateforme** :

| Modèle de scénario | Contrat avec l'éditeur | Numérotation | Intermédiaires explicitement modélisables |
| --- | --- | --- | --- |
| Exploitant direct | Audiotel | Ressources attribuées directement à Audiotel lorsque juridiquement requises | Fournisseurs techniques directs, sans couche commerciale supplémentaire |
| Exploitant avec opérateur géré | Audiotel | Audiotel pour ses nouveaux numéros, sous réserve de décision ARCEP | Un prestataire peut gérer les opérations réseau, les CDR et le support |
| Exploitant avec intermédiaires | Audiotel | Audiotel pour ses nouveaux numéros, sous réserve des droits requis | Plusieurs couches de grossistes ou sous-traitants, par service |
| Marque blanche sous contrat partenaire | Partenaire | Dépend des droits contractuels et réglementaires du modèle | Le partenaire peut être contractant et détenteur des ressources |

**Attention :** sous marque blanche contractée par le partenaire, Audiotel n'est plus nécessairement l'opérateur du client final. La fidélisation, la portabilité, les fichiers clients et les droits d'utilisation des ressources deviennent des enjeux contractuels. Le passage d'un modèle à l'autre ne peut pas être automatiquement garanti par un clic.

### Chaînes contractuelles par service

L'interface de préparation permet de représenter par exemple :
- Collecte : Audiotel -> grossiste A.
- Collecte intermédiaire : Audiotel -> distributeur B -> agrégateur C -> grossiste A.
- CDR : Audiotel gère le rapprochement de données reçues par le fournisseur sélectionné.
- Virement éditeur : opérateur/PSP habilité -> IBAN du professionnel, rémunération Audiotel distincte.

Ces chaînes décrivent les **responsabilités et contrats de fourniture**, pas un chemin SIP ou une preuve d'interconnexion réseau. Le moteur rejette les boucles, les fournisseurs inconnus, les fonctions non déclarées, les chaînes incohérentes et les affirmations trompeuses sur l'identité du cocontractant.

Les droits de numérotation, la conservation du numéro, le contrat client et les autorisations de paiement restent **non vérifiés** à ce stade : il faut les preuves officielles correspondantes. Toutes les opérations réelles exigent les adaptateurs techniques, la confirmation des fournisseurs et une autorisation de mise en service distincte.

## Fonctions que l'on pourra confier au choix du propriétaire

| Fonction | Audiotel en interne | Externalisation possible |
| --- | --- | --- |
| Collecte des appels SVA | Exploitation sous statut légal adapté | Opérateur de gros |
| Portabilité | Orchestration et contrôle client | Opérateur/partenaire APNF habilité |
| SIP/routage | SBC cloud contrôlé et supervision | Opérateur de gros à SLA contractuel |
| Relevés CDR | Validation, archivage, rapprochement | Flux normalisés opérateur |
| Reversements éditeurs | **Pas de transit de fonds tiers par défaut** | Opérateur ou PSP habilité verse directement à chaque éditeur |
| NOC et support technique | Équipe opérationnelle Audiotel | Opérateur/prestataire NOC |

Le site, les contacts, les tarifs commerciaux, l'espace client, les données historiques et le contrat client restent autant que possible sous contrôle d'Audiotel. L'externalisation technique ne supprime pas les responsabilités de l'opérateur contractuel.

## Implémentation sur la branche de préparation

- **Moteur** : `backend/src/audiotel-multi-operator-strategy.mjs`.
- **API interne** : `POST /api/v1/platform/audiotel/operator-strategy/preview` réservée au personnel `admin`, avec protection CSRF et refus des données non valides ; aucun write SQL.
- **Interface privée** : `assets/audiotel-operator-strategy.js`, chargée depuis `assets/control-tower.js`.
- **Tests** : `tests/audiotel-multi-operator-strategy.test.mjs`.
- **Documentation d'exploitant** : `docs/AUDIOTEL-OPERATEUR-CONTRACTUEL-INDEPENDANT-2026-11-13.md`.

Dans le Control Tower, après un futur déploiement **explicitement autorisé**, la simulation proposera les paramètres suivants :

- Volume de minutes effectivement facturables par mois.
- Liste d'opérateurs ou prestataires souhaités, et fonctions qu'ils proposent.
- Plusieurs configurations alternatives avec choix d'un fournisseur par fonction.
- Rémunération propre d'Audiotel par minute **déjà nette des revenus des éditeurs et retenues amont**, autres coûts variables, coûts fixes mensuels, coût initial.
- Hypothèse de prélèvements personnels, seuil net personnel minimum de 0,07 €/min.
- Perte de bénéfice maximale acceptée par rapport à l'offre la plus rentable.
- Classement et export JSON explicite de la simulation, non comptabilisé et non sauvegardé dans Neon.

**L'espace ne transforme pas les prix saisis en tarifs officiels.** Les valeurs sont des hypothèses privées tant que l'offre et la fiscalité ne sont pas indépendamment vérifiées.

## Garde-fous permanents

- Refuser d'utiliser le compte Audiotel pour recevoir l'argent dû aux professionnels sans solution légale et accord explicite. Privilégier le reversement direct, avec référence bancaire et commission Audiotel séparée.
- Ne pas considérer un CDR non authentifié comme une preuve facturable ; ne jamais déclencher de paiement sur la seule réception d'un CSV.
- Ne pas accepter une combinaison multi-prestataires si la responsabilité du lien SIP ou du rapprochement CDR entre eux n'a pas été documentée.
- Signaler la concentration sur un seul fournisseur même si celui-ci promet tout gérer.
- Refuser les taux non numériques, négatifs, les doublons de fournisseur et les champs financiers incomplets.
- Ne jamais confondre gains mensuels avant impôts, rémunération du dirigeant et trésorerie appartenant à des tiers.
- La comparaison n'autorise ni contrat, ni numéros, ni activation, ni versement, ni déploiement.
- Garder la séparation entre l'activité `audiotel_platform` et l'unité `direct_sva`.

## Travaux qui nécessitent encore une décision ou un acteur externe

1. Statut d'opérateur contractuel, identité de l'entité, démarches CE et ressources ARCEP, et validation des obligations applicables.
2. Devis de gros réels, conventions SIP et portabilité, CDR API/SFTP, adaptation spécifique à chaque opérateur.
3. Validation du montage fiscal, bancaire et financier, notamment reversements directement vers les éditeurs.
4. Couche persistante de contrats, autorisations, configuration des partenaires, secret manager, journal d'audit et migrations Neon, après dégel.
5. Adaptateurs capables de traiter les demandes réelles, avec signatures, déduplication durable, circuit d'exception, contrôle de latence, tests de bout en bout, bascule et réversibilité.
6. Activation graduée, après nouveau consentement explicite, preuves d'acceptation indépendantes et garanties financières.

La simulation est utilisable comme **outil de préparation et de négociation**. Elle n'est pas encore un outil de changement automatique d'opérateur en production.

## Ordre conseillé pour ne pas perdre l'indépendance

Dès la négociation, imposer : propriétaire contractuel du client clairement identifié, propriété ou droits de contrôle légaux sur les numéros, possibilité d'exporter les CDR et historiques, portabilité et réversibilité, commission et flux financiers distincts, coûts fixes chiffrés, support NOC, SLA, et clause de sortie. Toute exclusivité doit être revue au regard du risque de dépendance et de la rentabilité nette.

**Rappel : aucune mise en production autorisée au 13 novembre 2026.**

# Réduction des intermédiaires SVA 089 | architecture propriétaire

État : code préparatoire uniquement. Aucune activation réseau, aucun fonds tiers, aucun achat et aucun déploiement.

## Ce que contrôle directement Audiotel Premium Pro

- Titularité des ressources 089 attribuées par l'Arcep, uniquement après décision officielle.
- Contrat commercial et portefeuille d'éditeurs, portail, supervision, routage logique SIP, suivi de la portabilité.
- Données CDR, rapprochement, relevés, calcul de la commission Audiotel, contrôle des écarts et audit.
- Mise en concurrence directe de l'opérateur de collecte/interconnexion et du prestataire de paiement autorisé, sans revendeur supplémentaire inutile.
- Identification de ses propres ressources de routage pour les numéros portés avant l'échéance réglementaire du **1er juillet 2028**.

## Ce que le logiciel ne peut pas supprimer

L'interconnexion avec les réseaux d'origine, la collecte/facturation des appels surtaxés 089, les conventions SVA, l'accès APNF/RSVA et les opérations sur fonds de tiers relevant d'un cadre de paiement autorisé. Il faut une capacité propre légalement reconnue ou un partenaire contractuel habilité, et non un simple trunk SIP. Une infrastructure SIP exploitée par Audiotel ne crée pas automatiquement le droit de percevoir ou de transférer les recettes des opérateurs.

**Réglementation :** les nouvelles mises à disposition de numéros en 08 entre opérateurs sont déjà interdites depuis le 1er août 2018. La réforme du 1er juillet 2028 impose, pour l'exploitation de numéros **portés**, un préfixe de routage attribué en propre par l'Arcep. Les équipements d'acheminement peuvent rester ceux d'un délégataire technique. Ce n'est pas une nouvelle interdiction générale du prêt de numéros instaurée en 2028.

Sources officielles :
- https://www.arcep.fr/mes-demarches-et-services/acteurs-regules/operateurs-telecoms/fiches-pratiques/operateurs-telecoms-affectation-des-numeros-de-telephone.html
- https://www.arcep.fr/uploads/tx_gsavis/25-2215.pdf
- https://af2m.org/souscrire-aux-cgs-sva/

## Code mis en place

- `backend/src/direct-sva-independence.mjs` expose un plan de dépendances réglementaires et techniques, ainsi qu'un comparateur de **coût externe mensuel total** pour des devis équivalents, complets et conformes aux fonctionnalités attendues.
- La réponse existante `GET /api/v1/platform/direct-sva-release-readiness` publie également le plan documentaire de maîtrise des ressources et le calendrier 2028, **sans toucher aux parcours clients ni aux boutons de production**.
- `tests/direct-sva-independence.test.mjs` vérifie le changement de règles, les barrières d'activation, le rejet des devis partiels et le classement des frais réellement connus.

## Règles de comparaison des offres

Pour être comparable, un devis doit couvrir intégralement : numéros Arcep propres, collecte SVA française, numéros portés et préfixe après 2028, portée nationale, CDR/API, circuit de paiement légal aux éditeurs sur IBAN, commission Audiotel distincte. Les frais fixes, frais à l'usage, frais par éditeur, par virement, de mise en service et de résiliation doivent être fournis. Le comparateur refuse les données manquantes, minima de dépense/volume et exclusivité non exclue.

Les scénarios de volume ne sont **pas des engagements commerciaux**. Le calcul classe les coûts externes HT à volume identique : il ne déduit ni recettes SVA non contractuelles, ni impôts, ni rémunération nette personnelle. Aucun seuil interne de rentabilité ne figure dans ce dépôt public. Seul un devis écrit et vérifié permettra de conclure.

## Conditions préalables au lancement

Dossier Arcep et preuve d'attribution ; préfixe propre si portabilité ; accès aux mécanismes APNF/RSVA ; contrats de collecte/interconnexion ; MGIT et transparence tarifaire ; PSP ou autre schéma de paiement légal dûment validé ; KYC éditeurs ; règles anti-fraude ; CDR réels signés, rapprochés et auditables ; recette de bout en bout ; validation juridique, comptable et autorisation expresse du propriétaire.

Aucun nouvel intermédiaire ne sera introduit pour la seule gestion du portail ou de la relation client, qui restent internes.

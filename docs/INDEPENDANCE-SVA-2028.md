# Audiotel Premium Pro : indépendance opérateur et réforme 2028

Statut : préparation uniquement. Cette documentation n'établit ni attribution Arcep, ni statut réglementaire, ni autorisation de collecte, ni pouvoir de reversement.

## Ce que notre société doit contrôler

- Relation contractuelle avec les éditeurs, dossiers et politique tarifaire.
- Ressources 089 directement attribuées par décision de l'Arcep, sous réserve d'éligibilité.
- Portail, CRM, SVI métier, modèles clients, inventaire et historiques.
- CDR reçus, preuves des relevés opérateurs, réconciliation des recettes et commissions.
- Exports complets et réversibilité pour remplacer un opérateur sans perdre nos données.

Le dépôt dispose déjà de modules dans backend/carriers, backend/src/direct-sva-operator-readiness.mjs et backend/src/direct-sva-financial-book.mjs. Les réutiliser ; ne pas créer un deuxième cœur métier.

## Prestations externes encore nécessaires dans le modèle projeté

L'accès aux réseaux appelants, l'interconnexion nationale, la collecte SVA, et les processus de portabilité interopérateurs nécessitent des contrats et/ou des équipements conformes. Un programme informatique ne remplace ni les droits d'interconnexion ni la collecte auprès des réseaux d'origine.

Les fonds de tiers et reversements directs aux éditeurs nécessitent un cadre juridique approprié et, si nécessaire, un prestataire de services de paiement habilité. L'existence d'un compte bancaire ou d'un module Stripe abonnement ne prouve pas cette habilitation.

## Réglementation

- Les nouvelles mises à disposition de numéros en 08 entre opérateurs sont déjà interdites depuis le 1er août 2018.
- Le 1er juillet 2028 termine la possibilité de conserver les anciennes mises à disposition antérieures, y compris les stocks résiduels.
- Pour les numéros portés, l'opérateur exploitant devra être attributaire de son propre préfixe de routage à compter du 1er juillet 2028, même si les équipements physiques sont sous-traités.
- Les numéros portés chez nous ne doivent pas nécessairement appartenir au bloc originellement attribué à notre société.
- L'identifiant CE, la négociation fournisseur et le développement du logiciel ne sont pas une décision d'attribution Arcep.

Sources officielles :
https://www.arcep.fr/mes-demarches-et-services/acteurs-regules/operateurs-telecoms/fiches-pratiques/operateurs-telecoms-affectation-des-numeros-de-telephone.html
https://acpr.banque-france.fr/en/node/26817

## Code ajouté

Le module backend/src/direct-sva-independence-2028.mjs est un évaluateur documentaire isolé. Il identifie les preuves manquantes pour le bloc attribué, les numéros portés, le préfixe de routage, la collecte SVA et le paiement réglementé.

La présence d'une référence de document n'en authentifie pas le contenu. Même une évaluation documentaire favorable laisse systématiquement les autorisations de production, de routage et de paiement à FALSE.

La préparation ne modifie aucun comportement existant :
- aucun import dans le serveur ou les workers ;
- aucune migration Postgres, aucun changement de routes ou secrets ;
- aucune modification du site, du portail, du design ou des données ;
- aucun déclenchement de virement, de facturation ou d'activation.

## Négociation et modèle de coûts

1. Obtenir directement nos ressources Arcep, si les critères d'attribution sont réunis.
2. Mettre les fournisseurs en concurrence pour une prestation de gros française SVA 089 sur notre propre bloc et non une simple offre SIP pour numéros ordinaires.
3. Exiger les tarifs facturés effectivement par minute, les retenues, les frais fixes, la disponibilité nationale, les CDR/API, les conditions de réversibilité et les délais de règlement.
4. Si nécessaire, séparer transport SIP et collecte/PSP lorsque le coût total est démontrablement meilleur et les responsabilités contractuelles sont claires.
5. Conserver la responsabilité du parcours client, des données et de la détermination de notre rémunération contractuelle.
6. Ne pas divulger aux fournisseurs notre seuil interne de rentabilité par minute.

Aucune estimation chiffrée de gain garanti sans devis complet et validation de la chaîne de facturation, de collecte et de fiscalité.

## Décision de déploiement

Cette branche doit rester séparée de main. Une décision distincte de lancement nécessitera la vérification des preuves Arcep/AF2M/APNF/PSP, la signature des contrats, la revue du code et la conformité de la chaîne financière. Ne pas confondre code prêt et société autorisée à exploiter des numéros.

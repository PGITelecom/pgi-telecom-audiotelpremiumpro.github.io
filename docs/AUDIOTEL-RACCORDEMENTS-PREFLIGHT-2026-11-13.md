# Audiotel Premium Pro | Dossier de raccordement sans activation

Date : 13 novembre 2026. Périmètre : activité commerciale Audiotel Premium Pro (`audiotel_platform`), distincte de la distribution directe `direct_sva`.

## Ce qui est livré dans le code de production

- Modèle standardisé d'exigences d'opérateur, API et relevés financiers : `backend/src/audiotel-connection-preflight.mjs`.
- Précontrôle de dix domaines : contrat, numérotation, portabilité, SIP, CDR, tarif, reversements directs, facturation Stripe, comptabilité et sécurité.
- Intégration en lecture seule au rapport staff `GET /api/v1/platform/launch-readiness`, sans nouvelle route publique et avec rôle `admin`, `finance` ou `readonly`.
- Tableau de suivi dans le cockpit de lancement. Une preuve interne partielle ne vaut jamais acceptation d'un opérateur.
- Lecteur de *prévisualisation* CDR : type d'activité imposé, numéro SVA français au format E.164, horodatages UTC, secondes facturables entières, statut et EUR contrôlés, identifiant stable, empreintes SHA-256 déterministes, rejet des doublons contradictoires.
- Tests anti-rejeu, anti-croisement des deux activités, validation stricte des données et refus d'activation.

Aucune requête vers un opérateur, aucune signature HMAC déclarée vérifiée, aucune insertion de CDR, aucun paiement, aucune commande de numéro, aucune activation réseau.

## Ce qu'il faut recevoir de chaque opérateur

| Lot contractuel | Pièces et paramètres nécessaires |
| --- | --- |
| Numérotation | Attributaire réglementaire, droits de sous-affectation, préfixes autorisés, preuve d'attribution, gestion des retours et des collisions |
| Portabilité | Convention, formats de mandats, identifiants de portage/RIO lorsqu'applicables, états normalisés, rendez-vous de bascule, annulation et restitution |
| Contrat de gros | Conditions tarifaires, grille de reversement, commissions propres à APP, frais d'activation/portage/résiliation, sans engagement ou minimum lorsque négociable, responsabilités et SLA |
| Contrôle du trafic | SIP/TLS et restrictions d'accès, destination, codecs, classes d'erreur, supervision et secours, MGIT et signalétique selon catégorie |
| API / SFTP / fichiers | Spécification OpenAPI ou XSD/CSV, environnement d'essai, clés et procédures de rotation, IP autorisées, signatures ou mTLS, horodatage UTC, limites et accusés de réception |
| CDR | Identifiant global immuable, ressource appelée, début/fin, statut, secondes taxables, taux, période tarifaire, version de la grille, correction/annulation, empreinte fichier et rapprochement journalier |
| Reversements | Paiement **direct opérateur -> IBAN du professionnel**, habilitation PSP et KYC, calendrier, référence de virement, refus, retenues, litiges, justificatif de paiement et rémunération APP distincte |
| Fiscalité | Identité juridique validée, TVA, factures de l'abonnement et des frais APP, relevés SVA non fiscaux, avoirs, journal de rapprochement, FEC lorsque requis |

### Traitement automatique cible

1. Le client demande une portabilité ou un numéro, authentifié, autorisé et conforme au contrat. L'ancien numéro est prioritaire lorsque c'est son besoin.
2. Le moteur produit une intention idempotente, jamais une mise en service tacite.
3. L'opérateur répond avec son identifiant et un ACK dont la provenance est vérifiable. En cas d'échec ou de timeout, ne jamais réémettre une attribution sans vérification d'état.
4. Après validation de l'affectation, le routage SIP est configuré et fait l'objet d'un appel de recette et d'une procédure de retour arrière.
5. Les CDR entrent par flux authentifié. Déduplication persistante, affectation du numéro et du client par tables internes, contrôle du barème et rapprochement avec le relevé opérateur.
6. L'opérateur vire directement au professionnel. L'application enregistre **la preuve de paiement autorisée** et non une simple promesse de versement. APP reçoit sa propre rémunération contractuelle.
7. L'espace client affiche les statistiques, factures officielles Stripe et relevés SVA cohérents, horodatés, archivés et contrôlables.
8. La gestion nominale est automatique. Litiges, fraude, KYC, conflit de CDR, doublon contradictoire, paiement refusé ou événement douteux ouvrent une exception contrôlée, sans paiement aveugle.

### Mesures de mise en production

- Aucun secret dans GitHub ou les logs. Stockage de credentials dans Vercel et rotation, séparation test/production.
- Webhooks contrôlés par authentification cryptographique, délai/rejeu, idempotence persistante et audit.
- Contrôle d'autorisation côté serveur et isolation par locataire. Les RLS des tables existantes exigent un plan d'évolution des rôles et tests de non-régression ; ne pas activer RLS sans vérifier les requêtes administrateur et les connexions du serveur.
- Clés d'idempotence par opérateur, type, demande et événement, stockées avec contraintes d'unicité. Les empreintes de prévisualisation ne sont **pas** une preuve de signature opérateur.
- Traçabilité du rapprochement financier sans double comptabilisation et sans confondre argent de tiers et chiffre d'affaires APP.
- Plan de restauration Neon avec branche sauvegardée, audit des migrations, test de reprise et contrôle des coûts. Pas de changement de région, de capacité ou de facture sans étude de dépendances et validation.
- Contrôles avant ouverture : réconciliation du stock, contrat réel, recette complète SIP/CDR, HTTPS, RGPD, régime fiscal, portail factures et virement de bout en bout.

### Situation actuelle, démontrée le 13 novembre 2026

Neon : 85 migrations jusqu'à 085 ; aucun numéro SVA actif ni interconnexion opérateur exploitable, aucune ligne de reversement ni abonnement réel. Les données légales et comptables ne sont pas configurées. Le portail et la facturation documentaire sont publiés dans Vercel, mais le site ne peut pas encore garantir une exploitation télécom réelle.

**Les composants du présent dossier sont des contrats d'intégration et un précontrôle observable. Leur publication ne doit pas être assimilée à une activation de l'offre ou à un accord externe.**

## Plan d'exécution après réception d'un dossier opérateur

1. Adapter la correspondance de champs à la documentation exacte du fournisseur, avec fixtures fournies par celui-ci et vérification cryptographique du transport.
2. Créer une base d'essai isolée, appliquer une migration d'inbox avec contraintes d'unicité, outbox et quarantaine.
3. Exécuter des tests négatifs, des scénarios de doubles notifications, d'indisponibilité, de corrections et de latence.
4. Valider le contrat, les habilitations de numérotation, les flux bancaires directs, les mentions légales et la fiscalité.
5. Autoriser explicitement une ouverture graduée, avec retour arrière documenté et suivi en production.

Aucune infrastructure physique dans les locaux n'est nécessaire pour cette architecture.

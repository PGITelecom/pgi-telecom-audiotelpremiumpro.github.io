# PGI Telecom / Audiotel Premium Pro — checklist du prochain déploiement Vercel

**Préparée le 25 octobre 2026 — À EXÉCUTER UNIQUEMENT APRÈS AUTORISATION EXPLICITE DU PROPRIÉTAIRE.**

Ce document est un pense-bête de livraison, **pas** une autorisation de déployer, fusionner, migrer, supprimer, payer ou modifier des secrets. Recontrôler l'état réel des comptes, les branches, les exigences et les dépendances à la date du futur déploiement. Ne pas interpréter une tâche non cochée comme déjà réalisée.

## 0. Conditions bloquantes / autorisations
- [ ] Demander et obtenir le feu vert explicite : « On déploie PGI Telecom » ou équivalent.
- [ ] Définir exactement le périmètre du déploiement : intégration seulement des modifications approuvées (SVA, SEO, corrections visuelles, optimisation Neon). Ne pas lancer prématurément le Pôle Télécom & Réseau / Distribution.
- [ ] Vérifier `main`, l'état du site actuel, les incidents ouverts, les branches en attente et une procédure de rollback vers le déploiement précédent.
- [ ] Respecter la séparation stricte PGI Telecom / ClairVoyanceMedium.com : aucune interconnexion de données, marketing, facturation ni intégrations.
- [ ] Aucun transfert de projet Vercel/GitHub, aucune suppression de compte, de domaine ou de base de données et aucune souscription payante sans autorisation distincte.

## 1. Branches préparées / code et non-régression
- [ ] Vérifier et intégrer après revue la branche `optimization/neon-compute-budget-20261025` (404 statiques sans accès à PostgreSQL, contrôle GitHub Production Watch H+03, nouveaux tests ; documentation associée).
- [ ] Vérifier et intégrer seulement si approuvée la branche `contenu/metiers-sva-multisectoriel-20261024` : positionnement de l'offre SVA auprès de multiples secteurs et cartes métiers ; préserver les conditions d'éligibilité.
- [ ] Faire le point sur les autres corrections SVA déjà demandées : lisibilité du texte du visuel, colonnes et intitulés 01/02/03 sur une même ligne, comparateur avec chiffres de gain en vert et soulignés / texte explicatif en blanc, responsive du cockpit et autres ajustements explicitement validés. Ne pas confondre « demandé » avec « modifié et testé ».
- [ ] Ne pas rendre visible l'espace ou les services du Pôle Télécom & Réseau tant que le lancement Distribution n'est pas expressément autorisé ; ne pas casser son SEO ni les mécanismes de bascule.
- [ ] Comparer chaque branche avec `main`, résoudre les conflits, vérifier les limites de taille et les contenus SEO, exécuter `node --test tests/vercel-neon-static-fastpath.test.mjs`, `npm run check:js`, `npm run check:html` et `npm run verify:vercel` (plus tests complets pertinents).
- [ ] Contrôler les 404/200/308/401, pages publiques, authentifications, états Distribution privés, URL canoniques, robots.txt, sitemap et en-têtes de sécurité. Les routes dynamiques doivent rester dynamiques.

## 2. Neon : consommation et disponibilité
- [ ] Lire les limites du **forfait réel au jour J** et l'état de la consommation. Au 25/10 : Free, quota 100 CU-h/mois, ~110,01 CU-h utilisées, calcul main ~109,04 CU-h, prochain cycle 01/11/2026.
- [ ] Confirmer le comportement Neon Free « scale to zero » : `suspend_timeout_seconds=0` correspond au délai par défaut (~5 min), **pas** à une désactivation.
- [ ] Vérifier l'application de la voie statique déjà déployée le 19 octobre et des nouvelles protections 404 sans réveil Neon.
- [ ] Auditer le démarrage de PostgreSQL pour les accès dynamiques, les connexions persistantes, les appels robots/monitoring et les heures actives avant de modifier des tâches sensibles.
- [ ] Conserver les tâches indispensables : Business Live, remises à zéro, parrainage, paiements, intégration opérateur, comptabilité, emails, réconciliation, support et rapport quotidien.
- [ ] Ne supprimer aucune branche/sauvegarde Neon ; vérifier les sauvegardes/restauration, les migrations et la branche de production avant opération. L'activité des branches secondaires est négligeable (~0,97 CU-h cumulées au relevé).
- [ ] Si le forfait Free reste insuffisant pour la disponibilité commerciale, présenter une estimation documentée du coût Launch et demander une autorisation spécifique avant souscription.
- [ ] Mesurer CU-heures/jour, heures actives, réveils et temps de réponse après déploiement ; la cible 60–70 CU-h/mois est **non garantie**.

## 3. Vercel : identité, domaines et nettoyage prudent
- [ ] Revalider l'adresse principale `contact.audiotel.premium.pro@gmail.com`, le nom PGI Telecom, l'utilisateur `pgi-telecom-admin`, l'équipe `pgi-telecom`, son propriétaire et les IDs stables du compte/équipe/projet.
- [ ] Vérifier les valeurs utiles (sans exposer les secrets) des variables d'environnement de destinataires et expéditeurs : `PGI_DAILY_REPORT_RECIPIENT`, `PGI_INTERNAL_NOTIFICATION_EMAIL`, `PGI_TRANSACTIONAL_FROM_EMAIL`, `PGI_TRANSACTIONAL_REPLY_TO`, `PGI_TRANSACTIONAL_DOMAIN`, ainsi que les URL/callbacks. Les variables sont présentes mais leurs valeurs secrètes n'ont pas été lisibles lors de l'audit.
- [ ] Identifier les **28 alias Vercel historiques** contenant `contactclairvoyancemedium-8066` (décompte du 25/10), inventorier toute référence encore active et ne retirer que les alias sûrs après validation. Le déploiement ne les supprime pas automatiquement.
- [ ] Garder `audiotel-premium-pro.com` et `audiotel-premium-pro.fr`, leurs `www`, les redirections 308, la vérification DNS et la protection voulue ; aucun renommage/transfert de domaine automatique.
- [ ] Vérifier le statut READY, le raccordement GitHub `PGITelecom/pgi-telecom-audiotelpremiumpro.github.io`, et les branches de déploiement autorisées (main seulement). Ne pas publier les branches de préparation.

## 4. GitHub : identité et alertes
- [ ] Vérifier le profil du compte GitHub professionnel `contactaudiotelpremiumpro-code` : `contact.audiotel.premium.pro@gmail.com` ; dépôt sous l'organisation `PGITelecom`.
- [ ] Les alertes `Production Watch` arrivaient encore sur `contact.clairvoyancemedium@gmail.com`, avec entêtes **X-Github-Recipient: ClairVoyanceMedium** et **X-Github-Reason: ci_activity** (constaté le 25/10) : réattribuer les notifications au compte PGI, vérifier le compte acteur des exécutions planifiées, les abonnements aux notifications et la réception effective par l'adresse PGI. Ne pas désactiver la surveillance.
- [ ] Conserver **une vérification horaire** complète : la modification préparée avance la programmation de H+17 à H+03 pour tenter de grouper les réveils Neon avec les crons Vercel H+00, sans garantie d'exécution exacte par GitHub.
- [ ] Les échecs à 503 du 25/10 concernaient les routes dépendantes de Neon (accueil, API health), alors que plusieurs pages statiques répondaient 200. Faire cesser les incidents après rétablissement de la base et valider une exécution verte.

## 5. Autres comptes et intégrations
- [x] **Neon : membre administrateur** — le 25/10, le seul membre visible utilise désormais l'adresse PGI Telecom, possède le rôle admin organisation et projet et conserve les droits d'origine. La bonne adresse est donc déjà enregistrée dans les **accès effectifs**.
- [ ] **Neon : métadonnée `owner.email` obsolète** — l'API descriptive du projet renvoie encore l'ancienne adresse alors que la liste des membres renvoie bien PGI. Demander à Neon la correction du champ ou la confirmation de son statut historique ; ne pas retirer l'administrateur et ne pas transférer le projet pour contourner une métadonnée.
- [ ] **Neon : handle technique de l'organisation** — `clairvoyancemedium-org-dawn-butterfly-93181497` reste présent malgré le nom visible Audiotel Premium Pro. Vérifier auprès de Neon si ce handle est modifiable et s'il existe un impact sur API/URLs/permissions. Ne pas créer une nouvelle organisation ou déplacer PostgreSQL pour le seul nettoyage visuel.
- [ ] **Neon : paramètres affichés dans Work / console** — l'app Neon connectée à ChatGPT ne dispose pas d'actions pour changer l'email d'un compte ou le handle d'une organisation. Les opérations UI restantes nécessitent Work et, si non modifiables, une demande au fournisseur. Sur le forfait Free, le support technique officiel n'est pas inclus : privilégier d'abord Neon Console > Help > Get help > Ask the AI assistant. Aucune dépense ni migration automatique.
- [ ] Vérifier séparément Stripe **en mode réel** : abonnements 4,90 € TTC/mois, option prioritaire 9,90 € TTC, paiements uniques/récurrents, webhooks Connect et abonnements, réconciliation et aucune facturation de test réelle.
- [ ] Vérifier Resend (domaine `audiotel-premium-pro.com` vérifié, envoi/réception activés au 25/10, webhook email actif), expéditeurs, réponses et destinataires PGI.
- [ ] Vérifier HubSpot (compte relié à l'adresse PGI), création de contacts/deals/tickets et formulaires, sans créer de données clients réelles lors des tests.
- [ ] Vérifier GA4 et Search Console sur les bonnes propriétés PGI, connexions et données distinctes de ClairVoyanceMedium.
- [ ] Vérifier permissions GitHub/Vercel/Neon et accès administrateur après tout changement d'identité. Ne pas régénérer arbitrairement de clés API, webhooks ou secrets.

## 6. Recette et décision finale
- [ ] Avant publication : tests automatisés sans erreur, tests des cas critiques, plan de retour arrière validé et consentement explicite.
- [ ] Publier uniquement le périmètre approuvé (modifications techniques, marketing et identité explicitement validées).
- [ ] Après publication : vérifier accessibilité du domaine principal et des `www`/`.fr`, SEO, page d'accueil, espace client, cockpit, formulaires, Stripe, HubSpot, Resend, resets, rapport quotidien et état non publié de Distribution.
- [ ] Vérifier l'absence de nouvelles alertes « Production Watch » vers ClairVoyanceMedium ; confirmer la bonne réception chez PGI.
- [ ] Mesurer la consommation Neon et surveiller les effets de performance ; rollback si régression mesurée.
- [ ] Conserver un bilan « fait / non fait / non vérifiable » plutôt que d'affirmer que tout est parfait sans preuve.

**La règle générale : aucune action irréversible, aucun changement de compte, ni déploiement en production sans validation explicite.**

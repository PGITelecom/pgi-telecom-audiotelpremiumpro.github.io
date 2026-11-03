# PGI Telecom | Optimisation des CU-heures Neon (préparation)

**Date : 25 octobre 2026. Statut : branche GitHub isolée, aucun déploiement.**

## État vérifié

- Neon Free, 100 CU-heures par mois, période du 1er octobre au 1er novembre 2026.
- Consommation relevée : 110,01 CU-heures ; base `main` 109,04 CU-heures (99,1 %) ; branches secondaires ~0,97 CU-heure.
- 0,25 CU pour le compute principal, environ 435,42 heures actives.
- Réseau sortant ~0,49 Go ; pas le poste limitant.
- `suspend_timeout_seconds=0` signifie valeur par défaut (5 min sur Free), non « veille désactivée ».
- Le 19 octobre, une première optimisation a séparé les fichiers statiques du démarrage PostgreSQL. Elle est conservée.

## Corrections préparées dans cette branche

1. Après le gestionnaire de ressources statiques, renvoyer une 404 directement pour un asset image/style/script/police/manifeste absent ou un sondage de secrets Git/environnement, **sans réveiller Neon**. Les pages HTML, API, accueil, robots et Pôle Distribution restent sous le routage et les vérifications en place.
2. Avancer `Production Watch` (GitHub Actions) de **H+17 à H+03** pour rapprocher son contrôle API, maintenu **toutes les heures**, des trois crons horaires Vercel à H+00. Les contrôles de sécurité, disponibilité, parcours clients et SEO existants restent exécutés. Les retards GitHub Actions peuvent réduire l'économie prévue.
3. Ajouter un test de régression sur 404 sans connexion et sur repli backend inchangé.

## Interdictions et garde-fous

Aucun changement sur abonnements, téléphonie, routage opérateur, Pôle Télécom & Réseau, visibilité commerciale/SEO, paiements Stripe, HubSpot, Resend, Business Live, remises à zéro, comptabilité, parrainage, rapports, secrets, projets ou branches Neon.

Ne pas supprimer les branches « backup ». Ne pas modifier la facturation Neon ni déployer sans accord explicite.

## Recette avant fusion et déploiement

Exécuter `node --test tests/vercel-neon-static-fastpath.test.mjs`, `npm run check:js`, `npm run check:html` et `npm run verify:vercel`. Vérifier toutes les routes 200/404/401 et pages Distribution non publiées. Refaire un test de contrôle horaire. Contrôler le différentiel réel de CU-heures et de réveils sur plusieurs journées après un déploiement expressément approuvé. Retour arrière : revert des commits de la branche.

Cette optimisation ne rembourse pas un quota mensuel déjà consommé et ne garantit pas à elle seule de rester sous 100 CU-heures. Un usage commercial soutenu peut justifier Neon Launch.

Documentation : https://neon.com/docs/introduction/plans et https://neon.com/docs/introduction/cost-optimization.

# Audiotel Premium Pro : blocage sécurité et reprise avant déploiement

Constat du 27 novembre 2026. Source de vérité : lecture des projets connectés Neon, Vercel et GitHub. **Cette note n'active aucune opération de production.**

## Faits effectivement vérifiés
- GitHub : PR #207 `evolution-autonomie-2026-11-27` ouverte, brouillon et non fusionnée. CI Quality & Security sur `efdb33b962dd86035501fb2e2530f3335decb6ff` : SUCCÈS. Une CI réussie n'est pas un audit d'intrusion complet.
- Vercel : projet `pgi-telecom-audiotelpremiumpro-github-io` ; dernière livraison de production identifiée sur le SHA `a6522790741e32ef40ed46bc7e749e28b6cb10fa` antérieur à la PR #207. Le nouveau code n'y est pas en production.
- Neon : projet `silent-waterfall-98567339`, `main` id `br-soft-lake-aus3fapz`, **non protégée** lors de la lecture. Historique fourni par Neon : **21600 secondes = 6 heures**. Dix branches existantes, dont la dernière branche de secours non archivée date du 15 novembre 2026. Une seule snapshot retrouvée, du 3 octobre 2026.
- Tentative réelle de créer une snapshot `backup-avant-deploiement-2026-11-27` : **échec HTTP 422 `snapshots limit exceeded`**, aucune nouvelle snapshot créée.
- Tentative de protéger Neon `main` : **échec HTTP 422 `maximum number of protected branches for your current plan`**. Le contrôle de protection n'a pas été activé.
- La planification automatique de snapshots pour `main` est vide. Aucune restauration récente sur un environnement isolé n'a été démontrée.
- Les scripts `scripts/backup-postgres.sh` et `scripts/restore-drill.sh` utilisent un PostgreSQL via Docker Compose. Ils ne sauvegardent **pas** la base Neon distante par simple présence dans le dépôt.

## Blocage absolu avant une migration
L'état « prêt à déployer sur Vercel + Neon » est **NON**. Avant toute migration ou mise en service du nouveau code :
1. Obtenir une sauvegarde **récente et indépendante** de la branche Neon de production. Sans capacité de snapshot supplémentaire, préférer un export `pg_dump --format=custom` depuis une machine d'administration autorisée, stockage chiffré à accès restreint **hors du compte principal**, conservation d'une empreinte et validation de `pg_restore --list`. La validation de la liste seule ne remplace pas un essai de restauration.
2. Réaliser un essai de restauration dans une base isolée, vérifier au minimum les schémas, les comptes, les données et les permissions sans exposer de données clients. Ne jamais exécuter `pg_restore` sur `main`.
3. Définir une protection compensatoire à l'absence de branche protégée : MFA administrateur, privilèges minimaux, comptes restreints, gestion prudente des identifiants, approbation explicite des changements DDL et des migrations, journaux d'audit et interdiction des migrations automatiques au démarrage. **Ce sont des exigences, pas des contrôles déjà vérifiés.**
4. Vérifier que chaque migration est compatible avec la version du code et qu'elle n'efface pas de données ; préparer retour arrière, puis vérifier la restauration en cas d'échec.
5. Déployer une version identifiable et contrôlée sur Vercel en environnement séparé, avec les fonctions d'exploitation 089 OFF tant que les accords restent absents ; valider avant la promotion en production. Les éventuels frais et modifications sensibles exigent validation distincte.

## Économie et non-destruction
- Ne **pas** supprimer les anciennes branches ou snapshots pour contourner les limites du plan, ni souscrire automatiquement à une offre payante.
- Ne pas assimiler les six heures de restauration native à une sauvegarde extérieure conservée sur la durée.
- Une réussite GitHub CI ne justifie ni le déploiement ni la migration de la base de données.
- Ne pas reproduire de données personnelles ou de secrets dans GitHub, le Google Sheet, un journal de build ou une conversation.
- Vérifier les conditions commerciales Neon et la capacité effective d'export avant toute solution payante.

## Suite d'exécution
- Maintenir PR #207 en brouillon et la production inchangée.
- Privilégier un export externe chiffré et une restauration isolée **avant** la mise en service.
- Enregistrer comme seuls états vérifiés : **code CI réussi**, **nouvelle sauvegarde absente**, **branche Neon main non protégée**, **déploiement du nouveau code absent**.
- Ne déclarer « déploiement Vercel et Neon terminé » qu'après confirmations indépendantes des deux plateformes.

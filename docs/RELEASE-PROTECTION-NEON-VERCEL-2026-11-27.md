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


## Optimisation de l'espace sans perte de donnees (27/11/2026)

Une nouvelle tentative non destructive de branche Neon `backup-pre-release-2026-11-27`, sans compute, a ete **refusee HTTP 422 : branches limit exceeded**. Neon comporte 10 branches repertoriees, dont `main`, la sauvegarde active du 15/11 et 8 branches archivees. Leur suppression n'est **pas autorisee** tant que l'on n'a pas une protection externe plus recente et une restauration probante. La compression des archives ne reduit pas le **nombre** de branches ou de snapshots, qui est le quota bloquant.

Pour eviter un abonnement supplementaire, preparer desormais une sauvegarde externe du PostgreSQL Neon avec le script `scripts/backup-neon-encrypted.sh` dans la branche GitHub PR #207. Son fonctionnement :

1. Utiliser depuis une machine de confiance disposant de `pg_dump`, `pg_restore` et du logiciel libre `age` une connexion **directe TLS verifiee** a Neon. Fournir l'URL dans l'environnement seulement (`PGI_NEON_DATABASE_URL`), jamais en argument de commande, dans le code ou dans un log. La connexion doit posseder un droit de lecture adapte a la sauvegarde.
2. Fournir une cle publique destinataire `PGI_BACKUP_AGE_RECIPIENT` et une identite de dechiffrement conservee **hors du depot GitHub** (`PGI_BACKUP_AGE_IDENTITY_FILE`), puis un repertoire absolu **hors du depot et hors de Neon** (`PGI_BACKUP_OUTDIR`). Ne jamais copier de cle privee ni de dump en clair dans GitHub, une feuille de calcul ou un artefact CI public.
3. Le `pg_dump --format=custom --compress=6` produit directement un flux compresse, chiffre avec age et place temporairement dans un repertoire restreint. Le script dechiffre pour faire `pg_restore --list` **sans effectuer de restauration sur Neon**, publie le fichier .age et sa somme SHA-256 uniquement si ces verifications reussissent. Il n'efface jamais les archives preexistantes.
4. Copier cette sauvegarde chiffree vers un second emplacement prive independant (par exemple stockage local fiable distinct ou dossier Drive prive, avec autorisations et quotas verifies). Conserver la cle de recuperation hors du lieu des archives. Deux copies et deux lieux de risque distincts sont preferables.
5. Restaurer **sur une base isolee** et confronter schemas, donnees, permissions et coherence des applications. La simple lecture de la liste de `pg_restore` ne suffit pas a prouver une restauration. Conserver une preuve datée de ce test.
6. Seulement apres cette etape, examiner individuellement les huit anciennes branches archivees et le snapshot historique pour determiner quels doublons peuvent etre supprimes, **avec une approbation explicite et sans supprimer la branche `main` ni l'unique copie recentement validee**. Garder les versions de restauration requises pour l'activite et les obligations legales. Une archive ne devient pas inutile du seul fait de son age.

**Statut concret :** le script et ses verifications CI sont prepares mais aucune sauvegarde reelle Neon n'a ete obtenue par ce script ; aucune copie externe et aucune restauration isolee ne sont confirmees. Il faut un contexte de sauvegarde de confiance et les identifiants Neon disponibles sans les exposer. Aucun espace Neon n'a encore ete libere. Ne pas annoncer le deployement pret.

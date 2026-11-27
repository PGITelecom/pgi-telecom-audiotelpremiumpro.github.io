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


## Veritable exercice de restauration, validation de l'environnement et statut

Le script `scripts/restore-neon-encrypted-drill.sh` complete `scripts/backup-neon-encrypted.sh` : il refuse une archive ou une empreinte invalide, impose une connexion PostgreSQL **uniquement a 127.0.0.1**, cree une base de restauration temporaire distincte, dechiffre l'archive *directement en flux* vers `pg_restore` avec transaction et interruption sur erreur, puis verifie la presence des tables `public.calls`, `public.experts` et `public.outbox_events`. Il supprime ensuite la base temporaire, sans appeler Neon ni exposer les lignes clients dans les journaux. Executer cet exercice exclusivement sur un hote de reprise fiable, et non dans un CI public ou sur un poste tiers.

Le script de creation des sauvegardes refuse aussi d'annoncer qu'une archive est valide si le catalogue restaure ne contient pas ces trois tables. Il exige une cle privee de verification conservée hors de GitHub, des droits de fichiers restreints, un chemin de stockage externe et une connexion TLS a la base source. Le chiffrement protege la confidentialite de l'archive externe. Une empreinte SHA-256 sans signature distincte ne protege pas contre la substitution coordonnee du fichier et de son manifeste ; conserver une preuve datée sur un support de confiance.

**Limites explicites :**
- Ces deux scripts sont du code, et non des preuves qu'une sauvegarde des donnees actuelles a ete creee ni restauree. Ne pas cocher le pre-requis de deploiement tant que l'exercice n'est pas execute sur une archive reelle.
- Le format `pg_dump --no-owner --no-acl` ne restaure pas les comptes PostgreSQL, leurs roles ni les droits d'acces d'origine. Documenter et verifier ces elements separement avant toute reprise complete de production.
- Pour reduire les couts, privilegier deux copies chiffrees sur deux supports independants deja possedes. La rotation peut economiser de l'espace **apres** validation des copies recentes et de leur restauration, mais aucune suppression automatique n'est autorisee ici.
- L'exercice exige un PostgreSQL local temporaire, les outils disponibles et des identifiants de sauvegarde/reprise accessibles seulement au processus autorise. Ne jamais coller ces secrets dans ChatGPT, GitHub public ou dans le Google Sheet.
- Un test syntaxique GitHub CI reussi ne remplace pas un exercice reel sur les donnees Neon. Les tests automatiques sont inoffensifs sur CI et ne contactent aucune base client.

**Decision :** gel maintenu sur les migrations Neon et le deploiement de la PR #207 jusqu'a obtention d'un export recent, deux copies protegees et preuve de restauration, puis verification independante des droits et de l'application.


## Audit comparatif des branches candidates, 27 novembre 2026

**Audit effectue en lecture seule, sans export de donnees personnelles.** Trois branches examinees :
- `main` (branche principale, 3 tenants, 427 evenements de webhook e-mail, 85 migrations).
- `validation-migrations-076-085-2026-10-11` (`br-noisy-band-auw2255q`, archivee, 1 tenant, 53 evenements, 85 migrations).
- `preflight-prod-migrations-072-085-2026-10-11` (`br-shiny-river-auqpjd9i`, archivee, 1 tenant, 53 evenements, 85 migrations).

**Niveau 1 :** controles de lignes exactes sur **518 tables physiques** des trois branches. Dans les deux branches historiques, les nombres de lignes sont identiques table par table et ne sont jamais superieurs a `main`. Les 53 identifiants d'evenements, combines avec l'empreinte du contenu e-mail, sont presents dans `main`. Les signatures de tenant examinees sont presentes dans `main` ; les 85 noms et checksums de migration correspondent a `main`.

**Niveau 2 :** empreintes SHA-256/MD5 de comparaison de contenu pour les **31 tables peuplees** sur les branches historiques, en agregeant les empreintes de lignes sans transmettre les valeurs. Les deux branches historiques **ne sont pas identiques** : six tables ont des contenus differents (`direct_sva_admin_switches`, `direct_sva_integration_readiness`, `direct_sva_operator_controls`, `direct_sva_website_visibility`, `pgi_company_business_units`, `schema_migrations`). Par rapport a `main`, huit tables historiques ont des contenus differents, notamment les etats de configuration, l'horodatage de migration et les donnees de tenant/evenements.

**Decision prudente :** les deux branches restent des candidates au nettoyage, mais ne doivent **pas** etre supprimees comme des doublons exacts. Certaines differences peuvent etre simplement des horodatages ou des scenarios de recette, d'autres portent sur la configuration metier SVA. Conserver avant toute suppression un export externe chiffre, une restauration en environnement isole et un inventaire des changements de configuration propres a chaque branche. Les 10 branches restent conservees pour le moment.

Ce constat corrige toute interpretation selon laquelle « 85 migrations et memes nombres de lignes » prouveraient l'absence de donnees uniques. Aucun compte, numero, contrat, paiement ni route telecom n'a ete modifie. **Aucune branche supprimee.**

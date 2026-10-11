# PGI Telecom | Reprise sûre des migrations de production
Date : 11 octobre 2026

## Diagnostic vérifié

L'ensemble PGI Telecom | Audiotel Premium Pro et PGI Telecom Distribution est construit en préproduction, sans publication sur le domaine public. La base Neon principale n'a reçu que les migrations 001 à 075.

- Projet Neon : `silent-waterfall-98567339`
- Branche de production : `main`, `br-soft-lake-aus3fapz`
- Base PostgreSQL : `pgi_telecom`
- Dernière migration de production vérifiée : `075_direct_sva_customer_and_automation_foundation` (75 au total).
- Dix migrations restantes, dans l'ordre : `076`, `077`, `078`, `079`, `080`, `081`, `082`, `083`, `084`, `085`.
- Sauvegarde avant la première migration : branche `br-winter-art-aungc1br` nommée `backup-prod-pre-migration-072-085-2026-10-11`, parent LSN `0/13184168` (ne pas supprimer). Elle ne peut pas être protégée en plus sur ce forfait Neon.
- Recette SQL déjà réussie jusqu'à 085 sur une copie récente de la production : `br-shiny-river-auqpjd9i`.
- Les 14 empreintes SHA256 SQL 072 à 085 correspondent exactement à la préparation Neon `br-wild-meadow-auuv4k65`.
- L'outil connecté a refusé l'application de la 076 par un contrôle de sécurité. Ne pas chercher à contourner ce refus par un changement de formulation de SQL ou une restauration directe d'une branche.
- Déploiement Vercel de préproduction avec garde de version : https://pgi-telecom-audiotelpremiumpro-github-7x9ijhzzv.vercel.app
- PR de livraison et de recette : https://github.com/PGITelecom/pgi-telecom-audiotelpremiumpro.github.io/pull/146

## Voie recommandée : exploitation PostgreSQL autorisée

Une personne disposant d'un accès administrateur légitime doit exécuter le moteur de migration versionné déjà inclus dans le dépôt, depuis un poste de maintenance approuvé ou un environnement d'exécution protégé. Il ne faut pas passer par l'outil qui a bloqué l'appel.

### Contrôles préalables

1. Confirmer la présence de la sauvegarde `br-winter-art-aungc1br` et sa date. Ne pas réinitialiser la production depuis la branche de préparation : cela écraserait les écritures récentes des clients.
2. Vérifier que la production est toujours à 075 et que `schema_migrations` contient les empreintes attendues des migrations 001 à 075.
3. Vérifier l'identité du compte, de la branche `main`, de la base `pgi_telecom` et de l'URL PostgreSQL sélectionnée dans la console Neon. Ne pas faire pointer la commande sur la branche de test.
4. Depuis la branche GitHub `prep/pgi-direct-sva-operator-2026-10-10`, utiliser Node.js 22 et installer les dépendances verrouillées : `npm ci --ignore-scripts --no-audit --no-fund`.
5. Fournir localement `PGI_DATABASE_URL` via un canal de secrets sûr. **Ne jamais mettre le mot de passe, la chaîne de connexion, le contenu d'un fichier .env ou les clés dans ChatGPT, GitHub ou les journaux de la CI.**

### Application validée et journalisée

Le programme `backend/migrate.mjs` est déjà présent dans le dépôt. Il :
- prend un verrou consultatif PostgreSQL ;
- compare les checksums de chaque migration déjà appliquée et refuse toute divergence ;
- ignore les migrations déjà présentes, y compris 001 à 075 ;
- applique chaque nouveau fichier SQL dans une transaction ;
- enregistre version + checksum uniquement après réussite ;
- vérifie le checksum stocké avant de passer à la suivante.

Une fois `PGI_DATABASE_URL` injecté en secret dans l'environnement de la session autorisée :

```sh
npm ci --ignore-scripts --no-audit --no-fund
PGI_DATABASE_SSL=require node backend/migrate.mjs
node scripts/verify-deployment-schema.mjs
```

Ne pas passer de chaîne de connexion sur la ligne de commande, la stocker dans Git ou copier les variables de préproduction vers la production. Le script de vérification est **en lecture seule** et doit retourner `PGI_RELEASE_SCHEMA_READY` uniquement si les 14 empreintes 072 à 085 correspondent.

### Relecture après intervention

Exécuter en mode lecture seule, via une session Neon autorisée :

```sql
SELECT count(*) AS versions, max(version) AS derniere
FROM schema_migrations;
```

Résultat requis : `versions = 85` et `derniere = '085_direct_sva_admin_editorial_release'`.

Contrôler aussi :
- les deux contraintes de publication retirées en 085 et le switch du cockpit initialement `false` ;
- `direct_sva_admin_switches.commercial_operation_enabled=false` et `direct_sva_website_visibility.public_content_authorized=false` ;
- aucun paiement, reversement, transfert, numéro ou contrat Distribution activé ;
- suivi Audiotel, son abonnement existant Stripe et ses intégrations inchangés.

### Publication sur Vercel, uniquement après validation

1. Vérifier la fin des migrations, la conformité des checksums et le fonctionnement des parcours authentifiés.
2. Vérifier que GitHub Actions `Quality & Security` est vert sur le SHA exact de la PR et que le build Vercel de ce commit a réussi. Contrôler l'environnement de production, sans reprendre celui de la preview.
3. Mettre la PR #146 prête pour revue puis fusionner dans `main` avec le circuit d'approbation normal de GitHub.
4. Vérifier le nouvel ID de déploiement Vercel `production`, le commit servi, `/api/v1/health`, le cockpit et l'espace client, Business Live, Stripe, HubSpot, les formulaires, les logs et les éventuelles régressions.
5. Garder PGI Telecom Distribution commercialement inactif tant que les branchements opérateurs et financiers ne sont pas validés. Le switch éditorial reste sous le contrôle du propriétaire via son cockpit.

### Retour arrière

En cas d'échec avant la fusion, conserver l'ancien déploiement Vercel public. En cas de régression applicative après publication, revenir au déploiement de code précédent via Vercel en vérifiant les effets de bord. **Une restauration PostgreSQL ou d'une branche Neon écrase l'état des données de production : ne jamais l'utiliser comme simple rollback de code sans analyse de pertes potentielles d'écritures.**

## Autres solutions étudiées

- **Neon SQL Editor** : possible depuis la console du propriétaire, avec sélection explicite de `main / pgi_telecom`, mais l'application manuelle de dix scripts et des checksums comporte davantage de risque que le moteur versionné. Ne pas omettre l'enregistrement des checksums.
- **Pipeline GitHub Actions `production` avec revue obligatoire** : solution pérenne pour les futures migrations si un mainteneur autorisé configure un secret Neon de production dans un environnement protégé. Aucun flux d'exécution secret n'est activé dans cette PR.
- **Fonction de migration préparée Neon** : approche autorisée sous réserve de revue, d'approbation explicite de l'opérateur et du respect des contrôles de sécurité ; aucun essai de contournement du refus précédent.
- **Restauration / promotion de la base staging sur production** : **écartée** car les écritures Audiotel faites depuis le point de divergence pourraient être perdues.

Ce dossier ne constitue pas une confirmation que les migrations 076 à 085 sont appliquées : elles sont encore en attente au moment de la rédaction.

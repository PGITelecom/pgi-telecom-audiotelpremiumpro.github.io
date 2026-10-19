# PGI Telecom | Maintenir Neon Free sans dégrader le service

**Audit en lecture seule : 19 octobre 2026.** Aucun changement Neon, aucune fusion main, aucun déploiement Vercel. Les constats ci-dessous concernent la production `4d85bbc`.

## Mesures confirmées

- Projet : `PGI Telecom Audiotel Premium Pro`, Neon Free.
- Période de facturation interrogée : du 01/10/2026 au 01/11/2026.
- Calcul comptabilisé lors du contrôle : **361 656 CU-secondes**, soit **100,46 CU-heures**. Les `active_time_seconds` étaient de 1 445 052 secondes, soit **401,4 h** d'activité cumulée; au réglage fixe de 0,25 CU, cela explique les CU-heures. Ces relevés sont ponctuels et évolueront.
- Limite standard Free observée : **100 CU-heures/mois/projet**. Le dépassement risque une suspension du calcul, mais pas une suppression de la base.
- Base `pgi_telecom` : **47 Mo** (`pg_database_size` : 49 250 304 octets), stockage bien inférieur à 1 Go.
- Transfert réseau relevé : **473 283 076 octets**, bien inférieur aux 5 Go Free.
- 9 branches Neon, dont la production et des branches de validation/sauvegarde. **Ne rien supprimer sans examen et autorisation.**
- Endpoint principal : **0,25 CU**, `suspend_timeout_seconds=0`, qui signifie le *défaut* (300 s/5 minutes), **pas** « ne jamais suspendre ». Le forfait Free impose cette mise en veille après inactivité.
- La requête `pg_stat_activity` ponctuelle n'a révélé qu'une session active issue du contrôle de l'audit. Elle ne prouve pas l'absence de sessions à d'autres heures.

## Hypothèse principale corroborée par le code et les logs

**Le démarrage applicatif sur Vercel touche systématiquement Neon, avant même de répondre à une requête purement statique.**

- `scripts/start-vercel.sh` invoque `scripts/verify-deployment-schema.mjs` à chaque démarrage de conteneur.
- `backend/server.mjs` lance `createDefaultBackend()`, qui ouvre `PostgresStore.connect()`, prépare les garanties de schéma et attache le relais d'événements PostgreSQL.
- Le gestionnaire de fichiers statiques n'est créé qu'après cette initialisation. Ainsi un **GET /**, des consultations d'images/CSS, et même certaines requêtes de robots vers des pages inexistantes peuvent réveiller le calcul PostgreSQL lors d'un démarrage à froid.
- Les logs Vercel confirment « PGI_RELEASE_SCHEMA_READY » et « listening » lors de traitements GET /.
- Le volume des logs n'est **pas** un décompte exact de visites : plusieurs lignes sont émises lors d'une seule invocation. Aucune causalité exclusive sur la totalité des CU-heures n'est démontrée.

## Autres causes secondaires à mesurer

- Cron Vercel toutes les heures : Business Live reset, comptabilité, parrainage. Garder leur cadence fonctionnelle sans neutraliser la remise à zéro ou les versements.
- Cron quotidien : notifications email et bilan PGI Telecom. Garder le bilan et les emails.
- GitHub Production Watch toutes les heures à minute 17. La surveillance compte pour la fiabilité et teste certains endpoints publics dynamiques; ne pas arrêter aveuglément.
- Le serveur Vercel utilise `PGI_PROCESS_ROLE=api`, donc `startWorkers` est désactivé : ne pas affirmer que ses pollings en arrière-plan sont la cause de cette consommation sur Vercel.
- `EventBus.attachPostgres` utilise `sql.listen`; ce rôle doit être étudié avant tout changement, puisque LISTEN/NOTIFY participe au temps réel. Une connexion au repos, à elle seule, ne prouve pas l'impossibilité de mise en veille.

## Plan technique de correction à préparer puis tester sur branche

1. **Dissocier les ressources statiques du bootstrap PostgreSQL** : images, styles, JS, articles publics ne nécessitant pas d'état dynamique. Servir ces requêtes sans lancer `verify-deployment-schema`, le pool ni le relais, tout en gardant les CSP, X-Robots-Tag, cache headers, statuts HTTP, et les règles anti-traversée de répertoires.
2. **Respecter les pages dynamiques** : la page d'accueil, `robots.txt` et les pages `/distribution-sva/` utilisent les états de publication du Pôle depuis Neon. Préserver la synchronisation du commutateur, le sitemap, les canoniques et le SEO. Ne pas les basculer en HTML figé ou CDN sans mécanisme d'invalidation sûr.
3. **Garder les API, les connexions clients, Stripe, HubSpot, Resend, Business Live, les resets, les tâches de comptabilité, le parrainage et les bilans** strictement inchangés.
4. **Faire un essai reproductible sans données clients** : test des routes statiques et privées avec et sans base accessible; mesure du nombre de connexions ouvertes et de la durée d'activité du calcul; confirmer la possibilité de mise en veille après cinq minutes d'inactivité.
5. **Recette sur branche sans déploiement production** : tests existants et nouveaux tests de non-régression, comparaison des statuts/entêtes/HTML. Fusion et Vercel seulement sur instruction explicite du propriétaire.
6. **Après déploiement autorisé** : comparer le nombre de CU-heures par jour pendant une fenêtre représentative, évaluer les pics, les éventuels ralentissements du réveil et les coûts résiduels. Sans preuve d'économie, conserver un plan de retour arrière.

## Risques et limites

- Les 100 CU-heures gratuites ont déjà été atteintes au dernier relevé; la correction préparée ne rendra pas automatiquement la capacité pour la période en cours.
- En production, ne jamais publier une page du Pôle inactive par erreur, ni servir une version obsolète du commutateur.
- Les 9 branches ne doivent pas être nettoyées comme simple réponse aux CU-heures : une branche inactive ne consomme pas de calcul en continu.
- Aucun bénéfice chiffré ni disponibilité 24 h/24 garantis avant une mesure post-changement.

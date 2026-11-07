# Audiotel Premium Pro | Contrôle d'infrastructure et sécurité avant exploitation
Lecture seule : 07/11/2026. Aucun changement de configuration ni migration exécutée.

## Observations vérifiées
- Projet Neon `silent-waterfall-98567339`, région actuelle `aws-us-east-1`. Il ne s'agit pas d'une région de résidence de données située dans l'UE.
- Historique de récupération annoncé par l'API projet : `history_retention_seconds=21600` (6 h). Cela ne constitue pas une politique de sauvegarde indépendante.
- Compute minimal et maximal de la configuration actuelle : `0.25 CU / 0.25 CU`. Ne pas assimiler un workflow CI vert à un test de charge du service réel.
- Pas de liste d'IP autorisées au niveau du projet et connexions publiques non bloquées à ce niveau, sous réserve des contrôles d'authentification et de réseau appliqués ailleurs.
- Tables `tenants`, `tenant_revenue_distributions`, `tenant_service_incidents`, `tenant_relation_cases` et trois tables `direct_sva_*` contrôlées : PostgreSQL RLS disabled / FORCE RLS disabled. Cela ne démontre pas une fuite de données, car les API implémentent des contrôles applicatifs ; l'isolation en profondeur reste à démontrer.
- Aucun numéro attribué, aucun reversement SVA enregistré, aucune connexion opérateur prête au contrôle.

## Blocages obligatoires avant production

### Contrôles d'accès
1. Revue externe des API tenant et staff avec tests d'accès croisé, IDOR, rôles, cookies, CSRF, journalisation et exports.
2. Créer un rôle PostgreSQL de lecture applicative ne possédant pas `BYPASSRLS` et n'étant pas propriétaire des tables, avant tout déploiement RLS contrôlé.
3. Concevoir des politiques RLS tenant à tenant, avec `USING` ET `WITH CHECK` par opération, transactions et état de session fiables ; la désactivation d'une session doit rendre l'accès impossible.
4. Ne pas activer RLS sur les tables de production tant que les traitements internes et les workers n'ont pas été validés sur clone/rejeu de données. Une activation brutale peut bloquer les paiements, le service client et les rapports.
5. Prévoir rotation des secrets, permissions minimales, revue d'accès et audit non réinscriptible pour les mouvements financiers.

### Résidence, confidentialité et conservation
1. Étudier migration de projet vers une région UE réellement proposée par l'hébergeur, y compris coûts, restauration, disponibilité et plan de bascule sans perte.
2. Tant que les données restent aux États-Unis, documenter et vérifier la base juridique du transfert, les garanties du sous-traitant et le registre de traitements avec conseil RGPD compétent.
3. Fixer des périodes de conservation par type de données : CDR, relevés financiers, justificatifs, demandes clients, incidents, journaux d'accès, historique des commandes et preuves contractuelles.
4. Limiter les données personnelles contenues dans les logs et masquer les IBAN/RIO, tokens et identifiants d'appelants sur les exports non habilités.

### Sauvegarde et résilience
1. Mettre en place une sauvegarde PostgreSQL indépendante, chiffrée et restaurable hors du projet Neon. Vérifier la couverture des fichiers de preuve et des données applicatives hors base.
2. Effectuer un exercice complet de restauration sur un environnement isolé, avec durée et intégrité mesurées, contrôle de la cohérence et de la dernière écriture comptable.
3. Définir RPO/RTO acceptables contractuellement et disposer d'un protocole de retour arrière réaliste pour Vercel, Neon, routage, courriels et PSP.
4. Mesurer le trafic de pointe avant de fixer l'autoscaling, les limites de connexions PostgreSQL et le budget d'exploitation. La capacité actuelle ne prouve pas la tenue en charge pour 150-300 clients.

### Contrôle des recettes et de l'argent
1. Aucun statut `paid` sans référence prestataire vérifiée et rapprochement bancaire.
2. Un idempotency key, une écriture unique et un contrôle du solde agrégé avant chaque lot de reversement.
3. Vérifier le statut juridique du règlement de fonds de tiers avant toute activation bancaire.
4. Séparer les recettes Stripe des abonnements des recettes SVA payées par les opérateurs.
5. Le portail de distribution directe reste hors publication et séparé d'Audiotel ; aucun contournement des contrats ou des décisions d'attribution Arcep.

## Critères de sortie
- Tests de sécurité sur une copie avec rôles non propriétaires, preuves RLS, aucun accès interclient.
- Sauvegarde indépendante restaurée et vérifiée ; objectifs RPO/RTO prouvés, pas simplement déclarés.
- Tests de charge sous conditions réalistes, monitoring et alarmes avec procédure d'escalade.
- Contrôles RGPD / transfert international signés, rétention et suppression démontrées.
- Validation juridique des numéros SVA, contrats opérateur et statut PSP.
- Confirmation formelle des factures, des reversements et de la comptabilité par les parties compétentes.
- GO explicite du propriétaire. Aucun PR brouillon ne déclenche ce GO.

**Interdiction pendant la préparation :** aucune activation de RLS, aucune rotation de secrets, aucune migration de région, aucun effacement ni modification des données réelles sans plan de reprise et autorisation.

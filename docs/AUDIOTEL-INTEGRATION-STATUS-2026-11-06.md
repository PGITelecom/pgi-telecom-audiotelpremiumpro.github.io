# Audiotel Premium Pro : dossier d'intégration sans mise en service

État : branche de préparation distincte de main. La publication des pages Pôle, le backend commercial, Stripe, les données Neon et les services télécom en production ne sont pas modifiés.

## Ce qui est réellement raccordé par cette branche

- L'API staff GET /api/v1/platform/launch-readiness conserve la grille de lancement existante.
- La réponse contient désormais audiotel_order_assurance, un inventaire en lecture seule des ressources de numérotation, connexions opérateur, affectations, tarif d'abonnement, configuration légale et comptable.
- La grille reste strictement NON ACTIVANTE, même si tous les indicateurs internes sont présents : une ligne en base ne prouve jamais une affectation réglementaire, une connexion SIP saine, un événement de paiement signé ou une comptabilité légale certifiée.
- L'observation refuse toute erreur de base sans révéler de détails internes ou de données personnelles.
- Une suite de tests couvre les états vides, les contrôles financiers manquants, les erreurs de base et la séparation des unités d'activité.

## Unité opérationnelle Audiotel Premium Pro

- Les numéros SVA sont juridiquement affectés par l'opérateur attributaire tant que PGI n'est pas lui-même attributaire. Ne jamais délivrer un numéro depuis une simple liste locale.
- Le revenu d'abonnement PGI et les flux de reversement SVA doivent rester dans des journaux réconciliables, avec gestion séparée des avoirs, remboursements, retenues, litiges et frais du PSP.
- Le tarif client est historisé en version de prix ; pas de modification rétroactive des contrats existants.
- Un statut HTTP 200 dans une API de diagnostic n'autorise ni prise de commande ni facturation.

## Circuit de production restant à réaliser avant un feu vert

1. Raccorder le dossier client B2B, la vérification KYB, la politique métier, la signature du contrat et l'éligibilité SVA.
2. Définir la réservation transactionnelle idempotente d'un numéro attribuable, sans double allocation.
3. Brancher l'API de l'opérateur attributaire avec ACK signé / contractuellement authentifié ; prévoir indisponibilité, doublons, expirations et annulations.
4. Vérifier la disponibilité SIP/IVR/acheminement, les informations tarifaires obligatoires et les CDR certifiés.
5. Délivrer le numéro et les paramètres de destination dans le tenant autorisé seulement après preuve opérateur et contrôle technique.
6. Brancher Stripe sur le compte Audiotel correct avec webhook signé et antifraude. Ne jamais activer l'accès depuis le retour navigateur.
7. Configurer la personne morale, le régime TVA, le plan de comptes, les frais Stripe, les journaux, la piste d'audit, la banque, le FEC et le flux de facturation électronique selon le calendrier applicable.
8. Qualifier le rôle juridique PGI (principal ou mandataire), la TVA, les fonds de tiers, le PSP et la responsabilité des reversements.
9. Configurer l'isolation effective du portail Distribution et ses rôles SQL non bypass-RLS avant tout accès public. Conserver le mode préparatoire du Pôle tant que ses autorisations propres ne sont pas validées.
10. Valider la reprise après incident, la rétention, les sauvegardes, la conformité RGPD, les parcours d'absence de paiement et de suspension, la portabilité et la résiliation.
11. Exécuter la suite complète du dépôt et les contrôles SQL/SIP/PSP de recette. Revue indépendante et GO explicite avant toute publication.

## Portée des validations

Le test unitaire de l'observateur ne remplace pas la recette réelle d'une commande ni les mesures réseau. Cette branche ajoute désormais des modules préparatoires **APP et DSVA séparés**, et des tests unitaires dédiés, sans activer de route publique. Les modules restant dans le kit local ne sont pas automatiquement intégrés. Leur compatibilité doit être vérifiée séparément, notamment pour éviter de mélanger Audiotel et la distribution directe.

### Intégration effectuée sur la branche isolée au 6 novembre 2026

- Vérification de la disponibilité de numéros, des connexions opérateurs, du prix actif, des paramètres légaux et de l'état comptable via l'API de diagnostic staff en lecture seule.
- Ajout de `audiotel-platform-intake.mjs` : intention de commande transactionnelle et idempotente, sous autorisation serveur, sans attribution ni paiement et sans route publique active.
- Ajout de `audiotel-billing-calendar.mjs` : préparation de la période gratuite jusqu'à la fin du mois civil en heure de Paris ; ce module ne crée pas d'abonnement Stripe.
- Ajout de `audiotel-stripe-accounting-preview.mjs` : brouillons équilibrés, distinction facture/TVA/commission Stripe/compte de passage/virement bancaire, sans comptabilisation réelle.
- Ajout de `customer-portal-adaptability.mjs` : politique d'affichage par service et habilitation, distincte de l'autorisation des actions côté API.
- Ajout de modules préparatoires DSVA (suivi administratif, rapprochement, politique d'ouverture des blocs, lecture client cloisonnée, livre analytique), sans mise en service ni migration.
- Tests supplémentaires sur la commande répétée, les états de suspension, la TVA, les frais de paiement, les changements horaires Paris et l'isolation entre activités.
- Validation GitHub Actions du commit `b3d15e086052ccafd841bb06392aa37059281687` : succès du workflow Quality & Security, exécution `42306768146` (tests du dépôt, migrations sur PostgreSQL jetable, intégrations et contrôles).
- Pas de table `app_number_order_intents` installée dans Neon de production ; aucun numéro SVA enregistré ni attribué lors de la vérification.

### Non terminé, et donc non présentable comme une commande entièrement automatique

- Aucun parcours public de commande APP n'est activé avec les nouvelles intentions. Le moteur ne traite pas de manière autonome un paiement ou un numéro en production.
- L'opérateur attributaire, le KYB/KYC, la signature, l'acceptation SIP/CDR et l'acheminement doivent fournir des preuves réelles et des adaptateurs autorisés.
- Stripe sur le bon compte, le régime fiscal approuvé, les mentions de factures, l'export FEC et le rapprochement bancaire ne sont pas opérationnels.
- L'isolation PostgreSQL RLS du portail Distribution doit être configurée et contrôlée avant ouverture.
- Les scripts de préparation SQL restent confinés hors des migrations applicables automatiquement.

**Aucune fusion ni déploiement n'est autorisé par cette livraison.**

Interdictions actuelles : pas de déploiement, pas de modification de production Neon, pas de Stripe, pas de numérotation réelle, pas de reversements, pas de changement d'interface et pas de fusion vers main.

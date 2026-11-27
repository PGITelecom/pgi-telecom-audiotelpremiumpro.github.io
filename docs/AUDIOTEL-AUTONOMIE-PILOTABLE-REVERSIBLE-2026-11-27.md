# Audiotel Premium Pro : évolution vers une autonomie pilotable et réversible
Version : 27 novembre 2026. Statut : PRÉPARATION UNIQUEMENT. AUCUN DÉPLOIEMENT AUTORISÉ.

## Décision de direction

Faire évoluer la plateforme **Audiotel Premium Pro** sans modifier ou casser ses services existants, son cockpit, les espaces clients, les contrats, la base de données ou ses flux de paiement. Éviter les prestataires non indispensables, les frais fixes injustifiés et les dépendances exclusives. Le produit doit pouvoir changer de fournisseur sans réécriture métier.

**Ne pas confondre indépendance du logiciel et indépendance des réseaux.** Un numéro 089 atteignable depuis des abonnements français suppose des interconnexions et des accords de collecte. Une répartition des fonds vers les éditeurs suppose un circuit légalement conforme aux exigences de paiement. Aucun logiciel libre ne remplace ces accords ou autorisations.

## État observé au 27/11

- Dépôt GitHub : `PGITelecom/pgi-telecom-audiotelpremiumpro.github.io`, branche de préparation `evolution-autonomie-2026-11-27`, créée à partir du commit `a6522790741e32ef40ed46bc7e749e28b6cb10fa`. La branche principale reste inchangée.
- Le code contient déjà `backend/carriers/adapter-contract.schema.json`, `config/dependency-policy.json`, `telephony/README.md`, `infra/docker-compose.core.yml`, les modules `assets/direct-sva-*.js`, `assets/client-number-control.js` et des vues de comptabilité. Réutiliser ces composants, ne pas introduire de duplicata.
- Site actuellement lié à Vercel ; Neon PostgreSQL pour les données ; GitHub pour la traçabilité. Vercel et Neon sont des fournisseurs de plateforme, réversibles sous réserve d'export et restauration vérifiés, mais ne sont pas « gratuits » par nature.
- Statut commercial SVA direct : **préparation**, aucune attribution de bloc 089, interconnexion SVA, collecte ou habilitation PSP démontrée. Les contrôles existants d'activation commerciale directe restent OFF.
- Source documentaire : Google Doc « Cahier des charges Audiotel Premium Pro » et Google Sheets « Audiotel Premium Pro | Pilotage stratégique, fournisseurs et prospects ». Ne pas recréer d'autres maîtres concurrents.

## Architecture d'évolution, sans rupture

### Couche 1 : cockpit propriétaire Audiotel Premium Pro

Une seule interface d'administration. Réutiliser le système de rôles/sessions actuel. Ajouter des vues distinctes, uniquement via activation explicite et API sécurisée :

1. **Autonomie et fournisseurs** : inventaire des services requis, facultatifs et remplaçables ; statut réel de connexion ; propriétaire ; coût fixe/variable contractualisé ; possibilité d'export ; criticité ; délai de sortie.
2. **Numérotation et réseau** : statut de la demande Arcep, inventaire des ressources réellement attribuées, affectations aux éditeurs, routage SIP et opérateur primaire/secours. Aucun numéro 089 fictif déclaré disponible.
3. **Appels et CDR** : journal interne avec identifiants stables, correspondance opérateur, minutes facturables, anomalies, statistiques isolées par client ; distinguer mesures internes et montants officiellement facturés.
4. **Collecte et paiement** : encaissements confirmés, relevés opérateur, retenues, dette envers éditeurs, commission Audiotel et paiement réalisé ; aucun bouton de virement avant droit, KYC et confirmation bancaire.
5. **Gestion des changements** : état OFF/PRÉPARATION/PRÊT à évaluer/EXPLOITATION AUTORISÉE ; prérequis explicites ; personnes habilitées ; décisions et journal d'audit.

Tout affichage présentant « prêt », « conforme », « payable », « actif » ou « disponible » doit dépendre de preuves réelles, jamais d'un drapeau local seul.

### Couche 2 : espace client existant

Faire évoluer `client.html` et `assets/client-number-control.js` seulement dans une PR isolée ultérieure, avec les données réellement autorisées propres au client : numéros attribués, portabilité, destinations, appels, relevés confirmés, documents, support. Refuser l'accès à un autre tenant ; ne jamais afficher les coûts internes négociés, la marge confidentielle ou les identifiants d'autres éditeurs. Un espace client de démonstration ne doit pas être confondu avec un service SVA exploitable.

### Couche 3 : socle libre sous notre contrôle

| Besoin | Premier choix | Alternative réversible | Condition |
| --- | --- | --- | --- |
| Signalisation/routage SIP | Kamailio ou OpenSIPS | autre proxy SIP standard | infrastructure adaptée et configuration opérateur contractuelle |
| Service vocal / SVI | FreeSWITCH existant prévu | Asterisk | aucun remplacement tant que l'existant répond au besoin |
| Données métier | PostgreSQL compatible avec Neon | PostgreSQL auto-hébergé ou autre hébergeur | export logique, restauration, rôles, chiffrement |
| Cache/queue | Valkey prévu | PostgreSQL ou Redis compatible selon usage | pas de verrouillage propriétaire |
| API / logique financière | backend Node.js existant | exécution chez autre hébergeur compatible | interfaces standard, secrets hors dépôt |
| Monitoring | métriques/logs auto-hébergés si justifiés | service tiers non exclusif | aucune collecte de données sensibles inutile |
| Dashboard client / cockpit | modules JavaScript existants | UI équivalente sur même API | pas de refonte graphique obligatoire |

Les licences open source ne suppriment pas les coûts d'hébergement, d'exploitation, de sécurité et de télécom. Ne pas installer gratuitement un composant dont l'exploitation ferait augmenter le coût total.

### Couche 4 : adaptateurs strictement périphériques

Conserver le cœur métier sans SDK spécifique d'opérateur. Pour chaque prestataire, limiter le contrat d'intégration à :

- SIP : extrémités, transports, codecs, CLI, DNIS, SLA, route de secours ;
- CDR : mapping documenté, identifiant, temps, durée, tarifs, rejets et rectifications ;
- Collecte : période, montant réellement encaissé, retenues, litiges, référence de règlement ;
- PSP : rôle légal, opérations permises, compte bancaire, écritures d'audit, preuve d'exécution.

Un nouvel opérateur ne doit pas imposer sa propre UI, son CRM, son SVI, une source de vérité opaque ou l'exclusivité. Une disponibilité nationale 089 doit être validée contractuellement et techniquement.

## Pilotage possible depuis ChatGPT

**Déjà pilotable lorsque la connexion et l'action sont disponibles** : lecture/édition de documents Drive et Google Sheets, lecture du dépôt GitHub, préparation de branches et de PR, consultation du projet Vercel et de la base Neon, suivi des mails et des partenaires. Les modifications d'infrastructure et opérations financières demandent autorisation, droits et vérification explicites.

**À prévoir, mais non actuellement connecté comme téléphonie opérationnelle** : pilotage FreeSWITCH/Kamailio via un service privé limité et authentifié. Ne jamais exposer d'interface de commande générale, d'AMI/API d'administration non protégée ni de secret dans le navigateur, GitHub ou le Google Sheet. Le cockpit envoie des intentions métier validées au backend ; le backend contrôle les rôles, le CSRF, l'idempotence, les plafonds et l'audit, puis dialogue avec les systèmes autorisés. ChatGPT ne reçoit que les actions effectivement exposées et approuvées.

Aucun agent automatisé n'obtient un accès permanent illimité aux appels, paiements, comptes clients, DNS ou systèmes de production. Principe de moindre privilège et journalisation systématique.

## Protection contre toute rupture

1. Préparation uniquement dans une branche GitHub non déployée. Aucun merge dans `main`, aucune commande de déploiement, aucun changement DNS ou Stripe.
2. Changements **additifs** : nouveaux éléments isolés et OFF. Ne pas changer le schéma en détruisant colonnes/tables ; pas de migration Neon en production. Ne pas effacer les anciens statuts et historiques.
3. Séparer **rollback logiciel** (retour au commit antérieur) de **rollback opérateur** (routes, portabilité, collecte) et **reprise de données** (sauvegarde/rétablissement PostgreSQL). Le retour en arrière d'une portabilité ou d'un paiement n'est pas un simple interrupteur.
4. Prévoir une correspondance de chaque fonction nouvelle avec son module existant, la permission, la source de vérité, les données exposées et un contrat de désactivation indépendant.
5. Un coût n'est « validé » qu'avec devis et assiette de facturation. Un fournisseur n'est « opérationnel » qu'avec preuve. Le modèle de profit doit inclure tous frais, retenues et impôts.
6. Contrat de fournisseur : portabilité, export CDR et finance, SLA, suppression/retour de données, préavis, absence d'exclusivité, frais de sortie négociés, titulaire de la numérotation selon Arcep.
7. Aucune attribution Arcep, habilitation PSP, droit d'exploiter une ressource ou accord de collecte ne peut être créé par un changement logiciel.

## Ordre des travaux sans duplication

**A.** Mettre à jour les registres Google Sheets et Docs (contacts, Kbis, coûts, décisions, preuves), en conservant tous les historiques.

**B.** Sur une branche isolée, cartographier chaque module cockpit/client/API déjà présent et ses manques. Préparer une extension de la vue administrateur d'autonomie et des preuves, par lecture seule et OFF par défaut.

**C.** Définir des adaptateurs standards indépendants et leur modèle de données. Aucun partenaire n'est déclaré compatible sans confirmation de son périmètre 089.

**D.** Préparer, sans activer, la procédure et les contrôles du dépôt de numérotation, de l'interconnexion, de la collecte, de la portabilité et des paiements.

**E.** Soumettre les éventuelles activations à un accord distinct de la direction, après preuve contractuelle/réglementaire et revue de sécurité.

## Conditions fournisseurs et immatriculation

Idelio a demandé le **25 novembre 2026** : extrait Kbis de moins de trois mois, pièces d'identité des bénéficiaires effectifs, projet d'exploitation détaillé, mécanismes antifraude existants et présentation des partenaires techniques/financiers. Le **26 novembre**, Eric Vivien a précisé qu'Idelio ne reprendrait l'étude qu'après création effective de la société et structuration du dossier. Cette exigence ne peut pas être imputée par défaut à tous les autres fournisseurs.

Constituer dès maintenant une **présentation non confidentielle** de l'activité, de l'architecture et du dispositif antifraude prévu. L'immatriculation et les documents officiels ne peuvent pas être simulés. Les pièces d'identité doivent être transmises uniquement par un canal sécurisé vérifié, après vérification de nécessité et de confidentialité.

## Ce qui n'est pas accompli par cette préparation

Aucune connexion SIP, aucun opérateur SVA 089, aucun paiement PSP, aucun hébergement vocal, aucun déploiement ou changement sur le site en production n'est activé par ce document. La branche de préparation sert à garder la décision, la conception et l'historique de réversibilité sous contrôle.

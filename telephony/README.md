# Téléphonie : couche opérateur minimale

Ce dossier documente l'interface attendue entre l'opérateur SVA et PGI Telecom.

## Chaîne cible

```
Opérateur SVA D080
      │
      │ SIP
      ▼
SBC / Kamailio
      │
      ▼
FreeSWITCH
      │
      ├── SVI
      ├── files d'attente
      ├── ponts vers destinations des sociétés clientes
      ├── CDR
      └── événements temps réel
```

## Paramètres à obtenir avant configuration finale

Ne pas inventer ces valeurs. Elles devront venir du contrat opérateur :

- adresse(s) IP/SBC opérateur ;
- transport UDP/TCP/TLS autorisé ;
- ports SIP ;
- authentification IP ou digest ;
- codecs ;
- format du numéro appelé ;
- format CLI ;
- gestion P-Asserted-Identity / Diversion ;
- DTMF RFC2833/SIP INFO ;
- timers et Session-Expires ;
- codes SIP spécifiques de rejet ;
- contraintes de concurrence ;
- plan de reprise / second SBC ;
- méthode d'export CDR opérateur.

## Sécurité

- aucune interface SIP d'administration exposée publiquement ;
- ACL stricte sur les IP opérateur ;
- fail2ban/rate-limit en complément, jamais à la place des ACL ;
- TLS/SRTP si fourni et supporté de bout en bout ;
- secrets hors GitHub ;
- logs sans numéro complet par défaut ;
- séparation réseau management / signalisation / données lorsque l'infrastructure le permet.

## CDR

FreeSWITCH devra générer un identifiant d'appel stable propagé au backend et rapprochable avec l'identifiant opérateur.

Les durées suivantes doivent rester distinctes :

- durée totale ;
- attente ;
- conversation ;
- durée facturable ;
- durée éligible au reversement.


## Routage multi-client obligatoire

En production, FreeSWITCH doit transmettre le numéro SVA effectivement appelé à chaque demande de routage.

Exemple de contrat machine :

```
GET http://127.0.0.1:8080/api/v1/internal/routing/next-destination?sva_number=0890123456
```

ou, pour la réponse texte destinée au dialplan :

```
GET http://127.0.0.1:8080/api/v1/internal/routing/next-destination/text?sva_number=0890123456
```

Le backend résout :

```
numéro SVA
  → tenant propriétaire
  → destinations appartenant au même tenant
  → destination spécifique au numéro ou générale
  → priorité, capacité et secours
```

En mode production :

- l'absence de `sva_number` provoque `SVA_ROUTING_CONTEXT_REQUIRED` ;
- un numéro inconnu ou non routable provoque `SVA_NUMBER_NOT_ROUTABLE` ;
- un numéro sans tenant provoque `SVA_TENANT_NOT_CONFIGURED` ;
- un CDR associant un expert d'un autre tenant est rejeté avec `EXPERT_TENANT_MISMATCH`.

Ce comportement est volontairement fail-closed : aucun appel ne doit pouvoir tomber sur l'équipe d'un autre éditeur à cause d'une configuration incomplète.

Le `destination_number` FreeSWITCH doit être propagé sans invention ni substitution. PGI conserve le numéro canonique en E.164 dans `sva_numbers` et n'accepte une forme nationale ou spécifique à un trunk que si elle a été explicitement configurée dans `sva_number_aliases`. Aucune normalisation ambiguë ne doit être devinée en production.


Les destinations B2B sont stockées dans `tenant_call_destinations` et peuvent être un téléphone, un trunk SIP, un PBX ou un centre d'appels de la société cliente. Les nouvelles destinations démarrent en `testing` et doivent être explicitement activées. FreeSWITCH doit recopier `call_destination_id` dans le CDR. Les anciens endpoints `next-expert` restent disponibles uniquement pour compatibilité.


## Composants autonomes préparés (hors réseau de production)

### CDR : livraison différée sur le serveur voix

Le module `telephony/cdr-spool-delivery.mjs` envoie les CDR JSON terminés à
l'API PGI déjà existante. Il conserve le fichier lors des pannes réseau, des
erreurs d'authentification, des limites de débit et des blocages contractuels.
Une réponse PGI valide 200/201 avec le marqueur de déduplication autorise
la suppression du fichier livré. Les CDR invalides sont isolés dans
`quarantine`, jamais considérés comme encaissés. Les autres erreurs
de fichiers restent à contrôler. Les journaux n'affichent que les compteurs.

Prérequis de mise en service : hôte Linux privé, Node.js compatible avec
AbortSignal.timeout, compte dédié pgi-voice, réseau machine HTTPS autorisé
et certificat valide. Le proxy public doit continuer à refuser les routes
machine et d'ingestion. Ne jamais contourner cette protection. Les répertoires
`/var/lib/pgi-voice/cdr` et `pending` doivent appartenir au compte de service
et être de mode 0700. Les fichiers terminés doivent être déposés atomiquement
par un producteur FreeSWITCH autorisé, mode 0600, avec le nom UUID.json et
`variables.uuid` identique. Ce producteur et le trunk ne sont pas déployés ici.
Le nom réel du carrier doit être capturé au début de l'appel dans
`pgi_host_carrier`, jamais inféré après une bascule. Propager également
`pgi_call_destination_id` et, si réellement mesuré, `pgi_dtmf_errors`.
Les identifiants sont vérifiés dans le backend et les contrôles d'isolation
multi-tenant existants restent en place.

Le service et le timer systemd fournis en exemples sont inactifs tant
qu'ils ne sont pas installés et autorisés. Le fichier d'environnement est
à créer en privé, avec les accès réellement attribués, jamais dans Git.
Le verrou du spool prévient les drains concurrents ; en cas d'arrêt forcé,
contrôler l'absence de processus actif avant de retirer un verrou résiduel.
Surveiller l'espace disque, la file et les quarantaines, et définir la
rétention RGPD avant exploitation.

### Annonces SVI locales

`telephony/local-announcements.mjs` prépare un paquet WAV et un manifeste
à partir d'un parcours Voice Studio validé, en utilisant le programme
local eSpeak NG. Aucun texte n'est envoyé à un service de synthèse distant.
Les textes identiques sont dédupliqués dans le paquet. Les WAV sont contrôlés,
les empreintes calculées, le paquet isolé du dialplan actif.
Le moteur eSpeak NG constitue une option de base sans abonnement ;
la qualité vocale doit être acceptée, et les annonces réglementaires,
notamment MGIT, doivent être validées avant tout usage réel.
L'outil ne remplace pas un serveur média/SVI FreeSWITCH opérationnel,
ne génère pas d'enregistrement d'appel et n'active aucun numéro.

Une fois le moteur installé sur un hôte privé autorisé, exécuter :
`node telephony/local-announcements.mjs /chemin/prive/parcours.json /chemin/prive/annonces`
(répertoire de sortie existant en 0700). Ne jamais mettre les textes ou
fichiers clients dans le dépôt public.

### Portabilité opérateur

Les connecteurs entrants et sortants existants refusent les redirections
HTTP et vérifient le protocole de l'URL effectivement utilisée, y compris
les consultations de statut et annulations. La configuration des URL,
identifiants, conventions APNF et certificats reste dépendante des
spécifications du partenaire réel. Aucune portabilité fictive ni activation
automatique sur un réseau non contractualisé.

Ces préparatifs n'exigent aucune migration Neon, ne changent pas Vercel,
Stripe ni les autres services informatiques, et ne déclenchent aucune dépense.


## Préparation des raccordements indépendants

Le plan `telephony/voice-edge-plan.mjs` réutilise le validateur de profils
opérateurs du backend. Il produit les intentions ACL par adresse IPv4
exacte, les plages de ports RTP et une estimation de bande passante avec
réserve. Il n'écrit pas de pare-feu, ne génère pas une configuration
Kamailio/FreeSWITCH complète et n'ouvre aucun port. Les adresses, codecs,
transport, MGIT, capacité et secours doivent provenir des accords réels.
Ce modèle initial concerne des pairs SIP fixes ; il ne définit pas les
règles d'accès ICE/TURN publiques. Les capacités CPU, mémoire, transcodage,
chiffrement et qualité doivent être mesurées sur le futur hôte.

`telephony/turn-credentials.mjs` prépare les identifiants REST temporaires
compatibles Coturn (HMAC-SHA1 selon le protocole REST TURN, durée 60 à 600 s,
TLS TCP uniquement dans ce profil). Le secret maître reste côté serveur.
Aucune route client de distribution d'identifiants n'est activée.
Avant raccordement : serveur Coturn durci, quotas, restrictions des pairs,
certificats valides, autorisation par tenant et session, intégration SIP
WebRTC et vérification de la consommation de bande passante. Aucun
service TURN ni navigateur téléphonique opérationnel n'est livré ici.


### Publication durable et supervision CDR (serveur voix privé)

Le nouveau module `cdr-spool-publish.mjs` accepte sur stdin exclusivement
un CDR JSON terminé provenant d'un producteur autorisé. Il vérifie la taille,
l'UUID et le carrier d'origine, conserve les octets d'origine, écrit en mode
0600, synchronise le fichier puis publie atomiquement dans pending et
synchronise le répertoire. Il refuse les contenus différents ayant le même
UUID encore présent. Un accusé local signifie mise en file, pas encaissement
ni confirmation du backend.

Exécution sous le compte pgi-voice, avec PGI_CDR_SPOOL_DIR configuré :

    node telephony/cdr-spool-publish.mjs < /chemin/prive/cdr-termine.json
    node telephony/cdr-spool-health.mjs

FreeSWITCH mod_json_cdr écrit normalement des fichiers UUID.cdr.json ;
ne pas lire un fichier en cours d'écriture. Le producteur natif chargé
de signaler la fin d'écriture et de transmettre le fichier reste à intégrer
sur l'hôte réel. Ne pas supprimer la source sur simple accusé local ; définir
une politique de rétention et de rapprochement avec le backend. Les relectures
après livraison doivent s'appuyer sur la déduplication du backend.

Le contrôle santé est en lecture seule : capacité disque disponible, âge du
plus ancien CDR, quarantaines, fichiers anormaux et verrous anciens. Les
seuils par défaut (15 min de retard, 256 Mio libres, 25 min de verrou drain
et 60 s de verrou publication) sont des alertes indicatives, pas des SLA.
Aucun nettoyage automatique : vérifier l'absence de processus actif avant
de retirer un verrou résiduel, conserver les sources et contrôler les fichiers
de staging. Les journaux n'affichent que les agrégats. Les inspections
concurrentes constituent des instantanés non transactionnels.

Ces modules sont hors Vercel et hors Neon, n'ajoutent aucune dépendance npm,
ne démarrent aucun service ni tâche planifiée et n'exposent aucun port.
La recette sur un serveur voix autorisé et le raccordement réel restent requis.


## Réservation durable de capacité pour la future réception WebRTC

L'API historique next-destination augmente active_calls à chaque demande ;
l'API release par destination ne possède pas d'identifiant d'appel. Un retry
ou un double release peut donc dériver les compteurs. Elle reste inchangée
jusqu'à une bascule explicite et contrôlée.

Les composants préparés sont :
- backend/src/voice-reservation-lifecycle.mjs : transitions et clôture unique.
- backend/src/voice-reservation-store.mjs : transaction PostgreSQL, idempotence
  par UUID, verrou de destination, limite de capacité, contrôle du tenant,
  du numéro et des conditions d'accès/reversement existantes.
- telephony/sql/voice-reservations.prepare.sql : schéma proposé hors registre
  des migrations. Non exécuté, non déployé dans Neon.
- tests/voice-reservation-lifecycle.test.mjs : couverture logique des doublons,
  événements tardifs, perte de connexion, reprise et preuve terminale.

Aucun nouvel endpoint public, aucune réservation live et aucune modification
du compteur historique active_calls. La nouvelle capacité est calculée à
partir des réservations ouvertes ; ne jamais utiliser les deux moteurs pour
une même destination. La sélection des destinations, leurs contrôles de
priorité, la disponibilité des registrations SIP/WebRTC et le routage tenant
doivent rester côté serveur, indépendamment des paramètres navigateur.
L'identité du nœud doit être authentifiée par un canal machine privé et liée
à la réservation. Chaque appel racine doit disposer de son UUID stable,
d'une génération serveur et d'une séquence d'événements durable et monotone.
Ne jamais utiliser une fin de branche SIP comme preuve de fin de l'appel racine.

Un onglet fermé, une session navigateur expirée, un délai ou un serveur
injoignable ne libère jamais de capacité : demander une observation
autoritative de FreeSWITCH. Si le serveur média ne peut plus prouver l'état,
la réservation reste occupée et nécessite une réconciliation. Pour la
continuité : prévoir une destination de secours explicitement configurée ;
ne jamais reconnecter ou transférer à l'aveugle un appel possiblement actif.
La clôture de la réservation ne crée ni CDR ni règlement ; le pipeline CDR
durable reste la source de l'événement de facturation.

Avant activation : migration révisée et sauvegarde, rôle SQL privé minimal,
API machine avec authentification individuelle, production/rejeu durable
des événements média, intégration SIP over WSS, TURN et permissions par
tenant/session, stratégie de reconnexion et d'appel de secours, recette
des pannes et des appels facturables, bascule des destinations après
drainage des appels existants et réconciliation du compteur historique.
Aucun serveur voix, trunk ni ligne WebRTC n'est activé par ce code.

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


## Chaîne native CDR et raccordement : paquet d'intégration

Le fichier `telephony/config/json_cdr.conf.xml.example` est une configuration
native de mod_json_cdr conforme à la documentation FreeSWITCH :
https://developer.signalwire.com/freeswitch/module-reference/event-handlers/mod_json_cdr/
Il journalise sur disque les A-legs, en JSON non encodé, sans POST direct.
Avant toute mise en service, installer les versions maintenues des logiciels
depuis leurs sources officielles, vérifier la disponibilité et la licence du
module, configurer un compte de service dédié, UMask=0077 et des répertoires
privés 0700 sous /var/lib/pgi-voice. Le producteur FreeSWITCH et le processus
de staging doivent partager le même UID dédié. Ne jamais utiliser un
répertoire partagé avec des clients ou des logiciels non approuvés.

Le nouveau `cdr-native-stage.mjs` attend un fichier a_UUID.cdr.json stable,
vérifie l'identifiant et la présence du carrier réel, réduit les variables
aux seules données utilisées par PGI et conserve les mesures compatibles
avec le normaliseur. Il publie une copie en mode 0600 de manière atomique
sans écraser un événement déjà présent. Le fichier natif n'est retiré
qu'après synchronisation de la copie. Une collision de contenu reste à
examiner et ne remplace jamais le premier CDR. Les fichiers inconnus,
récents, incomplets ou non conformes ne sont pas effacés.

Le service exemple existant utilise désormais `cdr-pipeline.mjs` qui
enchaîne staging puis livraison, y compris si certains fichiers natifs
nécessitent un examen. Le verrou flock autour du service prévient les
exécutions concurrentes de la chaîne. Ne pas lancer les modules séparément
en parallèle de ce service. Après arrêt forcé, vérifier le verrou interne
résiduel et les fichiers temporaires .stage-* avant reprise. Prévoir
surveillance d'espace disque, de l'ancienneté des files et politique de
rétention ; aucune purge automatique de données en anomalie. La capacité
de reprise réelle doit être vérifiée sur le futur hôte.

`voice-host-bundle.mjs` génère un paquet de configuration avec empreintes
SHA-256 : fragment ACL FreeSWITCH, fragment de paramètres Sofia, règles
nftables pour les ports SIP/RTP spécifiés, estimation de capacité et
manifeste. Le paquet n'est jamais appliqué. Il concerne les pairs IPv4
fixes en SIP/TLS ; ce n'est ni un pare-feu complet, ni un profil Sofia
complet, ni un SBC ou un téléphone WebRTC opérationnel. Vérifier les
certificats, NAT, adresses, authentification, codecs, MGIT, compatibilité
opérateur et règles de pare-feu déjà présentes. Exécuter nft -c -f sur
le fichier généré uniquement dans un environnement autorisé avant
toute intégration. Le pare-feu de l'hôte doit conserver ses règles
d'administration et de refus par défaut ; le paquet ne les remplace pas.
Ne pas exposer l'Event Socket ni ouvrir des ports de registration SIP.

`carrier-sftp-collection.mjs` récupère directement un relevé CSV précis
via le client OpenSSH SFTP, avec clé hôte vérifiée et fichier known_hosts
privé. Il exige un compte en lecture seule, l'empreinte authentifiée,
une zone de téléchargement privée à quota de disque borné et un contrat
confirmé. Il n'effectue ni listing distant, ni suppression, ni écriture
chez l'opérateur. Délai d'exécution borné et validation des fichiers
au format UTF-8, 180 000 octets maximum après téléchargement.
Il utilise notre normaliseur CSV et enregistre uniquement le paquet
canonique avec empreintes, hors de Git. La récupération ne déclenche
aucun rapprochement comptable automatique, règlement ou paiement.
Les paramètres doivent venir du fournisseur réel ; un export trop grand
doit être découpé par lui. Aucun accès SFTP réel n'est configuré ici.

Le point restant avant le téléphone WebRTC actif : réservation de
destination liée à un identifiant unique d'appel et libération
idempotente. Les anciennes API de sélection incrémentent le compteur
et une relance après timeout pourrait créer une réservation fantôme.
Ne pas brancher un dialplan avec relances automatiques sur ces API
sans résoudre cette contrainte. Il faut ensuite intégrer les accès SIP
par tenant, les certificats, le média et les preuves de qualité.
Aucun serveur voix, tâche, numéro, règle réseau ni contrat n'est
activé par ces fichiers. Aucun changement de schéma Neon n'est requis.

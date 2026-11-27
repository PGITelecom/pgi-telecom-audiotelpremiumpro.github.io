# Mise en production voix indépendante — Audiotel Premium Pro

## État et frontière

Le site et le cockpit Vercel restent en service. Les routes machine WebRTC
sont uniquement préparées dans le dépôt et ne sont pas publiées sur Vercel.
Ne jamais ouvrir de port SIP/RTP/WSS ou déployer le serveur média dans le
runtime HTTP Vercel. PostgreSQL reste la source métier centrale ; FreeSWITCH
reste l'autorité sur les événements média. Le schéma proposé n'est pas
une migration automatique. Aucune activation réseau par défaut.

## Séquence de mise en service

1. Confirmer l'hôte Linux privé, le contrat opérateur, le profil SIP validé,
   les ressources de numérotation, les tarifs et les obligations SVA/MGIT.
   Obtenir les adresses exactes, certificats, codecs, plages RTP, règles DTMF,
   limites et plan de secours du partenaire. Ne pas inventer ces valeurs.
2. Examiner la migration telephony/sql/voice-reservations.prepare.sql
   sur une branche isolée PostgreSQL 17, avec le registre des migrations
   existant et sauvegarde vérifiée. Valider les clés étrangères, les deux
   triggers d'isolation, les rôles, la concurrence et le retour arrière.
   Appliquer en production uniquement par le processus de release approuvé.
   Le singleton voice_gateway_control reste disabled. Ne pas toucher aux
   anciens compteurs, aux écritures comptables ni aux appels en cours.
3. Créer un rôle dédié, non propriétaire et sans BYPASSRLS. Lui accorder
   seulement les droits nécessaires aux lectures métier, verrous, insertion
   des réservations et nonces, mise à jour des états. Les modifications du
   mode et des affectations de destinations restent au rôle de déploiement.
   Vérifier les droits de verrouillage PostgreSQL (FOR SHARE/FOR UPDATE)
   et les restrictions de colonnes ; ne pas lui attribuer l'accès global
   à la base, aux identifiants clients ni aux flux de paiement.
4. Sur l'hôte privé : installer une version maintenue de Node 22, FreeSWITCH,
   Kamailio et Coturn selon le profil contractuel, avec pare-feu, ACL et
   certificats. Valider les licences et coûts réels. Pas de service payant
   obligatoire supplémentaire. Ne pas configurer un relais TURN ouvert.
5. Le service exemple infra/systemd/pgi-voice-gateway.service.example
   ne doit pas être activé avant installation des prérequis. Le fichier
   gateway.json appartient au compte pgi-voice-gateway, mode 0600,
   répertoire privé. Il contient enabled, bind_ipv4 privé, port,
   cert_file, key_file, ca_file et nodes. Chaque entrée nodes contient
   node_id, certificate_sha256, key_id, secret (32 octets aléatoires
   en base64url), enabled, valid_from et valid_until (epoch secondes).
   Ne jamais sauvegarder les valeurs dans GitHub. Les certificats et clés
   référencés sont des fichiers absolus, privés, sans lien symbolique.
   Le fichier database.env contient PGI_VOICE_DATABASE_URL avec rôle dédié,
   sans options d'URL ; le programme exige TLS et vérifie le certificat.
6. Lancer sous le compte de service :
   node telephony/voice-gateway-preflight.mjs
   La vérification est en lecture seule et ne peut pas autoriser la mise
   en production. Vérifier également l'acceptation réelle du certificat
   client, la chaîne TLS, le pare-feu, les limites et la reprise.
7. Configurer des destinations SIP exclusivement dédiées au WebRTC,
   initialement status=testing, active_calls=0, capacité explicite.
   Affecter chaque destination au nœud média approuvé dans
   voice_gateway_destinations. Les triggers refusent leur activation dans
   le moteur historique. Les destinations anciennes ne sont pas converties.
   Un statut testing dans ce contexte signifie hors du sélecteur historique,
   et non disponibilité réseau. Ne pas modifier le routage existant.
8. Le serveur voix utilise telephony/voice-gateway-client.mjs pour appeler
   le gateway privé. La réservation transmet UUID de l'appel racine et
   numéro SVA réellement appelé. Le gateway résout tenant, numéro et
   destination à partir de la base, contrôle l'accès et les conditions
   de reversement, puis sérialise la capacité. Aucun ID client fourni par
   un navigateur ne fait autorité. Une réponse duplicate=true ne doit
   jamais déclencher une nouvelle branche SIP sans vérification de
   l'état réel du même appel. Les observations portent UUID, génération,
   séquence monotone durable et état média. Seule la fin vérifiée de
   l'appel racine libère la capacité.
9. Préparer l'émission durable des observations à partir de FreeSWITCH
   et le rejeu CDR en cas de panne. Un timeout de l'API est ambigu :
   conserver le même UUID/génération/séquence métier et signer chaque
   retry avec un nouveau nonce. Ne jamais inventer un hangup.
10. Épingler une version SIP.js et son intégrité, embarquer localement
    la bibliothèque, créer le service d'émission des droits SIP/TURN
    temporaires après authentification client et affectation réelle.
    Autoriser seulement WSS et TURN approuvés ; assurer révocation,
    renouvellement des droits, et attribution des endpoints côté réseau.
    Le navigateur ne constitue jamais une preuve de facturation.
11. Contrôler en environnement isolé : appel entrant réel, audio bidirectionnel,
    DTMF, numéro/tenant exact, concurrence, saturation, coupure navigateur,
    coupure SIP, perte d'accusé, double événement, reprise du nœud,
    débordement vers destination autorisée, CDR unique et rapprochement
    financier de bout en bout. Mesurer la capacité et la marge réelle.
12. Autorisation réseau et commerciale uniquement après preuve de recette,
    validation de conformité et décision de mise en service. Commencer
    avec une destination dédiée et un périmètre explicitement approuvé,
    jamais avec toutes les lignes. Le mode enabled est une décision
    opérationnelle distincte. Prévoir le repli historique/PSTN si le poste
    n'est pas disponible, sans contourner les règles tarifaires.

## Maintenance et repli

Passer en draining pour bloquer les nouvelles réservations ; les opérations
de clôture et retries idempotents des appels existants restent possibles.
La transaction de réservation relit le mode sous verrou. Attendre la
confirmation média et les CDR, rapprocher les réservations encore ouvertes
et vérifier les files. Ne jamais remettre le compteur à zéro ni expirer
une réservation active simplement sur un délai. Revenir à disabled
seulement une fois le périmètre drainé ; rétablir les destinations historiques
explicitement prévues. Laisser disponibles les opérations d'observation
des appels déjà enregistrés. La remise en service ne doit pas être automatique
sur la seule base d'un redémarrage du serveur.

Conserver les nonces tant que leur fenêtre de validité plus marge de sécurité
n'est pas expirée. Prévoir une purge bornée sous rôle de maintenance, la
rotation des clés et certificats, et une politique de conservation CDR/RGPD.
Aucune clé, URL de base avec identifiants, donnée client ni contenu audio
dans le dépôt ou les journaux. Les vérifications locales ne remplacent pas
les preuves opérateur et réseau.

## Références officielles

- SIP.js : https://sipjs.com/guides/simple-user/
- Coturn : https://github.com/coturn/coturn/blob/master/examples/etc/turnserver.conf
- FreeSWITCH : https://developer.signalwire.com/freeswitch/
- PostgreSQL : https://www.postgresql.org/docs/17/explicit-locking.html

## Validation logicielle

Le script npm run verify:voice est intégré au contrôle verify:vercel.
Il vérifie les composants et les cas unitaires, sans SIP réel ni migration
Neon. Un build réussi ne certifie pas l'infrastructure voix. La préparation
de production ne crée aucun serveur, trunk, abonnement ni paiement.

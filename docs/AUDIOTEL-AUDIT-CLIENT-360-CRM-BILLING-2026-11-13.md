# Audiotel Premium Pro : audit du parcours client, cockpit 360, HubSpot et Stripe
Date : 13 novembre 2026. PR 190, branche \`prep/chaine-telecom-operateur-20261108\`.

## Perimetre et qualification des preuves

- **Observe dans le code GitHub** : fichiers, controles, routes admin, schema et tests.
- **Observe dans HubSpot en lecture seule** : portail 149417663 correspondant a
  \`HUBSPOT_PORTAL_ID\` de \`backend/src/hubspot-crm.mjs\`. Proprietes
  \`pgi_dossier_ref\`, \`statut_commercial_pgi\`, \`type_de_demande\` et les
  champs \`pgi_paiement_cb_*\` presents sur les types utiles. Onboarding du
  portail signale incomplet : ce constat ne prouve ni une panne ni le bon
  fonctionnement d'une synchronisation.
- **Non atteste** : execution reelle du parcours sur le site public,
  reconciliation HubSpot/Neon sur un vrai client, connexion de collecte SVA,
  portage effectif, verification en direct du solde de factures Stripe, recette
  bancaire des fonds de l'operateur et marge personnelle apres impot.
- Aucune modification de base Neon de production, aucune fusion, aucun
  deploiement Vercel et aucun flux operateur/PSP reel dans ce lot.

## Cartographie : ce qui existait deja

| Fonction | Point de controle | Constat |
| --- | --- | --- |
| Recherche, nouvelles inscriptions, impayes | \`assets/customer-admin.js\` | Present ; formulaire et filtres existants conserves |
| Ouverture du dossier individuel | \`assets/tenant-control-detail.js\` | Present et rattache au client selectionne |
| Identite et origine commerciale | \`assets/customer-360-detail.js\` | Present, export CSV existant |
| Portabilite | \`assets/client-portability.js\`, \`backend/src/portability-automation.mjs\` | Workflow et prerequis prepares ; pas de preuve de portage reel |
| Dossier SVA preclient | \`backend/src/audiotel-opening-lead-bridge.mjs\` | Pont d'ouverture explicitement reserve au simulateur/CI |
| Abonnements | \`backend/src/stripe-billing.mjs\`, \`tenant_subscriptions\` | Webhooks et statuts d'abonnement prepares |
| Marge SVA | \`backend/src/store-postgres.mjs::customerProfitability\` | Marge commerciale SVA, **pas** benefice net complet |
| Reversements | \`tenant_revenue_distributions\`, \`assets/customer-360-detail.js\` | Etats individuels, dates de paiement seulement avec preuve |
| HubSpot | \`backend/src/hubspot-crm.mjs\`, \`backend/server.mjs\` | Soumissions formulaire, contacts, deals, tickets ; livraison E2E non prouvee |
| Services apres vente | \`assets/customer-relations.js\`, \`tenant_service_incidents\` | Briques reutilisees ; pas de duplication |

## Corrections integrees dans la PR 190 (code, pas production)

1. **Conservation des preuves de facture** :
   \`backend/src/stripe-billing.mjs\` normalise montants paye, du et restant,
   devise, etat de facture. \`backend/src/store-postgres.mjs\` les conserve
   dans le journal existant. Montant absent = valeur **NULL**, jamais zero.
   Rejeux de vieux evenements compatibles avec leur ancienne empreinte.
2. **Fiche facture rattachee au bon client** :
   \`backend/src/customer-invoice-audit.mjs\` consolide en lecture seule les
   evenements \`invoice.*\` de \`subscription_billing_events\`, filtre strict
   \`tenant_id\` et \`provider='stripe'\`, deduplique par reference de facture,
   refuse les URLs de documents externes a Stripe et conserve les devises
   separees. L'API existante
   \`/api/v1/platform/tenants/:id/control-center\` utilise deja les controles
   admin/finance/readonly du serveur. Aucun nouvel endpoint de paiement.
3. **Affichage et export** : \`assets/customer-invoice-detail.js\` ajoute
   dans le dialogue client actuel une section Factures et paiements Stripe :
   historique, etat, montants documentes, paiement confirme, dernier restant
   du signale, derniere notification et liens Stripe valides. Les lignes
   facture sont integrees a l'export CSV existant. Aucun CSS, page ou
   parcours public change ; l'asset nouveau figure dans les manifestes
   de build et dans les limites de taille.
4. **Portabilite fail-closed** : contrat collecteur maintenant toujours exige
   pour le travail automatise, y compris annulation. Un drapeau facultatif
   ne doit plus permettre de sauter ce prerequis.
5. **Aucune promesse de transit d'argent** :
   le cockpit ne presuppose plus un parcours de fonds
   "operateur -> Audiotel -> professionnel" sans contrat.

Tests : \`tests/customer-invoice-audit.test.mjs\`,
\`tests/portability-automation.test.mjs\` et suite existante.
L'execution complete Quality & Security est la preuve a lire sur le dernier
commit ; une execution anterieure ne valide pas le dernier.

## Limites financieres majeures encore ouvertes

- **Montant impaye actuel** : une notification Stripe indiquant 4,90 EUR
  de restant a payer prouve seulement le montant au moment de l'evenement.
  Une synchronisation de lecture de l'API Stripe sous la bonne permission et
  une reconciliation des factures/avoirs/remboursements restent necessaires
  pour afficher "solde actuellement exigible" en temps reel.
- **Historique ancien** : la journalisation precedente n'enregistrait pas
  les nouveaux champs de montant. Les evenements anterieurs restent
  consultables avec montant **non renseigne**, sans extrapolation.
  Aucune mutation des anciennes factures n'a ete effectuee.
- **Prestations hors factures Stripe** : portabilite prioritaire, paiements
  CB Connect, remboursements et frais PSP ont leurs propres journaux.
  Ne jamais fusionner volumes clients et revenus propres d'Audiotel.
- **Benefice net par professionnel** : la vue actuelle SVA exclut abonnements,
  frais Stripe, overhead, charges d'exploitation et impots. Ne pas additionner
  TTC des abonnements et HT des commissions. Un calcul net complet exige
  une veritable comptabilite analytique, des factures operateur, des couts
  d'hebergement et de maintenance ainsi que le traitement fiscal de l'entite.
- **Reversements SVA** : pas de flux authentifie de l'operateur, ni de
  confirmation de paiements a des professionnels. Aucune entree du
  journal preparatoire ne prouve une transaction bancaire.

## HubSpot : controle du branchement

Le portail HubSpot retrouve correspond au numero dans le code, et les
principales proprietes personnalisees existent. La synchro commerciale
est aujourd'hui executee en "best effort" : les erreurs sont journalisees,
mais leur recuperation automatique et reconciliation avec Neon ne sont
pas prouvees. Le controle doit prioritairement exiger :
- une cle durable dossier/tenant/HubSpot, l'unicite du contact et du deal
  par **dossier** ainsi qu'une attribution d'entreprise coherente ;
- le traitement des erreurs 429, 5xx et de la concurrence sans creer
  de nouveaux deals a chaque retry ;
- une file de reconciliation **consent-aware** pour les fiches qui n'ont
  pas ete synchronisees, sans reimporter tout le CRM ni ecraser les notes
  manuelles ;
- le lien visible, reserve au personnel autorise, vers contact/deal/ticket ;
- une preuve de bout en bout sur des dossiers autorises avant toute
  affirmation de synchronisation garantie.
Aucune ecriture de contact HubSpot n'a ete ordonnee pendant cet audit.

## Comparaison fonctionnelle avec les offres publiques

- **Remmedia** : collecte et portabilite SVA, gestion de numeros, routage,
  alertes et services selfcare documentes.
  https://www.remmedia.fr/qui-sommes-nous/
  https://www.remmedia.fr/vos_numeros_appels/
- **Aircall** : synchronisation CRM, contacts, journaux d'appels,
  tickets et automatisations HubSpot documentes.
  https://support.aircall.io/en-gb/articles/10375355065117
- **Ringover** : tableaux d'appels, filtres, statistiques et
  synchronisation d'activites CRM documentes.
  https://support.ringover.com/hc/fr/articles/14345815639697-Comment-filtrer-et-v%C3%A9rifier-les-statistiques-d-appels
  https://support.ringover.com/hc/fr/articles/14163560276753-Comment-int%C3%A9grer-Ringover-%C3%A0-HubSpot-CRM

**Comparabilite limitee** : Aircall et Ringover sont des solutions de
telephonie CRM, pas des preuves de fonctionnalites identiques a un
operateur de collecte SVA. Ne pas copier une offre payante de transcription
ou d'enregistrement sans ROI mesurable et sans base juridique.

Differenciation economique recherchee : fiche unifiee avec portabilite,
contrat, CDR, facture prouvee, solde exigible verifie, reversement prouve,
marge par minute et cout total du client, sans doublon CRM ni module couteux
inutilise. Aucune superiorite generale n'est revendiquee aujourd'hui.

## Restant a faire avant une exploitation effective

1. Obtenir contrats, API et habilitations operateur et prouver les portabilites
   de bout en bout, avec confirmations de titularite, frais et acheminement.
2. Finaliser la reconciliation en lecture seule des **factures Stripe
   existantes** et de leur solde actuel, sans encaisser ni relancer de facon
   non autorisee.
3. Prouver et fiabiliser le rapprochement Neon / HubSpot sur le dossier
   permanent avec une reprise automatique non destructive.
4. Mettre en place, une fois les donnees reelles disponibles, la marge nette
   analytique par client : recettes et commissions autorisees, couts fixes
   et variables, provision d'impayes, frais, retours et fiscalite.
5. Valider l'isolement multiclient et la qualite des CDR/opportunites sur des
   environnements CI ephemeres, sans recopier les donnees sensibles en public.
6. Ne declencher des notifications relances, portages, encaissements,
   reversements ni attributions sans autorisation et prerequis contractuels.

**Verdict** : des lacunes de traçabilite ont ete corrigees dans la branche.
Le parcours portabilite operateur et le revenu personnel net par client
ne sont pas certifiables aujourd'hui. La production demeure hors perimetre.


## Complement : consultation Stripe et integrity CRM (13/11/2026)

### Liaison HubSpot par dossier permanent

Le correctif de \`backend/src/hubspot-crm.mjs\` empeche de selectionner
une opportunite simplement parce qu'elle est ouverte et associee au
meme contact e-mail. Lorsque \`pgi_dossier_ref\` est fourni :
- rechercher uniquement l'opportunite ouverte du **meme dossier** ;
- ne pas modifier une opportunite d'un dossier different ;
- si le contact represente deja un autre dossier, **ne pas ecraser**
  sa reference, sa societe commerciale, son intention, sa phase de cycle
  de vie ni son statut commercial ;
- pour une nouvelle demande du meme contact mais d'un autre dossier,
  creer une opportunite distincte avec son propre stade.

Tests : \`tests/hubspot-dossier-integrity.test.mjs\`, en plus des
tests HubSpot existants. **Les appels HubSpot sont doubles par le test**,
il n'y a eu aucune ecriture de fiches HubSpot reelles.

**Limite connue** : si plusieurs requetes concurrentes peuvent creer un
meme deal, le systeme HubSpot n'offre ici aucune preuve d'unicite atomique.
Une reprise durable avec controle de concurrence et rapprochement effectif
reste necessaire avant d'affirmer "aucun doublon possible".

### Recouvrement client

La fiche client reutilise des informations de recouvrement deja
stockees dans \`tenant_subscriptions\` : etape de recouvrement, tentatives,
prochaine date de paiement et date butoir. Il ne s'agit ni d'un
prelevement ni d'une relance lancee par l'audit.

### Consultation des factures actuelles sur demande uniquement

Nouveau composant \`backend/src/stripe-invoice-readonly.mjs\`,
route \`GET /api/v1/platform/tenants/:id/stripe-invoices\` reservee aux
roles admin et finance, ainsi que bouton dans la **fiche client existante**.

Principe :
1. La demande provient d'un administrateur connecte ayant clique sur
   « Consulter Stripe en direct ». Il n'y a aucun polling automatique.
2. \`tenantStripeBillingBinding\` retrouve **dans Neon et sans accepter
   d'identifiant client fourni par le navigateur** le compte Stripe et
   les abonnements du dossier.
3. S'il existe plusieurs comptes Stripe incompatibles, une reference
   mal formee ou plus de 50 souscriptions, le systeme refuse la lecture
   plutot que de risquer de divulguer des factures d'un tiers.
4. Effectuer uniquement une operation **GET** de lecture a
   \`https://api.stripe.com/v1/invoices\` avec une page de 25 elements au
   maximum et pagination explicite sur clic.
5. Afficher uniquement les factures dont le numero de client Stripe
   **et** la reference d'abonnement figurent dans les associations
   autorisees du dossier. Trier les montants par devise.
6. Exposer l'etat actuel de facture, les montants Stripe paye, du et
   restant, date d'echeance et liens de facture de domaines Stripe,
   sans renvoyer de secret, e-mail ou detail bancaire.
7. **Aucune promesse de solde global exhaustif** : une page peut
   exclure d'autres factures et ne tient pas compte des litiges,
   remboursements, transferts, charges ou TVA non etablis.

Mode de fonctionnement : necessite un environnement Stripe configure.
Pas d'appel API Stripe dans la PR tant que cette fonctionnalite n'est pas
deployee et **ouverte manuellement** par un utilisateur autorise.

Les routes ne prennent aucune action de facturation ; aucun
paiement, abonnement, encaissement, mandat, portage ni reversement
n'est declenche. Les nouveaux codes sont soumis aux tests
\`tests/stripe-invoice-readonly.test.mjs\`.

### Protection du budget

Le chargement ne declenche pas d'interrogation de Stripe par defaut.
Il utilise les identifiants de souscription deja existants et n'ajoute
aucun fournisseur ni service heberge. Les appels ne sont effectues
qu'a la demande, lorsque la partie concernée sera autorisee et
mise en production a une date ulterieure avec approbation explicite.

Le **benefice net par client apres frais, charges et fiscalite** ne peut
toujours pas etre presente comme reel : ces donnees ne sont pas
reconciliees dans un ledger analytique avec couts des operateurs.
Aucune optimisation fiscale ou compensation sur fonds des professionnels
n'est executee.

### Etat et restrictions

Les changements de cette section sont uniquement dans la branche
\`prep/chaine-telecom-operateur-20261108\` de la PR 190.
Aucun design public ou feuille CSS changee, aucune migration Neon,
aucun deploiement Vercel, aucune fusion, aucun achat ni numero active.

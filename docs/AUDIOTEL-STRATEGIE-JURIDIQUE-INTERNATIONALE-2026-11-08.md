# Audiotel Premium Pro : trajectoire juridique, veille mensuelle et international
Date : 08/11/2026. **PRÉPARATION HORS PRODUCTION**.
Ne pas modifier les sites, fusionner GitHub, déployer Vercel, modifier Neon, souscrire un service, ouvrir un marché, déclarer une entreprise, transférer un contrat ou un numéro, envoyer un email ou autoriser un paiement.

## 1. Inventaire des briques réutilisées

Le schéma `operating_markets` et `tenant_market_profiles` existe depuis la migration 004. Ne pas créer un deuxième référentiel international ni forcer un nouveau `country_code` dans la table de production. La France est le seul espace prévu pour le lancement. Les modules `audiotel-financial-cycle-prelaunch.mjs`, `audiotel-finance-prelaunch-read.mjs`, `audiotel-onboarding-casework.mjs` et la portabilité `tenant_portability_requests` ont été préparés dans la PR #190. Le périmètre technique `direct_sva` reste distinct de l'activité commerciale `audiotel_platform`.

## 2. Différencier les notions juridiques

**Micro-entreprise** : régime fiscal et social simplifié, pas une société juridiquement distincte. En principe il s'applique à une entreprise individuelle éligible (certaines EURL à l'IR et gérant associé unique peuvent sous conditions relever du micro) ; il ne faut pas affirmer qu'une activité de fournisseur direct de télécommunications serait éligible sans examiner sa qualification fiscale, ses obligations d'opérateur et de paiement. Un passage vers EURL à l'IS ou SASU n'est pas une conversion silencieuse de paramètres : nouvelle personne morale possible, contrats et droits à traiter.

**Deux hypothèses de base taxable/CA** :
- Commission / mandataire réel : on étudie la rémunération propre contractuellement acquise, sous réserve du rôle effectif, des factures, du pouvoir d'engager les parties, de la séparation des créances et des services de paiement.
- Exploitant principal : le chiffre d'affaires peut porter sur une assiette beaucoup plus large que la commission nette. Les frais et reversements peuvent être des charges, non automatiquement des déductions du chiffre d'affaires.
- L'existence de reversements directs opérateur n'est **ni** un avis fiscal **ni** une exemption ACPR.
- Les clients professionnels doivent connaître les parties contractuelles réelles, même si Audiotel reste leur point de contact commercial privilégié.

## 3. Paramètres réglementaires FR constatés au 8 novembre 2026

| Paramètre, prestations de services | Montant / taux | Portée |
|---|---:|---|
| Régime micro BIC/BNC 2026 à 2028 | 83 600 EUR HT | Seuil de CA, à comparer selon la règle N-1/N-2, création, activités mixtes et année entière |
| Franchise TVA services, seuil de base 2026 | 37 500 EUR | Au-delà en N, perte de franchise possible en N+1 selon les règles |
| Franchise TVA services, seuil majoré 2026 | 41 250 EUR | Dépassement en cours d'année pouvant entraîner l'assujettissement immédiat |
| Micro-social prestations de services BIC 2026 | 21,2 % | Hypothèse seulement si classification BIC |
| Micro-social libéral non réglementé BNC 2026 | 25,6 % | Hypothèse seulement si classification BNC |
| CFP supplémentaire indicatif BIC commerçant / BNC non réglementé | 0,1 % / 0,2 % | Classification précise et situation à faire vérifier |

Ne pas combiner les montants avant d'établir les recettes juridiquement propres à l'entreprise. Le régime de TVA ne se confond pas avec le régime micro. Projections à l'année non opposables. Ne pas appliquer un coefficient de prorata automatisé sans la date réelle de création et les règles du régime concerné. Les seuils, taux et barèmes changent et doivent être revalidés à chaque nouvelle année de référence.

Sources :
- https://www.impots.gouv.fr/professionnel/questions/pour-rester-micro-entrepreneur-quel-montant-de-chiffre-daffaires-ou-de
- https://www.impots.gouv.fr/professionnel/questions/en-tant-que-micro-entrepreneur-puis-je-etre-redevable-de-la-tva
- https://entreprendre.service-public.gouv.fr/vosdroits/F36232
- https://bpifrance-creation.fr/boiteaoutils/travailleurs-independants-cotisations-a-verser-debut-dactivite-regime-normal
- https://entreprendre.service-public.gouv.fr/vosdroits/F37777

**EURL à l'IS / SASU** : coûts de création, comptabilité, fiscalité des bénéfices, rémunération de dirigeant, charges sociales, protection sociale, dividendes et IR du foyer doivent être comparés. Le gérant associé unique d'EURL à l'IS relève généralement des TNS avec des cotisations minimales, y compris sans rémunération ; le président de SASU rémunéré est assimilé salarié. Les dividendes EURL dépassant certains plafonds supportent des modalités sociales spécifiques. Il est interdit de coder un résultat « EURL toujours la plus rentable » sans vérifier les paramètres réels, la protection sociale et la stratégie de distribution.

## 4. Moteur mensuel préparé, pas encore programmé

`backend/src/audiotel-fr-legal-form-monitor.mjs` :
- Reçoit des rapports mensuels hypothétiques en **centimes EUR**, propres à `audiotel_platform`.
- Distingue `own_receipts`, `operator_sva_collections`, `publisher_payouts_by_partner` et coûts variables/fixes.
- Calcule deux scénarios de base de CA : `commission_hypothesis` et `principal_hypothesis`.
- Signale les risques de seuil TVA/micro, l'absence de données mensuelles et les obligations de prorata/création.
- Fournit une estimation 2026 de charges micro-sociales BIC ou BNC selon **classification hypothétique**, et un scénario de trésorerie avant IR.
- Accepte des simulations de trésorerie nette micro, EURL IS, SASU IS et EI réel si elles sont fournies avec références de calcul. Les trie comme **hypothèses non vérifiées**, sans dire qu'il faut changer.
- Ne calcule ni IR familial, ni IS, ni dividendes ni TVA réels en l'absence de barèmes, situation personnelle et confirmations comptables.
- Refuse les années autres que 2026 tant que leurs règles n'ont pas été vérifiées.
- Retourne toujours `statutory_turnover_minor=null`, `recommended_legal_change=null`, `legal_change_authorized=false`.

La future cadence **proposée** est le 5 de chaque mois à 9 h Europe/Paris, en analysant les opérations réconciliées du mois précédent. Ceci n'est **PAS une tâche planifiée créée ou activée**. `app_strategy_monthly_runner_config_drafts` contient `enabled=false`, `notification_enabled=false`, `legal_auto_change_enabled=false` et `external_api_enabled=false`, verrouillés par la base. La cadence sera installée dans le système existant uniquement sur nouvel ordre, à condition d'avoir accès à des écritures authentifiées, des budgets et des autorisations correspondantes.

L'analyse doit prévoir un avertissement très tôt : à 80 % d'un seuil **dans au moins une hypothèse**, lorsque le seuil TVA standard/majoré est atteint, lorsque les coûts fixes pourraient rendre le régime réel avantageux ou lorsque des données comptables manquent. Une alerte n'implique ni sortie immédiate du micro ni disparition de la franchise TVA.

## 5. Dossier de changement de structure prêt pour revue

`backend/src/audiotel-legal-transition-planner.mjs` :
- Propose une liste de 19 contrôles portant sur identité juridique, IR/IS/TVA, social, clients, contrats, mandats, Arcep, numéros SVA, opérateurs, SIP, comptabilité, Stripe, Revolut, RGPD, accès techniques et support.
- Chaque étape reste `evidence_required` et `can_execute_without_owner=false`.
- Pas de transfert automatique de numéro, de contrat, de domaine, d'espace client, de compte bancaire ou de compte de paiement.
- Il faudra examiner **la transmissibilité des droits d'utilisation Arcep et des conventions opérateur**, et éventuellement opérer les changements/portages sous la procédure réellement applicable. Ne pas supposer que conserver le nom de marque signifie conserver sans formalité les ressources téléphoniques.
- Établir un dossier de comparaison annuel avec les devis d'expert-comptable, de juriste, d'opérateur, les estimations de cotisations/IS, les coûts de création et de fonctionnement et le flux net personnel. Recommandation du système = **préavis de décision du dirigeant**, pas une action administrative.

## 6. Préparation internationale : cinq premiers marchés

| Marché | Référents officiels | Numéros principaux à étudier | Devise | Droits et portabilité |
|---|---|---|---|---|
| France | Arcep, AF2M | 081 / 082 / 089 | EUR | Attribution Arcep et portabilité spéciale sous conditions |
| Espagne | CNMC et administration télécom | 803 / 806 / 807 / 905 | EUR | Attribution/autorisation du titulaire local et portabilité de la catégorie à confirmer |
| Italie | AGCOM (plan), MIMIT (attribution) | 892 / 899 candidats | EUR | Vérifier la version actuelle du plan et la portabilité propre aux majorés |
| Royaume-Uni | Ofcom | 09, dont sous-catégories spécifiques | GBP | Enregistrement PRS Ofcom si applicable ; portabilité 09 à confirmer |
| États-Unis | FCC, FTC, États | 900 dans le plan NANP | USD | Règles pay-per-call fédérales/étatiques ; disponibilité commerciale et portabilité à confirmer |

Chaque marché doit disposer des champs : régulateur, registre, habilitation, type de numérotation, service admissible, plan tarifaire, information consommateur, droit au numéro, titulaire, portabilité, fournisseur de collecte, délais, CDR, prestataire PSP, rôle juridique, résidence de données, taxes locales et coût de mise en conformité. Les règles de transferts de données hors UE et la TVA sur services transfrontaliers requièrent une analyse pays par pays.

**Point critique** : aucun des cinq profils ne prouve qu'Audiotel pourrait directement obtenir un numéro dans ce pays. L'opérateur ou partenaire local peut être nécessaire. Pour les États-Unis, les services 900 ont un modèle juridique et un accès réseau particuliers ; ne pas extrapoler le modèle français 089. Le Royaume-Uni impose une inscription PRS pour les activités réglementées et un enregistrement du service avant certaines mises en activité, sous les règles Ofcom.

Sources :
- Arcep : https://www.arcep.fr/la-regulation/grands-dossiers-thematiques-transverses/la-numerotation.html
- CNMC : https://www.cnmc.es/ambitos-de-actuacion/telecomunicaciones/registros-sgda
- Gouvernement espagnol : https://www.dsca.gob.es/es/consumo/preguntas-frecuentes/que-numeros-empiezan-llamadas-tarificacion-adicional
- AGCOM : https://www.agcom.it/competenze/comunicazioni-elettroniche/reti/numerazione/piano-di-numerazione
- Ofcom : https://www.ofcom.org.uk/phones-and-broadband/mobile-phones/operating-a-premium-rate-service
- FCC / règles 900 : https://www.ecfr.gov/current/title-47/chapter-I/subchapter-B/part-64/subpart-O

## 7. Architecture logicielle internationale

`backend/src/audiotel-international-market-prelaunch.mjs` :
- Conserve l'ordre France, Espagne, Italie, Royaume-Uni, États-Unis.
- Reconnaît **à titre de présélection uniquement** les préfixes E.164 des cinq pays. Aucun numéro n'est enregistré comme disponible, attribué ou portable à partir du préfixe.
- `planAudiotelInternationalPortability` : dossier `draft` multi-pays, demande d'identité/mandat, revue nationale des droits et de la procédure, dossier opérateur et routage futur. Toujours `can_submit=false`, `ported=false`, `carrier_api_available=false`.
- `reviewAudiotelMarketContribution` : coûts d'interconnexion, collecte, PSP, réserve antifraude, FX, conformité et setup, comparaison **attribution directe candidate** vs **partenaire local candidat**, marge contributive locale par minute, jamais net fiscal ni euro si GBP ou USD sans vrai cours et politique de change.
- Un profil international n'est pas un droit de commercialiser ni de garder « l'indépendance » au détriment de contraintes d'agrément. Conserver la marque Audiotel et l'interface commerciale, et documenter le rôle exact de tout opérateur local.

## 8. Base de données complémentaire, non appliquée à Neon

`database/prelaunch-not-applied/093_audiotel_legal_international_prelaunch.sql` contient des tables de brouillons :
- `app_legal_monthly_monitor_drafts` : période, reçus Audiotel, collecte opérateur, reversements partenaires, coûts, référence d'origine, aucune assiette fiscale déclarée ;
- `app_legal_form_scenario_drafts` : hypothèses d'EURL, SASU, micro, EI réel ;
- `app_legal_entity_transition_drafts` : dossier de changement juridique, avec blocage des migrations réelles ;
- `app_international_market_entry_drafts` : recherches réglementaires, une par pays ; référence facultative à `operating_markets`, aucun insert dans les marchés en exploitation ;
- `app_international_portability_drafts` : demandes multi-pays, sans droit de portage ;
- `app_international_quote_drafts` : scénarios de marge locale et de frais ;
- `app_strategy_monthly_runner_config_drafts` : cadence prévue, **toujours désactivée** ;
- `app_strategy_audit_events` : historique en append-only.

Ces tables sont sécurisées par `business_unit='audiotel_platform'`, contrôles de type, contraintes interdisant la mise en production via un booléen et `REVOKE ALL FROM PUBLIC`. Elles ne sont **pas prêtes à recevoir des documents clients réels** tant qu'un rôle applicatif, l'isolation RLS, la politique de conservation et les connexions aux prestataires n'ont pas été revus.

## 9. Raccordement interne au cockpit existant

Une seule route API de prévisualisation est ajoutée dans le serveur existant : `GET /api/v1/platform/prelaunch/strategy`, accessible à l'administrateur **uniquement** lorsque `config.mode='simulator'` ET `options.prelaunchCaseworkPreview===true`, avec base temporaire 093. Elle donne les compteurs de dossiers, les seuils 2026 et les cinq marchés en recherche. Pas de nouveau menu, page ou CSS. Aucun droit de créer un numéro, de migrer une entreprise, d'envoyer un e-mail, ni d'activer une activité.

## 10. Séquence de mise en service future, indépendante de cette PR

1. Expert juridique et fiscal : qualification des recettes, BIC/BNC, éligibilité micro, TVA, mandats, hypothèses sociales EURL/SASU, données personnelles.
2. Opérateur français : numéros et collecte ; signature de conventions avant toute mise en service, et rôle des éditeurs.
3. Flux CDR, relevés, banque et PSP réellement authentifiés : seules ces preuves pourront nourrir une surveillance fiscale sincère.
4. Contrats et coût des prestataires : comparer la marge contributive par minute après tous frais. Préparer un seuil minimal commercial fondé sur coûts et risques.
5. Validation puis activation distincte des migrations SQL, de l'accès cockpit, de la surveillance mensuelle et des notifications.
6. Prioriser l'Espagne, Italie, UK, US par comparaison **résultat contributif documenté vs coûts fixes, obligations locales, accès aux numéros, protection des clients et risques**. Ne jamais activer automatiquement un pays.
7. Au moment de changer de forme juridique : préparer puis contrôler chaque consentement et chaque transfert ; signature et décision du dirigeant obligatoires.

**La PR #190 reste en brouillon non fusionnée. Aucune action n'exécute ces étapes.**

# Audiotel Premium Pro : architecture financière et raccordements internes
**État au 08/11/2026 : préparation uniquement, PR brouillon non fusionnée.**
Personne morale / régime fiscal encore à valider. Ne PAS déployer, ne PAS migrer Neon, ne PAS activer de numéros, de portabilité, de facturation, de transferts, de webhook bancaire ni d'e-mails. Aucune dépense ni aucun contrat.

## 1. Ce qui existe et doit rester intact

| Bloc déjà présent | Fichier / tables | Rôle réutilisé |
|---|---|---|
| Portabilité client et automatismes de suivi opérateur | `portability-automation.mjs`, `tenant_portability_requests`, `portability_operator_events` | Preuve de bascule et gestion des exceptions, seulement après raccordements autorisés |
| Formulaire et dossier d'ouverture | `/demande-ouverture/`, `ensureLeadTenant`, `audiotel-opening-lead-bridge.mjs` | Créer une demande et un tenant pending, pas un nouveau prestataire |
| Saisie du numéro et statuts staff/client | `audiotel-onboarding-casework.mjs`, SQL `091` | Lier un prospect au bon compte puis préparer contrat et opérateur |
| Calcul et classification comptable APP | `audiotel-platform-economics.mjs` | Vérification macro du relevé, de la banque et des obligations ; aucun FEC automatique |
| Distribution de revenus historiques | `tenant-revenue-finance.mjs`, `settlement-finance.mjs` | Analyse antérieure de la marge, sans substitution à un barème de gros certifié |
| Pôle Télécom & Réseau / distribution directe | `direct-sva-financial-cycle.mjs` et `direct_sva_*` | Conserver une unité distincte, ne jamais mélanger ses écritures ou ses utilisateurs |
| Abonnements Stripe / CB / avoirs | `stripe-billing.mjs`, `stripe-connect.mjs` | Les fonctions existantes suffisent comme bases des futures interfaces financières |
| Comptabilité / journal / FEC | `accounting-expert.mjs`, tables du grand livre existant | Aucune nouvelle comptabilité parallèle ni écriture statutaire dans cette branche |
| Espace client / cockpit | `assets/client-portal-api.js`, `assets/api-client.js`, `backend/server.mjs` | Conserver les chemins et styles, ajouter seulement des lectures de préparation |

**Choix technique** : les calculs en centimes entiers de `audiotel-financial-cycle-prelaunch.mjs` complètent les anciennes fonctions de distribution décimales, sans les modifier ni les utiliser pour autoriser un virement. Répartition au niveau de la ligne CDR = base versionnée d'un contrat, avec arrondi déterministe et garde-fous sur les montants.

## 2. Modèle financier : trois contrats distincts

- **Commission/intermédiation** : le partenaire contractuellement responsable peut reverser directement les éditeurs et rémunérer Audiotel par une commission, à condition que les contrats, la facturation, la nature du service et la qualification fiscale le démontrent. L'éditeur doit connaître clairement les cocontractants et le rôle de chacun.
- **Prestataire de services** : Audiotel facture ses propres prestations et son abonnement, les flux SVA rémunérant les éditeurs étant régis séparément. Seul le montant de ses prestations authentiquement réalisées est a priori à étudier comme recette propre ; ni les montants de la collecte ni le régime fiscal ne sont déduits automatiquement du schéma informatique.
- **Exploitant télécom direct / principal** : Audiotel assume les obligations de sa fourniture ; le montant des communications à prendre en compte peut alors différer substantiellement d'une simple commission. Une sortie de micro-entreprise peut devenir adaptée selon les volumes, charges et qualification juridique, à décider avec l'expert.

**Contraintes absolues** : le choix `commission_agent` dans un objet JSON n'est PAS une qualification de droit, aucun simple mandat écrit ne suffit à exclure des recettes du CA, et un compte bancaire séparé ne démontre pas une exemption de service de paiement. La micro-entreprise exige une comptabilité des encaissements et n'autorise pas la déduction des frais courants du CA déclaré. L'utilisateur doit valider la compatibilité du rôle « cocontractant commercial unique » avec le régime de commission, ou adopter un rôle de fournisseur qui reflète les contrats réels.

## 3. Source -> calcul -> paiement : chaîne cible

**Clause incontournable pour les futurs accords opérateur :** négocier prioritairement la collecte SVA suivie du reversement direct de l'opérateur ou d'un PSP habilité aux IBAN des professionnels, avec rémunération d'Audiotel sur un flux distinct. Requérir une réponse écrite documentant automatisation, coûts par transfert, statuts de règlement, preuves CDR/banque, délai de paiement, litiges et réconciliation via API/fichiers. Refus de l'opérateur = dossier de refus, alternatives chiffrées et validation juridique/fiscale avant décision expresse du dirigeant. Le circuit historique où Audiotel recevrait les fonds tiers n'est pas une alternative activable sans autorisations. Le versement direct n'emporte aucune conclusion automatique sur l'assiette du CA micro.

```text
Ressource SVA légalement exploitable
     ↓
Appel acheminé par un véritable opérateur -> CDR opérateur authentifié
     ↓
Relevé de collecte et barème de gros contractuel signé
     ↓
Contrat éditeur versionné, catégorie, période et droits de rémunération
     ↓
Moteur de calcul SVA Audiotel en centimes (contrôle doublon et arrondi)
     ↓
Litiges, rejets, retenues et corrections non silencieuses
     ↓
Rapprochement opérateur / confirmation PSP ou banque (source séparée)
     ↓
Contrôle KYB bénéficiaire + contrat + TVA + fonds de tiers + autorité
     ↓
Modèle A : opérateur/PSP habilité paie directement l'éditeur
     OU
Modèle B : Audiotel prépare un virement de fonds propres autorisés
     ↓
Preuves de paiement, rapprochements, journal et documents clients
```

**La version courante s'arrête à la PRÉPARATION**. Une référence client et un drapeau `verified=true` fournis par le navigateur ne sont jamais une preuve réelle. Aucun webhook financier n'est créé sur cette branche.

## 4. Module de calcul ajouté

`backend/src/audiotel-financial-cycle-prelaunch.mjs` :
- Contrôles d'unité `audiotel_platform`, France, EUR, références, statut et identité CDR ; aucun mélange `direct_sva`.
- Par locataire : `fee_bps` (base nette de gros après frais), `fee_minor_per_min` (secondes rémunérables / 60), `fixed_fee_minor_per_call`, tous rattachés à `version_reference` du contrat. Arrondi en **centimes** (BigInt pour multiplication et comparaison de seuils) pour éviter les erreurs cumulées de flottants.
- Une ligne `operator_reported` peut produire une estimation, jamais un virement. Une ligne `provisional`, `disputed` ou `rejected` n'entre pas dans les estimations d'exigible.
- Total opérateur = somme de toutes les lignes déclarées. Par ligne incluse : `gross = carrier_fee + processor_fee + audiotel_fee + publisher_due`, montant positif, plafond de calcul et pas de double CDR.
- Retenues par éditeur en cas de `fraud`, `dispute`, `chargeback`, `contract` ou `compliance`, sans conversion en recettes Audiotel.
- **Circuit de reversement direct** : le partenaire peut collecter 16,00 EUR pour les appels, conserver/déduire ses frais, verser les éditeurs directement et régler séparément **1,06 EUR de rémunération contractuelle simulée à Audiotel** dans l'exemple de test. La valeur de 1,06 EUR n'est pas un encaissement constaté, encore moins un chiffre d'affaires déclaré. La ligne `app_receipt_minor` correspond exclusivement au versement reçu par Audiotel, et non au total des communications.
- Rapprocher le versement Audiotel déclaré de la **rémunération contractuelle Audiotel**, jamais du total collecté quand l'opérateur paie directement les éditeurs. Vérifier séparément les preuves de paiement des éditeurs, les retenues, les frais, les taxes et les écritures du partenaire.
- Alerte si marge cible inférieure à 0,07 EUR/min (valeur ajustable, non une garantie).
- Source SHA et empreinte canonique, ordre des lignes neutre, version de contrat incluse, préparation de référence d'ordre unique par période, relevé, éditeur et contrat.
- Tous les champs de résultat `statutory_revenue_minor`, `micro_enterprise_turnover_minor`, `vat_minor` et `verified_earnings_minor` sont volontairement inconnus tant que les preuves ne sont pas authentifiées.
- Toutes les sorties `payout_authorized`, `bank_api_called`, `stripe_api_called`, `operator_api_called` valent `false` quel que soit l'état des données.

La fonction `evaluateAudiotelSettlement` préexistante reste l'outil macro pour l'expert comptable ; elle ne devient pas automatiquement une autorisation de paiement.

## 5. Modèle SQL à préparer, PAS installé en production

`database/prelaunch-not-applied/092_audiotel_financial_cycle_drafts.sql` ajoute :
- `app_fin_contract_terms_drafts` : barèmes contractuels versionnés par tenant, indicateurs légaux désactivés.
- `app_fin_operator_statement_drafts` : relevés et digest avec authentification désactivée.
- `app_fin_call_allocation_drafts` : lignes d'appels, contrainte de somme, unicité de CDR par opérateur, FK **tenant + contrat**.
- `app_fin_payout_instruction_drafts` : ordre théorique, bénéficiaire par référence, empreinte unique, sans IBAN ni prestataire API autorisé.
- `app_fin_reconciliation_drafts` : rapprochement PSP/banque uniquement en brouillon, jamais accepté sans source externe.
- `app_fin_audit_events` : traçabilité append-only, événement référencé, horodatage et empreinte de l'auteur.

Chaque table porte `business_unit='audiotel_platform'` et `PUBLIC` est révoqué. Le schéma bloque par `CHECK` toutes les mises à `true` de paiement, d'authentification externe et d'écriture statutaire : un futur lancement réclamera une migration de libération **différente**, revue et explicitement autorisée.

## 6. Ports techniques Stripe, Revolut Business et opérateurs

`backend/src/audiotel-financial-provider-ports.mjs` est une description d'interface non exécutable :
- **Stripe Billing** : conserver l'API et les webhooks signés existants pour abonnements, factures, CB, remboursement, abonnements ; ne jamais transformer le paiement d'un appel SVA en vente Stripe sans contrat.
- **Stripe Connect** : composant existant, activable exclusivement si rôle et circuit de fonds de tiers validés, KYC et configuration Stripe adéquats ; aucun transfert Connect vers éditeur en préparation.
- **Revolut Business** : futur adaptateur vers gestion de bénéficiaires, ordres de transfert, consultation de transaction et webhooks signés, **par défaut pour fonds propres Audiotel uniquement**. Pas de token, IBAN, permission `PAY` ni virement générés.
- **Opérateur collecteur** : entrée authentifiée des CDR, avis de paiement et preuve de reversement direct à l'éditeur ; prévoir des doubles contrôles pour les numéros portés, titulaires et périodes.
- **PSP habilité** : seule une convention autorisant ce service pour le compte des bénéficiaires permettra d'émettre des instructions.

Des clés d'idempotence internes ne protègent pas seules contre le double virement : le prestataire doit fournir sa propre clé de déduplication stable, la validation d'accusé d'ordre et la confirmation bancaire indépendante. Les retries après timeout demandent de consulter l'état d'un ordre **avant** toute répétition.

Documents officiels :
- Revolut Business API : https://developer.revolut.com/docs/api/business
- Stripe Connect : https://docs.stripe.com/connect
- ACPR : https://acpr.banque-france.fr/en/node/26817
- Service-Public micro : https://entreprendre.service-public.gouv.fr/vosdroits/F23266

## 7. Points de connexion internes ajoutés

Le serveur a déjà des routes pré-client en simulateur explicite `prelaunchCaseworkPreview`. Deux lectures supplémentaires ont été raccordées **sous ce même verrou** :
- `GET /api/v1/platform/prelaunch/finance` : staff admin, comptes de brouillons, statuts et liste des éléments manquants, sans montant fictif de CA.
- `GET /api/v1/customer/prelaunch/finance` : membre client avec `finance.read`, SQL `WHERE tenant_id=$1`, uniquement nombre de CDR préparés ; minutes et revenus validés restent `null`.

Ces routes n'existent pas en mode de production, même si l'option était activée. Les pages HTML/CSS et le cockpit existants ne sont pas modifiés : cette PR n'introduit aucun nouvel écran ni inscription libre.

## 8. Automatisation future, sans activation actuelle

Réutiliser `work_queue` et les journaux d'exécution :
1. Importer un fichier signé en staging via adaptateur contractuel et anti-virus / quota / checksum.
2. Dédupliquer les CDR dans l'opérateur et la période, enregistrer les corrections via écritures compensatoires.
3. Faire valider la catégorie, le barème et les droits de chaque éditeur.
4. Calculer les prévisions puis rapprocher les relevés signés indépendamment.
5. Créer les soldes confirmés uniquement après preuve de l'opérateur et règle comptable approuvée.
6. Bloquer retenues, impayés, chargebacks, litiges et bénéficiaires non vérifiés.
7. Préparer des instructions signées à destination d'un partenaire autorisé, jamais depuis un poste navigateur.
8. Prévenir deux validations internes avant transmission sensible si modèle l'exige.
9. Confirmer via le partenaire et la banque, rapprocher `request_id`, ref. transaction, montant, date et état.
10. Archiver documents et preuves selon les durées RGPD, déclencher l'e-mail transactionnel Resend avec idempotence.
11. Conserver un mécanisme d'alerte, de compensation et de support pour toute erreur ou échec.
12. Calculer les statistiques financières exclusivement depuis des confirmations authentifiées, avec permission `finance.read`.

L'architecture doit s'interfacer avec les modules d'ouverture et portabilité déjà préparés : pas de rémunération sans numéro actif légalement, CDR de source autorisée, tarif contractuel conservé et rapprochement authentifié.

## 9. Dépendances réelles qui restent

- Statut juridique de la personne morale, choix fiscal micro vs EURL/SASU, TVA, rôle `principal` vs `mandataire`, qualification des recettes et du risque PSP : expert-comptable + avocat spécialisé et, si nécessaire, échange avec ACPR.
- Clauses de collecte/reversement direct de l'opérateur SVA, facturation, barèmes de gros, responsabilités, CDR signés, garanties et gestion impayés.
- Droit et ressources Arcep, AF2M, identifiant d'opérateur, convention d'interconnexion et émission effective d'appels.
- Compte Stripe Audiotel relié au bon établissement et configuration légale; pas d'activation ni copie de clés.
- Revolut Business : vérification d'éligibilité du compte Business API et de son rôle juridique, signature des webhooks et périmètre des scopes.
- Contrats de mandats et KYB, banque de bénéficiaires / stockage privé, décision de rétention, conformité RGPD et accès RLS.
- Écrans et e-mails : uniquement après autorisation de publier; préparation des API staff et client est disponible sans changement du design.
- Coûts futurs non chiffrables sans offres contractuelles : collecte SVA, SBC/SIP hébergé, canaux, stockage CDR, PSP, virements, signature, KYC, expertise juridique/comptable ; zéro achat réalisé ici.

## 10. Contrôles et gel de production

- Code sur branche `prep/chaine-telecom-operateur-20261108`, PR **#190 draft**, non fusionnée.
- SQL **092** exécuté exclusivement dans une base temporaire GitHub Actions APRÈS les scripts existants et 090/091 ; aucun `CREATE` en Neon production.
- Tests automatisés : doublon CDR, équilibrage, états contestés, coûts, 7 centimes, contrats multi-tenants, rejet de fraude de preuves, facture/CA indéterminés, paiements toujours interdits, lecture staff/client cloisonnée, connecteurs hors ligne.
- Aucun nouveau déploiement Vercel, aucun webhook Resend/Stripe/Revolut, aucun envoi e-mail, aucune facture, aucun numéro exploité ni aucun paiement réel.
- Seul le propriétaire peut décider ultérieurement d'une fusion, d'un déploiement, d'une migration, d'une ouverture télécom ou d'un versement, sur ordres explicites et distincts.

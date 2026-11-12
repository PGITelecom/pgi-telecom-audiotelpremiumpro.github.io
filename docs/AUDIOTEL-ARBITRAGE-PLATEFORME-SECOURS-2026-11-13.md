# Audiotel Premium Pro | Plan de secours telecom et arbitrage financier
Date : 13 novembre 2026. **DOCUMENT INTERNE, SIMULATION UNIQUEMENT.**
Depot : PGITelecom/pgi-telecom-audiotelpremiumpro.github.io, PR 190, branche prep/chaine-telecom-operateur-20261108.
**Ne pas fusionner, deployer Vercel/Neon, demarrer de VPS/SIP, souscrire, attribuer de numeros, porter de lignes ou transferer des fonds.**

## 1. Decision strategique

Nous preparons une alternative technique independante sans presumer qu'elle sera moins couteuse. N'internaliser une fonction que si le cout complet sur 12, 24 et 36 mois, a garanties de disponibilite et de conformite comparables, est meilleur que celui d'un operateur de gros.
Priorite : frais d'activation par numero **0 EUR** et absence de minimum, d'engagement, d'inactivite, de frais de portabilite ou de desactivation/reactivation par professionnel.
Ces prix sont des **objectifs de negociation**, pas des facultes techniques garanties. Automatiser le provisionnement ne peut pas contraindre un collecteur a supprimer sa propre ligne de frais.

## 2. Perimetres a separer

- **Developpables** : portail existant, inventaire des numeros, dossiers de portabilite, automatisation de provisionnement *simule*, routage par DNIS, table clients/destinations, gestion des incidents, CDR et rapprochement, moteur financier, supervision et controle de fraude.
- **Necessitant des droits ou accords externes** : ressources attribuees par l'Arcep, interconnexion aux reseaux, collecte et facturation de l'appel SVA par les operateurs, annonces/controles reglementaires, portabilite operationnelle, reglements et versements a des tiers par un acteur habilite.
- **Exploitation reelle non preparee** : au moins deux noeuds SIP/media durcis en hebergement distant, reseau prive et SBC avec politique de securite operateur, flux RTP mesures, haute disponibilite multi-domaines, observabilite et reprise sur incident. Vercel/Neon restent le web et le stockage, **pas** un coeur SIP/RTP de production.
- La PR 190 comporte deja le routeur simule, le module CDR, le planificateur de numerotation et la comparaison de gros. Leur presence dans GitHub **ne prouve pas** qu'un operateur reel est interconnecte.

## 3. Modele financier livre

Sources :
- telephony/prelaunch-not-active/economics-capacity.mjs : contribution, cout par minute, capacite indicative.
- telephony/prelaunch-not-active/wholesale-comparison.mjs : comparaison de conditions de gros.
- telephony/prelaunch-not-active/build-vs-buy.mjs : **nouveau** TCO avec activation, portabilite, reactivation, resiliation, abonnement par numero, minimum individuel, engagement, frais fixes operateur, investissement logiciel, hebergement, redondance, maintenance, support, securite, conformite, cout minute SIP/transport/PSP/fraude, taxe de bloc Arcep et commission Audiotel hypothetique.
- scripts/audiotel-build-vs-buy-report.mjs : **nouveau** exemple reproductible sur 50/150/200/500/1 000 professionnels, 0/15/60 min/jour, 12/24/36 mois. Il ne contacte ni operateur, ni banque, ni base de donnees.
- tests/audiotel-build-vs-buy.test.mjs : **nouveau** controles des frais d'activation multiplies par numero, profils a zero minute, choix non autorise, marges distinctes, couts incompatibles et absence de donnees fiscales.
L'integralite des sommes de tiers doit etre exclue du modele de remuneration **propre** d'Audiotel tant que le cadre contractuel et fiscal n'est pas etabli.

### Donnees de calcul

Tous les montants suivants sont **des hypotheses de simulation entierement inventees pour comparer les mecanismes**, hors TVA et sans devis recu, **pas des prix d'Orange, Bouygues, Colt, SFR, Odigo, Axialys ou d'un cloud**.

| Hypothese | A : prestataire gere | B : plateforme hybride | C : SIP/RTP plus internalise |
|---|---:|---:|---:|
| Activation initiale par numero | 50 EUR | 0 EUR *(a obtenir du collecteur)* | 0 EUR *(a obtenir du collecteur)* |
| Developpement + securite + raccordement initial | 0 EUR | 12 000 EUR | 34 000 EUR |
| Charges mensuelles fixes hors numeros | 650 EUR | 1 000 EUR | 2 200 EUR |
| Frais mensuels par numero | 1 EUR | 0 EUR *(non garanti)* | 0 EUR *(non garanti)* |
| Cout variable total (operateur + media + PSP + risque) | 0,024 EUR/min | 0,014 EUR/min | 0,009 EUR/min |
| Attribution Arcep directe modelisee | Non | Oui | Oui |
| Commission Audiotel supposee pour calcul du resultat avant impots | 0,10 EUR/min | 0,10 EUR/min | 0,10 EUR/min |

**Attention a la commission de 0,10 EUR/min** : hypothese pedagogique, **pas** un reversement propose ni une tarification permise sur tous les prefixes. Les plafonds SVA Arcep rendent cette hypothese incompatible avec une simple minute 081 tarifee au maximum autorise. Les recettes, couts operateur et reversements reels doivent etre ventiles par prefixe, palier et origine de trafic.

Taxe annuelle de reference incluse dans B/C : 20 EUR pour un bloc Arcep de 1 000 numeros a dix chiffres. Montant de ressource uniquement, sans reseau telephonique. Source officielle actualisee 09/07/2026 : https://www.arcep.fr/la-regulation/grands-dossiers-thematiques-transverses/la-numerotation/taxes-de-numerotation.html

### TCO indicatif sur 12 mois

Hypotheses : 30 jours/mois, un numero par professionnel, 1 bloc detenu B/C, aucun frais de portabilite/desactivation/reactivation dans les trois scenarios. Couts operateur inconnus remplaces par les hypotheses explicites ci-dessus.

| Professionnels | Minutes par professionnel et par jour | A externe | B hybride | C interne |
|---|---:|---:|---:|---:|
| 150 | 0 | 17 100 EUR | 24 020 EUR | 60 420 EUR |
| 150 | 15 | 36 540 EUR | 35 360 EUR | 67 710 EUR |
| 150 | 60 | 94 860 EUR | **69 380 EUR** | 89 580 EUR |
| 50 | 60 | **36 820 EUR** | 39 140 EUR | 70 140 EUR |
| 500 | 60 | 298 000 EUR | 175 220 EUR | **157 620 EUR** |
| 1 000 | 60 | 588 200 EUR | 326 420 EUR | **254 820 EUR** |

Dans **cette simulation uniquement** : B reduit de **25 480 EUR** le cout sur 12 mois par rapport a A pour 150 professionnels a 60 min/jour. A 50 professionnels de meme intensite, A est moins couteuse malgre son activation de 50 EUR ; toutefois A ne satisfait pas le critere commercial de zero activation et son cout plus faible ne vaut pas recommandation de l'accepter. A 500 professionnels avec beaucoup de trafic, C devient moins couteuse malgre son investissement initial.

Ces conclusions *changent* des que les hypotheses de trafic, de recette, d'activation, de couts cloud, de maintenance ou de marge operateur changent.

Le seuil de trafic a partir duquel B devient moins chere qu'A dans l'exemple a 150 professionnels est **environ 57 667 minutes/mois**, soit **12,8 min/professionnel/jour**, sur 12 mois. Il ne s'agit pas d'un volume garanti.

### Marge par minute : perimetre exact

- **Contribution par minute avant charges fixes (hypothetique)** : commission propre Audiotel supposee moins couts variables du scenario.
- **Resultat moyen par minute avant impots sur l'horizon** : (recettes propres supposees moins investissements et tous couts TCO) / minutes. Le programme le calcule et renvoie une valeur nulle sans minute ou sans hypothese explicite de commission.
- **Revenu personnel reellement conserve apres impots et cotisations** : **inconnu** tant que la structure, les contrats, les charges et la fiscalite ne sont pas confirmes. Le logiciel renvoie donc toujours une valeur nulle pour cette donnee. Il serait incorrect de garantir 0,07 EUR nets personnels/minute sur ces seules hypotheses.
- Le risque, l'assurance, les contentieux, les impayes, la variation des tarifs operateurs et la qualite de service doivent etre chiffres avant toute decision d'investissement, meme s'ils ne sont pas completement connus dans les hypotheses.

### Validation d'un devis reel

Exiger une offre ecrite chiffree, avec reference, periode de validite et signatures des parties si elle est retenue, detaillant **chaque** frais : activation nouvelle et portabilite, retrait/reactivation, maintenance d'une ligne a zero minute, collecte, facturation, interconnexion, IP/numeros, degressivite, minima, duree et sortie, acces CDR, eventuelles obligations de volume, PSP et preuve de reversement direct. Verifier si un eventuel minimum est **au niveau Audiotel** ou **par professionnel**, les deux n'etant pas equivalents.
**Ne saisir dans un comparatif "devis verifie" que les montants directement etayes par le document.** Le moteur actuel reste volontairement au statut de devis non authentifie meme si une reference est renseignee. Pas de decision automatique.

## 4. Architecture de secours et points de decision

1. Maintenir PR 190 en brouillon **non fusionne**. Aucun code de production, base Neon, GitHub main, Vercel, Stripe, Resend, HubSpot ou compte bancaire modifie.
2. Preparer un modele de provisionnement declaratif : numero non attribue -> droit Arcep verifie -> titulaire KYB verifie -> mandat et route approuves -> prevision de configuration -> activation uniquement apres ordre autorise. Le logiciel de preparation doit echouer en securite si un prerequis manque.
3. Conserver l'architecture de simulation existante : routage exact par numero/client, protections anti-fraude, double noeud et secours simule, CDR reconcilies.
4. Ne pas acheter de VPS ou de numeros avant d'avoir un devis d'interconnexion compatible et une analyse des couts de support 24/7, de securite SIP, de haute disponibilite et de terminaison. Ne pas considerer une petite VM generaliste comme preuve de capacite RTP, ni un test de routage JavaScript comme une validation de qualite telephonique.
5. Comparer A/B/C sur les memes hypotheses, a volume **nul, faible, moyen et fort**, sur **12/24/36 mois**, y compris le cout du temps humain de maintenance.
6. Determiner la meilleure solution **pour la marge personnelle reelle** apres validation du regime juridique, du role SVA, des obligations ACPR et du traitement fiscal. Sans cette validation, publier seulement les couts et le resultat **avant prelevements**.
7. Exiger l'accord explicite du dirigeant pour toute commande, interconnexion, demande Arcep, deploiement, migration ou operation financiere.

## 5. Contraintes juridiques et preuves independantes

Sources prioritaires :
- Arcep, plan de numerotation, plafonds 081/082/089, attributaires et droits : https://www.arcep.fr/la-regulation/grands-dossiers-thematiques-transverses/la-numerotation.html
- Arcep, taxes annuelles et attribution : https://www.arcep.fr/la-regulation/grands-dossiers-thematiques-transverses/la-numerotation/taxes-de-numerotation.html
- ACPR, agent de PSP et PSP, qui fait quoi : https://acpr.banque-france.fr/fr/professionnels/lacpr-vous-accompagne/parcours-fintech/contenus-pedagogiques/agent-de-psp-et-psp-qui-fait-quoi

Le reversement direct par operateur ou PSP habilite **ne demontre pas** a lui seul que la societe Audiotel ne fournit aucun service de paiement ou que seules ses commissions seront fiscalisees : demander l'avis juridique et fiscal approprie.

## 6. Conclusion applicable pour le moment

**Aucun devis complet authentifie, aucun contrat d'interconnexion ni droits de numerotation etablis : il est actuellement IMPOSSIBLE de conclure que notre reseau interne coute effectivement moins cher qu'un prestataire.**

- A petit volume, la sous-traitance peut etre economiquement superieure.
- A volume suffisant, l'automatisation propre peut compenser ses investissements fixes.
- A tres fort volume, la gestion SIP/RTP interne peut devenir interessante, mais exige un personnel et des engagements de qualite de service.
- L'absence de frais de mise en service par numero **doit etre obtenue contractuellement**. L'automatisation de notre propre console ne supprime pas les frais que nous facturerait un collecteur.

**Statut final : modele de secours preparatoire, calculs hypothetiques, aucune exploitation autorisee, aucune depense engagee.**

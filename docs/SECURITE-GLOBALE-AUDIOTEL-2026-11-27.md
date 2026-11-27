# Audiotel Premium Pro | Politique de securite code, telecom, donnees et finances

Date : 27/11/2026. Statut : exigences et preparation, **pas de certification ni de mise en production**.
Objet : securite maximale avec gestion quotidienne simple. Les actions risquées echouent par defaut ; ne jamais creer un nouveau prestataire par reflexe.

## 1. Protection du code et de l'administration
- Activer une MFA resistante au phishing sur les comptes GitHub, Vercel, Neon, domaine/DNS, Google, Resend, Stripe et services financiers ; inventorier les comptes et leur proprietaire. A verifier compte par compte, sans pretendre que la MFA est active.
- Droits minimaux : separer gestion quotidienne et super-administration ; pas de jeton a privileges globaux permanent. Comptes machine distincts, secrets hors GitHub, navigateur, fichiers de suivi et logs.
- Changement du code : branche isolee, revue, CI qualite/securite, scan de secrets et dependances, verrouillage de main, verification des environnements avant fusion. Aucune validation de CI ne prouve a elle seule l'absence de failles.
- Protections applicatives : controles des permissions cote serveur et par client, sessions securisees, CSRF, limitation de debit, validation stricte, requetes parametrees, traitement prudent des webhooks signes, journal d'audit sans donnees sensibles.
- Pas de commandes administrateur generiques ou de SIP/SQL exposees sur internet ; controles d'acces meme sur le reseau prive. Rotation des secrets lors d'incident.

## 2. Securite telecom 089 et anti-fraude
- Aucune interconnexion, route, bloc 089, portabilite ou collecte n'est declaree active sans droits Arcep, contrats, validation des origines et preuve d'acheminement.
- Infrastructure SIP : interfaces d'administration non publiques, ACL explicites, authentification mutuelle/TLS/SRTP selon faisabilite, durcissement pare-feu, supervision et mises a jour. Eviter SIP ouvert sur internet et relais non autorise.
- Controles contre trafic artificiel, surconsommation, appels repetitifs, pics par numero/editeur/origine, usurpation d'identifiants, manipulation de durees/CDR, redirections non autorisees et fraude au partage de revenus. Des seuils doivent etre fondes sur le trafic reel et les contrats, jamais inventes.
- Rupture de chaine de preuves : bloquer les etats "payable/valide" si CDR, collecte contractuelle et reconciliation divergent ; conserver sources et ajustements, sans ecraser l'historique.
- Secours : deux routes SIP ne constituent pas deux collecteurs independants ; documenter l'indisponibilite du reseau de collecte 089 et les conditions reelles de portabilite.

## 3. Paiements, identite commerciale et donnees
- Ne jamais faire transiter de fonds de tiers par Audiotel sans validation juridique du modele ; reversement direct via operateur/PSP qualifie, sur IBAN du professionnel verifie.
- Changement de beneficiaire, d'IBAN ou de parametres de reversement : re-authentification forte, verification hors canal de la demande, temporisation adaptee et double validation si risque eleve. Journal immuable des decisions et preuve du montant.
- Interdire versement sur la seule foi d'un CDR, d'un e-mail, d'une estimation ou d'un drapeau applicatif. Conciliation CDR interne + relevé operateur + contrat + controle risque + preuve du reglement.
- Secrets et pieces identite : transit securise, acces limite, duree de conservation justifiee ; exports CDR minimises sans CLI quand inutile ; compartimentage des clients (tenants).
- Sauvegardes chiffrées, versionnees et hors du compte administrateur de production ; procedure de restauration documentee. Une sauvegarde non restauree et verifiee ne prouve pas la reprise.

## 4. Gouvernance, cout et niveau de preuve
- Pas de garantie "impossible a hacker" : raisonner en prevention, detection, limitation de degats, intervention et reprise.
- Priorite P0 : acces administrateur, secrets, isolation clients, demandes d'IBAN, droits sur numeros/portabilite, fraud/SVA, circuit de fonds, restauration.
- Priorite P1 : detection d'anomalies, horodatage et preuve des accords, revues fournisseurs, reponse incident, continuite.
- Priorite P2 : confort d'exploitation, reporting et automatisation non critiques.
- Les logiciels libres ne remplacent ni un operateur interconnecte ni un PSP legalement conforme. Faire le choix sur cout total, risque et possibilite de sortie.
- Chaque protection doit avoir un etat explicite : PLANIFIE, CODE NON DEPLOYE, VERIFIE EN CI, VERIFIE EN PRODUCTION, ou PREUVE CONTRACTUELLE. Aucun etat ne se deduit d'une promesse.

## 5. Statut du travail de preparation actuel
- Comparateur de 3 architectures (operateur integre / SIP proprie + collecte wholesale / interconnexion directe) : estimation pure, sans activation ou prix fournisseur presume.
- Validation numerique durcie contre les conversions implicites ; tests de securite et scenario trois modeles ajoutes. L'execution CI reste a confirmer apres commit.
- Normalisation, archive portable et continuité SIP : **previsualisation**, aucune collecte, aucune base ou paiement reel modifies.
- Toute activation commerciale ou reseau demandera une decision distincte avec preuve, analyse de securite et conditions contractuelles.

References : ANSSI guide securiser la telephonie IP https://messervices.cyber.gouv.fr/guides/securiser-une-architecture-de-telephonie-sur-ip ; ANSSI hygiene https://messervices.cyber.gouv.fr/guides/guide-dhygiene-informatique ; OWASP ASVS https://asvs.owasp.org/ .

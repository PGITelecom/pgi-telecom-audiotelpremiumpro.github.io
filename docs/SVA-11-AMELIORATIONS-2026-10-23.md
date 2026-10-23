# SVA uniquement | 11 optimisations en préparation (23 octobre 2026)

Branche isolée `prep/sva-conversion-automation-2026-10-23`. Aucune fusion vers `main`, aucun déploiement Vercel, aucune action sur Neon, Stripe, opérateur ou paiements. Aucun fichier du Pôle Télécom & Réseau modifié.

## Traçabilité des 11 objectifs

1. **Accueil convaincant** : lien de confiance discret sur l’accueil vers la page Solutions, sans agrandir excessivement le HTML critique.
2. **Pourquoi PGI Telecom ?** : quatre engagements lisibles sur Solutions, avec les composants responsives déjà éprouvés.
3. **Confiance vérifiable** : accès aux mentions légales et au contact sans fausses certifications, chiffres ou témoignages.
4. **Publics** : particuliers, porteurs de projet, indépendants et entreprises, avec rappel des activités admissibles.
5. **Clarté** : différencier en langage courant abonnement, coût de l'appel, reversement et frais tiers.
6. **Parcours commercial** : bouton unique vers la demande existante, sans prélèvement ni activation revendiqués.
7. **Business Live** : aperçu statique **pédagogique** sans données inventées, préservant la différence estimé/confirmé/validé.
8. **Mobile et accessibilité** : réemploi des composants de grille responsives existants, sans CSS supplémentaire.
9. **Statuts** : le formulaire enregistré n'équivaut pas à un numéro opérationnel ; contrôle des validations nécessaires.
10. **SEO et moteurs de réponse** : bloc HTML indexable sur Solutions, maillage depuis l’accueil et énoncés factuellement prudents.
11. **Cohérence** : conservation de la marque, des CTA, des tarifs existants et des fonctions SVA.

## Automatisation et limites opérationnelles

- La transmission des prospects utilise le mécanisme serveur/CRM existant. L'interface ne doit afficher de confirmation que lorsque l'API a accusé réception ; ne pas introduire de remise automatique en boucle qui provoquerait des doublons.
- CI autonome déclenchée par GitHub sur la branche de préparation : test des pages, des protections d'activation, des points du parcours et du paramètre Vercel qui interdit les déploiements hors `main`.
- Les automatismes serveur déjà présents (notamment emails, facturation, CRM et reversements) ne sont pas modifiés par cette livraison. Leur fonctionnement réel reste conditionné aux identifiants, à la disponibilité de Neon, aux opérateurs et à la confirmation des paiements.
- **Zéro intervention humaine absolue n'est pas garanti** : identification réglementaire, contractualisation opérateur, vérifications de conformité et incidents fournisseurs ne peuvent être supprimés par le logiciel.
- Aucun revenu supplémentaire ni classement de premier acteur du marché ne peut être garanti avant mesure de conversion et d'économie unitaire sur données réelles.

## Critères de sécurité
Maintenir `main` inchangée, ne pas modifier `site/distribution-sva/`, ne pas altérer les API de paiements et préserver les offres publiques affichées. Recontrôler le périmètre avec GitHub Compare avant toute fusion future.

## Condition préalable à l'ouverture commerciale : assurances et litiges

**À vérifier avant tout lancement réel des clients SVA ; ne pas traiter comme une assurance déjà souscrite.**

- Obtenir un devis et une **attestation de responsabilité civile professionnelle (RC Pro)** indiquant explicitement les activités « plateforme / distribution de numéros spéciaux et services à valeur ajoutée (SVA), télécommunications », les dommages immatériels non consécutifs, erreurs de tarification, incidents de service et erreurs de calcul de reversements dans la mesure où ils sont assurables.
- Comparer une **protection juridique professionnelle** : défense lors de litiges clients, éditeurs, fournisseurs et opérateurs, frais d'avocat et d'expertise, médiation et plafonds.
- Étudier une **assurance cyber** : incident informatique, fuite de données, indisponibilité, assistance de réponse à incident et responsabilité liée aux données, suivant conditions.
- Contrôler les **exclusions spécifiques** (SVA/089, télécommunications, fraude et abus des éditeurs, montants contestés, amendes et pénalités non assurables), franchises, plafonds, territorialité, délais de carence et éventuelles périodes de rétroactivité.
- Vérifier la répartition des responsabilités avec l'opérateur et les sous-traitants dans les contrats, plus les procédures de réclamation, données d'appels conservées légalement, conformité AF2M et information client.
- **Critère GO/NO-GO** : avant d'ouvrir le service aux clients, faire confirmer par écrit l'adéquation des garanties au modèle PGI et récupérer l'attestation active. Une RC Pro générale sans mention des SVA n'est pas considérée comme validée.

Cette tâche est une **préparation administrative et juridique** ; aucune assurance n'est souscrite ici et aucun déploiement Vercel/Neon n'est autorisé par cet ajout documentaire.

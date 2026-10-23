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

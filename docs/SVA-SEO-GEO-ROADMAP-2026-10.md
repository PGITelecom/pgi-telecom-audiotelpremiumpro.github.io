# Plan SEO / GEO / recherche vocale : Audiotel Premium Pro (SVA)

Date de préparation : 12 octobre 2026  
État : **brouillon GitHub uniquement**. **Ne pas fusionner dans main ni déployer sur Vercel sans accord explicite**.

## Périmètre

Le présent plan concerne exclusivement **Audiotel Premium Pro**, activité SVA existante. Ne pas mélanger les promesses commerciales, les numéros, les tarifs ou les autorisations d'exploitation de **PGI Telecom Distribution**.

## Point de départ Google Search Console

Propriété : `sc-domain:audiotel-premium-pro.com`  
Période : 28 derniers jours de données disponibles lors de l'analyse.

| Indicateur | Valeur |
| --- | ---: |
| Impressions | 92 |
| Clics | 3 |
| CTR | 3,26 % |
| Position moyenne | 58,66 |

**Attention :** échantillon trop faible pour conclure sur une tendance stable ou attribuer une variation à une modification SEO. Mesurer séparément les requêtes de marque et les requêtes commerciales.

Signaux détectés : `changer-operateur-audiotel/` (30 impressions, position moyenne 89,7), `paiement-cb-audiotel/` (19 impressions, position moyenne 81,9), page d'accueil, pages métiers et `audiotel-independants/`. Les requêtes « voyance audiotel pas cher » et similaires ne doivent pas être utilisées pour dénaturer la plateforme en site de consultation : la cible est un **fournisseur de services SVA**, non la vente de séances de voyance.

## Travaux préparés dans cette branche

- Métadonnées spécifiques pour les intentions **changer d'opérateur / portabilité**, **paiement CB pour consultations téléphoniques** et **numéro surtaxé professionnel**. Les affirmations restent conditionnelles lorsque la mise en service ou l'éligibilité nécessite une validation.
- Meilleur maillage contextuel : entrée directe depuis la page d'accueil vers « changer d'opérateur » ; liaison paiement CB vers les consultations de coaching. Aucun ajout de pages artificielles ou de liens vers des pages privées.
- Test de non-régression `tests/sva-seo-growth.test.mjs` pour les 29 pages éditoriales, les métadonnées, les liens et la séparation commerciale.

## Stratégie de visibilité organique

1. **Portabilité / changement d'opérateur :** articuler `changer-operateur-audiotel/` → `portabilite-numero-sva/` → `comparateur-audiotel/` → demande, sans laisser croire que le transfert est garanti.
2. **Numéros SVA pour professionnels :** distinguer `audiotel-professionnels/`, `numero-sva/`, `numero-surtaxe-08/` et `tarif-numero-sva/` ; éviter les pages concurrentes avec le même titre et la même intention.
3. **Reversements :** expliquer, sans promesse de revenus, le taux contractuel, les minutes éligibles et les montants attendus / confirmés / validés. Renforcer les relations entre `reversement-audiotel/`, `combien-rapporte-numero-surtaxe/`, `comparateur-audiotel/` et `business-live-audiotel/`.
4. **Paiement CB :** présenter explicitement ce service comme **complémentaire**, distinguer abonnement et commissions et limiter toute affirmation d'activation immédiate. Relier les cas d'usage aux guides métiers.
5. **GEO et assistants vocaux :** répondre aux questions concrètes en HTML accessible, contextualiser les conditions, citer les sources réglementaires pertinentes et conserver des titres hiérarchiques. Ne pas ajouter de faux avis, des FAQ identiques sur chaque page ni de données structurées non représentées dans le contenu.
6. **SEO technique :** contrôler titres, descriptions, H1, canoniques, indexation volontaire, sitemap, liens navigables en HTML et redirections ; mesurer LCP / INP / CLS en priorité sur mobile.
7. **Conversions et performance :** suivre les clics vers demandes de numéros, portabilité et comparateur, de préférence via GA4 / GSC sans injecter de données personnelles dans les statistiques.

## Critères de validation avant déploiement

- `npm test`, `npm run verify` et contrôle de génération de la sortie `dist` réussis ; l'écriture dans la branche de préparation ne suffit pas à prouver le résultat de ces tests.
- Absence de liens internes brisés, de pages destinées à l'indexation marquées `noindex` par erreur, de canoniques divergents et de duplication de H1.
- Contrôle manuel mobile, bureau, accessibilité et lisibilité des CTA, avec conservation de l'esthétique SVA.
- Vérification que les abonnements à **4,90 € TTC/mois**, les paiements, le CRM, l'authentification et les fonctionnalités Audiotel restent inchangés.
- Vérification que **PGI Telecom Distribution n'est pas activé**.
- **Feu vert explicite de l'utilisateur avant toute fusion pouvant déployer ou tout déploiement Vercel**.

## Mesure après une publication autorisée

Comparer les données Search Console sur au moins 28 jours puis sur plusieurs périodes comparables, sans promettre de première place. Suivre les pages commerciales, le volume de requêtes non liées à la marque, le CTR, la position et les demandes qualifiées. Adapter les textes seulement si les données confirment un bénéfice réel.

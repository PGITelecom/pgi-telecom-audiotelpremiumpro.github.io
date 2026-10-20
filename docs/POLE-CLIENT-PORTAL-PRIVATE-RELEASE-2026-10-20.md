# Pôle Telecom & Réseau : futur espace client privé

## État préparé au 20 octobre 2026

- Activité commerciale Distribution non ouverte. Aucun numéro direct, aucune facturation ni reversement Distribution ne doit être déclenché.
- Parcours SVA actuel : inchangé. Aucun lien ou onglet Distribution ajouté à `client.html` ou à `assets/client-portal.js`.
- Une identité PGI unique pourra servir aux deux activités, mais jamais une autorisation commune implicite.
- Interface préparatoire de la Distribution : `site/distribution-sva/espace-client/index.html`. Elle reste volontairement **non publiée**.
- Aperçu visuel sans aucune donnée client : onglet **Espace client (aperçu privé)**, importé seulement depuis le cockpit Distribution monté pour un administrateur authentifié.
- Adresses publiques du portail `/distribution-sva/espace-client/` et fichiers propres `/site/distribution-sva/client-portal.js` : HTTP **404**, `Cache-Control: no-store` et `X-Robots-Tag: noindex`, même lorsque les pages d'information du Pôle sont publiées.
- Rejet dès l'entrée Vercel avant réveil de Neon, plus un deuxième verrou au niveau du gestionnaire statique de l'application.
- API future `GET /api/v1/customer/direct-sva/overview` : authentification et habilitation client requises; sélection strictement limitée au tenant; `direct_sva_customer_accounts` et `commercial_operation_enabled` doivent également l'autoriser. Les verrous métier actuellement en place interdisent cette activation.
- Aucun changement de réglage Neon ni de droit client et aucune fusion/déploiement Vercel dans cette préparation.

## Procédure de lancement distincte (à demander explicitement)

1. Identifier et valider les accords opérateurs, les droits de numérotation, les obligations réglementaires, les données contractuelles et les circuits financiers.
2. Faire valider l'identité juridique, les mentions RGPD, la politique de réclamation et la notification clients.
3. Tester séparément les accès administrateur, SVA seul, Distribution seule et client multi-activité. Tester lecture multi-tenant, export, sécurité CSRF, cache, indexation, perte de session et déconnexion.
4. Préparer les habilitations par dossier client : l'inscription à Audiotel n'active jamais automatiquement la Distribution.
5. Après autorisation expresse, créer une évolution applicative **distincte** qui lève les verrous des seules pages et ressources nécessaires, configure la publication du portail et procède à un déploiement contrôlé. Ne jamais réutiliser l'interrupteur d'affichage du site informatif comme bouton de souscription.
6. Recetter la connexion, les pièces, les numéros, les relevés et les contrats avec des données vérifiées. Conserver un mécanisme de retrait immédiat et de retour arrière.
7. Afficher l'entrée Distribution aux seuls clients explicitement habilités, jamais aux clients SVA seuls; ne diffuser aucune invitation avant l'ouverture.

**Important :** les contrôles techniques en préparation ne constituent ni une certification, ni une garantie de disponibilité, ni un constat d'exploitation du réseau.

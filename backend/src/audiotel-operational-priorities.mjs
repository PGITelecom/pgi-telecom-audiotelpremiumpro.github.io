/**
 * Audiotel Premium Pro : deterministic, read-only operational action plan.
 * These instructions are recommendations to authorized staff, not evidence
 * of carrier readiness, a customer agreement, a payment, or lawful launch.
 */
const UNIT="audiotel_platform";
const catalog=Object.freeze({
  database_snapshot:["critical","internal","Restaurer le diagnostic fiable de la base","Vérifier la connexion SQL et les permissions de lecture avant tout autre contrôle."],
  number_stock_recorded:["critical","external","Obtenir un stock de numéros juridiquement attribuables","Vérifier les décisions d'attribution, le titulaire, les limites de blocs et la disponibilité réelle."],
  carrier_connection_recorded:["critical","external","Finaliser l'interconnexion télécom","Raccorder les opérateurs, le routage SIP, les tests d'appel et les relevés CDR."],
  upstream_number_assignment_recorded:["critical","external","Obtenir une preuve réglementaire d'affectation","Faire confirmer l'opérateur exploitant et ses droits d'affectation pour chaque numéro."],
  external_operator_acceptance:["critical","external","Faire valider le modèle contractuel et les ressources Arcep","Ne pas attribuer de numéro 08 sous une simple mise à disposition interdite entre opérateurs."],
  subscription_price_version:["high","internal","Contrôler le tarif et sa version contractuelle","Conserver un seul prix actif applicable, le TTC et les conditions contractuelles historiques."],
  legal_identity:["critical","legal","Vérifier l'identité juridique Audiotel","Configurer les références légales exactes et obtenir leur validation documentaire."],
  vat_configuration:["critical","accounting","Faire valider le régime TVA","Expert-comptable : TVA, principal/mandataire, frais, remboursements et avoirs."],
  account_mapping:["high","accounting","Paramétrer les comptes comptables","Plan de comptes, banque, créances, dettes éditeurs, frais prestataires et rapprochements."],
  fec_export_configuration:["high","accounting","Préparer l'export FEC exploitable","Contrôler les journaux, l'immutabilité des écritures et la piste d'audit avec l'expert-comptable."],
  payment_provider_live:["high","stripe_deferred","Raccorder Stripe au bon compte uniquement après autorisation","Abonnement, webhooks signés, idempotence, rapprochements et éventuel PSP SEPA pour les fonds opérateur."],
  statutory_accounting_review:["high","accounting","Faire approuver la qualification comptable","Documenter la reconnaissance du chiffre d'affaires et le traitement des fonds de tiers."],
  operator:["critical","external","Valider la connectivité réelle avec l'opérateur","Contrat opérateur, acheminement effectif, CDR, incident et secours testés."],
  regulatory:["critical","legal","Lever les blocages réglementaires SVA","Numéros autorisés, tarifs, messages, registre et obligations applicables vérifiés."],
  billing:["high","stripe_deferred","Finaliser les encaissements réels et leur rapprochement","Vérifier indépendamment le compte Stripe et les événements de règlement avant activation."],
  payouts:["critical","external","Sécuriser les reversements éditeurs","Prouver réception des fonds, droits du bénéficiaire et habilitation du prestataire de paiement."],
  security:["critical","internal","Renforcer les contrôles de sécurité de production","Sessions, privilèges, accès PostgreSQL et cloisonnement tenant, audit et sauvegardes."],
  resilience:["high","internal","Valider la résilience avant toute exploitation","Sauvegarde indépendante, restauration, SLA interne et suivi des incidents."],
  email:["high","internal","Fiabiliser les e-mails clients","Vérifier livraison Resend et webhooks entrants sans créer de comptes sur des messages non fiables."],
  database:["critical","internal","Garantir la persistance de la production","Contrôler les connexions, l'intégrité SQL et les procédures de reprise."],
  runtime:["high","internal","Résoudre les incidents internes bloquants","Éliminer les tâches en échec, dead letters et alertes critiques."],
  legal_identity_launch:["critical","legal","Publier une identité juridique vérifiée","Confirmer la personne morale contractante et les mentions légales."],
  b2c_legal:["high","legal","Finaliser le volet consommateur si applicable","Contrôler médiateur, rétractation et documentation avant les offres B2C."]
});
const rank={critical:0,high:1,normal:2};
function fixedAction(key,source){
  const entry=catalog[key];
  if(!entry)return null;
  const [priority,owner,title,action]=entry;
  return Object.freeze({key,source,priority,dependency:owner,title,action});
}
export function prioritizeAudiotelOperations({launch,assurance}={}){
  const actions=[];
  const present=new Set();
  const add=(key,source)=>{
    if(present.has(key))return;
    const item=fixedAction(key,source);
    if(item){present.add(key);actions.push(item);}
  };
  const hasLaunch=launch&&Array.isArray(launch.sections);
  const hasAssurance=assurance&&Array.isArray(assurance.checks)&&assurance.business_unit===UNIT;
  if(!hasLaunch||!hasAssurance)add("database_snapshot","unavailable");
  if(hasAssurance){
    for(const item of assurance.checks){
      if(!item||item.status!=="observed")add(item?.key,"audiotel_assurance");
    }
  }
  if(hasLaunch){
    for(const item of launch.sections){
      if(item?.status==="ready")continue;
      add(item.key==="legal_identity"?"legal_identity_launch":item?.key,"launch_gate");
    }
  }
  actions.sort((a,b)=>rank[a.priority]-rank[b.priority]||
    a.dependency.localeCompare(b.dependency,"fr")||a.key.localeCompare(b.key,"fr"));
  const dependencies=Object.freeze({
    internal:actions.filter(x=>x.dependency==="internal").length,
    external:actions.filter(x=>x.dependency==="external").length,
    legal:actions.filter(x=>x.dependency==="legal").length,
    accounting:actions.filter(x=>x.dependency==="accounting").length,
    stripe_deferred:actions.filter(x=>x.dependency==="stripe_deferred").length
  });
  return Object.freeze({
    schema_version:"audiotel-operational-priorities/1",
    business_unit:UNIT,
    source:"staff_readonly_launch_gate",
    action_count:actions.length,
    actionable_without_external_approval:dependencies.internal,
    depends_on_external_approval:dependencies.external+dependencies.legal+
      dependencies.accounting+dependencies.stripe_deferred,
    dependencies,actions:Object.freeze(actions),
    safe_for_automatic_payment:false,
    authorizes_number_assignment:false,
    authorizes_release:false,
    authorizes_real_payment:false
  });
}

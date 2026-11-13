/**
 * Purely hypothetical offline scenarios. NO real carrier tariff or quote.
 * Never provision hardware, numbering resources, contracts or payments.
 * Run: node scripts/audiotel-build-vs-buy-report.mjs
 */
import {compareAudiotelBuildVsBuy} from "../telephony/prelaunch-not-active/build-vs-buy.mjs";
import {auditAudiotelActivationOverlays} from "../telephony/prelaunch-not-active/activation-fee-audit.mjs";
const operator=(overrides={})=>({
 activation_minor_per_number:0,portability_minor_per_number:0,
 deactivation_minor_per_number:0,reactivation_minor_per_number:0,
 monthly_minor_per_number:0,monthly_minimum_minor_per_professional:0,
 commitment_months:0,fixed_monthly_minor:0,
 payout_minor_per_professional:0,minute_micros:0,psp_minute_micros:0,
 global_minimum_monthly_minor:0,direct_payout_supported:true,...overrides
});
const internal=(overrides={})=>({
 development_minor:0,telecom_setup_minor:0,security_legal_setup_minor:0,
 hosting_monthly_minor:0,redundancy_monthly_minor:0,maintenance_monthly_minor:0,
 support_monthly_minor:0,security_compliance_monthly_minor:0,ops_monthly_minor:0,
 media_minute_micros:0,network_minute_micros:0,fraud_minute_micros:0,...overrides
});
const alternatives=[
 {
  reference:"A-EXTERNAL-HYPOTHESIS",model:"external_managed",direct_arcep:false,
  quote_reference:null,commission_micros_per_min:100000,
  operator:operator({activation_minor_per_number:5000,monthly_minor_per_number:100,
   fixed_monthly_minor:50000,minute_micros:20000,psp_minute_micros:2000}),
  internal:internal({support_monthly_minor:15000,fraud_minute_micros:2000})
 },
 {
  reference:"B-HYBRID-HYPOTHESIS",model:"hybrid_automated",direct_arcep:true,
  quote_reference:null,commission_micros_per_min:100000,
  operator:operator({fixed_monthly_minor:25000,minute_micros:8000,
   psp_minute_micros:2000}),
  internal:internal({development_minor:800000,telecom_setup_minor:150000,
   security_legal_setup_minor:250000,hosting_monthly_minor:15000,
   redundancy_monthly_minor:10000,maintenance_monthly_minor:25000,
   support_monthly_minor:10000,security_compliance_monthly_minor:10000,
   ops_monthly_minor:5000,media_minute_micros:2000,
   network_minute_micros:1000,fraud_minute_micros:1000})
 },
 {
  reference:"C-MORE-INTERNAL-HYPOTHESIS",model:"self_managed_sip",direct_arcep:true,
  quote_reference:null,commission_micros_per_min:100000,
  operator:operator({fixed_monthly_minor:50000,minute_micros:3000,
   psp_minute_micros:2000}),
  internal:internal({development_minor:2200000,telecom_setup_minor:700000,
   security_legal_setup_minor:500000,hosting_monthly_minor:50000,
   redundancy_monthly_minor:40000,maintenance_monthly_minor:40000,
   support_monthly_minor:15000,security_compliance_monthly_minor:15000,
   ops_monthly_minor:10000,media_minute_micros:2000,
   network_minute_micros:1000,fraud_minute_micros:1000})
 }
];
const scenarios=[50,150,200,500,1000].flatMap(n=>[0,15,60].map(minutes=>({
 reference:"PROS-"+n+"-MIN-"+minutes,professional_count:n,
 minutes_per_professional_per_day:minutes,days_per_month:30,
 ported_count:n,deactivation_count:0,reactivation_count:0,
 payout_count_per_month:n,arcep_blocks_held:1
})));
const output=compareAudiotelBuildVsBuy({
 business_unit:"audiotel_platform",mode:"offline_simulation",
 annual_arcep_fee_per_block_minor:2000,
 scenarios,alternatives,horizons_months:[12,24,36]
});
// Independent stress illustration: these EXTRA charges are invented and
// NOT in the published baseline TCO table. No claims about any real carrier.
const hiddenFeeCase=auditAudiotelActivationOverlays({
 business_unit:"audiotel_platform",mode:"offline_simulation",
 base_input:{
  business_unit:"audiotel_platform",mode:"offline_simulation",
  annual_arcep_fee_per_block_minor:2000,
  scenarios:scenarios.filter(s=>s.reference==="PROS-150-MIN-60"),
  alternatives,horizons_months:[12]
 },
 fee_schedules:alternatives.map(a=>({
  alternative_reference:a.reference,completeness:"hypothetical",
  fees:a.reference==="A-EXTERNAL-HYPOTHESIS"?[{
   reference:"HYPOTHETICAL-EXTRA-BATCH-ADMIN",
   category:"manual_activation_admin",basis:"per_batch",
   amount_minor:5000,amount_micros_per_minute:null,batch_size:100
  }]:[]
 }))
});
process.stdout.write(JSON.stringify({
 warning:"HYPOTHESES NON CONTRACTUELLES. PAS DE DEVIS AUTHENTIFIE.",
 source:"simulation_offline_only",quote_count_authenticated:0,
 after_tax_margin_establishable:false,all_legal_contractual_gates_validated:false,
 illustrative_incremental_hidden_fees_only:{
  warning:"EXTRA FRAIS PUREMENTS FICTIFS, NON COMPRIS DANS LES TABLEAUX TCO DE BASE",
  authenticated_quotes:0,rows:hiddenFeeCase.rows,
  real_zero_activation_guaranteed:hiddenFeeCase.can_assert_real_zero_activation_cost
 },
 ...output
},null,2)+"\n");

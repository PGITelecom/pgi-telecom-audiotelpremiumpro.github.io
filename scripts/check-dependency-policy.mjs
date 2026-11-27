import fs from "node:fs";

const p=JSON.parse(fs.readFileSync("config/dependency-policy.json","utf8"));
const failures=[];

if(p.schemaVersion!==1)failures.push("unsupported schemaVersion");
if(p.policy!=="strict-minimum-external-dependencies")failures.push("invalid dependency policy");

const requiredCore=[
  "dashboard","api","database","sip_proxy","media_server","ivr",
  "expert_routing","internal_cdr","financial_engine","reconciliation","monitoring","audit"
];
for(const item of requiredCore){
  if(!p.coreOwnedByPGI.includes(item))failures.push("PGI core ownership missing: "+item);
}

const required=p.externalRequired||[];
if(required.length!==1)failures.push("architecture must expose exactly one required external role");
else if(required[0].role!=="sva_host_operator")failures.push("required external role must be sva_host_operator");
else if(required[0].replaceable!==true)failures.push("SVA host operator must be replaceable");

for(const forbidden of p.forbiddenHardDependencies||[]){
  if(!String(forbidden).startsWith("carrier_specific_"))failures.push("unexpected forbidden dependency declaration");
}


const cost=p.costGovernance;
if(!cost||cost.defaultForNewPaidServices!=="deny_without_proven_need"||
   cost.preferExistingOwnedModules!==true||
   cost.chooseLowestVerifiedTotalCostNotFewestVendors!==true||
   cost.securityComplianceCannotBeWaived!==true||
   cost.noPaidTelecomHostingBeforeNetworkContract!==true||
   cost.directInterconnectionIsNotCostFree!==true||
   cost.supplierCancellationRequiresEvidenceOfEquivalentService!==true)
 failures.push("missing mandatory cost-control guarantees");
const requiredEvidence=[
 "documented_unavoidable_gap","actual_complete_quote","security_and_legal_review",
 "export_and_exit_path","net_margin_check"
];
if(!Array.isArray(cost?.requireBeforePaidService)||
   requiredEvidence.some(x=>!cost.requireBeforePaidService.includes(x)))
 failures.push("paid supplier approval is missing cost, security or exit evidence");

const inter=p.numberingAndInterconnection;
if(!inter||inter.own089Block!=="requires_explicit_arcep_allocation"||
   inter.currentExternalNetworkMode!=="wholesale_partner_not_contracted"||
   inter.directInterconnectionRequiresOperatorContracts!==true||
   inter.originNetworkReachabilityNeverAssumed!==true||
   inter.collectionAndSettlementNeverAssumed!==true||
   !Array.isArray(inter.candidateNetworkModes)||
   !["wholesale_partner","owned_sip_with_wholesale_collection",
     "direct_bilateral_interconnection"].every(x=>inter.candidateNetworkModes.includes(x)))
 failures.push("network alternatives must remain contract-gated and not presumed active");

if(failures.length){
  failures.forEach(x=>console.error("FAIL:",x));
  process.exit(1);
}
console.log("Dependency sovereignty policy: OK");

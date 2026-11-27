import test from "node:test";
import assert from "node:assert/strict";
import {
  assessDirectSvaIndependence2028,
  DIRECT_SVA_2028_DATE,
  DIRECT_SVA_INDEPENDENCE_EVIDENCE_KEYS
} from "../backend/src/direct-sva-independence-2028.mjs";

const now=new Date("2026-11-27T12:00:00.000Z");
const base={target_launch_date:"2028-07-01",plans_ported_numbers:true};
const reference=issuer=>({
  status:"verified",issuer,reference:"DOCUMENT-EVIDENCE-2026-001",
  verified_at:"2026-11-26T10:00:00Z",expires_at:"2029-01-01T00:00:00Z"
});
test("no evidence means no carrier activation, payouts or regulatory approval",()=>{
  const x=assessDirectSvaIndependence2028(base,now);
  assert.equal(x.documentary_review_candidate,false);
  assert.equal(x.production_activation_allowed,false);
  assert.equal(x.payment_execution_allowed,false);
  assert.equal(x.database_or_site_changed,false);
  assert.ok(x.blockers.includes("arcep_number_attribution"));
  assert.ok(x.blockers.includes("arcep_routing_prefix"));
  assert.equal(DIRECT_SVA_2028_DATE,"2028-07-01");
});
test("ported numbers require own routing prefix for the 2028 target",()=>{
  const x=assessDirectSvaIndependence2028(base,now);
  assert.equal(x.own_routing_prefix_needed_for_target,true);
  const y=assessDirectSvaIndependence2028({...base,plans_ported_numbers:false},now);
  assert.equal(y.own_routing_prefix_needed_for_target,false);
  assert.ok(!y.blockers.includes("arcep_routing_prefix"));
  const z=assessDirectSvaIndependence2028({...base,target_launch_date:"2027-07-01"},now);
  assert.ok(z.warnings.includes("prepare_own_routing_prefix_for_2028"));
});
test("legacy number loans are a separate 2028 migration issue",()=>{
  const later=assessDirectSvaIndependence2028({...base,uses_pre2018_number_loan:true},now);
  assert.ok(later.blockers.includes("legacy_number_loan_must_end"));
  const earlier=assessDirectSvaIndependence2028({...base,uses_pre2018_number_loan:true,target_launch_date:"2027-12-01"},now);
  assert.ok(!earlier.blockers.includes("legacy_number_loan_must_end"));
  assert.ok(earlier.warnings.includes("legacy_number_loan_to_migrate_before_2028"));
});
test("false, future, expired or wrong-issuer evidence cannot satisfy a gate",()=>{
  for (const bad of [
    {...reference("pgi")},
    {...reference("arcep"),verified_at:"2027-11-26T10:00:00Z"},
    {...reference("arcep"),expires_at:"2026-11-27T11:00:00Z"},
    {...reference("arcep"),reference:""}
  ]) {
    const x=assessDirectSvaIndependence2028({...base,evidence:{arcep_number_attribution:bad}},now);
    assert.ok(x.blockers.includes("arcep_number_attribution"));
  }
});
test("documentary completion still never gives technical or payment authority",()=>{
  const issuers={
    legal_operator_role:"legal_reviewer",customer_contract_control:"pgi",
    arcep_number_attribution:"arcep",national_sva_collection:"carrier",
    carrier_cdr_access:"carrier",carrier_exit_plan:"carrier",
    portability_process:"apnf",publisher_compliance:"pgi",
    financial_legal_review:"legal_reviewer",regulated_payment_chain:"psp",
    publisher_direct_iban:"psp",owner_data_export:"pgi",
    security_review:"security_reviewer",pricing_and_tax_review:"accountant",
    arcep_routing_prefix:"arcep"
  };
  assert.ok(DIRECT_SVA_INDEPENDENCE_EVIDENCE_KEYS.includes("arcep_routing_prefix"));
  const evidence=Object.fromEntries(Object.entries(issuers).map(([k,v])=>[k,reference(v)]));
  const x=assessDirectSvaIndependence2028({...base,evidence},now);
  assert.equal(x.documentary_review_candidate,true);
  assert.equal(x.verified_by_external_authority,false);
  assert.equal(x.production_activation_allowed,false);
  assert.equal(x.call_routing_change_allowed,false);
  assert.equal(x.payment_execution_allowed,false);
  assert.ok(!JSON.stringify(x).includes("DOCUMENT-EVIDENCE-2026-001"));
});
test("invalid dates and unknown ported-number scope are rejected",()=>{
  assert.throws(()=>assessDirectSvaIndependence2028({target_launch_date:"2028-02-31",plans_ported_numbers:true},now),TypeError);
  assert.throws(()=>assessDirectSvaIndependence2028({target_launch_date:"2028-07-01"},now),TypeError);
  assert.throws(()=>assessDirectSvaIndependence2028(base,"not-a-date"),TypeError);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const billing=fs.readFileSync("assets/client-billing.js","utf8");
const relations=fs.readFileSync("assets/client-relations.js","utf8");
const server=fs.readFileSync("backend/server.mjs","utf8");
const store=fs.readFileSync("backend/src/store-postgres.mjs","utf8");

test("onboarding explains the free calendar month instead of immediate payment",()=>{
  assert.match(billing,/mois civil de souscription est offert/);
  assert.doesNotMatch(billing,/la première période est payée maintenant/);
  assert.match(billing,/premier prélèvement payant à la date confirmée par Stripe/);
});
test("Stripe checkout return is not claimed to be proof of payment",()=>{
  assert.match(billing,/Demande d’abonnement reçue par Stripe/);
  assert.doesNotMatch(billing,/Paiement reçu par Stripe/);
});
test("customer departure does not falsely promise a carrier request",()=>{
  assert.match(relations,/liaison opérateur le permettent/);
  assert.match(relations,/Aucun numéro ne sera libéré sur la seule base de cette demande/);
});
test("HubSpot client is not marked lost on an exit request",()=>{
  const route=server.split('if(method==="POST"&&pathname==="/api/v1/customer/relations/exits")')[1]?.split("match=routeMatch(pathname,")[0]||"";
  assert.match(route,/store\.createCustomerExitRequest/);
  assert.doesNotMatch(route,/syncHubSpotTenantLifecycle/);
});
test("recording a relation response does not misstate external email delivery",()=>{
  assert.match(store,/actionResult=\{message_recorded:true,customer_visible:true,external_delivery_confirmed:false\}/);
  assert.doesNotMatch(store,/actionResult=\{message_sent:true,customer_visible:true\}/);
});
test("irreversible access closure is guarded by business proofs",()=>{
  for(const code of [
    "EXIT_FINALIZATION_NOT_AUTHORIZED","EXIT_FINAL_INVOICE_UNCONFIRMED",
    "EXIT_FINAL_SETTLEMENT_UNCONFIRMED","EXIT_DATA_EXPORT_NOT_DELIVERED",
    "EXIT_NUMBERS_NOT_EXTERNALLY_CONFIRMED","EXIT_STRIPE_SUBSCRIPTION_STILL_ACTIVE"
  ])assert.ok(store.includes(code),code);
  assert.match(store,/FROM tenant_exit_lines WHERE exit_request_id=\$1/);
  assert.match(store,/status<>'completed'/);
});

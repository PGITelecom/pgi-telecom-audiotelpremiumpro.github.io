import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveCustomerPortalPresentation,CUSTOMER_PORTAL_PRESENTATION_CONTRACT} from '../backend/src/customer-portal-adaptability.mjs';
const base=()=>({schema_version:CUSTOMER_PORTAL_PRESENTATION_CONTRACT,business_unit:'audiotel_platform',revision:1,principal:{authenticated:true,tenant_scope_verified:true,membership_verified:true,business_unit:'audiotel_platform',permissions:['overview.read','finance.read']},capabilities:{overview:{enabled:true,state:'available',source:'server_verified'},billing:{enabled:true,state:'available',source:'browser'}}});
test('customer view only displays permissions that server attested',()=>{
 const s=resolveCustomerPortalPresentation(base());
 assert.equal(s.status,'display_only');
 assert.equal(s.modules.find(x=>x.key==='overview').visible,true);
 assert.equal(s.modules.find(x=>x.key==='billing').visible,false);
 assert.equal(s.any_write_authorized,false);
 assert.equal(s.number_activation_authorized,false);
 assert.equal(s.payout_authorized,false);
});
test('cross-business access fails closed',()=>{
 const x=base();x.principal.business_unit='direct_sva';
 const s=resolveCustomerPortalPresentation(x);
 assert.equal(s.status,'blocked');assert.equal(s.reason,'CROSS_BUSINESS_CONTEXT');
});
test('publication of Pôle information never unlocks its client space',()=>{
 const x=base();x.business_unit='direct_sva';x.principal.business_unit='direct_sva';
 x.release={public_content_authorized:true,navigation_enabled:true,commercial_operation_enabled:false,customer_portal_enabled:false,operator_mode:'preparation'};
 x.enrollment={business_unit:'direct_sva',access_state:'preparation',dashboard_enabled:false,client_contract_accepted:false};
 const s=resolveCustomerPortalPresentation(x);
 assert.equal(s.status,'blocked');assert.equal(s.reason,'DIRECT_SVA_NOT_RELEASED');
});

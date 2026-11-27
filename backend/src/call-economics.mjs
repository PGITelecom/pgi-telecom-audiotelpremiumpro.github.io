// Recorded call-level economics for the Audiotel platform, not the direct-SVA pole.
// Do not extrapolate missing allocations or treat a recorded fee as bank cash.
function fail(code,status=400){const e=new Error(code);e.code=code;e.status=status;throw e;}
export const CALL_ECONOMICS_SQL=`
WITH scoped AS MATERIALIZED (
 SELECT c.id,c.tenant_id,c.market_id,c.sva_number_id,c.host_carrier_id,c.call_destination_id,
        c.payout_eligible_seconds,c.technical_cost_ht,c.expert_cost_ht
 FROM calls c JOIN tenants t ON t.id=c.tenant_id
 WHERE t.tenant_type<>'internal' AND c.currency='EUR' AND c.call_status='connected'
   AND c.started_at >= $1::timestamptz AND c.started_at < $2::timestamptz
 ORDER BY c.started_at,c.id LIMIT 10001
), allocated AS (
 SELECT s.*,a.n AS allocation_count,a.fee,a.eligible
 FROM scoped s
 LEFT JOIN LATERAL (
  SELECT count(*) AS n,max(rc.platform_fee_ht) AS fee,
   bool_and(d.tenant_id=s.tenant_id AND d.currency='EUR' AND d.market_id=s.market_id
     AND d.status IN ('reconciled','payable','paid')
     AND rc.payout_terms_id IS NOT NULL AND rc.unallocated_amount_ht=0) AS eligible
  FROM tenant_revenue_distribution_calls rc JOIN tenant_revenue_distributions d ON d.id=rc.tenant_distribution_id
  WHERE rc.call_id=s.id
 ) a ON true
), evaluated AS (
 SELECT *,
  CASE WHEN allocation_count=1 AND eligible IS TRUE AND payout_eligible_seconds>0
    AND technical_cost_ht IS NOT NULL AND technical_cost_ht>=0 AND expert_cost_ht IS NOT NULL AND expert_cost_ht>=0
    THEN fee-technical_cost_ht-expert_cost_ht ELSE NULL END AS contribution
 FROM allocated
), grouped AS (
 SELECT e.sva_number_id,e.host_carrier_id,e.call_destination_id,
  count(*)::int AS calls,count(contribution)::int AS evaluable_calls,
  count(*) FILTER(WHERE allocation_count=0)::int AS missing_allocations,
  count(*) FILTER(WHERE allocation_count>1)::int AS multiple_allocations,
  count(*) FILTER(WHERE contribution<0)::int AS negative_contribution_calls,
  sum(payout_eligible_seconds) FILTER(WHERE contribution IS NOT NULL) AS eligible_seconds,
  sum(fee) FILTER(WHERE contribution IS NOT NULL) AS recorded_fee_ht,
  sum(technical_cost_ht) FILTER(WHERE contribution IS NOT NULL) AS recorded_technical_cost_ht,
  sum(expert_cost_ht) FILTER(WHERE contribution IS NOT NULL) AS recorded_expert_cost_ht,
  sum(contribution) AS contribution_ht
 FROM evaluated e GROUP BY e.sva_number_id,e.host_carrier_id,e.call_destination_id
)
SELECT (SELECT count(*)::int FROM scoped) AS scoped_calls,
       (SELECT count(*)::int FROM grouped) AS total_groups,
       COALESCE((SELECT jsonb_agg(to_jsonb(g)) FROM (
        SELECT g.sva_number_id::text,s.display_number,g.host_carrier_id::text,c.name AS carrier_name,
         g.call_destination_id::text,d.destination_type,g.calls,g.evaluable_calls,g.missing_allocations,
         g.multiple_allocations,g.negative_contribution_calls,g.eligible_seconds::text,
         g.recorded_fee_ht::text,g.recorded_technical_cost_ht::text,g.recorded_expert_cost_ht::text,
         g.contribution_ht::text,
         CASE WHEN g.eligible_seconds>0 THEN round(g.contribution_ht*60/g.eligible_seconds,6)::text END AS contribution_ht_per_eligible_minute
        FROM grouped g LEFT JOIN sva_numbers s ON s.id=g.sva_number_id
        LEFT JOIN carriers c ON c.id=g.host_carrier_id
        LEFT JOIN tenant_call_destinations d ON d.id=g.call_destination_id
        ORDER BY g.contribution_ht ASC NULLS FIRST,g.sva_number_id,g.host_carrier_id,g.call_destination_id
        LIMIT 100
       ) g),'[]'::jsonb) AS groups
`;
function utc(value){
 if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value))fail("CALL_ECONOMICS_INVALID_WINDOW");
 const d=new Date(value);
 if(!Number.isFinite(d.getTime())||d.toISOString()!==value.replace("Z",".000Z"))fail("CALL_ECONOMICS_INVALID_WINDOW");
 return d;
}
export async function callEconomicsSnapshot(store,input={},now=new Date()){
 if(input?.business_unit!=="audiotel_platform"||input.currency!=="EUR")fail("CALL_ECONOMICS_INVALID_SCOPE");
 const end=utc(input.to_utc),start=utc(input.from_utc);
 if(end<=start||end-start>31*86400000||end>now)fail("CALL_ECONOMICS_INVALID_WINDOW");
 if(typeof store?.sql?.unsafe!=="function")fail("CALL_ECONOMICS_POSTGRES_REQUIRED",503);
 const [row]=await store.sql.unsafe(CALL_ECONOMICS_SQL,[start.toISOString(),end.toISOString()]);
 if(!row||!Number.isInteger(row.scoped_calls)||!Array.isArray(row.groups))fail("CALL_ECONOMICS_UNAVAILABLE",503);
 if(row.scoped_calls>10000)fail("CALL_ECONOMICS_SPLIT_WINDOW_REQUIRED");
 return {schema_version:"pgi-recorded-call-economics/1",currency:"EUR",from_utc:start.toISOString(),to_utc:end.toISOString(),
  scoped_calls:row.scoped_calls,total_groups:row.total_groups,group_limit:100,groups_truncated:row.total_groups>100,
  groups:row.groups,accounting_basis:"allocated_platform_fee_minus_recorded_technical_and_expert_costs",
  excludes:["general_overhead","tax","unrecorded_costs","direct_settlement_without_call_allocation"],
  bank_receipts_verified:false,cost_completeness_verified:false,contract_evidence_independently_verified:false,
  automatic_tariff_change_authorized:false,routing_change_authorized:false,payout_authorized:false};
}

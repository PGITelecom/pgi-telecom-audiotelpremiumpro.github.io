// Aggregate-only quality and abuse review; not a fraud accusation or blocking engine.
function fail(code){const e=new Error(code);e.code=code;e.status=400;throw e;}
function n(v,k,min,max){if(typeof v!=="number"||!Number.isFinite(v)||v<min||v>max)fail("VOICE_RISK_INVALID_"+k);return v;}
function count(v,k,max=100000000){if(!Number.isSafeInteger(v))fail("VOICE_RISK_INVALID_"+k);return n(v,k,0,max);}
export function assessVoiceRisk(input={}){
 if(input?.business_unit!=="audiotel_platform")fail("VOICE_RISK_SCOPE");
 const calls=count(input.calls,"CALLS"),failed=count(input.failed_calls,"FAILED",calls);
 const connected=count(input.connected_calls,"CONNECTED",calls);
 if(connected+failed>calls)fail("VOICE_RISK_INCONSISTENT_COUNTS");
 const sample=count(input.quality_samples,"SAMPLES",connected);
 const low=count(input.low_mos_samples,"LOW_MOS",sample);
 const last=count(input.calls_last_hour,"LAST_HOUR",calls);
 const baseline=n(input.baseline_hourly_calls,"BASELINE",0,100000000);
 const alerts=[];
 if(calls>=20&&failed/calls>=0.2)alerts.push({code:"high_failure_rate",observed:failed/calls});
 if(sample>=20&&low/sample>=0.1)alerts.push({code:"low_mos_share",observed:low/sample});
 if(last>=20&&baseline>=5&&last/baseline>=4)alerts.push({code:"traffic_surge_review",observed:last/baseline});
 if(last>=20&&baseline<5)alerts.push({code:"traffic_baseline_insufficient",observed:last});
 if(connected>=20&&sample/connected<0.5)alerts.push({code:"quality_coverage_insufficient",observed:sample/connected});
 return {schema_version:"pgi-voice-risk-review/1",alerts,status:alerts.length?"review_required":calls<20?"insufficient_sample":"no_signal_in_supplied_metrics",
  source_verified:false,fraud_confirmed:false,automatic_block_authorized:false,routing_change_authorized:false,payout_authorized:false};
}


// Observe the canonical calls and measured MOS directly, rather than treating
// an unknown sample as good quality. Bound the raw read before aggregation.
export const VOICE_RISK_SQL=`
WITH scoped AS MATERIALIZED (
 SELECT c.id,c.host_carrier_id,c.started_at,c.call_status
 FROM calls c JOIN tenants t ON t.id=c.tenant_id
 WHERE t.tenant_type<>'internal' AND c.started_at >= $1::timestamptz AND c.started_at < $2::timestamptz
 ORDER BY c.started_at,c.id LIMIT 10001
), grouped AS (
 SELECT s.host_carrier_id,c.name AS carrier_name,
 count(*)::int AS calls,
 count(*) FILTER(WHERE s.call_status='connected')::int AS connected_calls,
 count(*) FILTER(WHERE s.call_status NOT IN ('connected','abandoned'))::int AS failed_calls,
 count(*) FILTER(WHERE s.call_status='connected' AND q.mos IS NOT NULL)::int AS quality_samples,
 count(*) FILTER(WHERE s.call_status='connected' AND q.mos<3.5)::int AS low_mos_samples,
 count(*) FILTER(WHERE s.started_at >= $2::timestamptz-interval '1 hour')::int AS calls_last_hour,
 (count(*) FILTER(WHERE s.started_at < $2::timestamptz-interval '1 hour')::numeric/167)::float8 AS baseline_hourly_calls
 FROM scoped s LEFT JOIN call_quality q ON q.call_id=s.id
 LEFT JOIN carriers c ON c.id=s.host_carrier_id GROUP BY s.host_carrier_id,c.name
)
SELECT (SELECT count(*)::int FROM scoped) AS scoped_calls,
 (SELECT count(*)::int FROM grouped) AS total_groups,
 COALESCE((SELECT jsonb_agg(to_jsonb(g)) FROM (
 SELECT host_carrier_id::text,carrier_name,calls,connected_calls,failed_calls,quality_samples,
 low_mos_samples,calls_last_hour,baseline_hourly_calls FROM grouped ORDER BY calls DESC,host_carrier_id LIMIT 100
 ) g),'[]'::jsonb) AS groups
`;
export async function voiceRiskSnapshot(store,now=new Date()){
 if(typeof store?.sql?.unsafe!=="function"){const e=new Error("VOICE_RISK_POSTGRES_REQUIRED");e.code=e.message;e.status=503;throw e;}
 const end=new Date(now);end.setUTCMinutes(0,0,0);
 if(!Number.isFinite(end.getTime()))fail("VOICE_RISK_INVALID_TIME");
 const start=new Date(end.getTime()-168*3600000);
 const [row]=await store.sql.unsafe(VOICE_RISK_SQL,[start.toISOString(),end.toISOString()]);
 if(!row||!Number.isInteger(row.scoped_calls)||!Array.isArray(row.groups))fail("VOICE_RISK_DATA_UNAVAILABLE");
 if(row.scoped_calls>10000)return {schema_version:"pgi-recorded-voice-risk/1",status:"volume_limit_reached",scoped_calls_at_least:10001,groups:[],automatic_block_authorized:false};
 return {schema_version:"pgi-recorded-voice-risk/1",status:row.scoped_calls?"review":"no_recorded_calls",
  from_utc:start.toISOString(),to_utc:end.toISOString(),scoped_calls:row.scoped_calls,total_groups:row.total_groups,groups_truncated:row.total_groups>100,
  groups:row.groups.map(g=>({host_carrier_id:g.host_carrier_id,carrier_name:g.carrier_name,metrics:{calls:g.calls,connected_calls:g.connected_calls,failed_calls:g.failed_calls,quality_samples:g.quality_samples},...assessVoiceRisk({...g,business_unit:"audiotel_platform"})})),
  source:"recorded_pgi_cdr_and_mos",network_evidence_independently_verified:false,automatic_block_authorized:false};
}

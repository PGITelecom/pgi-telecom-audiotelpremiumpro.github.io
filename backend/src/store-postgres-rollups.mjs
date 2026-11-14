// PostgreSQL rollup writers for call analytics and quality metrics.
// Extracted without modifying SQL statements or transaction boundaries.

export async function writeExperienceRollup(tx,callId){
  await tx.unsafe(
    "INSERT INTO experience_rollups_hourly_sharded("+
    " bucket_start,market_id,rollup_shard,calls_total,calls_connected,calls_abandoned,wait_seconds_sum,"+
    " wait_connected_seconds_sum,wait_abandoned_seconds_sum,answered_le_20s,abandoned_le_10s,ivr_seconds_sum,ivr_samples,"+
    " queue_seconds_sum,queue_samples,wait_le_10s,wait_10_20s,wait_20_30s,wait_30_60s,wait_60_120s,wait_gt_120s)"+
    " SELECT date_trunc('hour',c.started_at),c.market_id,(c.tenant_bucket%64)::smallint,1,"+
    " (c.call_status='connected')::int,(c.call_status='abandoned')::int,c.wait_seconds,"+
    " CASE WHEN c.call_status='connected' THEN c.wait_seconds ELSE 0 END,"+
    " CASE WHEN c.call_status='abandoned' THEN c.wait_seconds ELSE 0 END,"+
    " (c.call_status='connected' AND c.wait_seconds<=20)::int,(c.call_status='abandoned' AND c.wait_seconds<=10)::int,"+
    " CASE WHEN c.queued_at IS NOT NULL AND c.ivr_started_at IS NOT NULL THEN GREATEST(0,EXTRACT(EPOCH FROM (c.queued_at-c.ivr_started_at)))::bigint ELSE 0 END,"+
    " (c.queued_at IS NOT NULL AND c.ivr_started_at IS NOT NULL)::int,"+
    " CASE WHEN c.queued_at IS NOT NULL THEN GREATEST(0,EXTRACT(EPOCH FROM (COALESCE(c.bridged_at,c.ended_at)-c.queued_at)))::bigint ELSE 0 END,"+
    " (c.queued_at IS NOT NULL)::int,(c.wait_seconds<=10)::int,(c.wait_seconds>10 AND c.wait_seconds<=20)::int,"+
    " (c.wait_seconds>20 AND c.wait_seconds<=30)::int,(c.wait_seconds>30 AND c.wait_seconds<=60)::int,"+
    " (c.wait_seconds>60 AND c.wait_seconds<=120)::int,(c.wait_seconds>120)::int"+
    " FROM calls c WHERE c.id=$1 AND c.market_id IS NOT NULL"+
    " ON CONFLICT(bucket_start,market_id,rollup_shard) DO UPDATE SET"+
    " calls_total=experience_rollups_hourly_sharded.calls_total+1,"+
    " calls_connected=experience_rollups_hourly_sharded.calls_connected+EXCLUDED.calls_connected,"+
    " calls_abandoned=experience_rollups_hourly_sharded.calls_abandoned+EXCLUDED.calls_abandoned,"+
    " wait_seconds_sum=experience_rollups_hourly_sharded.wait_seconds_sum+EXCLUDED.wait_seconds_sum,"+
    " wait_connected_seconds_sum=experience_rollups_hourly_sharded.wait_connected_seconds_sum+EXCLUDED.wait_connected_seconds_sum,"+
    " wait_abandoned_seconds_sum=experience_rollups_hourly_sharded.wait_abandoned_seconds_sum+EXCLUDED.wait_abandoned_seconds_sum,"+
    " answered_le_20s=experience_rollups_hourly_sharded.answered_le_20s+EXCLUDED.answered_le_20s,"+
    " abandoned_le_10s=experience_rollups_hourly_sharded.abandoned_le_10s+EXCLUDED.abandoned_le_10s,"+
    " ivr_seconds_sum=experience_rollups_hourly_sharded.ivr_seconds_sum+EXCLUDED.ivr_seconds_sum,"+
    " ivr_samples=experience_rollups_hourly_sharded.ivr_samples+EXCLUDED.ivr_samples,"+
    " queue_seconds_sum=experience_rollups_hourly_sharded.queue_seconds_sum+EXCLUDED.queue_seconds_sum,"+
    " queue_samples=experience_rollups_hourly_sharded.queue_samples+EXCLUDED.queue_samples,"+
    " wait_le_10s=experience_rollups_hourly_sharded.wait_le_10s+EXCLUDED.wait_le_10s,"+
    " wait_10_20s=experience_rollups_hourly_sharded.wait_10_20s+EXCLUDED.wait_10_20s,"+
    " wait_20_30s=experience_rollups_hourly_sharded.wait_20_30s+EXCLUDED.wait_20_30s,"+
    " wait_30_60s=experience_rollups_hourly_sharded.wait_30_60s+EXCLUDED.wait_30_60s,"+
    " wait_60_120s=experience_rollups_hourly_sharded.wait_60_120s+EXCLUDED.wait_60_120s,"+
    " wait_gt_120s=experience_rollups_hourly_sharded.wait_gt_120s+EXCLUDED.wait_gt_120s,updated_at=now()",
    [callId]
  );
}

export async function writeTenantDailyRollup(tx,callId){
  await tx.unsafe(
    "INSERT INTO metric_rollups_daily_v2("+
    " tenant_bucket,bucket_date,tenant_id,market_id,currency,calls_total,calls_connected,calls_abandoned,calls_failed,"+
    " conversation_seconds,billable_seconds,payout_eligible_seconds,generated_revenue_ttc,expected_payout_ht,confirmed_payout_ht,"+
    " paid_payout_ht,expert_cost_ht,technical_cost_ht,estimated_margin_ht,reconciliation_variance_ht,source_generation)"+
    " SELECT f.tenant_bucket,f.started_at::date,f.tenant_id,f.market_id,f.currency,1,"+
    " (f.call_status='connected')::int,(f.call_status='abandoned')::int,(f.call_status NOT IN ('connected','abandoned'))::int,"+
    " f.conversation_seconds,f.billable_seconds,f.payout_eligible_seconds,f.retail_service_amount_ttc,f.expected_payout_ht,"+
    " f.confirmed_payout_ht,f.paid_payout_ht,f.expert_cost_ht,f.technical_cost_ht,f.estimated_margin_ht,f.reconciliation_variance_ht,1"+
    " FROM call_facts f WHERE f.call_id=$1 AND f.tenant_id IS NOT NULL AND f.market_id IS NOT NULL"+
    " ON CONFLICT(tenant_bucket,bucket_date,tenant_id,market_id,currency) DO UPDATE SET"+
    " calls_total=metric_rollups_daily_v2.calls_total+1,"+
    " calls_connected=metric_rollups_daily_v2.calls_connected+EXCLUDED.calls_connected,"+
    " calls_abandoned=metric_rollups_daily_v2.calls_abandoned+EXCLUDED.calls_abandoned,"+
    " calls_failed=metric_rollups_daily_v2.calls_failed+EXCLUDED.calls_failed,"+
    " conversation_seconds=metric_rollups_daily_v2.conversation_seconds+EXCLUDED.conversation_seconds,"+
    " billable_seconds=metric_rollups_daily_v2.billable_seconds+EXCLUDED.billable_seconds,"+
    " payout_eligible_seconds=metric_rollups_daily_v2.payout_eligible_seconds+EXCLUDED.payout_eligible_seconds,"+
    " generated_revenue_ttc=metric_rollups_daily_v2.generated_revenue_ttc+EXCLUDED.generated_revenue_ttc,"+
    " expected_payout_ht=metric_rollups_daily_v2.expected_payout_ht+EXCLUDED.expected_payout_ht,"+
    " confirmed_payout_ht=metric_rollups_daily_v2.confirmed_payout_ht+EXCLUDED.confirmed_payout_ht,"+
    " paid_payout_ht=metric_rollups_daily_v2.paid_payout_ht+EXCLUDED.paid_payout_ht,"+
    " expert_cost_ht=metric_rollups_daily_v2.expert_cost_ht+EXCLUDED.expert_cost_ht,"+
    " technical_cost_ht=metric_rollups_daily_v2.technical_cost_ht+EXCLUDED.technical_cost_ht,"+
    " estimated_margin_ht=metric_rollups_daily_v2.estimated_margin_ht+EXCLUDED.estimated_margin_ht,"+
    " reconciliation_variance_ht=metric_rollups_daily_v2.reconciliation_variance_ht+EXCLUDED.reconciliation_variance_ht,"+
    " source_generation=metric_rollups_daily_v2.source_generation+1,updated_at=now()",
    [callId]
  );
}

export async function writeVoiceCarrierHealthRollup(tx,callId){
  await tx.unsafe(
    "INSERT INTO voice_carrier_health_hourly_sharded("+
    " bucket_start,market_id,carrier_role,carrier_id,rollup_shard,calls_total,calls_connected,calls_failed,pdd_samples,pdd_ms_sum,high_pdd_calls,"+
    " quality_samples,network_affected_calls,low_mos_calls,mos_sum,packet_loss_sum,jitter_ms_sum,latency_ms_sum,rtt_ms_sum,"+
    " sip_4xx_calls,sip_5xx_calls,caller_hangups,callee_hangups,network_hangups)"+
    " SELECT date_trunc('hour',c.started_at),c.market_id,r.carrier_role,r.carrier_id,(c.tenant_bucket%64)::smallint,1,"+
    " (c.call_status='connected')::int,(c.call_status NOT IN ('connected','abandoned'))::int,"+
    " (c.post_dial_delay_ms IS NOT NULL)::int,COALESCE(c.post_dial_delay_ms,0),(COALESCE(c.post_dial_delay_ms,0)>8000)::int,"+
    " (q.call_id IS NOT NULL)::int,"+
    " (q.call_id IS NOT NULL AND (COALESCE(q.rtp_packet_loss_percent,0)>=5 OR COALESCE(q.jitter_ms,0)>5 OR COALESCE(q.latency_ms,0)>150))::int,"+
    " (q.call_id IS NOT NULL AND q.mos IS NOT NULL AND q.mos<3.5)::int,"+
    " COALESCE(q.mos,0),COALESCE(q.rtp_packet_loss_percent,0),COALESCE(q.jitter_ms,0),COALESCE(q.latency_ms,0),COALESCE(q.rtt_ms,0),"+
    " (c.sip_final_code BETWEEN 400 AND 499)::int,(c.sip_final_code BETWEEN 500 AND 599)::int,"+
    " (c.hangup_party='caller')::int,(c.hangup_party='callee')::int,(c.hangup_party='network')::int"+
    " FROM calls c LEFT JOIN call_quality q ON q.call_id=c.id"+
    " CROSS JOIN LATERAL (VALUES ('origin'::text,c.origin_carrier_id),('host'::text,c.host_carrier_id)) AS r(carrier_role,carrier_id)"+
    " WHERE c.id=$1 AND c.market_id IS NOT NULL AND r.carrier_id IS NOT NULL"+
    " ON CONFLICT(bucket_start,market_id,carrier_role,carrier_id,rollup_shard) DO UPDATE SET"+
    " calls_total=voice_carrier_health_hourly_sharded.calls_total+1,"+
    " calls_connected=voice_carrier_health_hourly_sharded.calls_connected+EXCLUDED.calls_connected,"+
    " calls_failed=voice_carrier_health_hourly_sharded.calls_failed+EXCLUDED.calls_failed,"+
    " pdd_samples=voice_carrier_health_hourly_sharded.pdd_samples+EXCLUDED.pdd_samples,"+
    " pdd_ms_sum=voice_carrier_health_hourly_sharded.pdd_ms_sum+EXCLUDED.pdd_ms_sum,"+
    " high_pdd_calls=voice_carrier_health_hourly_sharded.high_pdd_calls+EXCLUDED.high_pdd_calls,"+
    " quality_samples=voice_carrier_health_hourly_sharded.quality_samples+EXCLUDED.quality_samples,"+
    " network_affected_calls=voice_carrier_health_hourly_sharded.network_affected_calls+EXCLUDED.network_affected_calls,"+
    " low_mos_calls=voice_carrier_health_hourly_sharded.low_mos_calls+EXCLUDED.low_mos_calls,"+
    " mos_sum=voice_carrier_health_hourly_sharded.mos_sum+EXCLUDED.mos_sum,"+
    " packet_loss_sum=voice_carrier_health_hourly_sharded.packet_loss_sum+EXCLUDED.packet_loss_sum,"+
    " jitter_ms_sum=voice_carrier_health_hourly_sharded.jitter_ms_sum+EXCLUDED.jitter_ms_sum,"+
    " latency_ms_sum=voice_carrier_health_hourly_sharded.latency_ms_sum+EXCLUDED.latency_ms_sum,"+
    " rtt_ms_sum=voice_carrier_health_hourly_sharded.rtt_ms_sum+EXCLUDED.rtt_ms_sum,"+
    " sip_4xx_calls=voice_carrier_health_hourly_sharded.sip_4xx_calls+EXCLUDED.sip_4xx_calls,"+
    " sip_5xx_calls=voice_carrier_health_hourly_sharded.sip_5xx_calls+EXCLUDED.sip_5xx_calls,"+
    " caller_hangups=voice_carrier_health_hourly_sharded.caller_hangups+EXCLUDED.caller_hangups,"+
    " callee_hangups=voice_carrier_health_hourly_sharded.callee_hangups+EXCLUDED.callee_hangups,"+
    " network_hangups=voice_carrier_health_hourly_sharded.network_hangups+EXCLUDED.network_hangups,updated_at=now()",
    [callId]
  );
}

export async function writeTenantVoiceDailyRollup(tx,callId){
  await tx.unsafe(
    "INSERT INTO tenant_voice_daily_sharded("+
    " tenant_bucket,bucket_date,tenant_id,market_id,calls_total,calls_connected,pdd_samples,pdd_ms_sum,high_pdd_calls,"+
    " quality_samples,network_affected_calls,low_mos_calls,mos_sum,packet_loss_sum,jitter_ms_sum,latency_ms_sum,rtt_ms_sum,"+
    " sip_5xx_calls,caller_hangups,callee_hangups,network_hangups)"+
    " SELECT c.tenant_bucket,c.started_at::date,c.tenant_id,c.market_id,1,(c.call_status='connected')::int,"+
    " (c.post_dial_delay_ms IS NOT NULL)::int,COALESCE(c.post_dial_delay_ms,0),(COALESCE(c.post_dial_delay_ms,0)>8000)::int,"+
    " (q.call_id IS NOT NULL)::int,"+
    " (q.call_id IS NOT NULL AND (COALESCE(q.rtp_packet_loss_percent,0)>=5 OR COALESCE(q.jitter_ms,0)>5 OR COALESCE(q.latency_ms,0)>150))::int,"+
    " (q.call_id IS NOT NULL AND q.mos IS NOT NULL AND q.mos<3.5)::int,COALESCE(q.mos,0),COALESCE(q.rtp_packet_loss_percent,0),"+
    " COALESCE(q.jitter_ms,0),COALESCE(q.latency_ms,0),COALESCE(q.rtt_ms,0),(c.sip_final_code BETWEEN 500 AND 599)::int,"+
    " (c.hangup_party='caller')::int,(c.hangup_party='callee')::int,(c.hangup_party='network')::int"+
    " FROM calls c LEFT JOIN call_quality q ON q.call_id=c.id WHERE c.id=$1 AND c.tenant_id IS NOT NULL AND c.market_id IS NOT NULL"+
    " ON CONFLICT(tenant_bucket,bucket_date,tenant_id,market_id) DO UPDATE SET"+
    " calls_total=tenant_voice_daily_sharded.calls_total+1,"+
    " calls_connected=tenant_voice_daily_sharded.calls_connected+EXCLUDED.calls_connected,"+
    " pdd_samples=tenant_voice_daily_sharded.pdd_samples+EXCLUDED.pdd_samples,pdd_ms_sum=tenant_voice_daily_sharded.pdd_ms_sum+EXCLUDED.pdd_ms_sum,"+
    " high_pdd_calls=tenant_voice_daily_sharded.high_pdd_calls+EXCLUDED.high_pdd_calls,"+
    " quality_samples=tenant_voice_daily_sharded.quality_samples+EXCLUDED.quality_samples,"+
    " network_affected_calls=tenant_voice_daily_sharded.network_affected_calls+EXCLUDED.network_affected_calls,"+
    " low_mos_calls=tenant_voice_daily_sharded.low_mos_calls+EXCLUDED.low_mos_calls,"+
    " mos_sum=tenant_voice_daily_sharded.mos_sum+EXCLUDED.mos_sum,packet_loss_sum=tenant_voice_daily_sharded.packet_loss_sum+EXCLUDED.packet_loss_sum,"+
    " jitter_ms_sum=tenant_voice_daily_sharded.jitter_ms_sum+EXCLUDED.jitter_ms_sum,latency_ms_sum=tenant_voice_daily_sharded.latency_ms_sum+EXCLUDED.latency_ms_sum,"+
    " rtt_ms_sum=tenant_voice_daily_sharded.rtt_ms_sum+EXCLUDED.rtt_ms_sum,sip_5xx_calls=tenant_voice_daily_sharded.sip_5xx_calls+EXCLUDED.sip_5xx_calls,"+
    " caller_hangups=tenant_voice_daily_sharded.caller_hangups+EXCLUDED.caller_hangups,callee_hangups=tenant_voice_daily_sharded.callee_hangups+EXCLUDED.callee_hangups,"+
    " network_hangups=tenant_voice_daily_sharded.network_hangups+EXCLUDED.network_hangups,updated_at=now()",
    [callId]
  );
}

export async function writeSipCodeRollup(tx,callId){
  await tx.unsafe(
    "INSERT INTO voice_sip_code_hourly_sharded(bucket_start,market_id,host_carrier_id,sip_final_code,rollup_shard,calls_total)"+
    " SELECT date_trunc('hour',started_at),market_id,host_carrier_id,sip_final_code,(tenant_bucket%64)::smallint,1"+
    " FROM calls WHERE id=$1 AND market_id IS NOT NULL AND host_carrier_id IS NOT NULL AND sip_final_code BETWEEN 100 AND 699"+
    " ON CONFLICT(bucket_start,market_id,host_carrier_id,sip_final_code,rollup_shard) DO UPDATE SET"+
    " calls_total=voice_sip_code_hourly_sharded.calls_total+1,updated_at=now()",
    [callId]
  );
}

export async function writeQualityRollup(tx,callId){
  await tx.unsafe(
    "INSERT INTO quality_rollups_hourly_sharded("+
    " bucket_start,market_id,rollup_shard,quality_samples,mos_sum,packet_loss_sum,jitter_ms_sum,latency_ms_sum,dtmf_errors,affected_samples,low_mos_samples)"+
    " SELECT date_trunc('hour',c.started_at),c.market_id,(c.tenant_bucket%64)::smallint,1,"+
    " COALESCE(q.mos,0),COALESCE(q.rtp_packet_loss_percent,0),COALESCE(q.jitter_ms,0),COALESCE(q.latency_ms,0),COALESCE(q.dtmf_errors,0),"+
    " (COALESCE(q.rtp_packet_loss_percent,0)>=5 OR COALESCE(q.jitter_ms,0)>5 OR COALESCE(q.latency_ms,0)>150)::int,"+
    " (q.mos IS NOT NULL AND q.mos<3.5)::int"+
    " FROM calls c JOIN call_quality q ON q.call_id=c.id"+
    " WHERE c.id=$1 AND c.market_id IS NOT NULL"+
    " ON CONFLICT(bucket_start,market_id,rollup_shard) DO UPDATE SET"+
    " quality_samples=quality_rollups_hourly_sharded.quality_samples+1,"+
    " mos_sum=quality_rollups_hourly_sharded.mos_sum+EXCLUDED.mos_sum,"+
    " packet_loss_sum=quality_rollups_hourly_sharded.packet_loss_sum+EXCLUDED.packet_loss_sum,"+
    " jitter_ms_sum=quality_rollups_hourly_sharded.jitter_ms_sum+EXCLUDED.jitter_ms_sum,"+
    " latency_ms_sum=quality_rollups_hourly_sharded.latency_ms_sum+EXCLUDED.latency_ms_sum,"+
    " dtmf_errors=quality_rollups_hourly_sharded.dtmf_errors+EXCLUDED.dtmf_errors,"+
    " affected_samples=quality_rollups_hourly_sharded.affected_samples+EXCLUDED.affected_samples,"+
    " low_mos_samples=quality_rollups_hourly_sharded.low_mos_samples+EXCLUDED.low_mos_samples,updated_at=now()",
    [callId]
  );
}

export async function writeDashboardDimensionRollups(tx,callId){
  const common=
    " INSERT INTO dashboard_dimension_rollups_daily("+
    " bucket_date,market_id,currency,dimension_type,dimension_key,dimension_label,calls_total,calls_connected,"+
    " conversation_seconds,billable_seconds,generated_revenue_ttc,expected_payout_ht,estimated_margin_ht) ";
  const conflict=
    " ON CONFLICT(bucket_date,market_id,currency,dimension_type,dimension_key) DO UPDATE SET"+
    " dimension_label=EXCLUDED.dimension_label,"+
    " calls_total=dashboard_dimension_rollups_daily.calls_total+EXCLUDED.calls_total,"+
    " calls_connected=dashboard_dimension_rollups_daily.calls_connected+EXCLUDED.calls_connected,"+
    " conversation_seconds=dashboard_dimension_rollups_daily.conversation_seconds+EXCLUDED.conversation_seconds,"+
    " billable_seconds=dashboard_dimension_rollups_daily.billable_seconds+EXCLUDED.billable_seconds,"+
    " generated_revenue_ttc=dashboard_dimension_rollups_daily.generated_revenue_ttc+EXCLUDED.generated_revenue_ttc,"+
    " expected_payout_ht=dashboard_dimension_rollups_daily.expected_payout_ht+EXCLUDED.expected_payout_ht,"+
    " estimated_margin_ht=dashboard_dimension_rollups_daily.estimated_margin_ht+EXCLUDED.estimated_margin_ht,updated_at=now()";

  await tx.unsafe(
    common+
    " SELECT f.started_at::date,f.market_id,f.currency,'expert',COALESCE(f.expert_id::text,'unassigned'),"+
    " COALESCE(e.display_name,'Non affecté'),1,(f.call_status='connected')::int,f.conversation_seconds,f.billable_seconds,"+
    " f.retail_service_amount_ttc,f.expected_payout_ht,f.estimated_margin_ht"+
    " FROM call_facts f LEFT JOIN experts e ON e.id=f.expert_id WHERE f.call_id=$1 AND f.market_id IS NOT NULL"+
    conflict,[callId]
  );
  await tx.unsafe(
    common+
    " SELECT f.started_at::date,f.market_id,f.currency,'carrier',COALESCE(f.origin_carrier_id::text,'unknown'),"+
    " COALESCE(c.name,'Inconnu'),1,(f.call_status='connected')::int,f.conversation_seconds,f.billable_seconds,"+
    " f.retail_service_amount_ttc,f.expected_payout_ht,f.estimated_margin_ht"+
    " FROM call_facts f LEFT JOIN carriers c ON c.id=f.origin_carrier_id WHERE f.call_id=$1 AND f.market_id IS NOT NULL"+
    conflict,[callId]
  );
  await tx.unsafe(
    common+
    " SELECT f.started_at::date,f.market_id,f.currency,'duration',"+
    " CASE WHEN f.call_status<>'connected' THEN 'not_connected' WHEN f.conversation_seconds<60 THEN 'lt_1m'"+
    " WHEN f.conversation_seconds<300 THEN '1_5m' WHEN f.conversation_seconds<600 THEN '5_10m'"+
    " WHEN f.conversation_seconds<1200 THEN '10_20m' WHEN f.conversation_seconds<1800 THEN '20_30m' ELSE 'gte_30m' END,"+
    " CASE WHEN f.call_status<>'connected' THEN 'Non aboutis' WHEN f.conversation_seconds<60 THEN '< 1 min'"+
    " WHEN f.conversation_seconds<300 THEN '1–5 min' WHEN f.conversation_seconds<600 THEN '5–10 min'"+
    " WHEN f.conversation_seconds<1200 THEN '10–20 min' WHEN f.conversation_seconds<1800 THEN '20–30 min' ELSE '30 min +' END,"+
    " 1,(f.call_status='connected')::int,f.conversation_seconds,f.billable_seconds,"+
    " f.retail_service_amount_ttc,f.expected_payout_ht,f.estimated_margin_ht"+
    " FROM call_facts f WHERE f.call_id=$1 AND f.market_id IS NOT NULL"+
    conflict,[callId]
  );
}

export async function writeHourlyRollup(tx,callId){
  await tx.unsafe(
    "INSERT INTO platform_rollups_hourly_sharded("+
    " bucket_start,market_id,currency,rollup_shard,calls_total,calls_connected,calls_abandoned,calls_failed,"+
    " conversation_seconds,billable_seconds,payout_eligible_seconds,generated_revenue_ttc,expected_payout_ht,"+
    " confirmed_payout_ht,paid_payout_ht,expert_cost_ht,technical_cost_ht,estimated_margin_ht,reconciliation_variance_ht)"+
    " SELECT date_trunc('hour',f.started_at),f.market_id,f.currency,(f.tenant_bucket%64)::smallint,1,"+
    " (f.call_status='connected')::int,(f.call_status='abandoned')::int,"+
    " (f.call_status NOT IN ('connected','abandoned'))::int,f.conversation_seconds,f.billable_seconds,"+
    " f.payout_eligible_seconds,f.retail_service_amount_ttc,f.expected_payout_ht,f.confirmed_payout_ht,f.paid_payout_ht,"+
    " f.expert_cost_ht,f.technical_cost_ht,f.estimated_margin_ht,f.reconciliation_variance_ht"+
    " FROM call_facts f WHERE f.call_id=$1 AND f.market_id IS NOT NULL"+
    " ON CONFLICT(bucket_start,market_id,currency,rollup_shard) DO UPDATE SET"+
    " calls_total=platform_rollups_hourly_sharded.calls_total+EXCLUDED.calls_total,"+
    " calls_connected=platform_rollups_hourly_sharded.calls_connected+EXCLUDED.calls_connected,"+
    " calls_abandoned=platform_rollups_hourly_sharded.calls_abandoned+EXCLUDED.calls_abandoned,"+
    " calls_failed=platform_rollups_hourly_sharded.calls_failed+EXCLUDED.calls_failed,"+
    " conversation_seconds=platform_rollups_hourly_sharded.conversation_seconds+EXCLUDED.conversation_seconds,"+
    " billable_seconds=platform_rollups_hourly_sharded.billable_seconds+EXCLUDED.billable_seconds,"+
    " payout_eligible_seconds=platform_rollups_hourly_sharded.payout_eligible_seconds+EXCLUDED.payout_eligible_seconds,"+
    " generated_revenue_ttc=platform_rollups_hourly_sharded.generated_revenue_ttc+EXCLUDED.generated_revenue_ttc,"+
    " expected_payout_ht=platform_rollups_hourly_sharded.expected_payout_ht+EXCLUDED.expected_payout_ht,"+
    " confirmed_payout_ht=platform_rollups_hourly_sharded.confirmed_payout_ht+EXCLUDED.confirmed_payout_ht,"+
    " paid_payout_ht=platform_rollups_hourly_sharded.paid_payout_ht+EXCLUDED.paid_payout_ht,"+
    " expert_cost_ht=platform_rollups_hourly_sharded.expert_cost_ht+EXCLUDED.expert_cost_ht,"+
    " technical_cost_ht=platform_rollups_hourly_sharded.technical_cost_ht+EXCLUDED.technical_cost_ht,"+
    " estimated_margin_ht=platform_rollups_hourly_sharded.estimated_margin_ht+EXCLUDED.estimated_margin_ht,"+
    " reconciliation_variance_ht=platform_rollups_hourly_sharded.reconciliation_variance_ht+EXCLUDED.reconciliation_variance_ht,"+
    " updated_at=now()",
    [callId]
  );
}

export async function refreshHourlyRollupsForCalls(tx,matchJson){
  await tx.unsafe(
    "WITH input AS ("+
    " SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(call_id bigint,tenant_bucket smallint,amount numeric)"+
    "), affected AS ("+
    " SELECT DISTINCT date_trunc('hour',f.started_at) AS bucket_start,f.market_id,f.currency,"+
    " (f.tenant_bucket%64)::smallint AS rollup_shard"+
    " FROM call_facts f JOIN input i ON i.call_id=f.call_id AND i.tenant_bucket=f.tenant_bucket"+
    " WHERE f.market_id IS NOT NULL"+
    "), aggregated AS ("+
    " SELECT a.bucket_start,a.market_id,a.currency,a.rollup_shard,"+
    " count(*)::bigint AS calls_total,"+
    " count(*) FILTER(WHERE f.call_status='connected')::bigint AS calls_connected,"+
    " count(*) FILTER(WHERE f.call_status='abandoned')::bigint AS calls_abandoned,"+
    " count(*) FILTER(WHERE f.call_status NOT IN ('connected','abandoned'))::bigint AS calls_failed,"+
    " COALESCE(sum(f.conversation_seconds),0)::bigint AS conversation_seconds,"+
    " COALESCE(sum(f.billable_seconds),0)::bigint AS billable_seconds,"+
    " COALESCE(sum(f.payout_eligible_seconds),0)::bigint AS payout_eligible_seconds,"+
    " COALESCE(sum(f.retail_service_amount_ttc),0) AS generated_revenue_ttc,"+
    " COALESCE(sum(f.expected_payout_ht),0) AS expected_payout_ht,"+
    " COALESCE(sum(f.confirmed_payout_ht),0) AS confirmed_payout_ht,"+
    " COALESCE(sum(f.paid_payout_ht),0) AS paid_payout_ht,"+
    " COALESCE(sum(f.expert_cost_ht),0) AS expert_cost_ht,"+
    " COALESCE(sum(f.technical_cost_ht),0) AS technical_cost_ht,"+
    " COALESCE(sum(f.estimated_margin_ht),0) AS estimated_margin_ht,"+
    " COALESCE(sum(f.reconciliation_variance_ht),0) AS reconciliation_variance_ht"+
    " FROM affected a JOIN call_facts f ON f.market_id=a.market_id AND f.currency=a.currency"+
    " AND (f.tenant_bucket%64)::smallint=a.rollup_shard"+
    " AND f.started_at>=a.bucket_start AND f.started_at<a.bucket_start+interval '1 hour'"+
    " GROUP BY a.bucket_start,a.market_id,a.currency,a.rollup_shard"+
    ") INSERT INTO platform_rollups_hourly_sharded("+
    " bucket_start,market_id,currency,rollup_shard,calls_total,calls_connected,calls_abandoned,calls_failed,"+
    " conversation_seconds,billable_seconds,payout_eligible_seconds,generated_revenue_ttc,expected_payout_ht,"+
    " confirmed_payout_ht,paid_payout_ht,expert_cost_ht,technical_cost_ht,estimated_margin_ht,reconciliation_variance_ht,updated_at)"+
    " SELECT bucket_start,market_id,currency,rollup_shard,calls_total,calls_connected,calls_abandoned,calls_failed,"+
    " conversation_seconds,billable_seconds,payout_eligible_seconds,generated_revenue_ttc,expected_payout_ht,"+
    " confirmed_payout_ht,paid_payout_ht,expert_cost_ht,technical_cost_ht,estimated_margin_ht,reconciliation_variance_ht,now()"+
    " FROM aggregated"+
    " ON CONFLICT(bucket_start,market_id,currency,rollup_shard) DO UPDATE SET"+
    " calls_total=EXCLUDED.calls_total,calls_connected=EXCLUDED.calls_connected,"+
    " calls_abandoned=EXCLUDED.calls_abandoned,calls_failed=EXCLUDED.calls_failed,"+
    " conversation_seconds=EXCLUDED.conversation_seconds,billable_seconds=EXCLUDED.billable_seconds,"+
    " payout_eligible_seconds=EXCLUDED.payout_eligible_seconds,generated_revenue_ttc=EXCLUDED.generated_revenue_ttc,"+
    " expected_payout_ht=EXCLUDED.expected_payout_ht,confirmed_payout_ht=EXCLUDED.confirmed_payout_ht,"+
    " paid_payout_ht=EXCLUDED.paid_payout_ht,expert_cost_ht=EXCLUDED.expert_cost_ht,"+
    " technical_cost_ht=EXCLUDED.technical_cost_ht,estimated_margin_ht=EXCLUDED.estimated_margin_ht,"+
    " reconciliation_variance_ht=EXCLUDED.reconciliation_variance_ht,updated_at=now()",
    [matchJson]
  );
}


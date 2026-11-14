/**
 * Audiotel Premium Pro: PostgreSQL dashboard, network quality and incident insights.
 * Extracted without modifying SQL statements, business logic or public API signatures.
 * Depends only on explicitly injected legacy row helpers and the PostgresStore this context.
 */
export function createPostgresNetworkInsights({numberFields}){
 return {
  async dashboardAnalytics(from,to,market=null){
    const durationMs=Math.max(0,Date.parse(to)-Date.parse(from));
    const granularity=durationMs>14*86400000?"day":"hour";
    const baseCte=
      "WITH bounds AS ("+
      " SELECT $1::timestamptz AS from_ts,$2::timestamptz AS to_ts,"+
      " CASE WHEN $1::timestamptz=date_trunc('hour',$1::timestamptz) THEN $1::timestamptz"+
      " ELSE date_trunc('hour',$1::timestamptz)+interval '1 hour' END AS full_from,"+
      " date_trunc('hour',$2::timestamptz) AS full_to,"+
      " (SELECT id FROM operating_markets WHERE country_code=$3) AS market_id"+
      "), base AS ("+
      " SELECT r.bucket_start AS ts,r.currency,r.calls_total,r.calls_connected,r.calls_abandoned,r.calls_failed,"+
      " r.conversation_seconds,r.billable_seconds,r.payout_eligible_seconds,r.generated_revenue_ttc,r.expected_payout_ht,"+
      " r.confirmed_payout_ht,r.paid_payout_ht,r.expert_cost_ht,r.technical_cost_ht,r.estimated_margin_ht,r.reconciliation_variance_ht"+
      " FROM platform_rollups_hourly_sharded r CROSS JOIN bounds b"+
      " WHERE b.full_to>b.full_from AND r.bucket_start>=b.full_from AND r.bucket_start<b.full_to"+
      " AND ($3::text IS NULL OR r.market_id=b.market_id)"+
      " UNION ALL"+
      " SELECT f.started_at AS ts,f.currency,1::bigint,"+
      " (f.call_status='connected')::int::bigint,(f.call_status='abandoned')::int::bigint,"+
      " (f.call_status NOT IN ('connected','abandoned'))::int::bigint,"+
      " f.conversation_seconds::bigint,f.billable_seconds::bigint,f.payout_eligible_seconds::bigint,"+
      " f.retail_service_amount_ttc,f.expected_payout_ht,f.confirmed_payout_ht,f.paid_payout_ht,"+
      " f.expert_cost_ht,f.technical_cost_ht,f.estimated_margin_ht,f.reconciliation_variance_ht"+
      " FROM call_facts f CROSS JOIN bounds b"+
      " WHERE f.started_at>=b.from_ts AND f.started_at<=b.to_ts"+
      " AND NOT (b.full_to>b.full_from AND f.started_at>=b.full_from AND f.started_at<b.full_to)"+
      " AND ($3::text IS NULL OR f.market_id=b.market_id)"+
      ") ";

    const [series,hours,weekdays,heatmap,quality,qualitySeries,experience,experienceSeries,dimensions]=await Promise.all([
      this.readSql.unsafe(
        baseCte+
        "SELECT date_trunc($4::text,ts) AS bucket,min(currency) AS currency,count(DISTINCT currency)::int AS currency_count,"+
        " sum(calls_total)::bigint AS calls_total,sum(calls_connected)::bigint AS calls_connected,"+
        " sum(calls_abandoned)::bigint AS calls_abandoned,sum(calls_failed)::bigint AS calls_failed,"+
        " sum(conversation_seconds)::bigint AS conversation_seconds,sum(billable_seconds)::bigint AS billable_seconds,"+
        " sum(payout_eligible_seconds)::bigint AS payout_eligible_seconds,"+
        " CASE WHEN count(DISTINCT currency)<=1 THEN sum(generated_revenue_ttc)::float8 ELSE NULL END AS revenue,"+
        " CASE WHEN count(DISTINCT currency)<=1 THEN sum(expected_payout_ht)::float8 ELSE NULL END AS expected_payout,"+
        " CASE WHEN count(DISTINCT currency)<=1 THEN sum(confirmed_payout_ht)::float8 ELSE NULL END AS confirmed_payout,"+
        " CASE WHEN count(DISTINCT currency)<=1 THEN sum(paid_payout_ht)::float8 ELSE NULL END AS paid_payout,"+
        " CASE WHEN count(DISTINCT currency)<=1 THEN sum(expert_cost_ht)::float8 ELSE NULL END AS expert_cost,"+
        " CASE WHEN count(DISTINCT currency)<=1 THEN sum(technical_cost_ht)::float8 ELSE NULL END AS technical_cost,"+
        " CASE WHEN count(DISTINCT currency)<=1 THEN sum(estimated_margin_ht)::float8 ELSE NULL END AS margin,"+
        " CASE WHEN count(DISTINCT currency)<=1 THEN sum(reconciliation_variance_ht)::float8 ELSE NULL END AS reconciliation_variance"+
        " FROM base GROUP BY date_trunc($4::text,ts) ORDER BY bucket",
        [from,to,market||null,granularity]
      ),
      this.readSql.unsafe(
        baseCte+
        "SELECT EXTRACT(hour FROM ts)::int AS hour,sum(calls_total)::bigint AS calls_total,"+
        " sum(calls_connected)::bigint AS calls_connected,sum(billable_seconds)::bigint AS billable_seconds"+
        " FROM base GROUP BY EXTRACT(hour FROM ts) ORDER BY hour",
        [from,to,market||null]
      ),
      this.readSql.unsafe(
        baseCte+
        "SELECT EXTRACT(isodow FROM ts)::int AS weekday,sum(calls_total)::bigint AS calls_total,"+
        " sum(calls_connected)::bigint AS calls_connected,sum(billable_seconds)::bigint AS billable_seconds"+
        " FROM base GROUP BY EXTRACT(isodow FROM ts) ORDER BY weekday",
        [from,to,market||null]
      ),
      this.readSql.unsafe(
        baseCte+
        "SELECT EXTRACT(isodow FROM ts)::int AS weekday,EXTRACT(hour FROM ts)::int AS hour,"+
        " sum(calls_total)::bigint AS calls_total"+
        " FROM base GROUP BY EXTRACT(isodow FROM ts),EXTRACT(hour FROM ts) ORDER BY weekday,hour",
        [from,to,market||null]
      ),
      this.readSql.unsafe(
        "WITH bounds AS ("+
        " SELECT $1::timestamptz AS from_ts,$2::timestamptz AS to_ts,"+
        " CASE WHEN $1::timestamptz=date_trunc('hour',$1::timestamptz) THEN $1::timestamptz"+
        " ELSE date_trunc('hour',$1::timestamptz)+interval '1 hour' END AS full_from,"+
        " date_trunc('hour',$2::timestamptz) AS full_to,"+
        " (SELECT id FROM operating_markets WHERE country_code=$3) AS market_id"+
        "), qbase AS ("+
        " SELECT r.quality_samples,r.mos_sum,r.packet_loss_sum,r.jitter_ms_sum,r.latency_ms_sum,r.dtmf_errors,r.affected_samples,r.low_mos_samples"+
        " FROM quality_rollups_hourly_sharded r CROSS JOIN bounds b"+
        " WHERE b.full_to>b.full_from AND r.bucket_start>=b.full_from AND r.bucket_start<b.full_to"+
        " AND ($3::text IS NULL OR r.market_id=b.market_id)"+
        " UNION ALL"+
        " SELECT 1::bigint,COALESCE(q.mos,0),COALESCE(q.rtp_packet_loss_percent,0),COALESCE(q.jitter_ms,0),COALESCE(q.latency_ms,0),COALESCE(q.dtmf_errors,0)::bigint,"+
        " (COALESCE(q.rtp_packet_loss_percent,0)>=5 OR COALESCE(q.jitter_ms,0)>5 OR COALESCE(q.latency_ms,0)>150)::int::bigint,"+
        " (q.mos IS NOT NULL AND q.mos<3.5)::int::bigint"+
        " FROM calls c JOIN call_quality q ON q.call_id=c.id CROSS JOIN bounds b"+
        " WHERE c.started_at>=b.from_ts AND c.started_at<=b.to_ts"+
        " AND NOT (b.full_to>b.full_from AND c.started_at>=b.full_from AND c.started_at<b.full_to)"+
        " AND ($3::text IS NULL OR c.market_id=b.market_id)"+
        ") SELECT COALESCE(sum(quality_samples),0)::bigint AS samples,"+
        " CASE WHEN sum(quality_samples)>0 THEN (sum(mos_sum)/sum(quality_samples))::float8 ELSE NULL END AS mos,"+
        " CASE WHEN sum(quality_samples)>0 THEN (sum(packet_loss_sum)/sum(quality_samples))::float8 ELSE NULL END AS packet_loss_percent,"+
        " CASE WHEN sum(quality_samples)>0 THEN (sum(jitter_ms_sum)/sum(quality_samples))::float8 ELSE NULL END AS jitter_ms,"+
        " CASE WHEN sum(quality_samples)>0 THEN (sum(latency_ms_sum)/sum(quality_samples))::float8 ELSE NULL END AS latency_ms,"+
        " COALESCE(sum(dtmf_errors),0)::bigint AS dtmf_errors,"+
        " COALESCE(sum(affected_samples),0)::bigint AS affected_samples,COALESCE(sum(low_mos_samples),0)::bigint AS low_mos_samples FROM qbase",
        [from,to,market||null]
      ),
      this.readSql.unsafe(
        "WITH bounds AS ("+
        " SELECT $1::timestamptz AS from_ts,$2::timestamptz AS to_ts,"+
        " CASE WHEN $1::timestamptz=date_trunc('hour',$1::timestamptz) THEN $1::timestamptz"+
        " ELSE date_trunc('hour',$1::timestamptz)+interval '1 hour' END AS full_from,"+
        " date_trunc('hour',$2::timestamptz) AS full_to,"+
        " (SELECT id FROM operating_markets WHERE country_code=$3) AS market_id"+
        "), qbase AS ("+
        " SELECT r.bucket_start AS ts,r.quality_samples,r.mos_sum,r.packet_loss_sum,r.jitter_ms_sum,r.latency_ms_sum,r.dtmf_errors,r.affected_samples,r.low_mos_samples"+
        " FROM quality_rollups_hourly_sharded r CROSS JOIN bounds b"+
        " WHERE b.full_to>b.full_from AND r.bucket_start>=b.full_from AND r.bucket_start<b.full_to"+
        " AND ($3::text IS NULL OR r.market_id=b.market_id)"+
        " UNION ALL"+
        " SELECT c.started_at AS ts,1::bigint,COALESCE(q.mos,0),COALESCE(q.rtp_packet_loss_percent,0),"+
        " COALESCE(q.jitter_ms,0),COALESCE(q.latency_ms,0),COALESCE(q.dtmf_errors,0)::bigint,"+
        " (COALESCE(q.rtp_packet_loss_percent,0)>=5 OR COALESCE(q.jitter_ms,0)>5 OR COALESCE(q.latency_ms,0)>150)::int::bigint,"+
        " (q.mos IS NOT NULL AND q.mos<3.5)::int::bigint"+
        " FROM calls c JOIN call_quality q ON q.call_id=c.id CROSS JOIN bounds b"+
        " WHERE c.started_at>=b.from_ts AND c.started_at<=b.to_ts"+
        " AND NOT (b.full_to>b.full_from AND c.started_at>=b.full_from AND c.started_at<b.full_to)"+
        " AND ($3::text IS NULL OR c.market_id=b.market_id)"+
        ") SELECT date_trunc($4::text,ts) AS bucket,COALESCE(sum(quality_samples),0)::bigint AS samples,"+
        " CASE WHEN sum(quality_samples)>0 THEN (sum(mos_sum)/sum(quality_samples))::float8 ELSE NULL END AS mos,"+
        " CASE WHEN sum(quality_samples)>0 THEN (sum(packet_loss_sum)/sum(quality_samples))::float8 ELSE NULL END AS packet_loss_percent,"+
        " CASE WHEN sum(quality_samples)>0 THEN (sum(jitter_ms_sum)/sum(quality_samples))::float8 ELSE NULL END AS jitter_ms,"+
        " CASE WHEN sum(quality_samples)>0 THEN (sum(latency_ms_sum)/sum(quality_samples))::float8 ELSE NULL END AS latency_ms,"+
        " COALESCE(sum(dtmf_errors),0)::bigint AS dtmf_errors,COALESCE(sum(affected_samples),0)::bigint AS affected_samples,"+
        " COALESCE(sum(low_mos_samples),0)::bigint AS low_mos_samples"+
        " FROM qbase GROUP BY date_trunc($4::text,ts) ORDER BY bucket",
        [from,to,market||null,granularity]
      ),
      this.readSql.unsafe(
        "WITH bounds AS ("+
        " SELECT $1::timestamptz AS from_ts,$2::timestamptz AS to_ts,"+
        " CASE WHEN $1::timestamptz=date_trunc('hour',$1::timestamptz) THEN $1::timestamptz"+
        " ELSE date_trunc('hour',$1::timestamptz)+interval '1 hour' END AS full_from,"+
        " date_trunc('hour',$2::timestamptz) AS full_to,"+
        " (SELECT id FROM operating_markets WHERE country_code=$3) AS market_id"+
        "), ebase AS ("+
        " SELECT r.calls_total,r.calls_connected,r.calls_abandoned,r.wait_seconds_sum,r.wait_connected_seconds_sum,"+
        " r.wait_abandoned_seconds_sum,r.answered_le_20s,r.abandoned_le_10s,r.ivr_seconds_sum,r.ivr_samples,"+
        " r.queue_seconds_sum,r.queue_samples,r.wait_le_10s,r.wait_10_20s,r.wait_20_30s,r.wait_30_60s,r.wait_60_120s,r.wait_gt_120s"+
        " FROM experience_rollups_hourly_sharded r CROSS JOIN bounds b"+
        " WHERE b.full_to>b.full_from AND r.bucket_start>=b.full_from AND r.bucket_start<b.full_to"+
        " AND ($3::text IS NULL OR r.market_id=b.market_id)"+
        " UNION ALL"+
        " SELECT 1::bigint,(c.call_status='connected')::int::bigint,(c.call_status='abandoned')::int::bigint,"+
        " c.wait_seconds::bigint,(CASE WHEN c.call_status='connected' THEN c.wait_seconds ELSE 0 END)::bigint,"+
        " (CASE WHEN c.call_status='abandoned' THEN c.wait_seconds ELSE 0 END)::bigint,"+
        " (c.call_status='connected' AND c.wait_seconds<=20)::int::bigint,"+
        " (c.call_status='abandoned' AND c.wait_seconds<=10)::int::bigint,"+
        " (CASE WHEN c.queued_at IS NOT NULL AND c.ivr_started_at IS NOT NULL THEN GREATEST(0,EXTRACT(EPOCH FROM (c.queued_at-c.ivr_started_at))) ELSE 0 END)::bigint,"+
        " (c.queued_at IS NOT NULL AND c.ivr_started_at IS NOT NULL)::int::bigint,"+
        " (CASE WHEN c.queued_at IS NOT NULL THEN GREATEST(0,EXTRACT(EPOCH FROM (COALESCE(c.bridged_at,c.ended_at)-c.queued_at))) ELSE 0 END)::bigint,"+
        " (c.queued_at IS NOT NULL)::int::bigint,(c.wait_seconds<=10)::int::bigint,"+
        " (c.wait_seconds>10 AND c.wait_seconds<=20)::int::bigint,(c.wait_seconds>20 AND c.wait_seconds<=30)::int::bigint,"+
        " (c.wait_seconds>30 AND c.wait_seconds<=60)::int::bigint,(c.wait_seconds>60 AND c.wait_seconds<=120)::int::bigint,"+
        " (c.wait_seconds>120)::int::bigint"+
        " FROM calls c CROSS JOIN bounds b"+
        " WHERE c.started_at>=b.from_ts AND c.started_at<=b.to_ts"+
        " AND NOT (b.full_to>b.full_from AND c.started_at>=b.full_from AND c.started_at<b.full_to)"+
        " AND ($3::text IS NULL OR c.market_id=b.market_id)"+
        ") SELECT COALESCE(sum(calls_total),0)::bigint AS samples,COALESCE(sum(calls_connected),0)::bigint AS connected,"+
        " COALESCE(sum(calls_abandoned),0)::bigint AS abandoned,"+
        " CASE WHEN sum(calls_total)>0 THEN sum(wait_seconds_sum)::float8/sum(calls_total) ELSE 0 END AS avg_wait_seconds,"+
        " CASE WHEN sum(calls_connected)>0 THEN sum(wait_connected_seconds_sum)::float8/sum(calls_connected) ELSE 0 END AS avg_answered_wait_seconds,"+
        " CASE WHEN sum(calls_abandoned)>0 THEN sum(wait_abandoned_seconds_sum)::float8/sum(calls_abandoned) ELSE 0 END AS avg_abandoned_wait_seconds,"+
        " CASE WHEN sum(calls_connected)>0 THEN sum(answered_le_20s)::float8/sum(calls_connected)*100 ELSE 0 END AS answered_le_20s_percent,"+
        " CASE WHEN sum(calls_abandoned)>0 THEN sum(abandoned_le_10s)::float8/sum(calls_abandoned)*100 ELSE 0 END AS abandoned_le_10s_percent,"+
        " CASE WHEN sum(ivr_samples)>0 THEN sum(ivr_seconds_sum)::float8/sum(ivr_samples) ELSE 0 END AS avg_ivr_seconds,"+
        " CASE WHEN sum(queue_samples)>0 THEN sum(queue_seconds_sum)::float8/sum(queue_samples) ELSE 0 END AS avg_queue_seconds,"+
        " COALESCE(sum(wait_le_10s),0)::bigint AS wait_le_10s,COALESCE(sum(wait_10_20s),0)::bigint AS wait_10_20s,"+
        " COALESCE(sum(wait_20_30s),0)::bigint AS wait_20_30s,COALESCE(sum(wait_30_60s),0)::bigint AS wait_30_60s,"+
        " COALESCE(sum(wait_60_120s),0)::bigint AS wait_60_120s,COALESCE(sum(wait_gt_120s),0)::bigint AS wait_gt_120s"+
        " FROM ebase",
        [from,to,market||null]
      ),
      this.readSql.unsafe(
        "WITH bounds AS ("+
        " SELECT $1::timestamptz AS from_ts,$2::timestamptz AS to_ts,"+
        " CASE WHEN $1::timestamptz=date_trunc('hour',$1::timestamptz) THEN $1::timestamptz"+
        " ELSE date_trunc('hour',$1::timestamptz)+interval '1 hour' END AS full_from,"+
        " date_trunc('hour',$2::timestamptz) AS full_to,"+
        " (SELECT id FROM operating_markets WHERE country_code=$3) AS market_id"+
        "), ebase AS ("+
        " SELECT r.bucket_start AS ts,r.calls_total,r.calls_connected,r.calls_abandoned,r.wait_seconds_sum,r.wait_connected_seconds_sum,"+
        " r.wait_abandoned_seconds_sum,r.answered_le_20s,r.abandoned_le_10s,r.queue_seconds_sum,r.queue_samples"+
        " FROM experience_rollups_hourly_sharded r CROSS JOIN bounds b"+
        " WHERE b.full_to>b.full_from AND r.bucket_start>=b.full_from AND r.bucket_start<b.full_to"+
        " AND ($3::text IS NULL OR r.market_id=b.market_id)"+
        " UNION ALL"+
        " SELECT c.started_at AS ts,1::bigint,(c.call_status='connected')::int::bigint,(c.call_status='abandoned')::int::bigint,"+
        " c.wait_seconds::bigint,(CASE WHEN c.call_status='connected' THEN c.wait_seconds ELSE 0 END)::bigint,"+
        " (CASE WHEN c.call_status='abandoned' THEN c.wait_seconds ELSE 0 END)::bigint,"+
        " (c.call_status='connected' AND c.wait_seconds<=20)::int::bigint,(c.call_status='abandoned' AND c.wait_seconds<=10)::int::bigint,"+
        " (CASE WHEN c.queued_at IS NOT NULL THEN GREATEST(0,EXTRACT(EPOCH FROM (COALESCE(c.bridged_at,c.ended_at)-c.queued_at))) ELSE 0 END)::bigint,"+
        " (c.queued_at IS NOT NULL)::int::bigint"+
        " FROM calls c CROSS JOIN bounds b"+
        " WHERE c.started_at>=b.from_ts AND c.started_at<=b.to_ts"+
        " AND NOT (b.full_to>b.full_from AND c.started_at>=b.full_from AND c.started_at<b.full_to)"+
        " AND ($3::text IS NULL OR c.market_id=b.market_id)"+
        ") SELECT date_trunc($4::text,ts) AS bucket,COALESCE(sum(calls_total),0)::bigint AS samples,"+
        " CASE WHEN sum(calls_total)>0 THEN sum(wait_seconds_sum)::float8/sum(calls_total) ELSE 0 END AS avg_wait_seconds,"+
        " CASE WHEN sum(calls_connected)>0 THEN sum(answered_le_20s)::float8/sum(calls_connected)*100 ELSE 0 END AS answered_le_20s_percent,"+
        " CASE WHEN sum(calls_abandoned)>0 THEN sum(abandoned_le_10s)::float8/sum(calls_abandoned)*100 ELSE 0 END AS abandoned_le_10s_percent,"+
        " CASE WHEN sum(queue_samples)>0 THEN sum(queue_seconds_sum)::float8/sum(queue_samples) ELSE 0 END AS avg_queue_seconds"+
        " FROM ebase GROUP BY date_trunc($4::text,ts) ORDER BY bucket",
        [from,to,market||null,granularity]
      ),
      this.readSql.unsafe(
        "SELECT d.dimension_type,d.dimension_key,max(d.dimension_label) AS dimension_label,"+
        " sum(d.calls_total)::bigint AS calls_total,sum(d.calls_connected)::bigint AS calls_connected,"+
        " sum(d.conversation_seconds)::bigint AS conversation_seconds,sum(d.billable_seconds)::bigint AS billable_seconds,"+
        " CASE WHEN count(DISTINCT d.currency)<=1 THEN sum(d.generated_revenue_ttc)::float8 ELSE NULL END AS revenue,"+
        " CASE WHEN count(DISTINCT d.currency)<=1 THEN sum(d.expected_payout_ht)::float8 ELSE NULL END AS expected_payout,"+
        " CASE WHEN count(DISTINCT d.currency)<=1 THEN sum(d.estimated_margin_ht)::float8 ELSE NULL END AS margin"+
        " FROM dashboard_dimension_rollups_daily d LEFT JOIN operating_markets m ON m.id=d.market_id"+
        " WHERE d.bucket_date BETWEEN $1::timestamptz::date AND $2::timestamptz::date"+
        " AND ($3::text IS NULL OR m.country_code=$3)"+
        " GROUP BY d.dimension_type,d.dimension_key"+
        " ORDER BY d.dimension_type,calls_total DESC",
        [from,to,market||null]
      )
    ]);

    const countKeys=["calls_total","calls_connected","calls_abandoned","calls_failed","conversation_seconds","billable_seconds","payout_eligible_seconds","currency_count"];
    const dimensionKeys=["calls_total","calls_connected","conversation_seconds","billable_seconds"];
    const normalizedDimensions=dimensions.map(row=>numberFields(row,dimensionKeys));
    const byType={expert:[],carrier:[],duration:[]};
    for(const row of normalizedDimensions)if(byType[row.dimension_type])byType[row.dimension_type].push(row);
    return {
      granularity,
      series:series.map(row=>numberFields(row,countKeys)),
      hours:hours.map(row=>numberFields(row,["hour","calls_total","calls_connected","billable_seconds"])),
      weekdays:weekdays.map(row=>numberFields(row,["weekday","calls_total","calls_connected","billable_seconds"])),
      heatmap:heatmap.map(row=>numberFields(row,["weekday","hour","calls_total"])),
      quality:quality[0]?numberFields(quality[0],["samples","dtmf_errors","affected_samples","low_mos_samples"]):{samples:0,mos:null,packet_loss_percent:null,jitter_ms:null,latency_ms:null,dtmf_errors:0,affected_samples:0,low_mos_samples:0},
      quality_series:qualitySeries.map(row=>numberFields(row,["samples","dtmf_errors","affected_samples","low_mos_samples"])),
      experience:experience[0]?numberFields(experience[0],["samples","connected","abandoned","wait_le_10s","wait_10_20s","wait_20_30s","wait_30_60s","wait_60_120s","wait_gt_120s"]):{samples:0},
      experience_series:experienceSeries.map(row=>numberFields(row,["samples"])),
      experts:byType.expert.slice(0,50),
      carriers:byType.carrier.slice(0,50),
      durations:byType.duration
    };
  },

  async voiceIntelligence(from,to,market=null){
    const commonCte=
      "WITH bounds AS ("+
      " SELECT $1::timestamptz AS from_ts,$2::timestamptz AS to_ts,"+
      " CASE WHEN $1::timestamptz=date_trunc('hour',$1::timestamptz) THEN $1::timestamptz ELSE date_trunc('hour',$1::timestamptz)+interval '1 hour' END AS full_from,"+
      " date_trunc('hour',$2::timestamptz) AS full_to,(SELECT id FROM operating_markets WHERE country_code=$3) AS market_id"+
      "), vbase AS ("+
      " SELECT r.carrier_role,r.carrier_id,r.calls_total,r.calls_connected,r.calls_failed,r.pdd_samples,r.pdd_ms_sum,r.high_pdd_calls,"+
      " r.quality_samples,r.network_affected_calls,r.low_mos_calls,r.mos_sum,r.packet_loss_sum,r.jitter_ms_sum,r.latency_ms_sum,r.rtt_ms_sum,"+
      " r.sip_4xx_calls,r.sip_5xx_calls,r.caller_hangups,r.callee_hangups,r.network_hangups"+
      " FROM voice_carrier_health_hourly_sharded r CROSS JOIN bounds b"+
      " WHERE b.full_to>b.full_from AND r.bucket_start>=b.full_from AND r.bucket_start<b.full_to"+
      " AND ($3::text IS NULL OR r.market_id=b.market_id)"+
      " UNION ALL"+
      " SELECT cr.carrier_role,cr.carrier_id,1::bigint,(c.call_status='connected')::int::bigint,"+
      " (c.call_status NOT IN ('connected','abandoned'))::int::bigint,(c.post_dial_delay_ms IS NOT NULL)::int::bigint,"+
      " COALESCE(c.post_dial_delay_ms,0)::bigint,(COALESCE(c.post_dial_delay_ms,0)>8000)::int::bigint,(q.call_id IS NOT NULL)::int::bigint,"+
      " (q.call_id IS NOT NULL AND (COALESCE(q.rtp_packet_loss_percent,0)>=5 OR COALESCE(q.jitter_ms,0)>5 OR COALESCE(q.latency_ms,0)>150))::int::bigint,"+
      " (q.call_id IS NOT NULL AND q.mos IS NOT NULL AND q.mos<3.5)::int::bigint,COALESCE(q.mos,0),COALESCE(q.rtp_packet_loss_percent,0),"+
      " COALESCE(q.jitter_ms,0),COALESCE(q.latency_ms,0),COALESCE(q.rtt_ms,0),(c.sip_final_code BETWEEN 400 AND 499)::int::bigint,"+
      " (c.sip_final_code BETWEEN 500 AND 599)::int::bigint,(c.hangup_party='caller')::int::bigint,(c.hangup_party='callee')::int::bigint,"+
      " (c.hangup_party='network')::int::bigint"+
      " FROM calls c LEFT JOIN call_quality q ON q.call_id=c.id CROSS JOIN bounds b"+
      " CROSS JOIN LATERAL (VALUES ('origin'::text,c.origin_carrier_id),('host'::text,c.host_carrier_id)) AS cr(carrier_role,carrier_id)"+
      " WHERE c.started_at>=b.from_ts AND c.started_at<=b.to_ts"+
      " AND NOT (b.full_to>b.full_from AND c.started_at>=b.full_from AND c.started_at<b.full_to)"+
      " AND cr.carrier_id IS NOT NULL AND ($3::text IS NULL OR c.market_id=b.market_id)"+
      ") ";

    const aggregateSql=
      "SELECT COALESCE(sum(calls_total),0)::bigint AS calls_total,COALESCE(sum(calls_connected),0)::bigint AS calls_connected,"+
      " COALESCE(sum(calls_failed),0)::bigint AS calls_failed,COALESCE(sum(pdd_samples),0)::bigint AS pdd_samples,"+
      " CASE WHEN sum(pdd_samples)>0 THEN sum(pdd_ms_sum)::float8/sum(pdd_samples) ELSE NULL END AS avg_pdd_ms,"+
      " COALESCE(sum(high_pdd_calls),0)::bigint AS high_pdd_calls,COALESCE(sum(quality_samples),0)::bigint AS quality_samples,"+
      " COALESCE(sum(network_affected_calls),0)::bigint AS network_affected_calls,COALESCE(sum(low_mos_calls),0)::bigint AS low_mos_calls,"+
      " CASE WHEN sum(quality_samples)>0 THEN sum(mos_sum)::float8/sum(quality_samples) ELSE NULL END AS mos,"+
      " CASE WHEN sum(quality_samples)>0 THEN sum(packet_loss_sum)::float8/sum(quality_samples) ELSE NULL END AS packet_loss_percent,"+
      " CASE WHEN sum(quality_samples)>0 THEN sum(jitter_ms_sum)::float8/sum(quality_samples) ELSE NULL END AS jitter_ms,"+
      " CASE WHEN sum(quality_samples)>0 THEN sum(latency_ms_sum)::float8/sum(quality_samples) ELSE NULL END AS latency_ms,"+
      " CASE WHEN sum(quality_samples)>0 THEN sum(rtt_ms_sum)::float8/sum(quality_samples) ELSE NULL END AS rtt_ms,"+
      " COALESCE(sum(sip_4xx_calls),0)::bigint AS sip_4xx_calls,COALESCE(sum(sip_5xx_calls),0)::bigint AS sip_5xx_calls,"+
      " COALESCE(sum(caller_hangups),0)::bigint AS caller_hangups,COALESCE(sum(callee_hangups),0)::bigint AS callee_hangups,"+
      " COALESCE(sum(network_hangups),0)::bigint AS network_hangups";

    const [summaryRows,carrierRows,sipRows,incidentRows]=await Promise.all([
      this.readSql.unsafe(commonCte+aggregateSql+" FROM vbase WHERE carrier_role='host'",[from,to,market||null]),
      this.readSql.unsafe(
        commonCte+"SELECT v.carrier_role,v.carrier_id,c.name AS carrier,"+aggregateSql.replace(/^SELECT /,"")+
        " FROM vbase v JOIN carriers c ON c.id=v.carrier_id GROUP BY v.carrier_role,v.carrier_id,c.name ORDER BY v.carrier_role,calls_total DESC LIMIT 100",
        [from,to,market||null]
      ),
      this.readSql.unsafe(
        "WITH bounds AS (SELECT $1::timestamptz AS from_ts,$2::timestamptz AS to_ts,"+
        " CASE WHEN $1::timestamptz=date_trunc('hour',$1::timestamptz) THEN $1::timestamptz ELSE date_trunc('hour',$1::timestamptz)+interval '1 hour' END AS full_from,"+
        " date_trunc('hour',$2::timestamptz) AS full_to,(SELECT id FROM operating_markets WHERE country_code=$3) AS market_id), s AS ("+
        " SELECT r.sip_final_code,r.calls_total FROM voice_sip_code_hourly_sharded r CROSS JOIN bounds b"+
        " WHERE b.full_to>b.full_from AND r.bucket_start>=b.full_from AND r.bucket_start<b.full_to AND ($3::text IS NULL OR r.market_id=b.market_id)"+
        " UNION ALL SELECT c.sip_final_code,1::bigint FROM calls c CROSS JOIN bounds b"+
        " WHERE c.sip_final_code BETWEEN 100 AND 699 AND c.started_at>=b.from_ts AND c.started_at<=b.to_ts"+
        " AND NOT (b.full_to>b.full_from AND c.started_at>=b.full_from AND c.started_at<b.full_to)"+
        " AND ($3::text IS NULL OR c.market_id=b.market_id))"+
        " SELECT sip_final_code,COALESCE(sum(calls_total),0)::bigint AS calls_total FROM s GROUP BY sip_final_code ORDER BY calls_total DESC,sip_final_code LIMIT 20",
        [from,to,market||null]
      ),
      this.readSql.unsafe(
        "SELECT i.id,i.incident_type,i.severity,i.carrier_role,c.name AS carrier,m.country_code AS market,i.state,i.title,i.details,"+
        " i.started_at,i.last_detected_at,i.resolved_at FROM telecom_incidents i"+
        " LEFT JOIN carriers c ON c.id=i.carrier_id LEFT JOIN operating_markets m ON m.id=i.market_id"+
        " WHERE ($1::text IS NULL OR m.country_code=$1) ORDER BY (i.state='open') DESC,i.last_detected_at DESC LIMIT 50",
        [market||null]
      )
    ]);
    const keys=["calls_total","calls_connected","calls_failed","pdd_samples","avg_pdd_ms","high_pdd_calls","quality_samples","network_affected_calls","low_mos_calls","mos","packet_loss_percent","jitter_ms","latency_ms","rtt_ms","sip_4xx_calls","sip_5xx_calls","caller_hangups","callee_hangups","network_hangups"];
    const summary=numberFields(summaryRows[0]||{},keys);
    const carriers=carrierRows.map(row=>numberFields(row,keys));
    return {
      summary,
      carriers,
      sip_codes:sipRows.map(row=>numberFields(row,["sip_final_code","calls_total"])),
      incidents:incidentRows.map(row=>({...row,id:Number(row.id)}))
    };
  },

  async scanVoiceIncidents(){
    const rows=await this.sql.unsafe(
      "SELECT r.market_id,r.carrier_id,c.name AS carrier,COALESCE(sum(r.calls_total),0)::bigint AS calls_total,"+
      " COALESCE(sum(r.calls_connected),0)::bigint AS calls_connected,COALESCE(sum(r.pdd_samples),0)::bigint AS pdd_samples,"+
      " COALESCE(sum(r.high_pdd_calls),0)::bigint AS high_pdd_calls,COALESCE(sum(r.quality_samples),0)::bigint AS quality_samples,"+
      " COALESCE(sum(r.network_affected_calls),0)::bigint AS network_affected_calls,COALESCE(sum(r.sip_5xx_calls),0)::bigint AS sip_5xx_calls"+
      " FROM voice_carrier_health_hourly_sharded r JOIN carriers c ON c.id=r.carrier_id"+
      " WHERE r.carrier_role='host' AND r.bucket_start>=date_trunc('hour',now())-interval '1 hour'"+
      " GROUP BY r.market_id,r.carrier_id,c.name"
    );
    const types=["connection_low","network_degraded","pdd_high","sip_5xx_high"];
    const changes=[];
    await this.sql.begin(async tx=>{
      for(const raw of rows){
        const row=numberFields(raw,["market_id","carrier_id","calls_total","calls_connected","pdd_samples","high_pdd_calls","quality_samples","network_affected_calls","sip_5xx_calls"]);
        const connection=row.calls_total?row.calls_connected/row.calls_total*100:100;
        const affected=row.quality_samples?row.network_affected_calls/row.quality_samples*100:0;
        const highPdd=row.pdd_samples?row.high_pdd_calls/row.pdd_samples*100:0;
        const sip5xx=row.calls_total?row.sip_5xx_calls/row.calls_total*100:0;
        const conditions={
          connection_low:row.calls_total>=20&&connection<75,
          network_degraded:row.quality_samples>=10&&affected>=15,
          pdd_high:row.pdd_samples>=10&&highPdd>=15,
          sip_5xx_high:row.calls_total>=20&&sip5xx>=10
        };
        const meta={
          connection_low:{title:"Taux de connexion opérateur dégradé",value:connection,critical:connection<60},
          network_degraded:{title:"Qualité réseau opérateur dégradée",value:affected,critical:affected>=30},
          pdd_high:{title:"Temps avant sonnerie anormalement élevé",value:highPdd,critical:highPdd>=30},
          sip_5xx_high:{title:"Erreurs SIP 5xx élevées",value:sip5xx,critical:sip5xx>=20}
        };
        for(const type of types){
          const open=await tx.unsafe(
            "SELECT id,severity FROM telecom_incidents WHERE incident_type=$1 AND carrier_role='host' AND carrier_id=$2 AND market_id=$3 AND state='open' LIMIT 1",
            [type,row.carrier_id,row.market_id]
          );
          if(conditions[type]){
            const severity=meta[type].critical?"critical":"warning";
            const details=JSON.stringify({carrier:row.carrier,calls:row.calls_total,value_percent:Number(meta[type].value.toFixed(2)),window:"2h"});
            if(open[0]){
              await tx.unsafe("UPDATE telecom_incidents SET severity=$2,title=$3,details=$4::jsonb,last_detected_at=now() WHERE id=$1",[open[0].id,severity,meta[type].title,details]);
              if(open[0].severity!==severity)changes.push({event:"voice.incident",id:Number(open[0].id),type,severity,carrier:row.carrier});
            }else{
              const created=await tx.unsafe(
                "INSERT INTO telecom_incidents(incident_type,severity,carrier_role,carrier_id,market_id,state,title,details)"+
                " VALUES($1,$2,'host',$3,$4,'open',$5,$6::jsonb) RETURNING id",
                [type,severity,row.carrier_id,row.market_id,meta[type].title,details]
              );
              changes.push({event:"voice.incident",id:Number(created[0].id),type,severity,carrier:row.carrier});
            }
          }else if(open[0]){
            await tx.unsafe("UPDATE telecom_incidents SET state='resolved',resolved_at=now(),last_detected_at=now() WHERE id=$1",[open[0].id]);
            changes.push({event:"voice.incident.resolved",id:Number(open[0].id),type,carrier:row.carrier});
          }
        }
      }
      const stale=await tx.unsafe(
        "UPDATE telecom_incidents SET state='resolved',resolved_at=now() WHERE state='open' AND last_detected_at<now()-interval '90 minutes' RETURNING id,incident_type"
      );
      for(const row of stale)changes.push({event:"voice.incident.resolved",id:Number(row.id),type:row.incident_type});
    });
    for(const change of changes)this.eventBus.publish(change.event,change);
    return changes;
  }
 };
}

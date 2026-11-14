/**
 * Audiotel Premium Pro: PostgreSQL financial, KPI and jackpot insights.
 * Extracted without modifying SQL statements, business logic or public API signatures.
 * Depends only on explicitly injected legacy row helpers and the PostgresStore this context.
 */
export function createPostgresFinancialInsights({numberFields,clampInt,problem}){
 return {
  async summary(from,to,market=null){
    const rows=await this.readSql.unsafe(
      "WITH bounds AS ("+
      " SELECT $1::timestamptz AS from_ts,$2::timestamptz AS to_ts,"+
      " CASE WHEN $1::timestamptz=date_trunc('hour',$1::timestamptz)"+
      " THEN $1::timestamptz ELSE date_trunc('hour',$1::timestamptz)+interval '1 hour' END AS full_from,"+
      " date_trunc('hour',$2::timestamptz) AS full_to,"+
      " (SELECT id FROM operating_markets WHERE country_code=$3) AS market_id"+
      "), rollup_rows AS ("+
      " SELECT r.currency,r.calls_total,r.calls_connected,r.calls_abandoned,r.calls_failed,r.conversation_seconds,"+
      " r.billable_seconds,r.payout_eligible_seconds,r.generated_revenue_ttc,r.expected_payout_ht,"+
      " r.confirmed_payout_ht,r.paid_payout_ht,r.expert_cost_ht,r.technical_cost_ht,"+
      " r.estimated_margin_ht,r.reconciliation_variance_ht"+
      " FROM platform_rollups_hourly_sharded r CROSS JOIN bounds b"+
      " WHERE b.full_to>b.full_from AND r.bucket_start>=b.full_from AND r.bucket_start<b.full_to"+
      " AND ($3::text IS NULL OR r.market_id=b.market_id)"+
      "), edge_rows AS ("+
      " SELECT f.currency,1::bigint AS calls_total,"+
      " (f.call_status='connected')::int::bigint AS calls_connected,"+
      " (f.call_status='abandoned')::int::bigint AS calls_abandoned,"+
      " (f.call_status NOT IN ('connected','abandoned'))::int::bigint AS calls_failed,"+
      " f.conversation_seconds::bigint,f.billable_seconds::bigint,f.payout_eligible_seconds::bigint,"+
      " f.retail_service_amount_ttc AS generated_revenue_ttc,f.expected_payout_ht,f.confirmed_payout_ht,"+
      " f.paid_payout_ht,f.expert_cost_ht,f.technical_cost_ht,f.estimated_margin_ht,f.reconciliation_variance_ht"+
      " FROM call_facts f CROSS JOIN bounds b"+
      " WHERE f.started_at>=b.from_ts AND f.started_at<=b.to_ts"+
      " AND NOT (b.full_to>b.full_from AND f.started_at>=b.full_from AND f.started_at<b.full_to)"+
      " AND ($3::text IS NULL OR f.market_id=b.market_id)"+
      "), combined AS ("+
      " SELECT * FROM rollup_rows UNION ALL SELECT * FROM edge_rows"+
      ") SELECT"+
      " CASE WHEN count(DISTINCT currency)<=1 THEN COALESCE(sum(generated_revenue_ttc),0)::float8 ELSE NULL END AS generated_revenue_ttc,"+
      " CASE WHEN count(DISTINCT currency)<=1 THEN COALESCE(sum(expected_payout_ht),0)::float8 ELSE NULL END AS expected_payout_ht,"+
      " CASE WHEN count(DISTINCT currency)<=1 THEN COALESCE(sum(confirmed_payout_ht),0)::float8 ELSE NULL END AS confirmed_payout_ht,"+
      " CASE WHEN count(DISTINCT currency)<=1 THEN COALESCE(sum(paid_payout_ht),0)::float8 ELSE NULL END AS paid_payout_ht,"+
      " CASE WHEN count(DISTINCT currency)<=1 THEN COALESCE(sum(estimated_margin_ht),0)::float8 ELSE NULL END AS estimated_margin_ht,"+
      " CASE WHEN count(DISTINCT currency)<=1 THEN COALESCE(sum(reconciliation_variance_ht),0)::float8 ELSE NULL END AS reconciliation_variance_ht,"+
      " COALESCE(sum(calls_total),0)::bigint AS calls_total,"+
      " COALESCE(sum(calls_connected),0)::bigint AS calls_connected,"+
      " COALESCE(sum(calls_abandoned),0)::bigint AS calls_abandoned,"+
      " COALESCE(sum(calls_failed),0)::bigint AS calls_failed,"+
      " COALESCE(sum(billable_seconds),0)::float8/60.0 AS billable_minutes,"+
      " COALESCE(sum(payout_eligible_seconds),0)::float8/60.0 AS payout_eligible_minutes,"+
      " COALESCE(sum(expert_cost_ht),0)::float8 AS expert_cost_ht,"+
      " COALESCE(sum(technical_cost_ht),0)::float8 AS technical_cost_ht,"+
      " count(DISTINCT currency)::int AS currency_count,min(currency) AS currency,"+
      " CASE WHEN COALESCE(sum(calls_connected),0)>0"+
      " THEN COALESCE(sum(conversation_seconds),0)::float8/sum(calls_connected) ELSE 0 END AS acd_seconds"+
      " FROM combined",
      [from,to,market||null]
    );
    const [presence,liveFinancial]=await Promise.all([
      this.readSql.unsafe(
        "SELECT count(*) FILTER (WHERE status='available' AND enabled)::int AS active_experts,"+
        " COALESCE(sum(active_calls),0)::int AS live_calls FROM experts"
      ),
      this.liveFinancialSnapshot(null,null)
    ]);
    const r=numberFields(rows[0],[
      "calls_total","calls_connected","calls_abandoned","calls_failed","currency_count"
    ]);
    const p=numberFields(presence[0],["active_experts","live_calls"]);
    const liveSingle=liveFinancial.currency_count===1?liveFinancial.by_currency[0]||null:null;
    return {
      ...r,
      mixed_currency:r.currency_count>1,
      asr_percent:r.calls_total?r.calls_connected/r.calls_total*100:0,
      active_experts:p.active_experts,
      live_calls:Math.max(p.live_calls,liveFinancial.active_calls),
      queue_depth:0,
      live_currency_count:liveFinancial.currency_count,
      live_mixed_currency:liveFinancial.currency_count>1,
      live_currency:liveSingle?.currency||null,
      live_upstream_payout_ht:liveSingle?.estimated_upstream_payout_ht??null,
      live_client_net_ht:liveSingle?.estimated_client_net_ht??null,
      live_service_revenue_ttc:liveSingle?.estimated_service_revenue_ttc??null,
      live_upstream_rate_ht_per_second:liveSingle?.upstream_rate_ht_per_second??null,
      live_client_rate_ht_per_second:liveSingle?.client_rate_ht_per_second??null,
      live_service_rate_ttc_per_second:liveSingle?.service_rate_ttc_per_second??null,
      live_as_of:liveFinancial.as_of,
      live_financial_by_currency:liveFinancial.by_currency
    };
  },

  async liveFinancialSnapshot(tenantId=null,market=null){
    const rows=await this.readSql.unsafe(
      "SELECT l.currency,count(*)::int AS active_calls,"+
      " COALESCE(sum(LEAST(86400,GREATEST(0,EXTRACT(EPOCH FROM (now()-l.billable_started_at))))/60.0*l.service_rate_ttc_per_min),0)::float8 AS estimated_service_revenue_ttc,"+
      " COALESCE(sum(LEAST(86400,GREATEST(0,EXTRACT(EPOCH FROM (now()-l.billable_started_at))))/60.0*l.upstream_payout_rate_ht_per_min),0)::float8 AS estimated_upstream_payout_ht,"+
      " COALESCE(sum(LEAST(86400,GREATEST(0,EXTRACT(EPOCH FROM (now()-l.billable_started_at))))/60.0*l.net_client_rate_ht_per_min),0)::float8 AS estimated_client_net_ht,"+
      " COALESCE(sum(l.service_rate_ttc_per_min)/60.0,0)::float8 AS service_rate_ttc_per_second,"+
      " COALESCE(sum(l.upstream_payout_rate_ht_per_min)/60.0,0)::float8 AS upstream_rate_ht_per_second,"+
      " COALESCE(sum(l.net_client_rate_ht_per_min)/60.0,0)::float8 AS client_rate_ht_per_second"+
      " FROM live_call_financial_sessions l LEFT JOIN operating_markets m ON m.id=l.market_id"+
      " WHERE l.status='active' AND l.billable_started_at>now()-interval '24 hours'"+
      " AND ($1::bigint IS NULL OR l.tenant_id=$1) AND ($2::text IS NULL OR m.country_code=$2)"+
      " GROUP BY l.currency ORDER BY l.currency",
      [tenantId==null?null:Number(tenantId),market||null]
    );
    const byCurrency=rows.map(row=>numberFields(row,[
      "active_calls","estimated_service_revenue_ttc","estimated_upstream_payout_ht","estimated_client_net_ht",
      "service_rate_ttc_per_second","upstream_rate_ht_per_second","client_rate_ht_per_second"
    ]));
    return {
      as_of:new Date().toISOString(),
      active_calls:byCurrency.reduce((sum,row)=>sum+Number(row.active_calls||0),0),
      currency_count:byCurrency.length,
      by_currency:byCurrency
    };
  },

  async customerJackpotSnapshot(tenantId){
    const id=Number(tenantId);
    if(!Number.isInteger(id)||id<=0)throw problem(400,"INVALID_TENANT_CONTEXT");
    const tenantRows=await this.readSql.unsafe("SELECT id,default_currency,created_at FROM tenants WHERE id=$1",[id]);
    const tenant=tenantRows[0];if(!tenant)throw problem(404,"TENANT_NOT_FOUND");
    const resetRows=await this.readSql.unsafe("SELECT effective_from FROM customer_jackpot_baselines WHERE tenant_id=$1 ORDER BY effective_from DESC,id DESC LIMIT 1",[id]);
    const resetAt=new Date(resetRows[0]?.effective_from||tenant.created_at).toISOString();
    const rows=await this.withTenantReadContext(id,async tx=>tx.unsafe(
      "SELECT currency,count(*) FILTER(WHERE status='active')::int AS active_calls,count(*) FILTER(WHERE status='ended')::int AS completed_calls,"+
      " COALESCE(sum(CASE WHEN COALESCE(ended_at,now())>GREATEST(billable_started_at,$1::timestamptz) THEN LEAST(86400,GREATEST(0,EXTRACT(EPOCH FROM (COALESCE(ended_at,now())-GREATEST(billable_started_at,$1::timestamptz)))))/60.0*net_client_rate_ht_per_min ELSE 0 END),0)::float8 AS jackpot_client_net_ht,"+
      " COALESCE(sum(CASE WHEN status='active' AND now()>GREATEST(billable_started_at,$1::timestamptz) THEN LEAST(86400,GREATEST(0,EXTRACT(EPOCH FROM (now()-GREATEST(billable_started_at,$1::timestamptz)))))/60.0*net_client_rate_ht_per_min ELSE 0 END),0)::float8 AS live_client_net_ht,"+
      " COALESCE(sum(net_client_rate_ht_per_min) FILTER(WHERE status='active')/60.0,0)::float8 AS client_rate_ht_per_second"+
      " FROM tenant_scoped_live_call_financial_sessions WHERE status IN ('active','ended') AND COALESCE(ended_at,now())>$1::timestamptz AND billable_started_at<=now() GROUP BY currency ORDER BY currency",[resetAt]
    ));
    const byCurrency=rows.map(row=>numberFields(row,["active_calls","completed_calls","jackpot_client_net_ht","live_client_net_ht","client_rate_ht_per_second"]));
    return {as_of:new Date().toISOString(),reset_at:resetAt,default_currency:tenant.default_currency||"EUR",currency_count:byCurrency.length,by_currency:byCurrency,estimate:true,accounting_impact:"none"};
  },

  async platformJackpotSnapshot(){
    const resetRows=await this.readSql.unsafe("SELECT created_at AS effective_from FROM audit_log WHERE action='platform.jackpot.reset' ORDER BY id DESC LIMIT 1");
    const resetAt=new Date(resetRows[0]?.effective_from||0).toISOString();
    const rows=await this.readSql.unsafe(
      "SELECT currency,count(*) FILTER(WHERE status='active')::int AS active_calls,count(*) FILTER(WHERE status='ended')::int AS completed_calls,"+
      " COALESCE(sum(CASE WHEN COALESCE(ended_at,now())>GREATEST(billable_started_at,$1::timestamptz) THEN LEAST(86400,GREATEST(0,EXTRACT(EPOCH FROM (COALESCE(ended_at,now())-GREATEST(billable_started_at,$1::timestamptz)))))/60.0*upstream_payout_rate_ht_per_min ELSE 0 END),0)::float8 AS jackpot_upstream_payout_ht,"+
      " COALESCE(sum(CASE WHEN COALESCE(ended_at,now())>GREATEST(billable_started_at,$1::timestamptz) THEN LEAST(86400,GREATEST(0,EXTRACT(EPOCH FROM (COALESCE(ended_at,now())-GREATEST(billable_started_at,$1::timestamptz)))))/60.0*net_client_rate_ht_per_min ELSE 0 END),0)::float8 AS jackpot_client_net_ht,"+
      " COALESCE(sum(CASE WHEN COALESCE(ended_at,now())>GREATEST(billable_started_at,$1::timestamptz) THEN LEAST(86400,GREATEST(0,EXTRACT(EPOCH FROM (COALESCE(ended_at,now())-GREATEST(billable_started_at,$1::timestamptz)))))/60.0*GREATEST(0,upstream_payout_rate_ht_per_min-net_client_rate_ht_per_min) ELSE 0 END),0)::float8 AS jackpot_pgi_margin_ht,"+
      " COALESCE(sum(CASE WHEN status='active' AND now()>GREATEST(billable_started_at,$1::timestamptz) THEN LEAST(86400,GREATEST(0,EXTRACT(EPOCH FROM (now()-GREATEST(billable_started_at,$1::timestamptz)))))/60.0*upstream_payout_rate_ht_per_min ELSE 0 END),0)::float8 AS live_upstream_payout_ht,"+
      " COALESCE(sum(upstream_payout_rate_ht_per_min) FILTER(WHERE status='active')/60.0,0)::float8 AS upstream_rate_ht_per_second"+
      " FROM live_call_financial_sessions WHERE status IN ('active','ended') AND COALESCE(ended_at,now())>$1::timestamptz AND billable_started_at<=now() GROUP BY currency ORDER BY currency",
      [resetAt]
    );
    const byCurrency=rows.map(row=>numberFields(row,["active_calls","completed_calls","jackpot_upstream_payout_ht","jackpot_client_net_ht","jackpot_pgi_margin_ht","live_upstream_payout_ht","upstream_rate_ht_per_second"]));
    return {as_of:new Date().toISOString(),reset_at:resetAt,currency_count:byCurrency.length,by_currency:byCurrency,estimate:true,accounting_impact:"none",reporting_impact:"none"};
  },

  async liveFinancialByTenant(limit=50){
    const safe=clampInt(limit,50,1,100);
    const rows=await this.readSql.unsafe(
      "SELECT t.public_id AS tenant_public_id,t.display_name,l.currency,count(*)::int AS active_calls,"+
      " COALESCE(sum(LEAST(86400,GREATEST(0,EXTRACT(EPOCH FROM (now()-l.billable_started_at))))/60.0*l.upstream_payout_rate_ht_per_min),0)::float8 AS generated_upstream_payout_ht,"+
      " COALESCE(sum(LEAST(86400,GREATEST(0,EXTRACT(EPOCH FROM (now()-l.billable_started_at))))/60.0*l.net_client_rate_ht_per_min),0)::float8 AS generated_client_net_ht,"+
      " COALESCE(sum(LEAST(86400,GREATEST(0,EXTRACT(EPOCH FROM (now()-l.billable_started_at))))/60.0*GREATEST(0,l.upstream_payout_rate_ht_per_min-l.net_client_rate_ht_per_min)),0)::float8 AS pgi_margin_ht,"+
      " COALESCE(sum(l.upstream_payout_rate_ht_per_min)/60.0,0)::float8 AS upstream_rate_ht_per_second,"+
      " COALESCE(sum(l.net_client_rate_ht_per_min)/60.0,0)::float8 AS client_rate_ht_per_second,"+
      " COALESCE(sum(GREATEST(0,l.upstream_payout_rate_ht_per_min-l.net_client_rate_ht_per_min))/60.0,0)::float8 AS pgi_margin_rate_ht_per_second"+
      " FROM live_call_financial_sessions l JOIN tenants t ON t.id=l.tenant_id WHERE l.status='active' AND l.billable_started_at>now()-interval '24 hours'"+
      " GROUP BY t.public_id,t.display_name,l.currency ORDER BY generated_upstream_payout_ht DESC,t.display_name LIMIT $1",[safe]
    );
    const data=rows.map(row=>numberFields(row,["active_calls","generated_upstream_payout_ht","generated_client_net_ht","pgi_margin_ht","upstream_rate_ht_per_second","client_rate_ht_per_second","pgi_margin_rate_ht_per_second"]));
    return {as_of:new Date().toISOString(),active_calls:data.reduce((a,x)=>a+Number(x.active_calls||0),0),by_client:data};
  }
 };
}

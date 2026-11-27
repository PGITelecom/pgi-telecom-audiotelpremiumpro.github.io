// Observability only: use PGI's actual records, never infer regulatory clearance.
function fail(code,status=400){const e=new Error(code);e.code=code;e.status=status;throw e;}
export async function wholesaleIndependenceSnapshot(store){
 const sql=store?.readSql;
 if(typeof sql?.unsafe!=="function")fail("WHOLESALE_POSTGRES_REQUIRED",503);
 const [routes,resources,finance]=await Promise.all([
  sql.unsafe("SELECT r.route_key,a.name AS active_carrier,s.name AS standby_carrier,ac.state AS active_connection_state,sc.state AS standby_connection_state FROM logical_carrier_routes r LEFT JOIN carriers a ON a.id=r.active_carrier_id LEFT JOIN carriers s ON s.id=r.standby_carrier_id LEFT JOIN carrier_connections ac ON ac.id=r.active_connection_id LEFT JOIN carrier_connections sc ON sc.id=r.standby_connection_id ORDER BY r.route_key LIMIT 100"),
  sql.unsafe("SELECT (SELECT count(*)::int FROM direct_sva_number_blocks) AS block_records, (SELECT count(*)::int FROM direct_sva_number_blocks WHERE allocation_status='granted' AND granted_at<=current_date AND (expires_at IS NULL OR expires_at>=current_date)) AS recorded_current_grants, (SELECT count(*)::int FROM direct_sva_number_inventory) AS inventory_records, (SELECT count(*)::int FROM direct_sva_interconnections WHERE contract_status='signed' AND signed_at<=current_date AND (valid_until IS NULL OR valid_until>=current_date)) AS recorded_current_contracts"),
  sql.unsafe("SELECT f.host_carrier_id,c.name AS carrier_name, count(*)::text AS calls, coalesce(sum(f.payout_eligible_seconds),0)::text AS eligible_seconds, coalesce(sum(f.expected_payout_ht),0)::text AS expected_ht, coalesce(sum(f.confirmed_payout_ht),0)::text AS confirmed_ht, coalesce(sum(f.paid_payout_ht),0)::text AS recorded_paid_ht, coalesce(sum(f.technical_cost_ht),0)::text AS technical_cost_ht FROM call_facts f LEFT JOIN carriers c ON c.id=f.host_carrier_id WHERE f.started_at>=now()-interval '30 days' AND f.started_at<now() AND f.currency='EUR' GROUP BY f.host_carrier_id,c.name ORDER BY sum(f.expected_payout_ht) DESC NULLS LAST LIMIT 100")
 ]);
 return Object.freeze({schema_version:"pgi-wholesale-independence/1",scope:"company_admin_read_only",period:"rolling_30_days_EUR",
  logical_routes:routes,resource_records:resources[0]??null,carrier_finance:finance,
  finance_limit:100,contract_evidence_independently_verified:false,bank_receipts_verified:false,
  automatic_switch_authorized:false,number_assignment_authorized:false,payout_authorized:false});
}

// Compare direct SIP/WebRTC reception against chargeable external termination.
// All costs explicit, integer micro-EUR, estimated rather than live network pricing.
function int(v,k,min=0,max=1_000_000_000_000){if(!Number.isSafeInteger(v)||v<min||v>max)fail("VOICE_INVALID_"+k);return v;}
function safe(n){if(!Number.isSafeInteger(n))fail("VOICE_OVERFLOW");return n;}
export function compareVoiceReception(input={}){
 if(input.business_unit!=="audiotel_platform"||input.currency!=="EUR")fail("VOICE_SCOPE");
 const minutes=int(input.monthly_minutes,"MINUTES",1,100_000_000);
 const share=int(input.webrtc_adoption_bps,"ADOPTION",0,10000);
 const fallback=int(input.fallback_bps,"FALLBACK",0,10000);
 const horizon=int(input.horizon_months,"HORIZON",1,60);
 const pstn=int(input.pstn_cost_micro_eur_per_min,"PSTN",0,1_000_000);
 const rtc=int(input.webrtc_cost_micro_eur_per_min,"WEBRTC",0,1_000_000);
 const fixed=int(input.monthly_fixed_cost_micro_eur,"FIXED");
 const setup=int(input.setup_cost_micro_eur,"SETUP");
 // Conservative whole-minute model. Fallback minutes incur both WebRTC and PSTN costs.
 const attempted=Math.floor(minutes*share/10000);
 const saved=Math.floor(attempted*(10000-fallback)/10000);
 const baseline=safe(minutes*pstn);
 const alternative=safe(safe((minutes-saved)*pstn)+safe(attempted*rtc)+fixed);
 const recurring=safe(baseline-alternative);
 const total=safe(safe(recurring*horizon)-setup);
 const reasons=[];
 if(total<=0)reasons.push("no_positive_horizon_saving");
 for(const k of ["costs_verified","sip_interconnection_verified","media_quality_verified","fallback_tested","security_reviewed"])
  if(input.evidence?.[k]!==true)reasons.push("missing_"+k);
 return Object.freeze({schema_version:"pgi-voice-cost-scenario/1",currency:"EUR",unit:"micro_eur",
  monthly_minutes:minutes,webrtc_attempted_minutes:attempted,pstn_minutes_avoided:saved,
  monthly_baseline_micro_eur:baseline,monthly_alternative_micro_eur:alternative,
  monthly_saving_micro_eur:recurring,horizon_saving_micro_eur:total,
  payback_months:recurring>0?Math.ceil(setup/recurring):null,
  status:reasons.length?"blocked":"candidate_for_independent_review",blocked_reasons:Object.freeze(reasons),
  scenario_only:true,network_activation_authorized:false,routing_change_authorized:false});
}

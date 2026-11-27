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

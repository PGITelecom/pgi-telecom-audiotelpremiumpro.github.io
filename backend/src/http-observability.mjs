/**
 * HTTP observability: canonical Prometheus metrics and latency histogram.
 * Extracted byte-for-byte from backend/server.mjs without changing metrics names,
 * HTTP output, bucket boundaries or response formatting.
 */
const LATENCY_BUCKETS_MS=[10,25,50,100,250,500,1000,2500,5000];
export function observeLatency(metrics,route,durationMs){
  const key=String(route||"unclassified");
  let h=metrics.latencyByRoute.get(key);
  if(!h){
    h={count:0,sum:0,buckets:Array(LATENCY_BUCKETS_MS.length).fill(0)};
    metrics.latencyByRoute.set(key,h);
  }
  h.count++;
  h.sum+=Number(durationMs)||0;
  for(let i=0;i<LATENCY_BUCKETS_MS.length;i++){
    if(durationMs<=LATENCY_BUCKETS_MS[i]){
      h.buckets[i]++;
      break;
    }
  }
}
function promLabel(value){
  return String(value||"").replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/\n/g,"\\n");
}
function timestampMetric(value){
  const ms=Date.parse(value||"");
  return Number.isFinite(ms)?Math.floor(ms/1000):0;
}
export async function metricsResponse(res,metrics,store,workers){
  const [m,snapshot,queue]=await Promise.all([
    store.metrics(),
    store.systemSnapshot(),
    typeof store.workQueueHealth==="function"?store.workQueueHealth():Promise.resolve({pending:0,leased:0,dead_lettered:0,oldest_pending_seconds:0})
  ]);
  const lines=[
    "# TYPE pgi_http_requests_total counter",
    "pgi_http_requests_total "+metrics.requests,
    "# TYPE pgi_http_errors_total counter",
    "pgi_http_errors_total "+metrics.errors,
    "# TYPE pgi_rate_limited_total counter",
    "pgi_rate_limited_total "+metrics.rateLimited,
    "# TYPE pgi_auth_failures_total counter",
    "pgi_auth_failures_total "+metrics.authFailures,
    "# TYPE pgi_auth_rate_limited_total counter",
    "pgi_auth_rate_limited_total "+metrics.authRateLimited,
    "# TYPE pgi_calls_total gauge",
    "pgi_calls_total "+m.calls_total,
    "# TYPE pgi_calls_connected gauge",
    "pgi_calls_connected "+m.calls_connected,
    "# TYPE pgi_outbox_pending gauge",
    "pgi_outbox_pending "+m.outbox_pending,
    "# TYPE pgi_service_incidents_open gauge",
    "pgi_service_incidents_open "+Number(m.service_incidents_open||0),
    "# TYPE pgi_service_incidents_critical gauge",
    "pgi_service_incidents_critical "+Number(m.service_incidents_critical||0),
    "# TYPE pgi_service_first_response_overdue gauge",
    "pgi_service_first_response_overdue "+Number(m.service_first_response_overdue||0),
    "# TYPE pgi_service_resolution_overdue gauge",
    "pgi_service_resolution_overdue "+Number(m.service_resolution_overdue||0),
    "# TYPE pgi_routing_unavailable gauge",
    "pgi_routing_unavailable "+Number(m.routing_unavailable||0),
    "# TYPE pgi_portability_attention gauge",
    "pgi_portability_attention "+Number(m.portability_attention||0),
    "# TYPE pgi_cdr_lag_seconds gauge",
    "pgi_cdr_lag_seconds "+Number(snapshot.cdr_lag_seconds||0),
    "# TYPE pgi_experts_available gauge",
    "pgi_experts_available "+Number(snapshot.experts_available||0),
    "# TYPE pgi_event_subscribers gauge",
    "pgi_event_subscribers "+m.event_subscribers,
    "# TYPE pgi_worker_outbox_errors_total counter",
    "pgi_worker_outbox_errors_total "+Number(workers?.stats?.outboxErrors||0),
    "# TYPE pgi_worker_alert_errors_total counter",
    "pgi_worker_alert_errors_total "+Number(workers?.stats?.alertsErrors||0),
    "# TYPE pgi_worker_queue_errors_total counter",
    "pgi_worker_queue_errors_total "+Number(workers?.stats?.queueErrors||0),
    "# TYPE pgi_worker_queue_processed_total counter",
    "pgi_worker_queue_processed_total "+Number(workers?.stats?.queueProcessed||0),
    "# TYPE pgi_worker_queue_dead_letters_total counter",
    "pgi_worker_queue_dead_letters_total "+Number(workers?.stats?.queueDeadLetters||0),
    "# TYPE pgi_worker_outbox_last_success_unixtime gauge",
    "pgi_worker_outbox_last_success_unixtime "+timestampMetric(workers?.stats?.lastOutboxSuccessAt),
    "# TYPE pgi_worker_alerts_last_success_unixtime gauge",
    "pgi_worker_alerts_last_success_unixtime "+timestampMetric(workers?.stats?.lastAlertsSuccessAt),
    "# TYPE pgi_worker_queue_last_success_unixtime gauge",
    "pgi_worker_queue_last_success_unixtime "+timestampMetric(workers?.stats?.lastQueueSuccessAt),
    "# TYPE pgi_work_queue_pending gauge",
    "pgi_work_queue_pending "+Number(queue.pending||0),
    "# TYPE pgi_work_queue_leased gauge",
    "pgi_work_queue_leased "+Number(queue.leased||0),
    "# TYPE pgi_work_queue_dead_lettered gauge",
    "pgi_work_queue_dead_lettered "+Number(queue.dead_lettered||0),
    "# TYPE pgi_work_queue_oldest_pending_seconds gauge",
    "pgi_work_queue_oldest_pending_seconds "+Number(queue.oldest_pending_seconds||0).toFixed(3),
    "# TYPE pgi_process_uptime_seconds gauge",
    "pgi_process_uptime_seconds "+((Date.now()-metrics.startedAt)/1000).toFixed(3)
  ];
  lines.push("# TYPE pgi_rate_limited_class_total counter");
  for(const [scope,count] of metrics.rateLimitedByClass)lines.push('pgi_rate_limited_class_total{class="'+promLabel(scope)+'"} '+count);
  lines.push("# TYPE pgi_http_responses_total counter");
  for(const [status,count] of metrics.byStatus){
    lines.push('pgi_http_responses_total{status="'+promLabel(status)+'"} '+count);
  }
  lines.push("# TYPE pgi_http_route_requests_total counter");
  for(const [route,count] of metrics.byRoute){
    lines.push('pgi_http_route_requests_total{route="'+promLabel(route)+'"} '+count);
  }
  lines.push("# TYPE pgi_http_request_duration_ms histogram");
  for(const [route,h] of metrics.latencyByRoute){
    const label=promLabel(route);
    let cumulative=0;
    for(let i=0;i<LATENCY_BUCKETS_MS.length;i++){
      cumulative+=h.buckets[i]||0;
      lines.push('pgi_http_request_duration_ms_bucket{route="'+label+'",le="'+LATENCY_BUCKETS_MS[i]+'"} '+cumulative);
    }
    lines.push('pgi_http_request_duration_ms_bucket{route="'+label+'",le="+Inf"} '+h.count);
    lines.push('pgi_http_request_duration_ms_sum{route="'+label+'"} '+h.sum.toFixed(3));
    lines.push('pgi_http_request_duration_ms_count{route="'+label+'"} '+h.count);
  }
  const body=lines.join("\n")+"\n";
  res.writeHead(200,{"Content-Type":"text/plain; version=0.0.4; charset=utf-8","Content-Length":Buffer.byteLength(body)});
  res.end(body);
}

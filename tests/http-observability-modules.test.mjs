import test from "node:test";
import assert from "node:assert/strict";
import {metricsResponse,observeLatency} from "../backend/src/http-observability.mjs";

test("latency metric histogram buckets preserve their original boundaries",()=>{
 const metrics={latencyByRoute:new Map()};
 observeLatency(metrics,"GET /api",12);
 observeLatency(metrics,"GET /api",1600);
 const metric=metrics.latencyByRoute.get("GET /api");
 assert.equal(metric.count,2);
 assert.equal(metric.sum,1612);
 assert.equal(metric.buckets[1],1);
 assert.equal(metric.buckets[7],1);
 assert.equal(metric.buckets.reduce((a,b)=>a+b,0),2);
});

test("Prometheus HTTP exposition retains counters, escaping and valid content length",async()=>{
 const metrics={
  startedAt:Date.now()-12000,requests:4,errors:0,rateLimited:0,
  authFailures:0,authRateLimited:0,
  rateLimitedByClass:new Map([["public",2]]),
  byStatus:new Map([[200,4]]),
  byRoute:new Map([["/api/custom\"route",4]]),
  latencyByRoute:new Map()
 };
 observeLatency(metrics,'GET "/api"',20);
 const store={
  metrics:async()=>({calls_total:3,calls_connected:2,outbox_pending:0,event_subscribers:1}),
  systemSnapshot:async()=>({cdr_lag_seconds:0,experts_available:4}),
  workQueueHealth:async()=>({pending:1,leased:0,dead_lettered:0,oldest_pending_seconds:0})
 };
 const res={headers:null,body:null,status:null,
  writeHead(status,headers){this.status=status;this.headers=headers;},
  end(body){this.body=body;}
 };
 await metricsResponse(res,metrics,store,{stats:{}});
 assert.equal(res.status,200);
 assert.match(res.headers["Content-Type"],/text\/plain; version=0\.0\.4/);
 assert.equal(res.headers["Content-Length"],Buffer.byteLength(res.body));
 assert.match(res.body,/pgi_calls_total 3/);
 assert.match(res.body,/pgi_work_queue_pending 1/);
 assert.match(res.body,/pgi_http_request_duration_ms_bucket/);
 assert.match(res.body,/pgi_http_route_requests_total\{route="\/api\/custom\\\"route"\} 4/);
 assert.match(res.body,/pgi_http_request_duration_ms_count\{route="GET \\"\/api\\""\} 1/);
 assert.ok(!res.body.includes("undefined"));
});

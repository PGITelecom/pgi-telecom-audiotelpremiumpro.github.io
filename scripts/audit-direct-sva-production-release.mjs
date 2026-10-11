// Operator-only read-only validation for a schema-085 PGI release.
// This script has no credentials embedded and cannot mutate Postgres.
import postgres from "postgres";
import {evaluateDirectSvaReleaseSafety} from "../backend/src/direct-sva-release-safety.mjs";
const uri=process.env.PGI_DATABASE_URL||process.env.DATABASE_URL;
if(!uri)throw Error("PGI_DATABASE_URL_OR_DATABASE_URL_REQUIRED");
const sql=postgres(uri,{ssl:"require",prepare:false,max:1,connect_timeout:8});
try{
 const [units,controls,switches,website,constraints,counts]=await Promise.all([
  sql.unsafe("SELECT unit_code,legal_accounting_profile_id,analytics_namespace,cost_center,display_name,lifecycle_status,direct_distribution_sync_enabled,separate_legal_fec FROM pgi_company_business_units ORDER BY unit_code"),
  sql.unsafe("SELECT id,operator_mode,number_activation_enabled,payouts_enabled FROM direct_sva_operator_controls"),
  sql.unsafe("SELECT id,interface_preview_enabled,commercial_operation_enabled FROM direct_sva_admin_switches"),
  sql.unsafe("SELECT id,public_content_authorized,navigation_enabled,commercial_calls_to_action_enabled FROM direct_sva_website_visibility"),
  sql.unsafe("SELECT c.relname AS table_name,pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid WHERE c.relname IN ('direct_sva_admin_switches','direct_sva_operator_controls','direct_sva_website_visibility')"),
  sql.unsafe("SELECT (SELECT count(*) FROM direct_sva_customer_accounts) AS customers,(SELECT count(*) FROM direct_sva_number_inventory) AS numbers,(SELECT count(*) FROM direct_sva_journal_entries) AS journal,(SELECT count(*) FROM direct_sva_automation_jobs) AS workflows")
 ]);
 const audit=evaluateDirectSvaReleaseSafety({
  units,controls,switches,website,constraints,counters:counts[0]
 });
 console.log("PGI_DISTRIBUTION_RELEASE_READINESS",JSON.stringify(audit));
 if(!audit.ready)process.exitCode=78;
}catch(e){
 console.error("PGI_DISTRIBUTION_RELEASE_NOT_VERIFIED",String(e?.code||e?.name||"ERROR"));
 process.exitCode=78;
}finally{
 await sql.end({timeout:3});
}

// Portable CSV import: no external ETL, spreadsheet or vendor SDK.
// Strictly bounded and parsed as data; never execute formulas or fetch URLs.
import {createHash} from "node:crypto";
import {normalizeCarrierExport} from "./carrier-export-normalizer.mjs";
import {reconcileWholesaleLedger} from "./wholesale-reconciliation-preview.mjs";
function fail(code){const e=new Error(code);e.code=code;e.status=400;throw e;}
export function parseCarrierCsv(csv,delimiter=";"){
 if(typeof csv!=="string"||!csv.length||Buffer.byteLength(csv)>180000||![";",",","\t"].includes(delimiter))fail("CSV_INVALID_INPUT");
 const s=csv.replace(/^\uFEFF/,""),rows=[];let row=[],field="",quoted=false,closed=false;
 const pushField=()=>{if(field.length>4096||row.length>=64)fail("CSV_FIELD_LIMIT");row.push(field);field="";closed=false;};
 const pushRow=()=>{pushField();if(rows.length>=1001)fail("CSV_ROW_LIMIT");rows.push(row);row=[];};
 for(let i=0;i<s.length;i++){
  const c=s[i];
  if(quoted){if(c==='"'){if(s[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
  if(c===delimiter){pushField();continue;}
  if(c==="\r"||c==="\n"){if(c==="\r"&&s[i+1]==="\n")i++;pushRow();continue;}
  if(closed)fail("CSV_UNEXPECTED_AFTER_QUOTE");
  if(c==='"'){if(field.length)fail("CSV_UNEXPECTED_QUOTE");quoted=true;continue;}
  field+=c;
 }
 if(quoted)fail("CSV_UNCLOSED_QUOTE");
 if(row.length||field.length||closed)pushRow();
 if(rows.length<2)fail("CSV_NO_DATA");
 const header=rows.shift();
 if(new Set(header).size!==header.length||header.some(h=>!h||h.length>100||["__proto__","constructor","prototype"].includes(h)))fail("CSV_INVALID_HEADER");
 return rows.map(r=>{if(r.length!==header.length)fail("CSV_COLUMN_COUNT");return Object.fromEntries(header.map((h,i)=>[h,r[i]]));});
}
export function normalizeCarrierCsv(input={}){
 if(!input||typeof input!=="object")fail("CSV_INVALID_INPUT");
 const parsed=parseCarrierCsv(input.csv,input.delimiter);
 const convention=input.decimal_separator??".";
 if(![".",","].includes(convention))fail("CSV_INVALID_DECIMAL_SEPARATOR");
 // Map arbitrary real provider header labels to safe canonical aliases. No
 // inference or fuzzy matching: exact header names, one canonical field each.
 const mapping=input.field_mapping;
 if(!mapping||typeof mapping!=="object"||Array.isArray(mapping))fail("CSV_MAPPING_INVALID");
 const canonical=new Map(),aliasMapping={};
 for(const [header,field] of Object.entries(mapping)){
  if(!Object.hasOwn(parsed[0],header)||typeof field!=="string"||canonical.has(field))fail("CSV_MAPPING_INVALID");
  const alias="col_"+canonical.size;
  canonical.set(field,{header,alias});aliasMapping[alias]=field;
 }
 const rows=parsed.map(row=>Object.fromEntries([...canonical.entries()].map(([field,{header,alias}])=>{
  let value=row[header];
  if(field==="confirmed_payout_ht"&&convention===","){
   if(!/^\d{1,7}(?:,\d{1,6})?$/.test(value))fail("CSV_INVALID_DECIMAL_AMOUNT");
   value=value.replace(",",".");
  }
  return [alias,value];
 })));
 const result=normalizeCarrierExport({...input,field_mapping:aliasMapping,rows});
 return Object.freeze({...result,raw_file_sha256:createHash("sha256").update(input.csv,"utf8").digest("hex")});
}
export async function reconcileCarrierCsv(store,input={}){
 // Reconcile the entire submitted file, not just selected matching rows.
 const normalized=normalizeCarrierCsv({...input,provider_key:"carrier-"+String(input.carrier_id)});
 const from=Date.parse(input.from_utc),to=Date.parse(input.to_utc);
 if(!Number.isFinite(from)||!Number.isFinite(to)||normalized.rows.some(r=>Date.parse(r.started_at)<from||Date.parse(r.started_at)>=to))fail("CSV_OUTSIDE_RECONCILIATION_WINDOW");
 const result=await reconcileWholesaleLedger(store,{...input,reported_rows:normalized.rows.map(r=>({external_call_id:r.external_call_id,reported_micro_eur:r.reported_payout_micro_eur}))});
 return Object.freeze({...result,raw_file_sha256:normalized.raw_file_sha256,canonical_export_digest:normalized.canonical_digest});
}

import fs from "node:fs";
import path from "node:path";

const dir="database/migrations";
const failures=[];
const files=fs.readdirSync(dir)
  .filter(name=>name.endsWith(".sql"))
  .sort();

if(!files.length)failures.push("no migration files found");

const seen=new Set();
let previous=0;
for(const file of files){
  const match=file.match(/^(\d{3})_[A-Za-z0-9_.-]+\.sql$/);
  if(!match){
    failures.push("invalid migration filename: "+file);
    continue;
  }
  const number=Number(match[1]);
  if(seen.has(number))failures.push("duplicate migration number: "+match[1]);
  seen.add(number);
  if(number<=previous)failures.push("migration order is not strictly increasing: "+file);
  previous=number;

  const raw=fs.readFileSync(path.join(dir,file),"utf8");
  const sql=raw
    .replace(/\/\*[\s\S]*?\*\//g," ")
    .replace(/--.*$/gm," ")
    .replace(/\s+/g," ")
    .trim()
    .toUpperCase();

  // Exception strictly scoped to the owner's editorial publication switch:
  // migration 085 removes exactly two obsolete publication-only CHECK guards,
  // never a table, column, data record or the commercial-operation guard.
  let inspectedSql=sql;
  if(file==="085_direct_sva_admin_editorial_release.sql"){
    const approved=[
      /ALTER\s+TABLE\s+DIRECT_SVA_WEBSITE_VISIBILITY\s+DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+DIRECT_SVA_WEBSITE_VISIBILITY_PUBLIC_CONTENT_AUTHORIZED_CHECK\s*;/g,
      /ALTER\s+TABLE\s+DIRECT_SVA_WEBSITE_VISIBILITY_AUDIT\s+DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+DIRECT_SVA_WEBSITE_VISIBILITY_AUDIT_SWITCH_NAME_CHECK\s*;/g
    ];
    for(const pattern of approved){
      const found=[...inspectedSql.matchAll(pattern)];
      if(found.length!==1)failures.push(file+" missing or duplicated approved CHECK evolution");
      inspectedSql=inspectedSql.replace(pattern," ");
    }
  }
  const forbidden=[
    [/\bDROP\s+(TABLE|SCHEMA|DATABASE|INDEX|VIEW|FUNCTION|TRIGGER|TYPE|COLUMN)\b/,"DROP"],
    [/\bTRUNCATE\b/,"TRUNCATE"],
    [/\bALTER\s+TABLE\b[\s\S]*\bDROP\b/,"ALTER TABLE DROP"],
    [/\bALTER\s+TABLE\b[\s\S]*\bRENAME\b/,"ALTER TABLE RENAME"],
    [/\bALTER\s+TABLE\b[\s\S]*\bALTER\s+COLUMN\b/,"ALTER COLUMN"],
    [/\bALTER\s+TYPE\b/,"ALTER TYPE"],
    [/\bDELETE\s+FROM\b/,"DELETE FROM"],
    [/\bCREATE\s+OR\s+REPLACE\s+(VIEW|FUNCTION|PROCEDURE|TRIGGER)\b/,"CREATE OR REPLACE behavioral object"]
  ];

  for(const [pattern,label] of forbidden){
    if(pattern.test(inspectedSql))failures.push(file+" contains destructive operation: "+label);
  }
}

if(failures.length){
  failures.forEach(x=>console.error("FAIL:",x));
  process.exit(1);
}
console.log("Migration safety: OK ("+files.length+" migrations, 2 narrowly audited CHECK releases in 085)");

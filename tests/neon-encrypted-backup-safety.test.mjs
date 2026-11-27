import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import fs from "node:fs";

const script = "scripts/backup-neon-encrypted.sh";
test("Neon backup script passes shell syntax inspection", () => {
 const result=spawnSync("bash",["-n",script],{encoding:"utf8"});
 assert.equal(result.status,0,result.stderr);
});
test("Neon backup fails closed without production credentials",()=>{
 const result=spawnSync("bash",[script],{
  encoding:"utf8",timeout:10000,
  env:{PATH:process.env.PATH,HOME:process.env.HOME||"/tmp"}
 });
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/PGI_NEON_DATABASE_URL/);
 assert.doesNotMatch(result.stdout,/NEON_BACKUP_ENCRYPTED_ARCHIVE_CREATED/);
});
test("Neon backup never exports data into the repository or deletes archives",()=>{
 const text=fs.readFileSync(script,"utf8");
 assert.match(text,/destination must be outside this repository/);
 assert.match(text,/age -r/);
 assert.match(text,/age -d -i/);
 assert.match(text,/pg_restore --list/);
 assert.match(text,/sha256sum --check/);
 assert.doesNotMatch(text,/rm -rf -- "\$outdir"/);
 assert.doesNotMatch(text,/pg_restore\s+.*--dbname=.*main/);
});


const restoreDrill="scripts/restore-neon-encrypted-drill.sh";
test("recovery drill passes Bash syntax verification",()=>{
 const result=spawnSync("bash",["-n",restoreDrill],{encoding:"utf8"});
 assert.equal(result.status,0,result.stderr);
});
test("recovery drill refuses missing archived customer backup",()=>{
 const result=spawnSync("bash",[restoreDrill],{
  encoding:"utf8",timeout:10000,
  env:{PATH:process.env.PATH,HOME:process.env.HOME||"/tmp"}
 });
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/PGI_BACKUP_ARCHIVE/);
 assert.doesNotMatch(result.stdout,/isolated restore and schema verified/);
});
test("recovery drill must only use 127.0.0.1, require checksum, and clean test database",()=>{
 const text=fs.readFileSync(restoreDrill,"utf8");
 assert.match(text,/PGHOST=127\.0\.0\.1/);
 assert.match(text,/PGHOSTADDR=127\.0\.0\.1/);
 assert.match(text,/unset PGDATABASE PGHOSTADDR PGSERVICE/);
 assert.match(text,/sha256sum --check --status/);
 assert.match(text,/createdb --host=127\.0\.0\.1/);
 assert.match(text,/dropdb --if-exists --host=127\.0\.0\.1/);
 assert.match(text,/age -d -i/);
 assert.match(text,/pg_restore --exit-on-error --single-transaction/);
 assert.match(text,/public\.calls/);
 assert.match(text,/public\.experts/);
 assert.doesNotMatch(text,/PGI_NEON_DATABASE_URL/);
});

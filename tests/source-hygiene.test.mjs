import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {
 inspectSourceUnicode,inspectImageMetadata,auditRepository
} from "../scripts/scan-source-hygiene.mjs";

test("detects exact invisible Unicode codepoints without changing source",()=>{
 const mark=String.fromCodePoint(0x200B),joiner=String.fromCodePoint(0x2060);
 const content="Bonjour"+mark+" le monde\nA"+joiner+"B";
 const before=content;
 const found=inspectSourceUnicode(content,"site/seo/page.html");
 assert.deepEqual(found.map(x=>[x.line,x.column,x.codepoint]),[
  [1,8,"U+200B"],[2,2,"U+2060"]
 ]);
 assert.equal(content,before);
});

test("preserves legitimate escaped BOM for CSV and Unicode joiners",()=>{
 const escaped=String.raw`const csv = "\uFEFF" + rows.join("\n");`;
 assert.deepEqual(inspectSourceUnicode(escaped,"assets/export.js"),[]);
 const legit="a"+String.fromCodePoint(0x200D)+"b"+
  String.fromCodePoint(0x200C)+"c"+String.fromCodePoint(0x00A0)+"d";
 assert.deepEqual(inspectSourceUnicode(legit,"site/index.html"),[]);
});

test("flags bidi overrides in executable code but not ordinary multilingual copy",()=>{
 const content="a"+String.fromCodePoint(0x202E)+"b";
 assert.deepEqual(inspectSourceUnicode(content,"assets/client.js").map(x=>x.kind),[
  "BIDI_CONTROL_IN_EXECUTABLE"
 ]);
 assert.deepEqual(inspectSourceUnicode(content,"site/seo/text.html"),[]);
});

test("detects image metadata containers but never modifies image bytes",()=>{
 const pngHeader=Buffer.from("89504e470d0a1a0a","hex");
 const pngChunk=(type,payload)=>Buffer.concat([
  Buffer.from([0,0,0,payload.length]),Buffer.from(type,"ascii"),
  payload,Buffer.alloc(4)
 ]);
 const png=Buffer.concat([pngHeader,
  pngChunk("iTXt",Buffer.from("XML:com.adobe.xmp\0hello","latin1")),
  pngChunk("caBX",Buffer.from("jumb", "ascii")),
  pngChunk("IEND",Buffer.alloc(0))
 ]);
 const before=Buffer.from(png);
 assert.deepEqual(inspectImageMetadata(png,"assets/preview.png").metadata,[
  "C2PA_CONTAINER","XMP"
 ]);
 assert.deepEqual(png,before);
 const webp=Buffer.alloc(12+8+4);
 webp.write("RIFF",0,"ascii");webp.writeUInt32LE(webp.length-8,4);
 webp.write("WEBP",8,"ascii");webp.write("XMP ",12,"ascii");
 webp.writeUInt32LE(4,16);
 assert.deepEqual(inspectImageMetadata(webp,"site/hero.webp").metadata,["XMP"]);
 const jpeg=Buffer.concat([
  Buffer.from([0xFF,0xD8,0xFF,0xE1,0x00,0x08]),
  Buffer.from("Exif\0\0","binary"),Buffer.from([0xFF,0xD9])
 ]);
 assert.deepEqual(inspectImageMetadata(jpeg,"site/scan.jpeg").metadata,["EXIF"]);
 assert.equal(inspectImageMetadata(Buffer.alloc(12),"a.webp").invalid_header,true);
});

test("repository audit covers text and images without rewriting anything",()=>{
 const root=mkdtempSync(join(tmpdir(),"app-source-hygiene-"));
 try{
  mkdirSync(join(root,"site"));
  writeFileSync(join(root,"site","text.html"),"propre");
  writeFileSync(join(root,"site","dirty.js"),
   "let note=\""+String.fromCodePoint(0x00AD)+"\";");
  writeFileSync(join(root,"site","bad.webp"),Buffer.alloc(12));
  const report=auditRepository({root,trackedFiles:[
   "site/text.html","site/dirty.js","site/bad.webp"
  ]});
  assert.equal(report.summary.text_files,2);
  assert.equal(report.summary.image_files,1);
  assert.equal(report.errors.length,2);
  assert.ok(report.errors.some(x=>x.codepoint==="U+00AD"));
  assert.ok(report.errors.some(x=>x.kind==="INVALID_IMAGE_HEADER"));
  assert.ok(report.limits.some(x=>x.includes("textGrain")));
 }finally{rmSync(root,{recursive:true,force:true});}
});

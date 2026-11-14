/**
 * Read-only source integrity scanner.
 *
 * Applies the conservative Unicode inspection rules from the owner's private
 * Watermarks Remover workflow. It is NOT an AI-author detector and cannot
 * detect keyed textGrain, SynthID, pixel-domain marks or C2PA soft bindings.
 *
 * Deliberately never rewrites source, removes metadata or changes provenance.
 */
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {resolve,extname} from "node:path";
import {fileURLToPath} from "node:url";

export const SUSPICIOUS_UNICODE=Object.freeze(new Map([
 [0x200B,"ZERO_WIDTH_SPACE"],[0x2060,"WORD_JOINER"],
 [0xFEFF,"ZERO_WIDTH_NO_BREAK_SPACE_OR_BOM"],
 [0x00AD,"SOFT_HYPHEN"],[0x034F,"COMBINING_GRAPHEME_JOINER"]
]));
const isExecutable=path=>/\.(?:mjs|cjs|js|ts|jsx|tsx|sql|sh)$/i.test(path);
const isText=path=>/\.(?:mjs|cjs|js|ts|jsx|tsx|json|html?|css|md|mdx|txt|xml|ya?ml|sql|sh|svg|webmanifest|toml)$/i.test(path);
const isImage=path=>/\.(?:png|jpe?g|webp)$/i.test(path);

/**
 * Return exact codepoints and offsets only, without echoing any file content.
 * Bidi formatting controls are reported as security findings in executable
 * sources; multilingual joiners, nonbreaking spaces, typography are preserved.
 */
export function inspectSourceUnicode(source,path="source.txt"){
 const findings=[];
 for(let i=0,line=1,column=1;i<source.length;i++){
  const cp=source.codePointAt(i);
  const flagged=SUSPICIOUS_UNICODE.get(cp);
  const bidi=isExecutable(path)&&
   ((cp>=0x202A&&cp<=0x202E)||(cp>=0x2066&&cp<=0x2069));
  if(cp===0||flagged||bidi)findings.push({
   path,line,column,codepoint:"U+"+cp.toString(16).toUpperCase().padStart(4,"0"),
   kind:cp===0?"NUL_BYTE":flagged||"BIDI_CONTROL_IN_EXECUTABLE"
  });
  if(cp===10){line++;column=1;}else column++;
  if(cp>0xFFFF)i++;
 }
 return findings;
}

function unique(parts){
 return [...new Set(parts)].sort();
}

/**
 * Detect selected *metadata containers*, not a watermark in rendered pixels.
 * These findings require a human provenance/copyright review before removal.
 */
export function inspectImageMetadata(data,path){
 if(!Buffer.isBuffer(data))throw new TypeError("IMAGE_BUFFER_REQUIRED");
 const ext=extname(path).toLowerCase(),found=[];
 if(ext===".png"){
  if(data.subarray(0,8).toString("hex")!=="89504e470d0a1a0a")return {format:"png",invalid_header:true,metadata:[]};
  for(let p=8;p+12<=data.length;){
   const len=data.readUInt32BE(p),end=p+12+len;
   if(end>data.length)break;
   const type=data.toString("ascii",p+4,p+8);
   if(type==="eXIf")found.push("EXIF");
   if(type==="caBX")found.push("C2PA_CONTAINER");
   if(type==="iTXt"||type==="tEXt"||type==="zTXt"){
    const keyword=data.toString("latin1",p+8,Math.min(p+8+len,p+120)).split("\0")[0];
    if(/xmp/i.test(keyword))found.push("XMP");
    if(/^(?:author|creator|software|comment|description|creation time)$/i.test(keyword))found.push("TEXT_METADATA:"+keyword.toLowerCase());
   }
   p=end;
   if(type==="IEND")break;
  }
 }else if(ext===".jpg"||ext===".jpeg"){
  if(data.length<2||data[0]!==0xFF||data[1]!==0xD8)return {format:"jpeg",invalid_header:true,metadata:[]};
  for(let p=2;p+4<=data.length;){
   if(data[p]!==0xFF)break;
   let marker=data[p+1],start=p+4;
   if(marker===0xD9||marker===0xDA)break;
   if(marker===0x01||(marker>=0xD0&&marker<=0xD7)){p+=2;continue;}
   const len=data.readUInt16BE(p+2);
   if(len<2||p+2+len>data.length)break;
   if(marker===0xE1){
    const head=data.toString("latin1",start,Math.min(start+80,p+2+len));
    if(head.startsWith("Exif\0\0"))found.push("EXIF");
    if(/xap\/1\.0\/|xmp\/extension/i.test(head))found.push("XMP");
   }
   if(marker===0xEB){
    const head=data.toString("latin1",start,Math.min(start+96,p+2+len));
    if(/jumb|c2pa/i.test(head))found.push("POSSIBLE_C2PA_CONTAINER");
   }
   p+=2+len;
  }
 }else if(ext===".webp"){
  if(data.length<12||data.toString("ascii",0,4)!=="RIFF"||data.toString("ascii",8,12)!=="WEBP")
   return {format:"webp",invalid_header:true,metadata:[]};
  for(let p=12;p+8<=data.length;){
   const type=data.toString("ascii",p,p+4),len=data.readUInt32LE(p+4),end=p+8+len+(len%2);
   if(end>data.length)break;
   if(type==="EXIF")found.push("EXIF");
   if(type==="XMP ")found.push("XMP");
   if(type==="C2PA")found.push("C2PA_CONTAINER");
   p=end;
  }
 }else return {format:"unsupported",invalid_header:false,metadata:[]};
 return {format:ext.slice(1),invalid_header:false,metadata:unique(found)};
}

export function auditRepository({root=resolve(fileURLToPath(new URL("../",import.meta.url))),trackedFiles=null}={}){
 const paths=trackedFiles??execFileSync("git",["ls-files","-z"],{
  cwd:root,encoding:"utf8",maxBuffer:12*1024*1024
 }).split("\0").filter(Boolean);
 const errors=[],metadata=[],summary={text_files:0,image_files:0,files_with_metadata:0};
 const decoder=new TextDecoder("utf-8",{fatal:true});
 for(const path of paths){
  if(!isText(path)&&!isImage(path))continue;
  const content=readFileSync(resolve(root,path));
  if(isText(path)){
   summary.text_files++;
   let source;
   try{source=decoder.decode(content);}catch{
    errors.push({path,kind:"INVALID_UTF8_SOURCE"});continue;
   }
   errors.push(...inspectSourceUnicode(source,path));
   if(path.endsWith(".svg")&&/<metadata(?:\s|>)/i.test(source))
    metadata.push({path,types:["SVG_METADATA"]});
  }else{
   summary.image_files++;
   const report=inspectImageMetadata(content,path);
   if(report.invalid_header)errors.push({path,kind:"INVALID_IMAGE_HEADER"});
   if(report.metadata.length)metadata.push({path,types:report.metadata});
  }
 }
 summary.files_with_metadata=metadata.length;
 return {summary,errors,metadata,limits:[
  "No statistical textGrain detector",
  "Metadata containers are not proof of AI provenance",
  "No analysis of image pixels or remote C2PA soft binding",
  "Read-only: preserves original source, provenance and media"
 ]};
}

// Executed by CI, never by importing this module into the test runner.
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=auditRepository();
 console.log("SOURCE_HYGIENE_REPORT",JSON.stringify(result));
 if(result.errors.length)process.exitCode=1;
}

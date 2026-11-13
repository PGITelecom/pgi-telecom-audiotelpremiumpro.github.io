import {readFileSync} from "node:fs";
import {inflateSync,deflateSync} from "node:zlib";

const MONTH=/^20\d{2}-(0[1-9]|1[0-2])$/;
const CURRENCY=/^[A-Z]{3}$/;
const STATUSES=new Set(["open","reconciled","invoiced","payable","paid","disputed"]);

function asDate(value){
  if(value instanceof Date)return Number.isFinite(value.valueOf())?value.toISOString().slice(0,10):"";
  const s=String(value||"");
  return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):"";
}
function amount(value){const n=Number(value);return Number.isFinite(n)?n:0;}
function two(value){return Math.round(amount(value)*100)/100;}
function money(value,currency){
  return new Intl.NumberFormat("fr-FR",{style:"currency",currency:currency||"EUR",minimumFractionDigits:2}).format(two(value)).replace(/\u202f/g," ");
}
function clean(value,max=100){return String(value??"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function rowsForMonth(rows,month,currency){
  if(!MONTH.test(month)||!CURRENCY.test(currency))return [];
  return (Array.isArray(rows)?rows:[]).filter(r=>asDate(r.period_end).slice(0,7)===month&&String(r.currency||"").trim()===currency&&STATUSES.has(String(r.status||"")));
}
export function monthlySettlementIndex(rows){
  const groups=new Map();
  for(const r of Array.isArray(rows)?rows:[]){
    const period=asDate(r.period_end).slice(0,7),currency=String(r.currency||"").trim();
    if(!MONTH.test(period)||!CURRENCY.test(currency)||!STATUSES.has(String(r.status||"")))continue;
    const key=period+"|"+currency;
    if(!groups.has(key))groups.set(key,{period,currency,records:0,net_payout_ht:0,platform_fee_ht:0,upstream_payout_ht:0,paid_records:0,disputed_records:0,open_records:0});
    const g=groups.get(key);g.records++;g.net_payout_ht+=amount(r.net_payout_ht);g.platform_fee_ht+=amount(r.platform_fee_ht);g.upstream_payout_ht+=amount(r.upstream_payout_ht);
    if(r.status==="paid")g.paid_records++;
    if(r.status==="disputed")g.disputed_records++;
    if(r.status==="open")g.open_records++;
  }
  return [...groups.values()].sort((a,b)=>b.period.localeCompare(a.period)||a.currency.localeCompare(b.currency)).map(g=>({
    ...g,net_payout_ht:two(g.net_payout_ht),platform_fee_ht:two(g.platform_fee_ht),upstream_payout_ht:two(g.upstream_payout_ht),
    status:g.open_records||g.disputed_records?"provisional":"reconciled",
    downloadable:true
  }));
}
export function monthlySettlementReport({tenant={},rows=[],period,currency}={}){
  const selected=rowsForMonth(rows,period,currency);
  if(!selected.length)return null;
  const summaries=monthlySettlementIndex(selected);
  const summary=summaries.find(g=>g.period===period&&g.currency===currency);
  if(!summary)return null;
  return {
    kind:"non_fiscal_sva_statement",reference:"RELEVE-SVA-"+period+"-"+currency,
    period,currency,customer_name:clean(tenant.legal_name||tenant.display_name||"Titulaire du dossier",180),
    ...summary,
    lines:selected.map(r=>({
      period_start:asDate(r.period_start),period_end:asDate(r.period_end),
      upstream_payout_ht:two(r.upstream_payout_ht),platform_fee_ht:two(r.platform_fee_ht),
      net_payout_ht:two(r.net_payout_ht),status:clean(r.status,30),
      paid_at:asDate(r.paid_at),payment_due_date:asDate(r.payment_due_date),
      statement_reference:clean(r.statement_reference||"Non renseignée",80)
    }))
  };
}
export function publicInvoiceUrl(value){
  if(typeof value!=="string"||value.length>2048)return null;
  try{const u=new URL(value);if(u.protocol!=="https:"||!(u.hostname==="stripe.com"||u.hostname.endsWith(".stripe.com"))||u.username||u.password)return null;return u.href;}
  catch{return null;}
}

/* PNG decoder. Supports the project's indexed/RGB/RGBA, 8-bit brand logo.
   Flattens transparency on white; no font or executable content is imported. */
function logoRgb(){
  let png;
  try{png=readFileSync(new URL("../../assets/audiotel-brand-logo-v33.png",import.meta.url));}catch{return null;}
  if(!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return null;
  let width=0,height=0,bits=0,type=0,palette=null,alpha=null;const compressed=[];
  for(let i=8;i+12<=png.length;){
    const len=png.readUInt32BE(i),name=png.toString("ascii",i+4,i+8);if(len>png.length-i-12)return null;
    const data=png.subarray(i+8,i+8+len);
    if(name==="IHDR"){width=data.readUInt32BE(0);height=data.readUInt32BE(4);bits=data[8];type=data[9];}
    if(name==="PLTE")palette=data;
    if(name==="tRNS")alpha=data;
    if(name==="IDAT")compressed.push(data);
    i+=12+len;if(name==="IEND")break;
  }
  const channels=({0:1,2:3,3:1,4:2,6:4})[type];
  if(!channels||bits!==8||!width||!height||width*height>2000000||type===3&&!palette)return null;
  const stride=width*channels,raw=inflateSync(Buffer.concat(compressed));
  if(raw.length<(stride+1)*height)return null;
  const out=Buffer.alloc(width*height*3),previous=Buffer.alloc(stride);let offset=0;
  for(let y=0;y<height;y++){
    const filter=raw[offset++],row=Buffer.from(raw.subarray(offset,offset+stride));offset+=stride;
    if(filter>4)return null;
    for(let i=0;i<stride;i++){
      const left=i>=channels?row[i-channels]:0,up=previous[i],ul=i>=channels?previous[i-channels]:0;
      let predictor=0;
      if(filter===1)predictor=left;
      if(filter===2)predictor=up;
      if(filter===3)predictor=Math.floor((left+up)/2);
      if(filter===4){const p=left+up-ul,pa=Math.abs(p-left),pb=Math.abs(p-up),pc=Math.abs(p-ul);predictor=pa<=pb&&pa<=pc?left:pb<=pc?up:ul;}
      row[i]=(row[i]+predictor)&255;
    }
    for(let x=0;x<width;x++){
      const k=x*channels,p=(y*width+x)*3,ix=row[k];
      let r,g,b,a=255;
      if(type===3){r=palette[ix*3]??255;g=palette[ix*3+1]??255;b=palette[ix*3+2]??255;a=alpha?.[ix]??255;}
      else if(type===2){r=ix;g=row[k+1];b=row[k+2];}
      else if(type===6){r=ix;g=row[k+1];b=row[k+2];a=row[k+3];}
      else if(type===4){r=g=b=ix;a=row[k+1];}
      else {r=g=b=ix;}
      out[p]=Math.round((r*a+255*(255-a))/255);
      out[p+1]=Math.round((g*a+255*(255-a))/255);
      out[p+2]=Math.round((b*a+255*(255-a))/255);
    }
    row.copy(previous);
  }
  return {width,height,compressed:deflateSync(out,{level:9})};
}
function pdfText(s){
  const special={"€":"\x80","’":"\x92","“":"\x93","”":"\x94","œ":"oe","Œ":"OE","–":"-"," ":" "," ":" "};
  let value=clean(s,800).replace(/[€’“”œŒ–  ]/g,ch=>special[ch]);
  value=value.replace(/[^\x20-\x7e\x80-\xff]/g,"?");
  return value.replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)");
}
function pdfBuffer(objects,root){
  const segments=[Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n","latin1")],offsets=[0];let size=segments[0].length;
  for(let i=0;i<objects.length;i++){
    offsets.push(size);
    const b=Buffer.concat([Buffer.from(String(i+1)+" 0 obj\n","ascii"),objects[i],Buffer.from("\nendobj\n","ascii")]);
    segments.push(b);size+=b.length;
  }
  const xref=size;
  let tail="xref\n0 "+(objects.length+1)+"\n0000000000 65535 f \n";
  for(let i=1;i<offsets.length;i++)tail+=String(offsets[i]).padStart(10,"0")+" 00000 n \n";
  tail+="trailer\n<< /Size "+(objects.length+1)+" /Root "+root+" 0 R >>\nstartxref\n"+xref+"\n%%EOF\n";
  segments.push(Buffer.from(tail,"ascii"));return Buffer.concat(segments);
}
function objectWriter(){
  const objects=[];
  return {objects,
    add(b){objects.push(Buffer.isBuffer(b)?b:Buffer.from(String(b),"latin1"));return objects.length;},
    stream(dict,body){const data=Buffer.isBuffer(body)?body:Buffer.from(String(body),"latin1");return this.add(Buffer.concat([Buffer.from("<< "+dict+" /Length "+data.length+" >>\nstream\n","ascii"),data,Buffer.from("\nendstream","ascii")]));}
  };
}
/* No third-party PDF renderer. PDF consists only of verified ledger entries. */
export function createMonthlySettlementPdf(report){
  if(!report||report.kind!=="non_fiscal_sva_statement"||!MONTH.test(report.period)||!CURRENCY.test(report.currency))throw new Error("INVALID_STATEMENT");
  const w=objectWriter(),normal=w.add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),bold=w.add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  let logo=null;try{logo=logoRgb();}catch{logo=null;}
  const logoId=logo?w.stream("/Type /XObject /Subtype /Image /Width "+logo.width+" /Height "+logo.height+" /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode",logo.compressed):null;
  const pagesId=w.add("<< /Type /Pages /Kids [] /Count 0 >>"),pageIds=[];
  const lines=Array.isArray(report.lines)?report.lines:[],perPage=11,totalPages=Math.max(1,Math.ceil(lines.length/perPage));
  const statusMap={open:"En attente",reconciled:"Rapproché",invoiced:"Facturé (registre)",payable:"À régler",paid:"Réglé (registre)",disputed:"Contesté"};
  for(let page=0;page<totalPages;page++){
    const cmds=[];
    const text=(s,x,y,size=9,strong=false)=>{cmds.push("BT /"+(strong?"F2":"F1")+" "+size+" Tf 1 0 0 1 "+x+" "+y+" Tm ("+pdfText(s)+") Tj ET");};
    const rule=(y)=>cmds.push("0.78 0.81 0.84 RG 38 "+y+" m 557 "+y+" l S");
    cmds.push("0.16 0.21 0.28 rg 0 772 595 70 re f");
    if(logoId)cmds.push("q 173 0 0 55 40 780 cm /Brand Do Q");
    else {cmds.push("1 1 1 rg");text("AUDIOTEL PREMIUM PRO",43,807,16,true);}
    cmds.push("0.16 0.21 0.28 rg");
    text("RELEVÉ MENSUEL DES REVERSEMENTS SVA",40,745,15,true);
    text("Document de suivi non fiscal. Ne constitue pas une facture.",40,726,9);
    text("Référence : "+report.reference,40,706,9);
    text("Période : "+report.period+"  |  Devise : "+report.currency,40,690,9);
    text("Client : "+report.customer_name,40,672,10,true);
    rule(660);
    text("Net client : "+money(report.net_payout_ht,report.currency),40,641,12,true);
    text("Quote-part plateforme : "+money(report.platform_fee_ht,report.currency),40,621,10);
    text("Montant opérateur amont : "+money(report.upstream_payout_ht,report.currency),40,603,10);
    text(report.disputed_records||report.open_records?"Attention : écritures ouvertes ou contestées, chiffres susceptibles de correction.":"Montants issus du registre de rapprochement de la plateforme.",40,583,8);
    rule(568);
    text("Période du relevé",41,551,9,true);text("Net HT",236,551,9,true);text("Statut",327,551,9,true);text("Référence opérateur",420,551,9,true);
    rule(542);
    const first=page*perPage;
    lines.slice(first,first+perPage).forEach((line,i)=>{
      const y=524-i*34;
      text((line.period_start||"?")+" / "+(line.period_end||"?"),41,y,8);
      text(money(line.net_payout_ht,report.currency),237,y,8,true);
      text(statusMap[line.status]||line.status,327,y,8);
      text(clean(line.statement_reference,21),420,y,8);
      text("Échéance : "+(line.payment_due_date||"Non renseignée")+"    Date de règlement inscrite : "+(line.paid_at||"Non renseignée"),41,y-13,7);
      rule(y-20);
    });
    cmds.push("0.16 0.21 0.28 rg");
    text("Les statuts reflètent le registre interne. Un paiement ne prouve pas à lui seul le crédit sur l'IBAN.",40,105,8);
    text("Le détail contractuel, les contestations et les justificatifs de l'opérateur font foi.",40,91,8);
    text("Audiotel Premium Pro  |  Relevé SVA non fiscal  |  "+(page+1)+"/"+totalPages,40,55,8);
    const content=w.stream("",cmds.join("\n")+"\n");
    const resources="<< /Font << /F1 "+normal+" 0 R /F2 "+bold+" 0 R >> "+(logoId?"/XObject << /Brand "+logoId+" 0 R >> ":"")+">>";
    pageIds.push(w.add("<< /Type /Page /Parent "+pagesId+" 0 R /MediaBox [0 0 595 842] /Resources "+resources+" /Contents "+content+" 0 R >>"));
  }
  w.objects[pagesId-1]=Buffer.from("<< /Type /Pages /Kids ["+pageIds.map(id=>id+" 0 R").join(" ")+"] /Count "+pageIds.length+" >>","ascii");
  const root=w.add("<< /Type /Catalog /Pages "+pagesId+" 0 R >>");
  return pdfBuffer(w.objects,root);
}

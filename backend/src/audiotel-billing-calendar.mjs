/** Calendar-month introductory offer, France. Pure function; NOT a Stripe subscription. */
const dtf=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function parts(date){const x=Object.fromEntries(dtf.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));return x;}
function fail(s){const e=new Error(s);e.code=s;throw e;}
function parisOffsetAt(instant){const p=parts(instant);const localUtc=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);return localUtc-Math.floor(instant.getTime()/1000)*1000;}
function parisMidnight(y,month){
 const guess=new Date(Date.UTC(y,month-1,1));
 // Paris has no DST transition at midnight on the first day of the month.
 const utc=new Date(guess.getTime()-parisOffsetAt(guess));
 const p=parts(utc);
 if(p.year!==y||p.month!==month||p.day!==1||p.hour!==0||p.minute!==0)fail('PARIS_BILLING_CUTOFF_INVALID');
 return utc;
}
export function introductoryCurrentMonthFree(start){
 const t=new Date(start);
 if(!Number.isFinite(t.getTime()))fail('BILLING_START_INVALID');
 const p=parts(t),next=new Date(Date.UTC(p.year,p.month,1));
 const firstOfNext=parisMidnight(next.getUTCFullYear(),next.getUTCMonth()+1);
 if(firstOfNext<=t)fail('BILLING_TRIAL_WINDOW_INVALID');
 return Object.freeze({offer:'calendar_month_current_free',zone:'Europe/Paris',
  starts_at:t.toISOString(),trial_ends_at:firstOfNext.toISOString(),
  first_billable_period_starts_at:firstOfNext.toISOString(),
  charge_authorized:false,invoice_generated:false,
  must_display_end_date_before_acceptance:true});
}

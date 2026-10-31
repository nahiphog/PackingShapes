// Compare a certified rational size with the SOURCE CLAIM, never claim record priority.
const fraction=s=>{
  if(typeof s!=='string')throw Error('Exact size must be a string, not a floating-point Number');
  if(/^[-+]?\d+\/\d+$/.test(s)){const [n,d]=s.split('/').map(BigInt);if(d<=0n)throw Error('Nonpositive denominator');return [n,d];}
  const m=/^([+-]?)(\d+)(?:\.(\d*))?$/.exec(s);if(!m)throw Error('Expected decimal or fraction');
  return [BigInt(m[2]+(m[3]??''))*(m[1]==='-'?-1n:1n),10n**BigInt((m[3]??'').length)];
};
const compare=(a,b)=>{const d=a[0]*b[1]-b[0]*a[1];return d<0n?-1:d>0n?1:0;};
export function compareReportedBound(record, certifiedSize) {
  const value=fraction(certifiedSize);
  if(value[0]<=0n)throw Error('Size must be positive');
  const bound=record.reported_incumbent;
  let relation;
  if(bound.squared_value){
    const sign=compare([value[0]*value[0],value[1]*value[1]],[BigInt(bound.squared_value.numerator),BigInt(bound.squared_value.denominator)]);
    relation=sign<0?'below_reported_exact_value':sign===0?'equals_reported_exact_value':'above_reported_exact_value';
  }else{
    const interval=bound.reported_precision_interval;
    if(!interval) return {relation:'unavailable',world_record_established:false};
    relation=compare(value,fraction(interval.lower))<0?'below_reported_precision_interval':compare(value,fraction(interval.upper))>=0?'above_reported_precision_interval':'within_reported_precision_interval';
  }
  return {relation,world_record_established:false,notice:'Comparison concerns a frozen source claim only. Candidate feasibility, source completeness, competing submissions, and record priority need separate evidence.'};
}

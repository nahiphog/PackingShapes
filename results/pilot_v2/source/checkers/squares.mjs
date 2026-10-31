/** Exact feasibility checker for congruent unit squares. No search dependencies. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const gcd = (a,b) => { a=a<0n?-a:a; b=b<0n?-b:b; while(b) [a,b]=[b,a%b]; return a; };
export class Rational {
  constructor(n,d=1n) { n=BigInt(n); d=BigInt(d); if(!d) throw Error('Zero denominator'); if(d<0n){n=-n;d=-d;} const g=gcd(n,d);this.n=n/g;this.d=d/g; }
  static parse(value) {
    if(value instanceof Rational) return value;
    if(typeof value!=='string') throw Error('Exact numbers must be strings');
    if(value.length>10000) throw Error('Exact number too long');
    if(/^-?\d+\/\d+$/.test(value)){const [n,d]=value.split('/');return new Rational(n,d);}
    const m=/^([+-]?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(value);
    if(!m) throw Error(`Invalid rational: ${value}`);
    const exp=Number(m[4]||0)-(m[3]||'').length;
    if(!Number.isSafeInteger(exp)||Math.abs(exp)>10000) throw Error('Exponent out of range');
    let n=BigInt(m[2]+(m[3]||''))*(m[1]==='-'?-1n:1n);
    return exp>=0?new Rational(n*10n**BigInt(exp)):new Rational(n,10n**BigInt(-exp));
  }
  add(b){return new Rational(this.n*b.d+b.n*this.d,this.d*b.d);}
  sub(b){return new Rational(this.n*b.d-b.n*this.d,this.d*b.d);}
  mul(b){return new Rational(this.n*b.n,this.d*b.d);}
  div(b){return new Rational(this.n*b.d,this.d*b.n);}
  neg(){return new Rational(-this.n,this.d);}
  abs(){return new Rational(this.n<0n?-this.n:this.n,this.d);}
  cmp(b){const d=this.n*b.d-b.n*this.d;return d<0n?-1:d>0n?1:0;}
  toString(){return this.d===1n?String(this.n):`${this.n}/${this.d}`;}
  toNumber(){return Number(this.n)/Number(this.d);}
}
const Z=new Rational(0), O=new Rational(1), T=new Rational(2), H=new Rational(1,2), THREE=new Rational(3);
const min=(a,b)=>a.cmp(b)<0?a:b, max=(a,b)=>a.cmp(b)>0?a:b;
const dot=(a,b)=>a[0].mul(b[0]).add(a[1].mul(b[1]));

/** Sign of a+b sqrt(3), decided exactly by signs and rational squaring. */
export function signSqrt3(a,b) {
  const sa=a.cmp(Z),sb=b.cmp(Z);
  if(!sa) return sb;if(!sb||sa===sb) return sa;
  const difference=a.mul(a).sub(THREE.mul(b.mul(b))).cmp(Z);
  return sa*difference;
}
function square(p) {
  if(!p||typeof p!=='object')throw Error('Invalid piece');
  for(const key of Object.keys(p))if(!['x','y','t'].includes(key))throw Error(`Unexpected piece field ${key}`);
  const c=[Rational.parse(p.x),Rational.parse(p.y)],t=Rational.parse(p.t),d=O.add(t.mul(t));
  const co=O.sub(t.mul(t)).div(d),si=T.mul(t).div(d), axes=[[co,si],[si.neg(),co]];
  const vertices=[];
  for(const sx of [H,H.neg()])for(const sy of [H,H.neg()])vertices.push(c.map((v,k)=>v.add(axes[0][k].mul(sx)).add(axes[1][k].mul(sy))));
  return {c,axes,vertices,floatCenter:c.map(q=>q.toNumber()),floatAxes:axes.map(a=>a.map(q=>q.toNumber()))};
}
// For square edge axes, the sum of both support radii is invariant across all
// four axes: (1 + |cos(relative angle)| + |sin(relative angle)|) / 2.
const pairExtent=(a,b)=>O.add(dot(a.axes[0],b.axes[0]).abs()).add(dot(a.axes[0],b.axes[1]).abs()).mul(H);
function orderedAxes(a,b){
  const dx=b.floatCenter[0]-a.floatCenter[0],dy=b.floatCenter[1]-a.floatCenter[1];
  const axes=[...a.axes,...b.axes],approx=[...a.floatAxes,...b.floatAxes];
  // Floating point chooses evaluation order only. Every acceptance is exact;
  // NaNs/infinities fall back to stable original order without skipping axes.
  return axes.map((axis,index)=>({axis,index,score:Math.abs(dx*approx[index][0]+dy*approx[index][1])}))
    .sort((a,b)=>Number.isFinite(a.score)&&Number.isFinite(b.score)?b.score-a.score:a.index-b.index);
}
function checkContract(cert,expectedN) {
  if(!cert||cert.schema_version!==1||cert.shape!=='unit_square')throw Error('Unsupported schema or shape');
  if(!['circle','equilateral_triangle','square'].includes(cert.container))throw Error('Unsupported container');
  if(!Number.isSafeInteger(cert.n)||cert.n<1||!Array.isArray(cert.pieces)||cert.pieces.length!==cert.n)throw Error('Piece count mismatch');
  if(expectedN!==undefined&&cert.n!==expectedN)throw Error('Expected instance count mismatch');
  const size=Rational.parse(cert.size);if(size.cmp(Z)<=0)throw Error('Container size must be positive');
  return size;
}

export function verifyCertificate(cert,{expectedN,expectedContainer}={}) {
  const size=checkContract(cert,expectedN), squares=cert.pieces.map(square), violations=[], witnesses=[];
  if(expectedContainer!==undefined&&cert.container!==expectedContainer)throw Error('Expected instance container mismatch');
  for(let i=0;i<squares.length;i++)for(let j=0;j<4;j++){
    const [x,y]=squares[i].vertices[j];
    if(cert.container==='circle') {
      if(x.mul(x).add(y.mul(y)).cmp(size.mul(size))>0)violations.push({kind:'wall',piece:i,vertex:j,wall:'circle'});
    } else if(cert.container==='square') {
      if(x.cmp(Z)<0||y.cmp(Z)<0||x.cmp(size)>0||y.cmp(size)>0)violations.push({kind:'wall',piece:i,vertex:j});
    } else {
      // Triangle: y>=0 and y+sqrt(3)(+/-x-L/2)<=0.
      if(y.cmp(Z)<0)violations.push({kind:'wall',piece:i,vertex:j,wall:'base'});
      for(const [name,xx]of [['right',x],['left',x.neg()]])if(signSqrt3(y,xx.sub(size.mul(H)))>0)violations.push({kind:'wall',piece:i,vertex:j,wall:name});
    }
  }
  for(let i=0;i<squares.length;i++)for(let j=i+1;j<squares.length;j++){
    const a=squares[i],b=squares[j],delta=b.c.map((x,k)=>x.sub(a.c[k])),extent=pairExtent(a,b);let found=false;
    for(const {index:axisIndex,axis}of orderedAxes(a,b)){
      const dist=dot(delta,axis).abs();
      if(dist.cmp(extent)>=0){witnesses.push({i,j,axis:axisIndex,gap:dist.sub(extent).toString()});found=true;break;}
    }
    if(!found)violations.push({kind:'overlap',i,j});
  }
  return {valid:violations.length===0,n:cert.n,container:cert.container,size:cert.size,pairs_checked:cert.n*(cert.n-1)/2,vertices_checked:cert.n*4,arithmetic:'exact rational and Q(sqrt(3)); no tolerances',violations,separating_axes:witnesses};
}

function ceilDiv(n,d){return n>=0n?(n+d-1n)/d:n/d;}
function ceilQ(q,den){return new Rational(ceilDiv(q.n*den,q.d),den);}
function integerSqrt(n){if(n<0n)throw Error('Negative square root');if(n<2n)return n;let x=1n<<BigInt(Math.ceil(n.toString(2).length/2));for(;;){const y=(x+n/x)>>1n;if(y>=x)return x;x=y;}}
function ceilSqrt(q,den){const v=q.n*den*den;let k=integerSqrt(v/q.d);if(k*k*q.d<v)k++;return new Rational(k,den);}
function ceilAlgebraic(a,b,den){
  // Return the least k/den >= a+b sqrt(3), without floating-point decisions.
  let lo=0n,hi=1n;
  if(signSqrt3(a,b)<=0)return Z;
  // An approximate guess accelerates bracketing only. Both bracket endpoints
  // are decided exactly and expanded as needed before the integer bisection.
  const guess=Math.ceil((a.toNumber()+Math.sqrt(3)*b.toNumber())*Number(den));
  if(Number.isSafeInteger(guess)&&guess>0){hi=BigInt(guess);lo=hi-1n;}
  let step=1n;
  while(signSqrt3(a.sub(new Rational(hi,den)),b)>0){lo=hi;hi+=step;step*=2n;}
  step=1n;
  while(lo>0n&&signSqrt3(a.sub(new Rational(lo,den)),b)<=0){hi=lo;lo=lo>step?lo-step:0n;step*=2n;}
  while(hi-lo>1n){const mid=(hi+lo)/2n;if(signSqrt3(a.sub(new Rational(mid,den)),b)>0)lo=mid;else hi=mid;}
  return new Rational(hi,den);
}
function fixed(x,digits){if(typeof x!=='number'||!Number.isFinite(x)||Math.abs(x)>1e12)throw Error('Nonfinite or excessive numerical coordinate');return x.toFixed(digits);}

/** Converts a numerical candidate to a rigorous feasible witness by documented outward repair.
 * Uniform center dilation repairs all overlaps. It does not optimize the arrangement.
 */
export function certifyCandidate(candidate,{digits=12}={}) {
  if(!Number.isInteger(digits)||digits<3||digits>15)throw Error('digits must be 3..15');
  if(!candidate||candidate.shape!=='unit_square'||!Number.isSafeInteger(candidate.n)||candidate.n<1||candidate.pieces?.length!==candidate.n)throw Error('Candidate contract/count mismatch');
  if(!['circle','equilateral_triangle','square'].includes(candidate.container))throw Error('Unsupported container');
  const den=10n**BigInt(digits);
  const pieces=candidate.pieces.map(p=>{
    if(typeof p.theta!=='number'||!Number.isFinite(p.theta))throw Error('Nonfinite angle');
    // Squares are invariant under quarter turns; this avoids tan's singular chart.
    const theta=((p.theta+Math.PI/4)%(Math.PI/2)+Math.PI/2)%(Math.PI/2)-Math.PI/4;
    return {x:fixed(p.x,digits),y:fixed(p.y,digits),t:fixed(Math.tan(theta/2),digits)};
  });
  let squares=pieces.map(square),scale=O;
  for(let i=0;i<squares.length;i++)for(let j=i+1;j<squares.length;j++){
    const a=squares[i],b=squares[j],delta=b.c.map((x,k)=>x.sub(a.c[k])),extent=pairExtent(a,b);let largest=Z,satisfied=false;
    for(const {axis}of orderedAxes(a,b)){
      const dist=dot(delta,axis).abs();
      if(dist.mul(scale).cmp(extent)>=0){satisfied=true;break;}
      largest=max(largest,dist);
    }
    // Early exit only when this pair needs no increase to current scale. If it
    // does, every axis was tested and the exact best projection is known.
    if(!satisfied){if(largest.cmp(Z)===0)throw Error('Cannot repair coincident centers');scale=max(scale,extent.div(largest));}
  }
  scale=ceilQ(scale,den);
  for(let i=0;i<pieces.length;i++){pieces[i].x=squares[i].c[0].mul(scale).toString();pieces[i].y=squares[i].c[1].mul(scale).toString();}
  squares=pieces.map(square);
  const vertices=squares.flatMap(s=>s.vertices);
  let shiftX=Z,shiftY=Z;
  if(candidate.container!=='circle'){
    shiftY=vertices.reduce((m,v)=>min(m,v[1]),vertices[0][1]).neg();
    if(candidate.container==='square')shiftX=vertices.reduce((m,v)=>min(m,v[0]),vertices[0][0]).neg();
    for(let i=0;i<pieces.length;i++){pieces[i].x=squares[i].c[0].add(shiftX).toString();pieces[i].y=squares[i].c[1].add(shiftY).toString();}
  }
  squares=pieces.map(square);let size=Z;
  for(const [x,y]of squares.flatMap(s=>s.vertices)){
    if(candidate.container==='circle')size=max(size,ceilSqrt(x.mul(x).add(y.mul(y)),den));
    else if(candidate.container==='square')size=max(size,ceilQ(max(x,y),den));
    else size=max(size,ceilAlgebraic(T.mul(x.abs()),T.mul(y).div(THREE),den));
  }
  const certificate={schema_version:1,shape:'unit_square',container:candidate.container,n:candidate.n,size:size.toString(),pieces};
  const verification=verifyCertificate(certificate);
  if(!verification.valid)throw Error('Internal certification failure');
  return {certificate,verification,repair:{decimal_digits:digits,center_dilation:scale.toString(),translation:[shiftX.toString(),shiftY.toString()],proposed_size:candidate.size??null,certified_size_numeric:size.toNumber(),method:'rational rotation, exact SAT center dilation, outward container bound'}};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const [command,input,output]=process.argv.slice(2);
    if(!['verify','certify'].includes(command)||!input)throw Error('Usage: node checkers/squares.mjs verify|certify input.json [output.json]');
    const raw=readFileSync(input,'utf8'),data=JSON.parse(raw);
    const result=command==='verify'?verifyCertificate(data):certifyCandidate(data);
    const envelope={...result,input_sha256:createHash('sha256').update(raw).digest('hex'),checker_sha256:createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex')};
    if(output)writeFileSync(output,JSON.stringify(envelope,null,2)+'\n');else console.log(JSON.stringify(envelope,null,2));
    if(command==='verify'&&!result.valid)process.exitCode=1;
  }catch(e){console.error(JSON.stringify({valid:false,error:e.message}));process.exitCode=2;}
}

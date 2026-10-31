// Independent feasibility replay of Nakajima's published 12-cube coordinates.
// Uses exact decimal rationals and the 15-axis box separation theorem.
// No upstream checker code or numerical optimizer is executed.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
class Q {
  constructor(n, d = 1n) {
    n = BigInt(n); d = BigInt(d);
    if (!d) throw new Error('Zero denominator');
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n, d); this.n = n / g; this.d = d / g;
  }
  static decimal(s) {
    const m = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(s);
    if (!m) throw new Error(`Invalid decimal ${s}`);
    const scale = (m[3] || '').length - Number(m[4] || 0);
    const n = BigInt(m[2] + (m[3] || '')) * (m[1] ? -1n : 1n);
    return scale >= 0 ? new Q(n, 10n ** BigInt(scale)) : new Q(n * 10n ** BigInt(-scale));
  }
  add(b) { return new Q(this.n*b.d + b.n*this.d, this.d*b.d); }
  sub(b) { return new Q(this.n*b.d - b.n*this.d, this.d*b.d); }
  mul(b) { return new Q(this.n*b.n, this.d*b.d); }
  div(b) { return new Q(this.n*b.d, this.d*b.n); }
  abs() { return new Q(this.n < 0n ? -this.n : this.n, this.d); }
  cmp(b) { const d = this.n*b.d - b.n*this.d; return d < 0n ? -1 : d > 0n ? 1 : 0; }
  toString() { return `${this.n}/${this.d}`; }
}
const zero = new Q(0), one = new Q(1), two = new Q(2), half = new Q(1, 2);
const dot = (a,b) => a.reduce((s,x,k) => s.add(x.mul(b[k])), zero);
const cross = (a,b) => [a[1].mul(b[2]).sub(a[2].mul(b[1])), a[2].mul(b[0]).sub(a[0].mul(b[2])), a[0].mul(b[1]).sub(a[1].mul(b[0]))];
const unit = [0,1,2].map(i => [0,1,2].map(j => i === j ? one : zero));
function cube(p) {
  assert.equal(p.length, 7);
  const c = p.slice(0,3).map(Q.decimal), [w,...v] = p.slice(3).map(Q.decimal);
  const norm = w.mul(w).add(dot(v,v));
  assert.ok(norm.n > 0n, 'Zero quaternion');
  // Quaternion action on each basis vector: ((w²-v·v)e+2v(v·e)+2w(v×e))/norm.
  const axes = unit.map(e => {
    const vx = cross(v,e), ve = dot(v,e), scalar = w.mul(w).sub(dot(v,v));
    return e.map((x,k) => scalar.mul(x).add(two.mul(v[k]).mul(ve)).add(two.mul(w).mul(vx[k])).div(norm));
  });
  for(let i=0;i<3;i++) for(let j=0;j<3;j++) assert.equal(dot(axes[i],axes[j]).cmp(i===j?one:zero),0);
  assert.equal(dot(cross(axes[0],axes[1]),axes[2]).cmp(one),0);
  return {c,axes};
}
const support = (b,a) => b.axes.reduce((s,e)=>s.add(dot(e,a).abs()),zero).mul(half);
function verify(data) {
  const boxes = data.pieces.map(cube), side = Q.decimal(data.s_full);
  assert.equal(boxes.length, Number(data.n));
  assert.ok(side.n > 0n);
  let minWall = side;
  for(const b of boxes) for(let k=0;k<3;k++) {
    const extent = support(b,unit[k]);
    for(const gap of [b.c[k].sub(extent), side.sub(b.c[k]).sub(extent)]) {
      assert.ok(gap.n >= 0n, 'Wall violation');
      if(gap.cmp(minWall)<0) minWall=gap;
    }
  }
  const witnesses=[];
  for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++) {
    const a=boxes[i], b=boxes[j], delta=b.c.map((x,k)=>x.sub(a.c[k]));
    const candidates=[...a.axes,...b.axes,...a.axes.flatMap(u=>b.axes.map(v=>cross(u,v)))];
    let found=false;
    for(let k=0;k<candidates.length;k++) {
      const axis=candidates[k];
      if(axis.every(x=>x.n===0n)) continue;
      const gap=dot(delta,axis).abs().sub(support(a,axis)).sub(support(b,axis));
      if(gap.n>=0n) { witnesses.push({i,j,axis_index:k,projection_gap:gap.toString()}); found=true; break; }
    }
    assert.ok(found, `Overlap between ${i} and ${j}`);
  }
  return {n:boxes.length,side:side.toString(),pairs_checked:witnesses.length,min_wall_gap:minWall.toString(),strict_pair_separation:witnesses.every(w=>Q.decimal('0').cmp(new Q(...w.projection_gap.split('/')))<0),witnesses};
}
const input=new URL('./evidence/cubincub_n12.json',import.meta.url);
const raw=readFileSync(input,'utf8');
// Preserve numeric JSON tokens as strings; quoted source text is left untouched.
const data=JSON.parse(raw.replace(/"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, token=>token.startsWith('"')?token:JSON.stringify(token)));
const result=verify(data);
const duplicate=structuredClone(data); duplicate.pieces[1]=[...duplicate.pieces[0]];
assert.throws(()=>verify(duplicate),/Overlap/);
const small=structuredClone(data); small.s_full='2';
assert.throws(()=>verify(small),/Wall violation/);
const bad=structuredClone(data); bad.pieces[0].splice(3,4,'0','0','0','0');
assert.throws(()=>verify(bad),/Zero quaternion/);
const truncated=structuredClone(data); truncated.s_full=data.s;
assert.throws(()=>verify(truncated),/Wall violation/);
const audit={
  audited_on:'2026-10-30',
  source:'https://github.com/yoheinakajima/soft-to-rigid-packing/blob/main/claims/cubincub_n12/cubincub_n12.json',
  source_sha256:createHash('sha256').update(raw).digest('hex'),
  checker_sha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
  semantics:'Decimal tokens are exact rationals; nonzero quaternion is mapped to an exactly orthogonal rotation by homogeneous normalization. Interior-disjoint unit cubes, boundary contact permitted.',
  conclusion:'Feasible construction at s_full; no global optimality or current record priority established.',
  controls:['duplicated cube rejected','too-small container rejected','zero quaternion rejected','truncated display side rejected'],
  ...result
};
writeFileSync(new URL('./evidence/cube_audit.json',import.meta.url),JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({valid:true,n:result.n,pairs:result.pairs_checked,side:data.s_full,strict_pair_separation:result.strict_pair_separation,controls:audit.controls},null,2));

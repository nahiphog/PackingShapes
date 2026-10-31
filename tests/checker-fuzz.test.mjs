// Independent floating-point vertex-projection screen of exact certificates.
// This is a diagnostic test; rigorous feasibility comes from the exact checker.
import test from 'node:test';
import assert from 'node:assert/strict';
import { certifyCandidate, verifyCertificate, Rational } from '../checkers/squares.mjs';

function rng(seed){let x=seed;return()=>{x=(Math.imul(x,1664525)+1013904223)|0;return (x>>>0)/4294967296;};}
function independentFloatScreen(cert){
  const number=x=>Rational.parse(x).toNumber();
  const size=number(cert.size),tol=1e-9*Math.max(1,size);
  const polygons=cert.pieces.map(p=>{
    const x=number(p.x),y=number(p.y),angle=2*Math.atan(number(p.t));
    const c=Math.cos(angle),s=Math.sin(angle);
    return [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([a,b])=>[x+c*a-s*b,y+s*a+c*b]);
  });
  for(const poly of polygons)for(const [x,y]of poly){
    if(cert.container==='circle')assert.ok(Math.hypot(x,y)<=size+tol);
    else if(cert.container==='square')assert.ok(x>=-tol&&y>=-tol&&x<=size+tol&&y<=size+tol);
    else assert.ok(y>=-tol&&Math.sqrt(3)*Math.abs(x)+y<=Math.sqrt(3)*size/2+tol);
  }
  for(let i=0;i<polygons.length;i++)for(let j=i+1;j<polygons.length;j++){
    let greatest=-Infinity;
    for(const poly of [polygons[i],polygons[j]])for(let e=0;e<4;e++){
      const a=poly[e],b=poly[(e+1)%4],axis=[-(b[1]-a[1]),b[0]-a[0]],length=Math.hypot(...axis);
      const project=v=>(v[0]*axis[0]+v[1]*axis[1])/length;
      const p=polygons[i].map(project),q=polygons[j].map(project);
      greatest=Math.max(greatest,Math.min(...q)-Math.max(...p),Math.min(...p)-Math.max(...q));
    }
    assert.ok(greatest>=-tol,`floating screen overlap ${i},${j}: ${greatest}`);
  }
}

test('100 seeded random candidates certify and pass separate float polygon projections',()=>{
  const random=rng(739102);
  for(let sample=0;sample<100;sample++){
    const n=1+Math.floor(random()*9),container=['circle','equilateral_triangle','square'][sample%3];
    const pieces=Array.from({length:n},(_,i)=>({x:(i%3)*.55+random()*.15-2,y:Math.floor(i/3)*.6+random()*.15-1,theta:(random()-.5)*100*Math.PI}));
    const result=certifyCandidate({shape:'unit_square',container,n,size:1,pieces});
    assert.equal(result.verification.valid,true);
    assert.equal(verifyCertificate(result.certificate,{expectedN:n,expectedContainer:container}).valid,true);
    independentFloatScreen(result.certificate);
  }
});

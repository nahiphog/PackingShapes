import test from 'node:test';
import assert from 'node:assert/strict';
import { Rational as Q, signSqrt3, verifyCertificate, certifyCandidate } from '../checkers/squares.mjs';

const cert=(container,size,pieces)=>({schema_version:1,shape:'unit_square',container,size,n:pieces.length,pieces});
const p=(x,y,t='0')=>({x,y,t});
test('unit square exactly tiles unit square; contact is valid',()=>{
  const d=cert('square','1',[p('1/2','1/2')]);assert.equal(verifyCertificate(d).valid,true);
  d.size='999999999999999999999999999999/1000000000000000000000000000000';assert.equal(verifyCertificate(d).valid,false);
});
test('all pairs checked including a coincident pair far from first object',()=>{
  const d=cert('circle','10',[p('0','0'),p('3','0'),p('3','0')]);
  const r=verifyCertificate(d);assert.equal(r.pairs_checked,3);assert.deepEqual(r.violations,[{kind:'overlap',i:1,j:2}]);
});
test('contact accepted but arbitrary tiny rational penetration rejected',()=>{
  const d=cert('square','2',[p('1/2','1/2'),p('3/2','1/2')]);assert.equal(verifyCertificate(d).valid,true);
  d.pieces[1].x='1499999999999999999999999999999/1000000000000000000000000000000';assert.equal(verifyCertificate(d).valid,false);
});
test('rotated-square separating axes catch overlap missed by center distance',()=>{
  const d=cert('circle','5',[p('0','0','2/5'),p('13/10','0','2/5')]);assert.equal(verifyCertificate(d).valid,false);
  d.pieces[1].x='3/2';assert.equal(verifyCertificate(d).valid,true);
});
test('circle checks all corners and rational equality',()=>{
  assert.equal(verifyCertificate(cert('circle','5/2',[p('1','3/2')])).valid,true); // corner (1.5,2)
  assert.equal(verifyCertificate(cert('circle','2499999999999/1000000000000',[p('1','3/2')])).valid,false);
});
test('exact triangle wall distinguishes adjacent decimals around optimum',()=>{
  const d=cert('equilateral_triangle','2.154700538380',[p('0','1/2')]);assert.equal(verifyCertificate(d).valid,true);
  d.size='2.154700538379';assert.equal(verifyCertificate(d).valid,false);
  d.size='10';d.pieces[0].y='499999999999/1000000000000';assert.equal(verifyCertificate(d).valid,false);
});
test('quadratic field sign covers both signs and cancellation',()=>{
  const q=Q.parse;
  assert.equal(signSqrt3(q('0'),q('0')),0);
  assert.equal(signSqrt3(q('-3'),q('2')),1);
  assert.equal(signSqrt3(q('3'),q('-2')),-1);
  assert.equal(signSqrt3(q('-2'),q('1')),-1);
  assert.equal(signSqrt3(q('2'),q('-1')),1);
  assert.equal(signSqrt3(q('1'),q('1')),1);
});
test('schema count, wrong shape size, float values and unsupported fields fail closed',()=>{
  const d=cert('square','2',[p('1','1')]);
  assert.throws(()=>verifyCertificate({...d,n:2}),/count/);
  assert.throws(()=>verifyCertificate(d,{expectedN:2}),/count/);
  assert.throws(()=>verifyCertificate(d,{expectedContainer:'circle'}),/container mismatch/);
  assert.throws(()=>verifyCertificate({...d,size:2}),/strings/);
  assert.throws(()=>verifyCertificate({...d,pieces:[{...d.pieces[0],side:'2'}]}),/Unexpected/);
  assert.throws(()=>verifyCertificate({...d,size:'NaN'}),/Invalid/);
  assert.throws(()=>verifyCertificate({...d,size:'1/0'}),/Zero denominator/);
  assert.throws(()=>verifyCertificate({...d,shape:'rectangle'}),/Unsupported/);
});
test('relabeling and exact global rotation preserve circle feasibility',()=>{
  const d=cert('circle','2',[p('-1/2','-1/2'),p('1/2','-1/2'),p('-1/2','1/2'),p('1/2','1/2')]);
  assert.equal(verifyCertificate(d).valid,true);
  const rotated=d.pieces.map(v=>{const x=Q.parse(v.x),y=Q.parse(v.y),c=Q.parse('3/5'),s=Q.parse('4/5');return p(c.mul(x).sub(s.mul(y)).toString(),s.mul(x).add(c.mul(y)).toString(),'1/2');});
  assert.equal(verifyCertificate({...d,pieces:rotated.reverse()}).valid,true);
});
test('certification repairs pair overlap and bottom wall, then independently verifies',()=>{
  const candidate={shape:'unit_square',container:'equilateral_triangle',n:2,size:3,pieces:[{x:-0.4999999999,y:0.4999999999,theta:0},{x:0.4999999999,y:0.4999999999,theta:0}]};
  const {certificate,repair}=certifyCandidate(candidate);assert.equal(verifyCertificate(certificate).valid,true);
  assert.ok(Q.parse(repair.center_dilation).cmp(Q.parse('1'))>0);
  assert.ok(repair.certified_size_numeric<3.155);
});
test('circle certification produces an outward square-root bound',()=>{
  const r=certifyCandidate({shape:'unit_square',container:'circle',n:1,pieces:[{x:0,y:0,theta:0}]});
  assert.equal(r.certificate.size,'707106781187/1000000000000'); // sqrt(1/2) rounded upward at 12 decimals
  assert.equal(r.verification.valid,true);
});
test('certifier refuses duplicate centers, NaNs and count mismatch',()=>{
  const d={shape:'unit_square',container:'circle',n:2,pieces:[{x:0,y:0,theta:0},{x:0,y:0,theta:0}]};
  assert.throws(()=>certifyCandidate(d),/coincident/);
  assert.throws(()=>certifyCandidate({...d,n:1}),/count/);
  d.pieces[1].x=NaN;assert.throws(()=>certifyCandidate(d),/Nonfinite/);
});

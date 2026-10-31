import test from 'node:test';
import assert from 'node:assert/strict';
import { selectBest } from '../checkers/select-best.mjs';
const candidate=(pieces,size=1)=>({shape:'unit_square',container:'circle',n:pieces.length,size,pieces});
const p=(x,y,theta=0)=>({x,y,theta});

test('selects certified best when numerical ranking is reversed by repair',()=>{
  const a=candidate([p(0,0),p(.01,0)],.5);
  const b=candidate([p(-.5,0),p(.5,0)],1.2);
  const result=selectBest({instance:{n:2,container:'circle'},candidates:[a,b]});
  assert.equal(result.valid,true);assert.equal(result.selected_index,1);
  assert.ok(result.candidate_summary[0].size_numeric>result.candidate_summary[1].size_numeric);
  assert.ok(Number(result.candidate_summary[0].center_dilation)>1);
});
test('records failed candidates and enforces external instance',()=>{
  const good=candidate([p(0,0)]);
  const result=selectBest({instance:{n:1,container:'circle'},candidates:[{...good,container:'square'},{...good,n:2},good]});
  assert.equal(result.valid,true);assert.equal(result.selected_index,2);assert.equal(result.failures.length,2);assert.equal(result.candidate_count,3);
});
test('preserves first exact tie and reports complete failure without a witness',()=>{
  const good=candidate([p(0,0)]);
  assert.equal(selectBest({instance:{n:1,container:'circle'},candidates:[good,good]}).selected_index,0);
  const bad=candidate([p(0,0),p(0,0)]);
  const result=selectBest({instance:{n:2,container:'circle'},candidates:[bad]});
  assert.equal(result.valid,false);assert.equal(result.selected_index,null);assert.equal(result.certificate,undefined);
});

test('keeps unchanged exact baseline when rounding a proposal would inflate it',()=>{
  const baseline={schema_version:1,shape:'unit_square',container:'circle',n:1,size:'14142135623731/20000000000000',pieces:[{x:'0',y:'0',t:'0'}]};
  const result=selectBest({instance:{n:1,container:'circle'},baseline_certificate:baseline,candidates:[candidate([p(0,0)],Math.SQRT1_2)]});
  assert.equal(result.valid,true);assert.equal(result.selected_index,null);assert.equal(result.selected_baseline,true);assert.equal(result.baseline_considered,true);
  assert.equal(result.certificate,baseline);assert.equal(result.repair.method,'unchanged exact baseline');assert.equal(result.candidate_count,1);
});

test('candidate can beat exact baseline and invalid baseline is explicitly rejected',()=>{
  const baseline={schema_version:1,shape:'unit_square',container:'circle',n:1,size:'1',pieces:[{x:'0',y:'0',t:'0'}]};
  const good=candidate([p(0,0)]);
  const result=selectBest({instance:{n:1,container:'circle'},baseline_certificate:baseline,candidates:[good]});
  assert.equal(result.selected_index,0);assert.equal(result.selected_baseline,false);assert.equal(result.baseline_considered,true);
  const failed=selectBest({instance:{n:1,container:'circle'},baseline_certificate:{...baseline,size:'1/2'},candidates:[good]});
  assert.equal(failed.valid,true);assert.equal(failed.failures[0].baseline,true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { compareReportedBound } from './compare.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const records=read('registry/records.json').records;
test('all frozen source and seed hashes match, counts and contracts are valid',()=>{
  const manifest=read('data/sources/manifest.json');
  for(const a of manifest.artifacts)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(a.path)).digest('hex'),a.sha256);
  assert.equal(records.length,10);assert.equal(new Set(records.map(r=>r.id)).size,10);
  for(const r of records){
    const seed=read(r.warm_start.path);
    assert.equal(seed.pieces.length,r.contract.n);assert.equal(seed.container,r.contract.container);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(r.warm_start.path)).digest('hex'),r.warm_start.sha256);
    assert.equal(r.certified_incumbent,null);assert.equal(r.reported_incumbent.full_coordinates_available,false);
    assert.ok(seed.pieces.every(p=>['x','y','theta'].every(k=>Number.isFinite(p[k]))));
  }
});
test('truncated-source comparison does not mistake within-rounding gains for records',()=>{
  const r=records.find(r=>r.id==='square_triangle_n8');
  assert.equal(compareReportedBound(r,'5.3009').relation,'below_reported_precision_interval');
  assert.equal(compareReportedBound(r,'5.3015').relation,'within_reported_precision_interval');
  assert.equal(compareReportedBound(r,'5.302').relation,'above_reported_precision_interval');
  assert.equal(compareReportedBound(r,'5.3009').world_record_established,false);
  assert.throws(()=>compareReportedBound(r,5.301));
});
test('algebraic incumbent comparison uses exact squared arithmetic',()=>{
  const r=records.find(r=>r.id==='square_circle_n18');
  assert.equal(compareReportedBound(r,'27414/10000').relation,'below_reported_exact_value');
  assert.equal(compareReportedBound(r,'27415/10000').relation,'above_reported_exact_value');
  assert.throws(()=>compareReportedBound(r,'-1'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,readFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {generate,medianExact,successRate} from './report.mjs';
const here=dirname(fileURLToPath(import.meta.url));
test('exact median does not lose sub-double differences',()=>{
  assert.equal(medianExact(['1','100000000000000000001/100000000000000000000']),'200000000000000000001/200000000000000000000');
  assert.equal(medianExact([]),null);
});
test('Wilson intervals handle empty and extreme samples',()=>{
  assert.equal(successRate(0,0).wilson95,null);
  const zero=successRate(0,12),all=successRate(12,12);
  assert.equal(zero.rate,0);assert.ok(zero.wilson95[1]>0.24&&zero.wilson95[1]<0.25);
  assert.equal(all.rate,1);assert.ok(all.wilson95[0]>0.75&&all.wilson95[0]<0.76);
});
test('selected certificates control ranking, invalid and missing runs stay visible',()=>{
  const dir=mkdtempSync(resolve(here,'test-fixture-'));
  const write=(name,obj)=>{const p=resolve(dir,name);writeFileSync(p,JSON.stringify(obj));return p;};
  try{
    const instance={id:'square_circle_n11',n:11,container:'circle',split:'development'};
    const tasks=[];
    for(let i=0;i<4;i++){
      const output=resolve(dir,`run${i}.json`);tasks.push({instance,output,task_id:`t${i}`,arm:'rigid',warm_path:null});
      if(i===3)continue;
      const cert={schema_version:1,shape:'unit_square',container:'circle',n:11,size:i===2?'1':i===0?'30':'31',pieces:Array.from({length:11},(_,j)=>({x:String(j*2),y:'0',t:'0'}))};
      const p=write(`cert${i}.json`,{certificate:cert});
      write(`run${i}.json`,{status:'certified',certificate_path:p,cpu_seconds:2,numeric_best:{size:i===0?100:1}});
    }
    write('tasks.json',tasks);write('manifest.json',{});
    write('baseline_index.json',[{id:instance.id,certificate:resolve(dir,'cert0.json')}]);
    mkdirSync(resolve(dir,'source/registry'),{recursive:true});
    write('source/registry/records.json',{records:[{id:instance.id,reported_incumbent:{reported_precision_interval:{lower:'29',upper:'30'}}}]});
    const s=generate(dir);
    assert.equal(s.cases[0].best.task_id,'t0');assert.equal(s.cases[0].best.size,'30');
    assert.equal(s.totals.valid,2);assert.equal(s.totals.missing,1);assert.equal(s.totals.failed_or_unverified,1);
    assert.equal(s.cases[0].groups[0].median_size_exact,'61/2');
    assert.equal(s.cases[0].groups[0].baseline_recovery_rate.completed,3);
    assert.equal(s.cases[0].groups[0].baseline_recovery_rate.successes,1);
    assert.equal(s.cases[0].groups[0].meaningful_local_improvement_count,0);
    assert.ok(s.registry_path.endsWith('source/registry/records.json'));
    assert.equal(s.baseline_index.campaign_snapshot,true);
    assert.match(readFileSync(resolve(dir,'report/index.html'),'utf8'),/<svg/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('warm fallback and missing CPU accounting are explicit in reports',()=>{
  const dir=mkdtempSync(resolve(here,'test-fixture-'));
  const write=(name,obj)=>{const p=resolve(dir,name);writeFileSync(p,JSON.stringify(obj));return p;};
  try{
    const instance={id:'fixture_circle1',n:1,container:'circle',split:'development'};
    const tasks=Array.from({length:3},(_,i)=>({instance,output:resolve(dir,`run${i}.json`),task_id:`t${i}`,arm:'rigid',warm_path:'reference.json'}));
    const baseline={schema_version:1,shape:'unit_square',container:'circle',n:1,size:'1',pieces:[{x:'0',y:'0',t:'0'}]};
    const certPath=write('selected.json',{certificate:baseline,selected_baseline:true});
    write('run0.json',{status:'certified',certificate_path:certPath,cpu_seconds:120,selected_baseline:true});
    write('run1.json',{status:'failed',error:'certification timed out after search; CPU accounting lost'});
    write('tasks.json',tasks);write('manifest.json',{});
    write('baseline_index.json',[{id:instance.id,certificate:certPath}]);
    mkdirSync(resolve(dir,'source/registry'),{recursive:true});
    write('source/registry/records.json',{records:[{id:instance.id,reported_incumbent:{reported_precision_interval:{lower:'0.7',upper:'0.8'}}}]});
    const summary=generate(dir),group=summary.cases[0].groups[0];
    assert.equal(summary.totals.unknown_search_cpu_cost_tasks,1);
    assert.equal(summary.totals.search_cpu_hours,120/3600);
    assert.equal(summary.runs[0].selected_baseline,true);
    assert.equal(summary.runs[1].cpu_seconds,null);
    assert.equal(summary.runs[2].status,'missing');
    assert.equal(group.selected_baseline_count,1);
    assert.equal(group.unchanged_exact_baseline_count,1);
    assert.equal(group.unknown_search_cpu_cost_tasks,1);
    assert.equal(group.baseline_recovery_rate.completed,2);
    assert.equal(group.baseline_recovery_rate.rate,.5);
    assert.match(summary.notice,/not evidence of rediscovery/);
    assert.match(summary.notice,/only the recorded subtotal/);
    assert.match(summary.reporting_provenance.checker_sha256,/^[a-f0-9]{64}$/);
    assert.match(summary.cases[0].baseline.certificate_sha256,/^[a-f0-9]{64}$/);
    assert.match(readFileSync(resolve(dir,'report/REPORT.md'),'utf8'),/Selected unchanged witness/);
  }finally{assert.ok(dir.startsWith(resolve(here,'test-fixture-')));rmSync(dir,{recursive:true,force:true});}
});

/** Final independent evaluation and custody inventory; never launches or changes search. */
import {readFileSync,writeFileSync,existsSync,readdirSync,statSync} from 'node:fs';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {generate} from './report.mjs';
import {Rational as Q} from '../checkers/squares.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dir=resolve(root,process.argv[2]??'results/pilot_v2');
const load=p=>JSON.parse(readFileSync(p,'utf8'));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const rel=p=>relative(root,p).replaceAll('\\','/');
const json=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
function files(d){return readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(resolve(d,e.name)):[resolve(d,e.name)]).sort();}
const custodyPath=resolve(dir,'custody-start.json');
if(!existsSync(custodyPath))json(custodyPath,{captured_at:new Date().toISOString(),note:'Custody begins at monitoring handoff, not campaign launch.',files:[...files(resolve(dir,'baselines')),resolve(dir,'manifest.json'),resolve(dir,'tasks.json')].map(p=>({path:rel(p),sha256:hash(p)}))});
const manifest=load(resolve(dir,'manifest.json'));
function audit(){
  const checks=[];
  for(const [p,expected] of Object.entries(manifest.source_hashes))for(const location of [resolve(root,p),resolve(dir,'source',p)])checks.push({path:rel(location),expected_sha256:expected,actual_sha256:hash(location)});
  for(const f of load(custodyPath).files)checks.push({path:f.path,expected_sha256:f.sha256,actual_sha256:hash(resolve(root,f.path))});
  for(const t of load(resolve(dir,'tasks.json')))if(t.warm_path)checks.push({path:rel(t.warm_path),expected_sha256:t.warm_sha256,actual_sha256:hash(t.warm_path)});
  const unique=[...new Map(checks.map(c=>[JSON.stringify(c),c])).values()];
  const result={checked_at:new Date().toISOString(),all_match:unique.every(c=>c.expected_sha256===c.actual_sha256),checks:unique};
  json(resolve(dir,'source-integrity.json'),result);
  if(!result.all_match)throw Error('Source/input custody mismatch; see source-integrity.json');
}
audit();
if(process.argv.includes('--watch')){
  let milestone=-1,stale=false;
  while(!existsSync(resolve(dir,'completion.json'))){
    const p=load(resolve(dir,'progress.json'));
    const m=Math.floor(p.completed/120);
    if(m!==milestone){console.log(JSON.stringify({event:'progress',...p}));milestone=m;}
    const age=Date.now()/1000-p.updated_epoch;
    if(age>300&&!stale){console.log(JSON.stringify({event:'stale_progress',age_seconds:age,...p}));stale=true;}
    if(age<=300)stale=false;
    await new Promise(r=>setTimeout(r,30000));
  }
}
if(!existsSync(resolve(dir,'completion.json')))throw Error('Campaign is not complete; rerun with --watch');
audit();
const completion=load(resolve(dir,'completion.json'));
const s=generate(dir);
if(!completion.complete||s.totals.missing||completion.tasks!==s.totals.tasks)throw Error('Completion marker and tasks disagree');
const failures=s.runs.filter(r=>r.status!=='valid').map(r=>({task_id:r.task_id,status:r.status,result:load(resolve(dir,'runs',r.task_id+'.json'))}));
json(resolve(dir,'report/failures.json'),failures);
const aggregates=[];
for(const split of ['development','held_out'])for(const start of ['fresh','warm']){
  const groups=s.cases.filter(c=>c.split===split).flatMap(c=>c.groups.filter(g=>g.start_kind===start));
  const sum=k=>groups.reduce((a,g)=>a+(g[k]??0),0);
  aggregates.push({split,start,tasks:sum('tasks'),valid:sum('valid'),recovered:sum('baseline_recovery_count'),meaningful:sum('meaningful_local_improvement_count'),strict:sum('strict_local_improvement_count'),retained:sum('selected_baseline_count')});
}
const material=s.cases.filter(c=>c.best&&c.baseline&&Q.parse(c.best.size).cmp(Q.parse(c.baseline.size_exact).mul(new Q(1).sub(Q.parse(s.metrics.meaningful_local_improvement_relative))))<=0);
let md=`# Final pilot interpretation\n\nAll ${s.totals.tasks} scheduled tasks finished. Independent exact replay accepted ${s.totals.valid}; ${s.totals.failed_or_unverified} failed or unverified; ${s.totals.missing} missing. Completion-marker failures: ${completion.failures.length}. See [failure evidence](failures.json).\n\nRecorded search CPU: ${s.totals.search_cpu_hours.toFixed(6)} hours. Certification: ${s.totals.certification_wall_hours_summed.toFixed(6)} summed wall hours, not CPU hours. ${s.totals.unknown_search_cpu_cost_tasks} completed tasks have unknown search CPU costs. Total end-to-end CPU use is not measured.\n\n${material.length} of ${s.cases.length} cases achieved the frozen meaningful local improvement threshold (relative ${s.metrics.meaningful_local_improvement_relative}). Baselines are certified reconstructions, not original full-precision world-record witnesses. No novelty, priority or global optimality is established. Warm recovery includes the guaranteed retained baseline and does not demonstrate rediscovery.\n\n## Exact feasible upper bounds\n\nCircle sizes are radii; triangle sizes are side lengths, for congruent unit squares. Decimals are approximate; the fractions and certificates determine the bounds.\n\n| Case | Best exact bound | Approximate bound | Relative local improvement |\n|---|---|---:|---:|\n`;
for(const c of s.cases)md+=`| ${c.id} | ${c.best?.size??'unavailable'} | ${c.best?.size_numeric.toPrecision(14)??'unavailable'} | ${c.baseline&&c.best?(c.baseline_minus_best_numeric/c.baseline.size_numeric).toExponential(6):'unavailable'} |\n`;
md+='\n## Fresh/warm and development/held-out results\n\nThese are descriptive counts across cases and arms, not paired significance tests or rankings. Per-case and per-arm rates, exact medians and marginal Wilson intervals are in [the detailed report](REPORT.md).\n\n| Split | Start | Valid / scheduled | Recovered | Meaningful improvement | Strict improvement | Selected retained witness |\n|---|---|---:|---:|---:|---:|---:|\n';
for(const a of aggregates)md+=`| ${a.split} | ${a.start} | ${a.valid} / ${a.tasks} | ${a.recovered} | ${a.meaningful} | ${a.strict} | ${a.retained} |\n`;
md+='\nSource and snapshot hashes match the frozen manifest; warm inputs match task hashes. Baseline certificate hashes match the monitoring-handoff custody capture. The final inventory includes every campaign artifact except the inventory itself. Small strict improvements below the meaningful threshold can reflect reconstruction precision or numerical certification repair. No search tuning occurred during this evaluation.\n';
writeFileSync(resolve(dir,'report/FINAL_EVALUATION.md'),md);
json(resolve(dir,'report/final-metrics.json'),{totals:s.totals,materially_improved_cases:material.map(c=>c.id),aggregates});
const readmePath=resolve(root,'README.md');
let readme=readFileSync(readmePath,'utf8');
const paragraph=`The frozen full pilot in \`results/pilot_v2\` is complete: ${s.totals.tasks} tasks, ${s.totals.valid} independently replayed valid certificates, ${s.totals.failed_or_unverified} failed or unverified, and ${s.totals.missing} missing. Recorded search cost was ${s.totals.search_cpu_hours.toFixed(4)} CPU hours, excluding certification. ${material.length}/10 cases met the relative 1e-6 meaningful local improvement threshold against derived reference packings. This establishes no new world record. See the [final evaluation](results/pilot_v2/report/FINAL_EVALUATION.md), [detailed report](results/pilot_v2/report/REPORT.md), and [standalone visual report](results/pilot_v2/report/index.html). The interrupted first launch remains separately preserved in \`results/pilot_v1\`.`;
readme=readme.replace(/^The repository now implements.*$/m,paragraph);
writeFileSync(readmePath,readme);
json(resolve(dir,'artifact-inventory.json'),{generated_at:new Date().toISOString(),algorithm:'SHA-256',excludes:['artifact-inventory.json'],files:files(dir).filter(p=>p!==resolve(dir,'artifact-inventory.json')).map(p=>({path:rel(p),bytes:statSync(p).size,sha256:hash(p)}))});
console.log(JSON.stringify({event:'finalized',...s.totals,materially_improved_cases:material.map(c=>c.id),aggregates,failures:failures.map(f=>f.task_id)}));

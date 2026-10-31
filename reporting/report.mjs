/** Read-only evaluation: exact certificate ranking, independent replay, static artifacts. */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Rational as Q,verifyCertificate} from '../checkers/squares.mjs';
import {compareReportedBound} from '../registry/compare.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const load=p=>JSON.parse(readFileSync(p,'utf8'));
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const path=p=>resolve(ROOT,p);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=q=>Q.parse(q).toNumber();
const fmt=v=>v==null?'—':Number(v).toPrecision(12);
export function successRate(successes,completed){
  if(!completed)return {successes,completed,rate:null,wilson95:null};
  const z=1.959963984540054,p=successes/completed,d=1+z*z/completed;
  const center=(p+z*z/(2*completed))/d,half=z*Math.sqrt(p*(1-p)/completed+z*z/(4*completed*completed))/d;
  return {successes,completed,rate:p,wilson95:[Math.max(0,center-half),Math.min(1,center+half)]};
}
const rateText=r=>!r||r.rate===null?'—':`${r.successes}/${r.completed} (${(100*r.rate).toFixed(1)}%; ${(100*r.wilson95[0]).toFixed(1)}–${(100*r.wilson95[1]).toFixed(1)}%)`;
export function medianExact(values){
  if(!values.length)return null;
  const sorted=values.map(Q.parse).sort((a,b)=>a.cmp(b)), k=sorted.length>>1;
  return (sorted.length%2?sorted[k]:sorted[k-1].add(sorted[k]).div(new Q(2))).toString();
}
function certificate(file,instance){
  const doc=load(path(file)), cert=doc.certificate??doc;
  const check=verifyCertificate(cert,{expectedN:instance.n,expectedContainer:instance.container});
  if(!check.valid)throw Error('Exact replay rejected certificate');
  return {path:file,sha256:sha(path(file)),size:Q.parse(cert.size).toString(),certificate:cert,selected_baseline:typeof doc.selected_baseline==='boolean'?doc.selected_baseline:null};
}
export function drawing(cert,scaleSize,title){
  if(!cert)return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 310"><text x="15" y="40">Unavailable</text></svg>`;
  const s=num(cert.size), circle=cert.container==='circle';
  const extent=circle?2*scaleSize:scaleSize, factor=270/extent;
  const xy=(x,y)=>[170+x*factor,circle?160-y*factor:290-y*factor];
  const points=pts=>pts.map(([x,y])=>xy(x,y).map(v=>v.toFixed(5)).join(',')).join(' ');
  let out=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 330" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title><rect width="340" height="330" fill="white"/>`;
  out+=circle?`<circle cx="170" cy="160" r="${s*factor}" fill="none" stroke="#334155"/>`:`<polygon points="${points([[-s/2,0],[s/2,0],[0,s*Math.sqrt(3)/2]])}" fill="none" stroke="#334155"/>`;
  for(const p of cert.pieces){const x=num(p.x),y=num(p.y),t=num(p.t),c=(1-t*t)/(1+t*t),u=2*t/(1+t*t);
    out+=`<polygon points="${points([[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([a,b])=>[x+c*a-u*b,y+u*a+c*b]))}" fill="#dbeafe" stroke="#1e40af" stroke-width="0.65"/>`;
  }
  return out+`<text x="170" y="320" text-anchor="middle" font-size="11" fill="#334155">${esc(title)}</text></svg>`;
}
export function generate(resultsDirectory,{outputDirectory,root=ROOT}={}){
  if(root!==ROOT)throw Error('Alternate roots are unsupported');
  const dir=resolve(resultsDirectory),out=resolve(outputDirectory??resolve(dir,'report'));mkdirSync(out,{recursive:true});
  const tasks=load(resolve(dir,'tasks.json')),manifest=load(resolve(dir,'manifest.json'));
  const registryPath=existsSync(resolve(dir,'source/registry/records.json'))?resolve(dir,'source/registry/records.json'):path('registry/records.json');
  const records=load(registryPath).records;
  const recoveryTolerance=String(manifest.metrics?.baseline_recovery_relative_tolerance??'0.00001');
  const meaningfulTolerance=String(manifest.metrics?.meaningful_local_improvement_relative??'0.000001');
  const baseIndexPath=[resolve(dir,'baselines/index.json'),resolve(dir,'baseline_index.json'),path('results/baselines/index.json')].find(existsSync);
  const baseIndex=baseIndexPath?load(baseIndexPath):[];
  const errors=[],rows=[];
  for(const task of tasks){
    const row={task_id:task.task_id,instance_id:task.instance.id,arm:task.arm,seed:task.seed,start_kind:task.warm_path?'warm':'fresh',status:'missing',cpu_seconds:null,certification_wall_seconds:0,selected_baseline:null};
    if(existsSync(task.output)){
      try{const r=load(task.output);row.status=r.status;row.cpu_seconds=typeof r.cpu_seconds==='number'&&Number.isFinite(r.cpu_seconds)&&r.cpu_seconds>=0?r.cpu_seconds:null;row.certification_wall_seconds=r.certification_wall_seconds??0;
        if(r.status==='certified'){
          const c=certificate(r.certificate_path,task.instance);Object.assign(row,{status:'valid',size:c.size,certificate_path:c.path,certificate_sha256:c.sha256,selected_baseline:c.selected_baseline??(typeof r.selected_baseline==='boolean'?r.selected_baseline:null)});
        }
      }catch(e){row.status='replay_or_read_failed';row.error=e.message;errors.push({task_id:task.task_id,error:e.message});}
    } rows.push(row);
  }
  const cases=[];
  for(const instance of [...new Map(tasks.map(t=>[t.instance.id,t.instance])).values()]){
    const runs=rows.filter(r=>r.instance_id===instance.id),valid=runs.filter(r=>r.status==='valid').sort((a,b)=>Q.parse(a.size).cmp(Q.parse(b.size)));
    let baseline=null;const entry=baseIndex.find(b=>b.id===instance.id);
    if(entry)try{baseline=certificate(entry.certificate,instance);}catch(e){errors.push({baseline:instance.id,error:e.message});}
    const best=valid[0]??null,groups=[];
    for(const arm of [...new Set(runs.map(r=>r.arm))])for(const start_kind of ['fresh','warm']){
      const group=runs.filter(r=>r.arm===arm&&r.start_kind===start_kind),ok=group.filter(r=>r.status==='valid');
      if(!group.length)continue;
      const median=medianExact(ok.map(r=>r.size));
      const missing=group.filter(r=>r.status==='missing').length,completed=group.length-missing;
      const count=factor=>baseline?ok.filter(r=>Q.parse(r.size).cmp(Q.parse(baseline.size).mul(factor))<=0).length:null;
      const recovered=count(new Q(1).add(Q.parse(recoveryTolerance))),meaningful=count(new Q(1).sub(Q.parse(meaningfulTolerance)));
      groups.push({arm,start_kind,seeds:group.map(r=>r.seed),tasks:group.length,valid:ok.length,missing,median_size_exact:median,median_size_numeric:median?num(median):null,search_cpu_hours:group.reduce((a,r)=>a+(r.cpu_seconds??0),0)/3600,unknown_search_cpu_cost_tasks:group.filter(r=>r.status!=='missing'&&r.cpu_seconds===null).length,selected_baseline_count:ok.filter(r=>r.selected_baseline===true).length,unchanged_exact_baseline_count:baseline?ok.filter(r=>Q.parse(r.size).cmp(Q.parse(baseline.size))===0).length:null,baseline_recovery_count:recovered,meaningful_local_improvement_count:meaningful,baseline_recovery_rate:baseline?successRate(recovered,completed):null,meaningful_local_improvement_rate:baseline?successRate(meaningful,completed):null,strict_local_improvement_count:baseline?ok.filter(r=>Q.parse(r.size).cmp(Q.parse(baseline.size))<0).length:null});
    }
    const record=records.find(r=>r.id===instance.id),delta=baseline&&best?Q.parse(baseline.size).sub(Q.parse(best.size)):null;
    const item={id:instance.id,n:instance.n,container:instance.container,split:instance.split,baseline:baseline?{size_exact:baseline.size,size_numeric:num(baseline.size),certificate_path:baseline.path,certificate_sha256:baseline.sha256}:null,best:best?{...best,size_numeric:num(best.size)}:null,baseline_minus_best_exact:delta?.toString()??null,baseline_minus_best_numeric:delta?.toNumber()??null,strict_local_improvement:delta?delta.cmp(new Q(0))>0:null,source_comparison:best&&record?compareReportedBound(record,best.size):{relation:'unavailable',world_record_established:false},groups};
    const bestCert=best?certificate(best.certificate_path,instance).certificate:null;
    const scale=Math.max(baseline?num(baseline.size):0,best?num(best.size):0)||1;
    for(const [label,cert]of [['baseline',baseline?.certificate],['best',bestCert]])writeFileSync(resolve(out,`${instance.id}-${label}.svg`),drawing(cert,scale,`${instance.id}: ${label}`));
    cases.push(item);
  }
  const summary={schema_version:1,generated_at:new Date().toISOString(),results_directory:relative(ROOT,dir).replaceAll('\\','/'),manifest,manifest_sha256:sha(resolve(dir,'manifest.json')),registry_sha256:sha(registryPath),completion_marker:existsSync(resolve(dir,'completion.json'))?load(resolve(dir,'completion.json')):null,totals:{tasks:rows.length,valid:rows.filter(r=>r.status==='valid').length,missing:rows.filter(r=>r.status==='missing').length,failed_or_unverified:rows.filter(r=>!['valid','missing'].includes(r.status)).length,search_cpu_hours:rows.reduce((a,r)=>a+(r.cpu_seconds??0),0)/3600,unknown_search_cpu_cost_tasks:rows.filter(r=>r.status!=='missing'&&r.cpu_seconds===null).length,certification_wall_hours_summed:rows.reduce((a,r)=>a+r.certification_wall_seconds,0)/3600},notice:'Local baseline improvements only; no world records established. Baselines are certified reconstructions, not original full-precision incumbents. Exact replay and ranking use selected certificates, never numeric_best. CPU hours are recorded search cost only and exclude certification; failed runs with unavailable CPU accounting are counted separately, not assumed to have cost zero. Summed certification wall hours are not CPU hours. Medians condition on valid runs; missing and failures remain visible. SVGs use floating-point rendering only.',cases,runs:rows,errors};
  summary.baseline_index=baseIndexPath?{path:relative(ROOT,baseIndexPath).replaceAll('\\','/'),sha256:sha(baseIndexPath),campaign_snapshot:baseIndexPath!==path('results/baselines/index.json')}:null;
  summary.registry_sha256=sha(registryPath);
  summary.registry_path=relative(ROOT,registryPath).replaceAll('\\','/');
  summary.metrics={recovery_relative_tolerance:recoveryTolerance,meaningful_local_improvement_relative:meaningfulTolerance,success_rate_denominator:'completed tasks including failed or unverified runs; missing excluded',interval:'95% Wilson marginal descriptive intervals, not paired arm-comparison tests'};
  const checkerHash=sha(path('checkers/squares.mjs'));
  summary.reporting_provenance={report_sha256:sha(fileURLToPath(import.meta.url)),checker_sha256:checkerHash,comparator_sha256:sha(path('registry/compare.mjs')),tasks_sha256:sha(resolve(dir,'tasks.json')),checker_matches_campaign_manifest:manifest.source_hashes?.['checkers/squares.mjs']?checkerHash===manifest.source_hashes['checkers/squares.mjs']:null};
  summary.notice+=' Recovery and meaningful improvement thresholds follow manifest.metrics (defaults 1e-5 and 1e-6). Success rates include failed completed runs as nonsuccesses and exclude missing runs. Wilson intervals are descriptive marginal intervals; common seeds pair arms, so these intervals do not test arm differences.';
  summary.notice+=' Warm runs retain the exact baseline as a fallback: warm recovery is guaranteed by retention when certification succeeds, not evidence of rediscovery. Selected-baseline counts identify the unchanged witness; equal-baseline-bound counts also include other witnesses with exactly the same size.';
  if(summary.totals.unknown_search_cpu_cost_tasks)summary.notice+=` Search CPU cost is unavailable for ${summary.totals.unknown_search_cpu_cost_tasks} completed tasks; the reported CPU total is therefore only the recorded subtotal.`;
  if(summary.baseline_index&&!summary.baseline_index.campaign_snapshot)summary.notice+=' Baseline index was read from the live baseline directory; archive this report and its referenced certificates before baselines change.';
  writeFileSync(resolve(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');
  let md=`# Packing pilot evaluation\n\n${summary.notice}\n\nTasks: ${summary.totals.tasks}; independently replayed valid: ${summary.totals.valid}; missing: ${summary.totals.missing}; failed or unverified: ${summary.totals.failed_or_unverified}. Recorded search CPU hours: ${summary.totals.search_cpu_hours.toFixed(4)}; completed tasks with unknown search CPU cost: ${summary.totals.unknown_search_cpu_cost_tasks}.\n\n| Case | Derived baseline | Best certified | Baseline − best | Source claim comparison |\n|---|---:|---:|---:|---|\n`;
  for(const c of cases)md+=`| ${c.id} | ${fmt(c.baseline?.size_numeric)} | ${fmt(c.best?.size_numeric)} | ${fmt(c.baseline_minus_best_numeric)} | ${c.source_comparison.relation} |\n`;
  for(const c of cases){md+=`\n## ${c.id}\n\nExact baseline minus best: \`${c.baseline_minus_best_exact??'unavailable'}\`. Positive means a smaller certified local container. Thresholds: recovery +${recoveryTolerance}, meaningful improvement −${meaningfulTolerance}, relative to baseline. Rate cells show success/completed, percent, and 95% Wilson interval.\n\n| Arm | Start | Valid / tasks | Missing | Valid-run median | CPU hours | Recovery rate | Meaningful improvement rate | Strict exact improvements |\n|---|---|---:|---:|---:|---:|---|---|---:|\n`;
    for(const g of c.groups)md+=`| ${g.arm} | ${g.start_kind} | ${g.valid} / ${g.tasks} | ${g.missing} | ${fmt(g.median_size_numeric)} | ${g.search_cpu_hours.toFixed(4)} | ${rateText(g.baseline_recovery_rate)} | ${rateText(g.meaningful_local_improvement_rate)} | ${g.strict_local_improvement_count??'—'} |\n`;
    md+='\n| Arm / start | Selected unchanged witness | Equal baseline bound | Unknown search CPU cost |\n|---|---:|---:|---:|\n';
    for(const g of c.groups)md+=`| ${g.arm} / ${g.start_kind} | ${g.selected_baseline_count} | ${g.unchanged_exact_baseline_count??'—'} | ${g.unknown_search_cpu_cost_tasks} |\n`;
    md+=`\n![Derived baseline](${c.id}-baseline.svg) ![Best certified](${c.id}-best.svg)\n`;
  }
  writeFileSync(resolve(out,'REPORT.md'),md);
  let html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Packing pilot evaluation</title><style>body{font:15px system-ui;max-width:1200px;margin:2em auto;padding:0 1em;color:#172033}table{border-collapse:collapse;width:100%;margin:1em 0}th,td{border-bottom:1px solid #ccd3dd;padding:.5em;text-align:left}section{margin:3em 0}.pair{display:flex;gap:1em}.pair svg{width:48%;max-height:410px}code{overflow-wrap:anywhere}p{line-height:1.6}</style><h1>Packing pilot evaluation</h1><p>${esc(summary.notice)}</p><p>${summary.totals.valid} / ${summary.totals.tasks} valid; ${summary.totals.missing} missing; ${summary.totals.failed_or_unverified} failed or unverified. Recorded search CPU hours: ${summary.totals.search_cpu_hours.toFixed(4)}; completed tasks with unknown search CPU cost: ${summary.totals.unknown_search_cpu_cost_tasks}.</p>`;
  for(const c of cases){html+=`<section><h2>${esc(c.id)}</h2><p>Derived baseline: ${fmt(c.baseline?.size_numeric)}. Best certified: ${fmt(c.best?.size_numeric)}. Source comparison: <strong>${esc(c.source_comparison.relation)}</strong>.</p><p>Exact baseline minus best: <code>${esc(c.baseline_minus_best_exact??'unavailable')}</code>.</p><div class="pair">${readFileSync(resolve(out,`${c.id}-baseline.svg`),'utf8')}${readFileSync(resolve(out,`${c.id}-best.svg`),'utf8')}</div><table><tr><th>Arm</th><th>Start</th><th>Valid / tasks</th><th>Missing</th><th>Valid-run median</th><th>CPU hours</th></tr>`;
    for(const g of c.groups)html+=`<tr><td>${esc(g.arm)}</td><td>${g.start_kind}</td><td>${g.valid} / ${g.tasks}</td><td>${g.missing}</td><td>${fmt(g.median_size_numeric)}</td><td>${g.search_cpu_hours.toFixed(4)}</td></tr>`;
    html+='</table><p>Rates below show success/completed, percent, and 95% Wilson interval. Strict exact improvement can be smaller than the meaningful threshold.</p><table><tr><th>Arm / start</th><th>Recovery</th><th>Meaningful improvement</th><th>Strict exact improvements</th></tr>';
    for(const g of c.groups)html+=`<tr><td>${esc(g.arm)} / ${g.start_kind}</td><td>${rateText(g.baseline_recovery_rate)}</td><td>${rateText(g.meaningful_local_improvement_rate)}</td><td>${g.strict_local_improvement_count??'—'}</td></tr>`;
    html+='</table><table><tr><th>Arm / start</th><th>Selected unchanged witness</th><th>Equal baseline bound</th><th>Unknown search CPU cost</th></tr>';
    for(const g of c.groups)html+=`<tr><td>${esc(g.arm)} / ${g.start_kind}</td><td>${g.selected_baseline_count}</td><td>${g.unchanged_exact_baseline_count??'—'}</td><td>${g.unknown_search_cpu_cost_tasks}</td></tr>`;
    html+='</table></section>';
  }writeFileSync(resolve(out,'index.html'),html+'</html>');return summary;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [dir,out]=process.argv.slice(2);if(!dir){console.error('Usage: node reporting/report.mjs RESULTS_DIRECTORY [OUTPUT_DIRECTORY]');process.exitCode=2;}else{const s=generate(dir,{outputDirectory:out});console.log(JSON.stringify(s.totals));}
}

// Run before/after checker changes; output scores must remain exactly equal.
import { readdirSync,readFileSync,writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { certifyCandidate } from '../checkers/squares.mjs';
const rows=[];
for(const name of readdirSync('data/seeds').filter(x=>x.endsWith('.json')).sort()){
  const candidate=JSON.parse(readFileSync(`data/seeds/${name}`,'utf8'));
  const start=performance.now(),r=certifyCandidate(candidate);
  rows.push({file:name,milliseconds:performance.now()-start,size_exact:r.certificate.size,dilation:r.repair.center_dilation});
}
const report={total_ms:rows.reduce((s,r)=>s+r.milliseconds,0),rows};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));

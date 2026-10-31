import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {selectBest} from '../checkers/select-best.mjs';
import {Rational} from '../checkers/squares.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const config=read('research/pilot_targets.json');
mkdirSync('results/baselines',{recursive:true});
const index=[];
for(const instance of config.instances){
  const reconstruction=read(`results/reconstruction_v2/${instance.id}.json`);
  const existing=read(`results/baselines/${instance.id}.json`);
  const input={instance:{n:instance.n,container:instance.container},candidates:[reconstruction.best,existing]};
  const selected=selectBest(input);
  if(!selected.valid)throw Error(`No baseline ${instance.id}`);
  const certPath=`results/baselines/${instance.id}.certificate.json`;
  writeFileSync(certPath,JSON.stringify(selected,null,2)+'\n');
  const c=selected.certificate;
  const num=s=>Rational.parse(s).toNumber();
  const candidate={schema_version:1,shape:'unit_square',n:c.n,container:c.container,size:num(c.size),
    pieces:c.pieces.map(p=>({x:num(p.x),y:num(p.y),theta:2*Math.atan(num(p.t))})),
    provenance:{kind:'certified_source_reconstruction',source_seed:`data/seeds/${instance.id}.json`,reconstruction:`results/reconstruction_v2/${instance.id}.json`,certificate:certPath,original_full_precision_incumbent:false}};
  const path=`results/baselines/${instance.id}.json`;
  writeFileSync(path,JSON.stringify(candidate,null,2)+'\n');
  index.push({id:instance.id,path,certificate:certPath,size:candidate.size,size_exact:c.size,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});
  console.log(instance.id,candidate.size);
}
writeFileSync('results/baselines/index.json',JSON.stringify(index,null,2)+'\n');
writeFileSync('registry/local_baselines.json',JSON.stringify({schema_version:1,evidence_state:'exactly_certified_local_reconstructions',world_record_established:false,records:index},null,2)+'\n');

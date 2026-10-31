import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const write=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');
const pilot=read('research/pilot_targets.json');
const source=read('data/sources/minmax-tilted-squares-in-circle.json');
const pixels=read('data/reconstructions/triangle-pixel-regions.json');
const sourceManifest=read('data/sources/manifest.json');
for(const a of sourceManifest.artifacts) assert.equal(hash(a.path),a.sha256);
fs.mkdirSync('data/seeds',{recursive:true});
const orientation=t=>((t+Math.PI/4)%(Math.PI/2)+Math.PI/2)%(Math.PI/2)-Math.PI/4;
const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
function hull(points){
  const p=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const lower=[],upper=[];
  for(const v of p){while(lower.length>=2&&cross(lower.at(-2),lower.at(-1),v)<=0)lower.pop();lower.push(v);}
  for(const v of p.reverse()){while(upper.length>=2&&cross(upper.at(-2),upper.at(-1),v)<=0)upper.pop();upper.push(v);}
  return lower.slice(0,-1).concat(upper.slice(0,-1));
}
function rectangle(points){
  const h=hull(points);let best;
  for(let i=0;i<h.length;i++){
    const a=h[i],b=h[(i+1)%h.length],theta=Math.atan2(b[1]-a[1],b[0]-a[0]);
    const c=Math.cos(theta),s=Math.sin(theta);
    const xx=points.map(p=>p[0]*c+p[1]*s),yy=points.map(p=>-p[0]*s+p[1]*c);
    const xmin=Math.min(...xx),xmax=Math.max(...xx),ymin=Math.min(...yy),ymax=Math.max(...yy);
    const area=(xmax-xmin)*(ymax-ymin), u=(xmin+xmax)/2,v=(ymin+ymax)/2;
    if(!best||area<best.area)best={area,x:u*c-v*s,y:u*s+v*c,theta};
  }
  return best;
}
const records=[];
for(const target of pilot.instances){
  const triangle=target.container==='equilateral_triangle';
  const common={instance_id:target.id,shape:'unit_square',container:target.container,n:target.n};
  let seed,claim;
  if(!triangle){
    const record=source.instances.find(x=>x.parameters.n===target.n);
    assert.ok(record?.answer?.squares?.length===target.n);
    const squares=record.answer.squares;
    const side=Math.min(...squares.map(s=>2*Math.hypot(Number(s.ux),Number(s.uy))));
    seed={...common,size:1/side,pieces:squares.map(s=>({x:(Number(s.cx)-1)/side,y:(Number(s.cy)-1)/side,theta:orientation(Math.atan2(Number(s.uy),Number(s.ux)))})),
      provenance:{kind:'source_derived_warm_start',source:'https://minmaxarena.com/data/tilted-squares-in-circle.json',source_instance:record.instanceId,source_generated_at:source.generatedAt,source_holder:record.holder,source_method:record.method,source_recorded_at:record.recordedAt,source_sha256:hash('data/sources/minmax-tilted-squares-in-circle.json'),license:'CC-BY-4.0',attribution:'MinMax Arena and the named record holder; originating construction credited separately by Erich Friedman catalogue',transformation:'Subtract circle center (1,1); divide centers and radius by the shortest published square side; replace every square by a concentric unit square in its published orientation. Floating seed only; exact checker must repair and certify.',certification:'not_certified',original_full_precision_incumbent:false}};
    claim={type:'site_witness',holder:record.holder,reported_common_side:record.scoreDisplay,normalized_radius_estimate:1/side,site_record_status:record.recordStatus,source_semantics:'Min-side objective allows last-digit size differences; normalization is a derived pose, not source exact congruence.',source_instance:record.instanceId};
  }else{
    const rec=pixels.find(x=>x.n===target.n);assert.equal(rec.components.length,target.n);
    const left=Math.min(...rec.dark.map(p=>p[0])),right=Math.max(...rec.dark.map(p=>p[0])),bottom=Math.max(...rec.dark.map(p=>p[1]));
    const L=Number(target.catalogue_display.replace('+',''));
    const scale=(right-left)/L;
    seed={...common,size:L,pieces:rec.components.map(region=>{const r=rectangle(region);return {x:(r.x-(left+right)/2)/scale,y:(bottom-r.y)/scale,theta:orientation(-r.theta)};}),
      provenance:{kind:'figure_digitization_warm_start',source:`https://erich-friedman.github.io/packing/squintri/ts${target.n}.gif`,source_sha256:hash(`data/sources/friedman-squintri-${target.n}.gif`),source_author:'David W. Cantrell',source_date:'2002-07',method:'Flood-fill the 181-gray connected regions; fit minimum-area rectangles to pixel convex hulls; use black outer triangle extent and truncated published side to initialize scale.',pixel_scale:scale,license:'Original figure licence unspecified; derived geometry and attribution retained for research.',certification:'not_certified',original_full_precision_incumbent:false,warning:'Raster positions and orientation are approximate and may overlap. Polishing and exact repair are mandatory.'}};
  }
  assert.equal(seed.pieces.length,target.n);
  for(const p of seed.pieces)for(const k of ['x','y','theta'])assert.ok(Number.isFinite(p[k]));
  const seedPath=`data/seeds/${target.id}.json`;write(seedPath,seed);
  const author=triangle||target.n!==11?'David W. Cantrell':'Milan Kovacic';
  const dates=triangle?'2002-07':({11:'2006-05',13:'2010-11',15:'2002-06',18:'2002-03',20:'2002-06'})[target.n];
  const displayed=target.catalogue_display.replace('+','');
  const decimals=displayed.split('.')[1]?.length??0;
  records.push({id:target.id,contract:{shape:'square',unit:'edge_length_1',dimension:2,n:target.n,container:target.container,objective:target.objective,allowed_transforms:['translation','rotation'],boundary_contact:'permitted',interior_overlap:'forbidden',coordinate_convention:triangle?'vertices(-L/2,0),(L/2,0),(0,sqrt(3)*L/2)':'center(0,0), radius=size'},split:target.split,
    reported_incumbent:{display:target.catalogue_display,numeric_semantics:target.n===18&&!triangle?'exact_algebraic_expression_with_truncated_decimal_display':'truncated_decimal_display',...(target.n===18&&!triangle?{expression:'sqrt(481)/8',squared_value:{numerator:'481',denominator:'64'}}:{reported_precision_interval:{lower:displayed,upper:(Number(displayed)+10**(-decimals)).toFixed(decimals),upper_open:true},interval_scope:'Interval for the printed construction value, not an impossibility lower bound on the optimum.'}),author,publication_month:dates,source_url:target.source,source_snapshot:triangle?'data/sources/friedman-squintri.html':'data/sources/friedman-squincir.html',evidence_state:'reported_catalogue',full_coordinates_available:false},
    certified_incumbent:null,verified_lower_bound:null,newer_source_claim:claim??null,
    warm_start:{path:seedPath,sha256:hash(seedPath),kind:seed.provenance.kind,certification:'not_certified'},
    record_priority:'unresolved_pending_full_incumbent_and_competing_claim_review',proof_status:'no_optimality_proof_imported',source_retrieval_date:'2026-10-30'});
}
write('registry/records.json',{schema_version:1,research_date:'2026-10-30',source_manifest:'data/sources/manifest.json',notice:'None of the ten original full-precision catalogue witnesses was available in the inspected source. Warm starts are explicitly derived, and certified_incumbent is intentionally null pending local exact replay. No world-record comparisons may use seed size as the original record.',coverage_notes:['Friedman directories contain diagrams and HTML; no original coordinates found.','Hyra SUMMARY.csv contains circle cases22,25,31,33 and triangle20,39,41,42,43; none is one of these ten.','MinMax Arena supplied current square-circle site answers for all five counts; these are derived from source arrangements and subsequent refinements.','Triangle warm starts are newly digitized source diagrams, not numerical incumbent certificates.'],records});
console.log(JSON.stringify(records.map(r=>({id:r.id,kind:r.warm_start.kind,size:read(r.warm_start.path).size})),null,2));

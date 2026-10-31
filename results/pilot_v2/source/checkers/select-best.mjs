/** Certify a numerical shortlist and choose its exact smallest feasible witness. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { Rational, certifyCandidate, verifyCertificate } from './squares.mjs';

export function selectBest(input,{digits=12}={}) {
  const instance=input?.instance;
  if(!instance||!Number.isSafeInteger(instance.n)||instance.n<1||!['circle','equilateral_triangle','square'].includes(instance.container))throw Error('Invalid external instance contract');
  if(!Array.isArray(input.candidates)||input.candidates.length===0)throw Error('Nonempty candidates array required');
  let winner=null,winningSize=null,selectedIndex=null,selectedBaseline=false;
  const failures=[],summary=[];
  const baselineConsidered=input.baseline_certificate!==undefined;
  if(baselineConsidered){
    try{
      const verification=verifyCertificate(input.baseline_certificate,{expectedN:instance.n,expectedContainer:instance.container});
      if(!verification.valid)throw Error('Baseline certificate is geometrically invalid');
      winningSize=Rational.parse(input.baseline_certificate.size);
      winner={certificate:input.baseline_certificate,verification,repair:{certified_size_numeric:winningSize.toNumber(),center_dilation:'1',translation:['0','0'],method:'unchanged exact baseline'}};
      selectedBaseline=true;
    }catch(error){failures.push({baseline:true,error:error.message});}
  }
  for(let index=0;index<input.candidates.length;index++){
    try {
      const proposal=input.candidates[index];
      if(proposal?.n!==instance.n||proposal?.container!==instance.container||proposal?.shape!=='unit_square')throw Error('Candidate differs from external instance contract');
      const result=certifyCandidate(proposal,{digits});
      const checked=verifyCertificate(result.certificate,{expectedN:instance.n,expectedContainer:instance.container});
      if(!checked.valid)throw Error('Replayed certificate is invalid');
      const size=Rational.parse(result.certificate.size);
      summary.push({index,valid:true,size_exact:size.toString(),size_numeric:size.toNumber(),center_dilation:result.repair.center_dilation,proposed_size:proposal.size??null});
      // Strict comparison preserves the first witness on an exact tie.
      if(winningSize===null||size.cmp(winningSize)<0){winner={...result,verification:checked};winningSize=size;selectedIndex=index;selectedBaseline=false;}
    }catch(error){
      failures.push({index,error:error.message});
      summary.push({index,valid:false,error:error.message});
    }
  }
  if(winner===null)return {valid:false,selected_index:null,selected_baseline:false,baseline_considered:baselineConsidered,candidate_count:input.candidates.length,failures,candidate_summary:summary,error:'No candidate could be certified'};
  return {valid:true,...winner,selected_index:selectedIndex,selected_baseline:selectedBaseline,baseline_considered:baselineConsidered,candidate_count:input.candidates.length,failures,candidate_summary:summary};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const [inputFile,outputFile]=process.argv.slice(2);
    if(!inputFile)throw Error('Usage: node checkers/select-best.mjs shortlist.json [selected.json]');
    const raw=readFileSync(inputFile,'utf8'),result=selectBest(JSON.parse(raw));
    const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
    const output={...result,input_sha256:hash(raw),checker_sha256:hash(readFileSync(new URL('./squares.mjs',import.meta.url))),selector_sha256:hash(readFileSync(fileURLToPath(import.meta.url)))};
    if(outputFile)writeFileSync(outputFile,JSON.stringify(output,null,2)+'\n');else console.log(JSON.stringify(output,null,2));
    if(!result.valid)process.exitCode=1;
  }catch(error){console.error(JSON.stringify({valid:false,error:error.message}));process.exitCode=2;}
}

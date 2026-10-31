"""Local, resumable pilot launcher. Imports pinned dependencies from .deps."""
from __future__ import annotations
import os
for key in ("OPENBLAS_NUM_THREADS","OMP_NUM_THREADS","MKL_NUM_THREADS","NUMEXPR_NUM_THREADS"):
    os.environ[key]="1"
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/".deps"))
import argparse
import concurrent.futures as futures
import hashlib
import json
import subprocess
import shutil
import time
import traceback

def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def load(path): return json.loads(Path(path).read_text(encoding="utf8"))

def worker(task):
    from packing_shapes.search import run_search,atomic_json
    instance=task["instance"]; output=Path(task["output"])
    candidate_path=output.with_suffix(".candidate.json")
    started=time.time()
    try:
        if task.get("warm_path") and sha(task["warm_path"])!=task["warm_sha256"]:raise RuntimeError("Warm-start content changed")
        warm=load(task["warm_path"]) if task.get("warm_path") else None
        result=run_search(instance,task["arm"],task["seed"],task["seconds"],warm,
                          checkpoint=lambda c:atomic_json(candidate_path,c))
        result.update({"task_id":task["task_id"],"started_epoch":started,"finished_epoch":time.time(),
                       "status":"search_complete","warm_source":task.get("warm_path"),"budget_cpu_seconds":task["seconds"]})
        if result["numeric_best"] is not None:
            shortlist_path=output.with_suffix(".shortlist.json")
            shortlist={"instance":{"n":instance["n"],"container":instance["container"]},"candidates":result["certification_candidates"]}
            if warm and warm.get("provenance",{}).get("certificate"):
                source_cert=load(ROOT/warm["provenance"]["certificate"])
                shortlist["baseline_certificate"]=source_cert.get("certificate",source_cert)
            atomic_json(shortlist_path,shortlist)
            cert_path=output.with_suffix(".certificate.json")
            t=time.monotonic()
            certified=subprocess.run(["node",str(ROOT/"checkers/select-best.mjs"),str(shortlist_path),str(cert_path)],capture_output=True,text=True,timeout=120)
            result["certification_wall_seconds"]=time.monotonic()-t
            result["certification_exit_code"]=certified.returncode
            if certified.returncode==0:
                cert=load(cert_path)
                assert cert["verification"]["valid"] and cert["certificate"]["n"]==instance["n"] and cert["certificate"]["container"]==instance["container"]
                result["certified_size"]=cert["repair"]["certified_size_numeric"]
                result["certificate_path"]=str(cert_path.relative_to(ROOT)).replace('\\','/')
                result["selected_candidate_index"]=cert["selected_index"]
                result["selected_baseline"]=cert["selected_baseline"]
                atomic_json(candidate_path,warm if cert["selected_baseline"] else result["certification_candidates"][cert["selected_index"]])
                result["status"]="certified"
            else:
                result["certification_error"]=certified.stderr[-4000:]; result["status"]="certification_failed"
        atomic_json(output,result)
        return {k:result.get(k) for k in ("task_id","status","certified_size","cpu_seconds","wall_seconds")}
    except Exception:
        error={"task_id":task["task_id"],"status":"failed","error":traceback.format_exc(),"finished_epoch":time.time()}
        atomic_json(output,error); return error

def execute(tasks,workers,out,all_tasks):
    from packing_shapes.search import atomic_json
    pending=[t for t in tasks if not Path(t["output"]).exists()]
    completed=len(tasks)-len(pending); started=time.monotonic(); last=0
    print(json.dumps({"total":len(tasks),"resumed":completed,"workers":workers}),flush=True)
    with futures.ProcessPoolExecutor(max_workers=workers) as pool:
        active={pool.submit(worker,t):t for t in pending}
        while active:
            done,_=futures.wait(active,timeout=10,return_when=futures.FIRST_COMPLETED)
            for f in done:
                active.pop(f); value=f.result(); completed+=1
                with (out/"events.jsonl").open("a",encoding="utf8") as log: log.write(json.dumps(value)+"\n")
                print(json.dumps(value),flush=True)
            if time.monotonic()-last>=30 or not active:
                global_done=sum(Path(t["output"]).exists() for t in all_tasks)
                status={"completed":global_done,"total":len(all_tasks),"current_split_completed":completed,"current_split_total":len(tasks),"pending_current_split":len(active),"elapsed_split_wall_seconds":time.monotonic()-started,"updated_epoch":time.time()}
                atomic_json(out/"progress.json",status);last=time.monotonic()
    return completed

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("mode",choices=["prepare","smoke","pilot"])
    parser.add_argument("--workers",type=int,default=6)
    parser.add_argument("--seconds",type=float)
    parser.add_argument("--output")
    parser.add_argument("--instances",nargs="*")
    parser.add_argument("--arms",nargs="*")
    args=parser.parse_args()
    from packing_shapes.search import ARMS,atomic_json
    config=load(ROOT/"research/pilot_targets.json"); instances=config["instances"]
    if args.instances: instances=[i for i in instances if i["id"] in args.instances]
    out=ROOT/(args.output or f"results/{args.mode}");out.mkdir(parents=True,exist_ok=True)
    files=[ROOT/"run_pilot.py",*sorted((ROOT/"packing_shapes").glob("*.py")),ROOT/"checkers/squares.mjs",ROOT/"checkers/select-best.mjs",ROOT/"research/pilot_targets.json",ROOT/"registry/records.json"]
    manifest={"mode":args.mode,"source_hashes":{str(p.relative_to(ROOT)).replace('\\','/'):sha(p) for p in files},
              "python":sys.version,"numpy":__import__('numpy').__version__,"scipy":__import__('scipy').__version__,
              "workers":args.workers,"blas_threads":1,"clock":"time.process_time per worker", "created_epoch":time.time(),
              "amendments":["Warm starts use independently certified derived reference poses, not unavailable original full-precision incumbents."],
              "metrics":{"baseline_recovery_relative_tolerance":1e-5,"meaningful_local_improvement_relative":1e-6,"record_claims":"exact registry comparison plus priority review required"}}
    manifest_path=out/"manifest.json"
    if manifest_path.exists():
        old=load(manifest_path)
        if old["source_hashes"]!=manifest["source_hashes"]: raise RuntimeError("Source hashes changed; use a new output directory")
    else:
        atomic_json(manifest_path,manifest)
        for p in files:
            target=out/"source"/p.relative_to(ROOT);target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target)
        if args.mode!="prepare":
            baseline_dir=out/"baselines";baseline_dir.mkdir(exist_ok=True)
            entries=load(ROOT/"results/baselines/index.json")
            for entry in entries:
                cpath=baseline_dir/f"{entry['id']}.certificate.json"
                shutil.copy2(ROOT/entry["certificate"],cpath)
                proposal=load(ROOT/entry["path"])
                proposal["provenance"]["certificate"]=str(cpath.relative_to(ROOT)).replace('\\','/')
                ppath=baseline_dir/f"{entry['id']}.json";atomic_json(ppath,proposal)
                entry.update({"path":str(ppath.relative_to(ROOT)).replace('\\','/'),"certificate":str(cpath.relative_to(ROOT)).replace('\\','/'),"sha256":sha(ppath)})
            atomic_json(baseline_dir/"index.json",entries)
    tasks=[]
    # Development tasks finish before held-out evaluation; code remains frozen throughout.
    instances=sorted(instances,key=lambda i:(i["split"]!="development",i["id"]))
    for ix,instance in enumerate(instances):
        arms=["rigid"] if args.mode=="prepare" else (args.arms or list(ARMS))
        for ai,arm in enumerate(arms):
            repeats=24 if args.mode=="pilot" else 1
            for rep in range(repeats):
                use_warm=args.mode=="prepare" or args.mode=="smoke" or rep>=12
                task_id=f"{instance['id']}__{arm}__{rep:02d}"
                warm_path=(ROOT/"data/seeds"/f"{instance['id']}.json") if args.mode=="prepare" else out/"baselines"/f"{instance['id']}.json"
                if use_warm and not warm_path.exists():raise FileNotFoundError(warm_path)
                seconds=args.seconds if args.seconds is not None else (20 if args.mode=="prepare" else 3 if args.mode=="smoke" else 120)
                # Identical start RNG per instance/rep across arms, then operator-specific consumption.
                seed=271828+10000*config["instances"].index(instance)+rep
                tasks.append({"task_id":task_id,"instance":instance,"arm":arm,"seed":seed,"seconds":seconds,
                              "warm_path":str(warm_path) if use_warm else None,"warm_sha256":sha(warm_path) if use_warm else None,"output":str(out/"runs"/(task_id+".json"))})
    task_file=out/"tasks.json"
    if task_file.exists() and load(task_file)!=tasks:raise RuntimeError("Task configuration changed; use a new output directory")
    atomic_json(task_file,tasks)
    # Explicit split barrier. Preparation is deterministic reference reconstruction, not tuning.
    for split in ("development","held_out"):
        execute([t for t in tasks if t["instance"]["split"]==split],args.workers,out,tasks)
    if args.mode=="prepare":
        from fractions import Fraction
        baseline_index=[]
        for t in tasks:
            r=load(t["output"])
            if r["status"]!="certified":raise RuntimeError(f"Baseline preparation failed: {t['task_id']}")
            cert=load(ROOT/r["certificate_path"])["certificate"]
            import math
            candidate={"schema_version":1,"shape":"unit_square","n":cert["n"],"container":cert["container"],"size":float(Fraction(cert["size"])),
                       "pieces":[{"x":float(Fraction(p["x"])),"y":float(Fraction(p["y"])),"theta":2*math.atan(float(Fraction(p["t"])))} for p in cert["pieces"]],
                       "provenance":{"kind":"locally_polished_and_certified_derived_reference","source_seed":t["warm_path"],"certificate":r["certificate_path"]}}
            path=ROOT/"results/baselines"/f"{t['instance']['id']}.json";atomic_json(path,candidate)
            baseline_index.append({"id":t["instance"]["id"],"path":str(path.relative_to(ROOT)).replace('\\','/'),"size":candidate["size"],"certificate":r["certificate_path"],"sha256":sha(path)})
        atomic_json(ROOT/"results/baselines/index.json",baseline_index)
    summary={"complete":True,"tasks":len(tasks),"failures":[t["task_id"] for t in tasks if load(t["output"])["status"]!="certified"],"finished_epoch":time.time()}
    atomic_json(out/"completion.json",summary); print(json.dumps(summary),flush=True)

if __name__=="__main__":main()

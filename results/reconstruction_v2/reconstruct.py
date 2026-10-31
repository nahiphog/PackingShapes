"""Deterministic source reconstruction, without random perturbations or tuning."""
import json,sys,time
from pathlib import Path
import numpy as np
from scipy.optimize import minimize
from packing_shapes.polish import polish
from packing_shapes.geometry import ConstraintEvaluator, constraint_values

ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent

def snap(z,steps):
    q=z.copy()
    for k in range(2,len(q)-1,3):
        options=[round(q[k]/s)*s for s in steps]
        best=min(options,key=lambda a:abs(a-q[k]))
        if abs(best-q[k])<=.03:q[k]=best
    return q

def reconstruct(path):
    d=json.loads(path.read_text())
    n=d['n'];container=d['container']
    raw=np.array([x for p in d['pieces'] for x in [p['x'],p['y'],p['theta']]]+[d['size']],dtype=float)
    raw[-1]+=.2
    variants=[('source_direct',raw,False),('source_fixed',raw,True),
              ('snap_pi6',snap(raw,[np.pi/6]),True),
              ('snap_pi4',snap(raw,[np.pi/4]),True),
              ('snap_both',snap(raw,[np.pi/6,np.pi/4]),True)]
    best=None; rows=[]
    for name,z,fixed in variants:
        t=time.process_time()
        if fixed:z=polish(z,n,container,maxiter=1000)
        current=None
        def observe(x):
            nonlocal current
            c=constraint_values(x,n,container)
            if c.min()>=-1e-8 and (current is None or x[-1]<current[-1]):current=x.copy()
        observe(z)
        evaluator=ConstraintEvaluator(n,container)
        g=np.zeros(len(z));g[-1]=1
        res=minimize(lambda x:x[-1],z,method='SLSQP',jac=lambda x:g,
                     bounds=[(None,None)]*(3*n)+[(.1,None)],
                     constraints={'type':'ineq','fun':evaluator.fun,'jac':evaluator.jac},
                     callback=observe,options={'maxiter':600,'ftol':1e-12,'disp':False})
        observe(res.x)
        if current is not None and (best is None or current[-1]<best[-1]):best=current.copy()
        row={'variant':name,'numeric_best':None if current is None else float(current[-1]),
             'last_size':float(res.x[-1]),'last_min_constraint':float(evaluator.fun(res.x).min()),
             'iterations':res.nit,'success':bool(res.success),'status':str(res.message),'cpu_seconds':time.process_time()-t}
        rows.append(row)
        print(path.stem,name,row['numeric_best'],flush=True)
    result={'instance_id':path.stem,'source_file':str(path.relative_to(ROOT)),
            'purpose':'Deterministic reconstruction of published source; no randomized search.',
            'variants':rows,'best':None}
    if best is not None:
        result['best']={'schema_version':1,'shape':'unit_square','container':container,'n':n,'size':float(best[-1]),
            'pieces':[dict(x=float(x),y=float(y),theta=float(a)) for x,y,a in best[:-1].reshape(n,3)],
            'provenance':{'kind':'source_reconstruction','source_file':str(path.relative_to(ROOT)),
                          'not_certified':True,'original_full_precision_incumbent':False}}
    (OUT/(path.stem+'.json')).write_text(json.dumps(result,indent=2)+'\n')
    return {k:v for k,v in result.items() if k!='best'}|{'best_size':None if best is None else float(best[-1])}

if __name__=='__main__':
    paths=sorted((ROOT/'data/seeds').glob('*.json'))
    if len(sys.argv)>1:paths=[p for p in paths if any(s in p.stem for s in sys.argv[1:])]
    summary=[reconstruct(p) for p in paths]
    (OUT/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')

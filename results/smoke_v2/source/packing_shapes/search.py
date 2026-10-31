"""Five fixed-budget search arms. Numeric outputs require independent certification."""
from __future__ import annotations
import json
import math
import os
from pathlib import Path
import time

import numpy as np
from scipy.optimize import minimize
from .geometry import constraints
from .polish import polish

ARMS = ("rigid", "basin", "anneal", "homotopy", "structured")

class BudgetExpired(Exception):
    pass

class SoftExpired(Exception):
    def __init__(self,z): self.z=z.copy()

def to_vector(candidate):
    return np.array([v for p in candidate["pieces"] for v in (p["x"], p["y"], p["theta"])] + [candidate["size"]], dtype=float)

def from_vector(z, instance):
    return {"schema_version": 1, "shape": "unit_square", "n": instance["n"],
            "container": instance["container"], "size": float(z[-1]),
            "pieces": [{"x": float(x), "y": float(y), "theta": float(a)} for x,y,a in z[:-1].reshape(-1,3)]}

def initial(n, container, rng, kind="random"):
    if kind == "grid":
        if container == "circle":
            m = math.ceil(math.sqrt(n)) + 2
            pts = np.array([(i,j) for i in range(-m,m+1) for j in range(-m,m+1)], dtype=float)
            pts = pts[np.argsort(np.sum(pts*pts,axis=1)+rng.uniform(0,1e-5,len(pts)))[:n]]
            pts -= pts.mean(axis=0)
            size = np.max(np.linalg.norm(pts,axis=1)) + math.sqrt(.5) + .05
        else:
            size = float(math.ceil(math.sqrt(n*4/math.sqrt(3)))+3)
            pts=[]
            for row in range(int(size)):
                y=.5+row*1.001
                width=size/2-y/math.sqrt(3)-.5-.5/math.sqrt(3)
                if width<0: continue
                count=int(2*width)+1
                pts.extend(((j-(count-1)/2)*1.001,y) for j in range(count))
            pts=np.array(pts[:n]); assert len(pts)==n
        ang=np.zeros(n)
    else:
        size = math.sqrt(n/math.pi)*1.65+1 if container=="circle" else math.sqrt(4*n/math.sqrt(3))*1.55+1
        if container=="circle":
            a=rng.uniform(0,2*math.pi,n); r=(size-.8)*np.sqrt(rng.uniform(0,1,n))
            pts=np.column_stack((r*np.cos(a),r*np.sin(a)))
        else:
            u=rng.uniform(0,1,(n,2)); mask=u.sum(axis=1)>1; u[mask]=1-u[mask]
            pts=np.column_stack((-size/2+size*u[:,0]+size/2*u[:,1],math.sqrt(3)/2*size*u[:,1]))
        ang=rng.uniform(-math.pi/4,math.pi/4,n)
    return np.r_[np.column_stack((pts,ang)).ravel(),size]

def perturb(z, n, rng, amplitude, cluster=False):
    q=z.copy(); p=q[:-1].reshape(n,3)
    if cluster:
        pivot=int(rng.integers(n)); dist=np.sum((p[:,:2]-p[pivot,:2])**2,axis=1)
        ix=np.argsort(dist)[:max(2,int(rng.integers(2,max(3,n//2))))]
        p[ix,:2]+=rng.normal(0,amplitude,(1,2)); p[ix,2]+=rng.normal(0,amplitude)
    else:
        p[:,:2]+=rng.normal(0,amplitude,(n,2)); p[:,2]+=rng.normal(0,amplitude,n)
    q[-1]*=1+min(.12,amplitude*.15)
    return q

def run_search(instance, arm, seed, seconds, warm=None, checkpoint=None):
    if arm not in ARMS: raise ValueError(arm)
    rng=np.random.default_rng(seed); n=instance["n"]; container=instance["container"]
    start=time.process_time(); wall=time.monotonic(); deadline=start+seconds
    best=None; best_size=math.inf; events=[]; shortlist=[]; baseline=None; evaluations=0; rounds=0
    def observe(z,c):
        nonlocal best,best_size
        if np.all(np.isfinite(z)) and z[-1]>0 and float(np.min(c))>=-1e-8 and z[-1]<best_size-1e-10:
            best=z.copy(); best_size=float(z[-1])
            shortlist.append(best.copy())
            if len(shortlist)>12: shortlist.pop(0)
            events.append({"cpu_seconds":time.process_time()-start,"size":best_size,"minimum_constraint":float(np.min(c))})
            if checkpoint: checkpoint(from_vector(best,instance))
    def check_time():
        if time.process_time()>=deadline: raise BudgetExpired()
    def local(z, alpha=1., maxiter=180, penalty_first=False):
        nonlocal evaluations
        cache_z=None; cache=None
        def evaluate(x):
            nonlocal cache_z,cache,evaluations
            check_time()
            if alpha!=1 and deadline-time.process_time()<min(10.,seconds*.25): raise SoftExpired(x)
            if cache_z is None or not np.array_equal(x,cache_z):
                cache=constraints(x,n,container) if alpha==1 else constraints(x,n,container,alpha=alpha)
                cache_z=x.copy(); evaluations+=1
                if alpha==1: observe(x,cache[0])
            return cache
        gradient=np.zeros(len(z)); gradient[-1]=1
        lower=np.full(len(z),-np.inf); upper=np.full(len(z),np.inf); lower[-1]=.1
        if penalty_first or alpha!=1:
            def fun(x):
                c,j=evaluate(x); v=np.minimum(c,0); w=100.
                return float(x[-1]+w*np.dot(v,v)),gradient+2*w*(v@j)
            res=minimize(fun,z,method="L-BFGS-B",jac=True,bounds=list(zip(lower,upper)),options={"maxiter":maxiter,"ftol":1e-12,"gtol":1e-7,"maxls":30})
            z=res.x
        if alpha==1:
            res=minimize(lambda x: (check_time() or float(x[-1])),z,method="SLSQP",jac=lambda x:gradient,
                         bounds=list(zip(lower,upper)),constraints={"type":"ineq","fun":lambda x:evaluate(x)[0],"jac":lambda x:evaluate(x)[1]},
                         options={"maxiter":maxiter,"ftol":2e-11,"disp":False})
            final_c,_=evaluate(res.x)
            # A slightly larger but cleaner final iterate can certify smaller.
            if np.min(final_c)>=-1e-7 and res.x[-1]<=best_size+1e-6:
                shortlist.append(res.x.copy())
                if len(shortlist)>12:shortlist.pop(0)
            if np.min(final_c)>=-1e-6 and deadline-time.process_time()>.5:
                polished=polish(res.x,n,container,maxiter=100,time_limit=min(2.,deadline-time.process_time()),check_budget=check_time)
                pc,_=evaluate(polished)
                if np.min(pc)>=-1e-7 and polished[-1]<=best_size+1e-6:
                    shortlist.append(polished.copy())
                    if len(shortlist)>12:shortlist.pop(0)
                return polished
            return res.x
        return z
    current=to_vector(warm) if warm else initial(n,container,rng,"grid")
    # All arms have the same access to the unperturbed start and its feasible score.
    c,_=constraints(current,n,container); observe(current,c)
    if best is not None: baseline=best.copy()
    try:
        while True:
            check_time(); rounds+=1
            if rounds==1:
                z=current.copy() if warm else initial(n,container,rng,"random" if seed%2 else "grid")
            elif arm=="rigid":
                z=perturb(to_vector(warm),n,rng,float(rng.choice([.03,.1,.3]))) if warm else initial(n,container,rng,"grid" if rounds%3==0 else "random")
            elif arm=="basin":
                z=perturb(best if best is not None else current,n,rng,float(rng.choice([.04,.12,.35,.65])),cluster=rounds%2==0)
            elif arm=="anneal":
                z=perturb(current,n,rng,float(rng.uniform(.03,.5)),cluster=rounds%3==0)
            elif arm=="structured":
                z=(best if best is not None else current).copy(); p=z[:-1].reshape(n,3)
                if rounds%5==0: z=initial(n,container,rng,"grid")
                else:
                    if container=="circle":
                        ix=np.argsort(np.linalg.norm(p[:,:2],axis=1))[-max(2,n//3):]
                        angle=rng.uniform(-.3,.3); co,si=math.cos(angle),math.sin(angle)
                        p[ix,:2]=p[ix,:2]@np.array([[co,si],[-si,co]])
                        p[ix,2]+=rng.choice([angle,-angle,math.pi/4])
                    else:
                        ix=np.argsort(p[:,1])[:max(2,n//3)]
                        p[ix,0]+=rng.uniform(-.5,.5); p[ix,2]+=rng.choice([-math.pi/12,math.pi/12,math.pi/4])
                    z=perturb(z,n,rng,.05,cluster=True)
            else:
                z=perturb(best if best is not None else current,n,rng,.2) if rounds%2==0 else initial(n,container,rng,"random")
            if arm=="homotopy":
                try:
                    for alpha in (0.,.3,.6,.85): z=local(z,alpha=alpha,maxiter=65,penalty_first=True)
                except SoftExpired as e:
                    z=e.z
            z=local(z,penalty_first=(rounds==1 and not warm),maxiter=200)
            c,_=constraints(z,n,container)
            if np.min(c)>=-1e-7:
                if arm=="anneal":
                    temp=.025*max(.05,1-(time.process_time()-start)/seconds)
                    if z[-1]<=current[-1] or rng.random()<math.exp(min(0,(current[-1]-z[-1])/temp)): current=z
                else: current=best.copy() if best is not None else z
    except BudgetExpired:
        pass
    return {"instance_id":instance["id"],"arm":arm,"seed":seed,"start_kind":"warm" if warm else "fresh",
            "cpu_seconds":time.process_time()-start,"wall_seconds":time.monotonic()-wall,
            "rounds":rounds,"evaluations":evaluations,"numeric_best":None if best is None else from_vector(best,instance),
            "certification_candidates":[from_vector(z,instance) for z in ([baseline] if baseline is not None else [])+shortlist],"events":events}

def atomic_json(path, data):
    path=Path(path); path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix(path.suffix+".tmp")
    temp.write_text(json.dumps(data,indent=2,allow_nan=False)+"\n",encoding="utf8"); os.replace(temp,path)

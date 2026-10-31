"""Fixed-orientation, fixed-separation-branch position polishing.

Triangle and square containers use a linear program. Circle containment is
convex at fixed orientations and separation branches; here it is solved with
SLSQP and analytic derivatives, not with a dedicated conic solver. Returned
Float64 poses still require the independent exact checker.
"""
from __future__ import annotations
import numpy as np
from scipy.optimize import linprog, minimize
from .geometry import SIGNS, TRIANGLE_INWARD, TRIANGLE_OFFSETS, constraint_values


def _linear_model(z, n, container):
    z = np.asarray(z, dtype=float)
    if z.shape != (3*n+1,) or not np.isfinite(z).all():
        raise ValueError('Expected finite pose vector with 3*n+1 entries')
    p = z[:-1].reshape(n,3)
    u = np.column_stack((np.cos(p[:,2]),np.sin(p[:,2])))
    v = np.column_stack((-u[:,1],u[:,0]))
    corners = .5*(SIGNS[None,:,0,None]*u[:,None,:]+SIGNS[None,:,1,None]*v[:,None,:])
    rows, rhs = [], []
    for i in range(n):
        for j in range(i+1,n):
            axes = np.stack((u[i],v[i],u[j],v[j]))
            delta = p[j,:2]-p[i,:2]
            projection = axes@delta
            supports = .5*(np.abs(axes@u[i])+np.abs(axes@v[i])+
                            np.abs(axes@u[j])+np.abs(axes@v[j]))
            k = np.argmax(np.abs(projection)-supports)
            axis = axes[k]*(1 if projection[k]>=0 else -1)
            row=np.zeros(2*n+1)
            row[2*i:2*i+2]=axis
            row[2*j:2*j+2]=-axis
            rows.append(row);rhs.append(-supports[k])
    if container == 'equilateral_triangle':
        normals, offsets = TRIANGLE_INWARD, TRIANGLE_OFFSETS
    elif container == 'square':
        normals=np.array([[1.,0.],[0.,1.],[-1.,0.],[0.,-1.]])
        offsets=np.array([0.,0.,1.,1.])
    elif container != 'circle':
        raise ValueError(f'Unsupported container {container}')
    if container != 'circle':
        for i in range(n):
            for normal,offset in zip(normals,offsets):
                row=np.zeros(2*n+1)
                row[2*i:2*i+2]=-normal
                row[-1]=-offset
                # All four vertices; taking the minimum eliminates redundant rows.
                rows.append(row);rhs.append(np.min(corners[i]@normal))
    return np.asarray(rows).reshape(-1,2*n+1),np.asarray(rhs),corners


def polish(z, n, container, maxiter=200):
    """Return a non-worse feasible numerical pose, or an unchanged copy.

    Orientations and one separating direction/order per pair are held fixed.
    Feasibility is screened to 1e-7 for numerical solver noise only, not certified.
    For digitized input, inflate its size first if reconstruction may need room.
    """
    original=np.asarray(z,dtype=float)
    A,b,corners=_linear_model(original,n,container)
    objective=np.zeros(2*n+1);objective[-1]=1
    bounds=[(None,None)]*(2*n)+[(0,None)]
    if container in ('square','equilateral_triangle'):
        result=linprog(objective,A_ub=A,b_ub=b,bounds=bounds,method='highs',
                       options={'maxiter':maxiter})
    else:
        q=np.r_[original[:-1].reshape(n,3)[:,:2].ravel(),original[-1]]
        ids=np.repeat(np.arange(n),4)
        rowids=np.arange(4*n)
        def circle_values(x):
            verts=x[:-1].reshape(n,1,2)+corners
            return x[-1]-np.linalg.norm(verts,axis=2).ravel()
        def circle_jac(x):
            verts=(x[:-1].reshape(n,1,2)+corners).reshape(-1,2)
            norm=np.linalg.norm(verts,axis=1)
            direction=verts/np.maximum(norm[:,None],np.finfo(float).tiny)
            jac=np.zeros((4*n,2*n+1))
            jac[rowids,2*ids]=-direction[:,0]
            jac[rowids,2*ids+1]=-direction[:,1]
            jac[:,-1]=1
            return jac
        cons=[{'type':'ineq','fun':circle_values,'jac':circle_jac}]
        if len(b):cons.append({'type':'ineq','fun':lambda x:b-A@x,'jac':lambda x:-A})
        result=minimize(lambda x:float(x[-1]),q,method='SLSQP',jac=lambda x:objective,
                        bounds=bounds,constraints=cons,
                        options={'maxiter':maxiter,'ftol':1e-12,'disp':False})
    if result.x is None or not np.isfinite(result.x).all():
        return original.copy()
    out=original.copy()
    out[:-1].reshape(n,3)[:,:2]=result.x[:-1].reshape(n,2)
    out[-1]=result.x[-1]
    if out[-1] <= original[-1]+1e-12 and constraint_values(out,n,container).min()>=-1e-7:
        return out
    return original.copy()

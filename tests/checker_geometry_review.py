"""Independent finite-difference review of the numerical constraint Jacobian."""
import numpy as np
from packing_shapes.geometry import constraints, constraint_values

rng=np.random.default_rng(91723)
worst=0.
checks=0
for container in ('circle','equilateral_triangle','square'):
    for alpha in (0.,.17,.6,1.):
        for trial in range(5):
            n=5
            z=np.r_[rng.uniform(-3,3,(n,3)).ravel(),7.]
            _,jac=constraints(z,n,container,alpha)
            for k in range(len(z)):
                h=1e-6
                left=z.copy();right=z.copy();left[k]-=h;right[k]+=h
                numeric=(constraint_values(right,n,container,alpha)-constraint_values(left,n,container,alpha))/(2*h)
                err=np.max(np.abs(numeric-jac[:,k])/(1+np.abs(numeric)))
                worst=max(worst,float(err));checks+=1
                assert err<2e-5,(container,alpha,trial,k,err)
print({'column_checks':checks,'worst_scaled_error':worst})

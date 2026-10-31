"""Numerical geometry for freely rotated, congruent unit-square packings.

This module proposes and diagnoses floating-point candidates. It is deliberately
independent of the exact certificate checker and does not establish feasibility
in exact arithmetic. Variables are [x0,y0,theta0,...,xN,yN,thetaN,size].

All constraint values must be nonnegative. The order is pair separation, vertex
containment, then container size. Pair gaps are signed lengths, circle walls are
squared lengths, and polygon walls are signed distances. At nonsmooth ties the
Jacobian selects one active SAT axis and uses sign(0)=0.

Optional alpha in [0,1] describes an alpha-side square Minkowski-summed with
a disk of radius (1-alpha)/2. Thus alpha=0 is a diameter-one disk and alpha=1
is the target unit square. Disjoint cores use their actual closest-feature
distance, not a finite-axis approximation to a rounded shape.
"""
from functools import lru_cache
import numpy as np

SQRT3 = np.sqrt(3.0)
SIGNS = np.array([[-1., -1.], [-1., 1.], [1., -1.], [1., 1.]])
TRIANGLE_INWARD = np.array([[0., 1.], [-SQRT3 / 2., -.5], [SQRT3 / 2., -.5]])
TRIANGLE_OFFSETS = np.array([0., SQRT3 / 4., SQRT3 / 4.])


@lru_cache(maxsize=64)
def pair_indices(n):
    """Indices i<j, shared by evaluations; callers must not mutate these arrays."""
    i, j = np.triu_indices(n, 1)
    i.flags.writeable = False
    j.flags.writeable = False
    return i, j


def _state(z, n):
    z = np.asarray(z, dtype=np.float64)
    if not isinstance(n, (int, np.integer)) or n < 1:
        raise ValueError('n must be a positive integer')
    if z.ndim != 1 or z.size != 3 * n + 1 or not np.isfinite(z).all():
        raise ValueError('z must contain 3*n+1 finite numbers')
    p = z[:-1].reshape(n, 3)
    u = np.column_stack((np.cos(p[:, 2]), np.sin(p[:, 2])))
    v = np.column_stack((-u[:, 1], u[:, 0]))
    return z, p, u, v


def vertices(z, n, alpha=1.):
    """Return (n,4,2) world-space square-core vertices, in the SIGNS order."""
    _, p, u, v = _state(z, n)
    return p[:, None, :2] + .5 * alpha * (SIGNS[None, :, 0, None] * u[:, None, :]
                                         + SIGNS[None, :, 1, None] * v[:, None, :])


def _rounded_separated_pairs(verts, dverts, i, j, alpha):
    """Clearance/Jacobian for disjoint square cores, dilated by equal disks.

    A closest pair for disjoint polygons occurs between a vertex and an edge.
    The minimizing edge parameter is held constant in the envelope derivative.
    Rows returned correspond exactly to the supplied i,j arrays.
    """
    starts = np.array([0, 1, 3, 2])
    ends = np.array([1, 3, 2, 0])
    ds, grads = [], []
    for source, target in ((i,j),(j,i)):
        point = verts[source, :, None, :]
        a = verts[target][:, None, starts, :]
        b = verts[target][:, None, ends, :]
        edge = b - a
        offset = point - a
        t = np.clip(np.sum(offset * edge, axis=-1) / (alpha * alpha), 0., 1.)
        difference = offset - t[...,None] * edge
        d2 = np.sum(difference * difference, axis=-1)
        # Select one closest feature pair for each pair of shapes.
        k = np.argmin(d2.reshape(-1,16),axis=1)
        rr = np.arange(i.size)
        vi, ei = k // 4, k % 4
        vv = difference[rr,vi,ei]
        dist = np.sqrt(d2[rr,vi,ei])
        direction = vv / np.maximum(dist[:,None], np.finfo(float).tiny)
        time = t[rr,vi,ei]
        da = dverts[target,starts[ei]]
        db = dverts[target,ends[ei]]
        dp = dverts[source,vi]
        dq = da + time[:,None] * (db-da)
        grad = np.column_stack((direction,
                                np.einsum('mk,mk->m',direction,dp),
                                -direction,
                                -np.einsum('mk,mk->m',direction,dq)))
        if len(ds):
            # Put both directional tests into common i,j variable order.
            grad = grad[:,[3,4,5,0,1,2]]
        ds.append(dist)
        grads.append(grad)
    choose = ds[1] < ds[0]
    return np.where(choose,ds[1],ds[0])-(1.-alpha), np.where(choose[:,None],grads[1],grads[0])


def _evaluate(z, n, container, with_jac, alpha=1.):
    z, p, u, v = _state(z, n)
    if container not in ('circle', 'equilateral_triangle', 'square'):
        raise ValueError(f'Unsupported container: {container}')
    if not np.isfinite(alpha) or not 0 <= alpha <= 1:
        raise ValueError('alpha must be between zero and one')
    size = z[-1]
    i, j = pair_indices(n)
    m = i.size
    delta = p[j, :2] - p[i, :2]
    axes = np.stack((u[i], v[i], u[j], v[j]), axis=1)
    projected = np.einsum('mk,mqk->mq', delta, axes)
    angle = p[j, 2] - p[i, 2]
    c, s = np.cos(angle), np.sin(angle)
    extent = .5 * (1. + np.abs(c) + np.abs(s))
    all_gaps = np.abs(projected) - alpha * extent[:, None]
    active = np.argmax(all_gaps, axis=1)
    rows = np.arange(m)
    core_gaps = all_gaps[rows, active]
    gaps = core_gaps - (1. - alpha)

    verts = p[:, None, :2] + .5 * alpha * (SIGNS[None, :, 0, None] * u[:, None, :]
                                          + SIGNS[None, :, 1, None] * v[:, None, :])
    dverts = .5 * alpha * (SIGNS[None, :, 0, None] * v[:, None, :]
                           - SIGNS[None, :, 1, None] * u[:, None, :])
    rounded_grad = None
    separated = np.zeros(m,dtype=bool)
    if alpha == 0:
        distance = np.linalg.norm(delta,axis=1)
        gaps = distance - 1.
    elif alpha < 1:
        separated = core_gaps > 0
        if separated.any():
            gaps[separated], rounded_grad = _rounded_separated_pairs(
                verts, dverts, i[separated], j[separated], alpha)
    radius = .5 * (1. - alpha)
    if container == 'circle':
        walls = (size-radius) ** 2 - np.einsum('nqk,nqk->nq', verts, verts)
    elif container == 'equilateral_triangle':
        walls = verts @ TRIANGLE_INWARD.T + size * TRIANGLE_OFFSETS - radius
    else:
        walls = np.stack((verts[..., 0], verts[..., 1],
                          size - verts[..., 0], size - verts[..., 1]), axis=-1) - radius
    values = np.concatenate((gaps, walls.ravel(), [size-radius]))
    if not with_jac:
        return values

    jac = np.zeros((values.size, z.size), dtype=np.float64)
    a = axes[rows, active]
    signed = np.sign(projected[rows, active])
    signed_axis = signed[:, None] * a
    jac[rows, 3 * i] = -signed_axis[:, 0]
    jac[rows, 3 * i + 1] = -signed_axis[:, 1]
    jac[rows, 3 * j] = signed_axis[:, 0]
    jac[rows, 3 * j + 1] = signed_axis[:, 1]
    # Rotating an axis by +pi/2 is its derivative with respect to its angle.
    da = np.column_stack((-a[:, 1], a[:, 0]))
    projection_derivative = signed * np.einsum('mk,mk->m', delta, da)
    dh = .5 * alpha * (-s * np.sign(c) + c * np.sign(s))
    jac[rows, 3 * i + 2] = dh + (active < 2) * projection_derivative
    jac[rows, 3 * j + 2] = -dh + (active >= 2) * projection_derivative

    if alpha == 0:
        direction = delta / np.maximum(distance[:,None],np.finfo(float).tiny)
        jac[rows, 3*i] = -direction[:,0]
        jac[rows, 3*i+1] = -direction[:,1]
        jac[rows, 3*j] = direction[:,0]
        jac[rows, 3*j+1] = direction[:,1]
        jac[rows, 3*i+2] = 0.
        jac[rows, 3*j+2] = 0.
    elif rounded_grad is not None:
        rr=rows[separated]
        for local,col in enumerate((3*i[separated],3*i[separated]+1,3*i[separated]+2,
                                   3*j[separated],3*j[separated]+1,3*j[separated]+2)):
            jac[rr,col] = rounded_grad[:,local]
    if container == 'circle':
        wr = m + np.arange(4 * n)
        ids = np.repeat(np.arange(n), 4)
        jac[wr, 3 * ids] = -2. * verts[..., 0].ravel()
        jac[wr, 3 * ids + 1] = -2. * verts[..., 1].ravel()
        jac[wr, 3 * ids + 2] = -2. * np.einsum('nqk,nqk->nq', verts, dverts).ravel()
        jac[wr, -1] = 2. * (size-radius)
    else:
        normals = TRIANGLE_INWARD if container == 'equilateral_triangle' else np.array([[1., 0.], [0., 1.], [-1., 0.], [0., -1.]])
        offsets = TRIANGLE_OFFSETS if container == 'equilateral_triangle' else np.array([0., 0., 1., 1.])
        w = normals.shape[0]
        wr = m + np.arange(4 * n * w)
        ids = np.repeat(np.arange(n), 4 * w)
        normal_id = np.tile(np.arange(w), 4 * n)
        jac[wr, 3 * ids] = normals[normal_id, 0]
        jac[wr, 3 * ids + 1] = normals[normal_id, 1]
        jac[wr, 3 * ids + 2] = (dverts @ normals.T).ravel()
        jac[wr, -1] = offsets[normal_id]
    jac[-1, -1] = 1.
    return values, jac


def constraints(z, n, container, alpha=1.):
    """Return (constraint values, dense analytic Jacobian). Feasible is >=0."""
    return _evaluate(z, n, container, True, alpha)


def constraint_values(z, n, container, alpha=1.):
    """Return values only, avoiding allocation of the dense Jacobian."""
    return _evaluate(z, n, container, False, alpha)


def constraint_jacobian(z, n, container, alpha=1.):
    return _evaluate(z, n, container, True, alpha)[1]


def penalty(z, n, container, weight=1000., objective_weight=1., alpha=1.):
    """Size plus half the weighted squared negative constraint residuals."""
    c, jac = constraints(z, n, container, alpha)
    negative = np.minimum(c, 0.)
    g = weight * (negative @ jac)
    g[-1] += objective_weight
    return objective_weight * z[-1] + .5 * weight * np.dot(negative, negative), g


class ConstraintEvaluator:
    """Cache a common value/Jacobian evaluation for scipy constraint callbacks."""
    def __init__(self, n, container, alpha=1.):
        self.n, self.container, self.alpha = n, container, alpha
        self._z = self._values = self._jac = None
        self._alpha = None

    def both(self, z):
        z = np.asarray(z, dtype=np.float64)
        if self._z is None or self._alpha != self.alpha or not np.array_equal(z, self._z):
            self._values, self._jac = constraints(z, self.n, self.container, self.alpha)
            self._z = z.copy()
            self._alpha = self.alpha
        return self._values, self._jac

    def fun(self, z):
        return self.both(z)[0]

    def jac(self, z):
        return self.both(z)[1]


def residual_summary(z, n, container):
    c = constraint_values(z, n, container)
    m = n * (n - 1) // 2
    return {
        'max_pair_penetration': float(max(0., -np.min(c[:m]))) if m else 0.,
        'max_wall_violation': float(max(0., -np.min(c[m:-1]))),
        'size': float(z[-1]),
        'wall_units': 'squared_length' if container == 'circle' else 'length',
    }

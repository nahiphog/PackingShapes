"""Analytical and finite-difference checks for the floating search geometry."""
import unittest
import numpy as np
from packing_shapes.geometry import (constraints, constraint_values, vertices,
                                     penalty, ConstraintEvaluator)


class GeometryTests(unittest.TestCase):
    def test_analytic_square_and_circle(self):
        square = np.array([.5, .5, 0., 1.])
        self.assertTrue(np.all(constraint_values(square, 1, 'square') >= 0))
        circle = np.array([0., 0., .371, np.sqrt(.5)])
        self.assertLess(np.max(np.abs(constraint_values(circle, 1, 'circle')[:-1])), 5e-16)
        circle[-1] -= 1e-4
        self.assertLess(np.min(constraint_values(circle, 1, 'circle')), 0)

    def test_analytic_triangle(self):
        # Axis-aligned square with bottom on y=0 and top corners on oblique sides.
        z = np.array([0., .5, 0., 1 + 2/np.sqrt(3)])
        c = constraint_values(z, 1, 'equilateral_triangle')
        self.assertGreaterEqual(c.min(), -3e-16)
        z[-1] -= .001
        self.assertLess(constraint_values(z, 1, 'equilateral_triangle').min(), 0)

    def test_pair_touch_overlap_and_rotation(self):
        z = np.array([0., 0., 0., 1., 0., 0., 5.])
        self.assertEqual(constraint_values(z, 2, 'circle')[0], 0)
        z[3] = .99
        self.assertAlmostEqual(constraint_values(z, 2, 'circle')[0], -.01)
        # Invariance under a global rotation in a circular container.
        z = np.array([-.43, .18, .27, .91, .53, -.32, 4.])
        phi = .52
        r = np.array([[np.cos(phi), -np.sin(phi)], [np.sin(phi), np.cos(phi)]])
        rotated = z.copy()
        p = rotated[:-1].reshape(2, 3)
        p[:, :2] = p[:, :2] @ r.T
        p[:, 2] += phi
        np.testing.assert_allclose(constraint_values(z, 2, 'circle'),
                                   constraint_values(rotated, 2, 'circle'), atol=1e-14)

    def test_shape_preservation_and_relabeling(self):
        z = np.array([.1, .3, .31, 1.2, .1, -.21, 0., 1.3, .77, 3.])
        v = vertices(z, 3)
        for a,b in [(0,1),(0,2),(1,3),(2,3)]:
            np.testing.assert_allclose(np.linalg.norm(v[:,a]-v[:,b],axis=1), 1, atol=1e-15)
        reordered = np.concatenate((z[:-1].reshape(3,3)[[2,0,1]].ravel(),z[-1:]))
        np.testing.assert_allclose(np.sort(constraint_values(z,3,'circle')),
                                   np.sort(constraint_values(reordered,3,'circle')), atol=1e-14)

    def test_jacobian(self):
        rng = np.random.default_rng(8271)
        for container in ['circle','equilateral_triangle','square']:
            for n in [1, 3, 7]:
                z = rng.normal(size=3*n+1)
                z[-1] = 3.7
                c,j = constraints(z,n,container)
                numeric = np.empty_like(j)
                eps = 2e-6
                for k in range(z.size):
                    left,right=z.copy(),z.copy()
                    left[k]-=eps;right[k]+=eps
                    numeric[:,k]=(constraint_values(right,n,container)-constraint_values(left,n,container))/(2*eps)
                np.testing.assert_allclose(j,numeric,atol=2e-8,rtol=2e-7)
                np.testing.assert_array_equal(c,constraint_values(z,n,container))

    def test_penalty_gradient_and_cache(self):
        z = np.array([-.2,.1,.31,.1,.2,-.43,1.2])
        f,g = penalty(z,2,'circle',weight=13)
        eps=1e-6
        gn=np.empty_like(g)
        for k in range(z.size):
            a,b=z.copy(),z.copy();a[k]-=eps;b[k]+=eps
            gn[k]=(penalty(b,2,'circle',weight=13)[0]-penalty(a,2,'circle',weight=13)[0])/(2*eps)
        np.testing.assert_allclose(g,gn,atol=1e-7,rtol=1e-7)
        e=ConstraintEvaluator(2,'circle')
        np.testing.assert_array_equal(e.fun(z),constraints(z,2,'circle')[0])
        np.testing.assert_array_equal(e.jac(z),constraints(z,2,'circle')[1])
        z[-1]+=1
        np.testing.assert_array_equal(e.fun(z),constraints(z,2,'circle')[0])

    def test_rounded_shape_jacobians(self):
        rng=np.random.default_rng(831)
        for alpha in [0., .1, .5, .9]:
            for container in ['circle','equilateral_triangle','square']:
                n=7
                z=rng.normal(size=3*n+1)
                z[-1]=3.2
                c,j=constraints(z,n,container,alpha=alpha)
                numeric=np.empty_like(j)
                eps=1e-6
                for k in range(z.size):
                    a,b=z.copy(),z.copy();a[k]-=eps;b[k]+=eps
                    numeric[:,k]=(constraint_values(b,n,container,alpha=alpha)-constraint_values(a,n,container,alpha=alpha))/(2*eps)
                np.testing.assert_allclose(j,numeric,atol=5e-8,rtol=3e-7)

    def test_rounded_corners_use_euclidean_distance(self):
        # Face-normal SAT alone gives -0.1 here but the rounded shapes separate.
        z=np.array([0.,0.,0.,.9,.9,0.,3.])
        c=constraint_values(z,2,'circle',alpha=.5)
        self.assertAlmostEqual(c[0], np.sqrt(.4**2+.4**2)-.5)
        self.assertGreater(c[0],0)
        self.assertAlmostEqual(constraint_values(z,2,'circle',alpha=0)[0],np.sqrt(2*.9**2)-1)
        e=ConstraintEvaluator(2,'circle',alpha=0)
        e.fun(z)
        e.alpha=.5
        np.testing.assert_array_equal(e.fun(z),c)
        np.testing.assert_array_equal(e.jac(z),constraints(z,2,'circle',alpha=.5)[1])
        z[-1]+=1
        np.testing.assert_array_equal(e.fun(z),constraints(z,2,'circle',alpha=.5)[0])

    def test_reject_invalid_input_and_negative_radius(self):
        for z in [np.zeros(3),np.array([0.,0.,np.nan,1.])]:
            with self.assertRaises(ValueError): constraint_values(z,1,'circle')
        with self.assertRaises(ValueError): constraint_values(np.zeros(4),1,'ellipse')
        self.assertLess(constraint_values([0.,0.,0.,-10.],1,'circle').min(),0)


if __name__ == '__main__':
    unittest.main()

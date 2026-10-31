import unittest
import numpy as np
from packing_shapes.polish import polish
from packing_shapes.geometry import constraint_values


class PolishTests(unittest.TestCase):
    def test_one_square_circle(self):
        z=np.array([.2,-.3,.28,2.])
        out=polish(z,1,'circle')
        self.assertAlmostEqual(out[-1],np.sqrt(.5),places=8)
        self.assertEqual(out[2],z[2])
        self.assertGreaterEqual(constraint_values(out,1,'circle').min(),-1e-9)

    def test_triangle_analytic(self):
        z=np.array([.05,.6,0.,3.])
        out=polish(z,1,'equilateral_triangle')
        self.assertAlmostEqual(out[-1],1+2/np.sqrt(3),places=10)
        self.assertGreaterEqual(constraint_values(out,1,'equilateral_triangle').min(),-1e-12)

    def test_square_grid(self):
        z=np.array([.5,.5,0.,1.6,.5,0.,.5,1.6,0.,1.6,1.6,0.,3.])
        out=polish(z,4,'square')
        self.assertAlmostEqual(out[-1],2.,places=10)
        self.assertGreaterEqual(constraint_values(out,4,'square').min(),-1e-12)

    def test_pair_order_and_nonworsening(self):
        z=np.array([-1.2,0.,.15,.8,.3,.4,3.])
        out=polish(z,2,'circle')
        self.assertLessEqual(out[-1],z[-1])
        np.testing.assert_array_equal(out[[2,5]],z[[2,5]])
        self.assertGreaterEqual(constraint_values(out,2,'circle').min(),-1e-8)

    def test_budget_and_zero_time(self):
        z=np.array([.2,-.3,.28,2.])
        np.testing.assert_array_equal(polish(z,1,'circle',time_limit=0),z)
        class Expired(Exception):pass
        calls=[]
        def budget():
            calls.append(1)
            if len(calls)>2:raise Expired()
        with self.assertRaises(Expired):polish(z,1,'circle',check_budget=budget)


if __name__=='__main__':unittest.main()

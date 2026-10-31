import math
import unittest
import numpy as np
from packing_shapes.search import initial, run_search, to_vector
from packing_shapes.geometry import constraint_values


class SearchIntegrationTests(unittest.TestCase):
    def test_initial_grids_are_feasible_for_every_pilot_count(self):
        for container,counts in [('circle',[11,13,15,18,20]),('equilateral_triangle',[8,12,17,23,30])]:
            for n in counts:
                z=initial(n,container,np.random.default_rng(123),'grid')
                self.assertGreaterEqual(constraint_values(z,n,container).min(),-1e-12)

    def test_all_arms_keep_analytical_control_and_obey_budget(self):
        instance={'id':'control','n':1,'container':'circle'}
        warm={'shape':'unit_square','n':1,'container':'circle','size':math.sqrt(.5),'pieces':[{'x':0.,'y':0.,'theta':0.}]}
        for arm in ['rigid','basin','anneal','homotopy','structured']:
            result=run_search(instance,arm,991,.2,warm)
            self.assertGreaterEqual(result['cpu_seconds'],.19)
            self.assertLess(result['cpu_seconds'],1.)
            self.assertLessEqual(result['numeric_best']['size'],math.sqrt(.5)+1e-8)
            self.assertTrue(result['certification_candidates'])
            self.assertIn(result['numeric_best'],result['certification_candidates'])
            self.assertGreaterEqual(constraint_values(to_vector(result['numeric_best']),1,'circle').min(),-1e-8)


if __name__=='__main__':unittest.main()

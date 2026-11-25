import csv
import math
import tempfile
import unittest
from pathlib import Path

import vimo


class MotionTests(unittest.TestCase):
    def test_angles(self):
        self.assertAlmostEqual(vimo.angle((1, 0), (0, 0), (0, 1)), 90)
        self.assertAlmostEqual(vimo.angle((-1, 0), (0, 0), (1, 0)), 180)
        self.assertIsNone(vimo.angle((0, 0), (0, 0), (1, 0)))
        self.assertIsNone(vimo.angle(None, (0, 0), (1, 0)))

    def test_demo_and_visibility(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / 'pose.csv'
            vimo.demo(p)
            frames = vimo.load_pose(p)
            rows, report = vimo.analyze(frames)
            self.assertEqual(len(rows), 90)
            self.assertEqual(report['metrics']['left_knee_deg']['valid_frames'], 80)
            self.assertEqual(report['metrics']['right_knee_deg']['valid_frames'], 90)
            self.assertIsNone(rows[40]['left_knee_deg'])
            self.assertEqual(vimo.analyze(frames, 0.1)[1]['metrics']['left_knee_deg']['valid_frames'], 90)
            self.assertAlmostEqual(rows[0]['trunk_tilt_deg'], 0)

    def test_missing_pose(self):
        rows, report = vimo.analyze([(0, 0.0, {0: None})])
        self.assertTrue(all(rows[0][m] is None for m in vimo.METRICS))
        self.assertTrue(all(m['coverage'] == 0 for m in report['metrics'].values()))

    def test_invalid_csv(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / 'pose.csv'
            for body in ('0,0,23,nan,1,1\n', '0,0,23,1,1,1\n0,0,23,2,2,1\n',
                         '0,1,23,1,1,1\n1,0,23,1,1,1\n'):
                p.write_text(','.join(vimo.FIELDS)+'\n'+body, encoding='utf-8')
                with self.assertRaises(ValueError):
                    vimo.load_pose(p)


if __name__ == '__main__':
    unittest.main()

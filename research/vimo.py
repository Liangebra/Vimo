"""Offline, planar kinematic analysis of MediaPipe-style pose sequences."""
import argparse
import csv
import json
import math
import statistics
from pathlib import Path

FIELDS = ('frame', 'time_s', 'landmark', 'x', 'y', 'visibility')
JOINTS = {
    'left_knee_deg': (23, 25, 27), 'right_knee_deg': (24, 26, 28),
    'left_hip_deg': (11, 23, 25), 'right_hip_deg': (12, 24, 26),
    'left_elbow_deg': (11, 13, 15), 'right_elbow_deg': (12, 14, 16),
}
METRICS = (*JOINTS, 'trunk_tilt_deg')


def finite(value):
    n = float(value)
    if not math.isfinite(n):
        raise ValueError('expected a finite number')
    return n


def load_pose(path):
    frames = {}
    with open(path, encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        if not set(FIELDS).issubset(reader.fieldnames or []):
            raise ValueError('CSV requires: ' + ', '.join(FIELDS))
        for row in reader:
            try:
                frame, joint = int(row['frame']), int(row['landmark'])
                time = finite(row['time_s'])
                confidence = finite(row['visibility'])
                if frame < 0 or time < 0 or not 0 <= joint < 33 or not 0 <= confidence <= 1:
                    raise ValueError('frame/time/landmark/visibility out of range')
                x, y = row['x'], row['y']
                if x == y == '' and confidence == 0:
                    point = None
                else:
                    point = (finite(x), finite(y), confidence)
                record = frames.setdefault(frame, (time, {}))
                if record[0] != time or joint in record[1]:
                    raise ValueError('inconsistent timestamp or duplicate landmark')
                record[1][joint] = point
            except (ValueError, TypeError) as exc:
                raise ValueError(f'CSV line {reader.line_num}: {exc}') from exc
    ordered = [(i, *frames[i]) for i in sorted(frames)]
    if not ordered:
        raise ValueError('empty pose sequence')
    if any(b[1] <= a[1] for a, b in zip(ordered, ordered[1:])):
        raise ValueError('timestamps must increase with frame index')
    return ordered


def angle(a, b, c):
    if any(p is None for p in (a, b, c)):
        return None
    u, v = (a[0]-b[0], a[1]-b[1]), (c[0]-b[0], c[1]-b[1])
    nu, nv = math.hypot(*u), math.hypot(*v)
    if min(nu, nv) == 0:
        return None
    dot = (u[0]/nu)*(v[0]/nv) + (u[1]/nu)*(v[1]/nv)
    return math.degrees(math.acos(max(-1, min(1, dot))))


def analyze(frames, threshold=0.5):
    if not 0 <= threshold <= 1:
        raise ValueError('visibility threshold must be in [0, 1]')
    rows = []
    for frame, time, landmarks in frames:
        def p(i):
            point = landmarks.get(i)
            return point[:2] if point is not None and point[2] >= threshold else None
        values = {name: angle(*(p(i) for i in ids)) for name, ids in JOINTS.items()}
        shoulders, hips = (p(11), p(12)), (p(23), p(24))
        tilt = None
        if all(q is not None for q in shoulders + hips):
            dx = (shoulders[0][0]+shoulders[1][0]-hips[0][0]-hips[1][0])/2
            dy = (shoulders[0][1]+shoulders[1][1]-hips[0][1]-hips[1][1])/2
            if math.hypot(dx, dy) > 0:
                tilt = math.degrees(math.atan2(abs(dx), -dy))
        rows.append(dict(frame=frame, time_s=time, **values, trunk_tilt_deg=tilt))
    summary = {}
    for name in METRICS:
        xs = [r[name] for r in rows if r[name] is not None]
        summary[name] = dict(valid_frames=len(xs), coverage=len(xs)/len(rows),
                             minimum=min(xs) if xs else None,
                             median=statistics.median(xs) if xs else None,
                             maximum=max(xs) if xs else None)
    return rows, dict(schema_version=1, frame_count=len(rows), visibility_threshold=threshold,
                      coordinate_system='image plane, equal x/y units, y down',
                      limitations='2D projected geometry only; visibility is not calibrated uncertainty; no quality or injury diagnosis.',
                      metrics=summary)


def write_csv(path, fields, rows):
    with open(path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def demo(path):
    rows = []
    for frame in range(90):
        phase = frame * math.tau / 30
        coords = {11: (90, 40), 12: (110, 40), 13: (75, 65), 14: (125, 65),
                  15: (80, 90), 16: (120, 90), 23: (90, 100), 24: (110, 100),
                  25: (90+15*math.sin(phase), 145), 26: (110-15*math.sin(phase), 145),
                  27: (90+30*math.sin(phase+0.8), 185), 28: (110-30*math.sin(phase+0.8), 185)}
        for joint, (x, y) in coords.items():
            rows.append(dict(frame=frame, time_s=frame/30, landmark=joint, x=x, y=y,
                             visibility=0.2 if joint == 27 and 40 <= frame < 50 else 1))
    write_csv(path, FIELDS, rows)


def extract(video, model, output):
    try:
        import cv2
        import mediapipe as mp
        from mediapipe.tasks.python import vision
    except ImportError as exc:
        raise ValueError('video extraction requires opencv-python and mediapipe') from exc
    if not Path(model).is_file():
        raise ValueError('provide a local Pose Landmarker .task model')
    cap = cv2.VideoCapture(str(video))
    try:
        fps = cap.get(cv2.CAP_PROP_FPS)
        if not cap.isOpened() or not math.isfinite(fps) or fps <= 0:
            raise ValueError('video could not be opened or has no valid FPS')
        options = vision.PoseLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=str(model)),
            running_mode=vision.RunningMode.VIDEO, num_poses=1)
        with vision.PoseLandmarker.create_from_options(options) as detector, open(output, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=FIELDS)
            writer.writeheader()
            frame, last_ms = 0, -1
            while True:
                ok, bgr = cap.read()
                if not ok:
                    break
                h, w = bgr.shape[:2]
                time = frame/fps
                ms = max(last_ms+1, round(time*1000))
                last_ms = ms
                image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
                result = detector.detect_for_video(image, ms)
                points = result.pose_landmarks[0] if result.pose_landmarks else []
                if not points:
                    writer.writerow(dict(frame=frame, time_s=time, landmark=0, x='', y='', visibility=0))
                for joint, point in enumerate(points):
                    writer.writerow(dict(frame=frame, time_s=time, landmark=joint,
                                         x=point.x*w, y=point.y*h, visibility=point.visibility))
                frame += 1
            if not frame:
                raise ValueError('video contained no decodable frames')
    finally:
        cap.release()


def tui(rows, summary):
    try:
        import curses
    except ImportError as exc:
        raise ValueError('TUI needs curses (Windows: pip install windows-curses)') from exc
    def screen(stdscr):
        selected, position = 0, 0
        stdscr.keypad(True)
        while True:
            stdscr.erase()
            h, w = stdscr.getmaxyx()
            def put(y, s):
                if y < h-1 and w > 1:
                    stdscr.addnstr(y, 0, s, w-1)
            put(0, 'VIMO / MOTION RESEARCH   [OFFLINE]')
            put(1, f'{len(rows)} frames | visibility >= {summary["visibility_threshold"]:.2f} | 2D only')
            put(2, 'UP/DOWN metric | LEFT/RIGHT frame | q quit')
            for i, name in enumerate(METRICS):
                m = summary['metrics'][name]
                med = '--' if m['median'] is None else f'{m["median"]:.1f}'
                put(4+i, f'{">" if i == selected else " "} {name:19} median {med:>6} deg | coverage {m["coverage"]:6.1%}')
            name = METRICS[selected]
            row = rows[position]
            value = row[name]
            label = '--' if value is None else f'{value:.2f} deg'
            put(12, f'Frame {row["frame"]} ({position+1}/{len(rows)}) | {row["time_s"]:.3f} s | {label}')
            if h >= 19 and w >= 20:
                samples = min(w-1, len(rows))
                bins = [rows[round(j*(len(rows)-1)/max(1,samples-1))][name] for j in range(samples)]
                for level in range(4, -1, -1):
                    put(14+4-level, ''.join('*' if v is not None and round(v/180*4) == level else ' ' for v in bins))
                put(19, '180 deg (top) to 0 deg (bottom); gaps = missing')
            put(h-2, 'Projected geometry, not a clinical or quality score.')
            stdscr.refresh()
            key = stdscr.getch()
            if key in (ord('q'), 27):
                return
            if key == curses.KEY_UP:
                selected = (selected-1) % len(METRICS)
            elif key == curses.KEY_DOWN:
                selected = (selected+1) % len(METRICS)
            elif key == curses.KEY_LEFT:
                position = max(0, position-1)
            elif key == curses.KEY_RIGHT:
                position = min(len(rows)-1, position+1)
    curses.wrapper(screen)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    d = sub.add_parser('demo', help='write synthetic example, not validation data')
    d.add_argument('output')
    e = sub.add_parser('extract', help='extract 2D landmarks from local video')
    e.add_argument('video'); e.add_argument('--model', required=True); e.add_argument('--output', required=True)
    for name in ('analyze', 'tui'):
        p = sub.add_parser(name)
        p.add_argument('input'); p.add_argument('--visibility', type=float, default=0.5)
        if name == 'analyze':
            p.add_argument('--json'); p.add_argument('--csv')
    args = parser.parse_args()
    try:
        if args.command == 'demo':
            demo(args.output)
        elif args.command == 'extract':
            if Path(args.output).resolve() in (Path(args.video).resolve(), Path(args.model).resolve()):
                raise ValueError('output must differ from the input video and model')
            extract(args.video, args.model, args.output)
        else:
            rows, report = analyze(load_pose(args.input), args.visibility)
            if args.command == 'tui':
                tui(rows, report)
            else:
                for output in (args.json, args.csv):
                    if output and Path(output).resolve() == Path(args.input).resolve():
                        raise ValueError('output must differ from input')
                if args.json and args.csv and Path(args.json).resolve() == Path(args.csv).resolve():
                    raise ValueError('JSON and CSV outputs must differ')
                payload = json.dumps(report, indent=2, allow_nan=False)
                if args.json:
                    Path(args.json).write_text(payload+'\n', encoding='utf-8')
                if args.csv:
                    write_csv(args.csv, ('frame', 'time_s', *METRICS), rows)
                print(payload)
    except (OSError, ValueError) as exc:
        parser.exit(2, f'vimo: {exc}\n')


if __name__ == '__main__':
    main()

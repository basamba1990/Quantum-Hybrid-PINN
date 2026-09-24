#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, sys, tempfile, zipfile
from pathlib import Path

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()

def main() -> int:
    package = Path(sys.argv[1] if len(sys.argv) > 1 else '/home/ubuntu/lh2_openfoam_run_package_v3.zip')
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        with zipfile.ZipFile(package) as zf:
            zf.extractall(root)
        base = root / 'lh2_openfoam_run'
        status = json.loads((base / 'BUILD_STATUS.json').read_text())
        sidecar = json.loads((base / 'sidecar.json').read_text())
        failures = []
        for item in json.loads((base / 'MANIFEST.json').read_text())['files']:
            path = root / item['file']
            if not path.is_file() or sha256(path) != item['sha256']:
                failures.append('manifest:' + item['file'])
        for frame in sidecar['frames']:
            path = base / frame['file']
            if not path.is_file() or sha256(path) != frame['sha256']:
                failures.append('frame:' + frame['file'])
        if len(sidecar['frames']) != 8:
            failures.append('expected 8 frames')
        if status['moduleStatus'] != 'SCALAR_CLOSURE_PROTOTYPE_UNCOMPILED':
            failures.append('unexpected module status')
        if failures:
            print(json.dumps({'status': 'FAIL', 'failures': failures}, indent=2))
            return 2
        print(json.dumps({'status': 'PASS', 'package': str(package), 'frames': len(sidecar['frames']), 'moduleStatus': status['moduleStatus'], 'meshStatus': status['meshStatus']}, indent=2))
        return 0

if __name__ == '__main__':
    raise SystemExit(main())

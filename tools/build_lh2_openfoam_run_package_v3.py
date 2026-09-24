#!/usr/bin/env python3
"""Build a truthful, versioned LH2 OpenFOAM evidence/development package."""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
INPUT_ZIP = Path('/home/ubuntu/upload/lh2_openfoam_run_package.zip')
WORK = Path('/home/ubuntu/lh2_openfoam_run_package_v4')
ROOT = WORK / 'lh2_openfoam_run'
ZIP = Path('/home/ubuntu/lh2_openfoam_run_package_v4.zip')
FRAMES = REPO / 'pilot_case/LH2-TANK-TRANSIENT-RUN-001/run/frames'
SIDECAR = REPO / 'pilot_case/LH2-TANK-TRANSIENT-RUN-001/run/sidecar.json'
STL = REPO / 'pilot_case/LH2-TANK-TRANSIENT-RUN-001/case/constant/triSurface/lh2_tank_analytic.stl'
SOURCE = REPO / 'src/lh2ThermalMultiphaseVoF'


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def main() -> None:
    if WORK.exists():
        shutil.rmtree(WORK)
    if ZIP.exists():
        ZIP.unlink()
    ROOT.mkdir(parents=True)
    with zipfile.ZipFile(INPUT_ZIP) as zf:
        zf.extractall(WORK)
    # The supplied archive has its own lh2_openfoam_run directory.
    supplied = WORK / 'lh2_openfoam_run'
    if supplied != ROOT:
        raise RuntimeError('unexpected archive layout')

    frames_out = ROOT / 'frames'
    frames_out.mkdir(exist_ok=True)
    for frame in sorted(FRAMES.glob('frame_*.vtu')):
        shutil.copy2(frame, frames_out / frame.name)

    sidecar = json.loads(SIDECAR.read_text())
    sidecar.update({
        'caseId': 'LH2-OPENFOAM-RUN-PACKAGE-V4',
        'meshRevision': 'lh2-tank-analytic-concentric-surfaces-v1',
        'assetStatus': 'NATIVE_OPENFOAM_HYDRODYNAMIC_FRAMES_WITH_PHASE_CHANGE_PROTOTYPE',
        'solverStatus': 'pimpleFoam_hydrodynamic_only',
        'vofPhaseChangeStatus': 'NOT_IMPLEMENTED_IN_FRAMES',
        'conformalMultiRegionStatus': 'CONCENTRIC_SURFACES_PREPARED_SPLIT_PENDING',
        'sourcePackage': 'lh2_openfoam_run_package_v4',
        'warning': 'Frames are native OpenFOAM pimpleFoam hydrodynamic outputs; they are not article-faithful LH2 thermal VOF boiling outputs.'
    })
    (ROOT / 'sidecar.json').write_text(json.dumps(sidecar, indent=2, ensure_ascii=False) + '\n')

    source_out = ROOT / 'src/lh2ThermalMultiphaseVoF'
    shutil.copytree(SOURCE, source_out, dirs_exist_ok=True)

    library = Path('/home/ubuntu/OpenFOAM/root-12/platforms/linux64GccDPInt32Opt/lib/liblh2ThermalMultiphaseVoF.so')
    if library.is_file():
        (ROOT / 'lib').mkdir(exist_ok=True)
        shutil.copy2(library, ROOT / 'lib/liblh2ThermalMultiphaseVoF.so')
    for evidence in (Path('/home/ubuntu/lh2RanzMarshall_wmake_v5.log'), Path('/home/ubuntu/lh2_source_smoke_v5.log')):
        if evidence.is_file():
            (ROOT / 'logs').mkdir(exist_ok=True)
            shutil.copy2(evidence, ROOT / 'logs' / evidence.name)

    mesh = ROOT / 'mesh'
    (mesh / 'source').mkdir(parents=True, exist_ok=True)
    shutil.copy2(STL, mesh / 'source/lh2_tank_analytic.stl')
    (mesh / 'README.md').write_text('''# Concentric tank mesh preparation\n\nThe source STL is the corrected parameterized 50 L analytic reconstruction. The package also contains generated concentric shell surfaces for aluminium and PU 10/20/30 mm. These surfaces are inputs to the next `snappyHexMesh`/cellZone/splitMeshRegions step.\n\nThis v3 package does **not** claim that the conformal multi-region mesh has been completed: the supplied single-region OpenFOAM mesh remains separate evidence, and the shell partition is marked `CONCENTRIC_SURFACES_PREPARED_SPLIT_PENDING`.\n''')

    transform = shutil.which('surfaceTransformPoints')
    scales = {'aluminium_outer': 1.015544, 'pu10_outer': 1.041451, 'pu20_outer': 1.067358, 'pu30_outer': 1.093264}
    generated = {}
    if transform:
        for name, scale in scales.items():
            out = mesh / 'source' / f'{name}.stl'
            subprocess.run([transform, f'scale=({scale} {scale} {scale})', str(STL), str(out)], check=True)
            generated[name] = {'scale': scale, 'sha256': sha256(out), 'file': str(out.relative_to(ROOT))}
    (mesh / 'concentric_surfaces.json').write_text(json.dumps({
        'status': 'CONCENTRIC_SURFACES_PREPARED_SPLIT_PENDING',
        'source': 'lh2_tank_analytic.stl',
        'scalingMethod': 'uniform scale about STL origin; shell Boolean/conformal volume partition still required',
        'surfaces': generated
    }, indent=2) + '\n')

    status = {
        'packageVersion': 'v4',
        'moduleStatus': 'COMPILED_FVMODEL_SMOKE_TEST_PASSED_NOT_TANK_VALIDATED',
        'meshStatus': 'CONCENTRIC_SURFACES_PREPARED_CONFORMAL_SPLIT_PENDING',
        'framesStatus': 'NATIVE_OPENFOAM_PIMPLEFOAM_HYDRODYNAMIC_ONLY',
        'sidecarStatus': 'HASHED_AND_PROVENANCE_DECLARED_NOT_THERMAL_VOF_VALIDATED',
        'requiredNextSteps': [
            'compile and integrate lh2ThermalMultiphaseVoF into foamRun',
            'replace scaled surfaces by Boolean shell volumes or conformal CAD layers',
            'run snappyHexMesh/splitMeshRegions/checkMesh for each insulation case',
            'generate native VOF thermal frames and rerun sidecar validation'
        ]
    }
    (ROOT / 'BUILD_STATUS.json').write_text(json.dumps(status, indent=2) + '\n')

    readme = ROOT / 'README.md'
    readme.write_text(readme.read_text() + '''\n\n## v4 additions\n\nThis package adds the compiled `liblh2ThermalMultiphaseVoF.so`, its OpenFOAM 12 smoke-test logs, eight native OpenFOAM transient frames and a SHA-256 sidecar copied from the corrected analytic-tank pimpleFoam evidence. The remaining conformal multi-region split and tank thermal VOF validation are intentionally marked pending.\n''')

    files = []
    for path in sorted(ROOT.rglob('*')):
        if path.is_file() and path.name not in {'MANIFEST.sha256', 'MANIFEST.json'}:
            files.append({'file': str(path.relative_to(WORK)), 'sha256': sha256(path), 'bytes': path.stat().st_size})
    (ROOT / 'MANIFEST.json').write_text(json.dumps({'package': 'lh2_openfoam_run_package_v4', 'files': files}, indent=2) + '\n')
    (ROOT / 'MANIFEST.sha256').write_text('\n'.join(f"{item['sha256']}  {item['file']}" for item in files) + '\n')

    with zipfile.ZipFile(ZIP, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for path in sorted(WORK.rglob('*')):
            if path.is_file():
                zf.write(path, path.relative_to(WORK))
    print(ZIP)
    print(json.dumps(status, indent=2))


if __name__ == '__main__':
    main()

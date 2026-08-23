import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from cfd_import_router import _parse_vtu


def main() -> None:
    root = Path('/tmp/cfdkit/artifacts/synthetic_lh2_vtu')
    metadata = json.loads((root / 'sidecar.json').read_text(encoding='utf-8'))
    for spec in metadata['frames']:
        parsed = _parse_vtu(
            (root / spec['file']).read_bytes(),
            spec['file'],
            metadata['fieldDescriptors'],
        )
        names = [field['name'] for field in parsed['fields']]
        print(spec['file'], parsed['pointCount'], parsed['cellCount'], names)


if __name__ == '__main__':
    main()

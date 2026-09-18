from pathlib import Path
import json
p=Path('apps/web/public/cfd-demo/pccv-valve-preview/sidecar.json')
d=json.loads(p.read_text())
for frame in d['frames']:
    if frame['file'].startswith('frames/'):
        frame['file']=frame['file'][len('frames/'):]
p.write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')
print('adapted',p)

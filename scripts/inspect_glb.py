from __future__ import annotations

import json
import struct
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "apps/web/public/cad/HEAVY_DUTY_HYDROGEN_REFUELING/geometry.glb"
data = path.read_bytes()
magic, version, length = struct.unpack_from("<4sII", data, 0)
if magic != b"glTF":
    raise SystemExit("Not a GLB file")
offset = 12
json_doc = None
while offset < length:
    chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
    chunk = data[offset + 8: offset + 8 + chunk_length]
    if chunk_type == 0x4E4F534A:
        json_doc = json.loads(chunk.decode("utf-8"))
        break
    offset += 8 + chunk_length
if json_doc is None:
    raise SystemExit("Missing JSON chunk")

print(f"asset={path}")
print(f"version={version} byte_length={length}")
print(f"scenes={len(json_doc.get('scenes', []))} nodes={len(json_doc.get('nodes', []))} meshes={len(json_doc.get('meshes', []))}")
for index, mesh in enumerate(json_doc.get("meshes", [])):
    print(f"mesh[{index}] name={mesh.get('name')} primitives={len(mesh.get('primitives', []))}")
    for primitive_index, primitive in enumerate(mesh.get("primitives", [])):
        position_accessor = primitive.get("attributes", {}).get("POSITION")
        accessor = json_doc.get("accessors", [])[position_accessor] if position_accessor is not None else {}
        print(f"  primitive[{primitive_index}] position_accessor={position_accessor} count={accessor.get('count')} min={accessor.get('min')} max={accessor.get('max')}")
for index, node in enumerate(json_doc.get("nodes", [])):
    print(f"node[{index}] name={node.get('name')} mesh={node.get('mesh')} translation={node.get('translation')} rotation={node.get('rotation')} scale={node.get('scale')}")

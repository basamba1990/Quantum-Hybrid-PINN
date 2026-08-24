import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
main_source = (ROOT / "main.py").read_text(encoding="utf-8")
v2_source = (ROOT / "hydrogen_api_v2.py").read_text(encoding="utf-8")
main_tree = ast.parse(main_source)
v2_tree = ast.parse(v2_source)

main_calls = []
for node in ast.walk(main_tree):
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
        if isinstance(node.func.value, ast.Name):
            main_calls.append((node.func.value.id, node.func.attr))

if ("app", "mount") in main_calls:
    raise SystemExit("Dynamic FastAPI mount detected in main.py")

if ("app", "include_router") not in main_calls:
    raise SystemExit("main.py does not include routers")

v2_router_assignment = any(
    isinstance(node, ast.Assign)
    and any(isinstance(target, ast.Name) and target.id == "router" for target in node.targets)
    and isinstance(node.value, ast.Call)
    and isinstance(node.value.func, ast.Name)
    and node.value.func.id == "APIRouter"
    for node in ast.walk(v2_tree)
)
if not v2_router_assignment:
    raise SystemExit("hydrogen_api_v2.py does not define APIRouter")

forbidden = ("FastAPI", "uvicorn")
if any(
    isinstance(node, ast.Name) and node.id in forbidden
    for node in ast.walk(v2_tree)
):
    raise SystemExit("Standalone FastAPI/uvicorn symbol remains in hydrogen_api_v2.py")

required_strings = (
    'app.include_router(hydrogen_v2_router)',
    'app.include_router(cfd_import_router)',
    'app.include_router(analysis_router)',
)
for required in required_strings:
    if required not in main_source:
        raise SystemExit(f"Missing consolidated router inclusion: {required}")

required_paths = (
    '"/import"',
    '"/{analysis_id}"',
    '"/validate-3d"',
    '"/predict-batch"',
)
for path in required_paths:
    if path not in (main_source + v2_source + (ROOT / "cfd_import_router.py").read_text(encoding="utf-8")):
        raise SystemExit(f"Missing expected route declaration: {path}")

print("consolidated FastAPI static surface: PASS")

#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

import yaml

REQUIRED_CASE_KEYS = {
    "geometry": ["source_file", "source_hash_sha256", "format", "units", "mesh_artifact", "mesh_hash_sha256", "named_boundaries"],
    "physics": ["source_refs"],
    "solver": ["name", "version", "commit", "execution_id", "result_artifact", "result_hash_sha256", "time_states"],
}


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("cases/parameter_registry.yaml")
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    errors: list[str] = []
    if data.get("policy", {}).get("no_defaults") is not True:
        errors.append("policy.no_defaults doit être true")
    if data.get("policy", {}).get("no_synthetic_validation") is not True:
        errors.append("policy.no_synthetic_validation doit être true")
    for name, case in data.get("cases", {}).items():
        if case.get("evidence_level") == "VALIDATED":
            errors.append(f"{name}: VALIDATED interdit dans le registre source")
        for section, keys in REQUIRED_CASE_KEYS.items():
            values = case.get(section, {})
            for key in keys:
                value = values.get(key)
                if value is None or value == []:
                    errors.append(f"{name}.{section}.{key}: valeur obligatoire absente")
    if errors:
        print("REGISTRY_BLOCKED")
        print("\n".join(f"- {error}" for error in errors))
        return 1
    print("REGISTRY_READY")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

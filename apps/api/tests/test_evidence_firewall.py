from pathlib import Path


ROOT = Path(__file__).parents[1]


PRODUCTION_FILES = (
    ROOT / "main.py",
    ROOT / "advanced_physics_analysis.py",
    ROOT / "analysis_processor.py",
)


def test_production_paths_do_not_generate_random_evidence():
    forbidden = ("np.random", "random.uniform", "random.rand")
    source = "\n".join(path.read_text(encoding="utf-8") for path in PRODUCTION_FILES)
    assert not any(token in source for token in forbidden)


def test_analysis_processor_does_not_use_fixed_generic_3d_field():
    source = (ROOT / "analysis_processor.py").read_text(encoding="utf-8")
    assert "N_points = 2500" not in source
    assert "'pressure': 80.0" not in source
    assert "'temperature': 300.0" not in source


def test_missing_evidence_is_explicitly_unavailable():
    source = (ROOT / "advanced_physics_analysis.py").read_text(encoding="utf-8")
    assert '"status": "UNAVAILABLE"' in source
    assert '"computed_by": None' in source


def test_ci_has_blocking_backend_and_frontend_tests():
    ci = (ROOT.parent.parent / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    assert "Run Vitest Unit Tests (blocking)" in ci
    assert "Run Backend Contract Tests (blocking)" in ci
    assert "|| echo" not in ci

import gzip
import json
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1]))

from cfd_import_router import _dataset_blob, _dataset_summary, _load_dataset


def sample_dataset():
    return {
        "contractVersion": "cfd-volume.v1",
        "meshRevision": "fixture-revision",
        "classification": "SYNTHETIC_REFERENCE_DESIGN",
        "frames": [
            {
                "frameId": "f0",
                "time": 0.0,
                "points": [0.0, 0.0, 0.0] * 3,
                "cells": [0, 1, 2],
                "offsets": [0, 3],
                "cellTypes": [5],
                "fields": [
                    {"name": "pressure", "values": [1.0, 1.0, 1.0]},
                    {"name": "velocity", "values": [0.0, 0.0, 0.0]},
                ],
            }
        ],
    }


def test_dataset_summary_excludes_large_frame_arrays():
    dataset = sample_dataset()
    summary = _dataset_summary(dataset)
    assert summary["meshRevision"] == "fixture-revision"
    assert summary["frameCount"] == 1
    assert summary["frames"][0]["pointCount"] == 3
    assert summary["frames"][0]["cellCount"] == 1
    assert "points" not in summary["frames"][0]
    assert "fields" not in summary["frames"][0]


def test_dataset_blob_is_deterministic_and_round_trips():
    dataset = sample_dataset()
    blob_a = _dataset_blob(dataset)
    blob_b = _dataset_blob(dataset)
    assert blob_a == blob_b
    assert json.loads(gzip.decompress(blob_a).decode("utf-8")) == dataset


def test_load_dataset_reconstructs_gzip_storage_contract():
    dataset = sample_dataset()
    row = {
        "dataset": _dataset_summary(dataset),
        "artifact_manifest": {
            "bucket": "cfd-artifacts",
            "datasetPath": "owner/case/revision/analysis/dataset.json.gz",
            "datasetEncoding": "gzip+json",
        },
    }

    class Storage:
        def from_(self, bucket):
            assert bucket == "cfd-artifacts"
            return self

        def download(self, path):
            assert path.endswith("dataset.json.gz")
            return _dataset_blob(dataset)

    class Client:
        storage = Storage()

    with patch("cfd_import_router._supabase", return_value=Client()):
        assert _load_dataset(row) == dataset

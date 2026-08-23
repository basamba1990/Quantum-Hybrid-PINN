import os
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).parents[1]))
from cfd_import_router import require_cfd_import_auth


PROJECT = Path(__file__).parents[3]
PROXY = PROJECT / 'apps' / 'web' / 'app' / 'api' / 'cfd' / 'import' / 'route.ts'
MIGRATION = PROJECT / 'apps' / 'web' / 'supabase' / 'migrations' / '014_cfd_artifacts_and_datasets.sql'


def test_import_auth_fails_closed_when_token_is_missing(monkeypatch):
    monkeypatch.delenv('CFD_IMPORT_API_TOKEN', raising=False)
    with pytest.raises(HTTPException) as error:
        require_cfd_import_auth('Bearer anything')
    assert error.value.status_code == 503


def test_import_auth_rejects_wrong_token(monkeypatch):
    monkeypatch.setenv('CFD_IMPORT_API_TOKEN', 'server-only-token')
    with pytest.raises(HTTPException) as error:
        require_cfd_import_auth('Bearer wrong-token')
    assert error.value.status_code == 401


def test_import_auth_accepts_exact_bearer_token(monkeypatch):
    monkeypatch.setenv('CFD_IMPORT_API_TOKEN', 'server-only-token')
    assert require_cfd_import_auth('Bearer server-only-token') is None


def test_next_proxy_does_not_contain_service_role_secret():
    source = PROXY.read_text(encoding='utf-8')
    assert 'SUPABASE_SERVICE_ROLE_KEY' not in source
    assert 'CFD_IMPORT_API_TOKEN' in source
    assert 'supabase.auth.getUser' in source


def test_migration_enforces_private_backend_only_storage():
    source = MIGRATION.read_text(encoding='utf-8')
    assert "'cfd-artifacts'" in source
    assert 'public = false' in source
    assert 'enable row level security' in source
    assert 'force row level security' in source
    assert 'create policy' not in source.lower()
    assert 'cfd_datasets_immutable' in source

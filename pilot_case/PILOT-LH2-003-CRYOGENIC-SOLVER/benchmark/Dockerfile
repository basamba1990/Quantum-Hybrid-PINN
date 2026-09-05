FROM python:3.12-slim@sha256:78387bc3881b8273120a12ebe6c1ab22b018ccc2c9adf565ae1ac9b536e184ea

WORKDIR /workspace
RUN pip install --no-cache-dir numpy meshio fastapi supabase python-multipart
COPY apps/api /workspace/apps/api
COPY artifacts/synthetic_lh2_vtu /workspace/source
COPY pilot_case/PILOT-LH2-003-CRYOGENIC-SOLVER/benchmark/scripts /workspace/scripts
COPY pilot_case/PILOT-LH2-003-CRYOGENIC-SOLVER/benchmark/docker_entrypoint.sh /workspace/docker_entrypoint.sh
RUN chmod +x /workspace/docker_entrypoint.sh
ENTRYPOINT ["/workspace/docker_entrypoint.sh"]

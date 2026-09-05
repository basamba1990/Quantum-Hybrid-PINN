FROM python:3.12-slim

WORKDIR /workspace
RUN pip install --no-cache-dir numpy meshio fastapi supabase
COPY apps/api /workspace/apps/api
COPY artifacts/synthetic_lh2_vtu /workspace/source
COPY pilot_case/PILOT-LH2-003-CRYOGENIC-SOLVER/benchmark/scripts /workspace/scripts
COPY pilot_case/PILOT-LH2-003-CRYOGENIC-SOLVER/benchmark/docker_entrypoint.sh /workspace/docker_entrypoint.sh
RUN chmod +x /workspace/docker_entrypoint.sh
ENTRYPOINT ["/workspace/docker_entrypoint.sh"]

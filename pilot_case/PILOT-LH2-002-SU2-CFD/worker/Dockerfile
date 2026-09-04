# SU2 is the only CFD solver in this pilot.
# Pin this tag/digest in provenance before any production run.
FROM su2code/su2:latest
USER root
RUN python3 -m pip install --no-cache-dir meshio
COPY run_su2.py /opt/su2-worker/run_su2.py
RUN chmod 0555 /opt/su2-worker/run_su2.py && mkdir -p /case /artifacts && useradd -m -u 10001 su2worker && chown -R su2worker:su2worker /case /artifacts /opt/su2-worker
USER su2worker
ENV CASE_ROOT=/case ARTIFACT_ROOT=/artifacts SU2_CONFIG=case.cfg SU2_TIMEOUT_SECONDS=3600
ENTRYPOINT ["python3", "/opt/su2-worker/run_su2.py"]

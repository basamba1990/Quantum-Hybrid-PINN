FROM opencfd/openfoam-default:2512

USER root
RUN apt-get update && apt-get install -y --no-install-recommends python3 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY worker.py /opt/lh2-worker/worker.py
RUN chmod 0555 /opt/lh2-worker/worker.py && mkdir -p /cases /artifacts && useradd -m -u 10001 cfdworker && chown -R cfdworker:cfdworker /cases /artifacts /opt/lh2-worker
USER cfdworker
ENV PORT=8080 CASE_ROOT=/cases ARTIFACT_ROOT=/artifacts CFD_TIMEOUT_SECONDS=3600 OPENFOAM_SOLVER=reactingTwoPhaseEulerFoam
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health')"
ENTRYPOINT ["python3", "/opt/lh2-worker/worker.py"]

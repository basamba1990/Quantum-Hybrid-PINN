# syntax=docker/dockerfile:1
FROM ubuntu:24.04 AS build
ARG GMSH_TAG=gmsh_4_15_2
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git cmake ninja-build build-essential \
    libglu1-mesa-dev libfltk1.3-dev \
    libocct-foundation-dev libocct-modeling-data-dev libocct-modeling-algorithms-dev \
    libocct-data-exchange-dev libocct-ocaf-dev libocct-visualization-dev \
    libopenmpi-dev libblas-dev liblapack-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git clone --branch ${GMSH_TAG} --depth 1 https://gitlab.onelab.info/gmsh/gmsh.git gmsh
WORKDIR /src/gmsh
RUN cmake -S . -B build -G Ninja \
    -DENABLE_NETGEN=ON \
    -DENABLE_OCC=ON \
    -DENABLE_FLTK=OFF \
    -DENABLE_BUILD_LIB=OFF \
    -DENABLE_OPENMP=ON \
    -DCMAKE_BUILD_TYPE=Release \
 && cmake --build build --parallel \
 && cmake --install build --prefix /opt/gmsh

# Fail the image build if the OCC backend was not detected.  A real geometry
# smoke test is more reliable than grepping -info, whose feature list varies
# across Gmsh releases.
RUN printf 'SetFactory("OpenCASCADE"); Box(1) = {0,0,0,1,1,1}; Mesh 3; Save "/tmp/occ-smoke.msh";\n' > /tmp/occ-smoke.geo \
 && /opt/gmsh/bin/gmsh -3 /tmp/occ-smoke.geo -o /tmp/occ-smoke.msh -v 1 \
 && test -s /tmp/occ-smoke.msh

FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive PATH=/opt/gmsh/bin:$PATH
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libglu1-mesa libgomp1 libtbb12 libhwloc15 \
    libocct-foundation-7.6t64 libocct-modeling-data-7.6t64 \
    libocct-modeling-algorithms-7.6t64 libocct-data-exchange-7.6t64 \
    libocct-ocaf-7.6t64 libocct-visualization-7.6t64 && rm -rf /var/lib/apt/lists/*
COPY --from=build /opt/gmsh /opt/gmsh
ENV LD_LIBRARY_PATH=/opt/gmsh/lib:/usr/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH
WORKDIR /work
RUN printf 'SetFactory("OpenCASCADE"); Box(1) = {0,0,0,1,1,1}; Mesh 3; Save "/tmp/occ-runtime.msh";\n' > /tmp/occ-runtime.geo \
 && gmsh -3 /tmp/occ-runtime.geo -o /tmp/occ-runtime.msh -v 1 \
 && test -s /tmp/occ-runtime.msh
ENTRYPOINT ["gmsh"]

# syntax=docker/dockerfile:1
FROM ubuntu:24.04 AS build
ARG GMSH_TAG=gmsh_4_15_2
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git cmake ninja-build build-essential \
    libglu1-mesa-dev libfltk1.3-dev \
    libocct-foundation-dev libocct-modeling-data-dev libocct-modeling-algorithms-dev \
    libopenmpi-dev libblas-dev liblapack-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git clone --branch ${GMSH_TAG} --depth 1 https://gitlab.onelab.info/gmsh/gmsh.git gmsh
WORKDIR /src/gmsh
RUN cmake -S . -B build -G Ninja \
    -DENABLE_NETGEN=ON \
    -DENABLE_OPENCASCADE=ON \
    -DENABLE_FLTK=OFF \
    -DENABLE_BUILD_LIB=OFF \
    -DENABLE_OPENMP=ON \
    -DCMAKE_BUILD_TYPE=Release \
 && cmake --build build --parallel \
 && cmake --install build --prefix /opt/gmsh

FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive PATH=/opt/gmsh/bin:$PATH
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libglu1-mesa libocct-foundation-7.6t64 libocct-modeling-data-7.6t64 \
    libocct-modeling-algorithms-7.6t64 && rm -rf /var/lib/apt/lists/*
COPY --from=build /opt/gmsh /opt/gmsh
WORKDIR /work
ENTRYPOINT ["gmsh"]

"use client";

import * as THREE from "three";
import type { CfdBufferFrame } from "@/lib/cfd/cfd-contract";

export type CFDVolumeRendererProps = { frame: CfdBufferFrame; fieldName: string; dimensions: readonly [number, number, number]; origin: readonly [number, number, number]; spacing: readonly [number, number, number] };

export function buildCfdVolumeMesh({ frame, fieldName, dimensions, origin, spacing }: CFDVolumeRendererProps): THREE.Mesh {
  const field = frame.pointData.get(fieldName);
  if (!field || field.components !== 1) throw new Error("CFD_VOLUME_POINT_SCALAR_REQUIRED");
  const expected = dimensions[0] * dimensions[1] * dimensions[2];
  if (field.values.length !== expected) throw new Error("CFD_REGULAR_GRID_FIELD_SIZE_MISMATCH");
  const minimum = Math.min(...field.values); const maximum = Math.max(...field.values); const span = maximum - minimum || 1;
  const rgba = new Uint8Array(field.values.length * 4);
  for (let i = 0; i < field.values.length; i += 1) { const n = THREE.MathUtils.clamp((field.values[i] - minimum) / span, 0, 1); rgba[i * 4] = Math.round(255 * n); rgba[i * 4 + 1] = Math.round(255 * (1 - Math.abs(n - 0.5) * 2)); rgba[i * 4 + 2] = Math.round(255 * (1 - n)); rgba[i * 4 + 3] = Math.round(255 * n); }
  const texture = new THREE.Data3DTexture(rgba, dimensions[0], dimensions[1], dimensions[2]); texture.format = THREE.RGBAFormat; texture.type = THREE.UnsignedByteType; texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter; texture.unpackAlignment = 1; texture.needsUpdate = true;
  const size = new THREE.Vector3(dimensions[0] * spacing[0], dimensions[1] * spacing[1], dimensions[2] * spacing[2]); const geometry = new THREE.BoxGeometry(size.x, size.y, size.z); geometry.translate(origin[0] + size.x / 2, origin[1] + size.y / 2, origin[2] + size.z / 2);
  const material = new THREE.ShaderMaterial({ uniforms: { uVolume: { value: texture } }, vertexShader: `varying vec3 vUVW; void main(){ vUVW=position/2.0+0.5; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`, fragmentShader: `precision highp float; precision highp sampler3D; uniform sampler3D uVolume; varying vec3 vUVW; void main(){ vec4 sum=vec4(0.0); vec3 p=vUVW; for(int i=0;i<64;i++){ vec4 s=texture(uVolume,p); float a=s.a*0.12; sum.rgb+=(1.0-sum.a)*a*s.rgb; sum.a+=(1.0-sum.a)*a; p.z+=0.015625; if(p.z>1.0||sum.a>0.98) break; } if(sum.a<0.01) discard; gl_FragColor=sum; }`, transparent: true, side: THREE.BackSide, depthWrite: false });
  const mesh = new THREE.Mesh(geometry, material); mesh.userData.scalarRange = { min: minimum, max: maximum, unit: field.unit }; return mesh;
}

export default buildCfdVolumeMesh;

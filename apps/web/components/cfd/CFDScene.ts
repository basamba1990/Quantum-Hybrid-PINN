"use client";

import * as THREE from "three";
import type { CfdBufferFrame } from "@/lib/cfd/cfd-contract";
import { buildCfdSurfaceMesh } from "./CFDMeshRenderer";
import { extractCfdIsoSurface } from "./CFDIsoSurface";

export type CfdSceneHandle = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  meshGroup: THREE.Group;
  dispose: () => void;
  setFrame: (frame: CfdBufferFrame, fieldName?: string, isoValue?: number) => void;
};

export function createCfdScene(canvas: HTMLCanvasElement, initialFrame: CfdBufferFrame, fieldName?: string, isoValue?: number): CfdSceneHandle {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08111f);
  const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / Math.max(canvas.clientHeight, 1), 0.001, 100000);
  camera.position.set(1, 1, 1);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const directional = new THREE.DirectionalLight(0xffffff, 2);
  directional.position.set(1, 2, 3);
  scene.add(directional);
  const meshGroup = new THREE.Group();
  scene.add(meshGroup);
  const fitCamera = (mesh: THREE.Mesh) => {
    mesh.geometry.computeBoundingSphere();
    const sphere = mesh.geometry.boundingSphere;
    if (!sphere) return;
    const distance = Math.max(sphere.radius * 3, 0.01);
    camera.position.set(sphere.center.x + distance, sphere.center.y + distance, sphere.center.z + distance);
    camera.lookAt(sphere.center);
    camera.near = Math.max(distance / 1000, 1e-6);
    camera.far = Math.max(distance * 100, 1);
    camera.updateProjectionMatrix();
  };
  const setFrame = (frame: CfdBufferFrame, selectedField?: string, isoValue?: number) => {
    while (meshGroup.children.length) {
      const child = meshGroup.children.pop();
      if (child instanceof THREE.Mesh) { child.geometry.dispose(); if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose()); else child.material.dispose(); }
    }
    const mesh = isoValue !== undefined
      ? extractCfdIsoSurface(frame, selectedField ?? fieldName ?? "", isoValue)
      : buildCfdSurfaceMesh({ frame, fieldName: selectedField ?? fieldName });
    meshGroup.add(mesh);
    fitCamera(mesh);
  };
  setFrame(initialFrame, fieldName, isoValue);
  renderer.render(scene, camera);
  const resize = () => { const width = canvas.clientWidth; const height = Math.max(canvas.clientHeight, 1); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  return { scene, camera, renderer, meshGroup, dispose: () => { observer.disconnect(); renderer.dispose(); scene.clear(); }, setFrame };
}

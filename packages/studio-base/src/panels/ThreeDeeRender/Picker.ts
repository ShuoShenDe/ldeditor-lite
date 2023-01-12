// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// Adapted from <https://github.com/bzztbomb/three_js_gpu_picking/blob/main/src/gpupicker.js>
// released under the public domain. Original authors:
// - bzztbomb https://github.com/bzztbomb
// - jfaust https://github.com/jfaust

import * as THREE from "three";

import type { Renderable } from "./Renderable";

type Camera = THREE.PerspectiveCamera | THREE.OrthographicCamera;

// The width and height of the output viewport. This could be 1 to sample a
// single pixel, but GL_POINTS with a >1 point size would be clipped
const PIXEL_WIDTH = 31;

const WHITE_COLOR = new THREE.Color(0xffffff);

const AlwaysPickObject = (_obj: THREE.Object3D) => true;
// This works around an incorrect method definition, where passing null is valid
const NullScene = ReactNull as unknown as THREE.Scene;

export type PickedRenderable = {
  renderable: Renderable;
  instanceIndex?: number;
};

export type PickerOptions = {
  debug?: boolean;
};

/**
 * Handles picking of objects in a scene (detecting 3D objects at a given screen
 * coordinate). This works by performing a second rendering pass after
 * `WebGLRenderer.renderLists` has been populated from a normal rendering pass.
 * In the second pass, objectIds are written as colors to a small offscreen
 * rendering target surrounding the sample point. The color at the sample point
 * is then read back and used to determine which object was picked.
 *
 * Objects can set their own `userData.pickingMaterial` to override the default
 * shader used for picking.
 */
export class Picker {
  private gl: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera?: Camera;
  private shouldPickObjectCB: (object: THREE.Object3D) => boolean;
  private materialCache = new Map<number, THREE.ShaderMaterial>();
  private emptyScene: THREE.Scene;
  private pixelBuffer: Uint8Array;
  private currClearColor = new THREE.Color();
  private pickingTarget: THREE.WebGLRenderTarget;
  private debug: boolean;
  private isDebugPass = false;

  public constructor(gl: THREE.WebGLRenderer, scene: THREE.Scene, options: PickerOptions = {}) {
    this.gl = gl;
    this.scene = scene;
    this.shouldPickObjectCB = AlwaysPickObject;
    this.debug = options.debug ?? false;

    // This is the PIXEL_WIDTH x PIXEL_WIDTH render target we use to do the picking
    this.pickingTarget = new THREE.WebGLRenderTarget(PIXEL_WIDTH, PIXEL_WIDTH, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat, // stores objectIds as uint32
      encoding: THREE.LinearEncoding,
      generateMipmaps: false,
    });
    this.pixelBuffer = new Uint8Array(4);
    // We need to be inside of .render in order to call renderBufferDirect in
    // renderList() so create an empty scene
    this.emptyScene = new THREE.Scene();
  }

  public dispose(): void {
    for (const material of this.materialCache.values()) {
      material.dispose();
    }
    this.materialCache.clear();
    this.pickingTarget.dispose();
  }

  public pick(
    x: number,
    y: number,
    camera: THREE.OrthographicCamera | THREE.PerspectiveCamera,
    shouldPickObject = AlwaysPickObject,
  ): number {
    // Use the onAfterRender callback to actually render geometry for picking
    this.emptyScene.onAfterRender = this.handleAfterRender;
    this.camera = camera;
    this.shouldPickObjectCB = shouldPickObject;
    const hw = (PIXEL_WIDTH / 2) | 0;
    const pixelRatio = this.gl.getPixelRatio();
    const xi = Math.max(0, x * pixelRatio - hw);
    const yi = Math.max(0, y * pixelRatio - hw);
    const w = this.gl.domElement.width;
    const h = this.gl.domElement.height;
    // Set the projection matrix to only look at the pixels we are interested in
    camera.setViewOffset(w, h, xi, yi, PIXEL_WIDTH, PIXEL_WIDTH);
    const currRenderTarget = this.gl.getRenderTarget();
    const currAlpha = this.gl.getClearAlpha();
    this.gl.getClearColor(this.currClearColor);
    this.gl.setRenderTarget(this.pickingTarget);
    this.gl.setClearColor(WHITE_COLOR, 1);
    this.gl.clear();
    this.gl.render(this.emptyScene, camera);
    this.gl.readRenderTargetPixels(this.pickingTarget, hw, hw, 1, 1, this.pixelBuffer);
    this.gl.setRenderTarget(currRenderTarget);
    this.gl.setClearColor(this.currClearColor, currAlpha);
    camera.clearViewOffset();

    const val =
      (this.pixelBuffer[0]! << 24) +
      (this.pixelBuffer[1]! << 16) +
      (this.pixelBuffer[2]! << 8) +
      this.pixelBuffer[3]!;

    if (this.debug) {
      this.pickDebugRender(camera);
    }

    return val;
  }

  public pickInstance(
    x: number,
    y: number,
    camera: THREE.OrthographicCamera | THREE.PerspectiveCamera,
    renderable: Renderable,
  ): number {
    this.emptyScene.onAfterRender = this.makeHandleInstanceAfterRender(renderable);
    this.camera = camera;

    const hw = (PIXEL_WIDTH / 2) | 0;
    const pixelRatio = this.gl.getPixelRatio();
    const xi = Math.max(0, x * pixelRatio - hw);
    const yi = Math.max(0, y * pixelRatio - hw);
    const w = this.gl.domElement.width;
    const h = this.gl.domElement.height;
    // Set the projection matrix to only look at the pixels we are interested in
    camera.setViewOffset(w, h, xi, yi, PIXEL_WIDTH, PIXEL_WIDTH);
    const currRenderTarget = this.gl.getRenderTarget();
    const currAlpha = this.gl.getClearAlpha();
    this.gl.getClearColor(this.currClearColor);
    this.gl.setRenderTarget(this.pickingTarget);
    this.gl.setClearColor(WHITE_COLOR, 1);
    this.gl.clear();
    this.gl.render(this.emptyScene, camera);
    this.gl.readRenderTargetPixels(this.pickingTarget, hw, hw, 1, 1, this.pixelBuffer);
    this.gl.setRenderTarget(currRenderTarget);
    this.gl.setClearColor(this.currClearColor, currAlpha);
    camera.clearViewOffset();

    if (this.debug) {
      this.pickInstanceDebugRender(camera, renderable);
    }

    return (
      (this.pixelBuffer[0]! << 24) +
      (this.pixelBuffer[1]! << 16) +
      (this.pixelBuffer[2]! << 8) +
      this.pixelBuffer[3]!
    );
  }

  public pickDebugRender(camera: THREE.OrthographicCamera | THREE.PerspectiveCamera): void {
    this.isDebugPass = true;
    this.emptyScene.onAfterRender = this.handleAfterRender;
    const currAlpha = this.gl.getClearAlpha();
    this.gl.getClearColor(this.currClearColor);
    this.gl.setClearColor(WHITE_COLOR, 1);
    this.gl.clear();
    this.gl.render(this.emptyScene, camera);
    this.gl.setClearColor(this.currClearColor, currAlpha);
    this.isDebugPass = false;
  }

  public pickInstanceDebugRender(
    camera: THREE.OrthographicCamera | THREE.PerspectiveCamera,
    renderable: Renderable,
  ): void {
    this.isDebugPass = true;
    this.emptyScene.onAfterRender = this.makeHandleInstanceAfterRender(renderable);
    const currAlpha = this.gl.getClearAlpha();
    this.gl.getClearColor(this.currClearColor);
    this.gl.setClearColor(WHITE_COLOR, 1);
    this.gl.clear();
    this.gl.render(this.emptyScene, camera);
    this.gl.setClearColor(this.currClearColor, currAlpha);
    this.isDebugPass = false;
  }

  private handleAfterRender = (): void => {
    // This is the magic, these render lists are still filled with valid data.
    // So we can submit them again for picking and save lots of work!
    const renderList = this.gl.renderLists.get(this.scene, 0);
    renderList.opaque.forEach(this.processItem);
    renderList.transmissive.forEach(this.processItem);
    renderList.transparent.forEach(this.processItem);
  };

  private makeHandleInstanceAfterRender(renderable: Renderable): () => void {
    return (): void => {
      // Note that no attempt is made to define a sensible sort order. Since the
      // instanced picking pass should only be rendering opaque pixels, the
      // worst that will happen is some overdraw
      renderable.traverseVisible((object) => {
        const maybeRender = object as Partial<THREE.Mesh>;
        if (maybeRender.id != undefined && maybeRender.geometry && maybeRender.material) {
          const renderItem: THREE.RenderItem = {
            id: maybeRender.id,
            object,
            geometry: maybeRender.geometry,
            material: maybeRender.material as THREE.Material,
            // `program` is not used by WebGLRenderer even though it is defined in RenderItem
            program: undefined as unknown as THREE.WebGLProgram,
            groupOrder: 0,
            renderOrder: 0,
            z: 0,
            group: ReactNull,
          };
          this.processInstancedItem(renderItem);
        }
      });
    };
  }

  private processItem = (renderItem: THREE.RenderItem): void => {
    if (!this.camera) {
      return;
    }
    const object = renderItem.object;
    const objId = this.isDebugPass ? hashInt(object.id) : object.id;
    const material = renderItem.material;
    const geometry = renderItem.geometry;
    if (
      !geometry || // Skip if geometry is not defined
      renderItem.object.userData.picking === false || // Skip if object is marked no picking
      !this.shouldPickObjectCB(object) // Skip if user callback returns false
    ) {
      return;
    }

    const sprite = material.type === "SpriteMaterial" ? 1 : 0;
    const sizeAttenuation =
      (material as Partial<THREE.PointsMaterial>).sizeAttenuation === true ? 1 : 0;
    const pickingMaterial = renderItem.object.userData.pickingMaterial as
      | THREE.ShaderMaterial
      | undefined;
    const renderMaterial = pickingMaterial ?? this.renderMaterial(sprite, sizeAttenuation);
    if (sprite === 1) {
      renderMaterial.uniforms.rotation = { value: (material as THREE.SpriteMaterial).rotation };
      renderMaterial.uniforms.center = { value: (object as THREE.Sprite).center };
    }
    setObjectId(renderMaterial, objId);
    this.gl.renderBufferDirect(this.camera, NullScene, geometry, renderMaterial, object, ReactNull);
  };

  private processInstancedItem = (renderItem: THREE.RenderItem): void => {
    if (!this.camera) {
      return;
    }
    const object = renderItem.object;
    const geometry = renderItem.geometry;
    if (
      !geometry || // Skip if geometry is not defined
      renderItem.object.userData.picking === false // Skip if object is marked no picking
    ) {
      return;
    }

    const instancePickingMaterial = renderItem.object.userData.instancePickingMaterial as
      | THREE.ShaderMaterial
      | undefined;
    const renderMaterial = instancePickingMaterial ?? this.instanceRenderMaterial();
    this.gl.renderBufferDirect(this.camera, NullScene, geometry, renderMaterial, object, ReactNull);
  };

  private renderMaterial(sprite: 0 | 1, sizeAttenuation: 0 | 1): THREE.ShaderMaterial {
    const index = (sprite << 0) | (sizeAttenuation << 1);
    let renderMaterial = this.materialCache.get(index);
    if (renderMaterial) {
      return renderMaterial;
    }

    let vertexShader = THREE.ShaderChunk.meshbasic_vert;
    if (sprite === 1) {
      vertexShader = THREE.ShaderChunk.sprite_vert!;
    }
    if (sizeAttenuation === 1) {
      vertexShader = "#define USE_SIZEATTENUATION\n\n" + vertexShader;
    }
    renderMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: /* glsl */ `
          uniform vec4 objectId;
          void main() {
            gl_FragColor = objectId;
          }
        `,
      side: THREE.DoubleSide,
      uniforms: { objectId: { value: [NaN, NaN, NaN, NaN] } },
    });
    this.materialCache.set(index, renderMaterial);
    return renderMaterial;
  }

  private instanceRenderMaterial(): THREE.ShaderMaterial {
    const index = -1; // special materialCache index used for the instanced picking material
    let renderMaterial = this.materialCache.get(index);
    if (renderMaterial) {
      return renderMaterial;
    }

    let vertexShader = THREE.ShaderChunk.meshbasic_vert;
    vertexShader = vertexShader.replace(
      "void main() {",
      /* glsl */ `
      varying vec4 objectId;

      void main() {
        objectId = vec4(
          float((gl_InstanceID >> 24) & 255) / 255.0,
          float((gl_InstanceID >> 16) & 255) / 255.0,
          float((gl_InstanceID >> 8) & 255) / 255.0,
          float(gl_InstanceID & 255) / 255.0);
      `,
    );
    renderMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: /* glsl */ `
          varying vec4 objectId;
          void main() {
            gl_FragColor = objectId;
          }
        `,
      side: THREE.DoubleSide,
      uniforms: { objectId: { value: [NaN, NaN, NaN, NaN] } },
    });
    this.materialCache.set(index, renderMaterial);
    return renderMaterial;
  }
}

function setObjectId(material: THREE.ShaderMaterial, objectId: number): void {
  const iObjectId = material.uniforms.objectId;
  if (!iObjectId) {
    throw new Error(`objectId uniform not found in picking material`);
  }
  iObjectId.value = [
    ((objectId >> 24) & 255) / 255,
    ((objectId >> 16) & 255) / 255,
    ((objectId >> 8) & 255) / 255,
    (objectId & 255) / 255,
  ];
  material.uniformsNeedUpdate = true;
}

// Used for debug colors, this remaps objectIds to pseudo-random 32-bit integers
const A = new Uint32Array(1);
function hashInt(x: number): number {
  A[0] = x | 0;
  A[0] -= A[0] << 6;
  A[0] ^= A[0] >>> 17;
  A[0] -= A[0] << 9;
  A[0] ^= A[0] << 4;
  A[0] -= A[0] << 3;
  A[0] ^= A[0] << 10;
  A[0] ^= A[0] >>> 15;
  return A[0];
}

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { PackedElementField, PointCloud } from "@foxglove/schemas";
import { SettingsTreeNode, Topic } from "@foxglove/studio";
import { DynamicBufferGeometry } from "@foxglove/studio-base/panels/ThreeDeeRender/DynamicBufferGeometry";
import { BaseUserData, Renderable } from "@foxglove/studio-base/panels/ThreeDeeRender/Renderable";
import { rgbaToCssString } from "@foxglove/studio-base/panels/ThreeDeeRender/color";
import { isSupportedField } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/pointClouds/fieldReaders";
import {
  missingTransformMessage,
  MISSING_TRANSFORM,
} from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/transforms";
import { BaseSettings } from "@foxglove/studio-base/panels/ThreeDeeRender/settings";
import { MAX_DURATION, Pose } from "@foxglove/studio-base/panels/ThreeDeeRender/transforms";
import { updatePose } from "@foxglove/studio-base/panels/ThreeDeeRender/updatePose";

import { POINTCLOUD_DATATYPES as FOXGLOVE_POINTCLOUD_DATATYPES } from "../foxglove";
import { PointCloud2, POINTCLOUD_DATATYPES as ROS_POINTCLOUD_DATATYPES, PointField } from "../ros";
import { LaserScanMaterial } from "./LaserScans";
import {
  baseColorModeSettingsNode,
  colorHasTransparency,
  ColorModeSettings,
  FS_SRGB_TO_LINEAR,
  INTENSITY_FIELDS,
  RGBA_PACKED_FIELDS,
} from "./pointClouds/colors";

export type LayerSettingsPointExtension = BaseSettings &
  ColorModeSettings & {
    pointSize: number;
    pointShape: "circle" | "square";
    decayTime: number;
  };

const DEFAULT_POINT_SIZE = 1.5;
const DEFAULT_POINT_SHAPE = "circle";
const DEFAULT_COLOR_MAP = "turbo";
const DEFAULT_FLAT_COLOR = { r: 1, g: 1, b: 1, a: 1 };
const DEFAULT_MIN_COLOR = { r: 100 / 255, g: 47 / 255, b: 105 / 255, a: 1 };
const DEFAULT_MAX_COLOR = { r: 227 / 255, g: 177 / 255, b: 135 / 255, a: 1 };

// used by LaserScans, VelodyneScans, and PointClouds
export const DEFAULT_POINT_SETTINGS: LayerSettingsPointExtension = {
  visible: false,
  frameLocked: false,
  pointSize: DEFAULT_POINT_SIZE,
  pointShape: DEFAULT_POINT_SHAPE,
  decayTime: 0,
  colorMode: "flat",
  flatColor: rgbaToCssString(DEFAULT_FLAT_COLOR),
  colorField: undefined,
  gradient: [rgbaToCssString(DEFAULT_MIN_COLOR), rgbaToCssString(DEFAULT_MAX_COLOR)],
  colorMap: DEFAULT_COLOR_MAP,
  explicitAlpha: 1,
  minValue: undefined,
  maxValue: undefined,
};

export const POINT_CLOUD_REQUIRED_FIELDS = ["x", "y", "z"];
export const POINT_SHAPE_OPTIONS = [
  { label: "Circle", value: "circle" },
  { label: "Square", value: "square" },
];

/**
 * Creates settings node for Point cloud and scan topics
 * @param topic - topic to get settings node for
 * @param messageFields - message fields or required fields for the topic
 * @param config - current topic settings
 * @param defaultSettings - (optional) default settings to use
 * @returns  - settings node for the topic
 */
export function pointSettingsNode(
  topic: Topic,
  messageFields: string[],
  config: Partial<LayerSettingsPointExtension>,
  defaultSettings: LayerSettingsPointExtension = DEFAULT_POINT_SETTINGS,
): SettingsTreeNode {
  const pointSize = config.pointSize;
  const pointShape = config.pointShape ?? "circle";
  const decayTime = config.decayTime;

  const node = baseColorModeSettingsNode(messageFields, config, topic, defaultSettings, {
    supportsPackedRgbModes: ROS_POINTCLOUD_DATATYPES.has(topic.schemaName),
    supportsRgbaFieldsMode: FOXGLOVE_POINTCLOUD_DATATYPES.has(topic.schemaName),
  });
  node.fields = {
    pointSize: {
      label: "Point size",
      input: "number",
      step: 1,
      placeholder: "2",
      precision: 2,
      value: pointSize,
    },
    pointShape: {
      label: "Point shape",
      input: "select",
      options: POINT_SHAPE_OPTIONS,
      value: pointShape,
    },
    decayTime: {
      label: "Decay time",
      input: "number",
      step: 0.5,
      placeholder: "0 seconds",
      min: 0,
      precision: 3,
      value: decayTime,
    },
    ...node.fields,
  };

  return node;
}

/**
 * Selects optimal color field for settings given point cloud message
 * @param output - settings object to apply auto selection of colorfield to
 * @param pointCloud - point cloud message
 * @param { supportsPackedRgbModes } - whether or not the point cloud message supports packed rgb modes
 * @returns - changes output object to have desired color field selected
 */
export function autoSelectColorField(
  output: LayerSettingsPointExtension,
  pointCloud: PointCloud | PointCloud2,
  { supportsPackedRgbModes }: { supportsPackedRgbModes: boolean },
): void {
  // Prefer color fields first
  if (supportsPackedRgbModes) {
    for (const field of pointCloud.fields) {
      if (!isSupportedField(field)) {
        continue;
      }
      const fieldNameLower = field.name.toLowerCase();
      if (RGBA_PACKED_FIELDS.has(fieldNameLower)) {
        output.colorField = field.name;
        switch (fieldNameLower) {
          case "rgb":
            output.colorMode = "rgb";
            break;
          default:
          case "rgba":
            output.colorMode = "rgba";
            break;
        }
        return;
      }
    }
  }

  // Intensity fields are second priority
  for (const field of pointCloud.fields) {
    if (!isSupportedField(field)) {
      continue;
    }
    if (INTENSITY_FIELDS.has(field.name)) {
      output.colorField = field.name;
      output.colorMode = "colormap";
      output.colorMap = "turbo";
      return;
    }
  }

  // Fall back to using the first point cloud field
  const firstField = (pointCloud.fields as readonly (PackedElementField | PointField)[]).find(
    (field) => isSupportedField(field),
  );
  if (firstField != undefined) {
    output.colorField = firstField.name;
    output.colorMode = "colormap";
    output.colorMap = "turbo";
    return;
  }
}
/**
 * Creates a THREE.Points object for a point cloud and scan messages
 * @param topic - topic name string for naming geometry
 * @param usage - THREE draw usage (ex: THREE.StaticDrawUsage)
 * @returns
 */
export function createGeometry(topic: string, usage: THREE.Usage): DynamicBufferGeometry {
  const geometry = new DynamicBufferGeometry(usage);
  geometry.name = `${topic}:PointScans:geometry`;
  geometry.createAttribute("position", Float32Array, 3);
  geometry.createAttribute("color", Uint8Array, 4, true);
  return geometry;
}

type Material = THREE.PointsMaterial | LaserScanMaterial;
type Points = THREE.Points<DynamicBufferGeometry, Material>;
export type PointsAtTime = { receiveTime: bigint; messageTime: bigint; points: Points };

export function pointCloudColorEncoding<T extends LayerSettingsPointExtension>(
  settings: T,
): "srgb" | "linear" {
  switch (settings.colorMode) {
    case "flat":
    case "colormap":
    case "gradient":
      // converted to linear by getColorConverter
      return "linear";
    case "rgb":
    case "rgba":
    case "rgba-fields":
      return "srgb";
  }
}

export function createPoints(
  topic: string,
  pose: Pose,
  geometry: DynamicBufferGeometry,
  material: Material,
  pickingMaterial: THREE.Material,
  instancePickingMaterial: THREE.Material | undefined,
): Points {
  const points = new THREE.Points<DynamicBufferGeometry, Material>(geometry, material);
  // We don't calculate the bounding sphere for points, so frustum culling is disabled
  points.frustumCulled = false;
  points.name = `${topic}:PointCloud:points`;
  points.userData = {
    pickingMaterial,
    instancePickingMaterial,
    pose,
  };
  return points;
}

// Fragment shader chunk to convert sRGB to linear RGB
const FS_POINTCLOUD_SRGB_TO_LINEAR = /* glsl */ `
outgoingLight = sRGBToLinear(outgoingLight);
`;

// Fragment shader chunk to render a GL_POINT as a circle
const FS_POINTCLOUD_CIRCLE = /* glsl */ `
vec2 cxy = 2.0 * gl_PointCoord - 1.0;
if (dot(cxy, cxy) > 1.0) { discard; }
`;

export function pointCloudMaterial<T extends LayerSettingsPointExtension>(
  settings: T,
): THREE.PointsMaterial {
  const transparent = colorHasTransparency(settings);
  const encoding = pointCloudColorEncoding(settings);
  const scale = settings.pointSize;
  const shape = settings.pointShape;

  const material = new THREE.PointsMaterial({
    vertexColors: true,
    size: scale,
    sizeAttenuation: false,
    transparent,
    // The sorting issues caused by writing semi-transparent pixels to the depth buffer are less
    // distracting for point clouds than the self-sorting artifacts when depth writing is disabled
    depthWrite: true,
  });

  // Tell three.js to recompile the shader when `shape` or `encoding` change
  material.customProgramCacheKey = () => `${shape}-${encoding}`;
  material.onBeforeCompile = (shader) => {
    const SEARCH = "#include <output_fragment>";
    if (shape === "circle") {
      // Patch the fragment shader to render points as circles
      shader.fragmentShader = shader.fragmentShader.replace(SEARCH, FS_POINTCLOUD_CIRCLE + SEARCH);
    }
    if (encoding === "srgb") {
      // Patch the fragment shader to add sRGB->linear color conversion
      shader.fragmentShader =
        FS_SRGB_TO_LINEAR +
        shader.fragmentShader.replace(SEARCH, FS_POINTCLOUD_SRGB_TO_LINEAR + SEARCH);
    }
  };

  return material;
}

export function createPickingMaterial<T extends LayerSettingsPointExtension>(
  settings: T,
): THREE.ShaderMaterial {
  const MIN_PICKING_POINT_SIZE = 8;

  // Use a custom shader for picking that sets a minimum point size to make
  // individual points easier to click on
  const pointSize = Math.max(settings.pointSize, MIN_PICKING_POINT_SIZE);
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      uniform float pointSize;
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = pointSize;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec4 objectId;
      void main() {
        gl_FragColor = objectId;
      }
    `,
    side: THREE.DoubleSide,
    uniforms: { pointSize: { value: pointSize }, objectId: { value: [NaN, NaN, NaN, NaN] } },
  });
}

export function createInstancePickingMaterial<T extends LayerSettingsPointExtension>(
  settings: T,
): THREE.ShaderMaterial {
  const MIN_PICKING_POINT_SIZE = 8;

  // Use a custom shader for picking that sets a minimum point size to make
  // individual points easier to click on
  const pointSize = Math.max(settings.pointSize, MIN_PICKING_POINT_SIZE);
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
        uniform float pointSize;
        varying vec4 objectId;
        void main() {
          objectId = vec4(
            float((gl_VertexID >> 24) & 255) / 255.0,
            float((gl_VertexID >> 16) & 255) / 255.0,
            float((gl_VertexID >> 8) & 255) / 255.0,
            float(gl_VertexID & 255) / 255.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = pointSize;
        }
      `,
    fragmentShader: /* glsl */ `
        varying vec4 objectId;
        void main() {
          gl_FragColor = objectId;
        }
      `,
    side: THREE.DoubleSide,
    uniforms: { pointSize: { value: pointSize } },
  });
}

type PointHistoryUserData = BaseUserData & {
  topic: string;
  settings: LayerSettingsPointExtension;
  pointsHistory: PointsAtTime[];
  material: THREE.Material;
  pickingMaterial: THREE.Material;
};

/**
 * Parent class renderable that handles lifecycle of points history over the decay time
 * This class only handles updating, and end of life of the points history and its geometry.
 * Creation of new points in the history is handled by the child Renderable classes.
 * See LaserScansRenderable and PointCloudsRenderable for examples.
 */
export class PointsHistoryRenderable<
  UserData extends PointHistoryUserData,
> extends Renderable<UserData> {
  public override dispose(): void {
    for (const entry of this.userData.pointsHistory) {
      entry.points.geometry.dispose();
    }
    this.userData.pointsHistory.length = 0;

    super.dispose();
  }

  public startFrame(currentTime: bigint, renderFrameId: string, fixedFrameId: string): void {
    const path = this.userData.settingsPath;

    this.visible = this.userData.settings.visible;
    if (!this.visible) {
      this.renderer.settings.errors.clearPath(path);
      const pointsHistory = this.userData.pointsHistory;
      // removes all but the last element of the array, which would be the current point
      for (const entry of pointsHistory.splice(0, pointsHistory.length - 1)) {
        entry.points.geometry.dispose();
        this.remove(entry.points);
      }
      return;
    }

    // Remove expired entries from the history of points when decayTime is enabled
    const pointsHistory = this.userData.pointsHistory;
    const decayTime = this.userData.settings.decayTime;
    const expireTime =
      decayTime > 0 ? currentTime - BigInt(Math.round(decayTime * 1e9)) : MAX_DURATION;
    while (pointsHistory.length > 1 && pointsHistory[0]!.receiveTime < expireTime) {
      const entry = this.userData.pointsHistory.shift()!;
      this.remove(entry.points);
      entry.points.geometry.dispose();
    }

    // Update the pose on each THREE.Points entry
    let hadTfError = false;
    for (const entry of pointsHistory) {
      const srcTime = entry.messageTime; // frameLocked is false, so use TFs from the original message timestamp
      const frameId = this.userData.frameId;
      const updated = updatePose(
        entry.points,
        this.renderer.transformTree,
        renderFrameId,
        fixedFrameId,
        frameId,
        currentTime,
        srcTime,
      );
      if (!updated && !hadTfError) {
        const message = missingTransformMessage(renderFrameId, fixedFrameId, frameId);
        this.renderer.settings.errors.add(path, MISSING_TRANSFORM, message);
        hadTfError = true;
      }
    }

    if (!hadTfError) {
      this.renderer.settings.errors.remove(path, MISSING_TRANSFORM);
    }
  }
}

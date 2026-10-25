// The parts of three.js the WebGL Avatars view (web/avatars3d.js) uses,
// bundled into one file (web/vendor/three.js) by scripts/build-three.js.
// Using something new from three.js: add it here and rebuild.
export {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, InstancedMesh, Points,
  HemisphereLight, DirectionalLight, PointLight, FogExp2,
  MeshStandardMaterial, MeshBasicMaterial, PointsMaterial, CanvasTexture,
  BufferGeometry, BufferAttribute, InstancedBufferAttribute,
  SphereGeometry, BoxGeometry, CylinderGeometry, ConeGeometry, TorusGeometry, RingGeometry, CircleGeometry,
  DodecahedronGeometry, IcosahedronGeometry, OctahedronGeometry, TetrahedronGeometry,
  ExtrudeGeometry, TubeGeometry, Shape, Path, CatmullRomCurve3,
  Color, Vector2, Vector3, Quaternion, Matrix4, DataTexture, PlaneGeometry,
  ACESFilmicToneMapping, PCFShadowMap, AdditiveBlending, DoubleSide, DynamicDrawUsage, SRGBColorSpace,
  RGBAFormat, NearestFilter, LinearFilter,
} from 'three';
export { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
export { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
export { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
export { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
export { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

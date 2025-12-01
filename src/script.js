import * as THREE from 'three';

import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let camera, scene, renderer, controls;
let cam; // the loaded camera model (OBJ)
let camViewCamera, camRenderTarget, cameraScreen; // render-target items

let movingSphere;

init();

async function init() {

  // Camera — closer to the object like the first code
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.set(0, 0.1, 0.25) // same as your first code

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0)

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3)
  scene.add(ambientLight)

  const mainLight = new THREE.DirectionalLight(0xffffff, 1)
  mainLight.position.set(0, 2, 3)
  scene.add(mainLight)

  const backLight = new THREE.DirectionalLight(0xffffff, 0.2)
  backLight.position.set(-5, 5, -5)
  scene.add(backLight)

  scene.add(camera)

  // Load model
  const mtllloader = new MTLLoader()
  const body_mat = await mtllloader.loadAsync('body.mtl')
  body_mat.preload()

  const cam_mat = await mtllloader.loadAsync('body.mtl')
  cam_mat.preload()

  const btt_mat = await mtllloader.loadAsync('button.mtl')
  btt_mat.preload()

  const objloader = new OBJLoader()
  objloader.setMaterials(body_mat)
  const body = await objloader.loadAsync('body.obj')
  body.rotation.x = -Math.PI / 2
  scene.add(body)

  // Load camera (the model that will have the screen on its back)
  objloader.setMaterials(cam_mat)
  cam = await objloader.loadAsync('cam.obj')
  cam.rotation.x = -Math.PI / 2
  scene.add(cam)

  // Load button
  objloader.setMaterials(btt_mat)
  const button = await objloader.loadAsync('button.obj')
  button.rotation.x = -Math.PI / 2
  scene.add(button)

  // Room cube size
  const roomSize = 2

  // Room geometry and textures
  const geometry = new THREE.BoxGeometry(roomSize, roomSize, roomSize)
  const loader_text = new THREE.TextureLoader()
  const wallTexture = loader_text.load('textures/wall.jpg')
  const floorTexture = loader_text.load('textures/floor.jpg')
  const ceilingTexture = loader_text.load('textures/ceiling.jpg')

  const materials = [
    new THREE.MeshStandardMaterial({ map: wallTexture, side: THREE.BackSide }), // right wall
    new THREE.MeshStandardMaterial({ map: wallTexture, side: THREE.BackSide }), // left wall
    new THREE.MeshStandardMaterial({ map: ceilingTexture, side: THREE.BackSide }), // top
    new THREE.MeshStandardMaterial({ map: floorTexture, side: THREE.BackSide }),   // bottom
    new THREE.MeshStandardMaterial({ map: wallTexture, side: THREE.BackSide }), // front wall
    new THREE.MeshStandardMaterial({ map: wallTexture, side: THREE.BackSide })  // back wall
  ]

  // Create room mesh with materials array for each face
  const room = new THREE.Mesh(geometry, materials)
  scene.add(room)


  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setAnimationLoop(animate)
  document.body.appendChild(renderer.domElement)

  // Controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.minDistance = 0.1 // closer to the object
  controls.maxDistance = 2   // allow zooming out a little
  controls.target.set(0, 0, 0) // make sure controls focus on the object

  // --- RENDER TARGET SETUP (the "screen" on the back of the camera model) ---
  // Secondary camera that will "look out" from the camera model
  camViewCamera = new THREE.PerspectiveCamera(60, 1, 0.01, 100);
  // render target
  camRenderTarget = new THREE.WebGLRenderTarget(512, 512, {
    // optional: match encoding if you need color space conversion
    // type: THREE.UnsignedByteType
  });

  // screen mesh that displays the render target texture
  // Adjust the plane size/position to fit your OBJ camera's back surface
  const screenGeometry = new THREE.PlaneGeometry(0.083, 0.054); // tweak size to match model
  const screenMaterial = new THREE.MeshBasicMaterial({ map: camRenderTarget.texture });
  cameraScreen = new THREE.Mesh(screenGeometry, screenMaterial);

  // Position screen on the back of camera model
  cameraScreen.position.set(-0.015, -0.012, 0.04); // moved down on Y
  cameraScreen.rotation.set(Math.PI/2,0, Math.PI); 
  cam.add(cameraScreen);

    // --- MOVING SPHERE IN FRONT OF THE CAMERA ---
  const sphereGeo = new THREE.SphereGeometry(0.02, 32, 32);
  const sphereMat = new THREE.MeshStandardMaterial({ color: 0xff5555 });
  movingSphere = new THREE.Mesh(sphereGeo, sphereMat);
  scene.add(movingSphere);

  // Resize
  window.addEventListener('resize', onWindowResize)
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

function animate() {
  controls.update();

  // if cam or cameraScreen not ready yet, just render normally
  if (!cam || !camViewCamera || !camRenderTarget || !cameraScreen) {
    renderer.render(scene, camera);
    return;
  }

  // Sync position/orientation
  cam.updateWorldMatrix(true, false);
  camViewCamera.position.copy(cam.getWorldPosition(new THREE.Vector3()));
  camViewCamera.quaternion.copy(cam.getWorldQuaternion(new THREE.Quaternion()));

  // Fix rotation (your OBJ is rotated -90°)
  camViewCamera.rotateX(Math.PI / 2);
  camViewCamera.rotateZ(Math.PI);

  // ➜ Move slightly forward so camera is in front of the lens, not inside mesh
  camViewCamera.translateZ(-0.034);
  camViewCamera.translateY(-0.04);
  camViewCamera.translateX(0.006);

  // positionned right at the end of the len

  const t = performance.now() * 0.001;
  if (cam) {
      const basePos = cam.getWorldPosition(new THREE.Vector3());

      // Sphere movement: sinusoidal Z movement in front of the lens
      movingSphere.position.set(
          basePos.x - 0.1 - Math.sin(t) * 0.05,
          basePos.y + 0.04,
          basePos.z - 0.2,  // 10 cm in front + oscillation
      );
  }
  

  // Hide the screen mesh so it is not captured by the camera feed (avoids recursion/feedback)
  cameraScreen.visible = false;

  // Render the scene from the camera model's POV into the render target
  renderer.setRenderTarget(camRenderTarget);
  renderer.clear(); // ensure previous content is cleared
  renderer.render(scene, camViewCamera);

  // Restore default framebuffer and make the screen visible again
  renderer.setRenderTarget(null);
  cameraScreen.visible = true;

  // Finally render the full scene to the canvas
  renderer.render(scene, camera);
}

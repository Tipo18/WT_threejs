import * as THREE from 'three';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// MAIN VARS
let camera, scene, renderer;
let cam, camViewCamera, camRenderTarget, cameraScreen;

// DEVICE RIG
let deviceRig;
let objectGroup;

// ROTATION STATE
let isMouseDown = false;
let lastX = 0, lastY = 0;
let rotY = 0;  // horizontal rotation (left/right)
let tiltX = 0; // tilt forward/back
let rotationSpeed = 0.003;
let tiltSpeed = 0.003;

// CAMERA FOLLOW SMOOTHING
let cameraOffset = new THREE.Vector3(0, 0.1, 0.25);
let cameraCurrentPos = new THREE.Vector3();

let flipped = false;
let flipTarget = 0;  // 0° normal, 180° flipped

let zoom = 0;           // initial zoom (0 = default)
const minZoom = -0.8;  // zoom in limit
const maxZoom = 0.2;    // zoom out limit
const zoomSpeed = 0.01;

init();

async function init() {

    // ----------------------------
    // DISABLE PAGE SCROLLING
    // ----------------------------
    document.body.style.overflow = 'hidden';          // <--- prevents page scroll
    document.body.style.margin = '0';                // ensure no body margins
    document.body.style.height = '100vh';
    document.body.style.width = '100vw';
    window.scrollTo(0, 0);                           // force scroll to top

    // Prevent wheel from scrolling page
    window.addEventListener('wheel', (e) => e.preventDefault(), { passive: false }); // <--- prevent default scrolling
    window.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false }); // for mobile

    // ----------------------------
    // SCENE
    // ----------------------------
    scene = new THREE.Scene();
    createPointGrid();

    // CAMERA
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    scene.add(camera);

    // LIGHTS
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));

    const mainLight = new THREE.DirectionalLight(0xffffff, 1);
    mainLight.position.set(0, 2, 3);
    scene.add(mainLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.2);
    backLight.position.set(-5, 5, -5);
    scene.add(backLight);

    // DEVICE RIG (pivot)
    deviceRig = new THREE.Object3D();
    scene.add(deviceRig);

    // OBJECT GROUP (your phone)
    objectGroup = new THREE.Group();
    deviceRig.add(objectGroup);

    // LOAD MATERIALS
    const mtlLoader = new MTLLoader();

    const body_mat = await mtlLoader.loadAsync('body.mtl');
    body_mat.preload();
    const cam_mat = await mtlLoader.loadAsync('body.mtl');
    cam_mat.preload();
    const btt_mat = await mtlLoader.loadAsync('button.mtl');
    btt_mat.preload();

    const objLoader = new OBJLoader();

    // BODY
    objLoader.setMaterials(body_mat);
    const body = await objLoader.loadAsync('body.obj');
    body.rotation.x = -Math.PI / 2;
    objectGroup.add(body);

    // CAMERA HEAD
    objLoader.setMaterials(cam_mat);
    cam = await objLoader.loadAsync('cam.obj');
    cam.rotation.x = -Math.PI / 2;
    objectGroup.add(cam);

    // BUTTON
    objLoader.setMaterials(btt_mat);
    const button = await objLoader.loadAsync('button.obj');
    button.rotation.x = -Math.PI / 2;
    objectGroup.add(button);

    // SCREEN CAMERA OUTPUT
    camViewCamera = new THREE.PerspectiveCamera(60, 1, 0.01, 100);
    camRenderTarget = new THREE.WebGLRenderTarget(512, 512);

    const screenGeometry = new THREE.PlaneGeometry(0.083, 0.054);
    const screenMaterial = new THREE.MeshBasicMaterial({ map: camRenderTarget.texture });
    cameraScreen = new THREE.Mesh(screenGeometry, screenMaterial);

    cameraScreen.position.set(-0.015, -0.012, 0.04);
    cameraScreen.rotation.set(Math.PI / 2, 0, Math.PI);
    cam.add(cameraScreen);

    // LOAD ENVIRONMENT
    const gltfLoader = new GLTFLoader();
    gltfLoader.load('scene/scene.gltf', (gltf) => {
        const street = gltf.scene;
        street.scale.set(0.5, 0.5, 0.5);
        street.position.set(0.1, 0.2, -2);
        scene.add(street);
    });

    // ----------------------------
    // RENDERER
    // ----------------------------
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.display = 'block';  // <--- remove inline spacing
    renderer.domElement.style.position = 'fixed'; // <--- fix canvas to viewport
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.setAnimationLoop(animate);
    document.body.appendChild(renderer.domElement);

    // ----------------------------
    // MOUSE CONTROLS
    // ----------------------------
    renderer.domElement.addEventListener("mousedown", (e) => {
        isMouseDown = true;
        lastX = e.clientX;
        lastY = e.clientY;
    });

    window.addEventListener("mouseup", () => {
        isMouseDown = false;
    });

    window.addEventListener("mousemove", (e) => {
        if (!isMouseDown) return;

        let dx = e.clientX - lastX;
        let dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;

        rotY += dx * rotationSpeed;
        tiltX += dy * tiltSpeed;

        // ---- ROTATION LIMITS ----
        const maxTilt = Math.PI / 5;
        const maxSide = Math.PI / 5;

        tiltX = Math.max(-maxTilt, Math.min(maxTilt, tiltX));
        rotY = Math.max(-maxSide, Math.min(maxSide, rotY));
    });

    // ---- DOUBLE CLICK TO FLIP ----
    window.addEventListener("dblclick", () => {
        flipped = !flipped;
        flipTarget = flipped ? Math.PI : 0;
        objectGroup.rotation.y = flipped ? Math.PI : 0;
    });

    // ---- PRESS R TO FLIP ----
    window.addEventListener("keydown", (e) => {
        if (e.key.toLowerCase() === "r") {
            flipped = !flipped;
            flipTarget = flipped ? Math.PI : 0;
            objectGroup.rotation.y = flipped ? Math.PI : 0;
        }
    });

    // ---- SCROLL ZOOM ----
    window.addEventListener("wheel", (e) => {
        zoom += e.deltaY * zoomSpeed;
        zoom = Math.max(minZoom, Math.min(maxZoom, zoom)); // clamp zoom
    });

    // ---- create overlay styles ----
    const overlayCss = `
      #commands {
        position: fixed;
        top: 20px;
        left: 20px;
        max-width: 350px;
        background: rgba(0,0,0,0.45);
        color: #fff;
        padding: 10px 14px;
        border-radius: 8px;
        z-index: 9999;
        pointer-events: none;
        font-family: Arial, sans-serif;
        font-size: 20px;
        line-height: 1.5;  /* optional, makes text more readable */
      }
    `;
    const styleEl = document.createElement('style');
    styleEl.id = 'commands-style';
    styleEl.innerHTML = overlayCss;
    document.head.appendChild(styleEl);

    const commandsEl = document.createElement('div');
    commandsEl.id = 'commands';
    commandsEl.innerHTML = `
      <strong>Controls</strong><br>
      Drag & Move → Tilt<br>
      Scroll → Zoom In/Out<br>
      Double-click or R → View Camera
    `;
    document.body.appendChild(commandsEl);

    window.addEventListener("resize", onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function createPointGrid() {
    const gridSize = 50;
    const spacing = 0.5;
    const points = [];

    for (let x = -gridSize; x <= gridSize; x++) {
        for (let y = -gridSize; y <= gridSize; y++) {
            points.push(x * spacing, y * spacing, -5);
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));

    const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.02,
        sizeAttenuation: true
    });

    const gridPoints = new THREE.Points(geometry, material);
    scene.add(gridPoints);

    scene.background = new THREE.Color(0x000000);
}

function animate() {

    // --- APPLY RIG ROTATION ---
    deviceRig.rotation.y = rotY;     // horizontal spin
    deviceRig.rotation.x = tiltX;    // tilt forward/back

        // --- FOLLOW CAMERA (smooth) ---
    let desiredPos = cameraOffset.clone();

    // Apply rig rotation if needed
    desiredPos.applyQuaternion(deviceRig.quaternion);

    // Add zoom along the rig's local forward direction (negative Z)
    let forward = new THREE.Vector3(0, 0, -0.2);
    forward.applyQuaternion(deviceRig.quaternion);
    desiredPos.add(forward.multiplyScalar(zoom));

    desiredPos.add(deviceRig.position);

    if (!flipped)
      // Smooth follow
      cameraCurrentPos.lerp(desiredPos, 0.12);
      camera.position.copy(cameraCurrentPos);
      camera.lookAt(deviceRig.position);


    // --- RENDER SCREEN CAMERA ---
    if (cam && camViewCamera) {
        cam.updateWorldMatrix(true, false);

        camViewCamera.position.copy(cam.getWorldPosition(new THREE.Vector3()));
        camViewCamera.quaternion.copy(cam.getWorldQuaternion(new THREE.Quaternion()));

        camViewCamera.rotateX(Math.PI / 2);
        camViewCamera.rotateZ(Math.PI);

        camViewCamera.translateZ(-0.034);
        camViewCamera.translateY(-0.04);
        camViewCamera.translateX(0.006);

        renderer.setRenderTarget(camRenderTarget);
        renderer.clear();
        renderer.render(scene, camViewCamera);
        renderer.setRenderTarget(null);
    }

    // --- MAIN RENDER ---
    renderer.render(scene, camera);
}
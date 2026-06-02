import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ==========================================
// 1. OBTENER EL ID DESDE LA URL
// ==========================================
const urlParams = new URLSearchParams(window.location.search);
let modelId = urlParams.get('id') || '1';
const modelPath = `models/nft${modelId}.glb`;


// ==========================================
// 2. CONFIGURACIÓN DEL RENDERIZADOR (ESTÁNDAR PBR)
// ==========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111); // Fondo oscuro elegante

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    alpha: false,
    powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);

renderer.toneMapping = THREE.ACESFilmicToneMapping; 
renderer.toneMappingExposure = 1.3; // Exposición perfecta para resaltar el oro
renderer.outputColorSpace = THREE.SRGBColorSpace;

document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;


// ==========================================
// LÓGICA DE ROTACIÓN AUTOMÁTICA POR INACTIVIDAD
// ==========================================
let isUserInteracting = false;
let autoRotateTimeout;

function startAutoRotation() {
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.0; 
}

function resetInactivityTimer() {
    controls.autoRotate = false; 
    isUserInteracting = true;
    clearTimeout(autoRotateTimeout);
    
    autoRotateTimeout = setTimeout(() => {
        isUserInteracting = false;
        startAutoRotation();
    }, 5000);
}

controls.addEventListener('start', () => {
    isUserInteracting = true;
    controls.autoRotate = false;
    clearTimeout(autoRotateTimeout);
});

controls.addEventListener('end', () => {
    resetInactivityTimer();
});

startAutoRotation();


// ==========================================
// 3. CARGA MANUAL DE TUS 3 TEXTURAS (MÉTODO ULTRA SEGURO)
// ==========================================
const textureLoader = new THREE.TextureLoader();

// Carga del mapa de color base
const baseColorTex = textureLoader.load('textures/DefaultMaterial_baseColor.png');
baseColorTex.colorSpace = THREE.SRGBColorSpace; // Espacio sRGB para que los colores no se laven
baseColorTex.flipY = false; // GLTF usa el eje Y invertido, desactivamos flipY para alinearlo

// Carga del mapa de normales (relieve)
const normalTex = textureLoader.load('textures/DefaultMaterial_normal.png');
normalTex.colorSpace = THREE.NoColorSpace; // Las normales son datos vectoriales, no llevan sRGB
normalTex.flipY = false;

// Carga del mapa ORM empaquetado (Oclusión, Rugosidad, Metal)
const ormTex = textureLoader.load('textures/DefaultMaterial_occlusionRoughnessMetallic.png');
ormTex.colorSpace = THREE.NoColorSpace; // Datos físicos puros
ormTex.flipY = false;


// ==========================================
// 4. GENERACIÓN DE ENTORNO HDRI DE ESTUDIO REAL
// ==========================================
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

const envScene = new THREE.Scene();
const roomGeo = new THREE.SphereGeometry(15, 32, 16);
const roomMat = new THREE.MeshBasicMaterial({ color: 0x555555, side: THREE.BackSide }); 
const room = new THREE.Mesh(roomGeo, roomMat);
envScene.add(room);

const studioLight1 = new THREE.Mesh(new THREE.BoxGeometry(3, 8, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
studioLight1.position.set(6, 4, 5);
envScene.add(studioLight1);

const studioLight2 = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 0.5), new THREE.MeshBasicMaterial({ color: 0x888888 }));
studioLight2.position.set(-6, 6, -3);
envScene.add(studioLight2);

const renderTarget = pmremGenerator.fromScene(envScene);
scene.environment = renderTarget.texture;


// ==========================================
// 5. ILUMINACIÓN DIRECTA DE RELLENO
// =================
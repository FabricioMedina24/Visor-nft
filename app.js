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
// 2. CONFIGURACIÓN DEL RENDERIZADOR (ESTÁNDAR DE ALTA FIDELIDAD)
// ==========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111); // Tu fondo oscuro

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    alpha: false,
    powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);

// --- Configuración obligatoria para motores de renderizado PBR modernos ---
renderer.toneMapping = THREE.ACESFilmicToneMapping; // Mapeo de tonos estándar de la industria
renderer.toneMappingExposure = 1.0;                // Exposición equilibrada de fábrica
renderer.outputColorSpace = THREE.SRGBColorSpace;   // Espacio de color correcto para texturas nativas

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
// 3. GENERACIÓN DE ILUMINACIÓN DE ENTORNO HDRI REAL
// ==========================================
// Generamos un mapa de entorno dinámico basado en degradados de estudio esféricos.
// Esto permite que el metal y los mapas de rugosidad originales reaccionen con suavidad natural.
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

const envScene = new THREE.Scene();
const roomGeo = new THREE.SphereGeometry(15, 32, 16);

// Añadimos un degradado suave de estudio fotográfico al entorno
const roomMat = new THREE.MeshBasicMaterial({ 
    color: 0x555555, 
    side: THREE.BackSide,
    wireframe: false
}); 
const room = new THREE.Mesh(roomGeo, roomMat);
envScene.add(room);

// Añadimos luces de estudio esféricas suaves para generar reflejos e iluminar hendiduras de forma realista
const studioLight1 = new THREE.Mesh(new THREE.SphereGeometry(2, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
studioLight1.position.set(5, 8, 5);
envScene.add(studioLight1);

const studioLight2 = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 16), new THREE.MeshBasicMaterial({ color: 0x444444 }));
studioLight2.position.set(-6, 3, -5);
envScene.add(studioLight2);

const renderTarget = pmremGenerator.fromScene(envScene);
scene.environment = renderTarget.texture; // Asignamos el mapa de iluminación ambiental global


// ==========================================
// 4. LUCES DE APOYO REQUERIDAS
// ==========================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); 
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 1.5); 
mainLight.position.set(4, 6, 5);
scene.add(mainLight);


// ==========================================
// 5. CARGA RESPETANDO LOS MATERIALES DE ORIGEN (PBR ESTRICTO)
// =
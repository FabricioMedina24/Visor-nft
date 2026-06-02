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
scene.background = new THREE.Color(0x111111); // Tu fondo oscuro elegante

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    alpha: false,
    powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);

// Configuración de renderizado fotográfico para materiales físicos
renderer.toneMapping = THREE.ACESFilmicToneMapping; 
renderer.toneMappingExposure = 1.2; // Exposición perfecta para equilibrar brillos y sombras
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
// 3. GENERACIÓN DE ENTORNO HDRI DE ESTUDIO REAL
// ==========================================
// Esto genera un mapa de iluminación global difuso. 
// Hace que los metales tengan qué reflejar, eliminando manchas negras sin aplanar el contraste.
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

const envScene = new THREE.Scene();
// Una esfera de entorno gris neutro degradado
const roomGeo = new THREE.SphereGeometry(15, 32, 16);
const roomMat = new THREE.MeshBasicMaterial({ color: 0x666666, side: THREE.BackSide }); 
const room = new THREE.Mesh(roomGeo, roomMat);
envScene.add(room);

// Paneles de luz blanca suave flotantes para generar destellos lineales en el oro
const studioLight1 = new THREE.Mesh(new THREE.BoxGeometry(3, 8, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
studioLight1.position.set(6, 4, 5);
envScene.add(studioLight1);

const studioLight2 = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 0.5), new THREE.MeshBasicMaterial({ color: 0x888888 }));
studioLight2.position.set(-6, 6, -3);
envScene.add(studioLight2);

const renderTarget = pmremGenerator.fromScene(envScene);
scene.environment = renderTarget.texture;


// ==========================================
// 4. LUCES DIRECTAS DE RESPALDO
// ==========================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 1.5); 
mainLight.position.set(4, 6, 5);
scene.add(mainLight);


// ==========================================
// 5. CARGA FIEL DEL MODELO (LECTURA DE MATERIALES NATIVOS)
// ==========================================
const loader = new GLTFLoader();

loader.load(
    modelPath, 
    function (gltf) {
        const model = gltf.scene;

        model.traverse((child) => {
            if (child.isMesh) {
                // Sincronización estricta del espacio de color de la ilustración central
                if (child.material.map) {
                    child.material.map.colorSpace = THREE.SRGBColorSpace;
                }

                // LECTURA LIMPIA: No forzamos roughness ni metalness manuales.
                // Dejamos que el motor use exactamente los mapas que exportaste de Blender.
                child.material.envMapIntensity = 1.4; // Intensidad ideal para avivar los reflejos nativos
                child.material.needsUpdate = true;
            }
        });

        scene.add(model);
        console.log(`[Éxito] Modelo nft${modelId}.glb renderizado con fidelidad nativa.`);
        
        // --- AUTO-ENCUADRE Y SISTEMA ANTICHOCUE ---
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        controls.target.copy(center);
        
        const maxDim = Math.max(size.x, size.y, size.z);
        
        // Freno dinámico: Evita que la cámara atraviese la tarjeta al hacer zoom hacia adentro
        controls.minDistance = maxDim * 0.65; 
        controls.maxDistance = maxDim * 4.0; // Evita que el usuario se aleje infinitamente

        camera.position.set(center.x, center.y, center.z + (maxDim * 1.8));
        camera.lookAt(center);
        
        controls.update();
    }, 
    function (xhr) {
        if (xhr.total > 0) console.log(`Cargando: ${Math.round(xhr.loaded / xhr.total * 100)}%`);
    }, 
    function (error) {
        console.error(`Error al cargar el archivo: ${modelPath}`, error);
    }
);


// ==========================================
// 6. ANIMACIÓN Y RESPONSIVIDAD
// ==========================================
function animate() {
    requestAnimationFrame(animate);
    controls.update(); 
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
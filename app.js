import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ==========================================
// 1. OBTENER EL ID DESDE LA URL
// ==========================================
const urlParams = new URLSearchParams(window.location.search);
let modelId = urlParams.get('id');

// Si no pones ?id=X en la URL, por defecto es 1
if (!modelId) {
    modelId = '1';
}

// Ruta exacta hacia tu carpeta y archivo: models/nft1.glb
const modelPath = `models/nft${modelId}.glb`;

console.log(`[Visor] Intentando cargar la ruta: ${modelPath}`);


// ==========================================
// 2. CONFIGURACIÓN DE THREE.JS
// ==========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111); // Fondo oscuro a juego con tu CSS

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
// Posición inicial temporal de la cámara
camera.position.set(0, 2, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;


// ==========================================
// 3. ILUMINACIÓN MULTIDIRECCIONAL
// ==========================================
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 2.0);
mainLight.position.set(5, 10, 7);
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 1.0);
fillLight.position.set(-5, 5, -5);
scene.add(fillLight);


// ==========================================
// 4. CARGA DEL GLB (Con auto-ajuste de cámara)
// ==========================================
const loader = new GLTFLoader();

loader.load(
    modelPath, 
    function (gltf) {
        const model = gltf.scene;
        scene.add(model);
        
        console.log(`[Éxito] ¡nft${modelId}.glb cargado correctamente!`);
        
        // --- AUTO-ENCUADRE: Ajusta la cámara al tamaño real de tu FrogPrince ---
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        // Apuntar los controles al centro del NFT
        controls.target.copy(center);
        
        // Posicionar la cámara a una distancia perfecta según el tamaño del objeto
        const maxDim = Math.max(size.x, size.y, size.z);
        camera.position.set(center.x, center.y + (maxDim * 0.3), center.z + (maxDim * 2.2));
        camera.lookAt(center);
        
        controls.update();
    }, 
    function (xhr) {
        if (xhr.total > 0) {
            console.log(`Cargando NFT ${modelId}: ` + Math.round(xhr.loaded / xhr.total * 100) + '%');
        }
    }, 
    function (error) {
        console.error(`[Error de Carga] No se pudo leer: ${modelPath}`);
        console.error(error);
    }
);


// ==========================================
// 5. ANIMACIÓN Y RESPONSIVIDAD
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
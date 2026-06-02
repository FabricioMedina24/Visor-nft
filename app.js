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
// 2. CONFIGURACIÓN DEL RENDERIZADOR (ACTIVA TEXTURAS)
// ==========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 5);

const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: false,
    powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);

// --- CONFIGURACIÓN CRÍTICA PARA MAPAS DE TEXTURAS PBR ---
renderer.toneMapping = THREE.ACESFilmicToneMapping; // Mapeo tonal cinematográfico (colores realistas)
renderer.toneMappingExposure = 1.0;                // Controla la exposición general de la luz
renderer.outputColorSpace = THREE.SRGBColorSpace;   // Fuerza el espacio de color correcto para texturas

document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;


// ==========================================
// 3. ILUMINACIÓN AVANZADA (Esencial para Normal/Roughness maps)
// ==========================================
// Una luz ambiental suave para rellenar sombras oscuras
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

// Luz principal (actúa como sol, resalta brillos metálicos y rugosidad)
const mainLight = new THREE.DirectionalLight(0xffffff, 2.5);
mainLight.position.set(5, 10, 7);
scene.add(mainLight);

// Luz de contra (evita que el modelo se vea plano por detrás)
const backLight = new THREE.DirectionalLight(0xffffff, 1.5);
backLight.position.set(-5, 5, -5);
scene.add(backLight);


// ==========================================
// 4. CARGA DEL GLB (Manteniendo perfiles de color)
// ==========================================
const loader = new GLTFLoader();

loader.load(
    modelPath, 
    function (gltf) {
        const model = gltf.scene;

        // Recorremos cada parte del modelo para asegurarnos de que sus materiales
        // procesen correctamente todos los mapas de texturas 3D importados
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                // Si el material tiene texturas asignadas de Blender/Substance, forzamos su espacio de color
                if (child.material.map) {
                    child.material.map.colorSpace = THREE.SRGBColorSpace;
                }
                
                // Activa la renderización correcta de mapas normales y de rugosidad
                child.material.needsUpdate = true;
            }
        });

        scene.add(model);
        console.log(`[Éxito] Modelo nft${modelId}.glb y sus texturas cargados.`);
        
        // Auto-encuadre de cámara
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        controls.target.copy(center);
        const maxDim = Math.max(size.x, size.y, size.z);
        camera.position.set(center.x, center.y + (maxDim * 0.2), center.z + (maxDim * 2.0));
        camera.lookAt(center);
        
        controls.update();
    }, 
    function (xhr) {
        if (xhr.total > 0) console.log(`Cargando: ${Math.round(xhr.loaded / xhr.total * 100)}%`);
    }, 
    function (error) {
        console.error(`Error al cargar: ${modelPath}`, error);
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
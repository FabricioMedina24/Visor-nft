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
// 2. CONFIGURACIÓN DEL RENDERIZADOR PROFESIONAL
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

// Configuración de color e iluminación PBR estricta
renderer.toneMapping = THREE.ACESFilmicToneMapping; 
renderer.toneMappingExposure = 1.2; // Sube o baja esto si lo ves muy brillante o muy oscuro
renderer.outputColorSpace = THREE.SRGBColorSpace;

document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;


// ==========================================
// 3. ENTORNO DE REFLEJOS AUTOMÁTICO (El truco maestro)
// ==========================================
// Creamos una escena de iluminación ambiental realista para que el metal tenga qué reflejar
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

// Generamos un mapa de entorno artificial neutral
const envScene = new THREE.Scene();
const lightRoom = new THREE.Mesh(
    new THREE.BoxGeometry(10, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide })
);
envScene.add(lightRoom);

const renderTarget = pmremGenerator.fromScene(envScene);
scene.environment = renderTarget.texture; // <-- Esto activa los reflejos en los mapas 3D


// ==========================================
// 4. ILUMINACIÓN ESTUDIO (Luces de tres puntos)
// ==========================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

// Luz frontal principal
const mainLight = new THREE.DirectionalLight(0xffffff, 2.5);
mainLight.position.set(2, 4, 6);
scene.add(mainLight);

// Luz de relleno lateral (suaviza las sombras negras quemadas)
const fillLight = new THREE.DirectionalLight(0xffffff, 1.5);
fillLight.position.set(-6, 2, 2);
scene.add(fillLight);

// Luz de contra superior (resalta los bordes dorados de arriba)
const topLight = new THREE.DirectionalLight(0xffffff, 2.0);
topLight.position.set(0, 8, -4);
scene.add(topLight);


// ==========================================
// 5. CARGA DEL GLB CON CONFIGURACIÓN DE MATERIALES
// ==========================================
const loader = new GLTFLoader();

loader.load(
    modelPath, 
    function (gltf) {
        const model = gltf.scene;

        // Recorremos el modelo para configurar de forma agresiva cada textura
        model.traverse((child) => {
            if (child.isMesh) {
                // Forzar texturas al espacio sRGB correcto
                if (child.material.map) {
                    child.material.map.colorSpace = THREE.SRGBColorSpace;
                }
                
                // Si el modelo incluye mapas de normales o rugosidad, nos aseguramos de que se activen
                if (child.material.normalMap) child.material.normalScale.set(1, 1);
                if (child.material.roughnessMap) child.material.roughness = 1.0;
                
                // Permitir que el material use el entorno de reflejos que creamos arriba
                child.material.envMapIntensity = 1.5; // Ajusta la intensidad del reflejo en el metal
                child.material.needsUpdate = true;
            }
        });

        scene.add(model);
        console.log(`[Éxito] Modelo nft${modelId}.glb renderizado en alta definición.`);
        
        // Auto-encuadre perfecto
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        controls.target.copy(center);
        const maxDim = Math.max(size.x, size.y, size.z);
        camera.position.set(center.x, center.y, center.z + (maxDim * 1.8));
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
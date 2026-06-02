import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; // <-- 1. Importamos el cargador

const scene = new THREE.Scene();
// Cambiamos el fondo a un gris claro para contrastar mejor el modelo
scene.background = new THREE.Color(0xaaaaaa); 

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(0, 2, 5); // Posición inicial de la cámara (X, Y, Z)

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// --- 2. AGREGAR ILUMINACIÓN (Esencial para modelos GLB) ---
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5); // Luz general suave
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0); // Luz tipo "sol"
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

// --- 3. CARGAR EL MODELO .GLB ---
const loader = new GLTFLoader();

// REEMPLAZA 'ruta/de/tu/modelo.glb' por la ubicación real de tu archivo
loader.load(
    'modelo.glb', 
    function (gltf) {
        // Esta función se ejecuta cuando el modelo se carga con éxito
        const model = gltf.scene;
        scene.add(model);
        
        console.log("¡Modelo cargado exitosamente!");
    }, 
    function (xhr) {
        // Opcional: Muestra el progreso de la carga en la consola
        console.log((xhr.loaded / xhr.total * 100) + '% cargado');
    }, 
    function (error) {
        // Opcional: Si hay un error, lo muestra aquí
        console.error('Hubo un error al cargar el modelo:', error);
    }
);

// --- 4. BUCLE DE ANIMACIÓN ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// Ajuste de pantalla
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
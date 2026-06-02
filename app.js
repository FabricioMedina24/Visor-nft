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
// 2. CONFIGURACIÓN DEL RENDERIZADOR NATIVO
// ==========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);

const renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    alpha: false,
    powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);

renderer.toneMapping = THREE.ACESFilmicToneMapping; 
renderer.toneMappingExposure = 1.25; 
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
// 3. GENERACIÓN DE ENTORNO HDRI DE ESTUDIO NEUTRO
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
// 4. SISTEMA DE ILUMINACIÓN VINCULADA A LA CÁMARA
// ==========================================
// Luz ambiental muy suave para mantener las sombras base estables
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); 
scene.add(ambientLight);

// ¡CLAVE!: Creamos la luz direccional principal
const cameraLight = new THREE.DirectionalLight(0xffffff, 1.5); 
// La posicionamos ligeramente desplazada del lente (arriba y a la derecha de la pantalla)
cameraLight.position.set(2, 3, 4); 

// Agregamos la luz a la cámara, y luego la cámara a la escena
camera.add(cameraLight);
scene.add(camera); 


// ==========================================
// 5. CARGA AUTÓNOMA DE MATERIALES NATIVOS
// ==========================================
const loader = new GLTFLoader();

loader.load(
    modelPath, 
    function (gltf) {
        const model = gltf.scene;

        model.traverse((child) => {
            if (child.isMesh) {
                const mat = child.material;

                if (mat.map) {
                    mat.map.colorSpace = THREE.SRGBColorSpace;
                }

                // Incrementamos levemente la fuerza del reflejo metálico nativo
                mat.envMapIntensity = 2.2; 
                mat.needsUpdate = true;
            }
        });

        scene.add(model);
        console.log(`[Éxito] Modelo nft${modelId}.glb cargado con luz interactiva vinculada a la cámara.`);
        
        // --- AUTO-ENCUADRE Y SUPER ZOOM PERMITIDO ---
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        controls.target.copy(center);
        const maxDim = Math.max(size.x, size.y, size.z);
        
        // Súper zoom activado (detiene la cámara justo antes de chocar)
        controls.minDistance = maxDim * 0.15; 
        controls.maxDistance = maxDim * 4.0; 

        camera.position.set(center.x, center.y, center.z + (maxDim * 1.8));
        camera.lookAt(center);
        
        controls.update();
    }, 
    function (xhr) {
        if (xhr.total > 0) console.log(`Cargando modelo: ${Math.round(xhr.loaded / xhr.total * 100)}%`);
    }, 
    function (error) {
        console.error(`Error al cargar el archivo .glb: ${modelPath}`, error);
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
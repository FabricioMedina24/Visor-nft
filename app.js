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
// 2. CONFIGURACIÓN DEL RENDERIZADOR CONTRASTADO
// ==========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: false,
    powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);

renderer.toneMapping = THREE.LinearToneMapping; 
renderer.toneMappingExposure = 1.1; 
renderer.outputColorSpace = THREE.SRGBColorSpace;

document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;


// ==========================================
// LÓGICA DE ROTACIÓN AUTOMÁTICA TRAS INACTIVIDAD
// ==========================================
let isUserInteracting = false;
let autoRotateTimeout;

// Esta función activa la rotación automática en los controles
function startAutoRotation() {
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.0; // Velocidad del giro en 360° (ajusta si lo quieres más rápido o lento)
}

// Esta función resetea el contador de 5 segundos
function resetInactivityTimer() {
    controls.autoRotate = false; // Detiene el giro inmediatamente
    isUserInteracting = true;
    
    // Limpia el temporizador anterior
    clearTimeout(autoRotateTimeout);
    
    // Si pasan 5000ms (5 segundos) sin interacción, vuelve a girar
    autoRotateTimeout = setTimeout(() => {
        isUserInteracting = false;
        startAutoRotation();
    }, 5000);
}

// Escuchamos los eventos del mouse/touch sobre el visor
controls.addEventListener('start', () => {
    isUserInteracting = true;
    controls.autoRotate = false;
    clearTimeout(autoRotateTimeout);
});

controls.addEventListener('end', () => {
    // Cuando el usuario suelta el mouse, empiezan a correr los 5 segundos
    resetInactivityTimer();
});

// Iniciamos el temporizador por primera vez al cargar la página
startAutoRotation();


// ==========================================
// 3. MAPA DE ENTORNO SUTIL (Reflejos de metal real)
// ==========================================
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

const envScene = new THREE.Scene();
const roomGeo = new THREE.BoxGeometry(12, 12, 12);
const roomMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.BackSide }); 
const room = new THREE.Mesh(roomGeo, roomMat);
envScene.add(room);

const lightPanel1 = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
lightPanel1.position.set(4, 2, 4);
envScene.add(lightPanel1);

const lightPanel2 = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 0.5), new THREE.MeshBasicMaterial({ color: 0xaaaaaa }));
lightPanel2.position.set(-4, 4, -2);
envScene.add(lightPanel2);

const renderTarget = pmremGenerator.fromScene(envScene);
scene.environment = renderTarget.texture; 


// ==========================================
// 4. ILUMINACIÓN CONTROLADA
// ==========================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); 
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 1.3); 
mainLight.position.set(3, 5, 5);
scene.add(mainLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 0.9); 
rimLight.position.set(-3, 3, -4);
scene.add(rimLight);


// ==========================================
// 5. CARGA DEL GLB Y AJUSTE DE REFLEJOS FINOS
// ==========================================
const loader = new GLTFLoader();

loader.load(
    modelPath, 
    function (gltf) {
        const model = gltf.scene;

        model.traverse((child) => {
            if (child.isMesh) {
                if (child.material.map) {
                    child.material.map.colorSpace = THREE.SRGBColorSpace;
                }
                
                if (child.material.roughnessMap) {
                    child.material.roughness = 1.0; 
                } else {
                    child.material.roughness = 0.25; 
                }
                
                child.material.envMapIntensity = 1.8; 
                child.material.needsUpdate = true;
            }
        });

        scene.add(model);
        console.log(`[Éxito] Modelo nft${modelId}.glb renderizado con auto-giro por inactividad.`);
        
        // Auto-encuadre
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
    
    // IMPORTANTE: controls.update() es lo que hace girar la cámara automáticamente
    // cuando controls.autoRotate está activado
    controls.update(); 
    
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
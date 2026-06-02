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

// Mapeo tonal ideal para conservar negros profundos y contrastes
renderer.toneMapping = THREE.LinearToneMapping; 
renderer.toneMappingExposure = 1.0; 
renderer.outputColorSpace = THREE.SRGBColorSpace;

document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;


// ==========================================
// 3. MAPA DE ENTORNO SUTIL (Reflejos de metal real)
// ==========================================
// Generamos un entorno con degradados y variaciones físicas para que el metal tenga reflejos reales con detalle
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

const envScene = new THREE.Scene();
// Creamos una estructura que simula un estudio fotográfico oscuro con luces clave flotantes
const roomGeo = new THREE.BoxGeometry(12, 12, 12);
const roomMat = new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.BackSide }); // Paredes oscuras para no lavar el modelo
const room = new THREE.Mesh(roomGeo, roomMat);
envScene.add(room);

// Añadimos paneles de luz blanca al "estudio virtual" para que se reflejen como líneas nítidas en el metal dorado
const lightPanel1 = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
lightPanel1.position.set(4, 2, 4);
envScene.add(lightPanel1);

const lightPanel2 = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 0.5), new THREE.MeshBasicMaterial({ color: 0xaaaaaa }));
lightPanel2.position.set(-4, 4, -2);
envScene.add(lightPanel2);

const renderTarget = pmremGenerator.fromScene(envScene);
scene.environment = renderTarget.texture; 


// ==========================================
// 4. ILUMINACIÓN CONTROLADA (Conserva la atmósfera oscura)
// ==========================================
// Luz ambiental muy baja para mantener las sombras misteriosas y oscuras
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

// Luz principal suave (aporta volumen sin quemar la imagen interna)
const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
mainLight.position.set(3, 5, 5);
scene.add(mainLight);

// Luz de recorte trasera (da un sutil destello en los relieves dorados traseros)
const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
rimLight.position.set(-3, 3, -4);
scene.add(rimLight);


// ==========================================
// 5. CARGA DEL GLB Y RE-AJUSTE DE MATERIALES PBR
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
                
                // Mantenemos la configuración original de texturas que hiciste en tu software de 3D
                if (child.material.roughnessMap) {
                    // Si tiene mapa de rugosidad, dejamos que la textura controle el brillo plástico
                    child.material.roughness = 1.0; 
                } else {
                    // Si no tiene mapa, le damos un toque intermedio para que no parezca espejo ni plástico flojo
                    child.material.roughness = 0.4; 
                }
                
                // Controlamos qué tan fuerte impacta nuestro entorno en los reflejos del oro
                child.material.envMapIntensity = 1.0; 
                child.material.needsUpdate = true;
            }
        });

        scene.add(model);
        console.log(`[Éxito] Modelo nft${modelId}.glb renderizado con balance de contraste.`);
        
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
    controls.update(); 
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
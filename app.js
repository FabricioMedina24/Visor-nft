import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Importaciones requeridas para el canal de Bloom cinematográfico
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

let composer; // Variable global para el motor de efectos

requestAnimationFrame(() => {
    setTimeout(inicializarVisor3D, 50);
});

function inicializarVisor3D() {
    const urlParams = new URLSearchParams(window.location.search);
    let modelId = urlParams.get('id') || '1';

    const modelPath = `https://thehistorybehindthepainting.com/models/nft${modelId}.glb`;

    // ==========================================
    // CONFIGURACIÓN DEL RENDERIZADOR NATIVO
    // ==========================================
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0b0b);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);

    const renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: false,
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);

    renderer.toneMapping = THREE.ACESFilmicToneMapping; 
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    document.body.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // LÓGICA DE ROTACIÓN AUTOMÁTICA
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
    // CONFIGURACIÓN DEL CANAL DE BLOOM (AJUSTADO PARA SUAVIDAD)
    // ==========================================
    const renderScene = new RenderPass(scene, camera);
    
    // Ajustes para eliminar el aspecto "cuadrado" o "pixelado":
    // El radio aumentado ayuda a suavizar las formas del resplandor.
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.35, 0.8, 0.4);
    
    const outputPass = new OutputPass();

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composer.addPass(outputPass);

    // GENERACIÓN DE ENTORNO HDRI
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    const envScene = new THREE.Scene();
    const roomGeo = new THREE.SphereGeometry(15, 32, 16);
    const roomMat = new THREE.MeshBasicMaterial({ color: 0x444444, side: THREE.BackSide }); 
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

    // ILUMINACIÓN
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35); 
    scene.add(ambientLight);

    const cameraLight = new THREE.DirectionalLight(0xffffff, 1.4); 
    cameraLight.position.set(2, 3, 4); 

    camera.add(cameraLight);
    scene.add(camera); 

    // CARGA DEL MODELO
    const loader = new GLTFLoader();
    loader.setCrossOrigin('anonymous');

    loader.load(
        modelPath, 
        function (gltf) {
            const model = gltf.scene;

            model.traverse((child) => {
                if (child.isMesh) {
                    const mat = child.material;
                    if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
                    mat.envMapIntensity = 1.2; // Reducido para evitar el "quemado" cuadrado
                    mat.needsUpdate = true;
                }
            });

            scene.add(model);
            
            const loaderContainer = document.getElementById('loader-container');
            if (loaderContainer) {
                loaderContainer.style.opacity = '0';
                setTimeout(() => { loaderContainer.remove(); }, 400);
            }
            
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            
            controls.target.copy(center);
            const maxDim = Math.max(size.x, size.y, size.z);
            
            controls.minDistance = maxDim * 0.15; 
            controls.maxDistance = maxDim * 4.0; 

            camera.position.set(center.x, center.y, center.z + (maxDim * 0.95));
            camera.lookAt(center);
            controls.update();
        }, 
        null, 
        function (error) {
            console.error(`Error al cargar el archivo .glb: ${modelPath}`, error);
            const textElement = document.querySelector('.loading-text');
            if (textElement) textElement.innerText = "Error al conectar al modelo";
        }
    );

    // BUCLE DE ANIMACIÓN
    function animate() {
        requestAnimationFrame(animate);
        controls.update(); 
        if (composer) {
            composer.render();
        } else {
            renderer.render(scene, camera);
        }
    }
    animate();

    function resizeViewer() {
        const width = window.innerWidth || document.documentElement.clientWidth;
        const height = window.innerHeight || document.documentElement.clientHeight;
        if (width > 0 && height > 0) {
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
            if (composer) composer.setSize(width, height);
        }
    }

    window.addEventListener('resize', resizeViewer);
    resizeViewer();
}
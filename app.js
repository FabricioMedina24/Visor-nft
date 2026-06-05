import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Importaciones para el post-procesamiento
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

let composer;

requestAnimationFrame(() => {
    setTimeout(inicializarVisor3D, 50);
});

function inicializarVisor3D() {
    const urlParams = new URLSearchParams(window.location.search);
    let modelId = urlParams.get('id') || '1';
    const modelPath = `https://thehistorybehindthepainting.com/models/nft${modelId}.glb`;

    // CONFIGURACIÓN RENDERIZADOR
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0b0b);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; 
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // CONFIGURACIÓN DEL CANAL DE BLOOM (OPTIMIZADO PARA SUAVIDAD)
    const renderScene = new RenderPass(scene, camera);
    
    // Parámetros refinados para evitar el aspecto cuadrado:
    // Strength: 0.35, Radius: 0.8 (más alto para expandir el brillo), Threshold: 0.4
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.35, 0.8, 0.4);
    
    const outputPass = new OutputPass();

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composer.addPass(outputPass);

    // GENERACIÓN DE ENTORNO HDRI
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const room = new THREE.Mesh(new THREE.SphereGeometry(15, 32, 16), new THREE.MeshBasicMaterial({ color: 0x444444, side: THREE.BackSide }));
    envScene.add(room);
    scene.environment = pmremGenerator.fromScene(envScene).texture;

    // ILUMINACIÓN
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const cameraLight = new THREE.DirectionalLight(0xffffff, 1.4);
    cameraLight.position.set(2, 3, 4);
    camera.add(cameraLight);
    scene.add(camera);

    // CARGA DEL MODELO
    const loader = new GLTFLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(modelPath, (gltf) => {
        const model = gltf.scene;
        model.traverse((child) => {
            if (child.isMesh) {
                child.material.envMapIntensity = 1.2;
                child.material.needsUpdate = true;
            }
        });
        scene.add(model);
        
        // Ocultar cargador
        const loaderContainer = document.getElementById('loader-container');
        if (loaderContainer) loaderContainer.style.opacity = '0';
        
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        controls.target.copy(center);
        camera.position.set(center.x, center.y, center.z + (box.getSize(new THREE.Vector3()).length() * 0.5));
    });

    // BUCLE DE ANIMACIÓN
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        composer.render();
    }
    animate();

    // RESIZE
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
    });
}
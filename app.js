import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Importaciones requeridas para el canal de Bloom cinematográfico
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

let composer; 

// ==========================================
// 1. INTERCEPTOR DE RAREZA (METADATA)
// ==========================================
async function arrancarVisorConRareza() {
    const urlParams = new URLSearchParams(window.location.search);
    let modelId = urlParams.get('id') || '1';

    let metadata = {
        rarity: "Common",
        frames_count: 10,
        cycle_interval: 60000,
        glow_color: "0xffffff"
    };

    try {
        const response = await fetch(`https://thehistorybehindthepainting.com/metadata/nft${modelId}.json`);
        if (response.ok) {
            metadata = await response.json();
            console.log(`Rareza detectada: ${metadata.rarity}`);
        }
    } catch (e) {
        console.warn("No se encontró metadata, usando valores por defecto.");
    }

    requestAnimationFrame(() => {
        setTimeout(() => inicializarVisor3D(modelId, metadata), 50);
    });
}

arrancarVisorConRareza();

// ==========================================
// 2. FUNCIÓN PRINCIPAL DEL VISOR (COMPLETA E ÍNTEGRA)
// ==========================================
function inicializarVisor3D(modelId, metadata) {
    const modelPath = `https://thehistorybehindthepainting.com/models/nft${modelId}.glb`;

    // CONFIGURACIÓN DEL RENDERIZADOR NATIVO
    const scene = new THREE.Scene();
    
    // Diccionario de colores de fondo según rareza
    const coloresFondoPorRareza = {
        'common': 0x000000, 'rare': 0x0a2240, 'epic': 0x3d0c5a, 
        'legendary': 0xdfa837, 'divine': 0x8ecae6
    };
    const rarezaActual = (metadata.rarity || 'common').toLowerCase();
    scene.background = new THREE.Color(coloresFondoPorRareza[rarezaActual] || 0x0b0b0b);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
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

    function startAutoRotation() { controls.autoRotate = true; controls.autoRotateSpeed = 1.0; }
    function resetInactivityTimer() {
        controls.autoRotate = false;
        isUserInteracting = true;
        clearTimeout(autoRotateTimeout);
        autoRotateTimeout = setTimeout(() => { isUserInteracting = false; startAutoRotation(); }, 5000);
    }
    controls.addEventListener('start', () => { isUserInteracting = true; controls.autoRotate = false; clearTimeout(autoRotateTimeout); });
    controls.addEventListener('end', resetInactivityTimer);
    startAutoRotation();

    // CONFIGURACIÓN DEL CANAL DE BLOOM
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.25, 0.4, 0.5);
    const outputPass = new OutputPass();
    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass); 
    composer.addPass(outputPass);

    // ILUMINACIÓN Y HDRI
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(15, 32, 16), new THREE.MeshBasicMaterial({ color: 0x444444, side: THREE.BackSide })));
    envScene.add(new THREE.Mesh(new THREE.BoxGeometry(3, 8, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff })).position.set(6, 4, 5) || new THREE.Mesh());
    scene.environment = pmremGenerator.fromScene(envScene).texture;
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const cameraLight = new THREE.DirectionalLight(0xffffff, 1.4);
    cameraLight.position.set(2, 3, 4);
    camera.add(cameraLight);
    scene.add(camera);

    // CARGA DEL MODELO 3D
    const loader = new GLTFLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(modelPath, function (gltf) {
        const model = gltf.scene;
        
        // LÓGICA DE LIENZO Y TEXTURAS
        const nodoLienzo = model.getObjectByName('LIENZO');
        let lienzo = null;
        nodoLienzo?.traverse((child) => { if (child.isMesh && child.material) lienzo = child; });
        
        if (lienzo && lienzo.material) {
            const textureLoader = new THREE.TextureLoader();
            const texturas = [];
            const totalImagenes = metadata.frames_count || 1; 
            let indiceActual = 0; 

            for (let i = 1; i <= totalImagenes; i++) {
                textureLoader.load(`https://thehistorybehindthepainting.com/paintings/nft${modelId}/${i}.png`, (txt) => {
                    txt.colorSpace = THREE.SRGBColorSpace;
                    txt.flipY = false;
                    texturas.push({ id: i, map: txt });
                    if (texturas.length === 1) { lienzo.material.map = txt; lienzo.material.needsUpdate = true; }
                    if (texturas.length === totalImagenes) texturas.sort((a, b) => a.id - b.id);
                });
            }

            // TRANSICIÓN MÁGICA ORIGINAL
            function hacerTransicionMagica(nuevaTextura) {
                const duracion = 1500;
                const inicio = performance.now();
                const mat = lienzo.material;
                const emisionOriginal = mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000);
                const intensidadOriginal = mat.emissiveIntensity !== undefined ? mat.emissiveIntensity : 1.0;
                const colorMagia = new THREE.Color(parseInt(metadata.glow_color || "0xffffff", 16));

                function animarResplandor() {
                    const t = (performance.now() - inicio) / duracion;
                    if (t >= 1) { mat.emissive.copy(emisionOriginal); mat.emissiveIntensity = intensidadOriginal; return; }
                    const curvaLuz = Math.sin(t * Math.PI);
                    if (!mat.emissive) mat.emissive = new THREE.Color(0x000000);
                    mat.emissive.copy(colorMagia);
                    mat.emissiveIntensity = curvaLuz * 3.5;
                    if (t >= 0.5 && mat.map !== nuevaTextura) {
                        mat.map = nuevaTextura;
                        mat.emissiveMap = nuevaTextura;
                        mat.needsUpdate = true;
                    }
                    requestAnimationFrame(animarResplandor);
                }
                animarResplandor();
            }

            if (totalImagenes > 1) {
                setInterval(() => {
                    if (texturas.length === totalImagenes) {
                        indiceActual = (indiceActual + 1) % texturas.length;
                        hacerTransicionMagica(texturas[indiceActual].map);
                    }
                }, metadata.cycle_interval);
            }
        }

        model.traverse((child) => {
            if (child.isMesh) {
                const mat = child.material;
                if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
                mat.envMapIntensity = 1.0; 
                mat.needsUpdate = true;
            }
        });

        scene.add(model);
        document.getElementById('loader-container')?.remove();
        
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        controls.target.copy(center);
        const maxDim = Math.max(size.x, size.y, size.z);
        camera.position.set(center.x, center.y, center.z + (maxDim * 0.9));
        camera.lookAt(center);
        controls.update();
    });

    // BUCLE DE ANIMACIÓN
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        composer.render();
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
    });
}
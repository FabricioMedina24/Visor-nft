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
// 2. FUNCIÓN PRINCIPAL DEL VISOR (MANTENIDA ÍNTEGRA)
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

    // ROTACIÓN AUTOMÁTICA
    let autoRotateTimeout;
    function startAutoRotation() { controls.autoRotate = true; controls.autoRotateSpeed = 1.0; }
    function resetInactivityTimer() {
        controls.autoRotate = false;
        clearTimeout(autoRotateTimeout);
        autoRotateTimeout = setTimeout(startAutoRotation, 5000);
    }
    controls.addEventListener('start', () => { controls.autoRotate = false; clearTimeout(autoRotateTimeout); });
    controls.addEventListener('end', resetInactivityTimer);
    startAutoRotation();

    // POST-PROCESAMIENTO (BLOOM)
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.25, 0.4, 0.5));
    composer.addPass(new OutputPass());

    // ILUMINACIÓN Y ENTORNO
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

    // CARGA DE MODELO Y LIENZO
    new GLTFLoader().load(modelPath, (gltf) => {
        const model = gltf.scene;
        const nodoLienzo = model.getObjectByName('LIENZO');
        let lienzo = null;
        nodoLienzo?.traverse((child) => { if (child.isMesh && child.material) lienzo = child; });

        if (lienzo && lienzo.material) {
            const textureLoader = new THREE.TextureLoader();
            const texturas = [];
            
            // Carga de PNGs secuencial
            for (let i = 1; i <= metadata.frames_count; i++) {
                textureLoader.load(`https://thehistorybehindthepainting.com/paintings/nft${modelId}/${i}.png`, (txt) => {
                    txt.colorSpace = THREE.SRGBColorSpace;
                    txt.flipY = false;
                    texturas.push({ id: i, map: txt });
                    if (texturas.length === 1) { lienzo.material.map = txt; lienzo.material.needsUpdate = true; }
                    if (texturas.length === metadata.frames_count) texturas.sort((a, b) => a.id - b.id);
                });
            }

            // TRANSICIÓN MÁGICA (INTENSA Y NATURAL)
            function hacerTransicionMagica(nuevaTextura) {
                const duracion = 1500;
                const inicio = performance.now();
                const mat = lienzo.material;
                const colorMagia = new THREE.Color(parseInt(metadata.glow_color || "0xffffff", 16));
                
                function animar() {
                    const t = (performance.now() - inicio) / duracion;
                    if (t >= 1) { mat.emissiveIntensity = 1.0; return; }
                    
                    // Curva de destello "mágico" (Fade-out más natural)
                    const curvaLuz = Math.sin(t * Math.PI); 
                    
                    if (!mat.emissive) mat.emissive = new THREE.Color(0x000000);
                    mat.emissive.copy(colorMagia);
                    // Intensidad 6.0 para cubrir el cambio de imagen
                    mat.emissiveIntensity = curvaLuz * 6.0; 
                    
                    if (t >= 0.5 && mat.map !== nuevaTextura) {
                        mat.map = nuevaTextura;
                        mat.emissiveMap = nuevaTextura;
                        mat.needsUpdate = true;
                    }
                    requestAnimationFrame(animar);
                }
                animar();
            }

            // ESPERAR 1 MINUTO ANTES DE INICIAR EL CICLO
            if (metadata.frames_count > 1) {
                setTimeout(() => {
                    setInterval(() => {
                        if (texturas.length === metadata.frames_count) {
                            let idx = (texturas.findIndex(t => t.map === lienzo.material.map) + 1) % texturas.length;
                            hacerTransicionMagica(texturas[idx].map);
                        }
                    }, metadata.cycle_interval);
                }, 60000); // 1 minuto de espera inicial
            }
        }

        scene.add(model);
        document.getElementById('loader-container')?.remove();
        
        // Ajuste de cámara
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        controls.target.copy(center);
        camera.position.set(center.x, center.y, center.z + (Math.max(size.x, size.y, size.z) * 0.9));
        camera.lookAt(center);
        controls.update();
    });

    // ANIMACIÓN FINAL
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
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Importaciones requeridas para el canal de Bloom cinematográfico
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

let composer; 

requestAnimationFrame(() => {
    setTimeout(inicializarVisor3D, 50);
});

// =========================================================================
// CONFIGURACIÓN POR DEFECTO Y VALORES POR RAREZA
// =========================================================================
const CONFIG_POR_DEFECTO = {
    rarity: 'common',
    framesCount: 1,         
    cycleInterval: 0,       
    colorMagia: 0x000000,   
    fuerzaBloom: 0.0,       
    colorFondo: 0x0b0b0b    
};

const CONFIGURACION_RAREZAS = {
    divine:    { colorMagia: 0xff00ff, fuerzaBloom: 6.0,  colorFondo: 0x05000a }, 
    legendary: { colorMagia: 0xffeaba, fuerzaBloom: 4.5,  colorFondo: 0x0b0b0b }, 
    epic:      { colorMagia: 0x00ffff, fuerzaBloom: 3.5,  colorFondo: 0x0b0b0b }, 
    rare:      { colorMagia: 0x00ff00, fuerzaBloom: 2.5,  colorFondo: 0x0b0b0b }, 
    common:    { colorMagia: 0x000000, fuerzaBloom: 0.0,  colorFondo: 0x0b0b0b } 
};

async function obtenerConfiguracionNFT(modelId) {
    try {
        const urlMetadatos = `metadata/nft${modelId}.json`; 
        const respuesta = await fetch(urlMetadatos);
        if (!respuesta.ok) throw new Error(`No se encontró el archivo: ${urlMetadatos}`);
        
        const metadata = await respuesta.json();
        const rarezaLimpia = metadata.rarity ? metadata.rarity.toLowerCase() : 'common';
        const estilosRareza = CONFIGURACION_RAREZAS[rarezaLimpia] || CONFIGURACION_RAREZAS['common'];

        return {
            ...CONFIG_POR_DEFECTO,
            rarity: rarezaLimpia,
            framesCount: metadata.frames_count !== undefined ? metadata.frames_count : CONFIG_POR_DEFECTO.framesCount,
            cycleInterval: metadata.cycle_interval !== undefined ? metadata.cycle_interval : CONFIG_POR_DEFECTO.cycleInterval,
            ...estilosRareza 
        };

    } catch (error) {
        console.warn(`Aviso: Usando configuración estática por defecto debido a: ${error.message}`);
        return CONFIG_POR_DEFECTO; 
    }
}

async function inicializarVisor3D() {
    const urlParams = new URLSearchParams(window.location.search);
    let modelId = urlParams.get('id') || '1';

    const configNFT = await obtenerConfiguracionNFT(modelId);
    console.log("Configuración aplicada al renderizador:", configNFT);

    const modelPath = `models/nft${modelId}.glb`;

    // ==========================================
    // CONFIGURACIÓN DEL RENDERIZADOR NATIVO
    // ==========================================
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(configNFT.colorFondo); 

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

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

    controls.addEventListener('end', resetInactivityTimer);
    startAutoRotation();

    // ==========================================
    // CANAL DE POST-PROCESAMIENTO (BLOOM)
    // ==========================================
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.25, 0.4, 0.5);
    const outputPass = new OutputPass();

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass); 
    composer.addPass(outputPass);

    // ENTORNO HDRI
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    const envScene = new THREE.Scene();
    const roomGeo = new THREE.SphereGeometry(15, 32, 16);
    const roomMat = new THREE.MeshBasicMaterial({ color: 0x444444, side: THREE.BackSide }); 
    envScene.add(new THREE.Mesh(roomGeo, roomMat));

    const studioLight1 = new THREE.Mesh(new THREE.BoxGeometry(3, 8, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    studioLight1.position.set(6, 4, 5);
    envScene.add(studioLight1);

    const studioLight2 = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 0.5), new THREE.MeshBasicMaterial({ color: 0x888888 }));
    studioLight2.position.set(-6, 6, -3);
    envScene.add(studioLight2);

    scene.environment = pmremGenerator.fromScene(envScene).texture;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35); 
    scene.add(ambientLight);

    const cameraLight = new THREE.DirectionalLight(0xffffff, 1.4); 
    cameraLight.position.set(2, 3, 4); 
    camera.add(cameraLight);
    scene.add(camera); 

    // CARGA DEL MODELO 3D
    const loader = new GLTFLoader();
    loader.setCrossOrigin('anonymous');

    loader.load(
        modelPath, 
        function (gltf) {
            const model = gltf.scene;

            const nodoLienzo = model.getObjectByName('LIENZO');
            let lienzo = null;

            if (nodoLienzo) {
                nodoLienzo.traverse((child) => {
                    if (child.isMesh && child.material) lienzo = child;
                });
            }
            
            if (lienzo && lienzo.material) {
                const textureLoader = new THREE.TextureLoader();
                const texturas = [];
                let indiceActual = -1; 

                for (let i = 1; i <= configNFT.framesCount; i++) {
                    const url = `paintings/nft${modelId}/${i}.png`;
                    const texturaCarga = textureLoader.load(url, (txt) => {
                        txt.colorSpace = THREE.SRGBColorSpace;
                        txt.flipY = false; 
                    });
                    texturas.push(texturaCarga);
                }

                // =======================================================
                // NUEVO: ANIMACIÓN ESPECTACULAR DE ENTRADA
                // =======================================================
                function iniciarEntradaMagica() {
                    const duracionEntrada = 2500; // 2.5 segundos de show
                    const inicioEntrada = performance.now();
                    
                    // Si es rareza común (fuerza 0), le damos un destello blanco leve sólo para la entrada
                    const colorMagia = configNFT.fuerzaBloom > 0 ? new THREE.Color(configNFT.colorMagia) : new THREE.Color(0xffffff);
                    const fuerzaEntrada = configNFT.fuerzaBloom > 0 ? configNFT.fuerzaBloom * 1.5 : 2.0;

                    const material = lienzo.material;
                    const emisionOriginal = material.emissive ? material.emissive.clone() : new THREE.Color(0x000000);
                    const intensidadOriginal = material.emissiveIntensity !== undefined ? material.emissiveIntensity : 0;

                    function animarEntrada() {
                        const ahora = performance.now();
                        let t = (ahora - inicioEntrada) / duracionEntrada;

                        if (t >= 1) {
                            model.rotation.y = 0; // Termina exactamente de frente
                            if (material.emissive) material.emissive.copy(emisionOriginal);
                            material.emissiveIntensity = intensidadOriginal;
                            return; // Finaliza la animación de entrada
                        }

                        // 1. ROTAR RÁPIDO Y FRENAR SUAVE (Ease-Out Cubic)
                        const easeOut = 1 - Math.pow(1 - t, 3);
                        model.rotation.y = easeOut * (Math.PI * 8); // Gira 4 vueltas completas

                        // 2. BRILLO MAGICO (Curva Senoidal: sube y baja)
                        const curvaLuz = Math.sin(t * Math.PI); // Empieza en 0, pico en 0.5, baja a 0
                        
                        if (!material.emissive) material.emissive = new THREE.Color(0x000000);
                        material.emissive.lerpColors(new THREE.Color(0x000000), colorMagia, curvaLuz);
                        material.emissiveIntensity = curvaLuz * fuerzaEntrada;
                        material.needsUpdate = true;

                        requestAnimationFrame(animarEntrada);
                    }

                    animarEntrada();
                }

                // --- TRANSICIÓN MÁGICA ORIGINAL (Se mantiene igual) ---
                function hacerTransicionMagica(nuevaTextura) {
                    if (configNFT.fuerzaBloom <= 0) {
                        lienzo.material.map = nuevaTextura;
                        lienzo.material.needsUpdate = true;
                        return;
                    }

                    const duracion = 1500; 
                    const inicio = performance.now();
                    const material = lienzo.material;

                    const emisionOriginal = material.emissive ? material.emissive.clone() : new THREE.Color(0x000000);
                    const intensidadOriginal = material.emissiveIntensity !== undefined ? material.emissiveIntensity : 0;
                    const colorMagia = new THREE.Color(configNFT.colorMagia);

                    function animarResplandor() {
                        const ahora = performance.now();
                        let t = (ahora - inicio) / duracion;

                        if (t >= 1) {
                            if (material.emissive) material.emissive.copy(emisionOriginal);
                            material.emissiveIntensity = intensidadOriginal;
                            return;
                        }

                        const curvaLuz = Math.sin(t * Math.PI);
                        if (!material.emissive) material.emissive = new THREE.Color(0x000000);
                        material.emissive.lerpColors(new THREE.Color(0x000000), colorMagia, curvaLuz);
                        material.emissiveIntensity = curvaLuz * configNFT.fuerzaBloom;

                        if (t >= 0.5 && material.map !== nuevaTextura) {
                            material.color.setHex(0xffffff); 
                            material.map = nuevaTextura;
                            material.needsUpdate = true;
                        }

                        requestAnimationFrame(animarResplandor);
                    }
                    animarResplandor();
                }

                if (configNFT.framesCount > 1 && configNFT.cycleInterval > 0) {
                    setInterval(() => {
                        if (texturas.length > 0) {
                            let nuevoIndice;
                            do {
                                nuevoIndice = Math.floor(Math.random() * texturas.length);
                            } while (nuevoIndice === indiceActual && texturas.length > 1);
                            
                            indiceActual = nuevoIndice;
                            if (texturas[indiceActual]) hacerTransicionMagica(texturas[indiceActual]);
                        }
                    }, configNFT.cycleInterval);
                }

                // Disparador condicional: Al remover el loader, iniciar giro genial
                const loaderContainer = document.getElementById('loader-container');
                if (loaderContainer) {
                    loaderContainer.style.opacity = '0';
                    setTimeout(() => {
                        loaderContainer.remove();
                        iniciarEntradaMagica(); // <-- SE LLAMA A LA ANIMACIÓN DE ENTRADA
                    }, 400);
                } else {
                    iniciarEntradaMagica();
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
            
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            
            controls.target.copy(center);
            const maxDim = Math.max(size.x, size.y, size.z);
            
            controls.minDistance = maxDim * 0.45; 
            controls.maxDistance = maxDim * 4.0; 

            camera.position.set(center.x, center.y, center.z + (maxDim * 0.9));
            camera.lookAt(center);
            controls.update();
        }, 
        function (xhr) {}, 
        function (error) {
            console.error(`Error al cargar el archivo .glb: ${modelPath}`, error);
            const textElement = document.querySelector('.loading-text');
            if (textElement) textElement.innerText = "Error al conectar al modelo";
        }
    );

    // ==========================================
    // BUCLE DE ANIMACIÓN
    // ==========================================
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
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
// INTERCEPTOR DE RAREZA (METADATA)
// ==========================================
async function arrancarVisorConRareza() {
    const urlParams = new URLSearchParams(window.location.search);
    let modelId = urlParams.get('id') || '1';

    // Valores por defecto (Fallback)
    let metadata = {
        rarity: "Common",
        frames_count: 10,
        cycle_interval: 60000,
        glow_color: "0xffeaba" // Mantiene el tono dorado original del primer código por defecto
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

// Inicializar el flujo con interceptor de datos
arrancarVisorConRareza();

function inicializarVisor3D(modelId, metadata) {
    const modelPath = `https://thehistorybehindthepainting.com/models/nft${modelId}.glb`;

    // ==========================================
    // CONFIGURACIÓN DEL RENDERIZADOR NATIVO
    // ==========================================
    const scene = new THREE.Scene();

    // Diccionario de colores de fondo dinámicos según rareza
    const coloresFondoPorRareza = {
        'common': 0x000000,     // Negro
        'rare': 0x0a2240,       // Azul
        'epic': 0x3d0c5a,       // Morado
        'legendary': 0xdfa837,  // Mostaza
        'divine': 0x8ecae6      // Celeste
    };

    const rarezaActual = (metadata.rarity || 'common').toLowerCase();
    const colorDeFondo = coloresFondoPorRareza[rarezaActual] !== undefined 
        ? coloresFondoPorRareza[rarezaActual] 
        : 0x0b0b0b; // Color gris oscuro por defecto del primer script

    scene.background = new THREE.Color(colorDeFondo);

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
    // CONFIGURACIÓN DEL CANAL DE POST-PROCESAMIENTO (BLOOM)
    // ==========================================
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.25, 0.4, 0.5);
    const outputPass = new OutputPass();

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass); 
    composer.addPass(outputPass);

    // GENERACIÓN DE ENTORNO HDRI DE ESTUDIO NEUTRO
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

    // SISTEMA DE ILUMINACIÓN VINCULADA A LA CÁMARA
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

            // ==========================================
            // SISTEMA DE CAMBIO DE PINTURAS (ANIMACIÓN MÁGICA)
            // ==========================================
            const nodoLienzo = model.getObjectByName('LIENZO');
            let lienzo = null;

            if (nodoLienzo) {
                nodoLienzo.traverse((child) => {
                    if (child.isMesh && child.material) {
                        lienzo = child;
                    }
                });
            }
            
            if (lienzo && lienzo.material) {
                const textureLoader = new THREE.TextureLoader();
                const texturas = [];
                const totalImagenes = metadata.frames_count || 1; // Dinámico por metadata
                let indiceActual = 0; 

                // Precarga ordenada e indexada de imágenes con extensión .png fija
                for (let i = 1; i <= totalImagenes; i++) {
                    const url = `https://thehistorybehindthepainting.com/paintings/nft${modelId}/${i}.png`;
                    
                    textureLoader.load(url, (txt) => {
                        txt.colorSpace = THREE.SRGBColorSpace;
                        txt.flipY = false; 
                        
                        // Guardamos estructurado para poder ordenar al final
                        texturas.push({ id: i, map: txt });

                        // Asignar inmediatamente el primer frame que cargue
                        if (texturas.length === 1) {
                            lienzo.material.map = txt;
                            lienzo.material.needsUpdate = true;
                        }

                        // Cuando se terminen de cargar todos, forzamos el orden correcto secuencial
                        if (texturas.length === totalImagenes) {
                            texturas.sort((a, b) => a.id - b.id);
                        }
                    });
                }

                // --- FUNCIÓN DE ANIMACIÓN DE RESPLANDOR ---
                function hacerTransicionMagica(nuevaTextura) {
                    const duracion = 1500; // 1.5 segundos de efecto mágico
                    const inicio = performance.now();
                    const material = lienzo.material;

                    // Respaldar las propiedades emisivas que traía de Substance Painter
                    const emisionOriginal = material.emissive ? material.emissive.clone() : new THREE.Color(0x000000);
                    const intensidadOriginal = material.emissiveIntensity !== undefined ? material.emissiveIntensity : 0;

                    // Color de la magia dinámico extraído de la metadata
                    const colorMagia = new THREE.Color(parseInt(metadata.glow_color || "0xffeaba", 16));

                    function animarResplandor() {
                        const ahora = performance.now();
                        let t = (ahora - inicio) / duracion;

                        if (t >= 1) {
                            // Fin de la animación: restaurar el estado original del material
                            if (material.emissive) material.emissive.copy(emisionOriginal);
                            material.emissiveIntensity = intensidadOriginal;
                            return;
                        }

                        // Curva en forma de campana: 0 -> 1 -> 0
                        const curvaLuz = Math.sin(t * Math.PI);

                        // Aplicar el brillo progresivamente para activar el Bloom cinematográfico
                        if (!material.emissive) material.emissive = new THREE.Color(0x000000);
                        material.emissive.lerpColors(new THREE.Color(0x000000), colorMagia, curvaLuz);
                        material.emissiveIntensity = curvaLuz * 3.5; // Mantiene el factor 3.5 para forzar el bloom cinematográfico

                        // Exactamente en el punto máximo de luz (mitad de la animación), cambiamos la foto
                        if (t >= 0.5 && material.map !== nuevaTextura) {
                            material.color.setHex(0xffffff); // Forzar blanco en el Base Color
                            material.map = nuevaTextura;
                            material.emissiveMap = nuevaTextura; // Sincroniza el mapa emisivo para un glow perfecto de la pintura
                            material.needsUpdate = true;
                        }

                        requestAnimationFrame(animarResplandor);
                    }

                    animarResplandor();
                }
                // ------------------------------------------

                // Cambio automático secuencial según el intervalo de la metadata
                if (totalImagenes > 1) {
                    setInterval(() => {
                        if (texturas.length === totalImagenes) {
                            indiceActual = (indiceActual + 1) % texturas.length;
                            hacerTransicionMagica(texturas[indiceActual].map);
                            console.log(`Transición mágica secuencial iniciada hacia frame index: ${indiceActual + 1}`);
                        }
                    }, metadata.cycle_interval); 
                }

            } else {
                console.warn('Sigue sin encontrarse el Mesh o Material válido de LIENZO.');
            }
            // ==========================================

            model.traverse((child) => {
                if (child.isMesh) {
                    const mat = child.material;
                    if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
                    
                    mat.envMapIntensity = 1.0; 
                    mat.needsUpdate = true;
                }
            });

            scene.add(model);
            
            // BORRAR EL CONTENEDOR DE CARGA
            const loaderContainer = document.getElementById('loader-container');
            if (loaderContainer) {
                loaderContainer.style.opacity = '0';
                setTimeout(() => {
                    loaderContainer.remove();
                }, 400);
            }
            
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
        function (xhr) {
            // Progreso de carga
        }, 
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
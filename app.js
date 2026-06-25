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

// --- NUEVA FUNCIÓN PARA CARGAR METADATOS ---
async function obtenerMetadatosNFT(modelId) {
    try {
        // REEMPLAZA ESTA URL por la ruta real de tu API de metadatos
        // Ejemplo esperado de JSON: { "rarity": "divine", "name": "Obra Maestra #1" }
        const urlMetadatos = `https://thehistorybehindthepainting.com/api/metadata/${modelId}`; 
        const respuesta = await fetch(urlMetadatos);
        if (!respuesta.ok) throw new Error('No se pudieron obtener los metadatos');
        const data = await respuesta.json();
        
        // Normalizamos a minúsculas para evitar errores de mayúsculas/minúsculas
        return data.rarity ? data.rarity.toLowerCase() : 'common';
    } catch (error) {
        console.warn("Error cargando metadatos, asignando rareza 'common' por defecto:", error);
        return 'common'; 
    }
}

// Convertimos la función principal a 'async' para poder usar 'await' con los metadatos
async function inicializarVisor3D() {
    const urlParams = new URLSearchParams(window.location.search);
    let modelId = urlParams.get('id') || '1';

    // 1. OBTENER RAREZA ANTES DE CONTINUAR
    const rareza = await obtenerMetadatosNFT(modelId);
    console.log(`Rareza detectada para el NFT ${modelId}: ${rareza}`);

    // ==========================================
    // CONFIGURACIÓN DE EFECTOS SEGÚN RAREZA
    // ==========================================
    // Aquí defines qué color y qué fuerza tendrá el destello "mágico" según su rareza
    const configuracionRareza = {
        divine:    { colorMagia: 0xff00ff, fuerzaBloom: 6.0,  colorFondo: 0x05000a }, // Morado místico / Fondo cósmico
        legendary: { colorMagia: 0xffeaba, fuerzaBloom: 4.5,  colorFondo: 0x0b0b0b }, // Dorado / Fondo oscuro original
        epic:      { colorMagia: 0x00ffff, fuerzaBloom: 3.5,  colorFondo: 0x0b0b0b }, // Cian eléctrico
        rare:      { colorMagia: 0x00ff00, fuerzaBloom: 2.5,  colorFondo: 0x0b0b0b }, // Verde
        common:    { colorMagia: 0xffffff, fuerzaBloom: 1.5,  colorFondo: 0x0b0b0b }  // Blanco estándar
    };

    // Si la rareza obtenida no está en la lista, usamos 'common' como respaldo
    const ajusteVisual = configuracionRareza[rareza] || configuracionRareza['common'];

    const modelPath = `https://thehistorybehindthepainting.com/models/nft${modelId}.glb`;

    // ==========================================
    // CONFIGURACIÓN DEL RENDERIZADOR NATIVO
    // ==========================================
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(ajusteVisual.colorFondo); 

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
    // Ajustamos la fuerza inicial del Bloom base un poco dependiendo de la rareza si se desea
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
                const totalImagenes = 10; 
                let indiceActual = -1; 

                // Precarga de imágenes
                for (let i = 1; i <= totalImagenes; i++) {
                    const url = `https://thehistorybehindthepainting.com/paintings/nft${modelId}/${i}.png`;
                    
                    const texturaCarga = textureLoader.load(url, (txt) => {
                        txt.colorSpace = THREE.SRGBColorSpace;
                        txt.flipY = false; 
                    });

                    texturas.push(texturaCarga);
                }

                // --- FUNCIÓN DE ANIMACIÓN DE RESPLANDOR CON RAREZA ---
                function hacerTransicionMagica(nuevaTextura) {
                    const duracion = 1500; 
                    const inicio = performance.now();
                    const material = lienzo.material;

                    const emisionOriginal = material.emissive ? material.emissive.clone() : new THREE.Color(0x000000);
                    const intensidadOriginal = material.emissiveIntensity !== undefined ? material.emissiveIntensity : 0;

                    // Usamos el color de magia configurado dinámicamente según su metadato
                    const colorMagia = new THREE.Color(ajusteVisual.colorMagia);

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
                        
                        // Usamos la fuerza de Bloom configurada dinámicamente
                        material.emissiveIntensity = curvaLuz * ajusteVisual.fuerzaBloom;

                        if (t >= 0.5 && material.map !== nuevaTextura) {
                            material.color.setHex(0xffffff); 
                            material.map = nuevaTextura;
                            material.needsUpdate = true;
                        }

                        requestAnimationFrame(animarResplandor);
                    }

                    animarResplandor();
                }

                // Cambio automático aleatorio usando la transición mágica cada 1 minuto
                setInterval(() => {
                    if (texturas.length > 0) {
                        let nuevoIndice;
                        
                        do {
                            nuevoIndice = Math.floor(Math.random() * texturas.length);
                        } while (nuevoIndice === indiceActual && texturas.length > 1);
                        
                        indiceActual = nuevoIndice;

                        if (texturas[indiceActual]) {
                            hacerTransicionMagica(texturas[indiceActual]);
                            console.log(`[Rareza: ${rareza.toUpperCase()}] Transición mágica hacia: ${indiceActual + 1}.png`);
                        }
                    }
                }, 60000); 

            } else {
                console.warn('Sigue sin encontrarse el Mesh o Material válido de LIENZO.');
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
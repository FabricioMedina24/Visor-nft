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

// =======================================================
// NUEVO: CREAR TEXTURA REDONDA PARA LAS PARTÍCULAS
// =======================================================
function crearTexturaCirculo() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    
    // Dibujar un círculo blanco con bordes difuminados suaves
    const gradiente = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradiente.addColorStop(0, 'rgba(255,255,255,1)');
    gradiente.addColorStop(0.4, 'rgba(255,255,255,0.8)');
    gradiente.addColorStop(1, 'rgba(255,255,255,0)');
    
    context.fillStyle = gradiente;
    context.fillRect(0, 0, 64, 64);
    
    return new THREE.CanvasTexture(canvas);
}

const texturaParticula = crearTexturaCirculo();

async function inicializarVisor3D() {
    const urlParams = new URLSearchParams(window.location.search);
    let modelId = urlParams.get('id') || '1';

    const configNFT = await obtenerConfiguracionNFT(modelId);

    const modelPath = `models/nft${modelId}.glb`;
    const sistemasDeParticulas = [];

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

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.25, 0.4, 0.5);
    const outputPass = new OutputPass();

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass); 
    composer.addPass(outputPass);

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
                    mat.envMapIntensity = 1.0; 
                    mat.needsUpdate = true;
                }
            });

            scene.add(model);

            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            
            controls.target.copy(center);
            controls.minDistance = maxDim * 0.45; 
            controls.maxDistance = maxDim * 4.0; 
            camera.position.set(center.x, center.y, center.z + (maxDim * 0.9));
            camera.lookAt(center);
            controls.update();

            // =======================================================
            // FUNCIÓN: CREAR PARTÍCULAS DESDE EL LIENZO
            // =======================================================
            function crearParticulas(colorHex, mallaLienzo) {
                // Obtener las dimensiones exactas únicamente del LIENZO
                const cajaLienzo = new THREE.Box3().setFromObject(mallaLienzo);
                const tamanoLienzo = cajaLienzo.getSize(new THREE.Vector3());
                const centroLienzo = cajaLienzo.getCenter(new THREE.Vector3());

                const cantidad = 100; // Un poco más de polvo mágico
                const geometria = new THREE.BufferGeometry();
                const posiciones = new Float32Array(cantidad * 3);
                const velocidades = [];

                for(let i = 0; i < cantidad; i++) {
                    // Nacen aleatoriamente esparcidas a lo ancho y alto del propio lienzo
                    posiciones[i * 3] = centroLienzo.x + (Math.random() - 0.5) * tamanoLienzo.x * 0.9; 
                    posiciones[i * 3 + 1] = centroLienzo.y + (Math.random() - 0.5) * tamanoLienzo.y * 0.9;
                    
                    // Nacen ligeramente adelante de la pintura
                    posiciones[i * 3 + 2] = centroLienzo.z + (Math.random() * 0.05) + 0.01; 

                    // Flotan hacia adelante y hacia arriba
                    velocidades.push({
                        x: (Math.random() - 0.5) * 0.003,
                        y: (Math.random() * 0.006) + 0.002, // Hacia arriba
                        z: (Math.random() * 0.008) + 0.002  // Hacia la cámara
                    });
                }

                geometria.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));

                const materialParticulas = new THREE.PointsMaterial({
                    color: colorHex,
                    size: Math.max(tamanoLienzo.x, tamanoLienzo.y) * 0.02, // Muy pequeñitas y proporcionales
                    map: texturaParticula, // ASIGNAMOS LA TEXTURA REDONDA
                    transparent: true,
                    opacity: 1,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                });

                const mallaParticulas = new THREE.Points(geometria, materialParticulas);
                
                // Agregamos las partículas al modelo en lugar de la escena, 
                // así si el modelo está rotando, el polvo nace girando con él.
                model.add(mallaParticulas);

                sistemasDeParticulas.push({
                    mesh: mallaParticulas,
                    velocidades: velocidades,
                    vida: 1.0,           
                    decaimiento: 0.005 + (Math.random() * 0.003) // Se desvanecen suavemente
                });
            }

            const nodoLienzo = model.getObjectByName('LIENZO');
            let lienzo = null;

            if (nodoLienzo) {
                nodoLienzo.traverse((child) => {
                    if (child.isMesh && child.material) lienzo = child;
                });
            }
            
            if (lienzo && lienzo.material) {
                
                lienzo.material.map = null; 
                lienzo.material.color.setHex(0x000000); 
                lienzo.material.needsUpdate = true;

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

                function iniciarEntradaMagica() {
                    const duracionEntrada = 1800; 
                    const inicioEntrada = performance.now();
                    
                    const colorMagia = configNFT.fuerzaBloom > 0 ? new THREE.Color(configNFT.colorMagia) : new THREE.Color(0xffffff);
                    const fuerzaEntrada = configNFT.fuerzaBloom > 0 ? configNFT.fuerzaBloom * 1.5 : 2.5;

                    const material = lienzo.material;
                    const emisionOriginal = material.emissive ? material.emissive.clone() : new THREE.Color(0x000000);
                    const intensidadOriginal = material.emissiveIntensity !== undefined ? material.emissiveIntensity : 0;
                    
                    let particulasGeneradas = false;

                    function animarEntrada() {
                        const ahora = performance.now();
                        let t = (ahora - inicioEntrada) / duracionEntrada;

                        if (t >= 1) {
                            model.rotation.y = 0; 
                            if (material.emissive) material.emissive.copy(emisionOriginal);
                            material.emissiveIntensity = intensidadOriginal;
                            
                            if (texturas.length > 0 && material.map !== texturas[0]) {
                                material.color.setHex(0xffffff);
                                material.map = texturas[0];
                                material.needsUpdate = true;
                                indiceActual = 0;
                            }
                            return; 
                        }

                        const easeOut = 1 - Math.pow(1 - t, 3);
                        model.rotation.y = easeOut * (Math.PI * 16); 

                        const curvaLuz = Math.sin(t * Math.PI); 
                        
                        if (!material.emissive) material.emissive = new THREE.Color(0x000000);
                        material.emissive.lerpColors(new THREE.Color(0x000000), colorMagia, curvaLuz);
                        material.emissiveIntensity = curvaLuz * fuerzaEntrada;

                        if (t >= 0.5) {
                            if (texturas.length > 0 && material.map !== texturas[0]) {
                                material.color.setHex(0xffffff);
                                material.map = texturas[0];
                                indiceActual = 0; 
                            }

                            // Disparar las partículas pasándole el "lienzo" en lugar del centro general
                            if (!particulasGeneradas) {
                                crearParticulas(colorMagia, lienzo);
                                particulasGeneradas = true;
                            }
                        }

                        material.needsUpdate = true;
                        requestAnimationFrame(animarEntrada);
                    }

                    animarEntrada();
                }

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
                    
                    let particulasGeneradas = false;

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

                        if (t >= 0.5) {
                            if (material.map !== nuevaTextura) {
                                material.color.setHex(0xffffff); 
                                material.map = nuevaTextura;
                                material.needsUpdate = true;
                            }

                            if (!particulasGeneradas) {
                                crearParticulas(colorMagia, lienzo);
                                particulasGeneradas = true;
                            }
                        }

                        requestAnimationFrame(animarResplandor);
                    }
                    animarResplandor();
                }

                if (configNFT.framesCount > 1 && configNFT.cycleInterval > 0) {
                    setInterval(() => {
                        if (texturas.length > 0 && indiceActual !== -1) {
                            let nuevoIndice;
                            do {
                                nuevoIndice = Math.floor(Math.random() * texturas.length);
                            } while (nuevoIndice === indiceActual && texturas.length > 1);
                            
                            indiceActual = nuevoIndice;
                            if (texturas[indiceActual]) hacerTransicionMagica(texturas[indiceActual]);
                        }
                    }, configNFT.cycleInterval);
                }

                const loaderContainer = document.getElementById('loader-container');
                if (loaderContainer) {
                    iniciarEntradaMagica(); 
                    loaderContainer.style.opacity = '0';
                    setTimeout(() => {
                        loaderContainer.remove();
                    }, 400); 
                } else {
                    iniciarEntradaMagica();
                }
            }
        }, 
        function (xhr) {}, 
        function (error) {
            console.error(`Error al cargar el archivo .glb: ${modelPath}`, error);
            const textElement = document.querySelector('.loading-text');
            if (textElement) textElement.innerText = "Error al conectar al modelo";
        }
    );

    // ==========================================
    // BUCLE DE ANIMACIÓN PRINCIPAL
    // ==========================================
    function animate() {
        requestAnimationFrame(animate);
        controls.update(); 
        
        for (let i = sistemasDeParticulas.length - 1; i >= 0; i--) {
            const sistema = sistemasDeParticulas[i];
            
            sistema.vida -= sistema.decaimiento;
            
            if (sistema.vida <= 0) {
                // Ahora como están atachadas al modelo, las removemos del modelo
                sistema.mesh.parent.remove(sistema.mesh);
                sistema.mesh.geometry.dispose();
                sistema.mesh.material.dispose();
                sistemasDeParticulas.splice(i, 1);
                continue;
            }

            sistema.mesh.material.opacity = Math.max(0, sistema.vida);
            
            const posiciones = sistema.mesh.geometry.attributes.position.array;
            for (let j = 0; j < sistema.velocidades.length; j++) {
                posiciones[j * 3] += sistema.velocidades[j].x;       
                posiciones[j * 3 + 1] += sistema.velocidades[j].y;   
                posiciones[j * 3 + 2] += sistema.velocidades[j].z;   
            }
            sistema.mesh.geometry.attributes.position.needsUpdate = true;
        }

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
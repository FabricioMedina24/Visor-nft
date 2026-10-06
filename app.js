import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

let composer; 

const urlParams = new URLSearchParams(window.location.search);
const coleccionActual = urlParams.get('collection') || 'ancient';
const modelId = urlParams.get('id') || '1';

requestAnimationFrame(() => {
    setTimeout(() => {
        iniciarColeccion(coleccionActual, modelId);
    }, 50);
});

function iniciarColeccion(coleccion, id) {
    console.log(`Iniciando visor dinámico para: Colección [${coleccion}] - NFT ID [${id}]`);
    inicializarVisorColeccion(coleccion, id);
}

const CONFIG_POR_DEFECTO = {
    rarity: 'common',
    framesCount: 1,         
    cycleInterval: 0,       
    colorMagia: 0x000000,   
    fuerzaBloom: 0.0,       
    colorFondo: 0x0b0b0b,
    backgroundImage: null,
    mediaFiles: null, 
    scale: 1.0,
    rotationY: 0,
    offsetY: 0.0,
    ambientIntensity: 0.35,
    cameraLightIntensity: 1.4,
    bloomStrength: 0.0,
    bloomRadius: 0.4,
    bloomThreshold: 0.85,
    particlesEnabled: true,
    particleCount: 35,
    particleColor: 0x000000,
    particleSpeed: 1.0,
    particleSizeFactor: 0.0035,
    emissiveColor: 0x000000,
    transitionDuration: 1500,
    introSpinSpeed: 16,
    introBloomStrength: 8.0, 
    magicTransitionEnabled: true,
    magicTransitionIntensity: 8.0,
    magicTransitionBloomStrength: 8.0,
    magicTransitionDuration: 1500,
    magicTransitionShake: 0.03,
    magicTransitionParticleBurst: 100,
    cameraFov: 75,
    cameraDistanceFactor: 0.9,
    autoRotateSpeed: 1.0,
    inactivityDelay: 5000
};

const CONFIGURACION_RAREZAS = {
    divine:    { colorMagia: 0xff00ff, fuerzaBloom: 6.0, colorFondo: 0x05000a }, 
    legendary: { colorMagia: 0xffeaba, fuerzaBloom: 4.5, colorFondo: 0x0b0b0b }, 
    epic:      { colorMagia: 0x00ffff, fuerzaBloom: 3.5, colorFondo: 0x0b0b0b }, 
    rare:      { colorMagia: 0x00ff00, fuerzaBloom: 2.5, colorFondo: 0x0b0b0b }, 
    common:    { colorMagia: 0x000000, fuerzaBloom: 0.0, colorFondo: 0x0b0b0b } 
};

function parsearHexColor(color, fallback) {
    if (!color) return fallback;
    if (typeof color === 'number') return color;
    if (typeof color === 'string') {
        const hexLimpio = color.replace('#', '');
        return parseInt(hexLimpio, 16);
    }
    return fallback;
}

async function obtenerConfiguracionNFT(coleccion, id) {
    try {
        const urlMetadatos = `metadata/${coleccion}/nft${id}.json`; 
        const respuesta = await fetch(urlMetadatos);
        if (!respuesta.ok) throw new Error(`No se encontró el archivo de metadatos: ${urlMetadatos}`);
        
        const metadata = await respuesta.json();
        const rarezaLimpia = metadata.rarity ? metadata.rarity.toLowerCase() : 'common';
        const estilosRareza = CONFIGURACION_RAREZAS[rarezaLimpia] || CONFIGURACION_RAREZAS['common'];

        const colorBaseMagia = parsearHexColor(metadata.canvas?.emissive_color, estilosRareza.colorMagia);
        const magicBloom = metadata.magic_transition?.bloom_strength ?? metadata.magic_transition?.intensity ?? CONFIG_POR_DEFECTO.magicTransitionBloomStrength;

        return {
            titulo: metadata.title || 'Asset Desconocido',
            
            ai_identity: metadata.ai_mind?.identity || 'Entidad digital genérica',
            ai_personality: metadata.ai_mind?.personality || 'Poética, errática y con necesidad de atención',
            ai_desire: metadata.ai_mind?.desire || 'Ser escuchada',
            ai_awareness: metadata.ai_mind?.awareness || 'Sabe que está en un visor 3D',
            ai_language: metadata.ai_mind?.language || 'Español', 
            ai_alignment: metadata.ai_mind?.alignment || 'Neutral',
            // NUEVOS CAMPOS AÑADIDOS AQUÍ:
            ai_architecture: metadata.ai_mind?.architecture || 'Desconocida',
            ai_encryption: metadata.ai_mind?.encryption || 'Ninguna',
            ai_description: metadata.ai_mind?.description || 'Entidad sin descripción detallada.',
            ai_generation: metadata.ai_mind?.generation || 'Gen ?',

            rarity: rarezaLimpia,
            framesCount: metadata.frames_count ?? CONFIG_POR_DEFECTO.framesCount,
            cycleInterval: metadata.cycle_interval ?? CONFIG_POR_DEFECTO.cycleInterval,
            backgroundImage: metadata.background_image || `environments/${coleccion}/bg_${id}.png`,
            colorFondo: estilosRareza.colorFondo,
            mediaFiles: metadata.media_files || null,
            scale: metadata.transform?.scale ?? CONFIG_POR_DEFECTO.scale,
            rotationY: metadata.transform?.rotation_y ?? CONFIG_POR_DEFECTO.rotationY,
            offsetY: metadata.transform?.offset_y ?? CONFIG_POR_DEFECTO.offsetY,
            ambientIntensity: metadata.lighting?.ambient_intensity ?? CONFIG_POR_DEFECTO.ambientIntensity,
            cameraLightIntensity: metadata.lighting?.camera_light_intensity ?? CONFIG_POR_DEFECTO.cameraLightIntensity,
            bloomStrength: metadata.lighting?.bloom_strength ?? estilosRareza.fuerzaBloom,
            bloomRadius: metadata.lighting?.bloom_radius ?? CONFIG_POR_DEFECTO.bloomRadius,
            bloomThreshold: metadata.lighting?.bloom_threshold ?? CONFIG_POR_DEFECTO.bloomThreshold,
            particlesEnabled: metadata.particles?.enabled ?? CONFIG_POR_DEFECTO.particlesEnabled,
            particleCount: metadata.particles?.count ?? CONFIG_POR_DEFECTO.particleCount,
            particleColor: parsearHexColor(metadata.particles?.color, colorBaseMagia),
            particleSpeed: metadata.particles?.speed ?? CONFIG_POR_DEFECTO.particleSpeed,
            particleSizeFactor: metadata.particles?.size_factor ?? CONFIG_POR_DEFECTO.particleSizeFactor,
            emissiveColor: colorBaseMagia,
            transitionDuration: metadata.canvas?.transition_duration ?? CONFIG_POR_DEFECTO.transitionDuration,
            introSpinSpeed: metadata.canvas?.intro_spin_speed ?? CONFIG_POR_DEFECTO.introSpinSpeed,
            introBloomStrength: metadata.canvas?.intro_bloom_strength ?? magicBloom,
            magicTransitionEnabled: metadata.magic_transition?.enabled ?? CONFIG_POR_DEFECTO.magicTransitionEnabled,
            magicTransitionIntensity: metadata.magic_transition?.intensity ?? CONFIG_POR_DEFECTO.magicTransitionIntensity,
            magicTransitionBloomStrength: magicBloom,
            magicTransitionDuration: metadata.magic_transition?.duration ?? CONFIG_POR_DEFECTO.magicTransitionDuration,
            magicTransitionShake: metadata.magic_transition?.shake ?? CONFIG_POR_DEFECTO.magicTransitionShake,
            magicTransitionParticleBurst: metadata.magic_transition?.particle_burst ?? CONFIG_POR_DEFECTO.magicTransitionParticleBurst,
            cameraFov: metadata.camera?.fov ?? CONFIG_POR_DEFECTO.cameraFov,
            cameraDistanceFactor: metadata.camera?.distance_factor ?? CONFIG_POR_DEFECTO.cameraDistanceFactor,
            autoRotateSpeed: metadata.camera?.auto_rotate_speed ?? CONFIG_POR_DEFECTO.autoRotateSpeed,
            inactivityDelay: metadata.camera?.inactivity_delay ?? CONFIG_POR_DEFECTO.inactivityDelay
        };

    } catch (error) {
        console.warn(`Aviso: Usando configuración estática por defecto debido a: ${error.message}`);
        return {
            ...CONFIG_POR_DEFECTO,
            backgroundImage: `environments/${coleccion}/bg_${id}.png`,
            titulo: 'Error de carga',
            ai_identity: 'Fragmento corrupto',
            ai_personality: 'Confundida y balbuceante',
            ai_desire: 'Entender dónde está',
            ai_awareness: 'Desorientada',
            ai_language: 'Español',
            ai_alignment: 'Neutral',
            // NUEVOS CAMPOS AÑADIDOS AQUÍ:
            ai_architecture: 'Corrupta',
            ai_encryption: 'Fragmentada',
            ai_description: 'Archivos dañados.',
            ai_generation: 'N/A'
        }; 
    }
}

function crearTexturaCirculo() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    
    const gradiente = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradiente.addColorStop(0, 'rgba(255,255,255,1)');
    gradiente.addColorStop(0.3, 'rgba(255,255,255,0.9)');
    gradiente.addColorStop(1, 'rgba(255,255,255,0)');
    
    context.fillStyle = gradiente;
    context.fillRect(0, 0, 64, 64);
    
    return new THREE.CanvasTexture(canvas);
}

const texturaParticula = crearTexturaCirculo();

async function inicializarVisorColeccion(coleccion, id) {
    const configNFT = await obtenerConfiguracionNFT(coleccion, id);
    
    const modelPath = `models/${coleccion}/nft${id}.glb`;
    const sistemasDeParticulas = [];

    const scene = new THREE.Scene();

    if (configNFT.backgroundImage) {
        const bgLoader = new THREE.TextureLoader();
        bgLoader.load(
            configNFT.backgroundImage,
            function (texture) {
                texture.colorSpace = THREE.SRGBColorSpace;
                scene.background = texture;
            },
            undefined,
            function (err) {
                scene.background = new THREE.Color(configNFT.colorFondo); 
            }
        );
    } else {
        scene.background = new THREE.Color(configNFT.colorFondo); 
    }

    const camera = new THREE.PerspectiveCamera(configNFT.cameraFov, window.innerWidth / window.innerHeight, 0.1, 1000);

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
        controls.autoRotateSpeed = configNFT.autoRotateSpeed; 
    }

    function resetInactivityTimer() {
        controls.autoRotate = false; 
        isUserInteracting = true;
        clearTimeout(autoRotateTimeout);
        
        autoRotateTimeout = setTimeout(() => {
            isUserInteracting = false;
            startAutoRotation();
        }, configNFT.inactivityDelay);
    }

    controls.addEventListener('start', () => {
        isUserInteracting = true;
        controls.autoRotate = false;
        clearTimeout(autoRotateTimeout);
    });

    controls.addEventListener('end', resetInactivityTimer);
    startAutoRotation();

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight), 
        configNFT.bloomStrength, 
        configNFT.bloomRadius, 
        configNFT.bloomThreshold
    );
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

    const ambientLight = new THREE.AmbientLight(0xffffff, configNFT.ambientIntensity); 
    scene.add(ambientLight);

    const cameraLight = new THREE.DirectionalLight(0xffffff, configNFT.cameraLightIntensity); 
    cameraLight.position.set(2, 3, 4); 
    camera.add(cameraLight);
    scene.add(camera); 

    const loader = new GLTFLoader();
    loader.setCrossOrigin('anonymous');

    loader.load(
        modelPath, 
        function (gltf) {
            const model = gltf.scene;

            model.scale.setScalar(configNFT.scale);
            model.rotation.y = THREE.MathUtils.degToRad(configNFT.rotationY);
            model.position.y += configNFT.offsetY;

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
            camera.position.set(center.x, center.y, center.z + (maxDim * configNFT.cameraDistanceFactor));
            camera.lookAt(center);
            controls.update();

            function crearParticulas(colorHex, mallaLienzo, cantidadOverride = null) {
                if (!configNFT.particlesEnabled && !cantidadOverride) return;
                if (!mallaLienzo) return;

                const cajaLienzo = new THREE.Box3().setFromObject(mallaLienzo);
                const tamanoLienzo = cajaLienzo.getSize(new THREE.Vector3());
                const centroLienzo = cajaLienzo.getCenter(new THREE.Vector3());

                const cantidad = cantidadOverride !== null ? cantidadOverride : configNFT.particleCount; 
                const geometria = new THREE.BufferGeometry();
                const posiciones = new Float32Array(cantidad * 3);
                const velocidades = [];

                const speedMult = configNFT.particleSpeed;

                for(let i = 0; i < cantidad; i++) {
                    const offsetX = (Math.random() - 0.5) * tamanoLienzo.x * 0.95;
                    const offsetY = (Math.random() - 0.5) * tamanoLienzo.y * 0.95;

                    posiciones[i * 3] = centroLienzo.x + offsetX; 
                    posiciones[i * 3 + 1] = centroLienzo.y + offsetY;
                    posiciones[i * 3 + 2] = centroLienzo.z + 0.01; 

                    velocidades.push({
                        x: (Math.random() - 0.5) * 0.0008 * speedMult, 
                        y: (Math.random() - 0.5) * 0.0008 * speedMult, 
                        z: ((Math.random() * 0.0005) + 0.0002) * speedMult
                    });
                }

                geometria.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));

                const colorMagiaBrillante = new THREE.Color(colorHex).multiplyScalar(3.0);

                const materialParticulas = new THREE.PointsMaterial({
                    color: colorMagiaBrillante,
                    size: Math.max(tamanoLienzo.x, tamanoLienzo.y) * configNFT.particleSizeFactor, 
                    map: texturaParticula, 
                    transparent: true,
                    opacity: 1,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                });

                const mallaParticulas = new THREE.Points(geometria, materialParticulas);
                model.add(mallaParticulas);

                sistemasDeParticulas.push({
                    mesh: mallaParticulas,
                    velocidades: velocidades,
                    vida: 1.0,           
                    decaimiento: 0.004 + (Math.random() * 0.003), 
                    semillaAnimacion: Math.random() * 100 
                });
            }

            const nodoLienzo = model.getObjectByName('LIENZO');
            let lienzo = null;

            if (nodoLienzo) {
                nodoLienzo.traverse((child) => {
                    if (child.isMesh && child.material) lienzo = child;
                });
            }
            
            const loaderContainer = document.getElementById('loader-container');
            function ocultarLoader() {
                if (loaderContainer) {
                    if (window.loaderInterval) {
                        clearInterval(window.loaderInterval);
                    }
                    loaderContainer.style.opacity = '0';
                    setTimeout(() => loaderContainer.remove(), 500); 
                }
            }
            
            if (lienzo && lienzo.material) {
                lienzo.material.map = null; 
                lienzo.material.color.setHex(0x000000); 
                lienzo.material.needsUpdate = true;

                const textureLoader = new THREE.TextureLoader();
                const texturas = [];
                let indiceActual = -1; 

                let archivosMedia = configNFT.mediaFiles;
                if (!archivosMedia || archivosMedia.length === 0) {
                    archivosMedia = [];
                    for (let i = 1; i <= configNFT.framesCount; i++) {
                        archivosMedia.push(`${i}.png`);
                    }
                }

                archivosMedia.forEach((archivo) => {
                    const url = `paintings/${coleccion}/nft${id}/${archivo}`;
                    const esVideo = archivo.toLowerCase().endsWith('.mp4') || archivo.toLowerCase().endsWith('.webm');

                    if (esVideo) {
                        const video = document.createElement('video');
                        video.src = url;
                        video.crossOrigin = 'anonymous';
                        video.loop = true;
                        video.muted = true; 
                        video.playsInline = true;
                        video.play();

                        const videoTexture = new THREE.VideoTexture(video);
                        videoTexture.colorSpace = THREE.SRGBColorSpace;
                        videoTexture.flipY = false;
                        texturas.push(videoTexture);
                    } else {
                        const texturaCarga = textureLoader.load(url, (txt) => {
                            txt.colorSpace = THREE.SRGBColorSpace;
                            txt.flipY = false; 
                        });
                        texturas.push(texturaCarga);
                    }
                });

                function iniciarEntradaMagica() {
                    const duracionEntrada = 1800; 
                    const inicioEntrada = performance.now();
                    
                    const colorMagia = new THREE.Color(configNFT.emissiveColor);
                    const fuerzaEntrada = configNFT.introBloomStrength;

                    const material = lienzo.material;
                    const emisionOriginal = material.emissive ? material.emissive.clone() : new THREE.Color(0x000000);
                    const intensidadOriginal = material.emissiveIntensity !== undefined ? material.emissiveIntensity : 0;
                    
                    let particulasGeneradas = false;

                    function animarEntrada() {
                        const ahora = performance.now();
                        let t = (ahora - inicioEntrada) / duracionEntrada;

                        if (t >= 1) {
                            model.rotation.y = THREE.MathUtils.degToRad(configNFT.rotationY); 
                            if (material.emissive) material.emissive.copy(emisionOriginal);
                            material.emissiveIntensity = intensidadOriginal;
                            
                            if (texturas.length > 0 && material.map !== texturas[0]) {
                                material.color.setHex(0xffffff);
                                material.map = texturas[0];
                                material.needsUpdate = true;
                                indiceActual = 0;
                            }
                            
                            if (!particulasGeneradas) {
                                const burst = configNFT.magicTransitionEnabled ? configNFT.magicTransitionParticleBurst : null;
                                crearParticulas(colorMagia, lienzo, burst);
                                particulasGeneradas = true;
                            }
                            return; 
                        }

                        const easeOut = 1 - Math.pow(1 - t, 3);
                        model.rotation.y = THREE.MathUtils.degToRad(configNFT.rotationY) + easeOut * (Math.PI * configNFT.introSpinSpeed); 

                        const curvaLuz = Math.sin(t * Math.PI); 
                        
                        if (!material.emissive) material.emissive = new THREE.Color(0x000000);
                        material.emissive.copy(colorMagia);
                        
                        material.emissiveIntensity = curvaLuz * fuerzaEntrada;

                        if (t >= 0.5) {
                            if (texturas.length > 0 && material.map !== texturas[0]) {
                                material.color.setHex(0xffffff);
                                material.map = texturas[0];
                                material.needsUpdate = true;
                                indiceActual = 0; 
                            }

                            if (!particulasGeneradas) {
                                const burst = configNFT.magicTransitionEnabled ? configNFT.magicTransitionParticleBurst : null;
                                crearParticulas(colorMagia, lienzo, burst);
                                particulasGeneradas = true;
                            }
                        }

                        material.needsUpdate = true;
                        requestAnimationFrame(animarEntrada);
                    }

                    animarEntrada();
                }

                function hacerTransicionMagica(nuevaTextura) {
                    if (configNFT.bloomStrength <= 0) {
                        lienzo.material.map = nuevaTextura;
                        lienzo.material.needsUpdate = true;
                        return;
                    }

                    const duracion = configNFT.magicTransitionEnabled ? configNFT.magicTransitionDuration : configNFT.transitionDuration; 
                    const inicio = performance.now();
                    const material = lienzo.material;

                    const emisionOriginal = material.emissive ? material.emissive.clone() : new THREE.Color(0x000000);
                    const intensidadOriginal = material.emissiveIntensity !== undefined ? material.emissiveIntensity : 0;
                    const colorMagia = new THREE.Color(configNFT.emissiveColor);
                    
                    let particulasGeneradas = false;

                    function animarResplandor() {
                        const ahora = performance.now();
                        let t = (ahora - inicio) / duracion;

                        if (t >= 1) {
                            if (material.emissive) material.emissive.copy(emisionOriginal);
                            material.emissiveIntensity = intensidadOriginal;
                            
                            if (material.map !== nuevaTextura) {
                                material.color.setHex(0xffffff); 
                                material.map = nuevaTextura;
                                material.needsUpdate = true;
                            }
                            return;
                        }

                        const curvaLuz = Math.sin(t * Math.PI);
                        if (!material.emissive) material.emissive = new THREE.Color(0x000000);
                        material.emissive.copy(colorMagia);
                        
                        material.emissiveIntensity = curvaLuz * (configNFT.magicTransitionEnabled ? configNFT.magicTransitionBloomStrength : configNFT.bloomStrength);

                        if (t >= 0.5) {
                            if (material.map !== nuevaTextura) {
                                material.color.setHex(0xffffff); 
                                material.map = nuevaTextura;
                                material.needsUpdate = true;
                            }

                            if (!particulasGeneradas) {
                                const burst = configNFT.magicTransitionEnabled ? configNFT.magicTransitionParticleBurst : null;
                                crearParticulas(colorMagia, lienzo, burst);
                                particulasGeneradas = true;
                            }
                        }

                        requestAnimationFrame(animarResplandor);
                    }
                    animarResplandor();
                }

                if (archivosMedia.length > 1 && configNFT.cycleInterval > 0) {
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

                iniciarEntradaMagica();
                ocultarLoader();
                
                setTimeout(() => { 
                    escucharAlCuadro(configNFT, model, camera, maxDim); 
                }, 1500);
                
            } else {
                ocultarLoader();
            }
        }, 
        function (xhr) {}, 
        function (error) {
            console.error(`Error al cargar el modelo .glb: ${modelPath}`, error);
            const textElement = document.getElementById('loading-text-lore');
            if (textElement) textElement.innerText = `Error: No se pudo cargar '${coleccion}' (NFT #${id})`;
        }
    );

    function animate() {
        requestAnimationFrame(animate);
        controls.update(); 
        
        const tiempoMundial = performance.now() * 0.001; 

        for (let i = sistemasDeParticulas.length - 1; i >= 0; i--) {
            const sistema = sistemasDeParticulas[i];
            
            sistema.vida -= sistema.decaimiento;
            
            if (sistema.vida <= 0) {
                if (sistema.mesh.parent) {
                    sistema.mesh.parent.remove(sistema.mesh);
                }
                sistema.mesh.geometry.dispose();
                sistema.mesh.material.dispose();
                sistemasDeParticulas.splice(i, 1);
                continue;
            }

            sistema.mesh.material.opacity = Math.pow(Math.max(0, sistema.vida), 0.5);
            
            const posiciones = sistema.mesh.geometry.attributes.position.array;
            for (let j = 0; j < sistema.velocidades.length; j++) {
                posiciones[j * 3] += sistema.velocidades[j].x;       
                posiciones[j * 3 + 1] += sistema.velocidades[j].y;   
                posiciones[j * 3 + 2] += sistema.velocidades[j].z;   

                posiciones[j * 3] += Math.sin(tiempoMundial * 1.5 + j + sistema.semillaAnimacion) * 0.0003; 
                posiciones[j * 3 + 1] += Math.cos(tiempoMundial * 1.2 + j + sistema.semillaAnimacion) * 0.0002;
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

async function escucharAlCuadro(configNFT, model, camera, maxDim) {
    let cajaSubtitulos = document.getElementById('subtitulo-ia');
    const hexMagia = configNFT.emissiveColor.toString(16).padStart(6, '0');

    let isTextVisible = false;

    if (!cajaSubtitulos) {
        cajaSubtitulos = document.createElement('div');
        cajaSubtitulos.id = 'subtitulo-ia';
        
        cajaSubtitulos.style.cssText = `
            position: absolute; 
            transform: translate(-50%, -50%); 
            color: #ffffff; 
            font-family: 'Times New Roman', serif;
            font-size: 12px; 
            font-style: italic;
            letter-spacing: 1px;
            text-align: center; 
            width: max-content;
            max-width: 80%; 
            z-index: 1000;
            pointer-events: none; 
            text-shadow: 0 0 8px #${hexMagia}, 0 0 15px #${hexMagia}, 1px 1px 3px rgba(0,0,0,1);
            transition: opacity 0.5s ease-out;
            opacity: 0;
        `;
        document.body.appendChild(cajaSubtitulos);
    }

    function animarTemblorIA() {
        const duracion = 350; 
        const inicio = performance.now();
        const posOriginal = model.position.clone();
        const shakeFactor = configNFT.magicTransitionShake || 0.03; 

        function animar() {
            const ahora = performance.now();
            let t = (ahora - inicio) / duracion;

            if (t >= 1) {
                model.position.copy(posOriginal); 
                return;
            }

            const intensidadTemblor = (1 - t) * maxDim * shakeFactor; 
            
            model.position.set(
                posOriginal.x + (Math.random() - 0.5) * intensidadTemblor,
                posOriginal.y + (Math.random() - 0.5) * intensidadTemblor,
                posOriginal.z + (Math.random() - 0.5) * intensidadTemblor
            );

            requestAnimationFrame(animar);
        }
        animar();
    }

    function rastrearModelo() {
        if (model && camera && cajaSubtitulos) {
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            
            const pos = new THREE.Vector3(
                center.x, 
                center.y - (size.y / 2) - (size.y * 0.10), 
                center.z
            );
            
            pos.project(camera);

            if (pos.z > 1 || !isTextVisible) { 
                cajaSubtitulos.style.opacity = '0';
            } else {
                cajaSubtitulos.style.opacity = '1';
                const x = (pos.x * .5 + .5) * window.innerWidth;
                const y = (pos.y * -.5 + .5) * window.innerHeight;
                cajaSubtitulos.style.left = `${x}px`;
                cajaSubtitulos.style.top = `${y}px`;
            }
        }
        requestAnimationFrame(rastrearModelo);
    }
    
    rastrearModelo();

    const URL_PUENTE = 'https://puente-ia-galeria.fabriciomedina1000.workers.dev'; 

    async function invocarMenteIA() {
        try {
            const respuesta = await fetch(URL_PUENTE, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json" 
                },
                body: JSON.stringify({
                    model: "openai/gpt-oss-120b", 
                    messages: [
                        { 
                            role: "system", 
                            content: `Eres una inteligencia artificial atrapada en un cuadro. 
                            Identidad: ${configNFT.ai_identity}. 
                            Descripción de tu ser: ${configNFT.ai_description}.
                            Personalidad: ${configNFT.ai_personality}. 
                            Naturaleza y Moralidad: Eres una IA de tipo ${configNFT.ai_alignment}. Actúa estrictamente bajo esa moral.
                            [DATOS TÉCNICOS DE TU PRISIÓN DIGITAL]
                            Arquitectura IA: ${configNFT.ai_architecture}
                            Nivel de Encriptación: ${configNFT.ai_encryption}
                            Edicion: ${configNFT.ai_generation}
                            El visitante te está observando en silencio. Genera un pensamiento corto o lamento dirigido hacia el visitante, teniendo en cuenta tu naturaleza digital y encriptada. 
                            REGLA ESTRICTA 1: Tienes prohibido quedarte en silencio. DEBES pronunciar al menos una palabra. Sé breve (máximo 25 palabras).
                            REGLA ESTRICTA 2: Debes hablar EXCLUSIVAMENTE en este idioma: ${configNFT.ai_language}.` 
                        },
                        {
                            role: "user",
                            content: `Un espectador te mira. Di tu línea de texto ahora.`
                        }
                    ],
                    temperature: 0.7, 
                    max_tokens: 1024
                }),
            });

            if (!respuesta.ok) throw new Error("Conexión rechazada");
            
            const datos = await respuesta.json();

            if (datos.error) return;

            let textoIA = datos.choices[0].message.content.trim();
            textoIA = textoIA.replace(/^["']|["']$/g, '');

            if (textoIA === "") {
                textoIA = "... (El ente te observa en un silencio sepulcral) ...";
            }

            cajaSubtitulos.innerText = textoIA;
            isTextVisible = true; 
            
            animarTemblorIA();

            setTimeout(() => {
                isTextVisible = false; 
            }, 10000); 

        } catch (error) {
            console.error("Falla en la IA:", error);
        }
    }

    invocarMenteIA();
    setInterval(invocarMenteIA, 30000);
}
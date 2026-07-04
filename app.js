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
// CREAR TEXTURA REDONDA PARA LAS PARTÍCULAS
// =======================================================
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
    
    // =======================================================
    // NUEVO: BLOOM PASS DINÁMICO
    // =======================================================
    const fuerzaBloomGlobal = configNFT.fuerzaBloom > 0 ? (configNFT.fuerzaBloom * 0.25) + 0.5 : 0.8;
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight), 
        fuerzaBloomGlobal, // Fuerza que escala con la rareza
        0.6,               // Radio más amplio
        0.15               // Threshold reducido para atrapar el resplandor
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
            // FUNCIÓN: POLVO MÁGICO QUE SE QUEDA CERCA DEL CUADRO
            // =======================================================
            function crearParticulas(colorHex, mallaLienzo) {
                const cajaLienzo = new THREE.Box3().setFromObject(mallaLienzo);
                const tamanoLienzo = cajaLienzo.getSize(new THREE.Vector3());
                const centroLienzo = cajaLienzo.getCenter(new THREE.Vector3());

                const cantidad = 35; // Se mantienen pocas partículas
                const geometria = new THREE.BufferGeometry();
                const posiciones = new Float32Array(cantidad * 3);
                const velocidades = [];

                for(let i = 0; i < cantidad; i++) {
                    const offsetX = (Math.random() - 0.5) * tamanoLienzo.x * 0.95;
                    const offsetY = (Math.random() - 0.5) * tamanoLienzo.y * 0.95;

                    posiciones[i * 3] = centroLienzo.x + offsetX; 
                    posiciones[i * 3 + 1] = centroLienzo.y + offsetY;
                    posiciones[i * 3 + 2] = centroLienzo.z + 0.01; // Nacen muy pegadas al lienzo

                    // VELOCIDAD EXTREMADAMENTE BAJA
                    velocidades.push({
                        x: (Math.random() - 0.5) * 0.0008, 
                        y: (Math.random() - 0.5) * 0.0008, 
                        z: (Math.random() * 0.0005) + 0.0002 
                    });
                }

                geometria.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));

                const colorMagiaBrillante = new THREE.Color(colorHex).multiplyScalar(3.0);

                const materialParticulas = new THREE.PointsMaterial({
                    color: colorMagiaBrillante,
                    size: Math.max(tamanoLienzo.x, tamanoLienzo.y) * 0.0035, 
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
            
            if (lienzo && lienzo.material) {
                
                // =======================================================
                // NUEVO: FORZAR MESH STANDARD MATERIAL PARA SOPORTE EMISIVO
                // =======================================================
                if (!lienzo.material.isMeshStandardMaterial) {
                    const materialAnterior = lienzo.material;
                    lienzo.material = new THREE.MeshStandardMaterial({
                        map: materialAnterior.map,
                        color: materialAnterior.color,
                        roughness: 0.5,
                        metalness: 0.1
                    });
                }

                // Inicializamos las propiedades emisivas limpias
                lienzo.material.emissive = new THREE.Color(0x000000);
                lienzo.material.emissiveIntensity = 0;
                
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

                // =======================================================
                // TRANSICIÓN CON TEMBLOR INTENSO Y AURA
                // =======================================================
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

                    const posOriginal = model.position.clone();

                    function animarResplandor() {
                        const ahora = performance.now();
                        let t = (ahora - inicio) / duracion;

                        if (t >= 1) {
                            model.position.copy(posOriginal); 
                            if (material.emissive) material.emissive.copy(emisionOriginal);
                            material.emissiveIntensity = intensidadOriginal;
                            return;
                        }

                        const curvaLuz = Math.sin(t * Math.PI);
                        if (!material.emissive) material.emissive = new THREE.Color(0x000000);
                        material.emissive.lerpColors(new THREE.Color(0x000000), colorMagia, curvaLuz);
                        material.emissiveIntensity = curvaLuz * configNFT.fuerzaBloom;

                        if (t < 0.5) {
                            const intensidadTemblor = Math.pow(t / 0.5, 2) * maxDim * 0.03; 
                            
                            model.position.set(
                                posOriginal.x + (Math.random() - 0.5) * intensidadTemblor,
                                posOriginal.y + (Math.random() - 0.5) * intensidadTemblor,
                                posOriginal.z + (Math.random() - 0.5) * intensidadTemblor
                            );
                        } else {
                            model.position.copy(posOriginal);
                        }

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
        
        const tiempoMundial = performance.now() * 0.001; 

        for (let i = sistemasDeParticulas.length - 1; i >= 0; i--) {
            const sistema = sistemasDeParticulas[i];
            
            sistema.vida -= sistema.decaimiento;
            
            if (sistema.vida <= 0) {
                sistema.mesh.parent.remove(sistema.mesh);
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

                // Este es el movimiento que las hace titilar (ahora es el movimiento principal, ya que la velocidad es muy baja)
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
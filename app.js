import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Importaciones requeridas para el canal de Bloom cinematográfico
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

let composer; // Variable global para el motor de efectos
let sparkles, sparkleGeometry; // NUEVO: Variables para el sistema de partículas
let sparkleOpacities = [];    // NUEVO: Almacenará el estado de titileo (opacidad individual) de cada estrella

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
    scene.background = new THREE.Color(0x0b0b0b); // Un negro un poco más profundo para resaltar el Bloom

    // AJUSTE: near aumentado a 0.1 para evitar clipping (cámara atravesando geometría)
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: false,
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);

    renderer.toneMapping = THREE.ACESFilmicToneMapping; 
    renderer.toneMappingExposure = 1.15; // Ajustado levemente para balancear el brillo del Bloom
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
    
    // Configuración calibrada (Sutil para evitar el aspecto cuadrado)
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.25, 0.4, 0.5);
    
    const outputPass = new OutputPass();

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass); // Inyectamos el filtro de resplandor dorado
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

            model.traverse((child) => {
                if (child.isMesh) {
                    const mat = child.material;
                    if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
                    
                    mat.envMapIntensity = 1.0; // Reducido para mayor sutileza
                    mat.needsUpdate = true;
                }
            });

            scene.add(model);
            
            // BORRAR EL CONTENEDOR DEL ANILLO DE CARGA DE FORMA SUAVE
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

            // ==========================================
            // NUEVO: CREACIÓN DE PARTÍCULAS (ESTRELLITAS) EN EL MARCO
            // ==========================================
            const particleCount = 60; // Número de brillos repartidos por el marco
            sparkleGeometry = new THREE.BufferGeometry();
            const positions = new Float32Array(particleCount * 3);
            const colors = new Float32Array(particleCount * 3);

            // Coordenadas calculadas dinámicamente con los límites frontales del cuadro + un leve offset
            const minX = center.x - size.x / 2 - 0.01;
            const maxX = center.x + size.x / 2 + 0.01;
            const minY = center.y - size.y / 2 - 0.01;
            const maxY = center.y + size.y / 2 + 0.01;
            const frontZ = center.z + size.z / 2 + 0.02; // Al frente para evitar que se metan en el lienzo

            for (let i = 0; i < particleCount; i++) {
                const edge = i % 4; // Distribución matemática entre los 4 bordes del marco
                let x, y;
                const pct = Math.random();

                if (edge === 0) { // Marco Superior
                    x = minX + (maxX - minX) * pct;
                    y = maxY;
                } else if (edge === 1) { // Marco Inferior
                    x = minX + (maxX - minX) * pct;
                    y = minY;
                } else if (edge === 2) { // Marco Izquierdo
                    x = minX;
                    y = minY + (maxY - minY) * pct;
                } else { // Marco Derecho
                    x = maxX;
                    y = minY + (maxY - minY) * pct;
                }

                positions[i * 3] = x;
                positions[i * 3 + 1] = y;
                positions[i * 3 + 2] = frontZ;

                // Color base (Blanco cálido/dorado para reaccionar al Bloom)
                colors[i * 3] = 1.0;     // R
                colors[i * 3 + 1] = 0.95;  // G
                colors[i * 3 + 2] = 0.85;  // B

                // Parámetros de animación individuales (Titileo asíncrono)
                sparkleOpacities.push({
                    current: Math.random(),
                    speed: 0.015 + Math.random() * 0.035, // Velocidad asíncrona elegante
                    growing: Math.random() > 0.5
                });
            }

            sparkleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            sparkleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

            const sparkleMaterial = new THREE.PointsMaterial({
                size: 0.07, // Escala de los brillos. Modificar si se ven muy grandes/chicos
                vertexColors: true,
                transparent: true,
                blending: THREE.AdditiveBlending, // Suma luces ideal para efectos luminiscentes
                depthWrite: false
            });

            sparkles = new THREE.Points(sparkleGeometry, sparkleMaterial);
            scene.add(sparkles);
            // ==========================================
            
            controls.target.copy(center);
            const maxDim = Math.max(size.x, size.y, size.z);
            
            // MODIFICADO: minDistance intermedio para permitir un zoom más cercano por parte del usuario
            controls.minDistance = maxDim * 0.45; 
            controls.maxDistance = maxDim * 4.0; 

            // MODIFICADO: Ajuste intermedio (0.9). El modelo se verá más grande y cerca al iniciar sin recortarse.
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
    // BUCLE DE ANIMACIÓN UTILIZANDO COMPOSER
    // ==========================================
    function animate() {
        requestAnimationFrame(animate);
        controls.update(); 
        
        // NUEVO: Lógica de actualización de animación para el titileo (Prender y Apagar)
        if (sparkles && sparkleGeometry) {
            const colorAttribute = sparkleGeometry.attributes.color;
            
            for (let i = 0; i < sparkleOpacities.length; i++) {
                const data = sparkleOpacities[i];
                
                if (data.growing) {
                    data.current += data.speed;
                    if (data.current >= 1.0) data.growing = false;
                } else {
                    data.current -= data.speed;
                    if (data.current <= 0.1) data.growing = true;
                }

                // Atenuamos/Multiplicamos los canales de color en base al ciclo actual de opacidad
                colorAttribute.setXYZ(
                    i, 
                    1.0 * data.current,  
                    0.95 * data.current, 
                    0.85 * data.current
                );
            }
            colorAttribute.needsUpdate = true; // Forzar renderizado de nuevos colores en la GPU
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
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Importaciones requeridas para el canal de Bloom cinematográfico
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

let composer; 
let sparkles, sparkleGeometry; 
let sparkleOpacities = [];    

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
    scene.background = new THREE.Color(0x0b0b0b); 

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
    // CONFIGURACIÓN DEL CANAL DE BLOOM DETALLADO Y SUTIL
    // ==========================================
    const renderScene = new RenderPass(scene, camera);
    
    // REDUCIDO: Fuerza del bloom rebajada (0.15) y radio ultra ajustado (0.1) 
    // Esto genera un resplandor micro-fino y elegante que no invade la escena.
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight), 
        0.15, // Fuerza (strength)
        0.10, // Radio del brillo (radius)
        0.65  // Umbral de activación (threshold)
    );
    
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

    // TEXTURA DE ESTRELLA ESTILO DESTELLO FINO (Con centro nítido y cruz suave)
    function createElegantSparkleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // Fondo transparente
        ctx.clearRect(0, 0, 64, 64);

        // Destello central suave
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 16);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(255, 245, 220, 0.8)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(32, 32, 16, 0, Math.PI * 2);
        ctx.fill();

        // Finas líneas en cruz para simular un destello de joya/diamante aristocrático
        const glowGradientH = ctx.createLinearGradient(16, 32, 48, 32);
        glowGradientH.addColorStop(0, 'rgba(0,0,0,0)');
        glowGradientH.addColorStop(0.5, 'rgba(255,250,230,0.6)');
        glowGradientH.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = glowGradientH;
        ctx.fillRect(16, 31.5, 32, 1); // Línea horizontal ultra fina

        const glowGradientV = ctx.createLinearGradient(32, 16, 32, 48);
        glowGradientV.addColorStop(0, 'rgba(0,0,0,0)');
        glowGradientV.addColorStop(0.5, 'rgba(255,250,230,0.6)');
        glowGradientV.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = glowGradientV;
        ctx.fillRect(31.5, 16, 1, 32); // Línea vertical ultra fina

        return new THREE.CanvasTexture(canvas);
    }
    const sparkleTexture = createElegantSparkleTexture();

    // CARGA DEL MODELO 3D
    const loader = new GLTFLoader();
    loader.setCrossOrigin('anonymous');

    loader.load(
        modelPath, 
        function (gltf) {
            const model = gltf.scene;
            const validPositions = [];

            model.traverse((child) => {
                if (child.isMesh) {
                    const mat = child.material;
                    if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
                    
                    mat.envMapIntensity = 1.0; 
                    mat.needsUpdate = true;

                    const positionAttribute = child.geometry.attributes.position;
                    if (positionAttribute) {
                        const tempV = new THREE.Vector3();
                        // Ajuste del paso (i += 60): reduce la cantidad de puntos flotantes simultáneos
                        for (let i = 0; i < positionAttribute.count; i += 60) {
                            tempV.fromBufferAttribute(positionAttribute, i);
                            child.localToWorld(tempV);
                            
                            // Ajustado a +0.005 para que repose de forma perfecta y elegante sobre la superficie del oro
                            validPositions.push(tempV.x, tempV.y, tempV.z + 0.005); 
                        }
                    }
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

            // ==========================================
            // CONFIGURACIÓN DE PUNTOS MICRO-DESTELLANTES
            // ==========================================
            if (validPositions.length > 0) {
                sparkleGeometry = new THREE.BufferGeometry();
                const positions = new Float32Array(validPositions);
                const colors = new Float32Array(validPositions.length);

                for (let i = 0; i < validPositions.length / 3; i++) {
                    colors[i * 3] = 1.0;     
                    colors[i * 3 + 1] = 0.98;  
                    colors[i * 3 + 2] = 0.90;  

                    sparkleOpacities.push({
                        current: Math.random(),
                        speed: 0.008 + Math.random() * 0.015, // Titileo pausado, lento y sofisticado
                        growing: Math.random() > 0.5
                    });
                }

                sparkleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                sparkleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

                const sparkleMaterial = new THREE.PointsMaterial({
                    size: 0.035, // REDUCIDO ADREDE: Tamaño minúsculo para que luzcan como sutiles diamantes refractando luz
                    vertexColors: true,
                    transparent: true,
                    map: sparkleTexture, 
                    blending: THREE.AdditiveBlending, 
                    depthWrite: false
                });

                sparkles = new THREE.Points(sparkleGeometry, sparkleMaterial);
                scene.add(sparkles);
            }
            // ==========================================
            
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
    // BUCLE DE ANIMACIÓN UTILIZANDO COMPOSER
    // ==========================================
    function animate() {
        requestAnimationFrame(animate);
        controls.update(); 
        
        // Transición de opacidad balanceada
        if (sparkles && sparkleGeometry) {
            const colorAttribute = sparkleGeometry.attributes.color;
            
            for (let i = 0; i < sparkleOpacities.length; i++) {
                const data = sparkleOpacities[i];
                
                if (data.growing) {
                    data.current += data.speed;
                    if (data.current >= 0.85) data.growing = false; // Tope máximo de brillo reducido para control
                } else {
                    data.current -= data.speed;
                    if (data.current <= 0.05) data.growing = true;
                }

                colorAttribute.setXYZ(
                    i, 
                    1.0 * data.current,  
                    0.98 * data.current, 
                    0.90 * data.current
                );
            }
            colorAttribute.needsUpdate = true; 
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
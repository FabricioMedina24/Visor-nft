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
    // CONFIGURACIÓN DEL CANAL DE BLOOM ULTRA-SUTIL Y FINO
    // ==========================================
    const renderScene = new RenderPass(scene, camera);
    
    // CALIBRACIÓN CRÍTICA: Se redujo el radio a 0.08 y la intensidad a 0.12 para evitar destellos gigantes
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight), 
        0.12,  // Fuerza (strength) - Resplandor sutil
        0.08,  // Radio (radius) - Ultra concentrado en la punta de la estrella
        0.75   // Umbral (threshold) - Solo brillan los pixeles más puros
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

    // TEXTURA DE ESTRELLA ESTILO DESTELLO MICRO-FINO
    function createTrueSparkleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, 64, 64);

        const cx = 32;
        const cy = 32;

        // Geometría cóncava más pronunciada para que las puntas de las estrellas sean delgadísimas
        ctx.beginPath();
        ctx.moveTo(cx, cy - 28);
        ctx.quadraticCurveTo(cx, cy, cx + 28, cy);
        ctx.quadraticCurveTo(cx, cy, cx, cy + 28);
        ctx.quadraticCurveTo(cx, cy, cx - 28, cy);
        ctx.quadraticCurveTo(cx, cy, cx, cy - 28);
        ctx.closePath();

        // Degradado de luz concentrado en el puro centro
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        gradient.addColorStop(0.12, 'rgba(255, 252, 240, 0.85)');
        gradient.addColorStop(0.35, 'rgba(245, 220, 150, 0.15)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.fill();

        // Núcleo brillante micro central
        const coreGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 3);
        coreGradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        coreGradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();

        return new THREE.CanvasTexture(canvas);
    }
    const sparkleTexture = createTrueSparkleTexture();

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
                        // i += 85: Aumentamos el salto para tener menos cantidad de destellos dispersos, haciéndolo más exclusivo
                        for (let i = 0; i < positionAttribute.count; i += 85) {
                            tempV.fromBufferAttribute(positionAttribute, i);
                            child.localToWorld(tempV);
                            
                            // Ajuste milimétrico sobre el plano del oro (+ 0.003)
                            validPositions.push(tempV.x, tempV.y, tempV.z + 0.003); 
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
            // INYECCIÓN DE SISTEMA DE ESTRELLITAS DE LUJO
            // ==========================================
            if (validPositions.length > 0) {
                sparkleGeometry = new THREE.BufferGeometry();
                const positions = new Float32Array(validPositions);
                const colors = new Float32Array(validPositions.length);

                for (let i = 0; i < validPositions.length / 3; i++) {
                    colors[i * 3] = 1.0;     
                    colors[i * 3 + 1] = 0.98;  
                    colors[i * 3 + 2] = 0.92;  

                    sparkleOpacities.push({
                        current: Math.random() * 0.5, // Empiezan con brillos iniciales más atenuados
                        speed: 0.006 + Math.random() * 0.012, // Parpadeo lento y lujoso
                        growing: Math.random() > 0.5
                    });
                }

                sparkleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                sparkleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

                const sparkleMaterial = new THREE.PointsMaterial({
                    size: 0.018, // MODIFICADO: Tamaño reducido drásticamente (de 0.06 a 0.018) para verse como finos cristales
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
        
        if (sparkles && sparkleGeometry) {
            const colorAttribute = sparkleGeometry.attributes.color;
            
            for (let i = 0; i < sparkleOpacities.length; i++) {
                const data = sparkleOpacities[i];
                
                if (data.growing) {
                    data.current += data.speed;
                    if (data.current >= 0.75) data.growing = false; // Techo de brillo limitado para máxima discreción
                } else {
                    data.current -= data.speed;
                    if (data.current <= 0.01) data.growing = true;
                }

                colorAttribute.setXYZ(
                    i, 
                    1.0 * data.current,  
                    0.98 * data.current, 
                    0.92 * data.current
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
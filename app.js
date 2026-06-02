import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

document.body.appendChild(
    renderer.domElement
);

const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshNormalMaterial();
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

camera.position.z = 5; // Lo alejé un poco más para que aprecies mejor el zoom

// Instanciamos los controles pasándole la cámara y el elemento del renderizador
const controls = new OrbitControls(camera, renderer.domElement);

// Opcional: añade amortiguación (inercia) para que se mueva más suave
controls.enableDamping = true;
controls.dampingFactor = 0.05;

function animate() {
    requestAnimationFrame(animate);

    // Si quieres interactuar libremente, puedes comentar o dejar las rotaciones automáticas
    cube.rotation.x += 0.005;
    cube.rotation.y += 0.005;

    // ESENCIAL: Actualiza los controles en cada frame si usas damping
    controls.update();

    renderer.render(scene, camera);
}

animate();

// Ajustar la pantalla si cambias el tamaño de la ventana
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
import COLORS from './constants/colors.js';

function createScene(color = COLORS.BLACK, pos = 1000) {
	const scene = new THREE.Scene();

	const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 5000);
	camera.position.set(0, 0, pos);

	const light = new THREE.AmbientLight(COLORS.WHITE);
	scene.add(light);

	const renderer = new THREE.WebGLRenderer();
	renderer.setClearColor(color);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setPixelRatio(window.devicePixelRatio);

	const canvas = renderer.domElement;
	document.body.appendChild(canvas);

	const controls = new THREE.TrackballControls(camera, canvas);
	controls.target.set(1, 1, 1);
	controls.rotateSpeed = 2;

	const render = () => {
		controls.update();
		renderer.render(scene, camera);
		requestAnimationFrame(render);
	};

	render();

	const axes = new THREE.AxesHelper(5000);
	scene.add(axes)

	return scene;
}

export default createScene;
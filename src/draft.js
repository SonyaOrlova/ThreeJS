import _ from 'lodash';

import COLORS from './constants/colors.js';

// addThreeSphere();
LoadBlenderModel();

function LoadBlenderModel() {
	const loader = new THREE.GLTFLoader();

	loader.load('sphere.glb', function(gltf) {		
		const model = gltf.scene;

		model.traverse(object => {
			if (!object.isMesh) return;

			const unindexedGeometry = object.geometry.toNonIndexed();

			const verticesCoords = unindexedGeometry.attributes.position.array;
			const verticesCountPerFace = unindexedGeometry.attributes.position.itemSize;
			const axesCount = 3; // x, y, z
			const colorCodesCount = 3; // r, g, b

			// const facesCoords = _.chunk(verticesCoords, verticesCountPerFace * axesCount);

			// const faces = [];
			// const facesColors = new Float32Array(facesCoords.length * verticesCountPerFace * colorCodesCount).fill(1); // 1: white

			// for (let faceIndex = 0; faceIndex < facesCoords.length; faceIndex ++) {
			// 	// if (faceIndex === 0 || faceIndex === 14) {

			// 		const faceCoords = facesCoords[faceIndex];
			// 		const face = [];

			// 		const faceColorR = Math.random();
			// 		const faceColorG = Math.random();
			// 		const faceColorB = Math.random();

			// 		faceCoords.forEach((coord, coordIndex) => {
			// 			const isVertex = coordIndex % axesCount === 0;

			// 			if (isVertex) {
			// 				const x = faceCoords[coordIndex];
			// 				const y = faceCoords[coordIndex + 1];
			// 				const z = faceCoords[coordIndex + 2];

			// 				face.push(new THREE.Vector3(x, y, z));

			// 				const faceColorIndex = faceIndex * verticesCountPerFace * colorCodesCount + coordIndex;

			// 				facesColors[faceColorIndex] = faceColorR;
			// 				facesColors[faceColorIndex + 1] = faceColorG;
			// 				facesColors[faceColorIndex + 2] = faceColorB;
			// 			} 
			// 		})

			// 		faces.push(face);
			// 	// }
			// }

			// unindexedGeometry.setAttribute('color', new THREE.BufferAttribute(facesColors, 3));
			// unindexedGeometry.getAttribute('color').needsUpdate = true;

			const rows = [];

			for (let coordIndex = 0; coordIndex < verticesCoords.length; coordIndex ++) {
				const coordStep = verticesCountPerFace * axesCount;

				const isFace = coordIndex % coordStep === 0;

				if (isFace) {
					const face = [];
					const faceCoords = verticesCoords.slice(coordIndex, coordIndex + coordStep);

					faceCoords.forEach((faceCoord, faceCoordIndex) => {
						const isVertex = faceCoordIndex % axesCount === 0;

						if (isVertex) {
							const xIdx = faceCoordIndex + coordIndex;
							const yIdx = faceCoordIndex + coordIndex + 1;
							const zIdx = faceCoordIndex + coordIndex + 2;

							const vertex = {
								x: { index: xIdx, coord: verticesCoords[xIdx] },
								y: { index: yIdx, coord: verticesCoords[yIdx] },
								z: { index: zIdx, coord: verticesCoords[zIdx] },
							};

							face.push(vertex);
						}
					});

					const faceBaseY = face.map(vertex => vertex.y.coord).find((y, idx, arr) => arr.indexOf(y) !== idx);

					const rowIndex = rows.findIndex(row => row.baseY === faceBaseY);

					if (rowIndex !== -1) {
						rows[rowIndex].faces.push(face);
					} else {
						rows.push({ baseY: faceBaseY, faces: [ face ] });
					}
				}
			}

			const rowColors = new Float32Array(verticesCoords.length / axesCount * colorCodesCount).fill(1);

			for (let rowIndex = 0; rowIndex < rows.length; rowIndex ++) {
				const rowColorR = Math.random();
				const rowColorG = Math.random();
				const rowColorB = Math.random();

				const rowFaces = rows[rowIndex].faces;

				rowFaces.forEach(face => {
					face.forEach(vertex => {
						const startVertexIndex = vertex.x.index;

						rowColors[startVertexIndex] = rowColorR;
						rowColors[startVertexIndex + 1] = rowColorG;
						rowColors[startVertexIndex + 2] = rowColorB;
					})
				})
			}

			unindexedGeometry.setAttribute('color', new THREE.BufferAttribute(rowColors, 3));
			unindexedGeometry.getAttribute('color').needsUpdate = true;

			object.geometry = unindexedGeometry;
			object.material = new THREE.MeshBasicMaterial({ vertexColors: THREE.VertexColors });
		})

		const scene = createScene(COLORS.WHITE, 600);
		scene.add(model);
	});
}

function addThreeSphere() {
	const scene = createScene();
	const geometry = createSphereGeometry(6, 6);

	geometry.faces[0].color.setRGB(0.2, 0.2, 0.2);
	const BG = new THREE.BufferGeometry().fromGeometry( geometry );
	const mesh = createMesh(BG, COLORS.RED, true);

	// const wireframe = addWireframe(mesh, COLORS.BLACK);

	console.log(mesh)

	scene.add(mesh);
	// scene.add(wireframe);
}

function createSphereGeometry(widthSegments, heightSegments) {
	const sphereGeometry = new THREE.SphereGeometry(200, widthSegments, heightSegments);

	return sphereGeometry;
}

function createMesh(geometry, color, wireframe = false) {
	const material = new THREE.MeshBasicMaterial({ color, vertexColors: THREE.VertexColors, wireframe });

	const mesh = new THREE.Mesh(geometry, material);
	mesh.position.set(0, 0, 0)

	return mesh;
}

function addLines(geometry, color) {
	const edges = new THREE.EdgesGeometry(geometry, 2);
	const lines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color, linewidth: 1 }));

	return lines;
}

function addWireframe(mesh, color) {
	const wireframe = new THREE.WireframeHelper( mesh, color );

	return wireframe;
}

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
	controls.target.set( 1, 1, 1);
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

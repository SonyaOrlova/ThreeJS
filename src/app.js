import _ from 'lodash';
import createScene from './createScene';

import COLORS from './constants/colors.js';

const AXES_COUNT = 3; // x, y, z

const PATTERN = {
	INCR: 'increment',
	DECR: 'decrement',
}

LoadBlenderModel('./models/sphere16.glb', PATTERN.INCR);

function LoadBlenderModel(fileName, pattern) {
	const loader = new THREE.GLTFLoader();

	loader.load(fileName, function(gltf) {		
		const model = gltf.scene;

		model.traverse(object => {
			if (!object.isMesh) return;

			const unindexedGeometry = object.geometry.toNonIndexed();

			const verticesCoords = unindexedGeometry.attributes.position.array;
			const verticesCount = verticesCoords.length / AXES_COUNT;
			const verticesCountPerFace = unindexedGeometry.attributes.position.itemSize;

			const rows = getRows(verticesCoords, verticesCountPerFace, pattern);
			const rowsColor = getRowsColor(rows, verticesCount);

			calculateStitchesSchema(rows);

			unindexedGeometry.setAttribute('color', new THREE.BufferAttribute(rowsColor, 3));
			unindexedGeometry.getAttribute('color').needsUpdate = true;

			object.geometry = unindexedGeometry;
			object.material = new THREE.MeshBasicMaterial({ vertexColors: THREE.VertexColors });
		})

		const scene = createScene(COLORS.WHITE, 600);
		scene.add(model);
	});
}

function getRows(verticesCoords, verticesCountPerFace, pattern) {
	let rows = [];

	let modelMaxY;
	let modelMinY;

	const excludedFaces = [];

	for (let coordIndex = 0; coordIndex < verticesCoords.length; coordIndex ++) {
		const coordStep = verticesCountPerFace * AXES_COUNT;

		const isFace = coordIndex % coordStep === 0;

		if (isFace) {
			const face = {
				vertices: [],
				baseVertices: undefined,
			};

			const faceCoords = verticesCoords.slice(coordIndex, coordIndex + coordStep);

			faceCoords.forEach((faceCoord, faceCoordIndex) => {
				const isVertex = faceCoordIndex % AXES_COUNT === 0;

				if (isVertex) {
					const xIdx = faceCoordIndex + coordIndex;
					const yIdx = faceCoordIndex + coordIndex + 1;
					const zIdx = faceCoordIndex + coordIndex + 2;

					const vertex = {
						x: { index: xIdx, coord: verticesCoords[xIdx] },
						y: { index: yIdx, coord: verticesCoords[yIdx] },
						z: { index: zIdx, coord: verticesCoords[zIdx] },
					};

					face.vertices.push(vertex);
				}
			});

			const faceYs = face.vertices.map(vertex => vertex.y.coord);

			const baseY = faceYs.find((y, idx, arr) => arr.indexOf(y) !== idx);
			const maxY = Math.max.apply(null, faceYs);
			const minY = Math.min.apply(null, faceYs);

			face.baseVertices = face.vertices.filter(vertex => vertex.y.coord === baseY).map(vertex => ({
				x: vertex.x.coord,
				y: vertex.y.coord,
				z: vertex.z.coord,
			}));

			face.baseCenter = {
				x: (face.baseVertices[0].x + face.baseVertices[1].x) / 2,
				y: (face.baseVertices[0].y + face.baseVertices[1].y) / 2,
				z: (face.baseVertices[0].z + face.baseVertices[1].z) / 2,
			};

			if (!modelMaxY || maxY > modelMaxY) modelMaxY = maxY;
			if (!modelMinY || minY < modelMinY) modelMinY = minY;

			const incrementPattern = minY < baseY;
			const decrementPattern = maxY > baseY;

			if ((pattern === PATTERN.INCR && incrementPattern) || (pattern === PATTERN.DECR && decrementPattern)) {
				rows = addFaceToRow(rows, face, baseY, minY, maxY, pattern);
			} else {
				excludedFaces.push({ face, baseY, minY, maxY });
			}
		}
	};

	const excludedRowFaces = excludedFaces.filter(face => {
		return (pattern === PATTERN.INCR && face.maxY === modelMaxY) || (pattern === PATTERN.DECR && face.minY === modelMinY);
	});

	if (excludedRowFaces.length) {
		excludedRowFaces.forEach(ef => {
			rows = addFaceToRow(rows, ef.face, ef.baseY, ef.minY, ef.maxY, pattern);
		});
	}

	rows.forEach(row => row.faces = sortRowFaces(row.faces));

	rows = checkClosingRows(rows, modelMinY, modelMaxY, pattern);

	return rows;

	function addFaceToRow(rows, face, baseY, minY, maxY, pattern) {
		const rowIndex = rows.findIndex(row => row.baseY === baseY && row.maxY === maxY && row.minY === minY);

		if (rowIndex !== -1) {
			rows[rowIndex].faces.push(face);
		} else {
			const row = {
				baseY,
				maxY,
				minY,
				faces: [ face ],
			};

			const sortedRowIndex = _.sortedIndexBy(rows, row, (r) => {
				if (pattern === PATTERN.INCR) return r.maxY;
				if (pattern === PATTERN.DECR) return - r.maxY;
			});

			rows.splice(sortedRowIndex, 0, row);
		}

		return rows;
	}
}

function checkClosingRows(rows, modelMinY, modelMaxY, pattern) {
	const modelMinRowIndex = rows.findIndex(row => row.minY === modelMinY);
	const modelMaxRowIndex = rows.findIndex(row => row.maxY === modelMaxY);

	let openingRowIndex;
	let closingRowIndex;

	if (pattern === PATTERN.INCR) {
		openingRowIndex = modelMinRowIndex;
		closingRowIndex = modelMaxRowIndex;
	}

	if (pattern === PATTERN.DECR) {
		openingRowIndex = modelMaxRowIndex;
		closingRowIndex = modelMinRowIndex;
	}

	if (openingRowIndex !== -1) rows[openingRowIndex].isOpening = true;
	if (closingRowIndex !== -1) rows[closingRowIndex].isClosing = true;

	return rows;
}

function sortRowFaces(faces) {
	const centroid = faces.reduce((acc, face) => {
		acc.x += face.baseCenter.x / faces.length;
		acc.z += face.baseCenter.z / faces.length;

		return acc;
	}, { x: 0, z: 0 });

	const angles = faces.map((face, index) => ({
		index,
		angle: Math.atan2(centroid.x - face.baseCenter.x, centroid.z - face.baseCenter.z) * 180 / Math.PI,
	})).sort((a, b) => b.angle - a.angle);

	return [...angles].map(angle => faces[angle.index]);
}

function getRowsColor(rows, verticesCount) {
	const colorCodesCount = 3; // r, g, b

	const rowColors = new Float32Array(verticesCount * colorCodesCount).fill(1); // fill white color by default

	for (let rowIndex = 0; rowIndex < rows.length; rowIndex ++) {
		const rowColorR = Math.random();
		const rowColorG = Math.random();
		const rowColorB = Math.random();

		const { faces } = rows[rowIndex];

		for (let faceIndex = 0; faceIndex < faces.length; faceIndex ++) {
			const face = faces[faceIndex];

			face.vertices.forEach(vertex => {
				const startVertexIndex = vertex.x.index;

				rowColors[startVertexIndex] = rowColorR;
				rowColors[startVertexIndex + 1] = rowColorG;
				rowColors[startVertexIndex + 2] = rowColorB;
			});
		}
	}

	return rowColors;
}

function calculateStitchesSchema(rows) {
	let stitchLength;

	const calculated = rows.map(row => {
		return row.faces.map(face => {
			const bv1 = face.baseVertices[0];
			const bv2 = face.baseVertices[1];

			let length = Number(Math.sqrt(Math.pow(bv1.x - bv2.x, 2) + Math.pow(bv1.z - bv2.z, 2)).toFixed(2));

			if (row.isOpening) stitchLength = length;
			if (row.isClosing) length = 0;

			return length;
		});
	});

	const stichesCountInRow = calculated[0].length;

	const stitchLengthShift = calculated
		.map(row => _.uniq(row))
		.map((value, index, arr) => {
			if (index === 0) return 1;
			return (value / arr[index - 1]).toFixed(2);
		}); // ПЕРЕДЕЛАТЬ

	console.log(stitchLengthShift);
}

// 0.8 - 1 = П
// 0.5 - 0.8 = 1 П
// 0.3 - 0.35 = 2 П
// 0.23 - 0.27 = 3 П
// 0.

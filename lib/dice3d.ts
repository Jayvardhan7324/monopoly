import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const params = {
    segments: 50,
    edgeRadius: .07,
    notchRadius: .12,
    notchDepth: .1
};

export function createBoxGeometry() {
    let boxGeometry: THREE.BufferGeometry = new THREE.BoxGeometry(1, 1, 1, params.segments, params.segments, params.segments);
    const positionAttribute = boxGeometry.attributes.position;
    const subCubeHalfSize = .5 - params.edgeRadius;

    const notchWave = (v: number) => {
        v = (1 / params.notchRadius) * v;
        v = Math.PI * Math.max(-1, Math.min(1, v));
        return params.notchDepth * (Math.cos(v) + 1.);
    };
    const notch = (pos: [number, number]) => notchWave(pos[0]) * notchWave(pos[1]);

    for (let i = 0; i < positionAttribute.count; i++) {
        let position = new THREE.Vector3().fromBufferAttribute(positionAttribute, i);

        const subCube = new THREE.Vector3(
            Math.sign(position.x),
            Math.sign(position.y),
            Math.sign(position.z)
        ).multiplyScalar(subCubeHalfSize);

        const addition = new THREE.Vector3().subVectors(position, subCube);

        if (Math.abs(position.x) > subCubeHalfSize && Math.abs(position.y) > subCubeHalfSize && Math.abs(position.z) > subCubeHalfSize) {
            addition.normalize().multiplyScalar(params.edgeRadius);
            position = subCube.add(addition);
        } else if (Math.abs(position.x) > subCubeHalfSize && Math.abs(position.y) > subCubeHalfSize) {
            addition.z = 0;
            addition.normalize().multiplyScalar(params.edgeRadius);
            position.x = subCube.x + addition.x;
            position.y = subCube.y + addition.y;
        } else if (Math.abs(position.x) > subCubeHalfSize && Math.abs(position.z) > subCubeHalfSize) {
            addition.y = 0;
            addition.normalize().multiplyScalar(params.edgeRadius);
            position.x = subCube.x + addition.x;
            position.z = subCube.z + addition.z;
        } else if (Math.abs(position.y) > subCubeHalfSize && Math.abs(position.z) > subCubeHalfSize) {
            addition.x = 0;
            addition.normalize().multiplyScalar(params.edgeRadius);
            position.y = subCube.y + addition.y;
            position.z = subCube.z + addition.z;
        }

        const offset = .23;

        if (position.y === .5) {
            position.y -= notch([position.x, position.z]);
        } else if (position.x === .5) {
            position.x -= notch([position.y + offset, position.z + offset]);
            position.x -= notch([position.y - offset, position.z - offset]);
        } else if (position.z === .5) {
            position.z -= notch([position.x - offset, position.y + offset]);
            position.z -= notch([position.x, position.y]);
            position.z -= notch([position.x + offset, position.y - offset]);
        } else if (position.z === -.5) {
            position.z += notch([position.x + offset, position.y + offset]);
            position.z += notch([position.x + offset, position.y - offset]);
            position.z += notch([position.x - offset, position.y + offset]);
            position.z += notch([position.x - offset, position.y - offset]);
        } else if (position.x === -.5) {
            position.x += notch([position.y + offset, position.z + offset]);
            position.x += notch([position.y + offset, position.z - offset]);
            position.x += notch([position.y, position.z]);
            position.x += notch([position.y - offset, position.z + offset]);
            position.x += notch([position.y - offset, position.z - offset]);
        } else if (position.y === -.5) {
            position.y += notch([position.x + offset, position.z + offset]);
            position.y += notch([position.x + offset, position.z]);
            position.y += notch([position.x + offset, position.z - offset]);
            position.y += notch([position.x - offset, position.z + offset]);
            position.y += notch([position.x - offset, position.z]);
            position.y += notch([position.x - offset, position.z - offset]);
        }

        positionAttribute.setXYZ(i, position.x, position.y, position.z);
    }

    boxGeometry.deleteAttribute('normal');
    boxGeometry.deleteAttribute('uv');
    boxGeometry = BufferGeometryUtils.mergeVertices(boxGeometry);

    boxGeometry.computeVertexNormals();

    return boxGeometry;
}

export function createInnerGeometry() {
    const baseGeometry = new THREE.PlaneGeometry(1 - 2 * params.edgeRadius, 1 - 2 * params.edgeRadius);
    const offset = .48;

    return BufferGeometryUtils.mergeGeometries([
        baseGeometry.clone().translate(0, 0, offset),
        baseGeometry.clone().translate(0, 0, -offset),
        baseGeometry.clone().rotateX(.5 * Math.PI).translate(0, -offset, 0),
        baseGeometry.clone().rotateX(.5 * Math.PI).translate(0, offset, 0),
        baseGeometry.clone().rotateY(.5 * Math.PI).translate(-offset, 0, 0),
        baseGeometry.clone().rotateY(.5 * Math.PI).translate(offset, 0, 0),
    ], false);
}

export function createDiceMesh() {
    const boxMaterialOuter = new THREE.MeshStandardMaterial({
        color: 0xeeeeee,
    });
    const boxMaterialInner = new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 0,
        metalness: 1,
        side: THREE.DoubleSide
    });

    const diceMesh = new THREE.Group();
    const innerMesh = new THREE.Mesh(createInnerGeometry(), boxMaterialInner);
    const outerMesh = new THREE.Mesh(createBoxGeometry(), boxMaterialOuter);

    // Setup shadow casting
    innerMesh.castShadow = true;
    outerMesh.castShadow = true;
    innerMesh.receiveShadow = true;
    outerMesh.receiveShadow = true;

    diceMesh.add(innerMesh, outerMesh);

    return diceMesh;
}

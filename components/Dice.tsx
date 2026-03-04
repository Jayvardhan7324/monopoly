import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createDiceMesh } from '../lib/dice3d';

interface DiceProps {
  value: number;
  isRolling: boolean;
  size?: number;
  index?: number;
}

export const Dice: React.FC<DiceProps> = ({ value, isRolling, size = 100, index = 0 }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [sceneState, setSceneState] = useState<{ body: CANNON.Body, world: CANNON.World } | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const width = size;
    const height = size;

    // Clear any existing canvases (e.g. from HMR or React StrictMode)
    mountRef.current.innerHTML = '';

    // Set up Three.js Scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    // Adjusted camera to view more from top down, acting as a visual "tilt"
    camera.position.set(0, 5.5, 3.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);

    // Set up Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    // Tweak shadow properties
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // Set up Cannon.js World
    const world = new CANNON.World();
    world.gravity.set(0, -9.82 * 4, 0); // Fast gravity for snappy roll
    world.broadphase = new CANNON.NaiveBroadphase();

    // Floor physics only (invisible in Three.js)
    const floorShape = new CANNON.Plane();
    const floorBody = new CANNON.Body({ mass: 0 });
    floorBody.addShape(floorShape);
    floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    // We place the floor slightly below the origin
    floorBody.position.set(0, -0.5, 0);
    world.addBody(floorBody);

    // Dice Mesh and Body
    const diceMesh = createDiceMesh();
    scene.add(diceMesh);

    const shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
    const body = new CANNON.Body({ mass: 1, shape });
    body.position.set(0, 0, 0);
    world.addBody(body);

    setSceneState({ body, world });

    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = () => {
      const time = performance.now();
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      // Fix maximum time step to prevent physics blowing up if tab is inactive
      world.step(1 / 60, Math.min(dt, 0.1), 3);

      // Always keep the visual mesh perfectly centered
      diceMesh.position.set(0, 0, 0);
      diceMesh.quaternion.copy(body.quaternion as any);

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      world.removeBody(body);
      world.removeBody(floorBody);
    };
  }, [size]);

  useEffect(() => {
    if (!sceneState) return;
    const { body } = sceneState;

    if (isRolling) {
      // Roll the dice keeping it in the same place
      body.position.set(0, 0.2, 0);
      body.velocity.set(0, 0, 0);
      // Constant high-speed spin. Flip direction based on index so they don't look identical.
      const spinDirection = index === 0 ? 1 : -1;
      body.angularVelocity.set(250 * spinDirection, 250 * spinDirection, 250 * spinDirection);
      body.wakeUp();
    } else {
      // Snap to target rotation so it displays the correct resulting value
      // Set to rest at center
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
      body.position.set(0, 0, 0);

      // Base rotations for dice faces so the correct value points UP
      const baseQuat = new CANNON.Quaternion();
      switch (value) {
        case 1: baseQuat.setFromEuler(0, 0, 0); break;
        case 2: baseQuat.setFromEuler(0, 0, Math.PI / 2); break;
        case 3: baseQuat.setFromEuler(-Math.PI / 2, 0, 0); break;
        case 4: baseQuat.setFromEuler(Math.PI / 2, 0, 0); break;
        case 5: baseQuat.setFromEuler(0, 0, -Math.PI / 2); break;
        case 6: baseQuat.setFromEuler(Math.PI, 0, 0); break;
        default: baseQuat.setFromEuler(0, 0, 0);
      }

      // Add a realistic yaw so they point inwards towards one another (flat on floor)
      const yaw = index === 0 ? Math.PI / 6 : -Math.PI / 6;
      const yawQuat = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), yaw);

      const finalQuat = yawQuat.mult(baseQuat);
      body.quaternion.set(finalQuat.x, finalQuat.y, finalQuat.z, finalQuat.w);
    }
  }, [isRolling, value, sceneState, index]);
  return (
    <div
      ref={mountRef}
      className="flex items-center justify-center transition-transform"
      style={{ width: size, height: size }}
    />
  );
};
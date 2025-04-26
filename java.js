// Import libraries from CDN
import * as THREE from "https://cdn.skypack.dev/three@0.136.0";
import { gsap } from "https://cdn.skypack.dev/gsap@3.11.0";
import { ScrollTrigger } from "https://cdn.skypack.dev/gsap@3.11.0/ScrollTrigger";

// Register ScrollTrigger plugin
gsap.registerPlugin(ScrollTrigger);

// Initialize scene, camera, and renderer
const scene = new THREE.Scene();
scene.background = null; // Set to null for transparency

// Set up camera with centered position
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 5);
camera.lookAt(0, 0, 0);

// Set up renderer with transparency
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0); // Transparent background
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Set canvas to appear above content
const canvas = renderer.domElement;
canvas.style.position = "fixed";
canvas.style.top = "0";
canvas.style.left = "0";
canvas.style.width = "100%";
canvas.style.height = "100%";
canvas.style.zIndex = "10"; // Higher than content
canvas.style.pointerEvents = "none"; // Allow clicking through

// Create an enhanced star texture for brighter, more distinct particles
function createStarTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");

  // Create more detailed radial gradient for star with brighter core
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)"); // Core
  gradient.addColorStop(0.1, "rgba(255, 255, 255, 0.95)"); // Near core - brighter
  gradient.addColorStop(0.3, "rgba(200, 200, 255, 0.7)"); // Middle - brighter
  gradient.addColorStop(0.6, "rgba(140, 140, 230, 0.4)"); // Outer middle - brighter
  gradient.addColorStop(1, "rgba(40, 40, 120, 0)"); // Edge

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  // Add stronger cross shape for enhanced sparkle effect
  ctx.globalCompositeOperation = "lighten";
  const linearGradient = ctx.createLinearGradient(32, 0, 32, 64);
  linearGradient.addColorStop(0, "rgba(100, 100, 230, 0)");
  linearGradient.addColorStop(0.5, "rgba(250, 250, 255, 0.7)"); // Brighter center
  linearGradient.addColorStop(1, "rgba(100, 100, 230, 0)");

  ctx.fillStyle = linearGradient;
  ctx.fillRect(28, 0, 8, 64);

  // Horizontal line - brighter
  const horizontalGradient = ctx.createLinearGradient(0, 32, 64, 32);
  horizontalGradient.addColorStop(0, "rgba(100, 100, 230, 0)");
  horizontalGradient.addColorStop(0.5, "rgba(250, 250, 255, 0.7)"); // Brighter center
  horizontalGradient.addColorStop(1, "rgba(100, 100, 230, 0)");

  ctx.fillStyle = horizontalGradient;
  ctx.fillRect(0, 28, 64, 8);

  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Create a group to hold the cube and its wireframe
const cubeGroup = new THREE.Group();
scene.add(cubeGroup);

// Create higher-resolution cube geometry
const geometry = new THREE.BoxGeometry(2, 2, 2, 4, 4, 4);

// Create custom vertex shader with enhanced position and normal data
const vertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Create shader material with enhanced uniforms
const uniforms = {
  iTime: { value: 0 },
  iResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }, // Use window size
  scrollProgress: { value: 0.0 }, // Track scroll progress
};

// Enhanced galaxy shader with nebula and color shifts
const fragmentShader = `
  uniform float iTime;
  uniform vec2 iResolution;
  uniform float scrollProgress;
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;

  void mainImage(out vec4 O, vec2 I) {
      vec2 r = iResolution.xy;
      vec2 z;
      vec2 i;
      vec2 f = I*(z+=4.-4.*abs(.7-dot(I=(I+I-r)/r.y, I)));

      // Add subtle movement to pattern
      float timeOffset = sin(iTime * 0.2) * 0.1;
      f.x += timeOffset;
      f.y -= timeOffset;

      // More iterations based on scroll progress for increasing detail
      float iterations = mix(8.0, 12.0, scrollProgress);

      for(O *= 0.; i.y++<iterations;
          O += (sin(f += cos(f.yx*i.y+i+iTime)/i.y+.7)+1.).xyyx
          * abs(f.x-f.y));

      O = tanh(7.*exp(z.x-4.-I.y*vec4(-1,1,2,0))/O);

      // Add pulsing effect
      float pulse = 1.0 + 0.2 * sin(iTime * 0.5);
      O.rgb *= pulse;

      // Add color shifting nebula effect
      float nebula = sin(I.x * 0.01 + iTime * 0.3) * sin(I.y * 0.01 - iTime * 0.2);
      nebula = abs(nebula) * 0.5;

      // Create shifting color palette that changes with scroll
      vec3 color1 = mix(vec3(0.1, 0.2, 0.8), vec3(0.8, 0.1, 0.5), scrollProgress); // Blue to purple
      vec3 color2 = mix(vec3(0.8, 0.2, 0.7), vec3(0.2, 0.8, 0.7), scrollProgress); // Purple to teal
      vec3 colorMix = mix(color1, color2, sin(iTime * 0.2) * 0.5 + 0.5);

      // Apply nebula color to darker areas
      O.rgb = mix(O.rgb, colorMix, nebula * (1.0 - length(O.rgb)));
  }

  void main() {
      // Map the position on the cube face to shader coordinates
      // Adjusting UV mapping based on face orientation might be needed for seamless texture across faces
      // For a simple box, using vUv directly might show seams.
      vec2 cubeUV = vUv; // Use normalized UV (0-1)
      vec4 fragColor;
      // Scale the UVs for the mainImage function which expects pixel coordinates or similar
      mainImage(fragColor, cubeUV * iResolution);

      // Add depth effect based on normals and position
      float depthFactor = abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
      fragColor.rgb *= 0.7 + 0.3 * depthFactor;

      // Add edge glow - intensity increases with scroll
      float edge = 1.0 - max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)) * 2.0;
      edge = pow(edge, 4.0);
      fragColor.rgb += edge * vec3(0.1, 0.2, 0.8) * (0.6 + scrollProgress * 0.4);

      // Boost brightness
      fragColor.rgb *= 2.0;

      gl_FragColor = fragColor;
  }
`;

// Create material with optimized settings for visibility
const material = new THREE.ShaderMaterial({
  vertexShader: vertexShader,
  fragmentShader: fragmentShader,
  uniforms: uniforms,
  transparent: true,
  opacity: 1.0,
  side: THREE.DoubleSide,
});

// Create cube mesh
const cube = new THREE.Mesh(geometry, material);
cube.castShadow = true;
cube.receiveShadow = true;
cubeGroup.add(cube);

// Create wireframe for edges (Optional: consider if needed with the shader)
const wireframe = new THREE.LineSegments(
  new THREE.EdgesGeometry(geometry, 10), // Lower threshold for more visible edges
  new THREE.LineBasicMaterial({
    color: 0x4488ff,
    linewidth: 1.5,
    transparent: true,
    opacity: 0.1,
  })
);
wireframe.scale.setScalar(1.001); // Slightly larger to prevent z-fighting
cubeGroup.add(wireframe);

// Particle system variables
let particleSystem, particleGeometry, particleMaterial;
let particlePositions, particleOriginalPositions, particleVelocities, particleSizes, particleColors, particleDepths;
const particleSettings = {
  PARTICLE_COUNT: 2000, // More individual particles instead of connections
  PARTICLE_MOUSE_INFLUENCE_X: 0.00005, // Subtle mouse effect (separate for X and Y)
  PARTICLE_MOUSE_INFLUENCE_Y: 0.00005,
  PARTICLE_REPULSION_RADIUS: 0.8,
  PARTICLE_REPULSION_STRENGTH: 0.00008,
  PARTICLE_CONNECTION_DISTANCE: 0.5, // Much smaller connection distance (not used for lines anymore)
  PARTICLE_DEPTH_RANGE: 12, // How far particles extend in Z-direction
  BASE_VELOCITY_SCALE: 0.0003, // Scale for base random movement
};

// State variables for particle effects
const particleEffectState = {
  emitFromCube: { active: false, particles: [] },
  whirlpool: { active: false, startTime: 0, duration: 2.0 },
  pulseWave: { active: false, startTime: 0, duration: 2.5, waveSpeed: 3, waveWidth: 1.0 },
};

function createEnhancedParticles() {
  particleGeometry = new THREE.BufferGeometry();
  const particleCount = particleSettings.PARTICLE_COUNT;

  particlePositions = new Float32Array(particleCount * 3);
  particleOriginalPositions = new Float32Array(particleCount * 3); // Store original positions
  particleVelocities = new Float32Array(particleCount * 3);
  particleSizes = new Float32Array(particleCount);
  particleColors = new Float32Array(particleCount * 3);
  particleDepths = new Float32Array(particleCount); // Store depth for zoom effect

  // Distribute particles in 3D volume with more depth variation
  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    // Use spherical distribution for wider spread
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    // Create deeper z-range for zoom effect
    const radius = 3 + Math.random() * 3; // Base radius 3-6
    const depthExtension =
      Math.random() * particleSettings.PARTICLE_DEPTH_RANGE -
      particleSettings.PARTICLE_DEPTH_RANGE / 2;

    particleOriginalPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    particleOriginalPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    particleOriginalPositions[i3 + 2] = radius * Math.cos(phi) + depthExtension;

    // Initialize current positions to original
    particlePositions[i3] = particleOriginalPositions[i3];
    particlePositions[i3 + 1] = particleOriginalPositions[i3 + 1];
    particlePositions[i3 + 2] = particleOriginalPositions[i3 + 2];


    // Store original depth for zoom calculation
    particleDepths[i] = particleOriginalPositions[i3 + 2];

    // Gentler velocities
    particleVelocities[i3] = (Math.random() - 0.5) * particleSettings.BASE_VELOCITY_SCALE;
    particleVelocities[i3 + 1] = (Math.random() - 0.5) * particleSettings.BASE_VELOCITY_SCALE;
    particleVelocities[i3 + 2] = (Math.random() - 0.5) * particleSettings.BASE_VELOCITY_SCALE * 0.5; // Less z movement

    // Size based on depth - farther particles are smaller
    const z = particleOriginalPositions[i3 + 2];
    const normalizedDepth =
      (z + particleSettings.PARTICLE_DEPTH_RANGE / 2) /
      particleSettings.PARTICLE_DEPTH_RANGE;
    particleSizes[i] = 0.008 + 0.03 * (1 - normalizedDepth); // Closer particles are larger

    // Color based on depth - create depth perception
    const brightness = 0.5 + 0.5 * (1 - normalizedDepth); // Brighter in front
    particleColors[i3] = 0.4 + 0.3 * brightness; // R
    particleColors[i3 + 1] = 0.4 + 0.3 * brightness; // G
    particleColors[i3 + 2] = 0.7 + 0.3 * brightness; // B - bluer in front
  }

  particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
  particleGeometry.setAttribute(
    "originalPosition",
    new THREE.BufferAttribute(particleOriginalPositions, 3)
  );
  particleGeometry.setAttribute("velocity", new THREE.BufferAttribute(particleVelocities, 3));
  particleGeometry.setAttribute("size", new THREE.BufferAttribute(particleSizes, 1));
  particleGeometry.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));
  particleGeometry.setAttribute("depth", new THREE.BufferAttribute(particleDepths, 1));

  const particleTexture = createStarTexture();

  particleMaterial = new THREE.PointsMaterial({
    size: 0.03, // Slightly larger individual particles (base size)
    map: particleTexture,
    transparent: true,
    vertexColors: true, // Enable vertex colors from buffer attribute
    opacity: 0.9, // More visible individual particles
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true, // Important for size to change with distance
  });

  particleSystem = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particleSystem);

  // // Remove constellation system as it's not being used to draw lines
  // const constellationMaterial = new THREE.LineBasicMaterial({
  //   color: 0x3366ff,
  //   transparent: true,
  //   opacity: 0.08, // Lower opacity for subtler effect
  //   blending: THREE.AdditiveBlending,
  // });

  // const constellationGeometry = new THREE.BufferGeometry();
  // const constellationSystem = new THREE.LineSegments(
  //   constellationGeometry,
  //   constellationMaterial
  // );
  // scene.add(constellationSystem);

  // return {
  //   particleSystem,
  //   constellationSystem, // Removed
  //   settings: particleSettings,
  // };
}

// Create enhanced particles
createEnhancedParticles(); // Call directly, no need to return an object

// --- Main Particle Update Function ---
function updateParticles(deltaTime, scrollProgress, mouseX, mouseY) {
  if (!particleSystem || !particleGeometry) return;

  const positions = particleGeometry.attributes.position.array;
  const originalPositions = particleGeometry.attributes.originalPosition.array;
  const velocities = particleGeometry.attributes.velocity.array;
  const sizes = particleGeometry.attributes.size.array;
  const colors = particleGeometry.attributes.color.array;
  const originalSizes = particleGeometry.attributes.size.original || new Float32Array(sizes); // Store original sizes if not already
  const originalColors = particleGeometry.attributes.color.original || new Float32Array(colors); // Store original colors if not already
  const particleCount = positions.length / 3;

  // Store original size and color arrays if they haven't been already
  if (!particleGeometry.attributes.size.original) {
    particleGeometry.attributes.size.original = originalSizes;
  }
  if (!particleGeometry.attributes.color.original) {
    particleGeometry.attributes.color.original = originalColors;
  }


  // Create bell curve for zoom effect - matches cube zoom curve
  let zoomCurve;
  if (scrollProgress < 0.5) {
    // First half - zoom in (0 to 1)
    zoomCurve = gsap.utils.clamp(0, 1, scrollProgress * 2);
  } else {
    // Second half - zoom out (1 to 0)
    zoomCurve = gsap.utils.clamp(0, 1, 2 - scrollProgress * 2);
  }

  // Apply easing
  zoomCurve = gsap.parseEase("power2.inOut")(zoomCurve);

  // Time elapsed for effects
  const currentTime = performance.now();

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;

    // --- Apply Base Velocity ---
    positions[i3] += velocities[i3] * deltaTime;
    positions[i3 + 1] += velocities[i3 + 1] * deltaTime;
    positions[i3 + 2] += velocities[i3 + 2] * deltaTime;

    // --- Apply Scroll Zoom Effect ---
    const zPosition = originalPositions[i3 + 2];

    // Push particles outward during zoom
    const pushFactor = 1 + zoomCurve * 1.5; // Max 2.5x distance at peak zoom
    const targetX = originalPositions[i3] * pushFactor;
    const targetY = originalPositions[i3 + 1] * pushFactor;

    // Z-position is special - particles move toward camera during zoom
    let targetZ = zPosition;
    if (Math.abs(zPosition) > 0.5) { // Apply zoom primarily to particles not too close initially
      targetZ = zPosition * (1 - zoomCurve * 0.6); // Move distant particles toward camera
    } else {
      targetZ = zPosition - zoomCurve * Math.sign(zPosition || 1) * 1.5; // Push close particles past camera
    }

    // Smoothly move current position towards the scroll-influenced target position
    // Use a small factor or time-based interpolation if desired for smoother scroll
    positions[i3] = lerp(positions[i3], targetX, 0.05); // Lerp factor can be tuned
    positions[i3 + 1] = lerp(positions[i3 + 1], targetY, 0.05);
    positions[i3 + 2] = lerp(positions[i3 + 2], targetZ, 0.05);


    // --- Apply Mouse Influence (Repulsion) ---
    if (!ScrollTrigger.isScrolling()) { // Only apply mouse repulsion when not scrolling
      // Get particle position in screen space (approximate)
      const particleScreenPos = new THREE.Vector3(positions[i3], positions[i3 + 1], positions[i3 + 2]).project(camera);
      const screenDx = particleScreenPos.x - mouseX;
      const screenDy = particleScreenPos.y - mouseY;
      const screenDistance = Math.sqrt(screenDx * screenDx + screenDy * screenDy);

      if (screenDistance < particleSettings.PARTICLE_REPULSION_RADIUS) {
        // Apply repulsion force
        const repulsionStrength = (1 - screenDistance / particleSettings.PARTICLE_REPULSION_RADIUS) * particleSettings.PARTICLE_REPULSION_STRENGTH;
        const repulsionX = (screenDx / screenDistance) * repulsionStrength;
        const repulsionY = (screenDy / screenDistance) * repulsionStrength;

        // Apply force in world space (approximation)
        positions[i3] += repulsionX * deltaTime * 100; // Scale repulsion force
        positions[i3 + 1] += repulsionY * deltaTime * 100;
      }
    }


    // --- Apply Particle Effects ---
    let sizeMultiplier = 1.0;
    let colorMultiplier = 1.0;
    let tempColor = new THREE.Color(originalColors[i3], originalColors[i3+1], originalColors[i3+2]); // Start with original color

    // Emit from Cube Effect
    if (particleEffectState.emitFromCube.active) {
      // This effect directly sets position and velocity for a short duration
      // Its logic should ideally be handled by updating velocity and then letting the main loop move it.
      // For now, we assume emitFromCube modifies velocity and maybe initial position when triggered.
      // The main loop then applies this velocity. Need a mechanism to reset velocity after the burst.
      // This part might need more complex state management per particle if effects are long-lasting.
    }

    // Whirlpool Effect
    if (particleEffectState.whirlpool.active) {
      const elapsed = (currentTime - particleEffectState.whirlpool.startTime) / 1000;
      const progress = Math.min(elapsed / particleEffectState.whirlpool.duration, 1.0);

      if (progress < 1.0) {
        const dx = positions[i3] - cubeGroup.position.x;
        const dy = positions[i3 + 1] - cubeGroup.position.y;
        const dz = positions[i3 + 2] - cubeGroup.position.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance < 8) {
          const strength = (1 - Math.min(distance / 8, 1)) * 0.0005 * (1 - progress); // Strength fades out
          const angle = Math.atan2(dy, dx);

          // Apply spiral force as an additional velocity
          velocities[i3] += -dy * strength * deltaTime * 60;
          velocities[i3 + 1] += dx * strength * deltaTime * 60;
          velocities[i3 + 2] += -0.0001 * distance * (1 - progress) * deltaTime * 60; // Pull slightly toward cube
        }
      } else {
        particleEffectState.whirlpool.active = false; // End effect
        // Consider smoothly transitioning velocities back to base or original
      }
    }

    // Pulse Wave Effect
    if (particleEffectState.pulseWave.active) {
      const elapsed = (currentTime - particleEffectState.pulseWave.startTime) / 1000;
      const waveDistance = elapsed * particleEffectState.pulseWave.waveSpeed;

      if (elapsed < particleEffectState.pulseWave.duration) {
        const dx = positions[i3] - cubeGroup.position.x;
        const dy = positions[i3 + 1] - cubeGroup.position.y;
        const dz = positions[i3 + 2] - cubeGroup.position.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const distFromWave = Math.abs(distance - waveDistance);

        if (distFromWave < particleEffectState.pulseWave.waveWidth) {
          const waveIntensity = (1 - distFromWave / particleEffectState.pulseWave.waveWidth) * (1 - elapsed / particleEffectState.pulseWave.duration); // Intensity fades out

          sizeMultiplier *= (1 + waveIntensity * 1.5); // Increase size at wave front
          tempColor.r += waveIntensity * 0.4; // R glow
          tempColor.g += waveIntensity * 0.2; // G glow
          tempColor.b += waveIntensity * 0.7; // B glow
        }
      } else {
        particleEffectState.pulseWave.active = false; // End effect
      }
    }

    // --- Combine Scroll Zoom and Effect Influences on Size and Color ---

    // Size increases dramatically during zoom and is influenced by effects
    const distFromCamera = new THREE.Vector3(positions[i3], positions[i3 + 1], positions[i3 + 2]).distanceTo(camera.position);
    const closenessFactor = Math.max(0, 1 - distFromCamera / 10); // Adjusted distance for closeness
    const sizeBoost = 1 + zoomCurve * 5.0; // Much larger at max zoom

    // Apply base size, closeness, zoom boost, and effect multiplier
    sizes[i] = originalSizes[i] * sizeBoost * sizeMultiplier * (0.5 + closenessFactor * 0.5); // Factor in closeness

    // Brighten particles during zoom and apply effect color changes
    const brightnessBoost = zoomCurve * 0.5; // Additional brightness at max zoom
    const baseBrightness = 0.5 + closenessFactor * 0.5;
    const brightness = baseBrightness + brightnessBoost;

    // Apply original color, general brightness, and effect color
    // Use tempColor (potentially modified by effects) and mix with original based on brightness/zoom
    const finalColor = new THREE.Color().lerpColors(
      tempColor, // Color influenced by effects
      new THREE.Color(originalColors[i3], originalColors[i3+1], originalColors[i3+2]).multiplyScalar(brightness), // Original color with brightness/zoom
      Math.min(1.0, brightness + (sizeMultiplier - 1.0)) // Blend factor - more effect color when brighter or effect increases size
    );


    colors[i3] = finalColor.r;
    colors[i3 + 1] = finalColor.g;
    colors[i3 + 2] = finalColor.b;

    // --- Reset velocities if effects are over or not active ---
    if (!particleEffectState.whirlpool.active) {
      // Smoothly transition velocity back to base random velocity
      velocities[i3] = lerp(velocities[i3], (Math.random() - 0.5) * particleSettings.BASE_VELOCITY_SCALE, 0.02);
      velocities[i3 + 1] = lerp(velocities[i3 + 1], (Math.random() - 0.5) * particleSettings.BASE_VELOCITY_SCALE, 0.02);
      velocities[i3 + 2] = lerp(velocities[i3 + 2], (Math.random() - 0.5) * particleSettings.BASE_VELOCITY_SCALE * 0.5, 0.02);
    }
    // Emit from Cube effect needs specific velocity handling if it's temporary bursts
  }

  particleGeometry.attributes.position.needsUpdate = true;
  particleGeometry.attributes.size.needsUpdate = true;
  particleGeometry.attributes.color.needsUpdate = true;
  // particleGeometry.attributes.velocity.needsUpdate = true; // Velocity is used internally, updating buffer not usually needed unless recreating it.
}


// Add special particle effects based on interactions
function createParticleEffects() {
  const effects = {
    // Create burst of particles from the cube
    emitFromCube: function (count = 30) { // Increased count
      if (!particleSystem || !particleGeometry) return;

      const positions = particleGeometry.attributes.position.array;
      const velocities = particleGeometry.attributes.velocity.array;
      const sizes = particleGeometry.attributes.size.array;
      const colors = particleGeometry.attributes.color.array;
      const particleCount = positions.length / 3;

      // Get random vertices from cube (world space)
      const cubeVertices = [];
      const positionAttr = cube.geometry.attributes.position;
      const cubeMatrix = cube.matrixWorld;

      for (let i = 0; i < positionAttr.count; i++) {
        const vertex = new THREE.Vector3(
          positionAttr.getX(i),
          positionAttr.getY(i),
          positionAttr.getZ(i)
        );
        vertex.applyMatrix4(cubeMatrix);
        cubeVertices.push(vertex);
      }

      particleEffectState.emitFromCube.particles = []; // Clear previous particles for this effect

      for (let i = 0; i < count; i++) {
        // Select random particles to repurpose
        const particleIndex = Math.floor(Math.random() * particleCount);
        const i3 = particleIndex * 3;

        // Get random vertex
        const vertexIndex = Math.floor(Math.random() * cubeVertices.length);
        const vertex = cubeVertices[vertexIndex];

        // Position particle at vertex
        positions[i3] = vertex.x;
        positions[i3 + 1] = vertex.y;
        positions[i3 + 2] = vertex.z;

        // Set outward velocity
        const speed = 0.01 + Math.random() * 0.03; // Slightly reduced speed
        velocities[i3] = (Math.random() - 0.5) * speed;
        velocities[i3 + 1] = (Math.random() - 0.5) * speed;
        velocities[i3 + 2] = (Math.random() - 0.5) * speed;

        // Increase size for visibility (temporarily)
        sizes[particleIndex] = (particleGeometry.attributes.size.original[particleIndex] || 0.03) * 2.0; // Boost original size

        // Brighten color (temporarily)
        colors[i3] = 1.0; // White core
        colors[i3 + 1] = 1.0;
        colors[i3 + 2] = 1.0;

        // Store affected particle index and start time to manage duration/fade
        particleEffectState.emitFromCube.particles.push({ index: particleIndex, startTime: performance.now() });
      }

      particleGeometry.attributes.position.needsUpdate = true;
      particleGeometry.attributes.velocity.needsUpdate = true; // Update velocities buffer
      particleGeometry.attributes.size.needsUpdate = true;
      particleGeometry.attributes.color.needsUpdate = true;

      particleEffectState.emitFromCube.active = true; // Activate state
    },

    // Create whirlpool effect around cube
    createWhirlpool: function (duration = 2.0) {
      particleEffectState.whirlpool.active = true;
      particleEffectState.whirlpool.startTime = performance.now();
      particleEffectState.whirlpool.duration = duration;
    },

    // Pulse wave emanating from cube
    emitPulseWave: function (duration = 2.5, waveSpeed = 3, waveWidth = 1.0) {
      particleEffectState.pulseWave.active = true;
      particleEffectState.pulseWave.startTime = performance.now();
      particleEffectState.pulseWave.duration = duration;
      particleEffectState.pulseWave.waveSpeed = waveSpeed;
      particleEffectState.pulseWave.waveWidth = waveWidth;
    },
  };

  return effects;
}

// Initialize particle effects
const particleEffects = createParticleEffects();

// Add lighting for better 3D perception
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(5, 10, 7);
directionalLight.castShadow = true;
scene.add(directionalLight);

const pointLight = new THREE.PointLight(0x3366ff, 1.5, 20);
pointLight.position.set(-3, 2, 5);
scene.add(pointLight);

// Handle window resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // Update shader resolution uniform on resize
  uniforms.iResolution.value.set(window.innerWidth, window.innerHeight);
});

// Set up mouse interaction with improved stability
const mouse = new THREE.Vector2(0, 0);
const targetCubeRotation = new THREE.Euler(0, 0, 0); // Target rotation for smooth movement

window.addEventListener("mousemove", (event) => {
  // Update mouse position for cube rotation
  const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
  const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;

  // Map mouse position to a target rotation range
  targetCubeRotation.x = mouseY * 0.1; // Adjust sensitivity
  targetCubeRotation.y = mouseX * 0.1; // Adjust sensitivity

  // Store mouse position for particle repulsion in normalized device coordinates
  mouse.x = mouseX;
  mouse.y = mouseY;
});

// Update click handler to include particle effects
document.addEventListener("click", () => {
  // Random animation on click
  gsap.to(cubeGroup.rotation, {
    x: cubeGroup.rotation.x + Math.PI * 0.25 * (Math.random() - 0.5),
    y: cubeGroup.rotation.y + Math.PI * 0.25 * (Math.random() - 0.5),
    z: cubeGroup.rotation.z + Math.PI * 0.25 * (Math.random() - 0.5),
    duration: 1,
    ease: "back.out(1.5)",
  });

  // Choose a random effect
  const effectChoice = Math.floor(Math.random() * 3);
  switch (effectChoice) {
    case 0:
      particleEffects.emitFromCube();
      break;
    case 1:
      particleEffects.createWhirlpool();
      break;
    case 2:
      particleEffects.emitPulseWave();
      break;
  }
});

// Text animation function
function animateTextElements() {
  // Get all section titles and descriptions
  const titles = document.querySelectorAll(".title");
  const descriptions = document.querySelectorAll(".description");
  const sections = document.querySelectorAll(".section");

  // Create a timeline for each section
  sections.forEach((section, index) => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top 80%",
        end: "top 20%",
        scrub: 1,
        // markers: true, // Uncomment for debugging ScrollTrigger
        toggleActions: "play none none reverse",
        onUpdate: (self) => {
          // You could potentially add per-section scroll logic here if needed
        }
      },
    });

    if (titles[index]) {
      tl.fromTo(
        titles[index],
        { opacity: 0, y: 50 }, // Initial state (from)
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: "power2.out",
        },
        0
      );
    }

    if (descriptions[index]) {
      tl.fromTo(
        descriptions[index],
        { opacity: 0, y: 50 }, // Initial state (from)
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: "power2.out",
          delay: 0.2,
        },
        0
      );
    }

    // Add parallax effect for the cube position based on sections
    tl.to(
      cubeGroup.position,
      {
        z: -3 * index, // Move cube deeper with each section (adjusted depth)
        duration: 1,
        ease: "none", // Linear movement with scrub
      },
      0 // Start this tween at the beginning of the section timeline
    );
  });
}

// Create enhanced rotation timeline with extreme zoom effect
const scrollTimeline = gsap.timeline({
  scrollTrigger: {
    trigger: ".content",
    start: "top top",
    end: "bottom bottom",
    scrub: 1.5,
    // markers: true, // Uncomment for debugging
    onUpdate: (self) => {
      // Update scroll progress uniform in shader
      uniforms.scrollProgress.value = self.progress;

      // updateParticleZoom is now integrated into the main updateParticles loop
      // We pass the scroll progress to the main update function
    },
  },
});

// Animate cube rotation based on scroll (full content scroll)
scrollTimeline.to(cubeGroup.rotation, {
  x: Math.PI * 2, // Full rotation
  y: Math.PI * 4, // Multiple rotations
  ease: "none", // Linear rotation with scrub
}, 0); // Start at the beginning of the scroll timeline

// Track previous time for delta time calculation
let previousTime = 0;
const clock = new THREE.Clock(); // Three.js clock for consistent delta time

// --- Main Animation Loop ---
function animate(currentTime) {
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta(); // Time elapsed since last frame

  // Update uniforms
  uniforms.iTime.value += deltaTime; // Increment time uniform

  // Smoothly interpolate cube rotation towards mouse target when not scrolling
  if (!ScrollTrigger.isScrolling()) {
    cubeGroup.rotation.x = lerp(cubeGroup.rotation.x, targetCubeRotation.x, 0.05);
    cubeGroup.rotation.y = lerp(cubeGroup.rotation.y, targetCubeRotation.y, 0.05);
    // Keep the scroll-controlled Z rotation or add mouse influence if desired
    // cubeGroup.rotation.z = lerp(cubeGroup.rotation.z, targetCubeRotation.z, 0.05);
  }


  // Update particles (handles base movement, scroll zoom, and effects)
  // Pass scroll progress and mouse position (normalized device coordinates)
  updateParticles(deltaTime, uniforms.scrollProgress.value, mouse.x, mouse.y);


  // Render the scene
  renderer.render(scene, camera);

  previousTime = currentTime;
}

// Start the animation loop
animate();

// Initialize text animations after DOM is ready
document.addEventListener('DOMContentLoaded', (event) => {
  animateTextElements();
});


// Helper function for smooth interpolation (can use gsap.utils.interpolate instead if preferred)
function lerp(start, end, amt) {
  return start * (1 - amt) + end * amt;
}

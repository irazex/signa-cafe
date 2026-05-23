// syrnik-3d.jsx — Three.js 3D muffin/syrnik centerpiece
// Loads the photogrammetry .obj + diffuse + normal textures and renders it
// in a tiny WebGL canvas that floats inside .syrnik-stage.

function Syrnik3D() {
  const canvasRef = React.useRef(null);
  const wrapRef = React.useRef(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !window.THREE) return;
    const THREE = window.THREE;

    // ---- Scene / camera / renderer ------------------------------------------
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 50);
    camera.position.set(0, 0.05, 0.42);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.physicallyCorrectLights = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    // ---- Lights -------------------------------------------------------------
    const ambient = new THREE.AmbientLight(0xfff3e0, 0.45);
    scene.add(ambient);

    // warm key light, top-left
    const key = new THREE.DirectionalLight(0xffe0b0, 2.4);
    key.position.set(-0.35, 0.55, 0.6);
    scene.add(key);

    // cool fill from below to lift the underside
    const fill = new THREE.DirectionalLight(0xffd0a0, 0.9);
    fill.position.set(0.4, -0.1, 0.35);
    scene.add(fill);

    // warm rim light from behind
    const rim = new THREE.DirectionalLight(0xffb060, 1.6);
    rim.position.set(0.0, 0.2, -0.6);
    scene.add(rim);

    // ---- Load textures + model ----------------------------------------------
    const texLoader = new THREE.TextureLoader();
    const diffuseTex = texLoader.load("assets/syrnik-diffuse.jpg", (t) => {
      t.encoding = THREE.sRGBEncoding;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    });
    diffuseTex.encoding = THREE.sRGBEncoding;

    const normalTex = texLoader.load("assets/syrnik-normal.jpg", (t) => {
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    });

    // Slightly toned-warm material — fried/golden, light gloss
    const mat = new THREE.MeshPhysicalMaterial({
      map: diffuseTex,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(1.4, 1.4),
      roughness: 0.62,
      metalness: 0.0,
      clearcoat: 0.18,
      clearcoatRoughness: 0.55,
      sheen: 0.25,
      sheenColor: new THREE.Color(0xffd9a0),
    });

    let model = null;
    let raf;
    let t = 0;
    const ptr = { x: 0, y: 0 };
    const ptrTarget = { x: 0, y: 0 };

    const loader = new THREE.OBJLoader();
    loader.load(
      "assets/syrnik-model.obj",
      (obj) => {
        // apply material
        obj.traverse((c) => {
          if (c.isMesh) {
            c.material = mat;
            c.geometry.computeVertexNormals();
            c.geometry.computeTangents?.();
          }
        });

        // center & scale to a known size
        const box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        obj.position.sub(center);
        const targetWidth = 0.18; // world units
        const maxXZ = Math.max(size.x, size.z);
        const s = targetWidth / maxXZ;
        obj.scale.setScalar(s);

        // baseline pose: flip 180° so the fried TOP faces the viewer, then tilt
        // slightly forward so we see the surface (not edge-on).
        obj.rotation.x = Math.PI - 0.45;

        scene.add(obj);
        model = obj;
        setLoaded(true);
      },
      undefined,
      (err) => {
        console.warn("Syrnik OBJ load error:", err);
      }
    );

    // ---- Resize -------------------------------------------------------------
    const resize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    // ---- Pointer parallax ---------------------------------------------------
    const onPointer = (e) => {
      const x = e.clientX != null ? e.clientX : e.touches?.[0]?.clientX;
      const y = e.clientY != null ? e.clientY : e.touches?.[0]?.clientY;
      if (x == null || y == null) return;
      const rect = wrap.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      ptrTarget.x = (x - cx) / (window.innerWidth * 0.5);
      ptrTarget.y = (y - cy) / (window.innerHeight * 0.5);
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("touchstart", onPointer, { passive: true });

    // ---- Animate ------------------------------------------------------------
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const clock = new THREE.Clock();
    const tick = () => {
      const dt = clock.getDelta();
      t += dt;

      // smooth pointer
      ptr.x += (ptrTarget.x - ptr.x) * 0.06;
      ptr.y += (ptrTarget.y - ptr.y) * 0.06;

      if (model) {
        // bob up/down
        const bob = reduced ? 0 : Math.sin(t * 1.0) * 0.012;
        model.position.y = bob;

        // gentle rocking + pointer tilt
        const rock = reduced ? 0 : Math.sin(t * 0.5) * 0.06;
        model.rotation.x = (Math.PI - 0.45) + ptr.y * -0.25;
        model.rotation.y = rock + ptr.x * 0.45;
        model.rotation.z = ptr.x * -0.08;
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    // ---- Cleanup ------------------------------------------------------------
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("touchstart", onPointer);
      diffuseTex.dispose();
      normalTex.dispose();
      mat.dispose();
      renderer.dispose();
      if (model) {
        model.traverse((c) => {
          if (c.isMesh) c.geometry.dispose();
        });
      }
    };
  }, []);

  return (
    <div className="syrnik-3d-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} className="syrnik-canvas" />
      {!loaded && <div className="syrnik-3d-loading" aria-hidden="true"></div>}
    </div>
  );
}

window.Syrnik3D = Syrnik3D;

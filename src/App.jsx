import React, { useEffect, useState, useRef, Suspense } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { TextureLoader } from "three";
// import './assets/Galaxy.jsx';
// import Galaxy from "./Galaxy.jsx";


function SpaceBackground() {
  const { scene } = useThree();
  const bgTexture = useLoader(TextureLoader, "/textures/starfield.png");
  scene.background = bgTexture;
  return null; // No visible object, just background
}

const SUN_RADIUS = 2;

// Parse NASA heliographic coordinates (e.g., "N15W30")
function parseCoordinates(sourceLocation) {
  if (!sourceLocation) return [0, 0];

  const latMatch = sourceLocation.match(/([SN])(\d+)/);
  const lonMatch = sourceLocation.match(/([EW])(\d+)/);

  if (!latMatch || !lonMatch) return [0, 0];

  // Latitude: N is positive, S is negative
  const lat = parseInt(latMatch[2], 10) * (latMatch[1] === "N" ? 1 : -1);

  // Longitude: W is negative, E is positive (heliographic)
  const lon = parseInt(lonMatch[2], 10) * (lonMatch[1] === "W" ? -1 : 1);

  return [lat, lon];
}

// Convert heliographic coordinates to 3D Cartesian coordinates
function flarePositionCoords(sourceLocation, radius = SUN_RADIUS) {
  const [lat, lon] = parseCoordinates(sourceLocation || "N0E0");

  // Convert to radians
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;

  // Spherical to Cartesian (standard physics convention)
  // X points to central meridian, Y points north, Z points to observer
  const x = radius * Math.cos(latRad) * Math.sin(lonRad);
  const y = radius * Math.sin(latRad);
  const z = radius * Math.cos(latRad) * Math.cos(lonRad);

  return [x, y, z];
}

function FlareMarker({ position, intensity, classType }) {
  const meshRef = useRef();
  const particlesRef = useRef();
  const glowRef = useRef();

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();

    if (meshRef.current) {
      const pulse = 1 + 0.3 * Math.sin(time * 5);
      meshRef.current.scale.setScalar(pulse);
    }

    if (glowRef.current) {
      const pulse = 1 + 0.2 * Math.sin(time * 3);
      glowRef.current.scale.setScalar(pulse);
    }

    if (particlesRef.current) {
      particlesRef.current.rotation.z = time * 0.5;
    }
  });

  // Color based on flare class
  const getFlareColor = () => {
    if (!classType) return "#ff8800";
    if (classType.startsWith("X")) return "#ff0000";
    if (classType.startsWith("M")) return "#ff6600";
    if (classType.startsWith("C")) return "#ffaa00";
    return "#ffdd00";
  };

  const color = getFlareColor();
  const size = 0.15 * intensity;

  return (
    <group position={position}>
      {/* Outer glow */}
      <mesh ref={glowRef} scale={3}>
        <sphereGeometry args={[size, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.2}
        />
      </mesh>

      {/* Middle glow */}
      <mesh scale={2}>
        <sphereGeometry args={[size, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.4}
        />
      </mesh>

      {/* Main flare core */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[size, 32, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Bright center */}
      <mesh scale={0.5}>
        <sphereGeometry args={[size, 16, 16]} />
        <meshBasicMaterial
          color="white"
        />
      </mesh>

      {/* Particle ring */}
      <group ref={particlesRef}>
        {[...Array(12)].map((_, i) => {
          const angle = (i / 12) * Math.PI * 2;
          const dist = size * 4;
          return (
            <mesh
              key={i}
              position={[
                Math.cos(angle) * dist,
                Math.sin(angle) * dist,
                0
              ]}
            >
              <sphereGeometry args={[size * 0.3, 8, 8]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={0.6}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

function SunSphere() {
  const sunRef = useRef();

  // Load textures from /public/textures/
  const [colorMap, normalMap, specularMap] = useTexture([
    "/textures/Scene_-_Root_diffuse.png",
    "/textures/Scene_-_Root_normal.png",
    "/textures/Scene_-_Root_specularGlossiness.png"
  ]);

  useFrame(({ clock }) => {
    if (sunRef.current) {
      sunRef.current.rotation.y = clock.getElapsedTime() * 0.05;
    }
  });

  return (
    <mesh ref={sunRef}>
      <sphereGeometry args={[SUN_RADIUS, 64, 64]} />
      <meshStandardMaterial
        map={colorMap}
        normalMap={normalMap}
        metalness={0.2}
        roughness={1}
        emissive="#FF8800"
        emissiveIntensity={0.5}
      // Note: specularMap is not standard supported, but included here for experimentation
      // If you want more advanced reflections, experiment with meshPhysicalMaterial or meshPhongMaterial.
      // specularMap={specularMap}
      />
    </mesh>
  );
}

function SunWithFlares({ flare }) {
  let flareMarker = null;

  if (flare && flare.sourceLocation) {
    const position = flarePositionCoords(flare.sourceLocation, SUN_RADIUS + 0.05);

    // Calculate intensity from class type
    let intensity = 1;
    if (flare.classType) {
      const match = flare.classType.match(/([ABCMX])(\d+\.?\d*)/);
      if (match) {
        const classLetter = match[1];
        const classNumber = parseFloat(match[2]);

        const baseIntensity = {
          'A': 0.3,
          'B': 0.5,
          'C': 1.0,
          'M': 2.0,
          'X': 4.0
        };

        intensity = (baseIntensity[classLetter] || 1) * (1 + classNumber / 5);
      }
    }

    console.log("Flare position:", position, "Intensity:", intensity);

    flareMarker = (
      <FlareMarker
        position={position}
        intensity={intensity}
        classType={flare.classType}
      />
    );
  }

  return (
    <>
      <SunSphere />
      {flareMarker}
    </>
  );
}

export default function SolarFlare3D() {
  const [flare, setFlare] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });

  useEffect(() => {
    setLoading(true);
    setError(null);

    const apiKey = "4oEAAhQnykiGoPYdvGuWqjtKW0YQE8jtlFGrshM2";
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 7);
    const endDateStr = endDate.toISOString().split("T")[0];

    fetch(
      `https://api.nasa.gov/DONKI/FLR?startDate=${date}&endDate=${endDateStr}&api_key=${apiKey}`
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        console.log("Flare data received:", data);
        if (data && data.length > 0) {
          // Find flares with valid source locations
          const validFlares = data.filter(f => f.sourceLocation);

          if (validFlares.length > 0) {
            // Sort by intensity
            const sortedFlares = validFlares.sort((a, b) => {
              const getClassValue = (classType) => {
                if (!classType) return 0;
                const match = classType.match(/([ABCMX])(\d+\.?\d*)/);
                if (!match) return 0;
                const classLetter = match[1];
                const classNumber = parseFloat(match[2]);
                const multiplier = { 'A': 1, 'B': 10, 'C': 100, 'M': 1000, 'X': 10000 };
                return (multiplier[classLetter] || 0) * classNumber;
              };
              return getClassValue(b.classType) - getClassValue(a.classType);
            });
            setFlare(sortedFlares[0]);
          } else {
            setFlare(data[0]); // Use first flare even without location
          }
        } else {
          setFlare(null);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching flare data:", err);
        setError(err.message);
        setLoading(false);
      });
  }, [date]);

return (
  <div
    style={{
      position: "relative",
      width: "100vw",
      height: "100vh",
      fontFamily: "'Bitcount Single Ink', monospace, sans-serif",
      background: "black"
    }}
  >
    {/* Centered Sun Canvas */}
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        gl={{ antialias: true }}
        style={{ width: "100vw", height: "100vh", background: "transparent" }}
      >
        <Suspense fallback={null}>
          <SunWithFlares flare={flare} />
        </Suspense>
        <ambientLight intensity={0.2} />
        <pointLight position={[0, 0, 0]} intensity={1.5} color="#ffaa00" />
        <pointLight position={[10, 10, 10]} intensity={0.3} color="#ffffff" />
        <OrbitControls
          enableZoom
          enablePan={false}
          enableRotate
          minDistance={3}
          maxDistance={10}
          zoomSpeed={0.5}
          rotateSpeed={0.5}
        />
      </Canvas>
    </div>

    {/* LEFT: App title, date picker, description */}
    <div
      className="flare-info-panel"
      style={{
        position: "absolute",
        top: 60,
        left: 40,
        maxWidth: 320,
        zIndex: 2,
        background: "rgba(20,20,20,0.92)",
        padding: "22px 24px",
        borderRadius: "18px",
        boxShadow: "0 0 18px 2px #000, 0 0 4px #ffd47f inset",
        color: "#FFD47F",
        lineHeight: 1.35,
        textShadow: "1px 1px 5px #ebb427, 0 0 2px #fff"
      }}
    >
      <h1
        style={{
          color: "#FFD47F",
          fontSize: "1.28em"
        }}
      >
        🌞 Solar Flare 3D Visualization
      </h1>
      <p style={{ color: "#FFD47F", marginBottom: 24 }}>
        Real NASA solar flare data mapped onto a 3D Sun model.
      </p>
      <div style={{ marginBottom: 14 }}>
        <label>
          <span style={{ color: "#FFF39E" }}>Search from Date:</span>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            style={{
              marginLeft: 10,
              fontFamily: "'Bitcount Single Ink', monospace",
              fontSize: "0.85em",
              padding: "2px 10px",
              borderRadius: "6px",
              border: "1px solid #aa9400",
              background: "#1a1a1a",
              color: "#FFD47F"
            }}
          />
        </label>
      </div>
      {loading && <div>🔄 Loading flare data...</div>}
      {error && <span style={{ color: "#ff3939" }}>❌ {error}</span>}
      <div style={{ marginTop: 22 }}>
        <b>💡 Controls:</b>
        <ul
          style={{
            marginTop: 10,
            paddingLeft: 16,
            color: "#FFD47F",
            fontFamily: "'Bitcount Single Ink'"
          }}
        >
          <li>Rotate: Click and drag</li>
          <li>Zoom: Mouse wheel/pinch</li>
          <li>Flare colors: 🔴 X | 🟠 M | 🟡 C</li>
          <li>Marker shows eruption</li>
          <li style={{ fontSize: "0.9em" }}>NASA DONKI Data</li>
        </ul>
      </div>
    </div>

    {/* RIGHT: Flare detail + events + controls */}
    <div
      className="flare-right-panel"
      style={{
        position: "absolute",
        top: 60,
        right: 40,
        maxWidth: 340,
        zIndex: 2,
        background: "rgba(20,20,20,0.92)",
        padding: "22px 24px",
        borderRadius: "18px",
        boxShadow: "0 0 18px 2px #000, 0 0 4px #ffd47f inset",
        color: "#FFD47F",
        lineHeight: 1.35,
        textShadow: "1px 1px 5px #ebb427, 0 0 2px #fff"
      }}
    >
      {flare ? (
        <>
          <div style={{ marginBottom: 18 }}>
            <h2 style={{ color: "#FFD47F", marginBottom: 14 }}>
              ⚡ Flare Details
            </h2>
            <div>
              <div>
                <b>Flare ID:</b> {flare.flrID}
              </div>
              <div>
                <b>Class:</b> {flare.classType}
              </div>
              <div>
                <b>Start:</b>{" "}
                {new Date(flare.beginTime).toLocaleString()}
              </div>
              <div>
                <b>Peak:</b>{" "}
                {new Date(flare.peakTime).toLocaleString()}
              </div>
              <div>
                <b>Region:</b> {flare.activeRegionNum || "N/A"}
              </div>
              <div>
                <b>Source:</b> {flare.sourceLocation || "N/A"}
              </div>
              <div>
                <b>Instruments:</b>{" "}
                {flare.instruments?.map(i => i.displayName).join(", ") ||
                  "N/A"}
              </div>
            </div>
          </div>
          <div
            style={{
              margin: "18px 0",
              padding: "10px 8px",
              background: "rgba(60,60,50,0.80)",
              borderRadius: 8,
              color: "#FFD47F",
              boxShadow: "0 0 6px #ffd47f55"
            }}
          >
            <b>🔗 Linked Events:</b>
            <br />
            {flare.linkedEvents && flare.linkedEvents.length > 0
              ? flare.linkedEvents.map((ev, idx) => (
                  <div key={idx}>• {ev.activityID || "Event"}</div>
                ))
              : <span>No linked events</span>}
          </div>
        </>
      ) : (
        <div style={{ color: "#fff", textAlign: "center" }}>
          No flare data found for selected date range.
        </div>
      )}
    </div>
  </div>
);
}
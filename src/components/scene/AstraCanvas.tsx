import { Component, type ErrorInfo, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { World } from "./World";

class SceneErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error("Astra scene failed", err, info);
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

export function AstraCanvas() {
  return (
    <SceneErrorBoundary>
      <Canvas
        frameloop="always"
        camera={{ position: [12, 6, 10], fov: 42, near: 0.1, far: 80 }}
        dpr={[1, 1.6]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0, touchAction: "none" }}
        onCreated={({ gl }) => {
          gl.setClearColor("#040406", 1);
        }}
      >
        <World />
      </Canvas>
    </SceneErrorBoundary>
  );
}

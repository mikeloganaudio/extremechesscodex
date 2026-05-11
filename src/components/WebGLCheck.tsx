import { useEffect, useState } from "react";

function checkWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return !!gl;
  } catch {
    return false;
  }
}

export function WebGLCheck({ children }: { children: React.ReactNode }) {
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    setSupported(checkWebGL());
  }, []);

  if (supported === null) return null;

  if (!supported) {
    return (
      <div className="w-full h-screen bg-stone-950 flex items-center justify-center">
        <div className="max-w-sm text-center p-8">
          <div className="text-5xl mb-4">♟</div>
          <h1 className="text-amber-200 text-xl font-bold mb-3">
            3D Chess requires WebGL
          </h1>
          <p className="text-stone-400 text-sm leading-relaxed">
            Your browser or device doesn't support WebGL, which is needed for
            the 3D board. Please try a modern browser like Chrome, Firefox, or
            Safari on a device with GPU support.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

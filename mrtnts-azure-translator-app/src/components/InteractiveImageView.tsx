import React, { useRef, useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Plane, useTexture, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

interface InteractiveImageViewProps {
  imageDataUrl: string | null; // Base64 Data URL of the image
  width?: number | string;
  height?: number | string;
}

// Component responsible for loading and displaying the image texture on a plane
const ImagePlane: React.FC<{ imageDataUrl: string }> = ({ imageDataUrl }) => {
  const texture = useTexture(imageDataUrl);

  // Ensure the texture is updated correctly when imageDataUrl changes
  texture.needsUpdate = true;

  // Calculate aspect ratio to display the plane correctly
  const aspectRatio = texture.image ? texture.image.width / texture.image.height : 1;
  const planeWidth = 5; // Adjust size as needed
  const planeHeight = planeWidth / aspectRatio;

  return (
    <Plane args={[planeWidth, planeHeight]} rotation={[-Math.PI / 2, 0, 0]} >
      <meshStandardMaterial 
         map={texture} 
         side={THREE.DoubleSide} // Show texture on both sides
         transparent // Needed if the image has transparency, though JPEG won't
         roughness={0.8} // Adjust material properties as needed
         metalness={0.1}
       />
    </Plane>
  );
};

// Loading fallback component
const Loader = () => {
  return (
    <Html center>
      <div style={{ color: 'white', fontSize: '1.2em' }}>加载模型...</div>
    </Html>
  );
}

const InteractiveImageView: React.FC<InteractiveImageViewProps> = ({
  imageDataUrl,
  width = '100%',
  height = '300px', // Default height
}) => {
  const controlsRef = useRef<OrbitControlsImpl>(null); // Provide initial value and specific type

  // Memoize the ImagePlane component only when imageDataUrl is valid
  const imageContent = useMemo(() => {
    if (imageDataUrl) {
      return <ImagePlane imageDataUrl={imageDataUrl} />;
    }
    return (
       <Html center>
         <div style={{ color: 'white', fontSize: '1.2em' }}>等待捕获图像...</div>
       </Html>
    );
  }, [imageDataUrl]);

  return (
    <div style={{ width, height, background: '#282c34' /* Dark background for contrast */ }}>
      <Canvas camera={{ position: [0, 5, 5], fov: 50 }}>
        {/* Lighting is important for StandardMaterial */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 7.5]} intensity={0.8} />
        <pointLight position={[-5, -5, -5]} intensity={0.5} />

        <Suspense fallback={<Loader />}>
            {imageContent} 
        </Suspense>

        <OrbitControls 
           ref={controlsRef} 
           enableZoom={true} 
           enablePan={true} // Allow panning
           minDistance={2} // Set zoom limits if needed
           maxDistance={20}
           // target={[0, 0, 0]} // Optional: set the center point
         />
      </Canvas>
    </div>
  );
};

export default InteractiveImageView; 
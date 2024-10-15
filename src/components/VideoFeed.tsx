import React, { useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Card, CardContent } from '@/components/ui/card';
import * as faceapi from 'face-api.js';

interface VideoFeedProps {
  onFaceDetected: (facePosition: { x: number, y: number }, canvasSize: { width: number, height: number }) => void;
}

const VideoFeed: React.FC<VideoFeedProps> = ({ onFaceDetected }) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const loadModels = async () => {
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
    };
    loadModels();
  }, []);

  useEffect(() => {
    const detectFace = async () => {
      if (webcamRef.current && canvasRef.current) {
        const video = webcamRef.current.video;
        if (video) {
          const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks();

          if (detections) {
            const canvas = canvasRef.current;
            const displaySize = { width: video.width, height: video.height };
            faceapi.matchDimensions(canvas, displaySize);

            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            const nose = resizedDetections.landmarks.getNose()[3];
            
            onFaceDetected(
              { x: nose.x, y: nose.y },
              { width: video.width, height: video.height }
            );

            canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
            faceapi.draw.drawDetections(canvas, resizedDetections);
            faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
          }
        }
      }
    };

    const interval = setInterval(detectFace, 100);
    return () => clearInterval(interval);
  }, [onFaceDetected]);

  return (
    <Card>
      <CardContent className="relative">
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          videoConstraints={{
            width: 1280,
            height: 720,
            facingMode: "user"
          }}
        />
        <canvas ref={canvasRef} className="absolute top-0 left-0" />
      </CardContent>
    </Card>
  );
};

export default VideoFeed;
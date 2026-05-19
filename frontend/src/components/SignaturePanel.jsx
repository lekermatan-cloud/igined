import React, { useState, useRef, useCallback, useEffect } from "react";
import { FileSignature, Type, Eraser, GripHorizontal } from "lucide-react";

export default function SignaturePanel({ 
  onSignatureChange, 
  signatureType,
  setSignatureType,
  typedName,
  setTypedName,
  isDraggable = true
}) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const [drawnSignature, setDrawnSignature] = useState(null);

  const startDrawing = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    setIsDrawing(true);
    lastPos.current = {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  const draw = useCallback((e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    
    e.preventDefault();
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const currentPos = {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
    
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    
    lastPos.current = currentPos;
  }, [isDrawing]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    if (signatureType === "typed") {
      setSignatureType("drawn");
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL("image/png");
      setDrawnSignature(dataUrl);
      onSignatureChange?.(dataUrl);
    }
  }, [signatureType, setSignatureType, onSignatureChange]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setDrawnSignature(null);
      onSignatureChange?.(null);
    }
  }, [onSignatureChange]);

  useEffect(() => {
    if (signatureType === "typed" && typedName) {
      onSignatureChange?.(null, typedName);
    } else if (drawnSignature) {
      onSignatureChange?.(drawnSignature, null);
    }
  }, [typedName, drawnSignature, signatureType]);

  const getSignatureData = (type = signatureType) => {
    if (type === "typed") {
      return { type: "typed", value: typedName };
    }
    if (!drawnSignature) return null;
    return { type: "drawn", value: drawnSignature };
  };

  const handleDragStart = (e) => {
    const sig = getSignatureData();
    console.log("Drag start:", sig);
    if (!sig) {
      e.preventDefault();
      return;
    }
    
    e.dataTransfer.setData("signature", JSON.stringify(sig));
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSignatureType("typed")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm transition-colors ${
            signatureType === "typed" 
              ? "bg-amber-600 text-black" 
              : "bg-amber-600/10 text-amber-200 border border-amber-600/30 hover:bg-amber-600/20"
          }`}
        >
          <Type className="w-4 h-4" />
          Type Name
        </button>
        <button
          type="button"
          onClick={() => setSignatureType("drawn")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm transition-colors ${
            signatureType === "drawn" 
              ? "bg-amber-600 text-black" 
              : "bg-amber-600/10 text-amber-200 border border-amber-600/30 hover:bg-amber-600/20"
          }`}
        >
          <FileSignature className="w-4 h-4" />
          Draw Signature
        </button>
      </div>

      {signatureType === "typed" ? (
        <div className="text-center py-6 bg-white border border-gray-300 rounded-lg">
          <input
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Enter your full name"
            className="bg-transparent border-none text-center text-2xl text-black w-full max-w-xs focus:outline-none"
            dir="ltr"
            style={{ fontFamily: "cursive" }}
          />
          {typedName && (
            <p className="text-gray-600 text-lg mt-4" style={{ fontFamily: "cursive" }}>
              {typedName}
            </p>
          )}
        </div>
      ) : (
        <div>
          <canvas
            ref={canvasRef}
            width={400}
            height={120}
            className="w-full bg-white border border-gray-300 rounded-lg touch-none"
            style={{ cursor: "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpath d=%22M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z%22/%3E%3C/svg%3E') 3 22, crosshair" }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          <button
            type="button"
            onClick={clearCanvas}
            className="mt-2 flex items-center gap-1 text-sm text-amber-100/50 hover:text-amber-100"
          >
            <Eraser className="w-4 h-4" />
            Clear
          </button>
        </div>
      )}

      {isDraggable && (drawnSignature || typedName) && (
        <div
          draggable
          onDragStart={handleDragStart}
          className="mt-4 p-4 rounded-lg border-2 border-dashed border-amber-500 bg-amber-500/10 cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-center gap-2 text-amber-200 text-sm">
            <GripHorizontal className="w-4 h-4" />
            <span>Drag signature to document</span>
          </div>
          
          {(drawnSignature || typedName) && (
            <div className="mt-3 flex items-center justify-center bg-white rounded p-2">
              {signatureType === "typed" && typedName ? (
                <span className="text-2xl text-black" style={{ fontFamily: "cursive" }}>
                  {typedName}
                </span>
              ) : drawnSignature ? (
                <img src={drawnSignature} alt="Your signature" className="max-h-16" />
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
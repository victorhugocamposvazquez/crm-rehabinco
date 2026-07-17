"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SignaturePadProps {
  label: string;
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  className?: string;
}

export function SignaturePad({
  label,
  value,
  onChange,
  disabled = false,
  className,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasStroke, setHasStroke] = useState(Boolean(value));

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const width = parent.clientWidth;
    const height = 160;
    const prev = canvas.toDataURL("image/png");
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "#111827";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    if (prev && prev.length > 100 && hasStroke) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, width, height);
      img.src = prev;
    } else if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        setHasStroke(true);
      };
      img.src = value;
    }
  }, [hasStroke, value]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const emitChange = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL("image/png"));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawing.current = true;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setHasStroke(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    emitChange();
  };

  const clear = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    setHasStroke(false);
    onChange(null);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {!disabled && (
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            Borrar
          </Button>
        )}
      </div>
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-border bg-white touch-none",
          disabled && "opacity-70"
        )}
      >
        <canvas
          ref={canvasRef}
          className="block w-full cursor-crosshair"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-label={label}
        />
      </div>
      <p className="text-xs text-neutral-500">
        Firma con el dedo o el ratón en el recuadro.
      </p>
    </div>
  );
}

// ── Scene preview with interactive source overlays ──────────────────
//
// Polls OBS for screenshots of the current scene. Draws positioned
// overlays for each source that can be clicked, dragged to move, and
// resized via corner handles — all directly on the preview canvas.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOBSStore } from '../store/obs-store';
import { getOBS } from '../obs/connection';
import { getSourceTransform, setSourceTransform } from '../obs/scene';

// ── Constants ────────────────────────────────────────────────────────

const POLL_INTERVAL = 500;
const TRANSFORM_POLL_INTERVAL = 2000;
const SCREENSHOT_WIDTH = 640;
const SCREENSHOT_HEIGHT = 360;
const CANVAS_W = 1920;
const CANVAS_H = 1080;

// ── Types ────────────────────────────────────────────────────────────

interface SourceTransform {
  sceneItemId: number;
  sourceName: string;
  positionX: number;
  positionY: number;
  scaleX: number;
  scaleY: number;
  sourceWidth: number;
  sourceHeight: number;
  rotation: number;
}

interface DragState {
  id: number;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
}

type ResizeCorner = 'tl' | 'tr' | 'bl' | 'br';

interface ResizeState {
  id: number;
  corner: ResizeCorner;
  startX: number;
  startY: number;
  origScaleX: number;
  origScaleY: number;
  origPosX: number;
  origPosY: number;
  sourceWidth: number;
  sourceHeight: number;
}

interface ScenePreviewProps {
  onImageDropped?: (filePath: string) => void;
  onSourceSelect?: (sourceName: string, sceneItemId: number) => void;
  selectedSource?: number | null;
}

// ── Component ────────────────────────────────────────────────────────

export function ScenePreview({
  onImageDropped,
  onSourceSelect,
  selectedSource: externalSelected,
}: ScenePreviewProps) {
  const connected = useOBSStore((s) => s.connected);
  const sources = useOBSStore((s) => s.sources);

  // Screenshot state
  const [src, setSrc] = useState<string | null>(null);
  const screenshotTimerRef = useRef<ReturnType<typeof setInterval>>();

  // Drag-and-drop file state
  const [dragOver, setDragOver] = useState(false);

  // Container sizing
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewSize, setPreviewSize] = useState({ w: 640, h: 360 });

  // Source transforms
  const [transforms, setTransforms] = useState<SourceTransform[]>([]);
  const transformTimerRef = useRef<ReturnType<typeof setInterval>>();

  // Selection — driven externally if provided, otherwise internal
  const [internalSelected, setInternalSelected] = useState<number | null>(null);
  const selectedSource = externalSelected !== undefined ? externalSelected : internalSelected;

  // Interaction state
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [resizing, setResizing] = useState<ResizeState | null>(null);
  const [hoveredSource, setHoveredSource] = useState<number | null>(null);

  // Scale factors
  const scaleFactorX = previewSize.w / CANVAS_W;
  const scaleFactorY = previewSize.h / CANVAS_H;

  // ── Container resize observer ────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      setPreviewSize({ w: el.clientWidth, h: el.clientHeight });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Screenshot polling ───────────────────────────────────────────

  useEffect(() => {
    if (!connected) {
      setSrc(null);
      return;
    }

    const capture = async () => {
      try {
        const obs = getOBS();
        const { currentProgramSceneName } = await obs.call<{
          currentProgramSceneName: string;
        }>('GetCurrentProgramScene');

        const res = await obs.call<{ imageData: string }>(
          'GetSourceScreenshot',
          {
            sourceName: currentProgramSceneName,
            imageFormat: 'jpg',
            imageWidth: SCREENSHOT_WIDTH,
            imageHeight: SCREENSHOT_HEIGHT,
            imageCompressionQuality: 70,
          },
        );
        setSrc(res.imageData);
      } catch {
        // OBS not ready or disconnected
      }
    };

    capture();
    screenshotTimerRef.current = setInterval(capture, POLL_INTERVAL);
    return () => clearInterval(screenshotTimerRef.current);
  }, [connected]);

  // ── Transform polling ────────────────────────────────────────────

  const fetchTransforms = useCallback(async () => {
    if (!connected || sources.length === 0) return;

    try {
      const obs = getOBS();
      const results: SourceTransform[] = [];

      for (const source of sources) {
        try {
          const t = await getSourceTransform(obs, source.sceneItemId);
          results.push({
            sceneItemId: source.sceneItemId,
            sourceName: source.sourceName,
            positionX: Number(t.positionX) || 0,
            positionY: Number(t.positionY) || 0,
            scaleX: Number(t.scaleX) || 1,
            scaleY: Number(t.scaleY) || 1,
            sourceWidth: Number(t.sourceWidth) || 0,
            sourceHeight: Number(t.sourceHeight) || 0,
            rotation: Number(t.rotation) || 0,
          });
        } catch {
          // Individual source transform fetch failed
        }
      }

      setTransforms(results);
    } catch {
      // OBS call failed
    }
  }, [connected, sources]);

  useEffect(() => {
    fetchTransforms();
    transformTimerRef.current = setInterval(fetchTransforms, TRANSFORM_POLL_INTERVAL);
    return () => clearInterval(transformTimerRef.current);
  }, [fetchTransforms]);

  // ── Drag-and-drop files ──────────────────────────────────────────

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const path = (file as any).path || file.name;
      onImageDropped?.(path);
    }
  };

  // ── Source drag (move) ───────────────────────────────────────────

  const startDrag = (e: React.MouseEvent, t: SourceTransform) => {
    e.preventDefault();
    e.stopPropagation();

    setInternalSelected(t.sceneItemId);
    onSourceSelect?.(t.sourceName, t.sceneItemId);

    setDragging({
      id: t.sceneItemId,
      startX: e.clientX,
      startY: e.clientY,
      origX: t.positionX,
      origY: t.positionY,
    });
  };

  // ── Source resize ────────────────────────────────────────────────

  const startResize = (e: React.MouseEvent, t: SourceTransform, corner: ResizeCorner) => {
    e.preventDefault();
    e.stopPropagation();

    setResizing({
      id: t.sceneItemId,
      corner,
      startX: e.clientX,
      startY: e.clientY,
      origScaleX: t.scaleX,
      origScaleY: t.scaleY,
      origPosX: t.positionX,
      origPosY: t.positionY,
      sourceWidth: t.sourceWidth,
      sourceHeight: t.sourceHeight,
    });
  };

  // ── Mouse move handler ───────────────────────────────────────────

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      const dx = (e.clientX - dragging.startX) / scaleFactorX;
      const dy = (e.clientY - dragging.startY) / scaleFactorY;
      const newX = dragging.origX + dx;
      const newY = dragging.origY + dy;

      setTransforms((prev) =>
        prev.map((t) =>
          t.sceneItemId === dragging.id
            ? { ...t, positionX: newX, positionY: newY }
            : t,
        ),
      );
      return;
    }

    if (resizing) {
      const t = transforms.find((tr) => tr.sceneItemId === resizing.id);
      if (!t || resizing.sourceWidth === 0) return;

      const dx = (e.clientX - resizing.startX) / scaleFactorX;
      const dy = (e.clientY - resizing.startY) / scaleFactorY;

      let newScaleX = resizing.origScaleX;
      let newScaleY: number;
      let newPosX = resizing.origPosX;
      let newPosY = resizing.origPosY;

      // Corner determines direction of scale change
      switch (resizing.corner) {
        case 'br':
          newScaleX = Math.max(0.05, resizing.origScaleX + dx / resizing.sourceWidth);
          break;
        case 'bl':
          newScaleX = Math.max(0.05, resizing.origScaleX - dx / resizing.sourceWidth);
          newPosX = resizing.origPosX + dx;
          break;
        case 'tr':
          newScaleX = Math.max(0.05, resizing.origScaleX + dx / resizing.sourceWidth);
          newPosY = resizing.origPosY + dy;
          break;
        case 'tl': {
          newScaleX = Math.max(0.05, resizing.origScaleX - dx / resizing.sourceWidth);
          newPosX = resizing.origPosX + dx;
          newPosY = resizing.origPosY + dy;
          break;
        }
      }

      // Lock aspect ratio
      newScaleY = newScaleX;

      // For top corners, adjust Y position based on scale change
      if (resizing.corner === 'tr' || resizing.corner === 'tl') {
        const heightDelta = (newScaleY - resizing.origScaleY) * resizing.sourceHeight;
        newPosY = resizing.origPosY - heightDelta;
      }

      // For left corners, adjust X position based on scale change
      if (resizing.corner === 'bl' || resizing.corner === 'tl') {
        const widthDelta = (newScaleX - resizing.origScaleX) * resizing.sourceWidth;
        newPosX = resizing.origPosX - widthDelta;
      }

      setTransforms((prev) =>
        prev.map((tr) =>
          tr.sceneItemId === resizing.id
            ? { ...tr, scaleX: newScaleX, scaleY: newScaleY, positionX: newPosX, positionY: newPosY }
            : tr,
        ),
      );
    }
  };

  // ── Mouse up handler ─────────────────────────────────────────────

  const handleMouseUp = () => {
    if (dragging) {
      const t = transforms.find((tr) => tr.sceneItemId === dragging.id);
      if (t) {
        const obs = getOBS();
        setSourceTransform(obs, dragging.id, {
          positionX: t.positionX,
          positionY: t.positionY,
        }).catch(() => {});
      }
      setDragging(null);
      return;
    }

    if (resizing) {
      const t = transforms.find((tr) => tr.sceneItemId === resizing.id);
      if (t) {
        const obs = getOBS();
        setSourceTransform(obs, resizing.id, {
          scaleX: t.scaleX,
          scaleY: t.scaleY,
          positionX: t.positionX,
          positionY: t.positionY,
        }).catch(() => {});
      }
      setResizing(null);
    }
  };

  // ── Click empty area to deselect ─────────────────────────────────

  const handleContainerClick = () => {
    if (!dragging && !resizing) {
      setInternalSelected(null);
    }
  };

  // ── Render ───────────────────────────────────────────────────────

  if (!connected) {
    return (
      <div className="rounded-lg overflow-hidden border border-studio-border bg-studio-surface aspect-video relative flex items-center justify-center">
        <div className="text-center">
          <p className="text-studio-muted text-sm">Waiting for OBS...</p>
          <p className="text-studio-muted/50 text-xs mt-1">Preview will appear when connected</p>
        </div>
      </div>
    );
  }

  // Resize handle positions: [corner, css props, cursor]
  const resizeHandles: Array<{
    corner: ResizeCorner;
    style: React.CSSProperties;
    cursor: string;
  }> = [
    { corner: 'tl', style: { top: -4, left: -4 }, cursor: 'nwse-resize' },
    { corner: 'tr', style: { top: -4, right: -4 }, cursor: 'nesw-resize' },
    { corner: 'bl', style: { bottom: -4, left: -4 }, cursor: 'nesw-resize' },
    { corner: 'br', style: { bottom: -4, right: -4 }, cursor: 'nwse-resize' },
  ];

  return (
    <div
      ref={containerRef}
      className={`rounded-lg overflow-hidden border bg-black aspect-video relative transition-colors select-none ${
        dragOver ? 'border-studio-accent border-2' : 'border-studio-border'
      }`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleContainerClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Preview image -- pointer-events disabled so overlays receive clicks */}
      {src ? (
        <img
          src={src}
          alt="Stream preview"
          className="w-full h-full object-contain"
          draggable={false}
          style={{ pointerEvents: 'none' }}
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="w-5 h-5 border-2 border-studio-border border-t-studio-accent rounded-full animate-spin" />
        </div>
      )}

      {/* Source overlays */}
      {transforms.map((t) => {
        const isSelected = selectedSource === t.sceneItemId;
        const isHovered = hoveredSource === t.sceneItemId;
        const renderedW = t.sourceWidth * t.scaleX * scaleFactorX;
        const renderedH = t.sourceHeight * t.scaleY * scaleFactorY;

        // Skip sources with zero dimensions (audio-only, etc.)
        if (renderedW < 1 || renderedH < 1) return null;

        return (
          <div
            key={t.sceneItemId}
            style={{
              position: 'absolute',
              left: t.positionX * scaleFactorX,
              top: t.positionY * scaleFactorY,
              width: renderedW,
              height: renderedH,
              border: isSelected
                ? '2px solid #ff6b00'
                : isHovered
                  ? '1px solid rgba(255,255,255,0.5)'
                  : '1px solid rgba(255,255,255,0)',
              cursor: dragging?.id === t.sceneItemId ? 'grabbing' : 'move',
              pointerEvents: 'auto',
              boxSizing: 'border-box',
              transition: dragging || resizing ? 'none' : 'border-color 0.15s',
            }}
            onMouseDown={(e) => startDrag(e, t)}
            onMouseEnter={() => setHoveredSource(t.sceneItemId)}
            onMouseLeave={() => setHoveredSource(null)}
          >
            {/* Source name label */}
            {(isSelected || isHovered) && (
              <div className="absolute -top-5 left-0 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">
                {t.sourceName}
              </div>
            )}

            {/* Resize handles — only for selected source */}
            {isSelected &&
              resizeHandles.map((handle) => (
                <div
                  key={handle.corner}
                  style={{
                    position: 'absolute',
                    ...handle.style,
                    width: 8,
                    height: 8,
                    background: '#ff6b00',
                    borderRadius: 2,
                    cursor: handle.cursor,
                    pointerEvents: 'auto',
                    zIndex: 2,
                  }}
                  onMouseDown={(e) => startResize(e, t, handle.corner)}
                />
              ))}
          </div>
        );
      })}

      {/* File drag overlay */}
      {dragOver && (
        <div className="absolute inset-0 bg-studio-accent/20 flex items-center justify-center z-10 pointer-events-none">
          <p className="text-white text-sm font-medium">Drop image here</p>
        </div>
      )}

      {/* PREVIEW badge */}
      <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-studio-muted pointer-events-none">
        PREVIEW
      </div>
    </div>
  );
}

# Stylus event handling source copy

Assembled excerpts copied from the current application source for the stylus interaction test case. Snippets retain their original code; headings and source locations are added for navigation. These excerpts depend on App-level state and helpers, so this Markdown file is a review copy rather than a standalone compilation unit.

### Stylus input settings state
Source: `src/App.tsx` lines 217-219
```tsx
  const [penPressure, setPenPressure] = createSignal(true);
  const [penTilt, setPenTilt] = createSignal(true);
  const [penEraser, setPenEraser] = createSignal(true);
```

### Pointer and drawing state
Source: `src/App.tsx` lines 373-389
```tsx
  let drawing = false;
  let activeDrawingTool: Preview["type"] = "pen";
  let currentPoints: StrokePoint[] = [];
  type StrokePathCache = { length: number; pressureAware: boolean; path?: Path2D; pressurePaths: Map<number, Path2D> };
  const strokePathCache = new WeakMap<StrokePoint[], StrokePathCache>();
  let penEraserDrawing = false;
  let laserTimer: number | undefined;
  let restartAutosave: (() => void) | undefined;
  const syncTracker = createWindowsSyncTracker();
  let syncPollTimer: number | undefined;
  let syncObservationTimer: number | undefined;
  let panOrigin: { x: number; y: number; panX: number; panY: number } | undefined;
  const touchPointers = new Map<number, Point>();
  const ignoredTouchPointers = new Set<number>();
  let activePenPointerId: number | undefined;
  let touchGesture: TouchGesture | undefined;
  let touchTapTracker: TouchTapTracker | undefined;
```

### Pointer-to-stroke pressure and tilt adapter
Source: `src/App.tsx` lines 776-776
```tsx
  const strokePointFromPointer = (event: PointerEvent, point: Point): StrokePoint => makeStrokePoint(event, point, penPressure(), penTilt());
```

### Pressure and tilt sample conversion
Source: `src/features/canvas/input.ts` lines 9-16
```tsx
export function strokePointFromPointer(event: PointerEvent, point: Point, pressureEnabled: boolean, tiltEnabled: boolean): StrokePoint {
  if (event.pointerType !== "pen") return point;
  return {
    ...point,
    ...(pressureEnabled ? { pressure: Math.max(0, Math.min(1, event.pressure > 0 ? event.pressure : .5)) } : {}),
    ...(tiltEnabled ? { tiltX: Math.max(-90, Math.min(90, event.tiltX)), tiltY: Math.max(-90, Math.min(90, event.tiltY)) } : {}),
  };
}
```

### Window blur cancellation for active stylus interaction
Source: `src/App.tsx` lines 1767-1771
```tsx
    const blur = () => {
      setSpaceDown(false);
      activePenPointerId = undefined; ignoredTouchPointers.clear(); touchPointers.clear(); touchGesture = undefined; touchTapTracker = undefined;
      cancelCanvasInteraction();
    };
```

### Window blur handler registration
Source: `src/App.tsx` line 1803
``tsx
window.addEventListener("blur", blur)
````

### Window blur handler cleanup
Source: `src/App.tsx` line 1819
``tsx
window.removeEventListener("blur", blur)
````

### Canvas raw pointer event registration and cleanup
Source: `src/App.tsx` lines 1623-1624
```tsx
    const rawPen = (event: PointerEvent) => pointerRawUpdate(event);
    canvas.addEventListener("pointerrawupdate", rawPen as EventListener);
```

### Canvas raw pointer event cleanup
Source: `src/App.tsx` lines 1634-1634
```tsx
    onCleanup(() => { resize.disconnect(); canvas.removeEventListener("wheel", wheel); canvas.removeEventListener("pointerrawupdate", rawPen as EventListener); window.removeEventListener("resize", scheduleCanvasRender); window.visualViewport?.removeEventListener("resize", scheduleCanvasRender); });
```

### Canvas interaction start: pen, stylus eraser, and capture
Source: `src/App.tsx` lines 2939-3022
```tsx
  function beginCanvasInteraction(event: PointerEvent) {
    if (!activePath()) return;
    if (noteEditor()) saveNoteEditor();
    setContextMenu(undefined); penEraserDrawing = false;
    const isPenEraser = !readOnlyView() && penEraser() && event.pointerType === "pen" && (event.button === 5 || (event.buttons & 32) !== 0);
    if (textDraft()) { commitTextDraft(); if (tool() === "text" && !isPenEraser) return; }
    if (!isPenEraser && (event.button === 1 || spaceDown() || tool() === "pan")) {
      event.preventDefault(); setIsPanning(true); panOrigin = { x: event.clientX, y: event.clientY, panX: canvasState().panX, panY: canvasState().panY }; canvas.setPointerCapture(event.pointerId); return;
    }
    if (event.button !== 0 && !isPenEraser) return;
    const point = toWorld(event);
    if (readOnlyView() && tool() === "laser") {
      const hit = hitTest(point); const target = hit === undefined ? undefined : elements()[hit];
      if (hit !== undefined && target?.type === "group" && target.note && noteCollapseHit(target, point)) {
        toggleNoteCollapsed(hit); canvas.setPointerCapture(event.pointerId); return;
      }
    }
    if (boardLocked() && tool() !== "laser") return;
    if (isPenEraser) { event.preventDefault(); penEraserDrawing = true; drawing = true; eraseAtPoint(point); canvas.setPointerCapture(event.pointerId); return; }
    if (tool() === "select") {
      const handle = findTransformHandle(point);
      if (handle) { const original = elements()[handle.index]; resizeOrigin = { ...handle, start: point, original, before: elements(), moved: false }; canvas.setPointerCapture(event.pointerId); return; }
      const hit = hitTest(point);
      if (hit !== undefined) {
        const target = elements()[hit];
        if (target?.type === "group" && target.note && noteCollapseHit(target, point)) { toggleNoteCollapsed(hit); canvas.setPointerCapture(event.pointerId); return; }
        if (target?.type === "group" && target.note?.kind === "checklist") {
          const row = checklistIndexAt(target, point);
          if (row !== undefined) { toggleChecklist(hit, row); canvas.setPointerCapture(event.pointerId); return; }
        }
        const current = selectedIndices();
        const next = event.shiftKey
          ? current.includes(hit) ? current.filter((index) => index !== hit) : [...current, hit]
          : current.includes(hit) ? current : [hit];
        setSelectedIndices(next);
        setSidebarTab("properties");
        const movable = next.filter((index) => { const element = elements()[index]; return !!element && canMoveElement(element); });
        if (movable.includes(hit)) {
          const before = elements();
          moveOrigin = { indices: movable, point, before, moved: false, dx: 0, dy: 0, snapTargets: collectSnapTargets(movable, before), targets: collectMoveTargets(movable, before) };
        }
      } else {
        if (!event.shiftKey) setSelectedIndices([]);
        marqueeOrigin = { point, additive: event.shiftKey, moved: false };
        setMarquee({ start: point, end: point });
      }
      canvas.setPointerCapture(event.pointerId); return;
    }
    if (tool() === "line" || tool() === "arrow") {
      const handle = findTransformHandle(point);
      if (handle && isConnector(elements()[handle.index])) {
        const original = elements()[handle.index];
        resizeOrigin = { ...handle, start: point, original, before: elements(), moved: false };
        canvas.setPointerCapture(event.pointerId); return;
      }
    }
    if (tool() === "text") {
      const activeTextMode = textMode();
      if (activeTextMode !== "text") {
        const hit = hitTest(point); const element = hit === undefined ? undefined : elements()[hit];
        if (element?.type === "group" && element.note && (activeTextMode === "markdown" || activeTextMode === "table" || element.note.kind === activeTextMode)) openNoteEditor(point, element.note.kind, hit);
        else if (activeTextMode === "markdown") openNoteEditor(point, "note", undefined, { title: "Markdown" });
        else if (activeTextMode === "table") openNoteEditor(point, "note", undefined, { title: "Markdown table", content: "| Column 1 | Column 2 |\n| --- | --- |\n| Cell | Cell |\n| Cell | Cell |" });
        else openNoteEditor(point, activeTextMode);
        return;
      }
      const hit = hitTest(point) ?? hitInterior(point); if (hit !== undefined && isLabelShape(elements()[hit])) editShapeLabel(hit, event.pointerId); else startTextDraft(point, hit !== undefined && elements()[hit]?.type === "text" ? hit : undefined, event.pointerId); return;
    }
    if (tool() === "bucket") { const hit = hitInterior(point); if (hit !== undefined) updatePropertyForIndex(hit, fillColor()); return; }
    if (tool() === "eraser") { eraseAtPoint(point); drawing = true; canvas.setPointerCapture(event.pointerId); return; }
    if (tool() === "crop") { const hit = hitTest(point); if (hit !== undefined && elements()[hit].type === "image") { setSelectedIndices([hit]); marqueeOrigin = { point, additive: false, moved: false, cropIndex: hit }; setMarquee({ start: point, end: point }); canvas.setPointerCapture(event.pointerId); } return; }
    drawing = true; canvas.setPointerCapture(event.pointerId);
    activeDrawingTool = tool() === "laser" ? "pen" : tool() as Preview["type"];
    const start = activeDrawingTool === "line" || activeDrawingTool === "arrow" ? nearestBinding(elements(), point, 18 / canvasState().zoom)?.point ?? snap(point) : activeDrawingTool === "pen" ? point : snap(point);
    if (activeDrawingTool === "pen") {
      const laser = tool() === "laser"; const mode = brushMode();
      const strokePoint = tool() === "pen" ? strokePointFromPointer(event, point) : point; currentPoints = [strokePoint];
      const brushStyle: Record<BrushMode, { width: number; opacity: number }> = { fine: { width: 1, opacity: 1 }, pencil: { width: .72, opacity: .62 }, brush: { width: 2.2, opacity: .9 }, marker: { width: 3, opacity: .78 }, highlighter: { width: 6, opacity: .28 }, chalk: { width: 1.7, opacity: .48 } };
      const style = brushStyle[mode];
      setPreview({ type: "pen", start: point, end: point, color: laser ? laserColor() : color(), thickness: laser ? laserThickness() / canvasState().zoom : Math.max(mode === "highlighter" ? 12 : mode === "marker" ? 6 : 1, thickness() * style.width), opacity: laser ? 1 : style.opacity });
    }
    else setPreview({ type: activeDrawingTool, start, end: start, color: color(), thickness: thickness(), ...(activeDrawingTool === "flowchart" ? { flowchartShape: flowchartShape() } : {}), ...(activeDrawingTool === "line" ? { lineRoute: lineRoute() } : {}), ...(activeDrawingTool === "arrow" ? { arrowRoute: arrowRoute() } : {}) });
  }

```

### Interaction cancellation cleanup
Source: `src/App.tsx` lines 3033-3041
```tsx
  function cancelCanvasInteraction() {
    if (resizeOrigin) setElements(resizeOrigin.before);
    if (moveOrigin) { moveOrigin = undefined; scheduleCanvasRender(); }
    drawing = false; currentPoints = []; penEraserDrawing = false;
    setPreview(undefined); setMarquee(undefined); setAttachmentHint(undefined); setAlignmentGuides(undefined);
    resizeOrigin = undefined; moveOrigin = undefined; marqueeOrigin = undefined; panOrigin = undefined;
    setIsPanning(false);
  }

```

### Pointer down: stylus ownership and touch suppression
Source: `src/App.tsx` lines 3042-3084
```tsx
  function pointerDown(event: PointerEvent) {
    if (!activePath()) return;
    if (event.pointerType === "pen") event.preventDefault();
    if (event.pointerType === "touch" && activePenPointerId !== undefined && !drawing && !panOrigin && !resizeOrigin && !moveOrigin && !marqueeOrigin) activePenPointerId = undefined;
    if (activePenPointerId !== undefined && event.pointerType !== "touch" && event.pointerId !== activePenPointerId) return;
    if (event.pointerType === "pen") {
      activePenPointerId = event.pointerId;
      if (touchPointers.size) {
        touchPointers.clear(); touchGesture = undefined; touchTapTracker = undefined;
        cancelCanvasInteraction();
      }
    }
    if (event.pointerType === "touch" && activePenPointerId !== undefined) {
      ignoredTouchPointers.add(event.pointerId);
      event.preventDefault();
      return;
    }
    if (event.target === canvas && isCompactTouchLayout() && (event.pointerType !== "mouse" || !!touchStylePanel()) &&
      (canvasOptionsOpen() || !!touchStylePanel() || !!openToolOptions() || stencilMenuOpen() || paintBrushMenuOpen() || !!quickStylePopover() || !!contextMenu() || !!document.querySelector("details[open]") || !!noteEditor() || !!textDraft())) {
      if (noteEditor()) saveNoteEditor();
      if (textDraft()) commitTextDraft();
      event.preventDefault();
      return;
    }
    if (event.pointerType === "touch") {
      const point = { x: event.clientX, y: event.clientY };
      touchPointers.set(event.pointerId, point);
      if (!touchTapTracker && touchPointers.size === 1) touchTapTracker = { startedAt: performance.now(), starts: new Map([[event.pointerId, point]]), maxFingers: 1, canceled: false, initialEvent: event };
      else if (touchTapTracker) {
        if (performance.now() - touchTapTracker.startedAt > 280 || touchPointers.size > 3) touchTapTracker.canceled = true;
        touchTapTracker.starts.set(event.pointerId, point);
        touchTapTracker.maxFingers = Math.max(touchTapTracker.maxFingers, Math.min(3, touchPointers.size));
      }
      if (startTouchGesture(event)) return;
      if (touchPointers.size === 1 && !readOnlyView() && (oneFingerTapAction() !== "none" || oneFingerDragAction() === "pan")) {
        event.preventDefault();
        try { canvas.setPointerCapture(event.pointerId); } catch { /* The pointer can be canceled before capture. */ }
        return;
      }
    }
    beginCanvasInteraction(event);
  }

```

### Stroke sample collection and raw stylus updates
Source: `src/App.tsx` lines 3085-3105
```tsx
  function appendStrokeSample(event: PointerEvent, point: Point) {
    const previous = currentPoints[currentPoints.length - 1];
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) * canvasState().zoom < .05) return;
    currentPoints.push(tool() === "pen" ? strokePointFromPointer(event, point) : point);
  }

  function appendPenSamples(event: PointerEvent, appendTerminal = true) {
    const bounds = canvas.getBoundingClientRect(); const state = canvasState();
    let samples: PointerEvent[] = [];
    try { samples = event.getCoalescedEvents?.() ?? []; } catch { /* Some Android WebViews expose this API without implementing it. */ }
    for (const sample of samples) appendStrokeSample(sample, { x: (sample.clientX - bounds.left - state.panX) / state.zoom, y: (sample.clientY - bounds.top - state.panY) / state.zoom });
    if (appendTerminal) appendStrokeSample(event, { x: (event.clientX - bounds.left - state.panX) / state.zoom, y: (event.clientY - bounds.top - state.panY) / state.zoom });
  }

  function pointerRawUpdate(event: PointerEvent) {
    if (event.pointerType !== "pen" || !drawing || activePenPointerId !== event.pointerId || activeDrawingTool !== "pen" || !preview()) return;
    const previousLength = currentPoints.length;
    appendPenSamples(event);
    if (currentPoints.length !== previousLength) scheduleCanvasRender();
  }

```

### Pointer move: stylus sampling and eraser movement
Source: `src/App.tsx` lines 3106-3163
```tsx
  function pointerMove(event: PointerEvent) {
    if (activePenPointerId !== undefined && event.pointerType !== "touch" && event.pointerId !== activePenPointerId) return;
    if (ignoredTouchPointers.has(event.pointerId) || event.pointerType === "touch" && !touchPointers.has(event.pointerId)) return;
    if (event.pointerType === "touch" && touchPointers.has(event.pointerId)) {
      touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const start = touchTapTracker?.starts.get(event.pointerId);
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > TOUCH_DRAG_THRESHOLD && touchTapTracker) {
        const tap = touchTapTracker;
        tap.canceled = true;
        if (!readOnlyView() && tap.maxFingers === 1 && !tap.deferredInteractionStarted && (oneFingerTapAction() !== "none" || oneFingerDragAction() === "pan")) {
          tap.deferredInteractionStarted = true;
          if (oneFingerDragAction() === "pan") beginTouchPan(tap.initialEvent);
          else beginCanvasInteraction(tap.initialEvent);
        }
      }
      if (touchGesture) { updateTouchGesture(); return; }
    }
    if (marqueeOrigin) {
      const end = toWorld(event);
      if (Math.hypot(end.x - marqueeOrigin.point.x, end.y - marqueeOrigin.point.y) > 2 / canvasState().zoom) marqueeOrigin.moved = true;
      setMarquee((current) => current ? { ...current, end } : undefined); return;
    }
    if (panOrigin) {
      setCanvasState({ ...canvasState(), panX: panOrigin.panX + event.clientX - panOrigin.x, panY: panOrigin.panY + event.clientY - panOrigin.y }); setDirty(!readOnlyView());
      return;
    }
    if (resizeOrigin) {
      const point = toWorld(event); if (Math.hypot(point.x - resizeOrigin.start.x, point.y - resizeOrigin.start.y) > 0.5) resizeOrigin.moved = true;
      const resized = resizeElement(resizeOrigin.original, resizeOrigin.handle, resizeOrigin.start, point);
      setElementsTransient(resizeOrigin.before.map((element, index) => index === resizeOrigin!.index ? resized : element)); setDirty(true); return;
    }
    if (moveOrigin) {
      const point = toWorld(event); const dx = point.x - moveOrigin.point.x; const dy = point.y - moveOrigin.point.y;
      if (Math.hypot(dx, dy) > 0.5) moveOrigin.moved = true;
      if (moveOrigin.moved) {
        const snapped = snapTranslation(moveOrigin.indices, moveOrigin.before, dx, dy, moveOrigin.snapTargets);
        moveOrigin.dx = snapped.dx; moveOrigin.dy = snapped.dy; scheduleCanvasRender(); setDirty(true);
      }
      return;
    }
    if (!drawing) {
      const point = toWorld(event); const hit = tool() === "select" || readOnlyView() ? hitTest(point) : undefined;
      setHoveredIndex(hit);
      const target = hit === undefined ? undefined : elements()[hit];
      setNoteToggleHovered(target?.type === "group" && !!target.note && noteCollapseHit(target, point));
      return;
    }
    if (penEraserDrawing || tool() === "eraser") { eraseAtPoint(toWorld(event)); return; }
    const raw = toWorld(event); const port = activeDrawingTool === "line" || activeDrawingTool === "arrow" ? nearestBinding(elements(), raw, 18 / canvasState().zoom) : undefined; setAttachmentHint(port?.point); const point = port?.point ?? (activeDrawingTool === "pen" ? raw : snap(raw));
    if (activeDrawingTool === "pen") {
      if (event.pointerType === "pen") {
        event.preventDefault();
        appendPenSamples(event);
      } else appendStrokeSample(event, point);
    }
    setPreview((previous) => previous ? { ...previous, end: point } : undefined);
  }

```

### Erase helper used by the stylus eraser end
Source: `src/App.tsx` lines 3249-3253
```tsx
  function eraseAtPoint(point: Point) {
    const hit = hitTest(point); if (hit === undefined) return;
    const before = cloneElements(elements()); setElements((items) => items.filter((_, index) => index !== hit)); setSelectedIndices((indices) => indices.filter((index) => index !== hit).map((index) => index > hit ? index - 1 : index)); pushUndo(before); setDirty(true);
  }

```

### Pointer cancel and lost capture
Source: `src/App.tsx` lines 3254-3266
```tsx
  function pointerCancel(event: PointerEvent) {
    if (textEditorPendingPointerId === event.pointerId) textEditorPendingPointerId = undefined;
    if (activePenPointerId !== undefined && event.pointerType !== "touch" && event.pointerId !== activePenPointerId) return;
    if (ignoredTouchPointers.delete(event.pointerId) || event.pointerType === "touch" && !touchPointers.has(event.pointerId)) return;
    if (event.pointerType === "pen" && activePenPointerId === event.pointerId) activePenPointerId = undefined;
    touchPointers.clear(); touchGesture = undefined; touchTapTracker = undefined;
    cancelCanvasInteraction();
  }

  function pointerLostCapture(event: PointerEvent) {
    if (event.pointerType === "pen" && activePenPointerId === event.pointerId || event.pointerType === "touch" && touchPointers.has(event.pointerId)) pointerCancel(event);
  }

```

### Pointer up: finish stylus stroke or eraser gesture
Source: `src/App.tsx` lines 3267-3423
```tsx
  function pointerUp(event: PointerEvent) {
    if (activePenPointerId !== undefined && event.pointerType !== "touch" && event.pointerId !== activePenPointerId) return;
    if (ignoredTouchPointers.delete(event.pointerId) || event.pointerType === "touch" && !touchPointers.has(event.pointerId)) return;
    if (event.pointerType === "pen" && activePenPointerId === event.pointerId) activePenPointerId = undefined;
    if (textEditorPendingPointerId === event.pointerId) {
      textEditorPendingPointerId = undefined;
      textEditorFocusOnCanvasClick = true;
      focusTextEditor();
      textEditorFocusTimer = window.setTimeout(() => {
        textEditorFocusTimer = undefined;
        textEditorFocusOnCanvasClick = false;
        focusTextEditor();
      }, 0);
    }
    let handledTapAction = false;
    if (event.pointerType === "touch") {
      const start = touchTapTracker?.starts.get(event.pointerId);
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > TOUCH_DRAG_THRESHOLD && touchTapTracker) touchTapTracker.canceled = true;
      touchPointers.delete(event.pointerId);
      if (touchPointers.size === 0) {
        const tap = touchTapTracker;
        touchTapTracker = undefined;
        if (!readOnlyView() && tap && !tap.canceled && performance.now() - tap.startedAt <= 500) {
          if (tap.maxFingers === 1 && oneFingerTapAction() !== "none") { runTouchTapAction(oneFingerTapAction()); handledTapAction = true; }
          else if (tap.maxFingers === 2 && twoFingerTapAction() !== "none") { runTouchTapAction(twoFingerTapAction()); handledTapAction = true; }
          else if (tap.maxFingers === 3 && threeFingerTapAction() !== "none") { runTouchTapAction(threeFingerTapAction()); handledTapAction = true; }
        }
      }
      if (touchGesture) {
        if (touchPointers.size < 2) { touchGesture = undefined; setIsPanning(false); }
        else startTouchGesture(event);
        return;
      }
      if (handledTapAction) return;
    }
    setAttachmentHint(undefined);
    if (panOrigin) { panOrigin = undefined; setIsPanning(false); return; }
    if (marqueeOrigin) {
      const activeMarquee = marquee();
      if (activeMarquee && marqueeOrigin.moved) {
        const box = { x: Math.min(activeMarquee.start.x, activeMarquee.end.x), y: Math.min(activeMarquee.start.y, activeMarquee.end.y), w: Math.abs(activeMarquee.end.x - activeMarquee.start.x), h: Math.abs(activeMarquee.end.y - activeMarquee.start.y) };
        if (marqueeOrigin.cropIndex !== undefined) {
          const index = marqueeOrigin.cropIndex; const image = elements()[index]; const bitmap = image?.type === "image" ? imageCache.get(image.dataUrl) : undefined;
          if (image?.type === "image" && bitmap?.naturalWidth && box.w > 2 && box.h > 2) {
            const sourceX = image.cropX ?? 0; const sourceY = image.cropY ?? 0; const sourceW = image.cropW ?? bitmap.naturalWidth; const sourceH = image.cropH ?? bitmap.naturalHeight;
            const left = Math.max(image.x, box.x); const top = Math.max(image.y, box.y); const right = Math.min(image.x + image.w, box.x + box.w); const bottom = Math.min(image.y + image.h, box.y + box.h);
            if (right > left && bottom > top) { const before = cloneElements(elements()); const sx = sourceX + (left - image.x) / image.w * sourceW; const sy = sourceY + (top - image.y) / image.h * sourceH; const sw = (right - left) / image.w * sourceW; const sh = (bottom - top) / image.h * sourceH; setElements((items) => items.map((element, current) => current === index && element.type === "image" ? { ...element, x: left, y: top, w: right - left, h: bottom - top, cropX: sx, cropY: sy, cropW: sw, cropH: sh } : element)); pushUndo(before); setDirty(true); }
          }
          marqueeOrigin = undefined; setMarquee(undefined); return;
        }
        const overlaps: number[] = [];
        elements().forEach((element, index) => {
          if (element.hidden || element.locked) return;
          const bounds = elementBounds(element);
          if (bounds.x >= box.x && bounds.y >= box.y && bounds.x + bounds.w <= box.x + box.w && bounds.y + bounds.h <= box.y + box.h) overlaps.push(index);
        });
        setSelectedIndices(marqueeOrigin.additive ? [...new Set([...selectedIndices(), ...overlaps])] : overlaps);
        setSidebarTab("properties");
      }
      marqueeOrigin = undefined; setMarquee(undefined); return;
    }
    if (resizeOrigin) { const origin = resizeOrigin; if (origin.moved) { setElements(elements()); pushUndo(origin.before); } resizeOrigin = undefined; return; }
    if (moveOrigin) {
      const origin = moveOrigin;
      if (origin.moved) {
        const selected = new Set(origin.indices);
        setElements(origin.before.map((element, index) => selected.has(index) ? moveElement(element, origin.dx, origin.dy) : element));
        pushUndo(origin.before);
      }
      moveOrigin = undefined; setAlignmentGuides(undefined); scheduleCanvasRender(); return;
    }
    if (!drawing) return;
    if (penEraserDrawing) { penEraserDrawing = false; drawing = false; return; }
    if (tool() === "eraser") { drawing = false; return; }
    if (activeDrawingTool === "pen") {
      if (event.pointerType === "pen") event.preventDefault();
      if (event.pointerType === "pen") appendPenSamples(event, false);
      const end = toWorld(event); const last = currentPoints[currentPoints.length - 1];
      if (last && Math.hypot(end.x - last.x, end.y - last.y) * canvasState().zoom >= .05) {
        currentPoints.push(tool() === "pen" ? { ...end, pressure: last.pressure, tiltX: last.tiltX, tiltY: last.tiltY } : end);
      }
    }
    drawing = false; const activePreview = preview();
    if (tool() === "laser") {
      if (activePreview && currentPoints.length) {
        setLaserTrail({ points: [...currentPoints], opacity: 1 });
        window.clearInterval(laserTimer);
        const startedAt = Date.now();
        laserTimer = window.setInterval(() => setLaserTrail((trail) => {
          if (!trail) return undefined;
          const opacity = 1 - (Date.now() - startedAt) / laserFadeDuration();
          if (opacity <= 0) { window.clearInterval(laserTimer); laserTimer = undefined; return undefined; }
          return { ...trail, opacity };
        }), 32);
      }
      currentPoints = []; setPreview(undefined); return;
    }
    if (activePreview) {
      const item: Element = activePreview.type === "pen"
        ? { type: "freehand", points: [...currentPoints], color: activePreview.color, thickness: activePreview.thickness, opacity: activePreview.opacity }
        : { type: activePreview.type, x: activePreview.start.x, y: activePreview.start.y, w: activePreview.end.x - activePreview.start.x, h: activePreview.end.y - activePreview.start.y, color: activePreview.color, thickness: activePreview.thickness, lineStyle: lineStyle(), edgeStyle: edgeStyle(), cornerRadius: cornerRadius(), flowchartShape: activePreview.type === "flowchart" ? activePreview.flowchartShape : undefined, lineRoute: activePreview.type === "line" ? activePreview.lineRoute : undefined, routePoints: activePreview.type === "line" && activePreview.lineRoute === "multi" ? [0.2, 0.4, 0.6, 0.8].map((ratio) => ({ x: activePreview.start.x + (activePreview.end.x - activePreview.start.x) * ratio, y: activePreview.start.y + (activePreview.end.y - activePreview.start.y) * ratio })) : undefined, arrowRoute: activePreview.type === "arrow" ? activePreview.arrowRoute : undefined, ...(fillEnabled() && (activePreview.type === "rectangle" || activePreview.type === "circle" || activePreview.type === "diamond" || activePreview.type === "triangle" || activePreview.type === "flowchart") ? { fillColor: fillColor(), fillOpacity: fillOpacity() } : {}), ...(activePreview.type === "line" ? { startHead: defaultLineStartHead(), endHead: defaultLineEndHead() } : {}), ...(activePreview.type === "arrow" ? { startHead: defaultStartHead(), endHead: defaultEndHead(), ...(activePreview.arrowRoute === "forked" ? { forkUpper: { endHead: defaultForkUpperHead() }, forkLower: { endHead: defaultForkLowerHead() } } : {}) } : {}) } as ShapeElement;
      const valid = activePreview.type === "pen" ? currentPoints.length > 0 : Math.hypot(activePreview.end.x - activePreview.start.x, activePreview.end.y - activePreview.start.y) > 1;
      if (isConnector(item)) {
        item.startBinding = nearestBinding(elements(), activePreview.start, 18 / canvasState().zoom)?.binding;
        item.endBinding = nearestBinding(elements(), activePreview.end, 18 / canvasState().zoom)?.binding;
        if (item.type === "arrow" && item.arrowRoute === "forked") {
          const fork = forkGeometry(item); const upper = nearestBinding(elements(), fork.upper, 18 / canvasState().zoom); const lower = nearestBinding(elements(), fork.lower, 18 / canvasState().zoom);
          if (upper) item.forkUpper = { ...(item.forkUpper ?? {}), end: upper.point, endBinding: upper.binding };
          if (lower) item.forkLower = { ...(item.forkLower ?? {}), end: lower.point, endBinding: lower.binding };
        }
      }
      if (valid) {
        const newIndex = elements().length;
        pushUndo(cloneElements(elements())); setElements((items) => [...items, item]); setDirty(true);
        if (isConnector(item)) { setSelectedIndices([newIndex]); setSidebarTab("properties"); }
      }
    }
    currentPoints = []; setPreview(undefined);
  }

  const tools: { value: Tool; label: string; key: string; path: string }[] = [
    { value: "select", label: "Select", key: "V", path: "M5 3l14 11-7 .8-3 6z" },
    { value: "pan", label: "Hand / Pan", key: "Space", path: "M8 11V5a1.5 1.5 0 0 1 3 0v5-6a1.5 1.5 0 0 1 3 0v6-5a1.5 1.5 0 0 1 3 0v7-3a1.5 1.5 0 0 1 3 0v5c0 5-3 8-8 8h-1c-3 0-5-2-6-4l-2-4a1.5 1.5 0 0 1 2.5-1.5L8 15" },
    { value: "pen", label: "Pen", key: "P", path: "M4 20l4.5-1 10.8-10.8a2.2 2.2 0 0 0-3.1-3.1L5.4 15.9 4 20zM14.8 6.3l3 3" },
    { value: "laser", label: "Laser pointer", key: "Y", path: "M5 19 17 7m-8 0 8 0 0 8M5 5l1 1M19 19l-1-1" },
    { value: "line", label: "Line", key: "L", path: "M4 20L20 4" },
    { value: "arrow", label: "Arrow", key: "A", path: "M4 20 20 4m-11 0h11v11" },
    { value: "rectangle", label: "Rectangle", key: "R", path: "M5 5h14v14H5z" },
    { value: "circle", label: "Circle", key: "C", path: "M19.5 12a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0z" },
    { value: "diamond", label: "Diamond", key: "D", path: "M12 3 21 12 12 21 3 12z" },
    { value: "triangle", label: "Triangle", key: "N", path: "M12 4 21 20H3z" },
    { value: "flowchart", label: "Flowchart shapes", key: "F", path: "M4 4h6v6H4zM14 4h6v6h-6zM9 14l4 0 3 3-3 3H9l-3-3z" },
    { value: "text", label: "Text", key: "T", path: "M5 6h14M12 6v13M8 19h8" },
    { value: "bucket", label: "Fill bucket", key: "B", path: "M4 14l6-6 8 8-6 6H4zM10 8l3-3 8 8-3 3M18 19h.01" },
    { value: "eraser", label: "Eraser", key: "E", path: "M3 14l9-10 9 9-8 8H7zM12 18l5-5" },
    { value: "crop", label: "Crop image", key: "X", path: "M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M8 8h8v8H8z" },
  ];
  const toolGroups: { id: string; label: string; tools: Tool[] }[] = readOnlyView() ? [
    { id: "laser", label: "Laser pointer", tools: ["laser"] },
  ] : isWindowsPlatform() ? [
    { id: "navigation", label: "Navigation", tools: ["select", "pan"] },
    { id: "drawing", label: "Drawing", tools: ["pen", "eraser"] },
    { id: "laser", label: "Laser", tools: ["laser"] },
    { id: "connectors", label: "Connectors", tools: ["line", "arrow"] },
    { id: "shapes", label: "Shapes", tools: ["rectangle", "circle", "diamond", "triangle", "flowchart"] },
    { id: "content", label: "Text and image tools", tools: ["text", "bucket", "crop"] },
  ] : [
    { id: "navigation", label: "Navigation", tools: ["select", "pan"] },
    { id: "drawing", label: "Drawing", tools: ["pen", "laser"] },
    { id: "connectors", label: "Connectors", tools: ["line", "arrow"] },
    { id: "shapes", label: "Shapes", tools: ["rectangle", "circle", "diamond", "triangle", "flowchart"] },
    { id: "content", label: "Text and image tools", tools: ["text", "bucket", "eraser", "crop"] },
  ];
  const mobileEssentialTools = new Set<Tool>(["select", "pan", "pen", "eraser", "laser"]);
  const swatches = ["#252525", "#e76b62", "#6b91c9", "#74a582", "#d8a448", "#a581bb", "#e5915b"];
  const helpShortcuts: [string, string][] = [["V", "Select tool"], ["Space", "Hold to pan"], ["P", "Fine pen"], ["Y", "Laser pointer"], ["R", "Rectangle"], ["C / O", "Circle"], ["D", "Diamond"], ["N", "Triangle"], ["L", "Line"], ["A", "Arrow"], ["F", "Flowchart symbol"], ["T", "Text"], ["B", "Fill bucket"], ["E", "Eraser"], ["X", "Image crop"], ["Esc", "Pan tool and clear selection"], ["G", "Toggle grid"], ["Shift+G", "Snap to grid"], ["Shift+O", "Snap to objects"], ["K", "Lock canvas"], ["0", "Center view at 100%"], ["1 / 2", "Fit drawing / selection"], ["Ctrl / Cmd + N", "New sketch"], ["Ctrl / Cmd + O", "Open sketch"], ["Ctrl / Cmd + S", "Save"], ["Ctrl / Cmd + Z", "Undo"], ["Ctrl / Cmd + Y", "Redo"], ["Ctrl / Cmd + C / X / V", "Copy / cut / paste"], ["Ctrl / Cmd + D", "Duplicate selection"], ["Ctrl / Cmd + A", "Select all"], ["Ctrl / Cmd + G", "Group selection"], ["Ctrl / Cmd + Shift + G", "Ungroup"], ["Delete / Backspace", "Delete selection"], ["Arrow keys", "Nudge by 1 px"], ["Shift+Arrow", "Nudge by 10 px"], ["F1", "Open Help"]];
  const updateTextDraft = (value: string) => setTextDraft((draft) => draft ? { ...draft, value } : undefined);
```

### Canvas pointer handler bindings
Source: `src/App.tsx` line 3895 (attributes copied from the canvas element)
``tsx
onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel} onLostPointerCapture={pointerLostCapture}
````

### Desktop pressure, tilt, and stylus eraser controls
Source: `src/App.tsx` lines 4057-4057
```tsx
                    <Show when={quickStylePopover() === "penInput" && tool() === "pen"}><div class="quick-style-popover pen-input-popover" aria-label="Stylus input options"><strong>Pen options</strong><label><input type="checkbox" checked={penPressure()} onChange={event => setPenPressure(event.currentTarget.checked)} /> Pressure width</label><label><input type="checkbox" checked={penTilt()} onChange={event => setPenTilt(event.currentTarget.checked)} /> Tilt shaping</label><label><input type="checkbox" checked={penEraser()} onChange={event => setPenEraser(event.currentTarget.checked)} /> Eraser end</label><small>Uses pressure, tilt, and eraser data reported by a compatible stylus.</small></div></Show>
```

### Mobile stylus settings callback types
Source: `src/platform/mobile/TouchStylePanel.tsx` lines 78-80
```tsx
  onPenPressureChange: (enabled: boolean) => void;
  onPenTiltChange: (enabled: boolean) => void;
  onPenEraserChange: (enabled: boolean) => void;
```

### Mobile pressure, tilt, and eraser control handlers
Source: `src/platform/mobile/TouchStylePanel.tsx` lines 124-124
```tsx
      {props.tool === "pen" && <section class="touch-style-section"><div class="touch-style-section-title"><strong>Pen and brush</strong></div><div class="touch-brush-grid">{BRUSHES.map(brush => <button class={props.brushMode === brush.value ? "active" : ""} aria-pressed={props.brushMode === brush.value} disabled={props.locked} onClick={() => props.onBrushModeChange(brush.value)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={brush.value === "fine" ? "m5 18 13-12M4 21h16" : brush.value === "pencil" ? "m5 19 11-11 3 3L8 22H5zm10-13 2-2 4 4-2 2" : brush.value === "brush" ? "M5 17c4 0 3-7 8-7 4 0 4 4 7 4M5 20h14" : brush.value === "marker" ? "M5 18 17 6l3 3L8 21H5zm9-9 3 3" : brush.value === "highlighter" ? "M4 16 15 5l5 5-11 11H4zm4-2 5 5" : "M5 18 17 6m-8 12 2 2M4 21h16"}/></svg><span>{brush.label}</span></button>)}</div><div class="touch-style-subsection"><strong>Stylus input</strong><label class="touch-style-check"><input type="checkbox" checked={props.penPressure} onChange={event => props.onPenPressureChange(event.currentTarget.checked)} /> Pressure width</label><label class="touch-style-check"><input type="checkbox" checked={props.penTilt} onChange={event => props.onPenTiltChange(event.currentTarget.checked)} /> Tilt shaping</label><label class="touch-style-check"><input type="checkbox" checked={props.penEraser} onChange={event => props.onPenEraserChange(event.currentTarget.checked)} /> Stylus eraser end</label></div></section>}
```

### Mobile stylus settings values passed from App
Source: `src/App.tsx` lines 3855-3857
```tsx
              penPressure={penPressure()}
              penTilt={penTilt()}
              penEraser={penEraser()}
```

### Mobile stylus setting callbacks passed from App
Source: `src/App.tsx` lines 3884-3886
```tsx
              onPenPressureChange={setPenPressure}
              onPenTiltChange={setPenTilt}
              onPenEraserChange={setPenEraser}
```


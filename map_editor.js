/**
 * ============================================================================
 * MAP_EDITOR.JS - Real-Time 5K Terraforming & Biome Brush Engine
 * ============================================================================
 * Handles terrain sculpting, height painting, biome stamping, brush previews,
 * and undo/redo state management for procedural fantasy maps.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MapEditor = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  const TERRAIN_PRESETS = {
    deep_ocean: { name: "Deep Ocean", elevation: 0.15, isWater: true },
    ocean:      { name: "Open Ocean", elevation: 0.32, isWater: true },
    shallows:   { name: "Coast Shallows", elevation: 0.39, isWater: true },
    sand:       { name: "Beach / Sand", elevation: 0.43, isWater: false },
    grass:      { name: "Grassland / Plains", elevation: 0.53, isWater: false },
    forest:     { name: "Woodland Forest", elevation: 0.68, isWater: false },
    hills:      { name: "Highlands / Hills", elevation: 0.79, isWater: false },
    mountain:   { name: "Mountain Ridge", elevation: 0.89, isWater: false },
    snow:       { name: "Snowy Peak", elevation: 0.97, isWater: false }
  };

  class MapEditorEngine {
    constructor() {
      this.isActive = false;
      this.editorCategory = 'terrain'; // 'terrain' or 'zone'
      this.currentTool = 'raise';
      this.currentPreset = 'grass';
      
      this.brushRadius = 45;
      this.brushStrength = 0.15;
      this.brushHardness = 0.5;
      this.targetElevation = 0.52;

      this.getWorldData = null;
      this.onRenderRequest = null;
      this.getRenderOptions = null;
      this.viewportElem = null;
      this.canvasWrapperElem = null;
      this.mapCanvas = null;
      this.brushCursorElem = null;
      this.cursorSvgOverlay = null;

      this.isPainting = false;
      this.currentMousePos = { gx: 0, gy: 0, canvasX: 0, canvasY: 0, inBounds: false };
      this.animFrameId = null;

      this.undoStack = [];
      this.redoStack = [];
      this.maxHistory = 15;
      this.strokeSnapshot = null;
    }

    init(options = {}) {
      this.getWorldData = options.getWorldData;
      this.onRenderRequest = options.onRenderRequest;
      this.getRenderOptions = options.getRenderOptions;
      this.viewportElem = options.viewportElem || document.getElementById('mainMapViewport');
      this.canvasWrapperElem = options.canvasWrapperElem || document.getElementById('mainCanvasWrapper');
      this.mapCanvas = options.mapCanvas || document.getElementById('mapCanvas');

      this.createDedicatedCursorOverlay();
      this.bindEvents();
      this.updateUI();
    }

    createDedicatedCursorOverlay() {
      if (document.getElementById('editorBrushSvgOverlay')) {
        this.cursorSvgOverlay = document.getElementById('editorBrushSvgOverlay');
        this.brushCursorElem = document.getElementById('editorBrushCursorGroup');
        return;
      }

      if (!this.canvasWrapperElem) {
        this.canvasWrapperElem = document.getElementById('mainCanvasWrapper');
      }
      if (!this.canvasWrapperElem) return;

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('id', 'editorBrushSvgOverlay');
      svg.setAttribute('viewBox', '0 0 5120 2880');
      svg.setAttribute('width', '5120');
      svg.setAttribute('height', '2880');
      svg.style.position = 'absolute';
      svg.style.top = '0';
      svg.style.left = '0';
      svg.style.width = '100%';
      svg.style.height = '100%';
      svg.style.pointerEvents = 'none';
      svg.style.overflow = 'visible';
      svg.style.zIndex = '30';

      const cursorGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      cursorGroup.setAttribute('id', 'editorBrushCursorGroup');
      cursorGroup.style.display = 'none';

      const outerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      outerCircle.setAttribute('id', 'editorBrushCursor');
      outerCircle.setAttribute('fill', 'rgba(212, 175, 55, 0.18)');
      outerCircle.setAttribute('stroke', '#d4af37');
      outerCircle.setAttribute('stroke-width', '4');
      outerCircle.setAttribute('stroke-dasharray', '12 8');

      const centerDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      centerDot.setAttribute('id', 'editorBrushCenter');
      centerDot.setAttribute('r', '5');
      centerDot.setAttribute('fill', '#ffffff');
      centerDot.setAttribute('stroke', '#000000');
      centerDot.setAttribute('stroke-width', '1.5');

      cursorGroup.appendChild(outerCircle);
      cursorGroup.appendChild(centerDot);
      svg.appendChild(cursorGroup);
      this.canvasWrapperElem.appendChild(svg);

      this.cursorSvgOverlay = svg;
      this.brushCursorElem = cursorGroup;
    }

    updateBrushCursor(canvasX, canvasY) {
      if (!this.brushCursorElem) {
        this.createDedicatedCursorOverlay();
      }
      if (!this.brushCursorElem || !this.isActive) return;

      const worldData = this.getWorldData ? this.getWorldData() : null;
      const step = worldData ? worldData.STEP : 2;
      const radiusInPixels = this.brushRadius * step;

      const outer = this.brushCursorElem.querySelector('#editorBrushCursor');
      const center = this.brushCursorElem.querySelector('#editorBrushCenter');

      if (outer && center) {
        outer.setAttribute('cx', canvasX);
        outer.setAttribute('cy', canvasY);
        outer.setAttribute('r', radiusInPixels);

        center.setAttribute('cx', canvasX);
        center.setAttribute('cy', canvasY);

if (this.currentTool === 'raise') {
          outer.setAttribute('stroke', '#2ecc71');
          outer.setAttribute('fill', 'rgba(46, 204, 113, 0.22)');
        } else if (this.currentTool === 'lower') {
          outer.setAttribute('stroke', '#3498db');
          outer.setAttribute('fill', 'rgba(52, 152, 219, 0.22)');
        } else if (this.currentTool === 'smooth') {
          outer.setAttribute('stroke', '#f39c12');
          outer.setAttribute('fill', 'rgba(243, 156, 18, 0.22)');
        } else if (this.currentTool === 'flatten') {
          outer.setAttribute('stroke', '#e74c3c');
          outer.setAttribute('fill', 'rgba(231, 76, 60, 0.22)');
        } else if (this.currentTool === 'mountain_stamp') {
          outer.setAttribute('stroke', '#ecf0f1');
          outer.setAttribute('fill', 'rgba(236, 240, 241, 0.30)');
        } else if (this.currentTool === 'mountain_erase') {
          outer.setAttribute('stroke', '#e74c3c');
          outer.setAttribute('fill', 'rgba(231, 76, 60, 0.25)');
        } else {
          outer.setAttribute('stroke', '#d4af37');
          outer.setAttribute('fill', 'rgba(212, 175, 55, 0.22)');
        }
      }

      this.brushCursorElem.style.display = 'block';
    }

    hideBrushCursor() {
      if (this.brushCursorElem) {
        this.brushCursorElem.style.display = 'none';
      }
    }

    openSidebar() {
      this.isActive = true;
      const sidebar = document.getElementById('mapEditorSidebar');
      if (sidebar) sidebar.classList.add('active');
      const btn = document.getElementById('toggleEditorBtn');
      if (btn) {
        btn.style.background = "#e74c3c";
        btn.innerText = "✖ Close Editor";
      }
      this.updateUI();
    }

    closeSidebar() {
      this.isActive = false;
      this.stopPaintingLoop();
      this.hideBrushCursor();
      const sidebar = document.getElementById('mapEditorSidebar');
      if (sidebar) sidebar.classList.remove('active');
      const btn = document.getElementById('toggleEditorBtn');
      if (btn) {
        btn.style.background = "#8e44ad";
        btn.innerText = "🛠️ Map Editor";
      }
    }

    toggleSidebar() {
      if (this.isActive) this.closeSidebar();
      else this.openSidebar();
    }

    setTool(toolName, presetKey = null) {
      this.currentTool = toolName;
      if (presetKey && TERRAIN_PRESETS[presetKey]) {
        this.currentPreset = presetKey;
      }
      this.updateUI();
    }

    setBrushSize(radius) {
      this.brushRadius = Math.max(3, Math.min(250, parseInt(radius) || 45));
      const sizeVal = document.getElementById('editorBrushSizeVal');
      if (sizeVal) sizeVal.innerText = `${this.brushRadius}px`;
      const slider = document.getElementById('editorBrushSize');
      if (slider && parseInt(slider.value) !== this.brushRadius) slider.value = this.brushRadius;
      if (this.currentMousePos && this.currentMousePos.inBounds) {
        this.updateBrushCursor(this.currentMousePos.canvasX, this.currentMousePos.canvasY);
      }
    }

    setBrushStrength(strength) {
      this.brushStrength = Math.max(0.01, Math.min(0.8, parseFloat(strength) || 0.15));
      const strVal = document.getElementById('editorBrushStrVal');
      if (strVal) strVal.innerText = `${Math.round(this.brushStrength * 100)}%`;
    }

    setBrushHardness(hardness) {
      this.brushHardness = Math.max(0.0, Math.min(1.0, parseFloat(hardness) || 0.5));
      const hardVal = document.getElementById('editorBrushHardVal');
      if (hardVal) hardVal.innerText = `${Math.round(this.brushHardness * 100)}%`;
    }

    screenToGridCoords(clientX, clientY) {
      if (!this.canvasWrapperElem) {
        this.canvasWrapperElem = document.getElementById('mainCanvasWrapper');
      }
      if (!this.canvasWrapperElem) return { canvasX: 0, canvasY: 0, gx: 0, gy: 0, inBounds: false };

      const wrapperRect = this.canvasWrapperElem.getBoundingClientRect();
      if (wrapperRect.width === 0 || wrapperRect.height === 0) {
        return { canvasX: 0, canvasY: 0, gx: 0, gy: 0, inBounds: false };
      }

      const normX = (clientX - wrapperRect.left) / wrapperRect.width;
      const normY = (clientY - wrapperRect.top) / wrapperRect.height;

      const canvasX = normX * 5120;
      const canvasY = normY * 2880;

      const worldData = this.getWorldData ? this.getWorldData() : null;
      const step = worldData ? worldData.STEP : 2;
      const gw = worldData ? worldData.gw : 2560;
      const gh = worldData ? worldData.gh : 1440;

      const gx = Math.min(gw - 1, Math.max(0, Math.floor(canvasX / step)));
      const gy = Math.min(gh - 1, Math.max(0, Math.floor(canvasY / step)));

      const inBounds = (normX >= 0 && normX <= 1 && normY >= 0 && normY <= 1);
      return { canvasX, canvasY, gx, gy, inBounds };
    }

    beginStroke() {
      const worldData = this.getWorldData ? this.getWorldData() : null;
      if (!worldData || !worldData.elevation) return;
      this.strokeSnapshot = {
        elevation: new Float32Array(worldData.elevation),
        mountainPeaks: (worldData.mountainPeaks || []).map(p => ({ ...p }))
      };
    }

    endStroke() {
      if (!this.strokeSnapshot) return;
      const worldData = this.getWorldData ? this.getWorldData() : null;
      if (!worldData) return;

      this.undoStack.push({
        elevation: this.strokeSnapshot
      });
      if (this.undoStack.length > this.maxHistory) {
        this.undoStack.shift();
      }
      this.redoStack = [];
      this.strokeSnapshot = null;
      this.updateHistoryButtons();
    }

   undo() {
      const worldData = this.getWorldData ? this.getWorldData() : null;
      if (!worldData || this.undoStack.length === 0) return;

      const previous = this.undoStack.pop();
      this.redoStack.push({
        elevation: new Float32Array(worldData.elevation),
        mountainPeaks: (worldData.mountainPeaks || []).map(p => ({ ...p }))
      });

      worldData.elevation.set(previous.elevation);
      worldData.mountainPeaks = (previous.mountainPeaks || []).map(p => ({ ...p }));
      this.recalculateAllDerivedMaps();

      if (typeof TerrainGL !== 'undefined' && TerrainGL.isInitialized) {
        const opts = this.getRenderOptions ? this.getRenderOptions() : {};
        let activeTier = 'none';
        if (opts.showGrand) activeTier = 'grand';
        else if (opts.showMed) activeTier = 'med';
        else if (opts.showSmall) activeTier = 'small';
        TerrainGL.uploadWorldData(worldData, activeTier);
        TerrainGL.render(opts);
      }

      if (this.onRenderRequest) this.onRenderRequest(true);
      this.updateHistoryButtons();
    }
     redo() {
      const worldData = this.getWorldData ? this.getWorldData() : null;
      if (!worldData || this.redoStack.length === 0) return;

      const next = this.redoStack.pop();
      this.undoStack.push({
        elevation: new Float32Array(worldData.elevation),
        mountainPeaks: (worldData.mountainPeaks || []).map(p => ({ ...p }))
      });

      worldData.elevation.set(next.elevation);
      worldData.mountainPeaks = (next.mountainPeaks || []).map(p => ({ ...p }));
      this.recalculateAllDerivedMaps();

      if (typeof TerrainGL !== 'undefined' && TerrainGL.isInitialized) {
        const opts = this.getRenderOptions ? this.getRenderOptions() : {};
        let activeTier = 'none';
        if (opts.showGrand) activeTier = 'grand';
        else if (opts.showMed) activeTier = 'med';
        else if (opts.showSmall) activeTier = 'small';
        TerrainGL.uploadWorldData(worldData, activeTier);
        TerrainGL.render(opts);
      }

      if (this.onRenderRequest) this.onRenderRequest(true);
      this.updateHistoryButtons();
    }

    startPaintingLoop() {
      if (this.animFrameId) return;
      this.isPainting = true;

      const paintTick = () => {
        if (!this.isPainting) {
          this.animFrameId = null;
          return;
        }

        if (this.currentMousePos && this.currentMousePos.inBounds) {
          if (this.editorCategory === 'zone' && typeof ZoneEditor !== 'undefined') {
            ZoneEditor.applyZoneStroke(this.currentMousePos.gx, this.currentMousePos.gy, this.brushRadius);
          } else {
            this.applyTerraformBrush(this.currentMousePos.gx, this.currentMousePos.gy);
          }
        }

        this.animFrameId = requestAnimationFrame(paintTick);
      };

      this.animFrameId = requestAnimationFrame(paintTick);
    }

    stopPaintingLoop() {
      this.isPainting = false;
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
    }

    renderFastTerrainPatch(minX, minY, maxX, maxY) {
      const worldData = this.getWorldData ? this.getWorldData() : null;
      if (!worldData) return;

      const opts = this.getRenderOptions ? this.getRenderOptions() : {};

      if (typeof TerrainGL !== 'undefined' && TerrainGL.isInitialized) {
        // Clamped sub-region update
        TerrainGL.updateElevationSubRegion(worldData, minX, minY, maxX, maxY);
        TerrainGL.render(opts);
      } else if (this.onRenderRequest) {
        this.onRenderRequest(false);
      }
    }

    applyTerraformBrush(centerGx, centerGy) {
      const worldData = this.getWorldData ? this.getWorldData() : null;
      if (!worldData) return;

      const { gw, gh, elevation, isWater, STEP } = worldData;
      if (!worldData.mountainPeaks) worldData.mountainPeaks = [];

      const R = this.brushRadius;
      const R2 = R * R;
      const strength = this.brushStrength;
      const hardness = this.brushHardness;

      const minX = Math.max(1, centerGx - R);
      const maxX = Math.min(gw - 2, centerGx + R);
      const minY = Math.max(1, centerGy - R);
      const maxY = Math.min(gh - 2, centerGy + R);

      if (minX > maxX || minY > maxY) return;

      // 1. MOUNTAIN PEAK STAMPING / ERASING
      if (this.currentTool === 'mountain_erase') {
        const initialCount = worldData.mountainPeaks.length;
        worldData.mountainPeaks = worldData.mountainPeaks.filter(p => {
          const dx = p.x - centerGx;
          const dy = p.y - centerGy;
          return (dx * dx + dy * dy) > R2;
        });

        if (worldData.mountainPeaks.length !== initialCount) {
          const featCanvas = document.getElementById('featureCanvas');
          if (featCanvas && typeof WorldGen !== 'undefined') {
            WorldGen.renderFeaturesToCanvas(featCanvas, worldData, this.getRenderOptions ? this.getRenderOptions() : {});
          }
        }
        return;
      }

      if (this.currentTool === 'mountain_stamp') {
        const minSpacing = Math.max(10, Math.min(24, Math.floor(R * 0.4)));
        const gridStep = minSpacing;
        let peaksAdded = false;

        for (let gy = minY; gy <= maxY; gy += gridStep) {
          for (let gx = minX; gx <= maxX; gx += gridStep) {
            const jx = gx + Math.floor((Math.random() - 0.5) * 6);
            const jy = gy + Math.floor((Math.random() - 0.5) * 6);

            if (jx < 1 || jx >= gw - 1 || jy < 1 || jy >= gh - 1) continue;

            const dx = jx - centerGx;
            const dy = jy - centerGy;
            if (dx * dx + dy * dy > R2) continue;

            const idx = jy * gw + jx;
            if (isWater[idx] === 1) continue;

            // Spacing check
            const tooClose = worldData.mountainPeaks.some(p => Math.hypot(p.x - jx, p.y - jy) < minSpacing);
            if (tooClose) continue;

            // Raise land underneath to realistic mountain ridge height
            const peakElev = Math.min(0.98, Math.max(0.76, elevation[idx] + 0.25));
            elevation[idx] = peakElev;

            worldData.mountainPeaks.push({
              x: jx,
              y: jy,
              px: jx * STEP + STEP / 2,
              py: jy * STEP + STEP / 2,
              elevation: peakElev
            });
            peaksAdded = true;
          }
        }

        if (peaksAdded) {
          // Sort by Y for correct visual front-to-back mountain overlap
          worldData.mountainPeaks.sort((a, b) => a.y - b.y);

          const patchMinX = Math.max(0, minX - 2);
          const patchMaxX = Math.min(gw - 1, maxX + 2);
          const patchMinY = Math.max(0, minY - 2);
          const patchMaxY = Math.min(gh - 1, maxY + 2);

          this.updateLocalHillshade(patchMinX, patchMinY, patchMaxX, patchMaxY);
          this.renderFastTerrainPatch(patchMinX, patchMinY, patchMaxX, patchMaxY);

          const featCanvas = document.getElementById('featureCanvas');
          if (featCanvas && typeof WorldGen !== 'undefined') {
            WorldGen.renderFeaturesToCanvas(featCanvas, worldData, this.getRenderOptions ? this.getRenderOptions() : {});
          }
        }
        return;
      }

      // 2. STANDARD HEIGHT & BIOME SCULPTING
      let sampleTargetHeight = this.targetElevation;
      if (this.currentTool === 'flatten' && this.targetElevation === null) {
        sampleTargetHeight = elevation[centerGy * gw + centerGx];
        this.targetElevation = sampleTargetHeight;
      }

      for (let y = minY; y <= maxY; y++) {
        const yOffset = y * gw;
        for (let x = minX; x <= maxX; x++) {
          const dx = x - centerGx;
          const dy = y - centerGy;
          const distSq = dx * dx + dy * dy;
          if (distSq > R2) continue;

          const dist = Math.sqrt(distSq);
          const normDist = dist / R;

          let factor = 1.0;
          if (hardness < 1.0) {
            const h = Math.max(0.01, hardness);
            if (normDist > h) {
              const f = (normDist - h) / (1.0 - h);
              factor = 0.5 * (1.0 + Math.cos(Math.PI * f));
            }
          }

          const idx = yOffset + x;
          const curElev = elevation[idx];
          let newElev = curElev;

          if (this.currentTool === 'raise') {
            newElev = Math.min(1.0, curElev + strength * factor * 0.045);
          } else if (this.currentTool === 'lower') {
            newElev = Math.max(0.0, curElev - strength * factor * 0.045);
          } else if (this.currentTool === 'smooth') {
            const avg = (elevation[idx - 1] + elevation[idx + 1] + elevation[idx - gw] + elevation[idx + gw]) / 4.0;
            newElev = curElev + (avg - curElev) * strength * factor * 0.4;
          } else if (this.currentTool === 'flatten') {
            newElev = curElev + (sampleTargetHeight - curElev) * strength * factor * 0.25;
          } else if (this.currentTool === 'preset') {
            const targetHeight = TERRAIN_PRESETS[this.currentPreset]?.elevation ?? 0.52;
            newElev = curElev + (targetHeight - curElev) * strength * factor * 0.28;
          }

          elevation[idx] = Math.max(0.0, Math.min(1.0, newElev));
          isWater[idx] = elevation[idx] < 0.40 ? 1 : 0;
        }
      }

      const patchMinX = Math.max(0, minX - 2);
      const patchMaxX = Math.min(gw - 1, maxX + 2);
      const patchMinY = Math.max(0, minY - 2);
      const patchMaxY = Math.min(gh - 1, maxY + 2);

      this.updateLocalHillshade(patchMinX, patchMinY, patchMaxX, patchMaxY);
      this.renderFastTerrainPatch(patchMinX, patchMinY, patchMaxX, patchMaxY);
    }

    updateLocalHillshade(minX, minY, maxX, maxY) {
      const worldData = this.getWorldData ? this.getWorldData() : null;
      if (!worldData) return;
      const { gw, gh, elevation, hillshade } = worldData;

      const lx = -0.707, ly = -0.707, lz = 0.5;
      const x0 = Math.max(1, minX), x1 = Math.min(gw - 2, maxX);
      const y0 = Math.max(1, minY), y1 = Math.min(gh - 2, maxY);

      if (x0 > x1 || y0 > y1) return;

      for (let y = y0; y <= y1; y++) {
        const yOffset = y * gw;
        for (let x = x0; x <= x1; x++) {
          const idx = yOffset + x;
          const dzdx = (elevation[idx + 1] - elevation[idx - 1]) * 2.0;
          const dzdy = (elevation[idx + gw] - elevation[idx - gw]) * 2.0;

          const nx = -dzdx, ny = -dzdy, nz = 1.0;
          const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
          const dot = (nx * lx + ny * ly + nz * lz) / len;

          hillshade[idx] = Math.max(0.4, Math.min(1.4, 0.6 + dot * 0.8));
        }
      }
    }

    recalculateAllDerivedMaps() {
      const worldData = this.getWorldData ? this.getWorldData() : null;
      if (!worldData) return;
      this.updateLocalHillshade(1, 1, worldData.gw - 2, worldData.gh - 2);
    }

    bindEvents() {
      const toggleBtn = document.getElementById('toggleEditorBtn');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => this.toggleSidebar());
      }

      const closeBtn = document.getElementById('closeEditorBtn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.closeSidebar());
      }

      if (!this.viewportElem) {
        this.viewportElem = document.getElementById('mainMapViewport');
      }
      if (!this.viewportElem) return;

      this.viewportElem.addEventListener('mousemove', (e) => {
        if (!this.isActive) return;
        const coords = this.screenToGridCoords(e.clientX, e.clientY);
        this.currentMousePos = coords;

        if (coords.inBounds) {
          this.updateBrushCursor(coords.canvasX, coords.canvasY);
        } else {
          this.hideBrushCursor();
        }
      });

this.viewportElem.addEventListener('mousedown', (e) => {
        if (!this.isActive) return;

        if (e.button === 0 && !e.altKey && !e.spaceKey) {
          const coords = this.screenToGridCoords(e.clientX, e.clientY);
          if (coords.inBounds) {
            // Forward to Route Connector when in route tab
            if (this.editorCategory === 'route' && typeof RouteEditor !== 'undefined') {
              RouteEditor.handleMapClick(coords);
              e.stopPropagation();
              e.preventDefault();
              return;
            }

            // Forward to Settlement Editor when in settlement tab
            if (this.editorCategory === 'settlement' && typeof SettlementEditor !== 'undefined') {
              SettlementEditor.placeSettlement(coords.gx, coords.gy, coords.canvasX, coords.canvasY);
              e.stopPropagation();
              e.preventDefault();
              return;
            }

            this.currentMousePos = coords;
            this.targetElevation = null;
            this.beginStroke();
            this.startPaintingLoop();
            e.stopPropagation();
            e.preventDefault();
          }
        }
      }, true);

      window.addEventListener('mouseup', (e) => {
        if (this.isPainting) {
          this.stopPaintingLoop();
          this.endStroke();

          if (this.editorCategory === 'zone' && typeof ZoneEditor !== 'undefined') {
            ZoneEditor.cleanupAndRecalculateLabels();
          }

          if (this.onRenderRequest) this.onRenderRequest(true);
        }
      });

      this.viewportElem.addEventListener('mouseleave', () => {
        if (this.isActive) this.hideBrushCursor();
      });

      this.viewportElem.addEventListener('wheel', (e) => {
        if (this.isActive && e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          const delta = e.deltaY < 0 ? 5 : -5;
          this.setBrushSize(this.brushRadius + delta);
        }
      }, { passive: false });

      window.addEventListener('keydown', (e) => {
        if (!this.isActive) return;
        if (e.key === '[' || e.key === '{') {
          this.setBrushSize(this.brushRadius - 5);
        } else if (e.key === ']' || e.key === '}') {
          this.setBrushSize(this.brushRadius + 5);
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
          if (e.shiftKey) this.redo();
          else this.undo();
          e.preventDefault();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
          this.redo();
          e.preventDefault();
        }
      });

      this.bindUIFormControls();
    }

    bindUIFormControls() {
      document.querySelectorAll('.editor-tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const tool = btn.getAttribute('data-tool');
          const preset = btn.getAttribute('data-preset');
          this.setTool(tool, preset);
        });
      });

document.querySelectorAll('.editor-cat-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          this.editorCategory = tab.getAttribute('data-cat');
          document.querySelectorAll('.editor-cat-tab').forEach(t => {
            t.style.background = '#1a1622';
            t.style.borderColor = '#3d3448';
          });
          tab.style.background = '#342918';
          tab.style.borderColor = '#f1c40f';

          const terrainCard = document.getElementById('terrainToolsCard');
          const biomeCard = document.getElementById('biomeToolsCard');
          const zoneCard = document.getElementById('zoneToolsCard');
          const settlementCard = document.getElementById('settlementToolsCard');
          const routeCard = document.getElementById('routeToolsCard');
          const brushPropCard = document.getElementById('brushPropertiesCard');

          if (terrainCard) terrainCard.style.display = (this.editorCategory === 'terrain') ? 'flex' : 'none';
          if (biomeCard) biomeCard.style.display = (this.editorCategory === 'terrain') ? 'flex' : 'none';
          if (zoneCard) zoneCard.style.display = (this.editorCategory === 'zone') ? 'flex' : 'none';
          if (settlementCard) settlementCard.style.display = (this.editorCategory === 'settlement') ? 'flex' : 'none';
          if (routeCard) routeCard.style.display = (this.editorCategory === 'route') ? 'flex' : 'none';
          if (brushPropCard) brushPropCard.style.display = (this.editorCategory === 'terrain' || this.editorCategory === 'zone') ? 'flex' : 'none';

          if (this.editorCategory === 'route' && typeof RouteEditor !== 'undefined') {
            RouteEditor.refreshNodeDropdowns();
            RouteEditor.updateSelectionHighlights();
          } else if (typeof RouteEditor !== 'undefined') {
            RouteEditor.clearSelection();
          }
        });
      });

      const sizeSlider = document.getElementById('editorBrushSize');
      if (sizeSlider) {
        sizeSlider.addEventListener('input', (e) => this.setBrushSize(e.target.value));
      }

      const strSlider = document.getElementById('editorBrushStr');
      if (strSlider) {
        strSlider.addEventListener('input', (e) => this.setBrushStrength(e.target.value));
      }

      const hardSlider = document.getElementById('editorBrushHard');
      if (hardSlider) {
        hardSlider.addEventListener('input', (e) => this.setBrushHardness(e.target.value));
      }

      const undoBtn = document.getElementById('editorUndoBtn');
      if (undoBtn) undoBtn.addEventListener('click', () => this.undo());

      const redoBtn = document.getElementById('editorRedoBtn');
      if (redoBtn) redoBtn.addEventListener('click', () => this.redo());

      const smoothAllBtn = document.getElementById('editorSmoothAllBtn');
      if (smoothAllBtn) {
        smoothAllBtn.addEventListener('click', () => {
          this.beginStroke();
          const worldData = this.getWorldData ? this.getWorldData() : null;
          if (worldData) {
            const { gw, gh, elevation } = worldData;
            for (let y = 1; y < gh - 1; y++) {
              for (let x = 1; x < gw - 1; x++) {
                const idx = y * gw + x;
                const avg = (elevation[idx - 1] + elevation[idx + 1] + elevation[idx - gw] + elevation[idx + gw]) / 4.0;
                elevation[idx] = elevation[idx] * 0.7 + avg * 0.3;
              }
            }
            this.recalculateAllDerivedMaps();

            if (typeof TerrainGL !== 'undefined' && TerrainGL.isInitialized) {
              const opts = this.getRenderOptions ? this.getRenderOptions() : {};
              let activeTier = 'none';
              if (opts.showGrand) activeTier = 'grand';
              else if (opts.showMed) activeTier = 'med';
              else if (opts.showSmall) activeTier = 'small';
              TerrainGL.uploadWorldData(worldData, activeTier);
              TerrainGL.render(opts);
            }

            this.endStroke();
            if (this.onRenderRequest) this.onRenderRequest(true);
          }
        });
      }
    }

    updateHistoryButtons() {
      const undoBtn = document.getElementById('editorUndoBtn');
      const redoBtn = document.getElementById('editorRedoBtn');
      if (undoBtn) undoBtn.disabled = this.undoStack.length === 0;
      if (redoBtn) redoBtn.disabled = this.redoStack.length === 0;
    }

    updateUI() {
      document.querySelectorAll('.editor-tool-btn').forEach(btn => {
        const tool = btn.getAttribute('data-tool');
        const preset = btn.getAttribute('data-preset');
        let isSelected = false;

        if (tool === 'preset') {
          isSelected = (this.currentTool === 'preset' && this.currentPreset === preset);
        } else {
          isSelected = (this.currentTool === tool);
        }

        if (isSelected) {
          btn.style.borderColor = '#f1c40f';
          btn.style.background = '#342918';
          btn.style.boxShadow = '0 0 10px rgba(241, 196, 15, 0.4)';
        } else {
          btn.style.borderColor = '#3d3448';
          btn.style.background = '#1a1622';
          btn.style.boxShadow = 'none';
        }
      });

      this.updateHistoryButtons();
    }
  }

  return new MapEditorEngine();
}));
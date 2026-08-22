/**
 * ============================================================================
 * ROUTE_EDITOR.JS - Road & Sea Route Connector / Remover Engine
 * ============================================================================
 * Handles manual road generation, port nautical sea routes, road removal,
 * visual node selection highlights, and road graph updates.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RouteEditor = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  class RouteEditorEngine {
    constructor() {
      this.selectedNodeA = null;
      this.selectedNodeB = null;
      this.routeType = 'auto'; // 'auto', 'highway', 'road', 'water'
      this.activeTool = 'connect'; // 'connect', 'delete_click'

      this.getWorldData = null;
      this.onRenderRequest = null;
      this.highlightSvgGroup = null;
    }

    init(options = {}) {
      this.getWorldData = options.getWorldData;
      this.onRenderRequest = options.onRenderRequest;

      this.createSelectionHighlightGroup();
      this.bindUI();
      this.refreshNodeDropdowns();
    }

    createSelectionHighlightGroup() {
      const svgOverlay = document.getElementById('editorBrushSvgOverlay') || document.getElementById('mapSvgOverlay');
      if (!svgOverlay) return;

      if (document.getElementById('routeSelectionHighlights')) {
        this.highlightSvgGroup = document.getElementById('routeSelectionHighlights');
        return;
      }

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('id', 'routeSelectionHighlights');
      g.style.pointerEvents = 'none';

      // Ring A
      const ringA = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ringA.setAttribute('id', 'routeRingA');
      ringA.setAttribute('r', '22');
      ringA.setAttribute('fill', 'rgba(46, 204, 113, 0.25)');
      ringA.setAttribute('stroke', '#2ecc71');
      ringA.setAttribute('stroke-width', '4');
      ringA.setAttribute('stroke-dasharray', '6 4');
      ringA.style.display = 'none';

      // Ring B
      const ringB = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ringB.setAttribute('id', 'routeRingB');
      ringB.setAttribute('r', '22');
      ringB.setAttribute('fill', 'rgba(52, 152, 219, 0.25)');
      ringB.setAttribute('stroke', '#3498db');
      ringB.setAttribute('stroke-width', '4');
      ringB.setAttribute('stroke-dasharray', '6 4');
      ringB.style.display = 'none';

      g.appendChild(ringA);
      g.appendChild(ringB);
      svgOverlay.appendChild(g);

      this.highlightSvgGroup = g;
    }

    updateSelectionHighlights() {
      if (!this.highlightSvgGroup) this.createSelectionHighlightGroup();
      if (!this.highlightSvgGroup) return;

      const ringA = this.highlightSvgGroup.querySelector('#routeRingA');
      const ringB = this.highlightSvgGroup.querySelector('#routeRingB');

      if (this.selectedNodeA && ringA) {
        ringA.setAttribute('cx', this.selectedNodeA.px);
        ringA.setAttribute('cy', this.selectedNodeA.py);
        ringA.style.display = 'block';
      } else if (ringA) {
        ringA.style.display = 'none';
      }

      if (this.selectedNodeB && ringB) {
        ringB.setAttribute('cx', this.selectedNodeB.px);
        ringB.setAttribute('cy', this.selectedNodeB.py);
        ringB.style.display = 'block';
      } else if (ringB) {
        ringB.style.display = 'none';
      }
    }

    clearSelection() {
      this.selectedNodeA = null;
      this.selectedNodeB = null;
      this.updateSelectionHighlights();
      this.updateUI();
    }

    findClosestSettlement(canvasX, canvasY, maxDist = 45) {
      const worldData = this.getWorldData ? this.getWorldData() : null;
      if (!worldData || !worldData.allNodes) return null;

      const candidates = worldData.allNodes.filter(n => n && n.type !== 'character');
      let closest = null;
      let closestDist = maxDist;

      for (let node of candidates) {
        const d = Math.hypot(node.px - canvasX, node.py - canvasY);
        if (d < closestDist) {
          closestDist = d;
          closest = node;
        }
      }
      return closest;
    }

    // --- Connect Settlement A & Settlement B ---
    connectNodes(nodeA, nodeB) {
      if (!nodeA || !nodeB) {
        alert("Please select both Settlement A and Settlement B!");
        return;
      }
      if (nodeA === nodeB) {
        alert("Cannot connect a settlement to itself!");
        return;
      }

      const worldData = this.getWorldData ? this.getWorldData() : null;
      if (!worldData) return;

      const { gw, gh, elevation, isWater, hasRoad } = worldData;

      // Determine Route Category: Sea vs Land
      let isSeaRoute = false;
      if (this.routeType === 'water') {
        isSeaRoute = true;
      } else if (this.routeType === 'auto') {
        const isPortA = nodeA.type === 'port' || nodeA.waterBodyId !== -1;
        const isPortB = nodeB.type === 'port' || nodeB.waterBodyId !== -1;
        if (isPortA && isPortB && (nodeA.compId !== nodeB.compId || nodeA.waterBodyId === nodeB.waterBodyId)) {
          isSeaRoute = true;
        }
      }

      let generatedPath = null;
      let finalType = isSeaRoute ? 'water' : 'road';

      if (isSeaRoute) {
        if (typeof WorldGen !== 'undefined' && typeof WorldGen.findNauticalSeaRoute === 'function') {
          const rawWater = WorldGen.findNauticalSeaRoute(nodeA, nodeB, isWater, gw, gh);
          if (rawWater && rawWater.length > 1) {
            generatedPath = WorldGen.smoothPathChaikin(rawWater, 2);
            if (!worldData.waterRoutePaths) worldData.waterRoutePaths = [];
            worldData.waterRoutePaths.push(generatedPath);
          }
        }
      } else {
        if (typeof WorldGen !== 'undefined' && typeof WorldGen.findSmartRoad === 'function') {
          const rawRoad = WorldGen.findSmartRoad(nodeA, nodeB, elevation, isWater, hasRoad, gw, gh);
          if (rawRoad && rawRoad.length > 1) {
            generatedPath = WorldGen.smoothPathChaikin(rawRoad, 2);

            const forceHighway = (this.routeType === 'highway') || 
              (this.routeType === 'auto' && ['capital', 'city', 'fort', 'port'].includes(nodeA.type) && ['capital', 'city', 'fort', 'port'].includes(nodeB.type));

            if (forceHighway) {
              if (!worldData.majorRoadPaths) worldData.majorRoadPaths = [];
              worldData.majorRoadPaths.push(generatedPath);
            } else {
              if (!worldData.minorRoadPaths) worldData.minorRoadPaths = [];
              worldData.minorRoadPaths.push(generatedPath);
            }
          }
        }
      }

      if (!generatedPath) {
        alert("Failed to calculate a valid path between these settlements! (Terrain may be impassable)");
        return;
      }

      // Add to Bidirectional Road Graph
      if (!worldData.roadGraph) worldData.roadGraph = new Map();
      if (!worldData.roadGraph.has(nodeA)) worldData.roadGraph.set(nodeA, []);
      if (!worldData.roadGraph.has(nodeB)) worldData.roadGraph.set(nodeB, []);

      worldData.roadGraph.get(nodeA).push({ target: nodeB, path: generatedPath, type: finalType });
      worldData.roadGraph.get(nodeB).push({ target: nodeA, path: [...generatedPath].reverse(), type: finalType });

      this.updateUI();
      if (this.onRenderRequest) this.onRenderRequest(true);
    }

    // --- Disconnect / Remove Route between Node A & Node B ---
    disconnectNodes(nodeA, nodeB) {
      if (!nodeA || !nodeB) return;
      const worldData = this.getWorldData ? this.getWorldData() : null;
      if (!worldData) return;

      // 1. Remove from Graph
      if (worldData.roadGraph) {
        if (worldData.roadGraph.has(nodeA)) {
          worldData.roadGraph.set(nodeA, worldData.roadGraph.get(nodeA).filter(e => e.target !== nodeB));
        }
        if (worldData.roadGraph.has(nodeB)) {
          worldData.roadGraph.set(nodeB, worldData.roadGraph.get(nodeB).filter(e => e.target !== nodeA));
        }
      }

      // 2. Remove from Path Arrays
      const isMatchingPath = (path) => {
        if (!path || path.length < 2) return false;
        const start = path[0];
        const end = path[path.length - 1];
        const matchForward = Math.hypot(start.px - nodeA.px, start.py - nodeA.py) < 25 && Math.hypot(end.px - nodeB.px, end.py - nodeB.py) < 25;
        const matchReverse = Math.hypot(start.px - nodeB.px, start.py - nodeB.py) < 25 && Math.hypot(end.px - nodeA.px, end.py - nodeA.py) < 25;
        return matchForward || matchReverse;
      };

      if (worldData.majorRoadPaths) worldData.majorRoadPaths = worldData.majorRoadPaths.filter(p => !isMatchingPath(p));
      if (worldData.minorRoadPaths) worldData.minorRoadPaths = worldData.minorRoadPaths.filter(p => !isMatchingPath(p));
      if (worldData.waterRoutePaths) worldData.waterRoutePaths = worldData.waterRoutePaths.filter(p => !isMatchingPath(p));

      this.updateUI();
      if (this.onRenderRequest) this.onRenderRequest(true);
    }

    // --- Click Directly on a Path to Delete It ---
    deleteRouteNearPoint(canvasX, canvasY, maxDistance = 25) {
      const worldData = this.getWorldData ? this.getWorldData() : null;
      if (!worldData) return false;

      let foundPath = null;
      let foundList = null;

      const checkList = (list) => {
        if (!list) return null;
        for (let path of list) {
          for (let pt of path) {
            if (Math.hypot(pt.px - canvasX, pt.py - canvasY) < maxDistance) {
              return path;
            }
          }
        }
        return null;
      };

      foundPath = checkList(worldData.majorRoadPaths);
      if (foundPath) foundList = worldData.majorRoadPaths;
      if (!foundPath) {
        foundPath = checkList(worldData.minorRoadPaths);
        if (foundPath) foundList = worldData.minorRoadPaths;
      }
      if (!foundPath) {
        foundPath = checkList(worldData.waterRoutePaths);
        if (foundPath) foundList = worldData.waterRoutePaths;
      }

      if (foundPath && foundList) {
        const startPt = foundPath[0];
        const endPt = foundPath[foundPath.length - 1];

        const nodeA = this.findClosestSettlement(startPt.px, startPt.py, 40);
        const nodeB = this.findClosestSettlement(endPt.px, endPt.py, 40);

        if (nodeA && nodeB) {
          this.disconnectNodes(nodeA, nodeB);
        } else {
          // Remove orphan path
          const idx = foundList.indexOf(foundPath);
          if (idx !== -1) foundList.splice(idx, 1);
          if (this.onRenderRequest) this.onRenderRequest(true);
        }
        return true;
      }
      return false;
    }

    // --- Map Click Forwarder ---
    handleMapClick(coords) {
      if (this.activeTool === 'delete_click') {
        const deleted = this.deleteRouteNearPoint(coords.canvasX, coords.canvasY);
        if (deleted) {
          this.updateUI();
        }
        return;
      }

      const clickedSettlement = this.findClosestSettlement(coords.canvasX, coords.canvasY, 35);

      if (clickedSettlement) {
        if (!this.selectedNodeA || (this.selectedNodeA && this.selectedNodeB)) {
          this.selectedNodeA = clickedSettlement;
          this.selectedNodeB = null;
        } else if (this.selectedNodeA && !this.selectedNodeB) {
          if (clickedSettlement === this.selectedNodeA) {
            this.selectedNodeA = null;
          } else {
            this.selectedNodeB = clickedSettlement;
          }
        }
      }

      this.updateSelectionHighlights();
      this.updateUI();
    }

    refreshNodeDropdowns() {
      const selectA = document.getElementById('routeSelectNodeA');
      const selectB = document.getElementById('routeSelectNodeB');
      if (!selectA || !selectB) return;

      const worldData = this.getWorldData ? this.getWorldData() : null;
      if (!worldData || !worldData.allNodes) return;

      const list = worldData.allNodes.filter(n => n && n.type !== 'character');
      const optionsHtml = '<option value="">-- Click on Map or Select --</option>' + 
        list.map(n => `<option value="${n.id}">${n.name} (${n.type.toUpperCase()})</option>`).join('');

      selectA.innerHTML = optionsHtml;
      selectB.innerHTML = optionsHtml;

      if (this.selectedNodeA) selectA.value = this.selectedNodeA.id;
      if (this.selectedNodeB) selectB.value = this.selectedNodeB.id;
    }

    updateConnectedRoutesList() {
      const listContainer = document.getElementById('routeConnectedList');
      if (!listContainer) return;

      const worldData = this.getWorldData ? this.getWorldData() : null;
      if (!worldData || !this.selectedNodeA || !worldData.roadGraph || !worldData.roadGraph.has(this.selectedNodeA)) {
        listContainer.innerHTML = '<div style="color: #777; font-style: italic; font-size: 0.75rem; padding: 4px;">No active connections for Node A.</div>';
        return;
      }

      const edges = worldData.roadGraph.get(this.selectedNodeA) || [];
      if (edges.length === 0) {
        listContainer.innerHTML = '<div style="color: #777; font-style: italic; font-size: 0.75rem; padding: 4px;">No active connections for Node A.</div>';
        return;
      }

      let html = '';
      edges.forEach((e, idx) => {
        const icon = e.type === 'water' ? '⚓ Sea to' : '🛣️ Road to';
        html += `
          <div style="display: flex; align-items: center; justify-content: space-between; background: #120e18; border: 1px solid #3d3448; border-radius: 4px; padding: 4px 8px; font-size: 0.75rem;">
            <span>${icon} <strong>${e.target.name}</strong></span>
            <button class="route-disconnect-btn" data-target-id="${e.target.id}" style="background: #c0392b; color: #fff; padding: 2px 6px; font-size: 0.7rem; border-radius: 3px; cursor: pointer;">Disconnect</button>
          </div>
        `;
      });
      listContainer.innerHTML = html;

      listContainer.querySelectorAll('.route-disconnect-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const targetId = btn.getAttribute('data-target-id');
          const targetNode = worldData.allNodes.find(n => n.id === targetId);
          if (targetNode) {
            this.disconnectNodes(this.selectedNodeA, targetNode);
          }
        });
      });
    }

    updateUI() {
      this.refreshNodeDropdowns();
      this.updateConnectedRoutesList();

      const labelA = document.getElementById('routeLabelA');
      const labelB = document.getElementById('routeLabelB');

      if (labelA) labelA.innerText = this.selectedNodeA ? `${this.selectedNodeA.name} (${this.selectedNodeA.type})` : "None Selected";
      if (labelB) labelB.innerText = this.selectedNodeB ? `${this.selectedNodeB.name} (${this.selectedNodeB.type})` : "None Selected";

      const connectBtn = document.getElementById('routeConnectBtn');
      if (connectBtn) {
        connectBtn.disabled = !(this.selectedNodeA && this.selectedNodeB && this.selectedNodeA !== this.selectedNodeB);
      }

      const disconnectBtn = document.getElementById('routeDisconnectBtn');
      if (disconnectBtn) {
        disconnectBtn.disabled = !(this.selectedNodeA && this.selectedNodeB);
      }
    }

    bindUI() {
      // Connect vs Delete Tool Toggle
      document.querySelectorAll('.route-tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.activeTool = btn.getAttribute('data-rtool');
          document.querySelectorAll('.route-tool-btn').forEach(b => {
            b.style.borderColor = '#3d3448';
            b.style.background = '#1a1622';
          });
          btn.style.borderColor = '#f1c40f';
          btn.style.background = '#342918';
        });
      });

      // Type Selector
      const typeSelect = document.getElementById('routeTypeSelect');
      if (typeSelect) {
        typeSelect.addEventListener('change', (e) => { this.routeType = e.target.value; });
      }

      // Dropdown Selectors
      const selectA = document.getElementById('routeSelectNodeA');
      if (selectA) {
        selectA.addEventListener('change', (e) => {
          const worldData = this.getWorldData ? this.getWorldData() : null;
          this.selectedNodeA = worldData ? worldData.allNodes.find(n => n.id === e.target.value) : null;
          this.updateSelectionHighlights();
          this.updateUI();
        });
      }

      const selectB = document.getElementById('routeSelectNodeB');
      if (selectB) {
        selectB.addEventListener('change', (e) => {
          const worldData = this.getWorldData ? this.getWorldData() : null;
          this.selectedNodeB = worldData ? worldData.allNodes.find(n => n.id === e.target.value) : null;
          this.updateSelectionHighlights();
          this.updateUI();
        });
      }

      // Buttons
      const swapBtn = document.getElementById('routeSwapBtn');
      if (swapBtn) {
        swapBtn.addEventListener('click', () => {
          const tmp = this.selectedNodeA;
          this.selectedNodeA = this.selectedNodeB;
          this.selectedNodeB = tmp;
          this.updateSelectionHighlights();
          this.updateUI();
        });
      }

      const clearBtn = document.getElementById('routeClearBtn');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => this.clearSelection());
      }

      const connectBtn = document.getElementById('routeConnectBtn');
      if (connectBtn) {
        connectBtn.addEventListener('click', () => {
          this.connectNodes(this.selectedNodeA, this.selectedNodeB);
        });
      }

      const disconnectBtn = document.getElementById('routeDisconnectBtn');
      if (disconnectBtn) {
        disconnectBtn.addEventListener('click', () => {
          this.disconnectNodes(this.selectedNodeA, this.selectedNodeB);
        });
      }
    }
  }

  return new RouteEditorEngine();
}));